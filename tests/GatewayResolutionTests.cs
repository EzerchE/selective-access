using System;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

internal static class GatewayResolutionTests {
    private static int Checks;
    private static void Check(bool value, string label) { Checks++; if (!value) throw new Exception(label); }
    private static SelectiveAccessGateway.DnsAnswer Answer(int ttl = 30000) {
        return new SelectiveAccessGateway.DnsAnswer(new[] {IPAddress.Parse("1.1.1.1")}, ttl);
    }
    public static int Main() {
        try { Run().GetAwaiter().GetResult(); Console.WriteLine("Gateway resolution checks passed: " + Checks); return 0; }
        catch(Exception e) { Console.Error.WriteLine(e); return 1; }
    }
    private static async Task Run() {
        SelectiveAccessGateway.ResetEncryptedResolution();
        var calls=new System.Collections.Generic.List<SelectiveAccessGateway.DohProvider>();
        SelectiveAccessGateway.DohProvider unavailable=null;
        Func<SelectiveAccessGateway.DohProvider,string,CancellationToken,Task<SelectiveAccessGateway.DnsAnswer>> query=
            delegate(SelectiveAccessGateway.DohProvider provider,string host,CancellationToken token){
                calls.Add(provider);
                if(unavailable==null)unavailable=provider;
                if(Object.ReferenceEquals(provider,unavailable))throw new System.IO.IOException("fixture provider unavailable");
                return Task.FromResult(Answer());
            };
        await SelectiveAccessGateway.ResolveEncryptedAnswerAsync("first.example",CancellationToken.None,query);
        Check(calls.Count==2,"unavailable provider falls back");
        var working=calls[1];
        await SelectiveAccessGateway.ResolveEncryptedAnswerAsync("second.example",CancellationToken.None,query);
        Check(calls.Count==3&&Object.ReferenceEquals(calls[2],working),"next uncached hostname starts with proven provider");
        SelectiveAccessGateway.ResetEncryptedResolution();
        await SelectiveAccessGateway.ResolveEncryptedAnswerAsync("new-network.example",CancellationToken.None,query);
        Check(calls.Count==5,"network change clears provider preference");
        var empty=await SelectiveAccessGateway.ResolveEncryptedAnswerAsync("offline.example",CancellationToken.None,
            delegate(SelectiveAccessGateway.DohProvider p,string h,CancellationToken t){return Task.FromResult(new SelectiveAccessGateway.DnsAnswer(new IPAddress[0],0));});
        Check(empty.Addresses.Length==0,"all provider failures preserve system fallback path");
        SelectiveAccessGateway.ResetEncryptedResolution();
        var oldProviderReply=new TaskCompletionSource<SelectiveAccessGateway.DnsAnswer>();
        var oldProviderLookup=SelectiveAccessGateway.ResolveEncryptedAnswerAsync("old-network.example",CancellationToken.None,
            delegate(SelectiveAccessGateway.DohProvider p,string h,CancellationToken t){
                if(Object.ReferenceEquals(p,unavailable))throw new System.IO.IOException("fixture");
                return oldProviderReply.Task;
            });
        SelectiveAccessGateway.ResetEncryptedResolution();
        oldProviderReply.SetResult(Answer());await oldProviderLookup;
        int callsBeforeResetCheck=calls.Count;
        await SelectiveAccessGateway.ResolveEncryptedAnswerAsync("fresh-network.example",CancellationToken.None,query);
        Check(calls.Count==callsBeforeResetCheck+2,"old-network success cannot restore a stale provider preference");
        Check(SelectiveAccessGateway.AnswerLifetimeMs("{\"TTL\":60}","")==30000,"cache cap");
        Check(SelectiveAccessGateway.AnswerLifetimeMs("{\"TTL\":60},{\"TTL\":4}","Age: 1\r\n")==3000,"CNAME minimum and HTTP age");
        Check(SelectiveAccessGateway.AnswerLifetimeMs("{\"TTL\":2}","Age: 3")==0,"expired response not cached");
        Check(SelectiveAccessGateway.AnswerLifetimeMs("{\"TTL\":60}","Age: 40")==20000,"apply cache cap after subtracting age");
        foreach(string body in new[]{"{}","{\"TTL\":0}","{\"TTL\":-1},{\"TTL\":60}","{\"TTL\":99999999999999999999}","{\"TTL\":\"bad\"}"})
            Check(SelectiveAccessGateway.AnswerLifetimeMs(body,"")==0,"invalid/missing/zero TTL is not cached");
        long now=0;
        var cache=new SelectiveAccessGateway.AnswerCache(delegate {return now;});
        int lookups=0;
        var release=new TaskCompletionSource<bool>();
        Func<Task<SelectiveAccessGateway.DnsAnswer>> lookup=async delegate {
            Interlocked.Increment(ref lookups); await release.Task; return Answer(1000);
        };
        var wave=Enumerable.Range(0,32).Select(i=>cache.GetAsync(i%2==0?"burst.example":"BURST.example",lookup)).ToArray();
        Check(lookups==1,"32 parallel connections share one case-insensitive lookup");
        // Cancel one caller's wait, not the underlying shared operation.
        using(var cancelled=new CancellationTokenSource()) {
            var method=typeof(SelectiveAccessGateway).GetMethods(System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static)
                .Single(m=>m.Name=="WithCancellation"&&m.IsGenericMethod).MakeGenericMethod(typeof(SelectiveAccessGateway.DnsAnswer));
            var waiting=(Task<SelectiveAccessGateway.DnsAnswer>)method.Invoke(null,new object[]{wave[0],cancelled.Token});
            cancelled.Cancel();
            bool stopped=false;try{await waiting;}catch(OperationCanceledException){stopped=true;}
            Check(stopped,"production cancellation ends one caller's wait");
            Check(!wave[1].IsCompleted,"other callers remain alive");
        }
        release.SetResult(true);
        await Task.WhenAll(wave);
        await cache.GetAsync("burst.example",lookup);
        Check(lookups==1,"warm connection uses cached positive answer");
        now=1001;
        await cache.GetAsync("burst.example",lookup);
        Check(lookups==2,"expired answer is refreshed");
        cache.Invalidate("burst.example");
        await cache.GetAsync("burst.example",lookup);
        Check(lookups==3,"failed target can invalidate cached address");
        int failures=0;
        Func<Task<SelectiveAccessGateway.DnsAnswer>> failure=delegate { failures++;return Task.FromResult(new SelectiveAccessGateway.DnsAnswer(new IPAddress[0],0)); };
        await cache.GetAsync("failure.example",failure); await cache.GetAsync("failure.example",failure);
        Check(failures==2,"negative answers are never cached");
        int throws=0;
        Func<Task<SelectiveAccessGateway.DnsAnswer>> throwing=delegate { throws++;throw new Exception("fixture"); };
        await cache.GetAsync("throw.example",throwing);await cache.GetAsync("throw.example",throwing);
        Check(throws==2,"lookup exceptions do not poison pending entries");
        var stale=new TaskCompletionSource<SelectiveAccessGateway.DnsAnswer>();
        var old=cache.GetAsync("network.example",delegate{return stale.Task;});
        cache.Clear();
        await cache.GetAsync("network.example",delegate{return Task.FromResult(Answer());});
        stale.SetResult(Answer());
        Check((await old).Addresses.Length==0,"network change discards old in-flight answer");
        int fresh=0;
        await cache.GetAsync("network.example",delegate{fresh++;return Task.FromResult(Answer());});
        Check(fresh==0,"stale completion does not delete a new-network entry");
        cache.Clear();
        int missingTtl=0;
        Func<Task<SelectiveAccessGateway.DnsAnswer>> noTtl=delegate {missingTtl++;return Task.FromResult(Answer(0));};
        await cache.GetAsync("ttl.example",noTtl);await cache.GetAsync("ttl.example",noTtl);
        Check(missingTtl==2,"zero-TTL positive answer is not retained");
        var held=new TaskCompletionSource<SelectiveAccessGateway.DnsAnswer>();
        var slow=cache.GetAsync("slow.example",delegate{return held.Task;});
        var fast=await cache.GetAsync("independent.example",delegate{return Task.FromResult(Answer());});
        Check(fast.Addresses.Length==1&&!slow.IsCompleted,"one slow hostname does not serialize unrelated routed hosts");
        held.SetResult(Answer());await slow;
        for(int i=0;i<300;i++) await cache.GetAsync("host"+i+".example",delegate{return Task.FromResult(Answer());});
        int refreshed=0;
        await cache.GetAsync("host0.example",delegate{refreshed++;return Task.FromResult(Answer());});
        Check(refreshed==1,"bounded cache evicts old entries");

        // Controlled latency comparison: identical upstream cost, sequential
        // requests. This measures lookup removal, not real Internet speed.
        const int count=8;
        var clock=Stopwatch.StartNew();
        for(int i=0;i<count;i++) await Task.Delay(25);
        long baseline=clock.ElapsedMilliseconds;
        var measured=new SelectiveAccessGateway.AnswerCache();
        int actual=0;clock.Restart();
        for(int i=0;i<count;i++) await measured.GetAsync("timing.example",async delegate{actual++;await Task.Delay(25);return Answer();});
        Check(actual==1,"eight connections require one lookup instead of eight");
        Console.WriteLine("Controlled DNS wait: baseline="+baseline+"ms cached="+clock.ElapsedMilliseconds+"ms; lookups=8 -> "+actual);
    }
}

using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

internal static class LanShareTests {
    private static int Assertions;
    private static void Check(bool value, string message) { Assertions++; if (!value) throw new Exception(message); }
    private static IPAddress Ip(byte a, byte b, byte c, byte d) { return new IPAddress(new byte[] {a,b,c,d}); }
    public static int Main() {
        try { Run().GetAwaiter().GetResult(); Console.WriteLine("LAN policy and relay tests passed: " + Assertions); return 0; }
        catch(Exception e) { Console.Error.WriteLine(e); return 1; }
    }
    private static async Task Run() {
        bool waited=false;
        SelectiveAccessLanShare.StopAndWait(delegate {}, delegate { waited=true; });
        Check(waited,"successful stop verifies STOPPED");
        waited=false;
        SelectiveAccessLanShare.StopAndWait(delegate { throw new InvalidOperationException("stop race",new System.ComponentModel.Win32Exception(1062)); },delegate { waited=true; });
        Check(waited,"already-stopped race still verifies STOPPED");
        waited=false;
        SelectiveAccessLanShare.StopAndWait(delegate { throw new InvalidOperationException("stop pending",new System.ComponentModel.Win32Exception(1061)); },delegate { waited=true; });
        Check(waited,"stop-pending race still verifies STOPPED");
        bool denied=false;
        try { SelectiveAccessLanShare.StopAndWait(delegate { throw new InvalidOperationException("denied",new System.ComponentModel.Win32Exception(5)); },delegate {}); } catch(InvalidOperationException){denied=true;}
        Check(denied,"access denial is not swallowed");
        bool timedOut=false;
        try { SelectiveAccessLanShare.StopAndWait(delegate { throw new InvalidOperationException("stop race",new System.ComponentModel.Win32Exception(1062)); },delegate { throw new TimeoutException(); }); } catch(TimeoutException){timedOut=true;}
        Check(timedOut,"already-stopped race cannot hide failed state verification");
        var b = new SelectiveAccessLanShare.Binding { Address=Ip(192,168,50,10), Mask=Ip(255,255,255,0), InterfaceId=Guid.Empty.ToString() };
        Check(SelectiveAccessLanShare.Prefix(b.Mask)==24,"prefix");
        foreach (var target in new[]{Ip(127,0,0,1),Ip(192,168,50,20),Ip(10,0,0,1),Ip(169,254,1,1),Ip(100,64,0,1),Ip(224,0,0,1),IPAddress.IPv6Loopback}) Check(!SelectiveAccessGateway.PublicDestination(target),"private/linklocal/loopback destination blocked after resolution");
        Check(SelectiveAccessGateway.PublicDestination(Ip(1,1,1,1)),"public destination allowed");
        Check(!SelectiveAccessGateway.PublicDestination(Ip(127,0,0,1).MapToIPv6()),"mapped private destination refused");
        Check(SelectiveAccessLanShare.Prefix(Ip(255,0,255,0))==-1,"non-contiguous mask refused");
        for(int i=0;i<256;i++) Check(SelectiveAccessLanShare.PermittedPeer(Ip(192,168,50,(byte)i),b)==(i>0&&i<255),"host/network/broadcast classification");
        foreach(var remote in new []{Ip(192,168,51,10),Ip(10,0,0,1),Ip(127,0,0,1),Ip(169,254,1,1),Ip(8,8,8,8),IPAddress.IPv6Loopback}) Check(!SelectiveAccessLanShare.PermittedPeer(remote,b),"outside subnet/public/loopback/IPv6 refused");
        bool rejected=false;try{SelectiveAccessLanShare.ParseBinding("0.0.0.0","0.0.0.0",Guid.Empty.ToString());}catch{rejected=true;}Check(rejected,"wildcard address refused");
        string rule=SelectiveAccessLanShare.FirewallArguments(b,"test.exe");
        Check(rule.Contains("profile=private")&&rule.Contains("edge=no")&&rule.Contains("localport=1082")&&rule.Contains("service=SelectiveAccessLanGateway"),"firewall profile/port/edge/service scope");
        Check(rule.Contains("remoteip="+b.Subnet)&&rule.Contains("localip="+b.Address),"firewall subnet/interface scope");
        var fake = new TcpListener(IPAddress.Loopback,0); fake.Start();
        var relay = new TcpListener(IPAddress.Loopback,0); relay.Start();
        using(var stop=new CancellationTokenSource())using(var user=new TcpClient()) {
            await user.ConnectAsync(IPAddress.Loopback,((IPEndPoint)relay.LocalEndpoint).Port);
            var accepted=await relay.AcceptTcpClientAsync();
            var relayTask=SelectiveAccessLanShare.RelayAsync(accepted,stop.Token,((IPEndPoint)fake.LocalEndpoint).Port);
            await user.GetStream().WriteAsync(new byte[]{5,1,0},0,3);
            using(var backend=await fake.AcceptTcpClientAsync()) {
                byte[] bytes=new byte[3];int count=0;while(count<3)count+=await backend.GetStream().ReadAsync(bytes,count,3-count);
                Check(bytes[0]==5&&bytes[1]==1&&bytes[2]==0,"SOCKS greeting relayed intact");
                await backend.GetStream().WriteAsync(new byte[]{5,0},0,2);
                byte[] reply=new byte[2];count=0;while(count<2)count+=await user.GetStream().ReadAsync(reply,count,2-count);
                Check(reply[0]==5&&reply[1]==0,"backend reply relayed intact");
                byte[] payload=Encoding.ASCII.GetBytes("transport-test");await user.GetStream().WriteAsync(payload,0,payload.Length);
                byte[] echoed=new byte[payload.Length];count=0;while(count<echoed.Length)count+=await backend.GetStream().ReadAsync(echoed,count,echoed.Length-count);
                Check(Encoding.ASCII.GetString(echoed)=="transport-test","TCP payload preserved");
                stop.Cancel();
                Check(await Task.WhenAny(relayTask,Task.Delay(2000))==relayTask,"cancellation closes active relay");
            }
        }
        fake.Stop();relay.Stop();
        // A non-SOCKS connection is refused without contacting the backend.
        var reject=new TcpListener(IPAddress.Loopback,0);reject.Start();
        using(var user=new TcpClient()) {
            await user.ConnectAsync(IPAddress.Loopback,((IPEndPoint)reject.LocalEndpoint).Port);
            var client=await reject.AcceptTcpClientAsync();var work=SelectiveAccessLanShare.RelayAsync(client,CancellationToken.None,1);
            await user.GetStream().WriteAsync(new byte[]{71,69},0,2);
            Check(await Task.WhenAny(work,Task.Delay(2000))==work,"HTTP health forwarding refused");
        }
        reject.Stop();
    }
}

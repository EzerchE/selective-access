using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Security;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Authentication;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

internal static class SelectiveAccessGateway
{
    private const string ServiceName = "SelectiveAccessGateway";
    private static readonly IPAddress ListenAddress = IPAddress.Loopback;
    private static int ListenPort = 1080;
    private static int BackendPort = 1081;
    private const int SystemDnsTimeoutMs = 1200;
    private const int DohProviderTimeoutMs = 1800;
    private const int ConnectionSetupTimeoutMs = 7000;
    private static bool ConsoleMode;
    private static readonly CancellationTokenSource StopSource = new CancellationTokenSource();
    private static ServiceStatusHandle statusHandle;
    private static ServiceControlHandler controlHandler;
    private static ServiceMainFunction serviceMain;
    private static readonly AnswerCache EncryptedAnswers = new AnswerCache();
    private static readonly object ProviderGate = new object();
    private static int PreferredProvider;
    private static int ProviderGeneration;

    internal static void ResetEncryptedResolution() {
        lock (ProviderGate) { PreferredProvider = 0; ProviderGeneration++; }
        EncryptedAnswers.Clear();
    }

    internal sealed class DnsAnswer {
        internal readonly IPAddress[] Addresses;
        internal readonly int LifetimeMs;
        internal DnsAnswer(IPAddress[] addresses, int lifetimeMs) {
            Addresses = addresses; LifetimeMs = Math.Max(0, Math.Min(30000, lifetimeMs));
        }
    }

    // Only routed SOCKS hostnames enter this cache. No system DNS settings or
    // browser routes change; no lookup history is persisted to disk.
    internal sealed class AnswerCache {
        private sealed class Entry { internal DnsAnswer Answer; internal long Expires; }
        private readonly object Gate = new object();
        private readonly Dictionary<string, Entry> Cached = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Task<DnsAnswer>> Pending = new Dictionary<string, Task<DnsAnswer>>(StringComparer.OrdinalIgnoreCase);
        private readonly Func<long> Now;
        private int Generation;
        internal AnswerCache(Func<long> now = null) {
            Stopwatch clock = Stopwatch.StartNew();
            Now = now ?? delegate { return clock.ElapsedMilliseconds; };
        }
        internal Task<DnsAnswer> GetAsync(string host, Func<Task<DnsAnswer>> lookup) {
            TaskCompletionSource<DnsAnswer> completion;
            int generation;
            lock (Gate) {
                Entry entry;
                if (Cached.TryGetValue(host, out entry) && entry.Expires > Now()) return Task.FromResult(entry.Answer);
                Cached.Remove(host);
                Task<DnsAnswer> pending;
                if (Pending.TryGetValue(host, out pending)) return pending;
                // Bound bookkeeping even if a local client supplies many names.
                if (Pending.Count >= 256) return Task.FromResult(new DnsAnswer(new IPAddress[0], 0));
                completion = new TaskCompletionSource<DnsAnswer>(TaskCreationOptions.RunContinuationsAsynchronously);
                Pending.Add(host, completion.Task);
                generation = Generation;
            }
            Task ignored = LoadAsync(host, lookup, completion, generation);
            return completion.Task;
        }
        private async Task LoadAsync(string host, Func<Task<DnsAnswer>> lookup, TaskCompletionSource<DnsAnswer> completion, int generation) {
            DnsAnswer answer;
            try { answer = await lookup().ConfigureAwait(false); }
            catch { answer = new DnsAnswer(new IPAddress[0], 0); }
            lock (Gate) {
                if (generation != Generation) answer = new DnsAnswer(new IPAddress[0], 0);
                else {
                    Pending.Remove(host);
                    if (answer.Addresses.Length > 0 && answer.LifetimeMs > 0) {
                        if (Cached.Count >= 256) Cached.Clear();
                        Cached[host] = new Entry { Answer = answer, Expires = Now() + answer.LifetimeMs };
                    }
                }
            }
            completion.TrySetResult(answer);
        }
        internal void Invalidate(string host) { lock (Gate) Cached.Remove(host); }
        internal void Clear() { lock (Gate) { Generation++; Cached.Clear(); Pending.Clear(); } }
    }

    internal sealed class DohProvider
    {
        public string Host;
        public string Address;
        public string JsonPath;
        public DohProvider(string host, string address, string jsonPath)
        {
            Host = host;
            Address = address;
            JsonPath = jsonPath;
        }
    }

    // Fixed bootstrap addresses avoid depending on the system resolver. TLS still
    // authenticates the provider hostname. DNS transport stays separate from the
    // target DPI path so a backend strategy failure cannot deadlock resolution.
    private static readonly DohProvider[] DohProviders = {
        new DohProvider("cloudflare-dns.com", "1.1.1.1", "/dns-query"),
        new DohProvider("dns.google", "8.8.8.8", "/resolve")
    };

    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--console") {
            ConsoleMode = true;
            if (args.Length > 1) ListenPort = int.Parse(args[1]);
            if (args.Length > 2) BackendPort = int.Parse(args[2]);
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e) {
                e.Cancel = true;
                StopSource.Cancel();
            };
            RunAsync(StopSource.Token).GetAwaiter().GetResult();
            return 0;
        }

        controlHandler = ServiceControl;
        serviceMain = ServiceMain;
        ServiceTableEntry[] table = {
            new ServiceTableEntry { Name = ServiceName, Main = serviceMain },
            new ServiceTableEntry { Name = null, Main = null }
        };
        return StartServiceCtrlDispatcher(table) ? 0 : Marshal.GetLastWin32Error();
    }

    private static void ServiceMain(int argc, IntPtr argv)
    {
        statusHandle = RegisterServiceCtrlHandler(ServiceName, controlHandler);
        if (statusHandle.IsInvalid) return;
        ReportStatus(ServiceState.StartPending, 3000);
        ReportStatus(ServiceState.Running, 0);
        try { RunAsync(StopSource.Token).GetAwaiter().GetResult(); }
        catch { ReportStatus(ServiceState.Stopped, 0, 1); return; }
        ReportStatus(ServiceState.Stopped, 0);
    }

    private static void ServiceControl(uint control)
    {
        if (control == 1 || control == 5) {
            ReportStatus(ServiceState.StopPending, 3000);
            StopSource.Cancel();
        }
    }

    private static async Task RunAsync(CancellationToken token)
    {
        TcpListener listener = new TcpListener(ListenAddress, ListenPort);
        listener.Start(128);
        NetworkAddressChangedEventHandler changed = delegate { ResetEncryptedResolution(); };
        NetworkChange.NetworkAddressChanged += changed;
        using (token.Register(delegate { listener.Stop(); })) {
            try {
                while (!token.IsCancellationRequested) {
                    TcpClient client = await listener.AcceptTcpClientAsync().ConfigureAwait(false);
                    Task ignored = Task.Run(delegate { return HandleClientAsync(client, token); });
                }
            } catch (ObjectDisposedException) {
                if (!token.IsCancellationRequested) throw;
            } catch (SocketException) {
                if (!token.IsCancellationRequested) throw;
            }
            finally { listener.Stop(); NetworkChange.NetworkAddressChanged -= changed; ResetEncryptedResolution(); }
        }
    }

    private static async Task HandleClientAsync(TcpClient client, CancellationToken token)
    {
        using (client) {
            client.NoDelay = true;
            NetworkStream input = client.GetStream();
            byte[] head = await ReadExactAsync(input, 2, token).ConfigureAwait(false);
            // Chrome maps both "nothing is listening locally" and a reachable
            // SOCKS server reporting "target unreachable" to the same browser
            // error. A loopback-only HTTP health response lets the extension
            // distinguish those cases without probing any external host.
            if (head[0] == (byte)'G' && head[1] == (byte)'E') {
                byte[] health = Encoding.ASCII.GetBytes(
                    "HTTP/1.1 204 No Content\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Cache-Control: no-store\r\n" +
                    "Connection: close\r\n\r\n");
                await input.WriteAsync(health, 0, health.Length, token).ConfigureAwait(false);
                return;
            }
            if (head[0] != 5) return;
            await ReadExactAsync(input, head[1], token).ConfigureAwait(false);
            await input.WriteAsync(new byte[] { 5, 0 }, 0, 2, token).ConfigureAwait(false);

            byte[] request = await ReadExactAsync(input, 4, token).ConfigureAwait(false);
            if (request[0] != 5 || request[1] != 1) { await ReplyAsync(input, 7, token); return; }
            string host;
            if (request[3] == 1) host = new IPAddress(await ReadExactAsync(input, 4, token)).ToString();
            else if (request[3] == 4) host = new IPAddress(await ReadExactAsync(input, 16, token)).ToString();
            else if (request[3] == 3) {
                int length = (await ReadExactAsync(input, 1, token))[0];
                host = Encoding.ASCII.GetString(await ReadExactAsync(input, length, token));
            } else { await ReplyAsync(input, 8, token); return; }
            byte[] portBytes = await ReadExactAsync(input, 2, token).ConfigureAwait(false);
            int port = (portBytes[0] << 8) | portBytes[1];

            TcpClient backend = null;
            try {
                using (CancellationTokenSource setupSource = CancellationTokenSource.CreateLinkedTokenSource(token)) {
                    setupSource.CancelAfter(ConnectionSetupTimeoutMs);
                    CancellationToken setupToken = setupSource.Token;
                    IPAddress parsed;
                    if (IPAddress.TryParse(host, out parsed)) {
                        backend = await TryBackendAddressesAsync(new[] { parsed }, port, setupToken).ConfigureAwait(false);
                    } else {
                        // A routed hostname may have reached this gateway because the
                        // active network returned a synthetic DNS answer. Prefer an
                        // authenticated encrypted answer for routed names; fall back
                        // to the system resolver only when encrypted resolution does
                        // not produce an address. Literal IP requests stay unchanged.
                        IPAddress[] encryptedAddresses = await ResolveEncryptedAsync(host, setupToken).ConfigureAwait(false);
                        if (encryptedAddresses.Length > 0) {
                            backend = await TryBackendAddressesAsync(encryptedAddresses, port, setupToken).ConfigureAwait(false);
                        } else {
                            IPAddress[] systemAddresses = await ResolveSystemAsync(host).ConfigureAwait(false);
                            backend = await TryBackendAddressesAsync(systemAddresses, port, setupToken).ConfigureAwait(false);
                        }
                    }
                }
                if (backend == null) { EncryptedAnswers.Invalidate(host); await ReplyAsync(input, 4, token); return; }
                await ReplyAsync(input, 0, token).ConfigureAwait(false);
                using (backend) {
                    NetworkStream output = backend.GetStream();
                    Task a = input.CopyToAsync(output, 16384, token);
                    Task b = output.CopyToAsync(input, 16384, token);
                    await Task.WhenAny(a, b).ConfigureAwait(false);
                }
            } catch (Exception error) {
                EncryptedAnswers.Invalidate(host);
                Log("client: " + error.Message);
                try { ReplyAsync(input, 4, token).Wait(1000); } catch { }
            }
        }
    }

    private static async Task<IPAddress[]> ResolveSystemAsync(string host)
    {
        List<IPAddress> addresses = new List<IPAddress>();
        try {
            Task<IPAddress[]> lookup = Dns.GetHostAddressesAsync(host);
            if (await Task.WhenAny(lookup, Task.Delay(SystemDnsTimeoutMs)).ConfigureAwait(false) != lookup) {
                Log("system dns: timed out");
                return addresses.ToArray();
            }
            IPAddress[] system = await lookup.ConfigureAwait(false);
            foreach (IPAddress address in system)
                if (address.AddressFamily == AddressFamily.InterNetwork && !addresses.Contains(address)) addresses.Add(address);
        } catch (SocketException error) { Log("system dns: " + error.Message); }
        return addresses.ToArray();
    }

    private static async Task<IPAddress[]> ResolveEncryptedAsync(string host, CancellationToken token)
    {
        // One caller timing out must not cancel a lookup shared by other sockets.
        DnsAnswer answer = await WithCancellation(EncryptedAnswers.GetAsync(host, async delegate {
            using (CancellationTokenSource lookupSource = CancellationTokenSource.CreateLinkedTokenSource(StopSource.Token)) {
                lookupSource.CancelAfter(ConnectionSetupTimeoutMs);
                return await ResolveEncryptedAnswerAsync(host, lookupSource.Token).ConfigureAwait(false);
            }
        }), token).ConfigureAwait(false);
        return answer.Addresses;
    }

    internal static async Task<DnsAnswer> ResolveEncryptedAnswerAsync(string host, CancellationToken token,
        Func<DohProvider, string, CancellationToken, Task<DnsAnswer>> query = null)
    {
        if (query == null) query = ResolveDohAsync;
        // Reuse the last provider that returned an authenticated DNS answer.
        // A failing provider otherwise costs its full deadline for every new
        // dependency hostname. Only the existing provider set is used.
        int preferred, generation;
        lock (ProviderGate) { preferred = PreferredProvider; generation = ProviderGeneration; }
        DohProvider[] providers = new DohProvider[DohProviders.Length];
        for (int i = 0; i < providers.Length; i++) providers[i] = DohProviders[(preferred + i) % providers.Length];
        foreach (DohProvider provider in providers) {
            using (CancellationTokenSource providerSource =
                CancellationTokenSource.CreateLinkedTokenSource(token)) {
                providerSource.CancelAfter(DohProviderTimeoutMs);
                try {
                    DnsAnswer result = await query(
                        provider,
                        host,
                        providerSource.Token).ConfigureAwait(false);
                    if (result.Addresses.Length > 0) {
                        lock (ProviderGate) {
                            if (generation == ProviderGeneration) PreferredProvider = Array.IndexOf(DohProviders, provider);
                        }
                        return result;
                    }
                } catch (Exception error) {
                    Log("doh " + provider.Host + ": " + error.Message);
                }
            }
        }
        return new DnsAnswer(new IPAddress[0], 0);
    }

    private static async Task<TcpClient> TryBackendAddressesAsync(IPAddress[] addresses, int port, CancellationToken token)
    {
        foreach (IPAddress address in addresses) {
            if (!PublicDestination(address)) continue;
            try { return await ConnectBackendAsync(address, port, token).ConfigureAwait(false); }
            catch { }
        }
        return null;
    }

    // Enforce after DNS resolution as well as for literal IP requests. LAN
    // clients must not use this gateway to reach the host's private services.
    internal static bool PublicDestination(IPAddress address)
    {
        if (address == null || IPAddress.IsLoopback(address)) return false;
        if (address.IsIPv4MappedToIPv6) return PublicDestination(address.MapToIPv4());
        byte[] b = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork) {
            return !(b[0] == 0 || b[0] == 10 || b[0] == 127 || b[0] >= 224 ||
                (b[0] == 100 && b[1] >= 64 && b[1] <= 127) ||
                (b[0] == 169 && b[1] == 254) ||
                (b[0] == 172 && b[1] >= 16 && b[1] <= 31) ||
                (b[0] == 192 && (b[1] == 168 || (b[1] == 0 && (b[2] == 0 || b[2] == 2)))) ||
                (b[0] == 198 && (b[1] == 18 || b[1] == 19 || (b[1] == 51 && b[2] == 100))) ||
                (b[0] == 203 && b[1] == 0 && b[2] == 113));
        }
        return address.AddressFamily == AddressFamily.InterNetworkV6 &&
            (b[0] & 0xE0) == 0x20 && !(b[0] == 0x20 && b[1] == 1 && b[2] == 0x0d && b[3] == 0xb8);
    }

    private static async Task<DnsAnswer> ResolveDohAsync(DohProvider provider, string host, CancellationToken token)
    {
        using (TcpClient tunnel = await ConnectDirectAsync(IPAddress.Parse(provider.Address), 443, token).ConfigureAwait(false))
        using (SslStream tls = new SslStream(tunnel.GetStream(), false)) {
            tls.ReadTimeout = 10000;
            tls.WriteTimeout = 10000;
            await WithCancellation(
                tls.AuthenticateAsClientAsync(provider.Host, null, SslProtocols.Tls12, true),
                token).ConfigureAwait(false);
            string path = provider.JsonPath + "?name=" + Uri.EscapeDataString(host) + "&type=A";
            string request = "GET " + path + " HTTP/1.1\r\nHost: " + provider.Host +
                "\r\nAccept: application/dns-json\r\nConnection: close\r\nUser-Agent: SelectiveAccessGateway/1\r\n\r\n";
            byte[] bytes = Encoding.ASCII.GetBytes(request);
            await tls.WriteAsync(bytes, 0, bytes.Length, token).ConfigureAwait(false);
            using (StreamReader reader = new StreamReader(tls, Encoding.UTF8)) {
                string response = await WithCancellation(reader.ReadToEndAsync(), token).ConfigureAwait(false);
                int bodyIndex = response.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                if (!response.StartsWith("HTTP/1.1 200", StringComparison.Ordinal) || bodyIndex < 0) return new DnsAnswer(new IPAddress[0], 0);
                List<IPAddress> addresses = new List<IPAddress>();
                foreach (Match match in Regex.Matches(response.Substring(bodyIndex + 4), "\\\"data\\\"\\s*:\\s*\\\"([0-9.]+)\\\"")) {
                    IPAddress address;
                    if (IPAddress.TryParse(match.Groups[1].Value, out address) && address.AddressFamily == AddressFamily.InterNetwork)
                        addresses.Add(address);
                }
                return new DnsAnswer(addresses.ToArray(), AnswerLifetimeMs(response.Substring(bodyIndex + 4), response.Substring(0, bodyIndex)));
            }
        }
    }

    internal static int AnswerLifetimeMs(string body, string headers) {
        // Include CNAME TTLs, use the shortest record, and never cache a reply
        // without a valid TTL. HTTP Age is subtracted if a provider cached it.
        int seconds = int.MaxValue;
        MatchCollection ttls = Regex.Matches(body, "\\\"TTL\\\"\\s*:\\s*([^,}\\s]+)", RegexOptions.IgnoreCase);
        if (ttls.Count == 0) return 0;
        foreach (Match ttl in ttls) {
            int value;
            if (!int.TryParse(ttl.Groups[1].Value, out value) || value < 0) return 0;
            seconds = Math.Min(seconds, value);
        }
        Match age = Regex.Match(headers, @"(?im)^Age:\s*([0-9]+)");
        if (age.Success) {
            int value;
            if (!int.TryParse(age.Groups[1].Value, out value)) return 0;
            seconds = Math.Max(0, seconds - value);
        }
        return Math.Min(30, seconds) * 1000;
    }

    private static async Task<TcpClient> ConnectDirectAsync(IPAddress address, int port, CancellationToken token)
    {
        TcpClient client = new TcpClient(address.AddressFamily);
        try {
            await WithCancellation(client.ConnectAsync(address, port), token).ConfigureAwait(false);
            return client;
        } catch {
            client.Dispose();
            throw;
        }
    }

    private static async Task WithCancellation(Task operation, CancellationToken token)
    {
        using (CancellationTokenSource cancellation = CancellationTokenSource.CreateLinkedTokenSource(token)) {
            Task cancelled = Task.Delay(Timeout.Infinite, cancellation.Token);
            if (await Task.WhenAny(operation, cancelled).ConfigureAwait(false) != operation)
                throw new OperationCanceledException(token);
            cancellation.Cancel();
            await operation.ConfigureAwait(false);
        }
    }

    private static async Task<T> WithCancellation<T>(Task<T> operation, CancellationToken token)
    {
        using (CancellationTokenSource cancellation = CancellationTokenSource.CreateLinkedTokenSource(token)) {
            Task cancelled = Task.Delay(Timeout.Infinite, cancellation.Token);
            if (await Task.WhenAny(operation, cancelled).ConfigureAwait(false) != operation)
                throw new OperationCanceledException(token);
            cancellation.Cancel();
            return await operation.ConfigureAwait(false);
        }
    }

    private static async Task<TcpClient> ConnectBackendAsync(IPAddress address, int port, CancellationToken token)
    {
        TcpClient backend = new TcpClient(AddressFamily.InterNetwork);
        try {
            await WithCancellation(backend.ConnectAsync(IPAddress.Loopback, BackendPort), token).ConfigureAwait(false);
            NetworkStream stream = backend.GetStream();
            await stream.WriteAsync(new byte[] { 5, 1, 0 }, 0, 3, token).ConfigureAwait(false);
            byte[] greeting = await ReadExactAsync(stream, 2, token).ConfigureAwait(false);
            if (greeting[0] != 5 || greeting[1] != 0) throw new IOException("Backend authentication failed.");
            byte[] raw = address.GetAddressBytes();
            byte atyp = address.AddressFamily == AddressFamily.InterNetwork ? (byte)1 : (byte)4;
            byte[] connect = new byte[4 + raw.Length + 2];
            connect[0] = 5; connect[1] = 1; connect[2] = 0; connect[3] = atyp;
            Buffer.BlockCopy(raw, 0, connect, 4, raw.Length);
            connect[connect.Length - 2] = (byte)(port >> 8);
            connect[connect.Length - 1] = (byte)port;
            await stream.WriteAsync(connect, 0, connect.Length, token).ConfigureAwait(false);
            byte[] reply = await ReadExactAsync(stream, 4, token).ConfigureAwait(false);
            if (reply[1] != 0) throw new IOException("Backend connection failed.");
            int tail = reply[3] == 1 ? 4 : reply[3] == 4 ? 16 : (await ReadExactAsync(stream, 1, token))[0];
            await ReadExactAsync(stream, tail + 2, token).ConfigureAwait(false);
            return backend;
        } catch {
            backend.Dispose();
            throw;
        }
    }

    private static async Task<byte[]> ReadExactAsync(Stream stream, int count, CancellationToken token)
    {
        byte[] buffer = new byte[count];
        int offset = 0;
        while (offset < count) {
            int read = await stream.ReadAsync(buffer, offset, count - offset, token).ConfigureAwait(false);
            if (read == 0) throw new EndOfStreamException();
            offset += read;
        }
        return buffer;
    }

    private static Task ReplyAsync(Stream stream, byte code, CancellationToken token)
    {
        byte[] reply = { 5, code, 0, 1, 0, 0, 0, 0, 0, 0 };
        return stream.WriteAsync(reply, 0, reply.Length, token);
    }

    private static void Log(string message)
    {
        if (ConsoleMode) Console.Error.WriteLine(message);
    }

    private static void ReportStatus(ServiceState state, uint waitHint, uint exitCode = 0)
    {
        ServiceStatus status = new ServiceStatus {
            ServiceType = 0x10,
            CurrentState = state,
            ControlsAccepted = state == ServiceState.Running ? 5u : 0u,
            Win32ExitCode = exitCode,
            WaitHint = waitHint
        };
        SetServiceStatus(statusHandle, ref status);
    }

    private delegate void ServiceMainFunction(int argc, IntPtr argv);
    private delegate void ServiceControlHandler(uint control);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ServiceTableEntry { public string Name; public ServiceMainFunction Main; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ServiceStatus {
        public uint ServiceType; public ServiceState CurrentState; public uint ControlsAccepted;
        public uint Win32ExitCode; public uint ServiceSpecificExitCode; public uint CheckPoint; public uint WaitHint;
    }
    private enum ServiceState : uint { Stopped = 1, StartPending = 2, StopPending = 3, Running = 4 }
    private struct ServiceStatusHandle { public IntPtr Value; public bool IsInvalid { get { return Value == IntPtr.Zero; } } }
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool StartServiceCtrlDispatcher([In] ServiceTableEntry[] table);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern ServiceStatusHandle RegisterServiceCtrlHandler(string name, ServiceControlHandler handler);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool SetServiceStatus(ServiceStatusHandle handle, ref ServiceStatus status);
}

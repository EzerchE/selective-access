using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.ServiceProcess;
using System.Threading;
using System.Threading.Tasks;

// Optional relay. The established loopback gateway and backend stay unchanged.
internal static class SelectiveAccessLanShare
{
    internal const string Name = "SelectiveAccessLanGateway";
    internal const string RuleName = "Selective Access Private LAN SOCKS5";
    internal const int Port = 1082;
    private static readonly CancellationTokenSource Stop = new CancellationTokenSource();
    private static readonly SemaphoreSlim Slots = new SemaphoreSlim(64);
    private static IntPtr StatusHandle;
    private static MainDelegate ServiceEntry = ServiceMain;
    private static ControlDelegate ControlEntry = ServiceControl;
    private static Binding Selected;

    internal sealed class Binding {
        internal IPAddress Address;
        internal IPAddress Mask;
        internal string InterfaceId;
        internal string Description;
        internal string Subnet {
            get {
                byte[] a = Address.GetAddressBytes(), m = Mask.GetAddressBytes();
                byte[] n = new byte[4];
                for (int i = 0; i < 4; i++) n[i] = (byte)(a[i] & m[i]);
                return new IPAddress(n) + "/" + Prefix(Mask);
            }
        }
    }

    public static int Main(string[] args) {
        bool elevatedWindow = args.Length == 2 && args[1] == "--elevated";
        if (elevatedWindow) args = new string[] { args[0] };
        try {
            if (args.Length == 4 && args[0] == "--service") {
                Selected = ParseBinding(args[1], args[2], args[3]);
                Entry[] table = { new Entry { Name = Name, Main = ServiceEntry }, new Entry() };
                return StartServiceCtrlDispatcher(table) ? 0 : Marshal.GetLastWin32Error();
            }
            if (args.Length == 1 && args[0] == "--status") return ShowStatus();
            if (args.Length != 1 || (args[0] != "--on" && args[0] != "--off")) {
                Console.WriteLine("Usage: --on | --off | --status"); return 1;
            }
            string installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SelectiveAccess", "SelectiveAccessLanShare.exe");
            if (!String.Equals(installed, Process.GetCurrentProcess().MainModule.FileName, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("Run helper/install.cmd first, then helper/share.cmd.");
            }
            if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) {
                using (Process p = Process.Start(new ProcessStartInfo(installed, args[0] + " --elevated") { UseShellExecute = true, Verb = "runas" })) {
                    p.WaitForExit();
                    if (p.ExitCode == 0) ShowStatus();
                    return p.ExitCode;
                }
            }
            if (args[0] == "--off") { Disable(); Console.WriteLine("LAN sharing is OFF. Local gateway is unchanged."); return 0; }
            Enable(installed);
            return 0;
        } catch (Exception e) { Console.Error.WriteLine("LAN sharing: " + e.Message); return 1; }
        finally { if (elevatedWindow) { Console.WriteLine("Press Enter / Devam icin Enter"); Console.ReadLine(); } }
    }

    internal static int Prefix(IPAddress mask) {
        if (mask == null || mask.AddressFamily != AddressFamily.InterNetwork) return -1;
        int bits = 0; bool zero = false;
        foreach (byte b in mask.GetAddressBytes()) for (int i = 7; i >= 0; i--) {
            if ((b & (1 << i)) != 0) { if (zero) return -1; bits++; } else zero = true;
        }
        return bits;
    }

    internal static bool PrivateV4(IPAddress ip) {
        if (ip == null || ip.AddressFamily != AddressFamily.InterNetwork) return false;
        byte[] b = ip.GetAddressBytes();
        return b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168);
    }

    internal static Binding ParseBinding(string ip, string mask, string id) {
        IPAddress a, m;
        if (!IPAddress.TryParse(ip, out a) || !PrivateV4(a) || !IPAddress.TryParse(mask, out m) || Prefix(m) < 8 || Prefix(m) > 30) throw new InvalidOperationException("A private IPv4 address and a contiguous /8 to /30 subnet are required.");
        Guid parsed;
        if (!Guid.TryParse(id, out parsed)) throw new InvalidOperationException("Invalid interface identifier.");
        return new Binding { Address = a, Mask = m, InterfaceId = parsed.ToString() };
    }

    internal static bool PermittedPeer(IPAddress peer, Binding binding) {
        if (!PrivateV4(peer)) return false;
        byte[] p = peer.GetAddressBytes(), a = binding.Address.GetAddressBytes(), m = binding.Mask.GetAddressBytes();
        if (Prefix(binding.Mask) < 8 || Prefix(binding.Mask) > 30) return false;
        bool network = true, broadcast = true;
        for (int i = 0; i < 4; i++) {
            if ((p[i] & m[i]) != (a[i] & m[i])) return false;
            if ((p[i] & ~m[i]) != 0) network = false;
            if ((p[i] | m[i]) != 255) broadcast = false;
        }
        return !network && !broadcast;
    }

    private static List<Binding> Interfaces() {
        List<Binding> result = new List<Binding>();
        foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces()) {
            if (nic.OperationalStatus != OperationalStatus.Up || (nic.NetworkInterfaceType != NetworkInterfaceType.Ethernet && nic.NetworkInterfaceType != NetworkInterfaceType.Wireless80211)) continue;
            foreach (UnicastIPAddressInformation u in nic.GetIPProperties().UnicastAddresses) {
                if (!PrivateV4(u.Address) || Prefix(u.IPv4Mask) < 8 || Prefix(u.IPv4Mask) > 30) continue;
                Binding b = ParseBinding(u.Address.ToString(), u.IPv4Mask.ToString(), nic.Id);
                b.Description = nic.Name; result.Add(b);
            }
        }
        return result;
    }

    private static bool PrivateFirewall() {
        object policy = null;
        try {
            policy = Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FwPolicy2"));
            dynamic firewall = policy;
            // Mixed Public/Private and Domain networks are refused deliberately.
            if ((int)firewall.CurrentProfileTypes != 2 || !(bool)firewall.FirewallEnabled[2]) return false;
            object excluded = firewall.ExcludedInterfaces[2];
            Array interfaces = excluded as Array;
            return interfaces == null || interfaces.Length == 0;
        } catch { return false; }
        finally { if (policy != null && Marshal.IsComObject(policy)) Marshal.FinalReleaseComObject(policy); }
    }

    private static bool BindingPresent(Binding b) {
        foreach (Binding current in Interfaces()) if (current.InterfaceId == b.InterfaceId && current.Address.Equals(b.Address) && current.Mask.Equals(b.Mask)) return true;
        return false;
    }

    private static int Command(string program, string arguments, bool required) {
        using (Process p = Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, program), arguments) { UseShellExecute = false, CreateNoWindow = true })) {
            if (!p.WaitForExit(30000)) { try { p.Kill(); } catch { } throw new IOException(program + " timed out."); }
            if (required && p.ExitCode != 0) throw new IOException(program + " failed; exit " + p.ExitCode);
            return p.ExitCode;
        }
    }

    private static bool ServiceExists() {
        foreach (ServiceController s in ServiceController.GetServices()) using (s) { if (s.ServiceName == Name) return true; }
        return false;
    }

    private static void Disable() {
        // Remove only the exact project rule; never disable/reset the firewall.
        int ruleResult = Command("netsh.exe", "advfirewall firewall delete rule name=\"" + RuleName + "\"", false);
        if (ServiceExists()) {
            using (ServiceController service = new ServiceController(Name)) {
                if (service.Status != ServiceControllerStatus.Stopped) { service.Stop(); service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(15)); }
            }
            Command("sc.exe", "delete " + Name, true);
            for (int i = 0; i < 100 && ServiceExists(); i++) Thread.Sleep(100);
            if (ServiceExists()) throw new IOException("LAN service removal could not be verified.");
        }
        // netsh returns 1 when no rule matched; verify absence through the COM API.
        object policy = null;
        try {
            policy = Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FwPolicy2")); dynamic fw = policy;
            foreach (dynamic rule in fw.Rules) if ((string)rule.Name == RuleName) throw new IOException("LAN firewall rule removal could not be verified (exit " + ruleResult + ").");
        } finally { if (policy != null && Marshal.IsComObject(policy)) Marshal.FinalReleaseComObject(policy); }
    }

    private static void Enable(string installed) {
        if (!PrivateFirewall()) throw new InvalidOperationException("Only a Private Windows network with its firewall enabled is supported. Public, Domain and mixed profiles are refused.");
        using (ServiceController gateway = new ServiceController("SelectiveAccessGateway")) if (gateway.Status != ServiceControllerStatus.Running) throw new InvalidOperationException("Start/install the local gateway first.");
        List<Binding> choices = Interfaces();
        if (choices.Count == 0) throw new InvalidOperationException("No eligible private Ethernet/Wi-Fi IPv4 interface found.");
        int index = 0;
        if (choices.Count > 1) {
            for (int i = 0; i < choices.Count; i++) Console.WriteLine((i+1) + ": " + choices[i].Description + "  " + choices[i].Address + "  " + choices[i].Subnet);
            Console.Write("Choose interface / Ag arabirimi: ");
            if (!int.TryParse(Console.ReadLine(), out index) || index < 1 || index > choices.Count) throw new InvalidOperationException("No interface selected.");
            index--;
        }
        Binding selected = choices[index];
        if (!PermittedPeer(selected.Address, selected)) throw new InvalidOperationException("The selected address is a network/broadcast address.");
        Disable();
        try {
            Command("sc.exe", "create " + Name + " binPath= \"\\\"" + installed + "\\\" --service " + selected.Address + " " + selected.Mask + " " + selected.InterfaceId + "\" start= auto depend= SelectiveAccessGateway obj= \"NT AUTHORITY\\LocalService\"", true);
            Command("netsh.exe", FirewallArguments(selected, installed), true);
            Command("sc.exe", "start " + Name, true);
            using (ServiceController service = new ServiceController(Name)) service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(10));
            Console.WriteLine("LAN sharing ON / Paylasim ACIK: SOCKS5 " + selected.Address + ":" + Port);
            Console.WriteLine("Allowed subnet / Izinli alt ag: " + selected.Subnet);
            Console.WriteLine("Other computers: Extension > Custom proxy > SOCKS5, server " + selected.Address + ", port " + Port);
            Console.WriteLine("Use only on a trusted private LAN. Do not forward the port on your router.");
        } catch { try { Disable(); } catch { } throw; }
    }

    internal static string FirewallArguments(Binding selected, string installed) {
        return "advfirewall firewall add rule name=\"" + RuleName + "\" dir=in action=allow protocol=TCP localip=" + selected.Address + " localport=" + Port + " remoteip=" + selected.Subnet + " profile=private program=\"" + installed + "\" service=" + Name + " edge=no enable=yes";
    }

    private static int ShowStatus() {
        if (!ServiceExists()) { Console.WriteLine("LAN sharing OFF / Paylasim KAPALI"); return 0; }
        using (ServiceController service = new ServiceController(Name)) Console.WriteLine("LAN service: " + service.Status);
        Console.WriteLine("Private firewall eligible: " + PrivateFirewall());
        string image = Convert.ToString(Microsoft.Win32.Registry.GetValue(@"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\" + Name, "ImagePath", ""));
        var binding = System.Text.RegularExpressions.Regex.Match(image, @"--service ([0-9.]+) ([0-9.]+) ([a-fA-F0-9-]+)");
        if (binding.Success) Console.WriteLine("Client / Istemci: SOCKS5 server=" + binding.Groups[1].Value + " port=" + Port);
        return 0;
    }

    private static void ServiceMain(int argc, IntPtr argv) {
        StatusHandle = RegisterServiceCtrlHandler(Name, ControlEntry);
        if (StatusHandle == IntPtr.Zero) return;
        Report(2, 0);
        try { RunAsync().GetAwaiter().GetResult(); Report(1, 0); }
        catch { Report(1, 1); }
    }
    private static void ServiceControl(uint code) { if (code == 1 || code == 5) { Report(3, 0); Stop.Cancel(); } }
    private static void Report(uint state, uint error) {
        Status s = new Status { Type = 0x10, State = state, Controls = state == 4 ? 5u : 0u, Error = error, Wait = state == 2 || state == 3 ? 3000u : 0u };
        SetServiceStatus(StatusHandle, ref s);
    }

    private static async Task RunAsync() {
        if (!PrivateFirewall() || !BindingPresent(Selected)) throw new InvalidOperationException("Private network binding unavailable.");
        TcpListener listener = new TcpListener(Selected.Address, Port); listener.Start(64); Report(4, 0);
        using (Stop.Token.Register(delegate { listener.Stop(); }))
        using (Timer monitor = new Timer(delegate { if (!PrivateFirewall() || !BindingPresent(Selected)) Stop.Cancel(); }, null, 2000, 2000)) {
            try {
                while (!Stop.IsCancellationRequested) {
                    TcpClient client = await listener.AcceptTcpClientAsync().ConfigureAwait(false);
                    if (!PrivateFirewall() || !BindingPresent(Selected) || !PermittedPeer(((IPEndPoint)client.Client.RemoteEndPoint).Address, Selected) || !Slots.Wait(0)) { client.Close(); continue; }
                    Task ignored = RelayAsync(client, Stop.Token).ContinueWith(delegate { Slots.Release(); });
                }
            } catch (ObjectDisposedException) { if (!Stop.IsCancellationRequested) throw; }
            catch (SocketException) { if (!Stop.IsCancellationRequested) throw; }
            finally { listener.Stop(); }
        }
    }

    internal static async Task RelayAsync(TcpClient client, CancellationToken token, int backendPort = 1080) {
        using (client)
        using (TcpClient backend = new TcpClient())
        using (token.Register(delegate { client.Close(); backend.Close(); })) {
            try {
                client.NoDelay = true; backend.NoDelay = true;
                // Initial SOCKS greeting and connect are bounded; idle clients
                // cannot consume every slot indefinitely without a greeting.
                using (CancellationTokenSource setup = CancellationTokenSource.CreateLinkedTokenSource(token)) {
                    setup.CancelAfter(5000);
                    using (setup.Token.Register(delegate { client.Close(); })) {
                        byte[] greeting = new byte[2]; int offset = 0;
                        NetworkStream input = client.GetStream();
                        while (offset < 2) { int n = await input.ReadAsync(greeting, offset, 2-offset, setup.Token).ConfigureAwait(false); if (n == 0) return; offset += n; }
                        if (greeting[0] != 5 || greeting[1] == 0) return;
                        byte[] methods = new byte[greeting[1]]; offset = 0;
                        while (offset < methods.Length) { int n = await input.ReadAsync(methods, offset, methods.Length-offset, setup.Token).ConfigureAwait(false); if (n == 0) return; offset += n; }
                        if (Array.IndexOf(methods, (byte)0) < 0) { await input.WriteAsync(new byte[] {5,255}, 0, 2, setup.Token).ConfigureAwait(false); return; }
                        Task connect = backend.ConnectAsync(IPAddress.Loopback, backendPort);
                        if (await Task.WhenAny(connect, Task.Delay(3000, setup.Token)).ConfigureAwait(false) != connect) return;
                        await connect.ConfigureAwait(false);
                        await backend.GetStream().WriteAsync(greeting, 0, greeting.Length, setup.Token).ConfigureAwait(false);
                        await backend.GetStream().WriteAsync(methods, 0, methods.Length, setup.Token).ConfigureAwait(false);
                    }
                }
                Task a = client.GetStream().CopyToAsync(backend.GetStream(), 16384, token);
                Task b = backend.GetStream().CopyToAsync(client.GetStream(), 16384, token);
                await Task.WhenAny(a, b).ConfigureAwait(false);
            } catch (Exception) { /* No URLs, traffic or client identifiers are logged. */ }
        }
    }

    private delegate void MainDelegate(int argc, IntPtr argv);
    private delegate void ControlDelegate(uint code);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] private struct Entry { public string Name; public MainDelegate Main; }
    [StructLayout(LayoutKind.Sequential)] private struct Status { public uint Type, State, Controls, Error, SpecificError, Checkpoint, Wait; }
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool StartServiceCtrlDispatcher([In] Entry[] table);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern IntPtr RegisterServiceCtrlHandler(string name, ControlDelegate handler);
    [DllImport("advapi32.dll", SetLastError=true)] private static extern bool SetServiceStatus(IntPtr handle, ref Status status);
}

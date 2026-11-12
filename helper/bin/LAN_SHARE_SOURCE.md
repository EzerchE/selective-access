# Optional LAN sharing build record

- Source: helper/source/SelectiveAccessLanShare.cs
- Build: helper/source/build-lan-share.cmd (Windows .NET Framework 4.x)
- SHA-256: D8E64F0CD1B2855BF1F43765A63DDC669B7EF61536B9E849A00492360D667517
- License: repository root LICENSE (MIT)

This separate LocalService relay exposes SOCKS5 only on one explicitly selected RFC1918 Ethernet/Wi-Fi interface, port 1082. Its firewall rule is limited to that interface/IP, matching subnet, executable, service, TCP port, Private profile and no edge traversal. Application peer checks repeat the subnet and private-address restrictions. Public/Domain/mixed profiles, disabled firewalls and excluded firewall interfaces are refused. An interface/profile change cancels the listener and active connections. The loopback gateway and ByeDPI backend are unchanged; install/update defaults sharing OFF. The controller changes only this project's dedicated service/rule. No traffic is logged.

# Optional Windows ByeDPI helper

The 4.18.1 helper requires .NET Framework 4.6 or later. It is prepared for current Windows 10/11 runtimes; older runtimes have not been validated.

## Optional private-LAN sharing (4.18.0)

After installation, double-click share.cmd. Choose 1 to enable, 2 to disable, or 3 for status. Changes request administrator approval. ON prints the selected server address and port 1082; another computer uses Custom proxy → SOCKS5 with that address/port and needs no helper. Multiple eligible interfaces require selection.

Sharing starts OFF after install/update. It supports only private IPv4 Ethernet/Wi-Fi, an enabled Private-profile firewall with no excluded interfaces, and clients from that exact subnet. Public/Domain/mixed profiles are refused. Network changes stop sharing and active connections. OFF removes the separate LAN service/rule while retaining the loopback helper. uninstall.cmd removes both. No firewall profile or DNS setting is changed. Public destinations only; LAN clients cannot proxy into private/loopback services. Use a trusted LAN: there is no client authentication. Do not forward port 1082 from your router.

Kurulumdan sonra share.cmd dosyasını açın: 1 paylaşımı açar, 2 kapatır, 3 sunucu adresi ve durumu gösterir. Diğer bilgisayarda Özel proxy → SOCKS5, gösterilen adres ve 1082 portunu kaydedin. İstemcide yardımcı/yönetici izni gerekmez. Sunucudaki değişiklikler yönetici onayı ister. Paylaşım kurulum/güncelleme sonrası kapalıdır; yalnız Özel ağ ve aynı alt ağ desteklenir. Kapatma yalnız LAN hizmetini/kuralını, uninstall.cmd tüm yardımcıları kaldırır.

This helper is separate from the Chrome extension and is optional if you already have a compatible proxy.

1. Extract the complete archive. Keep the helper folder and its contents together.
2. Right-click install.cmd → Run as administrator. Review the result; installation must complete successfully.
3. In Automatic Access, select Bundled local gateway, agree and save, then Check again. A healthy local endpoint reports ready.
4. To remove only the helper, first switch the extension off or save another proxy. Right-click uninstall.cmd → Run as administrator.
5. Removing the Chrome extension alone does not remove the Windows services. If this folder was deleted, download/extract the helper archive again to obtain the uninstaller.

Services: SelectiveAccessGateway and SelectiveAccessByeDPI. Local endpoints: 127.0.0.1:1080 and 127.0.0.1:1081. DNS adapter settings are not modified. Installation and removal require Windows administrator permission. The package is unsigned; existing hash checks verify expected bundled binary integrity, not publisher identity.

## Türkçe

4.18.1 yardımcısı .NET Framework 4.6 veya üzerini gerektirir. Güncel Windows 10/11 çalışma ortamları için hazırlanmıştır; eski çalışma ortamlarında doğrulanmamıştır.

Mevcut uyumlu proxy'niz varsa bu yardımcıyı kurmanız gerekmez.

1. ZIP'in tamamını çıkarın; helper klasörü ve içeriğini birlikte tutun.
2. install.cmd → sağ tık → Yönetici olarak çalıştır. Başarılı sonucu kontrol edin.
3. Eklentiden yerel geçidi seçin, kabul edip kaydedin ve yeniden denetleyin. Hazır sonucu görünmelidir.
4. Yalnız yardımcıyı kaldırmak için önce eklentiyi kapatın veya başka proxy kaydedin. uninstall.cmd dosyasını yönetici olarak çalıştırın.
5. Chrome eklentisini kaldırmak Windows hizmetlerini kaldırmaz. Klasör silindiyse kaldırıcı için yardımcı paketini yeniden indirip çıkarın.

Paket imzasızdır; hash kontrolleri beklenen ikililerin bütünlüğünü doğrular, yayıncı kimliğini değil. DNS adaptör ayarları değiştirilmez.

# Optional Windows ByeDPI helper

This helper is separate from the Chrome extension and is optional if you already have a compatible proxy.

1. Extract the complete archive. Keep the helper folder and its contents together.
2. Right-click install.cmd → Run as administrator. Review the result; installation must complete successfully.
3. In Automatic Access, select Bundled local gateway, agree and save, then Check again. A healthy local endpoint reports ready.
4. To remove only the helper, first switch the extension off or save another proxy. Right-click uninstall.cmd → Run as administrator.
5. Removing the Chrome extension alone does not remove the Windows services. If this folder was deleted, download/extract the helper archive again to obtain the uninstaller.

Services: SelectiveAccessGateway and SelectiveAccessByeDPI. Local endpoints: 127.0.0.1:1080 and 127.0.0.1:1081. DNS adapter settings are not modified. Installation and removal require Windows administrator permission. The package is unsigned; existing hash checks verify expected bundled binary integrity, not publisher identity.

## Türkçe

Mevcut uyumlu proxy'niz varsa bu yardımcıyı kurmanız gerekmez.

1. ZIP'in tamamını çıkarın; helper klasörü ve içeriğini birlikte tutun.
2. install.cmd → sağ tık → Yönetici olarak çalıştır. Başarılı sonucu kontrol edin.
3. Eklentiden yerel geçidi seçin, kabul edip kaydedin ve yeniden denetleyin. Hazır sonucu görünmelidir.
4. Yalnız yardımcıyı kaldırmak için önce eklentiyi kapatın veya başka proxy kaydedin. uninstall.cmd dosyasını yönetici olarak çalıştırın.
5. Chrome eklentisini kaldırmak Windows hizmetlerini kaldırmaz. Klasör silindiyse kaldırıcı için yardımcı paketini yeniden indirip çıkarın.

Paket imzasızdır; hash kontrolleri beklenen ikililerin bütünlüğünü doğrular, yayıncı kimliğini değil. DNS adaptör ayarları değiştirilmez.

# Chrome Web Store hazırlık durumu

## Teknik durum

- Manifest V3 kullanılır ve uzaktan JavaScript çalıştırılmaz.
- Tek amaç, bağlantı hatası doğrulanan alan adlarını yerel geçide seçici yönlendirmektir.
- Varsayılan durum kapalıdır.
- `activeTab`, `notifications`, `proxy`, `scripting`, `storage`, `webRequest` ve HTTP/HTTPS/WS/WSS erişimleri README ile gizlilik bildiriminde açıklanır.
- Tam URL depolanmaz veya dış hizmete gönderilmez; otomatik probe yalnız temizlenmiş origin kökünü sınar.
- İsteğe bağlı dış durum kontrolü yalnız kullanıcı eylemiyle alan adı gönderir.

## Gönderimden önce zorunlu işler

- Mağaza ZIP'ine yardımcı ikili, testler, geliştirme betikleri ve depo belgeleri dahil edilmemelidir.
- Yerel yardımcı ayrı, hash doğrulamalı ve tercihen kod imzalı masaüstü paketi olarak dağıtılmalıdır.
- Mağaza açıklaması yerel yardımcının gerekli olduğunu açıkça belirtmelidir.
- Yayıncı kimliği, destek URL'si, herkese açık gizlilik politikası URL'si, mağaza ikonu ve ekran görüntüleri tamamlanmalıdır.
- Developer Dashboard veri kullanımı formu `PRIVACY.md` ve gerçek izinlerle birebir eşleşmelidir.
- Paket, temiz Chrome profilinde inceleme ekibinin uygulayabileceği kurulum ve kaldırma adımlarıyla sınanmalıdır.
- İsteğe bağlı Buy Me a Coffee bağlantısı mağaza açıklamasında belirtilmeli; bağlantının yalnız kullanıcı eylemiyle açıldığı ve eklentide uzak ödeme/destek betiği çalışmadığı doğrulanmalıdır.

Bu maddeler tamamlanmadan Chrome Web Store gönderimi yapılmamalıdır.

## Gelir modeli

Sayfalara reklam, affiliate kodu veya izleme bileşeni enjekte edilmez. Uygun seçenekler; açıkça belirtilen lisans, isteğe bağlı abonelik, bağış veya ayrı destek planıdır. Gezinme verileri hiçbir gelir modelinde reklam hedefleme amacıyla kullanılamaz.

# Gizlilik bildirimi

Son güncelleme: 25 Ağustos 2026

Otomatik Erişim, bağlantı hatası yaşayan alan adlarını kullanıcının kendi bilgisayarındaki yerel SOCKS5 geçidine seçici yönlendirir. Geliştiriciye ait telemetri, analiz, reklam veya uzaktan günlük sunucusu yoktur.

## Cihazda işlenen veriler

Eklenti HTTP/HTTPS/WS/WSS isteklerinde Chrome'un bildirdiği bağlantı hata türünü, istek türünü ve alan adını geçici olarak işler. Chrome tam istek adresini olay içinde sağlayabilir; eklenti bundan yalnız alan adını türetir ve tam adresi depolamaz.

Otomatik doğrulama ve yönlendirmenin artık gerekip gerekmediğini denetleme sırasında kullanıcı bilgisi, yol, sorgu ve fragment kaldırılır. Yalnız hedef origin'in kökü; çerezsiz, kimlik bilgisi olmadan ve sınırlı içerik isteğiyle doğrudan sınanır. Art arda iki doğrudan yanıt alınırsa ilgili kural cihazdaki listeden kaldırılır.

Şunlar `chrome.storage.local` içinde yalnız cihazda tutulabilir:

- etkinlik ve yerel geçit ayarı;
- öğrenilen ve yoksayılan alan adları;
- son bağlantı durumu ve bildirim sonucu;
- kullanıcı özellikle açarsa son 150 sınırlı teşhis olayı.

Teşhis kayıtları tam URL, sorgu parametresi, çerez, form verisi, sayfa içeriği veya kullanıcı hesabı bilgisi içermez. Kayıtlar kullanıcı tarafından temizlenebilir.

## Üçüncü tarafa aktarım

Kullanıcı **Genel durumu kontrol et** düğmesine özellikle basarsa yalnız kontrol edilen alan adı Globalping API'sine gönderilir. Bu işlem otomatik değildir. Sağlayıcının kendi kayıt ve saklama koşulları geçerlidir.

Otomatik yönlendirmeye alınmış bir alan adı sistem DNS'iyle çözülemezse veya sistem yanıtını tamamlamak gerekirse yerel geçit yalnız bu alan adını şifreli DNS sağlayıcısına gönderebilir. Sağlayıcılar sırayla denenir; sorgu iki sağlayıcıya aynı anda yayılmaz. Yol, sorgu parametreleri, çerezler ve sayfa içeriği gönderilmez. Bu işlem normal ve yönlendirilmemiş bağlantıların DNS davranışını değiştirmez.

Bunun dışında geliştiriciye veya başka bir dış hizmete gezinme verisi gönderilmez. Yerel yardımcı yalnız kullanıcının bilgisayarında çalışır; yönlendirilen HTTPS içeriği şifreli kalır ve yerel geçit tarafından çözülmez.

Popup ve README içindeki isteğe bağlı destek bağlantısı yalnız kullanıcı tıkladığında Buy Me a Coffee sayfasını yeni sekmede açar. Eklenti üçüncü taraf destek betiği yüklemez ve bu platforma otomatik veri göndermez; açılan sayfanın kendi gizlilik koşulları geçerlidir.

## Saklama ve silme

Yerel ayarlar kullanıcı silene, Chrome eklenti verilerini temizleyene veya eklentiyi kaldırana kadar cihazda kalabilir. Windows hizmeti ve program dosyaları ayrıca `helper/uninstall.cmd` ile kaldırılır. Kaldırıcı DNS veya başka ağ ayarlarını değiştirmez.

## İzinlerin amacı

- `webRequest` ve HTTP/HTTPS/WS/WSS erişimi: desteklenen ağ hatalarını ve başarılı ana sayfa yanıtlarını algılamak.
- `proxy`: yalnız öğrenilen alan adları için yerel PAC/SOCKS5 yönlendirmesi uygulamak.
- `storage`: yerel ayar, alan adı listesi ve isteğe bağlı teşhis verisini saklamak.
- `activeTab`: popup açıldığında etkin sekmenin alan adını göstermek ve kullanıcı işlemini ilgili sekmeye uygulamak.
- `notifications`: yerel durum bildirimleri göstermek.
- `scripting`: yalnız öğrenilen harici iframe'i üst sayfayı yenilemeden yeniden yüklemek.

## Veri kullanımı taahhüdü

Veriler satılmaz, reklam hedefleme veya kredi değerlendirmesi için kullanılmaz ve ürünün tek amacının dışına aktarılmaz. İnsanların verileri görmesine yalnız güvenlik, yasal zorunluluk veya kullanıcının açık destek talebi kapsamında ihtiyaç duyulabilir; ürün normal çalışırken geliştirici cihazdaki verilere erişemez.

Ürünün veri kullanımı Chrome Web Store Limited Use şartlarına uygun tutulmak üzere tasarlanmıştır. Mağaza beyanı, bu belge ve gerçek ürün davranışı her sürümden önce birlikte doğrulanmalıdır.

Gizlilik soruları GitHub Issues üzerinden, güvenlik bildirimleri `SECURITY.md` içindeki kanal üzerinden iletilebilir. Destek taleplerine gezinme günlükleri veya başka hassas bilgiler eklenmemelidir.

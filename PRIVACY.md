# Gizlilik bildirimi

Son güncelleme: 24 Ağustos 2026

Otomatik Erişim'in tek amacı, bağlantı hatası yaşayan alan adlarını kullanıcının kendi bilgisayarındaki yerel SOCKS5 geçidine seçici olarak yönlendirmektir.

## Yerel olarak işlenen veriler

Eklenti etkinleştirildiğinde istek yapılan alan adlarını, Chrome bağlantı hata türlerini, ilgili zaman bilgisini ve kullanıcının öğrendiği alan adı listesini işler. Bunlar web gezinme etkinliği sayılabilir. Veriler `chrome.storage.local` içinde yalnız kullanıcının cihazında tutulur ve geliştiriciye gönderilmez.

## Üçüncü tarafa aktarım

Kurulum yardımcısı, ağ sağlayıcısının alan adı yanıtını engellediği durumlarda DNS sorgularını cihazdaki yerel `dnsproxy` hizmeti üzerinden şifreli olarak Cloudflare (`1.1.1.1`) ve Google (`8.8.8.8`) DoH çözümleyicilerine gönderir. Bu sağlayıcılar sorgulanan alan adını ve bağlantının kaynak IP adresini görebilir; tam URL ve sayfa içeriği DNS sorgusuna dahil değildir. Kullanıcı popup içindeki **Genel durumu kontrol et** düğmesine özellikle basarsa yalnız kontrol edilen alan adı ayrıca Globalping API'sine gönderilir.

## Saklama ve silme

Öğrenilen alan adları kullanıcı silene, eklenti verilerini temizleyene veya eklentiyi kaldırana kadar yerel cihazda kalır. Popup üzerinden girdiler ayrı ayrı silinebilir.

## Reklam ve satış

Eklenti kullanıcı verisini satmaz, reklam hedefleme amacıyla kullanmaz ve üçüncü taraf reklam platformlarına aktarmaz.

## İzinlerin amacı

- `proxy`: yalnız öğrenilen alan adları için yerel PAC/SOCKS5 yönlendirmesi uygulamak.
- `webRequest` ve HTTP/HTTPS host erişimi: ağ hatalarını ve başarılı ana sayfa yanıtlarını algılamak.
- `storage`: ayarları ve öğrenilen alan adlarını yerel olarak saklamak.
- `activeTab`: kullanıcı popup'ı açtığında yalnız etkin sekmenin alan adını göstermek ve isteğe bağlı işlem uygulamak.
- `notifications`: yeni bir hedef otomatik öğrenildiğinde yalnız cihaz üzerinde Chrome bildirimi göstermek.

Bu eklentinin kullanıcı verilerini kullanımı, Chrome Web Store User Data Policy'deki Limited Use şartlarına uygundur; veriler yalnız açıklanan tek amacı sağlamak için işlenir.

Gizlilik veya silme talepleri için GitHub deposundaki Issues ya da Security kanalı kullanılabilir; destek talebine gezinme kayıtları veya başka hassas bilgiler eklenmemelidir.

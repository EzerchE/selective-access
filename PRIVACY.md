# Gizlilik bildirimi

Son güncelleme: 24 Ağustos 2026

Otomatik Erişim'in amacı, bağlantı hatası yaşayan alan adlarını kullanıcının kendi bilgisayarındaki yerel SOCKS5 geçidine seçici olarak yönlendirmek ve kullanıcının isteğiyle dış erişilebilirlik ölçümü yapmaktır. Bu bildirim ürünün gerçek veri akışını açıklamak içindir; belirli bir mevzuata eksiksiz uyum garantisi değildir.

## Yerel olarak işlenen veriler

Eklenti etkinleştirildiğinde istek yapılan alan adlarını, Chrome bağlantı hata türlerini, ilgili zaman bilgisini, öğrenilen alan adı listesini ve kullanıcının yoksaydığı alan adlarını işler. Bunlar web gezinme etkinliği sayılabilir. Veriler `chrome.storage.local` içinde yalnız kullanıcının cihazında tutulur ve geliştiriciye gönderilmez.

Kullanıcı yerel ağ geçidi seçerse yönlendirilen hedeflerin bağlantıları kendi belirlediği yerel ağ bilgisayarındaki SOCKS5 hizmetinden çıkar. Bu cihaz hedef alan adlarını, bağlantı zamanlarını ve istemcinin yerel IP adresini görebilir. Geçit hizmeti kimlik doğrulaması sağlamadığından yalnız güvenilir özel ağlarda kullanılmalıdır; genel internet adresleri eklenti tarafından reddedilir.

## Üçüncü tarafa aktarım

Kurulum yardımcısı, cihazdaki **tüm DNS sorgularını** (yalnız eklentinin öğrendiği hedefleri değil) yerel `dnsproxy` üzerinden şifreli olarak Cloudflare (`1.1.1.1`) ve Google (`8.8.8.8`) DoH çözümleyicilerine gönderir. Bu sağlayıcılar sorgulanan alan adını ve bağlantının kaynak IP adresini görebilir; kendi gizlilik ve saklama koşulları geçerlidir. Tam URL, sayfa içeriği ve HTTPS içeriği DNS sorgusuna dahil değildir.

Kullanıcı popup içindeki **Genel durumu kontrol et** düğmesine özellikle basarsa yalnız kontrol edilen alan adı Globalping API'sine gönderilir. Bu aktarım otomatik değildir. Cloudflare, Google ve Globalping bağımsız veri alıcılarıdır; proje bu hizmetlerin kayıtlarını denetlemez.

Geliştiriciye ait bir telemetri, analiz, reklam veya uzaktan kayıt sunucusu yoktur.

## Saklama ve silme

Öğrenilen ve yoksayılan alan adları kullanıcı silene, eklenti verilerini temizleyene veya eklentiyi kaldırana kadar yerel cihazda kalır. Popup üzerinden öğrenilen hedefler çıkarılabilir veya yoksayılabilir; yoksayma kararı ayrı ayrı geri alınabilir.

Chrome eklentisini kaldırmak yerel listeyi siler; sistem geneli DNS kuralını ve yardımcı hizmetleri kaldırmak için ayrıca `helper/uninstall.cmd` çalıştırılmalıdır. Üçüncü taraf DNS ve ölçüm sağlayıcılarındaki kayıtların saklanması ilgili sağlayıcının politikasına tabidir.

## Reklam ve satış

Eklenti kullanıcı verisini satmaz, reklam hedefleme amacıyla kullanmaz ve üçüncü taraf reklam platformlarına aktarmaz.

## İzinlerin amacı

- `proxy`: yalnız öğrenilen alan adları için bu bilgisayardaki veya kullanıcının seçtiği özel yerel ağ adresindeki PAC/SOCKS5 yönlendirmesini uygulamak.
- `webRequest` ve HTTP/HTTPS host erişimi: ağ hatalarını ve başarılı ana sayfa yanıtlarını algılamak.
- `storage`: ayarları, öğrenilen ve yoksayılan alan adlarını yerel olarak saklamak.
- `activeTab`: kullanıcı popup'ı açtığında yalnız etkin sekmenin alan adını göstermek ve isteğe bağlı işlem uygulamak.
- `notifications`: yeni bir hedef otomatik öğrenildiğinde yalnız cihaz üzerinde Chrome bildirimi göstermek.

Veriler yalnız yukarıda açıklanan işlevleri sağlamak için işlenmek üzere tasarlanmıştır. Herhangi bir mağaza dağıtımından önce mağaza veri beyanı, bu metin ve ürün davranışı yeniden doğrulanmalıdır.

Proje geliştiricisine gizlilik veya yerel silme hakkında soru iletmek için GitHub deposundaki Issues; güvenlik açığı için Security kanalı kullanılabilir. Destek talebine gezinme kayıtları veya başka hassas bilgiler eklenmemelidir. Ticari veya mağaza dağıtımından önce veri sorumlusunun açık kimliği, iletişim bilgileri ve gerekli hukuki dayanak/aydınlatma unsurları dağıtıcı tarafından tamamlanmalıdır.

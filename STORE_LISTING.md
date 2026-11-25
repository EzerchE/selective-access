# Browser store listings — 4.19.2

Copy each locale into its corresponding listing. Names and short descriptions match the packaged locale catalogues. Preparation is not store approval.

## English

### Name

Automatic Access

### Short description

Detects connection errors and routes affected destinations through a proxy you choose.

### Detailed description

Automatic Access is a selective proxy extension for Edge and Chrome with support for your own SOCKS5 or HTTP(S) proxy. Choose a working proxy once during setup, then browse as usual. Automatic Access detects supported connection errors, runs a short connection check when needed, and automatically learns the affected hostname when the failure qualifies. It then retries a failed main page through your chosen proxy. Other sites keep their direct connection.

Manually adding a site is optional. Use Route now if you want to route an open site yourself. You can remove a route or ignore a hostname to prevent automatic relearning. Rules match exact hostnames. Learning a main page may also add its conventional www alias.

After a routed HTTPS page finishes loading, older automatic document routes can receive two short, credential-free direct root checks, at most once per 15 minutes. Two successful responses can return only the checked hostname to direct access. A temporary exact-host direct path lasts at most three seconds. Manual, socket-specific and observed mixed-socket routes stay protected; failed checks or concurrent resource errors keep the route. Unlisted hosts retain their normal path. These direct-access rechecks run without refreshing the page or sending it to an external status service.

A WORKING PROXY IS REQUIRED
Choose your own compatible SOCKS5, SOCKS4, HTTP or HTTPS proxy without username/password authentication, or install the optional Windows gateway from the project repository. No developer-operated remote proxy service is provided. Saving a custom endpoint confirms configuration, not connectivity; its first routed connection tests the endpoint.

OPTIONAL WINDOWS HELPER
The helper requires administrator permission to install/remove Windows services; the extension itself does not. Services start automatically after installation. Optional trusted private-LAN sharing lets another computer use the host's SOCKS5 endpoint without installing a local helper. Sharing starts OFF after helper installation/update, and the host must remain running. Use the sharing menu to stop LAN sharing or the included uninstaller to remove the helper. Removing the extension alone does not remove Windows services.

VISIBLE, LIMITED RECOVERY
The toolbar and popup explain setup, waiting, routing and unresolved connections. A main document loading does not hide a failed routed resource. Retries and notifications are bounded. Temporary failure is not proof that a site is restricted.

DATA AND CONTROL
Hostnames and connection outcomes are processed locally. Routed destinations and connection metadata reach your selected proxy. The optional helper uses disclosed encrypted-DNS recipients and system fallback. External global-status measurements happen only when you click their button. Debug starts off, remains local and can be cleared. Limited embedded-frame URL inspection supports retrying an affected frame. No developer analytics, traffic relay or browsing-history server is operated.

HTTPS certificate validation remains enabled. HTTP/SOCKS proxy transport does not encrypt connection metadata; HTTPS proxy transport encrypts the hop to the proxy. The local gateway does not provide anonymity or change the internet connection's public exit IP. A remote proxy may change the exit IP. The helper does not replace certificates or modify device DNS settings.

Free and open source. No product account or subscription is required. The optional donation link unlocks no feature. Use only where authorized. Results depend on the destination, network and selected proxy; not every restriction or failure can be resolved, and first attempts can take time.

## Türkçe

### Ad

Otomatik Erişim

### Kısa açıklama

Bağlantı hatalarını algılar ve etkilenen hedefleri seçtiğiniz proxy üzerinden yönlendirir.

### Ayrıntılı açıklama

Otomatik Erişim, Edge ve Chrome için seçici proxy eklentisidir. Kendi SOCKS5 veya HTTP(S) proxy’nizi kullanabilirsiniz. Kurulumda çalışan bir proxy’yi bir kez seçin ve normal şekilde gezinmeye devam edin. Otomatik Erişim, desteklenen bağlantı hatalarını algılar ve gerektiğinde kısa bir bağlantı kontrolü yapar. Hata yeniden deneme koşullarını karşılıyorsa ilgili alan adını kendiliğinden öğrenir ve açılamayan ana sayfayı seçtiğiniz proxy üzerinden yeniden dener. Diğer siteler doğrudan bağlantıda kalır.

Elle site eklemek isteğe bağlıdır. Açık siteyi kendiniz yönlendirmek isterseniz Şimdi geçide al düğmesini kullanın. Bir rotayı kaldırabilir veya alan adının yeniden öğrenilmesini önlemek için onu yoksayabilirsiniz. Kurallar tam alan adlarıyla eşleşir. Ana sayfa öğrenilirken geleneksel www eş adı da eklenebilir.

Yönlendirilmiş HTTPS sayfası tamamen yüklendikten sonra, eski otomatik sayfa rotalarında en sık 15 dakikada bir iki kısa, çerez/kimlik bilgisi içermeyen doğrudan kök isteği yapılabilir. İki başarılı yanıt yalnız denenen hedefi doğrudan bağlantıya döndürebilir. Geçici tam alan adı doğrudan yolu en fazla üç saniye sürer. Elle seçilen, WebSocket'e özgü ve WebSocket kullanılan karma rotalar korunur; başarısız kontrol veya eş zamanlı kaynak hatası rotayı silmez. Listelenmemiş hedefler normal yolunda kalır. Bu doğrudan erişim kontrolleri sayfayı yenilemeden ve dış durum servisine alan adı göndermeden yapılır.

ÇALIŞAN BİR PROXY GEREKİR
Kullanıcı adı/parola gerektirmeyen uyumlu SOCKS5, SOCKS4, HTTP veya HTTPS proxy'nizi seçin ya da proje deposundaki isteğe bağlı Windows geçidini kurun. Geliştiricinin işlettiği uzak proxy hizmeti sunulmaz. Özel uç noktayı kaydetmek ayarları doğrular; bağlantının çalışması ilk yönlendirilen istekte anlaşılır.

İSTEĞE BAĞLI WINDOWS YARDIMCISI
Windows hizmetlerini kurmak/kaldırmak yönetici izni gerektirir; eklentinin kendisi bunu gerektirmez. Kurulan hizmetler otomatik başlar. Güvenilir Özel yerel ağda paylaşım ayrıca açılabilir; başka bir bilgisayar yerel yardımcı kurmadan sunucunun SOCKS5 geçidini kullanabilir. Yardımcı kurulumu/güncellemesi paylaşımı KAPALI başlatır; sunucu açık kalmalıdır. Paylaşımı kapatmak için paylaşım menüsünü, yardımcıyı kaldırmak için paketle gelen kaldırıcıyı kullanın. Eklentiyi kaldırmak Windows hizmetlerini kaldırmaz.

GÖRÜNÜR VE SINIRLI KURTARMA
Araç çubuğu ve popup kurulum gereksinimini, beklemeyi, yönlendirmeyi ve devam eden sorunları açıklar. Ana belgenin açılması, başarısız bir alt kaynak bağlantısını gizlemez. Denemeler ve bildirimler sınırlıdır. Geçici hata, sitenin erişime engelli olduğunu kanıtlamaz.

VERİ VE DENETİM
Alan adları ve bağlantı sonuçları cihazda işlenir. Yönlendirilen hedefler ve bağlantı üst verisi seçtiğiniz proxy'ye ulaşır. İsteğe bağlı yardımcı, açıklanan şifreli DNS alıcılarını ve sistem yedeğini kullanır. Dış genel durum ölçümü yalnız düğmesine bastığınızda yapılır. Debug kapalı başlar, cihazda kalır ve temizlenebilir. Sınırlı iframe adresi incelemesi, ilgili çerçevenin yeniden denenmesini sağlar. Geliştiricinin analiz, trafik aktarma veya gezinti geçmişi sunucusu yoktur.

HTTPS sertifika doğrulaması açık kalır. HTTP/SOCKS aktarımı bağlantı üst verisini şifrelemez; HTTPS proxy aktarımı proxy'ye kadar olan bölümü şifreler. Yerel geçit anonimlik sağlamaz veya internet bağlantısının genel çıkış IP'sini değiştirmez. Uzak proxy çıkış IP'sini değiştirebilir. Yardımcı sertifika değiştirmez ve cihazın DNS ayarlarını düzenlemez.

Ücretsiz ve açık kaynaklıdır. Ürün hesabı veya abonelik gerekmez. Bağış bağlantısı hiçbir özelliği açmak için zorunlu değildir. Yalnız yetkili olduğunuz durumlarda kullanın. Sonuç hedefe, ağa ve proxy'ye bağlıdır; her kısıtlama veya hata çözülemez ve ilk denemeler zaman alabilir.

## Chrome Web Store opening paragraphs

For the Chrome Web Store, replace the first paragraph of each detailed description with its opening below. Keep the rest of the matching description, starting with the paragraph about manual routing.

### English opening

Website not opening in Chrome? Automatic Access is a selective proxy extension that detects supported connection errors and retries eligible pages through a proxy you choose. Set up a working SOCKS5 or HTTP(S) proxy once, or install the optional Windows gateway. If a DNS or connection error qualifies, the extension can learn the site and retry it automatically. Other sites keep their direct connection. Results depend on the network and proxy.

### Türkçe giriş

Chrome’da bir site açılmıyor veya erişim engeliyle karşılaşıyor musunuz? Otomatik Erişim, desteklenen bağlantı hatalarını algılayan ve uygun durumlarda sayfayı seçtiğiniz proxy üzerinden yeniden deneyen bir tarayıcı eklentisidir. Çalışan bir SOCKS5 veya HTTP(S) proxy’yi bir kez seçin ya da isteğe bağlı Windows geçidini kurun. Uygun bir DNS veya bağlantı hatasında eklenti siteyi kendiliğinden öğrenip yeniden deneyebilir. Diğer siteler doğrudan bağlantıda kalır. Sonuç ağa ve proxy’ye bağlıdır.

## Microsoft Edge Add-ons search terms

| English | Türkçe |
| --- | --- |
| selective proxy | seçici proxy |
| SOCKS5 proxy | SOCKS5 proxy |
| proxy per website | siteye özel proxy |
| automatic proxy routing | otomatik proxy |
| connection error retry | site açılmıyor |
| DNS resolution error | DNS çözümleme hatası |
| local proxy gateway | yerel proxy geçidi |

## Public links

- Homepage: https://github.com/EzerchE/selective-access
- Support: https://github.com/EzerchE/selective-access/issues
- English privacy: https://github.com/EzerchE/selective-access/blob/main/PRIVACY.md
- Turkish privacy: https://github.com/EzerchE/selective-access/blob/main/PRIVACY_TR.md
- Helper downloads/removal: https://github.com/EzerchE/selective-access/releases/latest

## Upload assets

- Store upload: dist/automatic-access-4.19.2.zip ONLY, not the repository or helper archive.
- Screenshots: assets/store/screenshot-routing.png and assets/store/screenshot-setup.png, 1280×800; optional dark image: assets/store/screenshot-routing-dark.png.
- Optional promotional tile: assets/store/promo-small.png, 440×280.
- Store icon: assets/icon-128.png, 128×128.

Graphics use the actual base interface and reserved demonstration targets. No real account, browsing history or test destination appears. Publisher fields are in STORE_SUBMISSION.md; review steps are in STORE_REVIEWER_GUIDE.md.

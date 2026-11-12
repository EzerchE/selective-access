# Chrome Web Store listing — 4.18.3

Copy each locale into its corresponding listing. Names and short descriptions match the packaged locale catalogues. Preparation is not store approval.

## English

### Name

Automatic Access

### Short description

Detects connection errors and routes affected destinations through a proxy you choose.

### Detailed description

Automatic Access keeps ordinary browsing direct and selectively routes listed destinations through a proxy you choose.

Supported connection errors trigger bounded checks and can teach the extension an affected hostname. You can also route the current site yourself, remove its route, or ignore it to prevent automatic relearning. Rules match exact listed hostnames. Main-page learning may add the conventional www alias; other subdomains are not automatically routed.

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

Otomatik Erişim normal gezintiyi doğrudan bağlantıda tutar; yalnız listelenen hedefleri seçtiğiniz proxy üzerinden yönlendirir.

Desteklenen bağlantı hatalarında sınırlı kontrollerle ilgili alan adını öğrenebilir. Açık siteyi kendiniz yönlendirebilir, listeden çıkarabilir veya yeniden öğrenilmemesi için yoksayabilirsiniz. Kurallar listelenen tam alan adlarına uygulanır. Ana sayfa öğrenilirken geleneksel www eş adı eklenebilir; diğer alt alanlar otomatik yönlendirilmez.

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

## Public links

- Homepage: https://github.com/EzerchE/selective-access
- Support: https://github.com/EzerchE/selective-access/issues
- English privacy: https://github.com/EzerchE/selective-access/blob/main/PRIVACY.md
- Turkish privacy: https://github.com/EzerchE/selective-access/blob/main/PRIVACY_TR.md
- Helper downloads/removal: https://github.com/EzerchE/selective-access/releases/latest

## Upload assets

- Store upload: dist/automatic-access-4.18.3.zip ONLY, not the repository or helper archive.
- Screenshots: assets/store/screenshot-routing.png and assets/store/screenshot-setup.png, 1280×800; optional dark image: assets/store/screenshot-routing-dark.png.
- Optional promotional tile: assets/store/promo-small.png, 440×280.
- Store icon: assets/icon-128.png, 128×128.

Graphics use the actual base interface and reserved demonstration targets. No real account, browsing history or test destination appears. Publisher fields are in STORE_SUBMISSION.md; review steps are in STORE_REVIEWER_GUIDE.md.

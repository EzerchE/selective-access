# Gizlilik bildirimi — Otomatik Erişim

Güncelleme: 12 Kasım 2026 · Sürüm 4.18.3

[English](PRIVACY.md)

Eklenti Chrome bağlantı hatalarını gözlemler ve yalnız listelenen alan adlarını seçtiğiniz proxy'ye yönlendirir. Geliştirici telemetri, analiz, reklam, trafik aktarma veya uzaktan günlük sunucusu işletmez.

## Cihazda işlenen veriler

Chrome olaylarındaki URL'lerden alan adı türetilir. Tam adres, yol, sorgu, fragment, kimlik bilgisi, çerez, form veya sayfa içeriği saklanmaz. Etkilenen iframe'i yeniden denemek için DOM içindeki iframe adresleri incelenebilir. Geçmiş ve çerez izinleri istenmez.

Etkinlik, proxy türü/adresi/portu, öğrenilen ve yoksayılan hedefler, rota kaynağı/sağlığı ve son durumlar cihazda tutulur. Oturum depolaması kurtarma durumunu tarayıcı oturumu boyunca tutar. Başlangıçta kapalı debug açılırsa en fazla 150 olay alan adı, hata, istek türü, süre ve karar bilgisi içerir. Gelişmiş bölümünden temizlenebilir.

Kurallar yalnız listelenen tam alan adlarına uygulanır; öğrenilen ana sayfanın geleneksel www eş adı da listelenir. Joker kapsam oluşturulmaz. Yoksayılan hedef ve alt alanları doğrudan kalır. Otomatik rotalar sınırlı kurtarmayla kaldırılabilir; elle seçilen rotalar korunur.

Yönlendirilen kaynak uyarılarında yalnız alan adı, istek türü, hata ve zaman tutulur; oturum depolamasında sekme başına en fazla 32 kayıt vardır. Geçici istek/rota ve tamamlanma takibi süreç belleğinde sınırlıdır; yol, sorgu veya içerik tutmaz. Gezinme veya sekmenin kapatılması eski sekme bağlamını temizler. Popup hatalı kaynağın alan adını gösterebilir; bunun dış durum denetimi için yine açıkça düğmeye basmanız gerekir.

## Veri alıcıları

İsteğe bağlı yardımcı, yönlendirilmiş SOCKS bağlantılarının aynı anda yapılan aynı DNS sorgularını birleştirir. En fazla 256 başarılı yanıtı kalan DNS ömrünü ve 30 saniyelik üst sınırı aşmadan yalnız süreç belleğinde tutar. Başarısız yanıt veya kalıcı DNS geçmişi saklanmaz. Ağ değişince yanıtlar ve mevcut sağlayıcı tercihi temizlenir. Yeni bir DNS alıcısı eklenmez.

- Hedef sunucu: otomatik origin kök kontrolünü çerez ve kimlik bilgisi olmadan alır. Kaynak IP ve normal bağlantı bilgilerini görür. Yol, sorgu, fragment ve kullanıcı bilgisi kontrol öncesinde temizlenir.
- Seçtiğiniz proxy: hedef adı/IP, port, kaynak bağlantı bilgisi ve bağlantı için gereken trafiği alır. İşletmecisi HTTP içeriğini okuyabilir. HTTPS/WSS uçtan uca TLS ile korunur; sertifika doğrulaması atlanmaz. HTTP/SOCKS proxy bağlantıları üst veriyi şifrelemez. HTTPS proxy bağlantısı proxy'ye kadar şifrelidir; işletmeci hedefleri yine görür. Güvendiğiniz proxy'yi seçin; işletmecinin saklama ve gizlilik koşulları geçerlidir. Ayarlar cihazda kalır; proxy kullanıcı adı/parolası desteklenmez.
- İsteğe bağlı yerel Windows yardımcısı: temel geçit ve arka geçit loopback üzerinde çalışır; ayrıca açıkça etkinleştirilen LAN aktarımı aşağıda açıklanır. Yönlendirilen alan adlarının DNS sorgularını sırayla Cloudflare ve/veya Google'a HTTPS üzerinden gönderir; uygun cevap yoksa sistem çözümleyicisine döner. Sağlayıcı hedef adı ve kaynak IP'yi kendi koşulları altında alır. DNS içinde sayfa yolu, çerez ve içerik aktarılmaz. Normal trafiğin DNS ayarları değişmez; HTTPS çözülmez ve sertifika değiştirilmez.
- Globalping: yalnız Genel durumu kontrol et düğmesine basarsanız alan adı dış problarda üç kıtadan ölçüm için API'ye gönderilir. Altyapı ve prob işletmecileri hedefi ve ölçüm isteğini alır. Özel hizmet adlarını göndermeyin. Yerel/özel IP hedefleri reddedilir; genel alan adı arkasındaki tüm özel hizmetler belirlenemez. Otomatik Globalping kontrolü yoktur.
- GitHub ve isteğe bağlı Buy Me a Coffee bağlantısı: yalnız tıklayınca açılır; ilgili sitenin koşulları geçerlidir. Uzak ödeme betiği yüklenmez.

Gezinme verileri geliştiriciye gönderilmez, satılmaz, reklam, kredi değerlendirmesi veya ilgisiz profillemede kullanılmaz. Destek için günlük paylaşımı sizin açık seçiminizdir; özel hedefleri önce temizleyin.

## Saklama ve kaldırma

İsteğe bağlı LAN paylaşımı seçilen özel IPv4 arayüzünde 1082 portunu açar; erişim aynı alt ağ ve Windows Özel güvenlik duvarı profiliyle sınırlandırılır. Kurulum/güncelleme sonrası kapalı başlar. Sunucudaki helper/share.cmd menüsünden yönetilir. Sunucu ve izinli ağ cihazları bağlantı üst verisini ve şifresiz trafiği görebilir; HTTPS/WSS içeriği şifreli kalır. İstemci IP'leri yalnız erişim kontrolü için geçici işlenir; trafik/istemci günlüğü tutulmaz. share.cmd → KAPAT yalnız LAN hizmetini/kuralını; uninstall.cmd tüm yardımcı hizmetleri ve LAN kuralını kaldırır.

Yerel veriler siz silene, Chrome temizleyene veya eklenti kaldırılana kadar kalabilir. Oturum verisi tarayıcı oturumuyla biter. Hedefleri satır düğmeleriyle, debug kaydını Gelişmiş bölümünden temizleyebilirsiniz. Eklenti kendi seçtiğiniz proxy'yi kurmaz veya kaldırmaz.

Yerel Windows hizmetlerini kurduysanız helper/uninstall.cmd dosyasını ayrıca yönetici olarak çalıştırın. Eklentiyi kaldırmak hizmetleri kaldırmaz. Kaldırıcı DNS veya başka sistem ağ ayarlarını değiştirmez.

## İzinler ve Limited Use

webRequest ve HTTP/HTTPS/WS/WSS erişimi bağlantı sonuçlarını gözlemlemek; proxy seçici PAC yönlendirmesi; storage yerel ayarlar/tanılama; activeTab açık sekmedeki hedef; scripting etkilenen iframe'i yeniden denemek; notifications kurulum, sınırlı bekleme/öğrenme ve istenen sonuç bildirimleri içindir.

Google API'lerinden alınan bilgilerin kullanımı, Limited Use dahil Chrome Web Store Kullanıcı Verileri Politikası'na uygundur. Veriler yalnız seçici yönlendirme ve ilgili sorun giderme için kullanılır. İnsan erişimi açık destek onayı, güvenlik incelemesi veya yasal zorunlulukla sınırlıdır.

Gizlilik sorularını özel günlük paylaşmadan GitHub Issues üzerinden; güvenlik bildirimlerini SECURITY.md içindeki özel kanal üzerinden iletin.

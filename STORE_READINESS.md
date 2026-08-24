# Chrome Web Store hazırlık durumu

## Uygun olan yönler

- Manifest V3 kullanılır ve uzaktan JavaScript çalıştırılmaz.
- Tek amaç, başarısız alan adlarını yerel geçide seçici yönlendirmektir.
- Varsayılan durum kapalıdır; kullanıcı popup anahtarıyla etkinleştirir.
- İzinler mevcut işlev için gereken `activeTab`, `notifications`, `proxy`, `storage`, `webRequest` ve HTTP/HTTPS host erişimiyle sınırlandırılmıştır.
- Veri kullanımı popup ve `PRIVACY.md` içinde açıklanmak üzere tasarlanmıştır; mağaza incelemesi uyumluluk garantisi değildir.

## Yayından önce tamamlanacaklar

- Mağaza ZIP'ine `helper/`, `ops/`, testler ve geliştirme belgeleri dahil edilmemelidir.
- Yerel ByeDPI hizmeti ayrı, doğrulanabilir ve tercihen kod imzalı bir masaüstü paketi olarak dağıtılmalıdır. Mağaza açıklaması eklentinin bu yardımcı olmadan çalışmayacağını açıkça söylemelidir.
- Globalping'e isteğe bağlı alan adı aktarımı mağaza veri beyanında belirtilmelidir.
- Mağaza ikonu, ekran görüntüleri, destek URL'si ve herkese açık gizlilik politikası URL'si hazırlanmalıdır.
- Developer Dashboard veri kullanım formu gerçek davranışla birebir doldurulmalıdır.
- Otomatik DNS hatası doğrulaması, yalnız doğrulanan alan adlarının Cloudflare/Google'a aktarımı ve yerel `nativeMessaging` köprüsü kullanıcı kurmadan önce mağaza açıklamasında ve ayrı yardımcı kurucuda belirgin biçimde açıklanmalıdır.
- Yayıncı/veri sorumlusu kimliği, geçerli iletişim bilgileri, hukuki dayanak ve gerekli bölgesel aydınlatma unsurları yayıncı tarafından tamamlanmalıdır.
- Üçüncü taraf GPL bileşeni için tam ve birebir karşılık gelen kaynak kod, ikiliyle eşdeğer erişimde ve gerekli süre boyunca sunulmalıdır.

Bu maddeler tamamlanmadan public/unlisted Chrome Web Store gönderimi yapılmamalıdır.

## Gelir modeli

Sayfalara reklam veya affiliate kodu enjekte edilmemelidir. Daha düşük politika riski taşıyan seçenekler; açıkça belirtilen ücretli lisans, isteğe bağlı abonelik, bağış veya ayrı bir destek planıdır. Gezinme verisi hiçbir gelir modelinde reklam hedefleme amacıyla kullanılamaz.

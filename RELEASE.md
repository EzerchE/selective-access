# Güvenli güncelleme akışı

Her kod değişikliğinde:

1. `node --check background.js`, `node --check popup.js` ve `node tests/background.test.cjs` çalıştırılır.
2. `node scripts/repository-audit.cjs --history` çalıştırılır.
3. Her sürüm değişikliğinde `manifest.json`, `README.md` içindeki güncel sürüm ve davranışı açıklayan ilgili belgeler birlikte güncellenir.
4. `git diff --check` başarılı olmalıdır.
5. Yalnız denetimler başarılıysa imzalı sürüm etiketi ve checksum dosyası oluşturulup GitHub'a gönderilir.
6. Chrome Web Store paketi yalnız mağaza sürümü için gerekli çalışma zamanı dosyalarını ve belgeleri içerir.

Kimlik bilgileri, kişisel veriler, öğrenilmiş alan adları, sabit eklenti kimlikleri ve makineye özgü dosyalar depoya eklenmez. Kod, test ve dokümantasyon örneklerinde yalnız ayrılmış `.example`, `example.com`, `example.net` ve `example.org` adları kullanılır.

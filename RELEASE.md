# Güvenli güncelleme akışı

Her kod değişikliğinde:

1. `node --check background.js`, `node --check i18n.js`, `node --check popup-preview.js`, `node --check popup.js`, `node tests/background.test.cjs`, `node tests/popup.test.cjs` ve `node tests/helper-migration.test.cjs` çalıştırılır.
2. `node scripts/repository-audit.cjs --history` çalıştırılır.
3. Her sürüm değişikliğinde `manifest.json`, `README.md`, `README_TR.md`, iki `_locales` sözlüğü ve davranışı açıklayan ilgili belgeler birlikte güncellenir.
4. `git diff --check` başarılı olmalıdır.
5. Yalnız denetimler başarılıysa imzalı sürüm etiketi ve checksum dosyası oluşturulup GitHub'a gönderilir.
6. Chrome Web Store paketi `node scripts/build-store-zip.cjs` ile üretilir. Dosya listesi betikte tutulur; yardımcı ikili, test, geliştirme betiği veya depo belgesi arşive girerse betik yazmayı reddeder.
7. Yardımcı paket değiştiğinde temiz kurulum ve desteklenen en eski yükseltme yolu izole bir Windows ortamında doğrulanır; taslak sürüm dosyaları ve checksum değerleri yeniden üretilir.

Kimlik bilgileri, kişisel veriler, öğrenilmiş alan adları, sabit eklenti kimlikleri ve makineye özgü dosyalar depoya eklenmez. Kod, test ve dokümantasyon örneklerinde yalnız ayrılmış `.example`, `example.com`, `example.net` ve `example.org` adları kullanılır.

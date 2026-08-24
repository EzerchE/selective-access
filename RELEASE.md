# Güvenli güncelleme akışı

Her kod değişikliğinde:

1. `node --check background.js` ve `node tests/background.test.cjs` çalıştırılır.
2. `node scripts/repository-audit.cjs` çalıştırılır.
3. Her sürüm değişikliğinde `manifest.json`, `README.md` içindeki güncel sürüm ve davranışı açıklayan ilgili belgeler birlikte güncellenir.
4. Yalnız audit başarılıysa commit oluşturulup GitHub deposuna push edilir.
5. Chrome Web Store paketi yalnız mağaza sürümü için gerekli çalışma zamanı dosyalarını ve belgeleri içerir.

Kimlik bilgileri, kişisel veriler, öğrenilmiş alan adları, sabit eklenti kimlikleri ve makineye özgü dosyalar depoya eklenmez. Test ve dokümantasyon örneklerinde yalnız ayrılmış `.example` alan adları kullanılır.

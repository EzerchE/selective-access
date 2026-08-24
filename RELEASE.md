# Güvenli güncelleme akışı

Her kod değişikliğinde:

1. `node --check background.js` ve `node tests/background.test.cjs` çalıştırılır.
2. `powershell -ExecutionPolicy Bypass -File scripts/repository-audit.ps1` çalıştırılır.
3. Kullanıcı davranışı değiştiyse `manifest.json` sürümü ve belgeler güncellenir.
4. Yalnız audit başarılıysa commit oluşturulup GitHub deposuna push edilir.
5. Chrome Web Store paketi yalnız mağaza sürümü için gerekli çalışma zamanı dosyalarını ve belgeleri içerir.

Kimlik bilgileri, kişisel veriler ve makineye özgü dosyalar depoya eklenmez.

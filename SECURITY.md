# Güvenlik politikası

Güvenlik açığını herkese açık issue içinde ayrıntılandırmayın. GitHub deposundaki **Security → Report a vulnerability** kanalını kullanın.

Rapora kimlik bilgisi, kişisel veri veya kullanıcı trafiği eklemeyin. Gerekli en küçük anonim yeniden üretim örneğini paylaşın.

Eklenti uzaktan kod çalıştırmaz. Yerel yardımcı yalnız loopback üzerinde ve kısıtlı Windows hizmet hesabıyla çalışmalıdır. Birlikte dağıtılan üçüncü taraf ikililerin kaynak, sürüm, lisans ve SHA-256 bilgileri `helper/bin/SOURCE.md` ile `THIRD_PARTY_NOTICES.md` içinde tutulur. Kurulum paketini çalıştırmadan önce hash değerlerini doğrulayın; yayımlanan masaüstü paketleri mümkün olduğunda kod imzalı olmalıdır.

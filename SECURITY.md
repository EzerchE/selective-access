# Güvenlik politikası

Güvenlik açığını herkese açık issue içinde ayrıntılandırmayın. GitHub deposundaki **Security → Report a vulnerability** kanalını kullanın.

Rapora kimlik bilgisi, kişisel veri veya kullanıcı trafiği eklemeyin. Gerekli en küçük anonim yeniden üretim örneğini paylaşın.

Eklenti uzaktan kod çalıştırmaz. Temel geçit ve ByeDPI yalnız loopback üzerinde LocalService hesabıyla çalışır. İsteğe bağlı LAN aktarımı ayrı LocalService hizmetidir: seçilen RFC1918 IPv4 Ethernet/Wi-Fi adresi, 1082 TCP portu, aynı alt ağ ve Windows Özel profiliyle sınırlıdır. Uygulama kaynak IP'yi ayrıca denetler. Genel/Etki Alanı/karma profil, kapalı güvenlik duvarı veya hariç tutulan arayüz varsa açılmaz; ağ değişirse etkin bağlantıları kapatır. Geçit DNS çözümlemesinden sonra da özel/loopback/link-local hedefleri reddeder; LAN istemcileri sunucunun özel servislerine proxy üzerinden erişemez.

Paylaşım kimlik doğrulamasızdır: yalnız güvenilir alt ağda kullanılmalıdır. SOCKS aktarımı LAN üzerinde şifresizdir; HTTPS/WSS içeriği TLS ile korunur. Modemde port yönlendirmesi açılmamalıdır; kaynak adresini yerel IP'ye çeviren NAT yalnız kaynak alt ağ denetimiyle tespit edilemez. Hizmette eşzamanlı bağlantı sınırı ve başlangıç zaman aşımı bulunur. Kapatma/kaldırma yalnız projeye ait LAN hizmetini ve güvenlik duvarı kuralını siler; hiçbir güvenlik duvarı profilini kapatmaz.

Kaynak ve SHA-256 bilgileri helper/bin/SOURCE.md, GATEWAY_SOURCE.md ve LAN_SHARE_SOURCE.md dosyalarındadır. Kurucu üçüncü ikiliyi de doğrular; güncelleme paylaşımı kapalı duruma döndürür. İmzalı masaüstü paketleri tercih edilir; mevcut paket imzasızdır.

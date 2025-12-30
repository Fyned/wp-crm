# 🔧 Server Update Instructions - Webhook Fix

## Problem Çözümü

**Sorun:** Session QR kod tarandıktan sonra "DISCONNECTED" durumunda kalıyor.

**Sebep:** Evolution API (Docker içinde) webhook'ları backend'e gönderemiyor çünkü external domain'e (https://api.fynedtest.com) ulaşamıyor.

**Çözüm:** Webhook URL'ini Docker internal networking kullanacak şekilde ayarlamak.

---

## 🚀 Adım 1: Sunucuya Bağlanın

```bash
ssh -i "C:\Projects\Whatsapp-App\waha-key.pem" ubuntu@13.49.116.115
```

---

## 🚀 Adım 2: Kod Güncellemelerini Çekin

```bash
cd ~/whatsapp-crm
git pull origin claude/whatsapp-crm-aws-setup-XATlw
```

**Beklenen çıktı:**
```
Updating a7717d2..f92e94b
Fast-forward
 backend/.env.example                              | 4 ++++
 backend/src/controllers/sessionController.evolution.js | 14 +++++++++++++-
 frontend/src/pages/ChatPage.jsx                   | 8 +++++++-
 frontend/src/services/api.js                      | 2 +-
 4 files changed, 25 insertions(+), 3 deletions(-)
```

---

## 🚀 Adım 3: Backend .env Dosyasını Güncelleyin

```bash
cd ~/whatsapp-crm/backend
nano .env
```

**Şu satırı ekleyin:**

```env
# Webhook Configuration for Docker->Backend Communication
WEBHOOK_BASE_URL=http://172.17.0.1:5000
```

`172.17.0.1` Docker'ın host makineye ulaşmak için kullandığı default gateway IP'sidir.

**Kaydet:** Ctrl+X → Y → Enter

---

## 🚀 Adım 4: Backend'i Yeniden Başlatın

```bash
cd ~/whatsapp-crm/backend
pm2 restart all
```

**Logları kontrol edin:**

```bash
pm2 logs
```

**Beklenen çıktı:**
```
[Session] Setting webhook URL: http://172.17.0.1:5000/api/webhooks/evolution
```

---

## 🚀 Adım 5: Mevcut Session'ları Sil ve Yeniden Oluştur

Webhook URL'i sadece yeni oluşturulan session'lara uygulanır. Mevcut "wptest" session'larını silip yeniden oluşturmanız gerekiyor.

### Frontend'den Silme:

1. https://app.fynedtest.com adresine gidin
2. Her "wptest" session'ı seçip sağ üstteki çöp kutusu ikonuna tıklayın
3. Silme işlemini onaylayın

### Yeni Session Oluşturma:

1. **+ Yeni Hat Ekle** butonuna tıklayın
2. Session adı: `wptest` (veya başka bir ad)
3. **Create & Connect** tıklayın
4. QR kodu tarayın

---

## 🚀 Adım 6: Webhook Çalıştığını Doğrulayın

QR kodu taradıktan sonra PM2 loglarını izleyin:

```bash
pm2 logs --lines 50
```

**Başarılı webhook çıktısı:**

```
[Webhook] Received event: CONNECTION_UPDATE for instance: wptest
[Webhook] Connection update: wptest -> open
```

---

## 🚀 Adım 7: Frontend'de Durumu Kontrol Edin

- Frontend artık 10 saniyede bir session listesini otomatik yeniliyor
- QR kod taradıktan sonra en fazla 10 saniye içinde session durumu "CONNECTED" olarak görünmeli
- Manuel yenilemek için sayfayı refresh edebilirsiniz

---

## 🧪 Test Senaryosu

1. ✅ Session oluştur → QR kod görünmeli
2. ✅ QR kod tara → WhatsApp'ta bağlantı onayı
3. ✅ 10 saniye bekle → Session durumu "CONNECTED" olmalı
4. ✅ Chat'e tıkla → Mesajlar yüklenmeye başlamalı

---

## 🔍 Sorun Giderme

### Webhook hala gelmiyor:

1. **Docker bridge network IP'sini kontrol edin:**

```bash
docker network inspect bridge | grep Gateway
```

Eğer `172.17.0.1` değilse, `.env` dosyasındaki `WEBHOOK_BASE_URL` değerini güncelleyin.

2. **Backend'in 5000 portunda çalıştığını doğrulayın:**

```bash
netstat -tlnp | grep 5000
```

3. **Evolution API'dan webhook test edin:**

```bash
docker exec evolution-api curl -X POST http://172.17.0.1:5000/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{"event":"CONNECTION_UPDATE","instance":"test","data":{"state":"open"}}'
```

**Beklenen:** `{"success":true}`

### Session hala DISCONNECTED:

1. **Evolution API durumunu kontrol edin:**

```bash
curl -X GET 'http://localhost:8080/instance/connectionState/wptest' \
  -H 'apikey: fynedtest-evolution-api-key-2024-secure'
```

2. **Webhook ayarlarını kontrol edin:**

```bash
curl -X GET 'http://localhost:8080/webhook/find/wptest' \
  -H 'apikey: fynedtest-evolution-api-key-2024-secure'
```

**Beklenen webhook URL:** `http://172.17.0.1:5000/api/webhooks/evolution`

---

## 📝 Özet

Bu güncellemeler 3 ana sorunu çözüyor:

1. **QR Kod Görüntüleme** → Frontend artık base64 data'yı doğru parse ediyor
2. **Webhook Bağlantısı** → Evolution API artık backend'e internal network üzerinden ulaşıyor
3. **Otomatik UI Güncelleme** → Frontend 10 saniyede bir session listesini yeniliyor

Her şey tamamlandıktan sonra WhatsApp CRM tam fonksiyonel olacak! 🎉

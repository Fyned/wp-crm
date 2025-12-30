# 🔥 HOTFIX GUIDE - Tüm Sorunların Çözümü

## 📋 Tespit Edilen Sorunlar

### 1. ❌ Login Sorunu: `https://app.fynedtest.com/login` Çalışmıyor
**Durum:** `wp-crm.vercel.app` çalışıyor ama `app.fynedtest.com` çalışmıyor
**Sebep:** Vercel custom domain environment variable ayarları eksik

### 2. ❌ Session DISCONNECTED Kalıyor
**Durum:** WhatsApp QR kod taranıyor ama session durumu CONNECTED olmuyor
**Sebep:** Sunucuda yapılan değişiklikler henüz deploy edilmemiş

### 3. ❌ Team Management Eksik
**Durum:** Database'de teams ve team_members tabloları var ama UI yok
**Sebep:** Feature henüz implement edilmemiş

### 4. ❌ Session Assignment UI Eksik
**Durum:** Session'ları team/user'a atama özelliği UI'da yok
**Sebep:** Feature henüz implement edilmemiş

---

## 🚀 ÇÖZÜM 1: Login Sorunu (app.fynedtest.com)

### Problem Analizi

Console'daki Permissions-Policy hataları **sorun değil** (sadece Chrome reklam özelliği uyarıları).

Asıl sorun: **Vercel environment variable eksik veya yanlış.**

### ✅ Çözüm Adımları

#### 1. Vercel Dashboard'a Gidin

https://vercel.com/dashboard → **wp-crm** projesini seçin

#### 2. Environment Variables Kontrol Edin

**Settings** → **Environment Variables** bölümüne gidin

Şu değişkenlerin **PRODUCTION** environment için ayarlandığından emin olun:

```env
VITE_API_URL=https://api.fynedtest.com
VITE_SUPABASE_URL=https://jillpsifuqdioispmlaq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGxwc2lmdXFkaW9pc3BtbGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDg0NDUsImV4cCI6MjA4MjU4NDQ0NX0.B0_piF4wArdJJrCgDDQibW1rj2z5NeORtGtRPwhNBro
```

#### 3. Domain Settings Kontrol Edin

**Settings** → **Domains** bölümünde:

- ✅ `app.fynedtest.com` ekli olmalı
- ✅ SSL certificate active olmalı

#### 4. Redeploy Yapın

Eğer environment variable değişikliği yaptıysanız:

**Deployments** → En son deployment → **...** → **Redeploy**

#### 5. DNS Kontrolü (Eğer hala çalışmıyorsa)

```bash
nslookup app.fynedtest.com
```

**Beklenen:** `13.49.116.115` IP'si görünmeli (ama Vercel kullanıyorsanız Vercel IP'leri görünür)

**ÖNEMLİ:** Eğer `app.fynedtest.com` Vercel'da host ediliyorsa, DNS ayarlarında **CNAME** kaydı Vercel'ı göstermeli:

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

---

## 🚀 ÇÖZÜM 2: Session DISCONNECTED Sorunu

### Sunucuda Yapılması Gerekenler

Bu değişiklikler `SERVER_UPDATE_INSTRUCTIONS.md` dosyasında detaylı anlatılmış.

### Kısa Özet:

```bash
# 1. Sunucuya bağlan
ssh -i "C:\Projects\Whatsapp-App\waha-key.pem" ubuntu@13.49.116.115

# 2. Kod güncellemelerini çek
cd ~/whatsapp-crm
git fetch origin
git checkout claude/whatsapp-crm-aws-setup-XATlw
git pull origin claude/whatsapp-crm-aws-setup-XATlw

# 3. Backend .env dosyasını düzenle
cd backend
nano .env
```

**Eklenecek satır:**
```env
WEBHOOK_BASE_URL=http://172.17.0.1:5000
```

```bash
# 4. Backend'i restart et
pm2 restart all

# 5. Logları kontrol et
pm2 logs --lines 20
```

**Beklenen log:**
```
[Session] Setting webhook URL: http://172.17.0.1:5000/api/webhooks/evolution
```

### Mevcut Session'ları Temizleme

**ÖNEMLİ:** Webhook URL sadece **YENİ** oluşturulan session'lara uygulanır.

1. Frontend'den tüm eski session'ları **SİLİN**
2. Yeni session oluşturun
3. QR kodu tarayın
4. 10 saniye içinde durum **CONNECTED** olacak

---

## 🚀 ÇÖZÜM 3 & 4: Eksik Özellikler (Team Management + Session Assignment)

### Durum

Bu özellikler şu anda **eksik**. Database tabloları var ama UI implement edilmemiş.

### Gerekli İşler

#### A. Team Management Page
- Teams listesi
- Team oluşturma
- Team üyelerini yönetme
- Team silme

#### B. Session Assignment UI
- Session detay sayfasında assignment butonu
- Session'ı user veya team'e atama modal'ı
- Assigned session'ların gösterimi

### Hızlı Geçici Çözüm (Manuel Database İşlemi)

Eğer acil team/session assignment yapmanız gerekiyorsa:

#### Supabase Dashboard'dan Manuel Ekleme

**1. Team Oluşturma:**

```sql
-- Supabase SQL Editor
INSERT INTO teams (name, description, created_by_admin_id)
VALUES ('Sales Team', 'Sales department WhatsApp team', 'ADMIN_USER_ID');
```

**2. Team Member Ekleme:**

```sql
INSERT INTO team_members (team_id, user_id, added_by_admin_id)
VALUES ('TEAM_ID', 'USER_ID', 'ADMIN_USER_ID');
```

**3. Session Assignment:**

```sql
INSERT INTO session_assignments (session_id, assigned_to_team_id, assigned_by_admin_id)
VALUES ('SESSION_ID', 'TEAM_ID', 'ADMIN_USER_ID');

-- veya user'a atamak için:
INSERT INTO session_assignments (session_id, assigned_to_user_id, assigned_by_admin_id)
VALUES ('SESSION_ID', 'USER_ID', 'ADMIN_USER_ID');
```

### Kalıcı Çözüm (Feature Implementation)

Bu özellikler için yeni sayfalar ve component'ler geliştirmem gerekiyor. İster misiniz?

---

## 📊 ÖNCELİK SIRASI

### 🔴 ACİL (Hemen yapılmalı)

1. **Vercel Environment Variables** → Login çalışsın
2. **Server Deployment** → Session connection çalışsın

### 🟡 ÖNEMLİ (Kullanılabilir ama eksik)

3. **Team Management UI** → Şu an manuel database işlemi gerekiyor
4. **Session Assignment UI** → Şu an manuel database işlemi gerekiyor

---

## ✅ KONTROL LİSTESİ

### Login Testi
- [ ] `https://app.fynedtest.com/login` açılıyor
- [ ] Kullanıcı adı/şifre ile giriş yapılabiliyor
- [ ] Dashboard yükleniyor

### Session Testi
- [ ] Yeni session oluşturuluyor
- [ ] QR kod görüntüleniyor
- [ ] QR kod tarandıktan sonra durum CONNECTED oluyor
- [ ] Chat listesi yükleniyor

### Admin Panel Testi
- [ ] `/admin` sayfası açılıyor
- [ ] User listesi görünüyor
- [ ] Yeni user oluşturulabiliyor
- [ ] Password reset yapılabiliyor

### Eksik Özellikler
- [ ] Team Management (implementation bekleniyor)
- [ ] Session Assignment UI (implementation bekleniyor)

---

## 🆘 ACİL DESTEK

Eğer sorunlar devam ediyorsa:

### Backend Logs

```bash
ssh -i "C:\Projects\Whatsapp-App\waha-key.pem" ubuntu@13.49.116.115
pm2 logs --lines 50
```

### Evolution API Status

```bash
curl -X GET 'http://localhost:8080/instance/fetchInstances' \
  -H 'apikey: fynedtest-evolution-api-key-2024-secure'
```

### Database Bağlantı Testi

Supabase Dashboard → SQL Editor:

```sql
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;
SELECT * FROM users WHERE is_active = true;
```

---

## 📝 SONRAKI ADIMLAR

Hangi özelliği eklememi istersiniz?

1. **Team Management sayfası** (full UI + CRUD)
2. **Session Assignment UI** (session'ları team/user'a atama)
3. **Dashboard iyileştirmeleri** (analytics, statistics)
4. **Diğer** (belirtin)

Tercih ettiğiniz özelliği söyleyin, hemen implementation'a başlayayım! 🚀

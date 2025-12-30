# 🚀 WhatsApp CRM - Database Migration Guide

## ADIM 1: SQL Migration Uygula

### 1. Supabase Dashboard'a Git
```
https://supabase.com/dashboard/project/jillpsifuqdioispmlaq
```

### 2. SQL Editor'ü Aç
- Sol menüden **SQL Editor**'e tıkla
- **New Query** butonuna bas

### 3. Migration SQL'i Kopyala
- Dosya: `/home/user/wp-crm/backend/database/migrations/003_crm_features.sql`
- Tüm içeriği kopyala (aşağıda)
- SQL Editor'a yapıştır

### 4. RUN Butonuna Bas
- ✅ Başarılı mesajı görmeli: "Success. No rows returned"

### 5. Doğrulama
Şu sorguyu çalıştır:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('session_metadata', 'contact_metadata', 'chat_assignments', 'message_media', 'sync_state', 'chat_groups', 'chat_group_members')
ORDER BY table_name;
```

**Beklenen Sonuç:** 7 tablo görmelisin!

---

## ADIM 2: Supabase Storage Bucket Oluştur

### 1. Storage'a Git
- Sol menüden **Storage** > **Buckets**'e tıkla

### 2. Yeni Bucket Oluştur
- **Create a new bucket** butonuna tıkla
- Bucket adı: `whatsapp-media`
- Public bucket: ✅ **AÇIK** (resimler görünsün diye)
- **Create bucket** butonuna tıkla

### 3. Bucket Politikalarını Ayarla (Önemli!)
**Policies** sekmesine geç ve şu politikaları ekle:

#### Policy 1: Public Read Access (Resimler için)
```sql
-- Policy name: Public read access for media files
-- Operation: SELECT
-- Policy definition:
(storage.foldername(name))[1] = 'messages'
```

#### Policy 2: Authenticated Upload (Backend için)
```sql
-- Policy name: Authenticated upload
-- Operation: INSERT
-- Policy definition:
true
```

#### Policy 3: Authenticated Update (Backend için)
```sql
-- Policy name: Authenticated update
-- Operation: UPDATE
-- Policy definition:
true
```

---

## ADIM 3: Eski Session'ı Temizle

### Yöntem 1: Frontend'den Sil (Kolay)
1. https://wp-crm.vercel.app adresine git
2. **opus** session'ı seç
3. **Delete** butonuna tıkla
4. Onayla

### Yöntem 2: Supabase'den Sil (Manuel)
SQL Editor'de şunu çalıştır:
```sql
-- Eski session ve ilgili tüm veriyi sil
DELETE FROM sessions WHERE session_name = 'opus';
```

---

## ADIM 4: Yeni Temiz Session Oluştur

1. https://wp-crm.vercel.app adresine git
2. **+ Yeni Session** butonuna tıkla
3. Session adı: `opus` (veya istediğin ad)
4. QR kod ile bağlan
5. **TEMİZ BAŞLANGIÇ!** ✨

---

## ✅ DOĞRULAMA KONTROLÜ

Migration başarılı mı? Kontrol et:

```sql
-- 1. Tabloları kontrol et
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%metadata%' OR table_name LIKE '%media%';
-- Sonuç: En az 3 olmalı

-- 2. Storage bucket'ı kontrol et
-- Storage > Buckets'ta "whatsapp-media" görünmeli

-- 3. Yeni session'ı kontrol et
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1;
-- En son oluşturduğun session görünmeli
```

---

## 🎯 SONUÇ

Migration tamamlandıktan sonra:
- ✅ Yeni tablolar oluşturuldu
- ✅ Storage bucket hazır
- ✅ Eski veriler temizlendi
- ✅ Yeni temiz session oluşturuldu

**ŞİMDİ TEST ET:**
1. Bir resim gönder → Görünmeli
2. PDF gönder → İndirebilmeli
3. İsimler doğru mu kontrol et → Artık değişmemeli!

---

## ❓ SORUN ÇIKARSA

### Hata: "relation already exists"
- Normal! Tablo zaten var, devam et

### Hata: "bucket already exists"
- Normal! Bucket zaten var, devam et

### Storage yükleme hatası
- Bucket politikalarını kontrol et
- Public access açık mı bak

---

**Hazır mısın? Migration'ı uygula! 🚀**

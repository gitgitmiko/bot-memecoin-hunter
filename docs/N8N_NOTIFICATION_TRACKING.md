# n8n Workflow: Notification Tracking untuk Mencegah Duplikasi

Dokumentasi tentang implementasi notification tracking di n8n workflow untuk mencegah notifikasi duplikat.

## 🔍 Masalah

### Problem: Notifikasi Terkirim Berulang-Ulang

**Gejala:**
- Coin yang sama menerima notifikasi berulang kali
- Misalnya: 16:48 terkirim, 16:50 tidak, 16:52 terkirim lagi
- Setiap kali analyzer membuat analysis baru, notifikasi dikirim lagi

**Penyebab:**
1. **Analyzer membuat analysis baru setiap ~5 menit**
   - Crawler menemukan coin yang sama lagi
   - Analyzer memproses coin yang sama lagi
   - Membuat analysis baru untuk coin yang sama

2. **Query hanya filter berdasarkan waktu**
   - Query mengambil analyses dalam 2 menit terakhir
   - Tidak ada tracking notifikasi yang sudah dikirim
   - Setiap kali ada analysis baru, notifikasi dikirim lagi

3. **Tidak ada deduplication berdasarkan notifikasi history**
   - DISTINCT ON hanya mencegah duplikat dalam 1 query
   - Tidak mencegah notifikasi berulang di cycle berikutnya

## ✅ Solusi: Notification Tracking

### 1. Update Query untuk Exclude Notifikasi yang Sudah Dikirim

**Query Lama:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
  AND c.address IS NOT NULL
  AND a.overall_score IS NOT NULL
```

**Query Baru:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
  AND c.address IS NOT NULL
  AND a.overall_score IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.coin_id = a.coin_id 
    AND n.sent_at >= NOW() - INTERVAL '1 hour'
  )
```

**Penjelasan:**
- `NOT EXISTS` - Hanya ambil analyses yang belum pernah dikirim
- `n.sent_at >= NOW() - INTERVAL '1 hour'` - Cek notifikasi dalam 1 jam terakhir
- Jika ada notifikasi untuk coin_id dalam 1 jam terakhir, exclude dari query

### 2. Update Format Message untuk Return coin_ids

**Perubahan:**
```javascript
// Return message dengan coin_ids untuk tracking
return { 
  json: { 
    message: fullMessage, 
    count: messages.length, 
    hasMessage: true, 
    shouldSend: true,
    coin_ids: validItems.map(item => item.json.coin_id) // Array of coin_ids
  } 
};
```

**Alasan:**
- Perlu coin_ids untuk insert ke notifications table
- Setiap coin yang dikirim perlu di-track

### 3. Tambah Node untuk Save Notifications

**Node 1: Prepare Notifications**
- Type: Code node
- Function: Prepare data untuk insert ke database
- Input: coin_ids array dari Format Message
- Output: Array of objects dengan coin_id, message_text, status

**Node 2: Save Notification**
- Type: PostgreSQL node
- Operation: executeQuery
- Query: `INSERT INTO notifications (coin_id, message_text, sent_at, status) VALUES ($1, $2, NOW(), $3)`
- Parameters: coin_id, message_text, status

## 📊 Flow Workflow

```
Every 2 Minutes (Cron)
  ↓
Query High Score Coins (exclude yang sudah dikirim)
  ↓
Has Results?
  ↓ (Yes)
Format Message (return coin_ids)
  ↓
Send Telegram
  ↓
Prepare Notifications (prepare data)
  ↓
Save Notification (insert ke database)
```

## 🔧 Implementasi Detail

### Query dengan NOT EXISTS

```sql
SELECT DISTINCT ON (a.coin_id) 
  a.id, a.coin_id, a.overall_score, ...
FROM analyses a
INNER JOIN coins c ON a.coin_id = c.id
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
  AND c.address IS NOT NULL
  AND a.overall_score IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.coin_id = a.coin_id 
    AND n.sent_at >= NOW() - INTERVAL '1 hour'
  )
ORDER BY a.coin_id, a.created_at DESC
LIMIT 10
```

**Hasil:**
- ✅ Hanya analyses yang belum pernah dikirim (dalam 1 jam)
- ✅ Tidak ada duplikasi notifikasi
- ✅ Setiap coin hanya dikirim sekali per jam

### Prepare Notifications Node

```javascript
const input = $input.first();
const coinIds = input.json.coin_ids || [];
const message = input.json.message || '';

if (!coinIds || coinIds.length === 0) {
  return { json: { saved: 0, message: 'No coin_ids to save' } };
}

// Return data untuk PostgreSQL insert
return coinIds.map(coinId => ({
  json: {
    coin_id: coinId,
    message_text: message.substring(0, 1000), // Limit length
    status: 'sent'
  }
}));
```

**Fungsi:**
- Ambil coin_ids dari Format Message
- Prepare data untuk setiap coin_id
- Return array untuk batch insert

### Save Notification Node

**Query:**
```sql
INSERT INTO notifications (coin_id, message_text, sent_at, status) 
VALUES ($1, $2, NOW(), $3)
```

**Parameters:**
- $1: coin_id
- $2: message_text (truncated to 1000 chars)
- $3: status ('sent')

## 📊 Perbandingan

### Sebelum (Tanpa Tracking)

**Timeline:**
- 16:48 - Analysis baru dibuat → Notifikasi terkirim ✅
- 16:50 - Tidak ada analysis baru → Tidak ada notifikasi ✅
- 16:52 - Analysis baru dibuat → Notifikasi terkirim lagi ❌ (duplikat!)

**Masalah:**
- Notifikasi dikirim berulang untuk coin yang sama
- Tidak ada tracking

### Sesudah (Dengan Tracking)

**Timeline:**
- 16:48 - Analysis baru dibuat → Notifikasi terkirim ✅ → Saved to DB
- 16:50 - Tidak ada analysis baru → Tidak ada notifikasi ✅
- 16:52 - Analysis baru dibuat → Query exclude (ada notifikasi dalam 1 jam) → Tidak ada notifikasi ✅

**Hasil:**
- Notifikasi hanya dikirim sekali per coin (dalam 1 jam)
- Tracking di database
- Tidak ada duplikasi

## ⚙️ Konfigurasi

### Interval Tracking

**Current: 1 jam**
```sql
n.sent_at >= NOW() - INTERVAL '1 hour'
```

**Opsi:**
- `1 hour` - Notifikasi hanya sekali per jam
- `24 hours` - Notifikasi hanya sekali per hari
- `1 week` - Notifikasi hanya sekali per minggu

**Rekomendasi:**
- `1 hour` untuk balance antara update dan tidak spam
- Bisa disesuaikan sesuai kebutuhan

### Query Interval

**Current: 2 menit**
```sql
a.created_at >= NOW() - INTERVAL '2 minutes'
```

**Harus <= cron interval** (2 menit)

## 🐛 Troubleshooting

### Problem: Masih ada duplikasi

**Penyebab:**
- Notifications table tidak ter-update
- Query NOT EXISTS tidak bekerja

**Solusi:**
1. Cek apakah Save Notification node berjalan
2. Cek apakah data masuk ke notifications table:
   ```sql
   SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 10;
   ```
3. Cek query dengan manual:
   ```sql
   SELECT a.coin_id FROM analyses a 
   WHERE NOT EXISTS (
     SELECT 1 FROM notifications n 
     WHERE n.coin_id = a.coin_id 
     AND n.sent_at >= NOW() - INTERVAL '1 hour'
   );
   ```

### Problem: Notifikasi tidak terkirim sama sekali

**Penyebab:**
- Query exclude semua analyses
- Atau ada masalah di Save Notification node

**Solusi:**
1. Cek apakah ada data di notifications table
2. Cek apakah interval 1 jam terlalu ketat
3. Test query tanpa NOT EXISTS

### Problem: Save Notification error

**Penyebab:**
- user_id tidak ada (notifications table require user_id)
- Atau constraint violation

**Solusi:**
1. Update notifications table untuk allow NULL user_id:
   ```sql
   ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
   ```
2. Atau insert dengan user_id NULL:
   ```sql
   INSERT INTO notifications (coin_id, message_text, sent_at, status) 
   VALUES ($1, $2, NOW(), $3);
   ```

## 📝 Catatan Penting

1. **user_id bisa NULL**
   - Notifications table memiliki user_id, tapi bisa NULL
   - Untuk n8n workflow, user_id bisa NULL (system notification)

2. **Message text truncated**
   - Message text di-truncate ke 1000 karakter
   - Untuk menghindari database error

3. **Interval 1 jam**
   - Bisa disesuaikan sesuai kebutuhan
   - Semakin lama interval, semakin jarang notifikasi duplikat
   - Tapi juga semakin lama waktu tunggu untuk notifikasi ulang

## 🎯 Kesimpulan

**Dengan notification tracking:**
- ✅ Notifikasi hanya dikirim sekali per coin (dalam 1 jam)
- ✅ Tracking di database
- ✅ Tidak ada duplikasi
- ✅ Bisa track history notifikasi

**File yang diupdate:**
- `workflows/n8n-memecoin-monitor-simple.json`
- `workflows/n8n-memecoin-monitor.json`

---

**Status:** ✅ Notification tracking implemented untuk mencegah duplikasi


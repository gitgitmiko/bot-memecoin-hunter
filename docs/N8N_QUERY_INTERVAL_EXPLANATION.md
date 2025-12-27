# Penjelasan Query Interval di n8n Workflow

Dokumentasi tentang filter waktu `created_at >= NOW() - INTERVAL 'X minutes'` di SQL query n8n workflow.

## 🔍 Masalah

Saat trigger workflow secara manual, notifikasi tidak terkirim karena:

1. **Filter waktu terlalu ketat** - Query hanya mengambil analyses dalam 2 menit terakhir
2. **Analyses sudah lebih dari 2 menit** - Jika trigger manual, analyses mungkin sudah lebih dari 2 menit yang lalu

## 📊 Query Saat Ini

**Sebelum (2 menit):**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
```

**Sesudah (10 menit):**
```sql
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
```

## ⚙️ Kenapa Perlu Filter Waktu?

Filter waktu diperlukan untuk:

1. **Menghindari duplikasi notifikasi**
   - Cron job berjalan setiap 2 menit
   - Tanpa filter, akan kirim notifikasi yang sama berulang-ulang

2. **Hanya kirim analyses baru**
   - Hanya analyses yang baru dibuat yang dikirim
   - Analyses lama tidak dikirim lagi

3. **Efisiensi query**
   - Query lebih cepat karena hanya scan data recent
   - Tidak perlu scan semua analyses

## 🔧 Opsi Interval

### 1. Interval 2 Menit (Original)
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
```
**Kelebihan:**
- ✅ Hanya kirim analyses yang sangat baru
- ✅ Minim duplikasi

**Kekurangan:**
- ❌ Terlalu ketat untuk testing manual
- ❌ Jika trigger manual, mungkin tidak ada data

### 2. Interval 10 Menit (Current)
```sql
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
```
**Kelebihan:**
- ✅ Lebih fleksibel untuk testing
- ✅ Masih cukup untuk menghindari duplikasi
- ✅ Cocok untuk cron job 2 menit

**Kekurangan:**
- ⚠️ Bisa kirim analyses yang sedikit lebih lama

### 3. Interval 1 Jam (Untuk Testing)
```sql
WHERE a.created_at >= NOW() - INTERVAL '1 hour'
```
**Kelebihan:**
- ✅ Sangat fleksibel untuk testing
- ✅ Pasti ada data untuk testing

**Kekurangan:**
- ❌ Bisa kirim banyak duplikasi
- ❌ Tidak cocok untuk production

### 4. Tanpa Filter (Hanya untuk Testing)
```sql
-- Hapus filter waktu
WHERE c.address IS NOT NULL 
  AND c.symbol IS NOT NULL 
  AND a.overall_score IS NOT NULL
```
**Kelebihan:**
- ✅ Pasti ada data
- ✅ Cocok untuk testing sekali

**Kekurangan:**
- ❌ Akan kirim SEMUA analyses (bisa banyak!)
- ❌ Banyak duplikasi
- ❌ Tidak cocok untuk production

## 🎯 Rekomendasi

### Untuk Production (Cron Job)
**Gunakan interval 10 menit:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
```

**Alasan:**
- Cron job berjalan setiap 2 menit
- Interval 10 menit memberikan buffer yang cukup
- Masih menghindari duplikasi yang berlebihan

### Untuk Testing Manual
**Gunakan interval 1 jam atau tanpa filter:**
```sql
-- Opsi 1: Interval 1 jam
WHERE a.created_at >= NOW() - INTERVAL '1 hour'

-- Opsi 2: Tanpa filter (hati-hati!)
WHERE c.address IS NOT NULL 
  AND c.symbol IS NOT NULL 
  AND a.overall_score IS NOT NULL
```

## 🔄 Cara Update Interval

### 1. Update di n8n UI
1. Buka workflow di n8n
2. Edit node "Query High Score Coins" (atau "Query Recent High Score Coins")
3. Ubah SQL query:
   ```sql
   WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
   ```
4. Save dan test

### 2. Update via Import Workflow
1. Edit file `workflows/n8n-memecoin-monitor-simple.json`
2. Ubah query di node "Query High Score Coins"
3. Import ulang:
   ```bash
   ./scripts/import_n8n_workflow.sh workflows/n8n-memecoin-monitor-simple.json
   ```

## 📝 Catatan Penting

1. **Interval harus lebih besar dari cron interval**
   - Cron: setiap 2 menit
   - Query interval: minimal 4-10 menit
   - Ini memastikan tidak ada gap

2. **Untuk testing, gunakan interval lebih besar**
   - Testing manual: 1 jam atau tanpa filter
   - Production: 10 menit

3. **Jangan hapus filter waktu di production**
   - Akan menyebabkan spam notifikasi
   - Banyak duplikasi

## 🐛 Troubleshooting

### Problem: Tidak ada notifikasi saat trigger manual

**Penyebab:**
- Filter waktu terlalu ketat
- Analyses sudah lebih dari interval

**Solusi:**
1. Cek umur analyses:
   ```sql
   SELECT a.id, a.created_at, NOW() - a.created_at as age 
   FROM analyses a 
   ORDER BY a.created_at DESC LIMIT 5;
   ```

2. Update interval ke lebih besar (10 menit atau 1 jam)

3. Atau hapus filter waktu untuk testing sekali

### Problem: Banyak duplikasi notifikasi

**Penyebab:**
- Interval terlalu besar
- Atau tidak ada filter waktu

**Solusi:**
1. Kurangi interval (misalnya 10 menit)
2. Pastikan cron job tidak berjalan terlalu sering

---

**Status:** ✅ Interval diubah dari 2 menit ke 10 menit untuk fleksibilitas testing


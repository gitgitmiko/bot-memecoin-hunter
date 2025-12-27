# n8n Workflow: Deduplication untuk Mencegah Notifikasi Duplikat

Dokumentasi tentang perbaikan workflow n8n untuk mencegah notifikasi duplikat ketika ada multiple analyses untuk coin yang sama.

## 🔍 Masalah

### Problem: Notifikasi Muncul Berulang dan Duplikat

**Gejala:**
- Notifikasi muncul terus-menerus untuk coin yang sama
- Ada 2 data yang sama dalam 1 notifikasi
- Coin yang sama muncul beberapa kali

**Penyebab:**
1. **Multiple analyses untuk coin yang sama**
   - Analyzer memproses coin yang sama beberapa kali
   - Setiap proses membuat analysis baru
   - Tidak ada deduplication di query

2. **Query mengambil semua analyses dalam interval**
   ```sql
   WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
   ```
   - Jika ada 2 analyses untuk coin yang sama dalam 10 menit
   - Query akan mengembalikan 2 rows
   - Workflow mengirim 2 notifikasi

3. **Tidak ada deduplication di workflow**
   - Query tidak menggunakan `DISTINCT` atau `GROUP BY`
   - JavaScript code tidak melakukan deduplication

## ✅ Solusi

### 1. Tambahkan DISTINCT ON di Query

**Query Lama:**
```sql
SELECT a.id, a.coin_id, a.overall_score, ...
FROM analyses a
INNER JOIN coins c ON a.coin_id = c.id
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
  AND c.address IS NOT NULL
  AND c.symbol IS NOT NULL
  AND a.overall_score IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 10
```

**Query Baru:**
```sql
SELECT DISTINCT ON (a.coin_id) 
  a.id, a.coin_id, a.overall_score, ...
FROM analyses a
INNER JOIN coins c ON a.coin_id = c.id
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
  AND c.address IS NOT NULL
  AND c.symbol IS NOT NULL
  AND a.overall_score IS NOT NULL
ORDER BY a.coin_id, a.created_at DESC
LIMIT 10
```

### 2. Penjelasan DISTINCT ON

**DISTINCT ON (a.coin_id):**
- Hanya ambil 1 row per `coin_id`
- Menggunakan row pertama berdasarkan `ORDER BY`

**ORDER BY a.coin_id, a.created_at DESC:**
- Group by `coin_id` dulu
- Kemudian sort by `created_at DESC` (terbaru dulu)
- Hasil: hanya analysis terbaru per coin

### 3. Contoh Hasil

**Sebelum (tanpa DISTINCT ON):**
```
coin_id | overall_score | created_at
--------|---------------|------------
1       | 59            | 2025-12-27 09:11:07
1       | 59            | 2025-12-27 09:06:12  ← Duplikat!
2       | 52            | 2025-12-27 09:10:00
```

**Sesudah (dengan DISTINCT ON):**
```
coin_id | overall_score | created_at
--------|---------------|------------
1       | 59            | 2025-12-27 09:11:07  ← Hanya yang terbaru
2       | 52            | 2025-12-27 09:10:00
```

## 📊 Perbandingan

### Query Lama
- ✅ Mengambil semua analyses dalam 10 menit
- ❌ Bisa ada duplikat untuk coin yang sama
- ❌ Notifikasi muncul berulang

### Query Baru
- ✅ Mengambil semua analyses dalam 10 menit
- ✅ Hanya 1 analysis per coin (yang terbaru)
- ✅ Tidak ada duplikat
- ✅ Notifikasi hanya 1 kali per coin

## 🔧 Alternatif Solusi

### Opsi 1: DISTINCT ON (Current)
```sql
SELECT DISTINCT ON (a.coin_id) ...
ORDER BY a.coin_id, a.created_at DESC
```
**Kelebihan:**
- ✅ Simple dan efisien
- ✅ Hanya 1 query
- ✅ PostgreSQL native feature

### Opsi 2: Subquery dengan MAX
```sql
SELECT a.*
FROM analyses a
INNER JOIN (
  SELECT coin_id, MAX(created_at) as max_created_at
  FROM analyses
  WHERE created_at >= NOW() - INTERVAL '10 minutes'
  GROUP BY coin_id
) latest ON a.coin_id = latest.coin_id 
  AND a.created_at = latest.max_created_at
```
**Kelebihan:**
- ✅ Lebih eksplisit
- ✅ Bisa digunakan di database lain

**Kekurangan:**
- ❌ Lebih kompleks
- ❌ Lebih lambat (2 subquery)

### Opsi 3: Deduplication di JavaScript
```javascript
// Di Format Message node
const uniqueCoins = new Map();
items.forEach(item => {
  const coinId = item.json.coin_id;
  if (!uniqueCoins.has(coinId) || 
      uniqueCoins.get(coinId).created_at < item.json.created_at) {
    uniqueCoins.set(coinId, item.json);
  }
});
const uniqueItems = Array.from(uniqueCoins.values());
```
**Kelebihan:**
- ✅ Fleksibel
- ✅ Bisa custom logic

**Kekurangan:**
- ❌ Lebih kompleks
- ❌ Processing di JavaScript (lebih lambat)

## 📝 Catatan Penting

1. **DISTINCT ON memerlukan ORDER BY yang sesuai**
   - Harus include column di DISTINCT ON di ORDER BY
   - `ORDER BY a.coin_id, a.created_at DESC` ✅
   - `ORDER BY a.created_at DESC` ❌ (akan error)

2. **LIMIT berlaku setelah DISTINCT ON**
   - `LIMIT 10` = maksimal 10 coin berbeda
   - Bukan 10 analyses

3. **Interval waktu tetap penting**
   - `INTERVAL '10 minutes'` menentukan window waktu
   - Hanya analyses dalam window yang diambil
   - Analysis terbaru per coin dalam window

## 🐛 Troubleshooting

### Problem: Query error "DISTINCT ON expressions must match initial ORDER BY expressions"

**Penyebab:**
- ORDER BY tidak include column di DISTINCT ON

**Solusi:**
```sql
-- ❌ Salah
ORDER BY a.created_at DESC

-- ✅ Benar
ORDER BY a.coin_id, a.created_at DESC
```

### Problem: Masih ada duplikat

**Penyebab:**
- Mungkin ada coin dengan `coin_id` berbeda tapi address sama
- Atau ada masalah di data

**Solusi:**
- Cek apakah ada coin dengan address sama tapi `coin_id` berbeda
- Pastikan `UNIQUE(address, chain_id)` constraint ada

## 🎯 Kesimpulan

**Dengan DISTINCT ON:**
- ✅ Hanya 1 analysis per coin (yang terbaru)
- ✅ Tidak ada notifikasi duplikat
- ✅ Query lebih efisien
- ✅ Notifikasi hanya muncul 1 kali per coin per cycle

**File yang diupdate:**
- `workflows/n8n-memecoin-monitor-simple.json`
- `workflows/n8n-memecoin-monitor.json`

---

**Status:** ✅ Deduplication implemented dengan DISTINCT ON


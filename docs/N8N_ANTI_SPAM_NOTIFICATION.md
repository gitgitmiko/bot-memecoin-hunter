# n8n Anti-Spam Notification Configuration

Dokumentasi untuk konfigurasi n8n workflow yang mencegah spam notification dengan data tidak lengkap.

## 🎯 Tujuan

Mencegah notification spam dengan data "N/A" atau tidak lengkap. Workflow hanya akan mengirim notifikasi jika:
- Ada analyses dengan overall_score >= 70
- Data lengkap dan valid
- Message tidak kosong

## 🔧 Konfigurasi

### 1. Query SQL - Filter Data Valid

Query sudah diperbaiki untuk hanya mengambil data yang valid:

```sql
SELECT 
  a.id, a.coin_id, a.overall_score, a.price_score, a.volume_score, 
  a.social_score, a.risk_score, a.created_at, 
  c.address, c.symbol, c.name, c.chain_id, c.liquidity, 
  COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE 
  a.created_at >= NOW() - INTERVAL '2 minutes' 
  AND a.overall_score >= 70 
  AND c.address IS NOT NULL 
  AND c.symbol IS NOT NULL 
  AND a.overall_score IS NOT NULL 
ORDER BY a.created_at DESC 
LIMIT 10
```

**Filter yang ditambahkan:**
- `c.address IS NOT NULL` - Pastikan address ada
- `c.symbol IS NOT NULL` - Pastikan symbol ada
- `a.overall_score IS NOT NULL` - Pastikan score ada

### 2. IF Condition - Validasi Data

Condition node sekarang memfilter item dengan data lengkap:

```javascript
$input.all().filter(item => 
  item.json && 
  item.json.address && 
  item.json.overall_score && 
  item.json.overall_score > 0
).length > 0
```

**Validasi:**
- Item harus ada dan valid
- Address harus ada
- Overall score harus ada dan > 0

### 3. Format Message - Skip Invalid Items

Format Message node sekarang:
- Filter item yang tidak valid
- Hanya format item dengan data lengkap
- Skip item dengan address "N/A" atau score 0
- Return `shouldSend: false` jika tidak ada data valid

**Validasi di Format Message:**
```javascript
const validItems = items.filter(item => {
  const data = item.json;
  return data && 
         data.address && 
         data.address !== 'N/A' &&
         data.overall_score !== null && 
         data.overall_score !== undefined &&
         data.overall_score > 0;
});
```

### 4. Send Telegram - Conditional Send

Send Telegram node sekarang hanya mengirim jika:
- `shouldSend = true`
- `message` tidak kosong
- `message.trim().length > 0`

```javascript
text: "={{ $json.shouldSend && $json.message && $json.message.trim().length > 0 ? $json.message : '' }}"
```

Jika message kosong, Telegram node tidak akan mengirim apapun (tidak error, hanya skip).

## 📊 Flow Logic

```
1. Cron Trigger (Every 2 minutes)
   ↓
2. Query High Score Coins
   - Hanya ambil data dengan validasi SQL
   ↓
3. Has Results? (IF Condition)
   - Filter item dengan data lengkap
   - Jika tidak ada → Skip (No Results)
   - Jika ada → Format Message
   ↓
4. Format Message
   - Filter valid items
   - Format hanya item yang valid
   - Set shouldSend = true/false
   ↓
5. Send Telegram
   - Hanya kirim jika shouldSend = true
   - Hanya kirim jika message tidak kosong
```

## ✅ Hasil

**Sebelum:**
- Notification dikirim setiap 2 menit meskipun tidak ada data
- Menampilkan "N/A" untuk semua field
- Spam notification

**Sesudah:**
- Notification hanya dikirim jika ada data valid
- Hanya menampilkan data yang lengkap
- Tidak ada spam notification

## 🔍 Testing

Untuk test apakah workflow bekerja dengan benar:

1. **Test dengan data valid:**
   - Pastikan ada analyses dengan score >= 70
   - Pastikan data lengkap (address, symbol, scores)
   - Workflow harus mengirim notification

2. **Test tanpa data:**
   - Jika tidak ada analyses baru
   - Workflow tidak akan mengirim notification
   - Tidak ada error, hanya skip

3. **Test dengan data tidak lengkap:**
   - Jika ada analyses tapi data tidak lengkap
   - Workflow akan skip item tersebut
   - Hanya kirim item yang valid

## 📝 Catatan

- Workflow akan tetap berjalan setiap 2 menit
- Jika tidak ada data valid, workflow akan skip tanpa error
- Notification hanya dikirim ketika ada data baru yang valid
- Tidak ada perubahan pada interval atau timing, hanya validasi data

## 🚀 Update Workflow

Untuk update workflow di n8n:

1. Import workflow JSON yang sudah diperbaiki
2. Atau update manual:
   - Update SQL query dengan filter tambahan
   - Update IF condition dengan filter validasi
   - Update Format Message dengan validasi item
   - Update Send Telegram dengan conditional send

---

**Status:** ✅ Anti-spam notification sudah aktif


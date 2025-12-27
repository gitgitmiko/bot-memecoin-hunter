# Penjelasan Sistem n8n Workflow

Dokumentasi lengkap tentang bagaimana sistem n8n workflow bekerja untuk mengirim notifikasi Telegram.

## 🔄 Flow Sistem

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ⏰ Cron Trigger (Every 2 minutes)                        │
│    - Trigger workflow setiap 2 menit                        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 🔍 Query High Score Coins                                │
│    - Query: SELECT ... FROM analyses a                     │
│              INNER JOIN coins c ...                         │
│    - Mencari analyses dengan:                               │
│      • overall_score >= 70                                 │
│      • created_at dalam 2 menit terakhir                  │
│      • Data lengkap (address, symbol, scores)              │
│    - Jika TIDAK ADA analyses → return 0 rows               │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ❓ Has Results? (IF Condition)                           │
│    - Cek: Apakah ada rows dengan data valid?                │
│    - Filter: item dengan address dan overall_score > 0      │
│    - Jika 0 rows → Skip (No Results) → TIDAK KIRIM         │
│    - Jika ada rows → Format Message                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ (jika ada data)
┌─────────────────────────────────────────────────────────────┐
│ 4. 📝 Format Message                                         │
│    - Filter item yang valid                                 │
│    - Skip item dengan data tidak lengkap                    │
│    - Format pesan untuk setiap coin                        │
│    - Set shouldSend = true/false                           │
│    - Jika tidak ada data valid → shouldSend = false        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ (jika shouldSend = true)
┌─────────────────────────────────────────────────────────────┐
│ 5. 📤 Send Telegram                                          │
│    - Hanya kirim jika:                                      │
│      • shouldSend = true                                    │
│      • message tidak kosong                                 │
│    - Jika message kosong → Skip (tidak error)               │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Query SQL

Query yang digunakan:

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

**Penting:**
- Menggunakan `INNER JOIN` dengan `analyses`
- Jika **tidak ada analyses** → Query return **0 rows**
- Hanya mengambil analyses yang dibuat dalam **2 menit terakhir**

## ⚠️ Masalah yang Sering Terjadi

### Masalah 1: Notification "N/A" padahal ada coin di database

**Penyebab:**
- Ada coin di database, tapi **tidak ada analyses**
- Query menggunakan `INNER JOIN` dengan analyses
- Jika tidak ada analyses → Query return 0 rows
- Tapi workflow masih mengirim notification dengan data kosong

**Solusi:**
- Pastikan analyzer sudah menyimpan analyses dengan benar
- Workflow sudah diperbaiki untuk tidak mengirim jika tidak ada data
- Import ulang workflow JSON yang sudah diperbaiki

### Masalah 2: Notification spam setiap 2 menit

**Penyebab:**
- Workflow berjalan setiap 2 menit
- Jika tidak ada data valid, masih mengirim notification kosong

**Solusi:**
- IF Condition sudah diperbaiki untuk skip jika tidak ada data
- Format Message sudah diperbaiki untuk return `shouldSend = false`
- Send Telegram sudah diperbaiki untuk tidak kirim jika message kosong

## 🔍 Debugging

### Cek apakah ada analyses di database:

```bash
docker-compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT COUNT(*) FROM analyses;"
```

### Cek apakah query return data:

```bash
docker-compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT a.id, a.overall_score, c.address, c.symbol FROM analyses a INNER JOIN coins c ON a.coin_id = c.id WHERE a.created_at >= NOW() - INTERVAL '2 minutes' AND a.overall_score >= 70 LIMIT 10;"
```

### Cek logs analyzer:

```bash
docker-compose logs analyzer | grep "Stored analysis"
```

## ✅ Checklist

- [ ] Analyzer sudah menyimpan analyses dengan benar
- [ ] Query return data (tidak 0 rows)
- [ ] IF Condition memfilter data valid
- [ ] Format Message skip invalid items
- [ ] Send Telegram hanya kirim jika message tidak kosong
- [ ] Workflow aktif (toggle ON di n8n)

## 📝 Catatan Penting

1. **Query hanya mencari analyses, bukan coins**
   - Jika tidak ada analyses → Query return 0 rows
   - Workflow akan skip dan tidak mengirim notification

2. **Analyses dibuat oleh Analyzer service**
   - Analyzer memproses coins dari queue
   - Menyimpan analyses ke database
   - Jika analyzer gagal → Tidak ada analyses → Tidak ada notification

3. **Workflow berjalan setiap 2 menit**
   - Tapi hanya mengirim jika ada data valid
   - Tidak akan spam jika tidak ada data

4. **Time window: 2 menit**
   - Query hanya mencari analyses yang dibuat dalam 2 menit terakhir
   - Analyses lama tidak akan muncul di notification

---

**Status:** ✅ Workflow sudah diperbaiki untuk mencegah spam notification


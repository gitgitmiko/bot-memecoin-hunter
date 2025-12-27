# Troubleshooting: Data Kosong di Telegram Notification

## 🎯 Masalah

Telegram notification terkirim tapi semua data kosong/N/A:

```
🎯 N/A (Unknown)
Score: 0/100
💰 Price: 0/100 | 📊 Volume: 0/100
👥 Social: 0/100 | ⚠️ Risk: 0/100
🔗 Chain: N/A
📍 Address: N/A
💵 Liquidity: $N/A
📈 24h Volume: $N/A
```

## 🔍 Kemungkinan Penyebab

### 1. **Query SQL Tidak Mengembalikan Data** ⭐ (PALING UMUM!)

Filter query terlalu ketat:
- `created_at >= NOW() - INTERVAL '2 minutes'` → Data terlalu baru (masih dalam 2 menit terakhir)
- `overall_score >= 70` → Tidak ada data dengan score >= 70

### 2. **Data di Database Kosong**

- Crawler belum running atau tidak menghasilkan data
- Analyzer belum running atau tidak menghasilkan analyses
- Data belum masuk ke database

### 3. **Field Mapping Salah**

- Nama field di query tidak cocok dengan struktur tabel
- Field NULL/kosong di database

## ✅ Solusi Step-by-Step

### Step 1: Debug Query dengan Script

Jalankan script debug untuk cek data di database:

```bash
./scripts/debug_n8n_query.sh
```

Script akan menampilkan:
- Jumlah data di database
- Query test (last 2 minutes)
- Top 5 analyses by score

### Step 2: Cek Execution Data di n8n

1. Buka workflow di n8n
2. Klik tab **"Executions"**
3. Klik execution terbaru
4. Klik node **"Query High Score Coins"**
5. Lihat output di tab **"Table"** atau **"JSON"**

**Jika output kosong:**
- Query tidak mengembalikan data
- Lihat Step 3

**Jika output ada data:**
- Data ada tapi mapping salah
- Lihat Step 4

### Step 3: Relax Query Filter (Untuk Testing)

Edit query di node "Query High Score Coins" untuk testing:

**Option 1: Hapus Filter Waktu (Pakai Semua Data)**

```sql
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.overall_score >= 70 
ORDER BY a.created_at DESC 
LIMIT 10
```

**Option 2: Hapus Filter Score (Pakai Semua Score)**

```sql
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY a.overall_score DESC 
LIMIT 10
```

**Option 3: Pakai Filter Lebih Longgar**

```sql
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '1 hour' 
  AND a.overall_score >= 0 
ORDER BY a.overall_score DESC 
LIMIT 10
```

### Step 4: Cek Field Mapping

Jika query mengembalikan data tapi Telegram masih kosong:

1. Buka execution di n8n
2. Klik node **"Query High Score Coins"**
3. Lihat output di tab **"JSON"**
4. Cek apakah field names cocok:
   - `symbol` (bukan `Symbol`)
   - `name` (bukan `Name`)
   - `address` (bukan `Address`)
   - `chain_id` (bukan `chainId`)
   - `overall_score` (bukan `overallScore`)
   - `price_score` (bukan `priceScore`)
   - dll.

### Step 5: Pastikan Crawler & Analyzer Running

```bash
# Cek apakah crawler running
docker-compose ps crawler

# Cek apakah analyzer running
docker-compose ps analyzer

# Cek logs
docker-compose logs crawler | tail -20
docker-compose logs analyzer | tail -20
```

Jika tidak running, start:
```bash
docker-compose up -d crawler analyzer
```

## 🔧 Quick Fix: Ubah Query untuk Testing

### Query yang Lebih Longgar (Recommended untuk Testing)

Edit node "Query High Score Coins" dengan query ini:

```sql
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '1 hour'
  AND a.overall_score >= 50
ORDER BY a.overall_score DESC 
LIMIT 10
```

**Perubahan:**
- `INTERVAL '2 minutes'` → `INTERVAL '1 hour'` (lebih longgar)
- `overall_score >= 70` → `overall_score >= 50` (lebih longgar)

### Query Original (Untuk Production)

Setelah yakin ada data, kembalikan ke query original:

```sql
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '2 minutes' 
  AND a.overall_score >= 70 
ORDER BY a.created_at DESC 
LIMIT 10
```

## 📊 Checklist Debugging

- [ ] Jalankan script debug: `./scripts/debug_n8n_query.sh`
- [ ] Cek execution data di n8n (node "Query High Score Coins")
- [ ] Cek apakah crawler & analyzer running
- [ ] Cek apakah ada data di database
- [ ] Test dengan query yang lebih longgar
- [ ] Verifikasi field mapping di output query
- [ ] Cek apakah field names cocok dengan JavaScript code

## 🎯 Common Issues & Solutions

### Issue 1: Query Tidak Mengembalikan Data

**Gejala:** Output query kosong di n8n

**Solusi:**
- Relax filter waktu (pakai 1 hour instead of 2 minutes)
- Relax filter score (pakai >= 50 instead of >= 70)
- Atau hapus filter untuk testing

### Issue 2: Data Ada Tapi Telegram Kosong

**Gejala:** Query mengembalikan data, tapi Telegram masih kosong/N/A

**Solusi:**
- Cek field mapping di JavaScript code
- Cek apakah field names cocok (case sensitive)
- Cek apakah field NULL di database

### Issue 3: Field NULL di Database

**Gejala:** Query mengembalikan data tapi banyak field NULL

**Solusi:**
- Pastikan crawler menyimpan data dengan benar
- Pastikan analyzer mengisi semua field
- Cek data langsung di database

## 🔗 Related Documentation

- Debug Script: `scripts/debug_n8n_query.sh`
- Database Schema: `scripts/create_database_schema.sql`
- Workflow Setup: `docs/PHASE5_N8N_WORKFLOW.md`


# n8n Workflow: Kirim Semua Notifikasi (Tanpa Threshold)

Dokumentasi tentang perubahan workflow n8n untuk mengirim semua notifikasi tanpa threshold score >= 70, dengan informasi score dan risk level lengkap.

## 📋 Perubahan

### 1. SQL Query - Hapus Threshold Score

**Sebelum:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes' 
  AND a.overall_score >= 70  -- ❌ Filter threshold
  AND c.address IS NOT NULL 
  AND c.symbol IS NOT NULL 
  AND a.overall_score IS NOT NULL
```

**Sesudah:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes' 
  -- ✅ Tidak ada filter threshold
  AND c.address IS NOT NULL 
  AND c.symbol IS NOT NULL 
  AND a.overall_score IS NOT NULL
```

**Tambahan:**
```sql
SELECT 
  ...,
  a.metrics::jsonb->>'riskLevel' as risk_level,
  a.metrics::jsonb->'riskReasons' as risk_reasons,
  ...
```

### 2. Format Message - Tambah Risk Level & Reasons

**Format Notifikasi Baru:**
```
🚀 MEMECOIN ALERT!

🎯 *SYMBOL* (Name)
⭐ Overall Score: 58/100
💰 Price: 70/100 | 📊 Volume: 100/100
👥 Social: 68/100 | ⚠️ Risk Score: 0/100
🔴 Risk Level: HIGH
⚠️ Risk Reasons:
  1. Low liquidity - potential rug pull risk
  2. New token - exercise caution
  3. Mint authority not renounced
  4. Liquidity not locked
🔗 Chain: 999
📍 Address: `2FJTPV5gTt9phaPNitZRHrsYstuaCsDDLGHJubcGpump`
💵 Liquidity: $33,658.38
📈 24h Volume: $632,600.02
---
```

**Risk Level Emoji:**
- ✅ **Low** - Risk rendah
- ⚠️ **Medium** - Risk sedang
- 🔴 **High** - Risk tinggi

### 3. Judul Notifikasi

**Sebelum:**
```
🚀 HIGH SCORE MEMECOIN ALERT!
```

**Sesudah:**
```
🚀 MEMECOIN ALERT!
```

## 🔍 Detail Perubahan

### SQL Query

**File:** `workflows/n8n-memecoin-monitor-simple.json` dan `workflows/n8n-memecoin-monitor.json`

**Perubahan:**
1. **Hapus filter `overall_score >= 70`** - Sekarang semua coin akan dikirim
2. **Tambah `risk_level`** - Extract dari `metrics->>'riskLevel'`
3. **Tambah `risk_reasons`** - Extract dari `metrics->'riskReasons'`

### Format Message (JavaScript Code)

**Perubahan:**
1. **Extract risk level dan reasons:**
   ```javascript
   let riskLevel = data.risk_level || 'unknown';
   let riskReasons = [];
   if (data.risk_reasons && Array.isArray(data.risk_reasons)) {
     riskReasons = data.risk_reasons;
   }
   ```

2. **Format risk level dengan emoji:**
   ```javascript
   let riskLevelEmoji = '⚠️';
   if (riskLevel === 'low') {
     riskLevelEmoji = '✅';
   } else if (riskLevel === 'medium') {
     riskLevelEmoji = '⚠️';
   } else if (riskLevel === 'high') {
     riskLevelEmoji = '🔴';
   }
   ```

3. **Build risk reasons text:**
   ```javascript
   let riskReasonsText = '';
   if (riskReasons.length > 0) {
     riskReasonsText = '\n⚠️ Risk Reasons:\n' + 
       riskReasons.map((reason, idx) => `  ${idx + 1}. ${reason}`).join('\n');
   }
   ```

4. **Update format message:**
   ```javascript
   return `🎯 *${symbol}* (${name})\n` +
     `⭐ Overall Score: ${overallScore}/100\n` +
     `💰 Price: ${priceScore}/100 | 📊 Volume: ${volumeScore}/100\n` +
     `👥 Social: ${socialScore}/100 | ⚠️ Risk Score: ${riskScore}/100\n` +
     `${riskLevelEmoji} Risk Level: ${riskLevel.toUpperCase()}${riskReasonsText}\n` +
     `🔗 Chain: ${chainId}\n` +
     `📍 Address: \`${address}\`\n` +
     `💵 Liquidity: ${liquidityStr}\n` +
     `📈 24h Volume: ${volume24hStr}\n` +
     `---`;
   ```

## 📊 Contoh Notifikasi

### Coin dengan Score Tinggi (>= 70)

```
🚀 MEMECOIN ALERT!

🎯 *COIN* (Coin Name)
⭐ Overall Score: 75/100
💰 Price: 80/100 | 📊 Volume: 70/100
👥 Social: 75/100 | ⚠️ Risk Score: 70/100
✅ Risk Level: LOW
🔗 Chain: 56
📍 Address: `0x...`
💵 Liquidity: $500,000.00
📈 24h Volume: $1,000,000.00
---
```

### Coin dengan Score Rendah (< 70)

```
🚀 MEMECOIN ALERT!

🎯 *Candy* (Candy)
⭐ Overall Score: 58/100
💰 Price: 70/100 | 📊 Volume: 100/100
👥 Social: 68/100 | ⚠️ Risk Score: 0/100
🔴 Risk Level: HIGH
⚠️ Risk Reasons:
  1. Low liquidity - potential rug pull risk
  2. New token - exercise caution
  3. Mint authority not renounced
  4. Liquidity not locked
🔗 Chain: 999
📍 Address: `2FJTPV5gTt9phaPNitZRHrsYstuaCsDDLGHJubcGpump`
💵 Liquidity: $33,658.38
📈 24h Volume: $632,600.02
---
```

## ✅ Validasi Tetap Ada

Workflow masih melakukan validasi untuk memastikan:
1. ✅ Data lengkap (address, symbol, overall_score)
2. ✅ Overall score > 0
3. ✅ Message tidak kosong
4. ✅ Message length < 4000 characters (Telegram limit)

## 🔄 Cara Update Workflow

1. **Import workflow baru:**
   ```bash
   ./scripts/import_n8n_workflow.sh workflows/n8n-memecoin-monitor-simple.json
   ```

2. **Atau update manual di n8n UI:**
   - Edit node "Query High Score Coins"
   - Hapus `AND a.overall_score >= 70` dari SQL query
   - Tambah `a.metrics::jsonb->>'riskLevel' as risk_level` dan `a.metrics::jsonb->'riskReasons' as risk_reasons` ke SELECT
   - Edit node "Format Message"
   - Update JavaScript code sesuai format baru

3. **Restart n8n container:**
   ```bash
   docker-compose restart n8n
   ```

## 📝 Catatan

1. **Semua coin akan dikirim** - Tidak ada filter threshold lagi
2. **Risk level dan reasons ditampilkan** - User bisa lihat risk assessment lengkap
3. **Validasi tetap ada** - Hanya coin dengan data lengkap yang dikirim
4. **Format message lebih informatif** - User bisa lihat semua score dan risk details

## 🎯 Manfaat

1. ✅ **Transparansi** - User bisa lihat semua coin yang dianalisis
2. ✅ **Risk Awareness** - User bisa lihat risk level dan reasons
3. ✅ **Decision Making** - User bisa decide sendiri berdasarkan score dan risk
4. ✅ **No Missed Opportunities** - Coin dengan score < 70 tapi menarik tetap dikirim

---

**Status:** ✅ Workflow updated untuk kirim semua notifikasi dengan risk level dan reasons


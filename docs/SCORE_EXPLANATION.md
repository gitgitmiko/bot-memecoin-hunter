# Penjelasan Parameter Score

Dokumentasi lengkap tentang sistem scoring dan artinya.

## 🎯 Apa itu Overall Score?

**Overall Score** adalah skor gabungan (0-100) yang mengukur **potensi/kesempatan trading** dari sebuah memecoin, BUKAN indikator "scam atau tidak".

### ⚠️ PENTING: Score ≠ Scam Indicator

- **Score >= 70**: Coin memiliki potensi tinggi untuk trading (volume tinggi, price trend bagus, dll)
- **Score < 70**: Coin kurang menarik untuk trading (volume rendah, price trend buruk, dll)
- **Score BUKAN menentukan**: Coin scam atau tidak scam

## 📊 Komponen Overall Score

Overall Score dihitung dari 4 komponen dengan bobot:

```
Overall Score = (Price Score × 20%) + (Volume Score × 30%) + (Social Score × 20%) + (Risk Score × 30%)
```

### 1. Price Score (0-100) - Bobot: 20%

**Mengukur:**
- Price trend (naik/turun dalam 24 jam)
- Price stability (volatilitas)

**Cara Hitung:**
- Base score: 50
- Price naik → +30 (max)
- Price turun → -30 (max)
- Volatilitas rendah → +10
- Volatilitas tinggi → -20

**Contoh:**
- Price naik 15% → Score: 50 + 30 = 80
- Price turun 10% → Score: 50 - 20 = 30
- Price stabil → Score: 50 + 10 = 60

### 2. Volume Score (0-100) - Bobot: 30%

**Mengukur:**
- Volume trading 24 jam (semakin tinggi semakin baik)

**Tier:**
- $1M+ → 100
- $500k+ → 90
- $100k+ → 75
- $50k+ → 60
- $10k+ → 40
- $5k+ → 20
- < $5k → 10

**Contoh:**
- Volume $2M → Score: 100
- Volume $80k → Score: 40
- Volume $3k → Score: 10

### 3. Social Score (0-100) - Bobot: 20%

**Mengukur:**
- Ratio buy vs sell (semakin banyak buy semakin baik)
- Total transactions (semakin banyak semakin baik)

**Cara Hitung:**
- Base score: 50
- Buy ratio tinggi → +50 (max)
- Buy ratio rendah → -50 (max)
- Total transactions > 100 → +10
- Total transactions > 50 → +5

**Contoh:**
- 80% buy, 20% sell → Score: 50 + 40 = 90
- 30% buy, 70% sell → Score: 50 - 20 = 30
- 50% buy, 50% sell → Score: 50

### 4. Risk Score (0-100) - Bobot: 30%

**Mengukur:**
- Tingkat risiko coin (semakin tinggi score = semakin rendah risiko)

**⚠️ INI YANG LEBIH RELEVAN UNTUK SCAM DETECTION!**

**Cara Hitung:**
- Start: 100 (perfect score)
- Honeypot → -100 (instant fail)
- Mint authority → -30
- Liquidity tidak locked → -20
- Risk level high → -40
- Risk level medium → -20
- Setiap risk reason → -5

**Contoh:**
- Honeypot → Score: 0 (SCAM!)
- Mint authority + no lock → Score: 100 - 30 - 20 = 50
- Low risk → Score: 100

## 🔍 Contoh Perhitungan

**Coin A:**
- Price Score: 80 (price naik 15%)
- Volume Score: 90 (volume $600k)
- Social Score: 75 (70% buy)
- Risk Score: 50 (mint authority, no lock)

**Overall Score:**
```
= (80 × 0.2) + (90 × 0.3) + (75 × 0.2) + (50 × 0.3)
= 16 + 27 + 15 + 15
= 73
```

**Coin B:**
- Price Score: 30 (price turun 10%)
- Volume Score: 20 (volume $6k)
- Social Score: 40 (30% buy)
- Risk Score: 70 (low risk)

**Overall Score:**
```
= (30 × 0.2) + (20 × 0.3) + (40 × 0.2) + (70 × 0.3)
= 6 + 6 + 8 + 21
= 41
```

## ❓ FAQ

### Q: Apakah score >= 70 berarti coin tidak scam?

**A: TIDAK!** Score >= 70 hanya berarti:
- Coin memiliki potensi tinggi untuk trading
- Volume tinggi, price trend bagus, social activity tinggi
- **TAPI BISA MASIH SCAM!**

**Contoh:**
- Coin dengan volume $1M, price naik 20%, tapi honeypot → Score: 0 (SCAM!)
- Coin dengan volume $500k, price naik 10%, tapi mint authority → Score: 60-70 (RISKY!)

### Q: Apakah score < 70 berarti coin pasti scam?

**A: TIDAK!** Score < 70 hanya berarti:
- Coin kurang menarik untuk trading
- Volume rendah, price trend buruk, social activity rendah
- **TAPI BISA MASIH LEGIT!**

**Contoh:**
- Coin baru dengan volume $10k, price stabil, low risk → Score: 40-50 (LEGIT tapi kurang menarik)

### Q: Lalu bagaimana cara tahu coin scam atau tidak?

**A: Lihat Risk Score!**

- **Risk Score >= 80**: Low risk (relatif aman)
- **Risk Score 50-79**: Medium risk (hati-hati)
- **Risk Score < 50**: High risk (sangat berisiko)
- **Risk Score = 0**: Honeypot (SCAM!)

**Tapi ingat:**
- Risk check saat ini masih **simplified** (placeholder)
- Untuk production, perlu:
  - Contract analysis untuk honeypot detection
  - Blockchain RPC untuk mint authority check
  - LP lock verification
  - Contract ownership verification

### Q: Kenapa threshold 70?

**A: Untuk filtering notifikasi.**

- Threshold 70 dipilih untuk mengurangi spam
- Hanya coin dengan potensi tinggi yang dikirim notifikasi
- Bukan untuk menentukan scam atau tidak

**Bisa diubah di:**
- `services/analyzer/src/utils/constants.ts`: `HIGH_SCORE_THRESHOLD: 70`
- `workflows/n8n-memecoin-monitor-simple.json`: `WHERE overall_score >= 70`

## 📊 Interpretasi Score

### Overall Score >= 70
✅ **Potensi tinggi untuk trading**
- Volume tinggi
- Price trend bagus
- Social activity tinggi
- **TAPI tetap cek Risk Score!**

### Overall Score 50-69
⚠️ **Potensi sedang**
- Volume sedang
- Price trend biasa
- Social activity sedang
- **Cek Risk Score untuk keputusan**

### Overall Score < 50
❌ **Potensi rendah**
- Volume rendah
- Price trend buruk
- Social activity rendah
- **Biasanya tidak dikirim notifikasi**

## 🎯 Kesimpulan

1. **Overall Score** = Potensi trading, BUKAN scam indicator
2. **Risk Score** = Lebih relevan untuk scam detection
3. **Score >= 70** = Potensi tinggi, BUKAN berarti tidak scam
4. **Score < 70** = Potensi rendah, BUKAN berarti pasti scam
5. **Selalu cek Risk Score** untuk keputusan trading

## 🔧 Customization

### Ubah Threshold

**File:** `services/analyzer/src/utils/constants.ts`
```typescript
export const SCORE_THRESHOLDS = {
  HIGH_SCORE_THRESHOLD: 70, // Ubah ke 60, 80, dll
};
```

**File:** `workflows/n8n-memecoin-monitor-simple.json`
```json
"query": "... WHERE overall_score >= 70 ..." // Ubah ke 60, 80, dll
```

### Ubah Bobot Score

**File:** `services/analyzer/src/services/scoring.service.ts`
```typescript
const weights = {
  price: 0.2,    // Ubah bobot
  volume: 0.3,   // Ubah bobot
  social: 0.2,   // Ubah bobot
  risk: 0.3,     // Ubah bobot
};
```

---

**Status:** ✅ Dokumentasi lengkap tentang scoring system


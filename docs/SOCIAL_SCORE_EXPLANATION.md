# Penjelasan Social Score

Dokumentasi lengkap tentang bagaimana Social Score dihitung.

## 🔍 Dari Mana Social Score?

Social Score dihitung oleh `ScoringService.calculateSocialScore()` berdasarkan data transaksi 24 jam (buys dan sells).

## 📊 Formula Perhitungan

**File:** `services/analyzer/src/services/scoring.service.ts`

```typescript
calculateSocialScore(
  transactions24h?: { buys: number; sells: number }
): number {
  if (!transactions24h) {
    return 50; // Neutral score
  }

  const totalTransactions = transactions24h.buys + transactions24h.sells;
  const buyRatio = transactions24h.buys / (totalTransactions || 1);

  // Higher buy ratio = better score
  let score = 50 + (buyRatio - 0.5) * 50;

  // More transactions = slightly better
  if (totalTransactions > 100) {
    score += 10;
  } else if (totalTransactions > 50) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

## 🧮 Contoh Perhitungan

### Contoh: Coin "中​国时代" (Social Score = 64)

**Data:**
- Buys 24h: 15,142
- Sells 24h: 11,364
- Total Transactions: 26,506

**Perhitungan:**

1. **Buy Ratio:**
   ```
   buyRatio = buys / (buys + sells)
            = 15,142 / 26,506
            = 0.571 (57.1%)
   ```

2. **Base Score:**
   ```
   score = 50 + (buyRatio - 0.5) × 50
        = 50 + (0.571 - 0.5) × 50
        = 50 + 0.071 × 50
        = 50 + 3.55
        = 53.55
   ```

3. **Bonus (karena totalTransactions > 100):**
   ```
   score += 10
   score = 53.55 + 10 = 63.55
   ```

4. **Final Score:**
   ```
   Math.round(63.55) = 64
   ```

**Hasil: Social Score = 64**

## 📈 Faktor yang Mempengaruhi Social Score

### 1. Buy Ratio (Rasio Pembelian)

**Formula:**
```
buyRatio = buys / (buys + sells)
```

**Impact:**
- `buyRatio = 0.5` (50% buys, 50% sells) → Base score = 50
- `buyRatio > 0.5` (lebih banyak buys) → Base score > 50
- `buyRatio < 0.5` (lebih banyak sells) → Base score < 50

**Contoh:**
- Buy ratio 60% → Base score = 55
- Buy ratio 70% → Base score = 60
- Buy ratio 40% → Base score = 45

### 2. Total Transactions (Volume Aktivitas)

**Bonus:**
- `totalTransactions > 100` → +10 poin
- `totalTransactions > 50` → +5 poin
- `totalTransactions <= 50` → +0 poin

**Alasan:**
- Semakin banyak transaksi = semakin aktif coin
- Aktivitas tinggi = indikator interest/engagement

## 📊 Range Social Score

### Minimum (0)
- Buy ratio sangat rendah (< 0%)
- Atau tidak ada transaksi

### Maximum (100)
- Buy ratio sangat tinggi (100% buys, 0% sells)
- Total transactions > 100
- Score = 50 + (1.0 - 0.5) × 50 + 10 = 85
- Tapi bisa lebih tinggi jika buy ratio > 100% (tidak mungkin)

**Praktis:**
- Maximum realistic: ~85-90
- Minimum realistic: ~10-20

## 🎯 Interpretasi Social Score

### Score Tinggi (70-100)
- ✅ Buy ratio tinggi (> 60%)
- ✅ Banyak transaksi (> 100)
- ✅ Indikasi: Interest tinggi, lebih banyak pembeli daripada penjual

### Score Sedang (40-70)
- ⚠️ Buy ratio seimbang (40-60%)
- ⚠️ Transaksi sedang (50-100)
- ⚠️ Indikasi: Aktivitas normal, balance antara buys dan sells

### Score Rendah (0-40)
- 🔴 Buy ratio rendah (< 40%)
- 🔴 Sedikit transaksi (< 50)
- 🔴 Indikasi: Lebih banyak penjual, aktivitas rendah

## 💡 Catatan Penting

1. **Social Score bukan dari social media**
   - Nama "social" mungkin misleading
   - Sebenarnya berdasarkan aktivitas trading (transactions)
   - Bisa dianggap sebagai "Trading Activity Score"

2. **Buy ratio lebih penting daripada volume**
   - Buy ratio menentukan base score
   - Volume hanya memberikan bonus kecil (+5 atau +10)

3. **Score dinamis**
   - Berubah setiap kali analyzer memproses coin
   - Bergantung pada data transaksi 24 jam terakhir

## 🔧 Contoh Lain

### Contoh 1: Coin dengan Buy Ratio Tinggi
- Buys: 8,000
- Sells: 2,000
- Total: 10,000

**Perhitungan:**
- Buy ratio = 8,000 / 10,000 = 0.8 (80%)
- Base score = 50 + (0.8 - 0.5) × 50 = 50 + 15 = 65
- Bonus (totalTransactions > 100): +10
- Final = 65 + 10 = 75

### Contoh 2: Coin dengan Buy Ratio Rendah
- Buys: 2,000
- Sells: 8,000
- Total: 10,000

**Perhitungan:**
- Buy ratio = 2,000 / 10,000 = 0.2 (20%)
- Base score = 50 + (0.2 - 0.5) × 50 = 50 - 15 = 35
- Bonus (totalTransactions > 100): +10
- Final = 35 + 10 = 45

### Contoh 3: Coin dengan Sedikit Transaksi
- Buys: 30
- Sells: 20
- Total: 50

**Perhitungan:**
- Buy ratio = 30 / 50 = 0.6 (60%)
- Base score = 50 + (0.6 - 0.5) × 50 = 50 + 5 = 55
- Bonus (totalTransactions > 50): +5
- Final = 55 + 5 = 60

## 📝 Kesimpulan

**Social Score = 64 untuk coin "中​国时代" berasal dari:**
1. Buy ratio 57.1% (sedikit di atas 50%) → Base score 53.55
2. Bonus +10 karena total transactions > 100 (26,506 transaksi)
3. Final: 53.55 + 10 = 63.55 → dibulatkan menjadi 64

**Ini menunjukkan:**
- Coin memiliki aktivitas trading yang tinggi (26,506 transaksi)
- Buy ratio sedikit di atas 50% (57.1%), menunjukkan lebih banyak pembeli
- Social score 64 adalah score yang wajar untuk coin dengan aktivitas tinggi

---

**Status:** ✅ Dokumentasi lengkap tentang Social Score calculation


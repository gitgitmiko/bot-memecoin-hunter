# Penjelasan Risk Score = 0

Dokumentasi lengkap tentang bagaimana Risk Score dihitung dan kenapa bisa menjadi 0.

## 🔍 Dari Mana Risk Score = 0?

Risk Score dihitung oleh `ScoringService.calculateRiskScore()` berdasarkan hasil dari `RiskCheckService.checkRisks()`.

## 📊 Flow Perhitungan

### 1. Risk Check Service (`checkRisks()`)

**File:** `services/analyzer/src/services/risk-check.service.ts`

Service ini melakukan pengecekan risiko dan mengembalikan `RiskCheckResult`:

```typescript
async checkRisks(
  coinAddress: string,
  _chainId: number,
  liquidityUsd?: number
): Promise<RiskCheckResult>
```

**Hasil untuk memecoin baru (default):**
- `isHoneypot = false` (assume false, karena false positive rate tinggi)
- `hasMintAuthority = true` (assume true for safety - konservatif)
- `liquidityLocked = false` (assume false - konservatif)
- `riskReasons = []` (array of risk reasons):
  - "Low liquidity - potential rug pull risk" (jika liquidity < $50k)
  - "New token - exercise caution" (selalu ditambahkan)
  - "Mint authority not renounced" (jika hasMintAuthority = true)
  - "Liquidity not locked" (jika liquidityLocked = false)
- `riskLevel = 'high'` (jika riskReasons.length >= 3)

**Contoh untuk Solana coin:**
```typescript
{
  isHoneypot: false,
  hasMintAuthority: true,
  liquidityLocked: false,
  riskLevel: 'high',
  riskReasons: [
    'Low liquidity - potential rug pull risk',
    'New token - exercise caution',
    'Mint authority not renounced',
    'Liquidity not locked'
  ]
}
```

### 2. Scoring Service (`calculateRiskScore()`)

**File:** `services/analyzer/src/services/scoring.service.ts`

Service ini menghitung Risk Score dari `RiskCheckResult`:

```typescript
calculateRiskScore(riskCheck: RiskCheckResult): number {
  let score = 100; // Start with perfect score

  // Deduct points for each risk factor
  if (riskCheck.isHoneypot) {
    score -= 100; // Honeypot = instant fail
  }

  if (riskCheck.hasMintAuthority) {
    score -= 30; // Mint authority = major risk
  }

  if (!riskCheck.liquidityLocked) {
    score -= 20; // No liquidity lock = risk
  }

  // Deduct based on risk level
  switch (riskCheck.riskLevel) {
    case 'high':
      score -= 40;
      break;
    case 'medium':
      score -= 20;
      break;
    case 'low':
      // No deduction
      break;
  }

  // Each additional risk reason reduces score
  score -= riskCheck.riskReasons.length * 5;

  return Math.max(0, Math.min(100, score));
}
```

## 🧮 Contoh Perhitungan

**Input (RiskCheckResult):**
- `isHoneypot = false`
- `hasMintAuthority = true`
- `liquidityLocked = false`
- `riskLevel = 'high'`
- `riskReasons = 4` (array dengan 4 reasons)

**Perhitungan:**
```
Start: 100

Deductions:
- isHoneypot (false): 0 (tidak deduct)
- hasMintAuthority (true): -30
- !liquidityLocked (true): -20
- riskLevel 'high': -40
- riskReasons (4 reasons): -20 (4 × 5)

Total: 100 - 30 - 20 - 40 - 20 = -10
→ max(0, -10) = 0
```

**Hasil: Risk Score = 0**

## 📊 Breakdown untuk Coin Candy (Solana)

**Risk Check Result:**
- `isHoneypot = false`
- `hasMintAuthority = true`
- `liquidityLocked = false`
- `riskLevel = 'high'`
- `riskReasons = 4`

**Risk Score Calculation:**
```
Start: 100
- hasMintAuthority: -30 → 70
- !liquidityLocked: -20 → 50
- riskLevel high: -40 → 10
- riskReasons (4): -20 → -10
→ max(0, -10) = 0
```

**Final: Risk Score = 0**

## ⚠️ Kenapa Risk Check Service Konservatif?

Risk check service menggunakan **"assume worst case for safety"** approach:

1. **`hasMintAuthority = true`** (assume true)
   - Karena tidak ada contract analysis yang sebenarnya
   - Lebih aman assume true daripada false

2. **`liquidityLocked = false`** (assume false)
   - Karena tidak ada LP lock verification
   - Lebih aman assume false daripada true

3. **`riskReasons` selalu include "New token"**
   - Semua token yang dianalisis dianggap "new"
   - Memecoin baru memang lebih berisiko

4. **`riskLevel = 'high'` jika riskReasons >= 3**
   - Dengan 4 risk reasons, otomatis jadi 'high'

## 💡 Dampak ke Overall Score

**Contoh: Coin Candy (Solana)**
- Price Score: 70
- Volume Score: 100
- Social Score: 68
- Risk Score: 0

**Overall Score:**
```
= (70 × 20%) + (100 × 30%) + (68 × 20%) + (0 × 30%)
= 14 + 30 + 13.6 + 0
= 57.6 ≈ 58
```

**Tanpa Risk Score = 0:**
Jika Risk Score = 50 (medium risk):
```
= (70 × 20%) + (100 × 30%) + (68 × 20%) + (50 × 30%)
= 14 + 30 + 13.6 + 15
= 72.6 ≈ 73 (>= 70, akan trigger notif!)
```

## 🔧 Cara Meningkatkan Risk Score

Untuk mendapatkan Risk Score > 0, coin perlu:

1. **Liquidity >= $50k** → Tidak ada "Low liquidity" reason
2. **Mint authority renounced** → `hasMintAuthority = false` → +30
3. **Liquidity locked** → `liquidityLocked = true` → +20
4. **Kurang risk reasons** → Kurang deduction

**Contoh ideal:**
- `hasMintAuthority = false` → +30
- `liquidityLocked = true` → +20
- `riskLevel = 'low'` → +40
- `riskReasons = 1` → +15

**Total: 100 - 0 - 0 - 0 - 5 = 95**

## 📝 Catatan

1. **Risk check service adalah placeholder**
   - Tidak ada contract analysis yang sebenarnya
   - Tidak ada blockchain RPC calls
   - Menggunakan assumption untuk safety

2. **Untuk production, perlu:**
   - Contract bytecode analysis
   - Blockchain RPC untuk mint authority check
   - LP lock verification
   - Contract ownership verification

3. **Risk Score = 0 adalah normal**
   - Untuk memecoin baru yang belum diverifikasi
   - Risk check service memang konservatif
   - Ini adalah safety measure

## 🎯 Kesimpulan

**Risk Score = 0 berasal dari:**
1. Risk check service yang konservatif (assume worst case)
2. Banyak deduction points:
   - hasMintAuthority: -30
   - !liquidityLocked: -20
   - riskLevel high: -40
   - riskReasons: -20
3. Total deduction > 100 → Risk Score = 0

**Ini normal untuk memecoin baru** yang belum diverifikasi. Untuk mendapatkan score >= 70, coin perlu memiliki volume sangat tinggi, price trend bagus, dan risk yang lebih rendah.

---

**Status:** ✅ Dokumentasi lengkap tentang Risk Score calculation


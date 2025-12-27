# DexScreener API Usage

Dokumentasi lengkap tentang API DexScreener yang digunakan di crawler service.

## 🔗 Base URL

```
https://api.dexscreener.com
```

## 📡 API Endpoints yang Digunakan

### 1. Token Boosts Latest

**Endpoint:**
```
GET /token-boosts/latest/v1
```

**Deskripsi:**
- Mengambil token yang baru saja di-boost (dipromosikan)
- Berguna untuk hype detection
- Mengembalikan array of boosted tokens

**Response Format:**
```json
[
  {
    "url": "https://dexscreener.com/solana/...",
    "chainId": "solana",
    "tokenAddress": "JAJz9EYCLUrKsAybKEfrQteETTWBQ3z4wL9eypkgpump",
    "description": "RPOW token by Satoshi Nakamoto",
    "icon": "...",
    "header": "...",
    "openGraph": "...",
    "links": [...],
    "totalAmount": 10,
    "amount": 10
  }
]
```

**Penggunaan di Code:**
```typescript
async fetchTokenBoostsLatest(): Promise<any[]> {
  const response = await this.apiClient.get('/token-boosts/latest/v1');
  return response.data; // Array of boosted tokens
}
```

---

### 2. Token Boosts Top

**Endpoint:**
```
GET /token-boosts/top/v1
```

**Deskripsi:**
- Mengambil token dengan boost paling aktif
- Diurutkan berdasarkan totalAmount (jumlah boost)
- Berguna untuk menemukan token yang sedang trending

**Response Format:**
```json
[
  {
    "url": "https://dexscreener.com/solana/...",
    "chainId": "solana",
    "tokenAddress": "2FJTPV5gTt9phaPNitZRHrsYstuaCsDDLGHJubcGpump",
    "description": "CANDY is the child of ANDY...",
    "totalAmount": 500
  }
]
```

**Penggunaan di Code:**
```typescript
async fetchTokenBoostsTop(): Promise<any[]> {
  const response = await this.apiClient.get('/token-boosts/top/v1');
  return response.data; // Array of top boosted tokens
}
```

---

### 3. Community Takeovers (Latest)

**Endpoint:**
```
GET /community-takeovers/latest/v1
```

**Deskripsi:**
- Mengambil daftar token terbaru dari community takeovers
- Mengembalikan array of token profiles dengan informasi dasar

**Response Format:**
```json
[
  {
    "url": "https://dexscreener.com/bsc/0x...",
    "chainId": "bsc",
    "tokenAddress": "0x0a82352ab7238c8ffdf66615fd29bee1f7fd4444",
    "icon": "https://cdn.dexscreener.com/...",
    "header": "https://cdn.dexscreener.com/...",
    "openGraph": "https://cdn.dexscreener.com/...",
    "description": "...",
    "links": [
      {
        "type": "twitter",
        "url": "https://x.com/..."
      },
      {
        "type": "telegram",
        "url": "https://t.me/..."
      }
    ],
    "claimDate": "2025-12-27T04:19:57.239Z"
  }
]
```

**Penggunaan di Code:**
```typescript
async fetchRecentTokenProfiles(): Promise<any[]> {
  const response = await this.apiClient.get('/community-takeovers/latest/v1');
  return response.data; // Array of token profiles
}
```

**Kapan Digunakan:**
- Dipanggil sekali di awal untuk mendapatkan daftar token terbaru
- Digunakan untuk mendapatkan token addresses yang akan di-fetch pairs-nya
- Menghindari perlu fetch semua pairs dari semua chains

---

### 4. Token Pairs

**Endpoint:**
```
GET /token-pairs/v1/{chainId}/{tokenAddress}
```

**Deskripsi:**
- Mengambil semua pairs untuk token tertentu di chain tertentu
- Mengembalikan array of pairs dengan data lengkap (price, volume, liquidity, dll)

**Parameters:**
- `chainId`: Chain identifier (e.g., "ethereum", "bsc", "base")
- `tokenAddress`: Token contract address (0x...)

**Response Format:**
```json
[
  {
    "chainId": "bsc",
    "dexId": "pancakeswap",
    "url": "https://dexscreener.com/bsc/0x...",
    "pairAddress": "0xDE37206aCc3C6551bC54a2Df36466CadDF97676d",
    "baseToken": {
      "address": "0x0a82352ab7238C8Ffdf66615FD29beE1F7Fd4444",
      "name": "中​国时代",
      "symbol": "中​国时代"
    },
    "quoteToken": {
      "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "name": "Wrapped BNB",
      "symbol": "WBNB"
    },
    "priceNative": "0.0000004830",
    "priceUsd": "0.0004041",
    "txns": {
      "m5": { "buys": 7, "sells": 7 },
      "h1": { "buys": 220, "sells": 206 },
      "h6": { "buys": 2681, "sells": 1908 },
      "h24": { "buys": 15142, "sells": 11364 }
    },
    "volume": {
      "m5": 466.85,
      "h1": 44095.43,
      "h6": 573643.84,
      "h24": 2710433.81
    },
    "priceChange": {
      "m5": 1.05,
      "h1": -16.84,
      "h6": -5.32,
      "h24": 480
    },
    "liquidity": {
      "usd": 79304.46,
      "base": 98120734,
      "quote": 47.3991
    },
    "fdv": 404117,
    "marketCap": 404117,
    "pairCreatedAt": 1766763061000
  }
]
```

**Penggunaan di Code:**
```typescript
async fetchPairsByToken(chainId: string, tokenAddress: string): Promise<DexScreenerPair[]> {
  const response = await this.apiClient.get<DexScreenerPair[]>(
    `/token-pairs/v1/${chainId}/${tokenAddress}`
  );
  return response.data; // Array of pairs
}
```

**Kapan Digunakan:**
- Dipanggil untuk setiap token dari community takeovers
- Mengambil data lengkap pairs (price, volume, liquidity, transactions)
- Digunakan untuk normalisasi dan penyimpanan ke database

---

## 🔄 Flow Penggunaan API

```
1. fetchRecentTokenProfiles()
   ↓
   GET /community-takeovers/latest/v1
   ↓
   Return: Array of token profiles
   ↓
2. fetchTokenBoostsLatest() & fetchTokenBoostsTop()
   ↓
   GET /token-boosts/latest/v1
   GET /token-boosts/top/v1
   ↓
   Return: Array of boosted tokens
   ↓
3. Untuk setiap token (profiles + boosts):
   ↓
   fetchPairsByToken(chainId, tokenAddress)
   ↓
   GET /token-pairs/v1/{chainId}/{tokenAddress}
   ↓
   Return: Array of pairs dengan data lengkap
   ↓
4. Deduplicate pairs by pairAddress
   ↓
5. Normalize dan simpan ke database
```

## ⚙️ Konfigurasi

### Base URL
```typescript
private readonly baseUrl = 'https://api.dexscreener.com';
```

### Timeout
```typescript
timeout: 30000  // 30 detik
```

### Headers
```typescript
headers: {
  'Accept': 'application/json',
}
```

## 🚦 Rate Limiting

Untuk menghindari rate limiting, crawler menggunakan:

1. **Delay antar token**: 200ms
   ```typescript
   await new Promise((resolve) => setTimeout(resolve, 200));
   ```

2. **Delay antar chain**: 500ms
   ```typescript
   await new Promise((resolve) => setTimeout(resolve, 500));
   ```

3. **Limit jumlah token**: Maksimal 10 token per chain
   ```typescript
   filteredProfiles.slice(0, 10)
   ```

## 📊 Data yang Diambil

### Dari Community Takeovers:
- Token address
- Chain ID
- Metadata (icon, description, links)

### Dari Token Pairs:
- Price (USD dan native)
- Volume (m5, h1, h6, h24)
- Liquidity (USD, base, quote)
- Transactions (buys/sells per period)
- Price change (m5, h1, h6, h24)
- Pair creation timestamp
- Market cap & FDV

## 🔍 Chain Support

Chains yang didukung:
- `ethereum` (Chain ID: 1)
- `bsc` (Chain ID: 56)
- `base` (Chain ID: 8453)
- `arbitrum` (Chain ID: 42161)
- `polygon` (Chain ID: 137)
- `optimism` (Chain ID: 10)

## 📝 Catatan

1. **Tidak perlu API Key**
   - DexScreener API adalah public API
   - Tidak memerlukan authentication

2. **Rate Limiting**
   - Tidak ada informasi resmi tentang rate limit
   - Menggunakan delay untuk menghindari rate limiting

3. **Data Freshness**
   - Community takeovers adalah data real-time
   - Pairs data juga real-time
   - Data di-update secara berkala oleh DexScreener

4. **Error Handling**
   - Semua API calls memiliki try-catch
   - Jika error, return empty array dan log error
   - Tidak menghentikan proses crawler

## 🔗 Referensi

- **Dokumentasi Resmi**: https://docs.dexscreener.com/
- **API Reference**: https://docs.dexscreener.com/api/reference

---

**Status:** ✅ API sudah terintegrasi dan berfungsi dengan baik


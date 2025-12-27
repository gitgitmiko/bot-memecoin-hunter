# Token Boosts API Integration

Dokumentasi tentang integrasi Token Boosts API dari DexScreener ke crawler service.

## 🎯 Tujuan

Menambahkan API token-boosts untuk:
- Mengambil token yang baru "boosted" (dipromosikan)
- Mengurutkan token dengan boost paling aktif
- Hype detection untuk token yang sedang trending
- Meningkatkan coverage token discovery

## 📡 API yang Ditambahkan

### 1. Token Boosts Latest

**Endpoint:**
```
GET https://api.dexscreener.com/token-boosts/latest/v1
```

**Deskripsi:**
- Mengambil token yang baru saja di-boost
- Mengembalikan array of boosted tokens dengan informasi dasar

**Response Format:**
```json
[
  {
    "url": "https://dexscreener.com/solana/...",
    "chainId": "solana",
    "tokenAddress": "JAJz9EYCLUrKsAybKEfrQteETTWBQ3z4wL9eypkgpump",
    "description": "RPOW token by Satoshi Nakamoto",
    "icon": "900a7183d68761e4b289755c6c83a646b5c0fb3e2f83749b2786797b0637010b",
    "header": "https://cdn.dexscreener.com/...",
    "openGraph": "https://cdn.dexscreener.com/...",
    "links": [
      {
        "url": "https://rpowbitcoin.tech"
      }
    ],
    "totalAmount": 10,
    "amount": 10
  }
]
```

### 2. Token Boosts Top

**Endpoint:**
```
GET https://api.dexscreener.com/token-boosts/top/v1
```

**Deskripsi:**
- Mengambil token dengan boost paling aktif
- Mengurutkan berdasarkan totalAmount (jumlah boost)
- Berguna untuk hype detection

**Response Format:**
```json
[
  {
    "url": "https://dexscreener.com/solana/...",
    "chainId": "solana",
    "tokenAddress": "2FJTPV5gTt9phaPNitZRHrsYstuaCsDDLGHJubcGpump",
    "description": "CANDY is the child of ANDY...",
    "icon": "68aebe7e163f17e377ac9678ac31a76132b01e010f6c1801b45a7c90445fdd42",
    "header": "https://cdn.dexscreener.com/...",
    "openGraph": "https://cdn.dexscreener.com/...",
    "links": [
      {
        "url": "https://auracandy.net/"
      },
      {
        "type": "twitter",
        "url": "https://x.com/auracandy_net"
      }
    ],
    "totalAmount": 500
  }
]
```

## 🔄 Flow Integrasi

```
1. fetchNewPairs() dipanggil
   ↓
2. fetchRecentTokenProfiles()
   → GET /community-takeovers/latest/v1
   → Dapatkan community takeovers
   ↓
3. fetchTokenBoostsLatest() & fetchTokenBoostsTop()
   → GET /token-boosts/latest/v1
   → GET /token-boosts/top/v1
   → Dapatkan boosted tokens
   ↓
4. Untuk setiap token (takeovers + boosts):
   fetchPairsByToken(chainId, tokenAddress)
   → GET /token-pairs/v1/{chainId}/{tokenAddress}
   → Dapatkan data lengkap pairs
   ↓
5. Deduplicate pairs by pairAddress
   ↓
6. Normalize dan simpan ke database
```

## 📊 Method Baru

### fetchTokenBoostsLatest()

```typescript
async fetchTokenBoostsLatest(): Promise<any[]>
```

- Mengambil token yang baru di-boost
- Return: Array of boosted token profiles

### fetchTokenBoostsTop()

```typescript
async fetchTokenBoostsTop(): Promise<any[]>
```

- Mengambil token dengan boost paling aktif
- Return: Array of top boosted token profiles

### fetchBoostedPairs()

```typescript
async fetchBoostedPairs(chainIds: string[]): Promise<DexScreenerPair[]>
```

- Menggabungkan latest dan top boosts
- Deduplicate by tokenAddress
- Fetch pairs untuk setiap boosted token
- Filter pairs created dalam 24 jam terakhir
- Return: Array of pairs dari boosted tokens

### fetchNewPairs() - Updated

```typescript
async fetchNewPairs(
  chainIds: string[] = ['ethereum', 'bsc', 'base'],
  includeBoosts: boolean = true
): Promise<DexScreenerPair[]>
```

**Perubahan:**
- Sekarang menggabungkan community takeovers + token boosts
- Parameter `includeBoosts` untuk enable/disable boosts (default: true)
- Deduplicate pairs untuk menghindari duplikasi
- Return: Array of unique pairs dari semua sumber

## 🎯 Keuntungan

1. **Lebih Banyak Coverage**
   - Tidak hanya community takeovers
   - Juga mengambil boosted tokens (hype detection)

2. **Hype Detection**
   - Token dengan boost tinggi = sedang trending
   - Berguna untuk menemukan token yang sedang naik

3. **Deduplication**
   - Menghindari duplikasi pairs
   - Satu pair hanya disimpan sekali

4. **Flexible**
   - Bisa enable/disable boosts via parameter
   - Tidak mempengaruhi flow existing

## ⚙️ Konfigurasi

### Enable/Disable Boosts

```typescript
// Include boosts (default)
const pairs = await crawler.fetchNewPairs(['ethereum', 'bsc', 'base'], true);

// Exclude boosts (only community takeovers)
const pairs = await crawler.fetchNewPairs(['ethereum', 'bsc', 'base'], false);
```

### Rate Limiting

- Delay 200ms antar token
- Delay 500ms antar chain
- Limit 10 boosted tokens per chain

## 📝 Catatan

1. **Deduplication**
   - Pairs di-deduplicate berdasarkan `pairAddress`
   - Jika pair sudah ada dari community takeovers, tidak akan duplikat dari boosts

2. **Chain Support**
   - Supports semua chains yang sama dengan community takeovers
   - Termasuk Solana (jika ada di boosts)

3. **Error Handling**
   - Jika boosts API gagal, crawler tetap berjalan dengan community takeovers
   - Tidak menghentikan proses crawler

4. **Performance**
   - Boosts di-fetch secara parallel dengan community takeovers
   - Deduplication dilakukan di akhir untuk efisiensi

## 🔍 Testing

Untuk test apakah boosts bekerja:

```bash
# Cek logs crawler
docker-compose logs crawler | grep -i "boost"

# Cek apakah ada pairs dari boosts
docker-compose logs crawler | grep "boosted pairs"
```

## 📊 Expected Output

```
[info] Fetching latest token boosts from DexScreener...
[info] Fetched 29 latest token boosts from DexScreener
[info] Fetching top token boosts from DexScreener...
[info] Fetched 30 top token boosts from DexScreener
[info] Processing 45 unique boosted tokens across 3 chains
[info] Found 12 boosted tokens for chain ethereum (ethereum)
[info] Total boosted pairs found: 8
[info] Added 8 pairs from boosted tokens
[info] Total unique pairs found across all sources: 15
```

---

**Status:** ✅ Token Boosts API sudah terintegrasi


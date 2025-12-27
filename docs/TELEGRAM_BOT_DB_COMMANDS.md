# Telegram Bot Database Commands

Dokumentasi untuk commands Telegram bot yang digunakan untuk mengecek data di database.

## 📋 Available Commands

### 1. `/dbstats`
Menampilkan statistik database secara lengkap.

**Usage:**
```
/dbstats
```

**Output:**
- Total coins di database
- Total analyses di database
- Jumlah high score coins (score > 70)
- Tanggal coin terbaru
- Tanggal analysis terbaru

**Contoh:**
```
📊 Database Statistics

🪙 Total Coins: 5
📈 Total Analyses: 3
⭐ High Score Coins: 2 (overall_score > 70)

📅 Latest Coin: 27/12/2025, 12:56:10
📅 Latest Analysis: 27/12/2025, 13:00:00
```

---

### 2. `/dblist [limit]`
Menampilkan daftar coins terbaru dari database.

**Usage:**
```
/dblist
/dblist 5
/dblist 20
```

**Parameters:**
- `limit` (optional): Jumlah coins yang ditampilkan (default: 10, max: 20)

**Output:**
- List coins dengan informasi:
  - Symbol dan name
  - Address (dalam format code untuk mudah copy)
  - Chain ID dan nama chain
  - Overall score (jika ada analysis)
  - Liquidity (jika ada)
  - Tanggal created

**Contoh:**
```
📋 Recent Coins (10):

1. TOKEN (Token Name)
   📍 Address: 0x1234...
   ⛓️ Chain: BSC (56)
   ⭐ Score: 85/100
   💵 Liquidity: $50,000
   📅 27/12/2025, 12:56:10
```

---

### 3. `/dbcoin <address>`
Menampilkan detail lengkap sebuah coin berdasarkan address.

**Usage:**
```
/dbcoin 0x1234567890123456789012345678901234567890
```

**Parameters:**
- `address`: Ethereum address coin (harus 0x diikuti 40 karakter hex)

**Output:**
- Detail lengkap coin:
  - Symbol dan name
  - Address
  - Chain ID dan nama
  - Coin ID
  - Liquidity
  - Tanggal created
  - Analysis scores (jika ada):
    - Overall score
    - Price score
    - Volume score
    - Social score
    - Risk score

**Contoh:**
```
🪙 Coin Details

TOKEN (Token Name)
📍 Address: 0x1234...
⛓️ Chain: BSC (56)
🆔 ID: 1
💵 Liquidity: $50,000
📅 Created: 27/12/2025, 12:56:10

Analysis Scores:
⭐ Overall Score: 85/100
💰 Price Score: 80/100
📊 Volume Score: 90/100
👥 Social Score: 75/100
⚠️ Risk Score: 95/100
```

---

### 4. `/dbhighscore [limit]`
Menampilkan coins dengan overall score > 70, diurutkan dari score tertinggi.

**Usage:**
```
/dbhighscore
/dbhighscore 5
/dbhighscore 15
```

**Parameters:**
- `limit` (optional): Jumlah coins yang ditampilkan (default: 10, max: 20)

**Output:**
- List coins dengan score tinggi:
  - Symbol dan name
  - Overall score (bold)
  - Address
  - Chain
  - Breakdown scores (price, volume, social, risk)

**Contoh:**
```
⭐ High Score Coins (Score > 70) - 3 coins:

1. TOKEN (Token Name)
   ⭐ Overall Score: 85/100
   📍 Address: 0x1234...
   ⛓️ Chain: BSC
   💰 Price: 80/100 | 📊 Volume: 90/100
   👥 Social: 75/100 | ⚠️ Risk: 95/100
```

---

## 🔧 Command Details

### Error Handling
Semua commands memiliki error handling:
- Jika terjadi error, bot akan mengirim pesan error yang user-friendly
- Log error akan ditulis ke logs untuk debugging

### Message Length
- Telegram memiliki batas 4096 karakter per message
- Commands `/dblist` dan `/dbhighscore` akan otomatis split message jika terlalu panjang
- Message akan dikirim dalam beberapa chunks jika diperlukan

### Address Format
- Address harus dalam format Ethereum address (0x + 40 karakter hex)
- Bot akan melakukan case-insensitive matching
- Format address ditampilkan dalam `<code>` tag untuk mudah di-copy

### Chain Mapping
Chain ID akan otomatis dikonversi ke nama:
- `1` → Ethereum
- `56` → BSC
- `137` → Polygon
- `43114` → Avalanche
- `250` → Fantom
- `42161` → Arbitrum
- `10` → Optimism
- `8453` → Base
- Lainnya → `Chain {chainId}`

---

## 📝 Notes

1. **Data Availability:**
   - Jika coin belum dianalisis, score akan ditampilkan sebagai "N/A"
   - Beberapa field seperti liquidity mungkin null untuk coin tertentu

2. **Performance:**
   - Limit maksimal 20 untuk `/dblist` dan `/dbhighscore` untuk menghindari query yang terlalu berat
   - Semua queries menggunakan index database untuk performa optimal

3. **Updated Commands:**
   - `/stats` sekarang juga menampilkan statistik dari database
   - `/help` dan `/start` sudah di-update dengan commands baru

---

## 🚀 Testing

Untuk test commands, kirim pesan ke bot di Telegram:
1. `/start` - untuk melihat daftar commands
2. `/help` - untuk melihat help lengkap
3. `/dbstats` - untuk cek statistik
4. `/dblist 5` - untuk lihat 5 coins terbaru
5. `/dbcoin 0x...` - untuk lihat detail coin (ganti dengan address yang ada di database)
6. `/dbhighscore` - untuk lihat coins dengan score tinggi

---

## 🔍 Troubleshooting

**Q: Bot tidak merespon commands?**
A: Cek logs bot dengan `docker-compose logs telegram-bot` dan pastikan bot sudah terhubung ke database.

**Q: "Coin not found" padahal ada di database?**
A: Pastikan address yang digunakan benar dan case-insensitive. Address harus lengkap (0x + 40 karakter).

**Q: Message terlalu panjang?**
A: Kurangi limit pada `/dblist` atau `/dbhighscore` (misalnya `/dblist 5`).

**Q: Error "Error getting database statistics"?**
A: Cek koneksi database dengan `docker-compose ps postgres` dan pastikan database service running.


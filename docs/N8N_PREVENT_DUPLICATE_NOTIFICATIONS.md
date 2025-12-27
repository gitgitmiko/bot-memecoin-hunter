# Mencegah Notifikasi Duplikat di n8n Workflow

Dokumentasi tentang bagaimana mencegah notifikasi duplikat yang muncul terus-menerus untuk coin yang sama.

## 🔍 Masalah

### Problem: Notifikasi Muncul Berulang-Ulang

**Gejala:**
- Notifikasi untuk coin yang sama muncul terus-menerus
- Setiap 2 menit, notifikasi yang sama dikirim lagi
- Coin yang sama muncul berulang kali

**Penyebab:**
1. **Query interval terlalu besar**
   - Query mengambil analyses dalam 10 menit terakhir
   - Cron trigger berjalan setiap 2 menit
   - Setiap cycle mengambil analyses yang sama
   - Tidak ada mekanisme untuk track notifikasi yang sudah dikirim

2. **Tidak ada deduplication antar cycle**
   - `DISTINCT ON` hanya mencegah duplikat dalam 1 query
   - Tidak mencegah notifikasi berulang di cycle berikutnya
   - Setiap cycle mengirim notifikasi untuk analyses yang sama

## ✅ Solusi

### Solusi 1: Kurangi Interval Query (Current)

**Prinsip:**
- Interval query harus <= cron interval
- Hanya analyses yang benar-benar baru yang dikirim

**Implementasi:**
```sql
-- Query lama (10 menit)
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'

-- Query baru (2 menit)
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
```

**Kelebihan:**
- ✅ Simple dan efektif
- ✅ Tidak perlu tracking tambahan
- ✅ Hanya analyses baru yang dikirim

**Kekurangan:**
- ⚠️ Jika analyzer memproses coin lebih dari 2 menit setelah dibuat, tidak akan terkirim
- ⚠️ Perlu pastikan analyzer memproses coin dengan cepat

### Solusi 2: Tracking di Database (Alternatif)

**Prinsip:**
- Gunakan `notifications` table untuk track notifikasi yang sudah dikirim
- Query hanya ambil analyses yang belum dikirim

**Implementasi:**
```sql
SELECT DISTINCT ON (a.coin_id) 
  a.id, a.coin_id, ...
FROM analyses a
INNER JOIN coins c ON a.coin_id = c.id
LEFT JOIN notifications n ON n.coin_id = a.coin_id 
  AND n.sent_at >= NOW() - INTERVAL '1 hour'
WHERE a.created_at >= NOW() - INTERVAL '10 minutes'
  AND n.id IS NULL  -- Hanya analyses yang belum dikirim
  AND c.address IS NOT NULL
  AND a.overall_score IS NOT NULL
ORDER BY a.coin_id, a.created_at DESC
```

**Kelebihan:**
- ✅ Bisa track notifikasi yang sudah dikirim
- ✅ Bisa kirim ulang setelah interval tertentu (misalnya 1 jam)
- ✅ Lebih fleksibel

**Kekurangan:**
- ❌ Lebih kompleks
- ❌ Perlu insert ke notifications table setelah kirim
- ❌ Perlu cleanup untuk notifications lama

### Solusi 3: n8n Workflow State (Alternatif)

**Prinsip:**
- Gunakan n8n workflow state untuk track notifikasi
- Simpan list coin_id yang sudah dikirim

**Implementasi:**
- Gunakan "Set" node untuk simpan state
- Check state sebelum kirim notifikasi
- Update state setelah kirim

**Kelebihan:**
- ✅ Tidak perlu database changes
- ✅ Fleksibel

**Kekurangan:**
- ❌ State hilang saat workflow restart
- ❌ Tidak persistent
- ❌ Lebih kompleks

## 📊 Perbandingan Solusi

| Solusi | Simple | Efektif | Persistent | Recommended |
|--------|--------|---------|------------|-------------|
| Kurangi Interval | ✅✅✅ | ✅✅ | N/A | ✅✅✅ |
| Database Tracking | ✅ | ✅✅✅ | ✅✅✅ | ✅✅ |
| Workflow State | ✅ | ✅ | ❌ | ✅ |

## 🎯 Rekomendasi

**Untuk production, gunakan Solusi 1 (Kurangi Interval):**
- Simple dan efektif
- Tidak perlu perubahan database
- Cukup untuk kebutuhan dasar

**Jika perlu tracking lebih detail, gunakan Solusi 2 (Database Tracking):**
- Bisa track notifikasi yang sudah dikirim
- Bisa kirim ulang setelah interval tertentu
- Lebih robust

## 🔧 Implementasi Current

**Query saat ini:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
```

**Cron interval:** 2 menit

**Hasil:**
- ✅ Hanya analyses yang dibuat dalam 2 menit terakhir yang dikirim
- ✅ Setiap cycle hanya ambil analyses baru
- ✅ Tidak ada duplikasi antar cycle

## 📝 Catatan Penting

1. **Interval query harus <= cron interval**
   - Cron: 2 menit
   - Query: 2 menit ✅
   - Jika query > cron, akan ada duplikasi

2. **Analyzer harus memproses coin dengan cepat**
   - Coin harus dianalisis dalam 2 menit setelah ditemukan
   - Jika lebih dari 2 menit, tidak akan terkirim

3. **DISTINCT ON tetap penting**
   - Mencegah duplikat dalam 1 query
   - Jika ada multiple analyses untuk coin yang sama dalam 2 menit
   - Hanya yang terbaru yang dikirim

## 🐛 Troubleshooting

### Problem: Masih ada duplikasi

**Penyebab:**
- Interval query masih terlalu besar
- Atau analyzer memproses coin yang sama beberapa kali

**Solusi:**
1. Kurangi interval query (misalnya 1 menit)
2. Atau implementasikan database tracking

### Problem: Notifikasi tidak terkirim

**Penyebab:**
- Interval query terlalu kecil
- Analyzer memproses coin lebih dari 2 menit setelah ditemukan

**Solusi:**
1. Naikkan interval query (misalnya 3 menit)
2. Atau pastikan analyzer memproses coin dengan cepat

---

**Status:** ✅ Interval query diubah dari 10 menit ke 2 menit untuk mencegah duplikasi


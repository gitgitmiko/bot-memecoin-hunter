# Panduan UI n8n Workflow Editor

## 🎯 Lokasi Tombol-Tombol di n8n Workflow Editor

Berdasarkan deskripsi UI yang Anda lihat, berikut penjelasan lengkap:

## 📍 Layout Toolbar (Kiri ke Kanan)

```
[✓ Log] → [Publish] → [Saved] → [History] → [...] → [Active Toggle]
```

### 1. **Log Ceklis (✓)**
- **Tooltip:** "Published X minutes ago"
- **Fungsi:** Menunjukkan kapan workflow terakhir di-publish
- **Bukan:** Tombol untuk mengaktifkan workflow

### 2. **Tombol "Publish"**
- **Fungsi:** Menyimpan dan publish workflow
- **Bukan:** Mengaktifkan cron trigger
- **Catatan:** Publish ≠ Aktifkan

### 3. **Text "Saved"**
- **Fungsi:** Status auto-save
- **Menunjukkan:** Workflow sudah tersimpan

### 4. **Tombol "History"**
- **Fungsi:** Lihat versi history workflow
- **Bukan:** Tombol aktivasi

### 5. **Tombol "..." (3 titik)**
- **Fungsi:** Menu dropdown (Settings, Delete, dll)
- **Bukan:** Tombol aktivasi

### 6. **Toggle "Active"** ⭐ (INI YANG DICARI!)
- **Lokasi:** Di paling kanan toolbar, setelah tombol "..."
- **Fungsi:** Mengaktifkan/menonaktifkan workflow (cron trigger)
- **Visual:**
  - **OFF (Abu-abu):** Workflow tidak aktif, cron tidak jalan
  - **ON (Hijau):** Workflow aktif, cron jalan otomatis

## 🔍 Cara Mencari Tombol "Active"

### Method 1: Di Toolbar Kanan Atas

1. Lihat ke **kanan atas** workflow editor
2. Setelah tombol "..." (3 titik)
3. Cari toggle switch dengan label **"Active"**
4. Toggle ini yang harus di-ON untuk mengaktifkan cron

### Method 2: Di Sidebar Kiri (Alternatif)

Beberapa versi n8n menampilkan status "Active" di sidebar kiri:
- Di bagian atas sidebar
- Atau di panel "Workflow Settings"

### Method 3: Via Workflow List

1. Klik **"Workflows"** di sidebar kiri
2. Lihat daftar workflows
3. Cari kolom **"Active"** atau **"Status"**
4. Klik toggle di kolom tersebut untuk mengaktifkan

## 🎨 Visual Indicator

### Workflow TIDAK Aktif:
```
[✓] [Publish] [Saved] [History] [...] [OFF Active] ← Abu-abu/OFF
```

### Workflow AKTIF:
```
[✓] [Publish] [Saved] [History] [...] [ON Active] ← Hijau/ON
```

## 📋 Langkah-Langkah Detail

### Step 1: Buka Workflow Editor

1. Login ke n8n
2. Klik **"Workflows"** di sidebar
3. Klik workflow yang ingin diaktifkan
4. Workflow editor akan terbuka

### Step 2: Cari Toggle "Active"

1. Lihat ke **kanan atas** editor
2. Setelah tombol "..." (3 titik)
3. Cari toggle switch dengan label **"Active"**
4. Jika tidak terlihat, scroll ke kanan atau zoom out

### Step 3: Aktifkan Workflow

1. Klik toggle **"Active"**
2. Toggle harus berubah menjadi **hijau/ON**
3. Status workflow berubah menjadi **"Active"**

### Step 4: Verifikasi

1. Toggle "Active" harus **hijau/ON**
2. Di workflow list, status menunjukkan **"Active"**
3. Tunggu 2 menit, cek tab **"Executions"** → Harus ada execution baru

## ⚠️ Jika Tombol "Active" Tidak Terlihat

### Kemungkinan 1: Tersembunyi di Layar

**Solusi:**
- Zoom out browser (Ctrl + -)
- Scroll ke kanan
- Resize window browser

### Kemungkinan 2: Versi n8n Berbeda

**Solusi:**
- Cek di sidebar kiri (Workflow Settings)
- Atau di workflow list (kolom "Active")

### Kemungkinan 3: Workflow Belum Di-publish

**Solusi:**
1. Klik tombol **"Publish"** dulu
2. Setelah publish, tombol "Active" akan muncul

### Kemungkinan 4: Permission Issue

**Solusi:**
- Pastikan user memiliki permission untuk mengaktifkan workflow
- Cek role user di n8n settings

## 🔄 Alternatif: Aktifkan via Workflow List

Jika tidak menemukan di editor:

1. Klik **"Workflows"** di sidebar
2. Lihat daftar workflows
3. Cari workflow Anda
4. Di kolom **"Active"** atau **"Status"**, klik toggle
5. Toggle menjadi hijau/ON

## 📸 Screenshot Reference

Jika masih bingung, cari:
- **Toggle switch** dengan label **"Active"**
- Biasanya di **kanan atas** editor
- Setelah tombol "..." (3 titik)
- Warna: **Hijau** = Aktif, **Abu-abu** = Tidak Aktif

## ✅ Checklist

Sebelum workflow bisa jalan otomatis:

- [ ] Workflow sudah di-publish (tombol "Publish" sudah diklik)
- [ ] Toggle "Active" sudah di-ON (hijau)
- [ ] Status workflow menunjukkan "Active"
- [ ] Cron trigger sudah di-set "Every 2 Minutes"
- [ ] Credentials sudah di-set
- [ ] Chat ID sudah diisi

## 🎯 Quick Reference

**Yang Penting:**
- **Publish** = Simpan workflow (tidak mengaktifkan cron)
- **Active** = Aktifkan cron trigger (toggle ON)
- **Keduanya berbeda!**

**Lokasi Toggle "Active":**
- Di kanan atas editor, setelah tombol "..."
- Atau di workflow list, kolom "Active"

## 🔗 Related Documentation

- Aktivasi Workflow: `docs/N8N_ACTIVATE_WORKFLOW.md`
- Troubleshooting Cron: `docs/N8N_CRON_TRIGGER_TROUBLESHOOTING.md`
- Setup Workflow: `docs/PHASE5_N8N_WORKFLOW.md`


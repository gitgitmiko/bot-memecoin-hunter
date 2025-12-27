# n8n Telegram Timeout Error - Solusi

Dokumentasi untuk mengatasi error "The connection timed out" di n8n Telegram node.

## 🔍 Masalah

**Error:**
```
The connection timed out, consider setting the 'Retry on Fail' option in the node settings
```

**Penyebab:**
- VPS tidak bisa akses Telegram API (network connectivity issue)
- Timeout saat mencoba connect ke `api.telegram.org`

## ✅ Solusi Sementara: Enable Retry on Fail

### Cara 1: Via n8n UI (Recommended)

1. **Buka n8n UI** dan edit workflow
2. **Klik node "Send Telegram"**
3. **Klik tombol "⚙️ Settings"** di node (biasanya di pojok kanan atas node)
4. **Enable "Retry on Fail"**:
   - Centang checkbox "Retry on Fail"
   - Set **"Max Tries"** ke `3` atau `5`
   - Set **"Wait Between Tries"** ke `5000` (5 detik)
5. **Klik "Save"**

### Cara 2: Via Workflow JSON

Workflow sudah di-update dengan retry settings:
```json
{
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000
}
```

**Import workflow yang sudah di-update:**
```bash
./scripts/import_n8n_workflow.sh workflows/n8n-memecoin-monitor-simple.json
```

## ⚠️ Catatan Penting

### Retry Hanya Membantu Jika:
- Network kadang-kadang bisa connect (intermittent connection)
- Timeout terjadi karena network sementara down
- Telegram API sementara overloaded

### Retry TIDAK Akan Membantu Jika:
- Network benar-benar blocked (selalu timeout)
- VPS tidak punya akses internet sama sekali
- Telegram API IP benar-benar di-block

## 🔧 Solusi Permanen: Perbaiki Network Connectivity

### 1. Cek Network Connectivity

**Test dari host:**
```bash
curl -I --connect-timeout 10 https://api.telegram.org
```

**Test dari container:**
```bash
docker-compose exec n8n wget -qO- --timeout=5 https://api.telegram.org
```

### 2. Cek Firewall Rules

```bash
# Cek iptables
sudo iptables -L -n | grep DROP

# Cek UFW
sudo ufw status

# Cek apakah port 443 (HTTPS) blocked
sudo iptables -L -n | grep 443
```

### 3. Cek DNS Resolution

```bash
# Test DNS
nslookup api.telegram.org

# Test dari container
docker-compose exec n8n nslookup api.telegram.org
```

### 4. Solusi Jika VPS di Region yang Block Telegram

**Opsi 1: Gunakan Proxy/VPN**
- Setup proxy server
- Configure n8n dan telegram-bot untuk menggunakan proxy

**Opsi 2: Pindah VPS**
- Pindah ke VPS di region yang tidak block Telegram
- Atau gunakan VPS dengan akses internet penuh

**Opsi 3: Gunakan Telegram Bot API via Proxy**
- Configure Telegram Bot untuk menggunakan proxy
- Update `node-telegram-bot-api` configuration

## 📊 Monitoring

### Cek Log n8n

```bash
# Real-time logs
docker-compose logs -f n8n

# Filter error
docker-compose logs n8n | grep -i "timeout\|error\|telegram"
```

### Cek Log Telegram Bot

```bash
# Real-time logs
docker-compose logs -f telegram-bot

# Filter error
docker-compose logs telegram-bot | grep -i "timeout\|error\|polling"
```

## 🎯 Kesimpulan

1. **Solusi Sementara**: Enable "Retry on Fail" di n8n node settings
2. **Solusi Permanen**: Perbaiki network connectivity VPS ke Telegram API

**Workflow sudah di-update dengan retry settings**, tapi tetap perlu perbaiki network connectivity untuk solusi permanen.

---

**Status:** ⚠️ Network connectivity issue - perlu diperbaiki di level VPS


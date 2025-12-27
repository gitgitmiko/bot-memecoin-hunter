# Diagnosa: Mengapa API Telegram Tidak Bisa Diakses

Dokumentasi lengkap tentang penyebab dan solusi untuk masalah akses ke Telegram API.

## 🔍 Kemungkinan Penyebab

### 1. **VPS di Region yang Block Telegram** ⚠️ (Paling Umum)

**Gejala:**
- DNS resolution berhasil
- Ping timeout (100% packet loss)
- HTTPS connection timeout
- VPS bisa akses internet lain (Google, dll)

**Region yang biasanya block Telegram:**
- Beberapa negara di Asia (tergantung provider)
- Beberapa negara di Timur Tengah
- Beberapa negara dengan regulasi internet ketat

**Solusi:**
- Gunakan proxy/VPN
- Pindah ke VPS di region lain
- Gunakan VPS dengan akses internet penuh

### 2. **Firewall Blocking Outbound HTTPS**

**Gejala:**
- Semua HTTPS connection timeout
- HTTP masih bisa (jika ada)

**Cek:**
```bash
# Cek iptables rules
sudo iptables -L -n -v

# Cek UFW
sudo ufw status verbose

# Cek apakah port 443 blocked
sudo iptables -L -n | grep 443
```

**Solusi:**
```bash
# Allow outbound HTTPS
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Atau disable firewall sementara untuk test
sudo ufw disable
```

### 3. **Network Provider Blocking Telegram**

**Gejala:**
- VPS bisa akses internet lain
- Hanya Telegram API yang tidak bisa diakses
- DNS resolution berhasil tapi connection timeout

**Solusi:**
- Hubungi provider VPS
- Gunakan proxy/VPN
- Gunakan alternative Telegram API endpoint (jika ada)

### 4. **Docker Network Configuration Issue**

**Gejala:**
- Host bisa akses Telegram API
- Container tidak bisa akses

**Cek:**
```bash
# Test dari host
curl -I https://api.telegram.org

# Test dari container
docker-compose exec n8n wget -qO- --timeout=5 https://api.telegram.org
```

**Solusi:**
```bash
# Cek Docker network
docker network inspect memecoin-network

# Restart Docker daemon
sudo systemctl restart docker

# Recreate network
docker network rm memecoin-network
docker network create memecoin-network
```

### 5. **DNS Resolution Issue**

**Gejala:**
- DNS tidak bisa resolve `api.telegram.org`
- Connection timeout karena tidak tahu IP address

**Cek:**
```bash
# Test DNS
nslookup api.telegram.org
dig api.telegram.org

# Test dari container
docker-compose exec n8n nslookup api.telegram.org
```

**Solusi:**
```bash
# Update DNS servers
sudo nano /etc/resolv.conf
# Tambahkan:
# nameserver 8.8.8.8
# nameserver 8.8.4.4

# Atau configure Docker DNS
# Di docker-compose.yml:
# dns:
#   - 8.8.8.8
#   - 8.8.4.4
```

### 6. **ISP/Network Provider Blocking**

**Gejala:**
- Semua akses ke Telegram API timeout
- VPS di region yang tidak seharusnya block Telegram

**Solusi:**
- Hubungi ISP/Provider
- Gunakan proxy/VPN
- Gunakan alternative network path

### 7. **Telegram API Rate Limiting**

**Gejala:**
- Connection timeout setelah banyak request
- Error 429 (Too Many Requests)

**Solusi:**
- Implement rate limiting
- Gunakan exponential backoff
- Reduce request frequency

### 8. **SSL/TLS Certificate Issue**

**Gejala:**
- Connection timeout saat handshake SSL
- SSL certificate verification error

**Cek:**
```bash
# Test SSL connection
openssl s_client -connect api.telegram.org:443 -showcerts

# Test dari container
docker-compose exec n8n openssl s_client -connect api.telegram.org:443
```

**Solusi:**
- Update CA certificates
- Check system time (SSL certificates require correct time)
- Disable SSL verification (NOT recommended for production)

## 🔧 Langkah Diagnosa

### Step 1: Cek DNS Resolution

```bash
nslookup api.telegram.org
# Harus return IP address

# Test dari container
docker-compose exec n8n nslookup api.telegram.org
```

**Jika gagal:**
- Update DNS servers
- Check DNS configuration

### Step 2: Cek Network Connectivity

```bash
# Ping test
ping -c 4 api.telegram.org

# Test HTTPS connection
curl -I --connect-timeout 10 https://api.telegram.org
```

**Jika timeout:**
- Cek firewall rules
- Cek network provider blocking
- Cek VPS region

### Step 3: Cek Firewall Rules

```bash
# Cek iptables
sudo iptables -L -n -v

# Cek UFW
sudo ufw status verbose

# Cek apakah port 443 allowed
sudo iptables -L -n | grep 443
```

**Jika blocked:**
- Allow outbound HTTPS (port 443)
- Disable firewall sementara untuk test

### Step 4: Cek VPS Location

```bash
# Cek IP location
curl -s https://ipinfo.io/json | grep country

# Atau
curl -s https://ip-api.com/json | grep country
```

**Jika di region yang block Telegram:**
- Gunakan proxy/VPN
- Pindah VPS

### Step 5: Cek Docker Network

```bash
# Test dari host
curl -I https://api.telegram.org

# Test dari container
docker-compose exec n8n wget -qO- --timeout=5 https://api.telegram.org
```

**Jika host bisa tapi container tidak:**
- Cek Docker network configuration
- Restart Docker daemon
- Recreate network

## 📊 Test Connectivity Script

Buat script untuk test connectivity:

```bash
#!/bin/bash
echo "🔍 Testing Telegram API Connectivity..."

echo "1. DNS Resolution:"
nslookup api.telegram.org | grep -A 1 "Name:"

echo "2. Ping Test:"
ping -c 2 -W 2 api.telegram.org 2>&1 | tail -2

echo "3. HTTPS Connection:"
curl -I --connect-timeout 10 https://api.telegram.org 2>&1 | head -3

echo "4. From Docker Container:"
docker-compose exec n8n wget -qO- --timeout=5 https://api.telegram.org 2>&1 | head -3

echo "5. VPS Location:"
curl -s --connect-timeout 3 https://ipinfo.io/json 2>/dev/null | grep -E "country|region" || echo "Cannot determine location"
```

## ✅ Solusi Berdasarkan Penyebab

### Jika VPS di Region yang Block Telegram:

**Opsi 1: Gunakan Proxy**
```bash
# Setup proxy di docker-compose.yml
n8n:
  environment:
    - HTTP_PROXY=http://proxy:port
    - HTTPS_PROXY=http://proxy:port
```

**Opsi 2: Pindah VPS**
- Pindah ke VPS di region yang tidak block Telegram
- Atau gunakan VPS dengan akses internet penuh

**Opsi 3: Gunakan VPN**
- Setup VPN di VPS
- Route traffic melalui VPN

### Jika Firewall Blocking:

```bash
# Allow outbound HTTPS
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

### Jika Docker Network Issue:

```bash
# Restart Docker
sudo systemctl restart docker

# Recreate network
docker network rm memecoin-network
docker network create memecoin-network
docker-compose up -d
```

## 🎯 Kesimpulan

**Penyebab paling umum:**
1. VPS di region yang block Telegram (80%)
2. Firewall blocking outbound HTTPS (15%)
3. Docker network configuration issue (5%)

**Solusi terbaik:**
- Jika VPS di region yang block: Gunakan proxy/VPN atau pindah VPS
- Jika firewall issue: Allow outbound HTTPS
- Jika Docker issue: Restart Docker dan recreate network

---

**Status:** ⚠️ Network connectivity issue - perlu diagnosa lebih lanjut berdasarkan hasil test di atas


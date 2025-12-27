# Database Connection Troubleshooting

## Error: `database "memecoin_user" does not exist`

Error ini muncul ketika services mencoba connect ke database dengan nama yang salah. `memecoin_user` adalah **username**, bukan **database name**.

### Penyebab

1. Environment variable `POSTGRES_DB` tidak ter-set dengan benar di container
2. Database `memecoin_hunter` belum dibuat
3. Services menggunakan konfigurasi database yang salah

### Solusi

#### 1. Pastikan Database Ada

Jalankan script untuk memastikan database dibuat:

```bash
./scripts/init_databases.sh
```

Atau manual:

```bash
# Masuk ke PostgreSQL container
docker compose exec postgres psql -U memecoin_user -d postgres

# Buat database
CREATE DATABASE memecoin_hunter;

# Keluar
\q
```

#### 2. Verifikasi Environment Variables

Pastikan `.env` file memiliki konfigurasi yang benar:

```bash
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=your_password_here
```

**PENTING**: `POSTGRES_DB` dan `POSTGRES_USER` harus **BERBEDA**!

#### 3. Verifikasi di Docker Compose

Pastikan `docker-compose.yml` meng-pass environment variables dengan benar:

```yaml
environment:
  - POSTGRES_DB=${POSTGRES_DB:-memecoin_hunter}
  - POSTGRES_USER=${POSTGRES_USER:-memecoin_user}
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

#### 4. Restart Services

Setelah memastikan konfigurasi benar:

```bash
# Stop services
docker compose stop crawler analyzer telegram-bot

# Start services dengan rebuild (opsional)
docker compose up -d --build crawler analyzer telegram-bot

# Atau restart saja
docker compose restart crawler analyzer telegram-bot
```

#### 5. Gunakan Fix Script

Jalankan script otomatis yang akan:
- Memastikan database ada
- Memverifikasi konfigurasi
- Restart services

```bash
./scripts/fix_database_connection.sh
```

### Verifikasi

Cek log services untuk memastikan tidak ada error:

```bash
# Cek log crawler
docker compose logs crawler | grep -i "database\|error"

# Cek log analyzer
docker compose logs analyzer | grep -i "database\|error"

# Cek log telegram-bot
docker compose logs telegram-bot | grep -i "database\|error"
```

### Debugging

#### Cek Environment Variables di Container

```bash
# Cek environment variables di container crawler
docker compose exec crawler env | grep POSTGRES
```

Harus menampilkan:
```
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=...
```

#### Test Database Connection Manual

```bash
# Test connection dari container crawler
docker compose exec crawler node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memecoin_hunter',
  user: process.env.POSTGRES_USER || 'memecoin_user',
  password: process.env.POSTGRES_PASSWORD,
});
pool.query('SELECT NOW()').then(r => {
  console.log('✅ Connection successful!', r.rows[0]);
  pool.end();
}).catch(e => {
  console.error('❌ Connection failed!', e.message);
  process.exit(1);
});
"
```

### Common Mistakes

1. **Salah set database name**: Menggunakan `POSTGRES_USER` sebagai database name
2. **Environment variable tidak ter-load**: File `.env` tidak ter-load dengan benar
3. **Database belum dibuat**: Database `memecoin_hunter` belum dibuat di PostgreSQL
4. **Services tidak restart**: Perubahan `.env` tidak ter-pick up karena services tidak di-restart

### Checklist

- [ ] File `.env` ada dan memiliki `POSTGRES_DB` dan `POSTGRES_USER` yang berbeda
- [ ] Database `memecoin_hunter` sudah dibuat
- [ ] Environment variables ter-pass dengan benar ke containers
- [ ] Services sudah di-restart setelah perubahan konfigurasi
- [ ] Log services tidak menunjukkan database connection errors


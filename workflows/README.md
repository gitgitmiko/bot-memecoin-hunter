# n8n Workflows

Workflow n8n untuk automation meme coin monitoring system.

## Available Workflows

### 1. Memecoin High Score Monitor (Recommended)

**File**: `n8n-memecoin-monitor-simple.json`

Workflow yang memantau hasil analyzer dan mengirim notifikasi Telegram ketika ditemukan coin dengan score tinggi.

**Features**:
- Cron trigger setiap 2 menit
- Query database untuk analyses terbaru
- Filter berdasarkan score threshold
- Send Telegram notification dengan detail coin

**Setup**: Lihat [PHASE5_N8N_WORKFLOW.md](../docs/PHASE5_N8N_WORKFLOW.md)

## Import Workflow

### Via n8n UI

1. Login ke n8n
2. Klik **"Workflows"** → **"Import from File"**
3. Pilih file JSON workflow
4. Configure credentials (PostgreSQL & Telegram)
5. Activate workflow

### Via n8n CLI (if available)

```bash
# Copy workflow to n8n container
docker compose cp workflows/n8n-memecoin-monitor-simple.json n8n:/home/node/.n8n/workflows/

# Or use n8n API (if enabled)
curl -X POST http://your-n8n-url/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @workflows/n8n-memecoin-monitor-simple.json
```

## Workflow Structure

```
[Cron Trigger]
    ↓
[Query Database]
    ↓
[Condition Check]
    ↓
[Format Message] → [Send Telegram]
    OR
[Skip (No Results)]
```

## Customization

Workflow bisa di-customize sesuai kebutuhan:
- Ubah cron interval
- Ubah score threshold
- Customize message format
- Add additional filters
- Add multiple notification channels

Lihat dokumentasi lengkap di `docs/PHASE5_N8N_WORKFLOW.md`.


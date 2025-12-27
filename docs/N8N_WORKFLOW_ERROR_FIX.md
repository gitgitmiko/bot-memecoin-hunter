# Fix Error n8n Workflow - Format Message

## Masalah

Error pada workflow n8n ketika menggunakan Set node dengan ekspresi:
```javascript
"value": "={{ '🎯 *HIGH SCORE MEMECOIN DETECTED!*\\n\\n' + $json.map(item => ...).join('\\n\\n') }}"
```

## Penyebab Error

1. **`$json` bukan array**: Di n8n, `$json` adalah object untuk current item, bukan array
2. **Set node tidak bisa akses semua items**: Set node hanya bekerja dengan current item, tidak bisa mengakses semua items sekaligus
3. **`.map()` tidak bisa digunakan pada object**: Karena `$json` adalah object, tidak bisa menggunakan method array seperti `.map()`

## Solusi

### 1. Ganti Set Node dengan Code Node

Code node bisa menggunakan `$input.all()` untuk mengakses semua items:

```javascript
const items = $input.all();

if (items.length === 0) {
  return { json: { message: '', count: 0 } };
}

const messages = items.map(item => {
  const data = item.json;
  // Format each coin data
  return `🎯 *${data.symbol}* ...`;
});

const fullMessage = `🚀 *HIGH SCORE MEMECOIN ALERT!*\\n\\n${messages.join('\\n\\n')}`;

return { json: { message: fullMessage, count: items.length } };
```

### 2. Fix IF Condition

Ganti `$json.length` dengan `$input.all().length`:

```javascript
// Salah
"leftValue": "={{ $json.length }}"

// Benar
"leftValue": "={{ $input.all().length }}"
```

## Perbedaan Set Node vs Code Node

| Node Type | Akses Data | Use Case |
|-----------|------------|----------|
| **Set Node** | `$json` (current item only) | Mengubah field dari single item |
| **Code Node** | `$input.all()` (all items) | Memproses semua items sekaligus, transformasi kompleks |

## Workflow yang Sudah Diperbaiki

File yang sudah diperbaiki:
- ✅ `workflows/n8n-memecoin-monitor.json`
- ✅ `workflows/n8n-memecoin-monitor-simple.json`

## Testing

Setelah import workflow:
1. Test dengan data dummy di n8n
2. Pastikan format message muncul dengan benar
3. Pastikan semua coins ter-format dengan benar
4. Pastikan Telegram notification terkirim dengan format yang benar


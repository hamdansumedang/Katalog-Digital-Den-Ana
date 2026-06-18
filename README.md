<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8bde5a25-0baf-4f58-8611-db05da6039b1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Fitur Blast WhatsApp (`/blast`) — WAHA + n8n

Halaman `/blast` adalah alat pengiriman pesan WhatsApp massal yang terhubung ke
**WAHA** (WhatsApp HTTP API) dan **n8n** di VPS Anda:

1. **Tambah kontak** — import dari kontak HP (Contact Picker API, Chrome Android)
   atau ketik manual satu nomor per baris (`Nama, 08xxxx` atau `08xxxx`). Nomor
   otomatis dinormalisasi ke format `62xxxx` dan duplikat dibuang.
2. **Cek nomor WhatsApp aktif** — memvalidasi nomor lewat **WAHA**
   (`GET /api/contacts/check-exists`) melalui proxy `/api/wa/validate`, lalu
   menandai aktif/tidak aktif.
3. **Simpan grup kontak (opsional)** — grup disimpan di `localStorage` browser
   dan bisa dimuat ulang kapan saja.
4. **Tulis pesan & kirim** — pesan mendukung variabel `{nama}`. App mengirim
   **seluruh daftar penerima sekaligus** ke **n8n workflow**; n8n yang melakukan
   **loop + Wait 7 detik** (dapat diubah) per pesan dan mengirim ke WAHA. Status
   **berhasil/gagal tiap nomor** dilaporkan balik ke app secara realtime.

### Arsitektur alur kirim

```
App (/blast)                Server (proxy)              n8n + WAHA (VPS)
   |  POST /api/wa/send  ----->  trigger N8N_WEBHOOK_URL  ----->  Webhook
   |  (seluruh contacts)        (jobId, callbackUrl,             Loop tiap kontak:
   |                             intervalSeconds, contacts)        - WAHA sendText
   |                                                               - callback hasil
   |  <----- polling GET /api/wa/status <--- POST /api/wa/result <-- (per nomor)
   v  (update status per kontak)            (dari n8n)
```

- `POST /api/wa/send` — membuat `jobId`, meneruskan daftar ke n8n, balas segera.
- `POST /api/wa/result` — callback dari n8n, mencatat hasil per nomor.
- `GET  /api/wa/status?jobId=` — dipoll app untuk status realtime.
- `POST /api/wa/validate` — cek nomor via WAHA `check-exists`.

### Konfigurasi (`.env`)

| Variabel | Fungsi |
|---|---|
| `WAHA_URL` | Base URL WAHA (untuk cek nomor aktif) |
| `WAHA_API_KEY` | API key WAHA (header `X-Api-Key`) |
| `WAHA_SESSION` | Nama session WAHA (default `default`) |
| `N8N_WEBHOOK_URL` | URL webhook workflow n8n blast |
| `APP_URL` | URL publik app, dipakai n8n untuk callback status |

> Tanpa `APP_URL`, n8n tetap mengirim pesan tetapi status berhasil/gagal tidak
> bisa tampil realtime di app (n8n tak punya alamat callback).

### Setup workflow n8n

1. Import file [`n8n/whatsapp-blast-waha.json`](n8n/whatsapp-blast-waha.json) ke n8n.
2. Set environment variable di n8n: `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION`.
3. Aktifkan workflow, salin URL webhook → isikan ke `N8N_WEBHOOK_URL` (atau ke
   field webhook di halaman `/blast`).

**Payload app → n8n:**

```json
{
  "jobId": "job_...",
  "callbackUrl": "https://app-anda.com/api/wa/result",
  "intervalSeconds": 7,
  "contacts": [{ "target": "628xxxx", "message": "Halo Budi ...", "name": "Budi" }]
}
```

**Payload callback n8n → app (per nomor):**

```json
{ "jobId": "job_...", "target": "628xxxx", "status": "sent", "detail": "" }
```

Workflow memanggil WAHA `POST /api/sendText` dengan body
`{ session, chatId: "<target>@c.us", text: "<message>" }`.

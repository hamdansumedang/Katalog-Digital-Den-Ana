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

## Fitur Blast WhatsApp (`/blast`) — n8n + WAHA

Halaman `/blast` adalah alat pengiriman pesan WhatsApp massal. **App hanya
berbicara ke n8n**; n8n yang memanggil **WAHA** (WhatsApp HTTP API). WAHA bersifat
internal di VPS (mis. `http://waha:3000`) dan tidak diakses langsung oleh app.

1. **Tambah kontak** — import dari kontak HP (Contact Picker API, Chrome Android)
   atau ketik manual satu nomor per baris (`Nama, 08xxxx` atau `08xxxx`). Nomor
   otomatis dinormalisasi ke format `62xxxx` dan duplikat dibuang.
2. **Cek nomor WhatsApp aktif** — app → `/api/wa/validate` → webhook n8n
   `wa-check` → WAHA `check-exists` (sinkron), lalu menandai aktif/tidak aktif.
3. **Simpan grup kontak (opsional)** — grup disimpan di `localStorage` browser
   dan bisa dimuat ulang kapan saja.
4. **Tulis pesan & kirim** — pesan mendukung variabel `{nama}`. App mengirim
   **seluruh daftar penerima sekaligus** ke webhook n8n `wa-blast`; n8n yang
   melakukan **loop + jeda 7 detik** (dapat diubah) per pesan via WAHA `sendText`.
   Status **berhasil/gagal tiap nomor** dilaporkan balik ke app secara realtime.

### Arsitektur

```
App (/blast)            Server (proxy)              n8n (VPS)            WAHA (internal)
   | cek nomor                                                          http://waha:3000
   |  POST /api/wa/validate -> trigger wa-check  ->  Code loop  ------->  GET /contacts/check-exists
   |  <------------- {registered, not_registered} <- Respond  <---------  numberExists
   |
   | kirim
   |  POST /api/wa/send  ----->  trigger wa-blast ->  Respond accepted
   |  (seluruh contacts)        (jobId, callbackUrl,  Code loop tiap kontak:
   |                             intervalSeconds)       - WAHA POST /sendText
   |                                                    - callback hasil + jeda
   |  <- polling /api/wa/status <- POST /api/wa/result <-- (per nomor)
   v  (update status per kontak)        (dari n8n)
```

Endpoint server (app):
- `POST /api/wa/validate` — teruskan ke webhook n8n `wa-check`, balas registered/not.
- `POST /api/wa/send` — buat `jobId`, trigger webhook n8n `wa-blast`, balas segera.
- `POST /api/wa/result` — callback dari n8n, mencatat hasil per nomor.
- `GET  /api/wa/status?jobId=` — dipoll app untuk status realtime.

### Konfigurasi env

**Sisi app (`.env`):**

| Variabel | Fungsi |
|---|---|
| `N8N_WEBHOOK_URL` | Webhook n8n blast (`.../webhook/wa-blast`) |
| `N8N_CHECK_WEBHOOK_URL` | Webhook n8n cek nomor (`.../webhook/wa-check`) |
| `APP_URL` | URL publik app, dipakai n8n untuk callback status |

> Tanpa `APP_URL`, n8n tetap mengirim pesan tetapi status berhasil/gagal tidak
> bisa tampil realtime di app (n8n tak punya alamat callback).

**Sisi n8n (docker-compose, service `n8n`):**

| Variabel | Nilai |
|---|---|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` (wajib — Code node baca `$env`) |
| `N8N_WAHA_BASE_URL` | `http://waha:3000` |
| `N8N_WAHA_API_KEY` | API key WAHA |
| `N8N_WAHA_SESSION` | `default` |

### Setup workflow n8n

Dua workflow yang perlu di-import lalu **di-Activate** (path produksi baru hidup setelah aktif):

1. [`n8n/whatsapp-blast-waha.json`](n8n/whatsapp-blast-waha.json) → webhook `wa-blast`
2. [`n8n/wa-check-exists.json`](n8n/wa-check-exists.json) → webhook `wa-check`

**Cara cepat (otomatis):** jalankan importer dari mesin yang bisa mengakses n8n
(mis. VPS). Skrip ini meng-create + meng-activate kedua workflow via REST API:

```bash
N8N_URL="https://n8n.asy-syifaa.com" \
N8N_API_KEY="<api-key-n8n>" \
npm run n8n:import
```

API key dibuat di n8n: **Settings → n8n API → Create an API key**. Skrip akan
mendeteksi workflow bernama sama (update, bukan duplikat) dan mencetak URL webhook
hasilnya. Skrip TIDAK menyetel env WAHA — pastikan env n8n di bawah sudah ada.

**Cara manual:** Workflows → menu (…) → **Import from File** → pilih kedua file →
aktifkan toggle "Active".

Untuk instance `n8n.asy-syifaa.com`, URL produksinya:

```
https://n8n.asy-syifaa.com/webhook/wa-blast
https://n8n.asy-syifaa.com/webhook/wa-check
```

> Catatan: URL editor (`.../workflow/<id>`) berbeda dari webhook produksi
> (`.../webhook/<path>`) — yang dipakai app adalah yang `/webhook/`.

Konvensi penting (mengikuti backup workflow ASF yang sudah terbukti):
- Webhook v2 membungkus body POST di `item.json.body`.
- Di **Code node** pakai `this.helpers.httpRequest(...)` — `fetch` tidak tersedia.
- `$env` perlu `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.

**Payload app → n8n (`wa-blast`):**

```json
{
  "jobId": "job_...",
  "callbackUrl": "https://app-anda.com/api/wa/result",
  "intervalSeconds": 7,
  "contacts": [{ "target": "628xxxx", "message": "Halo Budi ...", "name": "Budi" }]
}
```

**Callback n8n → app (per nomor):**

```json
{ "jobId": "job_...", "target": "628xxxx", "status": "sent", "detail": "" }
```

**Payload app → n8n (`wa-check`):** `{ "targets": ["628xxxx", ...] }`
→ balas `{ "registered": [...], "not_registered": [...] }`.

Workflow memanggil WAHA `POST {N8N_WAHA_BASE_URL}/api/sendText` (header
`X-Api-Key`) dengan body `{ session, chatId: "<target>@c.us", text: "<message>" }`.

> Catatan skala: blast memakai satu eksekusi Code node yang loop + jeda. Untuk
> daftar sangat besar, pastikan timeout eksekusi n8n tidak memotong proses
> (`EXECUTIONS_TIMEOUT` longgar / `-1`).

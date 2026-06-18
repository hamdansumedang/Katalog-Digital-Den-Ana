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

## Fitur Blast WhatsApp (`/blast`)

Halaman `/blast` adalah alat pengiriman pesan WhatsApp massal:

1. **Tambah kontak** — import dari kontak HP (Contact Picker API, Chrome Android)
   atau ketik manual satu nomor per baris (`Nama, 08xxxx` atau `08xxxx`). Nomor
   otomatis dinormalisasi ke format `62xxxx` dan duplikat dibuang.
2. **Cek nomor WhatsApp aktif** — memvalidasi nomor melalui Fonnte
   (`/api/wa/validate`) dan menandai aktif/tidak aktif.
3. **Simpan grup kontak (opsional)** — grup disimpan di `localStorage` browser
   dan bisa dimuat ulang kapan saja.
4. **Tulis pesan & kirim** — pesan mendukung variabel `{nama}`. Tiap pesan
   dikirim ke **n8n workflow** lewat proxy server (`/api/wa/send`) dengan
   **interval 7 detik** (dapat diubah) antar pesan, lengkap dengan progress bar
   dan status per kontak.

### Konfigurasi

- `FONNTE_TOKEN` — token Fonnte untuk validasi nomor WhatsApp.
- `N8N_WEBHOOK_URL` — URL webhook n8n tujuan pengiriman. Bisa juga diisi
  langsung dari halaman `/blast` (tersimpan di browser).

Payload yang dikirim server ke n8n per pesan:

```json
{ "target": "628xxxx", "message": "Halo Budi ...", "name": "Budi" }
```

Workflow n8n cukup menerima webhook tersebut lalu mengirim pesan ke WhatsApp
(mis. via node Fonnte/HTTP Request). Interval pengiriman sudah diatur oleh
aplikasi, jadi n8n hanya perlu memproses satu pesan per panggilan.

#!/usr/bin/env node
/**
 * Importer workflow n8n untuk fitur Blast WhatsApp (WAHA).
 *
 * Membuat DAN mengaktifkan workflow di n8n via REST API:
 *   - n8n/whatsapp-blast-waha.json  (webhook: wa-blast)
 *   - n8n/wa-check-exists.json       (webhook: wa-check)
 *
 * Jalankan dari mesin yang BISA mengakses n8n Anda (mis. VPS):
 *
 *   N8N_URL="https://n8n.asy-syifaa.com" \
 *   N8N_API_KEY="<api-key-n8n-anda>" \
 *   node n8n/import-workflows.mjs
 *
 * API key n8n dibuat di: Settings -> n8n API -> Create an API key.
 *
 * Catatan: skrip ini TIDAK menyetel env WAHA di n8n. Pastikan service n8n
 * sudah punya: N8N_BLOCK_ENV_ACCESS_IN_NODE=false, N8N_WAHA_BASE_URL,
 * N8N_WAHA_API_KEY, N8N_WAHA_SESSION (lihat README).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const N8N_URL = (process.env.N8N_URL || '').replace(/\/+$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY || '';

if (!N8N_URL || !N8N_API_KEY) {
  console.error('❌ Set dulu N8N_URL dan N8N_API_KEY sebagai environment variable.');
  console.error('   Contoh: N8N_URL="https://n8n.asy-syifaa.com" N8N_API_KEY="xxx" node n8n/import-workflows.mjs');
  process.exit(1);
}

const FILES = ['whatsapp-blast-waha.json', 'wa-check-exists.json'];

const api = async (path, options = {}) => {
  const res = await fetch(`${N8N_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path} -> ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
};

const importOne = async (file) => {
  const raw = JSON.parse(readFileSync(join(__dirname, file), 'utf8'));

  // API create hanya menerima field tertentu.
  const payload = {
    name: raw.name,
    nodes: raw.nodes,
    connections: raw.connections,
    settings: raw.settings || { executionOrder: 'v1' },
  };

  // Cek apakah workflow dengan nama sama sudah ada (hindari duplikat).
  const existing = await api('/workflows?limit=250');
  const found = (existing.data || existing || []).find((w) => w.name === raw.name);

  let wf;
  if (found) {
    wf = await api(`/workflows/${found.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    console.log(`↻ Update : ${raw.name} (id ${found.id})`);
  } else {
    wf = await api('/workflows', { method: 'POST', body: JSON.stringify(payload) });
    console.log(`＋ Create : ${raw.name} (id ${wf.id})`);
  }

  // Aktifkan.
  try {
    await api(`/workflows/${wf.id}/activate`, { method: 'POST' });
    console.log(`✅ Active : ${raw.name}`);
  } catch (e) {
    console.log(`⚠️  Gagal aktivasi otomatis (${raw.name}): ${e.message}`);
    console.log('   Aktifkan manual via toggle di UI n8n.');
  }

  // Tampilkan path webhook bila ada.
  const webhook = (raw.nodes || []).find((n) => n.type === 'n8n-nodes-base.webhook');
  if (webhook?.parameters?.path) {
    console.log(`   Webhook: ${N8N_URL}/webhook/${webhook.parameters.path}`);
  }
};

(async () => {
  console.log(`🔗 n8n: ${N8N_URL}\n`);
  for (const file of FILES) {
    try {
      await importOne(file);
    } catch (e) {
      console.error(`❌ ${file}: ${e.message}`);
      process.exitCode = 1;
    }
    console.log('');
  }
  console.log('Selesai. Salin URL webhook di atas ke env app:');
  console.log('  N8N_WEBHOOK_URL       = .../webhook/wa-blast');
  console.log('  N8N_CHECK_WEBHOOK_URL = .../webhook/wa-check');
})();

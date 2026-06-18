import { BlastContact, ContactGroup } from '../types';

/**
 * Normalisasi nomor ke format internasional Indonesia (62xxxxxxxxxx).
 * Menerima format 08xx, 8xx, +62xx, 62xx, atau dengan spasi/strip.
 */
export const normalizeNumber = (raw: string): string => {
  let digits = (raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (digits.startsWith('620')) {
    // 620xxx -> 62xxx
    digits = '62' + digits.slice(3);
  }
  return digits;
};

const isValidNumber = (num: string): boolean => {
  // 62 + 8-13 digit nasional
  return /^62\d{8,13}$/.test(num);
};

/**
 * Parse teks bebas menjadi daftar kontak.
 * Setiap baris bisa berupa: "Nama, 08xxxx" atau "08xxxx" atau "08xxxx Nama".
 * Pemisah antar baris: newline. Pemisah nama/nomor: koma, titik koma, atau tab.
 */
export const parseContacts = (text: string): BlastContact[] => {
  const lines = (text || '').split(/\r?\n/);
  const out: BlastContact[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let name = '';
    let numberPart = trimmed;

    // Pisahkan nama & nomor jika ada pemisah koma / titik koma / tab
    const sepMatch = trimmed.split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
    if (sepMatch.length >= 2) {
      // Tentukan bagian mana yang berisi banyak digit (itu nomornya)
      const numIdx = sepMatch.findIndex(s => (s.replace(/[^\d]/g, '').length >= 8));
      if (numIdx >= 0) {
        numberPart = sepMatch[numIdx];
        name = sepMatch.filter((_, i) => i !== numIdx).join(' ').trim();
      }
    }

    const number = normalizeNumber(numberPart);
    if (!isValidNumber(number)) continue;
    if (seen.has(number)) continue;
    seen.add(number);

    out.push({
      name: name || number,
      number,
      raw: trimmed,
      waStatus: 'unknown',
      sendStatus: 'idle',
    });
  }

  return out;
};

/**
 * Import kontak dari perangkat menggunakan Contact Picker API (Android Chrome).
 * Mengembalikan null bila tidak didukung.
 */
export const importFromDevice = async (): Promise<BlastContact[] | null> => {
  const nav = navigator as any;
  if (!nav.contacts || typeof nav.contacts.select !== 'function') {
    return null;
  }
  try {
    const props = ['name', 'tel'];
    const selected = await nav.contacts.select(props, { multiple: true });
    const out: BlastContact[] = [];
    const seen = new Set<string>();

    for (const c of selected) {
      const name = Array.isArray(c.name) ? c.name[0] : c.name;
      const tels: string[] = Array.isArray(c.tel) ? c.tel : [c.tel].filter(Boolean);
      for (const tel of tels) {
        const number = normalizeNumber(tel);
        if (!isValidNumber(number) || seen.has(number)) continue;
        seen.add(number);
        out.push({
          name: name || number,
          number,
          raw: tel,
          waStatus: 'unknown',
          sendStatus: 'idle',
        });
      }
    }
    return out;
  } catch (err) {
    console.error('Contact Picker error:', err);
    return [];
  }
};

/**
 * Cek apakah daftar nomor terdaftar/aktif di WhatsApp melalui proxy server (Fonnte validate).
 */
export const checkWhatsApp = async (
  numbers: string[],
): Promise<Record<string, 'active' | 'inactive'>> => {
  const result: Record<string, 'active' | 'inactive'> = {};
  if (numbers.length === 0) return result;

  try {
    const response = await fetch('/api/wa/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: numbers }),
    });
    const data = await response.json();

    const registered: string[] = (data.registered || []).map(normalizeNumber);
    const notRegistered: string[] = (data.not_registered || data.notRegistered || []).map(
      normalizeNumber,
    );

    for (const n of numbers) {
      const norm = normalizeNumber(n);
      if (registered.includes(norm)) result[n] = 'active';
      else if (notRegistered.includes(norm)) result[n] = 'inactive';
      // jika tidak ada di kedua list, biarkan tidak diset (unknown)
    }
  } catch (err) {
    console.error('checkWhatsApp error:', err);
  }
  return result;
};

/**
 * Kirim satu pesan melalui n8n workflow (via proxy server).
 */
export const sendOne = async (params: {
  target: string;
  message: string;
  name?: string;
  webhookUrl?: string;
}): Promise<{ ok: boolean; detail?: any }> => {
  try {
    const response = await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data.status !== false, detail: data };
  } catch (err) {
    console.error('sendOne error:', err);
    return { ok: false, detail: String(err) };
  }
};

/** Render template pesan: ganti {nama} / {name} dengan nama kontak. */
export const renderMessage = (template: string, contact: BlastContact): string => {
  return (template || '')
    .replace(/\{nama\}/gi, contact.name || '')
    .replace(/\{name\}/gi, contact.name || '')
    .replace(/\{nomor\}/gi, contact.number || '')
    .replace(/\{number\}/gi, contact.number || '');
};

// ---- Penyimpanan grup kontak di localStorage ----

const GROUPS_KEY = 'wa_blast_groups';
const WEBHOOK_KEY = 'wa_blast_n8n_webhook';

export const loadGroups = (): ContactGroup[] => {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ContactGroup[];
  } catch {
    return [];
  }
};

export const saveGroup = (name: string, contacts: BlastContact[]): ContactGroup[] => {
  const groups = loadGroups();
  const cleaned: BlastContact[] = contacts.map(c => ({
    name: c.name,
    number: c.number,
    raw: c.raw,
    waStatus: c.waStatus,
    sendStatus: 'idle',
  }));
  const idx = groups.findIndex(g => g.name.toLowerCase() === name.toLowerCase());
  const group: ContactGroup = {
    name,
    contacts: cleaned,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) groups[idx] = group;
  else groups.push(group);
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups;
};

export const deleteGroup = (name: string): ContactGroup[] => {
  const groups = loadGroups().filter(g => g.name.toLowerCase() !== name.toLowerCase());
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups;
};

export const getSavedWebhook = (): string => {
  try {
    return localStorage.getItem(WEBHOOK_KEY) || '';
  } catch {
    return '';
  }
};

export const setSavedWebhook = (url: string): void => {
  try {
    localStorage.setItem(WEBHOOK_KEY, url);
  } catch {
    /* ignore */
  }
};

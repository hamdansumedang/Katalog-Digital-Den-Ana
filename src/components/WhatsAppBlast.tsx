import { useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Users,
  ClipboardList,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Contact,
  Trash2,
  Save,
  FolderOpen,
  Send,
  Loader2,
  Filter,
  Plus,
  StopCircle,
} from 'lucide-react';
import { BlastContact, ContactGroup } from '../types';
import {
  parseContacts,
  importFromDevice,
  checkWhatsApp,
  startBlast,
  getJobStatus,
  renderMessage,
  loadGroups,
  saveGroup,
  deleteGroup,
  getSavedWebhook,
  setSavedWebhook,
} from '../services/blastService';

const SEND_INTERVAL_SECONDS = 7;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function WhatsAppBlast() {
  const [contacts, setContacts] = useState<BlastContact[]>([]);
  const [manualText, setManualText] = useState('');
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState<ContactGroup[]>(() => loadGroups());
  const [webhookUrl, setWebhookUrl] = useState(() => getSavedWebhook());
  const [interval, setIntervalSec] = useState(SEND_INTERVAL_SECONDS);
  const [onlyActive, setOnlyActive] = useState(true);

  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, eta: 0 });
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const cancelRef = useRef(false);

  const stats = useMemo(() => {
    const active = contacts.filter(c => c.waStatus === 'active').length;
    const inactive = contacts.filter(c => c.waStatus === 'inactive').length;
    const unknown = contacts.filter(c => c.waStatus === 'unknown').length;
    const sent = contacts.filter(c => c.sendStatus === 'sent').length;
    const failed = contacts.filter(c => c.sendStatus === 'failed').length;
    return { active, inactive, unknown, sent, failed };
  }, [contacts]);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const mergeContacts = (incoming: BlastContact[]) => {
    setContacts(prev => {
      const map = new Map(prev.map(c => [c.number, c]));
      for (const c of incoming) {
        if (!map.has(c.number)) map.set(c.number, c);
      }
      return Array.from(map.values());
    });
  };

  // ---- Step 1: Import / Manual ----
  const handleAddManual = () => {
    const parsed = parseContacts(manualText);
    if (parsed.length === 0) {
      showToast('err', 'Tidak ada nomor valid yang terdeteksi.');
      return;
    }
    mergeContacts(parsed);
    setManualText('');
    showToast('ok', `${parsed.length} nomor ditambahkan.`);
  };

  const handleImportDevice = async () => {
    const result = await importFromDevice();
    if (result === null) {
      showToast('err', 'Import kontak tidak didukung di browser ini (gunakan Chrome Android).');
      return;
    }
    if (result.length === 0) {
      showToast('err', 'Tidak ada kontak yang dipilih.');
      return;
    }
    mergeContacts(result);
    showToast('ok', `${result.length} kontak diimport.`);
  };

  const removeContact = (number: string) => {
    setContacts(prev => prev.filter(c => c.number !== number));
  };

  const clearContacts = () => setContacts([]);

  // ---- Step 2: Cek WhatsApp ----
  const handleCheckWhatsApp = async () => {
    if (contacts.length === 0) return;
    setIsChecking(true);
    try {
      const numbers = contacts.map(c => c.number);
      const result = await checkWhatsApp(numbers);
      setContacts(prev =>
        prev.map(c => ({
          ...c,
          waStatus: result[c.number] ?? c.waStatus,
        })),
      );
      const checked = Object.keys(result).length;
      showToast('ok', `Pengecekan selesai (${checked} nomor terdata).`);
    } catch {
      showToast('err', 'Gagal mengecek nomor WhatsApp.');
    } finally {
      setIsChecking(false);
    }
  };

  // ---- Step 3: Grup ----
  const handleSaveGroup = () => {
    const name = groupName.trim();
    if (!name) {
      showToast('err', 'Nama grup wajib diisi.');
      return;
    }
    if (contacts.length === 0) {
      showToast('err', 'Belum ada kontak untuk disimpan.');
      return;
    }
    setGroups(saveGroup(name, contacts));
    setGroupName('');
    showToast('ok', `Grup "${name}" disimpan.`);
  };

  const handleLoadGroup = (g: ContactGroup) => {
    mergeContacts(g.contacts);
    showToast('ok', `Grup "${g.name}" dimuat (${g.contacts.length} kontak).`);
  };

  const handleDeleteGroup = (name: string) => {
    setGroups(deleteGroup(name));
    showToast('ok', `Grup "${name}" dihapus.`);
  };

  // ---- Step 4: Kirim ----
  const recipients = useMemo(
    () => (onlyActive ? contacts.filter(c => c.waStatus !== 'inactive') : contacts),
    [contacts, onlyActive],
  );

  const handleSend = async () => {
    if (recipients.length === 0) {
      showToast('err', 'Tidak ada penerima.');
      return;
    }
    if (!message.trim()) {
      showToast('err', 'Pesan tidak boleh kosong.');
      return;
    }

    const trimmedWebhook = webhookUrl.trim();
    setSavedWebhook(trimmedWebhook);

    cancelRef.current = false;
    setIsSending(true);

    const targets = [...recipients];
    const targetSet = new Set(targets.map(c => c.number));
    setContacts(prev =>
      prev.map(c =>
        targetSet.has(c.number)
          ? { ...c, sendStatus: 'sending', sendDetail: undefined }
          : c,
      ),
    );
    setProgress({ current: 0, total: targets.length, eta: targets.length * interval });

    // Pesan dirender per kontak di sini; n8n hanya meneruskan teks ke WAHA.
    const payload = targets.map(c => ({
      target: c.number,
      message: renderMessage(message, c),
      name: c.name,
    }));

    const start = await startBlast({
      contacts: payload,
      intervalSeconds: interval,
      webhookUrl: trimmedWebhook || undefined,
    });

    if (!start.ok || !start.jobId) {
      setIsSending(false);
      setContacts(prev =>
        prev.map(c => (targetSet.has(c.number) ? { ...c, sendStatus: 'idle' } : c)),
      );
      showToast('err', start.msg || 'Gagal memicu n8n workflow.');
      return;
    }

    showToast('ok', `Daftar dikirim ke n8n (${targets.length} penerima). n8n memproses…`);

    // Tanpa callback (APP_URL belum diset), status realtime tidak akan masuk.
    if (!start.callbackEnabled) {
      setIsSending(false);
      showToast(
        'err',
        'APP_URL belum diset: n8n tetap memproses, tapi status berhasil/gagal tidak tampil di sini.',
      );
      return;
    }

    // Pantau hasil via polling sampai selesai (atau timeout).
    const jobId = start.jobId;
    const deadline = Date.now() + (targets.length * interval + 90) * 1000;

    while (!cancelRef.current && Date.now() < deadline) {
      await sleep(2500);
      if (cancelRef.current) break;

      const status = await getJobStatus(jobId);
      if (!status) continue;

      setContacts(prev =>
        prev.map(c => {
          const r = status.results[c.number];
          if (r && targetSet.has(c.number)) {
            return { ...c, sendStatus: r.status, sendDetail: r.detail };
          }
          return c;
        }),
      );
      setProgress({
        current: status.completed,
        total: status.total || targets.length,
        eta: Math.max(0, (targets.length - status.completed) * interval),
      });

      if (status.done) break;
    }

    setIsSending(false);
    if (cancelRef.current) showToast('err', 'Pemantauan dihentikan (n8n mungkin masih berjalan).');
    else showToast('ok', 'Pengiriman selesai.');
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const statusBadge = (c: BlastContact) => {
    if (c.sendStatus === 'sending')
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    if (c.sendStatus === 'sent') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (c.sendStatus === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    if (c.waStatus === 'active') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (c.waStatus === 'inactive') return <XCircle className="h-4 w-4 text-gray-400" />;
    return <HelpCircle className="h-4 w-4 text-gray-300" />;
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-brand-blue px-4 py-4 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <a
            href="/"
            className="p-2 -ml-2 text-white hover:bg-blue-700/50 rounded-full transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2 text-white">
            <Send className="h-5 w-5" />
            <div>
              <h1 className="font-extrabold text-lg leading-tight">Blast WhatsApp</h1>
              <p className="text-blue-200 text-[11px] leading-tight">via n8n workflow</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* STEP 1 */}
        <Section icon={<Users className="h-5 w-5" />} step={1} title="Tambah Kontak">
          <p className="text-xs text-gray-500 mb-3">
            Import dari kontak perangkat, atau ketik manual (satu nomor per baris). Format:{' '}
            <code className="bg-gray-100 px-1 rounded">Nama, 08xxxx</code> atau{' '}
            <code className="bg-gray-100 px-1 rounded">08xxxx</code>.
          </p>

          <button
            onClick={handleImportDevice}
            className="w-full mb-3 py-3 rounded-xl border-2 border-dashed border-brand-blue/40 text-brand-blue font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
          >
            <Contact className="h-4 w-4" />
            Import dari Kontak HP
          </button>

          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder={'Budi, 081234567890\n082233445566\nSiti; 0813-4567-8901'}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[110px] font-mono"
          />
          <button
            onClick={handleAddManual}
            className="mt-2 w-full py-3 rounded-xl bg-brand-blue text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Tambahkan ke Daftar
          </button>
        </Section>

        {/* DAFTAR KONTAK */}
        {contacts.length > 0 && (
          <Section
            icon={<ClipboardList className="h-5 w-5" />}
            step={2}
            title={`Daftar Kontak (${contacts.length})`}
          >
            <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-bold">
              <Pill className="bg-green-100 text-green-700">Aktif: {stats.active}</Pill>
              <Pill className="bg-gray-100 text-gray-600">Tidak Aktif: {stats.inactive}</Pill>
              <Pill className="bg-amber-100 text-amber-700">Belum dicek: {stats.unknown}</Pill>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={handleCheckWhatsApp}
                disabled={isChecking}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Cek Nomor WhatsApp
              </button>
              <button
                onClick={clearContacts}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm flex items-center gap-1.5 hover:bg-gray-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 -mx-1 px-1">
              {contacts.map(c => (
                <div
                  key={c.number}
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span className="shrink-0">{statusBadge(c)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{c.number}</div>
                    {c.sendDetail && (
                      <div className="text-[10px] text-red-400 truncate">{c.sendDetail}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeContact(c.number)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* STEP 3: GRUP */}
        <Section icon={<FolderOpen className="h-5 w-5" />} step={3} title="Simpan Grup (Opsional)">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Nama grup, mis. Reseller Sumedang"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleSaveGroup}
              className="px-4 rounded-lg bg-brand-blue text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Save className="h-4 w-4" />
              Simpan
            </button>
          </div>

          {groups.length > 0 ? (
            <div className="space-y-1.5">
              {groups.map(g => (
                <div
                  key={g.name}
                  className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <FolderOpen className="h-4 w-4 text-brand-blue shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{g.name}</div>
                    <div className="text-[11px] text-gray-400">{g.contacts.length} kontak</div>
                  </div>
                  <button
                    onClick={() => handleLoadGroup(g)}
                    className="shrink-0 text-xs font-bold text-brand-blue hover:underline"
                  >
                    Muat
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(g.name)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Belum ada grup tersimpan.</p>
          )}
        </Section>

        {/* STEP 4: PESAN & KIRIM */}
        <Section icon={<Send className="h-5 w-5" />} step={4} title="Tulis Pesan & Kirim">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pesan</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={'Halo {nama}, ada promo spesial untuk Anda hari ini! 🎉'}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[120px]"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Gunakan <code className="bg-gray-100 px-1 rounded">{'{nama}'}</code> untuk menyisipkan
            nama kontak.
          </p>

          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 mt-4">
            n8n Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://n8n.domain.com/webhook/xxxx (opsional bila sudah di server)"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
          />

          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Interval n8n (detik)
              </label>
              <input
                type="number"
                min={1}
                value={interval}
                onChange={e => setIntervalSec(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mt-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={e => setOnlyActive(e.target.checked)}
                className="h-4 w-4 accent-brand-blue"
              />
              <Filter className="h-4 w-4" />
              Lewati nomor non-WA
            </label>
          </div>

          <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-brand-blue font-semibold flex items-center justify-between">
            <span>Penerima: {recipients.length} nomor</span>
            <span className="text-xs">~{recipients.length * interval} detik</span>
          </div>

          {/* Progress */}
          <AnimatePresence>
            {(isSending || progress.current > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                  <span>
                    {progress.current} / {progress.total} terkirim
                  </span>
                  <span>
                    ✅ {stats.sent} · ❌ {stats.failed}
                    {isSending && ` · sisa ~${progress.eta}s`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-brand-blue h-2 rounded-full"
                    animate={{
                      width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isSending ? (
            <button
              onClick={handleStop}
              className="mt-4 w-full py-4 rounded-xl bg-brand-red text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <StopCircle className="h-5 w-5" />
              Hentikan Pemantauan
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={recipients.length === 0 || !message.trim()}
              className={`mt-4 w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                recipients.length > 0 && message.trim()
                  ? 'bg-brand-blue text-white shadow-lg shadow-blue-200 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="h-5 w-5" />
              Kirim ke {recipients.length} Penerima
            </button>
          )}
        </Section>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white ${
              toast.type === 'ok' ? 'bg-green-600' : 'bg-brand-red'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  icon,
  step,
  title,
  children,
}: {
  icon: ReactNode;
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-4 border border-blue-50">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Langkah {step}
          </span>
          <h2 className="font-extrabold text-gray-900 leading-tight">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`px-2.5 py-1 rounded-full ${className}`}>{children}</span>;
}

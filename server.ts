import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Konfigurasi n8n (WAHA hanya diakses dari sisi n8n, internal docker) ----
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ""; // webhook blast (async)
const N8N_CHECK_WEBHOOK_URL = process.env.N8N_CHECK_WEBHOOK_URL || ""; // webhook cek nomor (sync)
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");

// ---- Penyimpanan job blast (in-memory) ----
type BlastResult = { status: "sent" | "failed"; detail?: string };
type BlastJob = {
  total: number;
  results: Record<string, BlastResult>;
  done: boolean;
  createdAt: number;
};
const blastJobs = new Map<string, BlastJob>();

// Bersihkan job lama (> 2 jam) tiap 30 menit
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of blastJobs) {
    if (job.createdAt < cutoff) blastJobs.delete(id);
  }
}, 30 * 60 * 1000).unref?.();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Fonnte Notification Proxy
  app.post("/api/notify", async (req, res) => {
    const { message, target } = req.body;
    const token = process.env.FONNTE_TOKEN || "sRzKLWyBBpBHbTkd2TVV";

    try {
      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": token,
        },
        body: new URLSearchParams({
          target: target || "120363406553739227@g.us",
          message: message,
        }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Fonnte error:", error);
      res.status(500).json({ status: false, msg: "Failed to send notification" });
    }
  });

  // Cek nomor WhatsApp aktif via n8n (n8n yang memanggil WAHA check-exists, sinkron)
  app.post("/api/wa/validate", async (req, res) => {
    const { targets, webhookUrl } = req.body as { targets?: string[]; webhookUrl?: string };

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ status: false, msg: "targets harus berupa array nomor" });
    }

    const url = webhookUrl || N8N_CHECK_WEBHOOK_URL;
    if (!url) {
      return res.status(400).json({
        status: false,
        msg: "N8N_CHECK_WEBHOOK_URL belum dikonfigurasi di server (.env).",
      });
    }

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const d: any = await r.json().catch(() => ({}));
      res.json({
        status: true,
        registered: d.registered || [],
        not_registered: d.not_registered || d.notRegistered || [],
      });
    } catch (err) {
      console.error("n8n validate error:", err);
      res.status(500).json({ status: false, msg: "Gagal memvalidasi nomor via n8n" });
    }
  });

  // Mulai blast: kirim seluruh daftar ke n8n workflow (n8n yang loop + Wait per pesan)
  app.post("/api/wa/send", async (req, res) => {
    const { contacts, intervalSeconds, webhookUrl } = req.body as {
      contacts?: { target: string; message: string; name?: string }[];
      intervalSeconds?: number;
      webhookUrl?: string;
    };

    const url = webhookUrl || N8N_WEBHOOK_URL;

    if (!url) {
      return res.status(400).json({
        status: false,
        msg: "N8N_WEBHOOK_URL belum dikonfigurasi. Set di .env atau kirim webhookUrl dari aplikasi.",
      });
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ status: false, msg: "contacts wajib berisi minimal 1 penerima" });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    blastJobs.set(jobId, {
      total: contacts.length,
      results: {},
      done: false,
      createdAt: Date.now(),
    });

    const callbackUrl = APP_URL ? `${APP_URL}/api/wa/result` : "";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          callbackUrl,
          intervalSeconds: intervalSeconds && intervalSeconds > 0 ? intervalSeconds : 7,
          contacts,
        }),
      });
      // n8n biasanya membalas segera (Respond to Webhook). Workflow lanjut di background.
      res.status(response.ok ? 200 : 502).json({
        status: response.ok,
        jobId,
        total: contacts.length,
        callbackEnabled: !!callbackUrl,
      });
    } catch (error) {
      console.error("n8n trigger error:", error);
      blastJobs.delete(jobId);
      res.status(500).json({ status: false, msg: "Gagal memicu n8n workflow" });
    }
  });

  // Callback dari n8n: laporan hasil kirim per nomor
  app.post("/api/wa/result", (req, res) => {
    const { jobId, target, status, detail } = req.body as {
      jobId?: string;
      target?: string;
      status?: boolean | string;
      detail?: any;
    };

    const job = jobId ? blastJobs.get(jobId) : undefined;
    if (job && target) {
      const ok = status === true || status === "success" || status === "sent" || status === "ok";
      job.results[target] = {
        status: ok ? "sent" : "failed",
        detail: detail ? String(detail).slice(0, 200) : undefined,
      };
      if (Object.keys(job.results).length >= job.total) job.done = true;
    }
    res.json({ ok: true });
  });

  // Polling status job blast dari aplikasi
  app.get("/api/wa/status", (req, res) => {
    const jobId = String(req.query.jobId || "");
    const job = blastJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ status: false, msg: "job tidak ditemukan" });
    }
    res.json({
      status: true,
      jobId,
      total: job.total,
      done: job.done,
      completed: Object.keys(job.results).length,
      results: job.results,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

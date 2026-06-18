import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Cek nomor WhatsApp aktif (Fonnte validate)
  app.post("/api/wa/validate", async (req, res) => {
    const { targets } = req.body as { targets?: string[] };
    const token = process.env.FONNTE_TOKEN || "sRzKLWyBBpBHbTkd2TVV";

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ status: false, msg: "targets harus berupa array nomor" });
    }

    try {
      const response = await fetch("https://api.fonnte.com/validate", {
        method: "POST",
        headers: {
          "Authorization": token,
        },
        body: new URLSearchParams({
          target: targets.join(","),
          countryCode: "62",
        }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Fonnte validate error:", error);
      res.status(500).json({ status: false, msg: "Gagal memvalidasi nomor WhatsApp" });
    }
  });

  // Kirim satu pesan via n8n workflow
  app.post("/api/wa/send", async (req, res) => {
    const { target, message, name, webhookUrl } = req.body as {
      target?: string;
      message?: string;
      name?: string;
      webhookUrl?: string;
    };

    const url = webhookUrl || process.env.N8N_WEBHOOK_URL;

    if (!url) {
      return res.status(400).json({
        status: false,
        msg: "N8N_WEBHOOK_URL belum dikonfigurasi. Set di .env atau kirim webhookUrl dari aplikasi.",
      });
    }
    if (!target || !message) {
      return res.status(400).json({ status: false, msg: "target & message wajib diisi" });
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, message, name: name || "" }),
      });
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      res.status(response.ok ? 200 : 502).json({ status: response.ok, ...data });
    } catch (error) {
      console.error("n8n send error:", error);
      res.status(500).json({ status: false, msg: "Gagal mengirim ke n8n workflow" });
    }
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

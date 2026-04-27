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

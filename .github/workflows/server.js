import express from "express";
import cors from "cors";

const app = express();
const PORT = 8787;
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("www"));

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = req.headers.authorization || "";
    if (!apiKey.startsWith("Bearer ")) {
      return res.status(401).json({ error: "API Key NVIDIA não enviada." });
    }

    const payload = { ...req.body, stream: false };

    const r = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (err) {
    res.status(500).json({
      error: "Falha no proxy local.",
      detail: String(err?.message || err)
    });
  }
});

app.listen(PORT, () => {
  console.log("");
  console.log("Nemotron Chat rodando:");
  console.log(`http://localhost:${PORT}`);
  console.log("");
  console.log("Abra esse link no PC para testar sem CORS.");
});

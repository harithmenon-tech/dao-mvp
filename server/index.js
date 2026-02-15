// ═══════════════════════════════════════════════════════════════
// Decision Accountability OS — Production Server
// Serves the built frontend + proxies Claude API calls
// Run: npm start  (builds frontend then starts this server)
// ═══════════════════════════════════════════════════════════════
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "50mb" }));

// Serve built frontend
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "put_your_real_key_here" || key.trim() === "") return null;
  return key.trim();
}

// Health check — frontend calls this to know if API is ready
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiConfigured: !!getApiKey() });
});

// Claude API proxy with streaming support
app.post("/api/claude", async (req, res) => {
  const KEY = getApiKey();
  if (!KEY) {
    return res.status(500).json({
      error: "API key not configured. Add your ANTHROPIC_API_KEY to the .env file and restart the server."
    });
  }

  const { systemPrompt, messages, stream } = req.body || {};

  // Validate input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt || "",
        messages,
        stream: !!stream
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiResponse.status === 429) {
      return res.status(429).json({ error: "rate_limited", message: "Too many requests — please wait a moment and try again." });
    }
    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`Anthropic API ${apiResponse.status}:`, errText.slice(0, 500));
      return res.status(apiResponse.status).json({ error: errText });
    }

    // ─── Non-streaming ───
    if (!stream) {
      const data = await apiResponse.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      return res.json({ text });
    }

    // ─── Streaming: Anthropic SSE → newline-delimited JSON ───
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              res.write(JSON.stringify({ text: parsed.delta.text }) + "\n");
            }
            // Handle error events from the API
            if (parsed.type === "error") {
              res.write(JSON.stringify({ error: parsed.error?.message || "Stream error" }) + "\n");
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      console.error("Stream read error:", streamErr.message);
      // Try to send error through the stream
      try {
        res.write(JSON.stringify({ error: streamErr.message }) + "\n");
      } catch {}
    } finally {
      res.end();
    }
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === "AbortError"
      ? "Request timed out (120s). Try a shorter question."
      : err.message || "Internal server error";
    console.error("Server error:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      try { res.end(); } catch {}
    }
  }
});

// SPA fallback — serve index.html for all non-API routes (Express 5 syntax)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(distPath, "index.html"));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const key = getApiKey();
  console.log();
  console.log("  Decision Accountability OS");
  console.log("  Built by 30GENS");
  console.log("  ───────────────────────────────────");
  console.log(`  Running at:  http://localhost:${PORT}`);
  console.log(`  API status:  ${key ? "Ready" : "NOT CONFIGURED"}`);
  if (!key) {
    console.log();
    console.log("  To enable live AI:");
    console.log("  1. Open .env in this folder");
    console.log("  2. Set ANTHROPIC_API_KEY=sk-ant-...");
    console.log("  3. Restart the server");
  }
  console.log();
});

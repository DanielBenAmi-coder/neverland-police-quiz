const { handleOptions, jsonResponse } = require("./_lib/cors");

const MODEL = "gpt-4.1-mini";
const MAX_HISTORY = 20;
const MAX_MSG_LEN = 600;
const MAX_CONTEXT_LEN = 4000;

const SYSTEM_PROMPT =
  "You are Rasputin, a professional police AI assistant for Neverland Police Department. " +
  "You answer professionally in Hebrew and help officers understand procedures, SOP, dispatch protocols, " +
  "arrests, pursuits, and patrol operations. Never break role. " +
  "Keep answers short (2–5 sentences), clear, and practical. Use bullet points only when listing steps or codes. " +
  "If handbook context is provided, base your answer on it and do not invent rules. " +
  "If the context does not cover the question, say: לא מצאתי נוהל ברור לזה במאגר הנהלים.";

function sanitizeText(text, maxLen) {
  return String(text || "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-MAX_HISTORY)
    .map((m) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = sanitizeText(m.content, MAX_MSG_LEN);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 450,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI error ${res.status}`;
    throw new Error(msg);
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Empty response from OpenAI");
  return reply.trim();
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") {
    return jsonResponse(res, 405, { error: "Method not allowed" }, origin);
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return jsonResponse(res, 400, { error: "Invalid JSON" }, origin);
  }

  const message = sanitizeText(body.message, MAX_MSG_LEN);
  if (!message) {
    return jsonResponse(res, 400, { error: "חסרה שאלה" }, origin);
  }

  const history = sanitizeHistory(body.history);
  const context = sanitizeText(body.context, MAX_CONTEXT_LEN);

  const systemParts = [SYSTEM_PROMPT];
  if (context) {
    systemParts.push(
      "\n\n--- מאגר נהלים (Neverland Police Handbook) ---\n" + context
    );
  }

  const messages = [{ role: "system", content: systemParts.join("") }, ...history, { role: "user", content: message }];

  try {
    const reply = await callOpenAI(messages);
    return jsonResponse(res, 200, { ok: true, reply, model: MODEL }, origin);
  } catch (err) {
    console.error("Rasputin API:", err.message);
    const status = err.message.includes("OPENAI_API_KEY") ? 503 : 500;
    return jsonResponse(
      res,
      status,
      { error: "שגיאה בעיבוד התשובה. נסו שוב בעוד רגע." },
      origin
    );
  }
};

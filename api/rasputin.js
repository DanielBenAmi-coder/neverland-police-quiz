const { handleOptions, jsonResponse } = require("./_lib/cors");

const MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];
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
    const err = new Error("OPENAI_API_KEY not configured");
    err.code = "NO_KEY";
    throw err;
  }

  let lastError = null;

  for (const model of MODELS) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        max_tokens: 450,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) {
        lastError = new Error("Empty response from OpenAI");
        continue;
      }
      return { reply: reply.trim(), model };
    }

    const msg = data?.error?.message || `OpenAI error ${res.status}`;
    lastError = new Error(msg);
    lastError.openaiStatus = res.status;
    lastError.openaiType = data?.error?.type;

    const retryable =
      res.status === 404 ||
      /model/i.test(msg) ||
      /does not exist/i.test(msg) ||
      /not found/i.test(msg);
    if (!retryable) break;
  }

  throw lastError || new Error("OpenAI request failed");
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") return handleOptions(req, res);

  if (req.method === "GET") {
    return jsonResponse(
      res,
      200,
      {
        ok: true,
        service: "rasputin",
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        models: MODELS,
      },
      origin
    );
  }

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
    const result = await callOpenAI(messages);
    return jsonResponse(res, 200, { ok: true, reply: result.reply, model: result.model }, origin);
  } catch (err) {
    console.error("Rasputin API:", err.message);

    if (err.code === "NO_KEY" || err.message.includes("OPENAI_API_KEY")) {
      return jsonResponse(
        res,
        503,
        {
          error: "מפתח OpenAI לא מוגדר ב-Vercel. הוסיפו OPENAI_API_KEY ועשו Redeploy.",
          code: "NO_KEY",
        },
        origin
      );
    }

    let userMsg = "שגיאה בעיבוד התשובה. נסו שוב בעוד רגע.";
    if (/incorrect api key/i.test(err.message) || err.openaiStatus === 401) {
      userMsg = "מפתח OpenAI לא תקין. בדקו את OPENAI_API_KEY ב-Vercel.";
    } else if (/quota|billing|insufficient/i.test(err.message)) {
      userMsg = "אין יתרה/חיוב בחשבון OpenAI. בדקו Billing ב-platform.openai.com.";
    }

    return jsonResponse(
      res,
      500,
      { error: userMsg, code: "OPENAI_ERROR", detail: err.message.slice(0, 200) },
      origin
    );
  }
};

const { handleOptions, jsonResponse } = require("./_lib/cors");

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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

function buildSystemText(context) {
  if (!context) return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT +
    "\n\n--- מאגר נהלים (Neverland Police Handbook) ---\n" +
    context
  );
}

function buildGeminiContents(history, userMessage) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  return contents;
}

async function callGemini(systemText, history, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY not configured");
    err.code = "NO_KEY";
    throw err;
  }

  const url = `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemText }],
      },
      contents: buildGeminiContents(history, userMessage),
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 500,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.[0]?.error?.message ||
      `Gemini API error ${res.status}`;
    const err = new Error(msg);
    err.apiStatus = res.status;
    if (/quota|resource.exhausted|billing/i.test(msg)) err.code = "QUOTA";
    throw err;
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!reply) {
    const blockReason = data?.candidates?.[0]?.finishReason;
    throw new Error(blockReason ? `Blocked: ${blockReason}` : "Empty Gemini response");
  }

  return reply;
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
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        model: GEMINI_MODEL,
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
  const systemText = buildSystemText(context);

  try {
    const reply = await callGemini(systemText, history, message);
    return jsonResponse(res, 200, { ok: true, reply }, origin);
  } catch (err) {
    console.error("Rasputin API:", err.message);

    if (err.code === "NO_KEY" || err.message.includes("GEMINI_API_KEY")) {
      return jsonResponse(
        res,
        503,
        {
          error: "מפתח Gemini לא מוגדר ב-Vercel. הוסיפו GEMINI_API_KEY ועשו Redeploy.",
          code: "NO_KEY",
        },
        origin
      );
    }

    let userMsg = "שגיאה בעיבוד התשובה. נסו שוב בעוד רגע.";
    let code = "GEMINI_ERROR";

    if (/api key|invalid|permission|401|403/i.test(err.message) || err.apiStatus === 401 || err.apiStatus === 403) {
      userMsg = "מפתח Gemini לא תקין. בדקו את GEMINI_API_KEY ב-Vercel.";
    } else if (err.code === "QUOTA" || /quota|exhausted/i.test(err.message)) {
      userMsg = "אין יתרה ב-Gemini. בדקו מכסה ב-Google AI Studio.";
      code = "QUOTA";
    }

    return jsonResponse(
      res,
      500,
      { error: userMsg, code, detail: err.message.slice(0, 200), useLocal: code === "QUOTA" },
      origin
    );
  }
};

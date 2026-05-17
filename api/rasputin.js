const { handleOptions, jsonResponse } = require("./_lib/cors");

const OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];
const GROQ_MODEL = "llama-3.3-70b-versatile";
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

async function chatCompletion(url, apiKey, model, messages) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 500,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `API error ${res.status}`;
    const err = new Error(msg);
    err.apiStatus = res.status;
    throw err;
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Empty model response");
  return reply.trim();
}

function isQuotaError(msg) {
  return /quota|billing|insufficient|exceeded/i.test(msg || "");
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY not configured");
    err.code = "NO_KEY";
    throw err;
  }

  let lastError = null;

  for (const model of OPENAI_MODELS) {
    try {
      const reply = await chatCompletion(
        "https://api.openai.com/v1/chat/completions",
        apiKey,
        model,
        messages
      );
      return { reply, model, provider: "openai" };
    } catch (err) {
      lastError = err;
      const retryable =
        err.apiStatus === 404 ||
        /model/i.test(err.message) ||
        /does not exist/i.test(err.message);
      if (!retryable && !isQuotaError(err.message)) break;
    }
  }

  if (lastError) {
    if (isQuotaError(lastError.message)) lastError.code = "QUOTA";
    throw lastError;
  }
  throw new Error("OpenAI request failed");
}

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY not configured");
    err.code = "NO_GROQ";
    throw err;
  }

  const reply = await chatCompletion(
    "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    GROQ_MODEL,
    messages
  );
  return { reply, model: GROQ_MODEL, provider: "groq" };
}

async function callLlm(messages) {
  try {
    return await callOpenAI(messages);
  } catch (openaiErr) {
    if (process.env.GROQ_API_KEY && (openaiErr.code === "QUOTA" || isQuotaError(openaiErr.message))) {
      try {
        return await callGroq(messages);
      } catch (groqErr) {
        console.error("Groq fallback failed:", groqErr.message);
      }
    }
    throw openaiErr;
  }
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
        hasGroqKey: Boolean(process.env.GROQ_API_KEY),
        models: OPENAI_MODELS,
        groqModel: GROQ_MODEL,
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
    const result = await callLlm(messages);
    return jsonResponse(
      res,
      200,
      { ok: true, reply: result.reply, model: result.model, provider: result.provider },
      origin
    );
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
    let code = "OPENAI_ERROR";

    if (/incorrect api key/i.test(err.message) || err.apiStatus === 401) {
      userMsg = "מפתח OpenAI לא תקין. בדקו את OPENAI_API_KEY ב-Vercel.";
    } else if (err.code === "QUOTA" || isQuotaError(err.message)) {
      userMsg =
        "אין יתרה ב-OpenAI. הוסיפו GROQ_API_KEY (חינם) ב-Vercel או טענו Billing ב-OpenAI.";
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

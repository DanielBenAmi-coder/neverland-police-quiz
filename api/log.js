const { appendLog } = require("./_lib/redis");
const { handleOptions, jsonResponse } = require("./_lib/cors");

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function isValidName(name) {
  return name.length >= 2 && /^[\p{L}\p{N}\s.'-]+$/u.test(name);
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

  const name = sanitizeName(body.name);
  if (!isValidName(name)) {
    return jsonResponse(res, 400, { error: "שם לא תקין (2–32 תווים)" }, origin);
  }

  const event = String(body.event || "activity").slice(0, 40);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    name,
    event,
    mode: body.mode || null,
    rank: body.rank || null,
    category: body.category || null,
    score: typeof body.score === "number" ? body.score : null,
    passed: typeof body.passed === "boolean" ? body.passed : null,
    questions: typeof body.questions === "number" ? body.questions : null,
    label: body.label ? String(body.label).slice(0, 120) : null,
  };

  try {
    const result = await appendLog(entry);
    return jsonResponse(res, 200, { ok: true, entry, store: result.store }, origin);
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: "שגיאת שרת" }, origin);
  }
};

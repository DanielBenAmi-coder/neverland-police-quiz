const { appendHistory, readHistory } = require("./_lib/redis");
const { handleOptions, jsonResponse } = require("./_lib/cors");

const DEFAULT_ADMIN_CODE = "Rasputin";

function getAdminCode() {
  return process.env.ADMIN_CODE || DEFAULT_ADMIN_CODE;
}

function checkAdmin(req) {
  const sent = req.headers["x-admin-code"] || "";
  return sent === getAdminCode();
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function isValidName(name) {
  return name.length >= 2 && /^[\p{L}\p{N}\s.'-]+$/u.test(name);
}

function sanitizeWrongs(wrongs) {
  if (!Array.isArray(wrongs)) return [];
  return wrongs.slice(0, 40).map((w) => ({
    questionId: String(w.questionId || "").slice(0, 64),
    question: String(w.question || "").slice(0, 400),
    selectedText: String(w.selectedText || "").slice(0, 200),
    correctText: String(w.correctText || "").slice(0, 200),
    category: w.category ? String(w.category).slice(0, 64) : null,
    type: w.type ? String(w.type).slice(0, 32) : null,
  }));
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") return handleOptions(req, res);

  if (req.method === "GET") {
    const limit = parseInt(req.query?.limit || "100", 10);
    const nameQ = sanitizeName(req.query?.name || "");
    const isAdmin = checkAdmin(req);

    if (!isAdmin && !nameQ) {
      return jsonResponse(res, 400, { error: "חסר שם שוטר" }, origin);
    }

    try {
      const history = await readHistory(limit, isAdmin ? nameQ || null : nameQ);
      return jsonResponse(res, 200, { ok: true, history }, origin);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: "שגיאת שרת" }, origin);
    }
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

  const name = sanitizeName(body.name);
  if (!isValidName(name)) {
    return jsonResponse(res, 400, { error: "שם לא תקין (2–32 תווים)" }, origin);
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    name,
    mode: body.mode || null,
    rank: body.rank || null,
    category: body.category || null,
    label: body.label ? String(body.label).slice(0, 120) : null,
    score: typeof body.score === "number" ? body.score : null,
    passed: typeof body.passed === "boolean" ? body.passed : null,
    total: typeof body.total === "number" ? body.total : null,
    correctCount: typeof body.correctCount === "number" ? body.correctCount : null,
    wrongs: sanitizeWrongs(body.wrongs),
  };

  try {
    const result = await appendHistory(entry);
    return jsonResponse(res, 200, { ok: true, entry, store: result.store }, origin);
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { error: "שגיאת שרת" }, origin);
  }
};

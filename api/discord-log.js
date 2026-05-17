const { sendDiscordLog, configuredCategories } = require("./_lib/discord");
const { handleOptions, jsonResponse } = require("./_lib/cors");

const ALLOWED = new Set(["practice", "exam", "category", "rasputin"]);

const QUIZ_EVENTS = new Set([
  "quiz_start",
  "quiz_finish",
  "quit_quiz",
  "mode_open",
]);

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function mapModeToCategory(mode) {
  if (mode === "exam") return "exam";
  if (mode === "category") return "category";
  if (mode === "practice") return "practice";
  return null;
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
        configured: configuredCategories(),
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

  let category = String(body.channel || "").trim();
  const mode = String(body.mode || "").trim();

  if (!category && mode) {
    category = mapModeToCategory(mode) || "";
  }
  if (category === "ai") category = "rasputin";

  if (!ALLOWED.has(category)) {
    return jsonResponse(res, 400, { error: "קטגוריה לא תקינה" }, origin);
  }

  const name = sanitizeName(body.name);
  if (!name || name.length < 2) {
    return jsonResponse(res, 400, { error: "שם שוטר חסר" }, origin);
  }

  const event = String(body.event || "").slice(0, 40);
  if (category !== "rasputin" && event && !QUIZ_EVENTS.has(event)) {
    return jsonResponse(res, 400, { error: "סוג אירוע לא נתמך" }, origin);
  }

  const payload = {
    event,
    name,
    ts: body.ts || new Date().toISOString(),
    mode: body.mode || null,
    rank: body.rank || null,
    rankLabel: body.rankLabel ? String(body.rankLabel).slice(0, 64) : null,
    category: body.quizCategory || null,
    categoryLabel: body.categoryLabel
      ? String(body.categoryLabel).slice(0, 64)
      : null,
    score: typeof body.score === "number" ? body.score : null,
    passed: typeof body.passed === "boolean" ? body.passed : null,
    questions: typeof body.questions === "number" ? body.questions : null,
    label: body.label ? String(body.label).slice(0, 120) : null,
    question: body.question ? String(body.question).slice(0, 600) : null,
    answer: body.answer ? String(body.answer).slice(0, 600) : null,
    aiMode: body.aiMode ? String(body.aiMode).slice(0, 20) : null,
  };

  try {
    const result = await sendDiscordLog(category, payload);
    if (result.skipped) {
      return jsonResponse(
        res,
        200,
        { ok: true, skipped: true, reason: result.reason },
        origin
      );
    }
    return jsonResponse(res, 200, { ok: true }, origin);
  } catch (err) {
    console.error("Discord log:", err.message);
    return jsonResponse(
      res,
      502,
      { error: "שליחה לדיסקורד נכשלה", detail: err.message.slice(0, 120) },
      origin
    );
  }
};

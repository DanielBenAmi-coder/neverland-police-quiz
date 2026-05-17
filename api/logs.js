const { readLogs, isRedisConfigured } = require("./_lib/redis");
const { checkAdmin } = require("./_lib/admin");
const { handleOptions, jsonResponse } = require("./_lib/cors");

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "GET") {
    return jsonResponse(res, 405, { error: "Method not allowed" }, origin);
  }

  if (!checkAdmin(req)) {
    return jsonResponse(res, 401, { error: "קוד מנהל שגוי" }, origin);
  }

  const limit = parseInt(req.query?.limit || "300", 10);
  const redisConfigured = isRedisConfigured();

  try {
    const { logs, store } = await readLogs(limit);
    const names = [...new Set(logs.map((l) => l.name).filter(Boolean))];

    return jsonResponse(
      res,
      200,
      {
        ok: true,
        logs,
        meta: {
          redisConfigured,
          store,
          limit: Math.min(Math.max(limit, 1), 2000),
        },
        stats: {
          total: logs.length,
          uniqueNames: names.length,
          names,
        },
      },
      origin
    );
  } catch (err) {
    console.error(err);
    return jsonResponse(
      res,
      500,
      {
        error: "שגיאת קריאה מ-Redis",
        meta: { redisConfigured, store: "error" },
      },
      origin
    );
  }
};

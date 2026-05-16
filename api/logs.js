const { readLogs } = require("./_lib/redis");
const { handleOptions, jsonResponse } = require("./_lib/cors");

const DEFAULT_ADMIN_CODE = "Rasputin";

function getAdminCode() {
  return process.env.ADMIN_CODE || DEFAULT_ADMIN_CODE;
}

function checkAdmin(req) {
  const sent = req.headers["x-admin-code"] || "";
  return sent === getAdminCode();
}

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

  try {
    const logs = await readLogs(limit);
    const names = [...new Set(logs.map((l) => l.name))];
    return jsonResponse(
      res,
      200,
      {
        ok: true,
        logs,
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
    return jsonResponse(res, 500, { error: "שגיאת שרת" }, origin);
  }
};

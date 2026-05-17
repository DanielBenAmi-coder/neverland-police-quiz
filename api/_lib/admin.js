const DEFAULT_ADMIN_CODE = "Rasputin";

function getAdminCode() {
  return String(process.env.ADMIN_CODE || DEFAULT_ADMIN_CODE).trim();
}

/** השוואה לא רגישה לרישיות — תואם ללקוח */
function checkAdmin(req) {
  const sent = String(req.headers["x-admin-code"] || "").trim();
  if (!sent) return false;
  return sent.toLowerCase() === getAdminCode().toLowerCase();
}

module.exports = { getAdminCode, checkAdmin, DEFAULT_ADMIN_CODE };

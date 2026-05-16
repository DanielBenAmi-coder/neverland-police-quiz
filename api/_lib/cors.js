const ALLOWED_ORIGINS = [
  "https://danielbenami-coder.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

function corsHeaders(origin) {
  const allowed =
    !origin ||
    ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + "/")) ||
    origin.includes(".vercel.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Code",
    "Access-Control-Max-Age": "86400",
  };

  if (allowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else if (allowed) {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

function handleOptions(req, res) {
  const origin = req.headers.origin || "";
  res.writeHead(204, corsHeaders(origin));
  res.end();
}

function jsonResponse(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  });
  res.end(JSON.stringify(body));
}

module.exports = { corsHeaders, handleOptions, jsonResponse, ALLOWED_ORIGINS };

const LOG_KEY = "np:activity:logs";
const HISTORY_KEY = "np:quiz:history";
const MAX_LOGS = 2000;
const MAX_HISTORY = 3000;

function getMemLogs() {
  if (!globalThis.__NP_ACTIVITY_LOGS) {
    globalThis.__NP_ACTIVITY_LOGS = [];
  }
  return globalThis.__NP_ACTIVITY_LOGS;
}

async function upstash(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!res.ok) {
    throw new Error(`Redis error ${res.status}`);
  }
  return res.json();
}

async function appendLog(entry) {
  const raw = JSON.stringify(entry);

  try {
    const pushed = await upstash("LPUSH", LOG_KEY, raw);
    if (pushed) {
      await upstash("LTRIM", LOG_KEY, 0, MAX_LOGS - 1);
      return { ok: true, store: "redis" };
    }
  } catch (err) {
    console.error("Redis append failed:", err.message);
  }

  const mem = getMemLogs();
  mem.unshift(entry);
  if (mem.length > MAX_LOGS) mem.length = MAX_LOGS;
  return { ok: true, store: "memory" };
}

async function readLogs(limit = 300) {
  const cap = Math.min(Math.max(limit, 1), 500);

  try {
    const data = await upstash("LRANGE", LOG_KEY, 0, cap - 1);
    if (data && Array.isArray(data.result)) {
      return data.result
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  } catch (err) {
    console.error("Redis read failed:", err.message);
  }

  return getMemLogs().slice(0, cap);
}

function getMemHistory() {
  if (!globalThis.__NP_QUIZ_HISTORY) {
    globalThis.__NP_QUIZ_HISTORY = [];
  }
  return globalThis.__NP_QUIZ_HISTORY;
}

async function appendHistory(entry) {
  const raw = JSON.stringify(entry);

  try {
    const pushed = await upstash("LPUSH", HISTORY_KEY, raw);
    if (pushed) {
      await upstash("LTRIM", HISTORY_KEY, 0, MAX_HISTORY - 1);
      return { ok: true, store: "redis" };
    }
  } catch (err) {
    console.error("Redis history append failed:", err.message);
  }

  const mem = getMemHistory();
  mem.unshift(entry);
  if (mem.length > MAX_HISTORY) mem.length = MAX_HISTORY;
  return { ok: true, store: "memory" };
}

async function readHistory(limit = 200, nameFilter) {
  const cap = Math.min(Math.max(limit, 1), 500);
  let rows = [];

  try {
    const data = await upstash("LRANGE", HISTORY_KEY, 0, cap - 1);
    if (data && Array.isArray(data.result)) {
      rows = data.result
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  } catch (err) {
    console.error("Redis history read failed:", err.message);
  }

  if (rows.length === 0) {
    rows = getMemHistory().slice(0, cap);
  }

  if (nameFilter) {
    const q = String(nameFilter).trim().toLowerCase();
    rows = rows.filter((r) => (r.name || "").trim().toLowerCase() === q);
  }

  return rows;
}

module.exports = {
  appendLog,
  readLogs,
  appendHistory,
  readHistory,
  LOG_KEY,
  HISTORY_KEY,
};

(function () {
  "use strict";

  const LOCAL_HISTORY_KEY = "np_quiz_history";

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function hasSupabase() {
    const c = cfg();
    return Boolean((c.supabaseUrl || "").trim() && (c.supabaseAnonKey || "").trim());
  }

  function hasApi() {
    const host = window.location.hostname;
    if ((cfg().apiBase || "").trim()) return true;
    return host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1";
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function supabaseHeaders() {
    const key = cfg().supabaseAnonKey;
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  function localKey(name) {
    return `${LOCAL_HISTORY_KEY}:${(name || "").trim().toLowerCase()}`;
  }

  function saveLocal(entry) {
    try {
      const key = localKey(entry.name);
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.unshift(entry);
      if (list.length > 80) list.length = 80;
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function getLocal(name) {
    try {
      return JSON.parse(localStorage.getItem(localKey(name)) || "[]");
    } catch {
      return [];
    }
  }

  async function pushSupabase(entry) {
    const url = `${cfg().supabaseUrl.replace(/\/$/, "")}/rest/v1/quiz_history`;
    const row = {
      id: entry.id,
      ts: entry.ts,
      name: entry.name,
      mode: entry.mode,
      rank: entry.rank,
      category: entry.category,
      label: entry.label,
      score: entry.score,
      passed: entry.passed,
      total: entry.total,
      correct_count: entry.correctCount,
      wrongs: entry.wrongs || [],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  async function pushApi(entry) {
    const res = await fetch(apiUrl("/api/history"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  async function fetchSupabase(name, limit) {
    const base = `${cfg().supabaseUrl.replace(/\/$/, "")}/rest/v1/quiz_history`;
    const q =
      `?select=*&name=eq.${encodeURIComponent(name)}` +
      `&order=ts.desc&limit=${limit}`;

    const res = await fetch(base + q, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(await res.text());

    const rows = await res.json();
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      name: r.name,
      mode: r.mode,
      rank: r.rank,
      category: r.category,
      label: r.label,
      score: r.score,
      passed: r.passed,
      total: r.total,
      correctCount: r.correct_count,
      wrongs: r.wrongs || [],
    }));
  }

  async function fetchApi(name, limit, adminCode) {
    const params = new URLSearchParams({ limit: String(limit), name });
    const headers = {};
    if (adminCode) headers["X-Admin-Code"] = adminCode;

    const res = await fetch(apiUrl(`/api/history?${params}`), { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data.history || [];
  }

  function mergeById(items) {
    const map = new Map();
    items.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return [...map.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  }

  window.NeverlandHistory = {
    hasCloud() {
      return hasSupabase() || hasApi();
    },

    async save(entry) {
      saveLocal(entry);

      if (hasSupabase()) {
        try {
          await pushSupabase(entry);
          return "supabase";
        } catch (err) {
          console.warn("Supabase history:", err.message);
        }
      }

      if (hasApi()) {
        try {
          await pushApi(entry);
          return "api";
        } catch (err) {
          console.warn("API history:", err.message);
        }
      }

      return "local";
    },

    async fetchForOfficer(name, limit) {
      const cap = limit || 50;
      const batches = [getLocal(name)];

      if (hasSupabase()) {
        try {
          batches.push(await fetchSupabase(name, cap));
        } catch (err) {
          console.warn("Supabase history fetch:", err.message);
        }
      }

      if (hasApi()) {
        try {
          batches.push(await fetchApi(name, cap));
        } catch (err) {
          console.warn("API history fetch:", err.message);
        }
      }

      return mergeById(batches.flat());
    },
  };
})();

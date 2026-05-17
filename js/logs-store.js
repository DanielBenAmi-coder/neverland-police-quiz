(function () {
  "use strict";

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function hasSupabase() {
    const c = cfg();
    return Boolean((c.supabaseUrl || "").trim() && (c.supabaseAnonKey || "").trim());
  }

  function hasApi() {
    if ((cfg().apiBase || "").trim()) return true;
    const host = window.location.hostname;
    return host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1";
  }

  function supabaseHeaders() {
    const key = cfg().supabaseAnonKey;
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  async function pushSupabase(entry) {
    const url = `${cfg().supabaseUrl.replace(/\/$/, "")}/rest/v1/activity_logs`;
    const row = {
      id: entry.id,
      ts: entry.ts,
      name: entry.name,
      event: entry.event,
      session_id: entry.session || null,
      mode: entry.mode,
      rank: entry.rank,
      category: entry.category,
      score: entry.score,
      passed: entry.passed,
      questions: entry.questions,
      label: entry.label,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Supabase ${res.status}`);
    }
    return true;
  }

  async function pushApi(entry) {
    const res = await fetch(apiUrl("/api/log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entry.name,
        event: entry.event,
        mode: entry.mode,
        rank: entry.rank,
        category: entry.category,
        score: entry.score,
        passed: entry.passed,
        questions: entry.questions,
        label: entry.label,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  async function fetchSupabase(limit) {
    const url =
      `${cfg().supabaseUrl.replace(/\/$/, "")}/rest/v1/activity_logs` +
      `?select=*&order=ts.desc&limit=${limit}`;

    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(await res.text());

    const rows = await res.json();
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      name: r.name,
      event: r.event,
      session: r.session_id,
      mode: r.mode,
      rank: r.rank,
      category: r.category,
      score: r.score,
      passed: r.passed,
      questions: r.questions,
      label: r.label,
    }));
  }

  async function fetchApi(adminCode, limit) {
    const res = await fetch(apiUrl(`/api/logs?limit=${limit}`), {
      headers: { "X-Admin-Code": adminCode },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");
    return data.logs || [];
  }

  function mergeById(logs) {
    const map = new Map();
    logs.forEach((log) => {
      if (log && log.id) map.set(log.id, log);
    });
    return [...map.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  }

  window.NeverlandLogs = {
    hasCloud() {
      return hasSupabase() || hasApi();
    },

    async push(entry) {
      if (hasSupabase()) {
        try {
          await pushSupabase(entry);
          return "supabase";
        } catch (err) {
          console.warn("Supabase log:", err.message);
        }
      }
      if (hasApi()) {
        try {
          await pushApi(entry);
          return "api";
        } catch (err) {
          console.warn("API log:", err.message);
        }
      }
      return "local";
    },

    async fetchAll(adminCode, limit, opts) {
      const cap = limit || 500;
      const adminOnly = opts?.adminOnly === true;
      const batches = [];

      if (hasSupabase()) {
        try {
          batches.push(await fetchSupabase(cap));
        } catch (err) {
          console.warn("Supabase fetch:", err.message);
        }
      }

      if (hasApi() && adminCode) {
        try {
          batches.push(await fetchApi(adminCode, cap));
        } catch (err) {
          console.warn("API fetch:", err.message);
        }
      }

      if (!adminOnly) {
        const local = window.NeverlandTracking?.getLocalLogs?.() || [];
        batches.push(local);
      }

      return mergeById(batches.flat());
    },

    /** לוח מנהל — רק שרת משותף, בלי לוגים מקומיים של הדפדפן הנוכחי */
    async fetchForAdmin(adminCode, limit) {
      return this.fetchAll(adminCode, limit, { adminOnly: true });
    },
  };
})();

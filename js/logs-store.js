(function () {
  "use strict";

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function hasSupabase() {
    const c = cfg();
    return Boolean((c.supabaseUrl || "").trim() && (c.supabaseAnonKey || "").trim());
  }

  function apiAvailable() {
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
    return { channel: "supabase" };
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `API ${res.status}`);

    if (data.warning) console.warn("NeverlandLogs:", data.warning);
    return {
      channel: "api",
      store: data.store,
      persisted: data.meta?.persisted === true,
      warning: data.warning || null,
    };
  }

  async function fetchSupabase(limit) {
    const url =
      `${cfg().supabaseUrl.replace(/\/$/, "")}/rest/v1/activity_logs` +
      `?select=*&order=ts.desc&limit=${limit}`;

    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(await res.text());

    const rows = await res.json();
    return {
      logs: rows.map((r) => ({
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
      })),
      meta: { source: "supabase" },
    };
  }

  async function fetchApi(adminCode, limit) {
    try {
      const res = await fetch(apiUrl(`/api/logs?limit=${limit}`), {
        headers: { "X-Admin-Code": adminCode.trim() },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        return {
          logs: [],
          meta: data.meta || {},
          error: { code: "AUTH", message: data.error || "קוד מנהל שגוי (בדקו גם ב-Vercel: ADMIN_CODE)" },
        };
      }

      if (!res.ok) {
        return {
          logs: [],
          meta: data.meta || {},
          error: { code: "API", message: data.error || `שגיאת שרת ${res.status}` },
        };
      }

      return {
        logs: data.logs || [],
        meta: data.meta || {},
        stats: data.stats || null,
        error: null,
      };
    } catch (err) {
      return {
        logs: [],
        meta: {},
        error: { code: "NETWORK", message: err.message || "לא ניתן להתחבר לשרת" },
      };
    }
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
      return hasSupabase() || apiAvailable();
    },

    hasApi() {
      return apiAvailable();
    },

    hasSupabase() {
      return hasSupabase();
    },

    /** בדיקת קוד מול השרת (לא רק מול site-config) */
    async verifyAdminCode(adminCode) {
      if (!apiAvailable()) {
        return { ok: true, meta: {}, warning: "אין API — אימות מקומי בלבד" };
      }
      const result = await fetchApi(adminCode, 1);
      if (result.error?.code === "AUTH") {
        return { ok: false, error: result.error.message };
      }
      if (result.error) {
        return { ok: false, error: result.error.message };
      }
      return { ok: true, meta: result.meta || {} };
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
      if (apiAvailable()) {
        try {
          const r = await pushApi(entry);
          if (r.warning) console.warn(r.warning);
          return r.persisted ? "api" : "api-memory";
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
      const errors = [];
      let meta = { redisConfigured: false, sources: [] };

      if (hasSupabase()) {
        try {
          const sb = await fetchSupabase(cap);
          batches.push(sb.logs);
          meta.sources.push("supabase");
        } catch (err) {
          errors.push({ source: "supabase", message: err.message });
        }
      }

      if (apiAvailable() && adminCode) {
        const api = await fetchApi(adminCode, cap);
        if (api.error) {
          errors.push({ source: "api", ...api.error });
        } else {
          batches.push(api.logs);
          meta = { ...meta, ...api.meta, sources: [...(meta.sources || []), "api"] };
          if (api.stats) meta.stats = api.stats;
        }
      }

      if (!adminOnly) {
        const local = window.NeverlandTracking?.getLocalLogs?.() || [];
        batches.push(local);
        if (local.length) meta.sources.push("local");
      }

      return {
        logs: mergeById(batches.flat()),
        errors,
        meta,
      };
    },

    /** לוח מנהל — רק שרת משותף */
    async fetchForAdmin(adminCode, limit) {
      return this.fetchAll(adminCode, limit, { adminOnly: true });
    },
  };
})();

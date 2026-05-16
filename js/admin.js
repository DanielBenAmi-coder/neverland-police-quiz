(function () {
  "use strict";

  const ADMIN_CODE_KEY = "np_admin_code";
  let cachedLogs = [];

  const EVENT_LABELS = {
    login: "כניסה",
    visit: "ביקור",
    quiz_start: "התחלת תרגול/בחינה",
    quiz_finish: "סיום תרגול/בחינה",
    mode_open: "פתיחת מצב",
    quit_quiz: "יציאה ממבחן",
  };

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function getAdminCode() {
    return sessionStorage.getItem(ADMIN_CODE_KEY) || "";
  }

  function setAdminCode(code) {
    sessionStorage.setItem(ADMIN_CODE_KEY, code);
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString("he-IL", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso || "";
    }
  }

  function eventLabel(event) {
    return EVENT_LABELS[event] || event || "—";
  }

  function detailText(log) {
    const parts = [];
    if (log.label) parts.push(log.label);
    if (log.mode) parts.push(`מצב: ${log.mode}`);
    if (log.rank) parts.push(`דרגה: ${log.rank}`);
    if (log.category) parts.push(`נושא: ${log.category}`);
    if (log.score != null) parts.push(`ציון: ${log.score}%`);
    if (log.passed === true) parts.push("עבר");
    if (log.passed === false) parts.push("לא עבר");
    if (log.questions) parts.push(`${log.questions} שאלות`);
    return parts.join(" · ") || "—";
  }

  function mergeLogs(serverLogs, localLogs) {
    const map = new Map();
    [...serverLogs, ...localLogs].forEach((log) => {
      if (!log || !log.id) return;
      map.set(log.id, log);
    });
    return [...map.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  }

  function renderStats(logs) {
    const el = document.getElementById("admin-stats");
    if (!el) return;

    const names = new Set(logs.map((l) => l.name).filter(Boolean));
    const today = new Date().toDateString();
    const todayCount = logs.filter((l) => {
      try {
        return new Date(l.ts).toDateString() === today;
      } catch {
        return false;
      }
    }).length;

    el.innerHTML = `
      <div class="admin-stat-card"><span class="num">${logs.length}</span><span class="lbl">אירועים</span></div>
      <div class="admin-stat-card"><span class="num">${names.size}</span><span class="lbl">שוטרים</span></div>
      <div class="admin-stat-card"><span class="num">${todayCount}</span><span class="lbl">היום</span></div>
    `;
  }

  function renderTable(logs, filterName) {
    const tbody = document.getElementById("admin-logs-body");
    const empty = document.getElementById("admin-logs-empty");
    if (!tbody) return;

    const q = (filterName || "").trim().toLowerCase();
    const filtered = q
      ? logs.filter((l) => (l.name || "").toLowerCase().includes(q))
      : logs;

    tbody.innerHTML = "";
    if (filtered.length === 0) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    filtered.forEach((log) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatTime(log.ts)}</td>
        <td><strong>${log.name || "—"}</strong></td>
        <td>${eventLabel(log.event)}</td>
        <td>${detailText(log)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function fetchServerLogs(code) {
    const res = await fetch(apiUrl("/api/logs?limit=400"), {
      headers: { "X-Admin-Code": code },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "שגיאה בטעינת לוגים");
    return data;
  }

  async function loadLogs() {
    const status = document.getElementById("admin-status");
    const code = getAdminCode();
    if (!code) return;

    if (status) status.textContent = "טוען לוגים...";

    try {
      const data = await fetchServerLogs(code);
      cachedLogs = mergeLogs(data.logs || [], window.NeverlandTracking?.getLocalLogs?.() || []);
      renderStats(cachedLogs);
      const filter = document.getElementById("admin-filter-name");
      renderTable(cachedLogs, filter?.value || "");
      if (status) {
        status.textContent = data.store === "memory"
          ? "מצב זיכרון זמני — הגדירו Upstash ב-Vercel לשמירה קבועה"
          : `נטענו ${cachedLogs.length} רשומות מהשרת`;
      }
    } catch (err) {
      cachedLogs = window.NeverlandTracking?.getLocalLogs?.() || [];
      renderStats(cachedLogs);
      renderTable(cachedLogs, document.getElementById("admin-filter-name")?.value || "");
      if (status) {
        status.textContent = `שרת לא זמין — מוצגים לוגים מקומיים בלבד (${cachedLogs.length})`;
      }
    }
  }

  function showAdminScreen() {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById("screen-admin")?.classList.add("active");
    window.scrollTo(0, 0);
  }

  function showLogin() {
    document.getElementById("admin-login-panel")?.classList.remove("hidden");
    document.getElementById("admin-logs-panel")?.classList.add("hidden");
  }

  function showLogsPanel() {
    document.getElementById("admin-login-panel")?.classList.add("hidden");
    document.getElementById("admin-logs-panel")?.classList.remove("hidden");
    loadLogs();
  }

  function bind() {
    document.getElementById("btn-admin-entry")?.addEventListener("click", () => {
      showAdminScreen();
      if (getAdminCode()) showLogsPanel();
      else showLogin();
    });

    document.getElementById("btn-admin-back")?.addEventListener("click", () => {
      document.getElementById("screen-admin")?.classList.remove("active");
      document.getElementById("screen-home")?.classList.add("active");
    });

    document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("admin-code-input");
      const err = document.getElementById("admin-login-error");
      const code = (input?.value || "").trim();
      if (!code) return;

      try {
        await fetchServerLogs(code);
        setAdminCode(code);
        if (err) err.classList.add("hidden");
        showLogsPanel();
      } catch {
        if (err) {
          err.textContent = "קוד מנהל שגוי או השרת לא מוגדר";
          err.classList.remove("hidden");
        }
      }
    });

    document.getElementById("btn-admin-refresh")?.addEventListener("click", loadLogs);
    document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_CODE_KEY);
      showLogin();
    });

    document.getElementById("admin-filter-name")?.addEventListener("input", (e) => {
      renderTable(cachedLogs, e.target.value || "");
    });
  }

  function init() {
    bind();
    if (getAdminCode() && location.hash === "#admin") {
      showAdminScreen();
      showLogsPanel();
    }
  }

  window.NeverlandAdmin = { init, showAdminScreen, loadLogs };
})();

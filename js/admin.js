(function () {
  "use strict";

  const ADMIN_CODE_KEY = "np_admin_code";
  let cachedLogs = [];
  let cachedMeta = {};
  let cachedErrors = [];
  let viewMode = "grouped";

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

  function isValidAdminCode(code) {
    const expected = (cfg().adminCode || "Rasputin").trim().toLowerCase();
    return code.trim().toLowerCase() === expected;
  }

  function getAdminCode() {
    return sessionStorage.getItem(ADMIN_CODE_KEY) || "";
  }

  function setAdminCode(code) {
    sessionStorage.setItem(ADMIN_CODE_KEY, code.trim());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    if (log.mode) parts.push("מצב: " + log.mode);
    if (log.rank) parts.push("דרגה: " + log.rank);
    if (log.category) parts.push("נושא: " + log.category);
    if (log.score != null) parts.push("ציון: " + log.score + "%");
    if (log.passed === true) parts.push("עבר");
    if (log.passed === false) parts.push("לא עבר");
    if (log.questions) parts.push(log.questions + " שאלות");
    return parts.join(" · ") || "—";
  }

  function getFilters() {
    const nameQ = (document.getElementById("admin-filter-name")?.value || "")
      .trim()
      .toLowerCase();
    const eventQ = document.getElementById("admin-filter-event")?.value || "";
    return { nameQ, eventQ };
  }

  function filterLogs(logs) {
    const { nameQ, eventQ } = getFilters();
    return logs.filter((l) => {
      if (nameQ && !(l.name || "").toLowerCase().includes(nameQ)) return false;
      if (eventQ && l.event !== eventQ) return false;
      return true;
    });
  }

  function groupByName(logs) {
    const groups = new Map();
    logs.forEach((log) => {
      const name = (log.name || "לא ידוע").trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(log);
    });

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "he"))
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => (b.ts || "").localeCompare(a.ts || "")),
      }));
  }

  function officerSummary(items) {
    const quizzes = items.filter((l) => l.event === "quiz_finish");
    const last = items[0];
    const scores = quizzes.map((q) => q.score).filter((s) => s != null);
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    let line = items.length + " פעולות";
    if (quizzes.length) line += " · " + quizzes.length + " מבחנים/תרגולים";
    if (avg != null) line += " · ממוצע " + avg + "%";
    if (last && last.ts) line += " · אחרון: " + formatTime(last.ts);
    return line;
  }

  function hasApi() {
    return window.NeverlandLogs?.hasApi?.() ?? false;
  }

  function hasSupabase() {
    return window.NeverlandLogs?.hasSupabase?.() ?? false;
  }

  function renderAlert() {
    const el = document.getElementById("admin-alert");
    if (!el) return;

    const msgs = [];

    cachedErrors.forEach((e) => {
      if (e.code === "AUTH") {
        msgs.push(
          "קוד מנהל נדחה על ידי השרת — ודאו ש-ADMIN_CODE ב-Vercel תואם (ברירת מחדל: Rasputin)."
        );
      } else if (e.code === "NETWORK") {
        msgs.push("לא ניתן להתחבר ל-API: " + (e.message || ""));
      } else {
        msgs.push((e.source || "שגיאה") + ": " + (e.message || ""));
      }
    });

    if (hasApi() && cachedMeta.redisConfigured === false) {
      msgs.push(
        "Redis (Upstash) לא מוגדר ב-Vercel — לוגים לא נשמרים לכל השוטרים. הוסיפו UPSTASH_REDIS_REST_URL ו-UPSTASH_REDIS_REST_TOKEN."
      );
    }

    if (!hasApi() && !hasSupabase()) {
      msgs.push(
        "אין חיבור לשרת לוגים — הגדירו Supabase ב-site-config או פרסמו דרך GitHub Pages עם apiBase."
      );
    }

    if (msgs.length === 0) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }

    el.classList.remove("hidden");
    el.innerHTML = msgs.map((m) => "<p>" + escapeHtml(m) + "</p>").join("");
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
    const quizzes = logs.filter((l) => l.event === "quiz_finish").length;

    el.innerHTML =
      '<div class="admin-stat-card"><span class="num">' +
      names.size +
      '</span><span class="lbl">שוטרים</span></div>' +
      '<div class="admin-stat-card"><span class="num">' +
      logs.length +
      '</span><span class="lbl">אירועים</span></div>' +
      '<div class="admin-stat-card"><span class="num">' +
      todayCount +
      '</span><span class="lbl">היום</span></div>' +
      '<div class="admin-stat-card"><span class="num">' +
      quizzes +
      '</span><span class="lbl">סיומי מבחן</span></div>';
  }

  function renderGrouped(logs) {
    const container = document.getElementById("admin-logs-grouped");
    const flat = document.getElementById("admin-logs-flat");
    if (!container || !flat) return;

    container.classList.remove("hidden");
    flat.classList.add("hidden");
    container.innerHTML = "";

    groupByName(logs).forEach((group) => {
      const rows = group.items
        .map(function (log) {
          return (
            "<tr><td>" +
            formatTime(log.ts) +
            "</td><td>" +
            escapeHtml(eventLabel(log.event)) +
            "</td><td>" +
            escapeHtml(detailText(log)) +
            "</td></tr>"
          );
        })
        .join("");

      const card = document.createElement("article");
      card.className = "admin-officer-card";
      card.innerHTML =
        '<header class="admin-officer-head"><h3>' +
        escapeHtml(group.name) +
        "</h3><p>" +
        escapeHtml(officerSummary(group.items)) +
        '</p></header><div class="admin-table-wrap"><table class="admin-table admin-table-nested"><thead><tr><th>זמן</th><th>פעולה</th><th>פרטים</th></tr></thead><tbody>' +
        rows +
        "</tbody></table></div>";
      container.appendChild(card);
    });
  }

  function renderFlat(logs) {
    const container = document.getElementById("admin-logs-grouped");
    const flat = document.getElementById("admin-logs-flat");
    if (!container || !flat) return;

    container.classList.add("hidden");
    flat.classList.remove("hidden");

    const rows = logs
      .map(function (log) {
        return (
          "<tr><td>" +
          formatTime(log.ts) +
          "</td><td>" +
          escapeHtml(log.name || "—") +
          "</td><td>" +
          escapeHtml(eventLabel(log.event)) +
          "</td><td>" +
          escapeHtml(detailText(log)) +
          "</td></tr>"
        );
      })
      .join("");

    flat.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>זמן</th><th>שוטר</th><th>פעולה</th><th>פרטים</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>";
  }

  function renderLogsView(logs) {
    const empty = document.getElementById("admin-logs-empty");
    if (logs.length === 0) {
      document.getElementById("admin-logs-grouped")?.classList.add("hidden");
      document.getElementById("admin-logs-flat")?.classList.add("hidden");
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");
    if (viewMode === "flat") renderFlat(logs);
    else renderGrouped(logs);
  }

  function renderAll() {
    const filtered = filterLogs(cachedLogs);
    renderAlert();
    renderStats(filtered);
    renderLogsView(filtered);
  }

  async function loadLogs() {
    const status = document.getElementById("admin-status");
    const code = getAdminCode();
    if (!code) return;

    if (status) status.textContent = "טוען לוגים...";

    try {
      const result = await window.NeverlandLogs.fetchForAdmin(code, 800);
      cachedLogs = result.logs || [];
      cachedMeta = result.meta || {};
      cachedErrors = result.errors || [];
    } catch (err) {
      cachedLogs = [];
      cachedErrors = [{ code: "NETWORK", message: err.message }];
    }

    renderAll();

    const statusEl = document.getElementById("admin-status");
    if (!statusEl) return;

    const names = new Set(cachedLogs.map((l) => l.name).filter(Boolean)).size;
    const sources = (cachedMeta.sources || []).join(", ") || "—";
    const redisOk =
      cachedMeta.redisConfigured === true ? "Redis מחובר" : "Redis לא מוגדר";
    const time = new Date().toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (cachedErrors.some((e) => e.code === "AUTH")) {
      statusEl.textContent = "קוד מנהל נדחה על ידי השרת — התחברו מחדש.";
    } else if (cachedLogs.length === 0) {
      statusEl.textContent =
        "אין לוגים · " + redisOk + " · מקורות: " + sources + " · עודכן " + time;
    } else {
      statusEl.textContent =
        names +
        ' שוטרים · ' +
        cachedLogs.length +
        " אירועים · " +
        redisOk +
        " · " +
        sources +
        " · עודכן " +
        time;
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

      if (!isValidAdminCode(code)) {
        if (err) {
          err.textContent = "קוד מנהל שגוי (ברירת מחדל: Rasputin)";
          err.classList.remove("hidden");
        }
        return;
      }

      if (window.NeverlandLogs?.verifyAdminCode) {
        const verify = await window.NeverlandLogs.verifyAdminCode(code);
        if (!verify.ok) {
          if (err) {
            err.textContent = verify.error || "השרת דחה את הקוד";
            err.classList.remove("hidden");
          }
          return;
        }
      }

      setAdminCode(code);
      if (err) err.classList.add("hidden");
      showLogsPanel();
    });

    document.getElementById("btn-admin-refresh")?.addEventListener("click", loadLogs);
    document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_CODE_KEY);
      showLogin();
    });

    document.getElementById("admin-filter-name")?.addEventListener("input", renderAll);
    document.getElementById("admin-filter-event")?.addEventListener("change", renderAll);

    document.getElementById("btn-admin-view-grouped")?.addEventListener("click", () => {
      viewMode = "grouped";
      document.getElementById("btn-admin-view-grouped")?.classList.add("active");
      document.getElementById("btn-admin-view-flat")?.classList.remove("active");
      renderAll();
    });

    document.getElementById("btn-admin-view-flat")?.addEventListener("click", () => {
      viewMode = "flat";
      document.getElementById("btn-admin-view-flat")?.classList.add("active");
      document.getElementById("btn-admin-view-grouped")?.classList.remove("active");
      renderAll();
    });
  }

  function init() {
    bind();
    document.getElementById("btn-admin-view-grouped")?.classList.add("active");
    if (getAdminCode() && location.hash === "#admin") {
      showAdminScreen();
      showLogsPanel();
    }
  }

  window.NeverlandAdmin = { init, showAdminScreen, loadLogs };
})();

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

  function isValidAdminCode(code) {
    const expected = (cfg().adminCode || "Rasputin").trim().toLowerCase();
    return code.trim().toLowerCase() === expected;
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

    let line = `${items.length} פעולות`;
    if (quizzes.length) line += ` · ${quizzes.length} מבחנים/תרגולים`;
    if (avg != null) line += ` · ממוצע ${avg}%`;
    if (last?.ts) line += ` · אחרון: ${formatTime(last.ts)}`;
    return line;
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
      <div class="admin-stat-card"><span class="num">${names.size}</span><span class="lbl">שוטרים</span></div>
      <div class="admin-stat-card"><span class="num">${logs.length}</span><span class="lbl">אירועים</span></div>
      <div class="admin-stat-card"><span class="num">${todayCount}</span><span class="lbl">היום</span></div>
    `;
  }

  function renderGroupedLogs(logs, filterName) {
    const container = document.getElementById("admin-logs-grouped");
    const empty = document.getElementById("admin-logs-empty");
    if (!container) return;

    const q = (filterName || "").trim().toLowerCase();
    const filtered = q
      ? logs.filter((l) => (l.name || "").toLowerCase().includes(q))
      : logs;

    const groups = groupByName(filtered);
    container.innerHTML = "";

    if (groups.length === 0) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");

    groups.forEach((group) => {
      const card = document.createElement("article");
      card.className = "admin-officer-card";

      const rows = group.items
        .map(
          (log) => `
        <tr>
          <td>${formatTime(log.ts)}</td>
          <td>${eventLabel(log.event)}</td>
          <td>${detailText(log)}</td>
        </tr>`
        )
        .join("");

      card.innerHTML = `
        <header class="admin-officer-head">
          <h3>${group.name}</h3>
          <p>${officerSummary(group.items)}</p>
        </header>
        <div class="admin-table-wrap">
          <table class="admin-table admin-table-nested">
            <thead>
              <tr>
                <th>זמן</th>
                <th>פעולה</th>
                <th>פרטים</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      container.appendChild(card);
    });
  }

  async function loadLogs() {
    const status = document.getElementById("admin-status");
    const code = getAdminCode();
    if (!code) return;

    if (status) status.textContent = "טוען לוגים...";

    cachedLogs = await window.NeverlandLogs.fetchForAdmin(code, 500);

    renderStats(cachedLogs);
    const filter = document.getElementById("admin-filter-name")?.value || "";
    renderGroupedLogs(cachedLogs, filter);

    const hasCloud = window.NeverlandLogs?.hasCloud?.();
    const names = new Set(cachedLogs.map((l) => l.name)).size;

    if (status) {
      if (hasCloud) {
        status.textContent = `לוגים מ-${names} שוטרים · סה"כ ${cachedLogs.length} אירועים (שרת משותף)`;
      } else if (cachedLogs.length > 0) {
        status.textContent = `נמצאו ${cachedLogs.length} אירועים מהשרת.`;
      } else {
        status.textContent =
          "אין לוגים בשרת. ודאו ש-UPSTASH_REDIS (Vercel) או Supabase מוגדרים — לוגים מקומיים לא מוצגים כאן.";
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

      if (!isValidAdminCode(code)) {
        if (err) {
          err.textContent = "קוד מנהל שגוי (נסו: Rasputin)";
          err.classList.remove("hidden");
        }
        return;
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

    document.getElementById("admin-filter-name")?.addEventListener("input", (e) => {
      renderGroupedLogs(cachedLogs, e.target.value || "");
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

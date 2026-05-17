(function () {
  "use strict";

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

  function examLabel(item) {
    return item.label || item.rank || item.category || item.mode || "בחינה/תרגול";
  }

  function computeTrends(history) {
    const recent = history.slice(0, 12).reverse();
    const scores = recent.map((h) => h.score).filter((s) => s != null);
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    const last = history[0];
    const prev = history[1];
    let trend = "—";
    if (last?.score != null && prev?.score != null) {
      const diff = last.score - prev.score;
      if (diff > 0) trend = `↑ +${diff}%`;
      else if (diff < 0) trend = `↓ ${diff}%`;
      else trend = "→ יציב";
    }

    return { recent, avg, trend };
  }

  function mistakeMap(history) {
    const map = new Map();
    history.forEach((exam) => {
      (exam.wrongs || []).forEach((w) => {
        const key = w.questionId || w.question;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, { ...w, count: 0, lastTs: exam.ts });
        }
        const row = map.get(key);
        row.count += 1;
        if ((exam.ts || "") > (row.lastTs || "")) row.lastTs = exam.ts;
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  function renderTrendChart(recent) {
    const el = document.getElementById("history-trend-chart");
    if (!el) return;

    if (recent.length === 0) {
      el.innerHTML = '<p class="history-muted">אין מספיק נתונים למגמה</p>';
      return;
    }

    const max = Math.max(...recent.map((r) => r.score || 0), 1);
    const bars = recent.map((r, i) => {
      const h = Math.max(8, Math.round(((r.score || 0) / max) * 100));
      const pass = r.passed === true;
      return (
        '<div class="trend-bar-wrap" title="' +
        formatTime(r.ts) +
        " · " +
        r.score +
        '%">' +
        '<div class="trend-bar ' +
        (pass ? "pass" : "fail") +
        '" style="height:' +
        h +
        '%"></div>' +
        '<span class="trend-bar-score">' +
        (r.score ?? "—") +
        "</span>" +
        '<span class="trend-bar-idx">' +
        (i + 1) +
        "</span></div>"
      );
    });

    el.innerHTML = bars.join("");
  }

  function renderSummary(trends, total) {
    const el = document.getElementById("history-summary");
    if (!el) return;

    el.innerHTML =
      '<div class="history-stat"><span class="num">' +
      total +
      '</span><span class="lbl">בחינות/תרגולים</span></div>' +
      '<div class="history-stat"><span class="num">' +
      (trends.avg != null ? trends.avg + "%" : "—") +
      '</span><span class="lbl">ממוצע אחרון</span></div>' +
      '<div class="history-stat"><span class="num">' +
      trends.trend +
      '</span><span class="lbl">מגמה</span></div>';
  }

  function renderExamList(history) {
    const list = document.getElementById("history-exam-list");
    if (!list) return;

    if (history.length === 0) {
      list.innerHTML = '<li class="history-muted">עדיין אין היסטוריה — סיימו בחינה או תרגול</li>';
      return;
    }

    list.innerHTML = history
      .map((exam) => {
        const wrongN = (exam.wrongs || []).length;
        const passCls =
          exam.passed === true ? "pass" : exam.passed === false ? "fail" : "";
        return (
          '<li class="history-exam-item ' +
          passCls +
          '">' +
          '<div class="history-exam-head"><strong>' +
          examLabel(exam) +
          '</strong><span class="history-exam-score">' +
          (exam.score ?? "—") +
          "%</span></div>" +
          '<p class="history-exam-meta">' +
          formatTime(exam.ts) +
          " · " +
          (exam.correctCount ?? "?") +
          "/" +
          (exam.total ?? "?") +
          " נכונות" +
          (wrongN ? " · " + wrongN + " טעויות" : "") +
          "</p></li>"
        );
      })
      .join("");
  }

  function renderMistakes(mistakes) {
    const list = document.getElementById("history-mistakes-list");
    if (!list) return;

    if (mistakes.length === 0) {
      list.innerHTML = '<li class="history-muted">אין טעויות חוזרות — כל הכבוד!</li>';
      return;
    }

    list.innerHTML = mistakes
      .slice(0, 15)
      .map(
        (m) =>
          '<li class="history-mistake-item"><span class="mistake-count">×' +
          m.count +
          "</span><strong>" +
          (m.question || "שאלה") +
          "</strong><p>טעיתם: " +
          (m.selectedText || "—") +
          " · נכון: " +
          (m.correctText || "—") +
          "</p></li>"
      )
      .join("");
  }

  async function loadAndRender() {
    const name = window.NeverlandTracking?.getName?.();
    const status = document.getElementById("history-status");
    const title = document.getElementById("history-officer-name");

    if (!name) {
      if (status) status.textContent = "הזינו שם בשרת כדי לראות היסטוריה";
      return;
    }

    if (title) title.textContent = name;
    if (status) status.textContent = "טוען היסטוריה...";

    const history = await window.NeverlandHistory.fetchForOfficer(name, 50);
    const trends = computeTrends(history);
    const mistakes = mistakeMap(history);

    renderSummary(trends, history.length);
    renderTrendChart(trends.recent);
    renderExamList(history);
    renderMistakes(mistakes);

    const hasCloud = window.NeverlandHistory?.hasCloud?.();
    if (status) {
      status.textContent = hasCloud
        ? history.length + " רשומות (מקומי + שרת)"
        : history.length + " רשומות מקומיות — הגדירו שרת לסנכרון בין מכשירים";
    }
  }

  function showHistoryScreen() {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById("screen-history")?.classList.add("active");
    window.scrollTo(0, 0);
    loadAndRender();
  }

  function bind() {
    document.getElementById("btn-my-history")?.addEventListener("click", showHistoryScreen);
    document.getElementById("btn-history-back")?.addEventListener("click", () => {
      document.getElementById("screen-history")?.classList.remove("active");
      document.getElementById("screen-home")?.classList.add("active");
    });
    document.getElementById("btn-history-refresh")?.addEventListener("click", loadAndRender);
  }

  function init() {
    bind();
  }

  window.NeverlandHistoryUI = { init, showHistoryScreen, loadAndRender };
})();

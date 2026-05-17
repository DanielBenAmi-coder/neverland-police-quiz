/** שליחת לוגים לדיסקורד דרך השרת (webhooks ב-Vercel בלבד) */
(function () {
  "use strict";

  const SENT = new Set();

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function apiAvailable() {
    if ((cfg().apiBase || "").trim()) return true;
    const host = window.location.hostname;
    return host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1";
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function modeToCategory(mode) {
    if (mode === "exam") return "exam";
    if (mode === "category") return "category";
    if (mode === "practice") return "practice";
    return null;
  }

  function rankLabel(rankLevel) {
    if (!rankLevel || !window.RANK_LEVELS) return null;
    return window.RANK_LEVELS[rankLevel]?.title || rankLevel;
  }

  function categoryLabel(key) {
    if (!key) return null;
    if (typeof CATEGORY_LABELS !== "undefined" && CATEGORY_LABELS[key]) {
      return CATEGORY_LABELS[key];
    }
    return key;
  }

  function shouldSendDiscord(event, mode) {
    if (event === "quiz_start" || event === "quiz_finish" || event === "quit_quiz") {
      return true;
    }
    if (event === "mode_open") return false;
    return false;
  }

  function dedupeKey(category, event, name, extra) {
    return [category, event, name, extra || ""].join("|");
  }

  /**
   * @param {"practice"|"exam"|"category"|"rasputin"} category
   * @param {object} payload
   */
  function notify(category, payload) {
    if (!apiAvailable()) return;

    const name = payload.name || window.NeverlandTracking?.getName?.();
    if (!name) return;

    const event = payload.event || "";
    if (category !== "rasputin" && !shouldSendDiscord(event, payload.mode)) {
      return;
    }

    const key = dedupeKey(
      category,
      event,
      name,
      event === "quiz_finish" ? String(payload.score) : payload.ts
    );
    if (category !== "rasputin") {
      if (SENT.has(key)) return;
      SENT.add(key);
      setTimeout(() => SENT.delete(key), 8000);
    }

    const body = {
      channel: category,
      event,
      name,
      ts: payload.ts || new Date().toISOString(),
      mode: payload.mode,
      rank: payload.rank,
      rankLabel: payload.rankLabel || rankLabel(payload.rank),
      quizCategory: payload.category,
      categoryLabel: payload.categoryLabel || categoryLabel(payload.category),
      score: payload.score,
      passed: payload.passed,
      questions: payload.questions,
      label: payload.label,
      question: payload.question,
      answer: payload.answer,
      aiMode: payload.aiMode,
    };

    fetch(apiUrl("/api/discord-log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((err) => console.warn("Discord log:", err.message));
  }

  /** נקרא מ-tracking אחרי log רגיל */
  function fromTracking(entry) {
    const cat = modeToCategory(entry.mode);
    if (!cat) return;
    notify(cat, {
      event: entry.event,
      name: entry.name,
      ts: entry.ts,
      mode: entry.mode,
      rank: entry.rank,
      category: entry.category,
      score: entry.score,
      passed: entry.passed,
      questions: entry.questions,
      label: entry.label,
    });
  }

  function rasputin(question, answer, aiMode) {
    const name = window.NeverlandTracking?.getName?.();
    if (!name) return;
    notify("rasputin", {
      event: "rasputin_question",
      name,
      ts: new Date().toISOString(),
      question,
      answer,
      aiMode: aiMode || "local",
    });
  }

  window.NeverlandDiscord = {
    notify,
    fromTracking,
    rasputin,
  };
})();

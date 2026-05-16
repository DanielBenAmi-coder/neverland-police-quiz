(function () {
  "use strict";

  const STORAGE_KEY = "neverland-police-quiz-stats";
  const CATEGORY_SIZE = 25;

  let rankPanelMode = "exam";

  const TYPE_LABELS = {
    choice: "בחירה",
    truefalse: "נכון / לא נכון",
    not: "מה לא נכון?",
    scenario: "תרחיש בשטח",
  };

  const $ = (sel) => document.querySelector(sel);

  const screens = {};

  function initScreens() {
    screens.home = document.getElementById("screen-home");
    screens.quiz = document.getElementById("screen-quiz");
    screens.results = document.getElementById("screen-results");
  }

  let state = {
    mode: "practice",
    category: null,
    rankLevel: null,
    questions: [],
    index: 0,
    answers: [],
    answered: false,
    selected: null,
  };

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getPool(category, rankLevel) {
    if (rankLevel && RANK_LEVELS[rankLevel]) {
      return QUESTIONS.filter(RANK_LEVELS[rankLevel].pool);
    }
    if (category) {
      return QUESTIONS.filter((q) => q.category === category);
    }
    return QUESTIONS;
  }

  /** בחירה משוקללת לפי רמה — למבחן Officer→Senior יותר שאלות קשות */
  function pickByLevelRatio(pool, count, levelKey, ratio) {
    const primary = shuffle(pool.filter((q) => q.level === levelKey));
    const secondary = shuffle(pool.filter((q) => q.level !== levelKey));
    const nPrimary = Math.min(primary.length, Math.round(count * ratio));
    const nSecondary = Math.min(secondary.length, count - nPrimary);
    let picked = [...primary.slice(0, nPrimary), ...secondary.slice(0, nSecondary)];
    if (picked.length < count) {
      const rest = shuffle(pool.filter((q) => !picked.includes(q)));
      picked = [...picked, ...rest.slice(0, count - picked.length)];
    }
    return shuffle(picked).slice(0, count);
  }

  /** מבחן קשה: דגש על senior + סוגים מבלבלים */
  function pickHardExamPool(pool, count) {
    const senior = shuffle(pool.filter((q) => q.level === "senior"));
    const tricky = shuffle(
      pool.filter((q) => ["not", "scenario"].includes(q.type || ""))
    );
    const officer = shuffle(pool.filter((q) => q.level === "officer"));
    const picked = [];
    const used = new Set();

    const take = (list, maxN) => {
      let n = 0;
      for (const q of list) {
        if (picked.length >= count || n >= maxN) break;
        if (!used.has(q.id)) {
          picked.push(q);
          used.add(q.id);
          n++;
        }
      }
    };

    take(tricky, Math.round(count * 0.35));
    take(senior, Math.round(count * 0.72));
    take(officer, count);
    if (picked.length < count) {
      take(shuffle(pool), count - picked.length);
    }
    return shuffle(picked).slice(0, count);
  }

  function buildRankDeck(pool, rankConfig, questionCount) {
    const count = Math.min(questionCount, pool.length);
    let selected;
    if (rankConfig.id === "officer-senior") {
      selected = pickHardExamPool(pool, count);
    } else {
      selected = pickByLevelRatio(pool, count, "cadet", rankConfig.cadetRatio || 0.45);
    }
    selected = interleaveByCategory(selected);
    selected = shuffle(shuffle(selected));
    return selected.map(prepareQuestion);
  }

  function getSourceQuestion(prepared) {
    return QUESTIONS.find((x) => x.id === prepared.id);
  }

  function getCorrectAnswerText(prepared) {
    const src = getSourceQuestion(prepared);
    if (!src) return "";
    if (prepared.type === "truefalse") {
      return prepared.correct === 0 ? "נכון" : "לא נכון";
    }
    return src.options[src.correct];
  }

  /** מערבב קטגוריות כדי שלא יבואו הרבה שאלות רצופות מאותו נושא */
  function interleaveByCategory(questions) {
    const buckets = {};
    questions.forEach((q) => {
      if (!buckets[q.category]) buckets[q.category] = [];
      buckets[q.category].push(q);
    });
    Object.values(buckets).forEach((b) => shuffle(b));
    const catOrder = shuffle(Object.keys(buckets));
    const out = [];
    let left = true;
    while (left) {
      left = false;
      for (const cat of catOrder) {
        if (buckets[cat].length) {
          out.push(buckets[cat].shift());
          left = true;
        }
      }
    }
    return out;
  }

  /** בוחר מגוון סוגי שאלות */
  function pickBalancedPool(pool, count) {
    const byType = {};
    pool.forEach((q) => {
      const t = q.type || "choice";
      if (!byType[t]) byType[t] = [];
      byType[t].push(q);
    });
    Object.values(byType).forEach((list) => shuffle(list));

    const types = shuffle(Object.keys(byType));
    const picked = [];
    const usedIds = new Set();

    while (picked.length < count) {
      let added = false;
      for (const t of types) {
        if (picked.length >= count) break;
        const list = byType[t];
        while (list.length && usedIds.has(list[0].id)) list.shift();
        if (list.length) {
          const q = list.shift();
          picked.push(q);
          usedIds.add(q.id);
          added = true;
        }
      }
      if (!added) break;
    }

    if (picked.length < count) {
      const rest = shuffle(pool.filter((q) => !usedIds.has(q.id)));
      picked.push(...rest.slice(0, count - picked.length));
    }

    return picked.slice(0, count);
  }

  function prepareQuestion(raw) {
    const type = raw.type || "choice";
    const base = { ...raw, type };

    if (type === "truefalse") {
      const opts = ["נכון", "לא נכון"];
      return {
        ...base,
        shuffledOptions: opts,
        correct: raw.correct,
      };
    }

    const order = shuffle(raw.options.map((_, i) => i));
    return {
      ...base,
      shuffledOptions: order.map((i) => raw.options[i]),
      correct: order.indexOf(raw.correct),
    };
  }

  function buildQuizDeck(pool, count) {
    const n = Math.min(count, pool.length);
    let selected = pickBalancedPool(pool, n);
    selected = interleaveByCategory(selected);
    selected = shuffle(selected);
    selected = shuffle(selected);
    return selected.map(prepareQuestion);
  }

  function showScreen(name) {
    const target = screens[name];
    if (!target) {
      console.error("מסך לא נמצא:", name);
      return;
    }
    Object.keys(screens).forEach((key) => {
      const el = screens[key];
      if (el) el.classList.remove("active");
    });
    target.classList.add("active");
  }

  function track(event, data) {
    window.NeverlandTracking?.log?.(event, data);
  }

  function handleModeClick(mode) {
    if (mode === "exam") {
      track("mode_open", { mode: "exam", label: "פתיחת בחינה" });
      showRankPanel("exam");
      return;
    }
    if (mode === "practice") {
      track("mode_open", { mode: "practice", label: "פתיחת תרגול" });
      showRankPanel("practice");
      return;
    }
    if (mode === "category") {
      track("mode_open", { mode: "category", label: "פתיחת לפי נושא" });
      $("#category-panel").classList.remove("hidden");
      $("#rank-panel").classList.add("hidden");
      document.querySelector(".mode-grid").classList.add("hidden");
      return;
    }
  }

  function updateHomeStats() {
    const stats = loadStats();
    $("#stat-attempts").textContent = stats.attempts || 0;
    $("#stat-best-cadet").textContent =
      stats.bestCadetOfficer != null ? stats.bestCadetOfficer + "%" : "—";
    $("#stat-best-senior").textContent =
      stats.bestOfficerSenior != null ? stats.bestOfficerSenior + "%" : "—";
    $("#stat-questions").textContent = QUESTIONS.length;
  }

  function buildRankLevelCards() {
    const grid = $("#rank-level-grid");
    const isExam = rankPanelMode === "exam";
    grid.innerHTML = "";
    $("#rank-panel-title").textContent = isExam
      ? "בחרו סוג בחינה"
      : "בחרו דרגה לתרגול";

    Object.values(RANK_LEVELS).forEach((cfg) => {
      const pool = QUESTIONS.filter(cfg.pool);
      const qCount = isExam ? cfg.examSize : cfg.practiceSize;
      const meta = isExam
        ? `${qCount} שאלות · עוברים ב-${cfg.pass}%+ · ${pool.length} במאגר`
        : `${qCount} שאלות · משוב מיידי · ${pool.length} במאגר`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "exam-level-card" + (cfg.id === "officer-senior" ? " exam-level-hard" : "");
      btn.innerHTML = `
        <span class="exam-level-badge ${cfg.badgeClass}">${cfg.badge}</span>
        <h4>${cfg.title}</h4>
        <p>${cfg.topics}</p>
        <span class="exam-level-meta">${meta}</span>
      `;
      btn.addEventListener("click", () =>
        startQuiz(isExam ? "exam" : "practice", null, cfg.id)
      );
      grid.appendChild(btn);
    });
  }

  function showRankPanel(mode) {
    rankPanelMode = mode;
    buildRankLevelCards();
    $("#rank-panel").classList.remove("hidden");
    document.querySelector(".mode-grid").classList.add("hidden");
    $("#category-panel").classList.add("hidden");
  }

  function hidePanels() {
    $("#rank-panel").classList.add("hidden");
    $("#category-panel").classList.add("hidden");
    document.querySelector(".mode-grid").classList.remove("hidden");
  }

  function buildCategoryChips() {
    const container = $("#category-chips");
    container.innerHTML = "";
    const cats = [...new Set(QUESTIONS.map((q) => q.category))];
    shuffle(cats).forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      const n = QUESTIONS.filter((q) => q.category === cat).length;
      btn.textContent = `${CATEGORY_LABELS[cat] || cat} (${n})`;
      btn.dataset.category = cat;
      btn.addEventListener("click", () => startQuiz("category", cat));
      container.appendChild(btn);
    });
  }

  function startQuiz(mode, category, rankLevel) {
    const pool = getPool(category, rankLevel);
    if (pool.length === 0) {
      alert("אין שאלות מתאימות למסלול זה.");
      return;
    }

    hidePanels();

    let questions;
    let rankConfig = null;
    if (rankLevel && RANK_LEVELS[rankLevel]) {
      rankConfig = RANK_LEVELS[rankLevel];
      const count =
        mode === "exam" ? rankConfig.examSize : rankConfig.practiceSize;
      questions = buildRankDeck(pool, rankConfig, count);
    } else if (mode === "category") {
      questions = buildQuizDeck(pool, Math.min(pool.length, CATEGORY_SIZE));
    } else {
      alert("יש לבחור דרגה לתרגול או בחינה.");
      return;
    }

    state = {
      mode,
      category: category || null,
      rankLevel: rankLevel || null,
      rankConfig,
      questions,
      index: 0,
      answers: [],
      answered: false,
      selected: null,
    };

    const labels = {
      practice: rankConfig ? `תרגול · ${rankConfig.title}` : "תרגול",
      exam: rankConfig ? `בחינה · ${rankConfig.title}` : "בחינה",
      category: "לפי נושא",
    };
    $("#quiz-mode-label").textContent = labels[mode] || "תרגול";

    $("#feedback-panel").classList.add("hidden");
    $("#exam-actions").classList.toggle("hidden", mode !== "exam");
    $("#btn-submit-exam").disabled = true;

    track("quiz_start", {
      mode,
      rank: rankLevel,
      category: category || null,
      questions: questions.length,
      label: rankConfig?.title || category || mode,
    });

    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.index];
    const total = state.questions.length;
    const pct = ((state.index + 1) / total) * 100;

    $("#quiz-counter").textContent = `${state.index + 1} / ${total}`;
    $("#progress-fill").style.width = pct + "%";

    const catLabel = CATEGORY_LABELS[q.category] || q.category;
    const typeLabel = TYPE_LABELS[q.type] || TYPE_LABELS.choice;
    $("#question-category").innerHTML = `<span class="type-badge">${typeLabel}</span> ${catLabel}`;

    $("#question-text").textContent = q.q;

    state.answered = false;
    state.selected = null;
    $("#feedback-panel").classList.add("hidden");

    const list = $("#answers-list");
    list.innerHTML = "";
    list.className = "answers" + (q.type === "truefalse" ? " answers-tf" : "");

    q.shuffledOptions.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => onAnswer(i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    if (state.mode === "exam" && state.index === total - 1) {
      $("#btn-submit-exam").disabled = false;
    }
  }

  function onAnswer(choiceIndex) {
    if (state.answered) return;

    const q = state.questions[state.index];
    const correct = choiceIndex === q.correct;
    state.answered = true;
    state.selected = choiceIndex;
    state.answers.push({
      questionId: q.id,
      selected: choiceIndex,
      correct,
    });

    const buttons = $("#answers-list").querySelectorAll(".answer-btn");
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) btn.classList.add("correct");
      else if (i === choiceIndex && !correct) btn.classList.add("wrong");
    });

    if (state.mode === "exam") {
      if (state.index < state.questions.length - 1) {
        setTimeout(() => {
          state.index++;
          renderQuestion();
        }, 350);
      }
      return;
    }

    const resultEl = $("#feedback-result");
    const explainEl = $("#feedback-explanation");
    resultEl.textContent = correct ? "✓ נכון!" : "✗ לא נכון";
    resultEl.className = "feedback-result " + (correct ? "ok" : "bad");
    if (!correct) {
      explainEl.innerHTML = `<span class="correct-hint">תשובה נכונה: ${getCorrectAnswerText(q)}</span><br>${q.explain}`;
    } else {
      explainEl.textContent = q.explain;
    }
    $("#feedback-panel").classList.remove("hidden");
  }

  function nextQuestion() {
    if (state.index < state.questions.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    const total = state.answers.length;
    const correctCount = state.answers.filter((a) => a.correct).length;
    const pct = total ? Math.round((correctCount / total) * 100) : 0;

    const stats = loadStats();
    stats.attempts = (stats.attempts || 0) + 1;
    const passThreshold = state.rankConfig?.pass ?? 70;
    const isHardExam = state.rankLevel === "officer-senior";

    if (state.mode === "exam" && state.rankLevel === "cadet-officer") {
      if (stats.bestCadetOfficer == null || pct > stats.bestCadetOfficer) {
        stats.bestCadetOfficer = pct;
      }
    }
    if (state.mode === "exam" && state.rankLevel === "officer-senior") {
      if (stats.bestOfficerSenior == null || pct > stats.bestOfficerSenior) {
        stats.bestOfficerSenior = pct;
      }
    }
    saveStats(stats);
    updateHomeStats();

    $("#final-score").textContent = pct + "%";
    $("#score-ring").style.setProperty("--pct", pct + "%");

    let title, summary;
    const passed = pct >= passThreshold;

    if (state.mode === "exam" && state.rankConfig) {
      if (passed && pct >= 90) {
        title = isHardExam ? "מצוין! עברתם את המבחן הקשה" : "מצוין! עברתם";
        summary = `${state.rankConfig.title} — ציון גבוה, מוכנים להמשך.`;
      } else if (passed) {
        title = "עברתם את הבחינה";
        summary = `${state.rankConfig.title} — ${pct}% (נדרש ${passThreshold}%+).`;
      } else {
        title = isHardExam ? "לא עברתם — המבחן הקשה דורש חיזוק" : "לא עברתם";
        summary = `${state.rankConfig.title} — ${pct}%. נדרש ${passThreshold}%+. חזרו על המדריך.`;
      }
    } else if (pct >= 90) {
      title = "מצוין!";
      summary = "שליטה מעולה בנהלים — מוכנים לשטח.";
    } else if (pct >= 70) {
      title = "טוב מאוד";
      summary = "בסיס חזק — חזרו על השאלות המבלבלות.";
    } else if (pct >= 50) {
      title = "עברתם בקושי";
      summary = "מומלץ תרגול לפי נושא ושאלות נכון/לא נכון.";
    } else {
      title = "צריך חיזוק";
      summary = "עברו שוב על המדריך ונסו תרגול לפני בחינה.";
    }

    $("#results-title").textContent = title;
    $("#results-summary").textContent = summary;

    $("#results-breakdown").innerHTML = `
      <div class="breakdown-item">
        <span class="num" style="color:var(--success)">${correctCount}</span>
        <span class="lbl">נכונות</span>
      </div>
      <div class="breakdown-item">
        <span class="num" style="color:var(--error)">${total - correctCount}</span>
        <span class="lbl">שגויות</span>
      </div>
      <div class="breakdown-item">
        <span class="num">${total}</span>
        <span class="lbl">סה"כ</span>
      </div>
    `;

    const wrong = state.answers.filter((a) => !a.correct);
    const wrongReview = $("#wrong-review");
    const wrongList = $("#wrong-list");

    if (wrong.length > 0) {
      wrongReview.classList.remove("hidden");
      wrongList.innerHTML = "";
      wrong.forEach((a) => {
        const prepared = state.questions.find((x) => x.id === a.questionId);
        const src = getSourceQuestion(prepared) || prepared;
        if (!src) return;
        const li = document.createElement("li");
        const typeLbl = TYPE_LABELS[prepared?.type || "choice"] || "";
        li.innerHTML = `
          <span class="wrong-type">${typeLbl}</span>
          <strong>${src.q}</strong>
          <div class="correct-ans">תשובה נכונה: ${getCorrectAnswerText(prepared || src)}</div>
          <div style="color:var(--muted);margin-top:0.25rem">${src.explain}</div>
        `;
        wrongList.appendChild(li);
      });
    } else {
      wrongReview.classList.add("hidden");
    }

    track("quiz_finish", {
      mode: state.mode,
      rank: state.rankLevel,
      category: state.category,
      score: pct,
      passed,
      questions: total,
      label: state.rankConfig?.title || state.category || state.mode,
    });

    showScreen("results");
  }

  function init() {
    initScreens();
    updateHomeStats();
    buildCategoryChips();

    const modeGrid = document.querySelector(".mode-grid");
    if (modeGrid) {
      modeGrid.addEventListener("click", (e) => {
        const card = e.target.closest(".mode-card");
        if (!card || !modeGrid.contains(card)) return;
        const mode = card.dataset.mode;
        if (mode) handleModeClick(mode);
      });
    }

    $("#cancel-rank").addEventListener("click", hidePanels);

    $("#cancel-category").addEventListener("click", hidePanels);

    $("#btn-next").addEventListener("click", nextQuestion);

    $("#btn-submit-exam").addEventListener("click", () => {
      if (state.answers.length < state.questions.length) {
        const remaining = state.questions.length - state.answers.length;
        if (!confirm(`לא עניתם על ${remaining} שאלות. לסיים בכל זאת?`)) {
          return;
        }
        while (state.answers.length < state.questions.length) {
          const idx = state.answers.length;
          state.answers.push({
            questionId: state.questions[idx].id,
            selected: -1,
            correct: false,
          });
        }
      }
      finishQuiz();
    });

    $("#btn-quit").addEventListener("click", () => {
      if (confirm("לצאת מהמבחן? ההתקדמות לא תישמר.")) {
        track("quit_quiz", {
          mode: state.mode,
          rank: state.rankLevel,
          label: "יציאה ממבחן לפני סיום",
        });
        showScreen("home");
      }
    });

    $("#btn-home")?.addEventListener("click", () => showScreen("home"));

    $("#btn-retry")?.addEventListener("click", () => {
      startQuiz(state.mode, state.category, state.rankLevel);
    });
  }

  async function boot() {
    if (window.NeverlandTracking?.init) {
      await window.NeverlandTracking.init();
    }
    if (window.NeverlandAdmin?.init) {
      window.NeverlandAdmin.init();
    }
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

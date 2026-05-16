(function () {
  "use strict";

  const API_KEY_STORAGE = "neverland-police-ai-api-key";
  const CHAT_STORAGE = "neverland-police-ai-chat";
  const USE_LLM_STORAGE = "neverland-police-ai-use-llm";

  const STOP_WORDS = new Set([
    "את", "על", "של", "עם", "או", "אם", "זה", "זו", "הוא", "היא", "הם", "אני", "אתה",
    "מה", "מי", "איך", "למה", "כי", "גם", "רק", "כל", "יש", "אין", "כן", "לא", "ב", "ל",
    "מ", "ה", "ו", "the", "a", "an", "is", "are", "to", "of", "in",
  ]);

  const $ = (sel) => document.querySelector(sel);

  function getConfig() {
    const base = window.AI_CONFIG || {};
    return {
      model: base.model || "gpt-4o-mini",
      endpoint: base.endpoint || "https://api.openai.com/v1/chat/completions",
      maxContextQuestions: base.maxContextQuestions || 8,
      minScore: base.minScore ?? 2,
    };
  }

  function getApiKey() {
    return sessionStorage.getItem(API_KEY_STORAGE) || "";
  }

  function useLlmEnabled() {
    return sessionStorage.getItem(USE_LLM_STORAGE) === "1" && !!getApiKey();
  }

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    return normalize(text)
      .split(" ")
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  function getCorrectAnswer(raw) {
    if (raw.type === "truefalse") {
      return raw.correct === 0 ? "נכון" : "לא נכון";
    }
    if (raw.options && raw.options[raw.correct] != null) {
      return raw.options[raw.correct];
    }
    return "";
  }

  function questionToSearchText(q) {
    const cat = CATEGORY_LABELS[q.category] || q.category || "";
    const opts = (q.options || []).join(" ");
    return [q.q, q.explain, opts, cat].join(" ");
  }

  function scoreQuestion(q, tokens, queryNorm) {
    const hay = normalize(questionToSearchText(q));
    let score = 0;

    if (queryNorm.length > 4 && hay.includes(queryNorm)) {
      score += 12;
    }

    tokens.forEach((tok) => {
      if (hay.includes(tok)) score += 3;
    });

    const catLabel = normalize(CATEGORY_LABELS[q.category] || "");
    tokens.forEach((tok) => {
      if (catLabel.includes(tok)) score += 4;
    });

    return score;
  }

  function retrieveRelevant(query) {
    const cfg = getConfig();
    const queryNorm = normalize(query);
    const tokens = tokenize(query);
    if (!tokens.length && !queryNorm) return [];

    const scored = QUESTIONS.map((q) => ({
      q,
      score: scoreQuestion(q, tokens, queryNorm),
    }))
      .filter((x) => x.score >= cfg.minScore)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, cfg.maxContextQuestions).map((x) => x.q);
  }

  function buildContextBlock(chunks) {
    return chunks
      .map((raw, i) => {
        const cat = CATEGORY_LABELS[raw.category] || raw.category;
        return [
          `[${i + 1}] נושא: ${cat}`,
          `שאלה: ${raw.q}`,
          `תשובה נכונה: ${getCorrectAnswer(raw)}`,
          `הסבר: ${raw.explain}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  function dedupeExplains(chunks) {
    const seen = new Set();
    const out = [];
    chunks.forEach((raw) => {
      const key = normalize(raw.explain).slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(raw);
      }
    });
    return out;
  }

  function answerLocally(query, chunks) {
    if (!chunks.length) {
      return {
        text:
          "לא מצאתי במאגר שאלות התרגול מידע ישיר לנושא הזה.\n\n" +
          "נסו לנסח אחרת (למשל: סיור, מעצר, קשר, מרדף, מדים) או לבחור תרגול לפי נושא מהתפריט הראשי.",
        sources: [],
      };
    }

    const unique = dedupeExplains(chunks).slice(0, 5);
    const lines = [
      "לפי **מאגר הנהלים** של משטרת נברלנד (שאלות התרגול):",
      "",
    ];

    unique.forEach((raw, i) => {
      const cat = CATEGORY_LABELS[raw.category] || raw.category;
      lines.push(`**${i + 1}. ${cat}**`);
      lines.push(`• ${raw.explain}`);
      if (getCorrectAnswer(raw)) {
        lines.push(`• תשובה נכונה במאגר: ${getCorrectAnswer(raw)}`);
      }
      lines.push("");
    });

    lines.push(
      "_התשובה מבוססת על שאלות במאגר — לפרטים מלאים עברו על המדריך הרשמי._"
    );

    return {
      text: lines.join("\n"),
      sources: unique.map((raw) => ({
        id: raw.id,
        category: CATEGORY_LABELS[raw.category] || raw.category,
        q: raw.q,
      })),
    };
  }

  async function answerWithLlm(query, chunks) {
    const cfg = getConfig();
    const context = buildContextBlock(chunks);

    const system = [
      "אתה יועץ נהלים למשטרת נברלנד (FiveM RP).",
      "ענה רק על סמך קטעי המאגר שמופיעים בהודעת המשתמש.",
      "אם המידע לא מופיע במאגר — אמור במפורש שאין מידע במאגר ואל תמציא נהלים.",
      "ענה בעברית, ברור ומקצועי, בנקודות קצרות כשמתאים.",
      "אל תציין מספרי סעיפים שלא קיימים בקטעים.",
    ].join(" ");

    const userContent =
      `שאלת השוטר:\n${query}\n\n` +
      `--- קטעים מהמאגר (${chunks.length} פריטים) ---\n${context}`;

    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getApiKey(),
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.25,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "שגיאת API (" + res.status + ")");
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("תשובה ריקה מהמודל");

    return {
      text,
      sources: chunks.map((raw) => ({
        id: raw.id,
        category: CATEGORY_LABELS[raw.category] || raw.category,
        q: raw.q,
      })),
    };
  }

  function renderMarkdownLite(text) {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  function loadChat() {
    try {
      return JSON.parse(sessionStorage.getItem(CHAT_STORAGE) || "[]");
    } catch {
      return [];
    }
  }

  function saveChat(messages) {
    const trimmed = messages.slice(-40);
    sessionStorage.setItem(CHAT_STORAGE, JSON.stringify(trimmed));
  }

  function renderMessages(messages) {
    const box = $("#ai-messages");
    box.innerHTML = "";
    messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "ai-msg ai-msg-" + msg.role;
      if (msg.role === "assistant") {
        div.innerHTML =
          '<div class="ai-bubble">' + renderMarkdownLite(msg.text) + "</div>";
        if (msg.sources && msg.sources.length) {
          const src = document.createElement("div");
          src.className = "ai-sources";
          src.innerHTML =
            '<span class="ai-sources-label">מקורות במאגר:</span> ' +
            msg.sources
              .map((s) => `<span class="ai-src-chip">${escapeHtml(s.category)}</span>`)
              .join("");
          div.appendChild(src);
        }
      } else {
        div.innerHTML =
          '<div class="ai-bubble">' + escapeHtml(msg.text) + "</div>";
      }
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  let chatMessages = [];
  let busy = false;

  async function ask(question) {
    const q = (question || "").trim();
    if (!q || busy) return;

    busy = true;
    $("#ai-send").disabled = true;
    $("#ai-input").disabled = true;

    chatMessages.push({ role: "user", text: q });
    renderMessages(chatMessages);
    $("#ai-input").value = "";

    const loading = { role: "assistant", text: "מחפש במאגר הנהלים…", loading: true };
    chatMessages.push(loading);
    renderMessages(chatMessages);

    try {
      const chunks = retrieveRelevant(q);
      let result;

      if (useLlmEnabled() && chunks.length) {
        result = await answerWithLlm(q, chunks);
      } else if (useLlmEnabled() && !chunks.length) {
        result = answerLocally(q, chunks);
      } else {
        result = answerLocally(q, chunks);
      }

      chatMessages.pop();
      chatMessages.push({
        role: "assistant",
        text: result.text,
        sources: result.sources,
      });
    } catch (err) {
      chatMessages.pop();
      const fallback = answerLocally(q, retrieveRelevant(q));
      chatMessages.push({
        role: "assistant",
        text:
          "שגיאה בחיבור ל-AI: " +
          (err.message || "לא ידוע") +
          "\n\n---\n\n" +
          fallback.text,
        sources: fallback.sources,
      });
    }

    saveChat(chatMessages);
    renderMessages(chatMessages);
    busy = false;
    $("#ai-send").disabled = false;
    $("#ai-input").disabled = false;
    $("#ai-input").focus();
  }

  function updateModeBadge() {
    const badge = $("#ai-mode-badge");
    if (!badge) return;
    if (useLlmEnabled()) {
      badge.textContent = "מצב AI (OpenAI)";
      badge.className = "ai-mode-badge ai-mode-llm";
    } else {
      badge.textContent = "מצב מאגר (ללא API)";
      badge.className = "ai-mode-badge ai-mode-local";
    }
  }

  function syncSettingsUi() {
    const keyInput = $("#ai-api-key");
    const useLlm = $("#ai-use-llm");
    if (keyInput) keyInput.value = getApiKey();
    if (useLlm) useLlm.checked = sessionStorage.getItem(USE_LLM_STORAGE) === "1";
    updateModeBadge();
  }

  let assistantReady = false;

  function initAssistant() {
    if (assistantReady) return;
    const form = $("#ai-form");
    if (!form) return;
    assistantReady = true;

    chatMessages = loadChat();
    if (!chatMessages.length) {
      chatMessages.push({
        role: "assistant",
        text:
          "שלום! אני **יועץ הנהלים** של משטרת נברלנד.\n\n" +
          "שאלו אותי על נהלים, סיור, מעצרים, קשר, מרדפים ועוד — אחפש תשובות **במאגר השאלות** של האתר.\n\n" +
          "אפשר להפעיל גם **OpenAI** בהגדרות (מפתח אישי, נשמר רק בדפדפן שלכם).",
        sources: [],
      });
    }
    renderMessages(chatMessages);
    syncSettingsUi();

    $("#ai-form").addEventListener("submit", (e) => {
      e.preventDefault();
      ask($("#ai-input").value);
    });

    $("#ai-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ask($("#ai-input").value);
      }
    });

    document.querySelectorAll(".ai-suggest-chip").forEach((chip) => {
      chip.addEventListener("click", () => ask(chip.dataset.q));
    });

    $("#btn-ai-settings").addEventListener("click", () => {
      $("#ai-settings-panel").classList.toggle("hidden");
    });

    $("#btn-ai-save-settings").addEventListener("click", () => {
      const key = ($("#ai-api-key").value || "").trim();
      const useLlm = $("#ai-use-llm").checked;
      if (useLlm && !key) {
        alert("להפעלת AI חיצוני יש להזין מפתח OpenAI API.");
        return;
      }
      if (key) sessionStorage.setItem(API_KEY_STORAGE, key);
      else sessionStorage.removeItem(API_KEY_STORAGE);
      sessionStorage.setItem(USE_LLM_STORAGE, useLlm ? "1" : "0");
      $("#ai-settings-panel").classList.add("hidden");
      syncSettingsUi();
    });

    $("#btn-ai-clear-chat").addEventListener("click", () => {
      if (!confirm("למחוק את היסטוריית השיחה?")) return;
      sessionStorage.removeItem(CHAT_STORAGE);
      chatMessages = [
        {
          role: "assistant",
          text:
            "השיחה נמחקה. שאלו שוב על נהלים, סיור, מעצרים או כל נושא מהמאגר.",
          sources: [],
        },
      ];
      saveChat(chatMessages);
      renderMessages(chatMessages);
    });
  }

  window.NeverlandAI = { init: initAssistant, ask };
})();

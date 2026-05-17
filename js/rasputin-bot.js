(function () {
  "use strict";

  const HISTORY_KEY = "np_rasputin_chat_history";
  const LAST_PROC_KEY = "np_rasputin_last_proc";
  const AVATAR_SRC = "assets/rasputin.png";
  const MAX_TURNS = 14;

  const SUGGESTIONS = [
    "מה עושים במרדף?",
    "מתי מותר לירות?",
    "קודי רדיו 10-78 ו-10-80",
    "איך מתעדים אינסידנט?",
    "מתי מקריאים מירנדה?",
  ];

  let isLoading = false;
  let lastProcedureId = sessionStorage.getItem(LAST_PROC_KEY) || "";

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function canUseAiApi() {
    if ((cfg().apiBase || "").trim()) return true;
    const host = window.location.hostname;
    return host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1";
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(-MAX_TURNS) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_TURNS)));
    } catch {
      /* ignore */
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBotText(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function setLoading(on) {
    isLoading = on;
    const input = document.getElementById("rasputin-input");
    const send = document.querySelector(".rasputin-send");
    const fab = document.getElementById("rasputin-fab");

    if (input) input.disabled = on;
    if (send) send.disabled = on;
    if (fab) fab.classList.toggle("rasputin-fab-loading", on);
  }

  function buildKnowledgeContext(question) {
    const KB = window.PoliceKnowledge;
    if (!KB?.getContextForQuery) return "";

    const hit = KB.search(question, { lastProcedureId });
    if (hit.type === "hit" && hit.procedure?.id) {
      lastProcedureId = hit.procedure.id;
      sessionStorage.setItem(LAST_PROC_KEY, lastProcedureId);
    }

    return KB.getContextForQuery(question, { lastProcedureId });
  }

  async function askAi(question, history) {
    const context = buildKnowledgeContext(question);

    const res = await fetch(apiUrl("/api/rasputin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history, context }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || "שגיאת שרת (" + res.status + ")";
      const extra = data.detail ? "\n(" + data.detail + ")" : "";
      throw new Error(msg + extra);
    }
    return data.reply || "";
  }

  function askLocal(question) {
    const KB = window.PoliceKnowledge;
    if (!KB) return "מאגר הנהלים לא נטען. רעננו את הדף.";

    const result = KB.search(question, { lastProcedureId });
    if (result.type === "hit" && result.procedure?.id) {
      lastProcedureId = result.procedure.id;
      sessionStorage.setItem(LAST_PROC_KEY, lastProcedureId);
    }
    return KB.formatAnswer(result);
  }

  async function getReply(question, priorHistory) {
    if (canUseAiApi()) {
      try {
        return await askAi(question, priorHistory || []);
      } catch (err) {
        console.warn("Rasputin AI:", err.message);
        if (window.PoliceKnowledge) {
          return (
            askLocal(question) +
            "\n\n(מצב גיבוי — תשובה ממאגר מקומי. ודאו OPENAI_API_KEY ב-Vercel.)"
          );
        }
        throw err;
      }
    }
    return askLocal(question);
  }

  function appendMessage(role, text) {
    const log = document.getElementById("rasputin-messages");
    if (!log) return;

    const row = document.createElement("div");
    row.className = "rasputin-msg rasputin-msg-" + role;

    if (role === "bot") {
      const img = document.createElement("img");
      img.className = "rasputin-msg-avatar";
      img.src = AVATAR_SRC;
      img.alt = "";
      img.width = 28;
      img.height = 28;
      img.onerror = function () {
        this.classList.add("avatar-fallback");
        this.removeAttribute("src");
      };

      const bubble = document.createElement("div");
      bubble.className = "rasputin-msg-bubble";
      bubble.innerHTML = formatBotText(text);

      row.appendChild(img);
      row.appendChild(bubble);
    } else {
      const bubble = document.createElement("div");
      bubble.className = "rasputin-msg-bubble rasputin-msg-user";
      bubble.textContent = text;
      row.appendChild(bubble);
    }

    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    const log = document.getElementById("rasputin-messages");
    if (!log) return;

    const el = document.createElement("div");
    el.className = "rasputin-msg rasputin-msg-bot rasputin-typing";
    el.id = "rasputin-typing";

    const img = document.createElement("img");
    img.className = "rasputin-msg-avatar";
    img.src = AVATAR_SRC;
    img.alt = "";
    img.width = 28;
    img.height = 28;
    img.onerror = function () {
      this.classList.add("avatar-fallback");
      this.removeAttribute("src");
    };

    const bubble = document.createElement("div");
    bubble.className = "rasputin-msg-bubble";
    bubble.innerHTML =
      '<span class="rasputin-dots"><span></span><span></span><span></span></span>' +
      '<span class="rasputin-thinking">רספוטין חושב...</span>';

    el.appendChild(img);
    el.appendChild(bubble);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function hideTyping() {
    document.getElementById("rasputin-typing")?.remove();
  }

  async function handleSend() {
    if (isLoading) return;

    const input = document.getElementById("rasputin-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    input.value = "";
    appendMessage("user", text);

    const priorHistory = loadHistory();

    setLoading(true);
    showTyping();

    try {
      const reply = await getReply(text, priorHistory);
      hideTyping();
      appendMessage("bot", reply);

      saveHistory([
        ...priorHistory,
        { role: "user", content: text },
        { role: "assistant", content: reply },
      ]);
    } catch (err) {
      hideTyping();
      appendMessage("bot", err.message || "שגיאה. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  function togglePanel(open) {
    const panel = document.getElementById("rasputin-panel");
    const fab = document.getElementById("rasputin-fab");
    if (!panel || !fab) return;

    const shouldOpen = open ?? panel.classList.contains("hidden");
    if (shouldOpen) {
      panel.classList.remove("hidden");
      fab.setAttribute("aria-expanded", "true");
      document.getElementById("rasputin-input")?.focus();
    } else {
      panel.classList.add("hidden");
      fab.setAttribute("aria-expanded", "false");
    }
  }

  function renderSuggestions() {
    const wrap = document.getElementById("rasputin-suggestions");
    if (!wrap) return;

    wrap.innerHTML = "";
    SUGGESTIONS.forEach((q) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rasputin-chip";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        const input = document.getElementById("rasputin-input");
        if (input) input.value = q;
        handleSend();
      });
      wrap.appendChild(btn);
    });
  }

  function welcomeMessage() {
    if (canUseAiApi()) {
      return (
        "שלום, אני רספוטין — עוזר ה-AI של משטרת נברלנד.\n" +
        "שאלו אותי על נהלים, מרדפים, מעצרים, רדיו, דיספאץ' ותיעוד.\n" +
        "אני זוכר את השיחה שלנו במהלך הסשן."
      );
    }
    return (
      "שלום, אני רספוטין.\n" +
      "כרגע במצב מקומי (ללא API). פרסמו ב-Vercel עם OPENAI_API_KEY לעוזר AI מלא."
    );
  }

  function bind() {
    document.getElementById("rasputin-fab")?.addEventListener("click", () => {
      const panel = document.getElementById("rasputin-panel");
      togglePanel(panel?.classList.contains("hidden"));
    });

    document.getElementById("rasputin-close")?.addEventListener("click", () => togglePanel(false));

    document.getElementById("rasputin-clear-chat")?.addEventListener("click", () => {
      if (!confirm("למחוק את היסטוריית השיחה?")) return;
      sessionStorage.removeItem(HISTORY_KEY);
      sessionStorage.removeItem(LAST_PROC_KEY);
      lastProcedureId = "";
      const log = document.getElementById("rasputin-messages");
      if (log) log.innerHTML = "";
      appendMessage("bot", welcomeMessage());
    });

    document.getElementById("rasputin-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSend();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") togglePanel(false);
    });
  }

  function init() {
    if (!document.getElementById("rasputin-panel")) return;

    renderSuggestions();
    bind();

    const history = loadHistory();
    if (history.length === 0) {
      appendMessage("bot", welcomeMessage());
    } else {
      history.forEach((m) => {
        appendMessage(m.role === "user" ? "user" : "bot", m.content);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.RasputinBot = {
    getReply,
    togglePanel,
    clearHistory: () => sessionStorage.removeItem(HISTORY_KEY),
  };
})();

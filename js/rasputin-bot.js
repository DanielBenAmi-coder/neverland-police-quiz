(function () {
  "use strict";

  const STORAGE_KEY = "np_rasputin_last_proc";
  const AVATAR_SRC = "assets/rasputin.png";

  const SUGGESTIONS = [
    "מה עושים במרדף?",
    "מתי מותר לירות?",
    "קודי רדיו 10-78 ו-10-80",
    "איך מתעדים אינסידנט?",
    "מתי מקריאים מירנדה?",
  ];

  let lastProcedureId = sessionStorage.getItem(STORAGE_KEY) || "";

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

  function setLastProcedure(id) {
    lastProcedureId = id || "";
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  }

  function ask(question) {
    const KB = window.PoliceKnowledge;
    if (!KB) {
      return "מאגר הנהלים לא נטען. רעננו את הדף.";
    }

    const result = KB.search(question, { lastProcedureId });
    if (result.type === "hit" && result.procedure?.id) {
      setLastProcedure(result.procedure.id);
    }

    return KB.formatAnswer(result);
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
    img.className = "rasputin-msg-avatar avatar-fallback";
    img.alt = "";
    img.width = 28;
    img.height = 28;

    const bubble = document.createElement("div");
    bubble.className = "rasputin-msg-bubble";
    bubble.innerHTML = "<span></span><span></span><span></span>";

    el.appendChild(img);
    el.appendChild(bubble);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function hideTyping() {
    document.getElementById("rasputin-typing")?.remove();
  }

  function handleSend() {
    const input = document.getElementById("rasputin-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    input.value = "";
    appendMessage("user", text);

    showTyping();
    const delay = 280 + Math.min(text.length * 8, 400);

    setTimeout(() => {
      hideTyping();
      appendMessage("bot", ask(text));
    }, delay);
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
    return (
      "שלום, אני רספוטין — עוזר הנהלים של משטרת נברלנד.\n" +
      "שאלו אותי על מרדפים, מעצרים, רדיו, שימוש בכוח, תיעוד ועוד.\n" +
      "אני עונה רק לפי מאגר הנהלים באתר."
    );
  }

  function bind() {
    document.getElementById("rasputin-fab")?.addEventListener("click", () => {
      const panel = document.getElementById("rasputin-panel");
      togglePanel(panel?.classList.contains("hidden"));
    });

    document.getElementById("rasputin-close")?.addEventListener("click", () => togglePanel(false));

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
    appendMessage("bot", welcomeMessage());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.RasputinBot = { ask, togglePanel };
})();

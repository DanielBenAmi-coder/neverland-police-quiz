(function () {
  "use strict";

  const HISTORY_KEY = "np_rasputin_chat_history";
  const LAST_PROC_KEY = "np_rasputin_last_proc";
  const AVATAR_SRC = "assets/rasputin.png";
  const MAX_TURNS = 14;

  const SUGGESTIONS = [
    "נשארתי לבד בניידת — מה עושים?",
    "איך מבקשים תגבורת (10-78)?",
    "רכב לא עוצר בעצירה",
    "ירי לעברי — מה עושים?",
    "אני ראשון בזירה",
  ];

  let isLoading = false;
  let aiStatus = { online: false, mode: "unknown", message: "" };
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

  function setStatusBanner() {
    const el = document.getElementById("rasputin-status");
    if (!el) return;

    if (aiStatus.online) {
      el.className = "rasputin-status rasputin-status-ok hidden";
      el.textContent = "";
      return;
    }

    el.className = "rasputin-status rasputin-status-warn";
    el.textContent =
      aiStatus.message ||
      "מצב מאגר מקומי. להפעלת AI: הוסיפו GEMINI_API_KEY ב-Vercel.";
  }

  async function checkAiStatus() {
    if (!canUseAiApi()) {
      aiStatus = { online: false, mode: "local", message: "מצב מאגר מקומי (ללא API)." };
      setStatusBanner();
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/rasputin"));
      const data = await res.json().catch(() => ({}));

      if (data.hasGeminiKey) {
        aiStatus = { online: true, mode: "ai", message: "" };
      } else {
        aiStatus = {
          online: false,
          mode: "local",
          message: "הוסיפו GEMINI_API_KEY ב-Vercel (Google AI Studio).",
        };
      }
    } catch {
      aiStatus = { online: false, mode: "local", message: "לא ניתן לבדוק שרת — מצב מאגר מקומי." };
    }

    setStatusBanner();
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

  function buildIntentBrief(question) {
    const PI = window.PoliceIntents;
    const KB = window.PoliceKnowledge;
    const intent = PI?.detectIntent?.(question) || KB?.detectIntent?.(question);
    if (!intent || !PI?.formatOperationalBrief) return { intent: null, brief: "" };
    return {
      intent,
      brief: PI.formatOperationalBrief(intent),
    };
  }

  function buildKnowledgeContext(question) {
    const KB = window.PoliceKnowledge;
    if (!KB?.getContextForQuery) return "";

    const hit = KB.search(question, { lastProcedureId }, { minScore: 3 });
    if (hit.type === "hit" && hit.procedure?.id) {
      lastProcedureId = hit.procedure.id;
      sessionStorage.setItem(LAST_PROC_KEY, lastProcedureId);
    }

    return KB.getContextForQuery(question, { lastProcedureId });
  }

  function askLocal(question) {
    const KB = window.PoliceKnowledge;
    if (!KB) return "מאגר הנהלים לא נטען. רעננו את הדף.";
    if (KB.getSmartReply) return KB.getSmartReply(question, { lastProcedureId });

    const result = KB.search(question, { lastProcedureId });
    if (result.type === "hit" && result.procedure?.id) {
      lastProcedureId = result.procedure.id;
      sessionStorage.setItem(LAST_PROC_KEY, lastProcedureId);
    }
    return KB.formatAnswer(result);
  }

  async function askAi(question, history) {
    const context = buildKnowledgeContext(question);
    const { intent, brief: intentBrief } = buildIntentBrief(question);

    const res = await fetch(apiUrl("/api/rasputin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        history,
        context,
        intentBrief,
        intentId: intent?.id || "",
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.useLocal || data.code === "QUOTA") {
        aiStatus = { online: false, mode: "local", message: data.error || aiStatus.message };
        setStatusBanner();
        return askLocal(question);
      }
      throw new Error(data.error || "שגיאת שרת (" + res.status + ")");
    }

    aiStatus = { online: true, mode: "ai", message: "" };
    setStatusBanner();
    return data.reply || "";
  }

  async function getReply(question, priorHistory) {
    if (!canUseAiApi()) return askLocal(question);

    try {
      return await askAi(question, priorHistory || []);
    } catch (err) {
      console.warn("Rasputin AI:", err.message);
      return askLocal(question);
    }
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
      checkAiStatus();
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
      "שלום, אני רספוטין — עוזר מבצעי ונהלים של משטרת נברלנד.\n" +
      "שאלו במילים שלכם: \"נשארתי לבד בניידת\", \"אין גיבוי\", מרדף, עצירה, ירי.\n" +
      "אענה כמו דיספאטש — קצר, מעשי, עם דגש על בטיחות."
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
    checkAiStatus();

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

  window.RasputinBot = { getReply, togglePanel, checkAiStatus };
})();

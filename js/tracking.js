(function () {
  "use strict";

  const NAME_KEY = "np_officer_name";
  const SESSION_KEY = "np_session_id";
  const LOCAL_LOGS_KEY = "np_local_activity_logs";

  let readyResolve;
  const readyPromise = new Promise((r) => {
    readyResolve = r;
  });

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  function apiUrl(path) {
    const base = (cfg().apiBase || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function getName() {
    return sessionStorage.getItem(NAME_KEY) || "";
  }

  function setName(name) {
    sessionStorage.setItem(NAME_KEY, name);
    updateNameBadge();
  }

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function saveLocalLog(entry) {
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || "[]");
      list.unshift(entry);
      if (list.length > 500) list.length = 500;
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function getLocalLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function updateNameBadge() {
    const el = document.getElementById("officer-name-badge");
    if (!el) return;
    const name = getName();
    if (name) {
      el.textContent = `שוטר/ת: ${name}`;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  function showNameModal() {
    const modal = document.getElementById("name-gate-modal");
    const input = document.getElementById("name-gate-input");
    if (!modal || !input) return;
    modal.classList.remove("hidden");
    input.value = getName();
    input.focus();
    document.body.classList.add("gate-open");
  }

  function hideNameModal() {
    const modal = document.getElementById("name-gate-modal");
    if (modal) modal.classList.add("hidden");
    document.body.classList.remove("gate-open");
  }

  function validateName(raw) {
    const name = String(raw || "")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 32) return null;
    if (!/^[\p{L}\p{N}\s.'-]+$/u.test(name)) return null;
    return name;
  }

  async function sendLog(event, data) {
    const name = getName();
    if (!name) return;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ts: new Date().toISOString(),
      name,
      event,
      session: getSessionId(),
      mode: data?.mode ?? null,
      rank: data?.rank ?? null,
      category: data?.category ?? null,
      score: data?.score ?? null,
      passed: data?.passed ?? null,
      questions: data?.questions ?? null,
      label: data?.label ?? null,
    };

    saveLocalLog(entry);

    if (window.NeverlandLogs?.push) {
      await window.NeverlandLogs.push(entry);
    }

    return entry;
  }

  async function ensureName() {
    if (!cfg().requireName) {
      readyResolve();
      return;
    }

    const existing = getName();
    if (existing) {
      updateNameBadge();
      await sendLog("visit", { label: "חזרה לאתר" });
      readyResolve();
      return;
    }

    showNameModal();
  }

  function bindNameForm() {
    const form = document.getElementById("name-gate-form");
    const input = document.getElementById("name-gate-input");
    const err = document.getElementById("name-gate-error");
    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = validateName(input.value);
      if (!name) {
        if (err) {
          err.textContent = "הזינו שם תקין (2–32 תווים, עברית או אנגלית)";
          err.classList.remove("hidden");
        }
        return;
      }
      if (err) err.classList.add("hidden");
      setName(name);
      hideNameModal();
      await sendLog("login", { label: "כניסה לאתר" });
      readyResolve();
    });

    const changeBtn = document.getElementById("btn-change-name");
    if (changeBtn) {
      changeBtn.addEventListener("click", () => {
        showNameModal();
      });
    }
  }

  async function init() {
    bindNameForm();
    updateNameBadge();
    await ensureName();
  }

  window.NeverlandTracking = {
    ready: readyPromise,
    init,
    getName,
    setName,
    log: sendLog,
    getLocalLogs,
    validateName,
    showNameModal,
  };
})();

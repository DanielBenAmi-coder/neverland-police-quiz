(function () {
  "use strict";

  const STORAGE_KEY = "np_upgrade_toast_v2";

  function init() {
    const toast = document.getElementById("upgrade-toast");
    const closeBtn = document.getElementById("upgrade-toast-close");
    if (!toast) return;

    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    toast.classList.remove("hidden");
    requestAnimationFrame(() => toast.classList.add("upgrade-toast-visible"));

    function dismiss() {
      toast.classList.remove("upgrade-toast-visible");
      setTimeout(() => toast.classList.add("hidden"), 280);
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }

    closeBtn?.addEventListener("click", dismiss);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

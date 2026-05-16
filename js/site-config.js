/**
 * אחרי פריסה ב-Vercel — עדכנו את apiBase לכתובת הפרויקט שלכם.
 * לדוגמה: https://neverland-police-quiz.vercel.app
 */
(function () {
  const host = window.location.hostname;
  let apiBase = "";

  if (host === "danielbenami-coder.github.io") {
    apiBase = "https://neverland-police-quiz.vercel.app";
  } else if (host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1") {
    apiBase = "";
  }

  window.SITE_CONFIG = {
    apiBase,
    requireName: true,
  };
})();

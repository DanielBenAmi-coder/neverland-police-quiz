/**
 * adminCode — קוד כניסת מנהל (עובד גם בלי שרת).
 * apiBase — כתובת Vercel אחרי שמחברים את הריפו (ללוגים משותפים לכולם).
 */
(function () {
  const host = window.location.hostname;
  let apiBase = "";

  if (host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1") {
    apiBase = "";
  }

  window.SITE_CONFIG = {
    adminCode: "Rasputin",
    apiBase,
    requireName: true,
  };
})();

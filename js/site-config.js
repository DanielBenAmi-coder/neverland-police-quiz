/**
 * לוגים משותפים לכל השוטרים — הגדירו Supabase (חינם, 5 דקות):
 * 1. supabase.com → New project
 * 2. SQL Editor → הריצו את supabase/schema.sql
 * 3. Settings → API → העתיקו URL + anon key לכאן
 *
 * או: הוסיפו ב-GitHub Secrets את SUPABASE_URL ו-SUPABASE_ANON_KEY
 */
(function () {
  const VERCEL_API = "https://neverland-police-quiz.vercel.app";
  const host = window.location.hostname;
  let apiBase = "";

  if (host.includes("github.io")) {
    apiBase = VERCEL_API;
  } else if (host.includes("vercel.app") || host === "localhost" || host === "127.0.0.1") {
    apiBase = "";
  }

  window.SITE_CONFIG = {
    adminCode: "Rasputin",
    supabaseUrl: "",
    supabaseAnonKey: "",
    apiBase,
    requireName: true,
  };
})();

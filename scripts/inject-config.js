/**
 * GitHub Actions: מזריק מפתחות Supabase ל-site-config.js
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY
 */
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "https://mwgsoeylmecrsdvzfxtw.supabase.co";
const key = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Z3NvZXlsbWVjcnNkdnpmeHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDM2MjEsImV4cCI6MjA5NDU3OTYyMX0.6ZGK2x4v2viZfd_TwYWCTWioGrreY5o0Tw-QZzCaSu0";
if (!url || !key) {
  console.log("No Supabase secrets — skip inject");
  process.exit(0);
}

const file = path.join(__dirname, "..", "js", "site-config.js");
let src = fs.readFileSync(file, "utf8");

src = src.replace(/supabaseUrl:\s*""/, `supabaseUrl: "${url}"`);
src = src.replace(/supabaseAnonKey:\s*""/, `supabaseAnonKey: "${key}"`);

fs.writeFileSync(file, src, "utf8");
console.log("Injected Supabase config into site-config.js");

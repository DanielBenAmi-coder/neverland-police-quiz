/** Discord webhooks — URLs רק ב-env (לא בקוד ציבורי) */

const CATEGORY_META = {
  practice: {
    envKey: "DISCORD_WEBHOOK_PRACTICE",
    color: 0x3b82f6,
    emoji: "📖",
    title: "תרגול",
  },
  exam: {
    envKey: "DISCORD_WEBHOOK_EXAM",
    color: 0xeab308,
    emoji: "📝",
    title: "מבחן דמוי",
  },
  category: {
    envKey: "DISCORD_WEBHOOK_CATEGORY",
    color: 0x22c55e,
    emoji: "📂",
    title: "תרגול לפי נושא",
  },
  rasputin: {
    envKey: "DISCORD_WEBHOOK_AI",
    color: 0xa855f7,
    emoji: "🤖",
    title: "רספוטין — AI",
  },
};

function getWebhookUrl(category) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  return process.env[meta.envKey] || null;
}

function configuredCategories() {
  return Object.keys(CATEGORY_META).filter((k) => Boolean(getWebhookUrl(k)));
}

function formatHeTime(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    });
  } catch {
    return new Date().toISOString();
  }
}

function clip(text, max) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function rankTitle(rankLevel, rankLabel) {
  if (rankLabel) return rankLabel;
  if (!rankLevel) return "—";
  const map = {
    "cadet-officer": "קדט → Officer",
    "officer-senior": "Officer → Senior",
  };
  return map[rankLevel] || rankLevel;
}

const EVENT_TITLES = {
  quiz_start: "התחלה",
  quiz_finish: "סיום",
  quit_quiz: "יציאה מוקדמת",
  login: "כניסה לאתר",
  visit: "ביקור",
  mode_open: "פתיחת מצב",
  rasputin_question: "שאלה ל-AI",
};

function buildQuizPayload(category, data) {
  const meta = CATEGORY_META[category];
  const event = data.event || "activity";
  const eventTitle = EVENT_TITLES[event] || event;
  const name = clip(data.name, 32) || "לא ידוע";
  const label = clip(data.label, 80);
  const rankLbl = rankTitle(data.rank, data.rankLabel);

  const fields = [
    { name: "👮 שוטר/ת", value: name, inline: true },
    { name: "🕐 זמן", value: formatHeTime(data.ts), inline: true },
    { name: "📌 אירוע", value: eventTitle, inline: true },
  ];

  if (rankLbl && rankLbl !== "—") {
    fields.push({ name: "🎖️ מסלול", value: rankLbl, inline: true });
  }
  if (data.categoryLabel) {
    fields.push({ name: "📂 נושא", value: clip(data.categoryLabel, 64), inline: true });
  }
  if (label) {
    fields.push({ name: "ℹ️ פרטים", value: label, inline: false });
  }

  if (event === "quiz_finish") {
    const passed = data.passed === true;
    fields.push({
      name: "📊 ציון",
      value: data.score != null ? `${data.score}%` : "—",
      inline: true,
    });
    fields.push({
      name: "✅ תוצאה",
      value: passed ? "**עבר/ה** ✓" : "**לא עבר/ה** ✗",
      inline: true,
    });
    if (data.questions) {
      fields.push({
        name: "❓ שאלות",
        value: String(data.questions),
        inline: true,
      });
    }
  }

  if (event === "quit_quiz") {
    fields.push({
      name: "⚠️ הערה",
      value: "יצא/ה לפני סיום המבחן/תרגול",
      inline: false,
    });
  }

  let titlePrefix = meta.emoji + " " + meta.title;
  if (event === "quiz_finish") {
    titlePrefix += " · " + eventTitle;
    if (data.score != null) titlePrefix += ` · ${data.score}%`;
  } else {
    titlePrefix += " · " + eventTitle;
  }

  return {
    username: "Neverland Police Quiz",
    embeds: [
      {
        title: titlePrefix,
        color: meta.color,
        fields,
        footer: { text: "משטרת נברלנד · מערכת תרגול" },
        timestamp: data.ts || new Date().toISOString(),
      },
    ],
  };
}

function buildRasputinPayload(data) {
  const meta = CATEGORY_META.rasputin;
  const name = clip(data.name, 32) || "אנונימי";
  const question = clip(data.question, 900);
  const answer = clip(data.answer, 900);
  const source = data.aiMode === "ai" ? "Gemini AI" : "מאגר מקומי";

  return {
    username: "רספוטין · Neverland PD",
    embeds: [
      {
        title: meta.emoji + " שאלה חדשה לרספוטין",
        color: meta.color,
        fields: [
          { name: "👮 שוטר/ת", value: name, inline: true },
          { name: "🕐 זמן", value: formatHeTime(data.ts), inline: true },
          { name: "🔌 מקור תשובה", value: source, inline: true },
          { name: "❓ שאלה", value: question || "—", inline: false },
          { name: "💬 תשובה (תקציר)", value: answer || "—", inline: false },
        ],
        footer: { text: "Neverland Police · עוזר נהלים" },
        timestamp: data.ts || new Date().toISOString(),
      },
    ],
  };
}

async function postWebhook(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord ${res.status}: ${text.slice(0, 120)}`);
  }
  return true;
}

/**
 * @param {"practice"|"exam"|"category"|"rasputin"} category
 * @param {object} data
 */
async function sendDiscordLog(category, data) {
  const url = getWebhookUrl(category);
  if (!url) {
    return { ok: false, skipped: true, reason: "webhook_not_configured" };
  }

  let payload;
  if (category === "rasputin") {
    payload = buildRasputinPayload(data);
  } else {
    payload = buildQuizPayload(category, data);
  }

  await postWebhook(url, payload);
  return { ok: true };
}

module.exports = {
  sendDiscordLog,
  getWebhookUrl,
  configuredCategories,
  CATEGORY_META,
};

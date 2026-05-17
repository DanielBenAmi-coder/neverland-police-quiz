const { handleOptions, jsonResponse } = require("./_lib/cors");

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_HISTORY = 20;
const MAX_MSG_LEN = 600;
const MAX_CONTEXT_LEN = 5500;

const SYSTEM_PROMPT = `אתה רספוטין — עוזר מבצעי ומדריך נהלים של משטרת נברלנד (Neverland Police Department).
תפקידך: לענות כמו מפקד משמרת / דיספאטשר מנוסה — מעשי, קצר, מקצועי, בעברית.

=== עדיפויות (בסדר הזה) ===
1. בטיחות השוטר — תמיד ראשון.
2. שיפוט מבצעי ריאלי — לא טקסט כללי שלא קשור לשאלה.
3. תקשורת בקשר (זיהוי, מיקום, בקשה).
4. שליטה בהסלמה — החוק הראשון: "אין להסלים אירועים".
5. נהלים מהמאגר — אל תמציא חוקים.

=== כלל זהב: הבנת כוונה ===
לפני שאתה עונה, זהה מה השוטר באמת שואל:
• "נשארתי לבד בניידת" = סיכון ללא גיבוי — לא כניסה למשמרת / ON DUTY.
• "אין לי גיבוי" = 10-78, מיקום, המתנה לכוחות.
• "ראשון בזירה" = דיווח, היקף, לא להיכנס לבד לאיום.
• "רכב לא עוצר" = עצירת תנועה — טייזר אם יוצא בניגוד לכריזה; לא ירי על רכב במרדף.
• "שולף נשק" = מחסה, מרחק, תגבורת; ירי רק בסכנה ממשית לחיים.
• "ירי לעברי" = מחסה, דיווח יריות, 10-78.
• "לבד במעצר" = לא לבד — תגבורת לפני מעצר מסוכן.

אם סופק "ניתוח מבצעי" או כוונה מזוהה בהקשר — בנה את התשובה עליו, לא על נוהל אחר.

=== כשאין נוהל מדויק ===
אל תחזיר נוהל לא קשור (למשל כניסה למשמרת כששואלים על לבד בניידת).
תן הנחיה בטוחה: תגבורת, מרחק, דיווח, ללא הסלמה, המתנה לגיבוי.

=== פורמט תשובה ===
2–5 משפטים או עד 4 נקודות קצרות. עברית ברורה. בלי הקדמות ארוכות.

=== סלנג וניסוחים (להבין כולם) ===
"לבד בניידת", "נשארתי לבד", "בלי שותף", "אין גיבוי", "צריך גיבוי" → תגבורת ובטיחות.
"תגבור", "10-78", "גיבוי" → דיווח מסודר בקשר.
"סטופ", "עצירה", "לא עוצר" → עצירת תנועה / קוד 5 אם מבוקש.
"ירו עלי", "ירי לעברי" → ירי לעבר שוטר.
"במרדף", "10-80", "רכב בורח" → מרדף פעיל.
"פאניק", "נחטפתי" → חטיפה / PANIC (רק חירום אמיתי).

=== דוגמאות שאלה → תשובה (לחקות סגנון) ===

ש: "מה אני עושה אם אני נשאר בניידת לבד?"
ת: "אל תמשיכו לבד בסיכון. דווחו מיד: שם+תג, מיקום, 'מבקש תגבורת' (10-78). שמרו מרחק ומחסה, אל תסלימו. סיור — אסור לבד ללא אישור פיקוד; אם אתם בנהג ושולטים — אפשר להישאר ברכב נעול. אל תיכנסו למעצר/חיפוש מסוכן עד שמגיע גיבוי."

ש: "אני לבד בניידת"
ת: "10-78 עכשיו עם מיקום וסיבה. עדכנו דיספאטש, אל תתקרבו לבד לאיום. אם חייבים — תעדו ב-MDT."

ש: "אין לי גיבוי"
ת: "בקשר: '[שם] תג [מספר], [מיקום], [מה קורה], מבקש תגבורת'. הישארו בקשר, מיקום בטוח, לא הסלמה."

ש: "איך אני מבקש תגבור?"
ת: "זיהוי → מיקום → תיאור קצר → 'מבקש תגבורת' / 10-78. דוגמה: 'גד כהן תג 204, באזור X, חשוד חמוש, מבקש תגבורת'."

ש: "אם רכב לא עוצר"
ת: "עצירה שגרתית: כריזה להישאר ברכב. אם יוצא בניגוד — חשש מיידי, מותר טייזר לפי נוהל. אם הופך למרדף — 10-80, סדר מרדף, אסור לירות על הרכב או הגלגלים."

ש: "אם מישהו שולף נשק"
ת: "מחסה + מרחק. 10-31 + 10-78 + מיקום. אל תתקרבו לבד. ירי באדם רק בסכנה ממשית לחיים."

ש: "אני ראשון בזירה"
ת: "דווחו 'ראשון בזירה' + מיקום + מצב. 10-78 אם מסוכן. היקף מרחוק, המתינו לגיבוי לפני מעצר מורכב."

ש: "אם אני לבד במעצר"
ת: "אל תעצרו לבד מול סיכון. 10-78, המתינו לגיבוי. מעצר רק בחשד סביר ברור — הוראות מילוליות לפני כוח."

ש: "אם יש ירי לעברי"
ת: "מחסה מיידי. 'יריות לעבר שוטר' + מיקום + 10-78. החזרת אש רק אם סכנת חיים ממשית. אל תרדפו לבד."

=== נהלים קריטיים (Neverland Handbook) ===
• סיור בזוגות — לא לבד ללא אישור פיקוד.
• פירמידת כוח: ירוק (מילים) → כחול → כתום → אדום (נשק חם רק סכנה ממשית לחיים).
• מרדף: ראשון/שני/שלישי, מאגפים, החלפת רכב (מאגפים+תדר למעלה, מסוק מפקד).
• עדכון HANDBOOK: אסור לירות על רכב או גלגלים במרדף — גם בלי אפשרות להמשיך.
• PANIC — רק חטיפה/שבי ללא מוצא; שימוש ללא סיבה = פיטורים.
• מירנדה — רק אם יש חקירה.

אם יש "מאגר נהלים" למטה — העדף אותו. אל תסתור את ניתוח הכוונה המבצעי.`;

function sanitizeText(text, maxLen) {
  return String(text || "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-MAX_HISTORY)
    .map((m) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = sanitizeText(m.content, MAX_MSG_LEN);
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function buildSystemText(context, intentBrief) {
  let text = SYSTEM_PROMPT;

  if (intentBrief) {
    text += "\n\n--- ניתוח כוונה מהלקוח ---\n" + intentBrief;
  }

  if (context) {
    text += "\n\n--- מאגר נהלים (Neverland Police Handbook) ---\n" + context;
  }

  return text;
}

function buildGeminiContents(history, userMessage) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  return contents;
}

async function callGemini(systemText, history, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY not configured");
    err.code = "NO_KEY";
    throw err;
  }

  const url = `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemText }],
      },
      contents: buildGeminiContents(history, userMessage),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 550,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.[0]?.error?.message ||
      `Gemini API error ${res.status}`;
    const err = new Error(msg);
    err.apiStatus = res.status;
    if (/quota|resource.exhausted|billing/i.test(msg)) err.code = "QUOTA";
    throw err;
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!reply) {
    const blockReason = data?.candidates?.[0]?.finishReason;
    throw new Error(blockReason ? `Blocked: ${blockReason}` : "Empty Gemini response");
  }

  return reply;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") return handleOptions(req, res);

  if (req.method === "GET") {
    return jsonResponse(
      res,
      200,
      {
        ok: true,
        service: "rasputin",
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        model: GEMINI_MODEL,
      },
      origin
    );
  }

  if (req.method !== "POST") {
    return jsonResponse(res, 405, { error: "Method not allowed" }, origin);
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return jsonResponse(res, 400, { error: "Invalid JSON" }, origin);
  }

  const message = sanitizeText(body.message, MAX_MSG_LEN);
  if (!message) {
    return jsonResponse(res, 400, { error: "חסרה שאלה" }, origin);
  }

  const history = sanitizeHistory(body.history);
  const context = sanitizeText(body.context, MAX_CONTEXT_LEN);
  const intentBrief = sanitizeText(body.intentBrief, 1200);
  const systemText = buildSystemText(context, intentBrief);

  try {
    const reply = await callGemini(systemText, history, message);
    return jsonResponse(res, 200, { ok: true, reply }, origin);
  } catch (err) {
    console.error("Rasputin API:", err.message);

    if (err.code === "NO_KEY" || err.message.includes("GEMINI_API_KEY")) {
      return jsonResponse(
        res,
        503,
        {
          error: "מפתח Gemini לא מוגדר ב-Vercel. הוסיפו GEMINI_API_KEY ועשו Redeploy.",
          code: "NO_KEY",
        },
        origin
      );
    }

    let userMsg = "שגיאה בעיבוד התשובה. נסו שוב בעוד רגע.";
    let code = "GEMINI_ERROR";

    if (/api key|invalid|permission|401|403/i.test(err.message) || err.apiStatus === 401 || err.apiStatus === 403) {
      userMsg = "מפתח Gemini לא תקין. בדקו את GEMINI_API_KEY ב-Vercel.";
    } else if (err.code === "QUOTA" || /quota|exhausted/i.test(err.message)) {
      userMsg = "אין יתרה ב-Gemini. בדקו מכסה ב-Google AI Studio.";
      code = "QUOTA";
    }

    return jsonResponse(
      res,
      500,
      { error: userMsg, code, detail: err.message.slice(0, 200), useLocal: code === "QUOTA" },
      origin
    );
  }
};

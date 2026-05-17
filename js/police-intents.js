/**
 * זיהוי כוונות מבצעיות + ניסוחים בעברית מדוברת — רספוטין
 */
(function () {
  "use strict";

  /** נרמול שאלות: סלנג, ניסוחים שונים, טעויות נפוצות */
  const PHRASE_ALIASES = [
    ["נשארתי לבד בניידת", "לבד בניידת"],
    ["נשאר בניידת לבד", "לבד בניידת"],
    ["מה עושים אם אני לבד", "שוטר לבד"],
    ["אין לי גיבוי", "מבקש תגבורת"],
    ["אין גיבוי", "מבקש תגבורת"],
    ["צריך גיבוי", "מבקש תגבורת"],
    ["תגבור עכשיו", "מבקש תגבורת"],
    ["איך מבקשים תגבור", "מבקש תגבורת"],
    ["איך מבקש תגבור", "מבקש תגבורת"],
    ["רכב לא עוצר", "עצירת תנועה לא משתפת"],
    ["לא עוצר לי", "עצירת תנועה לא משתפת"],
    ["שולף אקדח", "חשוד חמוש"],
    ["שולף נשק", "חשוד חמוש"],
    ["ירו עלי", "ירי לעבר שוטר"],
    ["ירו עליי", "ירי לעבר שוטר"],
    ["ירי לעברי", "ירי לעבר שוטר"],
    ["אני ראשון", "ראשון בזירה"],
    ["הגעתי ראשון", "ראשון בזירה"],
    ["לבד במעצר", "מעצר לבד"],
    ["לעצור לבד", "מעצר לבד"],
    ["במרדף עכשיו", "מרדף פעיל"],
    ["רדיפה", "מרדף פעיל"],
    ["לחצן מצוקה", "פאניקה חטיפה"],
    ["פאניק", "פאניקה חטיפה"],
    ["נחטפתי", "פאניקה חטיפה"],
    ["חשוד מסוכן", "חשוד מסוכן"],
    ["פושע מסוכן", "חשוד מסוכן"],
    ["הקוף", "הקוף מעצר"],
    ["סטופ", "עצירת תנועה"],
    ["קוד 5", "עצירת תנועה סיכון"],
    ["10-78", "מבקש תגבורת"],
    ["10-80", "מרדף פעיל"],
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeQuery(raw) {
    let q = normalize(raw);
    PHRASE_ALIASES.forEach(([from, to]) => {
      if (q.includes(normalize(from))) {
        q = q.replace(normalize(from), normalize(to));
      }
    });
    return q;
  }

  /**
   * @typedef {Object} OperationalIntent
   * @property {string} id
   * @property {string} title
   * @property {number} priority
   * @property {(string|RegExp)[]} triggers
   * @property {RegExp[]} [exclude]
   * @property {RegExp[]} [requireAny]
   * @property {string} reasoning
   * @property {string[]} steps
   * @property {string} [dispatchExample]
   * @property {string[]} procedureIds
   */

  /** @type {OperationalIntent[]} */
  const OPERATIONAL_INTENTS = [
    {
      id: "officer_alone",
      title: "שוטר לבד — בטיחות, תגבורת, ללא הסלמה",
      priority: 95,
      triggers: [
        /לבד/,
        /בלי שותף/,
        /בלי מישהו/,
        /אין (לי )?מישהו/,
        /נשארתי/,
        /נשאר/,
        /נשאר בניידת/,
        /לבד בניידת/,
        /לבד בזירה/,
        /לבד בסיור/,
        /לבד בפטרול/,
      ],
      exclude: [/כניסה למשמרת/, /10-8/, /on duty/, /להתחיל משמרת/, /בדיקת ציוד/],
      requireAny: [/לבד|בלי שותף|ניידת|סיור|פטרול|זירה|מעצר|גיבוי/],
      reasoning:
        "השאלה עוסקת בסיכון שוטר ללא גיבוי בשטח — לא בנהלי כניסה למשמרת או ON DUTY.",
      steps: [
        "דווחו מיד בקשר: זיהוי + מיקום + סיבה + \"מבקש תגבורת\" (קוד 10-78).",
        "שמרו מרחק, מחסה ושליטה — אל תסלימו את האירוע.",
        "סיור: אסור לצאת לבד ללא אישור פיקוד; בניידת — נעילה רק אם אתם בנהג ושולטים.",
        "אל תיכנסו למעצר/חיפוש מסוכן לבד — המתינו לגיבוי או עדכנו 10-31.",
        "אם יש איום מיידי — פירמידת כוח, לא ירי על רכב נמלט.",
      ],
      dispatchExample:
        "\"[שם] תג [מספר], לבד ב[מיקום], [תיאור קצר], מבקש תגבורת דחופה.\"",
      procedureIds: ["patrol-pairs", "patrol-vehicle-lock", "dispatch-response", "ethics-calm"],
    },
    {
      id: "backup_needed",
      title: "בקשת תגבורת — דיספאטש ותקשורת",
      priority: 90,
      triggers: [
        /מבקש תגבורת/,
        /תגבור/,
        /גיבוי/,
        /10-78/,
        /צריך עזרה/,
        /צריך כוחות/,
      ],
      exclude: [/איך מתעדים/, /אינסידנט/],
      reasoning: "השאלה על הבאת כוחות נוספים — תקשורת ברורה ומהירה.",
      steps: [
        "בקשר: זיהוי (שם+תג) → מיקום → מה קורה → \"מבקש תגבורת\" / 10-78.",
        "הישארו בקשר, עדכנו שינויי מיקום; אל תצעקו ואל תדווחו שטויות.",
        "עד הגעת גיבוי: מיקום בטוח, לא הסלמה, תיעוד ב-MDT כשאפשר.",
      ],
      dispatchExample:
        "\"גד כהן תג 204, באזור בנק הירקון, חשוד חמוש, מבקש תגבורת.\"",
      procedureIds: ["dispatch-response", "radio-codes", "radio-discipline"],
    },
    {
      id: "first_on_scene",
      title: "ראשון בזירה — שליטה עד הגעת כוחות",
      priority: 88,
      triggers: [/ראשון בזירה/, /הגעתי ראשון/, /אני הראשון/, /ראשון באירוע/],
      reasoning: "שוטר ראשון בונה תמונת מצב ומבקש משאבים לפני פעולה מסוכנת.",
      steps: [
        "דווחו: \"ראשון בזירה\" + מיקום + תיאור קצר + האם בטוח להתקרב.",
        "10-78 אם יש סיכון; אל תיכנסו לבד לאיום לא ידוע.",
        "הקימו היקף, שמרו מרחק, זהו חשודים/נפגעים מרחוק.",
        "המתינו לגיבוי לפני מעצר מסובך; תעדו ב-MDT.",
      ],
      dispatchExample:
        "\"[שם] תג [מספר], ראשון בזירה ב[מיקום], [מצב], מבקש תגבורת.\"",
      procedureIds: ["dispatch-response", "ethics-calm", "force-pyramid"],
    },
    {
      id: "solo_arrest",
      title: "מעצר כשלבד — סיכון ותגבורת",
      priority: 92,
      triggers: [/מעצר לבד/, /לבד במעצר/, /לעצור לבד/, /מעצר בלי גיבוי/],
      reasoning: "מעצר לבד מסוכן — עדיפות לתגבורת ולכוח מינימלי.",
      steps: [
        "לפני מעצר: 10-78 אם אין גיבוי; ודאו חשד סביר ברור.",
        "הוראות מילוליות → כחול → כתום רק באיום ממשי; לא לבד מול מספר חשודים.",
        "במעצר: נשק מכוון, ידיים למעלה, גב לרכב, אזיקה, הסבר סיבה.",
        "מירנדה רק אם תחקירו; תיעוד אינסידנט מלא.",
      ],
      procedureIds: ["arrest-when", "force-pyramid", "dispatch-response", "patrol-pairs"],
    },
    {
      id: "armed_suspect",
      title: "חשוד חמוש — מרחק, מחסה, תגבורת",
      priority: 98,
      triggers: [
        /חשוד חמוש/,
        /שולף נשק/,
        /שולף אקדח/,
        /איום בנשק/,
        /נשק שלוף/,
        /מכוון אלי/,
      ],
      exclude: [/ירי על רכב/, /מרדף/],
      reasoning: "איום נשק — שמירה על חיים לפני מעצר.",
      steps: [
        "מחסה + מרחק; דווחו 10-31 + 10-78 + מיקום.",
        "אל תתקרבו לבד — המתינו לגיבוי או פעלו ממיקום בטוח.",
        "ירי באדם רק בסכנה ממשית לחיים (אדום) — מוצא אחרון.",
        "אחרי נטרול: אזיקה, חיפוש לפי סמכות, תיעוד והקלטה.",
      ],
      procedureIds: ["force-shooting", "force-pyramid", "dispatch-response"],
    },
    {
      id: "shots_at_officer",
      title: "ירי לעבר שוטר — מידור והישרדות",
      priority: 100,
      triggers: [/ירי לעבר שוטר/, /ירו עלי/, /יריות לעברי/, /אופי עלי/],
      reasoning: "ירי לעבר שוטר = סכנת חיים מיידית.",
      steps: [
        "מחסה מיידי; דווחו \"יריות לעבר שוטר\" + מיקום + 10-78.",
        "החזירו אש רק אם יש סכנה ממשית לחיים ויש קו ראייה בטוח.",
        "אל תרדפו לבד; תאם כוחות ומסוק אם זמין.",
        "PANIC רק בחטיפה/שבי ללא מוצא — לא בכל ירי.",
      ],
      dispatchExample:
        "\"[שם] תג [מספר], יריות לעברי ב[מיקום], מבקש תגבורת דחופה.\"",
      procedureIds: ["force-shooting", "dispatch-response", "panic-kidnap"],
    },
    {
      id: "shots_fired",
      title: "יריות באזור — סריקה ותגבורת",
      priority: 85,
      triggers: [/יריות/, /נשמעו יריות/, /ירי באזור/, /אש באזור/],
      exclude: [/ירי לעבר שוטר/, /לעברי/],
      reasoning: "יריות בסביבה — איתור מקור וגיוס כוחות.",
      steps: [
        "דווחו: \"נשמעו יריות\" + מיקום + כיוון; 10-78.",
        "מיקום בטוח, סריקה זהירה בזוג — לא לבד.",
        "אל תיכנסו ללא גיבוי לאזור לא ידוע.",
      ],
      dispatchExample:
        "\"אבי ישראלי תג 705, יריות בסביבת בנק הירקון, מתחילים סריקה, מבקש תגבורת.\"",
      procedureIds: ["dispatch-response", "radio-codes"],
    },
    {
      id: "traffic_stop_nc",
      title: "עצירת תנועה — חשוד לא משתף פעולה",
      priority: 87,
      triggers: [
        /עצירת תנועה לא משתפת/,
        /רכב לא עוצר/,
        /לא עוצר לי/,
        /יוצא מהרכב בסטופ/,
        /10-38/,
        /סטופ/,
      ],
      exclude: [/מרדף פעיל/, /10-80/],
      reasoning: "עצירה שגרתית שהחשוד לא מציית — בטיחות לפני כוח.",
      steps: [
        "כריזה ברורה להישאר ברכב; אם יוצא בניגוד להוראה — חשש מיידי לבטיחות.",
        "מותר טייזר לנטרול לפי נוהל עצירה שגרתית.",
        "אסור לירות על רכב נמלט במרדף — במרדף: איגוף, דוקרנים, תגבורת.",
        "אם הופך למרדף — 10-80, סדר מרדף, בלי ירי על גלגלים/רכב (עדכון HANDBOOK).",
      ],
      procedureIds: ["traffic-stop", "force-pyramid", "pursuit-no-shoot-vehicle"],
    },
    {
      id: "active_pursuit",
      title: "מרדף פעיל — סדר כוחות ותקשורת",
      priority: 86,
      triggers: [/מרדף פעיל/, /10-80/, /במרדף/, /רודף אחרי/, /רכב נמלט/],
      reasoning: "מרדף דורש סדר רכבים, תדר ודיווח — לא ירי על רכב.",
      steps: [
        "10-80 + מיקום + כיוון + סוג רכב; בקשת תגבורת אם צריך.",
        "רכב ראשון דבוק, שני חכם, שלישי גיבוי; מאגפים לאגף ופיטים.",
        "אסור לירות על רכב או גלגלים במרדף — גם בלי המשך מרדף.",
        "החלפת רכב: מאגפים אחרי החדש + תדר למעלה; מסוק מפקד אם יש.",
      ],
      procedureIds: [
        "pursuit-lead",
        "pursuit-no-shoot-vehicle",
        "pursuit-vehicle-switch",
        "pursuit-boxing",
      ],
    },
    {
      id: "panic_kidnap",
      title: "חטיפה / לחצן מצוקה — נוהל עורב",
      priority: 99,
      triggers: [/פאניקה חטיפה/, /לחצן מצוקה/, /panic/, /חטיפה/, /שבוי/, /נחטפתי/],
      reasoning: "מצב חירום חטיפה — PANIC רק באמת, שיתוף פעולה זמני אם אין מוצא.",
      steps: [
        "למנוע חטיפה: תגבורת, מרחק, אל תיכנסו לפאניקה מיותרת.",
        "אם אין בריחה ואיום מיידי — שיתוף פעולה זמני לשמירת חיים.",
        "שבי ללא מוצא — PANIC מיד; כל הכוחות מגיבים.",
        "PANIC ללא סיבה = פיטורים; לא לכל ירי או מרדף.",
      ],
      procedureIds: ["panic-kidnap", "dispatch-response"],
    },
    {
      id: "dangerous_suspect",
      title: "חשוד מסוכן — זהירות ותיאום",
      priority: 84,
      triggers: [/חשוד מסוכן/, /מסוכן מאוד/, /איום גבוה/],
      exclude: [/הקוף/],
      reasoning: "חשוד מסוכן — לא להסלים אבל לא להתקרב לבד.",
      steps: [
        "10-78 + תיאור חשוד + נשק אם ידוע.",
        "מרחק, מחסה, גיבוי לפני מעצר.",
        "פירמידת כוח מהירוק; תיעוד מלא.",
      ],
      procedureIds: ["force-pyramid", "dispatch-response", "ethics-calm"],
    },
  ];

  function scoreIntent(intent, q) {
    if (intent.exclude?.some((re) => re.test(q))) return 0;

    if (intent.requireAny && !intent.requireAny.some((re) => re.test(q))) return 0;

    let score = intent.priority || 50;

    intent.triggers.forEach((t) => {
      if (typeof t === "string") {
        const n = normalize(t);
        if (q.includes(n)) score += n.length >= 6 ? 22 : 14;
      } else if (t.test(q)) {
        score += 24;
      }
    });

    return score;
  }

  function detectIntent(rawQuery) {
    const q = normalizeQuery(rawQuery);
    if (!q) return null;

    let best = null;
    let bestScore = 0;

    OPERATIONAL_INTENTS.forEach((intent) => {
      const s = scoreIntent(intent, q);
      if (s > bestScore) {
        bestScore = s;
        best = intent;
      }
    });

    const threshold = best?.priority ? best.priority + 10 : 70;
    return bestScore >= threshold ? best : null;
  }

  function formatOperationalBrief(intent) {
    if (!intent) return "";

    const lines = [
      "=== ניתוח מבצעי (כוונה מזוהה) ===",
      "כותרת: " + intent.title,
      "משמעות השאלה: " + intent.reasoning,
      "",
      "צעדים מומלצים:",
    ];
    intent.steps.forEach((s, i) => lines.push(i + 1 + ". " + s));

    if (intent.dispatchExample) {
      lines.push("", "דוגמת דיווח בקשר:", intent.dispatchExample);
    }

    lines.push("", "עדיפות: בטיחות שוטר → תגבורת → ללא הסלמה → שיפוט מבצעי.");
    return lines.join("\n");
  }

  function formatDispatcherReply(intent) {
    const parts = [
      "🎯 " + intent.title,
      "",
      intent.reasoning,
      "",
      "מה לעשות עכשיו:",
    ];
    intent.steps.slice(0, 5).forEach((s) => parts.push("• " + s));
    if (intent.dispatchExample) {
      parts.push("", "בקשר:", intent.dispatchExample);
    }
    parts.push("", "שמרו על רגיעה — החוק הראשון: אין להסלים.");
    return parts.join("\n");
  }

  window.PoliceIntents = {
    OPERATIONAL_INTENTS,
    PHRASE_ALIASES,
    normalizeQuery,
    detectIntent,
    formatOperationalBrief,
    formatDispatcherReply,
  };
})();

/**
 * מאגר נהלים — Neverland Police Handbook
 * להוספת נוהל: הוסיפו אובייקט ל-procedures (ראו דוגמה בתחתית הקובץ).
 */
(function () {
  "use strict";

  const NOT_FOUND =
    "לא מצאתי נוהל ברור לזה במאגר הנהלים.";

  /** מילים נרדפות גלובליות — מפתח → מילות חיפוש נוספות */
  const GLOBAL_SYNONYMS = {
    מרדף: ["בריחה", "רכב נמלט", "נמלט", "מרדפים", "pursuit", "10-80", "רדיפה", "החלפת רכב"],
    "ירי על רכב": ["לירות על הרכב", "ירי על גלגלים", "גלגלים", "פנצ'ר", "לירות לגלגלים"],
    לבד: ["בלי שותף", "לבד בניידת", "נשארתי", "אין גיבוי", "בלי גיבוי", "solo"],
    תגבורת: ["גיבוי", "backup", "10-78", "עזרה", "כוחות נוספים"],
    מעצר: ["עצור", "לעצור", "אזיקים", "arrest", "עצירה", "לכוד"],
    רדיו: ["קשר", "תדר", "radio", "10-", "קוד", "מיקרופון", "תגבורת"],
    ירי: ["אש", "נשק חם", "אקדח", "יריות", "shoot", "fire"],
    כוח: ["טייזר", "שוקר", "פירמידה", "force", "אלימות", "התנגדות"],
    תנועה: ["עצירה", "רמזור", "רכב", "traffic", "stop", "סטופ", "קוד 5"],
    אינסידנט: ["mdt", "תיעוד", "דיווח", "incident", "שוד", "rob"],
    משמרת: ["on duty", "תפקיד", "פטרול", "סיור", "shift", "duty"],
    חיפוש: ["לחפש", "search", "לפתוח", "תיק", "גוף"],
    זכויות: ["מירנדה", "miranda", "חקירה", "שתיקה"],
    דרגה: ["היררכיה", "קדט", "cadet", "קורפורל", "סמל", "rank"],
    משמעת: ["קנס", "פיטורים", "מושחת", "הפרה", "discipline"],
    דיספאץ: ["dispatch", "פיקוד", "מוקד", "הקצאה", "קריאה"],
  };

  /**
   * @typedef {Object} Procedure
   * @property {string} id
   * @property {string} category
   * @property {string} title
   * @property {string} summary
   * @property {string[]} [bullets]
   * @property {string[]} keywords
   * @property {string[]} [synonyms]
   */

  /** @type {Procedure[]} */
  const procedures = [
    {
      id: "ethics-calm",
      category: "קוד אתי",
      title: "עקרון ראשון — אין להסלים",
      summary:
        "החוק הראשון במשטרת נברלנד: שמירה על רגיעה ושליטה. העדיפות היא להרגיע את הסיטואציה ולא להסלים.",
      bullets: [
        "התחילו בהוראות מילוליות ונוכחות לפני שימוש בכוח.",
        "שוטר טוב מסיים אירוע בשלב הירוק של פירמידת הכוח.",
      ],
      keywords: ["אתי", "רגיעה", "הסלמה", "עקרון", "חוק ראשון", "קוד אתי"],
      synonyms: ["להרגיע", "לא להסלים", "שליטה"],
    },
    {
      id: "ethics-corruption",
      category: "קוד אתי",
      title: "שחיתות וניצול תפקיד",
      summary:
        "ניצול לרעה של התפקיד מטופל בחומרה — שוטר מושחת עלול להימצא במאסר עד סוף החיים.",
      keywords: ["מושחת", "שחיתות", "משמעת", "עונש"],
      synonyms: ["הפרה", "קנס", "פיטורים"],
    },
    {
      id: "ethics-evidence-bag",
      category: "קוד אתי",
      title: "איסור שימוש ב-Evidence Bag כתיק",
      summary: "אסור בתכלית האיסור להשתמש ב-Evidence Bag בתור תיק משטרתי.",
      keywords: ["evidence bag", "תיק", "ראיות", "ציוד"],
    },
    {
      id: "ranks-hierarchy",
      category: "דרגות",
      title: "היררכיה — למי פונים",
      summary:
        "כל דרגה פונה בדרכה המקצועית לדרגה אחת מעליה בלבד, מבלי לעקוף סמכויות.",
      bullets: [
        "Chief of Police — מפקד עליון.",
        "Assistant Chief ממלא מקום המפקד בהיעדרו.",
        "Cadet — שוטר בהכשרה תחת פיקוח צמוד בלבד.",
      ],
      keywords: ["דרגה", "היררכיה", "chief", "cadet", "קורפורל", "סמל", "לוטננט"],
      synonyms: ["rank", "מפקד", "פיקוד"],
    },
    {
      id: "radio-codes",
      category: "קשר ורדיו",
      title: "קודי רדיו נפוצים",
      summary: "קודים עיקריים בתקשורת משטרתית:",
      bullets: [
        "10-4 מאשר | 10-6 עסוק | 10-7 יורד מתפקיד | 10-8 עולה מתפקיד.",
        "10-78 תגבורת | 10-80 מרדף | 10-31 פשע | 10-38 עצירה שגרתית.",
        "10-50 תאונה | 10-70 מרדף רגלי | 10-99 מבוקש → קוד 5 סטופ בסיכון.",
        "קוד 5 — עצירת תנועה בסיכון גבוה (שונה מ-10-38).",
      ],
      keywords: ["10-7", "10-78", "10-80", "10-31", "10-50", "קוד 5", "רדיו", "קשר"],
      synonyms: ["תדר", "קודים", "radio code"],
    },
    {
      id: "radio-discipline",
      category: "קשר ורדיו",
      title: "מענה בתדר ונוהל חטיפה",
      summary:
        "אי מענה לקריאות בתדר מפעיל 'נוהל חטיפה' — כל הכוחות מגיבים. אזעקת שווא עלולה להוביל לקנס או פיטורים.",
      bullets: [
        "דיווח תקין: זיהוי + מידע רלוונטי, לדוגמה: \"גד כהן תג 204, התחלתי מרדף... מבקש תגבורת\".",
        "באירוע חריג (שוד/מרדף) מותר מעבר זמני לתקשורת נפרדת עד סיום האירוע, ואז חזרה לתדר 1.",
      ],
      keywords: ["מענה", "חטיפה", "תדר", "תקשורת", "דיווח"],
      synonyms: ["לא עונה", "קריאות", "dispatch"],
    },
    {
      id: "pursuit-lead",
      category: "מרדפים",
      title: "תפקיד רכב ראשון במרדף",
      summary:
        "רכב ראשון = \"המתאבד\" — דבוק לרכב הנרדף במהירות מקסימלית, מבצע קפיצות וזריקות לפי הנוהל.",
      keywords: ["מרדף", "רכב ראשון", "מתאבד", "מרדפים"],
      synonyms: ["בריחה", "רכב נמלט", "נמלט", "pursuit", "10-80", "רדיפה"],
    },
    {
      id: "pursuit-second",
      category: "מרדפים",
      title: "תפקיד רכב שני במרדף",
      summary:
        "רכב שני חכם יותר — אם הראשון איבד שליטה, הוא עוקף והופך לרכב ראשון.",
      keywords: ["רכב שני", "מרדף", "עקיפה"],
      synonyms: ["בריחה", "pursuit"],
    },
    {
      id: "pursuit-no-shoot-vehicle",
      category: "מרדפים",
      title: "איסור ירי על רכב במרדף",
      summary:
        "אסור לירות על רכב במהלך מרדף — גם אם אין לכם דרך אחרת להמשיך את המרדף. אסור לירות על גלגלים של רכב — בחיים.",
      keywords: ["ירי", "רכב", "מרדף", "גלגלים", "אסור", "handbook"],
      synonyms: ["לירות על הרכב", "ירי על גלגלים", "פנצר", "ללא המשך", "אין איך להמשיך"],
    },
    {
      id: "pursuit-vehicle-switch",
      category: "מרדפים",
      title: "החלפת רכב על ידי נרדף (מבוי סתום)",
      summary:
        "כשהנרדף יורד ועובר לרכב אחר במבוי סתום — תפקיד קריטי לניידות המאגפות:",
      bullets: [
        "כל הניידות המאגפות מתחילות מרדף אחר הרכב החדש ועולות לתדר אחד למעלה.",
        "אם יש מסוק באירוע — המסוק מפקד על המרדף אחרי רכב החילוף.",
        "אם הרכב המקורי עדיין במרדף (לא כולם ירדו) — רק השלישייה הראשונה ממשיכה אחריו ונשארת בתדר ההתחלתי.",
        "אסור לירות על גלגלים או על הרכב — בחיים.",
      ],
      keywords: ["החלפת רכב", "מבוי סתום", "מאגפים", "תדר", "מסוק", "שלישייה", "רכב חדש"],
      synonyms: ["רכב חילוף", "channel up", "helicopter", "מבוי סתום"],
    },
    {
      id: "pursuit-boxing",
      category: "מרדפים",
      title: "איגוף וחסימת כביש",
      summary:
        "באיגוף: רכב במאונך, דוקרנים לחסימת נתיב (לא ירי!). אין לזוז במהלך חסימה. אסור לירות על גלגלים או על הרכב.",
      keywords: ["איגוף", "חסימה", "דוקרנים", "מרדף"],
      synonyms: ["box", "pit", "חוסם"],
    },
    {
      id: "pursuit-foot",
      category: "מרדפים",
      title: "קפיצה מהרכב הנרדף",
      summary:
        "אם הרכב הנרדף קופץ — רק הרכב הראשון קופץ אחריו. שאר הרכבים מאגפים (לא לקפוץ יחד — מניעת תאונות שרשרת).",
      keywords: ["קפיצה", "רגל", "מרדף", "רכב נרדף"],
      synonyms: ["בריחה ברגל", "foot pursuit"],
    },
    {
      id: "arrest-when",
      category: "מעצרים",
      title: "מתי מבצעים מעצר",
      summary:
        "מעצר רק בחשד סביר וברור לעבירה — למשל ירי, GSR חיובי, גניבת רכב, פגע וברח.",
      keywords: ["מעצר", "חשד סביר", "עצור", "לעצור"],
      synonyms: ["arrest", "אזיקים", "לכוד"],
    },
    {
      id: "search-person",
      category: "חיפוש על אדם",
      title: "חיפוש על אדם בפטרול",
      summary:
        "קורפורל ומעלה בפטרול — חיפוש על אדם בחשד סביר עם סיבה הגיונית. אחרת נדרשת הסכמה או צו מבית משפט.",
      keywords: ["חיפוש", "גוף", "אדם", "פטרול", "קורפורל"],
      synonyms: ["search person", "לחפש על", "חיפוש גופני"],
    },
    {
      id: "search-vehicle",
      category: "חיפוש ברכב",
      title: "חיפוש ברכב",
      summary:
        "חיפוש ברכב — לפי חשד סביר וסמכות דרגה (קורפורל+ בפטרול). תיעדו סיבה וממצאים באינסידנט.",
      keywords: ["חיפוש רכב", "רכב", "תא מטען", "vehicle"],
      synonyms: ["search car", "לפתוח רכב"],
    },
    {
      id: "traffic-stop",
      category: "בדיקות תנועה",
      title: "עצירת תנועה שגרתית",
      summary:
        "בעצירה שגרתית: חשוד שיוצא מהרכב למרות כריזה להישאר — יש חשש מיידי לבטיחות, מותר שימוש בטייזר לנטרול.",
      keywords: ["עצירה", "תנועה", "סטופ", "רכב", "טייזר"],
      synonyms: ["traffic stop", "עצירת רכב", "בדיקת רכב"],
    },
    {
      id: "traffic-red-light",
      category: "בדיקות תנועה",
      title: "רמזור אדום בסיור",
      summary:
        "בסיור אין חובה לעצור ברמזור אדום — יש להפעיל צ'קלקות וסירנות למעבר בטוח.",
      keywords: ["רמזור", "אדום", "סיור", "צקלקות"],
      synonyms: ["traffic light", "מעבר"],
    },
    {
      id: "force-pyramid",
      category: "שימוש בכוח",
      title: "פירמידת הכוח",
      summary:
        "השלב הטוב ביותר הוא ירוק — הוראות מילוליות ונוכחות. התקדמו בהדרגה רק כשיש איום ממשי.",
      bullets: [
        "ירוק — ללא כוח (מועדף).",
        "כחול — כוח מינימלי.",
        "כתום — כוח בינוני (כולל שוקר חשמלי באיום פיזי ממשי).",
        "אדום — כוח מרבי (נשק חם רק בסכנה ממשית לחיים).",
      ],
      keywords: ["פירמידה", "כוח", "טייזר", "שוקר", "ירוק", "כתום"],
      synonyms: ["force", "התנגדות", "אלימות"],
    },
    {
      id: "force-shooting",
      category: "ירי",
      title: "מתי מותר לירות",
      summary:
        "נשק חם הוא מוצא אחרון — ירי באדם מותר רק כשיש סכנה ממשית לחיים (שלך או של סובבים).",
      keywords: ["ירי", "אש", "נשק חם", "אקדח", "יריות"],
      synonyms: ["shoot", "fire", "לירות"],
    },
    {
      id: "incident-doc",
      category: "תיעוד אירוע",
      title: "תיעוד אינסידנט מלא",
      summary:
        "תיעוד מלא: כותרת באנגלית, פירוט, החלטה סופית ועונש — אין להמתיק או לדלג על שלבים.",
      bullets: [
        "כותרת באנגלית בלבד, לדוגמה: Warehouse Robbery.",
        "!rob! לשוד, !gen! לאירוע כללי.",
        "טביעות אצבע — קטגוריה Forensic באינסידנט.",
      ],
      keywords: ["אינסידנט", "mdt", "תיעוד", "דיווח", "שוד"],
      synonyms: ["incident", "rob", "gen", "דיווחים"],
    },
    {
      id: "suspect-rights",
      category: "זכויות חשוד",
      title: "זכויות מירנדה",
      summary:
        "זכויות מירנדה מוקראות רק אם יש צורך בחקירה — לא בכל מעצר (למשל מעצר תוך כדי שוד ללא חקירה).",
      keywords: ["מירנדה", "זכויות", "חקירה", "שתיקה"],
      synonyms: ["miranda", "זכויות חשוד"],
    },
    {
      id: "shift-start",
      category: "כניסה לתפקיד",
      title: "כניסה למשמרת",
      summary: "כניסה למשמרת מתחילה מתחנת המשטרה בלבד.",
      bullets: [
        "תדר 1 — הקשר הראשי לפעילות שוטפת.",
        "ON DUTY, בדיקת ציוד (פק\"ל), הקלטה פועלת (GeForce/Medal).",
        "אפוד מגן חובה ביציאה לפטרול.",
      ],
      keywords: ["משמרת", "on duty", "תחנה", "תדר 1", "פקל", "הקלטה"],
      synonyms: ["כניסה", "shift", "duty", "דיספאץ", "dispatch"],
    },
    {
      id: "shift-end",
      category: "יציאה מתפקיד",
      title: "ירידה מתפקיד",
      summary:
        "מחוץ לתפקיד אתם אזרחים — אסור קשר משטרתי, גרר, או התערבות משטרתית. מותר 911 במקרה חירום.",
      keywords: ["10-7", "ירידה", "off duty", "מתפקיד"],
      synonyms: ["יציאה", "סיום משמרת"],
    },
    {
      id: "patrol-pairs",
      category: "כניסה לתפקיד",
      title: "סיור בזוגות",
      summary:
        "סיורים יתבצעו תמיד בזוגות בלבד — יציאה לבד ללא אישור עלולה להוביל לקנס או פיטורים.",
      keywords: ["סיור", "זוג", "פטרול", "בזוגות"],
      synonyms: ["patrol", "שותף"],
    },
    {
      id: "patrol-vehicle-lock",
      category: "בדיקות תנועה",
      title: "נעילת רכב משטרתי",
      summary:
        "בכל יציאה מהרכב יש לנעול — חריג: שוטר נשאר בנהג ושולט על המצב.",
      keywords: ["נעילה", "רכב משטרתי", "פתוח"],
    },
    {
      id: "station-rules",
      category: "משמעת",
      title: "כללי תחנה",
      summary:
        "כל הדלתות בתחנה סגורות תמיד — למעט דלת הכניסה הראשית. אדם ללא רשות — תחילה חיפוש, אז אזהרה והוצאה.",
      keywords: ["תחנה", "דלתות", "משוטט", "הפרה"],
    },
    {
      id: "discipline-tow",
      category: "משמעת",
      title: "איסור עבודת גרר",
      summary:
        "העבודה היחידה שאסור לשוטר לבצע היא גרר — ואסור לעזור לחברים בכוונה באימפאונד.",
      keywords: ["גרר", "impound", "איסור"],
    },
    {
      id: "dispatch-response",
      category: "דיספאץ'",
      title: "תגובה לקריאות ותגבורת",
      summary:
        "בכל אירוע חריג — דווחו מיד בתדר עם זיהוי, מיקום וסוג אירוע. בקשת תגבורת: 10-78.",
      bullets: [
        "תחילת דיווח: שם + תג → מיקום → מה קורה → בקשה (תגבורת/מרדף וכו').",
        "דוגמה: \"גד כהן תג 204, מרדף אחרי ניסאן צהוב, כביש לכיוון בית הכלא, מבקש תגבורת\".",
      ],
      keywords: ["דיספאץ", "תגבורת", "קריאה", "מוקד", "פיקוד"],
      synonyms: ["dispatch", "backup", "תגבור"],
    },
    {
      id: "panic-kidnap",
      category: "חירום",
      title: "נוהל חטיפת שוטר (עורב) ולחצן מצוקה",
      summary:
        "מנעו חטיפה: תגבורת ומרחק. אם אין בריחה ואיום מיידי — שיתוף פעולה זמני לשמירת חיים. שבי ללא מוצא — PANIC מיד.",
      bullets: [
        "PANIC רק בחירום אמיתי (שבי/חטיפה) — שימוש ללא סיבה עלול להוביל לפיטורים.",
        "לאחר PANIC — כל הכוחות מתפרסים לאיתור.",
      ],
      keywords: ["חטיפה", "עורב", "panic", "מצוקה", "שבוי"],
      synonyms: ["לחצן", "נחטף"],
    },
    {
      id: "arrest-procedure",
      category: "מעצרים",
      title: "ביצוע מעצר בשטח",
      summary: "במעצר: כיוון נשק, ידיים למעלה, גב לרכב/אובייקט, אזיקה, הסבר סיבה.",
      bullets: [
        "מירנדה רק אם תחקירו — לא בכל מעצר (למשל שוד ללא חקירה).",
        "אי הקראת זכויות כשצריך — עלול לשחרר את העצור ולפגוע בתיק.",
      ],
      keywords: ["מעצר", "אזיקה", "ידיים", "מירנדה"],
      synonyms: ["לעצור", "עצירה"],
    },
    {
      id: "wanted-code5",
      category: "בדיקות תנועה",
      title: "מבוקש וקוד 5",
      summary:
        "מבוקש בקשר → קוד 5 (עצירת תנועה בסיכון גבוה), שונה מעצירה שגרתית 10-38.",
      keywords: ["מבוקש", "קוד 5", "10-99", "סטופ"],
      synonyms: ["wanted", "high risk stop"],
    },
    {
      id: "pursuit-pit-cars",
      category: "מרדפים",
      title: "רכבי פיטים במרדף",
      summary:
        "אם אינכם בשלישייה הראשונה — נתקו מהמרדף ונטרלו את רכב הפיטים. אחרי נטרול — טייזר, אזיקה, והמשיכו במרדף (לא להחזיר לתחנה מיד).",
      bullets: [
        "רישום סעיפי האירוע הראשוני גם לרכב הפיטים.",
        "במרדף על רכב נמלט רגיל — אסור ירי על הרכב/גלגלים (עדכון HANDBOOK).",
      ],
      keywords: ["פיט", "pit", "רכב חסימה", "חסימה במרדף"],
      synonyms: ["פיטים", "רכב עזר"],
    },
    {
      id: "pursuit-pit-maneuver",
      category: "מרדפים",
      title: "ביצוע פיט (PIT)",
      summary: "פיט רק באישור מפקד אירוע — לא במהירות גבוהה, לא באזור מאוכלס/מסוכן.",
      keywords: ["pit maneuver", "בוקס", "התנגשות"],
      synonyms: ["פיט מאושר"],
    },
    {
      id: "kof-monkey",
      category: "מעצרים",
      title: "הקוף — מעצר מסוכן",
      summary:
        "הקוף = Wanted מס' 1, סחר לא חוקי. מעצר מיידי בזהירות, נטרול מהיר, עדכון פיקוד. עלול לברוח מאזיקים.",
      keywords: ["הקוף", "kof", "wanted", "מסוכן"],
      synonyms: ["קוף", "הפושע"],
    },
    {
      id: "fingerprints",
      category: "ראיות",
      title: "טביעות אצבע ו-UV",
      summary:
        "כפפות חובה. טביעות בזירה עם Fingerprint Tape → מעבדה → Forensic באינסידנט. עדכון שם אם קיים במאגר.",
      keywords: ["טביעות", "uv", "forensic", "כפפות"],
      synonyms: ["fingerprint", "זיהוי"],
    },
    {
      id: "graffiti",
      category: "שוטף",
      title: "Graffiti Remover",
      summary:
        "ספריי מהתחנה/חדר משכורות; גם מחיפוש משאית חשודה או שלל שוד מכולה בחדר ראיות.",
      keywords: ["גרפיטי", "remover", "ספריי"],
      synonyms: ["graffiti", "ניקוי"],
    },
    {
      id: "vehicles-rank",
      category: "ציוד",
      title: "הוצאת רכבים לפי דרגה",
      summary:
        "אופיסר+: רוב הרכבים; אינטרספטור לקורפורל+/HighWay; אופנוע סניור+ בשוד בלבד; מסוק באירועים חמורים (שוד מחסן וכו').",
      keywords: ["רכב", "מסוק", "אינטרספטור", "אופנוע", "דרגה"],
      synonyms: ["vehicle", "helicopter", "interceptor"],
    },
    {
      id: "channel-break",
      category: "קשר ורדיו",
      title: "קשר 9 — הפסקה",
      summary: "קשר 9 = Break. עדכנו 10-6 ב-Police Chat עם משך ההפסקה.",
      keywords: ["קשר 9", "הפסקה", "break", "10-6"],
      synonyms: ["הפסקה", "break room"],
    },
    {
      id: "tunnel-pursuit",
      category: "מרדפים",
      title: "מרדף במנהרות",
      summary:
        "מנהרות מתחת לעיר — קשה לדיווח מסוק. כניסות: מוניות/ביוב, EMS, תחנה, אפרטמנטס. זהירות מגנרטורים (דלק/פיצוץ).",
      keywords: ["מנהרה", "tunnel", "מרכז מנהרות"],
      synonyms: ["תת קרקעי", "רכבת"],
    },
    {
      id: "complaint-desk",
      category: "תחנה",
      title: "תלונה על שוטר/אזרח",
      summary:
        "תיאום בדלפק → תא חקירות → אינסידנט → עדכון פיקוד במספר אינסידנט. תשובה כעריכה באותו אינסידנט.",
      keywords: ["תלונה", "דלפק", "תא חקירות"],
      synonyms: ["complaint", "להגיש תלונה"],
    },
    {
      id: "uniform-rules",
      category: "משמעת",
      title: "מדים וציוד לבוש",
      summary:
        "מדים תקינים לדרגה; אפוד מגן בפטרול. אסור משקפי מסיבה/מסכות לא מאושרות. מדים פורמליים לטקסים בלבד.",
      keywords: ["מדים", "אפוד", "לבוש", "משקפיים"],
      synonyms: ["uniform", "ווסט"],
    },
  ];

  /** תקציר ליבה — מועבר ל-AI כשאין התאמה חזקה */
  const HANDBOOK_CORE =
    "משטרת נברלנד: החוק הראשון — אין להסלים. סיור בזוגות בלבד (לא לבד ללא אישור). " +
    "קשר 1 = פעילות שוטפת. 10-78 תגבורת, 10-80 מרדף, 10-31 פשע, 10-7 ירידה. " +
    "פירמידת כוח: ירוק→כחול→כתום→אדום (נשק חם רק בסכנה ממשית לחיים). " +
    "מרדף: ראשון/שני/שלישי + מאגפים; אסור ירי על רכב/גלגלים במרדף (עדכון HANDBOOK). " +
    "עצירה שגרתית: יציאה בניגוד לכריזה = טייזר. מעצר בחשד סביר ברור בלבד.";

  /** בניית אינדקס חיפוש */
  function buildIndex() {
    return procedures.map((proc) => {
      const terms = new Set();
      const add = (t) => {
        if (t) terms.add(String(t).toLowerCase().trim());
      };
      add(proc.title);
      add(proc.category);
      add(proc.summary);
      (proc.keywords || []).forEach(add);
      (proc.synonyms || []).forEach(add);
      (proc.bullets || []).forEach(add);

      Object.entries(GLOBAL_SYNONYMS).forEach(([key, syns]) => {
        const all = [key, ...syns];
        const hit = all.some(
          (w) =>
            proc.keywords?.some((k) => k.includes(w) || w.includes(k)) ||
            proc.title.includes(w) ||
            proc.category.includes(w)
        );
        if (hit) all.forEach(add);
      });

      return { proc, terms: [...terms] };
    });
  }

  let searchIndex = null;

  function getIndex() {
    if (!searchIndex) searchIndex = buildIndex();
    return searchIndex;
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    const n = normalize(text);
    if (!n) return [];
    return n.split(" ").filter((t) => t.length > 1);
  }

  function expandTokens(tokens) {
    const out = new Set(tokens);
    tokens.forEach((tok) => {
      Object.entries(GLOBAL_SYNONYMS).forEach(([key, syns]) => {
        const group = [key, ...syns].map((s) => normalize(s));
        if (group.some((g) => g.includes(tok) || tok.includes(g))) {
          group.forEach((g) => g.split(" ").forEach((w) => w.length > 1 && out.add(w)));
          out.add(normalize(key));
        }
      });
    });
    return [...out];
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length < b.length) [a, b] = [b, a];
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i - 1;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cur = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
        prev = cur;
      }
    }
    return row[b.length];
  }

  function fuzzyMatch(queryTok, term) {
    if (term.includes(queryTok) || queryTok.includes(term)) return 1;
    if (queryTok.length >= 4 && term.length >= 4) {
      const d = levenshtein(queryTok, term);
      if (d <= 1) return 0.85;
      if (d <= 2 && queryTok.length >= 6) return 0.6;
    }
    return 0;
  }

  /**
   * @param {string} query
   * @param {{ lastProcedureId?: string }} [ctx]
   */
  function getProcedureById(id) {
    return procedures.find((p) => p.id === id) || null;
  }

  function detectIntent(query) {
    return window.PoliceIntents?.detectIntent?.(query) || null;
  }

  function search(query, ctx, opts) {
    const minScore = opts?.minScore ?? 4;
    const rawQ = String(query || "");
    const q = window.PoliceIntents?.normalizeQuery
      ? window.PoliceIntents.normalizeQuery(rawQ)
      : normalize(rawQ);
    if (!q) return { type: "empty" };

    const intent = opts?.intent || detectIntent(rawQ);

    const followUpHints = ["עוד", "המשך", "פרט", "דוגמה", "ולמה", "איך", "מה עוד"];
    const isFollowUp =
      followUpHints.some((h) => q.includes(h)) && q.length < 28 && ctx?.lastProcedureId;

    if (isFollowUp) {
      const prev = procedures.find((p) => p.id === ctx.lastProcedureId);
      if (prev) return { type: "hit", procedure: prev, score: 100, followUp: true };
    }

    const tokens = expandTokens(tokenize(q));
    const index = getIndex();
    const scored = [];

    index.forEach(({ proc, terms }) => {
      let score = 0;

      tokens.forEach((tok) => {
        if (normalize(proc.title).includes(tok)) score += 8;
        if (normalize(proc.category).includes(tok)) score += 5;

        terms.forEach((term) => {
          const fm = fuzzyMatch(tok, term);
          if (fm >= 1) score += 4;
          else if (fm > 0) score += 3;
        });

        (proc.keywords || []).forEach((kw) => {
          const nkw = normalize(kw);
          if (nkw.includes(tok) || tok.includes(nkw)) score += 6;
          else if (fuzzyMatch(tok, nkw) > 0) score += 4;
        });
      });

      if (normalize(proc.title) === q || normalize(proc.id) === q) score += 15;
      if (ctx?.lastProcedureId === proc.id) score += 2;

      if (intent?.procedureIds?.includes(proc.id)) score += 35;

      if (opts?.boostIds?.includes(proc.id)) score += 25;

      if (intent?.id === "officer_alone" && proc.id === "shift-start") score -= 40;

      if (score > 0) scored.push({ proc, score });
    });

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < minScore) {
      return { type: "miss" };
    }

    const top = scored[0];
    const related = scored.slice(1, 4).filter((s) => s.score >= top.score * 0.55);

    return {
      type: "hit",
      procedure: top.proc,
      score: top.score,
      related: related.map((r) => r.proc),
      intent: intent || undefined,
    };
  }

  function formatAnswer(result) {
    if (result.type === "empty") {
      return "שאל אותי על נהלים, קודי רדיו, מרדפים, מעצרים, שימוש בכוח ועוד.";
    }
    if (result.type === "miss") {
      return NOT_FOUND;
    }

    const p = result.procedure;
    const parts = [p.summary];
    if (p.bullets?.length) {
      parts.push("");
      p.bullets.forEach((b) => parts.push("• " + b));
    }
    parts.push("");
    parts.push("מקור: " + p.title + " (" + p.category + ")");

    if (result.related?.length && !result.followUp) {
      parts.push("");
      parts.push("אולי התכוונת גם ל:");
      result.related.slice(0, 2).forEach((r) => parts.push("— " + r.title));
    }

    return parts.join("\n");
  }

  function procedureToText(p) {
    const parts = [`[${p.category}] ${p.title}: ${p.summary}`];
    if (p.bullets?.length) p.bullets.forEach((b) => parts.push("- " + b));
    return parts.join("\n");
  }

  /** הקשר למודל AI — כוונה מבצעית + נהלים רלוונטיים */
  function getContextForQuery(query, ctx) {
    const intent = detectIntent(query);
    const parts = [];

    if (intent && window.PoliceIntents?.formatOperationalBrief) {
      parts.push(window.PoliceIntents.formatOperationalBrief(intent));
      const linked = (intent.procedureIds || [])
        .map(getProcedureById)
        .filter(Boolean)
        .slice(0, 3);
      if (linked.length) {
        parts.push("\n--- נהלים קשורים ---\n" + linked.map(procedureToText).join("\n\n"));
      }
    }

    const result = search(query, ctx, { minScore: 3, intent });
    if (result.type === "hit") {
      const list = [result.procedure, ...(result.related || [])].slice(0, 3);
      const seen = new Set();
      const extra = list.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      if (extra.length) {
        parts.push("\n--- חיפוש במאגר ---\n" + extra.map(procedureToText).join("\n\n"));
      }
    }

    if (parts.length === 0) {
      parts.push("--- ליבת נהלים ---\n" + HANDBOOK_CORE);
    }

    return parts.join("\n").slice(0, 3800);
  }

  /** תשובה מקומית — סגנון דיספאטש/מדריך */
  function getSmartReply(query, ctx) {
    const intent = detectIntent(query);

    if (intent && window.PoliceIntents?.formatDispatcherReply) {
      const linked = (intent.procedureIds || [])
        .map(getProcedureById)
        .filter(Boolean)
        .slice(0, 1);
      let reply = window.PoliceIntents.formatDispatcherReply(intent);
      if (linked[0]) {
        reply += "\n\nנהל רלוונטי: " + linked[0].title + " — " + linked[0].summary;
      }
      return reply;
    }

    const result = search(query, ctx, { minScore: 3, intent });
    if (result.type === "empty") {
      return (
        "שאלו על מצב מבצעי (לבד בניידת, תגבורת, מרדף, עצירה, ירי) או נהלים.\n" +
        "דוגמה: \"נשארתי לבד בניידת — מה עושים?\""
      );
    }
    if (result.type === "miss") {
      return (
        "אין נוהל מדויק במאגר, אבל לפי שיקול דעת בטוח:\n" +
        "• דווחו בקשר (זיהוי + מיקום + 10-78 אם צריך).\n" +
        "• אל תסלימו — שמרו מרחק ומחסה.\n" +
        "• המתינו לגיבוי לפני פעולה מסוכנת.\n\n" +
        HANDBOOK_CORE
      );
    }

    const items = [result.procedure, ...(result.related || [])].slice(0, 2);
    const parts = ["לפי נהלי משטרת נברלנד:\n"];

    items.forEach((p, i) => {
      parts.push("\n" + (i + 1) + ". " + p.title);
      parts.push(p.summary);
      if (p.bullets?.length) {
        p.bullets.slice(0, 3).forEach((b) => parts.push("• " + b));
      }
    });

    parts.push("\nמקור: מאגר הנהלים · " + items[0].category);
    return parts.join("\n");
  }

  window.PoliceKnowledge = {
    NOT_FOUND,
    HANDBOOK_CORE,
    procedures,
    GLOBAL_SYNONYMS,
    detectIntent,
    getProcedureById,
    search,
    formatAnswer,
    getContextForQuery,
    getSmartReply,
    procedureToText,
    getCategories() {
      return [...new Set(procedures.map((p) => p.category))];
    },
    /** רענון אינדקס אחרי הוספת נהלים בזמן ריצה */
    rebuildIndex() {
      searchIndex = null;
      getIndex();
    },
  };
})();

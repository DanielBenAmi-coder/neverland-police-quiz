/** רמות שאלות + הגדרות מסלולי בחינה ותרגול */
(function () {
  const CADET_IDS = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27,
    57, 58, 64, 65, 66, 67, 68, 107, 111, 112, 141, 153,
  ]);

  const SENIOR_IDS = new Set([
    33, 34, 35, 36, 37, 38, 39, 40, 85, 86, 87, 88, 89, 90, 96, 97, 119, 120,
    121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 132, 133, 137, 138, 139,
    140, 143, 145, 146, 149, 150, 155, 156, 159, 160, 27, 28, 29, 30, 31, 32,
    79, 80, 108, 135, 136,
  ]);

  const CADET_CATEGORIES = new Set(["shift", "uniform"]);
  const SENIOR_CATEGORIES = new Set(["pursuit"]);
  const SENIOR_TYPES = new Set(["not", "scenario"]);

  QUESTIONS.forEach((q) => {
    if (q.level) return;

    if (SENIOR_IDS.has(q.id) || SENIOR_CATEGORIES.has(q.category)) {
      q.level = "senior";
      return;
    }
    if (SENIOR_TYPES.has(q.type)) {
      q.level = "senior";
      return;
    }
    if (CADET_IDS.has(q.id) || CADET_CATEGORIES.has(q.category)) {
      q.level = "cadet";
      return;
    }
    if (q.type === "truefalse" && ["patrol", "general", "radio"].includes(q.category)) {
      q.level = "cadet";
      return;
    }
    if (q.category === "hierarchy" && q.id <= 8) {
      q.level = "cadet";
      return;
    }

    q.level = "officer";
  });

  window.RANK_LEVELS = {
    "cadet-officer": {
      id: "cadet-officer",
      title: "קדט → Officer",
      badge: "בסיס",
      badgeClass: "exam-badge-easy",
      topics: "משמרת, מדים, סיור, היררכיה בסיסית, קשר ראשוני",
      examSize: 40,
      practiceSize: 30,
      pass: 70,
      pool: (q) => q.level === "cadet" || q.level === "officer",
      cadetRatio: 0.45,
    },
    "officer-senior": {
      id: "officer-senior",
      title: "Officer → Senior",
      badge: "מתקדם · קשה",
      badgeClass: "exam-badge-hard",
      topics: "מרדפים, מעצרים מתקדמים, תרחישים ומלכודות",
      examSize: 55,
      practiceSize: 35,
      pass: 75,
      pool: (q) => q.level === "officer" || q.level === "senior",
      seniorRatio: 0.72,
    },
  };

  window.EXAM_LEVELS = window.RANK_LEVELS;
})();

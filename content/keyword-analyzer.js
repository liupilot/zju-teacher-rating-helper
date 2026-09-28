(() => {
  "use strict";

  const RULES = [
    { keyword: "讲课清楚", sentiment: "positive" },
    { keyword: "讲得清楚", sentiment: "positive" },
    { keyword: "讲得好", sentiment: "positive" },
    { keyword: "认真", sentiment: "positive" },
    { keyword: "负责", sentiment: "positive" },
    { keyword: "幽默", sentiment: "positive" },
    { keyword: "温柔", sentiment: "positive" },
    { keyword: "有耐心", sentiment: "positive" },
    { keyword: "干货", sentiment: "positive" },
    { keyword: "给分不错", sentiment: "positive" },
    { keyword: "给分好", sentiment: "positive" },
    { keyword: "受益匪浅", sentiment: "positive" },
    { keyword: "作业较多", sentiment: "negative" },
    { keyword: "作业多", sentiment: "negative" },
    { keyword: "给分严格", sentiment: "negative" },
    { keyword: "给分低", sentiment: "negative" },
    { keyword: "考试较难", sentiment: "negative" },
    { keyword: "考试难", sentiment: "negative" },
    { keyword: "很水", sentiment: "negative" },
    { keyword: "水课", sentiment: "negative" },
    { keyword: "不咋样", sentiment: "negative" },
    { keyword: "垃圾", sentiment: "negative" },
    { keyword: "拖堂", sentiment: "negative" },
    { keyword: "念PPT", sentiment: "negative" },
    { keyword: "照本宣科", sentiment: "negative" }
  ];

  function analyzeReviews(reviews, limit = 8) {
    const counts = new Map();

    reviews.forEach((review) => {
      const text = (review.content || "").toLowerCase();
      RULES.forEach((rule) => {
        const keyword = rule.keyword.toLowerCase();
        let index = text.indexOf(keyword);
        while (index !== -1) {
          counts.set(
            rule.keyword,
            (counts.get(rule.keyword) || 0) + 1
          );
          index = text.indexOf(keyword, index + keyword.length);
        }
      });
    });

    return [...counts.entries()]
      .map(([keyword, count]) => ({
        keyword,
        count,
        sentiment: RULES.find((rule) => rule.keyword === keyword).sentiment
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.keywordAnalyzer = { analyzeReviews };
})();

(() => {
  "use strict";

  const LOG_PREFIX = "[ZJU Teacher Helper]";
  const CHALAOSHI_BASE_URL = "https://chalaoshi.netlify.app/";
  const MAX_REVIEWS = 5;
  const STYLES = `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: none;
      font-family: system-ui, "Microsoft YaHei", sans-serif;
    }
    :host([data-open="true"]) {
      display: block;
    }
    .zju-teacher-helper-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
    }
    .zju-teacher-helper-modal-card {
      position: relative;
      width: min(560px, calc(100vw - 32px));
      max-height: min(640px, calc(100vh - 48px));
      margin: 24px auto;
      overflow: auto;
      background: #ffffff;
      border: 1px solid #dfe3e8;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
    }
    .zju-teacher-helper-modal-header {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .zju-teacher-helper-modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      overflow-wrap: anywhere;
    }
    .zju-teacher-helper-modal-close {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #334155;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }
    .zju-teacher-helper-modal-body {
      padding: 16px;
    }
    .zju-teacher-helper-modal-status {
      padding: 16px 0;
      color: #475569;
    }
    .zju-teacher-helper-modal-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .zju-teacher-helper-modal-kv {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .zju-teacher-helper-modal-kv-label {
      color: #64748b;
      font-size: 13px;
    }
    .zju-teacher-helper-modal-kv-value {
      color: #0f172a;
      font-size: 15px;
      font-weight: 600;
    }
    .zju-teacher-helper-modal-section {
      margin: 14px 0 6px;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }
    .zju-teacher-helper-modal-courses {
      margin: 0;
      padding-left: 20px;
      color: #1e293b;
      font-size: 13px;
      line-height: 1.7;
    }
    .zju-teacher-helper-modal-reviews {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .zju-teacher-helper-modal-keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .zju-teacher-helper-modal-keyword {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.6;
    }
    .zju-teacher-helper-modal-keyword-positive {
      background: #eefaf1;
      border: 1px solid #4c9e68;
      color: #1f6b3d;
    }
    .zju-teacher-helper-modal-keyword-negative {
      background: #fdecec;
      border: 1px solid #d96a6a;
      color: #8f2f2f;
    }
    .zju-teacher-helper-modal-review {
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .zju-teacher-helper-modal-review-content {
      color: #1e293b;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .zju-teacher-helper-modal-review-meta {
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
    }
    .zju-teacher-helper-modal-candidate {
      display: block;
      width: 100%;
      margin-bottom: 8px;
      padding: 9px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #1e293b;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .zju-teacher-helper-modal-candidate:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .zju-teacher-helper-modal-footer {
      padding: 10px 16px;
      border-top: 1px solid #e2e8f0;
      text-align: right;
    }
    .zju-teacher-helper-modal-link {
      color: #0f766e;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .zju-teacher-helper-modal-link:hover {
      text-decoration: underline;
    }
  `;

  let host = null;
  let root = null;
  let title = null;
  let body = null;
  let link = null;

  function log(...messages) {
    console.info(LOG_PREFIX, ...messages);
  }

  function buildSearchUrl(name) {
    const url = new URL(CHALAOSHI_BASE_URL);
    url.searchParams.set("zju_teacher", name);
    return url.toString();
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className !== null) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function clearBody() {
    body.replaceChildren();
  }

  function showLoading() {
    title.textContent = "正在加载评价";
    link.hidden = true;
    clearBody();
    body.appendChild(
      createElement(
        "div",
        "zju-teacher-helper-modal-status",
        "正在从查老师加载评价数据…"
      )
    );
  }

  function renderStatus(titleText, message) {
    title.textContent = titleText;
    link.hidden = false;
    clearBody();
    body.appendChild(
      createElement("div", "zju-teacher-helper-modal-status", message)
    );
  }

  function addKv(label, value) {
    const item = createElement("div", "zju-teacher-helper-modal-kv");
    item.appendChild(
      createElement("span", "zju-teacher-helper-modal-kv-label", label)
    );
    item.appendChild(
      createElement("span", "zju-teacher-helper-modal-kv-value", value)
    );
    return item;
  }

  function renderCourses(courses) {
    if (courses.length === 0) {
      return;
    }
    body.appendChild(
      createElement("div", "zju-teacher-helper-modal-section", "📚 开设课程")
    );
    const list = createElement("ul", "zju-teacher-helper-modal-courses");
    courses.forEach((course) => {
      const item = createElement(
        "li",
        null,
        `${course.course} · 绩点 ${course.gpa} ± ${course.passRate} · ${course.students} 人`
      );
      list.appendChild(item);
    });
    body.appendChild(list);
  }

  function renderReviews(reviews) {
    body.appendChild(
      createElement("div", "zju-teacher-helper-modal-section", "📝 最新评价")
    );
    const container = createElement("div", "zju-teacher-helper-modal-reviews");

    if (reviews.length === 0) {
      container.appendChild(
        createElement(
          "div",
          "zju-teacher-helper-modal-status",
          "该教师暂无评价"
        )
      );
    } else {
      reviews.slice(0, MAX_REVIEWS).forEach((review) => {
        const item = createElement(
          "div",
          "zju-teacher-helper-modal-review"
        );
        item.appendChild(
          createElement(
            "div",
            "zju-teacher-helper-modal-review-content",
            review.content || "(无评价内容)"
          )
        );
        item.appendChild(
          createElement(
            "div",
            "zju-teacher-helper-modal-review-meta",
            `${review.time} · 👍 ${review.upvotes} · 👎 ${review.downvotes}`
          )
        );
        container.appendChild(item);
      });
    }
    body.appendChild(container);
  }

  function renderKeywords(reviews) {
    const analyzer = window.ZJUTeacherHelper?.keywordAnalyzer;
    if (analyzer === undefined) {
      return;
    }
    const entries = analyzer.analyzeReviews(reviews);
    if (entries.length === 0) {
      return;
    }

    body.appendChild(
      createElement(
        "div",
        "zju-teacher-helper-modal-section",
        "评价中常提到"
      )
    );
    const container = createElement(
      "div",
      "zju-teacher-helper-modal-keywords"
    );
    entries.forEach((entry) => {
      const chip = createElement(
        "span",
        `zju-teacher-helper-modal-keyword zju-teacher-helper-modal-keyword-${entry.sentiment}`,
        `${entry.keyword} ×${entry.count}`
      );
      container.appendChild(chip);
    });
    body.appendChild(container);
  }

  function renderFound(result) {
    title.textContent = `${result.name} · ${result.college}`;
    link.hidden = false;
    clearBody();

    const summary = createElement(
      "div",
      "zju-teacher-helper-modal-summary"
    );
    summary.appendChild(addKv("⭐ 综合评分", result.rating));
    summary.appendChild(addKv("💬 评价人数", result.reviewCount));
    body.appendChild(summary);

    renderCourses(result.courses);
    renderReviews(result.reviews);
    renderKeywords(result.reviews);
  }

  function renderAmbiguous(result) {
    title.textContent = `${result.name}（${result.candidates.length} 位同名教师）`;
    link.hidden = false;
    clearBody();
    body.appendChild(
      createElement(
        "div",
        "zju-teacher-helper-modal-status",
        "请选择要查看的教师："
      )
    );

    result.candidates.forEach((candidate) => {
      const button = createElement(
        "button",
        "zju-teacher-helper-modal-candidate",
        `${candidate.name} · ${candidate.college} · 评分 ${candidate.rating}（${candidate.reviewCount} 条评价）`
      );
      button.addEventListener("click", () => {
        open(candidate.name, { college: candidate.college });
      });
      body.appendChild(button);
    });
  }

  function render(result) {
    link.href = buildSearchUrl(result.name);
    link.textContent = "查看完整评价 ↗";

    if (result.status === "found") {
      renderFound(result);
      return;
    }
    if (result.status === "ambiguous") {
      renderAmbiguous(result);
      return;
    }
    if (result.status === "not_found") {
      renderStatus(result.name, "查老师中未找到该教师");
      return;
    }
    renderStatus(result.name, "查询失败，请稍后重试或点击右上角查看完整评价。");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      close();
    }
  }

  function close() {
    if (host !== null) {
      host.setAttribute("data-open", "false");
    }
    document.removeEventListener("keydown", handleKeydown);
  }

  function open(name, options = {}) {
    ensureHost();
    host.setAttribute("data-open", "true");
    document.addEventListener("keydown", handleKeydown);
    showLoading();

    if (options.result !== undefined) {
      render(options.result);
      return;
    }

    const client = window.ZJUTeacherHelper?.teacherServiceClient;
    if (client === undefined) {
      render({
        status: "error",
        name,
        error: "查询服务未加载"
      });
      return;
    }

    client
      .queryTeacher(name, {
        college: options.college || null,
        includeReviews: true
      })
      .then(render)
      .catch((error) =>
        render({
          status: "error",
          name,
          error: String(error)
        })
      );
  }

  function ensureHost() {
    if (host !== null && host.isConnected) {
      return host;
    }

    host = createElement("div", "zju-teacher-helper-modal-host");
    root = host.attachShadow({ mode: "open" });

    const style = createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);

    const backdrop = createElement(
      "div",
      "zju-teacher-helper-modal-backdrop"
    );
    const card = createElement("div", "zju-teacher-helper-modal-card");
    const header = createElement("div", "zju-teacher-helper-modal-header");
    title = createElement("div", "zju-teacher-helper-modal-title");
    const closeButton = createElement(
      "button",
      "zju-teacher-helper-modal-close",
      "×"
    );
    closeButton.setAttribute("aria-label", "关闭");
    closeButton.addEventListener("click", close);
    header.appendChild(title);
    header.appendChild(closeButton);

    body = createElement("div", "zju-teacher-helper-modal-body");
    const footer = createElement("div", "zju-teacher-helper-modal-footer");
    link = createElement("a", "zju-teacher-helper-modal-link", "查看完整评价 ↗");
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
    footer.appendChild(link);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    root.appendChild(backdrop);
    root.appendChild(card);

    root.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });

    document.body.appendChild(host);
    return host;
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.reviewModal = { open, close };
})();

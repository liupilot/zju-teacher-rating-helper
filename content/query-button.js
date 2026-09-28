(() => {
  "use strict";

  const LOG_PREFIX = "[ZJU Teacher Helper]";
  const BUTTON_CLASS = "zju-teacher-helper-query-button";
  const BUTTON_LABEL = "⭐ 查询评价";
  const CHALAOSHI_BASE_URL = "https://chalaoshi.netlify.app/";
  const STATE_CLASSES = {
    loading: "zju-teacher-helper-query-loading",
    found: "zju-teacher-helper-query-found",
    ambiguous: "zju-teacher-helper-query-ambiguous",
    notFound: "zju-teacher-helper-query-not-found",
    error: "zju-teacher-helper-query-error"
  };

  function log(...messages) {
    console.info(LOG_PREFIX, ...messages);
  }

  function createQueryButton(name) {
    const button = document.createElement("span");
    button.className = BUTTON_CLASS;
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.dataset.teacherName = name;
    button.title = `在查老师中查询「${name}」`;
    button.textContent = BUTTON_LABEL;
    return button;
  }

  function handleActivate(event, button) {
    event.preventDefault();
    event.stopPropagation();
    const name = button.dataset.teacherName;

    const modal = window.ZJUTeacherHelper?.reviewModal;
    if (modal !== undefined) {
      modal.open(name);
      log(`查询评价：${name}，打开评价弹窗`);
      return;
    }

    const url = new URL(CHALAOSHI_BASE_URL);
    url.searchParams.set("zju_teacher", name);
    window.open(url.toString(), "_blank");
    log(`查询评价：${name}，已打开 ${url.toString()}`);
  }

  function attachHandlers(button) {
    button.addEventListener("click", (event) => handleActivate(event, button));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        handleActivate(event, button);
      }
    });
  }

  function clearStateClasses(button) {
    Object.values(STATE_CLASSES).forEach((className) => {
      button.classList.remove(className);
    });
  }

  function formatRating(rating) {
    const value = Number(rating);
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  function setLoading(button) {
    clearStateClasses(button);
    button.textContent = "查询中…";
    button.classList.add(STATE_CLASSES.loading);
  }

  function applyResult(button, result) {
    clearStateClasses(button);

    if (result.status === "found") {
      button.textContent = `⭐ ${formatRating(result.rating)} 💬 ${result.reviewCount}`;
      button.classList.add(STATE_CLASSES.found);
      button.title = `${result.name} · ${result.college} · 评分 ${result.rating} / ${result.reviewCount} 条评价`;
      return;
    }

    if (result.status === "ambiguous") {
      button.textContent = `同名 ${result.candidates.length} 位`;
      button.classList.add(STATE_CLASSES.ambiguous);
      button.title = `${result.name} 存在多位同名教师，点击查看`;
      return;
    }

    if (result.status === "not_found") {
      button.textContent = "未找到";
      button.classList.add(STATE_CLASSES.notFound);
      button.title = `查老师中未找到 ${result.name}`;
      return;
    }

    button.textContent = "查询失败";
    button.classList.add(STATE_CLASSES.error);
    button.title = `查询 ${result.name} 失败`;
  }

  function findExistingButton(container, name) {
    const buttons = container.querySelectorAll(`.${BUTTON_CLASS}`);
    for (const button of buttons) {
      if (button.dataset.teacherName === name) {
        return button;
      }
    }
    return null;
  }

  function inject(record) {
    const anchor = record.cell.querySelector("a");
    const container = anchor !== null ? anchor : record.cell;
    let injectedCount = 0;

    const names = new Set(record.names);
    const staleButtons = [
      ...container.querySelectorAll(`.${BUTTON_CLASS}`)
    ].filter((button) => !names.has(button.dataset.teacherName));
    staleButtons.forEach((button) => button.remove());

    record.names.forEach((name) => {
      if (findExistingButton(container, name) !== null) {
        return;
      }

      let target = null;
      for (const node of container.childNodes) {
        if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent.trim() === name
        ) {
          target = node;
          break;
        }
      }

      const button = createQueryButton(name);
      if (target !== null) {
        container.insertBefore(button, target.nextSibling);
      } else {
        container.appendChild(button);
      }
      attachHandlers(button);
      injectedCount += 1;
    });

    return injectedCount;
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.queryButtonInjector = { inject, setLoading, applyResult };
})();

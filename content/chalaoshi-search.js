(() => {
  "use strict";

  const LOG_PREFIX = "[ZJU Teacher Helper]";
  const SEARCH_PARAM = "zju_teacher";
  const SEARCH_INPUT_ID = "search";
  const WAIT_TIMEOUT_MS = 10000;

  function log(...messages) {
    console.info(LOG_PREFIX, ...messages);
  }

  function fillSearch(name) {
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input === null) {
      return false;
    }
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function waitForSearchInputAndFill(name) {
    let observer = null;
    let timer = null;

    const finish = () => {
      if (observer !== null) {
        observer.disconnect();
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
    };

    observer = new MutationObserver(() => {
      if (fillSearch(name)) {
        log("已自动填充搜索框");
        finish();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    timer = setTimeout(finish, WAIT_TIMEOUT_MS);
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const teacherName = params.get(SEARCH_PARAM);
    if (teacherName === null || teacherName.trim() === "") {
      return;
    }

    log(`自动搜索教师：${teacherName}`);
    if (fillSearch(teacherName)) {
      log("已自动填充搜索框");
    } else {
      waitForSearchInputAndFill(teacherName);
    }
  }

  init();
})();

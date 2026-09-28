(() => {
  "use strict";

  const LOG_PREFIX = "[ZJU Teacher Helper]";
  const BUTTON_SELECTOR = ".zju-teacher-helper-query-button";
  const MAX_CONCURRENT_QUERIES = 5;
  const MAX_QUERY_CACHE_SIZE = 200;
  const queries = new Map();
  const pendingQueryTasks = [];
  let activeQueryCount = 0;

  function log(...messages) {
    console.info(LOG_PREFIX, ...messages);
  }

  function getClient() {
    return window.ZJUTeacherHelper?.teacherServiceClient;
  }

  function findButtonsByName(name) {
    return [...document.querySelectorAll(BUTTON_SELECTOR)].filter(
      (button) => button.dataset.teacherName === name
    );
  }

  function getQueryPromise(name) {
    if (queries.has(name)) {
      const promise = queries.get(name);
      queries.delete(name);
      queries.set(name, promise);
      return promise;
    }

    const promise = getClient()
      .queryTeacher(name)
      .catch((error) => {
        queries.delete(name);
        return {
          status: "error",
          name,
          error: String(error)
        };
      });
    queries.set(name, promise);

    if (queries.size > MAX_QUERY_CACHE_SIZE) {
      queries.delete(queries.keys().next().value);
    }

    return promise;
  }

  function runLimited(task) {
    return new Promise((resolve, reject) => {
      pendingQueryTasks.push({ task, resolve, reject });
      drainPendingQueries();
    });
  }

  function drainPendingQueries() {
    while (
      activeQueryCount < MAX_CONCURRENT_QUERIES &&
      pendingQueryTasks.length > 0
    ) {
      const { task, resolve, reject } = pendingQueryTasks.shift();
      activeQueryCount += 1;
      Promise.resolve()
        .then(task)
        .then(
          (value) => {
            activeQueryCount -= 1;
            resolve(value);
            drainPendingQueries();
          },
          (error) => {
            activeQueryCount -= 1;
            reject(error);
            drainPendingQueries();
          }
        );
    }
  }

  async function refreshNames(names) {
    const uniqueNames = [...new Set(names.filter((name) => name !== ""))];
    const injector = window.ZJUTeacherHelper?.queryButtonInjector;
    if (uniqueNames.length === 0 || injector === undefined || getClient() === undefined) {
      return;
    }

    log(`开始刷新 ${uniqueNames.length} 位教师的评分标签`);

    uniqueNames.forEach((name) => {
      findButtonsByName(name).forEach((button) => injector.setLoading(button));
    });

    await Promise.all(
      uniqueNames.map((name) =>
        runLimited(async () => {
          const result = await getQueryPromise(name);
          findButtonsByName(name).forEach((button) =>
            injector.applyResult(button, result)
          );
        })
      )
    );
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.ratingDisplay = { refreshNames };
})();

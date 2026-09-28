(() => {
  "use strict";

  const LOG_PREFIX = "[ZJU Teacher Helper]";
  const OBSERVER_CONFIG = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  };
  const SCAN_DEBOUNCE_MS = 300;
  const MAX_FLUSH_DELAY_MS = 1500;
  const WATCHDOG_INTERVAL_MS = 1000;
  const TABLE_SELECTOR = "table.table.table-hover";
  const OWN_ELEMENT_SELECTOR =
    ".zju-teacher-helper-query-button, .zju-teacher-helper-modal-host";

  let mutationBatchCount = 0;
  let debounceTimer = null;
  let observer = null;
  let observedRoot = null;

  function log(...messages) {
    console.info(LOG_PREFIX, ...messages);
  }

  function isOwnNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node.closest(OWN_ELEMENT_SELECTOR) !== null) {
      return true;
    }
    const root = node.getRootNode();
    if (root instanceof ShadowRoot && root.host instanceof Element) {
      return root.host.closest(OWN_ELEMENT_SELECTOR) !== null;
    }
    return false;
  }

  function isTeacherRelevantMutation(mutation) {
    const target = mutation.target;
    if (isOwnNode(target)) {
      return false;
    }

    const targetElement =
      target instanceof Element ? target : target.parentElement;
    if (
      targetElement !== null &&
      targetElement.closest(TABLE_SELECTOR) !== null
    ) {
      return true;
    }

    const containsTeacherTable = (node) => {
      if (!(node instanceof Element)) {
        return false;
      }
      return (
        node.matches(TABLE_SELECTOR) ||
        node.querySelector(TABLE_SELECTOR) !== null
      );
    };

    for (const node of mutation.addedNodes) {
      if (containsTeacherTable(node)) {
        return true;
      }
    }
    for (const node of mutation.removedNodes) {
      if (containsTeacherTable(node)) {
        return true;
      }
    }
    return false;
  }

  function runTeacherScan() {
    const detector = window.ZJUTeacherHelper?.teacherDetector;
    if (detector === undefined) {
      log("教师识别模块未加载，跳过扫描");
      return [];
    }
    if (typeof detector.resetProcessedRows === "function") {
      detector.resetProcessedRows();
    }
    const records = detector.scanPage();
    if (
      records.length === 0 &&
      typeof detector.getPageDiagnostics === "function"
    ) {
      const diagnostics = detector.getPageDiagnostics();
      if (
        diagnostics.tablesFound > 0 &&
        diagnostics.bodyRows > 0 &&
        diagnostics.teacherCells === 0
      ) {
        log(
          `检测到 ${diagnostics.tablesFound} 个教学班表格、${diagnostics.bodyRows} 个数据行，但未识别到教师单元格，选课页面结构可能已变化`
        );
      }
    }
    return records;
  }

  function logDetectedTeachers(records) {
    records.forEach((record) => {
      record.names.forEach((name) => {
        log(`识别到教师: ${name}`);
      });
    });
  }

  function processTeacherRecords(records) {
    const injector = window.ZJUTeacherHelper?.queryButtonInjector;
    if (injector === undefined) {
      log("查询按钮模块未加载，跳过注入");
      return { injectedRecords: [], injectedCount: 0 };
    }

    const injectedRecords = [];
    let injectedCount = 0;
    records.forEach((record) => {
      const count = injector.inject(record);
      injectedCount += count;
      if (count > 0) {
        injectedRecords.push(record);
      }
    });

    return { injectedRecords, injectedCount };
  }

  function refreshTeacherRatings(records) {
    const names = records.flatMap((record) => record.names);
    const ratingDisplay = window.ZJUTeacherHelper?.ratingDisplay;
    if (ratingDisplay !== undefined) {
      ratingDisplay.refreshNames(names);
    }
  }

  function flushPendingScan() {
    debounceTimer = null;

    if (mutationBatchCount === 0) {
      return;
    }

    const records = runTeacherScan();
    if (records.length > 0) {
      const { injectedRecords, injectedCount } = processTeacherRecords(records);
      if (injectedRecords.length > 0) {
        logDetectedTeachers(injectedRecords);
        log(`教师识别：本次新增注入 ${injectedCount} 个查询按钮`);
        refreshTeacherRatings(injectedRecords);
      }
    }

    mutationBatchCount = 0;
  }

  function handleMutations(mutations) {
    let relevantCount = 0;
    mutations.forEach((mutation) => {
      if (isTeacherRelevantMutation(mutation)) {
        relevantCount += 1;
      }
    });
    if (relevantCount === 0) {
      return;
    }
    mutationBatchCount += relevantCount;

    if (debounceTimer === null) {
      const scheduledAt = Date.now();
      const tryFlush = () => {
        debounceTimer = null;
        if (Date.now() - scheduledAt >= MAX_FLUSH_DELAY_MS) {
          flushPendingScan();
        } else {
          debounceTimer = setTimeout(tryFlush, SCAN_DEBOUNCE_MS);
        }
      };
      debounceTimer = setTimeout(tryFlush, SCAN_DEBOUNCE_MS);
    }
  }

  function attachObserver() {
    if (observer !== null) {
      observer.disconnect();
    }
    const root = document.documentElement;
    if (root === null) {
      return;
    }
    observer = new MutationObserver(handleMutations);
    observer.observe(root, OBSERVER_CONFIG);
    observedRoot = root;
  }

  function ensureObserverAttached() {
    const root = document.documentElement;
    if (observer !== null && root === observedRoot) {
      return;
    }
    if (root === null) {
      return;
    }
    log("页面文档已重建，重新挂载动态监听并重新扫描");
    attachObserver();
    mutationBatchCount += 1;
    if (debounceTimer === null) {
      debounceTimer = setTimeout(flushPendingScan, SCAN_DEBOUNCE_MS);
    }
  }

  function startDomObserver() {
    attachObserver();
    log("动态页面监听已启动，等待课程展开后的 DOM 变化");
    setInterval(ensureObserverAttached, WATCHDOG_INTERVAL_MS);
  }

  function runInitialTeacherScan() {
    log("开始初始教师识别扫描");
    const records = runTeacherScan();
    logDetectedTeachers(records);
    const teacherCount = records.reduce(
      (sum, record) => sum + record.names.length,
      0
    );
    const { injectedRecords, injectedCount } = processTeacherRecords(records);
    log(`初始教师识别扫描完成：${records.length} 个教学班行，共 ${teacherCount} 位教师，注入 ${injectedCount} 个查询按钮`);
    refreshTeacherRatings(injectedRecords);
  }

  function init() {
    log("插件已启动");
    startDomObserver();
    runInitialTeacherScan();
  }

  init();
})();

importScripts("teacher-service.js");
importScripts("cache-service.js");

const LOG_PREFIX = "[ZJU Teacher Helper]";
const QUERY_TIMEOUT_MS = 20000;
const pendingRequests = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.info(`${LOG_PREFIX} Background Service Worker 已安装`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === null || typeof message !== "object") {
    return;
  }

  if (message.type === "ZJU_TEACHER_HELPER_QUERY") {
    const college = message.college || null;
    const includeReviews = message.includeReviews === true;
    const requestKey = ZJUTeacherCache.cacheKey(
      message.name,
      college,
      includeReviews
    );

    withTimeout(
      ZJUTeacherCache.getCachedTeacherQuery(message.name, college, includeReviews),
      QUERY_TIMEOUT_MS,
      "缓存查询"
    )
      .then((cached) => {
        if (cached !== null) {
          return cached;
        }
        return getOrStartPendingQuery(
          requestKey,
          message.name,
          college,
          includeReviews
        );
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "ZJU_TEACHER_HELPER_CLEAR_CACHE") {
    ZJUTeacherCache.clearCache()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

function getOrStartPendingQuery(requestKey, name, college, includeReviews) {
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const pending = withTimeout(
    ZJUTeacherService.queryTeacher(name, college, { includeReviews }),
    QUERY_TIMEOUT_MS,
    "教师查询"
  )
    .then((data) => {
      if (data.status === "found" || data.status === "ambiguous") {
        return ZJUTeacherCache.setCachedTeacherQuery(
          name,
          college,
          includeReviews,
          data
        ).then(() => data);
      }
      return data;
    })
    .finally(() => {
      pendingRequests.delete(requestKey);
    });

  pendingRequests.set(requestKey, pending);
  return pending;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}超时`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

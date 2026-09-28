(() => {
  "use strict";

  const QUERY_TYPE = "ZJU_TEACHER_HELPER_QUERY";
  const CLEAR_CACHE_TYPE = "ZJU_TEACHER_HELPER_CLEAR_CACHE";

  function queryTeacher(name, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: QUERY_TYPE,
          name,
          college: options.college || null,
          includeReviews: options.includeReviews === true
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response === undefined || response.ok !== true) {
            reject(new Error(response?.error || "教师查询失败"));
            return;
          }
          resolve(response.data);
        }
      );
    });
  }

  function clearCache() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: CLEAR_CACHE_TYPE }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response === undefined || response.ok !== true) {
          reject(new Error(response?.error || "清空缓存失败"));
          return;
        }
        resolve();
      });
    });
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.teacherServiceClient = { queryTeacher, clearCache };
})();

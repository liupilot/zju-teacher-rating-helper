(() => {
  "use strict";

  const STORAGE_KEY = "zjuTeacherHelperCache";
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  async function getCache() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const cache = stored[STORAGE_KEY];
    return cache !== null && typeof cache === "object" ? cache : {};
  }

  function cacheKey(name, college, includeReviews) {
    const mode = includeReviews ? "reviews" : "summary";
    return `${name}::${college || ""}::${mode}`;
  }

  async function getCachedTeacherQuery(name, college, includeReviews = false) {
    const cache = await getCache();
    const entry = cache[cacheKey(name, college, includeReviews)];
    if (entry === undefined) {
      return null;
    }
    const fetchedAt = Number(entry.fetchedAt || 0);
    if (Date.now() - fetchedAt > CACHE_TTL_MS) {
      return null;
    }
    return entry.data;
  }

  async function setCachedTeacherQuery(
    name,
    college,
    includeReviews,
    data
  ) {
    const cache = await getCache();
    cache[cacheKey(name, college, includeReviews)] = {
      fetchedAt: Date.now(),
      data
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: cache });
  }

  async function clearCache() {
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  const api = {
    getCachedTeacherQuery,
    setCachedTeacherQuery,
    clearCache,
    cacheKey,
    CACHE_TTL_MS
  };
  const target = typeof globalThis !== "undefined" ? globalThis : self;
  target.ZJUTeacherCache = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

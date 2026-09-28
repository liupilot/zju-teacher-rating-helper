# 浙江大学选课老师评价助手 — 六问题修改报告

**修改日期**：2026-08-27
**更新日期**：2026-08-28（新增问题 6）
**依据文档**：`REVIEW_AND_SUGGESTIONS.md`（2026-08-24）
**代码核对**：以 2026-08-28 项目当前代码为准

---

## 总体说明

本报告基于 `REVIEW_AND_SUGGESTIONS.md` 提出的五个问题，并补充一个项目内新发现的 DOM 重建问题，逐项核对当前代码的实际实现，整理六个问题的修改结果。六个问题均已修复，涉及以下文件（当前代码位于 `zju-teacher-rating-helper2.0/` 目录，修复分别于 2026-08-25 与 2026-08-28 落地）：

- `zju-teacher-rating-helper2.0/content/rating-display.js`
- `zju-teacher-rating-helper2.0/background/teacher-service.js`
- `zju-teacher-rating-helper2.0/background/service-worker.js`
- `zju-teacher-rating-helper2.0/content/content.js`
- `zju-teacher-rating-helper2.0/content/teacher-detector.js`
- `zju-teacher-rating-helper2.0/content/query-button.js`

与审查建议相比：问题 1 与问题 5 的实现与建议方案存在实质差异；问题 2、3 与建议方案一致；问题 4 思路一致但实现更完善；问题 6 不在审查文档范围内，以“方案说明（优势与劣势）”记录实际实现。每个问题章节包含问题现象、原修改建议、实际修改与方案对比（问题 6 为方案说明），列出实际方案与建议方案各自的优势与劣势。

---

## 目录

- [问题 1：并发控制缺失导致卡顿（高优先级）](#问题-1并发控制缺失导致卡顿高优先级)
- [问题 2：同一学院评论 CSV 被反复拉取（高优先级）](#问题-2同一学院评论-csv-被反复拉取高优先级)
- [问题 3：查询失败后永久无法重试（中优先级）](#问题-3查询失败后永久无法重试中优先级)
- [问题 4（可选）：背景层缓存雪崩（低优先级）](#问题-4可选背景层缓存雪崩低优先级)
- [问题 5（可选）：queries Map 只增不减（低优先级）](#问题-5可选queries-map-只增不减低优先级)
- [问题 6：点击“查询教学班”后内容区重建导致 MutationObserver 失效（高优先级）](#问题-6点击查询教学班后内容区重建导致-mutationobserver-失效高优先级)
- [总结](#总结)

---

## 问题 1：并发控制缺失导致卡顿（高优先级）

### 问题现象

页面展开多位教师时，`refreshNames` 会同时发起全部查询，例如 15 位教师同时发出 15 个请求，超出浏览器对同一域名的并发连接限制后请求排队，网络稍慢就整体卡顿。

### 原修改建议

审查文档建议在 `refreshNames` 中按 `BATCH_SIZE = 5` 分批，每批 5 个查询用 `Promise.all` 执行，整批完成后进入下一批。

### 实际修改

`zju-teacher-rating-helper2.0/content/rating-display.js` 改为队列式滑动限流：`MAX_CONCURRENT_QUERIES = 5` 控制同时进行的查询数，`runLimited` 负责入队，`drainPendingQueries` 在任务完成或失败后立即补位，`refreshNames` 只负责入队与收尾。

位置：`zju-teacher-rating-helper2.0/content/rating-display.js`，第 6 行（`MAX_CONCURRENT_QUERIES`）、第 53-82 行（`runLimited` / `drainPendingQueries`）、第 97-106 行（`refreshNames` 使用）。

```javascript
const MAX_CONCURRENT_QUERIES = 5;

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
```

```javascript
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
```

### 方案对比（优势与劣势）

- 实际方案（队列式滑动限流）：优势是任务完成即补位，不受批内最慢请求拖累，并发上限稳定，单任务粒度控制更细；劣势是队列机制代码量更大，理解成本略高。
- 建议方案（每批 5 个，整批等待）：优势是实现直观，易读易维护；劣势是每批要等最慢请求完成才启动下一批，批尾存在空闲等待。

---

## 问题 2：同一学院评论 CSV 被反复拉取（高优先级）

### 问题现象

同学院多位教师各自触发 `loadCollegeComments(college)` 时，同一份 `comment_学院.csv` 会被重复拉取多次。

### 原修改建议

为 `loadCollegeComments` 增加结果缓存和进行中 Promise 缓存，与 `loadTeachers`、`loadGpaMap` 保持一致。

### 实际修改

`zju-teacher-rating-helper2.0/background/teacher-service.js` 新增 `collegeCommentsCache` 与 `collegeCommentsPromiseCache` 两个 Map：命中结果缓存直接返回；未命中时复用进行中 Promise；成功后写入结果缓存，失败时删除进行中缓存以便重试。

位置：`zju-teacher-rating-helper2.0/background/teacher-service.js`，第 35-36 行（缓存声明）、第 151-182 行（`loadCollegeComments`）。

```javascript
const collegeCommentsCache = new Map();
const collegeCommentsPromiseCache = new Map();

async function loadCollegeComments(college) {
  if (collegeCommentsCache.has(college)) {
    return collegeCommentsCache.get(college);
  }
  if (collegeCommentsPromiseCache.has(college)) {
    return collegeCommentsPromiseCache.get(college);
  }

  const url = `${DATA_BASE_URL}comment_${encodeURIComponent(college)}.csv`;
  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`加载评论数据失败：HTTP ${response.status}`);
      }
      return response.text();
    })
    .then((text) => {
      const rows = toObjects(
        parseCSV(text.replace(/^\uFEFF/, "")),
        COMMENT_HEADERS
      );
      collegeCommentsCache.set(college, rows);
      return rows;
    })
    .catch((error) => {
      collegeCommentsPromiseCache.delete(college);
      throw error;
    });

  collegeCommentsPromiseCache.set(college, promise);
  return promise;
}
```

### 方案对比（优势与劣势）

- 实际方案与建议方案一致，无对比差异。

---

## 问题 3：查询失败后永久无法重试（中优先级）

### 问题现象

`getQueryPromise` 首次查询失败后，失败结果会永久留在 `queries` Map 中，该教师直到刷新页面都无法重新查询。

### 原修改建议

查询失败时从 `queries` 中删除自身，允许下次重试。

### 实际修改

`zju-teacher-rating-helper2.0/content/rating-display.js` 的 `getQueryPromise` 在 catch 中执行 `queries.delete(name)`，失败结果返回后条目即被移除，下次刷新会重新发起查询。

位置：`zju-teacher-rating-helper2.0/content/rating-display.js`，第 26-51 行（`getQueryPromise`）。

```javascript
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
```

### 方案对比（优势与劣势）

- 实际方案与建议方案一致，无对比差异。

---

## 问题 4（可选）：背景层缓存雪崩（低优先级）

### 问题现象

Service Worker 先查缓存、未命中再查网络；缓存写入完成前，多个相同查询会各自发起网络请求。

### 原修改建议

在消息处理中加入简单请求去重，按 `name::college::includeReviews` 拼接字符串作为键。

### 实际修改

`zju-teacher-rating-helper2.0/background/service-worker.js` 新增 `pendingRequests` Map，用 `ZJUTeacherCache.cacheKey(name, college, includeReviews)` 生成与缓存层一致的键；`getOrStartPendingQuery` 复用进行中请求，并在 `finally` 中清理；整个查询流程外层套 20 秒超时。

位置：`zju-teacher-rating-helper2.0/background/service-worker.js`，第 6 行（`pendingRequests`）、第 20-24 行（`requestKey`）、第 55-82 行（`getOrStartPendingQuery`）。

```javascript
const pendingRequests = new Map();

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
```

### 方案对比（优势与劣势）

- 实际方案（思路一致，实现更完善）：优势是键复用缓存层 `cacheKey`，避免键格式漂移；`finally` 保证成功与异常路径都会清理；超时覆盖缓存读取后的完整查询流程。劣势是比建议方案多一层函数封装。
- 建议方案（消息处理内直接拼接字符串去重）：优势是代码更短；劣势是键格式与缓存键各自维护，且未显式说明清理时机。

---

## 问题 5（可选）：queries Map 只增不减（低优先级）

### 问题现象

`queries` Map 只在页面刷新时清空，长时间切换课程后条目持续增长。

### 原修改建议

在 `refreshNames` 开始时清空一次，或忽略该问题。

### 实际修改

`zju-teacher-rating-helper2.0/content/rating-display.js` 将 `queries` 改为带 LRU 语义的有界缓存：命中时删除并重新插入以刷新位置；插入后超过 `MAX_QUERY_CACHE_SIZE = 200` 时淘汰最久未用键。

位置：`zju-teacher-rating-helper2.0/content/rating-display.js`，第 7 行（`MAX_QUERY_CACHE_SIZE`）、第 27-31 行（命中刷新）、第 46-48 行（淘汰）。

```javascript
if (queries.has(name)) {
  const promise = queries.get(name);
  queries.delete(name);
  queries.set(name, promise);
  return promise;
}

if (queries.size > MAX_QUERY_CACHE_SIZE) {
  queries.delete(queries.keys().next().value);
}
```

### 方案对比（优势与劣势）

- 实际方案（LRU 上限 200）：优势是最近查询结果跨刷新复用，减少重复请求，内存有界；劣势是实现更复杂，最多保留 200 条进行中 Promise 记录。
- 建议方案（每次刷新时清空）：优势是实现最简单，每次刷新内存归零；劣势是每次刷新都会重复查询已查教师，浪费请求，单页长时间操作期间仍可能累积。

---

## 问题 6：点击“查询教学班”后内容区重建导致 MutationObserver 失效（高优先级）

### 问题现象

点击选课页的“查询教学班”后，网站会重建整个内容区；重建后的 DOM 不再属于原观察器挂载的那棵文档树，扩展挂载在旧根节点上的 `MutationObserver` 从此失效，教师识别与评分标签注入停止工作。

### 原因分析

插件观察的是 `document.documentElement` 根节点（`content.js` 的 `attachObserver`）。站点重建内容区时，重建后的 DOM 脱离了原观察根节点所在文档树，旧根节点不再产生 DOM 变更事件，观察器收不到后续变化，也没有机制触发新的教师扫描。

### 实际修改

`zju-teacher-rating-helper2.0/content/content.js` 增加“根节点看门狗”：`ensureObserverAttached` 每秒检查一次 `document.documentElement` 是否仍是 `observedRoot`；若根节点已被替换，先 `disconnect()` 旧观察器，再对新根重新 `observe()`，并主动触发一次教师扫描，恢复教师识别与按钮注入。

位置：`zju-teacher-rating-helper2.0/content/content.js`，第 13 行（`WATCHDOG_INTERVAL_MS`）、第 189-200 行（`attachObserver`）、第 202-216 行（`ensureObserverAttached`）、第 218-222 行（`startDomObserver`）。

```javascript
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
```

配套修改：

- `content.js` 第 79-87 行：`runTeacherScan` 每次扫描前调用 `detector.resetProcessedRows()`，保证重建后的行能重新识别。
- `teacher-detector.js` 第 105-107 行：新增 `resetProcessedRows()`，重置已处理行集合。
- `query-button.js` 第 119-148 行：`inject` 先移除失配的旧按钮，再通过 `findExistingButton` 去重，避免重建后重复注入按钮。
- `content.js` 第 27-39 行：`isOwnNode` 过滤插件自身注入节点与弹窗 Shadow DOM，避免观察器重挂后的自我触发死循环。

### 方案说明（优势与劣势）

- 优势：根节点替换后 1 秒内自动恢复监听并主动重扫，教师按钮和评分标签无需刷新页面即可恢复；观察根固定在 `document.documentElement`，不依赖具体容器选择器；配合重置已处理行和旧按钮清理，重扫不会重复注入；主动重扫不依赖后续 DOM 变更。
- 劣势：每秒轮询一次根节点引用，存在少量常驻定时开销；看门狗只比较根节点引用，若站点仅重建根节点内部子树而未替换根节点，需要依赖 MutationObserver 自身继续工作，看门狗不会介入；根节点重建后需做一次全量扫描，教师较多时扫描成本略高（已有防抖和行去重兜底）。

---

## 总结

| 问题 | 优先级 | 修改文件 | 修复状态 | 与建议方案一致性 |
|------|:------:|----------|:--------:|:----------------:|
| 并发控制缺失导致卡顿 | 高 | `zju-teacher-rating-helper2.0/content/rating-display.js` | 已修复 | 有差异（队列式滑动限流） |
| 同一学院评论 CSV 被反复拉取 | 高 | `zju-teacher-rating-helper2.0/background/teacher-service.js` | 已修复 | 一致 |
| 查询失败后永久无法重试 | 中 | `zju-teacher-rating-helper2.0/content/rating-display.js` | 已修复 | 一致 |
| 背景层缓存雪崩 | 低 | `zju-teacher-rating-helper2.0/background/service-worker.js` | 已修复 | 思路一致，实现更完善 |
| queries Map 只增不减 | 低 | `zju-teacher-rating-helper2.0/content/rating-display.js` | 已修复 | 有差异（LRU 上限 200） |
| 内容区重建导致 MutationObserver 失效 | 高 | `zju-teacher-rating-helper2.0/content/` 下三个内容脚本 | 已修复 | 不适用（新增问题，方案说明） |

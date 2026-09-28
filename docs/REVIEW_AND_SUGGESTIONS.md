# 浙江大学选课老师评价助手 — 代码审查与修改建议

**审查人**：外部评审（匿名）  
**项目作者**：liupilot（农工创新班）  
**审查日期**：2026-08-24

---

## 总体评价

代码架构清晰、模块划分合理、错误处理覆盖全面、产品细节到位。作为一个大一新生独立完成的作品，质量远高于平均水平，达到了可交付的工程级水准。以下是体验过程中发现的几个可以改进的问题，按优先级排列。

---

## 目录

- [问题 1：并发控制缺失导致卡顿（高优先级）](#问题-1并发控制缺失导致卡顿高优先级)
- [问题 2：同一学院评论 CSV 被反复拉取（高优先级）](#问题-2同一学院评论-csv-被反复拉取高优先级)
- [问题 3：查询失败后永久无法重试（中优先级）](#问题-3查询失败后永久无法重试中优先级)
- [问题 4（可选）：背景层缓存雪崩（低优先级）](#问题-4可选背景层缓存雪崩低优先级)
- [问题 5（可选）：queries Map 只增不减（低优先级）](#问题-5可选queries-map-只增不减低优先级)
- [其他小建议](#其他小建议)

---

## 问题 1：并发控制缺失导致卡顿（高优先级）

### 现象

`content/rating-display.js` 中的 `refreshNames` 函数使用 `Promise.all` 同时发起所有教师的查询。如果选课页上展开后显示 15 位教师，15 个请求会同时发出。

浏览器对同一域名有并发连接数限制（通常 6 个），多出来的请求会排队等待。再加上 Service Worker 的 `withTimeout` 设了 20 秒超时，如果网络慢，全部请求挤在一起就会整体卡顿。

### 影响

- 所有用户都会感受到卡顿
- 教师越多越明显
- 多人同时使用时，查老师服务器压力也会增大

### 位置

`content/rating-display.js`，`refreshNames` 函数（约第 36-53 行）

### 修改建议

加一个并发控制，每批只发 5 个查询，等这批完成再发下一批：

```javascript
async function refreshNames(names) {
  const uniqueNames = [...new Set(names.filter((name) => name !== ""))];
  const injector = window.ZJUTeacherHelper?.queryButtonInjector;
  if (uniqueNames.length === 0 || injector === undefined || getClient() === undefined) {
    return;
  }

  log(`开始刷新 ${uniqueNames.length} 位教师的评分标签`);

  const BATCH_SIZE = 5;  // 每批 5 个，可酌情调整
  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (name) => {
        const buttons = findButtonsByName(name);
        buttons.forEach((button) => injector.setLoading(button));
        const result = await getQueryPromise(name);
        findButtonsByName(name).forEach((button) =>
          injector.applyResult(button, result)
        );
      })
    );
  }
}
```

---

## 问题 2：同一学院评论 CSV 被反复拉取（高优先级）

### 现象

`background/teacher-service.js` 中的 `loadCollegeComments` 函数没有做缓存。如果 15 位教师中有 8 位来自同一个学院（比如"计算机科学与技术学院"），`comment_计算机科学与技术学院.csv` 这个文件会被拉取 8 次，每次内容完全一样。

有意思的是，`loadTeachers()` 和 `loadGpaMap()` 这两个函数都有单例缓存（一次请求后缓存结果），但 `loadCollegeComments` 没有，可能是一时疏忽。

### 影响

- 加重卡顿，浪费带宽
- 增大查老师服务器的压力

### 位置

`background/teacher-service.js`，`loadCollegeComments` 函数（约第 149-159 行）

### 修改建议

添加单例缓存，与 `loadTeachers` 和 `loadGpaMap` 保持一致：

```javascript
// 文件顶部（约第 34 行附近）添加两个缓存变量
const collegeCommentsCache = new Map();
const collegeCommentsPromiseCache = new Map();

// 修改 loadCollegeComments 函数
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
      const result = toObjects(
        parseCSV(text.replace(/^\uFEFF/, "")),
        COMMENT_HEADERS
      );
      collegeCommentsCache.set(college, result);
      return result;
    })
    .catch((error) => {
      collegeCommentsPromiseCache.delete(college);
      throw error;
    });

  collegeCommentsPromiseCache.set(college, promise);
  return promise;
}
```

---

## 问题 3：查询失败后永久无法重试（中优先级）

### 现象

`content/rating-display.js` 中定义了一个全局的 `queries` Map：

```javascript
const queries = new Map();

function getQueryPromise(name) {
  if (!queries.has(name)) {
    const promise = getClient()
      .queryTeacher(name)
      .catch((error) => ({
        status: "error",
        name,
        error: String(error)
      }));
    queries.set(name, promise);
  }
  return queries.get(name);
}
```

第一次查询的结果（无论成功还是失败）会被永久缓存。如果某个教师第一次查询时网络抖动了一下，返回了 `{status: "error"}`，那么直到用户刷新整个页面，这个教师永远不会再发起新查询了。

### 影响

- 网络不稳定时体验较差
- 用户在页面上的操作都无法恢复该教师的查询结果

### 位置

`content/rating-display.js`，`queries` Map 和 `getQueryPromise` 函数（约第 6 行、第 22-33 行）

### 修改建议

查询失败时从 Map 中删除自己，允许下次重试：

```javascript
function getQueryPromise(name) {
  if (!queries.has(name)) {
    const promise = getClient()
      .queryTeacher(name)
      .catch((error) => {
        queries.delete(name);  // 失败后移除，允许重试
        return {
          status: "error",
          name,
          error: String(error)
        };
      });
    queries.set(name, promise);
  }
  return queries.get(name);
}
```

---

## 问题 4（可选）：背景层缓存雪崩（低优先级）

### 现象

`background/service-worker.js` 中，先查缓存，没命中再去查网络。如果两个教师同时发起查询，且都错过了缓存（因为第一个查询的结果还没写完缓存），两个请求都会发出去。

### 影响

- 多了一次不必要的网络请求
- 不会写坏数据（后写的覆盖前面的），影响很小

### 位置

`background/service-worker.js`，消息处理部分（约第 16-49 行）

### 修改建议

加一个简单的请求去重：

```javascript
// 文件顶部添加
const pendingRequests = new Map();

// 在消息处理中，对同一个查询做去重
const requestKey = `${message.name}::${college}::${includeReviews}`;
if (pendingRequests.has(requestKey)) {
  return pendingRequests.get(requestKey);
}
```

---

## 问题 5（可选）：queries Map 只增不减（低优先级）

### 现象

`queries` Map 只在页面刷新时清空。如果用户在选课页上长时间操作、切换不同课程，Map 里的条目会越来越多。

### 影响

- 量很小（几十到几百个 key），不会造成实质性问题
- 理论上不够干净

### 修改建议

可以在 `refreshNames` 开始时清空一次，或者不管它，影响极小。

---

## 其他小建议

1. 如果以后打算上架 Chrome 扩展商店，可以考虑把 `manifest.json` 中的 `version` 升到 `0.2.0`，因为已经远超最初的 MVP 了。

2. 关键词分析器（`keyword-analyzer.js`）的 23 条规则目前是硬编码的，如果未来想扩展，可以做成可配置的 JSON 文件，方便维护。

---

## 总结

| 问题 | 严重程度 | 建议优先级 |
|------|:-------:|:---------:|
| 并发控制缺失导致卡顿 | 高 | 优先修改 |
| 评论 CSV 被反复拉取 | 高 | 优先修改 |
| 查询失败后不可重试 | 中 | 建议修改 |
| 背景层缓存雪崩 | 低 | 可选 |
| queries Map 只增不减 | 低 | 可选 |

以上三个高/中优先级问题改完后，这个插件在多人同时使用的情况下就很稳了。整体来说是一个非常好的作品，祝越做越好 💪
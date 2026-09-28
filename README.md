# 浙江大学选课老师评价助手

ZJU Teacher Rating Helper 是一个 Chrome/Edge Manifest V3 浏览器扩展，帮助浙江大学学生在选课页面直接查看查老师网站的教师评价，无需复制姓名、打开网站、粘贴搜索。

## 功能

- 自动识别课程教学班表格中的教师姓名
- 每位教师旁边显示评分与评价人数，或“同名 N 位”/“未找到”状态
- 点击评分标签打开插件自己的评价弹窗，显示：
  - 教师姓名、学院
  - 综合评分、评价人数
  - 开设课程与绩点
  - 最新 5 条评价
  - “评价中常提到”关键词（纯本地规则，不包装成客观事实）
- “查看完整评价”跳转到查老师网站并自动填入教师姓名搜索
- 同名教师不自动选择，弹窗内提供候选列表
- 查询结果使用 `chrome.storage.local` 缓存 24 小时

## 项目结构

```text
zju-teacher-rating-helper/
├── manifest.json
├── README.md
├── LICENSE
├── .gitignore
├── background/
│   ├── service-worker.js
│   ├── teacher-service.js
│   └── cache-service.js
├── content/
│   ├── content.js
│   ├── teacher-detector.js
│   ├── query-button.js
│   ├── teacher-service-client.js
│   ├── rating-display.js
│   ├── keyword-analyzer.js
│   ├── review-modal.js
│   ├── chalaoshi-search.js
│   └── teacher-helper.css
└── docs/
    ├── 整体技术报告-选课老师评价助手2.0.md
    ├── MODIFICATION_REPORT.md
    └── REVIEW_AND_SUGGESTIONS.md
```

## 项目文档

- [整体技术报告](docs/整体技术报告-选课老师评价助手2.0.md)：架构与数据流、模块实现、关键设计决策、迭代复盘
- [修改报告](docs/MODIFICATION_REPORT.md)：代码审查提出的六个问题的修复记录
- [代码审查与修改建议](docs/REVIEW_AND_SUGGESTIONS.md)：外部审查意见原文（问题均已修复）

## 数据来源

插件读取查老师网站公开的静态数据文件：

- `https://chalaoshi.netlify.app/cls/teachers.csv`：姓名、学院、评分、评价人数等
- `https://chalaoshi.netlify.app/cls/gpa.json`：开设课程与绩点
- `https://chalaoshi.netlify.app/cls/comment_{学院}.csv`：教师评论

查老师网站没有后端 API，插件在 background service worker 中直接读取这些公开文件。

## 安装方法

### Chrome 安装

1. 打开 `chrome://extensions`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目 `zju-teacher-rating-helper` 文件夹

### Edge 安装

1. 打开 `edge://extensions`
2. 开启左侧“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择本项目 `zju-teacher-rating-helper` 文件夹

## 测试方法

1. 安装扩展后打开 `https://zdbk.zju.edu.cn/`
2. 展开任意课程，等待教学班表格出现
3. 教师姓名旁应出现“⭐ 查询评价”按钮，随后自动显示评分标签
4. 点击评分标签打开评价弹窗
5. 同名教师会在弹窗中列出候选，选择后查看对应教师详情
6. 点击“查看完整评价”验证新标签页跳转与自动搜索
7. 在扩展详情页打开 Service Worker 控制台，可执行 `ZJUTeacherCache.clearCache()` 清空缓存

## 常见问题

- 看不到按钮：确认扩展已加载，当前页面为 `https://zdbk.zju.edu.cn/`，并等待课程展开后的扫描
- 显示“查询失败”：查老师网站暂时无法访问或网络异常，稍后会自动重试
- 显示“同名 N 位”：查老师数据中存在多位同名教师，需要在弹窗中选择
- 显示“未找到”：查老师数据集中暂无该教师
- 页面结构变化：控制台会提示“选课页面结构可能已变化”，需要更新识别规则

## 已知限制

- 识别依赖当前选课页真实 DOM 结构：`table.table.table-hover`、`tbody tr.body_tr`、`td.jsxm` 和表头“教师”
- 查老师网站没有教师详情页 URL，只能跳转到自动搜索页
- 查老师数据是公开静态文件快照，不是实时数据库，评论更新取决于站长更新文件
- 同名且同学院的教师仍无法区分时，候选列表需要人工确认
- 查询结果缓存 24 小时，缓存期内不重新拉取数据

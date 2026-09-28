(() => {
  "use strict";

  const DATA_BASE_URL = "https://chalaoshi.netlify.app/cls/";
  const TEACHER_CSV_URL = `${DATA_BASE_URL}teachers.csv`;
  const GPA_JSON_URL = `${DATA_BASE_URL}gpa.json`;
  const DEFAULT_REVIEW_LIMIT = 20;

  const TEACHER_HEADERS = [
    "id",
    "姓名",
    "学院",
    "热度",
    "评分人数",
    "评分",
    "拼音",
    "拼音缩写"
  ];

  const COMMENT_HEADERS = [
    "评论id",
    "老师id",
    "老师姓名",
    "发表时间",
    "点赞减去点踩数量",
    "点赞量",
    "点踩量",
    "内容"
  ];

  let teacherRows = null;
  let teacherRowsPromise = null;
  let gpaMap = null;
  let gpaMapPromise = null;
  const collegeCommentsCache = new Map();
  const collegeCommentsPromiseCache = new Map();

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") {
          i += 1;
        }
        row.push(field);
        field = "";
        if (row.some((cell) => cell.trim() !== "")) {
          rows.push(row);
        }
        row = [];
      } else {
        field += char;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
    }
    return rows;
  }

  function toObjects(rows, headers) {
    return rows.map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index] !== undefined ? row[index] : "";
      });
      return object;
    });
  }

  async function loadTeachers() {
    if (teacherRows !== null) {
      return teacherRows;
    }
    if (teacherRowsPromise === null) {
      teacherRowsPromise = fetch(TEACHER_CSV_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`加载教师数据失败：HTTP ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          teacherRows = toObjects(
            parseCSV(text.replace(/^\uFEFF/, "")),
            TEACHER_HEADERS
          );
          return teacherRows;
        })
        .catch((error) => {
          teacherRowsPromise = null;
          throw error;
        });
    }
    return teacherRowsPromise;
  }

  async function loadGpaMap() {
    if (gpaMap !== null) {
      return gpaMap;
    }
    if (gpaMapPromise === null) {
      gpaMapPromise = fetch(GPA_JSON_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`加载绩点数据失败：HTTP ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          gpaMap = data;
          return gpaMap;
        })
        .catch((error) => {
          gpaMapPromise = null;
          throw error;
        });
    }
    return gpaMapPromise;
  }

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

  function teacherToSummary(teacher) {
    return {
      id: teacher.id,
      name: teacher.姓名,
      college: teacher.学院,
      rating: Number(teacher.评分) || 0,
      reviewCount: Number(teacher.评分人数) || 0,
      pinyin: teacher.拼音,
      pinyinAbbr: teacher.拼音缩写
    };
  }

  function buildSearchUrl(name) {
    const url = new URL("https://chalaoshi.netlify.app/");
    url.searchParams.set("zju_teacher", name);
    return url.toString();
  }

  function buildResult({
    status,
    confidence,
    name,
    college = null,
    teacher = null,
    candidates = [],
    courses = [],
    reviews = []
  }) {
    const result = {
      status,
      confidence,
      name,
      college,
      rating: null,
      reviewCount: null,
      courses,
      reviews,
      url: buildSearchUrl(name),
      updatedAt: new Date().toISOString()
    };

    if (teacher !== null) {
      result.college = teacher.学院;
      result.rating = Number(teacher.评分);
      result.reviewCount = Number(teacher.评分人数);
    }
    if (candidates.length > 0) {
      result.candidates = candidates;
    }
    return result;
  }

  async function fetchReviews(teacher, limit = DEFAULT_REVIEW_LIMIT) {
    const rows = await loadCollegeComments(teacher.学院);
    const teacherId = String(teacher.id);

    return rows
      .filter((row) => String(row.老师id) === teacherId)
      .map((row) => ({
        id: row.评论id,
        teacherName: row.老师姓名,
        time: row.发表时间,
        netUpvotes: Number(row.点赞减去点踩数量) || 0,
        upvotes: Number(row.点赞量) || 0,
        downvotes: Number(row.点踩量) || 0,
        content: row.内容.replace(/\\n/g, "\n").trim()
      }))
      .sort((a, b) => (a.time < b.time ? 1 : -1))
      .slice(0, limit);
  }

  async function matchTeacher(name, college = null) {
    const teachers = await loadTeachers();
    const candidates = teachers.filter((teacher) => teacher.姓名 === name);

    if (candidates.length === 0) {
      return {
        status: "not_found",
        confidence: "none",
        selected: null,
        candidates: []
      };
    }

    if (college !== null && college !== "") {
      const collegeMatches = candidates.filter(
        (teacher) => teacher.学院 === college
      );
      if (collegeMatches.length === 1) {
        return {
          status: "found",
          confidence: "high",
          selected: collegeMatches[0],
          candidates
        };
      }
      if (collegeMatches.length > 1) {
        return {
          status: "ambiguous",
          confidence: "medium",
          selected: null,
          candidates: collegeMatches
        };
      }
      // 提供了学院但没有匹配项时，不自动选择其他学院的同名教师。
      return {
        status: "ambiguous",
        confidence: "medium",
        selected: null,
        candidates
      };
    }

    if (candidates.length === 1) {
      return {
        status: "found",
        confidence: "medium",
        selected: candidates[0],
        candidates
      };
    }

    return {
      status: "ambiguous",
      confidence: "medium",
      selected: null,
      candidates
    };
  }

  async function queryTeacher(name, college = null, options = {}) {
    const match = await matchTeacher(name, college);

    if (match.status === "not_found") {
      return buildResult({
        status: match.status,
        confidence: match.confidence,
        name,
        college
      });
    }

    if (match.status === "ambiguous" || match.selected === null) {
      return buildResult({
        status: match.status,
        confidence: match.confidence,
        name,
        college,
        candidates: match.candidates.map(teacherToSummary)
      });
    }

    const selected = match.selected;
    const courses = [];
    try {
      const gpa = await loadGpaMap();
      const gpaEntries =
        gpa[selected.姓名] || gpa[selected.姓名.toUpperCase()] || [];
      gpaEntries.forEach((entry) => {
        courses.push({
          course: entry[0],
          gpa: entry[1],
          students: entry[2],
          passRate: entry[3]
        });
      });
    } catch {
      // 绩点数据加载失败时不阻塞主查询结果。
    }

    let reviews = [];
    if (options.includeReviews === true) {
      reviews = await fetchReviews(selected).catch(() => []);
    }

    return buildResult({
      status: match.status,
      confidence: match.confidence,
      name: selected.姓名,
      teacher: selected,
      courses,
      reviews
    });
  }

  const api = {
    queryTeacher,
    matchTeacher,
    fetchReviews,
    loadTeachers,
    parseCSV
  };
  const target = typeof globalThis !== "undefined" ? globalThis : self;
  target.ZJUTeacherService = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();

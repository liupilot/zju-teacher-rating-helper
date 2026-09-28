(() => {
  "use strict";

  const TEACHER_HEADER_TEXT = "教师";
  let processedRows = new WeakSet();

  function findTeacherColumnIndex(table) {
    const headerRow = table.querySelector("thead tr");
    if (headerRow === null) {
      return -1;
    }

    const headers = headerRow.querySelectorAll("th");
    for (let i = 0; i < headers.length; i += 1) {
      if (headers[i].textContent.trim() === TEACHER_HEADER_TEXT) {
        return i;
      }
    }
    return -1;
  }

  function getRows(table) {
    const rows = table.querySelectorAll("tbody tr.body_tr");
    if (rows.length > 0) {
      return rows;
    }
    return table.querySelectorAll("tr.body_tr");
  }

  function extractTeacherNames(cell) {
    const anchor = cell.querySelector("a");
    const container = anchor !== null ? anchor : cell;
    const names = [];
    let current = "";

    for (const node of container.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        current += node.textContent;
      } else if (node.nodeName === "BR") {
        if (current.trim() !== "") {
          names.push(current.trim());
        }
        current = "";
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList.contains("zju-teacher-helper-query-button")
      ) {
        // 插件注入的按钮文本不属于教师姓名，跳过。
      } else {
        current += node.textContent;
      }
    }

    if (current.trim() !== "") {
      names.push(current.trim());
    }
    return names;
  }

  function scanTable(table) {
    if (findTeacherColumnIndex(table) === -1) {
      return [];
    }

    const rows = getRows(table);
    const records = [];

    rows.forEach((row) => {
      if (processedRows.has(row)) {
        return;
      }

      // 真实表格的行内存在隐藏列（如 td.xkkh），表头序号不能直接对应
      // 单元格序号，因此用真实出现的 td.jsxm 定位教师单元格。
      const cell = row.querySelector("td.jsxm");
      if (cell === null) {
        return;
      }

      const names = extractTeacherNames(cell);
      if (names.length === 0) {
        return;
      }

      const anchor = cell.querySelector("a");
      processedRows.add(row);
      records.push({
        table,
        row,
        cell,
        names,
        rowIndex: row.rowIndex,
        teachers: names.map((name) => ({
          name,
          element: anchor !== null ? anchor : cell,
          rowIndex: row.rowIndex,
          cellElement: cell
        }))
      });
    });

    return records;
  }

  function resetProcessedRows() {
    processedRows = new WeakSet();
  }

  function scanPage() {
    const tables = document.querySelectorAll("table.table.table-hover");
    const records = [];

    tables.forEach((table) => {
      records.push(...scanTable(table));
    });

    return records;
  }

  function getPageDiagnostics() {
    const tables = document.querySelectorAll("table.table.table-hover");
    let teacherHeaders = 0;
    let bodyRows = 0;
    let teacherCells = 0;

    tables.forEach((table) => {
      if (findTeacherColumnIndex(table) !== -1) {
        teacherHeaders += 1;
      }
      const rows = getRows(table);
      bodyRows += rows.length;
      rows.forEach((row) => {
        if (row.querySelector("td.jsxm") !== null) {
          teacherCells += 1;
        }
      });
    });

    return {
      tablesFound: tables.length,
      teacherHeaders,
      bodyRows,
      teacherCells
    };
  }

  const api = (window.ZJUTeacherHelper = window.ZJUTeacherHelper || {});
  api.teacherDetector = { scanPage, getPageDiagnostics, resetProcessedRows };
})();

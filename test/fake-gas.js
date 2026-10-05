// Minimal in-memory stand-in for the Apps Script services used by backend/Code.gs,
// so the real server code can run under Node (unit tests and the browser e2e mock).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeSheet(name) {
  const rows = []; // rows[r][c], 0-based
  const sheet = {
    name,
    rows,
    getName: () => sheet.name,
    setName(n) { sheet.name = n; return sheet; },
    getLastRow: () => rows.length,
    getMaxRows: () => Math.max(rows.length, 1000),
    appendRow(values) { rows.push(values.slice()); return sheet; },
    setFrozenRows() { return sheet; },
    setRightToLeft() { return sheet; },
    getRange(row, col, numRows = 1, numCols = 1) {
      const cell = (r, c) => {
        const v = (rows[r - 1] || [])[c - 1];
        return v === undefined ? '' : typeof v === 'string' && v[0] === "'" ? v.slice(1) : v;
      };
      const range = {
        getValue: () => cell(row, col),
        getValues: () => Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (_, j) => cell(row + i, col + j))),
        setValue(v) { return range.setValues([[v]]); },
        setValues(vals) {
          vals.forEach((r, i) => r.forEach((v, j) => {
            while (rows.length < row + i) rows.push([]);
            rows[row + i - 1][col + j - 1] = v;
          }));
          return range;
        },
        setFontWeight: () => range,
        createTextFinder(text) {
          let whole = false;
          const finder = {
            matchEntireCell(b) { whole = b; return finder; },
            findNext() {
              for (let i = 0; i < numRows; i++) {
                for (let j = 0; j < numCols; j++) {
                  const v = String(cell(row + i, col + j));
                  if (whole ? v === text : v.includes(text)) return { getRow: () => row + i };
                }
              }
              return null;
            },
          };
          return finder;
        },
      };
      return range;
    },
  };
  return sheet;
}

function loadBackend(ownerKey) {
  const sheets = [makeSheet('Sheet1')];
  const ss = {
    getSheets: () => sheets,
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    insertSheet(n) { const s = makeSheet(n); sheets.push(s); return s; },
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    JSON, Date, Math, String, Number,
  };
  vm.createContext(context);
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8')
    .replace("'__OWNER_KEY__'", JSON.stringify(ownerKey));
  vm.runInContext(src, context);

  return {
    ss,
    // Same entry point Google calls for a POST
    post(body) {
      const out = context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
      return JSON.parse(out.content);
    },
  };
}

module.exports = { loadBackend };

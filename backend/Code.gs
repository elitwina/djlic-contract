/**
 * DJ LIC – שרת ההסכמים (Google Apps Script, מוצמד לגיליון Google).
 * כל הסכם נשמר כשורה בגיליון "הסכמים". האפליקציה פונה לכתובת /exec של הפריסה.
 *
 * פעולות (POST עם JSON בגוף הבקשה, שדה a):
 *   get  {k}            – קריאת הסכם (לכל מי שיש לו את הקישור)
 *   sign {k, data}      – חתימת הלקוח, פעם אחת בלבד
 *   save {key, data}    – יצירה/עדכון של הסכם שטרם נחתם (בעלים בלבד)
 *   list {key}          – רשימת ההסכמים (בעלים בלבד)
 *   ping {key}          – בדיקת קוד הבעלים
 */
var OWNER_KEY = '__OWNER_KEY__';
var SHEET_NAME = 'הסכמים';
var HEADERS = ['מזהה', 'עודכן', 'סטטוס', 'מזמינים', 'סוג האירוע', 'תאריך האירוע', 'מקום', 'מחיר', 'נשלח לטלפון',
  'שם החותם', 'ת״ז', 'טלפון', 'נחתם בתאריך', 'נתונים (לא לערוך)'];
var COL = { k: 1, updated: 2, status: 3, cn: 10, json: 14 };
var MAX_SIG = 20000;

function doGet(e) {
  return respond(function () { return route((e && e.parameter) || {}); });
}

function doPost(e) {
  return respond(function () {
    return route(JSON.parse((e && e.postData && e.postData.contents) || '{}'));
  });
}

// Run once from the editor to create the sheet and grant permissions
function setup() {
  sheet_();
}

function respond(fn) {
  var out;
  try {
    out = fn();
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function route(req) {
  switch (req.a) {
    case 'get': return getContract_(req.k);
    case 'sign': return signContract_(req.k, req.data);
    case 'save': requireOwner_(req); return saveContract_(req.data);
    case 'list': requireOwner_(req); return listContracts_();
    case 'ping': requireOwner_(req); return { ok: true };
    default: return { ok: false, error: 'unknown action' };
  }
}

function requireOwner_(req) {
  if (!req.key || req.key !== OWNER_KEY) throw new Error('unauthorized');
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    var sheets = ss.getSheets();
    sh = sheets.length === 1 && sheets[0].getLastRow() === 0 ? sheets[0].setName(SHEET_NAME) : ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function findRow_(sh, k) {
  if (!k) return 0;
  var hit = sh.getRange(1, COL.k, sh.getMaxRows(), 1).createTextFinder(String(k)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function readData_(sh, row) {
  return JSON.parse(sh.getRange(row, COL.json).getValue() || '{}');
}

function clean_(v, max) {
  return String(v == null ? '' : v).slice(0, max);
}

// Text cells get a leading apostrophe so Sheets keeps "000123" / "050-..." / "=..." as plain text
function txt_(v) {
  return v === '' ? '' : "'" + v;
}

function fmtDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}

function getContract_(k) {
  var sh = sheet_();
  var row = findRow_(sh, k);
  if (!row) return { ok: false, error: 'not found' };
  return { ok: true, data: readData_(sh, row) };
}

function saveContract_(input) {
  input = input || {};
  var k = clean_(input.k, 40);
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(k)) throw new Error('bad id');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var row = findRow_(sh, k);
    if (row && readData_(sh, row).cs) return { ok: false, error: 'already signed' };
    var data = {
      k: k,
      n: clean_(input.n, 200),
      t: clean_(input.t, 60),
      d: /^\d{4}-\d{2}-\d{2}$/.test(input.d) ? input.d : '',
      p: clean_(input.p, 200),
      pr: Math.max(0, Math.round(Number(input.pr) || 0)),
      cn: clean_(input.cn, 200),
      w: clean_(input.w, 30),
      ds: clean_(input.ds, MAX_SIG),
      dt: Date.now(),
    };
    if (!data.n || !data.d || !data.ds) throw new Error('missing fields');
    var values = [k, new Date(), 'ממתין לחתימה', txt_(data.n), txt_(data.t), fmtDate_(data.d), txt_(data.p), data.pr,
      txt_(data.w), txt_(data.cn), '', '', '', JSON.stringify(data)];
    if (row) sh.getRange(row, 1, 1, values.length).setValues([values]);
    else sh.appendRow(values);
    return { ok: true, data: data };
  } finally {
    lock.releaseLock();
  }
}

function signContract_(k, input) {
  input = input || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var row = findRow_(sh, k);
    if (!row) return { ok: false, error: 'not found' };
    var data = readData_(sh, row);
    if (data.cs) return { ok: false, error: 'already signed', data: data };
    var cn = data.cn || clean_(input.cn, 200).trim();
    var id = clean_(input.id, 20).trim();
    var ph = clean_(input.ph, 30).trim();
    var cs = clean_(input.cs, MAX_SIG);
    if (cn.length < 2 || !id || !ph || !cs) return { ok: false, error: 'missing fields' };
    data.cn = cn;
    data.id = id;
    data.ph = ph;
    data.cs = cs;
    data.ct = Date.now();
    sh.getRange(row, COL.updated, 1, 2).setValues([[new Date(), 'נחתם ✓']]);
    sh.getRange(row, COL.cn, 1, 5).setValues([[txt_(cn), txt_(id), txt_(ph), new Date(data.ct), JSON.stringify(data)]]);
    return { ok: true, data: data };
  } finally {
    lock.releaseLock();
  }
}

function listContracts_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  var items = sh.getRange(2, COL.json, last - 1, 1).getValues().map(function (r) {
    try {
      var d = JSON.parse(r[0]);
      return { k: d.k, n: d.n, t: d.t, d: d.d, p: d.p, pr: d.pr, w: d.w, cn: d.cn, dt: d.dt, ct: d.ct || 0 };
    } catch (e) {
      return null;
    }
  }).filter(function (x) { return x && x.k; });
  items.sort(function (a, b) { return (b.dt || 0) - (a.dt || 0); });
  return { ok: true, items: items.slice(0, 300) };
}

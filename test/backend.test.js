const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackend } = require('./fake-gas.js');

const KEY = 'owner-token';
const draft = { k: 'AbCdEf123456', n: 'שחף ורון', t: 'חתונה', d: '2026-12-30', p: 'באסיקו נס ציונה', pr: 7000, cn: '', w: '050-1234567', ds: '10,20,1,1' };

test('owner-only actions reject a wrong key', () => {
  const b = loadBackend(KEY);
  assert.deepEqual(b.post({ a: 'ping', key: 'nope' }), { ok: false, error: 'unauthorized' });
  assert.deepEqual(b.post({ a: 'save', data: draft }), { ok: false, error: 'unauthorized' });
  assert.deepEqual(b.post({ a: 'list' }), { ok: false, error: 'unauthorized' });
  assert.deepEqual(b.post({ a: 'ping', key: KEY }), { ok: true });
});

test('save creates the sheet with headers and one row per contract; saving again updates it', () => {
  const b = loadBackend(KEY);
  const r = b.post({ a: 'save', key: KEY, data: draft });
  assert.equal(r.ok, true);
  assert.equal(r.data.k, draft.k);
  assert.ok(r.data.dt > 0);
  const sh = b.ss.getSheetByName('הסכמים');
  assert.ok(sh, 'the empty default sheet is renamed');
  assert.equal(sh.getLastRow(), 2);
  b.post({ a: 'save', key: KEY, data: { ...draft, pr: 8000 } });
  assert.equal(sh.getLastRow(), 2, 'same key updates the same row');
  assert.equal(b.post({ a: 'get', k: draft.k }).data.pr, 8000);
});

test('save validates the id and required fields', () => {
  const b = loadBackend(KEY);
  assert.equal(b.post({ a: 'save', key: KEY, data: { ...draft, k: 'x' } }).error, 'bad id');
  assert.equal(b.post({ a: 'save', key: KEY, data: { ...draft, ds: '' } }).error, 'missing fields');
});

test('get returns the contract or not found', () => {
  const b = loadBackend(KEY);
  b.post({ a: 'save', key: KEY, data: draft });
  assert.equal(b.post({ a: 'get', k: draft.k }).data.n, 'שחף ורון');
  assert.deepEqual(b.post({ a: 'get', k: 'missing12345' }), { ok: false, error: 'not found' });
});

test('sign requires the client fields, stores them once, and locks the contract', () => {
  const b = loadBackend(KEY);
  b.post({ a: 'save', key: KEY, data: draft });
  assert.equal(b.post({ a: 'sign', k: draft.k, data: { cn: 'שחף', id: '', ph: '050', cs: '1,1' } }).error, 'missing fields');
  const r = b.post({ a: 'sign', k: draft.k, data: { cn: 'שחף כהן', id: '000000018', ph: '050-1234567', cs: '1,1,2,2' } });
  assert.equal(r.ok, true);
  assert.equal(r.data.id, '000000018');
  assert.ok(r.data.ct >= r.data.dt);
  const again = b.post({ a: 'sign', k: draft.k, data: { cn: 'אחר', id: '1', ph: '1', cs: '9,9' } });
  assert.equal(again.error, 'already signed');
  assert.equal(again.data.cn, 'שחף כהן');
  assert.equal(b.post({ a: 'save', key: KEY, data: { ...draft, pr: 1 } }).error, 'already signed');
  const row = b.ss.getSheetByName('הסכמים').rows[1];
  assert.equal(row[2], 'נחתם ✓');
  assert.equal(row[10], "'000000018", 'ID number is stored as text');
});

test('the owner-filled signer name cannot be replaced by the client', () => {
  const b = loadBackend(KEY);
  b.post({ a: 'save', key: KEY, data: { ...draft, cn: 'רון לוי' } });
  const r = b.post({ a: 'sign', k: draft.k, data: { cn: 'מישהו אחר', id: '18', ph: '050', cs: '1,1' } });
  assert.equal(r.data.cn, 'רון לוי');
});

test('list returns newest first with status info', () => {
  const b = loadBackend(KEY);
  b.post({ a: 'save', key: KEY, data: draft });
  b.post({ a: 'save', key: KEY, data: { ...draft, k: 'Second123456', n: 'דנה ויוסי' } });
  b.post({ a: 'sign', k: draft.k, data: { cn: 'שחף כהן', id: '18', ph: '050', cs: '1,1' } });
  const items = b.post({ a: 'list', key: KEY }).items;
  assert.equal(items.length, 2);
  assert.ok(items.find((i) => i.k === draft.k).ct > 0);
  assert.equal(items.find((i) => i.k === 'Second123456').ct, 0);
});

test('standalone project creates its own spreadsheet once and reuses it', () => {
  const b = loadBackend(KEY, { standalone: true });
  b.post({ a: 'save', key: KEY, data: draft });
  b.post({ a: 'save', key: KEY, data: { ...draft, k: 'Second123456' } });
  assert.equal(b.created, 1);
  assert.equal(b.post({ a: 'list', key: KEY }).items.length, 2);
});

test('bad JSON and unknown actions return errors instead of throwing', () => {
  const b = loadBackend(KEY);
  assert.equal(b.post('{oops').ok, false);
  assert.equal(b.post({ a: 'drop' }).error, 'unknown action');
});

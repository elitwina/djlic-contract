const test = require('node:test');
const assert = require('node:assert/strict');
const DJ = require('../lib.js');

test('normalizePhone handles Israeli local, international and formatted numbers', () => {
  assert.equal(DJ.normalizePhone('052-296-7041'), '972522967041');
  assert.equal(DJ.normalizePhone('0522967041'), '972522967041');
  assert.equal(DJ.normalizePhone('+972 52 296 7041'), '972522967041');
  assert.equal(DJ.normalizePhone('972522967041'), '972522967041');
  assert.equal(DJ.normalizePhone('522967041'), '972522967041');
  assert.equal(DJ.normalizePhone('+1 (212) 555-0100'), '12125550100');
  assert.equal(DJ.normalizePhone('12'), null);
  assert.equal(DJ.normalizePhone(''), null);
  assert.equal(DJ.normalizePhone('abc'), null);
});

test('formatLocalPhone shows Israeli numbers in local format', () => {
  assert.equal(DJ.formatLocalPhone('+972 50-765-4321'), '050-7654321');
  assert.equal(DJ.formatLocalPhone('0507654321'), '050-7654321');
  assert.equal(DJ.formatLocalPhone('03-1234567'), '03-1234567');
  assert.equal(DJ.formatLocalPhone('+1 (212) 555-0100'), '+12125550100');
  assert.equal(DJ.formatLocalPhone('12'), '12');
});

test('isValidIsraeliId checks the check digit', () => {
  assert.equal(DJ.isValidIsraeliId('000000018'), true);
  assert.equal(DJ.isValidIsraeliId('18'), true); // padded to 9 digits
  assert.equal(DJ.isValidIsraeliId('123456782'), true);
  assert.equal(DJ.isValidIsraeliId('123456789'), false);
  assert.equal(DJ.isValidIsraeliId('1234567890'), false);
  assert.equal(DJ.isValidIsraeliId(''), false);
});

test('base64url round-trips every byte value', () => {
  const bytes = new Uint8Array(256).map((_, i) => i);
  for (const len of [0, 1, 2, 3, 4, 255, 256]) {
    const slice = bytes.slice(0, len);
    assert.deepEqual(DJ.b64urlDecode(DJ.b64urlEncode(slice)), slice);
  }
});

test('simplifyStroke removes collinear points and keeps endpoints', () => {
  const line = [];
  for (let i = 0; i <= 100; i++) line.push([i, i * 2]);
  assert.deepEqual(DJ.simplifyStroke(line, 0.8), [[0, 0], [100, 200]]);
  const corner = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]];
  assert.deepEqual(DJ.simplifyStroke(corner, 0.8), [[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(DJ.simplifyStroke([[3, 4]], 0.8), [[3, 4]]);
});

test('encodeSig / decodeSig round-trip integer strokes', () => {
  const strokes = [[[10, 20], [12, 25], [9, 30]], [[100, 50]], [[0, 0], [599, 219]]];
  const enc = DJ.encodeSig(strokes);
  assert.equal(typeof enc, 'string');
  assert.deepEqual(DJ.decodeSig(enc), strokes);
  assert.deepEqual(DJ.decodeSig(''), []);
});

test('sigToSvg produces a path fitted to the drawing bounds', () => {
  const svg = DJ.sigToSvg(DJ.encodeSig([[[10, 20], [50, 60], [90, 20]]]));
  assert.match(svg, /^<svg[^>]+viewBox="[-\d. ]+"/);
  assert.match(svg, /<path d="M10 20/);
  assert.equal(DJ.sigToSvg(''), '');
});

test('docId is stable and changes when core fields change', () => {
  const a = { k: 'x1', n: 'שחף ורון', t: 'חתונה', d: '2026-12-30', p: 'באסיקו', pr: 7000 };
  assert.match(DJ.docId(a), /^DL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(DJ.docId(a), DJ.docId({ ...a }));
  assert.notEqual(DJ.docId(a), DJ.docId({ ...a, pr: 7001 }));
});

test('date and price formatting', () => {
  assert.equal(DJ.formatDate('2026-12-30'), '30.12.2026');
  assert.equal(DJ.formatDate(''), '');
  assert.equal(DJ.weekday('2026-12-30'), 'יום רביעי');
  assert.equal(DJ.formatPrice(7000), '7,000');
  assert.equal(DJ.formatPrice('12500'), '12,500');
  // "בשעה" keeps date and time in reading order inside right-to-left text
  const ms = new Date(2026, 9, 5, 18, 2).getTime();
  assert.equal(DJ.formatDateTime(ms), '05.10.2026 בשעה 18:02');
  assert.equal(DJ.formatDay(ms), '05.10.2026');
  assert.equal(DJ.formatDateTime(0), '');
});

test('waLink builds a wa.me URL with encoded text', () => {
  assert.equal(DJ.waLink('972522967041', 'שלום & bye'), 'https://wa.me/972522967041?text=' + encodeURIComponent('שלום & bye'));
  assert.equal(DJ.waLink('', 'hi'), 'https://wa.me/?text=hi');
});

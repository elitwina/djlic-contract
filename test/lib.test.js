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

test('isValidIsraeliId checks the check digit', () => {
  assert.equal(DJ.isValidIsraeliId('000000018'), true);
  assert.equal(DJ.isValidIsraeliId('18'), true); // padded to 9 digits
  assert.equal(DJ.isValidIsraeliId('123456782'), true);
  assert.equal(DJ.isValidIsraeliId('123456789'), false);
  assert.equal(DJ.isValidIsraeliId('1234567890'), false);
  assert.equal(DJ.isValidIsraeliId(''), false);
});

test('encodePayload / decodePayload round-trip Hebrew text and stay URL safe', () => {
  const data = {
    v: 1, k: 'a1b2c3', n: 'שחף ורון', t: 'חתונה', d: '2026-12-30',
    p: 'באסיקו נס ציונה', pr: 7000, cn: '', id: '', ph: '',
    ds: '10,20,1,1,2,2;30,40,-1,0', dt: 1790000000000,
  };
  const s = DJ.encodePayload(data);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(DJ.decodePayload(s), data);
});

test('decodePayload rejects garbage', () => {
  assert.throws(() => DJ.decodePayload(''));
  assert.throws(() => DJ.decodePayload('1!!!'));
  assert.throws(() => DJ.decodePayload('9abc'));
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

test('ownerMismatches flags only fields the owner filled and the signer changed', () => {
  const sent = { k: 'x', n: 'א', t: 'חתונה', d: '2026-12-30', p: 'ב', pr: 7000, cn: '', id: '', ph: '0501234567' };
  assert.deepEqual(DJ.ownerMismatches(sent, { ...sent, cn: 'שחף', id: '18' }), []);
  assert.deepEqual(DJ.ownerMismatches(sent, { ...sent, pr: 5000, ph: '0500000000' }), ['pr', 'ph']);
});

test('date and price formatting', () => {
  assert.equal(DJ.formatDate('2026-12-30'), '30.12.2026');
  assert.equal(DJ.formatDate(''), '');
  assert.equal(DJ.weekday('2026-12-30'), 'יום רביעי');
  assert.equal(DJ.formatPrice(7000), '7,000');
  assert.equal(DJ.formatPrice('12500'), '12,500');
});

test('waLink builds a wa.me URL with encoded text', () => {
  assert.equal(DJ.waLink('972522967041', 'שלום & bye'), 'https://wa.me/972522967041?text=' + encodeURIComponent('שלום & bye'));
  assert.equal(DJ.waLink('', 'hi'), 'https://wa.me/?text=hi');
});

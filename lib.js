/*
 * Pure helpers shared by the app and the tests: ids, validation,
 * signature compression/rendering and formatting. No DOM access here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DJ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- base64url ----------
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var B64_INDEX = {};
  for (var bi = 0; bi < B64.length; bi++) B64_INDEX[B64[bi]] = bi;

  function b64urlEncode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
      out += B64[a >> 2];
      out += B64[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
      if (b !== undefined) out += B64[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
      if (c !== undefined) out += B64[c & 63];
    }
    return out;
  }

  function b64urlDecode(str) {
    var vals = [];
    for (var i = 0; i < str.length; i++) {
      var v = B64_INDEX[str[i]];
      if (v === undefined) throw new Error('Invalid base64url character');
      vals.push(v);
    }
    if (vals.length % 4 === 1) throw new Error('Invalid base64url length');
    var out = new Uint8Array(Math.floor(vals.length * 3 / 4));
    var o = 0;
    for (var j = 0; j < vals.length; j += 4) {
      var w = vals[j], x = vals[j + 1], y = vals[j + 2], z = vals[j + 3];
      out[o++] = (w << 2) | (x >> 4);
      if (y !== undefined) out[o++] = ((x & 15) << 4) | (y >> 2);
      if (z !== undefined) out[o++] = ((y & 3) << 6) | z;
    }
    return out;
  }

  // ---------- validation ----------
  function normalizePhone(input) {
    var d = String(input || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('9720') === 0) d = '972' + d.slice(4);
    else if (d[0] === '0') d = '972' + d.slice(1);
    else if (d.length === 9 && d[0] === '5') d = '972' + d;
    return d.length >= 10 && d.length <= 15 ? d : null;
  }

  // Israeli numbers as 05X-XXXXXXX / 0X-XXXXXXX, anything else as +digits
  function formatLocalPhone(input) {
    var n = normalizePhone(input);
    if (!n) return String(input || '').trim();
    if (n.indexOf('972') !== 0) return '+' + n;
    var local = '0' + n.slice(3);
    var cut = local[1] === '5' || local[1] === '7' ? 3 : 2;
    return local.slice(0, cut) + '-' + local.slice(cut);
  }

  function isValidIsraeliId(input) {
    var s = String(input || '').trim();
    if (!/^\d{1,9}$/.test(s)) return false;
    s = ('000000000' + s).slice(-9);
    var sum = 0;
    for (var i = 0; i < 9; i++) {
      var n = Number(s[i]) * ((i % 2) + 1);
      sum += n > 9 ? n - 9 : n;
    }
    return sum % 10 === 0;
  }

  // ---------- signatures ----------
  // A signature is a list of strokes; a stroke is a list of [x, y] integer points.

  function perpDistance(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return Math.sqrt(Math.pow(p[0] - a[0], 2) + Math.pow(p[1] - a[1], 2));
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
  }

  // Ramer–Douglas–Peucker
  function simplifyStroke(points, eps) {
    if (points.length < 3) return points.slice();
    var maxD = 0, idx = 0, last = points.length - 1;
    for (var i = 1; i < last; i++) {
      var d = perpDistance(points[i], points[0], points[last]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= eps) return [points[0], points[last]];
    var left = simplifyStroke(points.slice(0, idx + 1), eps);
    var right = simplifyStroke(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }

  // "x,y,dx,dy,dx,dy;x,y,..." — first point absolute, the rest as deltas
  function encodeSig(strokes) {
    return strokes.map(function (s) {
      var parts = [s[0][0], s[0][1]];
      for (var i = 1; i < s.length; i++) parts.push(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      return parts.join(',');
    }).join(';');
  }

  function decodeSig(str) {
    if (!str) return [];
    return str.split(';').map(function (part) {
      var n = part.split(',').map(Number);
      var pts = [[n[0], n[1]]];
      for (var i = 2; i + 1 < n.length; i += 2) {
        var prev = pts[pts.length - 1];
        pts.push([prev[0] + n[i], prev[1] + n[i + 1]]);
      }
      return pts;
    });
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  function strokeToPath(s) {
    var d = 'M' + s[0][0] + ' ' + s[0][1];
    if (s.length === 1) return d + ' l0.1 0';
    if (s.length === 2) return d + ' L' + s[1][0] + ' ' + s[1][1];
    for (var i = 1; i < s.length - 1; i++) {
      var mx = r1((s[i][0] + s[i + 1][0]) / 2), my = r1((s[i][1] + s[i + 1][1]) / 2);
      d += ' Q' + s[i][0] + ' ' + s[i][1] + ' ' + mx + ' ' + my;
    }
    var e = s[s.length - 1];
    return d + ' L' + e[0] + ' ' + e[1];
  }

  // Inline SVG of the signature, cropped to its own bounds
  function sigToSvg(enc) {
    var strokes = decodeSig(enc);
    if (!strokes.length) return '';
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(function (s) {
      s.forEach(function (p) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
    var w = maxX - minX, h = maxY - minY;
    var pad = Math.max(8, Math.max(w, h) * 0.06);
    var vb = [r1(minX - pad), r1(minY - pad), r1(w + pad * 2), r1(h + pad * 2)].join(' ');
    var d = strokes.map(strokeToPath).join(' ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }

  // ---------- integrity ----------
  function fnv1a(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hex4(n) { return ('0000' + (n & 0xffff).toString(16)).slice(-4).toUpperCase(); }

  function docId(data) {
    var s = [data.k, data.n, data.t, data.d, data.p, data.pr].join('|');
    return 'DL-' + hex4(fnv1a(s, 2166136261)) + '-' + hex4(fnv1a(s, 3339675911));
  }

  // ---------- formatting ----------
  var WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

  function parseIsoDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { y: m[1], m: m[2], d: m[3], date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) } : null;
  }

  function formatDate(iso) {
    var p = parseIsoDate(iso);
    return p ? p.d + '.' + p.m + '.' + p.y : '';
  }

  function weekday(iso) {
    var p = parseIsoDate(iso);
    return p ? WEEKDAYS[p.date.getUTCDay()] : '';
  }

  function formatPrice(n) {
    var digits = String(Math.round(Number(n) || 0));
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pad2(n) { return ('0' + n).slice(-2); }

  function formatDay(ms) {
    if (!ms) return '';
    var t = new Date(ms);
    return pad2(t.getDate()) + '.' + pad2(t.getMonth() + 1) + '.' + t.getFullYear();
  }

  function formatDateTime(ms) {
    if (!ms) return '';
    var t = new Date(ms);
    return formatDay(ms) + ' בשעה ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes());
  }

  function waLink(phone, text) {
    return 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text);
  }

  return {
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    normalizePhone: normalizePhone,
    formatLocalPhone: formatLocalPhone,
    isValidIsraeliId: isValidIsraeliId,
    simplifyStroke: simplifyStroke,
    encodeSig: encodeSig,
    decodeSig: decodeSig,
    sigToSvg: sigToSvg,
    docId: docId,
    formatDate: formatDate,
    weekday: weekday,
    formatPrice: formatPrice,
    formatDay: formatDay,
    formatDateTime: formatDateTime,
    waLink: waLink,
  };
});

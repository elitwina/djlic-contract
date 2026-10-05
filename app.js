/*
 * DJ LIC – contract app.
 *  - No hash        → owner wizard (one question per screen) → preview → send on WhatsApp
 *  - #history       → contracts sent from this device
 *  - #c=<payload>   → the contract itself; signing page until the client signs, signed copy after
 * Everything (details + signatures) travels inside the link, so the WhatsApp message is each side's copy.
 */
(function () {
  'use strict';

  var CONFIG = {
    ownerPhone: '972522967041',
    ownerPhoneDisplay: '052-296-7041',
    // Used for links when the page is opened from a local file instead of the website
    publicUrl: 'https://elitwina.github.io/djlic-contract/',
  };

  var EVENT_TYPES = ['חתונה', 'בר מצווה', 'בת מצווה', 'חינה', 'ברית / בריתה', 'יום הולדת', 'אירוע חברה', 'מסיבה פרטית'];

  var LABELS = {
    n: 'שמות המזמינים', t: 'סוג האירוע', d: 'תאריך האירוע', p: 'מקום האירוע', pr: 'מחיר ההזמנה',
    cn: 'שם המזמין', id: 'ת״ז', ph: 'טלפון', ds: 'חתימת דיג׳י ליק',
  };

  var STEPS = [
    { key: 'n', type: 'text', title: 'מי המזמינים?', hint: 'השמות כפי שיופיעו בהסכם', placeholder: 'למשל: שחף ורון' },
    { key: 't', type: 'chips', title: 'מה סוג האירוע?', hint: 'בחרו מהרשימה או כתבו בעצמכם' },
    { key: 'd', type: 'date', title: 'מתי האירוע?' },
    { key: 'p', type: 'text', title: 'איפה האירוע?', hint: 'שם המקום והעיר', placeholder: 'למשל: באסיקו נס ציונה' },
    { key: 'pr', type: 'money', title: 'מה מחיר ההזמנה?', hint: 'בשקלים, כולל מע״מ' },
    { key: 'cn', type: 'text', optional: true, title: 'שם המזמין', hint: 'השם המלא של מי שחותם על ההסכם. אפשר לדלג – הלקוח ימלא בעצמו.', placeholder: 'שם פרטי ומשפחה' },
    { key: 'id', type: 'idnum', optional: true, title: 'תעודת הזהות של המזמין', hint: 'אפשר לדלג – הלקוח ימלא בעצמו.', placeholder: '9 ספרות' },
    { key: 'ph', type: 'tel', optional: true, title: 'הטלפון של המזמין', hint: 'אם תמלא – הוא ישמש גם לשליחה בוואטסאפ. אפשר לדלג.', placeholder: '050-0000000' },
    { key: 'ds', type: 'signature', title: 'החתימה שלך', hint: 'תופיע בהסכם בשם דיג׳י ליק (אלי טוינה).' },
  ];

  var CLAUSES = [
    { title: 'ציוד', items: [
      'בכל מקרה שבו "המזמין" ירצה לקיים תכנית אומנותית, כגון זמר אורח וכדומה, מעבר לשירותיו של "דיג׳י ליק", עליו לדאוג למערכת הגברה נפרדת לאומן האמור ו/או לתוכנית האומנותית לפי העניין, וכן על "המזמין" להודיע 30 יום לפני מועד האירוע על כוונתו זו. יובהר כי "דיג׳י ליק" לא יספק שירותי הגברה לאומן וכי אינו מתחייב לעשות כן.',
    ] },
    { title: 'ביטולים / שינויים', items: [
      'כל ביטול של הזמנה זו או שינוי בתאריך האירוע שלא עקב כוח עליון, יחייב את "המזמין" בתשלום של 50% מהסכום הכולל של ההזמנה. כל ביטול או שינוי שייעשה 14 ימים או פחות ממועד האירוע יחייב את "המזמין" בסכום ההזמנה המלא. שינוי מקום ו/או שינוי מועד למועד אחר המתאים לפעילות "דיג׳י ליק", עד 3 חודשים לפני מועד האירוע, לא יחייב את "המזמין" כאמור לעיל.',
    ] },
    { title: 'תנאי מקום האירוע', items: [
      'מוסכם ומוצהר בזאת כי "דיג׳י ליק" אינו אחראי לנזקים, שיבושים ולתקלות אשר יקרו בגין תקלות בחשמל המסופק למכשיריו ו/או כתוצאה מהתנהגות לא הולמת מצד הקהל הנוכח באירוע. נזקים ו/או שיבושים כתוצאה מהתנהגות המשתתפים באירוע יתוקנו על חשבונו של "המזמין".',
      'המוסיקה אשר תושמע באירוע תיקבע בהתאם לדרישת "המזמין" בפגישה שתיערך במועד מוקדם יותר, ובכפוף לשיקול דעתו של "דיג׳י ליק" במהלך האירוע.',
      'במידה ונבצר מ"דיג׳י ליק" להגיע לאירוע עקב כוח עליון, ידאג למחליף ראוי, וזאת בתיאום מול "המזמין" ובאישורו.',
    ] },
    { title: 'תנאי תשלום', items: [
      'סכום ההזמנה ישולם ביום האירוע, ולא יאוחר מ-5 ימי עסקים לאחריו.',
      'חתימה על מסמך זה באמצעות מכשיר פקס ו/או דוא״ל או כל דרך מקובלת אחרת תשמש כחתימה לכל דבר.',
    ] },
  ];

  // ---------- icons ----------
  var ICONS = {
    arrowL: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  };
  var WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z';

  function icon(name) {
    if (name === 'wa') return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + WA_PATH + '"/></svg>';
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // ---------- storage (best effort: private mode may block it) ----------
  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem('djlic.' + k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem('djlic.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------- small helpers ----------
  var app = document.getElementById('app');
  var actions = {};
  var pad = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function mount(html, acts) {
    closeSheet();
    app.innerHTML = html;
    actions = acts || {};
    pad = null;
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-goto]');
    if (!el || !app.contains(el)) return;
    if (el.dataset.goto && actions.goto) return actions.goto(el.dataset.goto, e);
    var fn = actions[el.dataset.act];
    if (fn) fn(el, e);
  });

  var toastTimer;
  function toast(msg) {
    var t = qs('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  }

  function newKey() {
    var a = new Uint8Array(6);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return DJ.b64urlEncode(a);
  }

  function baseUrl() {
    return location.protocol === 'file:' ? CONFIG.publicUrl : location.origin + location.pathname;
  }

  function compact(d) {
    var out = { v: 1 };
    Object.keys(d).forEach(function (k) {
      if (k !== 'v' && d[k] !== '' && d[k] != null && d[k] !== 0) out[k] = d[k];
    });
    return out;
  }

  function linkFor(d) { return baseUrl() + '#c=' + DJ.encodePayload(compact(d)); }

  // Never trust what came in the URL: coerce every field to the expected shape
  function cleanData(r) {
    function s(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }
    return {
      v: 1, k: s(r.k, 40), n: s(r.n), t: s(r.t, 60),
      d: /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : '',
      p: s(r.p), pr: Math.max(0, Math.round(Number(r.pr) || 0)),
      cn: s(r.cn), id: s(r.id, 20), ph: s(r.ph, 30),
      ds: s(r.ds, 30000), dt: Number(r.dt) || 0,
      cs: s(r.cs, 30000), ct: Number(r.ct) || 0,
    };
  }

  function ownerFields(d) {
    return { n: d.n, t: d.t, d: d.d, p: d.p, pr: d.pr, cn: d.cn, id: d.id, ph: d.ph, ds: d.ds, dt: d.dt };
  }

  function eventLine(d) { return [d.t, DJ.formatDate(d.d), d.p].filter(Boolean).join(' · '); }

  function msgToClient(d, link) {
    return 'היי ' + (d.cn || d.n) + '! 🎶\n' +
      'מצורף הסכם ההתקשרות לאירוע שלכם:\n' + eventLine(d) + '\n\n' +
      'לצפייה בהסכם ולחתימה דיגיטלית 👇\n' + link + '\n\n' +
      'תודה, אלי – DJ LIC 🎧';
  }
  function msgToOwner(d, link) {
    return 'היי אלי, חתמתי על ההסכם ✍️\n' + d.n + ' · ' + eventLine(d) + '\n\n' + 'העותק החתום 👇\n' + link;
  }
  function msgSignedCopy(d, link) {
    return 'עותק חתום של הסכם ההתקשרות – DJ LIC ✅\n' + d.n + ' · ' + eventLine(d) + '\n\n' + link;
  }

  function printDoc(d) {
    var title = document.title;
    document.title = 'הסכם התקשרות – ' + d.n + ' – ' + DJ.formatDate(d.d);
    window.print();
    setTimeout(function () { document.title = title; }, 1500);
  }

  // ---------- the contract document ----------
  function renderDocument(d, mode) {
    var owner = mode === 'owner';
    var signed = !!d.cs;

    function f(key, text) {
      if (owner) {
        return '<button type="button" class="fld" data-goto="' + key + '">' +
          (text ? esc(text) : '<span class="todo">ימולא ע״י הלקוח</span>') + '</button>';
      }
      if (!text) return '<span class="fld blank" data-bind="' + key + '"></span>';
      return '<span class="fld">' + esc(text) + '</span>';
    }
    function cell(label, html) {
      return '<div><span class="lbl">' + label + '</span><span class="val">' + html + '</span></div>';
    }
    function sigBox(svg, name, when, goto) {
      return '<div class="sig-box">' +
        '<div class="sig-img"' + (goto ? ' data-goto="' + goto + '" style="cursor:pointer"' : '') + '>' + svg + '</div>' +
        '<div class="sig-line"></div>' +
        '<div class="sig-name">' + name + '</div>' +
        '<div class="sig-date">' + (when ? 'נחתם: ' + DJ.formatDateTime(when) : '&nbsp;') + '</div>' +
      '</div>';
    }

    var price = DJ.formatPrice(d.pr) + ' ש״ח';
    var day = DJ.weekday(d.d);
    var id = DJ.docId(d);
    var djSig = d.ds ? DJ.sigToSvg(d.ds) : '<span class="sig-wait">טרם נחתם</span>';
    var clientSig = signed ? DJ.sigToSvg(d.cs)
      : '<span class="sig-wait">' + (mode === 'sign' ? 'החתימה תופיע כאן לאחר החתימה' : 'ממתין לחתימת המזמין') + '</span>';
    var clientName = 'המזמין' + (d.cn ? ': ' + esc(d.cn) : (mode === 'sign' ? '<span data-bindtext="cn"></span>' : ''));

    var clauses = CLAUSES.map(function (c, ci) {
      var n = ci + 1;
      var items = c.items.length === 1
        ? '<p>' + c.items[0] + '</p>'
        : '<ol>' + c.items.map(function (txt, ii) {
            return '<li><span class="sub">' + n + '.' + (ii + 1) + '</span><span>' + txt + '</span></li>';
          }).join('') + '</ol>';
      return '<section class="clause"><h2><span class="num">' + n + '</span>' + c.title + '</h2>' + items + '</section>';
    }).join('');

    return '' +
      '<article class="paper" id="doc">' +
        '<header class="doc-head">' +
          '<img class="doc-logo" src="img/logo.png" alt="DJ LIC">' +
          '<h1>הסכם התקשרות לשירותי מוסיקה</h1>' +
          '<div class="doc-sub">דיג׳י ליק · אלי טוינה</div>' +
          '<div class="doc-meta">' +
            '<span>מס׳ מסמך <b>' + id + '</b></span>' +
            (d.dt ? '<span>הופק ב-' + DJ.formatDateTime(d.dt).split(',')[0] + '</span>' : '') +
            '<span class="status' + (signed ? ' signed' : '') + '">' +
              (signed ? icon('check') + 'נחתם ע״י שני הצדדים' : 'ממתין לחתימת המזמין') + '</span>' +
          '</div>' +
        '</header>' +
        '<div class="doc-body">' +
          '<p class="parties">הסכם שנחתם בין <b>אלי טוינה</b> (להלן: "דיג׳י ליק") לבין ' + f('n', d.n) + ' (להלן: "המזמין").</p>' +
          '<div class="details">' +
            cell('סוג האירוע', f('t', d.t)) +
            cell('תאריך האירוע', f('d', DJ.formatDate(d.d)) + (day ? ' <small class="wd">' + day + '</small>' : '')) +
            cell('מקום האירוע', f('p', d.p)) +
            cell('שם המזמין', f('cn', d.cn)) +
            cell('ת״ז', f('id', d.id)) +
            cell('טלפון', f('ph', d.ph)) +
            '<div class="price"><span class="lbl">מחיר ההזמנה</span><span class="val">' + f('pr', price) + ' <small>כולל מע״מ</small></span></div>' +
          '</div>' +
          '<div class="recitals">' +
            '<p>הואיל ומחיר ההזמנה הינו <b>' + price + '</b> כולל מע״מ;</p>' +
            '<p>והואיל ו"המזמין" בדק את הצעותיו של "דיג׳י ליק" והסתמך על נכונות הצהרותיו;</p>' +
            '<p>והואיל ו"דיג׳י ליק" הוא בעל ידע וניסיון, וכי הוא מסוגל לבצע בעצמו את המטלות והעבודות בידע, באיכות ובמומחיות;</p>' +
            '<p class="therefore">לפיכך הוצהר והותנה בין הצדדים כדלהלן:</p>' +
          '</div>' +
          clauses +
          '<section class="signatures">' +
            '<h2>ולראיה באו הצדדים על החתום:</h2>' +
            '<div class="sig-grid">' +
              sigBox(djSig, 'דיג׳י ליק (אלי טוינה)', d.dt, owner ? 'ds' : '') +
              sigBox(clientSig, clientName, d.ct) +
            '</div>' +
          '</section>' +
        '</div>' +
        '<footer class="doc-foot">' +
          '<span>מס׳ מסמך ' + id + '</span>' +
          '<span>' + (signed ? 'נחתם דיגיטלית ב-' + DJ.formatDateTime(d.ct) : 'מסמך מקוון לחתימה דיגיטלית') + '</span>' +
          '<span>DJ LIC · אלי טוינה · ' + CONFIG.ownerPhoneDisplay + '</span>' +
        '</footer>' +
      '</article>';
  }

  // ---------- signature pad ----------
  function padHtml() {
    return '<div class="sigpad" id="pad"><canvas></canvas>' +
      '<div class="sigpad-line"></div><span class="sigpad-x">✕</span>' +
      '<div class="sigpad-hint">' + icon('pen') + ' חתמו כאן</div>' +
      '<button type="button" class="sigpad-clear" data-act="clear-pad">' + icon('undo') + ' ניקוי</button></div>';
  }

  function mountPad(wrap, onInk) {
    var LW = 500, LH = 250; // logical drawing space; stored signatures use these units
    var canvas = wrap.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var strokes = [];
    var cur = null;

    function resize() {
      var w = canvas.clientWidth;
      if (!w) return;
      var h = Math.round(w * LH / LW);
      canvas.style.height = h + 'px';
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      var k = dpr * w / LW;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      redraw();
    }
    function redraw() {
      ctx.clearRect(0, 0, LW, LH);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle = '#1D2B53';
      ctx.lineWidth = 3.4;
      strokes.forEach(function (s) {
        if (s.length === 1) {
          ctx.beginPath(); ctx.arc(s[0][0], s[0][1], 1.7, 0, Math.PI * 2); ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(s[0][0], s[0][1]);
        for (var i = 1; i < s.length - 1; i++) {
          ctx.quadraticCurveTo(s[i][0], s[i][1], (s[i][0] + s[i + 1][0]) / 2, (s[i][1] + s[i + 1][1]) / 2);
        }
        var e = s[s.length - 1];
        ctx.lineTo(e[0], e[1]);
        ctx.stroke();
      });
    }
    function pt(e) {
      var r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * LW / r.width, (e.clientY - r.top) * LH / r.height];
    }
    function end() { cur = null; }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      cur = [pt(e)];
      strokes.push(cur);
      wrap.classList.add('has-ink');
      wrap.classList.remove('invalid');
      if (onInk) onInk();
      redraw();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!cur) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      (evs.length ? evs : [e]).forEach(function (ev) { cur.push(pt(ev)); });
      redraw();
    });
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    resize();

    return {
      resize: resize,
      clear: function () { strokes = []; cur = null; wrap.classList.remove('has-ink'); redraw(); },
      isEmpty: function () {
        var len = 0;
        strokes.forEach(function (s) {
          for (var i = 1; i < s.length; i++) len += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        });
        return len < 25;
      },
      encode: function () {
        return DJ.encodeSig(strokes.map(function (s) {
          var q = [];
          s.forEach(function (p) {
            var x = Math.round(p[0]), y = Math.round(p[1]), last = q[q.length - 1];
            if (!last || last[0] !== x || last[1] !== y) q.push([x, y]);
          });
          return DJ.simplifyStroke(q, 0.6);
        }));
      },
    };
  }

  window.addEventListener('resize', function () { if (pad) pad.resize(); });

  // ---------- owner: wizard ----------
  function blankDraft() { return { k: newKey(), n: '', t: '', d: '', p: '', pr: 0, cn: '', id: '', ph: '', ds: '' }; }

  var W = {
    data: Object.assign(blankDraft(), store.get('draft', {})),
    step: store.get('step', 0),
    returnToPreview: false,
    resign: false,
    dir: 'fwd',
  };

  function saveDraft() { store.set('draft', W.data); store.set('step', W.step); }

  function go(step, dir) {
    W.step = step;
    W.dir = dir || 'fwd';
    saveDraft();
    renderWizard();
  }

  function goHome() {
    if (location.hash && location.hash !== '#') history.pushState(null, '', location.pathname + location.search);
    renderWizard();
  }

  function newContract() {
    var sent = store.get('history', []).some(function (h) { return h.k === W.data.k; });
    if (W.data.n && !sent && !confirm('להתחיל הסכם חדש? הפרטים שמילאת עד עכשיו יימחקו.')) return;
    W.data = blankDraft();
    W.returnToPreview = false;
    W.resign = false;
    W.step = 0;
    saveDraft();
    goHome();
  }

  var ownerActs = {
    new: newContract,
    home: function (el, e) { e.preventDefault(); goHome(); },
  };

  function ownerTop() {
    return '<header class="topbar no-print">' +
      '<a class="brand" href="#" data-act="home"><img src="img/logo.png" alt="DJ LIC">' +
        '<span class="brand-text">הסכמי התקשרות<small>DJ LIC · אלי טוינה</small></span></a>' +
      '<nav class="topnav">' +
        '<a class="navbtn" href="#history">' + icon('list') + 'נשלחו</a>' +
        '<button type="button" class="navbtn" data-act="new">' + icon('plus') + 'הסכם חדש</button>' +
      '</nav>' +
    '</header>';
  }

  function stepControl(s, v) {
    switch (s.type) {
      case 'chips': {
        var other = !!v && EVENT_TYPES.indexOf(v) < 0;
        return '<div class="chips">' +
          EVENT_TYPES.map(function (t) {
            return '<button type="button" class="chip' + (t === v ? ' on' : '') + '" data-chip="' + esc(t) + '">' + esc(t) + '</button>';
          }).join('') +
          '<button type="button" class="chip' + (other ? ' on' : '') + '" data-chip="">אחר…</button></div>' +
          '<div class="other-wrap"' + (other ? '' : ' hidden') + '>' +
            '<input id="f" class="inp" type="text" placeholder="סוג האירוע" autocomplete="off" value="' + (other ? esc(v) : '') + '"></div>';
      }
      case 'date':
        return '<input id="f" class="inp" type="date" value="' + esc(v) + '"><p class="note" id="note"></p>';
      case 'money':
        return '<div class="money"><input id="f" class="inp" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="' +
          (v ? DJ.formatPrice(v) : '') + '"><span class="cur">₪</span></div><p class="note">כולל מע״מ</p>';
      case 'idnum':
        return '<input id="f" class="inp" type="text" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="' + s.placeholder + '" value="' + esc(v) + '">';
      case 'tel':
        return '<input id="f" class="inp" type="tel" inputmode="tel" dir="ltr" style="text-align:right" autocomplete="off" placeholder="' + s.placeholder + '" value="' + esc(v) + '">';
      case 'signature': {
        var saved = v || store.get('sig', '');
        if (saved && !W.resign) {
          return '<div class="sig-saved">' + DJ.sigToSvg(saved) + '</div>' +
            '<button type="button" class="btn link" data-act="resign">' + icon('pen') + ' חתימה מחדש</button>';
        }
        return padHtml() +
          '<label class="check"><input type="checkbox" id="remember" checked> לשמור את החתימה במכשיר הזה לפעם הבאה</label>';
      }
      default:
        return '<input id="f" class="inp" type="text" autocomplete="off" enterkeyhint="next" placeholder="' + esc(s.placeholder || '') + '" value="' + esc(v) + '">';
    }
  }

  function dateNote(v) {
    if (!v) return null;
    var days = Math.round((new Date(v + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 864e5);
    var base = DJ.weekday(v) + ' · ' + DJ.formatDate(v);
    if (days < 0) return { text: base + ' – שימו לב, התאריך כבר עבר', warn: true };
    return { text: base + (days === 0 ? ' · היום' : ' · בעוד ' + days + ' ימים') };
  }

  function readStep(s) {
    var el = qs('#f');
    function ok(v) { return { ok: true, value: v }; }
    function bad(msg) { return { ok: false, error: msg }; }
    switch (s.type) {
      case 'chips': {
        var on = qs('.chip.on');
        if (!on) return bad('בחרו את סוג האירוע');
        var v = on.dataset.chip || el.value.trim();
        return v ? ok(v) : bad('כתבו את סוג האירוע');
      }
      case 'date':
        return el.value ? ok(el.value) : bad('בחרו את תאריך האירוע');
      case 'money': {
        var n = Number(el.value.replace(/\D/g, ''));
        return n > 0 ? ok(n) : bad('הזינו את מחיר ההזמנה');
      }
      case 'idnum': {
        var idv = el.value.replace(/\D/g, '');
        if (!idv) return ok('');
        return idv.length >= 8 && DJ.isValidIsraeliId(idv) ? ok(idv) : bad('מספר תעודת הזהות לא תקין – כדאי לבדוק את הספרות');
      }
      case 'tel': {
        var tv = el.value.trim();
        if (!tv) return ok('');
        return DJ.normalizePhone(tv) ? ok(tv) : bad('מספר הטלפון לא תקין');
      }
      case 'signature': {
        if (!pad) return ok(W.data.ds || store.get('sig', ''));
        if (pad.isEmpty()) { qs('#pad').classList.add('invalid'); return bad('חתמו בתוך המסגרת'); }
        var enc = pad.encode();
        if (qs('#remember').checked) store.set('sig', enc);
        return ok(enc);
      }
      default: {
        var tx = el.value.trim();
        if (!tx) return s.optional ? ok('') : bad('השדה הזה חובה');
        return tx.length < 2 ? bad('נראה קצר מדי') : ok(tx);
      }
    }
  }

  function renderWizard() {
    if (W.step === 'preview') return renderPreview();
    var i = Math.max(0, Math.min(STEPS.length - 1, Number(W.step) || 0));
    var s = STEPS[i];
    var last = i === STEPS.length - 1;
    var nextLabel = W.returnToPreview ? 'שמירה וחזרה להסכם' : last ? 'לתצוגת ההסכם' : 'המשך';

    function next(value) {
      W.data[s.key] = value;
      W.resign = false;
      if (W.returnToPreview) { W.returnToPreview = false; go('preview'); }
      else go(last ? 'preview' : i + 1);
    }

    mount('<div class="wiz">' + ownerTop() +
      '<div class="progress" aria-hidden="true"><span style="width:' + Math.round((i + 1) / (STEPS.length + 1) * 100) + '%"></span></div>' +
      '<main class="card step' + (W.dir === 'back' ? ' back' : '') + '">' +
        '<div class="step-count">שלב ' + (i + 1) + ' מתוך ' + STEPS.length + '</div>' +
        '<h1>' + s.title + '</h1>' +
        (s.hint ? '<p class="hint">' + s.hint + '</p>' : '') +
        '<form id="step-form" novalidate>' +
          stepControl(s, W.data[s.key]) +
          '<p class="err" id="err" role="alert"></p>' +
          '<div class="actions">' +
            '<button type="submit" class="btn primary">' + nextLabel + ' ' + icon('arrowL') + '</button>' +
            (s.optional ? '<button type="button" class="btn ghost" data-act="skip">דלג – הלקוח ימלא</button>' : '') +
            (W.returnToPreview
              ? '<button type="button" class="btn link" data-act="cancel-edit">ביטול</button>'
              : i > 0 ? '<button type="button" class="btn link" data-act="prev">' + icon('arrowR') + ' חזרה</button>' : '') +
          '</div>' +
        '</form>' +
      '</main></div>',
      Object.assign({
        prev: function () { go(i - 1, 'back'); },
        skip: function () { next(''); },
        'cancel-edit': function () { W.returnToPreview = false; W.resign = false; go('preview', 'back'); },
        resign: function () { W.resign = true; W.dir = ''; renderWizard(); },
        'clear-pad': function () { if (pad) pad.clear(); },
      }, ownerActs));

    var form = qs('#step-form');
    var input = qs('#f');
    var err = qs('#err');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = readStep(s);
      if (!r.ok) {
        err.textContent = r.error;
        if (input) { input.classList.add('invalid'); input.focus(); }
        return;
      }
      next(r.value);
    });
    if (input) input.addEventListener('input', function () { err.textContent = ''; input.classList.remove('invalid'); });

    if (s.type === 'chips') {
      qsa('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          qsa('.chip').forEach(function (c) { c.classList.toggle('on', c === chip); });
          err.textContent = '';
          var isOther = !chip.dataset.chip;
          qs('.other-wrap').hidden = !isOther;
          if (isOther) input.focus();
          else setTimeout(function () { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }, 180);
        });
      });
    } else if (s.type === 'date') {
      var showNote = function () {
        var n = dateNote(input.value), note = qs('#note');
        note.textContent = n ? n.text : '';
        note.classList.toggle('warn', !!(n && n.warn));
      };
      input.addEventListener('change', showNote);
      input.addEventListener('input', showNote);
      showNote();
    } else if (s.type === 'money') {
      input.addEventListener('input', function () {
        var digits = input.value.replace(/\D/g, '').slice(0, 9);
        input.value = digits ? DJ.formatPrice(digits) : '';
      });
    } else if (s.type === 'idnum') {
      input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, ''); });
    } else if (s.type === 'signature' && qs('#pad')) {
      pad = mountPad(qs('#pad'), function () { err.textContent = ''; });
    }

    if (input && s.type !== 'chips' && s.type !== 'date') {
      input.focus();
      var len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (e) { /* not supported for this type */ }
    }
  }

  // ---------- owner: preview + send ----------
  function renderPreview() {
    var d = W.data;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i];
      if (!st.optional && !d[st.key]) return go(i);
    }
    mount('<div class="view">' + ownerTop() +
      '<div class="preview-head no-print"><h1>תצוגה מקדימה</h1>' +
        '<p>כך הלקוח יראה את ההסכם. לחיצה על פרט מסומן מחזירה לעריכה שלו.</p></div>' +
      renderDocument(d, 'owner') +
      '<div class="sticky no-print">' +
        '<button type="button" class="btn ghost" data-act="back">' + icon('arrowR') + ' חזרה</button>' +
        '<button type="button" class="btn wa" data-act="send">' + icon('wa') + ' שליחה ללקוח בוואטסאפ</button>' +
      '</div></div>',
      Object.assign({
        back: function () { go(STEPS.length - 1, 'back'); },
        send: openSendSheet,
        goto: function (key) {
          var idx = STEPS.map(function (x) { return x.key; }).indexOf(key);
          if (idx < 0) return;
          W.returnToPreview = true;
          W.resign = key === 'ds';
          go(idx);
        },
      }, ownerActs));
  }

  var sheetEl = null;
  function closeSheet() {
    if (sheetEl) { sheetEl.remove(); sheetEl = null; document.removeEventListener('keydown', onSheetKey); }
  }
  function onSheetKey(e) { if (e.key === 'Escape') closeSheet(); }

  function saveHistory(d, link, to) {
    var list = store.get('history', []).filter(function (h) { return h.k !== d.k; });
    list.unshift({ k: d.k, sent: ownerFields(d), sentAt: Date.now(), to: to || '', link: link });
    store.set('history', list.slice(0, 60));
  }

  function openSendSheet() {
    var d = W.data;
    d.dt = Date.now();
    saveDraft();
    var link = linkFor(d);

    closeSheet();
    sheetEl = document.createElement('div');
    sheetEl.className = 'sheet-bg no-print';
    sheetEl.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">' +
      '<div id="sh-form">' +
        '<h2 id="sh-t">שליחה ללקוח</h2>' +
        '<p>הלקוח יקבל קישור לצפייה בהסכם ולחתימה מהטלפון.</p>' +
        '<label for="to">מספר הוואטסאפ של הלקוח</label>' +
        '<input id="to" class="inp" type="tel" inputmode="tel" dir="ltr" style="text-align:right" autocomplete="off" placeholder="050-0000000" value="' + esc(d.ph) + '">' +
        '<p class="err" id="to-err"></p>' +
        '<div class="actions">' +
          '<a class="btn wa block" id="wa-send" href="#" target="_blank" rel="noopener">' + icon('wa') + ' שליחה בוואטסאפ</a>' +
          '<button type="button" class="btn ghost block" data-sh="copy">' + icon('link') + ' העתקת הקישור</button>' +
          '<button type="button" class="btn link" data-sh="close">ביטול</button>' +
        '</div>' +
      '</div>' +
      '<div id="sh-done" hidden>' +
        '<svg class="success-mark" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/><path d="M19 33l9 9 17-19"/></svg>' +
        '<h2>ההסכם נשלח</h2>' +
        '<p>אחרי שהלקוח יחתום, הוא ישלח לך בוואטסאפ את העותק החתום. ההסכם נשמר גם ברשימת "נשלחו".</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary block" data-sh="new">' + icon('plus') + ' הסכם חדש</button>' +
          '<button type="button" class="btn link" data-sh="close">סגירה</button>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(sheetEl);
    document.addEventListener('keydown', onSheetKey);

    var to = qs('#to', sheetEl), toErr = qs('#to-err', sheetEl), waBtn = qs('#wa-send', sheetEl);
    to.addEventListener('input', function () { toErr.textContent = ''; to.classList.remove('invalid'); });
    to.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); waBtn.click(); } });
    if (!d.ph) setTimeout(function () { to.focus(); }, 300);

    waBtn.addEventListener('click', function (e) {
      var phone = DJ.normalizePhone(to.value);
      if (!phone) {
        e.preventDefault();
        toErr.textContent = to.value.trim() ? 'מספר הטלפון לא תקין' : 'הקלידו את מספר הטלפון של הלקוח';
        to.classList.add('invalid');
        to.focus();
        return;
      }
      waBtn.href = DJ.waLink(phone, msgToClient(d, link));
      saveHistory(d, link, to.value.trim());
      setTimeout(function () {
        qs('#sh-form', sheetEl).hidden = true;
        qs('#sh-done', sheetEl).hidden = false;
      }, 500);
    });

    sheetEl.addEventListener('click', function (e) {
      if (e.target === sheetEl) return closeSheet();
      var b = e.target.closest('[data-sh]');
      if (!b) return;
      if (b.dataset.sh === 'close') closeSheet();
      if (b.dataset.sh === 'new') { closeSheet(); newContract(); }
      if (b.dataset.sh === 'copy') {
        copyText(link).then(function (ok) {
          if (ok) { saveHistory(d, link, to.value.trim()); toast('הקישור הועתק – אפשר להדביק אותו בכל מקום'); }
          else toast('ההעתקה נכשלה');
        });
      }
    });
  }

  // ---------- owner: history ----------
  function renderHistory() {
    var list = store.get('history', []);
    function item(h) {
      var s = h.sent, signed = !!h.signedAt;
      var resend = DJ.waLink(DJ.normalizePhone(h.to) || '', msgToClient(s, h.link));
      return '<div class="item" data-k="' + esc(h.k) + '">' +
        '<div class="item-top"><div><h3>' + esc(s.n) + '</h3><div class="meta">' + esc(eventLine(s)) + '</div></div>' +
          '<span class="status' + (signed ? ' signed' : '') + '">' + (signed ? icon('check') + 'נחתם' : 'ממתין לחתימה') + '</span></div>' +
        '<div class="meta">' + DJ.formatPrice(s.pr) + ' ש״ח · נשלח ' + DJ.formatDateTime(h.sentAt) + (h.to ? ' ל-' + esc(h.to) : '') + '</div>' +
        '<div class="actions">' +
          '<a class="btn ghost small" href="' + esc(signed ? h.signedLink : h.link) + '" target="_blank" rel="noopener">' + icon('eye') + (signed ? ' העותק החתום' : ' צפייה') + '</a>' +
          (signed ? '' : '<a class="btn ghost small" href="' + esc(resend) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחה שוב</a>') +
          '<button type="button" class="btn link small" data-act="del">' + icon('trash') + ' מחיקה</button>' +
        '</div></div>';
    }
    mount('<div class="wiz">' + ownerTop() +
      '<div class="preview-head"><h1>הסכמים שנשלחו</h1><p>הרשימה נשמרת במכשיר הזה בלבד.</p></div>' +
      '<div class="list">' + (list.length ? list.map(item).join('') : '<div class="empty">עדיין לא נשלחו הסכמים מהמכשיר הזה.</div>') + '</div>' +
      '<div class="actions"><button type="button" class="btn link" data-act="home">' + icon('arrowR') + ' חזרה להסכם</button></div>' +
      '</div>',
      Object.assign({
        del: function (el) {
          var k = el.closest('.item').dataset.k;
          if (!confirm('למחוק את ההסכם מהרשימה? (הקישור שנשלח ימשיך לעבוד)')) return;
          store.set('history', store.get('history', []).filter(function (h) { return h.k !== k; }));
          renderHistory();
        },
      }, ownerActs));
  }

  // ---------- client: signing page ----------
  var CLIENT_FIELDS = {
    cn: { label: 'שם מלא', attrs: 'type="text" autocomplete="name"', ph: 'שם פרטי ומשפחה' },
    id: { label: 'מספר תעודת זהות', attrs: 'type="text" inputmode="numeric" maxlength="9" autocomplete="off"', ph: '9 ספרות' },
    ph: { label: 'טלפון', attrs: 'type="tel" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right"', ph: '050-0000000' },
  };

  function validateClientField(key, v) {
    if (key === 'cn') return v.length >= 2 ? '' : 'נא למלא שם מלא';
    if (key === 'id') return /^\d{8,9}$/.test(v) && DJ.isValidIsraeliId(v) ? '' : 'מספר תעודת הזהות לא תקין';
    if (key === 'ph') return DJ.normalizePhone(v) ? '' : 'מספר הטלפון לא תקין';
    return '';
  }

  function renderSign(d) {
    var signedBefore = store.get('signed.' + d.k, '');
    var missing = ['cn', 'id', 'ph'].filter(function (k) { return !d[k]; });

    mount('<div class="view" style="padding-top:16px">' +
      (signedBefore ? '<div class="panel alert good no-print">' + icon('check') +
        '<div>כבר חתמת על ההסכם הזה מהמכשיר הזה. <a href="' + esc(signedBefore) + '">לצפייה בעותק החתום</a></div></div>' : '') +
      '<section class="panel no-print">' +
        '<h1>שלום ' + esc(d.cn || d.n) + ' 👋</h1>' +
        '<p>לפניכם הסכם ההתקשרות עם דיג׳י ליק לאירוע שלכם (' + esc(eventLine(d)) + '). ' +
          'קראו אותו בעיון, ' + (missing.length ? 'השלימו את הפרטים החסרים ' : '') + 'וחתמו בתחתית העמוד.</p>' +
        '<div class="actions"><button type="button" class="btn primary" data-act="to-sign">' + icon('pen') + ' מעבר לחתימה</button></div>' +
      '</section>' +
      renderDocument(d, 'sign') +
      '<section class="panel no-print" id="sign-panel" style="margin-top:18px">' +
        '<h2>אישור וחתימה</h2>' +
        '<p>' + (missing.length ? 'השלימו את הפרטים, ' : '') + 'סמנו את האישור וחתמו באצבע (או בעכבר) בתוך המסגרת.</p>' +
        '<form id="sign-form" novalidate>' +
          (missing.length ? '<div class="form-grid">' + missing.map(function (k) {
            var f = CLIENT_FIELDS[k];
            return '<div><label for="c-' + k + '">' + f.label + '</label>' +
              '<input id="c-' + k + '" data-key="' + k + '" class="inp" ' + f.attrs + ' placeholder="' + f.ph + '">' +
              '<p class="err" id="e-' + k + '"></p></div>';
          }).join('') + '</div>' : '') +
          '<label class="check"><input type="checkbox" id="agree"> קראתי את ההסכם, הבנתי את תנאיו ואני מאשר/ת אותם</label>' +
          '<p class="err" id="agree-err"></p>' +
          '<div class="section-label">חתימת המזמין</div>' +
          padHtml() +
          '<p class="err" id="sig-err"></p>' +
          '<div class="actions"><button type="submit" class="btn primary block">' + icon('check') + ' אישור וחתימה על ההסכם</button></div>' +
        '</form>' +
      '</section></div>',
      {
        'to-sign': function () { qs('#sign-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        'clear-pad': function () { if (pad) pad.clear(); },
      });

    pad = mountPad(qs('#pad'), function () { qs('#sig-err').textContent = ''; });

    qsa('#sign-form [data-key]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (inp.dataset.key === 'id') inp.value = inp.value.replace(/\D/g, '');
        var v = inp.value.trim();
        qsa('[data-bind="' + inp.dataset.key + '"]').forEach(function (el) { el.textContent = v; });
        qsa('[data-bindtext="' + inp.dataset.key + '"]').forEach(function (el) { el.textContent = v ? ': ' + v : ''; });
        inp.classList.remove('invalid');
        qs('#e-' + inp.dataset.key).textContent = '';
      });
    });
    qs('#agree').addEventListener('change', function () { qs('#agree-err').textContent = ''; });

    qs('#sign-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var vals = {}, firstBad = null;
      missing.forEach(function (k) {
        var inp = qs('#c-' + k), v = inp.value.trim(), msg = validateClientField(k, v);
        qs('#e-' + k).textContent = msg;
        inp.classList.toggle('invalid', !!msg);
        if (msg && !firstBad) firstBad = inp;
        vals[k] = v;
      });
      if (!qs('#agree').checked) {
        qs('#agree-err').textContent = 'יש לאשר שקראת את ההסכם';
        firstBad = firstBad || qs('#agree');
      }
      if (pad.isEmpty()) {
        qs('#sig-err').textContent = 'נא לחתום בתוך המסגרת';
        qs('#pad').classList.add('invalid');
        firstBad = firstBad || qs('#pad');
      } else {
        qs('#sig-err').textContent = '';
      }
      if (firstBad) {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var signed = Object.assign({}, d, vals, { cs: pad.encode(), ct: Date.now() });
      var link = linkFor(signed);
      store.set('signed.' + d.k, link);
      history.replaceState(null, '', '#c=' + link.split('#c=')[1]);
      renderSigned(signed, true);
    });
  }

  // ---------- signed copy ----------
  function ownerEntry(d) {
    var list = store.get('history', []);
    var h = list.filter(function (x) { return x.k === d.k; })[0];
    if (h && !h.signedAt) {
      h.signedAt = d.ct;
      h.signedLink = linkFor(d);
      store.set('history', list);
    }
    return h || null;
  }

  function renderSigned(d, justSigned) {
    var link = linkFor(d);
    var h = ownerEntry(d);
    var toOwner = DJ.waLink(CONFIG.ownerPhone, msgToOwner(d, link));
    var verify = '';
    if (h) {
      var bad = DJ.ownerMismatches(h.sent, d);
      verify = bad.length
        ? '<div class="panel alert bad no-print">' + icon('alert') + '<div><b>שימו לב:</b> הפרטים הבאים שונים ממה ששלחת: ' +
            bad.map(function (k) { return LABELS[k]; }).join(', ') + '.</div></div>'
        : '<div class="panel alert good no-print">' + icon('shield') + '<div>אומת: פרטי ההסכם החתום זהים להסכם ששלחת.</div></div>';
    }

    var top;
    if (justSigned) {
      top = '<section class="panel ok no-print">' +
        '<svg class="success-mark" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/><path d="M19 33l9 9 17-19"/></svg>' +
        '<h1>ההסכם נחתם בהצלחה!</h1>' +
        '<p>נשאר רק לשלוח את העותק החתום לדיג׳י ליק בוואטסאפ. ההודעה תישאר גם אצלכם, וכך לכל צד יש עותק של ההסכם החתום.</p>' +
        '<div class="actions">' +
          '<a class="btn wa block" href="' + esc(toOwner) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחת העותק החתום לדיג׳י ליק</a>' +
          '<div class="row">' +
            '<button type="button" class="btn ghost" data-act="print">' + icon('download') + ' שמירה כ-PDF</button>' +
            '<button type="button" class="btn ghost" data-act="copy">' + icon('link') + ' העתקת קישור</button>' +
          '</div>' +
        '</div></section>';
    } else {
      var clientPhone = DJ.normalizePhone(d.ph) || (h && DJ.normalizePhone(h.to)) || '';
      var sendBtn = h
        ? '<a class="btn ghost" href="' + esc(DJ.waLink(clientPhone, msgSignedCopy(d, link))) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחת עותק ללקוח</a>'
        : '<a class="btn ghost" href="' + esc(toOwner) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחה לדיג׳י ליק</a>';
      top = '<section class="panel no-print">' +
        '<h1>הסכם חתום ✓</h1>' +
        '<p>' + esc(d.n) + ' · ' + esc(eventLine(d)) + '<br>נחתם ע״י המזמין ב-' + DJ.formatDateTime(d.ct) + '</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary" data-act="print">' + icon('download') + ' שמירה כ-PDF / הדפסה</button>' +
          '<div class="row">' + sendBtn +
            '<button type="button" class="btn ghost" data-act="copy">' + icon('link') + ' העתקת קישור</button>' +
          '</div>' +
        '</div></section>';
    }

    mount('<div class="view" style="padding-top:16px">' + verify + top + renderDocument(d, 'signed') + '</div>', {
      print: function () { printDoc(d); },
      copy: function () {
        copyText(link).then(function (ok) { toast(ok ? 'הקישור לעותק החתום הועתק' : 'ההעתקה נכשלה'); });
      },
    });
  }

  function renderBroken() {
    mount('<div class="wiz" style="padding-top:40px"><div class="card" style="text-align:center">' +
      '<img src="img/logo.png" alt="DJ LIC" style="width:110px">' +
      '<h1 style="font-size:24px;margin:14px 0 6px">הקישור לא תקין</h1>' +
      '<p class="hint">ייתכן שהקישור נקטע בהעתקה. בקשו מדיג׳י ליק לשלוח אותו שוב.</p>' +
      '<a class="btn wa block" href="' + esc(DJ.waLink(CONFIG.ownerPhone, 'היי אלי, הקישור להסכם לא נפתח לי – אפשר לשלוח שוב? 🙏')) + '" target="_blank" rel="noopener">' +
        icon('wa') + ' פנייה לדיג׳י ליק</a>' +
    '</div></div>');
  }

  // ---------- routing ----------
  function route() {
    var h = location.hash;
    if (h.indexOf('#c=') === 0) {
      var data;
      try { data = cleanData(DJ.decodePayload(h.slice(3))); } catch (e) { return renderBroken(); }
      if (!data.n || !data.d) return renderBroken();
      return data.cs ? renderSigned(data, false) : renderSign(data);
    }
    if (h === '#history') return renderHistory();
    renderWizard();
  }

  window.addEventListener('hashchange', route);
  route();
})();

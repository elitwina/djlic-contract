/*
 * DJ LIC – contract app.
 *  - No hash        → owner home: every contract and its status (password protected)
 *  - #new           → owner wizard (one question per screen) → preview → send on WhatsApp
 *  - #<id>          → the contract itself: signing page until the client signs, signed copy after
 * Contracts live in the owner's Google Sheet (backend/Code.gs), so links stay short.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Google Apps Script web-app URL (ends with /exec)
    apiUrl: 'https://script.google.com/macros/s/AKfycbwdh2Mlf9OgZdJW_Jvpe1ZkJsGJ_LnvJobYUT7hu5KmWpIcV0LPnxtc-RwH0ah3I6P-0g/exec',
    ownerPhone: '972522967041',
    ownerPhoneDisplay: '052-296-7041',
    // Used for links when the page is opened from a local file instead of the website
    publicUrl: 'https://elitwina.github.io/djlic-contract/',
  };

  var EVENT_TYPES = ['חתונה', 'בר מצווה', 'בת מצווה', 'חינה', 'ברית / בריתה', 'יום הולדת', 'אירוע חברה', 'מסיבה פרטית'];

  var STEPS = [
    { key: 'n', type: 'text', title: 'מי המזמינים?', hint: 'השמות כפי שיופיעו בהסכם', placeholder: 'למשל: שחף ורון' },
    { key: 't', type: 'chips', title: 'מה סוג האירוע?', hint: 'בחרו מהרשימה או כתבו בעצמכם' },
    { key: 'd', type: 'date', title: 'מתי האירוע?' },
    { key: 'p', type: 'text', title: 'איפה האירוע?', hint: 'שם המקום והעיר', placeholder: 'למשל: באסיקו נס ציונה' },
    { key: 'pr', type: 'money', title: 'מה מחיר ההזמנה?', hint: 'בשקלים, כולל מע״מ' },
    { key: 'cn', type: 'text', optional: true, title: 'שם המזמין', hint: 'השם המלא של מי שחותם על ההסכם. אפשר לדלג – הלקוח ימלא בעצמו.', placeholder: 'שם פרטי ומשפחה' },
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
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    contacts: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v2M8 2v2"/><circle cx="12" cy="11" r="3"/><path d="M7 22v-1a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  };
  var WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z';

  function icon(name) {
    if (name === 'wa') return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + WA_PATH + '"/></svg>';
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  var SUCCESS_MARK = '<svg class="success-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32"/><path d="M19 33l9 9 17-19"/></svg>';

  // ---------- storage (best effort: private mode may block it) ----------
  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem('djlic.' + k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem('djlic.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem('djlic.' + k); } catch (e) { /* ignore */ } },
  };

  // ---------- small helpers ----------
  var app = document.getElementById('app');
  var actions = {};
  var pad = null;
  var nav = 0; // bumps on every navigation so late async results don't paint over a newer page

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function mount(html, acts) {
    closeOverlay();
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
    var a = new Uint8Array(8);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return DJ.b64urlEncode(a);
  }

  function sha256hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  function baseUrl() {
    return location.protocol === 'file:' ? CONFIG.publicUrl : location.origin + location.pathname;
  }
  function contractLink(k) { return baseUrl() + '#' + k; }

  // Never trust what came over the network: coerce every field to the expected shape
  function cleanData(r) {
    function s(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }
    return {
      k: s(r.k, 40), n: s(r.n), t: s(r.t, 60),
      d: /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : '',
      p: s(r.p), pr: Math.max(0, Math.round(Number(r.pr) || 0)),
      cn: s(r.cn), id: s(r.id, 20), ph: s(r.ph, 30), w: s(r.w, 30),
      ds: s(r.ds, 30000), dt: Number(r.dt) || 0,
      cs: s(r.cs, 30000), ct: Number(r.ct) || 0,
    };
  }

  function eventLine(d) { return [d.t, DJ.formatDate(d.d), d.p].filter(Boolean).join(' · '); }

  function msgToClient(d, link) {
    return 'היי ' + (d.cn || d.n) + ',\n' +
      'מצורף הסכם ההתקשרות לאירוע שלכם:\n' + eventLine(d) + '\n\n' +
      'לצפייה בהסכם ולחתימה:\n' + link + '\n\n' +
      'תודה,\nאלי טוינה – DJ LIC';
  }
  function msgToOwner(d, link) {
    return 'היי אלי, חתמתי על ההסכם.\n' + d.n + ' · ' + eventLine(d) + '\n\n' + 'העותק החתום:\n' + link;
  }
  function msgSignedCopy(d, link) {
    return 'העותק החתום של הסכם ההתקשרות – DJ LIC\n' + d.n + ' · ' + eventLine(d) + '\n\n' + link;
  }

  function printDoc(d) {
    var title = document.title;
    document.title = 'הסכם התקשרות – ' + d.n + ' – ' + DJ.formatDate(d.d);
    window.print();
    setTimeout(function () { document.title = title; }, 1500);
  }

  // ---------- server ----------
  function apiError(code, data) {
    var e = new Error(code);
    e.code = code;
    e.data = data;
    return e;
  }

  // Every action is safe to repeat (sign refuses a second signature), so a hiccup gets one retry
  function api(payload, retried) {
    if (!CONFIG.apiUrl) return Promise.reject(apiError('no-server'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(CONFIG.apiUrl, { method: 'POST', body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .catch(function () { throw apiError('network'); })
      .then(function (j) {
        clearTimeout(timer);
        if (!j || !j.ok) throw apiError((j && j.error) || 'error', j && j.data);
        return j;
      }, function (e) {
        clearTimeout(timer);
        if (e.code === 'network' && !retried) {
          return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return api(payload, true); });
        }
        throw e;
      });
  }

  // Fire-and-forget save that survives the page going to the background (WhatsApp opening)
  function beacon(payload) {
    if (!CONFIG.apiUrl) return;
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon && navigator.sendBeacon(CONFIG.apiUrl, body)) return;
    try { fetch(CONFIG.apiUrl, { method: 'POST', body: body, keepalive: true }); } catch (e) { /* ignore */ }
  }

  // ---------- owner session ----------
  function ownerKey() { return store.get('owner', ''); }

  function logout() {
    store.del('owner');
    store.del('list');
    location.hash = '';
    route();
  }

  function renderLogin() {
    mount('<div class="auth"><div class="card auth-card">' +
      '<img class="auth-logo" src="img/logo.png" alt="DJ LIC">' +
      '<h1>כניסה לממשק ההסכמים</h1>' +
      '<p class="hint">הכניסה נשמרת במכשיר הזה, כך שלא תצטרך להקליד את הסיסמה שוב.</p>' +
      '<form id="login" novalidate>' +
        '<input type="text" name="username" autocomplete="username" value="DJ LIC" hidden>' +
        '<input id="pw" class="inp" type="password" name="password" autocomplete="current-password" placeholder="סיסמה" aria-label="סיסמה">' +
        '<p class="err" id="err" role="alert"></p>' +
        '<button type="submit" class="btn primary block" id="go">' + icon('lock') + ' כניסה</button>' +
      '</form></div></div>');

    var form = qs('#login'), pw = qs('#pw'), err = qs('#err'), go = qs('#go');
    pw.focus();
    pw.addEventListener('input', function () { err.textContent = ''; pw.classList.remove('invalid'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pw.value) { err.textContent = 'הקלד את הסיסמה'; return; }
      go.disabled = true;
      sha256hex(pw.value + ':djlic').then(function (token) {
        return api({ a: 'ping', key: token }).then(function () {
          store.set('owner', token);
          route();
        });
      }).catch(function (ex) {
        go.disabled = false;
        pw.classList.add('invalid');
        err.textContent = ex.code === 'unauthorized' ? 'הסיסמה שגויה'
          : ex.code === 'no-server' ? 'השרת עוד לא הוגדר'
          : 'אין חיבור לשרת – נסה שוב';
      });
    });
  }

  // ---------- the contract document ----------
  function renderDocument(d, mode) {
    var owner = mode === 'owner';
    var signed = !!d.cs;
    var editable = STEPS.map(function (s) { return s.key; });

    function f(key, text) {
      if (owner && editable.indexOf(key) >= 0) {
        return '<button type="button" class="fld" data-goto="' + key + '">' +
          (text ? esc(text) : '<span class="todo">ימולא ע״י הלקוח</span>') + '</button>';
      }
      if (owner && !text) return '<span class="todo">ימולא ע״י הלקוח</span>';
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
            (d.dt ? '<span>הופק ב-' + DJ.formatDay(d.dt) + '</span>' : '') +
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

  // ---------- overlays (bottom sheet / centred modal) ----------
  var overlayEl = null;
  function onOverlayKey(e) { if (e.key === 'Escape') closeOverlay(); }
  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.remove();
    overlayEl = null;
    document.removeEventListener('keydown', onOverlayKey);
  }
  function openOverlay(html, centred) {
    closeOverlay();
    var el = document.createElement('div');
    el.className = 'sheet-bg no-print' + (centred ? ' center' : '');
    el.innerHTML = html;
    el.addEventListener('click', function (e) { if (e.target === el) closeOverlay(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', onOverlayKey);
    overlayEl = el;
    return el;
  }

  // ---------- owner: wizard ----------
  function blankDraft() { return { k: newKey(), n: '', t: '', d: '', p: '', pr: 0, cn: '', ds: '', w: '', saved: false }; }

  var W = {
    data: Object.assign(blankDraft(), store.get('draft', {})),
    step: store.get('step', 0),
    returnToPreview: false,
    resign: false,
    dir: 'fwd',
  };
  delete W.data.id; // older drafts asked the owner for these; the client fills them now
  delete W.data.ph;

  function saveDraft() { store.set('draft', W.data); store.set('step', W.step); }
  function hasDraft() { return !!W.data.n && !W.data.saved; }

  function go(step, dir) {
    W.step = step;
    W.dir = dir || 'fwd';
    saveDraft();
    renderWizard();
  }

  function startNew() {
    if (hasDraft() && !confirm('יש טיוטה שלא נשלחה (' + W.data.n + '). להתחיל הסכם חדש במקומה?')) return;
    W.data = blankDraft();
    W.step = 0;
    W.returnToPreview = false;
    W.resign = false;
    saveDraft();
    location.hash = 'new';
  }

  function editContract(d) {
    W.data = { k: d.k, n: d.n, t: d.t, d: d.d, p: d.p, pr: d.pr, cn: d.cn, ds: d.ds, w: d.w, saved: true };
    W.step = 'preview';
    W.returnToPreview = false;
    W.resign = false;
    saveDraft();
    location.hash = 'new';
  }

  function ownerTop(extra) {
    return '<header class="topbar no-print">' +
      '<a class="brand" href="#"><img src="img/logo.png" alt="DJ LIC">' +
        '<span class="brand-text">הסכמי התקשרות<small>DJ LIC · אלי טוינה</small></span></a>' +
      '<nav class="topnav">' + (extra || '') + '</nav>' +
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
      if (W.data[s.key] !== value) W.data.saved = false;
      W.data[s.key] = value;
      W.resign = false;
      if (W.returnToPreview) { W.returnToPreview = false; go('preview'); }
      else go(last ? 'preview' : i + 1);
    }

    mount('<div class="wiz">' + ownerTop('<a class="navbtn" href="#">' + icon('list') + 'כל ההסכמים</a>') +
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
      {
        prev: function () { go(i - 1, 'back'); },
        skip: function () { next(''); },
        'cancel-edit': function () { W.returnToPreview = false; W.resign = false; go('preview', 'back'); },
        resign: function () { W.resign = true; W.dir = ''; renderWizard(); },
        'clear-pad': function () { if (pad) pad.clear(); },
      });

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
    mount('<div class="view">' + ownerTop('<a class="navbtn" href="#">' + icon('list') + 'כל ההסכמים</a>') +
      '<div class="preview-head no-print"><h1>תצוגה מקדימה</h1>' +
        '<p>כך הלקוח יראה את ההסכם. לחיצה על פרט מסומן מחזירה לעריכה שלו.</p></div>' +
      renderDocument(d, 'owner') +
      '<div class="sticky no-print">' +
        '<button type="button" class="btn ghost" data-act="back">' + icon('arrowR') + ' חזרה</button>' +
        '<button type="button" class="btn wa" data-act="send">' + icon('wa') + ' שליחה ללקוח בוואטסאפ</button>' +
      '</div></div>',
      {
        back: function () { go(STEPS.length - 1, 'back'); },
        send: openSendSheet,
        goto: function (key) {
          var idx = STEPS.map(function (x) { return x.key; }).indexOf(key);
          if (idx < 0) return;
          W.returnToPreview = true;
          W.resign = key === 'ds';
          go(idx);
        },
      });
  }

  function savePayload(d, w) {
    return { a: 'save', key: ownerKey(), data: { k: d.k, n: d.n, t: d.t, d: d.d, p: d.p, pr: d.pr, cn: d.cn, ds: d.ds, w: w == null ? d.w : w } };
  }

  // Best number from a picked contact: an Israeli mobile if there is one
  function pickPhone(tels) {
    var valid = (tels || []).filter(function (t) { return DJ.normalizePhone(t); });
    return valid.filter(function (t) { return DJ.normalizePhone(t).indexOf('9725') === 0; })[0] || valid[0] || '';
  }

  function openSendSheet() {
    var d = W.data;
    var link = contractLink(d.k);
    var ready = false;
    var canPick = !!(navigator.contacts && navigator.contacts.select);

    var el = openOverlay('<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">' +
      '<div id="sh-form">' +
        '<h2 id="sh-t">שליחה ללקוח</h2>' +
        '<p>הלקוח יקבל קישור קצר לצפייה בהסכם ולחתימה מהטלפון.</p>' +
        '<div class="save-state" id="sh-state"><span class="spin dark"></span><span id="sh-state-text">שומר את ההסכם…</span></div>' +
        '<label for="to">מספר הוואטסאפ של הלקוח</label>' +
        '<div class="inp-wrap' + (canPick ? ' has-pick' : '') + '">' +
          '<input id="to" class="inp" type="tel" inputmode="tel" dir="ltr" autocomplete="off" placeholder="050-0000000" value="' + esc(d.w) + '">' +
          (canPick ? '<button type="button" class="pick" data-sh="pick">' + icon('contacts') + 'אנשי קשר</button>' : '') +
        '</div>' +
        '<p class="note" id="picked"></p>' +
        '<p class="err" id="to-err"></p>' +
        '<div class="actions">' +
          '<a class="btn wa block wait" id="wa-send" href="#" target="_blank" rel="noopener">' + icon('wa') + ' שליחה בוואטסאפ</a>' +
          '<a class="btn ghost block wait" id="wa-pick" href="#" target="_blank" rel="noopener">' + icon('contacts') + ' בחירת איש קשר מתוך וואטסאפ</a>' +
          '<button type="button" class="btn ghost block wait" data-sh="copy">' + icon('link') + ' העתקת הקישור</button>' +
          '<button type="button" class="btn link" data-sh="close">ביטול</button>' +
        '</div>' +
      '</div>' +
      '<div id="sh-done" hidden>' + SUCCESS_MARK +
        '<h2>ההסכם נשלח</h2>' +
        '<p>ההסכם נשמר ברשימת ההסכמים שלך. ברגע שהלקוח יחתום, הסטטוס יתעדכן ל"נחתם" והלקוח ישלח לך את העותק החתום בוואטסאפ.</p>' +
        '<div class="actions"><button type="button" class="btn primary block" data-sh="home">' + icon('list') + ' לכל ההסכמים</button></div>' +
      '</div>' +
    '</div>');

    var to = qs('#to', el), toErr = qs('#to-err', el), waBtn = qs('#wa-send', el), waPick = qs('#wa-pick', el);
    var state = qs('#sh-state', el), stateText = qs('#sh-state-text', el);

    function save() {
      state.className = 'save-state';
      stateText.textContent = 'שומר את ההסכם…';
      state.hidden = false;
      api(savePayload(d)).then(function (r) {
        d.dt = r.data.dt;
        d.saved = true;
        saveDraft();
        ready = true;
        state.hidden = true;
        qsa('.wait', el).forEach(function (b) { b.classList.remove('wait'); });
      }, function (e) {
        if (e.code === 'unauthorized') { closeOverlay(); return logout(); }
        state.className = 'save-state bad';
        stateText.innerHTML = (e.code === 'already signed' ? 'ההסכם הזה כבר נחתם ואי אפשר לשנות אותו.'
          : 'לא הצלחנו לשמור את ההסכם. בדוק את החיבור לאינטרנט.') +
          ' <button type="button" class="btn link small" data-sh="retry">' + icon('refresh') + ' נסה שוב</button>';
      });
    }
    function done() {
      setTimeout(function () {
        qs('#sh-form', el).hidden = true;
        qs('#sh-done', el).hidden = false;
      }, 500);
    }

    to.addEventListener('input', function () { toErr.textContent = ''; to.classList.remove('invalid'); qs('#picked', el).textContent = ''; });
    to.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); waBtn.click(); } });

    waBtn.addEventListener('click', function (e) {
      if (!ready) { e.preventDefault(); return; }
      var phone = DJ.normalizePhone(to.value);
      if (!phone) {
        e.preventDefault();
        toErr.textContent = to.value.trim() ? 'מספר הטלפון לא תקין' : 'הקלידו את מספר הטלפון של הלקוח' + (canPick ? ' או בחרו מאנשי הקשר' : '');
        to.classList.add('invalid');
        to.focus();
        return;
      }
      waBtn.href = DJ.waLink(phone, msgToClient(d, link));
      d.w = DJ.formatLocalPhone(to.value);
      saveDraft();
      beacon(savePayload(d, d.w)); // remember who it was sent to (pre-fills the client's phone)
      done();
    });

    waPick.addEventListener('click', function (e) {
      if (!ready) { e.preventDefault(); return; }
      waPick.href = DJ.waLink('', msgToClient(d, link));
      done();
    });

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sh]');
      if (!b) return;
      var act = b.dataset.sh;
      if (act === 'close') closeOverlay();
      if (act === 'retry') save();
      if (act === 'home') {
        W.data = blankDraft();
        W.step = 0;
        saveDraft();
        location.hash = '';
      }
      if (act === 'copy' && ready) {
        copyText(link).then(function (ok) { toast(ok ? 'הקישור הועתק' : 'ההעתקה נכשלה'); });
      }
      if (act === 'pick') {
        navigator.contacts.select(['name', 'tel'], { multiple: false }).then(function (list) {
          if (!list || !list.length) return;
          var c = list[0], tel = pickPhone(c.tel);
          if (!tel) { toErr.textContent = 'לאיש הקשר שנבחר אין מספר טלפון'; return; }
          to.value = DJ.formatLocalPhone(tel);
          to.classList.remove('invalid');
          toErr.textContent = '';
          qs('#picked', el).textContent = (c.name && c.name[0]) ? 'נבחר: ' + c.name[0] : '';
        }).catch(function () { /* picker dismissed */ });
      }
    });

    save();
  }

  // ---------- owner: home (all contracts) ----------
  function renderHome() {
    var my = nav;
    var cached = store.get('list', null);

    mount('<div class="wiz home">' +
      ownerTop('<button type="button" class="navbtn" data-act="logout">' + icon('logout') + 'יציאה</button>') +
      '<div class="home-head"><h1>ההסכמים שלי</h1><p id="summary">&nbsp;</p></div>' +
      '<div id="draft"></div>' +
      '<div class="list" id="list"></div>' +
      '<button type="button" class="fab" data-act="new">' + icon('plus') + ' הסכם חדש</button>' +
      '</div>',
      {
        new: startNew,
        logout: function () { if (confirm('לצאת מהממשק במכשיר הזה?')) logout(); },
        resume: function () { location.hash = 'new'; },
        discard: function () {
          if (!confirm('למחוק את הטיוטה?')) return;
          W.data = blankDraft();
          W.step = 0;
          saveDraft();
          paintDraft();
        },
        edit: function (b) {
          var k = b.closest('.item').dataset.k;
          b.disabled = true;
          api({ a: 'get', k: k }).then(function (r) {
            var d = cleanData(r.data);
            if (d.cs) { toast('ההסכם כבר נחתם'); return renderHome(); }
            editContract(d);
          }, function () { b.disabled = false; toast('לא הצלחנו לטעון את ההסכם'); });
        },
        copy: function (b) {
          var link = contractLink(b.closest('.item').dataset.k);
          copyText(link).then(function (ok) { toast(ok ? 'הקישור הועתק' : 'ההעתקה נכשלה'); });
        },
        retry: renderHome,
      });

    function paintDraft() {
      var box = qs('#draft');
      if (!box) return;
      box.innerHTML = hasDraft()
        ? '<div class="item draft"><div class="item-top"><div><h3>' + esc(W.data.n) + '</h3>' +
            '<div class="meta">' + esc(eventLine(W.data)) + '</div></div><span class="status draft">טיוטה – לא נשלחה</span></div>' +
            '<div class="actions">' +
              '<button type="button" class="btn ghost small" data-act="resume">' + icon('pen') + ' המשך עריכה</button>' +
              '<button type="button" class="btn link small" data-act="discard">' + icon('trash') + ' מחיקה</button>' +
            '</div></div>'
        : '';
    }

    function item(c) {
      var signed = c.ct > 0;
      var link = contractLink(c.k);
      var phone = DJ.normalizePhone(c.w);
      return '<div class="item' + (signed ? ' is-signed' : '') + '" data-k="' + esc(c.k) + '">' +
        '<div class="item-top"><div><h3>' + esc(c.n) + '</h3><div class="meta">' + esc(eventLine(c)) + '</div></div>' +
          '<span class="status' + (signed ? ' signed' : '') + '">' + (signed ? icon('check') + 'נחתם' : 'ממתין לחתימה') + '</span></div>' +
        '<div class="meta">' + DJ.formatPrice(c.pr) + ' ש״ח · ' +
          (signed ? 'נחתם ' + DJ.formatDateTime(c.ct) + (c.cn ? ' ע״י ' + esc(c.cn) : '')
                  : 'נשלח ' + DJ.formatDateTime(c.dt) + (c.w ? ' ל-<bdi>' + esc(c.w) + '</bdi>' : '')) + '</div>' +
        '<div class="actions">' +
          '<a class="btn ghost small" href="#' + esc(c.k) + '">' + icon('eye') + (signed ? ' העותק החתום' : ' צפייה') + '</a>' +
          (!signed && phone ? '<a class="btn ghost small" href="' + esc(DJ.waLink(phone, msgToClient(c, link))) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחה שוב</a>' : '') +
          (!signed ? '<button type="button" class="btn ghost small" data-act="edit">' + icon('pen') + ' עריכה</button>' : '') +
          '<button type="button" class="btn link small" data-act="copy">' + icon('link') + ' קישור</button>' +
        '</div></div>';
    }

    function paintList(items, loading) {
      var list = qs('#list'), summary = qs('#summary');
      if (!list) return;
      if (!items) {
        list.innerHTML = loading ? '<div class="empty"><span class="spin dark"></span><br>טוען את ההסכמים…</div>' : '';
        return;
      }
      var signedCount = items.filter(function (c) { return c.ct > 0; }).length;
      summary.textContent = items.length
        ? 'סה״כ ' + items.length + ' · נחתמו ' + signedCount + ' · ממתינים לחתימה ' + (items.length - signedCount)
        : '';
      list.innerHTML = items.length ? items.map(item).join('')
        : '<div class="empty">עדיין אין הסכמים.<br>לחצו על "הסכם חדש" כדי ליצור את הראשון.</div>';
    }

    paintDraft();
    paintList(cached, true);
    api({ a: 'list', key: ownerKey() }).then(function (r) {
      if (my !== nav) return;
      store.set('list', r.items);
      paintList(r.items, false);
    }, function (e) {
      if (my !== nav) return;
      if (e.code === 'unauthorized') return logout();
      if (!cached) {
        qs('#list').innerHTML = '<div class="empty">לא הצלחנו לטעון את ההסכמים.<br>' +
          '<button type="button" class="btn ghost small" data-act="retry">' + icon('refresh') + ' נסה שוב</button></div>';
      } else {
        toast('אין חיבור לשרת – מוצגת הרשימה האחרונה');
      }
    });
  }

  // ---------- contract pages (client + owner) ----------
  function renderLoading(text) {
    mount('<div class="loading"><img src="img/logo.png" alt="DJ LIC"><span class="spin dark"></span><p>' + esc(text) + '</p></div>');
  }

  function openContract(k) {
    var my = nav;
    renderLoading('טוען את ההסכם…');
    api({ a: 'get', k: k }).then(function (r) {
      if (my !== nav) return;
      var d = cleanData(r.data);
      if (d.cs) renderSigned(d, false); else renderSign(d);
    }, function (e) {
      if (my !== nav) return;
      renderBroken(e.code === 'not found' ? 'notfound' : 'network');
    });
  }

  function ownerBar(d) {
    if (!ownerKey()) return '';
    var link = contractLink(d.k);
    var btns = '<a class="btn ghost small" href="#">' + icon('list') + ' כל ההסכמים</a>';
    if (!d.cs) {
      btns += '<button type="button" class="btn ghost small" data-act="edit">' + icon('pen') + ' עריכה</button>';
      if (DJ.normalizePhone(d.w)) {
        btns += '<a class="btn ghost small" href="' + esc(DJ.waLink(DJ.normalizePhone(d.w), msgToClient(d, link))) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחה שוב</a>';
      }
    } else if (DJ.normalizePhone(d.ph)) {
      btns += '<a class="btn ghost small" href="' + esc(DJ.waLink(DJ.normalizePhone(d.ph), msgSignedCopy(d, link))) + '" target="_blank" rel="noopener">' + icon('wa') + ' עותק ללקוח</a>';
    }
    return '<div class="panel owner-bar no-print"><div class="owner-title">' + icon('shield') +
      (d.cs ? ' מצב ניהול · ההסכם נחתם' : ' מצב ניהול · כך הלקוח רואה את ההסכם') + '</div>' +
      '<div class="owner-actions">' + btns + '</div></div>';
  }

  var CLIENT_FIELDS = {
    cn: { label: 'שם מלא', attrs: 'type="text" autocomplete="name"', ph: 'שם פרטי ומשפחה' },
    id: { label: 'מספר תעודת זהות', attrs: 'type="text" inputmode="numeric" maxlength="9" autocomplete="off"', ph: '9 ספרות' },
    ph: { label: 'טלפון', attrs: 'type="tel" inputmode="tel" autocomplete="tel" dir="ltr"', ph: '050-0000000' },
  };

  function validateClientField(key, v) {
    if (key === 'cn') return v.length >= 2 ? '' : 'נא למלא שם מלא';
    if (key === 'id') return /^\d{8,9}$/.test(v) && DJ.isValidIsraeliId(v) ? '' : 'מספר תעודת הזהות לא תקין';
    if (key === 'ph') return DJ.normalizePhone(v) ? '' : 'מספר הטלפון לא תקין';
    return '';
  }

  function renderSign(d) {
    var fields = (d.cn ? [] : ['cn']).concat(['id', 'ph']);
    var prefill = { ph: d.w ? DJ.formatLocalPhone(d.w) : '' };

    mount('<div class="view" style="padding-top:16px">' + ownerBar(d) +
      '<section class="panel no-print">' +
        '<h1>שלום ' + esc(d.cn || d.n) + '</h1>' +
        '<p>לפניכם הסכם ההתקשרות עם דיג׳י ליק לאירוע שלכם (' + esc(eventLine(d)) + '). ' +
          'קראו אותו בעיון, השלימו את הפרטים החסרים וחתמו בתחתית העמוד.</p>' +
        '<div class="actions"><button type="button" class="btn primary" data-act="to-sign">' + icon('pen') + ' מעבר לחתימה</button></div>' +
      '</section>' +
      renderDocument(d, 'sign') +
      '<section class="panel no-print" id="sign-panel" style="margin-top:18px">' +
        '<h2>אישור וחתימה</h2>' +
        '<p>השלימו את הפרטים, סמנו את האישור וחתמו באצבע (או בעכבר) בתוך המסגרת.</p>' +
        '<form id="sign-form" novalidate>' +
          '<div class="form-grid">' + fields.map(function (k) {
            var f = CLIENT_FIELDS[k];
            return '<div><label for="c-' + k + '">' + f.label + '</label>' +
              '<input id="c-' + k + '" data-key="' + k + '" class="inp" ' + f.attrs + ' placeholder="' + f.ph + '" value="' + esc(prefill[k] || '') + '">' +
              '<p class="err" id="e-' + k + '"></p></div>';
          }).join('') + '</div>' +
          '<label class="check consent" id="consent"><input type="checkbox" id="agree"> קראתי את ההסכם, הבנתי את תנאיו ואני מאשר/ת אותם</label>' +
          '<p class="err" id="agree-err"></p>' +
          '<div class="section-label">חתימת המזמין</div>' +
          padHtml() +
          '<p class="err" id="sig-err"></p>' +
          '<div class="actions"><button type="submit" class="btn primary block" id="sign-btn">' + icon('check') + ' אישור וחתימה על ההסכם</button></div>' +
          '<p class="err" id="submit-err" role="alert"></p>' +
        '</form>' +
      '</section></div>',
      {
        'to-sign': function () { qs('#sign-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        'clear-pad': function () { if (pad) pad.clear(); },
        edit: function () { editContract(d); },
      });

    pad = mountPad(qs('#pad'), function () { qs('#sig-err').textContent = ''; });

    function sync(inp) {
      var v = inp.value.trim();
      qsa('[data-bind="' + inp.dataset.key + '"]').forEach(function (el) { el.textContent = v; });
      qsa('[data-bindtext="' + inp.dataset.key + '"]').forEach(function (el) { el.textContent = v ? ': ' + v : ''; });
    }
    qsa('#sign-form [data-key]').forEach(function (inp) {
      sync(inp);
      inp.addEventListener('input', function () {
        if (inp.dataset.key === 'id') inp.value = inp.value.replace(/\D/g, '');
        sync(inp);
        inp.classList.remove('invalid');
        qs('#e-' + inp.dataset.key).textContent = '';
      });
    });
    qs('#agree').addEventListener('change', function () {
      qs('#agree-err').textContent = '';
      qs('#consent').classList.remove('attention');
    });

    var btn = qs('#sign-btn');
    qs('#sign-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var vals = {}, firstBad = null;
      fields.forEach(function (k) {
        var inp = qs('#c-' + k), v = inp.value.trim(), msg = validateClientField(k, v);
        qs('#e-' + k).textContent = msg;
        inp.classList.toggle('invalid', !!msg);
        if (msg && !firstBad) firstBad = inp;
        vals[k] = v;
      });
      if (!qs('#agree').checked) {
        var box = qs('#consent');
        box.classList.remove('attention');
        void box.offsetWidth; // restart the shake animation
        box.classList.add('attention');
        qs('#agree-err').textContent = 'יש לסמן כאן שקראת את ההסכם ושאת/ה מאשר/ת אותו';
        firstBad = firstBad || box;
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

      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> שומר את החתימה…';
      qs('#submit-err').textContent = '';
      api({ a: 'sign', k: d.k, data: { cn: vals.cn || '', id: vals.id, ph: vals.ph, cs: pad.encode() } }).then(function (r) {
        renderSigned(cleanData(r.data), true);
      }, function (ex) {
        if (ex.code === 'already signed' && ex.data) {
          toast('ההסכם כבר נחתם');
          return renderSigned(cleanData(ex.data), false);
        }
        btn.disabled = false;
        btn.innerHTML = icon('check') + ' אישור וחתימה על ההסכם';
        qs('#submit-err').textContent = 'לא הצלחנו לשמור את החתימה. בדקו את החיבור לאינטרנט ונסו שוב.';
      });
    });
  }

  function renderSigned(d, justSigned) {
    var link = contractLink(d.k);
    var owner = !!ownerKey();
    var toOwner = DJ.waLink(CONFIG.ownerPhone, msgToOwner(d, link));

    mount('<div class="view" style="padding-top:16px">' + ownerBar(d) +
      '<section class="panel no-print">' +
        '<h1>הסכם חתום ✓</h1>' +
        '<p>' + esc(d.n) + ' · ' + esc(eventLine(d)) + '<br>נחתם ע״י המזמין ב-' + DJ.formatDateTime(d.ct) + '</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary" data-act="print">' + icon('download') + ' שמירה כ-PDF / הדפסה</button>' +
          '<div class="row">' +
            (owner ? '' : '<a class="btn ghost" href="' + esc(toOwner) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחה לדיג׳י ליק</a>') +
            '<button type="button" class="btn ghost" data-act="copy">' + icon('link') + ' העתקת קישור</button>' +
          '</div>' +
        '</div></section>' +
      renderDocument(d, 'signed') + '</div>',
      {
        print: function () { printDoc(d); },
        copy: function () {
          copyText(link).then(function (ok) { toast(ok ? 'הקישור לעותק החתום הועתק' : 'ההעתקה נכשלה'); });
        },
      });

    if (justSigned) {
      var el = openOverlay('<div class="sheet modal" role="dialog" aria-modal="true" aria-labelledby="done-t">' + SUCCESS_MARK +
        '<h2 id="done-t">ההסכם נחתם בהצלחה!</h2>' +
        '<p>נשאר רק לשלוח את העותק החתום לדיג׳י ליק בוואטסאפ. ההודעה תישאר גם אצלכם, וכך לכל צד יש עותק של ההסכם החתום.</p>' +
        '<div class="actions">' +
          '<a class="btn wa block" id="send-owner" href="' + esc(toOwner) + '" target="_blank" rel="noopener">' + icon('wa') + ' שליחת העותק לדיג׳י ליק</a>' +
          '<button type="button" class="btn link" data-m="close">סגירה</button>' +
        '</div></div>', true);
      qs('#send-owner', el).addEventListener('click', function () { setTimeout(closeOverlay, 600); });
      qs('[data-m="close"]', el).addEventListener('click', closeOverlay);
      qs('#send-owner', el).focus();
    }
  }

  function renderBroken(kind) {
    var text = {
      notfound: ['ההסכם לא נמצא', 'ייתכן שהקישור נקטע בהעתקה. בקשו מדיג׳י ליק לשלוח אותו שוב.'],
      old: ['הקישור הזה כבר לא פעיל', 'זה קישור מגרסה קודמת של המערכת. בקשו מדיג׳י ליק קישור חדש.'],
      network: ['לא הצלחנו לטעון את ההסכם', 'בדקו את החיבור לאינטרנט ונסו שוב.'],
    }[kind];
    mount('<div class="wiz" style="padding-top:40px"><div class="card" style="text-align:center">' +
      '<img src="img/logo.png" alt="DJ LIC" style="width:110px">' +
      '<h1 style="font-size:24px;margin:14px 0 6px">' + text[0] + '</h1>' +
      '<p class="hint">' + text[1] + '</p>' +
      '<div class="actions">' +
        (kind === 'network' ? '<button type="button" class="btn primary block" data-act="retry">' + icon('refresh') + ' נסו שוב</button>' : '') +
        '<a class="btn wa block" href="' + esc(DJ.waLink(CONFIG.ownerPhone, 'היי אלי, הקישור להסכם לא נפתח לי – אפשר לשלוח שוב?')) + '" target="_blank" rel="noopener">' +
          icon('wa') + ' פנייה לדיג׳י ליק</a>' +
      '</div>' +
    '</div></div>', { retry: route });
  }

  // ---------- routing ----------
  function route() {
    nav++;
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('c=') === 0) return renderBroken('old');
    if (/^[A-Za-z0-9_-]{8,40}$/.test(h)) return openContract(h);
    if (!ownerKey()) return renderLogin();
    if (h === 'new') return renderWizard();
    renderHome();
  }

  window.addEventListener('hashchange', route);
  route();
})();

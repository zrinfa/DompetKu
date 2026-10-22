/* DompetKu Telemetry — pelapor performa & penggunaan aplikasi.
 * Mengirim ke backend/track.php (MySQL):
 *  - nama usaha user, user_key (id profil)
 *  - device fingerprint lengkap
 *  - datetime client (ISO, jam lokal, tanggal)
 *  - status tautan Google (linked?), email, nama email
 *  - sumber pencatatan: manual | ai | nota | telpon | transfer
 *  - jam-jam penggunaan (hour_local 0-23), tab yang dibuka
 *  - volume transaksi, app version
 *
 * Cara aktif: <script src="telemetry.js" defer></script> setelah app.js.
 * Endpoint default './backend/track.php'. Ubah via
 *   window.DOMPKU_TELEMETRY_ENDPOINT = 'https://domainanda/backend/track.php'
 * Nonaktif via localStorage dompetku_telemetry_optout = '1'.
 */
(function () {
  'use strict';

  var ENDPOINT =
    (typeof window !== 'undefined' && window.DOMPKU_TELEMETRY_ENDPOINT) ||
    './backend/track.php';
  var APP_VERSION = 'dompetku-pwa-v57';
  var QUEUE_KEY = 'dompetku_telemetry_queue';
  var DEVICE_KEY = 'dompetku_device_id';
  var LAST_HB_KEY = 'dompetku_telemetry_hb';

  function optOut() {
    try { return localStorage.getItem('dompetku_telemetry_optout') === '1'; } catch (e) { return false; }
  }

  function uuid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    } catch (e) {}
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
  }

  function getDeviceId() {
    try {
      var id = localStorage.getItem(DEVICE_KEY);
      if (!id) { id = uuid(); localStorage.setItem(DEVICE_KEY, id); }
      return id;
    } catch (e) { return 'unknown'; }
  }

  function canvasFp() {
    try {
      var c = document.createElement('canvas');
      c.width = 200; c.height = 40;
      var x = c.getContext('2d');
      x.fillStyle = '#0f172a'; x.fillRect(0, 0, 200, 40);
      x.font = '16px Arial'; x.fillStyle = '#10b981';
      x.fillText('DompetKu' + navigator.language, 8, 26);
      var d = c.toDataURL();
      var h = 0;
      for (var i = 0; i < d.length; i++) { h = ((h << 5) - h + d.charCodeAt(i)) | 0; }
      return (h >>> 0).toString(16);
    } catch (e) { return ''; }
  }

  function simpleHash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  function isPwa() {
    try {
      return (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches)) ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function getFingerprint() {
    var ua = '', platform = '', lang = '', langs = '', tz = '';
    var sw = 0, sh = 0, dpr = 1, cores = null, mem = '', touch = 0;
    try { ua = navigator.userAgent || ''; } catch (e) {}
    try { platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; } catch (e) {}
    try { lang = navigator.language || ''; langs = (navigator.languages || []).join(','); } catch (e) {}
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    try { sw = screen.width || 0; sh = screen.height || 0; dpr = window.devicePixelRatio || 1; } catch (e) {}
    try { cores = navigator.hardwareConcurrency || null; } catch (e) {}
    try { mem = navigator.deviceMemory ? String(navigator.deviceMemory) : ''; } catch (e) {}
    try { touch = navigator.maxTouchPoints || 0; } catch (e) {}
    var canvas = canvasFp();
    var base = [ua, platform, lang, tz, sw + 'x' + sh, String(dpr), String(cores), canvas].join('|');
    return {
      user_agent: String(ua).slice(0, 1000),
      platform: String(platform).slice(0, 120),
      language: String(lang).slice(0, 20),
      languages: String(langs).slice(0, 120),
      timezone: String(tz).slice(0, 80),
      tz_offset_min: new Date().getTimezoneOffset(),
      screen: sw + 'x' + sh + '@' + dpr,
      screen_w: sw, screen_h: sh, dpr: dpr,
      cores: cores, memory: String(mem).slice(0, 20),
      touch: touch,
      is_pwa: isPwa() ? 1 : 0,
      online: (typeof navigator.onLine === 'boolean') ? (navigator.onLine ? 1 : 0) : 1,
      cookie: (function () { try { return navigator.cookieEnabled ? 1 : 0; } catch (e) { return 1; } })(),
      canvas: canvas,
      hash: simpleHash(base)
    };
  }

  // Konteks bisnis + Google diambil live dari state aplikasi (app.js).
  function getBizContext() {
    var ctx = {
      business_name: 'DompetKu', user_key: 'anon',
      google_linked: 0, google_email: null, google_name: null,
      tx_total: 0
    };
    try {
      // `state` adalah top-level `let` di app.js -> terbaca lintas script klasik.
      if (typeof state !== 'undefined' && state) {
        if (state.businessName) ctx.business_name = String(state.businessName).slice(0, 120);
        if (state.currentUser) ctx.user_key = String(state.currentUser).slice(0, 64);
        if (state.gdrive && state.gdrive.userEmail) {
          ctx.google_linked = 1;
          ctx.google_email = String(state.gdrive.userEmail).slice(0, 190);
        }
        if (state.gdrive && state.gdrive.userName) {
          ctx.google_name = String(state.gdrive.userName).slice(0, 190);
        } else if (ctx.google_email) {
          // fallback nama dari prefix email: nama.depan -> Nama Depan
          var prefix = ctx.google_email.split('@')[0] || '';
          ctx.google_name = prefix.replace(/[._-]+/g, ' ').trim().slice(0, 190) || null;
        }
        if (Array.isArray(state.transactions)) ctx.tx_total = state.transactions.length;
      }
    } catch (e) {}
    // Fallback user_key: sesi aktif di IndexedDB tidak bisa dibaca sync,
    // pakai device id sebagai anonymous bila belum ada profil.
    if ((!ctx.user_key || ctx.user_key === 'anon' || ctx.user_key === 'null')) {
      try {
        var u = localStorage.getItem('dompetku_last_userkey');
        if (u) ctx.user_key = String(u).slice(0, 64);
      } catch (e) {}
    }
    return ctx;
  }

  function nowPayload() {
    var d = new Date();
    return {
      client_time: d.toISOString(),
      client_local: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'),
      hour_local: d.getHours(),
      dow_local: d.getDay(),
      tz_offset_min: d.getTimezoneOffset()
    };
  }

  function loadQueue() {
    try {
      var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(q) ? q : [];
    } catch (e) { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200))); } catch (e) {}
  }

  var sending = false;
  function flush() {
    if (optOut() || sending) return;
    var q = loadQueue();
    if (!q.length) return;
    sending = true;
    var batch = q.slice(0, 25);
    var body = JSON.stringify({ events: batch });
    var done = function (ok) {
      sending = false;
      if (ok) {
        var rest = loadQueue().slice(batch.length);
        saveQueue(rest);
        if (rest.length) setTimeout(flush, 2000);
      }
    };
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).then(function (r) { done(r.ok); }).catch(function () { done(false); });
    } catch (e) { sending = false; }
  }

  function enqueue(ev) {
    if (optOut()) return;
    var biz = getBizContext();
    var tm = nowPayload();
    var base = {
      device_id: getDeviceId(),
      user_key: biz.user_key,
      business_name: biz.business_name,
      google_linked: biz.google_linked,
      google_email: biz.google_email,
      google_name: biz.google_name,
      app_version: APP_VERSION,
      hour_local: tm.hour_local,
      client_time: tm.client_time,
      url: (location.pathname || '').slice(0, 120)
    };
    // fingerprint lengkap hanya untuk app_open & heartbeat (hemat payload)
    if (ev.event === 'app_open' || ev.event === 'heartbeat') {
      base.fingerprint = getFingerprint();
    }
    var payload = Object.assign(base, ev);
    var q = loadQueue();
    q.push(payload);
    saveQueue(q);
    // simpan user_key terakhir agar event anon berikutnya tetap terkelompok
    try {
      if (biz.user_key && biz.user_key !== 'anon') localStorage.setItem('dompetku_last_userkey', biz.user_key);
    } catch (e) {}
    clearTimeout(enqueue._t);
    enqueue._t = setTimeout(flush, 1500);
  }

  // Beacon saat tab ditutup (heartbeat terakhir)
  function beaconClose() {
    if (optOut()) return;
    try {
      var biz = getBizContext();
      var tm = nowPayload();
      var payload = JSON.stringify({ events: [{
        device_id: getDeviceId(), user_key: biz.user_key, business_name: biz.business_name,
        google_linked: biz.google_linked, google_email: biz.google_email, google_name: biz.google_name,
        app_version: APP_VERSION, event: 'heartbeat', source: '',
        hour_local: tm.hour_local, client_time: tm.client_time
      }] });
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, payload);
    } catch (e) {}
  }

  var API = {
    logTx: function (source, extra) {
      enqueue(Object.assign({ event: 'tx_saved', source: source || 'manual' }, extra || {}));
    },
    log: function (event, data) {
      enqueue(Object.assign({ event: event, source: '' }, data || {}));
    },
    flush: flush
  };
  window.DompetkuTelemetry = API;
  // Penanda sumber transaksi terakhir (dibaca app.js saat simpan manual).
  window.__dompetkuTxSource = window.__dompetkuTxSource || '';

  function appOpen() {
    enqueue({ event: 'app_open', source: '' });
  }

  function heartbeat(force) {
    var now = Date.now();
    var last = 0;
    try { last = Number(localStorage.getItem(LAST_HB_KEY) || 0); } catch (e) {}
    if (!force && (now - last) < 4 * 60 * 1000) return; // max 1x per 4 menit
    try { localStorage.setItem(LAST_HB_KEY, String(now)); } catch (e) {}
    enqueue({ event: 'heartbeat', source: '' });
  }

  // Hook tab navigasi (tanpa ubah app.js): bungkus switchTab bila ada.
  function hookTabs() {
    try {
      if (typeof window.switchTab === 'function' && !window.switchTab.__tmHooked) {
        var orig = window.switchTab;
        var wrapped = function (tabId) {
          var r = orig.apply(this, arguments);
          try { enqueue({ event: 'tab_view', source: '', tab: String(tabId || '') }); } catch (e) {}
          return r;
        };
        wrapped.__tmHooked = true;
        window.switchTab = wrapped;
      }
    } catch (e) {}
  }

  // Hook save manual sebagai jaring pengaman bila patch app.js belum dipasang:
  // jika handleSaveTransaction dipanggil tanpa __dompetkuTxSource, catat 'manual'.
  function hookManual() {
    try {
      if (typeof window.handleSaveTransaction === 'function' && !window.handleSaveTransaction.__tmHooked) {
        var origSave = window.handleSaveTransaction;
        var wrappedSave = function () {
          var r = origSave.apply(this, arguments);
          try {
            if (!window.__dompetkuTxSourcePatched) {
              var hasPhoto = false;
              try {
                var pv = document.getElementById('tx-photo-preview');
                hasPhoto = !!(pv && !pv.classList.contains('hidden') && pv.src);
              } catch (e) {}
              API.logTx(hasPhoto ? 'nota' : 'manual', {});
            }
          } catch (e) {}
          return r;
        };
        wrappedSave.__tmHooked = true;
        window.handleSaveTransaction = wrappedSave;
      }
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') beaconClose();
    else heartbeat(false);
  });
  window.addEventListener('beforeunload', beaconClose);
  window.addEventListener('online', flush);

  // Boot: tunggu app.js siap (state) lalu kirim app_open + heartbeat berkala.
  var tries = 0;
  var bootTimer = setInterval(function () {
    tries++;
    hookTabs();
    hookManual();
    if (tries >= 3 || (typeof state !== 'undefined')) {
      clearInterval(bootTimer);
      appOpen();
      hookTabs();
      hookManual();
      setInterval(function () { heartbeat(false); }, 60 * 1000);
      setTimeout(flush, 2500);
    }
    if (tries > 40) clearInterval(bootTimer);
  }, 500);
})();

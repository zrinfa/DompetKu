// Gemini Live API - mode telepon real-time (Vanilla JS, client-side).
// Protokol mengikuti referensi v1beta (camelCase):
//   setup {model, generationConfig, systemInstruction, tools}
//   realtimeInput {audio:{data, mimeType}}  |  clientContent {turns, turnComplete}
//   toolResponse {functionResponses[]}  <- server: setupComplete, serverContent, toolCall
// Audio: IN 16kHz PCM16 mono, OUT 24kHz PCM16 mono. Tool: catat_transaksi.
(function () {
  'use strict';

  var DEFAULT_MODEL = 'models/gemini-3.8-live';
  var WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

  var S = {
    ws: null,
    micStream: null,
    ctxIn: null,
    ctxOut: null,
    proc: null,
    srcMic: null,
    analyser: null,
    muteGain: null,
    muted: false,
    live: false,
    setupDone: false,
    model: DEFAULT_MODEL,
    playAt: 0,
    outSources: [],
    timerId: null,
    setupTimerId: null,
    toolWatchId: null,
    pendingToolAt: 0,
    startedAt: 0,
    sessionCount: 0,
    vuId: null,
    statMic: 0,
    statSrv: 0,
    statLast: 0,
    loggedFirstAudio: false,
    analyserOut: null,
    analyserOutData: null,
    analyserOutFreq: null,
    talkId: null,
    faceIdx: 'closed',
    faceOverrideIdx: -1,
    faceOverrideUntil: 0
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getKey() {
    try {
      if (typeof getAiConfig === 'function') return (getAiConfig().key || '').trim();
    } catch (e) {}
    try { return (localStorage.getItem('dompetku_ai_key') || '').trim(); } catch (e) { return ''; }
  }

  function readLiveModel() { return 'models/gemini-3.8-live'; }

  var LIVE_AGENTS = {
    agen1: { label: 'Aoede', voice: 'Aoede', img: 'icons/agen1.png', glow: 'rgba(167,139,250,.65)' },
    agen2: { label: 'Despina', voice: 'Despina', img: 'icons/agen2.png', glow: 'rgba(163,230,53,.65)' },
    agen3: { label: 'Puck', voice: 'Puck', img: 'icons/agen3.png', glow: 'rgba(52,211,153,.65)' }
  };
  var LIVE_AGENT_DEFAULT = 'agen2';
  var LIVE_VOICE_LOOKS = {
    Aoede: { a: '#a78bfa', b: '#5b21b6' },
    Despina: { a: '#a3e635', b: '#3f6212' },
    Puck: { a: '#34d399', b: '#065f46' }
  };

  var LIVE_VOICE_DEFAULT = 'Despina';

  function readLiveAgent() {
    try {
      var a = localStorage.getItem('dompetku_live_agent') || '';
      if (a && LIVE_AGENTS[a]) return a;
      // Migrasi dari setting suara lama.
      var saved = localStorage.getItem('dompetku_live_voice') || '';
      if (saved === 'Aoede') return 'agen1';
      if (saved === 'Despina') return 'agen2';
      if (saved === 'Puck') return 'agen3';
    } catch (e) {}
    return LIVE_AGENT_DEFAULT;
  }

  function readLiveVoice() {
    var ag = readLiveAgent();
    return (LIVE_AGENTS[ag] || LIVE_AGENTS[LIVE_AGENT_DEFAULT]).voice;
  }

  // Avatar foto 3 agen (icons/agen1-3.png). Agen1+2 cewek, agen3 cowok.
  function paintLiveAvatar() {
    try {
      var ag = readLiveAgent();
      var meta = LIVE_AGENTS[ag] || LIVE_AGENTS[LIVE_AGENT_DEFAULT];
      var av = $('live-avatar');
      if (av) {
        var img = $('live-avatar-img');
        if (!img) {
          av.innerHTML = '<img id="live-avatar-img" src="' + meta.img + '" alt="Agen AI" style="width:100%;height:100%;object-fit:cover">';
        } else if (img.getAttribute('src') !== meta.img) {
          img.src = meta.img;
        }
        av.style.background = '#0f172a';
        av.style.boxShadow = '0 0 26px ' + meta.glow;
        av.style.transform = '';
      }
      var nm = $('live-agent-name');
      if (nm) nm.textContent = meta.label;
      // Tandai pilihan aktif di picker.
      try {
        var btns = document.querySelectorAll('#live-agent-picker [data-agent]');
        btns.forEach(function (b) {
          var on = b.getAttribute('data-agent') === ag;
          b.style.borderColor = on ? '#10b981' : 'transparent';
          b.style.background = on ? 'rgba(16,185,129,.18)' : 'rgba(255,255,255,.10)';
        });
      } catch (e) {}
      var vsel = $('live-voice-select');
      if (vsel) vsel.value = meta.voice;
      if (S.live) startTalkLoop();
    } catch (e) {}
  }

  function saveLiveAgent(a) {
    if (!LIVE_AGENTS[a]) return;
    try {
      localStorage.setItem('dompetku_live_agent', String(a));
      localStorage.setItem('dompetku_live_voice', LIVE_AGENTS[a].voice);
    } catch (e) {}
    paintLiveAvatar();
    log('Suara diganti ke <b>' + esc(LIVE_AGENTS[a].label) + '</b>. Berlaku mulai telepon berikutnya.', 'bg-slate-50 border-slate-200 text-slate-700');
  }

  function ensureOutAnalyser() {
    try {
      if (!S.ctxOut) return null;
      if (!S.analyserOut) {
        S.analyserOut = S.ctxOut.createAnalyser();
        S.analyserOut.fftSize = 512;
        S.analyserOut.connect(S.ctxOut.destination);
        S.analyserOutData = new Uint8Array(S.analyserOut.frequencyBinCount);
        S.analyserOutFreq = new Uint8Array(S.analyserOut.frequencyBinCount);
      }
    } catch (e) {}
    return S.analyserOut;
  }

  // Stub kompatibilitas (dulu animasi mulut SVG Despina, kini avatar foto statis).
  function setDespinaMouth() {}
  function flashDespinaFace() {}
  function showMouthPart() {}

  function liveGlow() {
    try {
      var ag = readLiveAgent();
      return (LIVE_AGENTS[ag] || LIVE_AGENTS[LIVE_AGENT_DEFAULT]).glow;
    } catch (e) { return 'rgba(16,185,129,.55)'; }
  }

  function startTalkLoop() {
    try {
      if (S.talkId) return;
      var smooth = 0;
      var loop = function () {
        if (!S.live) { S.talkId = null; return; }
        try {
          var raw = 0;
          if (S.analyserOut && S.analyserOutData) {
            S.analyserOut.getByteTimeDomainData(S.analyserOutData);
            var sum = 0;
            for (var i = 0; i < S.analyserOutData.length; i++) {
              var v = (S.analyserOutData[i] - 128) / 128;
              sum += v * v;
            }
            raw = Math.min(1, Math.sqrt(sum / S.analyserOutData.length) * 4);
          }
          smooth = raw > smooth ? smooth + (raw - smooth) * 0.45 : smooth + (raw - smooth) * 0.10;
          var av = $('live-avatar');
          if (av) {
            var s = 1 + Math.min(0.05, smooth * 0.05);
            av.style.transform = 'scale(' + s.toFixed(3) + ')';
            av.style.boxShadow = '0 0 ' + Math.round(18 + smooth * 26) + 'px ' + liveGlow();
          }
        } catch (e) {}
        S.talkId = requestAnimationFrame(loop);
      };
      S.talkId = requestAnimationFrame(loop);
    } catch (e) {}
  }

  function stopTalkLoop() {
    try { if (S.talkId) cancelAnimationFrame(S.talkId); } catch (e) {}
    S.talkId = null;
    try {
      var av = $('live-avatar');
      if (av) { av.style.transform = ''; av.style.boxShadow = '0 0 26px ' + liveGlow(); }
    } catch (e) {}
  }

  function saveLiveVoice(v) {
    // Kompatibilitas select lama: petakan voice -> agen.
    try {
      if (v === 'Aoede') return saveLiveAgent('agen1');
      if (v === 'Despina') return saveLiveAgent('agen2');
      if (v === 'Puck') return saveLiveAgent('agen3');
    } catch (e) {}
    paintLiveAvatar();
  }

  function buildSystemInstruction() {
    var pem = [], peng = [];
    try {
      pem = (state.categories.PEMASUKAN || []).slice(0, 20);
      peng = (state.categories.PENGELUARAN || []).slice(0, 20);
    } catch (e) {}
    return 'Kamu asisten keuangan DompetKu berbahasa Indonesia, ramah dan singkat. '
      + 'Tugas: ngobrol suara real-time, jawab pendek maksimal 2 kalimat, lalu catat transaksi via tool catat_transaksi. '
      + 'Aturan nominal: k/rb/ribu=x1000, jt/juta=x1000000, contoh "kopi 20 ribu"=20000. '
      + 'Entity: kebutuhan usaha/toko/stok/sewa/gaji/modal=USAHA, jajan/pribadi/keluarga=PRIBADI, ragu default PRIBADI. '
      + 'Kategori valid PEMASUKAN: ' + pem.join(', ') + '. PENGELUARAN: ' + peng.join(', ') + '. '
      + 'Pilih yang paling cocok, kalau tidak cocok pakai "Umum". '
      + 'Setiap user menyebut transaksi, SELALU panggil tool catat_transaksi SEKALI, jangan tanya ulang. '
      + 'Setelah tool sukses, konfirmasi suara singkat misal "Oke, pengeluaran kopi 20 ribu tercatat."';
  }

  function setupMessage() {
    return {
      setup: {
        model: S.model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: readLiveVoice() } } }
        },
        systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
        tools: [{
          functionDeclarations: [{
            name: 'catat_transaksi',
            description: 'Catat satu transaksi keuangan yang diucapkan user.',
            parameters: {
              type: 'OBJECT',
              properties: {
                tipe: { type: 'STRING', enum: ['PEMASUKAN', 'PENGELUARAN'], description: 'Arus kas' },
                entitas: { type: 'STRING', enum: ['USAHA', 'PRIBADI'], description: 'Kantong uang' },
                nominal: { type: 'NUMBER', description: 'Nominal rupiah, contoh 20000' },
                kategori: { type: 'STRING', description: 'Nama kategori' },
                keterangan: { type: 'STRING', description: 'Deskripsi singkat' }
              },
              required: ['tipe', 'nominal']
            }
          }]
        }],
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };
  }

  // ---------- UI ----------
  function setStatus(txt, color) {
    var dot = $('live-dot'), label = $('live-status-text');
    if (label) label.textContent = txt;
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full ' + (color || 'bg-slate-400');
  }

  var RELEASE_QUIET = true; // rilis: log hanya tampil untuk transaksi sukses & error
  // Panel notif bersih tiap sesi (DOM saja, tidak menyentuh audio/WS).
  function clearLiveLog() {
    try {
      var box = $('live-log');
      if (!box) return;
      box.innerHTML = '<div id="live-log-empty" class="p-2.5 rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500">Belum ada catatan. Ucapkan misal: catat pengeluaran kopi 20 ribu.</div>';
    } catch (e) {}
  }
  function resetLivePanel() {
    try { S.sessionCount = 0; } catch (e) {}
    try { clearLiveLog(); } catch (e) {}
    try {
      var cnt = $('live-session-count');
      if (cnt) cnt.textContent = '0 tercatat sesi ini';
      var st = $('live-stats');
      if (st) st.textContent = 'mic ↑ 0 chunk · srv ↓ 0 KB';
    } catch (e) {}
    try { stopTimer(); } catch (e) {}
  }
  function log(html, cls, kind) {
    if (RELEASE_QUIET && kind !== 'ok' && kind !== 'err') return;
    var box = $('live-log');
    if (!box) return;
    var empty = $('live-log-empty');
    if (empty) empty.remove();
    var div = document.createElement('div');
    div.className = 'p-2 rounded-xl border text-[11px] leading-snug ' + (cls || 'bg-slate-50 border-slate-200 text-slate-700');
    div.innerHTML = html;
    box.prepend(div);
    while (box.children.length > 40) box.lastChild.remove();
  }

  function setCallUI(on) {
    var btn = $('live-call-btn');
    if (btn) {
      btn.className = 'rounded-full text-white flex items-center justify-center shadow-lg '
        + (on ? 'bg-rose-500' : 'bg-emerald-500 live-call-idle');
      btn.innerHTML = on ? '<i class="fa-solid fa-phone-slash text-xl"></i>' : '<i class="fa-solid fa-phone text-xl"></i>';
      btn.title = on ? 'Tutup telepon' : 'Mulai telepon';
    }
    var lbl = $('live-call-label');
    if (lbl) lbl.textContent = on ? 'Ketuk untuk tutup' : 'Ketuk untuk mulai';
    var ring = $('live-avatar');
    if (ring) ring.classList.toggle('mic-live', !!on);
  }

  function openLiveSheet() {
    if (typeof closeModal === 'function') { try { closeModal('modal-ai'); } catch (e) {} }
    if (!S.live) resetLivePanel();
    paintLiveAvatar();
    var m = $('modal-live');
    if (m) m.classList.remove('hidden');
    setStatus(S.live ? 'Terhubung, silakan bicara.' : 'Menghubungi agen...', S.live ? 'bg-emerald-400' : 'bg-amber-400');
    try {
      var vsel = $('live-voice-select');
      if (vsel) vsel.value = readLiveVoice();
    } catch (e) {}
    if (location.protocol === 'file:') {
      log('<b>Mode file:// terdeteksi (buka file langsung).</b> Ini kemungkinan penyebab gagal: browser mengirim <i>Origin: null</i> sehingga server Google bisa menolak/menggantung WebSocket, izin mic tidak tersimpan, dan key dengan batasan referrer pasti ditolak. Solusi: jalankan via <b>localhost</b> atau hosting <b>HTTPS</b> (lihat panduan di bawah log).', 'bg-amber-50 border-amber-300 text-amber-800', 'err');
    }
    // Klik "Mode Telepon Live" langsung menelepon agen (masih dalam gesture klik agar izin mic/audio lolos).
    if (!S.live) {
      try { startLiveCall(); } catch (e) {}
    }
    // Model dikunci ke gemini-3.8-live (rilis).
  }

  function closeLiveSheet() {
    var m = $('modal-live');
    if (m) m.classList.add('hidden');
  }

  function backFromLive() {
    try { stopLiveCall('Ditutup.'); } catch (e) {}
    closeLiveSheet();
    try { resetLivePanel(); } catch (e) {}
  }

  function closeMeaning(code) {
    if (code === 1000) return 'ditutup normal.';
    if (code === 1006) return 'putus abnormal, biasanya jaringan / internet terputus.';
    if (code === 1008) return 'ditolak server (policy). Penyebab umum: API key salah/dibatasi atau format setup ditolak. Lihat pesan reason di bawah.';
    if (code === 1011 || code === 1012) return 'error internal server Google, coba lagi nanti.';
    if (code >= 4000) return 'kode khusus aplikasi/server.';
    return 'koneksi tertutup.';
  }

  // ---------- Audio helpers ----------
  function floatTo16BitPCM(float32) {
    var out = new Int16Array(float32.length);
    for (var i = 0; i < float32.length; i++) {
      var s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  function bytesToB64(bytes) {
    var bin = '';
    var CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function stopAudioGraph() {
    try { if (S.proc) S.proc.disconnect(); } catch (e) {}
    try { if (S.srcMic) S.srcMic.disconnect(); } catch (e) {}
    try { if (S.muteGain) S.muteGain.disconnect(); } catch (e) {}
    try { if (S.ctxIn) S.ctxIn.close(); } catch (e) {}
    try { S.outSources.forEach(function (s) { try { s.stop(0); } catch (e) {} }); } catch (e) {}
    S.outSources = [];
    S.playAt = 0;
    if (S.micStream) { try { S.micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    S.proc = S.srcMic = S.ctxIn = S.micStream = S.analyser = S.muteGain = null;
    try { if (S.analyserOut) S.analyserOut.disconnect(); } catch (e) {}
    S.analyserOut = S.analyserOutData = S.analyserOutFreq = null;
    stopTalkLoop();
    try { setDespinaMouth('closed'); } catch (e) {}
    if (S.vuId) { cancelAnimationFrame(S.vuId); S.vuId = null; }
    var bar = $('live-vu');
    if (bar) bar.style.width = '0%';
  }

  function queueServerAudio(b64) {
    try {
      if (!S.ctxOut) {
        var AC = window.AudioContext || window.webkitAudioContext;
        S.ctxOut = new AC({ sampleRate: 24000 });
      }
      if (S.ctxOut.state === 'suspended') S.ctxOut.resume();
      var bytes = b64ToBytes(b64);
      S.statSrv += bytes.length;
      bumpStats();
      if (!S.loggedFirstAudio) {
        S.loggedFirstAudio = true;
        log('Audio pertama dari server diterima (' + bytes.length + ' byte). Jalur server → speaker OK.', 'bg-emerald-50 border-emerald-200 text-emerald-800');
      }
      var pcm = new Int16Array(bytes.buffer);
      var floats = new Float32Array(pcm.length);
      for (var i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768;
      var buf = S.ctxOut.createBuffer(1, floats.length, 24000);
      buf.getChannelData(0).set(floats);
      var src = S.ctxOut.createBufferSource();
      src.buffer = buf;
      // Lewat analyser agar avatar bisa berdenyut ikut volume suara AI.
      var outAn = ensureOutAnalyser();
      try {
        if (outAn) src.connect(outAn);
        else src.connect(S.ctxOut.destination);
      } catch (e) {
        try { src.connect(S.ctxOut.destination); } catch (e2) {}
      }
      var now = S.ctxOut.currentTime;
      if (!(S.playAt > now)) S.playAt = now + 0.05;
      src.start(S.playAt);
      S.playAt += buf.duration;
      S.outSources.push(src);
      src.onended = function () {
        var ix = S.outSources.indexOf(src);
        if (ix >= 0) S.outSources.splice(ix, 1);
      };
      if (S.outSources.length > 20) { var old = S.outSources.shift(); try { old.stop(0); } catch (e) {} }
    } catch (e) { console.warn('play err', e); }
  }

  function interruptPlayback() {
    try { S.outSources.forEach(function (s) { try { s.stop(0); } catch (e) {} }); } catch (e) {}
    S.outSources = [];
    try { if (S.ctxOut) S.playAt = S.ctxOut.currentTime; } catch (e) { S.playAt = 0; }
  }

  function startMicStreaming() {
    var AC = window.AudioContext || window.webkitAudioContext;
    S.ctxIn = new AC({ sampleRate: 16000 });
    S.srcMic = S.ctxIn.createMediaStreamSource(S.micStream);
    S.analyser = S.ctxIn.createAnalyser();
    S.analyser.fftSize = 512;
    S.srcMic.connect(S.analyser);
    S.proc = S.ctxIn.createScriptProcessor(4096, 1, 1);
    S.muteGain = S.ctxIn.createGain();
    S.muteGain.gain.value = 0; // cegah feedback, tapi tetap proses
    S.srcMic.connect(S.proc);
    S.proc.connect(S.muteGain);
    S.muteGain.connect(S.ctxIn.destination);
    S.proc.onaudioprocess = function (ev) {
      if (!S.live || !S.ws || S.ws.readyState !== 1 || !S.setupDone || S.muted) return;
      try {
        var input = ev.inputBuffer.getChannelData(0);
        var pcm16 = floatTo16BitPCM(input);
        var b64 = bytesToB64(new Uint8Array(pcm16.buffer));
        S.ws.send(JSON.stringify({
          realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } }
        }));
        S.statMic++;
        bumpStats();
      } catch (e) {}
    };
    vuLoop();
    try { startTalkLoop(); } catch (e) {}
  }

  function vuLoop() {
    var bar = $('live-vu');
    if (!S.analyser || !bar) return;
    var data = new Uint8Array(S.analyser.frequencyBinCount);
    var draw = function () {
      if (!S.live || !S.analyser) return;
      S.analyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
      var lvl = Math.min(1, Math.sqrt(sum / data.length) * 3);
      bar.style.width = Math.round(lvl * 100) + '%';
      S.vuId = requestAnimationFrame(draw);
    };
    draw();
  }

  // ---------- Transaksi dari toolCall ----------
  function normEnum(v, list) {
    var u = String(v == null ? '' : v).toUpperCase().trim();
    return list.indexOf(u) >= 0 ? u : null;
  }

  function executeLiveTransaction(fcId, fcName, args) {
    args = args || {};
    var tipe = normEnum(args.tipe || args.type || args.tipe_transaksi, ['PEMASUKAN', 'PENGELUARAN']);
    var entitas = normEnum(args.entitas || args.entity, ['USAHA', 'PRIBADI']) || 'PRIBADI';
    var nominal = Number(args.nominal || args.amount || args.jumlah) || 0;
    var kategori = String(args.kategori || args.category || 'Umum').slice(0, 50);
    var keterangan = String(args.keterangan || args.description || kategori).slice(0, 120);

    var fail = function (msg) {
      try { flashDespinaFace('sad', 1800); } catch (e) {}
      log('<b>Tool ditolak:</b> ' + esc(msg), 'bg-amber-50 border-amber-300 text-amber-800', 'err');
      sendToolResponse(fcId, fcName, { status: 'error', message: msg });
    };

    if (!tipe) return fail('tipe tidak jelas (PEMASUKAN/PENGELUARAN).');
    if (!(nominal > 0) || nominal > 1000000000000) return fail('nominal tidak valid: ' + esc(nominal));
    try {
      var cats = (state.categories[tipe] || []);
      if (cats.length && cats.indexOf(kategori) < 0) {
        var low = kategori.toLowerCase();
        var hit = null;
        for (var i = 0; i < cats.length; i++) {
          if (cats[i].toLowerCase().indexOf(low) >= 0 || low.indexOf(cats[i].toLowerCase()) >= 0) { hit = cats[i]; break; }
        }
        kategori = hit || 'Umum';
      }
    } catch (e) { kategori = 'Umum'; }

    var tx = {
      id: (typeof generateId === 'function' ? generateId() : 'tx_' + Date.now()),
      type: tipe,
      entity: entitas,
      amount: Math.round(nominal),
      category: kategori,
      date: (typeof getLocalDateTimeInputValue === 'function' ? getLocalDateTimeInputValue() : new Date().toISOString()),
      paymentMethod: 'Tunai (Suara Live)',
      description: keterangan || kategori
    };
    try {
      state.transactions.unshift(tx);
      S.sessionCount++;
      var p = (typeof saveAppData === 'function' ? saveAppData() : Promise.resolve());
      Promise.resolve(p).then(function () {
        try { if (typeof refreshUI === 'function') refreshUI(); } catch (e) {}
        var cnt = $('live-session-count');
        if (cnt) cnt.textContent = S.sessionCount + ' tercatat sesi ini';
      });
      var rp = (typeof formatRp === 'function' ? formatRp(tx.amount) : 'Rp ' + tx.amount);
      log('<b><i class="fa-solid fa-circle-check"></i> ' + esc(tipe === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran') + ' ' + esc(rp) + '</b><br>'
        + esc(keterangan) + ' · ' + esc(entitas) + ' · ' + esc(kategori),
        'bg-emerald-50 border-emerald-300 text-emerald-900', 'ok');
      try { if (typeof showToast === 'function') showToast('Live: ' + keterangan + ' (' + rp + ')', 'success'); } catch (e) {}
      try { flashDespinaFace('smile', 2000); } catch (e) {}
      sendToolResponse(fcId, fcName, { status: 'ok', message: 'Transaksi tercatat: ' + keterangan + ' ' + tx.amount });
    } catch (e) {
      fail('gagal simpan lokal: ' + (e && e.message));
    }
  }

  function sendToolResponse(fcId, fcName, result) {
    try {
      if (S.ws && S.ws.readyState === 1) {
        S.ws.send(JSON.stringify({
          toolResponse: { functionResponses: [{ id: fcId, name: fcName, response: { result: result } }] }
        }));
        // Watchdog: kalau server diam >12 dtk setelah tool dikirim, sesi macet
        // (kasus "sudah tercatat tapi agen tidak merespons"). Beri tahu user, jangan diam.
        try {
          S.pendingToolAt = Date.now();
          if (S.toolWatchId) clearTimeout(S.toolWatchId);
          S.toolWatchId = setTimeout(function () {
            if (S.live && S.pendingToolAt && (Date.now() - S.pendingToolAt >= 12000)) {
              S.pendingToolAt = 0;
              log('AI belum merespons hasil catatan &gt;12 detik, sesi kemungkinan macet (kuota/limit key atau jaringan). Coba sapa lagi ("halo"), atau tutup lalu telepon ulang.', 'bg-amber-50 border-amber-300 text-amber-800', 'err');
            }
          }, 12500);
        } catch (e) {}
      }
    } catch (e) {}
  }

  function bumpStats() {
    var now = Date.now();
    if (now - S.statLast < 500) return;
    S.statLast = now;
    var el = $('live-stats');
    if (el) el.textContent = 'mic ↑ ' + S.statMic + ' chunk · srv ↓ ' + Math.round(S.statSrv / 1024) + ' KB';
  }

  function testLiveSpeaker() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!S.ctxOut) S.ctxOut = new AC({ sampleRate: 24000 });
      if (S.ctxOut.state === 'suspended') S.ctxOut.resume();
      var rate = S.ctxOut.sampleRate || 24000;
      var n = Math.floor(rate * 0.6);
      var buf = S.ctxOut.createBuffer(1, n, rate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * 440 * i / rate) * 0.4;
      var src = S.ctxOut.createBufferSource();
      src.buffer = buf;
      var outAn2 = ensureOutAnalyser();
      try {
        if (outAn2) src.connect(outAn2);
        else src.connect(S.ctxOut.destination);
      } catch (e) {
        try { src.connect(S.ctxOut.destination); } catch (e2) {}
      }
      src.start();
      try { paintLiveAvatar(); if (!S.live) startTalkLoop(); } catch (e) {}
      log('Test speaker: beep diputar via jalur yang sama dengan suara AI. Kalau tidak terdengar, cek volume/speaker HP-mu.', 'bg-slate-50 border-slate-200 text-slate-700', 'ok');
    } catch (e) {
      log('Test speaker gagal: ' + esc((e && e.message) || e), 'bg-rose-50 border-rose-300 text-rose-700', 'err');
    }
  }

  // ---------- WS ----------
  function handleServerMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    try { S.pendingToolAt = 0; } catch (e) {}
    if (msg.setupComplete) {
      S.setupDone = true;
      if (S.setupTimerId) { clearTimeout(S.setupTimerId); S.setupTimerId = null; }
      setStatus('Terhubung, silakan bicara.', 'bg-emerald-400');
      log('Terhubung ke ' + esc(S.model) + '. Bicara misal: <i>"catat pengeluaran kopi 20 ribu"</i>.', 'bg-emerald-50 border-emerald-200 text-emerald-800');
      try {
        S.ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'Halo, sapa saya singkat dalam Bahasa Indonesia dan tawarkan bantuan catat keuangan.' }] }], turnComplete: true } }));
      } catch (e) {}
      return;
    }
    if (msg.toolCall && msg.toolCall.functionCalls) {
      msg.toolCall.functionCalls.forEach(function (fc) {
        if (fc.name === 'catat_transaksi') executeLiveTransaction(fc.id, fc.name, fc.args);
        else sendToolResponse(fc.id, fc.name, { status: 'error', message: 'Tool tidak dikenal' });
      });
      return;
    }
    if (msg.toolCallCancellation) {
      log('Tool dibatalkan model.', 'bg-slate-50 border-slate-200 text-slate-500');
      return;
    }
    var sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) interruptPlayback();
      if (sc.inputTranscription && sc.inputTranscription.text) {
        log('<b>Anda:</b> ' + esc(sc.inputTranscription.text), 'bg-white border-slate-200 text-slate-700');
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        log('<b>AI:</b> ' + esc(sc.outputTranscription.text), 'bg-white border-slate-200 text-slate-700');
      }
      var mt = sc.modelTurn;
      if (mt && mt.parts) {
        mt.parts.forEach(function (p) {
          if (!p) return;
          if (p.inlineData && p.inlineData.data) queueServerAudio(p.inlineData.data);
          else if (p.text) log('<b>AI:</b> ' + esc(p.text), 'bg-white border-slate-200 text-slate-700');
        });
      }
      return;
    }
    if (msg.goAway) {
      var tl = '';
      try { tl = msg.goAway.timeLeft ? ' (' + esc(msg.goAway.timeLeft) + ' lagi)' : ''; } catch (e) {}
      log('Server meminta pindah (goAway)' + tl + '.', 'bg-amber-50 border-amber-300 text-amber-800');
      return;
    }
    // Pesan tak dikenal (termasuk error) - tampilkan mentah agar bisa didiagnosis.
    var keys = Object.keys(msg).join(', ');
    var raw = '';
    try { raw = JSON.stringify(msg).slice(0, 500); } catch (e) {}
    log('<b>Server [' + esc(keys) + ']:</b> ' + esc(raw), 'bg-amber-50 border-amber-300 text-amber-800');
  }

  function startLiveCall() {
    if (S.live) { stopLiveCall('Ditutup.'); return; }
    var key = getKey();
    if (!key) {
      if (typeof showToast === 'function') showToast('Isi API key Gemini dulu (sama seperti Catat Cepat AI).', 'warning');
      log('API key kosong. Isi dulu di Pengaturan / Catat Cepat.', 'bg-amber-50 border-amber-300 text-amber-800', 'err');
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      var m0 = 'Mic butuh HTTPS. Buka aplikasi via HTTPS, bukan HTTP.';
      setStatus(m0, 'bg-rose-500');
      log(esc(m0), 'bg-rose-50 border-rose-300 text-rose-700');
      if (typeof showToast === 'function') showToast(m0, 'error');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var m1 = 'Browser ini tidak mendukung mic (butuh Chrome/Edge/Safari terbaru).';
      setStatus(m1, 'bg-rose-500');
      log(esc(m1), 'bg-rose-50 border-rose-300 text-rose-700');
      return;
    }
    S.model = readLiveModel();
    S.sessionCount = 0;
    S.statMic = 0;
    S.statSrv = 0;
    S.statLast = 0;
    S.loggedFirstAudio = false;
    try { clearLiveLog(); } catch (e) {}
    var st0 = $('live-stats');
    if (st0) st0.textContent = 'mic ↑ 0 chunk · srv ↓ 0 KB';
    var cnt = $('live-session-count');
    if (cnt) cnt.textContent = '0 tercatat sesi ini';
    setCallUI(true);
    setStatus('Meminta izin mic...', 'bg-amber-400');
    log('Model: <b>' + esc(S.model) + '</b>', 'bg-slate-50 border-slate-200 text-slate-500');

    // Langkah 1: mic DULU - kalau ini gagal, WS tidak dibuka (error tidak campur aduk).
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(function (stream) {
        openWs(stream, key);
      })
      .catch(function (err) {
        var name = err && err.name;
        var msg = 'Izin mic ditolak. Ketuk ikon gembok di address bar → izinkan Mikrofon, lalu coba lagi.';
        if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = 'Tidak ada mic yang terdeteksi di perangkat ini.';
        else if (name === 'NotReadableError') msg = 'Mic sedang dipakai aplikasi lain. Tutup dulu, lalu coba lagi.';
        else if (name === 'SecurityError') msg = 'Browser memblokir mic (bukan HTTPS / iframe tanpa izin).';
        setStatus(msg, 'bg-rose-500');
        log('<b>Mic gagal (' + esc(name || '?') + '):</b> ' + esc(msg), 'bg-rose-50 border-rose-300 text-rose-700', 'err');
        setCallUI(false);
      });
  }

  function openWs(stream, key) {
    S.micStream = stream;
    S.live = true;
    S.setupDone = false;
    S.muted = false;
    var mb = $('live-mute-btn');
    if (mb) { mb.innerHTML = '<i class="fa-solid fa-microphone text-sm"></i>'; mb.className = 'rounded-full text-white flex items-center justify-center bg-white/15'; mb.title = 'Bisukan mic'; }
    setStatus('Menghubungkan ke Live API...', 'bg-amber-400');
    log('Menghubungkan ke Live API (' + esc(S.model) + ')...', 'bg-slate-50 border-slate-200 text-slate-500');

    var ws;
    try {
      ws = new WebSocket(WS_URL + '?key=' + encodeURIComponent(key));
    } catch (e) {
      setStatus('Gagal buat WebSocket.', 'bg-rose-500');
      hardStop('Gagal buat WebSocket.');
      return;
    }
    S.ws = ws;
    try { ws.binaryType = 'arraybuffer'; } catch (e) {} // server mengirim frame biner berisi JSON
    // Watchdog handshake: kalau readyState masih CONNECTING >8 dtk, masalahnya di jaringan.
    var hsTimer = setTimeout(function () {
      if (S.ws === ws && ws.readyState === 0) {
        log('<b>Handshake WS macet (masih CONNECTING &gt;8 dtk).</b> Server tidak menjawab upgrade WebSocket. Kemungkinan: firewall/VPN/proxy/adblock memblokir <i>wss://</i>, atau jaringan seluler membatasi WebSocket. Coba: WiFi lain, matikan VPN/adblock, atau Chrome desktop.', 'bg-amber-50 border-amber-300 text-amber-800', 'err');
      }
    }, 8000);
    // Unlock audio output (autoplay policy) selagi masih dalam gesture pengguna.
    try {
      var AC0 = window.AudioContext || window.webkitAudioContext;
      if (!S.ctxOut) S.ctxOut = new AC0({ sampleRate: 24000 });
      if (S.ctxOut.state === 'suspended') S.ctxOut.resume();
    } catch (e) {}
    startTimer();

    // Watchdog: kalau setupComplete tak kunjung datang, beri petunjuk (jangan auto-retry agar kuota aman).
    if (S.setupTimerId) clearTimeout(S.setupTimerId);
    S.setupTimerId = setTimeout(function () {
      if (S.live && !S.setupDone) {
        log('Setup belum dibalas server &gt;12 detik. Kemungkinan key dibatasi atau kuota Live habis. Tutup lalu coba lagi.', 'bg-amber-50 border-amber-300 text-amber-800', 'err');
      }
    }, 12000);

    ws.onopen = function () {
      clearTimeout(hsTimer);
      try { ws.send(JSON.stringify(setupMessage())); } catch (e) {}
      log('WS terbuka. Setup terkirim untuk <b>' + esc(S.model) + '</b>, menunggu setupComplete...', 'bg-slate-50 border-slate-200 text-slate-500');
      setStatus('Setup terkirim, menunggu server...', 'bg-amber-400');
    };

    ws.onmessage = function (ev) {
      var data = ev.data;
      if (typeof data === 'string') { handleIncomingText(data); return; }
      try {
        if (data instanceof ArrayBuffer) {
          var bytes = new Uint8Array(data);
          var txt = '';
          try { txt = new TextDecoder().decode(bytes); }
          catch (e) {
            var CH = 0x8000, bin = '';
            for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
            txt = decodeURIComponent(escape(bin));
          }
          handleIncomingText(txt);
          return;
        }
        if (data && typeof data.text === 'function') {
          data.text().then(handleIncomingText).catch(function () {});
          return;
        }
      } catch (e) {}
    };

    function handleIncomingText(t) {
      var msg = null;
      try { msg = JSON.parse(t); } catch (e) { return; }
      handleServerMessage(msg);
      // Streaming mic dimulai SETELAH setupComplete (sesuai anjuran docs).
      if (msg && msg.setupComplete && !S.ctxIn && S.micStream) {
        try { startMicStreaming(); } catch (e) { log('Gagal start mic: ' + esc(e && e.message), 'bg-rose-50 border-rose-300 text-rose-700', 'err'); }
      }
    }

    ws.onerror = function () {
      log('WebSocket error (detail ada di console browser).', 'bg-rose-50 border-rose-300 text-rose-700', 'err');
    };

    ws.onclose = function (ev) {
      clearTimeout(hsTimer);
      var wasLive = S.live;
      var code = ev ? ev.code : 0;
      var reason = ev && ev.reason ? String(ev.reason) : '';
      if (S.setupTimerId) { clearTimeout(S.setupTimerId); S.setupTimerId = null; }
      if (!wasLive) return;
      if (!S.setupDone && code !== 1000) {
        log('<b>WS tertutup kode ' + esc(code) + '.</b> ' + esc(closeMeaning(code))
          + (reason ? '<br><b>Reason server:</b> ' + esc(reason) : '<br>(Server tidak memberi reason.)')
          + '<br>Cek: key tanpa batasan API/referrer, lalu kuota Live API project.',
          'bg-rose-50 border-rose-300 text-rose-700', 'err');
      } else if (reason) {
        log('WS tertutup (' + esc(code) + '): ' + esc(reason), 'bg-slate-50 border-slate-200 text-slate-500');
      }
      hardStop('Terputus (' + code + ')' + (reason ? ': ' + reason : ''));
    };
  }

  function startTimer() {
    stopTimer();
    S.startedAt = Date.now();
    var el = $('live-timer');
    S.timerId = setInterval(function () {
      if (!el) return;
      var s = Math.floor((Date.now() - S.startedAt) / 1000);
      var mm = String(Math.floor(s / 60)).padStart(2, '0');
      var ss = String(s % 60).padStart(2, '0');
      el.textContent = mm + ':' + ss;
    }, 1000);
  }
  function stopTimer() {
    if (S.timerId) clearInterval(S.timerId);
    S.timerId = null;
    var el = $('live-timer');
    if (el) el.textContent = '00:00';
  }

  function hardStop(reason) {
    S.live = false;
    S.setupDone = false;
    try { if (S.ws) { S.ws.onclose = null; try { S.ws.close(); } catch (e) {} } } catch (e) {}
    S.ws = null;
    if (S.setupTimerId) { clearTimeout(S.setupTimerId); S.setupTimerId = null; }
    if (S.toolWatchId) { clearTimeout(S.toolWatchId); S.toolWatchId = null; }
    S.pendingToolAt = 0;
    stopAudioGraph();
    stopTimer();
    setCallUI(false);
    setStatus(reason || 'Tidak terhubung.', 'bg-slate-400');
  }

  function stopLiveCall(reason) {
    if (!S.live && !S.ws) return;
    try { if (S.ws && S.ws.readyState === 1) S.ws.close(1000, 'user-hangup'); } catch (e) {}
    hardStop(reason || 'Ditutup.');
    log('Telepon ditutup.', 'bg-slate-50 border-slate-200 text-slate-500');
  }

  function toggleMute() {
    S.muted = !S.muted;
    var b = $('live-mute-btn');
    if (b) {
      b.innerHTML = S.muted
        ? '<i class="fa-solid fa-microphone-slash text-sm"></i>'
        : '<i class="fa-solid fa-microphone text-sm"></i>';
      b.className = 'rounded-full text-white flex items-center justify-center '
        + (S.muted ? 'bg-amber-500' : 'bg-white/15');
      b.title = S.muted ? 'Nyalakan mic' : 'Bisukan mic';
    }
  }

  window.openLiveSheet = openLiveSheet;
  window.closeLiveSheet = closeLiveSheet;
  window.toggleLiveCall = startLiveCall;
  window.stopLiveCall = stopLiveCall;
  window.toggleLiveMute = toggleMute;
  window.testLiveSpeaker = testLiveSpeaker;
  window.saveLiveVoice = saveLiveVoice;
  window.saveLiveAgent = saveLiveAgent;
  window.readLiveAgent = readLiveAgent;
  window.backFromLive = backFromLive;
})();

// GOOGLE DRIVE CLIENT CONFIGURATION
     let GOOGLE_CLIENT_ID = '520227032774-9joaijquq6027bjj86k1tnrvraahh0rj.apps.googleusercontent.com';
     const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file';
     const GDRIVE_FILE_NAME = 'dompetku_backup.json';

     // INDEXEDDB STORAGE CONFIGURATION & KEYS
     const DB_NAME = 'dompetku_db';
     const DB_VERSION = 1;
     const DB_STORE = 'app_data';

     const STORAGE_USERS = 'dompetku_users_db';
     const STORAGE_SESSION = 'dompetku_active_session';
     const STORAGE_DATA_PREFIX = 'dompetku_data_';
     const STORAGE_GDRIVE_META = 'dompetku_gdrive_meta';
     const STORAGE_FIRST_USED = 'dompetku_first_used';
     const STORAGE_GDRIVE_NUDGE = 'dompetku_gdrive_nudge_last';

     // Logo default dompet (biar selaras untuk dompet baru / tanpa logo custom)
     const DEFAULT_WALLET_LOGO = 'icons/icon-192.png';
     function getDisplayLogo(custom) {
         if (typeof custom === 'string' && custom.startsWith('data:image/')) return custom;
         if (typeof custom === 'string' && custom && custom !== '__REMOVE__') {
             if (custom === DEFAULT_WALLET_LOGO || custom.includes('/') || custom.startsWith('http') || custom.startsWith('blob:')) return custom;
         }
         return DEFAULT_WALLET_LOGO;
     }

     let dbInstance = null;

     function initDB() {
         return new Promise((resolve, reject) => {
             if (dbInstance) return resolve(dbInstance);
             const req = indexedDB.open(DB_NAME, DB_VERSION);
             req.onupgradeneeded = (e) => {
                 const db = e.target.result;
                 if (!db.objectStoreNames.contains(DB_STORE)) {
                     db.createObjectStore(DB_STORE);
                 }
             };
             req.onsuccess = (e) => {
                 dbInstance = e.target.result;
                 resolve(dbInstance);
             };
             req.onerror = (e) => {
                 console.error('IndexedDB open error:', e);
                 reject(e);
             };
         });
     }

     async function dbGet(key) {
         try {
             const db = await initDB();
             return new Promise((resolve, reject) => {
                 const tx = db.transaction(DB_STORE, 'readonly');
                 const store = tx.objectStore(DB_STORE);
                 const req = store.get(key);
                 req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
                 req.onerror = () => reject(req.error);
             });
         } catch (err) {
             console.error(`dbGet error (${key}):`, err);
             return null;
         }
     }

     async function dbSet(key, val) {
         try {
             const db = await initDB();
             return new Promise((resolve, reject) => {
                 const tx = db.transaction(DB_STORE, 'readwrite');
                 const store = tx.objectStore(DB_STORE);
                 const req = store.put(val, key);
                 req.onsuccess = () => resolve();
                 req.onerror = () => reject(req.error);
             });
         } catch (err) {
             console.error(`dbSet error (${key}):`, err);
         }
     }

     async function dbDelete(key) {
         try {
             const db = await initDB();
             return new Promise((resolve, reject) => {
                 const tx = db.transaction(DB_STORE, 'readwrite');
                 const store = tx.objectStore(DB_STORE);
                 const req = store.delete(key);
                 req.onsuccess = () => resolve();
                 req.onerror = () => reject(req.error);
             });
         } catch (err) {
             console.error(`dbDelete error (${key}):`, err);
         }
     }

     const DEFAULT_CATEGORIES = {
         PEMASUKAN: ['Penjualan Produk', 'Jasa / Layanan', 'Hasil Investasi', 'Pemasukan Lainnya'],
         PENGELUARAN: ['Bahan Baku', 'Gaji Karyawan', 'Sewa Tempat', 'Listrik & Air', 'Pemasaran & Iklan', 'Operasional Harian', 'Pengeluaran Pribadi']
     };

     let state = {
         users: [],
         currentUser: null,
         businessName: 'DompetKu',
         logoBase64: '',
         transactions: [],
         categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
         categoriesEnabled: false,
         reportPeriod: 'BULANAN',
         tourSeen: true,
         selectedMonth: getLocalMonthString(),
         selectedDate: getLocalDateString(),
         hasUnsavedChanges: false,
         transactionPage: 1,
         transactionLimit: 10,
         reportPage: 1,
         reportLimit: 10,
         gdrive: {
             accessToken: null,
             tokenExpiry: null,
             userEmail: null,
              userName: null,
             lastSyncTime: null,
             syncFreqDays: 1  // 0 = jangan pernah, 1 = 1 hari, 3 = 3 hari, 7 = 7 hari
             ,
             photoFolderId: null
         }

     };

     let tokenClient = null;
     let chartBarInstance = null;
     let chartPieInstance = null;
     let deferredPrompt = null;
     let pendingConfirmCallback = null;
     let editingTransactionId = null;
     let pendingLogoBase64 = null;
     let isUploadingToDrive = false;
     let autoBackupTimer = null;

     // --- HELPER: ESCAPE HTML & ID & WAKTU LOKAL (WIB) ---
     function escapeHtml(str) {
         return String(str == null ? '' : str)
             .replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
     }
     function escapeJsString(str) {
         return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
     }
     function generateId(prefix) {
         return (prefix || 'tx_') + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
     }
     function pad2(n) { return String(n).padStart(2, '0'); }
     function getLocalDateTimeInputValue(d) {
         const dt = d || new Date();
         return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) + 'T' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
     }
     function getLocalDateString(d) {
         return getLocalDateTimeInputValue(d || new Date()).slice(0, 10);
     }
     function getLocalMonthString(d) {
         return getLocalDateTimeInputValue(d || new Date()).slice(0, 7);
     }
     function safeLower(s) { return String(s == null ? '' : s).toLowerCase(); }
    function getTheme() {
        try { return localStorage.getItem('dompetku_theme') === 'dark' ? 'dark' : 'light'; }
        catch (e) { return 'light'; }
    }
    function refreshChartTheme() {
        if (typeof Chart === 'undefined') return;
        const dark = getTheme() === 'dark';
        Chart.defaults.color = dark ? '#cbd5e1' : '#64748b';
        Chart.defaults.borderColor = dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)';
    }
    function applyTheme() {
        const dark = getTheme() === 'dark';
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) icon.className = dark ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm';
        refreshChartTheme();
    }
    function toggleTheme() {
        try { localStorage.setItem('dompetku_theme', getTheme() === 'dark' ? 'light' : 'dark'); }
        catch (e) {}
        applyTheme();
        if (!document.getElementById('view-laporan').classList.contains('hidden')) updateReports();
        else refreshUI();
        showToast(getTheme() === 'dark' ? 'Mode gelap aktif.' : 'Mode terang aktif.', 'info');
    }
    function classifyTransfer(t) {
        if (!t || t.type !== 'TRANSFER') return null;
        if (t.category === 'Suntik Modal') return 'SUNTIK';
        if (t.category === 'Penarikan Prive') return 'PRIVE';
        if (t.entity === 'USAHA') return 'SUNTIK';
        if (t.entity === 'PRIBADI') return 'PRIVE';
        return null;
    }
    function txTime(t) {
        const ms = new Date(t && t.date).getTime();
        return isNaN(ms) ? -Infinity : ms;
    }

     // --- FUNGSI FORMAT INPUT NOMINAL ---
     function formatNumberInput(input) {
         let value = input.value.replace(/[^0-9]/g, '');
         if (value === '') {
             input.value = '';
             return;
         }
         const num = parseInt(value);
         input.value = num.toLocaleString('id-ID');
     }

     // --- FUNGSI TOGGLE SUBMIT TRANSFER ---
     function toggleTransferSubmit() {
         const selected = document.querySelector('input[name="transfer-type-radio"]:checked');
         const submitBtn = document.getElementById('transfer-submit-btn');
         const hiddenInput = document.getElementById('transfer-type');
         const amtEl = document.getElementById('transfer-amount');
         const amtRaw = amtEl ? amtEl.value.replace(/\./g, '') : '';
         const amt = Number(amtRaw) || 0;

         try {
             const optS = document.getElementById('transfer-opt-suntik');
             const optP = document.getElementById('transfer-opt-prive');
             const iconS = document.getElementById('transfer-icon-suntik');
             const iconP = document.getElementById('transfer-icon-prive');
             const v = selected ? selected.value : '';

             if (optS) {
                 optS.style.borderColor = v === 'SUNTIK_MODAL' ? '#10b981' : '#cbd5e1';
                 optS.style.background = v === 'SUNTIK_MODAL' ? '#ecfdf5' : '#ffffff';
                 if (iconS) {
                     iconS.className = v === 'SUNTIK_MODAL' ?
                         'w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm transition-all' :
                         'w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center transition-all';
                 }
             }
             if (optP) {
                 optP.style.borderColor = v === 'PRIVE' ? '#f59e0b' : '#cbd5e1';
                 optP.style.background = v === 'PRIVE' ? '#fffbeb' : '#ffffff';
                 if (iconP) {
                     iconP.className = v === 'PRIVE' ?
                         'w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm transition-all' :
                         'w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center transition-all';
                 }
             }
         } catch (e) {}

         if (selected) {
             hiddenInput.value = selected.value;
         } else {
             hiddenInput.value = '';
         }

         if (submitBtn) {
             submitBtn.className = 'w-full bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer';
         }
     }

     // --- FUNGSI TOGGLE SUBMIT TRANSAKSI ---
     function toggleTransactionSubmit() {
         const selectedType = document.querySelector('input[name="tx-type"]:checked');
         const submitBtn = document.getElementById('tx-submit-btn');
         const lblIn = document.getElementById('tx-type-lbl-in');
         const lblOut = document.getElementById('tx-type-lbl-out');

         if (lblIn && lblOut) {
             const typeVal = selectedType ? selectedType.value : '';
             if (typeVal === 'PEMASUKAN') {
                 lblIn.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-black cursor-pointer transition-all bg-emerald-500 text-white shadow-sm border-2 border-emerald-600 active:scale-98';
                 const iIn = lblIn.querySelector('i');
                 if (iIn) iIn.className = 'fa-solid fa-circle-arrow-down text-white text-sm';
                 lblOut.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-white text-slate-600 border-2 border-slate-200 active:scale-98';
                 const iOut = lblOut.querySelector('i');
                 if (iOut) iOut.className = 'fa-solid fa-circle-arrow-up text-rose-500 text-sm';
             } else if (typeVal === 'PENGELUARAN') {
                 lblOut.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-black cursor-pointer transition-all bg-rose-500 text-white shadow-sm border-2 border-rose-600 active:scale-98';
                 const iOut = lblOut.querySelector('i');
                 if (iOut) iOut.className = 'fa-solid fa-circle-arrow-up text-white text-sm';
                 lblIn.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-white text-slate-600 border-2 border-slate-200 active:scale-98';
                 const iIn = lblIn.querySelector('i');
                 if (iIn) iIn.className = 'fa-solid fa-circle-arrow-down text-emerald-500 text-sm';
             } else {
                 lblIn.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-white text-slate-700 border-2 border-slate-200 active:scale-98';
                 const iIn = lblIn.querySelector('i');
                 if (iIn) iIn.className = 'fa-solid fa-circle-arrow-down text-emerald-500 text-sm';
                 lblOut.className = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-white text-slate-700 border-2 border-slate-200 active:scale-98';
                 const iOut = lblOut.querySelector('i');
                 if (iOut) iOut.className = 'fa-solid fa-circle-arrow-up text-rose-500 text-sm';
             }
         }

         if (submitBtn) {
             submitBtn.className = 'w-full bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer';
         }
     }
     function nudgeTxType() {
         const group = document.getElementById('tx-type-group');
         if (group) {
             try { group.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
             group.classList.remove('field-nudge');
             void group.offsetWidth;
             group.classList.add('field-nudge');
             setTimeout(() => group.classList.remove('field-nudge'), 2800);
         }
         showToast('Pilih dulu: Pemasukan atau Pengeluaran.', 'warning');
     }

     // --- FUNGSI PAGING TRANSAKSI ---
     function changeTransactionPage(direction) {
         const search = safeLower(document.getElementById('tx-search').value);
         const entity = document.getElementById('tx-filter-entity').value;
         const type = document.getElementById('tx-filter-type').value;

         let filtered = state.transactions.filter(t => {
             const matchSearch = safeLower(t.description).includes(search) || safeLower(t.category).includes(search);
             const matchEntity = entity === 'ALL' || t.entity === entity || t.type === 'TRANSFER';
             const matchType = type === 'ALL' || t.type === type;
             return matchSearch && matchEntity && matchType;
         });

         const totalPages = Math.ceil(filtered.length / state.transactionLimit) || 1;
         const newPage = state.transactionPage + direction;

         if (newPage >= 1 && newPage <= totalPages) {
             state.transactionPage = newPage;
             renderTransactions();
         }
     }

     // --- FUNGSI PAGING LAPORAN ---
     function changeReportPage(direction) {
         let filtered = state.transactions;
         if (state.reportPeriod === 'HARIAN') {
             const dateVal = document.getElementById('report-date-picker').value || state.selectedDate;
             filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(dateVal));
         } else if (state.reportPeriod === 'BULANAN') {
             const monthVal = document.getElementById('report-month-picker').value || state.selectedMonth;
             filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(monthVal));
         }

         const totalPages = Math.ceil(filtered.length / state.reportLimit) || 1;
         const newPage = state.reportPage + direction;

         if (newPage >= 1 && newPage <= totalPages) {
             state.reportPage = newPage;
             renderReportTable(filtered);
         }
     }

     // --- FUNGSI PERHITUNGAN MODAL & PRIVE ---
     function computeModalAndPrive(transactions) {
         let suntikTotal = 0;
         let penarikanTotal = 0;

         (transactions || state.transactions).forEach(t => {
             if (t.type === 'TRANSFER') {
                 const amt = Number(t.amount) || 0;
                 if (classifyTransfer(t) === 'SUNTIK') suntikTotal += amt;
                 if (classifyTransfer(t) === 'PRIVE') penarikanTotal += amt;
             }
         });

         const priveAktual = Math.max(0, penarikanTotal - suntikTotal);
         const modalKembali = Math.min(penarikanTotal, suntikTotal);
         const sisaModal = Math.max(0, suntikTotal - penarikanTotal);

         let status = '';
         let edukasi = '';

         if (sisaModal > 0) {
             status = 'Mengembalikan Modal';
             edukasi = `Anda masih memiliki sisa modal pribadi di usaha sebesar ${formatRp(sisaModal)}. Semua penarikan saat ini adalah pengembalian modal, BUKAN prive (keuntungan).`;
         } else if (priveAktual > 0) {
             status = 'Mengambil Keuntungan (Prive)';
             edukasi = `Modal pribadi sudah kembali semua. Kelebihan penarikan sebesar ${formatRp(priveAktual)} adalah prive (bagian laba usaha untuk pemilik).`;
         } else {
             status = 'Modal Sama Dengan Penarikan';
             edukasi = 'Total modal yang disuntik sama dengan total penarikan. Belum ada prive yang diambil.';
         }

         return {
             suntikTotal,
             penarikanTotal,
             priveAktual,
             modalKembali,
             sisaModal,
             status,
             edukasi
         };
     }

     // --- GOOGLE DRIVE SYNC ENGINE ---
     let tokenRequestResolve = null;

     async function loadGoogleConfig() {
         // Client ID statis (tidak butuh endpoint API) supaya tetap jalan
         // di GitHub Pages yang tidak punya backend PHP.
         if (!GOOGLE_CLIENT_ID && window.DOMPETKU_GOOGLE_CLIENT_ID) {
             GOOGLE_CLIENT_ID = String(window.DOMPETKU_GOOGLE_CLIENT_ID).trim();
         }
         return GOOGLE_CLIENT_ID;
     }

     async function initGoogleDriveAuth() {
         if (tokenClient) return tokenClient;
         await loadGoogleConfig();
         if (!GOOGLE_CLIENT_ID) return null;

         for (let i = 0; i < 50; i++) {
             if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) break;
             await new Promise((r) => setTimeout(r, 150));
         }
         if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return null;

         tokenClient = google.accounts.oauth2.initTokenClient({
             client_id: GOOGLE_CLIENT_ID,
             scope: GDRIVE_SCOPE,
             callback: (response) => {
                 const resolve = tokenRequestResolve;
                 tokenRequestResolve = null;
                 if (!response || response.error || !response.access_token) {
                     if (resolve) resolve(null);
                     return;
                 }
                 state.gdrive.accessToken = response.access_token;
                 state.gdrive.tokenExpiry = Date.now() + ((Number(response.expires_in) || 3600) - 60) * 1000;
                 saveGDriveMeta();
                 if (resolve) resolve(response.access_token);
             },
             error_callback: () => {
                 const resolve = tokenRequestResolve;
                 tokenRequestResolve = null;
                 if (resolve) resolve(null);
             }
         });
         return tokenClient;
     }

     function tokenIsValid() {
         return !!(state.gdrive.accessToken && state.gdrive.tokenExpiry && Date.now() < state.gdrive.tokenExpiry);
     }

     // forceInteractive=true -> boleh popup. false -> silent, tidak pernah popup (auto-backup).
     async function ensureAccessToken(forceInteractive) {
         if (tokenIsValid()) return state.gdrive.accessToken;
         if (!forceInteractive) return null;
         const client = await initGoogleDriveAuth();
         if (!client) {
             showToast('Google Sign-In belum siap. Coba lagi sebentar.', 'warning');
             return null;
         }
         if (tokenRequestResolve) return null;
         const token = await new Promise((resolve) => {
             tokenRequestResolve = resolve;
             const opts = { prompt: 'consent' };
             if (state.gdrive.userEmail) opts.hint = state.gdrive.userEmail;
             try {
                 client.requestAccessToken(opts);
             } catch (err) {
                 tokenRequestResolve = null;
                 resolve(null);
             }
         });
         if (!token) return null;
         if (!state.gdrive.userEmail) await fetchGoogleUserInfo();
         saveGDriveMeta();
         updateGDriveUI();
         return token;
     }

     async function gdriveFetch(url, options, isRetry, allowInteractive) {
         const token = allowInteractive ? await ensureAccessToken(true) : await ensureAccessToken(false);
         if (!token) return null;
         const opts = Object.assign({}, options || {});
         opts.headers = Object.assign({}, opts.headers || {}, { Authorization: `Bearer ${token}` });
         let res;
         try {
             res = await fetch(url, opts);
         } catch (e) {
             return null;
         }
         if (res && res.status === 401 && !isRetry && allowInteractive) {
             state.gdrive.accessToken = null;
             state.gdrive.tokenExpiry = null;
             saveGDriveMeta();
             return gdriveFetch(url, options, true, allowInteractive);
         }
         return res;
     }

     async function fetchGoogleUserInfo() {
         try {
             const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                 headers: { Authorization: `Bearer ${state.gdrive.accessToken}` }
             });
             const data = await res.json();
             state.gdrive.userEmail = data.email || 'Akun Google';
              state.gdrive.userName = data.name || data.given_name || null;
              try { if (window.DompetkuTelemetry) window.DompetkuTelemetry.log('google_linked', {}); } catch (e) {}
         } catch (err) {
             console.error('Failed to get user info', err);
             state.gdrive.userEmail = state.gdrive.userEmail || 'Akun Google';
         }
         saveGDriveMeta();
     }

     async function connectGoogleDrive() {
         if (state.gdrive.userEmail) {
             uploadToGoogleDrive(false);
             processPendingPhotoUploads();
             return;
         }
         const token = await ensureAccessToken(true);
         if (!token) {
             showToast('Gagal menghubungkan akun Google.', 'error');
             return;
         }
         updateGDriveUI();
         showToast(`Terhubung sebagai ${state.gdrive.userEmail}`, 'success');
         processPendingPhotoUploads();
     }

     async function disconnectGoogleDrive() {
         try {
             if (state.gdrive.accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                 google.accounts.oauth2.revoke(state.gdrive.accessToken, () => {});
             }
         } catch (err) { /* abaikan */ }
         state.gdrive.accessToken = null;
         state.gdrive.tokenExpiry = null;
         state.gdrive.userEmail = null;
          state.gdrive.userName = null;
          try { if (window.DompetkuTelemetry) window.DompetkuTelemetry.log('google_unlinked', {}); } catch (e) {}
         state.gdrive.lastSyncTime = null;
         saveGDriveMeta();
         updateGDriveUI();
         showToast('Akun Google diputuskan.', 'info');
     }

     async function backupToGoogleDrive() {
         uploadToGoogleDrive(false);
     }

     async function restoreFromGoogleDrive() {
         const token = await ensureAccessToken(true);
         if (!token) {
             showToast('Hubungkan akun Google terlebih dahulu.', 'warning');
             return;
         }
         executeGDriveRestore();
     }

     function restoreFromGoogleDriveDirect() {
         restoreFromGoogleDrive();
     }

     function triggerGDriveBackupManual() {
         uploadToGoogleDrive(false);
     }

     async function uploadToGoogleDrive(isAuto) {
         if (isUploadingToDrive) return;
         if (isAuto) {
             if (!state.gdrive.userEmail) return;
             if (state.gdrive.syncFreqDays === 0) return;
             if (!tokenIsValid()) return;
             if (state.gdrive.lastSyncTime) {
                 const diffDays = (Date.now() - new Date(state.gdrive.lastSyncTime).getTime()) / (1000 * 60 * 60 * 24);
                 if (diffDays < Number(state.gdrive.syncFreqDays || 1)) return;
             } else if (!state.transactions || state.transactions.length === 0) {
                 return;
             }
         }
         const token = isAuto ? await ensureAccessToken(false) : await ensureAccessToken(true);
         if (!token) {
             if (!isAuto) showToast('Hubungkan akun Google terlebih dahulu.', 'warning');
             return;
         }

         if (!isAuto) showToast('Mengunggah cadangan ke Google Drive...', 'info');
         isUploadingToDrive = true;

         // Kumpulkan data seluruh user untuk backup komprehensif
         const allUsersData = {};
         for (const u of state.users) {
             const raw = await dbGet(STORAGE_DATA_PREFIX + u.id);
             if (raw) {
                 try {
                     allUsersData[u.id] = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                 } catch(e) {
                     allUsersData[u.id] = raw;
                 }
             }
         }
         // Pastikan data user aktif tersimpan mutakhir
         if (state.currentUser) {
             allUsersData[state.currentUser] = {
                 tourSeen: !!state.tourSeen,
                 businessName: state.businessName,
                 logoBase64: state.logoBase64,
                 transactions: state.transactions,
                 categories: state.categories,
                 categoriesEnabled: state.categoriesEnabled
             };
         }

         const backupContent = JSON.stringify({
             version: "3.0",
             exportDate: new Date().toISOString(),
             users: state.users,
             activeUserId: state.currentUser,
             tourSeen: !!state.tourSeen,
             tourSeen: !!state.tourSeen,
             businessName: state.businessName,
             logoBase64: state.logoBase64,
             transactions: state.transactions,
             categories: state.categories,
             categoriesEnabled: state.categoriesEnabled,
             allUsersData: allUsersData
         });

         try {
             const searchRes = await gdriveFetch(
                 `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GDRIVE_FILE_NAME}'`,
                 null, false, !isAuto
             );
             if (!searchRes) { isUploadingToDrive = false; return; }
             const searchData = await searchRes.json();
             const existingFile = searchData.files && searchData.files[0];

             let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
             let method = 'POST';

             const metadata = {
                 name: GDRIVE_FILE_NAME,
                 parents: ['appDataFolder']
             };

             if (existingFile) {
                 uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
                 method = 'PATCH';
                 delete metadata.parents;
             }

             const boundary = 'dompetku_' + Math.random().toString(36).slice(2);
             const delimiter = "\r\n--" + boundary + "\r\n";
             const close_delim = "\r\n--" + boundary + "--";

             const multipartRequestBody =
                 delimiter +
                 'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                 JSON.stringify(metadata) +
                 delimiter +
                 'Content-Type: application/json\r\n\r\n' +
                 backupContent +
                 close_delim;

             const uploadRes = await gdriveFetch(uploadUrl, {
                 method: method,
                 headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
                 body: multipartRequestBody
             }, false, !isAuto);

             if (uploadRes && uploadRes.ok) {
                 if (!state.gdrive.userEmail) await fetchGoogleUserInfo();
                 state.gdrive.lastSyncTime = new Date().toISOString();
                 state.hasUnsavedChanges = false;
                 await saveGDriveMeta();
                 updateGDriveUI();
                 if (!isAuto) showToast('Pencadangan Google Drive Berhasil!', 'success');
                  try { if (window.DompetkuTelemetry) window.DompetkuTelemetry.log('backup_done', {}); } catch (e) {}
             } else if (!isAuto) {
                 showToast('Gagal mengunggah ke Google Drive.', 'error');
             }
         } catch (err) {
             console.error(err);
             if (!isAuto) showToast('Koneksi terputus saat sinkronisasi Google Drive.', 'error');
         } finally {
             isUploadingToDrive = false;
         }
     }

     function isAutoBackupDue() {
         if (!state.gdrive.userEmail) return false;
         if (state.gdrive.syncFreqDays === 0) return false;
         if (!state.transactions || state.transactions.length === 0) return false;
         if (!state.gdrive.lastSyncTime) return true;
         const diffDays = (Date.now() - new Date(state.gdrive.lastSyncTime).getTime()) / (1000 * 60 * 60 * 24);
         return diffDays >= Number(state.gdrive.syncFreqDays || 1);
     }

     function scheduleAutoBackupCheck() {
         if (!isAutoBackupDue()) return;
         if (autoBackupTimer) clearTimeout(autoBackupTimer);
         autoBackupTimer = setTimeout(() => { uploadToGoogleDrive(true); }, 4000);
     }

     async function executeGDriveRestore() {
         showToast('Mencari file cadangan di Google Drive...', 'info');
         try {
             // Cek file dompetku_backup.json atau duitku_backup.json lama
             let searchRes = await gdriveFetch(
                 `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${GDRIVE_FILE_NAME}'`,
                 null, false, true
             );
             let searchData = searchRes ? await searchRes.json() : null;
             let file = searchData && searchData.files && searchData.files[0];

             if (!file) {
                 // Fallback cek file lama duitku_backup.json
                 searchRes = await gdriveFetch(
                     `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='duitku_backup.json'`,
                     null, false, true
                 );
                 searchData = searchRes ? await searchRes.json() : null;
                 file = searchData && searchData.files && searchData.files[0];
             }

             if (!file) {
                 showToast('Tidak ada file cadangan ditemukan di Google Drive ini.', 'warning');
                 return;
             }

             const fileRes = await gdriveFetch(
                 `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                 null, false, true
             );
             if (!fileRes) return;
             const parsed = await fileRes.json();

             showConfirmModal('Pulihkan Data Google Drive', `Ditemukan cadangan tanggal ${new Date(parsed.exportDate || Date.now()).toLocaleString('id-ID')}. Pulihkan data ini?`, async () => {
                 if (parsed.version === "3.0" && parsed.allUsersData) {
                     state.users = Array.isArray(parsed.users) ? parsed.users.filter(u => u && typeof u === 'object').map(u => ({
                         id: String(u.id || generateId('usr_')),
                         businessName: String(u.businessName || 'DompetKu').slice(0, 60),
                         createdAt: String(u.createdAt || new Date().toISOString()),
                         gdriveEmail: (typeof u.gdriveEmail === 'string') ? u.gdriveEmail.slice(0, 120) : null,
                         logoBase64: (typeof u.logoBase64 === 'string' && (u.logoBase64.startsWith('data:image/') || u.logoBase64 === DEFAULT_WALLET_LOGO)) ? u.logoBase64 : DEFAULT_WALLET_LOGO
                     })) : [];
                     for (const uid of Object.keys(parsed.allUsersData || {})) {
                         const v = parsed.allUsersData[uid];
                         if (v && typeof v === 'object') await dbSet(STORAGE_DATA_PREFIX + String(uid), v);
                     }
                     await dbSet(STORAGE_USERS, state.users);

                     const activeOk = state.users.some(u => String(u.id) === String(parsed.activeUserId));
                     const targetUser = (activeOk && parsed.activeUserId) || (state.users[0] ? state.users[0].id : null);
                     if (targetUser) {
                         await selectProfile(targetUser);
                     } else if (state.users.length > 0) {
                         await selectProfile(state.users[0].id);
                     }
                 } else {
                     // Restore dari format v2.0 atau sebelumnya
                     const restoredName = parsed.businessName || 'DompetKu';
                     const newId = generateId('usr_');
                     const restoredProfile = {
                         id: newId,
                         businessName: restoredName,
                         createdAt: new Date().toISOString(),
                         gdriveEmail: state.gdrive.userEmail || null
                     };

                     state.users = [restoredProfile];
                     await dbSet(STORAGE_USERS, state.users);

                     const restoredData = {
                         businessName: restoredName,
                         logoBase64: parsed.logoBase64 || '',
                         transactions: parsed.transactions || [],
                         categories: parsed.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
                         categoriesEnabled: parsed.categoriesEnabled !== undefined ? parsed.categoriesEnabled : false
                     };
                     await dbSet(STORAGE_DATA_PREFIX + newId, restoredData);
                     await selectProfile(newId);
                 }

                 showToast('Data berhasil dipulihkan dari Google Drive!', 'success');
             });

         } catch (err) {
             console.error(err);
             showToast('Gagal memulihkan dari Google Drive.', 'error');
         }
     }

     function saveSyncSettings() {
         const freqEl = document.getElementById('setting-sync-freq');
         state.gdrive.syncFreqDays = freqEl ? Number(freqEl.value) : 1;
         saveGDriveMeta();
         const label = freqEl && freqEl.value === '0' ? 'Pencadangan Otomatis Dinonaktifkan' : 'Pengaturan Sinkronisasi Disimpan';
         showToast(label, 'success');
     }

     async function saveGDriveMeta() {
         await dbSet(STORAGE_GDRIVE_META, {
             accessToken: state.gdrive.accessToken,
             tokenExpiry: state.gdrive.tokenExpiry,
             userEmail: state.gdrive.userEmail,
              userName: state.gdrive.userName || null,
             lastSyncTime: state.gdrive.lastSyncTime,
             syncFreqDays: state.gdrive.syncFreqDays,
             photoFolderId: state.gdrive.photoFolderId || null
         });
     }

     async function loadGDriveMeta() {
         const parsed = await dbGet(STORAGE_GDRIVE_META);
         if (parsed) {
             state.gdrive.accessToken = parsed.accessToken || null;
             state.gdrive.tokenExpiry = parsed.tokenExpiry || null;
             state.gdrive.userEmail = parsed.userEmail || null;
              state.gdrive.userName = parsed.userName || null;
             state.gdrive.lastSyncTime = parsed.lastSyncTime || null;
             state.gdrive.photoFolderId = parsed.photoFolderId || null;
             if (parsed.syncFreqDays !== undefined) {
                 state.gdrive.syncFreqDays = Number(parsed.syncFreqDays);
             } else {
                 state.gdrive.syncFreqDays = 1;
             }
         }
         updateGDriveUI();
     }

     function updateGDriveUI() {
         const statusLabel = document.getElementById('gdrive-status-label');
         const dot = document.getElementById('gdrive-dot');
         const connectText = document.getElementById('btn-gdrive-connect-text');
         const lastSyncText = document.getElementById('gdrive-last-sync-text');
         const syncBadge = document.getElementById('gdrive-sync-badge');
         const freqEl = document.getElementById('setting-sync-freq');

         if (freqEl) freqEl.value = state.gdrive.syncFreqDays;

         const disconnectBtn = document.getElementById('btn-gdrive-disconnect');

         if (state.gdrive.userEmail) {
             if (statusLabel) statusLabel.innerText = `Terhubung: ${state.gdrive.userEmail}`;
             if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
             if (connectText) connectText.innerText = "Sinkron Sekarang";
             if (disconnectBtn) disconnectBtn.classList.remove('hidden');
             // Update email di kartu profil aktif
             updateActiveProfileEmail(state.gdrive.userEmail);
         } else {
             if (statusLabel) statusLabel.innerText = "Belum Terhubung";
             if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-slate-500";
             if (connectText) connectText.innerText = "Hubungkan Akun";
             if (disconnectBtn) disconnectBtn.classList.add('hidden');
         }

         if (state.gdrive.lastSyncTime) {
             if (lastSyncText) lastSyncText.innerText = `Sinkron Terakhir: ${new Date(state.gdrive.lastSyncTime).toLocaleString('id-ID')}`;
         } else {
             if (lastSyncText) lastSyncText.innerText = "Belum pernah disinkronkan.";
         }

         if (syncBadge) {
             if (state.hasUnsavedChanges) {
                 syncBadge.classList.remove('hidden');
             } else {
                 syncBadge.classList.add('hidden');
             }
         }
     }

     async function updateActiveProfileEmail(email) {
         if (!state.currentUser) return;
         const userIdx = state.users.findIndex(u => u.id === state.currentUser);
         if (userIdx !== -1 && state.users[userIdx].gdriveEmail !== email) {
             state.users[userIdx].gdriveEmail = email;
             await dbSet(STORAGE_USERS, state.users);
         }
     }

     function checkAutomaticSyncRules() {
          if (isAutoBackupDue()) uploadToGoogleDrive(true);
      }

     document.addEventListener('visibilitychange', () => {
         if (document.visibilityState === 'hidden') {
             checkAutomaticSyncRules();
         }
     });
     window.addEventListener('beforeunload', () => {
         checkAutomaticSyncRules();
     });



     // --- STANDARD APP LOGIC ---
     function isAppInstalled() {
         return window.matchMedia('(display-mode: standalone)').matches
             || window.matchMedia('(display-mode: fullscreen)').matches
             || window.matchMedia('(display-mode: minimal-ui)').matches
             || window.navigator.standalone === true
             || document.referrer.startsWith('android-app_/index.html');
     }

     function updateInstallButton() {
         const btn = document.getElementById('pwa-install-btn');
         if (!btn) return;
         btn.style.display = (!isAppInstalled() && deferredPrompt) ? 'flex' : 'none';
     }

     function initPWA() {
         if ('serviceWorker' in navigator) {
             let swRefreshed = false;
             navigator.serviceWorker.addEventListener('controllerchange', () => {
                 if (swRefreshed) return;
                 const ae = document.activeElement;
                 const typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
                 const modalOpen = ['modal-ai', 'modal-transaction', 'modal-transfer', 'modal-confirm', 'modal-auth'].some(id => {
                     const m = document.getElementById(id);
                     return m && !m.classList.contains('hidden') && id !== 'modal-auth';
                 });
                 if (typing || modalOpen) return;
                 swRefreshed = true;
                 window.location.reload();
             });
         }
         window.addEventListener('beforeinstallprompt', (e) => {
             e.preventDefault();
             deferredPrompt = e;
             updateInstallButton();
         });

         window.addEventListener('appinstalled', () => {
             deferredPrompt = null;
             updateInstallButton();
             showToast('Aplikasi berhasil dipasang di perangkat!', 'success');
         });

         window.matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallButton);
         updateInstallButton();

         const host = location.hostname;
         const inIframe = window.self !== window.top;
         const isPreview = host.startsWith('id-preview--') || host.startsWith('preview--')
             || host.endsWith('.lovableproject.com') || host.endsWith('.lovableproject-dev.com')
             || host.endsWith('.beta.lovable.dev') || host === 'localhost' || host === '127.0.0.1';
         const killSwitch = new URLSearchParams(location.search).get('sw') === 'off';

         if ('serviceWorker' in navigator) {
             if (inIframe || isPreview || killSwitch) {
                 navigator.serviceWorker.getRegistrations().then((regs) => {
                     regs.forEach((reg) => {
                         if (reg.active && reg.active.scriptURL.indexOf('sw.js') !== -1) reg.unregister();
                     });
                 }).catch(() => {});
             } else {
                 window.addEventListener('load', () => {
                     navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
                 });
             }
         }
     }

     function triggerPwaInstall() {
         if (deferredPrompt) {
             deferredPrompt.prompt();
             deferredPrompt.userChoice.then((choice) => {
                 deferredPrompt = null;
                 updateInstallButton();
                 if (choice.outcome === 'accepted') {
                     showToast('Memasang aplikasi...', 'success');
                 }
             });
         } else if (isAppInstalled()) {
             updateInstallButton();
         } else {
             showToast('Pilih "Tambahkan ke Layar Utama" pada menu browser Anda.', 'info');
         }
     }

     function showToast(message, type = 'info') {
         const container = document.getElementById('toast-container');
         const toast = document.createElement('div');
         let bgClass = 'bg-slate-800 text-white';
         let iconClass = 'fa-circle-info';
         if (type === 'success') { bgClass = 'bg-emerald-600 text-white'; iconClass = 'fa-circle-check'; }
         if (type === 'error') { bgClass = 'bg-rose-600 text-white'; iconClass = 'fa-circle-xmark'; }
         if (type === 'warning') { bgClass = 'bg-amber-500 text-slate-950'; iconClass = 'fa-triangle-exclamation'; }

         toast.className = `p-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-toast ${bgClass}`;
         /* patched: pakai textContent */
         toast.appendChild(Object.assign(document.createElement('i'), { className: `fa-solid ${iconClass} text-sm shrink-0` }));
         toast.appendChild(Object.assign(document.createElement('span'), { textContent: String(message == null ? '' : message) }));
         container.appendChild(toast);
         setTimeout(() => {
             toast.style.opacity = '0';
             toast.style.transition = 'all 0.3s ease';
             setTimeout(() => toast.remove(), 300);
         }, 3000);
     }

     function showConfirmModalHTML(title, html, onConfirm) {
         document.getElementById('confirm-title').innerText = title;
         document.getElementById('confirm-message').innerHTML = html;
         pendingConfirmCallback = onConfirm;
         document.getElementById('modal-confirm').classList.remove('hidden');
     }

     function showConfirmModal(title, message, onConfirm) {
         document.getElementById('confirm-title').innerText = title;
         document.getElementById('confirm-message').innerText = message;
         pendingConfirmCallback = onConfirm;
         document.getElementById('modal-confirm').classList.remove('hidden');
     }

     document.getElementById('confirm-btn-cancel').onclick = () => {
         document.getElementById('modal-confirm').classList.add('hidden');
         pendingConfirmCallback = null;
     };

     document.getElementById('confirm-btn-ok').onclick = () => {
         document.getElementById('modal-confirm').classList.add('hidden');
         if (pendingConfirmCallback) pendingConfirmCallback();
         pendingConfirmCallback = null;
     };

     async function loadStorageState() {
        let users = await dbGet(STORAGE_USERS);
        if (!users || !Array.isArray(users)) users = [];
        if (users.length === 0) {
            state.users = [];
            state.currentUser = null;
            renderProfileScreen();
            showAuthScreen('profiles');
            document.getElementById('modal-auth').classList.remove('hidden');
            await loadGDriveMeta();
            return;
        } else {
            // Pastikan data logo profil termutakhirkan jika ada
            let usersUpdated = false;
            for (const u of users) {
                if (!u.logoBase64) {
                    const uData = await dbGet(STORAGE_DATA_PREFIX + u.id);
                    if (uData && uData.logoBase64) {
                        u.logoBase64 = uData.logoBase64;
                        usersUpdated = true;
                    }
                }
            }
            if (usersUpdated) {
                await dbSet(STORAGE_USERS, users);
            }
        }

        state.users = users;

        const activeSession = await dbGet(STORAGE_SESSION);
        const userExists = state.users.some(u => u.id === activeSession);

        if (activeSession && userExists) {
            state.currentUser = activeSession;
            await loadUserData(activeSession);
            document.getElementById('modal-auth').classList.add('hidden');
        } else {
            state.currentUser = null;
            renderProfileScreen();
            showAuthScreen('profiles');
            document.getElementById('modal-auth').classList.remove('hidden');
        }

        await loadGDriveMeta();
    }

    async function loadUserData(userId) {
        const rawData = await dbGet(STORAGE_DATA_PREFIX + userId);
        const userProfile = state.users.find(u => u.id === userId);
        const defaultName = userProfile ? userProfile.businessName : 'DompetKu';

        if (rawData) {
            try {
                const parsed = (typeof rawData === 'string') ? JSON.parse(rawData) : rawData;
                state.businessName = parsed.businessName || defaultName;
                state.logoBase64 = parsed.logoBase64 || DEFAULT_WALLET_LOGO;
                state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions.filter(t => t && typeof t === 'object') : [];
                state.categories = parsed.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
                state.categoriesEnabled = parsed.categoriesEnabled !== undefined ? parsed.categoriesEnabled : false;
                 state.tourSeen = parsed.tourSeen !== undefined ? parsed.tourSeen : true;
            } catch (e) {
                console.error('Error parsing user data', e);
                await initDefaultUserData(defaultName);
            }
        } else {
            await initDefaultUserData(defaultName);
        }
    }

    async function initDefaultUserData(name, initialCapital = 0, capitalType = null) {
        state.businessName = name || 'DompetKu';
        state.tourSeen = false;
        state.logoBase64 = DEFAULT_WALLET_LOGO;
        state.transactions = [];
        if (initialCapital > 0) {
            const nowTime = getLocalDateTimeInputValue();
            if (capitalType === 'KEUNTUNGAN_USAHA') {
                state.transactions.push({
                    id: generateId(),
                    type: 'PEMASUKAN',
                    entity: 'USAHA',
                    amount: initialCapital,
                    category: 'Pemasukan Lainnya',
                    date: nowTime,
                    paymentMethod: 'Tunai',
                    description: 'Modal Awal Usaha (Keuntungan Bersih)'
                });
            } else {
                // SUNTIK_MODAL (Alur: Pemasukan pribadi lalu transfer suntik modal ke usaha agar saldo pribadi tidak minus)
                state.transactions.push({
                    id: generateId(),
                    type: 'PEMASUKAN',
                    entity: 'PRIBADI',
                    amount: initialCapital,
                    category: 'Pemasukan Lainnya',
                    date: nowTime,
                    paymentMethod: 'Tunai',
                    description: 'Dana Pribadi untuk Modal Awal'
                });
                state.transactions.push({
                    id: generateId(),
                    type: 'TRANSFER',
                    entity: 'USAHA',
                    amount: initialCapital,
                    category: 'Suntik Modal',
                    date: nowTime,
                    paymentMethod: 'Tunai',
                    description: 'Modal Awal Usaha (Suntik Modal Pribadi)'
                });
            }
        }
        state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        state.categoriesEnabled = false;
        await saveAppData(false);
    }

    async function saveAppData(markUnsaved = true) {
        if (markUnsaved) state.hasUnsavedChanges = true;
        if (state.currentUser) {
            await dbSet(STORAGE_DATA_PREFIX + state.currentUser, {
                tourSeen: !!state.tourSeen,
                businessName: state.businessName,
                logoBase64: state.logoBase64,
                transactions: state.transactions,
                categories: state.categories,
                categoriesEnabled: state.categoriesEnabled
            });
        }
        updateGDriveUI();
        if (markUnsaved) scheduleAutoBackupCheck();
    }

    function getDummyTransactions() {
        const today = new Date().toISOString().slice(0, 10);
        return [
         //   { id: '1', date: `${today}T09:00`, entity: 'USAHA', type: 'PEMASUKAN', category: 'Penjualan Produk', amount: 850000, description: 'Penjualan Paket Kopi & Roti', paymentMethod: 'QRIS' },
         //   { id: '2', date: `${today}T10:30`, entity: 'USAHA', type: 'PENGELUARAN', category: 'Bahan Baku', amount: 300000, description: 'Beli Biji Kopi & Susu Fresh', paymentMethod: 'Transfer Bank' }
        ];
    }

    // --- AUTH & PROFILE PICKER FUNCTIONS ---
    function handleCapitalInputChange() {
        const capitalEl = document.getElementById('input-new-business-capital');
        const capitalRaw = capitalEl ? capitalEl.value.replace(/\./g, '') : '';
        const initialCapital = Number(capitalRaw) || 0;
        const container = document.getElementById('container-modal-option');
        const errorEl = document.getElementById('capital-option-error');

        if (container) {
            if (initialCapital > 0) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
                document.querySelectorAll('input[name="capital-accounting-type"]').forEach(r => r.checked = false);
                if (errorEl) errorEl.classList.add('hidden');
            }
        }
    }

    function validateCapitalOption() {
        const errorEl = document.getElementById('capital-option-error');
        const selected = document.querySelector('input[name="capital-accounting-type"]:checked');
        if (selected && errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    function showAuthScreen(screen) {
        const profilesView = document.getElementById('auth-screen-profiles');
        const newProfileView = document.getElementById('auth-screen-new-profile');
        const authSub = document.getElementById('auth-subtitle');

        if (screen === 'profiles') {
            profilesView.classList.remove('hidden');
            newProfileView.classList.add('hidden');
            authSub.innerText = 'Pilih profil usaha Anda';
            renderProfileScreen();
        } else if (screen === 'new-profile') {
            profilesView.classList.add('hidden');
            newProfileView.classList.remove('hidden');
            authSub.innerText = 'Tambah Profil Usaha Baru';
            document.getElementById('input-new-business-name').value = '';
            const capitalEl = document.getElementById('input-new-business-capital');
            if (capitalEl) capitalEl.value = '';
            const container = document.getElementById('container-modal-option');
            if (container) container.classList.add('hidden');
            document.querySelectorAll('input[name="capital-accounting-type"]').forEach(r => r.checked = false);
            const errorEl = document.getElementById('capital-option-error');
            if (errorEl) errorEl.classList.add('hidden');
            setTimeout(() => document.getElementById('input-new-business-name').focus(), 150);
        }
    }

    function renderProfileScreen() {
        const grid = document.getElementById('profile-grid');
        if (!grid) return;

        if (state.users.length === 0) {
            grid.innerHTML = `<p class="col-span-2 text-center text-slate-400 py-6 text-xs">Belum ada profil usaha.</p>`;
            return;
        }

        grid.innerHTML = state.users.map((u, idx) => {
            const isFirst = idx === 0;
            const emailInfo = u.gdriveEmail
                ? `<span class="text-[10px] text-emerald-600 truncate flex items-center gap-1 font-medium"><i class="fa-brands fa-google text-[10px]"></i> ${escapeHtml(u.gdriveEmail)}</span>`
                : `<span class="text-[9px] text-slate-400 italic">Belum ada cadangan Google</span>`;

            const safeLogo = getDisplayLogo(u.logoBase64);
             const avatarHTML = `<img src="${safeLogo}" alt="${escapeHtml(u.businessName)}" class="w-8 h-8 rounded-xl object-cover shrink-0 shadow-xs border border-slate-200">`;

            const deleteBtn = state.users.length > 1
                ? `<button type="button" data-uid="${escapeHtml(u.id)}" onclick="deleteProfile(this.dataset.uid, event)" title="Hapus profil" class="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors text-xs z-10"><i class="fa-solid fa-trash-can"></i></button>`
                : '';

            return `
                <div class="relative group">
                    <button type="button" data-uid="${escapeHtml(u.id)}" onclick="selectProfile(this.dataset.uid)" class="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border-2 border-slate-200/80 hover:border-emerald-500 transition-all flex flex-col justify-between min-h-[96px] shadow-xs active:scale-[0.98]">
                        <div class="flex items-center gap-2">
                            ${avatarHTML}
                        </div>
                        <div class="mt-2 min-w-0 pr-4">
                            <span class="block text-xs font-extrabold text-slate-800 truncate leading-snug">${escapeHtml(u.businessName)}</span>
                            <div class="mt-0.5 truncate">${emailInfo}</div>
                        </div>
                    </button>
                    ${deleteBtn}
                </div>
            `;
        }).join('');
    }

    async function selectProfile(userId) {
        state.transactionPage = 1;
        state.reportPage = 1;
        state.currentUser = userId;
        await dbSet(STORAGE_SESSION, userId);
        await loadUserData(userId);
        document.getElementById('modal-auth').classList.add('hidden');
        refreshUI();
        showToast(`Masuk sebagai ${state.businessName}`, 'success');
        setTimeout(checkGDriveNudge, 800);
        setTimeout(() => { if (!state.tourSeen && guideIdx < 0) startGuideTour(); }, 1600);
    }

    async function handleCreateProfile(e) {
        e.preventDefault();
        const name = document.getElementById('input-new-business-name').value.trim().slice(0, 60);
        if (!name) return;

        const capitalEl = document.getElementById('input-new-business-capital');
        const capitalRaw = capitalEl ? capitalEl.value.replace(/\./g, '') : '';
        const initialCapital = Number(capitalRaw) || 0;

        let capitalType = null;
        if (initialCapital > 0) {
            const selectedRadio = document.querySelector('input[name="capital-accounting-type"]:checked');
            if (!selectedRadio) {
                const errorEl = document.getElementById('capital-option-error');
                if (errorEl) errorEl.classList.remove('hidden');
                showToast('Wajib pilih perlakuan modal awal terlebih dahulu!', 'warning');
                return;
            }
            capitalType = selectedRadio.value;
        }

        const newId = generateId('usr_');
        const newProfile = {
            id: newId,
            businessName: name,
            createdAt: new Date().toISOString(),
            gdriveEmail: null,
            logoBase64: DEFAULT_WALLET_LOGO
        };

        state.users.push(newProfile);
        await dbSet(STORAGE_USERS, state.users);

        // Inisialisasi data usaha baru dengan modal awal jika diisi
        state.currentUser = newId;
        await initDefaultUserData(name, initialCapital, capitalType);
        await selectProfile(newId);
          try { if (window.DompetkuTelemetry) window.DompetkuTelemetry.log('profile_created', {}); } catch (e) {}
    }

     function deleteProfile(userId, e) {
         if (e) e.stopPropagation();
         const profile = state.users.find(u => String(u.id) === String(userId));
         const name = profile ? profile.businessName : 'profil ini';

         showConfirmModal('Hapus Profil Usaha', `Hapus profil "${name}" beserta seluruh data transaksinya? Tindakan ini tidak dapat dibatalkan.`, async () => {
             state.users = state.users.filter(u => String(u.id) !== String(userId));
             await dbSet(STORAGE_USERS, state.users);
             await dbDelete(STORAGE_DATA_PREFIX + userId);

             if (String(state.currentUser) === String(userId)) {
                 if (state.users.length > 0) {
                     await selectProfile(state.users[0].id);
                 } else {
                     state.currentUser = null;
                     await dbDelete(STORAGE_SESSION);
                     renderProfileScreen();
                     showAuthScreen('profiles');
                     document.getElementById('modal-auth').classList.remove('hidden');
                 }
             } else {
                 renderProfileScreen();
             }
             showToast('Profil usaha telah dihapus.', 'info');
         });
     }

     function logout() {
         showConfirmModal('Ganti Profil Usaha', 'Apakah Anda ingin beralih profil atau keluar?', async () => {
             state.currentUser = null;
             await dbDelete(STORAGE_SESSION);
             renderProfileScreen();
             showAuthScreen('profiles');
             document.getElementById('modal-auth').classList.remove('hidden');
         });
     }

     // --- GDRIVE NUDGE POPUP FUNCTIONS ---
     async function checkGDriveNudge() {
         if (!state.currentUser) return;
         // Jika sudah terhubung, tidak perlu ingatkan
         if (state.gdrive.userEmail) return;

         // Catat first used jika belum pernah
         let firstUsed = await dbGet(STORAGE_FIRST_USED);
         if (!firstUsed) {
             firstUsed = Date.now().toString();
             await dbSet(STORAGE_FIRST_USED, firstUsed);
         }

         const diffDays = (Date.now() - Number(firstUsed)) / (1000 * 60 * 60 * 24);
         // Muncul jika sudah 7 hari atau lebih
         if (diffDays < 7) return;

         // Cek kapan terakhir nudge ditutup (jangan spam, minimal jeda 3 hari)
         const lastNudge = await dbGet(STORAGE_GDRIVE_NUDGE);
         if (lastNudge) {
             const nudgeDiffDays = (Date.now() - Number(lastNudge)) / (1000 * 60 * 60 * 24);
             if (nudgeDiffDays < 3) return;
         }

         const popup = document.getElementById('modal-gdrive-nudge');
         if (popup) popup.classList.remove('hidden');
     }

     async function dismissGDriveNudge() {
         const popup = document.getElementById('modal-gdrive-nudge');
         if (popup) popup.classList.add('hidden');
         await dbSet(STORAGE_GDRIVE_NUDGE, Date.now().toString());
     }

     function connectGDriveFromNudge() {
         dismissGDriveNudge();
         connectGoogleDrive();
     }


     function computeBalances() {
         let saldoUsaha = 0, saldoPribadi = 0;
         state.transactions.forEach(t => {
             const amt = Number(t.amount) || 0;
             if (t.type === 'PEMASUKAN') {
                 if (t.entity === 'USAHA') saldoUsaha += amt;
                 if (t.entity === 'PRIBADI') saldoPribadi += amt;
             } else if (t.type === 'PENGELUARAN') {
                 if (t.entity === 'USAHA') saldoUsaha -= amt;
                 if (t.entity === 'PRIBADI') saldoPribadi -= amt;
             } else if (t.type === 'TRANSFER') {
                 if (classifyTransfer(t) === 'SUNTIK') { saldoPribadi -= amt; saldoUsaha += amt; }
                 else if (classifyTransfer(t) === 'PRIVE') { saldoUsaha -= amt; saldoPribadi += amt; }
             }
         });
         return { saldoUsaha, saldoPribadi };
     }

     function computeModalDebt() {
         let suntik = 0, prive = 0;
         state.transactions.forEach(t => {
             if (t.type !== 'TRANSFER') return;
             const amt = Number(t.amount) || 0;
             if (classifyTransfer(t) === 'SUNTIK') suntik += amt;
             else if (classifyTransfer(t) === 'PRIVE') prive += amt;
         });
         const priveAktual = Math.max(0, prive - suntik);
         const modalKembali = Math.min(prive, suntik);
         const sisaModal = Math.max(0, suntik - prive);
         return { suntik, prive, priveAktual, modalKembali, sisaModal };
     }

     function renderDashInsights() {
         const box = document.getElementById('dash-insights');
         if (!box) return;
         const { saldoUsaha, saldoPribadi } = computeBalances();
         const d = computeModalDebt();
         let html = '';

         if (saldoUsaha < 0) {
             html += `
             <div class="bg-rose-50 border border-rose-200 rounded-2xl p-3.5">
                 <div class="flex items-center gap-2 mb-1">
                     <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>
                     <h3 class="text-xs font-extrabold text-rose-900">Saldo Usaha Minus ${formatRp(saldoUsaha)}</h3>
                 </div>
                 <p class="text-[11px] text-rose-800/90 leading-relaxed">Uang usaha sudah terpakai melebihi yang masuk. Saran tindakan:</p>
                 <ul class="text-[11px] text-rose-800/90 mt-1 space-y-0.5 list-disc pl-4">
                     <li>Stop dulu penarikan prive ke kantong pribadi.</li>
                     <li>Suntik modal dari kantong pribadi lewat tombol <b>Transfer Saldo</b>.</li>
                     <li>Tunda belanja non-esensial &amp; kejar penjualan/piutang.</li>
                 </ul>
             </div>`;
         }

         if (saldoPribadi < 0) {
             const need = Math.abs(saldoPribadi);
             html += `
             <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                 <div class="flex items-center gap-2 mb-1">
                     <i class="fa-solid fa-hand-holding-dollar text-amber-600"></i>
                     <h3 class="text-xs font-extrabold text-amber-900">Saldo Pribadi Minus ${formatRp(saldoPribadi)}</h3>
                 </div>
                 <p class="text-[11px] text-amber-900/90 leading-relaxed">Tambal kekurangan ini dengan prive dari kantong usaha sekali klik.</p>
                 <button type="button" onclick="coverPersonalDeficit()" class="mt-2 w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm">
                     <i class="fa-solid fa-wand-magic-sparkles"></i> Tambal ${formatRp(need)} dari Uang Usaha
                 </button>
             </div>`;
         }

         if (d.sisaModal > 0) {
             const risky = saldoUsaha < d.sisaModal;
             html += `
             <div class="bg-white border ${risky ? 'border-rose-200' : 'border-slate-200/80'} rounded-2xl p-3.5 shadow-xs">
                 <div class="flex items-center justify-between gap-2">
                     <div class="min-w-0">
                         <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sisa Modal Pribadi di Usaha</p>
                         <p class="text-sm font-black text-slate-900 mt-0.5">${formatRp(d.sisaModal)}</p>
                     </div>
                     <div class="w-9 h-9 rounded-xl ${risky ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'} flex items-center justify-center shrink-0">
                         <i class="fa-solid fa-scale-balanced"></i>
                     </div>
                 </div>
                 <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">Modal pribadi disuntik ${formatRp(d.suntik)} &bull; sudah dikembalikan ${formatRp(d.modalKembali)}.</p>
                 ${risky ? `<p class="text-[11px] font-semibold text-rose-700 mt-1.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Saldo usaha (${formatRp(saldoUsaha)}) lebih kecil dari sisa modal pribadi. Sebagian uang pribadi sudah terpakai habis.</p>` : `<p class="text-[11px] font-semibold text-emerald-700 mt-1.5"><i class="fa-solid fa-circle-check mr-1"></i>Saldo usaha masih cukup untuk mengembalikan modal pribadi.</p>`}
             </div>`;
         } else if (d.priveAktual > 0) {
             html += `
             <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                 <p class="text-[11px] font-bold text-emerald-900"><i class="fa-solid fa-circle-check mr-1"></i>Modal pribadi sudah balik penuh.</p>
                 <p class="text-[10px] text-emerald-800/90 mt-0.5">Prive (keuntungan) yang diambil: ${formatRp(d.priveAktual)}</p>
             </div>`;
         }

         box.innerHTML = html;
     }

     function coverPersonalDeficit() {
         const { saldoUsaha, saldoPribadi } = computeBalances();
         if (saldoPribadi >= 0) { showToast('Saldo pribadi tidak minus.', 'info'); return; }
         const need = Math.abs(saldoPribadi);
         const d = computeModalDebt();
         const sisaUsaha = saldoUsaha - need;
         const sisaModalSetelah = Math.max(0, d.sisaModal - need);
         showConfirmModalHTML('Tambal Saldo Pribadi', `
             <span class="block mb-2">Sistem akan mencatat <b>Penarikan Prive</b> dari kantong usaha ke kantong pribadi.</span>
             <span class="block bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1 text-left">
                 <span class="flex justify-between"><span>Nominal prive</span><b>${formatRp(need)}</b></span>
                 <span class="flex justify-between"><span>Saldo pribadi jadi</span><b>Rp 0</b></span>
                 <span class="flex justify-between"><span>Saldo usaha jadi</span><b class="${sisaUsaha < 0 ? 'text-rose-600' : ''}">${formatRp(sisaUsaha)}</b></span>
                 <span class="flex justify-between"><span>Sisa modal pribadi di usaha jadi</span><b>${formatRp(sisaModalSetelah)}</b></span>
             </span>
             ${sisaUsaha < 0 ? '<span class="block mt-2 text-rose-600 font-semibold">Perhatian: saldo usaha akan ikut minus setelah penarikan ini.</span>' : ''}
         `, () => {
             state.transactions.unshift({
                 id: generateId(),
                 type: 'TRANSFER',
                 entity: 'PRIBADI',
                 amount: need,
                 category: 'Penarikan Prive',
                 date: getLocalDateTimeInputValue(),
                 paymentMethod: 'Transfer Bank',
                 description: 'Tambal saldo pribadi minus (prive otomatis)'
             });
             saveAppData();
             refreshUI();
             showToast('Saldo pribadi sudah ditambal jadi Rp 0.', 'success');
         });
     }

     function formatRp(num) {
         return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
     }

     // --- AI CATAT CEPAT (teks/suara/foto struk via Gemini, fallback parser lokal) ---
     const DEFAULT_AI_KEY = 'AQ.Ab8RN6Ixp38wu2WcC8o_L1fPCqsAdCUaXeridLOJzpswZ1ovKg';
     let aiMode = 'text';
     let aiPhotoDataUrl = null;
     let aiBusy = false;
     let aiRecog = null;
     let aiRecording = false;
     let aiLastHeard = '';
     let aiLastHeardAt = 0;

     function getAiConfig() {
         try {
             return {
                 key: localStorage.getItem('dompetku_ai_key') || DEFAULT_AI_KEY || '',
                 model: (localStorage.getItem('dompetku_ai_model') || '').trim() || 'gemini-3.5-flash-lite'
             };
         } catch (e) { return { key: DEFAULT_AI_KEY || '', model: 'gemini-3.5-flash-lite' }; }
     }

     function openAiSheet() {
         aiPhotoDataUrl = null;
         const inp = document.getElementById('ai-input');
         if (inp) inp.value = '';
         const prev = document.getElementById('ai-photo-preview');
         if (prev) { prev.src = ''; prev.classList.add('hidden'); }
         setAiMode('text');
         const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
         const mic = document.getElementById('ai-mic-btn');
         if (mic) mic.classList.toggle('hidden', !SR);
         document.getElementById('modal-ai').classList.remove('hidden');
     }

     function setAiMode(mode) {
         aiMode = mode;
         const rv = document.getElementById('ai-review-pane');
         if (rv) rv.classList.add('hidden');
         const sb = document.getElementById('ai-submit-btn');
         if (sb) sb.classList.remove('hidden');
         const isText = mode === 'text';
         document.getElementById('ai-text-pane').classList.toggle('hidden', !isText);
         document.getElementById('ai-photo-pane').classList.toggle('hidden', isText);
         const bT = document.getElementById('ai-mode-text-btn');
         const bP = document.getElementById('ai-mode-photo-btn');
         bT.className = 'py-2 rounded-xl text-xs font-bold ' + (isText ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/15 text-white');
         bP.className = 'py-2 rounded-xl text-xs font-bold ' + (!isText ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/15 text-white');
     }

     function handleAiPhoto(e) {
         const file = e.target.files ? e.target.files[0] : null;
         e.target.value = '';
         if (!file) return;
         if (!String(file.type || '').startsWith('image/')) { showToast('File harus gambar.', 'warning'); return; }
         const rd = new FileReader();
         rd.onload = (evt) => {
             const img = new Image();
             img.onload = () => {
                 const maxSide = 1568;
                 let w = img.width || maxSide, h = img.height || maxSide;
                 const sc = Math.min(1, maxSide / Math.max(w, h));
                 w = Math.round(w * sc); h = Math.round(h * sc);
                 const cv = document.createElement('canvas');
                 cv.width = w; cv.height = h;
                 const cx = cv.getContext('2d');
                 cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h);
                 cx.drawImage(img, 0, 0, w, h);
                 aiPhotoDataUrl = cv.toDataURL('image/jpeg', 0.82);
                 const prev = document.getElementById('ai-photo-preview');
                 if (prev) { prev.src = aiPhotoDataUrl; prev.classList.remove('hidden'); }
             };
             img.onerror = () => showToast('Gagal membaca foto.', 'error');
             img.src = evt.target.result;
         };
         rd.readAsDataURL(file);
     }

     function micUI() {
         const btn = document.getElementById('ai-mic-btn');
         const st = document.getElementById('ai-mic-status');
         if (btn) btn.classList.toggle('mic-live', aiRecording);
         if (st) st.classList.toggle('hidden', !aiRecording);
     }

     function toggleAiMic() {
         const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
         const btn = document.getElementById('ai-mic-btn');
         if (!SR) {
             showToast('Browser ini tidak mendukung suara. Pakai Chrome Android/desktop.', 'warning');
             if (btn) btn.classList.add('hidden');
             return;
         }
         if (aiRecording && aiRecog) { try { aiRecog.stop(); } catch (e) {} return; }
         aiRecog = new SR();
         aiRecog.lang = 'id-ID';
         aiRecog.interimResults = false;
         aiRecog.maxAlternatives = 1;
         aiRecog.continuous = false;
         aiRecog.interimResults = false;
         aiRecog.onresult = (ev) => {
             let finalText = '';
             for (let i = ev.resultIndex || 0; i < (ev.results ? ev.results.length : 0); i++) {
                 if (ev.results[i].isFinal && ev.results[i][0]) finalText += ev.results[i][0].transcript;
             }
             if (finalText) {
                 const now = Date.now();
                 if (finalText !== aiLastHeard || (now - aiLastHeardAt) > 2500) {
                     const inp = document.getElementById('ai-input');
                     inp.value = ((inp.value ? inp.value + ' ' : '') + finalText).slice(0, 500);
                     aiLastHeard = finalText;
                     aiLastHeardAt = now;
                 }
             }
         };
         aiRecog.onend = () => { aiRecording = false; micUI(); };
         aiRecog.onerror = (ev) => {
             aiRecording = false; micUI();
             const c = ev && ev.error;
             if (c === 'not-allowed' || c === 'service-not-allowed') showToast('Izin mikrofon ditolak.', 'error');
             else if (c !== 'aborted') showToast('Gagal mendengar, coba lagi.', 'warning');
         };
         try { aiRecog.start(); aiRecording = true; micUI(); }
         catch (e) { showToast('Mikrofon sibuk, coba lagi.', 'warning'); }
     }

     function buildAiPrompt() {
         const pem = (state.categories.PEMASUKAN || []).join(', ');
         const peng = (state.categories.PENGELUARAN || []).join(', ');
         return 'Kamu pencatat keuangan Indonesia. Dari perintah atau foto struk berikut, kembalikan HANYA objek JSON '
             + 'tanpa penjelasan dengan bentuk {"items":[...]} berisi SATU objek per belanja/transaksi yang berbeda. '
             + 'Tiap item: {"type":"PEMASUKAN"|"PENGELUARAN"|null,"entity":"USAHA"|"PRIBADI"|null,'
             + '"amount":bilangan bulat rupiah atau null,"category":string atau null,"description":string,'
             + '"unknown":["type"|"entity"|"amount"|"category"]}. '
             + 'Aturan nominal: akhiran k/rb/ribu = ribu, jt/juta = juta; dari struk ambil TOTAL AKHIR (grand total), '
             + 'abaikan tunai, kembalian, kembali, dan diskon terpisah. '
             + 'Entity: kebutuhan usaha (sewa tempat, bahan baku, gaji karyawan, modal, stok) = USAHA; '
             + 'keperluan pribadi = PRIBADI; bila ragu = null. '
             + 'Kategori valid PEMASUKAN: ' + pem + '. PENGELUARAN: ' + peng + '. '
             + 'Pilih yang paling cocok atau null. description: ringkasan singkat bahasa Indonesia. '
             + 'unknown: daftar field yang null atau meragukan.';
     }

     function parseAiJson(txt) {
         if (!txt) throw { code: 'EMPTY', message: 'AI tidak mengembalikan hasil.' };
         let t = String(txt).trim().replace(/^```(json)?/i, '').replace(/```\s*$/, '').trim();
         return JSON.parse(t);
     }

     async function callGemini(parts, maxTokens) {
         const cfg = getAiConfig();
         if (!cfg.key) throw { code: 'NO_KEY', message: 'Isi kunci API Gemini di Pengaturan.' };
         const models = [];
         [cfg.model, 'gemini-3.5-flash-lite', 'gemini-3.5-flash'].forEach(m => {
             if (m && !models.includes(m)) models.push(m);
         });
         let lastErr = null;
         for (const model of models) {
             try {
                 return await callGeminiOnce(cfg.key, model, parts, maxTokens);
             } catch (e) {
                 lastErr = e;
                 if (!e || (e.code !== 'LIMIT' && e.retryable !== true)) throw e;
             }
         }
         throw lastErr || { code: 'API', message: 'AI tidak merespons.' };
     }

     async function callGeminiOnce(key, model, parts, maxTokens) {
         const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
             + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
         let res;
         try {
             res = await fetch(url, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     contents: [{ parts: parts }],
                     generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: maxTokens || 400 }
                 })
             });
         } catch (e) {
             throw { code: 'NETWORK', message: 'Tidak ada internet untuk AI.' };
         }
         let data = null;
         try { data = await res.json(); } catch (e) {}
         if (!res.ok) {
             const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
             if (res.status === 400) throw { code: 'BAD_KEY', message: 'Kunci ditolak / permintaan salah. Cek kunci & batasan referrer.' };
             if (res.status === 403) throw { code: 'FORBIDDEN', message: 'Akses ditolak (403). Cek batasan kunci di AI Studio.' };
             if (res.status === 404) throw { code: 'BAD_MODEL', message: 'Model tidak ditemukan. Cek nama model di Pengaturan.' };
             if (res.status === 429 || res.status === 503 || (res.status >= 500 && res.status < 600)) {
                 const e = { code: 'LIMIT', message: 'AI sibuk. Coba lagi nanti.' };
                 e.retryable = true;
                 throw e;
             }
             throw { code: 'API', message: String(msg).slice(0, 140) };
         }
         let txt = '';
         try {
             txt = (data.candidates[0].content.parts || []).map(p => p.text || '').join('');
         } catch (e) {}
         try {
             return parseAiJson(txt);
         } catch (e) {
             throw { code: 'FORMAT', message: 'AI mengembalikan format aneh. Coba lagi.' };
         }
     }

     function parseNominalId(str) {
         const m = String(str).match(/(\d[\d\.,]*)\s*(miliar|milyar|juta|jt|ribu|rb|k|m)\b/i);
         if (!m) {
             const b = String(str).match(/(\d[\d\.,]*)/);
             if (!b) return null;
             const v = Number(b[1].replace(/\./g, '').replace(',', '.'));
             return v > 0 ? Math.round(v) : null;
         }
         let num = Number(m[1].replace(/\./g, '').replace(',', '.'));
         if (!(num > 0)) return null;
         const u = m[2].toLowerCase();
         if (u === 'k' || u === 'rb' || u === 'ribu') num *= 1000;
         else if (u === 'jt' || u === 'juta') num *= 1000000;
         else num *= 1000000000;
         return Math.round(num);
     }

     function parseLocalCommand(cmd) {
         const low = ' ' + String(cmd).toLowerCase() + ' ';
         const amount = parseNominalId(cmd);
         let type = null;
         if (/(\bterima\b|\bdapat\b|\bmasuk\b|\buntung\b|\bjual\b|\blaku\b|\bterjual\b|\bpelunasan\b|\bdibayar\b)/.test(low)) type = 'PEMASUKAN';
         else if (/(\bbayar\b|\bbeli\b|\bbelanja\b|\bkeluar\b|\bsewa\b|\bcicil\b|\bongkir\b|\bsetor\b)/.test(low)) type = 'PENGELUARAN';
         let entity = null;
         if (/(\busaha\b|\btoko\b|\bwarung\b|\bkios\b|\bdagang\b|\bmodal\b|\bstok\b|\bkulakan\b|\bbahan\b|\bkaryawan\b|\bruko\b|\blapak\b|sewa tempat|\boperasional\b)/.test(low)) entity = 'USAHA';
         else if (/(\bpribadi\b|\bjajan\b|\bkeluarga\b|\banak\b|\bistri\b|\bmain\b|\bnongkrong\b)/.test(low)) entity = 'PRIBADI';
         let category = null;
         const pool = type ? (state.categories[type] || []) : [...(state.categories.PENGELUARAN || []), ...(state.categories.PEMASUKAN || [])];
         const words = low.replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
         for (const c of pool) {
             const cw = String(c).toLowerCase().split(/\s+/).filter(w => w.length >= 3);
             if (cw.some(w => words.includes(w) || low.includes(' ' + w))) { category = c; break; }
         }
         let desc = String(cmd).replace(/(\d[\d\.,]*\s*(miliar|milyar|juta|jt|ribu|rb|k|m)?)/i, ' ').replace(/\s+/g, ' ').trim();
         const unk = [];
         if (!type) unk.push('type');
         if (!entity) unk.push('entity');
         if (!amount) unk.push('amount');
         if (!category) unk.push('category');
         return { type, entity, amount, category, description: desc || String(cmd).slice(0, 120), unknown: unk, _local: true };
     }

     function nudgeEl(id) {
         const el = document.getElementById(id);
         if (!el) return;
         try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
         el.classList.remove('field-nudge');
         void el.offsetWidth;
         el.classList.add('field-nudge');
         setTimeout(() => el.classList.remove('field-nudge'), 2800);
     }

     async function processAiInput() {
         if (aiBusy) return;
         const btn = document.getElementById('ai-submit-btn');
         const old = btn ? btn.innerHTML : '';
         const setBusy = (b) => {
             aiBusy = b;
             if (btn) {
                 btn.disabled = b;
                 btn.innerHTML = b ? 'Memproses...' : old;
             }
         };
         try {
             let result = null;
             let localNote = false;
             if (aiMode === 'photo') {
                 if (!aiPhotoDataUrl) { showToast('Pilih foto struk dulu.', 'warning'); return; }
                 setBusy(true);
                 const b64 = aiPhotoDataUrl.split(',')[1] || '';
                 result = await callGemini([
                     { text: buildAiPrompt() + '\n\nAnalisis foto struk ini.' },
                     { inline_data: { mime_type: 'image/jpeg', data: b64 } }
                 ], 600);
             } else {
                 const cmd = document.getElementById('ai-input').value.trim();
                 if (!cmd) { showToast('Tulis atau bicarakan perintah dulu.', 'warning'); return; }
                 setBusy(true);
                 try {
                     result = await callGemini([{ text: buildAiPrompt() + '\n\nPerintah: ' + cmd }], 300);
                 } catch (e) {
                     if (e && (e.code === 'NO_KEY' || e.code === 'NETWORK')) {
                         result = { items: parseLocalMulti(cmd) };
                         localNote = true;
                     } else throw e;
                 }
             }
             if (localNote) showToast('AI tidak tersedia, dipakai parser lokal.', 'info');
             const items = normalizeAiResult(result);
             if (items.length > 1) openAiReview(items);
             else if (!isAiRecognized(items[0])) {
                 aiFailHome(aiMode === 'photo'
                     ? 'Foto tidak terbaca sebagai struk. Coba foto lebih jelas dan tegak.'
                     : 'Tidak dikenali sebagai catatan keuangan. Coba sebutkan barang/jasa dan nominalnya, mis. "bayar sewa 10k".', 'warning');
             }
             else applyAiResult(items[0]);
         } catch (e) {
             aiFailHome((e && e.message) || 'Gagal memproses AI.', 'error');
         } finally {
             setBusy(false);
         }
     }

     function normalizeAiResult(r) {
         let arr = [];
         if (Array.isArray(r)) arr = r;
         else if (r && Array.isArray(r.items)) arr = r.items;
         else if (r && typeof r === 'object') arr = [r];
         return arr.filter(x => x && typeof x === 'object');
     }

     function aiFailHome(msg, type) {
         closeModal('modal-ai');
         const inp = document.getElementById('ai-input');
         if (inp) inp.value = '';
         aiPhotoDataUrl = null;
         const prev = document.getElementById('ai-photo-preview');
         if (prev) { prev.src = ''; prev.classList.add('hidden'); }
         switchTab('tab-dashboard');
         showToast(msg, type || 'warning');
     }

     function isAiRecognized(it) {
         if (!it || typeof it !== 'object') return false;
         if (Number(it.amount) > 0) return true;
         if (it.type === 'PEMASUKAN' || it.type === 'PENGELUARAN') return true;
         if (it.entity === 'USAHA' || it.entity === 'PRIBADI') return true;
         const cats = [...(state.categories.PEMASUKAN || []), ...(state.categories.PENGELUARAN || [])];
         if (it.category && cats.includes(it.category)) return true;
         return false;
     }

     function parseLocalMulti(cmd) {
         return String(cmd).split(/[,;\n]+/).map(p => p.trim()).filter(Boolean)
             .map(parseLocalCommand).filter(o => o && o.amount > 0);
     }

     function applyAiResult(r) {
         const unk = Array.isArray(r.unknown) ? r.unknown.slice() : [];
         ['type', 'entity', 'amount', 'category'].forEach(f => {
             if (r[f] == null && !unk.includes(f)) unk.push(f);
         });
         let amount = Number(r.amount) || 0;
         if (!(amount > 0) || amount > 1000000000000) {
             amount = null;
             if (!unk.includes('amount')) unk.push('amount');
         }
         const type = (r.type === 'PEMASUKAN' || r.type === 'PENGELUARAN') ? r.type : null;
         const entity = (r.entity === 'USAHA' || r.entity === 'PRIBADI') ? r.entity : null;
         closeModal('modal-ai');
         openWallet(entity || activeWallet);
          try { window.__dompetkuTxSource = (typeof aiMode !== 'undefined' && aiMode === 'photo') ? 'nota' : 'ai'; } catch (e) {}
         if (type) {
             document.querySelectorAll('input[name="tx-type"]').forEach(el => { el.checked = (el.value === type); });
             updateCategories();
         }
         if (amount != null) {
             document.getElementById('tx-amount').value = amount.toLocaleString('id-ID');
         }
         let catOk = false;
         if (r.category && type && (state.categories[type] || []).includes(r.category)) {
             document.getElementById('tx-category').value = r.category;
             selectCategory(r.category);
             catOk = true;
         }
         document.getElementById('tx-description').value = String(r.description || '').slice(0, 120);
         document.getElementById('tx-datetime').value = getLocalDateTimeInputValue();
         toggleTransactionSubmit();
         const need = [];
         if (unk.includes('type') || unk.includes('entity')) { nudgeTxType(); need.push('tipe/entitas'); }
         if (unk.includes('category') && state.categoriesEnabled && !catOk) { nudgeEl('tx-category-wrap'); need.push('kategori'); }
         if (unk.includes('amount')) {
             need.push('nominal');
             setTimeout(() => document.getElementById('tx-amount').focus(), 300);
         }
         showToast(need.length ? ('Periksa form, lengkapi: ' + need.join(', ') + '.') : 'Form terisi. Periksa lalu simpan.', need.length ? 'warning' : 'success');
     }

     let aiPendingItems = [];

     function openAiReview(items) {
         aiPendingItems = (items || []).map((x) => ({
             type: (x.type === 'PEMASUKAN' || x.type === 'PENGELUARAN') ? x.type : null,
             entity: (x.entity === 'USAHA' || x.entity === 'PRIBADI') ? x.entity : null,
             amount: (Number(x.amount) > 0 && Number(x.amount) <= 1000000000000) ? Math.round(Number(x.amount)) : null,
             category: String(x.category || 'Umum').slice(0, 50),
             description: String(x.description || '').slice(0, 120)
         })).filter(x => x.amount != null);
         if (!aiPendingItems.length) {
             showToast('Tidak ada nominal yang bisa dibaca.', 'warning');
             return;
         }
         document.getElementById('ai-text-pane').classList.add('hidden');
         document.getElementById('ai-photo-pane').classList.add('hidden');
         document.getElementById('ai-submit-btn').classList.add('hidden');
         document.getElementById('ai-review-pane').classList.remove('hidden');
         aiEditing = aiPendingItems.findIndex(it => !it.type || !it.entity);
         renderAiReview();
     }

     function aiBackToInput() {
         aiEditing = -1;
         document.getElementById('ai-review-pane').classList.add('hidden');
         document.getElementById('ai-submit-btn').classList.remove('hidden');
         setAiMode(aiMode);
     }

     let aiEditing = -1;

     function renderAiReview() {
         const box = document.getElementById('ai-review-list');
         const total = aiPendingItems.reduce((a, b) => a + (Number(b.amount) || 0), 0);
         const typeLabel = (t) => t === 'PEMASUKAN' ? 'Masuk' : (t === 'PENGELUARAN' ? 'Keluar' : 'Pilih...');
         const entLabel = (e) => e === 'USAHA' ? 'Usaha' : (e === 'PRIBADI' ? 'Pribadi' : 'Pilih...');
         box.innerHTML = aiPendingItems.map((it, i) => {
             if (aiEditing === i) return aiEditRowHTML(it, i);
             const miss = !it.type || !it.entity;
             return `<div class="p-2.5 rounded-xl border-2 space-y-1 ${miss ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 bg-slate-50'}">`
                 + `<div class="flex items-start justify-between gap-2">`
                 + `<span class="text-xs font-bold text-slate-800 leading-snug">${escapeHtml(it.description) || '(tanpa catatan)'}`
                 + ` <button type="button" onclick="aiToggleEdit(${i})" title="Ubah" class="text-slate-400 hover:text-emerald-600 p-1"><i class="fa-solid fa-pen text-[10px]"></i></button></span>`
                 + `<span class="text-xs font-extrabold text-slate-900 whitespace-nowrap">${formatRp(it.amount)}</span>`
                 + `</div>`
                 + `<div class="flex flex-wrap items-center gap-1">`
                 + `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${it.type === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-800' : (it.type === 'PENGELUARAN' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}">${it.type ? typeLabel(it.type) : 'Pilih'}</span>`
                 + `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${it.entity === 'USAHA' ? 'bg-navy-900 text-white' : (it.entity === 'PRIBADI' ? 'bg-slate-500 text-white' : 'bg-amber-100 text-amber-800')}">${it.entity ? entLabel(it.entity) : 'Pilih'}</span>`
                 + `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${escapeHtml(it.category)}</span>`
                 + `</div>`
                 + `<div class="text-right"><button type="button" onclick="aiRemoveItem(${i})" class="text-[10px] text-rose-400 font-semibold">Hapus item ini</button></div>`
                 + `</div>`;
         }).join('');
         const foot = document.getElementById('ai-review-foot');
         if (foot) foot.innerHTML = `<div class="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">`
             + `<span>Total ${aiPendingItems.length} transaksi</span><span>${formatRp(total)}</span></div>`
             + `<div class="flex gap-2">`
             + `<button type="button" onclick="aiBackToInput()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs">Ulangi</button>`
             + `<button type="button" onclick="aiSaveAll()" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-sm">Simpan Semua</button>`
             + `</div>`;
     }

     function aiEditRowHTML(it, i) {
         const cats = state.categories[it.type] || state.categories.PENGELUARAN || [];
         const catOpts = ['Umum', ...cats.filter(c => c !== 'Umum')].map(c =>
             `<option value="${escapeHtml(c)}" ${it.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
         return `<div class="p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 space-y-2">`
             + `<input type="text" id="ai-e-desc-${i}" value="${escapeHtml(it.description)}" maxlength="120" class="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500">`
             + `<div class="grid grid-cols-2 gap-1.5">`
             + `<input type="text" id="ai-e-amt-${i}" value="${Number(it.amount) || ''}" inputmode="numeric" placeholder="Nominal" class="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500">`
             + `<select id="ai-e-cat-${i}" class="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-emerald-500">${catOpts}</select>`
             + `</div>`
             + `<div class="grid grid-cols-2 gap-1.5">`
             + `<select id="ai-e-type-${i}" onchange="aiEditType(${i})" class="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-emerald-500">`
             + `<option value="PENGELUARAN" ${it.type !== 'PEMASUKAN' ? 'selected' : ''}>Keluar</option>`
             + `<option value="PEMASUKAN" ${it.type === 'PEMASUKAN' ? 'selected' : ''}>Masuk</option>`
             + `</select>`
             + `<select id="ai-e-ent-${i}" class="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-emerald-500">`
             + `<option value="USAHA" ${it.entity !== 'PRIBADI' ? 'selected' : ''}>Usaha</option>`
             + `<option value="PRIBADI" ${it.entity === 'PRIBADI' ? 'selected' : ''}>Pribadi</option>`
             + `</select>`
             + `</div>`
             + `<button type="button" onclick="aiToggleEdit(${i})" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"><i class="fa-solid fa-check"></i> Selesai Ubah</button>`
             + `</div>`;
     }

     function aiToggleEdit(i) {
         if (aiEditing === i) {
             const it = aiPendingItems[i];
             if (!it) { aiEditing = -1; renderAiReview(); return; }
             const desc = document.getElementById('ai-e-desc-' + i);
             const amt = document.getElementById('ai-e-amt-' + i);
             const typ = document.getElementById('ai-e-type-' + i);
             const ent = document.getElementById('ai-e-ent-' + i);
             const cat = document.getElementById('ai-e-cat-' + i);
             const amount = Number(String(amt ? amt.value : '').replace(/\./g, '').replace(/,/g, '')) || 0;
             if (!(amount > 0) || amount > 1000000000000) {
                 showToast('Nominal item ke-' + (i + 1) + ' tidak valid.', 'warning');
                 return;
             }
             it.description = String(desc ? desc.value : '').trim().slice(0, 120);
             it.amount = Math.round(amount);
             it.type = typ ? typ.value : it.type;
             it.entity = ent ? ent.value : it.entity;
             const cats = state.categories[it.type] || [];
             it.category = (cat && cats.includes(cat.value)) ? cat.value : 'Umum';
             aiEditing = -1;
         } else {
             aiEditing = i;
         }
         renderAiReview();
     }

     function aiEditType(i) {
         const typ = document.getElementById('ai-e-type-' + i);
         const cat = document.getElementById('ai-e-cat-' + i);
         if (!typ || !cat || !aiPendingItems[i]) return;
         aiPendingItems[i].type = typ.value;
         const cats = state.categories[typ.value] || [];
         cat.innerHTML = ['Umum', ...cats.filter(c => c !== 'Umum')].map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
     }

     function aiRemoveItem(i) {
         aiPendingItems.splice(i, 1);
         if (!aiPendingItems.length) { aiBackToInput(); return; }
         renderAiReview();
     }

     function aiSaveAll() {
         const bad = aiPendingItems.findIndex(it => !it.type || !it.entity || !(it.amount > 0));
         if (bad !== -1) {
             showToast('Item ke-' + (bad + 1) + ' belum lengkap. Pilih tipe & entitasnya.', 'warning');
             renderAiReview();
             return;
         }
         const now = getLocalDateTimeInputValue();
         aiPendingItems.forEach(it => {
             state.transactions.unshift({
                 id: generateId(),
                 type: it.type,
                 entity: it.entity,
                 amount: it.amount,
                 category: (state.categories[it.type] || []).includes(it.category) ? it.category : 'Umum',
                 date: now,
                 paymentMethod: 'Tunai',
                 description: it.description || it.category
             });
         });
         const n = aiPendingItems.length;
         aiPendingItems = [];
         aiEditing = -1;
         saveAppData();
         refreshUI();
         closeModal('modal-ai');
         aiBackToInput();
         showToast(n + ' transaksi tersimpan.', 'success');
          try {
              var _src = (typeof aiMode !== 'undefined' && aiMode === 'photo') ? 'nota' : 'ai';
              if (window.DompetkuTelemetry) window.DompetkuTelemetry.log('tx_saved', { source: _src, amount: 0, tx_count: n });
              window.__dompetkuTxSource = '';
          } catch (e) {}
     }

     // --- PANDUAN TUR APLIKASI (GUIDED TOUR, spotlight 4 sisi) ---
     const GUIDE_STEPS = [
         { tab: 'tab-dashboard', sel: null, title: 'Selamat Datang di DompetKu',
           desc: 'Catat keuangan usaha dan pribadi dalam dua kantong terpisah. Ikuti tur singkat 8 langkah untuk mengenal aplikasi.' },
         { tab: 'tab-dashboard', sel: '#btn-wallet-usaha', title: 'Kantong Usaha',
           desc: 'Klik kartu hijau ini untuk mencatat pemasukan atau pengeluaran usaha, sekaligus melihat riwayatnya.' },
         { tab: 'tab-dashboard', sel: '#btn-wallet-pribadi', title: 'Kantong Pribadi',
           desc: 'Kartu gelap ini khusus uang pribadi. Memisahkan keduanya membuat laba usaha terlihat jelas.' },
         { tab: 'tab-dashboard', sel: '#btn-transfer-home', title: 'Transfer Saldo',
           desc: 'Pindahkan uang antar kantong: Suntik Modal (pribadi ke usaha) atau Penarikan Prive (usaha ke pribadi).' },
         { tab: 'tab-dashboard', sel: '#ai-fab', title: 'Catat Cepat dengan AI',
           desc: 'Ketuk tombol AI melayang untuk mencatat via ketikan, suara, foto struk, atau telepon AI. Semua otomatis terisi!' },
         { tab: 'tab-transaksi', sel: '#nav-tab-transaksi', title: 'Riwayat Transaksi',
           desc: 'Semua catatan ada di sini. Pakai kolom cari dan filter entitas atau arus kas. Ikon pensil untuk mengedit.' },
         { tab: 'tab-laporan', sel: '#period-btn-bulanan', title: 'Laporan & Grafik',
           desc: 'Pilih periode Harian, Bulanan, atau Semua. Lihat laba bersih, status prive, grafik, lalu unduh CSV atau cetak PDF.' },
         { tab: 'tab-pengaturan', sel: '#btn-gdrive-connect', title: 'Pencadangan Otomatis',
           desc: 'Hubungkan akun Google agar data tercadangkan ke Drive sesuai jadwal. Data aman meski ganti HP.' }
     ];
     let guideIdx = -1;
     let guideReturnTab = 'tab-dashboard';
     let guideScrollHooked = false;

     function startGuideTour(force) {
         if (!force && state.tourSeen) return;
         const nudge = document.getElementById('modal-gdrive-nudge');
         if (nudge) nudge.classList.add('hidden');
         try { if (typeof stopLiveCall === 'function') stopLiveCall('Tour dimulai.'); } catch (e) {}
         const views = ['dashboard', 'transaksi', 'laporan', 'pengaturan'];
         for (const v of views) {
             const el = document.getElementById('view-' + v);
             if (el && !el.classList.contains('hidden')) { guideReturnTab = 'tab-' + v; break; }
         }
         if (!guideScrollHooked) {
             guideScrollHooked = true;
             const vp = document.getElementById('main-viewport');
             if (vp) vp.addEventListener('scroll', () => { if (guideIdx >= 0) requestAnimationFrame(layoutGuide); }, { passive: true });
             window.addEventListener('resize', () => { if (guideIdx >= 0) layoutGuide(); });
         }
         guideIdx = 0;
         renderGuideStep();
     }

     function guideTargetEl() {
         const step = GUIDE_STEPS[guideIdx];
         if (!step || !step.sel) return null;
         return document.querySelector(step.sel);
     }

     function layoutGuide() {
         if (guideIdx < 0) return;
         const shell = document.getElementById('app-shell');
         const ov = document.getElementById('guide-overlay');
         if (!shell || !ov || ov.classList.contains('hidden')) return;
         const full = document.getElementById('guide-dim-full');
         const dt = document.getElementById('guide-dim-t');
         const db = document.getElementById('guide-dim-b');
         const dl = document.getElementById('guide-dim-l');
         const dr = document.getElementById('guide-dim-r');
         const ring = document.getElementById('guide-ring');
         const wrap = document.getElementById('guide-card-wrap');
         const el = guideTargetEl();
         const W = shell.clientWidth, H = shell.clientHeight;
         if (!el) {
             full.classList.remove('hidden');
             [dt, db, dl, dr, ring].forEach(x => x && x.classList.add('hidden'));
             if (wrap) { wrap.style.top = ''; wrap.style.bottom = '12px'; }
             return;
         }
         const r = el.getBoundingClientRect();
         const s = shell.getBoundingClientRect();
         const pad = 6;
         let top = Math.max(0, r.top - s.top - pad);
         let left = Math.max(0, r.left - s.left - pad);
         let bottom = Math.min(H, r.bottom - s.top + pad);
         let right = Math.min(W, r.right - s.left + pad);
         if (right <= left || bottom <= top) return;
         full.classList.add('hidden');
         const px = (v) => Math.round(v) + 'px';
         dt.classList.remove('hidden');
         dt.style.top = '0'; dt.style.left = '0'; dt.style.right = '0'; dt.style.height = px(top);
         db.classList.remove('hidden');
         db.style.top = px(bottom); db.style.left = '0'; db.style.right = '0'; db.style.bottom = '0';
         dl.classList.remove('hidden');
         dl.style.top = px(top); dl.style.left = '0'; dl.style.width = px(left); dl.style.bottom = px(H - bottom);
         dr.classList.remove('hidden');
         dr.style.top = px(top); dr.style.right = '0'; dr.style.width = px(W - right); dr.style.bottom = px(H - bottom);
         if (ring) {
             ring.classList.remove('hidden');
             ring.style.top = px(top); ring.style.left = px(left);
             ring.style.width = px(right - left); ring.style.height = px(bottom - top);
         }
         if (wrap) {
             if (bottom > H * 0.60) { wrap.style.bottom = ''; wrap.style.top = '12px'; }
             else { wrap.style.top = ''; wrap.style.bottom = '12px'; }
         }
     }

     function renderGuideStep() {
         const step = GUIDE_STEPS[guideIdx];
         if (!step) { finishGuideTour(); return; }
         if (step.tab) switchTab(step.tab);
         ['modal-ai', 'modal-live'].forEach(id => {
             const m = document.getElementById(id);
             if (m) m.classList.add('hidden');
         });
         // Tour tidak pernah membuka popup agar spotlight tidak kalah z-index.
         const ov = document.getElementById('guide-overlay');
         if (ov) ov.classList.remove('hidden');
         const el = guideTargetEl();
         if (el) {
             try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
         }
         const dots = GUIDE_STEPS.map((_, i) =>
             `<span class="h-1.5 rounded-full transition-all ${i === guideIdx ? 'w-5 bg-emerald-500' : (i < guideIdx ? 'w-1.5 bg-emerald-300' : 'w-1.5 bg-slate-200')}"></span>`
         ).join('');
         const isLast = guideIdx === GUIDE_STEPS.length - 1;
         const card = document.getElementById('guide-card-body');
         if (card) {
             card.innerHTML =
                 `<div class="flex items-center justify-between">`
                 + `<span class="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Langkah ${guideIdx + 1} dari ${GUIDE_STEPS.length}</span>`
                 + `<button onclick="skipGuideTour()" class="text-xs text-slate-400 hover:text-slate-600 font-bold">Lewati</button>`
                 + `</div>`
                 + `<h3 class="text-lg font-black text-slate-900 leading-snug">${step.title}</h3>`
                 + `<p class="text-sm font-medium text-slate-700 leading-relaxed">${step.desc}</p>`
                 + `<div class="flex items-center gap-1 pt-0.5">${dots}</div>`
                 + `<div class="flex gap-2 pt-1">`
                 + (guideIdx > 0 ? `<button onclick="guideBackStep()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-sm">Kembali</button>` : ``)
                 + `<button id="guide-next-btn" onclick="guideNextStep()" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-xl text-sm shadow-sm">${isLast ? 'Selesai, Mengerti!' : 'Lanjut'}</button>`
                 + `</div>`;
         }
         requestAnimationFrame(layoutGuide);
         setTimeout(layoutGuide, 450);
     }

     function guideNextStep() {
         if (guideIdx >= GUIDE_STEPS.length - 1) { finishGuideTour(); return; }
         guideIdx++;
         renderGuideStep();
     }

     function guideBackStep() {
         if (guideIdx > 0) { guideIdx--; renderGuideStep(); }
     }

     function skipGuideTour() { finishGuideTour(); }

     function finishGuideTour() {
         guideIdx = -1;
         ['modal-ai', 'modal-live'].forEach(id => {
             const m = document.getElementById(id);
             if (m) m.classList.add('hidden');
         });
         const ov = document.getElementById('guide-overlay');
         if (ov) ov.classList.add('hidden');
         if (!state.tourSeen) {
             state.tourSeen = true;
             saveAppData();
         }
         switchTab(guideReturnTab);
     }

     let activeWallet = 'USAHA';

     function openWallet(entity) {
         activeWallet = entity;
         const modal = document.getElementById('modal-transaction');
         modal.querySelector('form').reset();
         resetTxPhotoUI();
         document.getElementById('tx-entity').value = entity;
         document.getElementById('tx-datetime').value = getLocalDateTimeInputValue();

         editingTransactionId = null;
         const submitBtn0 = document.getElementById('tx-submit-btn');
         if (submitBtn0) submitBtn0.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Transaksi';
         document.querySelectorAll('input[name="tx-type"]').forEach(el => el.checked = false);
         toggleTransactionSubmit();

         const isUsaha = entity === 'USAHA';
         const header = document.getElementById('wallet-modal-header');
         header.className = `sticky top-0 z-10 p-4 rounded-t-3xl sm:rounded-t-2xl text-white bg-gradient-to-br ${isUsaha ? 'from-emerald-600 to-emerald-800' : 'from-navy-800 to-navy-900'}`;
         document.getElementById('wallet-modal-title').innerText = isUsaha ? 'Saldo Usaha' : 'Saldo Pribadi';
         const { saldoUsaha, saldoPribadi } = computeBalances();
         document.getElementById('wallet-modal-balance').innerText = formatRp(isUsaha ? saldoUsaha : saldoPribadi);

         updateCategories();
         modal.classList.remove('hidden');
         setTimeout(() => document.getElementById('tx-amount').focus(), 120);
     }

     function addTransferQuick(val) {
         const input = document.getElementById('transfer-amount');
         const currentRaw = input.value.replace(/\./g, '');
         const current = currentRaw === '' ? 0 : parseInt(currentRaw);
         let result = val === 0 ? 0 : current + val;
         if (result > 1000000000000) { showToast('Nominal maksimal Rp 1 triliun.', 'warning'); result = 1000000000000; }
         input.value = result === 0 ? '' : result.toLocaleString('id-ID');
         toggleTransferSubmit();
         updateTransferPreview();
     }

     function updateTransferPreview() {
         const box = document.getElementById('transfer-preview');
         if (!box) return;
         const type = document.getElementById('transfer-type').value;
         const amount = Number((document.getElementById('transfer-amount').value || '').replace(/\./g, '')) || 0;
         const bal = computeBalances();
         if (!type || !(amount > 0)) {
             box.innerHTML = 'Pilih arah &amp; nominal untuk melihat pratinjau saldo sesudah transfer.';
             return;
         }
         const isSuntik = type === 'SUNTIK_MODAL';
         const pAfter = isSuntik ? bal.saldoPribadi - amount : bal.saldoPribadi + amount;
         const uAfter = isSuntik ? bal.saldoUsaha + amount : bal.saldoUsaha - amount;
         const neg = (v) => v < 0 ? 'text-rose-600' : 'text-emerald-600';
         box.innerHTML = '<span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Pratinjau sesudah transfer</span>'
             + '<span class="flex items-center justify-between gap-2"><span>Pribadi</span>'
             + '<span class="font-bold text-slate-700">' + formatRp(bal.saldoPribadi) + ' &rarr; <b class="' + neg(pAfter) + '">' + formatRp(pAfter) + '</b></span></span>'
             + '<span class="flex items-center justify-between gap-2"><span>Usaha</span>'
             + '<span class="font-bold text-slate-700">' + formatRp(bal.saldoUsaha) + ' &rarr; <b class="' + neg(uAfter) + '">' + formatRp(uAfter) + '</b></span></span>'
             + ((pAfter < 0 || uAfter < 0) ? '<span class="block mt-1 font-semibold text-rose-600">Perhatian: salah satu saldo akan minus.</span>' : '');
     }

     function refreshTransferHeader() {
         const bal = computeBalances();
         const hp = document.getElementById('transfer-head-pribadi');
         const hu = document.getElementById('transfer-head-usaha');
         if (hp) { hp.innerText = formatRp(bal.saldoPribadi); hp.style.color = bal.saldoPribadi < 0 ? '#fda4af' : '#fff'; }
         if (hu) { hu.innerText = formatRp(bal.saldoUsaha); hu.style.color = bal.saldoUsaha < 0 ? '#fda4af' : '#fff'; }
     }

     function addQuickAmount(val) {
         const input = document.getElementById('tx-amount');
         const currentRaw = input.value.replace(/\./g, '');
         const current = currentRaw === '' ? 0 : parseInt(currentRaw);
         let result = val === 0 ? 0 : current + val;
         if (result > 1000000000000) { showToast('Nominal maksimal Rp 1 triliun.', 'warning'); result = 1000000000000; }
         input.value = result === 0 ? '' : result.toLocaleString('id-ID');
         toggleTransactionSubmit();
     }

     function openModal(id) {
         if (id === 'modal-transaction') {
             openWallet(activeWallet);
             return;
         } else if (id === 'modal-transfer') {
             document.querySelector('#modal-transfer form').reset();
             document.getElementById('transfer-datetime').value = getLocalDateTimeInputValue();
             document.getElementById('transfer-amount').value = '';
             document.getElementById('transfer-note').value = '';
             document.querySelectorAll('input[name="transfer-type-radio"]').forEach(el => el.checked = false);
             toggleTransferSubmit();
             refreshTransferHeader();
             updateTransferPreview();
         }
         document.getElementById(id).classList.remove('hidden');
     }

     function closeModal(id) {
         document.getElementById(id).classList.add('hidden');
         if (id === 'modal-transaction') { editingTransactionId = null; }
     }

     function switchTab(tabId) {
         if (tabId !== 'tab-pengaturan' && pendingLogoBase64) {
             pendingLogoBase64 = null;
             const lf = document.getElementById('input-logo-file');
             if (lf) lf.value = '';
             const li = document.getElementById('header-logo-img');
             const ic = document.getElementById('header-logo-icon');
             if (li) { li.src = getDisplayLogo(state.logoBase64); li.classList.remove('hidden'); } if (ic) ic.classList.add('hidden');
         }
         ['dashboard', 'transaksi', 'laporan', 'pengaturan'].forEach(t => {
             const view = document.getElementById(`view-${t}`);
             if (view) view.classList.toggle('hidden', `tab-${t}` !== tabId);
             const navBtn = document.getElementById(`nav-tab-${t}`);
             if (navBtn) {
                 navBtn.className = `tab-${t}` === tabId ?
                     "flex flex-col items-center gap-1 text-emerald-600 font-bold transition-all py-1 px-3" :
                     "flex flex-col items-center gap-1 text-slate-500 hover:text-slate-700 font-medium transition-all py-1 px-3";
             }
         });

         const fab = document.getElementById('ai-fab');
         if (fab) fab.classList.toggle('hidden', tabId !== 'tab-dashboard');
         if (tabId === 'tab-laporan') updateReports();
         if (tabId === 'tab-pengaturan') {
             pendingLogoBase64 = null;
             document.getElementById('input-business-name').value = state.businessName;
             renderCategoryManagement();
         }
     }

     function toggleCategoriesEnabled(enabled) {
         state.categoriesEnabled = !!enabled;
         saveAppData();
         renderCategoryManagement();
         updateCategories();
         showToast(enabled ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan.', 'info');
     }

     function updateCategories() {
         const wrap = document.getElementById('tx-category-wrap');
         if (wrap) wrap.classList.toggle('hidden', !state.categoriesEnabled);
         if (!state.categoriesEnabled) {
             document.getElementById('tx-category').innerHTML = '<option value="Umum">Umum</option>';
             document.getElementById('tx-category').value = 'Umum';
             return;
         }
         const selectedRadio = document.querySelector('input[name="tx-type"]:checked');
         const type = selectedRadio ? selectedRadio.value : 'PEMASUKAN';
         const catSelect = document.getElementById('tx-category');
         const cats = state.categories[type] || [];
         if (!cats.length) { catSelect.innerHTML = '<option value="Umum">Umum</option>'; catSelect.value = 'Umum'; const _ch = document.getElementById('tx-category-chips'); if (_ch) _ch.innerHTML = ''; return; }
         catSelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
         const chips = document.getElementById('tx-category-chips');
         if (chips) {
             chips.innerHTML = cats.map((c, i) => `<button type="button" data-idx="${i}" onclick="selectCategoryByIndex(${i})" class="cat-chip text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all ${i === 0 ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-600 border-slate-200'}">${escapeHtml(c)}</button>`).join('')
                 || `<p class="text-[11px] text-slate-400">Belum ada kategori. Tambahkan di Pengaturan.</p>`;
             if (cats.length) catSelect.value = cats[0];
         }
     }

     function selectCategoryByIndex(idx) {
         const selectedRadio = document.querySelector('input[name="tx-type"]:checked');
         const type = selectedRadio ? selectedRadio.value : 'PEMASUKAN';
         const cats = state.categories[type] || [];
         if (cats[idx] !== undefined) selectCategory(cats[idx]);
     }
     function selectCategory(cat) {
         document.getElementById('tx-category').value = cat;
         document.querySelectorAll('#tx-category-chips .cat-chip').forEach(btn => {
             const active = (btn.getAttribute('data-cat') === cat) || (btn.textContent === cat) || (Number(btn.getAttribute('data-idx')) >= 0 && document.getElementById('tx-category').options[Number(btn.getAttribute('data-idx'))]?.value === cat);
             btn.className = `cat-chip text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all ${active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`;
         });
     }

     function renderCategoryManagement() {
         const toggle = document.getElementById('toggle-categories-enabled');
         if (toggle) toggle.checked = state.categoriesEnabled;
         const body = document.getElementById('category-manage-body');
         if (body) body.classList.toggle('hidden', !state.categoriesEnabled);
         const container = document.getElementById('category-list-container');
         const selectedRadio = document.querySelector('input[name="cat-type-radio"]:checked');
         const type = selectedRadio ? selectedRadio.value : 'PEMASUKAN';
         const list = state.categories[type] || [];

         container.innerHTML = list.map((cat, idx) => `
             <div class="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                 <span class="text-slate-700 font-medium">${escapeHtml(cat)}</span>
                 <button type="button" onclick="deleteCategory('${type}', ${idx})" class="text-rose-500 hover:text-rose-700 text-xs px-2.5 py-1.5">
                     <i class="fa-solid fa-trash-can"></i>
                 </button>
             </div>
         `).join('');
     }

     function addNewCategory() {
         const selectedRadio = document.querySelector('input[name="cat-type-radio"]:checked');
         const input = document.getElementById('input-new-category');
         const type = selectedRadio ? selectedRadio.value : 'PEMASUKAN';
         const val = input.value.trim().slice(0, 30);
         if (!val) { showToast('Nama kategori tidak boleh kosong.', 'warning'); return; }
         if (!state.categories[type]) state.categories[type] = [];
         if (state.categories[type].some(c => String(c).toLowerCase() === val.toLowerCase())) { showToast('Kategori sudah ada.', 'warning'); return; }
         if (state.categories[type].length >= 50) { showToast('Maksimal 50 kategori.', 'warning'); return; }
         if (true) {
             state.categories[type].push(val);
             input.value = '';
             saveAppData();
             renderCategoryManagement();
             updateCategories();
             showToast('Kategori ditambahkan!', 'success');
         }
     }

     function deleteCategory(type, index) {
         if (!state.categories[type]) return;
         { const _cn = state.categories[type][index] || ''; showConfirmModal('Hapus Kategori', 'Hapus kategori "' + _cn + '"? Transaksi lama tetap memakai nama lama.', (() => { const _t = type, _i = index; return () => { state.categories[_t].splice(_i, 1); saveAppData(); renderCategoryManagement(); updateCategories(); }; })()); return; } // patched
     }

     function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!String(file.type || '').startsWith('image/')) { showToast('File harus gambar.', 'warning'); e.target.value=''; return; }
        if (file.size > 5 * 1024 * 1024) { showToast('Ukuran logo maksimal 5MB.', 'warning'); e.target.value=''; return; }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                const maxSide = 512;
                let w = img.width || maxSide, h = img.height || maxSide;
                const scale = Math.min(1, maxSide / Math.max(w, h));
                w = Math.round(w * scale); h = Math.round(h * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                (() => { const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); })();
                pendingLogoBase64 = canvas.toDataURL('image/jpeg', 0.82);
                const logoImg = document.getElementById('header-logo-img');
                const logoIcon = document.getElementById('header-logo-icon');
                if (logoImg && pendingLogoBase64) {
                    logoImg.src = pendingLogoBase64;
                    logoImg.classList.remove('hidden');
                    if (logoIcon) logoIcon.classList.add('hidden');
                }
                showToast('Logo siap. Klik Simpan untuk menerapkan.', 'info');
            };
            img.onerror = () => showToast('Gagal membaca gambar.', 'error');
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
    function removeLogo() {
        pendingLogoBase64 = '__REMOVE__';
        const logoImg = document.getElementById('header-logo-img');
        const logoIcon = document.getElementById('header-logo-icon');
        if (logoImg) { logoImg.src = DEFAULT_WALLET_LOGO; logoImg.classList.remove('hidden'); }
        if (logoIcon) logoIcon.classList.add('hidden');
        const inp = document.getElementById('input-logo-file');
        if (inp) inp.value = '';
        showToast('Logo dikembalikan ke default DompetKu saat Anda klik Simpan.', 'info');
    }

     function renderHeaderLogo() {
         const logoImg = document.getElementById('header-logo-img');
         const logoIcon = document.getElementById('header-logo-icon');
         if (pendingLogoBase64 === '__REMOVE__') {
             if (logoImg) { logoImg.src = DEFAULT_WALLET_LOGO; logoImg.classList.remove('hidden'); }
             if (logoIcon) logoIcon.classList.add('hidden');
             return;
         }
         if (pendingLogoBase64) { const _li = document.getElementById('header-logo-img'); const _ic = document.getElementById('header-logo-icon'); if (_li) { _li.src = pendingLogoBase64; _li.classList.remove('hidden'); } if (_ic) _ic.classList.add('hidden'); return; }
         const displayLogo = getDisplayLogo(state.logoBase64);
         if (logoImg) {
             logoImg.src = displayLogo;
             logoImg.classList.remove('hidden');
         }
         if (logoIcon) logoIcon.classList.add('hidden');
     }

     function handleSaveTransaction(e) {
         e.preventDefault();

         const selectedType = document.querySelector('input[name="tx-type"]:checked');
         if (!selectedType) {
             nudgeTxType();
             return;
         }

         const amountRaw = document.getElementById('tx-amount').value.replace(/\./g, '');
         const amount = Number(amountRaw) || 0;

         if (amount <= 0) {
             showToast('Masukkan nominal yang valid!', 'warning');
             return;
         }
         if (amount > 1000000000000) {
             showToast('Nominal maksimal Rp 1 triliun per transaksi.', 'warning');
             return;
         }

         const desc = document.getElementById('tx-description').value.trim().slice(0, 120);
         const category = state.categoriesEnabled ? (document.getElementById('tx-category').value || 'Umum') : 'Umum';

         const newTx = {
             id: generateId(),
             type: selectedType.value,
             entity: document.getElementById('tx-entity').value,
             amount: amount,
             category: category,
             date: document.getElementById('tx-datetime').value,
             paymentMethod: document.getElementById('tx-payment-method').value,
             description: desc || category
         };

         if (pendingTxPhotoImg) {
             newTx.photo = {
                 img: pendingTxPhotoImg,
                 driveFileId: pendingTxPhotoDriveId,
                 driveFileName: '',
                 pending: !pendingTxPhotoDriveId,
                 updatedAt: new Date().toISOString()
             };
         }

         if (editingTransactionId) {
             const idx = state.transactions.findIndex(t => String(t.id) === String(editingTransactionId));
             if (idx !== -1) {
                 newTx.id = editingTransactionId;
                 state.transactions[idx] = newTx;
             } else {
                 state.transactions.unshift(newTx);
             }
             editingTransactionId = null;
         } else {
             state.transactions.unshift(newTx);
         }
         saveAppData();
         refreshUI();
         (function () {
             const delId = pendingTxPhotoDeleteId;
             const savedTx = newTx;
             pendingTxPhotoDeleteId = null;
             resetTxPhotoUI();
             if (delId) deleteDriveFile(delId);
             if (savedTx.photo && savedTx.photo.img && !savedTx.photo.driveFileId) {
                 uploadTxPhotoInteractive(savedTx).catch(() => {});
             }
         })();
         document.getElementById('tx-amount').value = '';
         document.getElementById('tx-description').value = '';
         document.querySelectorAll('input[name="tx-type"]').forEach(el => el.checked = false);
         document.getElementById('tx-datetime').value = getLocalDateTimeInputValue();

         toggleTransactionSubmit();

         const { saldoUsaha, saldoPribadi } = computeBalances();
         document.getElementById('wallet-modal-balance').innerText = formatRp(activeWallet === 'USAHA' ? saldoUsaha : saldoPribadi);

         const _wasEdit = document.getElementById('tx-submit-btn').innerHTML.includes('Update');
         closeModal('modal-transaction');
         editingTransactionId = null;
         document.querySelectorAll('input[name="tx-type"]').forEach(el => el.checked = false);
         updateCategories();
         showToast(_wasEdit ? 'Perubahan transaksi disimpan!' : 'Transaksi berhasil dicatat!', 'success');
          try {
              var _src2 = window.__dompetkuTxSource || '';
              if (!_src2) { _src2 = (typeof pendingTxPhotoImg !== 'undefined' && pendingTxPhotoImg) ? 'nota' : 'manual'; }
              if (window.DompetkuTelemetry && !_wasEdit) window.DompetkuTelemetry.logTx(_src2, { amount: (typeof amount !== 'undefined' ? amount : 0), tx_type: (selectedType && selectedType.value) || '', entity: document.getElementById('tx-entity').value });
              window.__dompetkuTxSource = '';
          } catch (e) {}
     }

     function nudgeTransferType() {
         const group = document.getElementById('transfer-type-group');
         if (group) {
             try { group.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
             group.classList.remove('field-nudge');
             void group.offsetWidth;
             group.classList.add('field-nudge');
             setTimeout(() => group.classList.remove('field-nudge'), 2800);
         }
         showToast('Pilih dulu arah transfer: Suntik Modal atau Penarikan Prive.', 'warning');
     }

     function handleSaveTransfer(e) {
         e.preventDefault();
         const type = document.getElementById('transfer-type').value;
         const amountEl = document.getElementById('transfer-amount');
         const amountRaw = (amountEl ? amountEl.value : '').replace(/\./g, '');
         const amount = Number(amountRaw) || 0;
         if (!type) {
             if (!(amount > 0)) {
                 if (amountEl) amountEl.focus();
                 showToast('Masukkan nominal transfer dulu.', 'warning');
             } else {
                 nudgeTransferType();
             }
             return;
         }

         if (amount > 1000000000000) {
             showToast('Nominal maksimal Rp 1 triliun per transaksi.', 'warning');
             return;
         }
         const isSuntik = type === 'SUNTIK_MODAL';

         if (amount <= 0) {
             showToast('Masukkan nominal yang valid!', 'warning');
             return;
         }

         const newTx = {
             id: generateId(),
             type: 'TRANSFER',
             entity: isSuntik ? 'USAHA' : 'PRIBADI',
             amount: amount,
             category: isSuntik ? 'Suntik Modal' : 'Penarikan Prive',
             date: document.getElementById('transfer-datetime').value,
             paymentMethod: 'Transfer Bank',
             description: document.getElementById('transfer-note').value.trim().slice(0, 120) || (isSuntik ? 'Suntik Modal Usaha' : 'Penarikan Prive Pemilik')
         };

         state.transactions.unshift(newTx);
         saveAppData();
         closeModal('modal-transfer');
         refreshUI();
         showToast('Transfer berhasil!', 'success');
          try { if (window.DompetkuTelemetry) window.DompetkuTelemetry.logTx('transfer', { amount: (typeof amount !== 'undefined' ? amount : 0) }); } catch (e) {}

         document.querySelectorAll('input[name="transfer-type-radio"]').forEach(el => el.checked = false);
         document.getElementById('transfer-type').value = '';
         document.getElementById('transfer-amount').value = '';
         document.getElementById('transfer-note').value = '';
         toggleTransferSubmit();
     }

     function editTransaction(id) {
         const t = state.transactions.find(x => String(x.id) === String(id));
         if (!t) { showToast('Transaksi tidak ditemukan.', 'error'); return; }
         if (t.type === 'TRANSFER') { showToast('Transfer hanya bisa dihapus lalu buat ulang.', 'warning'); return; }
         activeWallet = t.entity || 'USAHA';
         editingTransactionId = t.id;
         const modal = document.getElementById('modal-transaction');
         document.getElementById('tx-entity').value = activeWallet;
         document.getElementById('tx-datetime').value = t.date || getLocalDateTimeInputValue();
         document.querySelectorAll('input[name="tx-type"]').forEach(el => el.checked = (el.value === t.type));
         document.getElementById('tx-amount').value = Number(t.amount || 0).toLocaleString('id-ID');
         document.getElementById('tx-description').value = t.description || '';
     if (t.photo && t.photo.img) {
         pendingTxPhotoImg = t.photo.img;
         pendingTxPhotoDriveId = t.photo.driveFileId || null;
         pendingTxPhotoDeleteId = null;
         const prev = document.getElementById('tx-photo-preview');
         if (prev) { prev.src = t.photo.img; prev.classList.remove('hidden'); }
         const rm = document.getElementById('tx-photo-remove');
         if (rm) rm.classList.remove('hidden');
     } else {
         resetTxPhotoUI();
     }
         const pm = document.getElementById('tx-payment-method');
         if (pm && t.paymentMethod) pm.value = t.paymentMethod;
         const isUsaha = activeWallet === 'USAHA';
         const header = document.getElementById('wallet-modal-header');
         header.className = `sticky top-0 z-10 p-4 rounded-t-3xl sm:rounded-t-2xl text-white bg-gradient-to-br ${isUsaha ? 'from-emerald-600 to-emerald-800' : 'from-navy-800 to-navy-900'}`;
         document.getElementById('wallet-modal-title').innerText = isUsaha ? 'Saldo Usaha' : 'Saldo Pribadi';
         const _b = computeBalances();
         document.getElementById('wallet-modal-balance').innerText = formatRp(isUsaha ? _b.saldoUsaha : _b.saldoPribadi);
         updateCategories();
         if (state.categoriesEnabled && t.category) {
             const sel = document.getElementById('tx-category');
             if ([...sel.options].some(o => o.value === t.category)) { sel.value = t.category; selectCategory(t.category); }
         }
         toggleTransactionSubmit();
         const sb = document.getElementById('tx-submit-btn');
         if (sb) sb.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update Transaksi';
         modal.classList.remove('hidden');
     }
     function deleteTransaction(id) {
         showConfirmModal('Hapus Catatan', 'Hapus catatan transaksi ini?', () => {
             const gone = state.transactions.find(t => String(t.id) === String(id));
             const goneFileId = (gone && gone.photo && gone.photo.driveFileId) || null;
             state.transactions = state.transactions.filter(t => String(t.id) !== String(id));
             saveAppData();
             refreshUI();
             if (goneFileId) deleteDriveFile(goneFileId);
         });
     }

     // --- BUKTI FOTO TRANSAKSI (kompres lokal + upload Google Drive) ---
     const TX_PHOTO_MAX_SIDE = 1000;
     const TX_PHOTO_QUALITY = 0.8;
     let pendingTxPhotoImg = null;
     let pendingTxPhotoDriveId = null;
     let pendingTxPhotoDeleteId = null;
     let uploadingPhotos = false;

     function compressImageFile(file, maxSide, quality) {
         return new Promise((resolve, reject) => {
             if (!file || !String(file.type || '').startsWith('image/')) return reject(new Error('not-image'));
             const rd = new FileReader();
             rd.onload = (evt) => {
                 const img = new Image();
                 img.onload = () => {
                     let w = img.width || maxSide, h = img.height || maxSide;
                     const sc = Math.min(1, maxSide / Math.max(w, h));
                     w = Math.max(1, Math.round(w * sc));
                     h = Math.max(1, Math.round(h * sc));
                     const cv = document.createElement('canvas');
                     cv.width = w; cv.height = h;
                     const cx = cv.getContext('2d');
                     cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h);
                     cx.drawImage(img, 0, 0, w, h);
                     resolve(cv.toDataURL('image/jpeg', quality));
                 };
                 img.onerror = () => reject(new Error('bad-img'));
                 img.src = evt.target.result;
             };
             rd.onerror = () => reject(new Error('read'));
             rd.readAsDataURL(file);
         });
     }

     function dataUrlToBytes(dataUrl) {
         try {
             const b64 = String(dataUrl).split(',')[1] || '';
             const bin = atob(b64);
             const out = new Uint8Array(bin.length);
             for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
             return out;
         } catch (e) { return new Uint8Array(0); }
     }

     async function handleTxPhoto(e) {
         const file = e.target.files ? e.target.files[0] : null;
         if (e.target) e.target.value = '';
         if (!file) return;
         try {
             showToast('Memproses foto...', 'info');
             const img = await compressImageFile(file, TX_PHOTO_MAX_SIDE, TX_PHOTO_QUALITY);
             pendingTxPhotoImg = img;
             if (pendingTxPhotoDriveId) pendingTxPhotoDeleteId = pendingTxPhotoDriveId;
             pendingTxPhotoDriveId = null;
             const prev = document.getElementById('tx-photo-preview');
             if (prev) { prev.src = img; prev.classList.remove('hidden'); }
             const rm = document.getElementById('tx-photo-remove');
             if (rm) rm.classList.remove('hidden');
         } catch (err) {
             showToast('Foto tidak valid.', 'error');
         }
     }

     function removeTxPhoto() {
         const prev = document.getElementById('tx-photo-preview');
         if (prev) { prev.src = ''; prev.classList.add('hidden'); }
         const rm = document.getElementById('tx-photo-remove');
         if (rm) rm.classList.add('hidden');
         if (pendingTxPhotoDriveId) pendingTxPhotoDeleteId = pendingTxPhotoDriveId;
         pendingTxPhotoImg = null;
         pendingTxPhotoDriveId = null;
     }

     function resetTxPhotoUI() {
         pendingTxPhotoImg = null;
         pendingTxPhotoDriveId = null;
         pendingTxPhotoDeleteId = null;
         const prev = document.getElementById('tx-photo-preview');
         if (prev) { prev.src = ''; prev.classList.add('hidden'); }
         const rm = document.getElementById('tx-photo-remove');
         if (rm) rm.classList.add('hidden');
     }

     function sanitizeImportedPhoto(p) {
         if (!p || typeof p !== 'object' || typeof p.img !== 'string') return null;
         if (!p.img.startsWith('data:image/') || p.img.length > 1500000) return null;
         return {
             img: p.img,
             driveFileId: (typeof p.driveFileId === 'string') ? p.driveFileId.slice(0, 120) : null,
             driveFileName: (typeof p.driveFileName === 'string') ? p.driveFileName.slice(0, 120) : '',
             pending: !p.driveFileId,
             updatedAt: (typeof p.updatedAt === 'string') ? p.updatedAt.slice(0, 30) : ''
         };
     }

     async function ensurePhotoFolder(allowInteractive) {
         if (state.gdrive.photoFolderId) return state.gdrive.photoFolderId;
         const q = "mimeType='application/vnd.google-apps.folder' and name='DompetKu' and trashed=false";
         const res = await gdriveFetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)&pageSize=1', null, false, allowInteractive);
         if (!res) return null;
         if (res.status === 403) return 'FORBIDDEN';
         if (res.ok) {
             let d = null;
             try { d = await res.json(); } catch (e) {}
             if (d && d.files && d.files[0] && d.files[0].id) {
                 state.gdrive.photoFolderId = d.files[0].id;
                 await saveGDriveMeta();
                 return state.gdrive.photoFolderId;
             }
         } else {
             return null;
         }
         const cr = await gdriveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: 'DompetKu', mimeType: 'application/vnd.google-apps.folder' })
         }, false, allowInteractive);
         if (!cr) return null;
         if (cr.status === 403) return 'FORBIDDEN';
         if (!cr.ok) return null;
         let cd = null;
         try { cd = await cr.json(); } catch (e) {}
         if (cd && cd.id) {
             state.gdrive.photoFolderId = cd.id;
             await saveGDriveMeta();
             return cd.id;
         }
         return null;
     }

     async function driveUploadResumable(meta, bytes, allowInteractive) {
         const init = await gdriveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json; charset=UTF-8' },
             body: JSON.stringify(meta)
         }, false, allowInteractive);
         if (!init) return { error: 'no-token' };
         if (init.status === 403) return { error: 'forbidden' };
         if (!init.ok) {
             let t = '';
             try { t = await init.text(); } catch (e) {}
             return { error: 'init:' + init.status + ' ' + String(t).slice(0, 120) };
         }
         const sessionUri = init.headers.get('location');
         if (!sessionUri) return { error: 'no-session' };
         let put = null;
         try {
             const heads = { 'Content-Type': 'image/jpeg', 'Content-Length': String(bytes.length) };
             if (state.gdrive.accessToken) heads['Authorization'] = 'Bearer ' + state.gdrive.accessToken;
             put = await fetch(sessionUri, { method: 'PUT', headers: heads, body: bytes });
         } catch (e) {
             return { error: 'network' };
         }
         if (put.status === 403) return { error: 'forbidden' };
         if (!put.ok) {
             let t = '';
             try { t = await put.text(); } catch (e) {}
             return { error: 'put:' + put.status + ' ' + String(t).slice(0, 120) };
         }
         try { return { file: await put.json() }; } catch (e) { return { error: 'bad-json' }; }
     }

     async function uploadTxPhoto(tx, allowInteractive) {
         if (!tx || !tx.photo || !tx.photo.img || tx.photo.driveFileId) return true;
         const folder = await ensurePhotoFolder(allowInteractive);
         if (folder === 'FORBIDDEN') return 'FORBIDDEN';
         if (!folder) return false;
         const bytes = dataUrlToBytes(tx.photo.img);
         if (!bytes.length) return false;
         const fname = 'bukti_' + String(tx.id || Date.now()).replace(/[^A-Za-z0-9_-]/g, '') + '.jpg';
         const r = await driveUploadResumable({ name: fname, parents: [folder], mimeType: 'image/jpeg' }, bytes, allowInteractive);
         if (r.file && r.file.id) {
             tx.photo.driveFileId = r.file.id;
             tx.photo.driveFileName = fname;
             tx.photo.pending = false;
             await saveAppData(false);
             try { refreshUI(); } catch (e) {}
             return true;
         }
         if (r.error === 'forbidden') return 'FORBIDDEN';
         return false;
     }

     async function uploadTxPhotoInteractive(tx) {
         if (!tx || !tx.photo || !tx.photo.img || tx.photo.driveFileId) return;
         if (!state.gdrive.userEmail) {
             tx.photo.pending = true;
             return;
         }
         let r = await uploadTxPhoto(tx, true);
         if (r === 'FORBIDDEN') {
             tokenClient = null;
             state.gdrive.accessToken = null;
             state.gdrive.tokenExpiry = null;
             await saveGDriveMeta();
             showToast('Izin Drive untuk foto dibutuhkan. Menghubungkan ulang...', 'info');
             const tok = await ensureAccessToken(true);
             if (tok) r = await uploadTxPhoto(tx, true);
         }
         if (r === true) {
             await saveAppData(false);
             refreshUI();
         } else {
             tx.photo.pending = true;
             await saveAppData(false);
             refreshUI();
             showToast('Transaksi tersimpan. Foto menunggu diupload ke Drive.', 'warning');
         }
     }

     function processPendingPhotoUploads() {
         if (uploadingPhotos) return;
         const pend = state.transactions.filter(t => t && t.photo && t.photo.img && (!t.photo.driveFileId || t.photo.pending));
         if (!pend.length) return;
         if (!state.gdrive.userEmail || !tokenIsValid()) return;
         uploadingPhotos = true;
         (async () => {
             try {
                 for (const tx of pend.slice(0, 5)) {
                     const r = await uploadTxPhoto(tx, false);
                     if (r === 'FORBIDDEN') break;
                 }
             } finally {
                 uploadingPhotos = false;
             }
         })().catch(() => { uploadingPhotos = false; });
     }

     async function deleteDriveFile(fileId) {
         if (!fileId || !tokenIsValid()) return;
         try {
             await gdriveFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId), { method: 'DELETE' }, false, false);
         } catch (e) {}
     }

     function viewTxPhoto(id) {
         const t = state.transactions.find(x => String(x.id) === String(id));
         if (!t || !t.photo || !t.photo.img) {
             showToast('Bukti foto tidak ditemukan.', 'warning');
             return;
         }
         const img = document.getElementById('photo-view-img');
         if (img) img.src = t.photo.img;
         const st = document.getElementById('photo-view-status');
         if (st) st.innerText = (t.description || '') + ' • ' + formatRp(t.amount || 0) + ' — ' + (t.photo.driveFileId ? 'Tersimpan di Google Drive' : 'Hanya di HP ini (menunggu upload)');
         document.getElementById('modal-photo').classList.remove('hidden');
     }

     function closePhotoViewer() {
         document.getElementById('modal-photo').classList.add('hidden');
     }

     function renderTransactions() {
         const container = document.getElementById('full-transactions-list');
         const search = safeLower(document.getElementById('tx-search').value);
         const entity = document.getElementById('tx-filter-entity').value;
         const type = document.getElementById('tx-filter-type').value;

         let filtered = state.transactions.filter(t => {
             const matchSearch = safeLower(t.description).includes(search) || safeLower(t.category).includes(search);
             const matchEntity = entity === 'ALL' || t.entity === entity || t.type === 'TRANSFER';
             const matchType = type === 'ALL' || t.type === type;
             return matchSearch && matchEntity && matchType;
         });

         filtered = filtered.slice().sort((a, b) => txTime(b) - txTime(a));

         const total = filtered.length;
         const totalPages = Math.ceil(total / state.transactionLimit) || 1;
         const currentPage = Math.min(state.transactionPage, totalPages);
         state.transactionPage = currentPage;
         const start = (currentPage - 1) * state.transactionLimit;
         const end = Math.min(start + state.transactionLimit, total);
         const pageItems = filtered.slice(start, end);

         let html = '';
         if (pageItems.length === 0) {
             html = `<p class="text-center text-slate-400 py-4 text-xs">Tidak ada transaksi.</p>`;
         } else {
             html = pageItems.map(t => createTransactionItemHTML(t, true)).join('');
         }

         if (total > state.transactionLimit) {
             html += `
                 <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                     <button onclick="changeTransactionPage(-1)"
                         class="px-3 py-1.5 text-xs font-bold rounded-lg ${currentPage <= 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}"
                         ${currentPage <= 1 ? 'disabled' : ''}>
                         <i class="fa-solid fa-chevron-left"></i> Sebelumnya
                     </button>
                     <span class="text-xs text-slate-600 font-medium">${currentPage} / ${totalPages} (${total} transaksi)</span>
                     <button onclick="changeTransactionPage(1)"
                         class="px-3 py-1.5 text-xs font-bold rounded-lg ${currentPage >= totalPages ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}"
                         ${currentPage >= totalPages ? 'disabled' : ''}>
                         Selanjutnya <i class="fa-solid fa-chevron-right"></i>
                     </button>
                 </div>
             `;
         }

         container.innerHTML = html;
     }

     function createTransactionItemHTML(t, allowDelete = false) {
         const isIncome = t.type === 'PEMASUKAN';
         const isTransfer = t.type === 'TRANSFER';
         let colorClass = isIncome ? 'text-emerald-600 bg-emerald-50' : (isTransfer ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
         let iconClass = isIncome ? 'fa-circle-arrow-down' : (isTransfer ? 'fa-right-left' : 'fa-circle-arrow-up');
         let prefix = isIncome ? '+' : (isTransfer ? '' : '-');
         const hasPhoto = !!(t.photo && (t.photo.img || t.photo.driveFileId));
         const photoBtn = (!hasPhoto || !allowDelete) ? '' : `<button data-txid="${escapeHtml(t.id)}" onclick="viewTxPhoto(this.dataset.txid)" class="text-xs ${t.photo.driveFileId ? 'text-slate-500 hover:text-emerald-600' : 'text-amber-500 hover:text-amber-600'} p-1.5" title="Lihat bukti foto"><i class="fa-solid fa-paperclip"></i></button>`;

         return `
             <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                 <div class="flex items-center gap-2.5 min-w-0">
                     <div class="w-8 h-8 rounded-xl ${colorClass} flex items-center justify-center shrink-0 ring-1 ring-current/15">
                         <i class="fa-solid ${iconClass} text-sm"></i>
                     </div>
                     <div class="min-w-0">
                         <div class="flex items-center gap-1">
                             <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(t.description)}</span>
                             <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${t.entity === 'USAHA' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">${escapeHtml(t.entity)}</span>
                         </div>
                         <span class="text-[11px] text-slate-500 block truncate">${((t.date && !isNaN(new Date(t.date))) ? new Date(t.date).toLocaleDateString('id-ID') : '-')} &bull; ${escapeHtml(t.category)}</span>
                     </div>
                 </div>
                 <div class="text-right shrink-0 ml-2">
                     <span class="text-xs font-bold ${isIncome ? 'text-emerald-600' : (isTransfer ? 'text-slate-800' : 'text-rose-600')} block">${prefix}${formatRp(t.amount)}</span>
                     ${allowDelete ? `<span class="inline-flex gap-2 mt-0.5">${photoBtn}<button data-txid="${escapeHtml(t.id)}" onclick="editTransaction(this.dataset.txid)" class="text-xs text-slate-500 hover:text-emerald-600 p-1.5" title="Edit"><i class="fa-solid fa-pen"></i></button><button data-txid="${escapeHtml(t.id)}" onclick="deleteTransaction(this.dataset.txid)" class="text-xs text-rose-400 hover:text-rose-600 p-1.5" title="Hapus"><i class="fa-solid fa-trash-can"></i></button></span>` : ''}
                 </div>
             </div>`;
     }

     function setReportPeriod(period) {
         state.reportPeriod = period;
         const harianBtn = document.getElementById('period-btn-harian');
         const bulananBtn = document.getElementById('period-btn-bulanan');
         const semuaBtn = document.getElementById('period-btn-semua');
         const monthPicker = document.getElementById('report-month-picker');
         const datePicker = document.getElementById('report-date-picker');
         const pickerLabel = document.getElementById('picker-label');

         [harianBtn, bulananBtn, semuaBtn].forEach(b => b.className = "px-2.5 py-1 text-[10px] sm:text-[11px] font-medium rounded-lg text-slate-600 transition-all");

         if (period === 'HARIAN') {
             harianBtn.className = "px-2.5 py-1 text-[10px] sm:text-[11px] font-medium rounded-lg bg-white text-slate-800 shadow-xs";
             datePicker.classList.remove('hidden');
             monthPicker.classList.add('hidden');
             pickerLabel.innerText = "Pilih Tanggal:";
         } else if (period === 'BULANAN') {
             bulananBtn.className = "px-2.5 py-1 text-[10px] sm:text-[11px] font-medium rounded-lg bg-white text-slate-800 shadow-xs";
             monthPicker.classList.remove('hidden');
             datePicker.classList.add('hidden');
             pickerLabel.innerText = "Pilih Bulan:";
         } else {
             semuaBtn.className = "px-2.5 py-1 text-[10px] sm:text-[11px] font-medium rounded-lg bg-white text-slate-800 shadow-xs";
             monthPicker.classList.add('hidden');
             datePicker.classList.add('hidden');
             pickerLabel.innerText = "Semua Riwayat";
         }

         updateReports();
     }

     // Sisa modal sebelum periode + alokasi penarikan periode (kronologis).
    function computePeriodModalSplit(periodTxs) {
        let periodKey = null;
        const periodKind = state.reportPeriod;
        try {
            if (periodKind === 'HARIAN') {
                const el = document.getElementById('report-date-picker');
                periodKey = (el && el.value) || state.selectedDate;
            } else if (periodKind === 'BULANAN') {
                const el = document.getElementById('report-month-picker');
                periodKey = (el && el.value) || state.selectedMonth;
            }
        } catch (e) {}
        let suntikBefore = 0, tarikBefore = 0;
        if (periodKey && periodKind !== 'SEMUA') {
            state.transactions.forEach(t => {
                if (!t || t.type !== 'TRANSFER' || !t.date) return;
                const amt = Number(t.amount) || 0;
                let isBefore = false;
                if (periodKind === 'HARIAN') isBefore = String(t.date).slice(0, 10) < periodKey;
                else if (periodKind === 'BULANAN') isBefore = String(t.date).slice(0, 7) < periodKey;
                if (!isBefore) return;
                if (classifyTransfer(t) === 'SUNTIK') suntikBefore += amt;
                else if (classifyTransfer(t) === 'PRIVE') tarikBefore += amt;
            });
        }
        let sisa2 = Math.max(0, suntikBefore - tarikBefore);
        let prive = 0, kembali = 0;
        const sorted = (periodTxs || []).slice().sort((a, b) => String(a.date) < String(b.date) ? -1 : 1);
        sorted.forEach(t => {
            if (!t || t.type !== 'TRANSFER') return;
            const amt = Number(t.amount) || 0;
            if (classifyTransfer(t) === 'SUNTIK') { sisa2 += amt; }
            else if (classifyTransfer(t) === 'PRIVE') {
                const ambil = Math.min(amt, sisa2);
                kembali += ambil; sisa2 -= ambil; prive += (amt - ambil);
            }
        });
        const g = computeModalDebt();
        return {
            priveAktual: prive, modalKembaliPeriode: kembali,
            sisaModalSebelum: Math.max(0, suntikBefore - tarikBefore),
            sisaModalGlobal: g.sisaModal
        };
    }

    function updateReports() {
         state.reportPage = 1;

         let filtered = state.transactions;
         if (state.reportPeriod === 'HARIAN') {
             const dateVal = document.getElementById('report-date-picker').value || state.selectedDate;
             filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(dateVal));
         } else if (state.reportPeriod === 'BULANAN') {
             const monthVal = document.getElementById('report-month-picker').value || state.selectedMonth;
             filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(monthVal));
         }

         let pemUsaha = 0, pengUsaha = 0, pengPribadi = 0;
         let privePeriode = 0, suntikPeriode = 0;

         filtered.forEach(t => {
             const amt = Number(t.amount) || 0;
             if (t.type === 'PEMASUKAN' && t.entity === 'USAHA') pemUsaha += amt;
             if (t.type === 'PENGELUARAN' && t.entity === 'USAHA') pengUsaha += amt;
             if (t.type === 'PENGELUARAN' && t.entity === 'PRIBADI') pengPribadi += amt;
             if (t.type === 'TRANSFER') {
                 if (classifyTransfer(t) === 'SUNTIK') suntikPeriode += amt;
                 if (classifyTransfer(t) === 'PRIVE') privePeriode += amt;
             }
         });

         const split = computePeriodModalSplit(filtered);
         const priveAktual = split.priveAktual;
         const modalKembali = split.modalKembaliPeriode;
         const sisaModal = split.sisaModalGlobal;

         const labaBersih = pemUsaha - pengUsaha;

         document.getElementById('report-pemasukan-usaha').innerText = formatRp(pemUsaha);
         document.getElementById('report-pengeluaran-usaha').innerText = formatRp(pengUsaha);
         document.getElementById('report-laba-bersih').innerText = formatRp(labaBersih);
         document.getElementById('report-total-prive').innerText = formatRp(priveAktual);

         renderAntiBoncosPanel(pemUsaha, pengUsaha, priveAktual, suntikPeriode, privePeriode, modalKembali, sisaModal);
         renderCharts(pemUsaha, pengUsaha, labaBersih, priveAktual, modalKembali);
         renderReportTable(filtered);
     }

     function renderAntiBoncosPanel(pemasukan, pengeluaran, priveAktual, suntikPeriode, penarikanPeriode, modalKembali, sisaModal) {
         const panel = document.getElementById('panel-anti-boncos');
         const laba = pemasukan - pengeluaran;

         let statusText = "", colorClass = "", icon = "", advice = "";

         let modalStatus = '';
         if (sisaModal > 0) {
             modalStatus = `<i class="fa-solid fa-rotate-left text-blue-500 mr-1"></i> Modal Pribadi di Usaha: ${formatRp(sisaModal)} (belum kembali)`;
         } else if (modalKembali > 0 && priveAktual === 0) {
             modalStatus = `<i class="fa-solid fa-check-circle text-emerald-500 mr-1"></i> Modal Pribadi sudah kembali semua (${formatRp(modalKembali)})`;
         } else if (priveAktual > 0) {
             modalStatus = `<i class="fa-solid fa-coins text-amber-500 mr-1"></i> Prive (Keuntungan) diambil: ${formatRp(priveAktual)}`;
         }

         if (pemasukan === 0 && pengeluaran === 0 && suntikPeriode === 0 && penarikanPeriode === 0) {
             colorClass = "bg-slate-100 border-slate-200 text-slate-700";
             icon = "fa-circle-info text-slate-500";
             statusText = "Belum Ada Transaksi";
             advice = "Catat pemasukan dan pengeluaran usaha Anda untuk melihat skor kesehatan arus kas.";
         } else if (pemasukan === 0 && pengeluaran === 0) {
             colorClass = "bg-slate-100 border-slate-200 text-slate-700";
             icon = "fa-circle-info text-slate-500";
             statusText = "Baru Ada Pergerakan Modal";
             advice = "Periode ini hanya ada suntik/penarikan modal, belum ada laba/rugi usaha.";
         } else if (laba > 0 && priveAktual <= laba * 0.5) {
             colorClass = "bg-emerald-50 border-emerald-200 text-emerald-900";
             icon = "fa-circle-check text-emerald-600";
             statusText = "Status: Keuangan Sehat & Aman!";
             advice = `Laba usaha Anda memadai (${formatRp(laba)}). Penarikan prive (${formatRp(priveAktual)}) masih dalam batas aman di bawah 50% laba.`;
         } else if (laba > 0 && priveAktual > laba * 0.5) {
             colorClass = "bg-amber-50 border-amber-200 text-amber-900";
             icon = "fa-triangle-exclamation text-amber-600";
             statusText = "Waspada: Prive Terlalu Besar";
             advice = `Usaha Anda mencetak laba (${formatRp(laba)}), namun penarikan prive Anda (${formatRp(priveAktual)}) memakan lebih dari setengah laba usaha. Pertimbangkan menahan modal usaha.`;
         } else {
             colorClass = "bg-rose-50 border-rose-200 text-rose-900";
             icon = "fa-triangle-exclamation text-rose-600";
             statusText = "Peringatan Anti-Boncos!";
             advice = `Pengeluaran usaha melebihi pemasukan (Defisit ${formatRp(Math.abs(laba))}). Kurangi pengeluaran operasional non-esensial atau tingkatkan penjualan.`;
         }

         let modalEdukasi = '';
         if (suntikPeriode > 0 || penarikanPeriode > 0) {
             modalEdukasi = `
                 <div class="mt-3 pt-3 border-t border-slate-200/50">
                     <div class="grid grid-cols-3 gap-2 text-[10px]">
                         <div class="bg-white/50 p-2 rounded-lg">
                             <span class="block font-semibold text-slate-500">Modal Disuntik</span>
                             <span class="block font-bold text-emerald-600">${formatRp(suntikPeriode)}</span>
                         </div>
                         <div class="bg-white/50 p-2 rounded-lg">
                             <span class="block font-semibold text-slate-500">Penarikan</span>
                             <span class="block font-bold text-amber-600">${formatRp(penarikanPeriode)}</span>
                         </div>
                         <div class="bg-white/50 p-2 rounded-lg">
                             <span class="block font-semibold text-slate-500">Prive Aktual</span>
                             <span class="block font-bold text-rose-600">${formatRp(priveAktual)}</span>
                         </div>
                     </div>
                     <p class="text-[10px] text-slate-600 mt-2 leading-relaxed">${modalStatus}</p>
                     ${sisaModal > 0 ? `<p class="text-[10px] text-blue-600 mt-1"><i class="fa-solid fa-lightbulb mr-1"></i>Penarikan Anda saat ini adalah pengembalian modal, BUKAN prive (keuntungan).</p>` : ''}
                     ${priveAktual > 0 ? `<p class="text-[10px] text-emerald-600 mt-1"><i class="fa-solid fa-lightbulb mr-1"></i>Modal sudah kembali. Kelebihan penarikan adalah prive (keuntungan).</p>` : ''}
                 </div>
             `;
         }

         panel.className = `p-3.5 rounded-2xl shadow-xs border transition-all ${colorClass}`;
         panel.innerHTML = `
             <div class="flex items-center gap-2 mb-1">
                 <i class="fa-solid ${icon} text-sm"></i>
                 <h3 class="text-xs font-bold">${statusText}</h3>
             </div>
             <p class="text-[11px] leading-relaxed opacity-90">${advice}</p>
             ${modalEdukasi}
         `;
     }

     function renderCharts(pemUsaha, pengUsaha, labaBersih, priveAktual, modalKembali) {
        if (typeof Chart === 'undefined') {
            const box = document.getElementById('chart-bar-legend');
            if (box) box.innerHTML = '<div class="rounded-xl border p-3 bg-slate-50 border-slate-200 text-slate-600"><p class="text-[11px] font-bold">Grafik tidak tersedia offline</p><p class="text-[10px] leading-relaxed mt-1">Sambungkan internet sekali untuk memuat pustaka grafik. Angka ringkasan di atas tetap akurat.</p></div>';
            try { if (chartBarInstance) { chartBarInstance.destroy(); chartBarInstance = null; } } catch (e) {}
            try { if (chartPieInstance) { chartPieInstance.destroy(); chartPieInstance = null; } } catch (e) {}
            return;
        }
         const ctxBar = document.getElementById('chart-bar-comparison').getContext('2d');
         if (chartBarInstance) chartBarInstance.destroy();

         const barData = {
             labels: ['Pendapatan', 'Pengeluaran', 'Laba Bersih', 'Prive Aktual'],
             datasets: [{
                 data: [pemUsaha, pengUsaha, labaBersih, priveAktual],
                 backgroundColor: ['#10b981', '#f43f5e', '#3b82f6', '#f59e0b'],
                 borderRadius: 8,
                 borderSkipped: false
             }]
         };

         chartBarInstance = new Chart(ctxBar, {
             type: 'bar',
             data: barData,
             options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: {
                     legend: { display: false },
                     tooltip: {
                         callbacks: {
                             label: (c) => formatRp(c.raw)
                         }
                     }
                 },
                 scales: {
                     x: {
                         ticks: {
                             font: { size: 8, weight: 'bold' },
                             maxRotation: 45,
                             minRotation: 45,
                             autoSkip: false,
                             maxTicksLimit: 6
                         }
                     },
                     y: {
                         ticks: {
                             font: { size: 8 },
                             callback: (v) => {
                                 if (v >= 1000000) return (v/1000000) + 'Jt';
                                 if (v >= 1000) return (v/1000) + 'Rb';
                                 return v;
                             }
                         }
                     }
                 }
             }
         });

         renderBarLegend(pemUsaha, pengUsaha, labaBersih, priveAktual, modalKembali);

         const ctxPie = document.getElementById('chart-pie-distribution').getContext('2d');
         if (chartPieInstance) chartPieInstance.destroy();

         const labaPositif = Math.max(0, labaBersih);
         const privePositif = Math.min(priveAktual, labaPositif);
         const sisaLaba = Math.max(0, labaPositif - privePositif);
         const doughnutEmpty = (sisaLaba === 0 && privePositif === 0);

         chartPieInstance = new Chart(ctxPie, {
             type: 'doughnut',
             data: {
                 labels: doughnutEmpty ? ['Belum ada laba ditahan'] : ['Laba Ditahan', 'Prive (Keuntungan Diambil)'],
                 datasets: [{
                     data: doughnutEmpty ? [1] : [sisaLaba, privePositif],
                     backgroundColor: doughnutEmpty ? ['#e2e8f0'] : ['#3b82f6', '#f59e0b'],
                     borderWidth: 2,
                     borderColor: '#ffffff'
                 }]
             },
             options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: {
                     legend: {
                         position: 'bottom',
                         labels: {
                             font: { size: 10 },
                             padding: 15
                         }
                     },
                     tooltip: {
                         callbacks: {
                             label: (c) => {
                                 if (c.chart && c.chart.data && c.chart.data.labels && c.chart.data.labels[0] === 'Belum ada laba ditahan') return 'Belum ada data';
                                 const total = c.dataset.data.reduce((a,b) => a + b, 0);
                                 const pct = total > 0 ? Math.round((c.raw / total) * 100) : 0;
                                 return formatRp(c.raw) + ` (${pct}%)`;
                             }
                         }
                     }
                 }
             }
         });
     }

     function renderBarLegend(pemUsaha, pengUsaha, labaBersih, priveAktual, modalKembali) {
         const box = document.getElementById('chart-bar-legend');
         if (!box) return;

         const rasio = labaBersih > 0 ? Math.round((priveAktual / labaBersih) * 100) : (priveAktual > 0 ? 100 : 0);
         let verdict, vClass;

         if (priveAktual === 0) {
             if (modalKembali > 0) {
                 verdict = `<i class="fa-solid fa-rotate-left text-blue-500 mr-1"></i> ${formatRp(modalKembali)} modal pribadi kembali. Belum ada prive yang diambil.`;
                 vClass = 'bg-blue-50 border-blue-200 text-blue-800';
             } else {
                 verdict = 'Belum ada prive yang diambil dari usaha.';
                 vClass = 'bg-slate-50 border-slate-200 text-slate-700';
             }
         }
         else if (labaBersih > 0 && priveAktual <= labaBersih * 0.5) {
             verdict = `<i class="fa-solid fa-check-circle text-emerald-500 mr-1"></i> Aman. Prive ${rasio}% dari laba usaha.`;
             vClass = 'bg-emerald-50 border-emerald-200 text-emerald-800';
         }
         else if (labaBersih > 0 && priveAktual <= labaBersih) {
             verdict = `<i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i> Waspada. Prive ${rasio}% dari laba usaha.`;
             vClass = 'bg-amber-50 border-amber-200 text-amber-800';
         }
         else {
             verdict = `<i class="fa-solid fa-circle-exclamation text-rose-500 mr-1"></i> Bahaya! Prive melebihi laba usaha.`;
             vClass = 'bg-rose-50 border-rose-200 text-rose-800';
         }

         const rows = [
             { color: '#10b981', label: 'Pendapatan Usaha', val: pemUsaha, desc: 'Seluruh uang masuk ke kantong usaha.' },
             { color: '#f43f5e', label: 'Pengeluaran Usaha', val: pengUsaha, desc: 'Biaya operasional usaha.' },
             { color: '#3b82f6', label: 'Laba Bersih', val: labaBersih, desc: 'Pendapatan - Pengeluaran usaha.' },
             { color: '#f59e0b', label: 'Prive (Keuntungan)', val: priveAktual, desc: 'Keuntungan yang diambil pemilik.' }
         ];

         box.innerHTML = rows.map(r => `
             <div class="flex items-start gap-2">
                 <span class="w-2.5 h-2.5 rounded-sm mt-1 shrink-0" style="background:${r.color}"></span>
                 <div class="min-w-0">
                     <p class="text-[11px] font-bold text-slate-800">${r.label}: ${formatRp(r.val)}</p>
                     <p class="text-[10px] text-slate-500 leading-tight">${r.desc}</p>
                 </div>
             </div>
         `).join('') + `
             <div class="mt-3 rounded-xl border p-3 ${vClass}">
                 <p class="text-[11px] font-bold">Ringkasan:</p>
                 <p class="text-[10px] leading-relaxed mt-1">${verdict}</p>
                 ${modalKembali > 0 ? `<p class="text-[10px] leading-relaxed mt-1"><i class="fa-solid fa-lightbulb mr-1"></i> ${formatRp(modalKembali)} modal pribadi sudah kembali ke pemilik.</p>` : ''}
             </div>
         `;
     }

     function renderReportTable(filtered) {
         const tbody = document.getElementById('report-table-body');

         filtered = filtered.slice().sort((a, b) => txTime(b) - txTime(a));

         const total = filtered.length;
         const totalPages = Math.ceil(total / state.reportLimit) || 1;
         const currentPage = Math.min(state.reportPage, totalPages);
         state.reportPage = currentPage;
         const start = (currentPage - 1) * state.reportLimit;
         const end = Math.min(start + state.reportLimit, total);
         const pageItems = filtered.slice(start, end);

         let html = '';
         if (pageItems.length === 0) {
             html = `<tr><td colspan="4" class="text-center p-3 text-slate-400">Tidak ada transaksi pada periode ini.</td></tr>`;
         } else {
             html = pageItems.map(t => {
                 const dSafe = (t.date && !isNaN(new Date(t.date))) ? new Date(t.date).toLocaleDateString('id-ID') : '-';
                 return `
                 <tr class="hover:bg-slate-50">
                     <td class="p-2 text-slate-600">${dSafe}</td>
                     <td class="p-2 font-medium text-slate-800">${escapeHtml(t.entity)}</td>
                     <td class="p-2 text-slate-600">${escapeHtml(t.category)}</td>
                     <td class="p-2 text-right font-bold ${t.type === 'PEMASUKAN' ? 'text-emerald-600' : (t.type === 'TRANSFER' ? 'text-amber-600' : 'text-rose-600')}">${formatRp(t.amount)}</td>
                 </tr>
             `; }).join('');
         }

         tbody.innerHTML = html;

         const container = document.getElementById('report-table-container');
         if (total > state.reportLimit) {
             container.innerHTML = `
                 <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-200">
                     <button onclick="changeReportPage(-1)"
                         class="px-3 py-1.5 text-xs font-bold rounded-lg ${currentPage <= 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}"
                         ${currentPage <= 1 ? 'disabled' : ''}>
                         <i class="fa-solid fa-chevron-left"></i> Sebelumnya
                     </button>
                     <span class="text-xs text-slate-600 font-medium">${currentPage} / ${totalPages} (${total} transaksi)</span>
                     <button onclick="changeReportPage(1)"
                         class="px-3 py-1.5 text-xs font-bold rounded-lg ${currentPage >= totalPages ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}"
                         ${currentPage >= totalPages ? 'disabled' : ''}>
                         Selanjutnya <i class="fa-solid fa-chevron-right"></i>
                     </button>
                 </div>
             `;
         } else {
             container.innerHTML = '';
         }
     }

     function refreshUI() {
         document.getElementById('app-business-name').innerText = state.businessName;
         const _pcn = document.getElementById('print-company-name');
         if (_pcn) _pcn.innerText = state.businessName;
         const _pli = document.getElementById('print-logo-img');
         if (_pli) { try { _pli.src = getDisplayLogo(state.logoBase64); } catch (e) {} }
         renderHeaderLogo();

         const { saldoUsaha, saldoPribadi } = computeBalances();
         document.getElementById('card-saldo-usaha').innerText = formatRp(saldoUsaha);
         document.getElementById('card-saldo-pribadi').innerText = formatRp(saldoPribadi);

         const currentMonthStr = getLocalMonthString();
         let monthIn = 0, monthOut = 0;
         state.transactions.forEach(t => {
             if (t.date && String(t.date).startsWith(currentMonthStr) && t.entity === 'USAHA') {
                 if (t.type === 'PEMASUKAN') monthIn += Number(t.amount) || 0;
                 if (t.type === 'PENGELUARAN') monthOut += Number(t.amount) || 0;
             }
         });

         document.getElementById('metric-pemasukan').innerText = formatRp(monthIn);
         document.getElementById('metric-pengeluaran').innerText = formatRp(monthOut);

         renderDashInsights();
         renderTransactions();
     }

     async function saveSettings(e) {
        e.preventDefault();
        if (pendingLogoBase64 === '__REMOVE__') {
            state.logoBase64 = DEFAULT_WALLET_LOGO;
        } else if (pendingLogoBase64) {
            state.logoBase64 = pendingLogoBase64;
        }
        pendingLogoBase64 = null;
        const _lf = document.getElementById('input-logo-file');
        if (_lf) _lf.value = '';
        const name = document.getElementById('input-business-name').value.trim().slice(0, 60);

        if (name) {
            state.businessName = name;
            if (state.currentUser) {
                const idx = state.users.findIndex(u => u.id === state.currentUser);
                if (idx !== -1) {
                    state.users[idx].businessName = name;
                    state.users[idx].logoBase64 = state.logoBase64;
                    await dbSet(STORAGE_USERS, state.users);
                }
            }
        }

        await saveAppData();
        refreshUI();
        showToast('Pengaturan berhasil disimpan!', 'success');
    }

    function requestResetAllData() {
        showConfirmModal('PERINGATAN RESET DATA', 'Seluruh catatan transaksi usaha & pribadi pada profil ini akan dihapus. Yakin?', async () => {
            state.transactions = [];
            await saveAppData();
            refreshUI();
            showToast('Semua data transaksi telah dibersihkan.', 'info');
        });
    }

    function csvEscape(v) {
        const str = String(v == null ? '' : v);
        return '"' + str.replace(/"/g, '""') + '"';
    }
    function exportCSV() {
        const rows = ["ID,Tanggal,Entitas,Tipe,Kategori,Jumlah,Deskripsi,Metode"];
        state.transactions.forEach(t => {
            rows.push([t.id, t.date, t.entity, t.type, t.category, t.amount, t.description, t.paymentMethod || ''].map(csvEscape).join(','));
        });
        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `DompetKu_Laporan_${getLocalDateString()}.csv`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 500);
    }

    function exportJSON() {
        const payload = {
            version: "3.0-local",
            exportDate: new Date().toISOString(),
            businessName: state.businessName,
            logoBase64: state.logoBase64,
            transactions: state.transactions,
            categories: state.categories,
            categoriesEnabled: state.categoriesEnabled
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dl = document.createElement('a');
        dl.href = url;
        dl.download = `DompetKu_Cadangan_${getLocalDateString()}.json`;
        document.body.appendChild(dl);
        dl.click();
        setTimeout(() => { URL.revokeObjectURL(url); dl.remove(); }, 500);
    }
    function sanitizeImportedDate(d) {
        const fallback = getLocalDateTimeInputValue();
        if (d == null) return fallback;
        const str = String(d).slice(0, 16);
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(str)) return fallback;
        const parsed = new Date(str.length === 10 ? str + 'T00:00' : str);
        if (isNaN(parsed)) return fallback;
        return str.length === 10 ? str + 'T00:00' : str;
    }
    function sanitizeImportedTransaction(t) {
        if (!t || typeof t !== 'object') return null;
        const type = String(t.type || '').toUpperCase();
        const entity = String(t.entity || '').toUpperCase();
        if (!['PEMASUKAN', 'PENGELUARAN', 'TRANSFER'].includes(type)) return null;
        if (!['USAHA', 'PRIBADI'].includes(entity)) return null;
        const amount = Number(t.amount) || 0;
        if (!(amount > 0) || amount > 1000000000000) return null;
        return {
            id: String(t.id || generateId()),
            type, entity, amount,
            category: String(t.category || 'Umum').slice(0, 50),
            date: sanitizeImportedDate(t.date),
            paymentMethod: String(t.paymentMethod || 'Tunai').slice(0, 30),
            description: String(t.description || t.category || 'Transaksi').slice(0, 120),
            ...(sanitizeImportedPhoto(t.photo) ? { photo: sanitizeImportedPhoto(t.photo) } : {})
        };
    }

    function importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (!parsed || typeof parsed !== 'object') throw new Error('bad format');
                if (!Array.isArray(parsed.transactions)) throw new Error('transactions bukan array');
                const clean = parsed.transactions.map(sanitizeImportedTransaction).filter(Boolean);
                if (clean.length === 0 && parsed.transactions.length > 0) throw new Error('tidak ada transaksi valid');
                state.transactions = clean;
                state.transactionPage = 1;
                state.reportPage = 1;
                if (parsed.businessName) {
                    state.businessName = parsed.businessName;
                    if (state.currentUser) {
                        const idx = state.users.findIndex(u => u.id === state.currentUser);
                        if (idx !== -1) {
                            state.users[idx].businessName = parsed.businessName;
                        }
                    }
                }
                if (parsed.logoBase64 !== undefined) {
                    state.logoBase64 = parsed.logoBase64 || DEFAULT_WALLET_LOGO;
                    if (state.currentUser) {
                        const idx = state.users.findIndex(u => u.id === state.currentUser);
                        if (idx !== -1) {
                            state.users[idx].logoBase64 = state.logoBase64;
                        }
                    }
                }
                if (state.currentUser) {
                    await dbSet(STORAGE_USERS, state.users);
                }
                if (parsed.categories && typeof parsed.categories === 'object') {
                    const pem = Array.isArray(parsed.categories.PEMASUKAN) ? parsed.categories.PEMASUKAN.filter(c => typeof c === 'string').map(c => c.trim().slice(0, 30)).filter(Boolean).slice(0, 50) : null;
                    const peng = Array.isArray(parsed.categories.PENGELUARAN) ? parsed.categories.PENGELUARAN.filter(c => typeof c === 'string').map(c => c.trim().slice(0, 30)).filter(Boolean).slice(0, 50) : null;
                    if (pem && pem.length) state.categories.PEMASUKAN = [...new Set(pem)];
                    if (peng && peng.length) state.categories.PENGELUARAN = [...new Set(peng)];
                }
                if (typeof parsed.categoriesEnabled === 'boolean') state.categoriesEnabled = parsed.categoriesEnabled;
                 if (typeof parsed.tourSeen === 'boolean') state.tourSeen = parsed.tourSeen;
                await saveAppData();
                refreshUI();
                showToast(`Pemulihan berhasil: ${state.transactions.length} transaksi valid.`, 'success');
            } catch(err) {
                showToast('Format JSON salah atau corrupt.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function getReportFilteredForPrint() {
        let filtered = state.transactions;
        try {
            if (state.reportPeriod === 'HARIAN') {
                const dv = (document.getElementById('report-date-picker') || {}).value || state.selectedDate;
                filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(dv));
            } else if (state.reportPeriod === 'BULANAN') {
                const mv = (document.getElementById('report-month-picker') || {}).value || state.selectedMonth;
                filtered = state.transactions.filter(t => t.date && String(t.date).startsWith(mv));
            }
        } catch (e) {}
        return filtered.slice().sort((a, b) => txTime(b) - txTime(a));
    }
    function getReportPeriodLabel() {
        try {
            if (state.reportPeriod === 'HARIAN') {
                const dv = (document.getElementById('report-date-picker') || {}).value || state.selectedDate;
                let fmt = dv;
                try { fmt = new Date(dv + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
                return 'Periode: Harian \u2022 ' + fmt;
            }
            if (state.reportPeriod === 'BULANAN') {
                const mv = (document.getElementById('report-month-picker') || {}).value || state.selectedMonth;
                let fmt = mv;
                try {
                    const parts = String(mv).split('-');
                    if (parts.length === 2) fmt = new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                } catch (e) {}
                return 'Periode: Bulanan \u2022 ' + fmt;
            }
            return 'Periode: Semua Transaksi';
        } catch (e) { return 'Periode: -'; }
    }
    function exportPDF() {
        try {
            const logoEl = document.getElementById('print-logo-img');
            if (logoEl) logoEl.src = getDisplayLogo(state.logoBase64);
        } catch (e) {}
        try {
            const nameEl = document.getElementById('print-company-name');
            if (nameEl) nameEl.innerText = state.businessName || 'DompetKu';
        } catch (e) {}
        try {
            const perEl = document.getElementById('print-period-label');
            if (perEl) perEl.innerText = getReportPeriodLabel();
        } catch (e) {}
        const nowStr = new Date().toLocaleString('id-ID');
        try { document.getElementById('print-date-stamp').innerText = 'Dicetak pada: ' + nowStr; } catch (e) {}
        try {
            const sd = document.getElementById('print-sign-date');
            if (sd) sd.innerText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) {}
        try {
            const sn = document.getElementById('print-sign-name');
            if (sn) sn.innerText = state.businessName || 'Pemilik Usaha';
        } catch (e) {}
        const prevTheme = document.documentElement.dataset.theme;
        document.documentElement.dataset.theme = 'light';
        const prevPage = state.reportPage;
        const prevLimit = state.reportLimit;
        try {
            const filtered = getReportFilteredForPrint();
            if (filtered.length > prevLimit) {
                state.reportPage = 1;
                state.reportLimit = Math.max(filtered.length, 1);
                renderReportTable(filtered.slice());
            }
        } catch (e) {}
        const restore = () => {
            if (prevTheme) document.documentElement.dataset.theme = prevTheme;
            state.reportPage = prevPage;
            state.reportLimit = prevLimit;
            try { renderReportTable(getReportFilteredForPrint()); } catch (e) {}
            window.removeEventListener('afterprint', restore);
        };
        window.addEventListener('afterprint', restore);
        window.print();
        setTimeout(() => { if (state.reportLimit !== prevLimit) restore(); }, 1500);
    }

    // Fungsi pemantauan status jaringan (Online / Offline)
    function updateNetworkStatus() {
        const offlineBadge = document.getElementById('network-offline-badge');
        if (!offlineBadge) return;
        if (navigator.onLine) {
            offlineBadge.classList.add('hidden');
            offlineBadge.classList.remove('flex');
        } else {
            offlineBadge.classList.remove('hidden');
            offlineBadge.classList.add('flex');
        }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Event listener untuk format input nominal & inisialisasi aplikasi
    document.addEventListener('DOMContentLoaded', async function() {
        applyTheme();
        updateNetworkStatus();

        try {
            await initDB();
            const firstUsed = await dbGet(STORAGE_FIRST_USED);
            if (!firstUsed) {
                await dbSet(STORAGE_FIRST_USED, Date.now().toString());
            }

            initPWA();
            initGoogleDriveAuth();
            await loadStorageState();
            refreshUI();
            setTimeout(processPendingPhotoUploads, 3000);
            
            document.getElementById('report-month-picker').value = state.selectedMonth;
            document.getElementById('report-date-picker').value = state.selectedDate;

            setTimeout(initGoogleDriveAuth, 1000);
            setTimeout(checkGDriveNudge, 1500);
        } catch (err) {
            console.error('Initialization error:', err);
        }

        const txAmount = document.getElementById('tx-amount');
        if (txAmount) {
            txAmount.addEventListener('input', function() {
                formatNumberInput(this);
                toggleTransactionSubmit();
            });
        }

        const transferAmount = document.getElementById('transfer-amount');
        if (transferAmount) {
            transferAmount.addEventListener('input', function() {
                formatNumberInput(this);
            });
        }

        document.querySelectorAll('input[name="transfer-type-radio"]').forEach(el => {
            el.addEventListener('change', toggleTransferSubmit);
        });
    });
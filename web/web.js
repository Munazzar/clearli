/* Clearli Web — dashboard that reads the phone's snapshot from the user's own Google Drive (app folder).
   Loaded before store.js: provides the "Native" layer for the browser and gates boot until data is loaded. */
(function () {
  window.CLEARLI_WEB = true;
  window.CLEARLI_DEFER_BOOT = true;

  /* ---------------- Google sign-in return (runs before anything else) ---------------- */
  const TOK = 'clearli.gtok';
  const readHash = () => {
    if (!/access_token=|error=/.test(location.hash)) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    return { t: p.get('access_token'), exp: Date.now() + (Number(p.get('expires_in')) || 3600) * 1000, state: p.get('state') || '', err: p.get('error') || '' };
  };
  const hashTok = readHash();
  if (hashTok && (window.opener || window.name === 'clearli-auth')) {
    // We are the sign-in popup: hand the token to the dashboard window and close.
    try { new BroadcastChannel('clearli-auth').postMessage(hashTok); } catch (e) { }
    try { localStorage.setItem('clearli.authmsg', JSON.stringify(hashTok)); } catch (e) { }
    window.CLEARLI_POPUP = true;
    document.addEventListener('DOMContentLoaded', () => { document.body.innerHTML = '<p style="font-family:sans-serif;text-align:center;margin-top:30vh;color:#888">Signed in — you can close this window.</p>'; });
    setTimeout(() => window.close(), 150);
    return;
  }
  if (hashTok) history.replaceState(null, '', location.pathname + location.search);
  const W = { data: null, base: null, meta: null, pending: false, status: 'idle', lastPull: 0 };
  window.CW = W;

  /* ---------------- tiny IndexedDB key/value ---------------- */
  const idb = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('clearli', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
    const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => { const t = d.transaction('kv', mode); const s = t.objectStore('kv'); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
    return { get: (k) => tx('readonly', (s) => s.get(k)), set: (k, v) => tx('readwrite', (s) => s.put(v, k)), del: (k) => tx('readwrite', (s) => s.delete(k)) };
  })();
  W.idb = idb;

  /* ---------------- Native layer for the browser ---------------- */
  const results = {}; let n = 0;
  const cb = (id, obj) => { const k = 'w' + (++n); results[k] = JSON.stringify(obj); setTimeout(() => window.__nativeCb(id, k), 0); };
  window.Native = {
    take: (k) => { const v = results[k]; delete results[k]; return v; },
    loadData: () => W.data,
    saveData: (json) => { W.data = json; W.schedulePush(); return true; },
    hasCredential: () => false, clearCredential: () => { }, wipeAll: () => { },
    claimToken: (t, id) => cb(id, { ok: false, error: 'Connect banks from the phone app.' }),
    fetchAccounts: (a, b, bo, id) => cb(id, { ok: false, error: 'Bank sync runs on your phone.' }),
    accessHost: () => null, isDeviceSecure: () => false, requestUnlock: (id) => cb(id, { ok: true }),
    setBars: () => { }, setSecure: () => { }, haptic: () => { }, version: () => 'Web',
    openUrl: (u) => window.open(u, '_blank', 'noopener'),
    clipboard: () => '', decodeToken: () => null,
    exportFile: (name, mime, content, id) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); cb(id, { ok: true }); },
    importFile: (id) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.ofx,.qfx,.qbo,.txt,.json';
      let done = false;
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; done = true; const r = new FileReader(); r.onload = () => cb(id, { ok: true, content: r.result }); r.onerror = () => cb(id, { ok: false, error: 'Could not read file' }); r.readAsText(f); };
      window.addEventListener('focus', () => setTimeout(() => { if (!done && !inp.files.length) cb(id, { ok: false, error: 'cancelled' }); }, 800), { once: true });
      inp.click();
    },
  };

  /* ---------------- state helpers ---------------- */
  const WEB_SETTINGS = { onboarded: true, lock: false, secureScreen: false, autoSync: false };
  const localSettings = () => { try { return JSON.parse(localStorage.getItem('clearli.web.settings') || '{}'); } catch (e) { return {}; } };
  const saveLocalSettings = (s) => { try { localStorage.setItem('clearli.web.settings', JSON.stringify({ theme: s.theme, accent: s.accent, hideAmounts: s.hideAmounts, reduceFx: s.reduceFx })); } catch (e) { } };
  const compose = (snapJson, batches) => {
    const S = JSON.parse(snapJson);
    for (const b of batches || []) Cloud.apply(S, b.ops);
    S.settings = Object.assign({}, S.settings, WEB_SETTINGS, localSettings());
    return S;
  };

  // Pull snapshot (+ edits not yet merged by the phone) and make it the app state
  W.pull = async function (force) {
    const meta = await Cloud.meta();
    if (!meta) { const e = new Error('No synced data yet. On your phone: More → Web dashboard & sync.'); e.noData = true; throw e; }
    let snap = null;
    const cache = await idb.get('cache').catch(() => null);
    if (!force && cache && cache.version === meta.version && W.ckey) {
      const bytes = await Cloud.decrypt(cache.iv, cache.data, W.ckey);
      snap = await Cloud.unzip(bytes, cache.gz);
    } else {
      const r = await Cloud.pullSnapshot(meta);
      snap = r.json;
      if (W.remember && W.ckey) { const c = await Cloud.encrypt(await Cloud.zip(snap), W.ckey); idb.set('cache', { version: meta.version, iv: c.iv, data: c.data, gz: Cloud.gz }).catch(() => { }); }
    }
    const batches = await Cloud.pullOps();
    const S = compose(snap, batches);
    W.meta = meta; W.lastPull = Date.now();
    return S;
  };
  W.install = function (S) {
    Store.S = S;
    U.currency = S.settings.currency || 'USD';
    Store.recompute();
    W.base = Cloud.baseOf(Store.S);
    W.data = JSON.stringify(S);
  };

  // Push only what changed (encrypted); the phone merges it on its next sync
  let pushT = null;
  W.schedulePush = function () {
    if (!W.base) return;
    saveLocalSettings(Store.S.settings);
    clearTimeout(pushT); pushT = setTimeout(W.push, 1500);
    W.setStatus('pending');
  };
  W.push = async function () {
    if (!W.base) return;
    const ops = Cloud.diff(Store.S, W.base);
    if (!ops.length) { W.setStatus('ok'); return; }
    W.setStatus('saving');
    try {
      await Cloud.pushOps(ops);
      W.base = Cloud.baseOf(Store.S);
      W.setStatus('ok');
    } catch (e) { if (e.auth) { W.setStatus('signin'); return; } W.setStatus('error', e.message); clearTimeout(pushT); pushT = setTimeout(W.push, 15000); }
  };
  W.setStatus = function (s, msg) {
    W.status = s; W.statusMsg = msg || '';
    const el = document.getElementById('webStatus'); if (el) el.innerHTML = W.statusHtml();
  };
  W.statusHtml = function () {
    const I = U.icon;
    if (W.status === 'signin') return `<span class="warn">${I('alert-triangle', 'sm')} Google session paused</span> <button class="btn sm primary" data-a="wRenew" style="margin-left:6px">Continue</button>`;
    const m = { idle: ['cloud', 'faint', ''], pending: ['clock', 'faint', 'Unsaved'], saving: ['refresh-cw', 'faint', 'Saving…'], ok: ['check', 'pos', 'Saved'], error: ['alert-triangle', 'neg', 'Offline — will retry'] }[W.status] || ['check', 'pos', ''];
    const phone = W.meta ? 'Phone synced ' + U.ago(W.meta.version) : '';
    return `<span class="${m[1]}">${I(m[0] === 'cloud' ? 'shield-check' : m[0], 'sm')} ${m[2]}</span>${phone ? `<span class="faint"> · ${phone}</span>` : ''}`;
  };

  // Poll for newer phone snapshots
  W.refresh = async function (manual) {
    if (!W.base || document.hidden) return;
    try {
      if (Cloud.diff(Store.S, W.base).length) await W.push();
      const meta = await Cloud.meta();
      if (!meta) return;
      if (!manual && W.meta && meta.version === W.meta.version) { W.setStatus(W.status); return; }
      const S = await W.pull(false);
      W.install(S);
      App.render();
      if (manual) UI.toast('Up to date with your phone', 'check');
    } catch (e) { if (e.auth) W.setStatus('signin'); else if (manual) UI.toast(e.message, 'alert-triangle'); }
  };
  setInterval(() => W.refresh(false), 20000);
  window.addEventListener('focus', () => { if (Date.now() - W.lastPull > 5000) W.refresh(false); });

  /* ---------------- Google sign-in (OAuth token flow, scope drive.appdata) ---------------- */
  const store = () => (localStorage.getItem('clearli.remember') === '0' ? sessionStorage : localStorage);
  const loadTok = () => { try { return JSON.parse(store().getItem(TOK) || 'null'); } catch (e) { return null; } };
  const saveTok = (o) => { try { store().setItem(TOK, JSON.stringify(o)); } catch (e) { } };
  W.email = '';
  const webProvider = async () => {
    const t = loadTok();
    if (t && t.t && Date.now() < t.exp - 60000) return { t: t.t, exp: t.exp };
    const e = new Error('Google session paused — click Continue'); e.auth = true; throw e;
  };
  const authUrl = (state, prompt, hint) => {
    const p = new URLSearchParams({ client_id: (window.GCONFIG || {}).webClientId || '', redirect_uri: location.origin + location.pathname, response_type: 'token', scope: Drive.SCOPE, include_granted_scopes: 'true', state });
    if (prompt) p.set('prompt', prompt);
    if (hint) p.set('login_hint', hint);
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
  };
  // Opens Google in a popup; resolves with {t, exp}. Falls back to a full-page redirect if popups are blocked.
  W.oauth = function (prompt, hint) {
    if (!(window.GCONFIG || {}).webClientId) return Promise.reject(new Error('Google sign-in isn\'t set up for this site yet.'));
    const state = 'web' + Math.random().toString(36).slice(2);
    return new Promise((res, rej) => {
      let done = false; let bc = null;
      const finish = (m) => {
        if (done || !m || m.state !== state) return; done = true;
        try { bc && bc.close(); } catch (e) { } window.removeEventListener('storage', onStore); clearInterval(poll);
        try { localStorage.removeItem('clearli.authmsg'); } catch (e) { }
        if (m.err || !m.t) rej(new Error(m.err === 'access_denied' ? 'Sign-in cancelled' : 'Google sign-in failed' + (m.err ? ': ' + m.err : ''))); else res({ t: m.t, exp: m.exp });
      };
      const onStore = (e) => { if (e.key === 'clearli.authmsg' && e.newValue) { try { finish(JSON.parse(e.newValue)); } catch (x) { } } };
      try { bc = new BroadcastChannel('clearli-auth'); bc.onmessage = (e) => finish(e.data); } catch (e) { }
      window.addEventListener('storage', onStore);
      const w = window.open(authUrl(state, prompt, hint), 'clearli-auth', 'width=500,height=650');
      if (!w) { sessionStorage.setItem('clearli.after', state); location.href = authUrl(state, prompt, hint); return; }
      const poll = setInterval(() => { let closed = false; try { closed = w.closed; } catch (e) { } if (closed) setTimeout(() => { if (!done) { done = true; clearInterval(poll); rej(new Error('Sign-in window closed')); } }, 800); }, 700);
    });
  };
  const gotToken = async (tk) => {
    saveTok(Object.assign({}, tk, { email: W.email }));
    Drive.tok = null;
    const email = await Drive.email();
    W.email = email; saveTok({ t: tk.t, exp: tk.exp, email });
    return email;
  };
  W.renew = async function () {
    try {
      const old = loadTok();
      const tk = await W.oauth('', old && old.email);
      await gotToken(tk);
      W.setStatus('ok');
      await W.refresh(true);
    } catch (e) { UI.toast(e.message, 'alert-triangle'); }
  };

  const F = { remember: true, busy: false, err: '' };
  W.gate = function () {
    const el = document.getElementById('onb');
    const I = U.icon;
    const old = loadTok();
    document.body.classList.add('onb');
    el.style.display = 'flex';
    el.innerHTML = `<div class="inner" style="max-width:420px"><div class="logo"><img src="icon.png" alt=""></div><h1 class="hero-t">Clearli Web</h1><p class="hero-s">Your phone's data, from your own Google Drive.</p>
      <div class="g pad">
        <div class="small muted" style="margin-bottom:14px">Sign in with the Google account your phone syncs to. Clearli only sees its own private folder in your Drive — none of your other files.</div>
        <label class="row small muted" style="margin:4px 4px 14px;gap:8px;cursor:pointer"><input type="checkbox" id="wRem" ${F.remember ? 'checked' : ''}> Remember on this computer</label>
        ${F.err ? `<div class="small neg" style="margin:0 4px 12px">${I('alert-triangle', 'sm')} ${U.esc(F.err)}</div>` : ''}
        <button class="btn primary block" id="wGo" ${F.busy ? 'disabled' : ''}>${F.busy ? '<div class="spin"></div> Loading…' : (window.App && App.gIcon ? App.gIcon() : '') + (old && old.email ? ' Continue as ' + U.esc(old.email) : ' Sign in with Google')}</button>
        ${old && old.email ? '<div class="center" style="margin-top:10px"><a href="#" id="wSwitch" class="link small">Use another account</a></div>' : ''}
      </div><p class="tiny faint center" style="margin-top:14px">No Clearli server. Data goes straight between this browser and your Google Drive.</p></div>`;
    el.querySelector('#wGo').onclick = () => W.signIn(old && old.email);
    const sw = el.querySelector('#wSwitch'); if (sw) sw.onclick = (e) => { e.preventDefault(); W.signIn(null, true); };
  };
  W.signIn = async function (hint, switching) {
    const el = document.getElementById('onb');
    F.remember = el.querySelector('#wRem') ? el.querySelector('#wRem').checked : F.remember;
    try { localStorage.setItem('clearli.remember', F.remember ? '1' : '0'); } catch (e) { }
    F.err = ''; F.busy = true; W.gate();
    try {
      const tk = await W.oauth(hint && !switching ? '' : 'select_account', switching ? null : hint);
      await afterToken(tk);
    } catch (e) { F.err = e.message; F.busy = false; W.gate(); }
  };
  async function afterToken(tk) {
    Drive.use(); Cloud.device = 'web';
    const prev = (loadTok() || {}).email;
    const email = await gotToken(tk);
    if (prev && prev !== email) await idb.del('cache').catch(() => { });
    W.remember = localStorage.getItem('clearli.remember') !== '0';
    if (W.remember) await localKey(); else { await idb.del('cache').catch(() => { }); await idb.del('ckey').catch(() => { }); }
    const S = await W.pull(true);
    W.start(S);
  }
  // a non-extractable key that only lives in this browser, for the offline cache
  async function localKey() {
    let k = await idb.get('ckey').catch(() => null);
    if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await idb.set('ckey', k).catch(() => { }); }
    W.ckey = k; return k;
  }
  W.start = function (S) {
    W.install(S);
    document.getElementById('onb').style.display = 'none';
    document.body.classList.remove('onb');
    App.boot();
    W.base = Cloud.baseOf(Store.S);
    W.setStatus('ok');
  };
  W.forget = async function () {
    const t = loadTok();
    if (t && t.t) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.t), { method: 'POST', mode: 'no-cors' }).catch(() => { });
    try { localStorage.removeItem(TOK); sessionStorage.removeItem(TOK); } catch (e) { }
    await idb.del('cache').catch(() => { }); await idb.del('ckey').catch(() => { });
    location.reload();
  };

  // Boot: come straight back in when there is a valid token, or show the cached copy while the session is paused.
  W.init = async function () {
    Cloud.device = 'web';
    Drive.use(); Drive.provider = webProvider;
    W.remember = localStorage.getItem('clearli.remember') !== '0';
    if (hashTok && hashTok.t) { try { await afterToken(hashTok); return; } catch (e) { F.err = e.message; } }
    else if (hashTok && hashTok.err) F.err = hashTok.err === 'access_denied' ? 'Sign-in cancelled' : 'Google sign-in failed: ' + hashTok.err;
    const tk = loadTok();
    if (tk && tk.email) W.email = tk.email;
    if (W.remember) await localKey().catch(() => null);
    if (tk && tk.t && Date.now() < tk.exp - 60000) {
      try { W.start(await W.pull(false)); return; }
      catch (e) { if (!e.auth) { F.err = e.message; } }
    }
    // token expired (Google web tokens last 1 hour): show the cached copy and offer one-click Continue
    const cache = W.ckey ? await idb.get('cache').catch(() => null) : null;
    if (cache && tk && tk.email) {
      try { const snap = await Cloud.unzip(await Cloud.decrypt(cache.iv, cache.data, W.ckey), cache.gz); W.meta = { version: cache.version }; W.start(compose(snap, [])); W.setStatus('signin'); return; } catch (x) { }
    }
    W.gate();
  };
  document.addEventListener('DOMContentLoaded', () => { W.init(); });
  window.addEventListener('load', () => { UI.on('wRenew', () => W.renew()); });

  /* ---------------- web-specific screens & overrides (after app scripts load) ---------------- */
  window.addEventListener('load', () => {
    const I = U.icon;
    App.doSync = async function () {
      const btn = document.querySelector('[data-a="sync"] .ic'); if (btn) btn.style.animation = 'sp 1s linear infinite';
      await W.refresh(true);
      if (btn) btn.style.animation = '';
    };
    App.runBackfill = async function () { };
    const _home = App.screens.home;
    App.screens.home = function () {
      const r = _home();
      r.body = `<div class="small" id="webStatus" style="margin:0 4px 10px">${W.statusHtml()}</div>` + r.body;
      return r;
    };
    const row = (icon, color, title, sub, a, x) => `<div class="item tap" data-a="${a}" data-x="${x || ''}">${UI.bubble(icon, color)}<div class="grow"><div class="t">${title}</div>${sub ? `<div class="s ell">${sub}</div>` : ''}</div>${I('chevron-right')}</div>`;
    App.screens.more = function () {
      const S = Store.S;
      let b = `<div class="g pad row">${UI.bubble('shield-check', '#43D9B8')}<div class="grow"><div class="h3">${U.esc(W.email || '')}</div><div class="small muted" id="webStatus">${W.statusHtml()}</div></div><button class="iconbtn g" data-a="sync">${I('refresh-cw')}</button></div>`;
      b += UI.sec('Data') + `<div class="list g">${row('wallet', '#43D9B8', 'Accounts', 'Rename, hide, set types', 'push', 'accounts')}${row('tag', '#FF6FB5', 'Categories', S.cats.length + ' categories', 'push', 'categories')}${row('sparkles', '#FFB547', 'Rules & learning', S.rules.length + ' rules', 'push', 'rules')}</div>`;
      b += UI.sec('Preferences') + `<div class="list g">${row('palette', '#B78CFF', 'Appearance', 'Theme and accent for this computer', 'push', 'appearance')}${row('settings', '#5AC8FA', 'General', `${S.settings.currency} · ${S.settings.apy}% APY`, 'push', 'general')}</div>`;
      b += UI.sec('Import & export') + `<div class="list g">${row('file-text', '#FFB547', 'Import bank file', 'CSV, OFX or QFX — added on your phone at its next sync', 'importFile')}${row('download', '#43D9B8', 'Export transactions (CSV)', '', 'exportCsv')}</div>`;
      b += UI.sec('This computer') + `<div class="list g">${row('log-out', '#FF6B81', 'Sign out & forget this computer', 'Removes the saved sign-in and the local cache', 'wForget')}</div>`;
      b += `<p class="tiny faint" style="margin:14px 6px">Bank connections, SimpleFIN and app lock live on your phone. Edits you make here are saved to your Google Drive and applied by the phone the next time it syncs.</p>`;
      return { title: 'More', body: b };
    };
    UI.on('wForget', async () => { if (await UI.confirm('Forget this computer?', 'Signs out of Google here and removes the local copy. Your data stays in your Google Drive.', 'Sign out', true)) W.forget(); });
  });
})();

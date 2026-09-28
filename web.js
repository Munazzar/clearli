/* Clearli Web — dashboard that reads the phone's end-to-end encrypted snapshot from Firebase.
   Loaded before store.js: provides the "Native" layer for the browser and gates boot until data is decrypted. */
(function () {
  window.CLEARLI_WEB = true;
  window.CLEARLI_DEFER_BOOT = true;
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
    if (!force && cache && cache.version === meta.version) {
      const bytes = await Cloud.decrypt(cache.iv, cache.data);
      snap = await Cloud.unzip(bytes, cache.gz);
    } else {
      const r = await Cloud.pullSnapshot(meta);
      snap = r.json;
      if (W.remember) { const c = await Cloud.encrypt(await Cloud.zip(snap)); idb.set('cache', { version: meta.version, iv: c.iv, data: c.data, gz: Cloud.gz }).catch(() => { }); }
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
    } catch (e) { W.setStatus('error', e.message); clearTimeout(pushT); pushT = setTimeout(W.push, 15000); }
  };
  W.setStatus = function (s, msg) {
    W.status = s; W.statusMsg = msg || '';
    const el = document.getElementById('webStatus'); if (el) el.innerHTML = W.statusHtml();
  };
  W.statusHtml = function () {
    const I = U.icon;
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
      if (manual || meta.by === 'phone') UI.toast('Up to date with your phone', 'check');
    } catch (e) { if (manual) UI.toast(e.message, 'alert-triangle'); }
  };
  setInterval(() => W.refresh(false), 60000);
  window.addEventListener('focus', () => { if (Date.now() - W.lastPull > 15000) W.refresh(false); });

  /* ---------------- sign-in / unlock screen ---------------- */
  const F = { email: '', password: '', pass: '', remember: true, busy: false, err: '', need: 'login' };
  W.gate = function () {
    const el = document.getElementById('onb');
    const I = U.icon;
    document.body.classList.add('onb');
    el.style.display = 'flex';
    el.innerHTML = `<div class="inner" style="max-width:420px"><div class="logo"><img src="icon.png" alt=""></div><h1 class="hero-t">Clearli Web</h1><p class="hero-s">Your phone's data, decrypted only on this computer.</p>
      <div class="g pad">
        ${F.need === 'login' ? `<label class="field"><span>Email</span><input class="inp" id="wEmail" type="email" autocomplete="username" value="${U.esc(F.email)}"></label>
        <label class="field"><span>Password</span><input class="inp" id="wPw" type="password" autocomplete="current-password"></label>` : `<div class="small muted" style="margin-bottom:12px">${I('check', 'sm')} ${U.esc(Cloud.auth && Cloud.auth.email || '')} · <a href="#" id="wSwitch" class="link">switch</a></div>`}
        <label class="field"><span>Sync passphrase</span><input class="inp" id="wPass" type="password" autocomplete="off"></label>
        <label class="row small muted" style="margin:4px 4px 14px;gap:8px;cursor:pointer"><input type="checkbox" id="wRem" ${F.remember ? 'checked' : ''}> Remember on this computer</label>
        ${F.err ? `<div class="small neg" style="margin:0 4px 12px">${I('alert-triangle', 'sm')} ${U.esc(F.err)}</div>` : ''}
        <button class="btn primary block" id="wGo" ${F.busy ? 'disabled' : ''}>${F.busy ? '<div class="spin"></div> Decrypting…' : I('lock') + ' Unlock'}</button>
      </div><p class="tiny faint center" style="margin-top:14px">Nothing is decrypted on any server. Your passphrase never leaves this browser.</p></div>`;
    const go = () => W.unlock();
    el.querySelector('#wGo').onclick = go;
    el.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    const sw = el.querySelector('#wSwitch'); if (sw) sw.onclick = (e) => { e.preventDefault(); W.forget(); };
    const first = el.querySelector(F.need === 'login' ? '#wEmail' : '#wPass'); if (first) setTimeout(() => first.focus(), 50);
  };
  W.unlock = async function () {
    const el = document.getElementById('onb');
    const v = (id) => { const i = el.querySelector(id); return i ? i.value : ''; };
    if (F.need === 'login') { F.email = v('#wEmail').trim(); F.password = v('#wPw'); }
    F.pass = v('#wPass'); F.remember = el.querySelector('#wRem').checked; F.err = ''; F.busy = true; W.gate();
    try {
      if (F.need === 'login') { await Cloud.signIn(F.email, F.password); F.need = 'pass'; }
      await Cloud.setupKey(F.pass, { allowCreate: false, extractable: false });
      W.remember = F.remember;
      if (F.remember) { await idb.set('auth', { uid: Cloud.auth.uid, email: Cloud.auth.email, refreshToken: Cloud.auth.refreshToken }); await idb.set('key', Cloud.key); }
      else { await idb.del('auth'); await idb.del('key'); await idb.del('cache'); }
      const S = await W.pull(true);
      W.start(S);
    } catch (e) { F.err = e.message; F.busy = false; if (e.auth) F.need = 'login'; W.gate(); }
    F.password = ''; F.pass = '';
  };
  W.start = function (S) {
    W.install(S);
    document.getElementById('onb').style.display = 'none';
    document.body.classList.remove('onb');
    App.boot();
    W.base = Cloud.baseOf(Store.S);
    W.setStatus('ok');
  };
  W.forget = async function () {
    await idb.del('auth').catch(() => { }); await idb.del('key').catch(() => { }); await idb.del('cache').catch(() => { });
    Cloud.auth = null; Cloud.key = null; F.need = 'login'; location.reload();
  };
  W.lock = function () { Cloud.key = null; location.reload(); };

  // Boot: use remembered sign-in + key if present
  W.init = async function () {
    Cloud.device = 'web';
    Cloud.onAuth = (a) => { if (W.remember) idb.set('auth', { uid: a.uid, email: a.email, refreshToken: a.refreshToken }).catch(() => { }); };
    let auth = null, key = null;
    try { auth = await idb.get('auth'); key = await idb.get('key'); } catch (e) { }
    if (auth) { Cloud.auth = Object.assign({ idToken: null, exp: 0 }, auth); F.need = 'pass'; W.remember = true; }
    if (auth && key) {
      Cloud.key = key;
      try { W.start(await W.pull(false)); return; }
      catch (e) {
        // offline: fall back to the encrypted local cache
        const cache = await idb.get('cache').catch(() => null);
        if (cache && !e.auth) { try { const snap = await Cloud.unzip(await Cloud.decrypt(cache.iv, cache.data), cache.gz); W.start(compose(snap, [])); W.setStatus('error'); return; } catch (x) { } }
        F.err = e.message; if (e.auth) F.need = 'login';
      }
    }
    W.gate();
  };
  document.addEventListener('DOMContentLoaded', () => { W.init(); });

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
      let b = `<div class="g pad row">${UI.bubble('shield-check', '#43D9B8')}<div class="grow"><div class="h3">${U.esc(Cloud.auth ? Cloud.auth.email : '')}</div><div class="small muted" id="webStatus">${W.statusHtml()}</div></div><button class="iconbtn g" data-a="sync">${I('refresh-cw')}</button></div>`;
      b += UI.sec('Data') + `<div class="list g">${row('wallet', '#43D9B8', 'Accounts', 'Rename, hide, set types', 'push', 'accounts')}${row('tag', '#FF6FB5', 'Categories', S.cats.length + ' categories', 'push', 'categories')}${row('sparkles', '#FFB547', 'Rules & learning', S.rules.length + ' rules', 'push', 'rules')}</div>`;
      b += UI.sec('Preferences') + `<div class="list g">${row('palette', '#B78CFF', 'Appearance', 'Theme and accent for this computer', 'push', 'appearance')}${row('settings', '#5AC8FA', 'General', `${S.settings.currency} · ${S.settings.apy}% APY`, 'push', 'general')}</div>`;
      b += UI.sec('Import & export') + `<div class="list g">${row('file-text', '#FFB547', 'Import bank file', 'CSV, OFX or QFX — added on your phone at its next sync', 'importFile')}${row('download', '#43D9B8', 'Export transactions (CSV)', '', 'exportCsv')}</div>`;
      b += UI.sec('This computer') + `<div class="list g">${row('lock', '#7C8CFF', 'Lock now', 'Asks for your passphrase again', 'wLock')}${row('log-out', '#FF6B81', 'Sign out & forget this computer', 'Removes the saved sign-in, key and encrypted cache', 'wForget')}</div>`;
      b += `<p class="tiny faint" style="margin:14px 6px">Bank connections, SimpleFIN and app lock live on your phone. Edits you make here are encrypted and applied by the phone the next time it syncs.</p>`;
      return { title: 'More', body: b };
    };
    UI.on('wLock', () => W.lock());
    UI.on('wForget', async () => { if (await UI.confirm('Forget this computer?', 'You will need your email, password and passphrase to open Clearli here again.', 'Sign out', true)) W.forget(); });
  });
})();

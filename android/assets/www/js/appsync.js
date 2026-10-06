/* Clearli (phone) — sync for the web dashboard and household phones.
   Storage: the user's own Google Drive (private app folder). Older installs may still be on Firebase
   (end-to-end encrypted) until they tap "Move to Google Drive".
   Phone = source of truth: pulls edits made on the web, applies them, uploads a fresh snapshot. */
(function () {
  if (window.CLEARLI_WEB) return;
  const I = U.icon;
  App.WEB_URL = 'https://munazzar.github.io/clearli/';
  const sy = () => Store.S.sync || null;
  const isMember = () => !!(sy() && sy().enabled && sy().role === 'member');
  App.isMember = isMember;
  let busy = false, dirty = false, timer = null, ready = false;
  let memberBase = null; // what the cloud already has (member phones send only their changes)

  const isDrive = () => !!(sy() && sy().backend === 'drive');
  App.isDriveSync = isDrive;
  // Access tokens come from the native side, which keeps the Google sign-in and renews it silently.
  const gProvider = async (force) => {
    const r = await Store.N.call('googleToken', force ? '1' : '0');
    if (!r.ok) { const e = new Error(r.error || 'Google sign-in needed'); e.auth = !!r.signin; throw e; }
    return { t: r.token, exp: r.exp };
  };
  App.googleSignIn = async function (hint) {
    const G = window.GCONFIG || {};
    if (!G.appClientId) throw new Error('Google sign-in isn\'t set up in this build yet.');
    const r = await Store.N.call('googleSignIn', G.appClientId, G.appClientSecret || '', hint || '');
    if (!r.ok) throw new Error(r.error === 'cancelled' ? 'Sign-in cancelled' : (r.error || 'Sign-in failed'));
    Drive.use(); Drive.provider = gProvider; Drive.tok = { t: r.token, exp: r.exp };
    return Drive.email();
  };
  App.cloudInit = async function () {
    const s = sy(); ready = false;
    if (!s || !s.enabled) return false;
    if (s.backend === 'drive') {
      Cloud.device = s.role === 'member' ? 'member' : 'phone';
      Drive.use(); Drive.provider = gProvider; ready = true;
      return true;
    }
    try {
      Cloud.device = s.role === 'member' ? 'member' : 'phone';
      Cloud.auth = { uid: s.uid, email: s.email, refreshToken: s.refreshToken, idToken: null, exp: 0 };
      Cloud.onAuth = (a) => { s.refreshToken = a.refreshToken; Store.save(); };
      Cloud.key = await Cloud.importRaw(s.keyRaw);
      ready = true;
    } catch (e) { s.lastErr = e.message; }
    return ready;
  };

  // Mark local changes; upload shortly after the last one.
  const _commit = Store.commit;
  Store.commit = function (opts) {
    _commit(opts);
    if (!sy() || !sy().enabled || (opts && opts.fromCloud)) return;
    if (isMember()) {
      // queue just what changed; it's sent within a couple of seconds (and kept if offline)
      if (!memberBase) memberBase = Cloud.baseOf(Store.S);
      const ops = Cloud.diff(Store.S, memberBase);
      if (ops.length) { const s = sy(); s.queue = (s.queue || []).concat(ops); memberBase = Cloud.baseOf(Store.S); Store.save(); }
      clearTimeout(timer); timer = setTimeout(() => App.cloudTick(), 1500);
      return;
    }
    dirty = true; clearTimeout(timer); timer = setTimeout(() => App.cloudTick(), 4000);
  };

  /* ---------- household member phone: follows the main phone's data ---------- */
  const KEEP_LOCAL = ['theme', 'accent', 'hideAmounts', 'reduceFx', 'lock', 'lockAfter', 'secureScreen', 'onboarded', 'autoSync'];
  App.memberInstall = function (snapJson, batches) {
    const old = Store.S;
    const S = JSON.parse(snapJson);
    for (const b of batches || []) Cloud.apply(S, b.ops);
    const s = old.sync;
    if (s && s.queue && s.queue.length) Cloud.apply(S, s.queue); // our own edits not uploaded yet
    const f = Store.fresh();
    for (const k of Object.keys(f)) if (S[k] === undefined) S[k] = f[k];
    S.settings = Object.assign({}, f.settings, S.settings);
    KEEP_LOCAL.forEach((k) => { if (old.settings[k] !== undefined) S.settings[k] = old.settings[k]; });
    S.sync = s; S.quota = old.quota; S.backfill = null;
    Store.S = S; U.currency = S.settings.currency || 'USD';
    Store.recompute();
    memberBase = Cloud.baseOf(Store.S);
    Store.save();
  };
  async function memberTick(force) {
    const s = sy();
    if (s.queue && s.queue.length) { const q = s.queue; await Cloud.pushOps(q); s.queue = s.queue.slice(q.length); Store.save(); }
    const meta = await Cloud.meta();
    if (!meta) { s.lastErr = isDrive() ? 'The main phone hasn\'t uploaded to this Google account yet.' : 'Nothing found — if the main phone moved to Google Drive, tap "Move to Google Drive" here too.'; return; }
    const ops = await Cloud.pullOps();
    const sig = meta.version + ':' + ops.map((b) => b.id).join(',');
    if (!force && sig === s.lastSig) { s.lastCheck = Date.now(); return; }
    const r = await Cloud.pullSnapshot(meta);
    App.memberInstall(r.json, ops);
    s.needSignIn = false;
    s.lastSig = sig; s.lastVersion = meta.version; s.lastPull = Date.now(); s.lastCheck = Date.now(); s.lastErr = '';
    Store.save();
    const ae = document.activeElement;
    if (!(ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) { App.render(); if (UI.sheets.length) UI.renderSheet(); }
  }

  App.cloudTick = async function (force) {
    const s = sy();
    if (busy || !s || !s.enabled) return;
    if (!ready && !(await App.cloudInit())) return;
    busy = true;
    try {
      if (isMember()) { await memberTick(force); return; }
      const batches = await Cloud.pullOps();
      if (batches.length) {
        for (const b of batches) Cloud.apply(Store.S, b.ops);
        Store.commit({ silent: true, fromCloud: true });
        await Cloud.deleteOps(batches.map((b) => b.id));
        dirty = true;
        const n = batches.reduce((x, b) => x + b.ops.length, 0);
        if (n) UI.toast(`Applied ${n} change${n > 1 ? 's' : ''} from your other devices`, 'layers');
        App.render();
      }
      if (dirty || force || !s.lastPush) {
        dirty = false;
        const r = await Cloud.pushSnapshot(Cloud.snapshotOf(Store.S), s.lastN || 0);
        s.lastPush = Date.now(); s.lastVersion = r.version; s.lastN = r.n; s.lastSize = r.stored; s.lastErr = ''; s.needSignIn = false;
        Store.save();
      }
    } catch (e) {
      s.lastErr = e.message; Store.save();
      if (e.auth && isDrive()) { if (!s.needSignIn) UI.toast('Google sign-in needed — More → Web dashboard & sync', 'alert-triangle'); s.needSignIn = true; Store.save(); }
      else if (e.auth) { s.enabled = false; ready = false; UI.toast('Sync sign-in expired — sign in again under More → Web dashboard', 'alert-triangle'); }
    } finally { busy = false; const card = document.getElementById('syncCard'); if (card) card.innerHTML = App.syncCardHtml(); }
  };
  /* ---------- bank sync only while signed in to Google ----------
     When this build has Google sign-in, SimpleFIN is pulled only by the main phone while it is signed in, so
     bank data always lands in the user's own Drive vault and a signed-out phone never talks to SimpleFIN. */
  let gateToasted = false;
  App.googleReady = () => !!(window.GCONFIG || {}).appClientId;
  App.bankSyncBlocked = function () {
    if (!App.googleReady() || Store.S.settings.demo) return '';
    const s = sy();
    if (!s || !s.enabled) return 'Sign in with Google to sync your banks';
    if (s.backend === 'drive' && s.needSignIn) return 'Sign in to Google again to sync your banks';
    return ''; // signed in (or on the old Firebase sync, which has its own sign-in); members never pull banks
  };
  const _storeSync = Store.sync;
  Store.sync = async function (opts) { const why = App.bankSyncBlocked(); if (why) return { ok: false, error: why, signin: true }; return _storeSync(opts); };
  const _bfRun = Store.backfillRun;
  Store.backfillRun = async function (onStep) { if (App.bankSyncBlocked()) return; return _bfRun(onStep); };
  // after signing in: catch up on banks right away (normal 6-hour auto-sync rules don't apply — we were blocked)
  App.afterGoogle = function () {
    if (isMember() || Store.S.settings.demo || !Store.N.sync('hasCredential')) return;
    setTimeout(() => App.doSync({ silent: true }).then(() => App.runBackfill()), 800);
  };
  // Used by onboarding before connecting SimpleFIN. Resolves 'main', 'member' (joined a household) or null (cancelled).
  App.ensureGoogleMain = async function (progress) {
    if (!App.bankSyncBlocked()) return isMember() ? 'member' : 'main';
    const s = sy();
    if (s && s.enabled && s.needSignIn) { await App.googleSignIn(s.email); s.needSignIn = false; s.lastErr = ''; Store.save(); return 'main'; }
    return App.turnOnDrive(progress);
  };
  App.bankGateHtml = function () {
    const why = App.bankSyncBlocked();
    if (!why || !Store.N.sync('hasCredential')) return '';
    return `<div class="g pad"><div class="row" style="align-items:flex-start">${UI.bubble('shield-check', '#FFB547')}<div class="grow"><div class="h3">${U.esc(why)}</div><div class="small muted" style="margin-top:3px">Clearli syncs with SimpleFIN only while you're signed in, so everything is saved to your own Google Drive.</div></div></div><div class="sp"></div><button class="btn primary block" data-a="${sy() && sy().needSignIn ? 'syReauth' : 'syG'}">${App.gIcon()} Sign in with Google</button></div><div class="sp"></div>`;
  };

  // On a member phone "sync" means: get the latest from the main phone (banks are only pulled there)
  const _doSync = App.doSync;
  App.doSync = async function (opts) {
    if (!isMember()) {
      const why = App.bankSyncBlocked();
      if (why && Store.N.sync('hasCredential')) {
        if (!opts || !opts.silent) { UI.toast(why, 'alert-triangle'); App.go('more'); App.push('websync'); }
        else if (!gateToasted) { gateToasted = true; UI.toast(why + ' — More → Web dashboard & sync', 'alert-triangle'); }
        return { ok: false, error: why, signin: true };
      }
      return _doSync(opts);
    }
    const btn = document.querySelector('[data-a="sync"] .ic'); if (btn) btn.style.animation = 'sp 1s linear infinite';
    await App.cloudTick(true);
    if (btn) btn.style.animation = '';
    if (!opts || !opts.silent) UI.toast(sy().lastErr || 'Up to date with the main phone', sy().lastErr ? 'alert-triangle' : 'check');
    return { ok: !sy().lastErr, added: 0 };
  };

  /* ---------- join screen (onboarding: "We already use Clearli") ---------- */
  const J = { busy: false, err: '' };
  App.joinScreen = function () {
    const el = document.getElementById('onb');
    el.style.display = 'flex'; document.body.classList.add('onb');
    el.innerHTML = `<div class="inner"><div class="logo">${UI.bubble('layers', '#43D9B8')}</div><h1 class="hero-t">Join your household</h1><p class="hero-s">Use the same Clearli as the main phone. Bank connections stay on that phone; this one sees everything and can edit.</p>
      <div class="g pad"><div class="small muted" style="margin-bottom:14px">Sign in with the <b>same Google account</b> the main phone uses for sync. You only do this once — Clearli stays signed in.</div>
        ${J.err ? `<div class="small neg" style="margin:0 4px 12px">${I('alert-triangle', 'sm')} ${U.esc(J.err)}</div>` : ''}
        ${J.busy ? `<div class="row" style="justify-content:center;padding:10px"><div class="spin"></div><span class="muted">${U.esc(J.busy === true ? 'Waiting for Google…' : J.busy)}</span></div>` : `<button class="btn primary block" data-a="joinGo">${App.gIcon()} Sign in with Google</button>`}
      </div><div class="sp"></div><button class="btn block" data-a="joinBack">${I('chevron-left')} Back</button>
      <p class="tiny faint center" style="margin-top:12px">On the main phone, sync must be on (More → Web dashboard & sync).</p></div>`;
  };
  UI.on('obJoin', () => App.joinScreen());
  UI.on('joinBack', () => { if (J.busy) Store.N.sync('googleCancel'); J.busy = false; App.restartOnboarding(); });
  UI.on('joinGo', async () => {
    J.err = ''; J.busy = true; App.joinScreen();
    try {
      Cloud.device = 'member';
      const email = await App.googleSignIn();
      J.busy = 'Downloading…'; App.joinScreen();
      const meta = await Cloud.meta();
      if (!meta) throw new Error('No Clearli data in ' + email + ' yet. Turn on sync on the main phone first, with this Google account.');
      await joinAsMember(email, meta);
      Store.S.settings.onboarded = false; Store.saveNow();
      J.busy = false;
      UI.toast('Joined — ' + Object.keys(Store.S.accounts).length + ' accounts', 'check');
      App.onboardStep(3);
    } catch (e) { J.err = e.message; J.busy = false; App.joinScreen(); }
  });
  async function joinAsMember(email, meta) {
    const keep = Store.S.settings;
    Store.S = Store.fresh(); Store.S.settings = Object.assign(Store.S.settings, keep);
    Store.S.sync = { enabled: true, backend: 'drive', role: 'member', email, queue: [] };
    Cloud.device = 'member'; ready = true;
    const r = await Cloud.pullSnapshot(meta);
    App.memberInstall(r.json, await Cloud.pullOps());
    Store.S.sync.lastVersion = meta.version; Store.S.sync.lastPull = Date.now();
  }
  // background cadence while the app is open
  setInterval(() => { if (document.visibilityState !== 'hidden') App.cloudTick(); }, 30000);
  const _resume = App.onResume;
  App.onResume = function (away) { _resume && _resume(away); setTimeout(() => App.cloudTick(), 1500); };
  const _pause = App.onPause;
  App.onPause = function () { _pause && _pause(); if (dirty) { clearTimeout(timer); App.cloudTick(); } };
  document.addEventListener('DOMContentLoaded', () => { if (isMember()) memberBase = Cloud.baseOf(Store.S); setTimeout(() => App.cloudTick(), isMember() ? 800 : 3000); });

  /* ---------------- UI: More → Web dashboard & sync ---------------- */
  App.syncCardHtml = function () {
    const s = sy();
    if (!s || !s.enabled) return '';
    if (s.role === 'member') return `<div class="row">${UI.bubble('layers', '#43D9B8')}<div class="grow"><div class="h3">Household member</div><div class="small muted ell">${U.esc(s.email)}</div></div>${busy ? '<div class="spin"></div>' : ''}</div>
      <div class="grid2" style="margin-top:14px"><div><div class="tiny faint">Main phone uploaded</div><div class="b">${s.lastVersion ? U.ago(s.lastVersion) : '—'}</div></div><div><div class="tiny faint">Your unsent edits</div><div class="b">${(s.queue || []).length}</div></div></div>
      ${s.needSignIn ? `<div class="sp"></div><button class="btn primary block" data-a="syReauth">${App.gIcon()} Sign in to Google again</button>` : s.lastErr ? `<div class="small warn" style="margin-top:10px">${I('alert-triangle', 'sm')} ${U.esc(s.lastErr)}</div>` : ''}`;
    return `<div class="row">${UI.bubble('layers', '#7C8CFF')}<div class="grow"><div class="h3">Sync is on</div><div class="small muted ell">${U.esc(s.email)}</div></div>${busy ? '<div class="spin"></div>' : ''}</div>
      <div class="grid2" style="margin-top:14px"><div><div class="tiny faint">Last upload</div><div class="b">${s.lastPush ? U.ago(s.lastPush) : 'Not yet'}</div></div><div><div class="tiny faint">${isDrive() ? 'Stored in' : 'Encrypted size'}</div><div class="b">${isDrive() ? 'Your Google Drive' : s.lastSize ? (s.lastSize / 1024).toFixed(0) + ' KB' : '—'}</div></div></div>
      ${s.needSignIn ? `<div class="sp"></div><button class="btn primary block" data-a="syReauth">${App.gIcon()} Sign in to Google again</button>` : s.lastErr ? `<div class="small warn" style="margin-top:10px">${I('alert-triangle', 'sm')} ${U.esc(s.lastErr)}</div>` : ''}`;
  };
  const F = { email: '', password: '', pass: '', pass2: '', step: 'login', busy: false, err: '', newKeys: false };
  App.pageDefs.websync = function () {
    const s = sy();
    let b = '';
    if (s && s.enabled && s.role === 'member') {
      b += `<div class="g pad" id="syncCard">${App.syncCardHtml()}</div>
        <div class="sp"></div><button class="btn primary block" data-a="syUp">${I('refresh-cw', 'sm')} Get latest now</button>
        ${isDrive() ? '' : `<div class="sp"></div><div class="g pad-s small">${I('info', 'sm')} Clearli now syncs through Google Drive. When the main phone has moved, tap below and sign in with the same Google account.</div><div class="sp"></div><button class="btn primary block" data-a="syMove">${App.gIcon()} Move to Google Drive</button>`}
        <p class="small muted" style="margin:14px 4px">This phone shows the household's shared Clearli. Bank data comes from the main phone; your edits (categories, splits, goals, savings…) are merged there within seconds while it's open.</p>
        <div class="list g"><div class="item tap" data-a="syLeave">${UI.bubble('log-out', '#FF6B81')}<div class="grow"><div class="t">Leave household on this phone</div><div class="s">Erases the copy on this phone only</div></div></div></div>`;
      return { title: 'Household sync', body: b };
    }
    if (s && s.enabled) {
      b += `<div class="g pad" id="syncCard">${App.syncCardHtml()}</div>
        <div class="sp"></div><div class="grid2"><button class="btn" data-a="syUp">${I('upload', 'sm')} Sync now</button><button class="btn primary" data-a="syOpen">${I('arrow-up-right', 'sm')} Open web</button></div>
        ${isDrive() ? '' : `<div class="sp"></div><div class="g pad"><div class="h3">${I('sparkles', 'sm')} Move to Google Drive</div><div class="small muted" style="margin:6px 0 12px">Keep your data in your own Google Drive instead of Clearli's Firebase. No passphrase, nothing hosted by anyone else. Your phone uploads everything, then the Firebase copy is deleted.</div><button class="btn primary block" data-a="syMove">${App.gIcon()} Move to Google Drive</button></div>`}
        <p class="small muted" style="margin:14px 4px">On your computer, open <b>${U.esc(App.WEB_URL)}</b> and ${isDrive() ? 'sign in with the same Google account' : 'sign in with the same email and sync passphrase'}. Edits you make there come back to this phone automatically. A household phone can join with the same ${isDrive() ? 'Google account' : 'sign-in'}.</p>
        <div class="list g">
          <div class="item tap" data-a="syOff">${UI.bubble('log-out', '#FFB547')}<div class="grow"><div class="t">Turn off sync on this phone</div><div class="s">Keeps the cloud copy</div></div></div>
          <div class="item tap" data-a="syWipe">${UI.bubble('trash-2', '#FF6B81')}<div class="grow"><div class="t">Delete cloud copy</div><div class="s">${isDrive() ? 'Removes Clearli\'s data from your Google Drive' : 'Removes all encrypted data from Firebase'}</div></div></div>
        </div>`;
    } else {
      b += `<div class="g pad"><div class="row" style="align-items:flex-start">${UI.bubble('shield-check', '#43D9B8')}<div class="grow"><div class="h3">Your data, your Google Drive</div><div class="small muted" style="margin-top:3px">Clearli syncs through a private folder in <b>your own</b> Google Drive that only Clearli can open — it doesn't show up in your Drive files and there's no Clearli server. Your SimpleFIN key never leaves this phone.</div></div></div>${App.bankSyncBlocked() && Store.N.sync('hasCredential') ? `<div class="small warn" style="margin-top:10px">${I('alert-triangle', 'sm')} Bank sync is paused until you sign in.</div>` : ''}</div><div class="sp"></div>
        <div class="list g flat">${[['monitor', 'Web dashboard', 'See everything on a big screen'], ['layers', 'Household phones', 'Your partner signs in with the same Google account'], ['refresh-cw', 'Stays signed in', 'One sign-in, then it renews itself']].map(([ic, t, d]) => `<div class="item">${UI.bubble(ic, '#7C8CFF')}<div class="grow"><div class="t">${t}</div><div class="s">${d}</div></div></div>`).join('')}</div><div class="sp"></div>`;
      if (F.err) b += `<div class="small neg" style="margin:10px 4px">${I('alert-triangle', 'sm')} ${U.esc(F.err)}</div>`;
      b += F.busy ? `<div class="row" style="justify-content:center"><div class="spin"></div><span class="muted">${U.esc(F.busy === true ? 'Waiting for Google…' : F.busy)}</span></div>` : `<button class="btn primary block" data-a="syG">${App.gIcon()} Sign in with Google</button>`;
    }
    return { title: 'Web dashboard & sync', body: b };
  };
  UI.on('syF', (v, el) => { F[el.dataset.x] = v; });

  /* Sign in with Google and make this the main phone. Resolves 'main', 'member' (joined instead) or null (cancelled).
     A vault started on the web (web-first users) is brought onto this phone — merged with what's here — and the
     phone takes over as the main device; the web notices and follows it. */
  App.turnOnDrive = async function (progress) {
    progress = progress || (() => { });
    Cloud.device = 'phone';
    const email = await App.googleSignIn();
    progress('Checking your Drive…');
    const meta = await Cloud.meta();
    // Only one phone may be the main (bank-connected) phone — two would overwrite each other.
    if (meta && meta.by === 'phone' && Date.now() - meta.version < 14 * 86400000) {
      progress(false);
      const pick = await UI.choice('Another phone is already the main phone', `Clearli was uploaded from another phone ${U.ago(meta.version)}. A household should have one main phone that connects to the banks; other phones join as members.`, [
        { id: 'join', label: 'Join as a household member', primary: true },
        { id: 'main', label: 'Make this the main phone instead' },
      ]);
      if (pick === 'join') {
        progress('Downloading…');
        await joinAsMember(email, meta);
        Store.S.settings.demo = false; Store.saveNow();
        return 'member';
      }
      if (pick !== 'main') { Drive.unuse(); return null; }
    }
    let adopted = false;
    if (meta && meta.by === 'web') {
      progress('Bringing in your web data…');
      const r = await Cloud.pullSnapshot(meta);
      App.adoptVault(r.json); adopted = true; // op files waiting in Drive are merged by the first cloudTick below
    }
    Store.S.sync = { enabled: true, backend: 'drive', role: 'main', email, lastPush: 0 };
    ready = true; Store.saveNow();
    progress('Uploading…');
    await App.cloudTick(true);
    if (sy().lastErr) throw new Error(sy().lastErr);
    if (adopted) UI.toast('Brought in your data from Clearli Web', 'layers');
    return 'main';
  };
  // Take over a vault the web dashboard kept. Keeps anything this phone already has (union; the vault wins on conflicts).
  App.adoptVault = function (json) {
    const old = Store.S; const R = JSON.parse(json); const f = Store.fresh();
    const own = !old.settings.demo && Object.keys(old.txns || {}).length > 0;
    const S = R;
    for (const k of Object.keys(f)) if (S[k] === undefined) S[k] = f[k];
    if (own) {
      for (const k of ['txns', 'accounts', 'conns', 'edits', 'reviewed', 'recurringOverrides']) S[k] = Object.assign({}, old[k] || {}, S[k] || {});
      for (const k of ['rules', 'goals', 'assets', 'imports', 'cats']) { const have = new Set((S[k] || []).map((x) => x.id)); S[k] = (S[k] || []).concat((old[k] || []).filter((x) => x && !have.has(x.id))); }
      S.syncLog = (S.syncLog || []).concat(old.syncLog || []).sort((a, b) => b.at - a.at).slice(0, 30);
      S.lastSync = old.lastSync || 0; S.oldest = Math.min(old.oldest || Infinity, S.oldest || Infinity); if (!isFinite(S.oldest)) S.oldest = 0;
      S.backfill = old.backfill;
    } else { S.lastSync = old.lastSync || 0; S.backfill = null; }
    S.settings = Object.assign({}, f.settings, R.settings);
    KEEP_LOCAL.forEach((k) => { if (old.settings[k] !== undefined) S.settings[k] = old.settings[k]; });
    S.settings.demo = false;
    S.sync = old.sync; S.quota = old.quota;
    for (const c of E.DEFAULT_CATS) if (!S.cats.find((x) => x.id === c.id)) S.cats.push(Object.assign({}, c));
    Store.S = S; U.currency = S.settings.currency || 'USD';
    Store.recompute();
    Store.saveNow();
  };
  UI.on('syG', async () => {
    F.err = ''; F.busy = true; App.render();
    try {
      const role = await App.turnOnDrive((m) => { F.busy = m; App.render(); });
      if (role === 'member') { Store.S.settings.onboarded = true; Store.saveNow(); UI.toast('Joined your household', 'layers'); }
      else if (role === 'main') { UI.toast('Sync is on — saved to your Google Drive', 'shield-check'); App.afterGoogle(); }
    } catch (e) { F.err = e.message; }
    F.busy = false; App.render();
  });
  UI.on('syReauth', async () => {
    const s = sy();
    try { await App.googleSignIn(s.email); s.needSignIn = false; s.lastErr = ''; Store.save(); await App.cloudTick(true); App.render(); UI.toast('Signed in again', 'check'); App.afterGoogle(); }
    catch (e) { UI.toast(e.message, 'alert-triangle'); }
  });
  // Firebase → Google Drive, one tap. The phone has everything locally, so it simply re-uploads it.
  UI.on('syMove', async () => {
    const s = sy(); if (!s || isDrive()) return;
    const member = s.role === 'member';
    UI.toast('Sign in with Google…', 'refresh-cw');
    let email;
    try {
      if (!member) { try { await App.cloudTick(true); } catch (e) { } } // merge any last edits waiting in Firebase
      email = await App.googleSignIn();
    } catch (e) { Drive.unuse(); UI.toast(e.message, 'alert-triangle'); return; }
    const old = { uid: s.uid, auth: Cloud.auth };
    try {
      if (member) {
        Store.S.sync = { enabled: true, backend: 'drive', role: 'member', email, queue: s.queue || [] };
        Cloud.device = 'member'; ready = true; Store.saveNow();
        await App.cloudTick(true);
        if (sy().lastErr) throw new Error(sy().lastErr);
        App.render(); UI.toast('This phone now follows Google Drive', 'check');
        return;
      }
      Store.S.sync = { enabled: true, backend: 'drive', role: 'main', email, lastPush: 0 };
      Cloud.device = 'phone'; ready = true; Store.saveNow();
      await App.cloudTick(true);
      if (sy().lastErr) throw new Error(sy().lastErr);
      App.render();
      if (await UI.confirm('Moved to Google Drive', `Everything is now in ${U.esc(email)}'s Google Drive. Delete the old encrypted copy from Firebase? (Do it once your household phone and web dashboard have switched too.)`, 'Delete Firebase copy', true)) {
        try { await wipeFirebase(old); UI.toast('Firebase copy deleted', 'trash-2'); } catch (e) { UI.toast('Could not delete the Firebase copy: ' + e.message, 'alert-triangle'); }
      } else UI.toast('Done — your data now syncs through Google Drive', 'check');
    } catch (e) { Store.S.sync = s; Drive.unuse(); ready = false; Store.saveNow(); App.render(); UI.toast('Move failed: ' + e.message, 'alert-triangle'); }
  });
  async function wipeFirebase(old) {
    if (old.auth) Cloud.auth = old.auth;
    const u = 'users/' + (old.uid || Cloud.auth.uid);
    const ids = [...(await Cloud.list(u + '/vault')).map((d) => u + '/vault/' + d._id), ...(await Cloud.list(u + '/ops')).map((d) => u + '/ops/' + d._id), u + '/meta/state', u + '/meta/keys'];
    await Cloud.commit(ids.map((p) => ({ del: p })));
  }
  UI.on('syGo', async () => {
    F.err = ''; F.busy = true; App.render();
    try {
      Cloud.device = 'phone';
      if (F.step === 'login') {
        await Cloud.signIn(F.email.trim(), F.password);
        F.newKeys = !(await Cloud.get('users/' + Cloud.auth.uid + '/meta/keys'));
        F.step = 'pass'; F.password = '';
      } else {
        if (F.newKeys && F.pass.length < 10) throw new Error('Use at least 10 characters.');
        if (F.newKeys && F.pass !== F.pass2) throw new Error("Passphrases don't match.");
        await Cloud.setupKey(F.pass, { allowCreate: true, extractable: true });
        // Only one phone may be the main (bank-connected) phone — two would overwrite each other.
        const meta = F.newKeys ? null : await Cloud.meta();
        if (meta && Date.now() - meta.version < 14 * 86400000) {
          F.busy = false; App.render();
          const pick = await UI.choice('Another phone is already the main phone', `Clearli was uploaded from another phone ${U.ago(meta.version)}. A household should have one main phone that connects to the banks; other phones join as members.`, [
            { id: 'join', label: 'Join as a household member', primary: true },
            { id: 'main', label: 'Make this the main phone instead' },
          ]);
          if (pick === 'join') {
            F.busy = true; App.render();
            const keep = Store.S.settings;
            Store.S = Store.fresh(); Store.S.settings = Object.assign(Store.S.settings, keep, { onboarded: true, demo: false });
            Store.S.sync = { enabled: true, role: 'member', email: Cloud.auth.email, uid: Cloud.auth.uid, refreshToken: Cloud.auth.refreshToken, keyRaw: await Cloud.exportRaw(Cloud.key), queue: [] };
            Cloud.onAuth = (a) => { Store.S.sync.refreshToken = a.refreshToken; Store.save(); };
            Cloud.device = 'member'; ready = true;
            const r = await Cloud.pullSnapshot(meta);
            App.memberInstall(r.json, await Cloud.pullOps());
            Store.S.sync.lastVersion = meta.version; Store.S.sync.lastPull = Date.now(); Store.saveNow();
            Object.assign(F, { pass: '', pass2: '', step: 'login', busy: false });
            App.render(); UI.toast('Joined your household', 'layers');
            return;
          }
          if (pick !== 'main') { Object.assign(F, { busy: false }); App.render(); return; }
          F.busy = true; App.render();
        }
        Store.S.sync = { enabled: true, email: Cloud.auth.email, uid: Cloud.auth.uid, refreshToken: Cloud.auth.refreshToken, keyRaw: await Cloud.exportRaw(Cloud.key), lastPush: 0, lastN: 0 };
        Cloud.onAuth = (a) => { Store.S.sync.refreshToken = a.refreshToken; Store.save(); };
        Object.assign(F, { pass: '', pass2: '', step: 'login' });
        ready = true; Store.saveNow();
        F.busy = false; App.render();
        await App.cloudTick(true);
        UI.toast('Sync is on — your data is encrypted and uploaded', 'shield-check');
      }
    } catch (e) { F.err = e.message; }
    F.busy = false; App.render();
  });
  UI.on('syUp', async () => { await App.cloudTick(true); App.render(); UI.toast(sy().lastErr ? sy().lastErr : isMember() ? 'Up to date with the main phone' : 'Synced', sy().lastErr ? 'alert-triangle' : 'check'); });
  UI.on('syLeave', async () => {
    if (!(await UI.confirm('Leave the household?', 'Everything on this phone is erased. The main phone and cloud copy are not affected.', 'Leave', true))) return;
    if (isDrive()) Drive.unuse();
    Store.resetAll(); UI.closeAll(); App.pages = []; App.tab = 'home'; App.applyTheme(); App.restartOnboarding();
  });
  UI.on('syOpen', () => Store.N.sync('openUrl', App.WEB_URL));
  UI.on('syOff', async () => { if (!(await UI.confirm('Turn off sync?', isDrive() ? 'This phone stops uploading and signs out of Google. The copy stays in your Google Drive until you delete it.' : 'This phone stops uploading. The encrypted copy stays in Firebase until you delete it.', 'Turn off'))) return; if (isDrive()) { Store.N.sync('googleSignOut'); Drive.unuse(); } Store.S.sync = null; ready = false; Store.saveNow(); App.render(); });
  UI.on('syWipe', async () => {
    if (isDrive()) {
      if (!(await UI.confirm('Delete the cloud copy?', 'Removes Clearli\'s data from your Google Drive and signs this phone out. Your phone keeps its data; the web dashboard and household phones stop getting updates.', 'Delete', true))) return;
      try { await Drive.wipe(); Store.N.sync('googleSignOut'); Drive.unuse(); Store.S.sync = null; ready = false; Store.saveNow(); App.render(); UI.toast('Cloud copy deleted', 'trash-2'); }
      catch (e) { UI.toast(e.message, 'alert-triangle'); }
      return;
    }
    if (!(await UI.confirm('Delete the cloud copy?', 'Removes every encrypted piece, pending web edit and the key check from Firebase. Your phone keeps its data.', 'Delete', true))) return;
    try {
      const u = 'users/' + Cloud.auth.uid;
      const ids = [...(await Cloud.list(u + '/vault')).map((d) => u + '/vault/' + d._id), ...(await Cloud.list(u + '/ops')).map((d) => u + '/ops/' + d._id), u + '/meta/state', u + '/meta/keys'];
      await Cloud.commit(ids.map((p) => ({ del: p })));
      Store.S.sync = null; ready = false; Store.saveNow(); App.render(); UI.toast('Cloud copy deleted', 'trash-2');
    } catch (e) { UI.toast(e.message, 'alert-triangle'); }
  });
})();

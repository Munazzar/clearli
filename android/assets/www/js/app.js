/* Clearli — app shell: router, header, theme, lock, onboarding, boot */
(function () {
  const I = U.icon;
  const App = {
    tab: 'home', pages: [], scope: { accts: [], conns: [] },
    rep: { seg: 'overview', pid: 'M', off: 0, cmpA: 'thisM', cmpB: 'lastM', items: [], itemsKind: 'cat' },
    act: { q: '', type: 'all', cat: '', range: 'all', from: '', to: '', limit: 120, sel: null, flag: '' },
    plan: { seg: 'goals', cal: U.som(new Date()), calSel: null },
    screens: {}, pageDefs: {}, locked: false, unlocking: false,
  };
  window.App = App;

  // Per-data-version cache so re-renders don't recompute heavy analytics.
  App.memo = function (k, fn) {
    if (App._mv !== Store.V) { App._mv = Store.V; App._mc = {}; }
    const kk = k + '|' + App.scope.accts.join(',') + '|' + App.scope.conns.join(',');
    if (!(kk in App._mc)) App._mc[kk] = fn();
    return App._mc[kk];
  };
  /* How fresh is a bank balance? SimpleFIN refreshes about once a day. */
  App.asOf = function (ms) {
    if (!ms) return { short: '', long: 'Not reported', stale: false };
    const h = (Date.now() - ms) / 3600000;
    const d = new Date(ms); const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const day = U.daysBetween(d, new Date());
    const short = h < 1 ? 'now' : h < 24 ? Math.floor(h) + 'h ago' : Math.floor(h / 24) + 'd ago';
    const long = day === 0 ? 'today ' + time : day === 1 ? 'yesterday ' + time : U.fmtDate(d) + ' ' + time;
    return { short, long, stale: h > 26 };
  };
  App.asOfBadge = function (ms) {
    const x = App.asOf(ms); if (!x.short) return '';
    return `<span class="asof ${x.stale ? 'warn' : 'faint'}" title="Balance as of ${x.long}">${x.stale ? U.icon('alert-triangle', 'sm') : U.icon('clock', 'sm')}${x.short}</span>`;
  };
  // Balance after charges the bank has sent as pending but not yet taken out of the reported balance
  App.afterPending = function (a) {
    if (a.avail != null) return null;
    const pend = Object.values(Store.S.txns).filter((t) => t.acct === a.id && t.pending);
    if (!pend.length) return null;
    return { v: a.balance + pend.reduce((s, t) => s + t.amt, 0), n: pend.length };
  };
  App.list = (opts) => App.memo('list' + (opts && opts.includeExcluded ? 'x' : ''), () => E.scoped(Store.V, App.scope, opts));
  App.insights = () => App.memo('ins', () => E.insights(Store.V, App.list(), Store.S));
  App.S = () => Store.S;

  /* ---------------- theme ---------------- */
  App.applyTheme = function () {
    const s = Store.S.settings;
    document.documentElement.setAttribute('data-theme', s.theme);
    document.body.setAttribute('data-theme', s.theme);
    document.body.style.setProperty('--accent', s.accent || '#7C8CFF');
    document.body.classList.toggle('fx-low', !!s.reduceFx);
    document.body.classList.toggle('hide-amt', !!s.hideAmounts);
    const bg = UI.css('--bg') || '#0B0D1A';
    Store.N.sync('setBars', bg, s.theme !== 'glass-light');
    Store.N.sync('setSecure', s.secureScreen !== false);
    U.currency = s.currency || 'USD';
    UI.applyChartTheme();
  };

  /* ---------------- routing ---------------- */
  const TABS = [['home', 'house', 'Home'], ['calendar', 'calendar', 'Calendar'], ['activity', 'list', 'Activity'], ['reports', 'chart-column', 'Reports'], ['plan', 'target', 'Plan'], ['more', 'settings', 'More']];
  App.go = function (tab) {
    if (App.tab === tab && !App.pages.length) { document.getElementById('view').scrollTo({ top: 0 }); return; }
    App.tab = tab; App.pages = [];
    App.render(true);
  };
  App.push = function (id, arg) { App.pages.push({ id, arg }); App.render(true); };
  App.pop = function () { App.pages.pop(); App.render(true); };
  App.back = function () {
    if (App.locked) return true;
    if (UI.sheets.length) { UI.closeSheet(); return true; }
    if (App.act.sel) { App.act.sel = null; App.render(); return true; }
    if (App.pages.length) { App.pop(); return true; }
    if (App.tab !== 'home') { App.go('home'); return true; }
    return false;
  };

  // Re-render only when the data actually changed (used when a sheet closes)
  App.refresh = function () { if (Store.V !== App._lastV) App.render(); };
  App.render = function (resetScroll) {
    if (!Store.S.settings.onboarded) return;
    App._lastV = Store.V;
    const view = document.getElementById('view');
    const page = App.pages[App.pages.length - 1];
    let r;
    try { r = page ? App.pageDefs[page.id](page.arg) : App.screens[App.tab](); }
    catch (e) { console.log(e && e.stack || e); r = { title: 'Oops', body: UI.empty('alert-triangle', 'Something went wrong', U.esc(String(e))) }; }
    const top = document.getElementById('top');
    top.innerHTML = (page ? `<button class="iconbtn back" data-a="back">${I('chevron-left', 'lg')}</button>` : '') + `<h1 style="${page ? 'font-size:22px' : ''}">${r.title}</h1>` + (r.actions || '');
    const st = view.scrollTop;
    UI.destroyCharts(view);
    view.innerHTML = r.body;
    UI.flushCharts(view);
    view.scrollTop = resetScroll ? 0 : st;
    if (r.after) r.after(view);
    // tab bar
    const tabs = document.getElementById('tabs');
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.x === App.tab));
    App.moveDrop();
    document.getElementById('extra').innerHTML = r.floating || '';
  };
  App.moveDrop = function () {
    const tabs = document.getElementById('tabs');
    const on = tabs.querySelector('button.on'); const drop = tabs.querySelector('.drop');
    if (on && drop) { drop.style.left = on.offsetLeft + 'px'; drop.style.width = on.offsetWidth + 'px'; drop.style.top = on.offsetTop + 'px'; drop.style.height = on.offsetHeight + 'px'; }
  };
  UI.on('tab', (x) => { Store.N.sync('haptic'); App.go(x); });
  UI.on('back', () => App.back());
  UI.on('push', (x, el) => App.push(x, el.dataset.y));

  /* header helpers used by screens */
  App.scopeLabel = function () {
    const S = Store.S; const sc = App.scope;
    if (sc.accts.length === 1) { const a = S.accounts[sc.accts[0]]; return a ? (a.alias || a.name) : 'Account'; }
    if (sc.accts.length > 1) return sc.accts.length + ' accounts';
    if (sc.conns.length === 1) return (S.conns[sc.conns[0]] || {}).name || 'Bank';
    if (sc.conns.length > 1) return sc.conns.length + ' banks';
    return 'All accounts';
  };
  App.scopeBtn = () => `<button class="chip ${App.scope.accts.length || App.scope.conns.length ? 'on' : ''}" data-a="scope">${I('landmark')}<span class="ell" style="max-width:130px">${U.esc(App.scopeLabel())}</span>${I('chevron-down')}</button>`;
  App.eyeBtn = () => `<button class="iconbtn g" data-a="eye">${I(Store.S.settings.hideAmounts ? 'eye-off' : 'eye')}</button>`;
  UI.on('eye', () => { Store.S.settings.hideAmounts = !Store.S.settings.hideAmounts; Store.save(); App.applyTheme(); App.render(); });

  /* scope (bank/account filter) sheet */
  UI.on('scope', () => {
    const S = Store.S;
    const body = () => {
      const sc = App.scope;
      const conns = Object.values(S.conns);
      let h = `<button class="btn block ${!sc.accts.length && !sc.conns.length ? 'primary' : ''}" data-a="scopeAll">All banks & accounts</button><div class="sp"></div>`;
      for (const c of conns) {
        const accts = Object.values(S.accounts).filter((a) => a.conn === c.id && !a.hidden);
        if (!accts.length) continue;
        const cOn = sc.conns.includes(c.id);
        h += `<div class="list g flat" style="margin-bottom:12px"><div class="item tap" data-a="scopeConn" data-x="${U.esc(c.id)}">${UI.bubble('landmark', '#7C8CFF', true)}<div class="grow"><div class="t">${U.esc(c.name)}</div><div class="s">${accts.length} account${accts.length > 1 ? 's' : ''}</div></div><div class="check ${cOn ? 'on' : ''}">${cOn ? I('check') : ''}</div></div>`;
        for (const a of accts) {
          const on = sc.accts.includes(a.id);
          h += `<div class="item tap" data-a="scopeAcct" data-x="${U.esc(a.id)}"><div style="width:40px"></div><div class="grow"><div class="t ell" style="font-size:14px">${U.esc(a.alias || a.name)}</div><div class="s">${U.esc(a.type)}</div></div><div class="small b amt" style="margin-right:8px">${U.money(a.balance, { auto: true })}</div><div class="check ${on ? 'on' : ''}">${on ? I('check') : ''}</div></div>`;
        }
        h += '</div>';
      }
      return h;
    };
    UI.sheet({ title: 'Show data from', body, onClose: () => App.render() });
  });
  UI.on('scopeAll', () => { App.scope = { accts: [], conns: [] }; UI.closeSheet(); });
  UI.on('scopeConn', (id) => { const sc = App.scope; sc.accts = []; sc.conns = sc.conns.includes(id) ? sc.conns.filter((x) => x !== id) : [...sc.conns, id]; UI.renderSheet(); });
  UI.on('scopeAcct', (id) => { const sc = App.scope; sc.conns = []; sc.accts = sc.accts.includes(id) ? sc.accts.filter((x) => x !== id) : [...sc.accts, id]; UI.renderSheet(); });

  /* ---------------- sync ---------------- */
  App.syncing = false;
  App.doSync = async function (opts) {
    if (App.syncing) return;
    App.syncing = true;
    const btn = document.querySelector('[data-a="sync"] .ic'); if (btn) btn.style.animation = 'sp 1s linear infinite';
    const r = await Store.sync(opts);
    App.syncing = false;
    if (btn) btn.style.animation = '';
    if (!opts || !opts.silent || !r.ok) UI.toast(r.ok ? (r.demo ? 'Sample data is up to date' : `Synced · ${r.added} new`) : r.error, r.ok ? 'check' : 'alert-triangle');
    App.render();
    return r;
  };
  UI.on('sync', () => App.doSync());

  /* ---------------- lock ---------------- */
  App.showLock = function () {
    App.locked = true;
    const el = document.getElementById('lock');
    el.style.display = 'flex';
    el.innerHTML = `<div class="inner center"><div class="logo"><img src="icon.png" alt=""></div><div class="hero-t">Clearli is locked</div><p class="hero-s">Your financial data is protected.</p><button class="btn primary block" data-a="unlock">${I('fingerprint')} Unlock</button></div>`;
    setTimeout(App.unlock, 250);
  };
  App.unlock = async function () {
    if (App.unlocking) return;
    App.unlocking = true;
    const r = await Store.N.call('requestUnlock');
    App.unlocking = false;
    if (r.ok) { App.locked = false; document.getElementById('lock').style.display = 'none'; }
  };
  UI.on('unlock', () => App.unlock());
  App.onPause = function () { App.pausedAt = Date.now(); Store.saveNow(); };
  App.onResume = function (awayMs) {
    const s = Store.S.settings;
    if (s.lock && awayMs >= (s.lockAfter || 0) * 1000 && !App.unlocking) App.showLock();
    if (s.autoSync && !s.demo && Store.S.lastSync && Date.now() - Store.S.lastSync > 6 * 3600000) App.doSync({ silent: true }).then(() => App.runBackfill());
    else App.runBackfill();
  };

  /* ---------------- history range picker + background backfill ---------------- */
  const BACKS = [['90', '3 months'], ['180', '6 months'], ['365', '1 year'], ['730', '2 years'], ['1095', '3 years'], ['custom', 'Pick a date']];
  App.histTarget = (st) => (st.back === 'custom' ? (st.date ? +U.parseInputDate(st.date) : Date.now() - 365 * U.DAY) : +U.sod(U.addDays(new Date(), -Number(st.back))));
  App.histPicker = function (st, act, fromMs) {
    const target = App.histTarget(st);
    const from = fromMs || Date.now();
    const req = Math.max(0, Math.ceil((from - target) / Store.BF_WIN));
    const perDay = Store.BF_BUDGET;
    const days = Math.max(1, Math.ceil(req / perDay));
    return `<div class="chips wrap">${BACKS.map(([id, l]) => `<button class="chip ${st.back === id ? 'on' : ''}" data-a="${act}" data-x="${id}">${l}</button>`).join('')}</div>
      ${st.back === 'custom' ? `<input type="date" class="inp" style="margin:6px 0 4px" data-ch="${act}Date" max="${U.inputDate(new Date())}" value="${st.date || U.inputDate(target)}">` : ''}
      <div class="small muted" style="margin:6px 4px 0">${req ? `From <b>${U.fmtDate(target, { year: true })}</b> · about <b>${req}</b> request${req > 1 ? 's' : ''} of 45 days${days > 1 ? `, spread over ~${days} days to respect SimpleFIN's daily limit` : ''}. Banks that keep less history simply stop earlier.` : 'Already loaded.'}</div>`;
  };
  App.runBackfill = async function () {
    const bf = Store.S.backfill;
    if (!bf || !bf.active || Store.backfillBusy()) return;
    await Store.backfillRun((b) => {
      const pill = document.getElementById('bfPill'); if (pill) pill.innerHTML = App.bfPillHtml();
      const card = document.getElementById('bfCard'); if (card) card.innerHTML = App.bfCardHtml();
    });
    const ae = document.activeElement;
    if (!(ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) && !UI.sheets.length) App.render();
    const b = Store.S.backfill;
    if (b && b.status === 'done') UI.toast('Older history loaded', 'check');
    else if (b && b.status === 'nohistory') UI.toast('Loaded all the history your banks provide', 'check');
  };
  App.bfPillHtml = function () {
    const bf = Store.S.backfill;
    if (!bf || !bf.active) return '';
    return `${I('download', 'sm')} ${bf.status === 'waiting' ? 'History continues tomorrow' : 'Loading history · ' + U.fmtMonth(bf.cursor, true)}`;
  };
  App.bfCardHtml = function () {
    const S = Store.S; const bf = S.backfill;
    const oldestTx = Object.values(S.txns).reduce((m, t) => Math.min(m, t.ts), Date.now());
    const has = Object.keys(S.txns).length > 0;
    let h = `<div class="row between"><div><div class="tiny faint">Oldest transaction</div><div class="b">${has ? U.fmtDate(oldestTx, { year: true }) : '—'}</div></div><div style="text-align:right"><div class="tiny faint">Requests today</div><div class="b">${Store.quotaUse(0)} / 24</div></div></div>`;
    if (bf && bf.active) {
      const pct = (bf.started - bf.cursor) / Math.max(1, bf.started - bf.target);
      const left = Math.max(0, Math.ceil((bf.cursor - bf.target) / Store.BF_WIN));
      h += `<div style="margin:14px 0 6px">${UI.progress(pct)}</div><div class="small muted">${bf.status === 'waiting' ? I('clock', 'sm') + ' ' + U.esc(bf.msg) : bf.status === 'error' ? `<span class="warn">${I('alert-triangle', 'sm')} ${U.esc(bf.msg)}</span>` : `Loading back to ${U.fmtDate(bf.target, { year: true })} · reached ${U.fmtMonth(bf.cursor, true)}`} · ~${left} request${left === 1 ? '' : 's'} left</div>
        <div class="grid2" style="margin-top:12px">${bf.status !== 'waiting' && !Store.backfillBusy() ? `<button class="btn sm" data-a="bfResume">${I('refresh-cw', 'sm')} Resume now</button>` : '<div></div>'}<button class="btn sm danger" data-a="bfStop">${I('x', 'sm')} Stop</button></div>`;
    } else {
      if (bf && bf.status === 'nohistory') h += `<div class="small muted" style="margin-top:10px">${I('info', 'sm')} Your banks don't provide anything older than this.</div>`;
      h += `<div class="sp"></div><button class="btn block" data-a="bfOpen">${I('calendar-clock')} Load older history</button>`;
    }
    return h;
  };
  UI.on('bfStop', () => { Store.backfillStop(); App.render(); });
  UI.on('bfResume', () => { const bf = Store.S.backfill; if (bf) { bf.active = true; bf.status = 'running'; } App.runBackfill(); App.render(); });
  UI.on('bfOpen', () => {
    if (Store.S.settings.demo) return UI.toast('Connect SimpleFIN to load real history', 'info');
    const st = { back: '730', date: '' };
    const from = () => Math.min(Store.S.oldest || Date.now(), Date.now());
    UI.on('bfPick', (x) => { st.back = x; UI.renderSheet(); });
    UI.on('bfPickDate', (v) => { st.date = v; UI.renderSheet(); });
    UI.on('bfGo', () => {
      const t = App.histTarget(st);
      if (!Store.backfillStart(t)) { UI.toast('That range is already loaded', 'info'); return; }
      UI.closeSheet(); App.render(); App.runBackfill();
      UI.toast('Loading history in the background', 'download');
    });
    UI.sheet({ title: 'Load older history', body: () => `<p class="small muted" style="margin-top:0">You have data back to <b>${U.fmtDate(from(), { year: true })}</b>. How far back should Clearli go?</p>${App.histPicker(st, 'bfPick', from())}<p class="tiny faint" style="margin:12px 4px 0">Runs quietly while the app is open, a few seconds apart, and picks up where it left off next time. Normal syncs always keep priority.</p>`, foot: `<button class="btn primary block" data-a="bfGo">Start</button>` });
  });

  /* ---------------- onboarding ---------------- */
  const OB = { step: 0, token: '', busy: false, err: '', progress: '', back: '365', date: '' };
  App.onboard = function () {
    const el = document.getElementById('onb');
    el.style.display = 'flex';
    document.body.classList.add('onb');
    const s = Store.S.settings;
    const dots = `<div class="dots-nav">${[0, 1, 2, 3].map((i) => `<i class="${i === OB.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let h = '';
    if (OB.step === 0) {
      h = `<div class="logo"><img src="icon.png" alt=""></div><h1 class="hero-t">Money, made clear.</h1><p class="hero-s">Find hidden expenses, see every account in one place, and plan what you want to save for.</p>
      <div class="g pad">${[
        ['sparkles', '#7C8CFF', 'Leak finder', 'Spots subscriptions, price hikes, fees and duplicate charges.'],
        ['chart-pie', '#FF6FB5', 'Deep reports', 'Day to 2-year views, trends and side-by-side comparisons.'],
        ['calendar-clock', '#43D9B8', 'Recurring calendar', 'Every bill and paycheck, predicted on a calendar.'],
        ['target', '#FFB547', 'Savings planner', 'How much to save, where to cut and how to earn more.'],
      ].map(([ic, c, t, d]) => `<div class="feat">${UI.bubble(ic, c)}<div><div class="h3">${t}</div><div class="small muted">${d}</div></div></div>`).join('')}</div>
      ${dots}<button class="btn primary block" data-a="obNext">Get started</button>`;
    } else if (OB.step === 1) {
      h = `<div class="logo">${UI.bubble('shield-check', '#43D9B8')}</div><h1 class="hero-t">Private by design</h1><p class="hero-s">Your finances never touch a Clearli server — there isn't one.</p>
      <div class="g pad">${[
        ['lock', 'Encrypted on this phone', 'All data is sealed with AES-256 using a key locked in Android Keystore hardware.'],
        ['eye-off', 'No tracking, no ads', 'No analytics, no accounts, no third parties. The interface itself is blocked from the internet.'],
        ['landmark', 'Read-only bank access', 'SimpleFIN can only read balances and transactions. It can never move money.'],
        ['fingerprint', 'App lock & screenshot guard', 'Lock with your fingerprint or PIN, and hide the app in recent apps.'],
      ].map(([ic, t, d]) => `<div class="feat">${UI.bubble(ic, '#43D9B8')}<div><div class="h3">${t}</div><div class="small muted">${d}</div></div></div>`).join('')}</div>
      ${dots}<button class="btn primary block" data-a="obNext">Continue</button>`;
    } else if (OB.step === 2) {
      const dec = OB.token ? Store.N.sync('decodeToken', OB.token) : null;
      const host = dec && /^https:\/\//.test(dec) ? dec.replace(/^https:\/\//, '').split('/')[0] : null;
      h = `<div class="logo">${UI.bubble('landmark', '#7C8CFF')}</div><h1 class="hero-t">Connect your banks</h1><p class="hero-s">Clearli uses SimpleFIN Bridge — a small, privacy-focused service that securely links 16,000+ banks.</p>
      ${App.googleReady && App.googleReady() && !(Store.S.sync && Store.S.sync.enabled) && !OB.busy ? `<button class="btn primary block" data-a="obJoin">${App.gIcon()} Sign in with Google</button><div class="tiny faint center" style="margin:8px 0 14px">Same account on the web and every phone — your data stays in sync through your Google Drive.</div>` : ''}
      <div class="g pad"><ol class="steps" style="margin:0;padding:0">
        <li>Tap <b>Open SimpleFIN</b> — it opens right here. Create an account and connect your banks and cards.</li>
        <li>Under <b>Apps</b>, tap <b>New connection</b>, then <b>copy</b> the Setup Token.</li>
        <li>Close the page. Clearli picks up the token by itself and connects.</li>
      </ol>${App.googleReady && App.googleReady() ? `<div class="small muted" style="margin-top:10px">${I('shield-check', 'sm')} You'll sign in with Google first. Your data is kept in your own Google Drive, and banks sync only while you're signed in.</div>` : ''}<div class="sp"></div><button class="btn primary block" data-a="obBridge">${I('landmark', 'sm')} Open SimpleFIN</button></div><div class="sp"></div>
      <label class="field"><span>Setup token</span><textarea class="inp" id="obTok" data-in="obTok" placeholder="aHR0cHM6Ly9iZXRh..." spellcheck="false" autocomplete="off" style="min-height:84px;font-family:monospace;font-size:13px">${U.esc(OB.token)}</textarea></label>
      <div class="row" style="margin:-4px 2px 12px"><button class="btn sm" data-a="obPaste">${I('file-text', 'sm')} Paste</button><div class="grow small ${host ? 'pos' : OB.token ? 'neg' : 'faint'}" id="obHost">${host ? I('check', 'sm') + ' Token for ' + U.esc(host) : OB.token ? 'This doesn\'t look like a setup token' : ''}</div></div>
      <div class="field"><span>How far back?</span>${App.histPicker(OB, 'obBack')}${Number(OB.back) > 90 || OB.back === 'custom' ? `<div class="tiny faint" style="margin:6px 4px 0">The last 3 months load right away; older history keeps loading quietly in the background.</div>` : ''}</div>
      ${OB.err ? `<div class="g pad-s small neg" style="margin-bottom:12px">${I('alert-triangle', 'sm')} ${U.esc(OB.err)}</div>` : ''}
      ${OB.busy ? `<div class="row center" style="justify-content:center;padding:12px"><div class="spin"></div><span class="muted">${U.esc(OB.progress || 'Connecting…')}</span></div>` : `<button class="btn primary block" data-a="obConnect" ${host ? '' : 'disabled'}>Connect securely</button>
      <div class="sp"></div><button class="btn block" data-a="obImport">${I('file-text')} No SimpleFIN? Import a bank file</button>
      <div class="sp"></div><button class="btn block" data-a="obDemo">${I('sparkles')} Explore with sample data</button>`}
      ${dots}`;
    } else {
      const secure = Store.N.sync('isDeviceSecure');
      h = `<div class="logo">${UI.bubble('fingerprint', '#FFB547')}</div><h1 class="hero-t">Lock it down</h1><p class="hero-s">Require your fingerprint, face or screen lock to open Clearli.</p>
      <div class="list g">
        <div class="item"><div class="grow"><div class="t">App lock</div><div class="s">${secure ? 'Uses your device biometrics / PIN' : 'Set a screen lock in Android settings first'}</div></div>${secure ? UI.toggle(s.lock, 'obLock') : ''}</div>
        <div class="item"><div class="grow"><div class="t">Hide amounts by default</div><div class="s">Tap the eye icon to reveal</div></div>${UI.toggle(s.hideAmounts, 'obHide')}</div>
        <div class="item"><div class="grow"><div class="t">Block screenshots</div><div class="s">Also hides Clearli in recent apps</div></div>${UI.toggle(s.secureScreen !== false, 'obSecure')}</div>
      </div>${dots}<button class="btn primary block" data-a="obFinish">Open Clearli</button>`;
    }
    el.innerHTML = `<div class="inner">${h}</div>`;
    el.scrollTop = 0;
  };
  UI.on('obNext', () => { OB.step++; App.onboard(); });
  UI.on('obBack', (x) => { OB.back = x; App.onboard(); const f = document.querySelector('#onb .field:last-of-type'); if (f) f.scrollIntoView({ block: 'center' }); });
  UI.on('obBackDate', (v) => { OB.date = v; App.onboard(); });
  // SimpleFIN opens over the app (Custom Tab). When it closes, a copied setup token is picked up automatically.
  App.SIMPLEFIN_URL = 'https://bridge.simplefin.org/';
  App.openSimpleFin = () => { if (window.Native && Native.openTab) Store.N.sync('openTab', App.SIMPLEFIN_URL); else Store.N.sync('openUrl', App.SIMPLEFIN_URL); };
  UI.on('obBridge', () => App.openSimpleFin());
  App.clipToken = function () {
    const t = String(Store.N.sync('clipboard') || '').trim().replace(/\s+/g, '');
    if (!t || t.length < 20 || t.length > 2000) return null;
    const dec = Store.N.sync('decodeToken', t);
    return dec && /^https:\/\/.+\/claim\//.test(dec) ? t : null;
  };
  App.onTabClosed = function () {
    const onb = document.getElementById('onb');
    const inOnb = !Store.S.settings.onboarded && onb && onb.style.display !== 'none';
    if (inOnb && OB.step === 2 && !OB.busy) {
      const t = App.clipToken();
      if (t && t !== OB.usedToken) { OB.token = t; OB.usedToken = t; OB.err = ''; App.onboard(); UI.toast('Setup token found — connecting', 'check'); setTimeout(() => UI.actions.obConnect && UI.actions.obConnect(), 600); }
      return;
    }
    if (Store.S.settings.onboarded) {
      const page = App.pages[App.pages.length - 1];
      if (page && page.id === 'connection') {
        const t = App.clipToken();
        if (t && t !== OB.usedToken && !Store.N.sync('accessHost')) { OB.usedToken = t; OB.token = t; OB.step = 2; App.restartOnboarding(); OB.token = t; App.onboard(); setTimeout(() => UI.actions.obConnect && UI.actions.obConnect(), 600); return; }
        if (Store.N.sync('accessHost')) App.doSync({ silent: false }); // banks added in SimpleFIN show up right away
      }
    }
  };
  UI.on('obTok', (v) => {
    OB.token = v.trim(); OB.err = '';
    const dec = OB.token ? Store.N.sync('decodeToken', OB.token) : null;
    const host = dec && /^https:\/\//.test(dec) ? dec.replace(/^https:\/\//, '').split('/')[0] : null;
    const hEl = document.getElementById('obHost'); const btn = document.querySelector('[data-a="obConnect"]');
    if (hEl) { hEl.className = 'grow small ' + (host ? 'pos' : OB.token ? 'neg' : 'faint'); hEl.innerHTML = host ? I('check', 'sm') + ' Token for ' + U.esc(host) : OB.token ? "This doesn't look like a setup token" : ''; }
    if (btn) btn.disabled = !host;
  });
  UI.on('obPaste', () => { const t = Store.N.sync('clipboard') || ''; if (t) { OB.token = t.trim(); App.onboard(); } else UI.toast('Clipboard is empty', 'info'); });
  UI.on('obConnect', async () => {
    OB.busy = true; OB.err = '';
    // Google sign-in comes first when this build has it: banks only sync while signed in (see appsync.js)
    if (App.bankSyncBlocked && App.bankSyncBlocked()) {
      OB.progress = 'Sign in with Google first…'; App.onboard();
      let role = null;
      try { role = await App.ensureGoogleMain((m) => { if (m) { OB.progress = m; App.onboard(); } }); }
      catch (e) { OB.busy = false; OB.err = e.message; App.onboard(); return; }
      if (role === 'member') { OB.busy = false; OB.token = ''; UI.toast('Joined your household — banks sync on the main phone', 'layers'); OB.step = 3; App.onboard(); return; }
      if (!role) { OB.busy = false; App.onboard(); return; }
    }
    OB.progress = 'Claiming your token…'; App.onboard();
    const r = await Store.N.call('claimToken', OB.token);
    if (!r.ok) { OB.busy = false; OB.err = r.error || 'Could not connect'; App.onboard(); return; }
    Store.S.settings.demo = false;
    OB.progress = 'Downloading your accounts…'; App.onboard();
    const target = App.histTarget(OB);
    const firstDays = Math.min(90, Math.ceil((Date.now() - target) / U.DAY));
    const s = await Store.sync({ full: true, days: firstDays, progress: (i, n) => { OB.progress = `Downloading history… ${Math.round((i / n) * 100)}%`; const p = document.querySelector('#onb .muted'); if (p) p.textContent = OB.progress; } });
    OB.busy = false;
    if (!s.ok) { OB.err = s.error; App.onboard(); return; }
    OB.token = '';
    if (Store.backfillStart(target)) setTimeout(App.runBackfill, 1500);
    UI.toast(`Connected · ${Object.keys(Store.S.accounts).length} accounts`, 'check');
    OB.step = 3; App.onboard();
  });
  // Banks anywhere in the world: start from a statement file (signed in first, so it's saved to Google Drive)
  UI.on('obImport', async () => {
    if (App.googleReady && App.googleReady() && !(Store.S.sync && Store.S.sync.enabled)) {
      OB.busy = true; OB.err = ''; OB.progress = 'Sign in with Google first…'; App.onboard();
      let role = null;
      try { role = await App.turnOnDrive((m) => { if (m) { OB.progress = m; App.onboard(); } }); }
      catch (e) { OB.busy = false; OB.err = e.message; App.onboard(); return; }
      OB.busy = false;
      if (!role) { App.onboard(); return; }
    }
    Store.S.settings.demo = false; Store.S.settings.onboarded = true; Store.commit({ silent: true }); Store.saveNow();
    document.getElementById('onb').style.display = 'none'; document.body.classList.remove('onb');
    App.applyTheme(); App.render(true);
    App.startImport();
  });
  UI.on('obDemo', () => { Store.loadDemo(); Store.S.settings.onboarded = false; OB.step = 3; App.onboard(); });
  UI.on('obLock', () => { Store.S.settings.lock = !Store.S.settings.lock; App.onboard(); });
  UI.on('obHide', () => { Store.S.settings.hideAmounts = !Store.S.settings.hideAmounts; App.onboard(); });
  UI.on('obSecure', () => { Store.S.settings.secureScreen = Store.S.settings.secureScreen === false; App.onboard(); });
  UI.on('obFinish', () => {
    Store.S.settings.onboarded = true; Store.commit({ silent: true }); Store.saveNow();
    document.getElementById('onb').style.display = 'none';
    document.body.classList.remove('onb');
    App.applyTheme(); App.render(true);
  });
  App.onboardStep = function (n) { OB.step = n; App.onboard(); };
  App.restartOnboarding = function () { OB.step = 2; OB.token = ''; OB.err = ''; App.onboard(); };

  /* ---------------- home-screen widget (Android) ----------------
     The widget can't run this app's code, so we hand it a small snapshot: recurring bills and paychecks
     from last month to three months out (paid + expected). It is stored encrypted by the native side. */
  App.widgetSnapshot = function () {
    const S = Store.S; const V = Store.V; if (!V) return null;
    const today = U.sod(new Date()); const from = U.addMonths(U.som(today), -1); const to = U.addMonths(U.som(today), 3);
    const hidden = (a) => { const x = S.accounts[a]; return !x || x.hidden; };
    const col = (c) => (V.catMap[c] || {}).color || '#8A93B8';
    const items = [];
    for (const t of V.list) if (t.recurring && !t.excluded && !t.hiddenAcct && t.ts >= +from && t.ts < +today + U.DAY) items.push({ d: U.dayKey(t.ts), n: t.name, v: Math.round(t.amt * 100) / 100, p: 1, c: col(t.cat) });
    for (const x of E.projectRecurring(V, today, to)) if (!hidden(x.r.acct)) items.push({ d: U.dayKey(x.date), n: x.r.name, t: x.r.tag || '', v: Math.round(x.r.amount * 100) / 100, p: 0, c: col(x.r.cat) });
    items.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    return { v: 1, gen: Date.now(), cur: S.settings.currency || 'USD', ws: S.settings.weekStart || 0, accent: S.settings.accent, items };
  };
  App.widgetPush = U.debounce(() => {
    if (!window.Native || !Native.widgetData || !Store.S.settings.onboarded) return;
    try { Native.widgetData(JSON.stringify(App.widgetSnapshot())); } catch (e) { console.log('widget', e); }
  }, 1500);
  App.openFrom = function (target) {
    if (!target || !Store.S.settings.onboarded) return;
    UI.closeAll && UI.closeAll();
    if (target === 'calendar') { App.plan.cal = U.som(new Date()); App.plan.calSel = null; App.go('calendar'); }
  };

  // Google "G" mark for sign-in buttons
  App.gIcon = () => `<svg viewBox="0 0 48 48" width="18" height="18" style="vertical-align:-3px;margin-right:4px;background:#fff;border-radius:50%;padding:2px"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  /* ---------------- boot ---------------- */
  App.boot = function () {
    document.getElementById('tabs').innerHTML = '<span class="drop"></span>' + TABS.map(([id, ic, l]) => `<button data-a="tab" data-x="${id}">${I(ic)}<span>${l}</span></button>`).join('');
    const recompute = Store.recompute;
    Store.recompute = function () { const r = recompute.apply(this, arguments); App.widgetPush(); return r; };
    Store.load();
    App.applyTheme();
    Store.on(() => { });
    window.addEventListener('resize', App.moveDrop);
    if (!Store.S.settings.onboarded) { App.onboard(); }
    else {
      App.render(true);
      App.openFrom(Store.N.sync('takeLaunch'));
      if (Store.S.settings.lock) App.showLock();
      if (Store.S.settings.autoSync && !Store.S.settings.demo && Date.now() - (Store.S.lastSync || 0) > 6 * 3600000) setTimeout(() => App.doSync({ silent: true }).then(() => App.runBackfill()), 600);
      else setTimeout(App.runBackfill, 1500);
    }
  };
  document.addEventListener('DOMContentLoaded', () => { if (window.CLEARLI_DEFER_BOOT) return; try { App.boot(); } catch (e) { document.body.innerHTML = '<pre style="color:#fff;padding:20px;white-space:pre-wrap">' + U.esc(e.stack || e) + '</pre>'; } });
})();

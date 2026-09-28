/* Clearli — state, persistence (encrypted natively), SimpleFIN sync, demo data */
(function () {
  const DAY = U.DAY;

  /* ---------------- Native bridge (with browser mock for development) ---------------- */
  const pending = {};
  window.__nativeCb = function (cbId, key) {
    const p = pending[cbId]; if (!p) return;
    delete pending[cbId];
    let r; try { r = JSON.parse(window.Native.take(key)); } catch (e) { r = { ok: false, error: 'Bad response' }; }
    p(r);
  };
  const isNative = !!window.Native;
  if (!isNative) {
    // Development mock: localStorage, no network.
    const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { } } };
    const results = {}; let n = 0;
    const cb = (id, obj) => { const k = 'm' + (++n); results[k] = JSON.stringify(obj); setTimeout(() => __nativeCb(id, k), 350); };
    window.Native = {
      take: (k) => { const v = results[k]; delete results[k]; return v; },
      loadData: () => ls.get('clearli.data'), saveData: (j) => { ls.set('clearli.data', j); return true; },
      hasCredential: () => !!ls.get('clearli.cred'), clearCredential: () => ls.del('clearli.cred'),
      wipeAll: () => { ls.del('clearli.cred'); ls.del('clearli.data'); },
      claimToken: (t, id) => cb(id, { ok: false, error: 'Network is not available in the browser preview. Use sample data.' }),
      fetchAccounts: (a, b, bo, id) => cb(id, { ok: false, error: 'not_connected' }),
      accessHost: () => null, isDeviceSecure: () => true, requestUnlock: (id) => cb(id, { ok: true }),
      setBars: () => { }, setSecure: () => { }, haptic: () => { }, openUrl: (u) => window.open(u, '_blank'),
      exportFile: (name, mime, content, id) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click(); cb(id, { ok: true }); },
      importFile: (id) => cb(id, { ok: false, error: 'cancelled' }), version: () => '1.0.0 (browser)',
      decodeToken: (t) => { try { const s = t.trim().replace(/-/g, '+').replace(/_/g, '/'); return atob(s + '==='.slice((s.length + 3) % 4)); } catch (e) { return null; } },
    };
  }
  const N = {
    isNative,
    call(method, ...args) {
      return new Promise((resolve) => {
        const id = 'c' + Math.random().toString(36).slice(2);
        pending[id] = resolve;
        try { window.Native[method](...args, id); } catch (e) { delete pending[id]; resolve({ ok: false, error: String(e) }); }
      });
    },
    sync(method, ...args) { try { return window.Native[method](...args); } catch (e) { return null; } },
  };

  /* ---------------- State ---------------- */
  function fresh() {
    return {
      v: 1,
      settings: { theme: 'glass-dark', accent: '#7C8CFF', currency: 'USD', hideAmounts: false, lock: false, lockAfter: 60, reduceFx: false, weekStart: 0, historyDays: 365, apy: 4.0, onboarded: false, demo: false, autoSync: true, secureScreen: true },
      conns: {}, accounts: {}, txns: {}, edits: {}, rules: [], cats: E.DEFAULT_CATS.map((c) => Object.assign({}, c)),
      recurringOverrides: {}, goals: [], backfill: null, assets: [], imports: [], syncLog: [], lastSync: 0, oldest: 0, quota: { day: '', n: 0 }, errors: [],
    };
  }
  const Store = { N, S: fresh(), V: null, listeners: [] };

  Store.load = function () {
    const raw = N.sync('loadData');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        const f = fresh();
        s.settings = Object.assign(f.settings, s.settings || {});
        for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
        // add any new default categories
        for (const c of E.DEFAULT_CATS) if (!s.cats.find((x) => x.id === c.id)) s.cats.push(Object.assign({}, c));
        Store.S = s;
      } catch (e) { console.log('load failed', e); }
    }
    U.currency = Store.S.settings.currency || 'USD';
    Store.recompute();
  };
  const saveNow = () => { N.sync('saveData', JSON.stringify(Store.S)); };
  Store.save = U.debounce(saveNow, 400);
  Store.saveNow = saveNow;
  Store.recompute = function () {
    const S = Store.S;
    // goals tracked by savings places follow those places' current value
    for (const g of S.goals || []) if (g.assets && g.assets.length) g.saved = Math.round(U.sum((S.assets || []).filter((a) => g.assets.includes(a.id)), E.assetValue) * 100) / 100;
    Store.V = E.derive(S);
  };
  Store.commit = function (opts) {
    Store.recompute();
    Store.save();
    if (!opts || !opts.silent) Store.listeners.forEach((f) => f());
  };
  Store.on = (f) => Store.listeners.push(f);

  /* ---------------- SimpleFIN ingestion ---------------- */
  function guessType(a) {
    const n = (a.name || '').toLowerCase();
    if (/credit|card|visa|mastercard|amex|discover|sapphire|freedom|venture|quicksilver/.test(n)) return 'credit';
    if (/saving|hysa|money market|mm\b/.test(n)) return 'savings';
    if (/brokerage|ira|401|invest|roth|hsa|stock|crypto/.test(n) || (a.holdings && a.holdings.length)) return 'investment';
    if (/loan|mortgage|auto|student/.test(n)) return 'loan';
    if (/check|spending|everyday|total|debit/.test(n)) return 'checking';
    return parseFloat(a.balance) < 0 ? 'credit' : 'checking';
  }
  Store.ingest = function (json, window) {
    const S = Store.S;
    const errs = [];
    (json.errlist || []).forEach((e) => errs.push(e.msg || e.code));
    (json.errors || []).forEach((e) => { if (!errs.includes(e)) errs.push(e); });
    (json.connections || []).forEach((c) => { S.conns[c.conn_id] = { id: c.conn_id, name: c.name, org: c.org_id, url: c.org_url || '' }; });
    let added = 0;
    for (const a of json.accounts || []) {
      let conn = a.conn_id;
      if (!conn && a.org) { conn = a.org.id || a.org.domain || a.org.name || 'bank'; S.conns[conn] = S.conns[conn] || { id: conn, name: a.org.name || a.org.domain || 'Bank', url: a.org.url || '' }; }
      conn = conn || 'bank';
      if (!S.conns[conn]) S.conns[conn] = { id: conn, name: 'Bank', url: '' };
      const prev = S.accounts[a.id] || {};
      S.accounts[a.id] = Object.assign(prev, {
        id: a.id, name: a.name, conn, currency: a.currency || 'USD', balance: parseFloat(a.balance) || 0,
        avail: a['available-balance'] != null ? parseFloat(a['available-balance']) : null, balanceDate: (a['balance-date'] || 0) * 1000,
        type: prev.type || guessType(a), holdings: a.holdings || prev.holdings || null,
      });
      if (!a.transactions) continue;
      // drop stored pending txns in the fetched window; they come back if still pending
      if (window) for (const k in S.txns) { const t = S.txns[k]; if (t.acct === a.id && t.pending && t.ts >= window.a && t.ts < window.b) delete S.txns[k]; }
      for (const t of a.transactions) {
        const key = a.id + ':' + t.id;
        const posted = parseInt(t.posted, 10) || 0;
        const at = parseInt(t.transacted_at, 10) || 0;
        const ts = (at || posted || Date.now() / 1000) * 1000;
        if (!S.txns[key]) added++;
        S.txns[key] = { id: String(t.id), acct: a.id, ts, posted: posted * 1000, amt: parseFloat(t.amount) || 0, desc: t.description || t.payee || 'Transaction', payee: t.payee || '', memo: t.memo || '', pending: !!t.pending || posted === 0 };
      }
    }
    return { added, errs };
  };

  Store.quotaUse = function (n) {
    const q = Store.S.quota; const today = U.dayKey(new Date());
    if (q.day !== today) { q.day = today; q.n = 0; }
    q.n += n || 0; return q.n;
  };

  // Fetch in <=45-day windows (SimpleFIN Bridge recommended max; larger ranges may be capped), overlapping 5 days on incremental syncs.
  Store.sync = async function (opts) {
    opts = opts || {};
    const S = Store.S;
    if (S.settings.demo) { Store.demoTick(); return { ok: true, added: 0, demo: true }; }
    if (!N.sync('hasCredential')) return { ok: false, error: 'Not connected to SimpleFIN yet.' };
    const now = Date.now();
    const end = now;
    let start;
    if (opts.full || !S.lastSync) start = now - (opts.days || S.settings.historyDays || 365) * DAY;
    else start = Math.min(S.lastSync, now) - 5 * DAY;
    if (opts.from) start = opts.from;
    const windows = [];
    const WIN = 45 * DAY;
    for (let b = end; b > start; b -= WIN) windows.push({ a: Math.max(start, b - WIN), b });
    if (Store.quotaUse(0) + windows.length > 24 && !opts.force) return { ok: false, error: `Daily SimpleFIN request limit is close (${Store.quotaUse(0)}/24 used today). Try again tomorrow.` };
    let added = 0; const errs = [];
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (opts.progress) opts.progress(i, windows.length);
      const r = await N.call('fetchAccounts', String(Math.floor(w.a / 1000)), String(Math.floor(w.b / 1000)), false);
      Store.quotaUse(1);
      if (!r.ok) {
        const msg = r.error || 'Sync failed';
        S.syncLog.unshift({ at: now, ok: false, msg }); S.syncLog = S.syncLog.slice(0, 30);
        Store.commit();
        return { ok: false, error: msg, status: r.status };
      }
      let json; try { json = JSON.parse(r.body); } catch (e) { return { ok: false, error: 'SimpleFIN returned invalid data.' }; }
      const res = Store.ingest(json, w);
      added += res.added; res.errs.forEach((e) => { if (!errs.includes(e)) errs.push(e); });
      // stop going further back if nothing exists that far
      if (i > 0 && res.added === 0 && !(json.accounts || []).some((a) => (a.transactions || []).length)) break;
    }
    S.lastSync = now;
    S.oldest = S.oldest ? Math.min(S.oldest, start) : start;
    S.errors = errs;
    S.syncLog.unshift({ at: now, ok: true, msg: `${added} new transaction${added === 1 ? '' : 's'}` + (errs.length ? ` · ${errs.length} warning(s)` : ''), n: added });
    S.syncLog = S.syncLog.slice(0, 30);
    Store.commit();
    return { ok: true, added, errs };
  };

  /* ---------------- History backfill (paced, resumable) ----------------
     Walks backwards from the oldest data we have to a user-chosen date in 45-day requests.
     Uses at most BF_BUDGET requests per day (leaving room for normal syncs), waits between
     requests, resumes on the next app open/day, and stops early once banks return nothing older. */
  const BF_WIN = 45 * DAY, BF_BUDGET = 18, BF_GAP_MS = 4000;
  Store.BF_WIN = BF_WIN; Store.BF_BUDGET = BF_BUDGET;
  Store.backfillEstimate = function (target) {
    const S = Store.S;
    const from = Math.min(S.oldest || Date.now(), Date.now());
    const req = Math.max(0, Math.ceil((from - target) / BF_WIN));
    const today = Math.max(0, BF_BUDGET - Store.quotaUse(0));
    return { req, today: Math.min(req, today), days: req <= today ? 1 : 1 + Math.ceil((req - today) / BF_BUDGET) };
  };
  Store.backfillStart = function (target) {
    const S = Store.S;
    const cursor = Math.min(S.oldest || Date.now(), Date.now());
    if (cursor - target < 2 * DAY) return false;
    S.backfill = { target, cursor, active: true, empty: 0, started: Date.now(), requests: 0, status: 'running', msg: '' };
    Store.commit({ silent: true });
    return true;
  };
  Store.backfillStop = function () { if (Store.S.backfill) { Store.S.backfill.active = false; Store.S.backfill.status = 'stopped'; Store.commit({ silent: true }); } };
  let bfRunning = false;
  Store.backfillRun = async function (onStep) {
    const S = Store.S; const bf = S.backfill;
    if (bfRunning || !bf || !bf.active || S.settings.demo || !N.sync('hasCredential')) return;
    bfRunning = true;
    try {
      while (bf.active && bf.cursor > bf.target) {
        if (Store.quotaUse(0) >= BF_BUDGET) { bf.status = 'waiting'; bf.msg = 'Daily request budget used — continues tomorrow'; break; }
        const w = { a: Math.max(bf.target, bf.cursor - BF_WIN), b: bf.cursor };
        bf.status = 'running'; bf.msg = '';
        const r = await N.call('fetchAccounts', String(Math.floor(w.a / 1000)), String(Math.floor(w.b / 1000)), false);
        Store.quotaUse(1); bf.requests++;
        if (!r.ok) {
          bf.status = 'error'; bf.msg = r.error || 'Request failed — will retry later';
          if (r.status === 403 || r.status === 402) bf.active = false;
          break;
        }
        let json; try { json = JSON.parse(r.body); } catch (e) { bf.status = 'error'; bf.msg = 'Invalid data from SimpleFIN'; break; }
        const res = Store.ingest(json, w);
        const got = (json.accounts || []).reduce((n, a) => n + (a.transactions || []).length, 0);
        bf.cursor = w.a;
        S.oldest = Math.min(S.oldest || w.a, w.a);
        bf.empty = got ? 0 : bf.empty + 1;
        if (res.errs.length) S.errors = res.errs;
        if (bf.empty >= 2) { bf.active = false; bf.status = 'nohistory'; bf.msg = 'Your banks don\'t provide anything older'; break; }
        Store.commit({ silent: true });
        if (onStep) onStep(bf);
        if (bf.cursor > bf.target) await new Promise((res2) => setTimeout(res2, BF_GAP_MS));
      }
      if (bf.cursor <= bf.target) { bf.active = false; bf.status = 'done'; bf.msg = ''; }
      const oldestTx = Object.values(S.txns).reduce((m, t) => Math.min(m, t.ts), Date.now());
      if (bf.status === 'nohistory') bf.reached = oldestTx;
      if (!bf.active) S.syncLog.unshift({ at: Date.now(), ok: bf.status !== 'error', msg: bf.status === 'nohistory' ? `History loaded back to ${U.fmtDate(oldestTx, { year: true })} — the oldest your banks provide` : bf.status === 'done' ? `History loaded back to ${U.fmtDate(bf.target, { year: true })}` : bf.msg });
      Store.commit({ silent: true });
      if (onStep) onStep(bf);
    } finally { bfRunning = false; }
  };
  Store.backfillBusy = () => bfRunning;

  /* ---------------- Rules / edits helpers ---------------- */
  Store.setEdit = function (key, patch) {
    const e = Object.assign({}, Store.S.edits[key] || {}, patch);
    for (const k in e) if (e[k] === '' || e[k] == null || e[k] === false) delete e[k];
    if (Object.keys(e).length) Store.S.edits[key] = e; else delete Store.S.edits[key];
  };
  Store.upsertRule = function (rule) {
    const S = Store.S;
    const i = S.rules.findIndex((r) => r.id === rule.id || (r.match === rule.match && r.pattern === rule.pattern));
    if (i >= 0) S.rules[i] = Object.assign(S.rules[i], rule); else S.rules.push(Object.assign({ id: U.uid(), created: Date.now() }, rule));
  };

  /* ---------------- Export / import ---------------- */
  Store.csv = function (list) {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const S = Store.S;
    const rows = [['Date', 'Name', 'Original description', 'Amount', 'Category', 'Account', 'Bank', 'Pending', 'Note', 'Tags'].join(',')];
    for (const t of list) {
      const a = S.accounts[t.acct] || {}; const c = S.conns[a.conn] || {};
      rows.push([U.dayKey(t.ts), q(t.name), q(t.desc), t.amt.toFixed(2), q(Store.V.catMap[t.cat].name), q(a.alias || a.name), q(c.name), t.pending ? 'yes' : '', q(t.note), q((t.tags || []).join(' '))].join(','));
    }
    return rows.join('\n');
  };
  Store.backup = function () {
    const S = Object.assign({}, Store.S);
    delete S.sync; // never put sync credentials in a backup file
    return JSON.stringify({ app: 'clearli', kind: 'backup', v: 1, at: Date.now(), state: S });
  };
  Store.restore = function (text) {
    const o = JSON.parse(text);
    if (!o || o.app !== 'clearli' || !o.state) throw new Error('Not a Clearli backup file');
    const cur = Store.S;
    Store.S = o.state;
    Store.S.sync = cur.sync;
    Store.S.settings.onboarded = true;
    Store.S.settings.lock = cur.settings.lock;
    Store.commit();
  };

  /* ---------------- Demo data (realistic 2 years, 2 banks, 5 accounts) ---------------- */
  Store.loadDemo = function () {
    const S = fresh();
    S.settings = Object.assign(S.settings, Store.S.settings, { demo: true, onboarded: true });
    let seed = 42; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const between = (a, b) => a + rnd() * (b - a);
    S.conns = { chase: { id: 'chase', name: 'Chase', url: 'https://chase.com' }, amex: { id: 'amex', name: 'American Express', url: 'https://americanexpress.com' }, ally: { id: 'ally', name: 'Ally Bank', url: 'https://ally.com' } };
    const A = (id, name, conn, type) => (S.accounts[id] = { id, name, conn, type, currency: 'USD', balance: 0, balanceDate: Date.now() });
    A('chk', 'Total Checking ••4821', 'chase', 'checking');
    A('sapph', 'Sapphire Preferred ••1107', 'chase', 'credit');
    A('amexg', 'Gold Card ••3004', 'amex', 'credit');
    A('sav', 'Online Savings ••7720', 'ally', 'savings');
    const tx = [];
    const add = (acct, date, amt, desc) => tx.push({ acct, ts: +date + Math.floor(between(8, 21) * 3600000), amt: Math.round(amt * 100) / 100, desc });
    const today = U.sod(new Date());
    const start = U.addMonths(U.som(today), -24);
    for (let d = new Date(start); d <= today; d = U.addDays(d, 1)) {
      const dom = d.getDate(); const dow = d.getDay(); const mIdx = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth();
      const raise = mIdx >= 14 ? 1.04 : 1;
      if (dow === 5 && Math.floor(U.daysBetween(start, d) / 7) % 2 === 0) add('chk', d, 3150.44 * raise, 'ACME CORP PAYROLL PPD ID: 4455');
      if (dom === 1) add('chk', d, -1985, 'BILT RENT PAYMENT ACH');
      if (dom === 3) add('chk', d, -(62 + between(0, 58)), 'COMED ELECTRIC PAYMENT');
      if (dom === 6) add('chk', d, -(38 + between(0, 45)), 'NICOR GAS UTILITY PMT');
      if (dom === 9) add('sapph', d, -(mIdx > 15 ? 89.99 : 79.99), 'COMCAST XFINITY INTERNET');
      if (dom === 12) add('chk', d, -142.18, 'T-MOBILE AUTOPAY');
      if (dom === 15) add('chk', d, -176.4, 'GEICO AUTO INSURANCE');
      if (dom === 17) add('amexg', d, -(mIdx > 10 ? 22.99 : 15.49), 'NETFLIX.COM');
      if (dom === 21) add('amexg', d, -11.99, 'SPOTIFY USA');
      if (dom === 4) add('sapph', d, -20, 'OPENAI *CHATGPT SUBSCR');
      if (dom === 14) add('sapph', d, -2.99, 'APPLE.COM/BILL ICLOUD');
      if (dom === 23) add('sapph', d, -24.99, 'PLANET FITNESS CLUB FEES');
      if (dom === 26) add('amexg', d, -17.99, 'HULU 877-8244858 CA');
      if (dom === 8) add('amexg', d, -14.99, 'PARAMOUNT+ SUBSCRIPTION');
      if (dom === 11 && d.getMonth() % 3 === 0) add('sapph', d, -149, 'AMAZON PRIME*2K3LL MEMBERSHIP');
      if (dom === 2) add('chk', d, -500, 'ONLINE TRANSFER TO ALLY SAVINGS');
      if (dom === 2) add('sav', d, 500, 'ONLINE TRANSFER FROM CHASE');
      if (dom === 28) add('sav', d, 12 + mIdx * 0.9, 'INTEREST PAID');
      if (dom === 20) add('chk', d, -385.5, 'TOYOTA FINANCIAL AUTO LOAN');
      // card payments
      if (dom === 25) { const v = 1400 + between(0, 800); add('chk', d, -v, 'CHASE CREDIT CRD AUTOPAY'); add('sapph', d, v, 'PAYMENT THANK YOU'); }
      if (dom === 27) { const v = 900 + between(0, 600); add('chk', d, -v, 'AMEX EPAYMENT ACH PMT'); add('amexg', d, v, 'ONLINE PAYMENT - THANK YOU'); }
      // variable spend
      const wk = dow === 0 || dow === 6;
      if (rnd() < (wk ? 0.4 : 0.18)) add(pick(['amexg', 'sapph']), d, -between(30, 150), pick(['JEWEL OSCO 3421', 'TRADER JOE S #702', 'ALDI 72014', 'COSTCO WHSE #0388', 'PATEL BROTHERS SCHAUMBURG', 'WHOLE FOODS MKT 10212']));
      if (rnd() < (wk ? 0.7 : 0.45)) add('amexg', d, -between(9, 68), pick(['DOORDASH*CHIPOTLE', 'UBER *EATS PENDING', 'TST* PORTILLOS SCHAUMBURG', 'CHIPOTLE 2291', 'SQ *KABOB HOUSE', 'PANERA BREAD #601', 'RAISING CANES 721', 'GRUBHUB*BIRYANIPOINT']));
      if (rnd() < (wk ? 0.35 : 0.55)) add('sapph', d, -between(3.5, 8.75), pick(['STARBUCKS STORE 12345', 'DUNKIN #345521', 'STARBUCKS STORE 55123']));
      if (rnd() < 0.18) add('sapph', d, -between(35, 62), pick(['SHELL OIL 57444321', 'COSTCO GAS #0388', 'SPEEDWAY 4432', 'MOBIL 99234']));
      if (rnd() < 0.3) add(pick(['sapph', 'amexg']), d, -between(8, 140), pick(['AMZN MKTP US*2K3', 'AMAZON.COM*HB7', 'TARGET 00012345', 'WALMART.COM', 'BEST BUY 00123', 'OLD NAVY US 4432', 'IKEA SCHAUMBURG', 'HOME DEPOT #1922']));
      if (rnd() < 0.08) add('sapph', d, -between(12, 38), pick(['UBER *TRIP', 'LYFT *RIDE SUN', 'METRA MOBILE']));
      if (rnd() < 0.05) add('sapph', d, -between(15, 90), pick(['WALGREENS #1234', 'CVS/PHARMACY #0443', 'NORTHWEST COMMUNITY HOSP']));
      if (rnd() < 0.04) add('amexg', d, -between(18, 120), pick(['AMC ONLINE', 'TICKETMASTER', 'STEAM PURCHASE', 'TOPGOLF SCHAUMBURG']));
      if (rnd() < 0.03) add('sapph', d, -between(20, 75), pick(['GREAT CLIPS #221', 'ULTA BEAUTY']));
      if (rnd() < 0.03) add('chk', d, -between(20, 150), pick(['ZELLE TO AHMED', 'VENMO PAYMENT', 'ISLAMIC RELIEF USA DONATION']));
      if (rnd() < 0.015) add('chk', d, -between(40, 200), 'ATM WITHDRAWAL 0012 MOUNT PROSPECT');
      if (rnd() < 0.02) add('chk', d, -between(18, 60), pick(['KINDERCARE LEARNING', 'BUY BUY BABY', 'TARGET 00012345']));
      if (dom === 16 && rnd() < 0.2) add('chk', d, -35, 'OVERDRAFT FEE');
      if (dom === 19 && rnd() < 0.25) add('sapph', d, -between(18, 42), 'INTEREST CHARGE ON PURCHASES');
      if (rnd() < 0.006) add('sapph', d, -between(250, 900), pick(['UNITED AIRLINES', 'MARRIOTT HOTELS', 'AIRBNB * HMQ2']));
      if (rnd() < 0.01) add('chk', d, between(40, 400), pick(['VENMO CASHOUT', 'IRS TREAS 310 TAX REF', 'ZELLE FROM SARA']));
    }
    // a duplicate charge + price hike examples in recent months
    add('amexg', U.addDays(today, -9), -54.2, 'SQ *KABOB HOUSE');
    add('amexg', U.addDays(today, -8), -54.2, 'SQ *KABOB HOUSE');
    tx.forEach((t, i) => { const key = t.acct + ':d' + i; S.txns[key] = { id: 'd' + i, acct: t.acct, ts: t.ts, posted: t.ts, amt: t.amt, desc: t.desc, payee: '', memo: '', pending: t.ts > Date.now() - 2 * DAY && rnd() < 0.5 }; });
    // balances consistent with flows
    const bal = { chk: 4200, sapph: 0, amexg: 0, sav: 9000 };
    for (const t of tx) bal[t.acct] += t.amt;
    S.accounts.chk.balance = Math.round(Math.max(bal.chk, 3150.12) * 100) / 100;
    S.accounts.sapph.balance = -1843.21;
    S.accounts.amexg.balance = -962.4;
    S.accounts.sav.balance = Math.round(bal.sav * 100) / 100;
    S.goals = [
      { id: 'g1', name: 'Emergency fund', target: 20000, saved: 9500, date: +U.addMonths(today, 14), icon: 'shield-check', color: '#43D9B8', created: Date.now() },
      { id: 'g2', name: 'Family trip', target: 4500, saved: 800, date: +U.addMonths(today, 7), icon: 'plane', color: '#7C8CFF', created: Date.now() },
    ];
    S.cats.find((c) => c.id === 'dining').budget = 450;
    S.cats.find((c) => c.id === 'groceries').budget = 900;
    S.cats.find((c) => c.id === 'shopping').budget = 400;
    S.cats.find((c) => c.id === 'coffee').budget = 60;
    S.lastSync = Date.now(); S.oldest = +start;
    S.syncLog = [{ at: Date.now(), ok: true, msg: 'Sample data loaded', n: tx.length }];
    Store.S = S;
    Store.commit();
  };
  Store.demoTick = function () { Store.S.lastSync = Date.now(); Store.commit(); };

  Store.resetAll = function () {
    N.sync('wipeAll');
    Store.S = fresh();
    Store.commit();
  };
  Store.fresh = fresh;
  window.Store = Store;
})();

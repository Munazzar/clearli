/* Clearli — Home, Activity, Transaction detail, Category picker */
(function () {
  const I = U.icon;
  const DAY = U.DAY;

  /* =============================== HOME =============================== */
  App.screens.home = function () {
    const S = Store.S; const V = Store.V; const list = App.list();
    const sc = App.scope;
    const accts = Object.values(S.accounts).filter((a) => !a.hidden && (!sc.accts.length || sc.accts.includes(a.id)) && (!sc.conns.length || sc.conns.includes(a.conn)));
    const inTot = accts.filter((a) => !a.excludeTotals);
    const stash = sc.accts.length || sc.conns.length ? 0 : E.assetsTotal(S, true);
    const net = U.sum(inTot, (a) => a.balance) + stash;
    const cash = U.sum(inTot.filter((a) => a.type === 'checking' || a.type === 'savings'), (a) => a.balance);
    const credit = U.sum(inTot.filter((a) => a.type === 'credit' || a.type === 'loan'), (a) => a.balance);
    const inv = U.sum(inTot.filter((a) => a.type === 'investment'), (a) => a.balance);
    const now = new Date();
    const a = U.som(now); const pa = U.addMonths(a, -1);
    const fc = E.forecastMonth(V, list);
    const lastSame = E.totals(E.inRange(list, pa, U.addDays(pa, now.getDate()))).spend;
    const hist = E.balanceHistory(V, sc, U.addDays(U.sod(now), -89), U.addDays(U.sod(now), 1), 'day');
    const cumThis = E.cumulativeDaily(list, a, U.addDays(U.sod(now), 1), E.spendOf);
    const cumPrev = E.cumulativeDaily(list, pa, a, E.spendOf);
    const dim = Math.max(U.dim(now), cumPrev.length);
    const labels = Array.from({ length: dim }, (_, i) => String(i + 1));
    const ins = App.insights();
    const potential = U.sum(ins, (x) => (x.save || 0) + (x.earn || 0));
    const up = E.projectRecurring(V, U.sod(now), U.addDays(U.sod(now), 15)).filter((x) => sc.accts.length ? sc.accts.includes(x.r.acct) : true).sort((x, y) => x.date - y.date);
    const cats = E.byCategory(V, E.inRange(list, a, U.addMonths(a, 1))).slice(0, 5);
    const buds = E.budgetStatus(V, list, S);
    const goalsCommit = U.sum(S.goals.filter((g) => g.date && g.saved < g.target), (g) => (g.target - g.saved) / Math.max(0.5, (g.date - Date.now()) / (30.44 * DAY)));
    const recExp = U.sum(V.recurring.filter((r) => r.active && r.amount < 0), (r) => -r.monthly);
    const recPaidMTD = U.sum(E.inRange(list, a, now).filter((t) => t.recurring && t.kind === 'expense'), (t) => -t.amt);
    const varMTD = Math.max(0, fc.mtd.spend - recPaidMTD);
    const income = Math.max(fc.base.income, fc.projIncome);
    const safeMonthVar = income - recExp - goalsCommit;
    const daysLeft = U.dim(now) - now.getDate() + 1;
    const safeDaily = (safeMonthVar - varMTD) / daysLeft;
    const hasData = V.list.length > 0;

    let body = '';
    if (S.errors && S.errors.length) body += `<div class="g pad-s small warn" style="margin-bottom:12px">${I('alert-triangle', 'sm')} ${U.esc(S.errors[0])}</div>`;
    body += `<div class="g hero">
      <div class="row between"><div class="eyebrow">Net worth · ${U.esc(App.scopeLabel())}</div><div class="tiny faint">${S.lastSync ? 'Updated ' + U.ago(S.lastSync) : ''}</div></div>
      <div class="big amt" style="margin-top:6px">${U.money(net)}</div>
      <div class="sub"><span class="pill">${I('wallet', 'sm')} Cash <b class="amt">${U.money(cash, { auto: true })}</b></span><span class="pill">${I('credit-card', 'sm')} Credit <b class="amt">${U.money(credit, { auto: true })}</b></span>${stash ? `<span class="pill tap" data-a="goSavings">${I('piggy-bank', 'sm')} Savings <b class="amt">${U.money(stash, { auto: true })}</b></span>` : ''}<span class="pill" id="bfPill" style="${S.backfill && S.backfill.active ? '' : 'display:none'}">${App.bfPillHtml()}</span>${inv ? `<span class="pill">${I('trending-up', 'sm')} Invest <b class="amt">${U.money(inv, { auto: true })}</b></span>` : ''}</div>
      <div class="spark">${UI.chart('hSpark', { type: 'line', data: { labels: hist.labels, datasets: [{ data: hist.vals, borderColor: S.settings.accent, backgroundColor: UI.grad(S.settings.accent, 0.35, 0), fill: true, borderWidth: 2 }] }, options: { plugins: { tooltip: { callbacks: { label: UI.ttMoney } } }, scales: { x: { display: false }, y: { display: false } } } }, 46)}</div>
    </div>`;

    if (!hasData) {
      body += `<div class="sp"></div><div class="g pad">${UI.empty('landmark', 'No transactions yet', S.settings.demo ? '' : 'Pull the latest from your banks.', `<div class="sp"></div><button class="btn primary" data-a="sync">${I('refresh-cw')} Sync now</button>`)}</div>`;
      return { title: 'Clearli', actions: App.scopeBtn() + App.eyeBtn(), body };
    }

    // This month
    body += UI.sec('This month', `<span class="small faint">${U.fmtMonth(now)}</span>`);
    body += `<div class="g pad"><div class="row between" style="align-items:flex-start">
        <div><div class="eyebrow">Spent so far</div><div class="mid amt">${U.money(fc.mtd.spend)}</div><div class="small" style="margin-top:3px">${UI.delta(fc.mtd.spend, lastSame, true)} <span class="faint">vs same day last month</span></div></div>
        <div style="text-align:right"><div class="eyebrow">Projected</div><div class="h3 amt" style="margin-top:4px">${U.money(fc.projSpend, { whole: true })}</div><div class="tiny faint">last month <span class="amt">${U.money(fc.lastMonthSpend, { whole: true })}</span></div></div>
      </div>
      ${UI.chart('hPace', { type: 'line', data: { labels, datasets: [
        { label: 'This month', data: cumThis, borderColor: S.settings.accent, backgroundColor: UI.grad(S.settings.accent, 0.3, 0), fill: true },
        { label: 'Last month', data: cumPrev, borderColor: UI.css('--text3'), borderDash: [5, 5], borderWidth: 2 },
      ] }, options: UI.baseOpts({ extra: {} }) }, 140)}
      <div class="grid3" style="margin-top:12px">
        <div><div class="tiny faint">Income</div><div class="b pos amt">${U.money(fc.mtd.income, { auto: true })}</div></div>
        <div><div class="tiny faint">Net</div><div class="b amt ${fc.mtd.net >= 0 ? 'pos' : 'neg'}">${U.money(fc.mtd.net, { auto: true, sign: true })}</div></div>
        <div><div class="tiny faint">Transactions</div><div class="b">${fc.mtd.n}</div></div>
      </div></div>`;

    // Safe to spend + leaks
    body += `<div class="grid2" style="margin-top:12px">
      <div class="g pad-s tap" data-a="safeInfo"><div class="eyebrow">Safe to spend</div>${safeDaily >= 0 ? `<div class="mid amt" style="margin-top:6px">${U.money(safeDaily, { whole: true })}</div><div class="tiny faint">per day · ${daysLeft} days left</div>` : `<div class="mid amt neg" style="margin-top:6px">${U.money(-safeDaily * daysLeft, { whole: true })}</div><div class="tiny faint">over plan this month</div>`}</div>
      <div class="g pad-s tap" data-a="goLeaks" style="background:linear-gradient(150deg,${U.hexA('#3DDC97', .28)},${U.hexA('#3DDC97', .05)})"><div class="eyebrow">Leaks found</div><div class="mid pos amt" style="margin-top:6px">${U.money(potential, { whole: true, compact: true })}</div><div class="tiny faint">potential per year · ${ins.length} tips</div></div>
    </div>`;

    // Insights teaser
    if (ins.length) {
      body += UI.sec('Hidden expenses', `<button class="link" data-a="goLeaks">See all</button>`);
      body += ins.slice(0, 2).map((x) => App.insightCard(x, true)).join('<div style="height:10px"></div>');
    }

    // Upcoming
    body += UI.sec('Coming up', `<button class="link" data-a="goCal">Calendar</button>`);
    if (up.length) {
      body += `<div class="list g">${up.slice(0, 6).map((x) => { const c = V.catMap[x.r.cat]; return `<div class="item tap" data-a="recOpen" data-x="${U.esc(x.r.key)}">${UI.catBubble(c)}<div class="grow"><div class="t ell">${U.esc(x.r.name)}</div><div class="s">${U.fmtDate(x.date, { rel: true })} · ${x.r.freq}</div></div><div class="r b">${U.amt(x.r.amount, { color: true })}</div></div>`; }).join('')}</div>`;
    } else body += `<div class="g pad-s small muted">No recurring charges expected in the next two weeks.</div>`;

    // Accounts
    body += UI.sec('Accounts', `<button class="link" data-a="push" data-x="accounts">Manage</button>`);
    body += `<div class="acctcards">${accts.map((x) => `<div class="g acard tap" data-a="acctFilter" data-x="${U.esc(x.id)}"><div class="bank ell">${U.esc((S.conns[x.conn] || {}).name || '')}</div><div class="nm ell">${U.esc(x.alias || x.name)}</div><div class="bl amt ${x.balance < 0 ? 'neg' : ''}">${U.money(x.balance)}</div>${x.avail != null && x.avail !== x.balance ? `<div class="tiny faint">Available <span class="amt">${U.money(x.avail, { auto: true })}</span></div>` : `<div class="tiny faint">${U.esc(x.type)}</div>`}</div>`).join('')}</div>`;

    // Categories
    if (cats.length) {
      const max = cats[0].v;
      body += UI.sec('Top categories', `<button class="link" data-a="tab" data-x="reports">Reports</button>`);
      body += `<div class="g pad">${cats.map((c) => `<div class="tap" data-a="catDrill" data-x="${c.cat}" style="margin-bottom:12px"><div class="row" style="margin-bottom:6px">${I(c.c.icon, 'sm')}<span class="grow small b">${U.esc(c.c.name)}</span><span class="small b amt">${U.money(c.v, { auto: true })}</span></div>${UI.progress(c.v / max, c.c.color)}</div>`).join('')}</div>`;
    }

    // Budgets
    if (buds.length) {
      body += UI.sec('Budgets', `<button class="link" data-a="goBudgets">Edit</button>`);
      body += `<div class="g pad">${buds.map((b) => `<div style="margin-bottom:14px"><div class="row" style="margin-bottom:6px"><span class="grow small b">${U.esc(b.c.name)}</span><span class="small ${b.over ? 'neg' : b.ahead ? 'warn' : 'muted'}"><span class="amt">${U.money(b.spent, { whole: true })}</span> / <span class="amt">${U.money(b.budget, { whole: true })}</span></span></div>${UI.progress(b.pct, b.over ? 'var(--neg)' : b.ahead ? 'var(--warn)' : b.c.color, b.pace)}</div>`).join('')}</div>`;
    }

    // Recent
    body += UI.sec('Recent', `<button class="link" data-a="tab" data-x="activity">All activity</button>`);
    body += `<div class="list g">${list.slice(0, 6).map((t) => UI.txRow(t, { showDate: true })).join('')}</div>`;

    return { title: 'Clearli', actions: App.scopeBtn() + `<button class="iconbtn g" data-a="sync">${I('refresh-cw')}</button>` + App.eyeBtn(), body };
  };
  UI.on('goLeaks', () => { App.rep.seg = 'leaks'; App.go('reports'); });
  UI.on('goSavings', () => { App.plan.seg = 'savings'; App.go('plan'); });
  UI.on('goCal', () => { App.plan.seg = 'calendar'; App.go('plan'); });
  UI.on('goBudgets', () => { App.plan.seg = 'budgets'; App.go('plan'); });
  UI.on('acctFilter', (id) => { App.scope = { accts: [id], conns: [] }; App.render(); UI.toast('Showing ' + (Store.S.accounts[id].alias || Store.S.accounts[id].name), 'filter'); });
  UI.on('safeInfo', () => {
    UI.sheet({ title: 'Safe to spend', body: `<p class="muted">An estimate of what you can spend per day for the rest of this month on flexible purchases, after:</p>
      <div class="list g flat"><div class="item"><div class="grow">Expected monthly income</div><div class="b amt">${U.money(Math.max(E.forecastMonth(Store.V, App.list()).base.income, 0), { whole: true })}</div></div>
      <div class="item"><div class="grow">Recurring bills & subscriptions</div><div class="b amt neg">−${U.money(U.sum(Store.V.recurring.filter((r) => r.active && r.amount < 0), (r) => -r.monthly), { whole: true })}</div></div>
      <div class="item"><div class="grow">Goal contributions</div><div class="b amt neg">−${U.money(U.sum(Store.S.goals.filter((g) => g.date && g.saved < g.target), (g) => (g.target - g.saved) / Math.max(0.5, (g.date - Date.now()) / (30.44 * DAY))), { whole: true })}</div></div></div>
      <p class="small faint">Flexible spending already made this month is subtracted, and what's left is spread over the remaining days.</p>` });
  });

  App.insightCard = function (x, compact) {
    const color = x.sev >= 3 ? '#FF6B81' : x.sev === 2 ? '#FFB547' : x.sev === 1 ? '#5AC8FA' : '#8A93B8';
    const val = x.save ? `<span class="save-tag amt">Save ~${U.money(x.save, { whole: true })}/yr</span>` : x.earn ? `<span class="save-tag amt">Earn ~${U.money(x.earn, { whole: true })}/yr</span>` : x.note ? `<span class="save-tag amt" style="color:var(--warn)">${x.note}</span>` : '';
    let items = '';
    if (!compact && x.items && x.items.length) {
      items = `<div class="list" style="margin-top:10px;background:var(--fill)">${x.items.slice(0, 10).map((it) => `<div class="item tap" data-a="insItem" data-x="${U.esc(JSON.stringify({ tx: it.tx, merchant: it.merchant, cat: it.cat, key: it.key }))}"><div class="grow"><div class="t ell" style="font-size:14px">${U.esc(it.label)}</div><div class="s">${U.esc(it.sub || '')}</div></div><div class="b small amt">${U.money(it.v)}</div></div>`).join('')}</div>`;
    }
    return `<div class="g insight tap" ${compact ? 'data-a="goLeaks"' : ''}><div class="row" style="align-items:flex-start">${UI.bubble(x.icon, color)}<div class="grow"><div class="h3">${U.esc(x.title)}</div><div class="small muted" style="margin-top:4px">${x.body}</div><div style="margin-top:6px">${val}</div></div></div>${items}${!compact && x.action === 'uncat' ? `<div class="sp"></div><button class="btn sm" data-a="showUncat">Categorize now</button>` : ''}</div>`;
  };
  UI.on('insItem', (j) => {
    const o = JSON.parse(j);
    if (o.tx) return App.openTx(o.tx);
    if (o.key) return App.openRecurring(o.key);
    if (o.merchant) return App.openMerchant(o.merchant);
    if (o.cat) return App.openCategory(o.cat);
  });
  UI.on('showUncat', () => { App.act = Object.assign(App.act, { flag: 'uncat', range: 'all', type: 'all', cat: '', q: '' }); App.go('activity'); });

  /* =============================== ACTIVITY =============================== */
  const RANGES = [['all', 'All time'], ['thisM', 'This month'], ['lastM', 'Last month'], ['30', '30 days'], ['90', '90 days'], ['thisY', 'This year'], ['custom', 'Custom']];
  App.rangeOf = function (id) {
    const now = new Date(); const t = U.addDays(U.sod(now), 1);
    if (id === 'thisM') return [U.som(now), U.addMonths(U.som(now), 1)];
    if (id === 'lastM') return [U.addMonths(U.som(now), -1), U.som(now)];
    if (id === '30') return [U.addDays(t, -30), t];
    if (id === '90') return [U.addDays(t, -90), t];
    if (id === 'thisY') return [U.soy(now), U.addMonths(U.soy(now), 12)];
    if (id === 'custom' && App.act.from && App.act.to) return [U.parseInputDate(App.act.from), U.addDays(U.parseInputDate(App.act.to), 1)];
    return null;
  };
  App.activityFiltered = function () {
    const f = App.act;
    let list = App.list({ includeExcluded: f.flag === 'hidden' });
    const r = App.rangeOf(f.range);
    if (r) list = E.inRangeTs(list, r[0], r[1]);
    if (f.type === 'out') list = list.filter((t) => t.kind === 'expense');
    else if (f.type === 'in') list = list.filter((t) => t.kind === 'income');
    else if (f.type === 'xfer') list = list.filter((t) => t.kind === 'transfer');
    if (f.cat) list = list.filter((t) => t.cat === f.cat);
    if (f.flag === 'pending') list = list.filter((t) => t.pending);
    if (f.flag === 'recurring') list = list.filter((t) => t.recurring);
    if (f.flag === 'uncat') list = list.filter((t) => t.cat === 'other');
    if (f.flag === 'notes') list = list.filter((t) => t.note || (t.tags && t.tags.length));
    if (f.flag === 'hidden') list = list.filter((t) => t.excluded);
    if (f.flag === 'big') { const th = U.median(list.filter((t) => t.kind === 'expense').map((t) => -t.amt)) * 4; list = list.filter((t) => t.kind === 'expense' && -t.amt >= Math.max(100, th)); }
    if (f.q) {
      const q = f.q.toLowerCase().trim();
      const num = parseFloat(q.replace(/[$,]/g, ''));
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q) || Store.V.catMap[t.cat].name.toLowerCase().includes(q) || (t.tags || []).some((g) => g.toLowerCase().includes(q)) || (!isNaN(num) && Math.abs(Math.abs(t.amt) - num) < 0.01));
    }
    return list;
  };
  App.activityList = function () {
    const list = App.activityFiltered();
    const f = App.act;
    const tot = E.totals(list);
    let h = `<div class="row between small" style="margin:10px 6px 0"><span class="muted">${U.num(list.length)} transactions</span><span><span class="neg amt">−${U.money(tot.spend, { auto: true })}</span> · <span class="pos amt">+${U.money(tot.income, { auto: true })}</span></span></div>`;
    if (!list.length) return h + `<div class="g" style="margin-top:12px">${UI.empty('search', 'Nothing here', 'Try a different filter or search.')}</div>`;
    const shown = list.slice(0, f.limit);
    const byDay = U.groupBy(shown, (t) => U.dayKey(t.ts));
    for (const [, txs] of byDay) {
      const dayTot = U.sum(txs, (t) => (t.kind === 'expense' ? t.amt : 0));
      h += `<div class="dayhdr"><span>${U.fmtDate(txs[0].ts, { rel: true, dow: true })}</span><span class="amt">${dayTot ? U.money(dayTot) : ''}</span></div>`;
      h += `<div class="list g">${txs.map((t) => UI.txRow(t, { select: !!f.sel, selected: f.sel && f.sel.has(t.k) })).join('')}</div>`;
    }
    if (list.length > f.limit) h += `<div class="sp"></div><button class="btn block" data-a="actMore">Show more (${U.num(list.length - f.limit)} left)</button>`;
    return h;
  };
  App.screens.activity = function () {
    const f = App.act; const V = Store.V;
    const cat = f.cat ? V.catMap[f.cat] : null;
    let body = `<div class="g search">${I('search')}<input id="actQ" data-in="actQ" placeholder="Search name, amount, note, category" value="${U.esc(f.q)}" autocomplete="off">${f.q ? `<button data-a="actClearQ">${I('x')}</button>` : ''}</div><div class="sp" style="height:10px"></div>`;
    body += `<div class="chips">${RANGES.map(([id, l]) => `<button class="chip ${f.range === id ? 'on' : ''}" data-a="actRange" data-x="${id}">${l}</button>`).join('')}</div>`;
    if (f.range === 'custom') body += `<div class="grid2" style="margin:4px 0 8px"><input type="date" class="inp" data-ch="actFrom" value="${f.from}"><input type="date" class="inp" data-ch="actTo" value="${f.to}"></div>`;
    body += `<div class="chips">${[['all', 'Everything'], ['out', 'Spending'], ['in', 'Income'], ['xfer', 'Transfers']].map(([id, l]) => `<button class="chip ${f.type === id ? 'on' : ''}" data-a="actType" data-x="${id}">${l}</button>`).join('')}
      <button class="chip ${cat ? 'on' : ''}" data-a="actCat">${I(cat ? cat.icon : 'tag')}${cat ? U.esc(cat.name) : 'Category'}${cat ? '' : I('chevron-down')}</button>
      ${[['pending', 'Pending', 'clock'], ['recurring', 'Recurring', 'repeat'], ['uncat', 'Uncategorized', 'circle-help'], ['big', 'Large', 'flame'], ['notes', 'Notes & tags', 'file-text'], ['hidden', 'Hidden', 'eye-off']].map(([id, l, ic]) => `<button class="chip ${f.flag === id ? 'on' : ''}" data-a="actFlag" data-x="${id}">${I(ic)}${l}</button>`).join('')}</div>`;
    body += `<div id="actList">${App.activityList()}</div>`;
    let floating = '';
    if (f.sel) {
      floating = `<div class="selbar g"><button class="iconbtn" data-a="selClear">${I('x')}</button><div class="grow b">${f.sel.size} selected</div><button class="btn sm" data-a="selCat" ${f.sel.size ? '' : 'disabled'}>${I('tag', 'sm')}</button><button class="btn sm" data-a="selCompare" ${f.sel.size >= 2 ? '' : 'disabled'}>${I('git-compare-arrows', 'sm')}</button><button class="btn sm" data-a="selHide" ${f.sel.size ? '' : 'disabled'}>${I('eye-off', 'sm')}</button></div>`;
    }
    return { title: 'Activity', actions: App.scopeBtn() + `<button class="iconbtn g" data-a="actSelect">${I(f.sel ? 'x' : 'check')}</button><button class="iconbtn g" data-a="actExport">${I('download')}</button>`, body, floating };
  };
  const refreshList = () => { const el = document.getElementById('actList'); if (el) { el.innerHTML = App.activityList(); } };
  UI.on('actQ', U.debounce((v) => { App.act.q = v; App.act.limit = 120; refreshList(); }, 180));
  UI.on('actClearQ', () => { App.act.q = ''; App.render(); });
  UI.on('actRange', (x) => { App.act.range = x; App.act.limit = 120; if (x === 'custom' && !App.act.from) { App.act.from = U.inputDate(U.addDays(new Date(), -30)); App.act.to = U.inputDate(new Date()); } App.render(); });
  UI.on('actFrom', (v) => { App.act.from = v; App.render(); });
  UI.on('actTo', (v) => { App.act.to = v; App.render(); });
  UI.on('actType', (x) => { App.act.type = x; App.render(); });
  UI.on('actFlag', (x) => { App.act.flag = App.act.flag === x ? '' : x; App.render(); });
  UI.on('actCat', () => { if (App.act.cat) { App.act.cat = ''; App.render(); return; } App.pickCategory(null, (id) => { App.act.cat = id; App.render(); }); });
  UI.on('actMore', () => { App.act.limit += 200; refreshList(); });
  UI.on('actSelect', () => { App.act.sel = App.act.sel ? null : new Set(); App.render(); });
  UI.on('selClear', () => { App.act.sel = null; App.render(); });
  UI.on('txSel', (k) => { const s = App.act.sel; if (s.has(k)) s.delete(k); else s.add(k); App.render(); });
  UI.on('selCat', () => {
    const keys = [...App.act.sel];
    App.pickCategory(null, (id) => { keys.forEach((k) => Store.setEdit(k, { cat: id })); App.act.sel = null; Store.commit(); App.render(); UI.toast(`Moved ${keys.length} to ${Store.V.catMap[id].name}`, 'check'); });
  });
  UI.on('selHide', () => { const keys = [...App.act.sel]; keys.forEach((k) => Store.setEdit(k, { excluded: true })); App.act.sel = null; Store.commit(); App.render(); UI.toast(`Hidden ${keys.length} from reports`, 'eye-off'); });
  UI.on('selCompare', () => App.compareTxns([...App.act.sel]));
  UI.on('actExport', async () => {
    const list = App.activityFiltered();
    const r = await Store.N.call('exportFile', `clearli-transactions-${U.dayKey(new Date())}.csv`, 'text/csv', Store.csv(list));
    if (r.ok) UI.toast(`Exported ${list.length} transactions`, 'check'); else if (r.error !== 'cancelled') UI.toast(r.error, 'alert-triangle');
  });

  /* ======================= Transaction detail ======================= */
  UI.on('tx', (k) => App.openTx(k));
  App.openTx = function (k) {
    const body = () => {
      const V = Store.V; const S = Store.S;
      const raw = S.txns[k]; const split = ((S.edits[k] || {}).splits || []).length > 1;
      const t = V.byKey[k] || (V.byKey[k + '~0'] && raw ? Object.assign({}, V.byKey[k + '~0'], { k, amt: raw.amt, parent: null }) : null);
      if (!t) return UI.empty('info', 'Transaction not found');
      const parts = split ? V.list.filter((x) => x.parent === k).sort((x, y) => x.part - y.part) : [];
      const ctx0 = t.kind === 'income' && t.amt > 0 && !split ? V.list.filter((x) => x.m === t.m && x.k !== k && x.kind === 'income' && !x.parent) : [];
      const usual = ctx0.length >= 2 ? U.median(ctx0.map((x) => x.amt)) : 0;
      const looksBonus = usual > 0 && t.amt > usual * 1.2 && t.amt - usual >= 50;
      const c = V.catMap[t.cat]; const a = S.accounts[t.acct] || {}; const conn = S.conns[a.conn] || {};
      const ctx = E.txnContext(V, t);
      const monthly = E.series(ctx.all, U.addMonths(U.som(new Date()), -11), U.addMonths(U.som(new Date()), 1), 'month', 0, (x) => Math.abs(x.amt));
      const srcLbl = { manual: 'Set by you', rule: 'From your rule', learned: 'Learned from your choices', bank: 'From your bank', auto: 'Auto-detected', paired: 'Matched transfer' }[t.catSrc];
      return `<div class="center" style="padding:6px 0 14px">${UI.catBubble(c).replace('class="bubble', 'style="margin:0 auto 10px;width:56px;height:56px;border-radius:18px" class="bubble')}
        <div class="big amt ${t.amt > 0 && t.kind !== 'transfer' ? 'pos' : ''}" style="font-size:36px">${U.money(t.amt, { sign: true })}</div>
        <div class="h3" style="margin-top:6px">${U.esc(t.name)}</div><div class="small faint" style="margin-top:3px">${U.fmtDate(t.ts, { dow: true, year: true })}${t.pending ? ' · <span class="warn">Pending</span>' : ''}</div></div>
        <div class="list g flat">
          ${split ? `<div class="item tap" data-a="txSplit" data-x="${U.esc(k)}">${UI.bubble('scissors', '#FFB547')}<div class="grow"><div class="t">Split into ${parts.length} parts</div><div class="s ell">${parts.map((p) => U.esc(V.catMap[p.cat].name) + ' ' + U.money(p.amt)).join(' · ')}</div></div>${I('chevron-right')}</div>`
            : `<div class="item tap" data-a="txCat" data-x="${U.esc(k)}">${UI.catBubble(c)}<div class="grow"><div class="t">${U.esc(c.name)}</div><div class="s">${srcLbl} · tap to change</div></div>${I('chevron-right')}</div>`}
          <div class="item tap" data-a="txRename" data-x="${U.esc(k)}">${UI.bubble('pencil', '#8A93B8')}<div class="grow"><div class="t">Rename</div><div class="s ell">Bank shows: ${U.esc(t.desc)}</div></div>${I('chevron-right')}</div>
          <div class="item">${UI.bubble('landmark', '#8A93B8')}<div class="grow"><div class="t ell">${U.esc(a.alias || a.name || '')}</div><div class="s">${U.esc(conn.name || '')}</div></div></div>
          ${!split ? `<div class="item tap" data-a="txSplit" data-x="${U.esc(k)}">${UI.bubble('scissors', '#FFB547')}<div class="grow"><div class="t">Split</div><div class="s">${t.amt > 0 ? 'Separate a bonus, reimbursement or refund' : 'Divide across categories'}</div></div>${I('chevron-right')}</div>` : ''}
          ${t.amt < 0 ? `<div class="item tap" data-a="txSave" data-x="${U.esc(k)}">${UI.bubble('piggy-bank', '#43D9B8')}<div class="grow"><div class="t">${S.edits[k] && S.edits[k].stash ? 'Moved to ' + U.esc(((S.assets || []).find((x) => x.id === S.edits[k].stash) || {}).name || 'savings') : 'Moved to savings'}</div><div class="s">Cash, gold, investments or another account</div></div>${I('chevron-right')}</div>` : ''}
        </div>
        ${looksBonus ? `<div class="g pad-s" style="margin-top:12px;background:linear-gradient(150deg,${U.hexA('#FFD166', 0.28)},${U.hexA('#FFD166', 0.05)})"><div class="small">${I('sparkles', 'sm')} This is <b class="amt">${U.money(t.amt - usual)}</b> more than your usual <b class="amt">${U.money(usual)}</b> from ${U.esc(t.name)}. Includes a bonus?</div><button class="btn sm" style="margin-top:10px" data-a="txBonus" data-x="${U.esc(k)}">Split out ${U.money(t.amt - usual)} as bonus</button></div>` : ''}
        ${t.amt > 0 ? (() => { const rule = S.rules.find((r) => r.match === 'merchant' && r.pattern === t.m); const day = new Date(t.ts).getDate(); return `<div class="g pad-s" style="margin-top:14px"><div class="h3" style="margin-bottom:8px">${I('calendar-clock', 'sm')} Which month does this money belong to?</div>${UI.seg([['', 'Auto'], ['this', U.fmtMonth(t.ts, true)], ['next', U.fmtMonth(U.addMonths(U.som(t.ts), 1), true)]], t.month || '', 'txMonth')}
          <div class="small ${t.shifted ? 'pos' : 'muted'}" style="margin:8px 4px 0">${t.shifted ? `Counted as <b>${U.fmtMonth(t.rts)}</b> income (arrived ${U.fmtDate(t.ts)}).` : `Counted as <b>${U.fmtMonth(t.ts)}</b> income.`}</div>
          ${t.kind !== 'income' ? `<div class="small warn" style="margin:6px 4px 0">${I('info', 'sm')} Its category (${U.esc(c.name)}) isn't counted as income. Change the category to Paycheck or Other Income to include it.</div>` : ''}
          <div class="item" style="padding:10px 2px 0"><div class="grow"><div class="t" style="font-size:14px">Always for ${U.esc(t.rawName)}</div><div class="s">Deposits on or after the ${day}${['th', 'st', 'nd', 'rd'][(day % 10 > 3 || [11, 12, 13].includes(day)) ? 0 : day % 10]} count toward the next month</div></div>${UI.toggle(!!(rule && rule.nextFrom), 'txNextRule', k)}</div>
          <div class="tiny faint" style="margin:6px 4px 0">You can also add the tag <b>nextmonth</b> to any deposit.</div></div>`; })() : ''}
        ${t.series ? (() => { const r = V.recurring.find((x) => x.key === t.series); return r ? `<div class="list g flat" style="margin-top:12px"><div class="item tap" data-a="recOpen" data-x="${U.esc(r.key)}">${UI.bubble('repeat', '#B78CFF')}<div class="grow"><div class="t">Part of: ${U.esc(r.name)}</div><div class="s">${r.freq} · ${U.money(Math.abs(r.amount))} · name or categorize this subscription separately</div></div>${I('chevron-right')}</div></div>` : ''; })() : ''}
        <div class="sp"></div>
        <label class="field"><span>Note</span><textarea class="inp" data-in="txNote" data-x="${U.esc(k)}" id="txNote" placeholder="Add a note for yourself" style="min-height:64px">${U.esc(t.note)}</textarea></label>
        <label class="field"><span>Tags (space separated)</span><input class="inp" data-ch="txTags" data-x="${U.esc(k)}" value="${U.esc((t.tags || []).join(' '))}" placeholder="work reimbursable trip"></label>
        <div class="list g flat">
          <div class="item"><div class="grow"><div class="t">Hide from reports</div><div class="s">Keep it in the list but ignore it in totals</div></div>${UI.toggle(t.excluded, 'txExcl', k)}</div>
          <div class="item"><div class="grow"><div class="t">Recurring</div><div class="s">${t.recurring ? 'Detected as a repeating charge' : 'Not detected as repeating'}</div></div>${UI.toggle(t.recurring, 'txRec', k)}</div>
        </div>
        ${UI.sec('How it compares')}
        <div class="grid3">
          <div class="g kpi"><div class="tiny faint">Avg here</div><div class="v amt" style="font-size:17px">${U.money(ctx.avg)}</div></div>
          <div class="g kpi"><div class="tiny faint">Visits</div><div class="v" style="font-size:17px">${ctx.count}</div></div>
          <div class="g kpi"><div class="tiny faint">Last 12 mo</div><div class="v amt" style="font-size:17px">${U.money(ctx.ytot, { whole: true })}</div></div>
        </div>
        <div class="g pad-s" style="margin-top:10px"><div class="small muted">${ctx.first ? 'First time at this merchant.' : `This is ${Math.abs(t.amt) > ctx.avg ? `<b class="neg">${U.pctAbs((Math.abs(t.amt) - ctx.avg) / ctx.avg)}</b> above` : `<b class="pos">${U.pctAbs((ctx.avg - Math.abs(t.amt)) / ctx.avg)}</b> below`} your average here${ctx.prev ? `, last time was <span class="amt">${U.money(Math.abs(ctx.prev.amt))}</span> on ${U.fmtDate(ctx.prev.ts)}` : ''}.`}</div>
        ${UI.chart('txMerch', { type: 'bar', data: { labels: monthly.labels, datasets: [{ label: t.name, data: monthly.vals, backgroundColor: UI.grad(c.color, 0.9, 0.35) }] }, options: UI.baseOpts() }, 130)}</div>
        ${ctx.count > 1 ? UI.sec('History', `<button class="link" data-a="merchOpen" data-x="${U.esc(t.m)}">Merchant view</button>`) + `<div class="list g flat">${ctx.all.slice(0, 8).map((x) => UI.txRow(x, { showDate: true, sub: U.fmtDate(x.ts, { year: true }) + ' · ' + V.catMap[x.cat].name })).join('')}</div>` : ''}`;
    };
    UI.sheet({ title: 'Transaction', body, full: true, onClose: () => App.render() });
  };
  UI.on('txNote', U.debounce((v, el) => { Store.setEdit(el.dataset.x, { note: v }); Store.commit({ silent: true }); }, 400));
  UI.on('txTags', (v, el) => { Store.setEdit(el.dataset.x, { tags: v.split(/[\s,]+/).map((s) => s.replace(/^#/, '')).filter(Boolean) }); Store.commit({ silent: true }); });
  UI.on('txExcl', (k) => { const t = Store.V.byKey[k]; Store.setEdit(k, { excluded: !t.excluded }); Store.commit({ silent: true }); UI.renderSheet(); });
  UI.on('txRec', (k) => {
    const t = Store.V.byKey[k]; const ov = Store.S.recurringOverrides;
    if (t.recurring) ov[t.m] = 'ignore'; else ov[t.m] = 'force';
    Store.commit({ silent: true }); UI.renderSheet();
    UI.toast(t.recurring ? 'Won\'t treat this merchant as recurring' : 'Marked as recurring', 'repeat');
  });
  UI.on('merchOpen', (m) => App.openMerchant(m));
  let curTx = null;
  const _openTx = App.openTx;
  App.openTx = function (k) { curTx = k; _openTx(k); };
  UI.on('txNextRule', (k) => {
    const t = Store.V.byKey[k] || Store.V.byKey[k + '~0'];
    const r = Store.S.rules.find((x) => x.match === 'merchant' && x.pattern === t.m);
    if (r && r.nextFrom) { delete r.nextFrom; if (!r.cat && !r.rename) Store.S.rules = Store.S.rules.filter((x) => x !== r); }
    else Store.upsertRule({ match: 'merchant', pattern: t.m, nextFrom: new Date(t.ts).getDate() });
    Store.commit({ silent: true }); UI.renderSheet();
    UI.toast(r && !r.nextFrom ? 'Rule removed' : 'Late deposits from ' + t.rawName + ' now count toward the next month', 'calendar-clock');
  });
  UI.on('txMonth', (x) => { Store.setEdit(curTx, { month: x || null }); Store.commit({ silent: true }); UI.renderSheet(); });
  UI.on('txBonus', (k) => {
    const V = Store.V; const t = V.byKey[k];
    const usual = U.median(V.list.filter((x) => x.m === t.m && x.k !== k && x.kind === 'income' && !x.parent).map((x) => x.amt));
    App.editSplit(k, [{ amt: Math.round(usual * 100) / 100, cat: t.cat === 'bonus' ? 'income' : t.cat }, { amt: Math.round((t.amt - usual) * 100) / 100, cat: 'bonus' }]);
  });
  UI.on('txSplit', (k) => App.editSplit(k));
  App.editSplit = function (k, preset) {
    const S = Store.S; const raw = S.txns[k]; const V = Store.V;
    const cur = (S.edits[k] || {}).splits;
    const base = V.byKey[k] || V.byKey[k + '~0'];
    const parts = preset || (cur && cur.length > 1 ? cur.map((p) => Object.assign({}, p)) : [{ amt: raw.amt, cat: base.cat }, { amt: 0, cat: raw.amt > 0 ? 'bonus' : base.cat }]);
    const total = raw.amt;
    const body = () => {
      const sum = U.sum(parts, (p) => p.amt); const left = Math.round((total - sum) * 100) / 100;
      return `<div class="g pad-s row between"><div class="small muted">Transaction total</div><div class="b amt">${U.money(total)}</div></div><div class="sp"></div>
        ${parts.map((p, i) => { const c = Store.V.catMap[p.cat] || Store.V.catMap.other; return `<div class="g pad-s" style="margin-bottom:10px"><div class="row"><button class="row tap grow" data-a="spCat" data-x="${i}" style="text-align:left">${UI.catBubble(c)}<span class="b">${U.esc(c.name)}</span></button><input class="inp" style="width:130px;text-align:right" type="number" step="0.01" inputmode="decimal" data-ch="spAmt" data-x="${i}" value="${p.amt}">${parts.length > 2 ? `<button class="iconbtn" data-a="spDel" data-x="${i}">${I('x')}</button>` : ''}</div>
          <input class="inp" style="margin-top:8px;height:42px" placeholder="Note (optional)" data-ch="spNote" data-x="${i}" value="${U.esc(p.note || '')}"></div>`; }).join('')}
        <div class="row between" style="margin:4px 4px 12px"><button class="btn sm" data-a="spAdd">${I('plus', 'sm')} Add part</button><div class="small ${Math.abs(left) < 0.005 ? 'pos' : 'warn'}">${Math.abs(left) < 0.005 ? I('check', 'sm') + ' Adds up' : 'Left to assign: <b class="amt">' + U.money(left) + '</b>'}</div></div>
        ${Math.abs(left) >= 0.005 ? `<button class="btn sm block" data-a="spFill">Put the remaining ${U.money(left)} in the last part</button>` : ''}`;
    };
    UI.on('spCat', (i) => App.pickCategory(parts[i].cat, (id) => { parts[i].cat = id; UI.renderSheet(); }));
    UI.on('spAmt', (v, el) => { parts[el.dataset.x].amt = Math.round((parseFloat(v) || 0) * 100) / 100; UI.renderSheet(); });
    UI.on('spNote', (v, el) => { parts[el.dataset.x].note = v; });
    UI.on('spAdd', () => { parts.push({ amt: 0, cat: parts[parts.length - 1].cat }); UI.renderSheet(); });
    UI.on('spDel', (i) => { parts.splice(Number(i), 1); UI.renderSheet(); });
    UI.on('spFill', () => { const sum = U.sum(parts, (p) => p.amt); parts[parts.length - 1].amt = Math.round((parts[parts.length - 1].amt + total - sum) * 100) / 100; UI.renderSheet(); });
    UI.on('spSave', () => {
      const sum = U.sum(parts, (p) => p.amt);
      if (Math.abs(sum - total) >= 0.005) { UI.toast('Parts must add up to ' + U.money(total), 'info'); return; }
      Store.setEdit(k, { splits: parts.filter((p) => Math.abs(p.amt) >= 0.005), cat: null });
      Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet(); UI.toast('Split saved', 'scissors');
    });
    UI.on('spRemove', () => { Store.setEdit(k, { splits: null }); Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet(); UI.toast('Split removed', 'undo-2'); });
    UI.sheet({ title: 'Split transaction', body, full: true, foot: `${cur && cur.length > 1 ? '<button class="btn grow" data-a="spRemove">Unsplit</button>' : ''}<button class="btn primary grow" data-a="spSave">Save split</button>` });
  };

  // Category change with learning
  UI.on('txCat', (k) => {
    const t = Store.V.byKey[k];
    App.pickCategory(t.cat, async (id) => {
      const V = Store.V;
      const similar = V.list.filter((x) => x.m === t.m && x.k !== k && x.cat !== id);
      Store.setEdit(k, { cat: id });
      let msg = `Moved to ${V.catMap[id].name}`;
      if (similar.length || true) {
        const choice = await UI.choice('Apply to similar?', `Clearli can remember that <b>${U.esc(t.name)}</b> belongs in <b>${U.esc(V.catMap[id].name)}</b>.`, [
          { id: 'all', label: similar.length ? `All ${similar.length + 1} from ${U.esc(t.name)} + future ones` : `This and all future ${U.esc(t.name)}`, primary: true },
          { id: 'one', label: 'Just this transaction' },
        ]);
        if (choice === 'all') {
          Store.upsertRule({ match: 'merchant', pattern: t.m, cat: id });
          for (const x of V.list) if (x.m === t.m && Store.S.edits[x.k] && Store.S.edits[x.k].cat) Store.setEdit(x.k, { cat: null });
          Store.setEdit(k, { cat: null });
          msg = `Learned: ${t.name} → ${V.catMap[id].name}`;
        }
      }
      Store.recompute();
      const learned = E.learn(Store.S, Store.V, k);
      if (learned) msg = `Learned: ${t.name} → ${Store.V.catMap[id].name}`;
      Store.commit({ silent: true });
      UI.renderSheet();
      UI.toast(msg, 'sparkles');
    });
  });
  UI.on('txRename', async (k) => {
    const t = Store.V.byKey[k];
    UI.sheet({
      title: 'Rename', body: `<label class="field"><span>Display name</span><input class="inp" id="rnVal" value="${U.esc(t.name)}" autocomplete="off"></label><p class="small faint">Original: ${U.esc(t.desc)}</p>`,
      foot: `<button class="btn grow" data-a="rnOne" data-x="${U.esc(k)}">Just this one</button><button class="btn primary grow" data-a="rnAll" data-x="${U.esc(k)}">All from merchant</button>`,
      after: (bd) => { const i = bd.querySelector('#rnVal'); setTimeout(() => { i.focus(); i.select(); }, 350); },
    });
  });
  UI.on('rnOne', (k) => { const v = document.getElementById('rnVal').value.trim(); Store.setEdit(k, { name: v === Store.V.byKey[k].rawName ? null : v }); Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet(); UI.toast('Renamed', 'pencil'); });
  UI.on('rnAll', (k) => {
    const t = Store.V.byKey[k]; const v = document.getElementById('rnVal').value.trim();
    const r = Store.S.rules.find((x) => x.match === 'merchant' && x.pattern === t.m);
    if (r) r.rename = v; else Store.upsertRule({ match: 'merchant', pattern: t.m, rename: v });
    Store.setEdit(k, { name: null });
    Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet(); UI.toast(`All ${t.rawName} now show as “${v}”`, 'pencil');
  });

  /* ======================= Category picker ======================= */
  App.pickCategory = function (current, cb) {
    let q = '';
    const body = () => {
      const cats = Store.S.cats.filter((c) => !q || c.name.toLowerCase().includes(q));
      const grp = [['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Other']];
      return `<div class="g search" style="margin-bottom:10px">${I('search')}<input data-in="pcQ" placeholder="Find category" value="${U.esc(q)}"></div>` + grp.map(([k, l]) => {
        const cs = cats.filter((c) => c.kind === k); if (!cs.length) return '';
        return `<div class="eyebrow" style="margin:14px 6px 8px">${l}</div><div class="list g flat">${cs.map((c) => `<div class="item tap" data-a="pcPick" data-x="${c.id}">${UI.catBubble(c)}<div class="grow t">${U.esc(c.name)}</div>${c.id === current ? `<div class="check on">${I('check')}</div>` : ''}</div>`).join('')}</div>`;
      }).join('') + `<div class="sp"></div><button class="btn block" data-a="pcNew">${I('plus')} New category</button>`;
    };
    UI.on('pcQ', U.debounce((v) => { q = v.toLowerCase(); const rec = UI.sheets[UI.sheets.length - 1]; const inp = rec.el.querySelector('[data-in="pcQ"]'); const pos = inp.selectionStart; UI.renderSheet(rec); const n = rec.el.querySelector('[data-in="pcQ"]'); n.focus(); n.setSelectionRange(pos, pos); }, 150));
    UI.on('pcPick', (id) => { UI.closeSheet(); cb(id); });
    UI.on('pcNew', () => App.editCategory(null, (id) => { UI.closeSheet(); cb(id); }));
    UI.sheet({ title: 'Choose category', body, full: true });
  };
})();

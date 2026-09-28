/* Clearli — Reports: Overview, Trends, Compare, Leaks + drill-downs */
(function () {
  const I = U.icon;
  const DAY = U.DAY;
  const acc = () => Store.S.settings.accent || '#7C8CFF';

  const periodBar = () => {
    const R = App.rep;
    const pr = E.periodRange(R.pid, R.off, null, Store.S.settings.weekStart);
    return `<div class="chips">${E.PERIODS.map((p) => `<button class="chip ${R.pid === p.id ? 'on' : ''}" data-a="repP" data-x="${p.id}">${p.label}</button>`).join('')}</div>
      <div class="g row between" style="padding:6px;border-radius:22px;margin:4px 0 14px"><button class="iconbtn" data-a="repOff" data-x="-1">${I('chevron-left')}</button><div class="b">${pr.label}</div><button class="iconbtn" data-a="repOff" data-x="1" ${R.off >= 0 ? 'style="opacity:.3" disabled' : ''}>${I('chevron-right')}</button></div>`;
  };
  UI.on('repP', (x) => { App.rep.pid = x; App.rep.off = 0; App.render(); });
  UI.on('repOff', (x) => { App.rep.off = Math.min(0, App.rep.off + Number(x)); App.render(); });
  UI.on('repSeg', (x) => { App.rep.seg = x; App.render(true); });

  App.screens.reports = function () {
    const R = App.rep;
    let body = UI.seg([['overview', 'Spending'], ['income', 'Income'], ['trends', 'Trends'], ['compare', 'Compare'], ['leaks', 'Leaks']], R.seg, 'repSeg') + '<div class="sp"></div>';
    if (R.seg === 'overview') body += periodBar() + overview();
    else if (R.seg === 'income') body += periodBar() + income();
    else if (R.seg === 'trends') body += periodBar() + trends();
    else if (R.seg === 'compare') body += compare();
    else body += leaks();
    return { title: 'Reports', actions: App.scopeBtn() + App.eyeBtn(), body };
  };

  /* ---------------- Overview (inside the selected period) ---------------- */
  function overview() {
    const S = Store.S; const V = Store.V; const R = App.rep; const ws = S.settings.weekStart;
    const all = App.list();
    const pr = E.periodRange(R.pid, R.off, null, ws); const pv = E.periodRange(R.pid, R.off - 1, null, ws);
    const cur = E.inRange(all, pr.a, pr.b); const prev = E.inRange(all, pv.a, pv.b);
    const T = E.totals(cur); const P = E.totals(prev);
    const days = Math.max(1, Math.min(U.daysBetween(pr.a, pr.b), U.daysBetween(pr.a, new Date()) + 1));
    const pdays = U.daysBetween(pv.a, pv.b);
    let h = `<div class="grid2">
      ${kpi('Spent', U.money(T.spend, { auto: true }), UI.delta(T.spend, P.spend, true))}
      ${kpi('Income', U.money(T.income, { auto: true }), UI.delta(T.income, P.income))}
      ${kpi('Net', U.money(T.net, { auto: true, sign: true }), UI.delta(T.net, P.net), T.net >= 0 ? 'pos' : 'neg')}
      ${kpi('Savings rate', T.rate == null ? '—' : Math.round(T.rate * 100) + '%', P.rate == null || T.rate == null ? '' : `<span class="${T.rate >= P.rate ? 'pos' : 'neg'}">${((T.rate - P.rate) * 100).toFixed(0)} pts</span>`, '', true)}
      ${kpi('Avg / day', U.money(T.spend / days, { auto: true }), UI.delta(T.spend / days, P.spend / Math.max(1, pdays), true))}
      ${kpi('Purchases', U.num(T.n), UI.delta(T.n, P.n, true), '', true)}
    </div>`;
    if (!cur.length) return h + `<div class="sp"></div><div class="g">${UI.empty('chart-column', 'No activity in this period')}</div>`;

    // Pace: cumulative spending vs previous period
    if (R.pid !== 'D') {
      const cc = E.cumulativeDaily(all, pr.a, pr.b, E.spendOf); const cp = E.cumulativeDaily(all, pv.a, pv.b, E.spendOf);
      const todayIdx = U.daysBetween(pr.a, new Date());
      const ccCut = cc.map((v, i) => (i <= todayIdx ? v : null));
      const n = Math.max(cc.length, cp.length);
      const lbl = Array.from({ length: n }, (_, i) => E.bucketLabel(U.addDays(pr.a, i), 'day'));
      h += card('Spending pace', `vs ${pv.label}`, UI.chart('rPace', { type: 'line', data: { labels: lbl, datasets: [
        { label: pr.label, data: ccCut, borderColor: acc(), backgroundColor: UI.grad(acc(), 0.32, 0), fill: true },
        { label: pv.label, data: cp, borderColor: UI.css('--text3'), borderDash: [5, 5], borderWidth: 2 },
      ] }, options: UI.baseOpts() }, 190), legend([[acc(), pr.label], [UI.css('--text3'), pv.label]]));
    }

    // Categories donut
    const cats = E.byCategory(V, cur); const pcats = E.byCategory(V, prev);
    h += card('Where it went', `${cats.length} categories`, `<div class="row" style="gap:16px"><div style="width:46%;flex:none">${UI.chart('rDonut', { type: 'doughnut', data: { labels: cats.map((c) => c.c.name), datasets: [{ data: cats.map((c) => c.v), backgroundColor: cats.map((c) => c.c.color), hoverOffset: 8, spacing: 2, borderRadius: 6 }] }, options: { cutout: '68%', plugins: { tooltip: { callbacks: { label: UI.ttMoney } } } } }, 170)}</div>
      <div class="grow">${cats.slice(0, 6).map((c) => `<div class="row tap" data-a="catDrill" data-x="${c.cat}" style="margin:6px 0"><i style="width:9px;height:9px;border-radius:3px;background:${c.c.color}"></i><span class="small grow ell">${U.esc(c.c.name)}</span><span class="small b">${Math.round((c.v / T.spend) * 100)}%</span></div>`).join('')}</div></div>
      <div class="list" style="margin-top:12px">${cats.map((c) => { const p = (pcats.find((x) => x.cat === c.cat) || { v: 0 }).v; return `<div class="item tap" data-a="catDrill" data-x="${c.cat}" style="padding:10px 4px">${UI.catBubble(c.c)}<div class="grow"><div class="t" style="font-size:14px">${U.esc(c.c.name)}</div><div class="s">${UI.delta(c.v, p, true)}</div></div><div class="r b amt">${U.money(c.v, { auto: true })}</div></div>`; }).join('')}</div>`);

    // Stacked category breakdown across sub-buckets
    const sub = pr.p.sub;
    if (sub) {
      const top = cats.slice(0, 6).map((c) => c.cat);
      const ds = top.map((cid) => { const s = E.series(cur.filter((t) => t.cat === cid), pr.a, pr.b, sub, ws, E.spendOf); return { label: V.catMap[cid].name, data: s.vals, backgroundColor: V.catMap[cid].color, stack: 's', borderRadius: 3 }; });
      const other = E.series(cur.filter((t) => !top.includes(t.cat)), pr.a, pr.b, sub, ws, E.spendOf);
      ds.push({ label: 'Other', data: other.vals, backgroundColor: U.hexA('#8A93B8', 0.6), stack: 's', borderRadius: 3 });
      h += card('Category mix over time', `by ${sub}`, UI.chart('rStack', { type: 'bar', data: { labels: other.labels, datasets: ds }, options: UI.baseOpts({ stacked: true }) }, 220), legend(ds.map((d) => [d.backgroundColor, d.label])));
    }

    // Top merchants
    const ms = E.byMerchant(cur).slice(0, 8);
    if (ms.length) h += card('Top merchants', '', UI.chart('rMerch', { type: 'bar', data: { labels: ms.map((m) => m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name), datasets: [{ label: 'Spent', data: ms.map((m) => m.v), backgroundColor: ms.map((m) => V.catMap[m.cat].color) }] }, options: Object.assign(UI.baseOpts({ horizontal: true }), { indexAxis: 'y', onClick: (e, els) => { if (els[0]) App.openMerchant(ms[els[0].index].m); } }) }, 40 + ms.length * 30));

    // Income sources
    const inc = E.byMerchant(cur, 'income').slice(0, 5);
    if (inc.length) h += card('Income sources', '', `<div class="list">${inc.map((m) => `<div class="item tap" data-a="merchOpen" data-x="${U.esc(m.m)}" style="padding:10px 4px">${UI.bubble('hand-coins', '#43D9B8')}<div class="grow"><div class="t" style="font-size:14px">${U.esc(m.name)}</div><div class="s">${m.n} deposit${m.n > 1 ? 's' : ''}</div></div><div class="r b pos amt">${U.money(m.v, { auto: true })}</div></div>`).join('')}</div>`);

    // Heatmap
    const dmap = E.dailySpendMap(cur, pr.a, pr.b);
    const dv = Object.values(dmap).sort((x, y) => x - y); const maxD = Math.max(1, dv[Math.floor(dv.length * 0.9)] || 1);
    if (R.pid === 'M' || R.pid === 'W') {
      const first = U.sow(pr.a, ws); const cells = [];
      for (let d = first; d < pr.b || cells.length % 7; d = U.addDays(d, 1)) cells.push(d);
      h += card('Spending heatmap', 'darker = more', `<div class="heat" style="grid-template-columns:repeat(7,1fr)">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="tiny faint center">${U.DOW[(i + ws) % 7][0]}</div>`).join('')}${cells.map((d) => { const v = dmap[U.dayKey(d)] || 0; const out = d < pr.a || d >= pr.b; return `<div class="c ${out ? 'out' : ''} ${U.dayKey(d) === U.dayKey(new Date()) ? 'today' : ''} tap" data-a="dayOpen" data-x="${+d}" style="${v ? `background:${U.hexA('#FF6FB5', 0.1 + 0.9 * Math.min(1, v / maxD))};color:#fff` : ''}">${d.getDate()}</div>`; }).join('')}</div>`);
    } else if (R.pid !== 'D') {
      const first = U.sow(pr.a, 0); const cells = [];
      for (let d = first; d < pr.b; d = U.addDays(d, 1)) cells.push(d);
      h += card('Spending heatmap', 'each square is a day', `<div class="heatY" style="padding-bottom:6px">${cells.map((d) => { const v = dmap[U.dayKey(d)] || 0; return `<div class="c" title="${U.dayKey(d)}" style="${v ? `background:${U.hexA('#FF6FB5', 0.1 + 0.9 * Math.min(1, v / maxD))}` : ''}${d < pr.a ? ';opacity:.2' : ''}"></div>`; }).join('')}</div>`);
    }

    // Day of week
    const dow = E.dowProfile(all.filter((t) => !t.recurring), pr.a, new Date(Math.min(+pr.b, Date.now() + DAY)));
    h += card('By day of week', 'flexible spending, avg per day', UI.chart('rDow', { type: 'bar', data: { labels: U.DOW, datasets: [{ label: 'Avg', data: dow, backgroundColor: dow.map((v, i) => (i === 0 || i === 6 ? U.hexA('#FF6FB5', 0.85) : U.hexA(acc(), 0.85))) }] }, options: UI.baseOpts() }, 170));

    // Essentials vs discretionary + radar vs previous
    const ess = U.sum(cats.filter((c) => c.c.essential), (c) => c.v); const disc = T.spend - ess;
    const radarCats = cats.filter((c) => !c.c.essential).slice(0, 7);
    h += `<div class="grid2" style="margin-top:12px">
      <div class="g pad-s"><div class="h3">Needs vs wants</div>${UI.chart('rNeeds', { type: 'doughnut', data: { labels: ['Essentials', 'Discretionary'], datasets: [{ data: [ess, disc], backgroundColor: ['#43D9B8', '#FF6FB5'], spacing: 2, borderRadius: 6 }] }, options: { cutout: '70%', plugins: { tooltip: { callbacks: { label: UI.ttMoney } } } } }, 130)}<div class="tiny center muted" style="margin-top:6px"><span class="pos">■</span> ${Math.round((ess / (T.spend || 1)) * 100)}% needs · <span style="color:#FF6FB5">■</span> ${Math.round((disc / (T.spend || 1)) * 100)}% wants</div></div>
      <div class="g pad-s"><div class="h3">Purchase sizes</div>${(() => { const hg = E.histogram(cur); return UI.chart('rHist', { type: 'bar', data: { labels: hg.labels, datasets: [{ label: 'Count', data: hg.cnt, backgroundColor: U.hexA('#5AC8FA', 0.85), borderRadius: 4 }] }, options: { plugins: { tooltip: { callbacks: { label: (c) => ` ${c.raw} purchases` } } }, scales: { x: { display: false }, y: { display: false } } } }, 130); })()}<div class="tiny center muted" style="margin-top:6px">count by amount, small → large</div></div>
    </div>`;
    if (radarCats.length >= 3) {
      h += card('Lifestyle profile', `flexible categories · ${pr.label} vs ${pv.label}`, UI.chart('rRadar', { type: 'radar', data: { labels: radarCats.map((c) => c.c.name.split(' ')[0]), datasets: [
        { label: pr.label, data: radarCats.map((c) => c.v), borderColor: acc(), backgroundColor: U.hexA(acc(), 0.25), pointRadius: 2 },
        { label: pv.label, data: radarCats.map((c) => (pcats.find((x) => x.cat === c.cat) || { v: 0 }).v), borderColor: '#FF6FB5', backgroundColor: U.hexA('#FF6FB5', 0.12), pointRadius: 2 },
      ] }, options: { plugins: { tooltip: { callbacks: { label: UI.ttMoney } } }, scales: { r: { grid: { color: UI.css('--line') }, angleLines: { color: UI.css('--line') }, ticks: { display: false }, pointLabels: { color: UI.css('--text2'), font: { size: 11 } } } } } }, 250), legend([[acc(), pr.label], ['#FF6FB5', pv.label]]));
    }

    // By account
    const byA = U.groupBy(cur.filter((t) => t.kind === 'expense'), (t) => t.acct);
    if (byA.size > 1) {
      const rows = [...byA.entries()].map(([id, txs]) => ({ a: S.accounts[id], v: -U.sum(txs, (t) => t.amt) })).sort((x, y) => y.v - x.v);
      h += card('By account', '', UI.chart('rAcct', { type: 'bar', data: { labels: rows.map((r) => (r.a.alias || r.a.name).replace(/\s*••\d+$/, '')), datasets: [{ label: 'Spent', data: rows.map((r) => r.v), backgroundColor: rows.map((_, i) => U.PALETTE[i % U.PALETTE.length]) }] }, options: Object.assign(UI.baseOpts({ horizontal: true }), { indexAxis: 'y' }) }, 40 + rows.length * 34));
    }

    // Largest
    const big = cur.filter((t) => t.kind === 'expense').sort((a, b) => a.amt - b.amt).slice(0, 5);
    if (big.length) h += UI.sec('Largest purchases') + `<div class="list g">${big.map((t) => UI.txRow(t, { showDate: true })).join('')}</div>`;
    return h;
  }

  /* ---------------- Income (by the month it counts toward) ---------------- */
  function income() {
    const S = Store.S; const V = Store.V; const R = App.rep; const ws = S.settings.weekStart;
    const all = App.list();
    const pr = E.periodRange(R.pid, R.off, null, ws); const pv = E.periodRange(R.pid, R.off - 1, null, ws);
    const inc = E.inRange(all, pr.a, pr.b).filter((t) => t.kind === 'income');
    const pinc = E.inRange(all, pv.a, pv.b).filter((t) => t.kind === 'income');
    const tot = U.sum(inc, (t) => t.amt); const ptot = U.sum(pinc, (t) => t.amt);
    const bonus = U.sum(inc.filter((t) => t.cat === 'bonus'), (t) => t.amt);
    const regular = U.sum(inc.filter((t) => t.cat === 'income'), (t) => t.amt);
    const other = tot - bonus - regular;
    const spent = E.totals(E.inRange(all, pr.a, pr.b)).spend;
    const early = inc.filter((t) => t.shifted && t.ts < +pr.a);
    const leftEarly = E.inRangeTs(all, pr.a, pr.b).filter((t) => t.kind === 'income' && t.shifted && t.rts >= +pr.b);
    const future = +pr.b > Date.now() ? E.projectRecurring(V, new Date(Math.max(+pr.a, Date.now())), pr.b).filter((x) => x.r.amount > 0) : [];
    const expected = U.sum(future, (x) => x.r.amount);
    let h = `<div class="g tint pad"><div class="eyebrow" style="color:var(--text)">Income · ${pr.label}</div><div class="big amt pos" style="margin-top:6px">${U.money(tot)}</div>
      <div class="small muted" style="margin-top:6px">${UI.delta(tot, ptot)} vs ${pv.label} (<span class="amt">${U.money(ptot, { whole: true })}</span>)${expected ? ` · <span class="amt">${U.money(expected, { whole: true })}</span> still expected` : ''}</div>
      <div class="grid3" style="margin-top:14px"><div><div class="tiny faint">Paychecks</div><div class="b amt">${U.money(regular, { auto: true })}</div></div><div><div class="tiny faint">Bonus</div><div class="b amt">${U.money(bonus, { auto: true })}</div></div><div><div class="tiny faint">Other</div><div class="b amt">${U.money(other, { auto: true })}</div></div></div>
      <div style="margin-top:12px">${UI.progress(tot ? Math.min(1, spent / tot) : 1, spent > tot ? 'var(--neg)' : 'var(--accent)')}</div><div class="tiny faint" style="margin-top:6px">Spent <span class="amt">${U.money(spent, { whole: true })}</span> of it · ${tot ? (spent <= tot ? 'kept ' + Math.round((1 - spent / tot) * 100) + '%' : 'overspent by ' + U.money(spent - tot, { whole: true })) : ''}</div></div>`;
    if (early.length || leftEarly.length) h += `<div class="g pad-s small" style="margin-top:12px">${I('calendar-clock', 'sm')} ${early.length ? `<b>${early.length}</b> deposit${early.length > 1 ? 's' : ''} received early (${early.map((t) => U.fmtDate(t.ts)).join(', ')}) ${early.length > 1 ? 'are' : 'is'} counted here.` : ''} ${leftEarly.length ? `<b>${leftEarly.length}</b> received in this period ${leftEarly.length > 1 ? 'count' : 'counts'} toward the next one.` : ''}</div>`;
    // 12 months by payer
    const m1 = U.addMonths(U.som(pr.b > Date.now() ? new Date() : new Date(+pr.b - 1)), 1); const m0 = U.addMonths(m1, -12);
    const incAll = all.filter((t) => t.kind === 'income');
    const payers = E.byMerchant(E.inRange(incAll, m0, m1), 'income').slice(0, 4);
    const cols = ['#43D9B8', '#7C8CFF', '#FFD166', '#FF6FB5'];
    const ds = payers.map((p, i) => ({ label: p.name, data: E.series(incAll.filter((t) => t.m === p.m && t.cat !== 'bonus'), m0, m1, 'month', ws, (t) => t.amt).vals, backgroundColor: cols[i], stack: 's', borderRadius: 3 }));
    const bon = E.series(incAll.filter((t) => t.cat === 'bonus'), m0, m1, 'month', ws, (t) => t.amt);
    if (bon.vals.some((v) => v)) ds.push({ label: 'Bonus', data: bon.vals, backgroundColor: '#FFB547', stack: 's', borderRadius: 3 });
    const rest = E.series(incAll.filter((t) => !payers.some((p) => p.m === t.m) && t.cat !== 'bonus'), m0, m1, 'month', ws, (t) => t.amt);
    if (rest.vals.some((v) => v)) ds.push({ label: 'Other', data: rest.vals, backgroundColor: U.hexA('#8A93B8', 0.7), stack: 's', borderRadius: 3 });
    const lbls = E.series([], m0, m1, 'month', ws, () => 0).labels;
    h += card('Income by month', 'counted in the month it belongs to', UI.chart('iMonths', { type: 'bar', data: { labels: lbls, datasets: ds }, options: UI.baseOpts({ stacked: true }) }, 220), legend(ds.map((d) => [d.backgroundColor, d.label])));
    // sources this period
    const src = E.byMerchant(inc, 'income');
    if (src.length) h += UI.sec('Where it came from') + `<div class="list g">${src.map((m) => `<div class="item tap" data-a="merchOpen" data-x="${U.esc(m.m)}">${UI.bubble('hand-coins', '#43D9B8')}<div class="grow"><div class="t ell">${U.esc(m.name)}</div><div class="s">${m.n} deposit${m.n > 1 ? 's' : ''} · ${Math.round((m.v / (tot || 1)) * 100)}%</div></div><div class="r b pos amt">${U.money(m.v)}</div></div>`).join('')}</div>`;
    // each deposit
    if (inc.length) {
      h += UI.sec('Every deposit') + `<div class="list g">${[...inc].sort((a, b) => b.ts - a.ts).map((t) => `<div class="item tap" data-a="tx" data-x="${U.esc(t.parent || t.k)}">${UI.catBubble(V.catMap[t.cat])}<div class="grow"><div class="t ell">${U.esc(t.name)} ${t.shifted ? `<span class="badge acc">${I('calendar-clock')} counts in ${U.MON[new Date(t.rts).getMonth()]}</span>` : ''}</div><div class="s">Received ${U.fmtDate(t.ts, { dow: true })} · ${U.esc(V.catMap[t.cat].name)}</div></div><div class="r b pos amt">${U.money(t.amt)}</div></div>`).join('')}</div>`;
    } else h += `<div class="sp"></div><div class="g">${UI.empty('hand-coins', 'No income in this period')}</div>`;
    if (future.length) h += UI.sec('Still expected') + `<div class="list g">${future.map((x) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(x.r.key)}">${UI.bubble('clock', '#43D9B8')}<div class="grow"><div class="t">${U.esc(x.r.name)}</div><div class="s">${U.fmtDate(x.date, { rel: true, dow: true })}</div></div><div class="r b pos amt">${U.money(x.r.amount)}</div></div>`).join('')}</div>`;
    // money in that isn't counted as income
    const notInc = E.inRangeTs(all, pr.a, pr.b).filter((t) => t.amt > 0 && t.kind !== 'income');
    if (notInc.length) h += UI.sec('Money in, not counted as income', `<span class="small muted amt">${U.money(U.sum(notInc, (t) => t.amt), { whole: true })}</span>`) + `<p class="small faint" style="margin:-4px 6px 8px">Transfers between your accounts, card payments and refunds. Tap one to change its category if it's really income.</p><div class="list g">${notInc.slice(0, 15).map((t) => UI.txRow(t, { showDate: true })).join('')}</div>`;
    return h;
  }

  /* ---------------- Trends (N periods ending at selected) ---------------- */
  function trends() {
    const S = Store.S; const V = Store.V; const R = App.rep; const ws = S.settings.weekStart;
    const all = App.list();
    const pr = E.periodRange(R.pid, R.off, null, ws);
    const p = pr.p;
    let unit, a;
    if (p.id === 'D') { unit = 'day'; a = U.addDays(pr.a, -29); }
    else if (p.id === 'W') { unit = 'week'; a = U.addDays(pr.a, -7 * 15); }
    else if (p.id === 'M') { unit = 'month'; a = U.addMonths(pr.a, -11); }
    else if (p.id === 'Q') { unit = 'quarter'; a = U.addMonths(pr.a, -21); }
    else if (p.id === 'Y') { unit = 'year'; a = U.addMonths(pr.a, -48); }
    else { unit = 'month'; a = pr.a; }
    const b = pr.b;
    const firstTs = all.length ? all[all.length - 1].ts : +a;
    if (+a < firstTs) a = new Date(Math.max(+a, +E.bucketStart(new Date(firstTs), unit, ws)));
    const sp = E.series(all, a, b, unit, ws, E.spendOf); const inc = E.series(all, a, b, unit, ws, E.incomeOf);
    const net = sp.vals.map((v, i) => inc.vals[i] - v);
    const rate = sp.vals.map((v, i) => (inc.vals[i] > 0 ? Math.round(((inc.vals[i] - v) / inc.vals[i]) * 100) : null));
    let h = '';
    const avgS = U.mean(sp.vals.filter((v, i) => i < sp.vals.length - (R.off === 0 ? 1 : 0)));
    h += card('Income vs spending', `by ${unit} · avg spend ${U.money(avgS, { whole: true })}`, UI.chart('tIE', { type: 'bar', data: { labels: sp.labels, datasets: [
      { label: 'Income', data: inc.vals, backgroundColor: UI.grad('#3DDC97', 0.95, 0.4) },
      { label: 'Spending', data: sp.vals, backgroundColor: UI.grad('#FF6B81', 0.95, 0.4) },
    ] }, options: UI.baseOpts() }, 220), legend([['#3DDC97', 'Income'], ['#FF6B81', 'Spending']]));
    h += card('Net cash flow', 'income minus spending', UI.chart('tNet', { type: 'bar', data: { labels: sp.labels, datasets: [{ label: 'Net', data: net, backgroundColor: net.map((v) => (v >= 0 ? U.hexA('#3DDC97', 0.85) : U.hexA('#FF6B81', 0.85))) }] }, options: UI.baseOpts({ zero: true }) }, 180));
    h += card('Savings rate', '% of income kept', UI.chart('tRate', { type: 'line', data: { labels: sp.labels, datasets: [{ label: 'Rate', data: rate, borderColor: '#43D9B8', backgroundColor: UI.grad('#43D9B8', 0.3, 0), fill: true, pointRadius: 3, spanGaps: true }] }, options: Object.assign(UI.baseOpts({ pct: true, zero: false }), { plugins: { tooltip: { callbacks: { label: (c) => ` ${c.raw}%` } } } }) }, 170));

    // Balance / net worth
    const bu = unit === 'day' ? 'day' : unit === 'week' ? 'week' : unit === 'year' ? 'month' : unit === 'quarter' ? 'week' : 'week';
    const bh = E.balanceHistory(V, App.scope, a, b, bu);
    h += card('Net worth trend', 'reconstructed from your transactions', UI.chart('tBal', { type: 'line', data: { labels: bh.labels, datasets: [{ label: 'Balance', data: bh.vals, borderColor: acc(), backgroundColor: UI.grad(acc(), 0.35, 0), fill: true }] }, options: UI.baseOpts({ zero: false }) }, 190));

    // Category trends top 5
    const top = E.byCategory(V, E.inRange(all, a, b)).slice(0, 5);
    const cds = top.map((c) => ({ label: c.c.name, data: E.series(all.filter((t) => t.cat === c.cat), a, b, unit, ws, E.spendOf).vals, borderColor: c.c.color, backgroundColor: c.c.color, pointRadius: 2 }));
    h += card('Top categories over time', '', UI.chart('tCats', { type: 'line', data: { labels: sp.labels, datasets: cds }, options: UI.baseOpts() }, 220), legend(cds.map((d) => [d.borderColor, d.label])));

    // Forecast (monthly)
    const m0 = U.addMonths(U.som(new Date()), -12); const m1 = U.som(new Date());
    const ms = E.series(all, m0, m1, 'month', ws, E.spendOf);
    const pred = E.trendPredict(ms.vals, 3);
    const labels = ms.labels.concat([1, 2, 3].map((i) => E.bucketLabel(U.addMonths(m1, i - 1), 'month') + '*'));
    const hist = ms.vals.concat([null, null, null]);
    h += card('Spending forecast', 'trend of the last 12 full months → next 3', UI.chart('tFc', { type: 'line', data: { labels, datasets: [
      { label: 'Actual', data: hist, borderColor: acc(), backgroundColor: UI.grad(acc(), 0.3, 0), fill: true, pointRadius: 2 },
      { label: 'Predicted', data: pred, borderColor: '#FFB547', borderDash: [6, 5], pointRadius: 3 },
    ] }, options: UI.baseOpts() }, 200), legend([[acc(), 'Actual'], ['#FFB547', 'Predicted (linear trend)']]));

    // Average ticket & count
    const cnt = E.series(all.filter((t) => t.kind === 'expense'), a, b, unit, ws, () => 1);
    const avgT = sp.vals.map((v, i) => (cnt.vals[i] ? v / cnt.vals[i] : 0));
    h += card('Purchases & average size', '', UI.chart('tCnt', { type: 'bar', data: { labels: sp.labels, datasets: [
      { type: 'line', label: 'Avg size', data: avgT, borderColor: '#FFB547', yAxisID: 'y1', pointRadius: 2 },
      { label: 'Purchases', data: cnt.vals, backgroundColor: U.hexA('#5AC8FA', 0.7), yAxisID: 'y' },
    ] }, options: { plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.dataset.yAxisID === 'y1' ? U.money(c.raw) : c.raw}` } } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { grid: { color: UI.css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 4 } }, y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { callback: UI.tickMoney, maxTicksLimit: 4 } } } } }, 200), legend([['#5AC8FA', 'Purchases'], ['#FFB547', 'Average size']]));

    // Year over year monthly comparison
    if (p.id === 'M' || p.id === 'Y' || p.id === '2Y' || p.id === 'Q') {
      const y0 = U.soy(new Date());
      const ys = [0, -1, -2].map((o) => { const s = U.addMonths(y0, o * 12); return { y: s.getFullYear(), vals: E.series(all, s, U.addMonths(s, 12), 'month', ws, E.spendOf).vals }; }).filter((y) => y.vals.some((v) => v > 0));
      const cols = [acc(), '#FF6FB5', '#43D9B8'];
      h += card('Year over year', 'monthly spending', UI.chart('tYoY', { type: 'line', data: { labels: U.MON, datasets: ys.map((y, i) => ({ label: String(y.y), data: y.vals.map((v, mi) => ((y.y === new Date().getFullYear() && mi > new Date().getMonth()) || +new Date(y.y, mi + 1, 1) <= firstTs ? null : v)), borderColor: cols[i], pointRadius: 2 })) }, options: UI.baseOpts() }, 200), legend(ys.map((y, i) => [cols[i], String(y.y)])));
    }
    return h;
  }

  /* ---------------- Compare ---------------- */
  const PRESETS = [['thisM', 'This month'], ['lastM', 'Last month'], ['sameMLY', 'This month last year'], ['thisQ', 'This quarter'], ['lastQ', 'Last quarter'], ['thisY', 'This year'], ['lastY', 'Last year'], ['l30', 'Last 30 days'], ['p30', 'Previous 30 days'], ['l90', 'Last 90 days'], ['p90', 'Previous 90 days']];
  function presetRange(id) {
    const now = new Date(); const t = U.addDays(U.sod(now), 1); const m = U.som(now); const q = U.soq(now); const y = U.soy(now);
    switch (id) {
      case 'thisM': return [m, U.addMonths(m, 1)];
      case 'lastM': return [U.addMonths(m, -1), m];
      case 'sameMLY': return [U.addMonths(m, -12), U.addMonths(m, -11)];
      case 'thisQ': return [q, U.addMonths(q, 3)];
      case 'lastQ': return [U.addMonths(q, -3), q];
      case 'thisY': return [y, U.addMonths(y, 12)];
      case 'lastY': return [U.addMonths(y, -12), y];
      case 'l30': return [U.addDays(t, -30), t];
      case 'p30': return [U.addDays(t, -60), U.addDays(t, -30)];
      case 'l90': return [U.addDays(t, -90), t];
      case 'p90': return [U.addDays(t, -180), U.addDays(t, -90)];
    }
    return [m, U.addMonths(m, 1)];
  }
  const pLabel = (id) => (PRESETS.find((p) => p[0] === id) || [0, id])[1];
  function compare() {
    const S = Store.S; const V = Store.V; const R = App.rep;
    const all = App.list();
    const [a1, b1] = presetRange(R.cmpA); const [a2, b2] = presetRange(R.cmpB);
    const A = E.inRange(all, a1, b1); const B = E.inRange(all, a2, b2);
    const TA = E.totals(A); const TB = E.totals(B);
    const colA = acc(); const colB = '#FF6FB5';
    let h = `<div class="grid2">
      <button class="g pad-s tap" data-a="cmpPick" data-x="A" style="text-align:left"><div class="eyebrow" style="color:${colA}">Period A</div><div class="b ell" style="margin-top:4px">${pLabel(R.cmpA)}</div><div class="tiny faint">${U.fmtDate(a1)} – ${U.fmtDate(U.addDays(b1, -1))}</div></button>
      <button class="g pad-s tap" data-a="cmpPick" data-x="B" style="text-align:left"><div class="eyebrow" style="color:${colB}">Period B</div><div class="b ell" style="margin-top:4px">${pLabel(R.cmpB)}</div><div class="tiny faint">${U.fmtDate(a2)} – ${U.fmtDate(U.addDays(b2, -1))}</div></button>
    </div><div class="chips" style="margin-top:10px">${[['thisM|lastM', 'Month vs last'], ['thisM|sameMLY', 'vs last year'], ['thisQ|lastQ', 'Quarter'], ['thisY|lastY', 'Year'], ['l30|p30', '30 days'], ['l90|p90', '90 days']].map(([k, l]) => `<button class="chip ${R.cmpA + '|' + R.cmpB === k ? 'on' : ''}" data-a="cmpPreset" data-x="${k}">${l}</button>`).join('')}</div>`;
    const row = (label, va, vb, invert, fmt) => { fmt = fmt || ((v) => U.money(v, { auto: true })); return `<div class="item" style="padding:11px 14px"><div class="grow small muted">${label}</div><div class="b amt" style="width:26%;text-align:right;color:${colA}">${fmt(va)}</div><div class="b amt" style="width:26%;text-align:right;color:${colB}">${fmt(vb)}</div><div class="small" style="width:19%;text-align:right">${UI.delta(va, vb, invert)}</div></div>`; };
    h += `<div class="list g" style="margin-top:6px"><div class="item" style="padding:10px 14px"><div class="grow"></div><div class="tiny b" style="width:26%;text-align:right;color:${colA}">A</div><div class="tiny b" style="width:26%;text-align:right;color:${colB}">B</div><div class="tiny faint" style="width:19%;text-align:right">A vs B</div></div>
      ${row('Spent', TA.spend, TB.spend, true)}${row('Income', TA.income, TB.income)}${row('Net', TA.net, TB.net)}${row('Purchases', TA.n, TB.n, true, U.num)}${row('Per day', TA.spend / Math.max(1, Math.min(U.daysBetween(a1, b1), U.daysBetween(a1, new Date()) + 1)), TB.spend / Math.max(1, U.daysBetween(a2, b2)), true)}</div>`;
    // cumulative overlay
    const ca = E.cumulativeDaily(all, a1, b1, E.spendOf); const cb = E.cumulativeDaily(all, a2, b2, E.spendOf);
    const ti = U.daysBetween(a1, new Date());
    const n = Math.max(ca.length, cb.length);
    h += card('Cumulative spending', 'day by day', UI.chart('cCum', { type: 'line', data: { labels: Array.from({ length: n }, (_, i) => 'Day ' + (i + 1)), datasets: [
      { label: 'A', data: ca.map((v, i) => (i <= ti ? v : null)), borderColor: colA, backgroundColor: UI.grad(colA, 0.25, 0), fill: true },
      { label: 'B', data: cb, borderColor: colB, borderDash: [5, 4] },
    ] }, options: UI.baseOpts() }, 190));
    // per category grouped bars
    const ca2 = E.byCategory(V, A); const cb2 = E.byCategory(V, B);
    const ids = [...new Set([...ca2.slice(0, 8).map((c) => c.cat), ...cb2.slice(0, 8).map((c) => c.cat)])];
    const va = ids.map((id) => (ca2.find((c) => c.cat === id) || { v: 0 }).v); const vb = ids.map((id) => (cb2.find((c) => c.cat === id) || { v: 0 }).v);
    h += card('Side by side by category', '', UI.chart('cCats', { type: 'bar', data: { labels: ids.map((id) => V.catMap[id].name.split(' ')[0]), datasets: [{ label: 'A', data: va, backgroundColor: colA }, { label: 'B', data: vb, backgroundColor: U.hexA(colB, 0.85) }] }, options: Object.assign(UI.baseOpts({ horizontal: true }), { indexAxis: 'y' }) }, 50 + ids.length * 38), legend([[colA, 'A · ' + pLabel(R.cmpA)], [colB, 'B · ' + pLabel(R.cmpB)]]));
    // biggest changes
    const allIds = [...new Set([...ca2.map((c) => c.cat), ...cb2.map((c) => c.cat)])];
    const deltas = allIds.map((id) => ({ id, a: (ca2.find((c) => c.cat === id) || { v: 0 }).v, b: (cb2.find((c) => c.cat === id) || { v: 0 }).v })).map((x) => ({ ...x, d: x.a - x.b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8);
    h += UI.sec('Biggest changes') + `<div class="list g">${deltas.map((x) => { const c = V.catMap[x.id]; return `<div class="item tap" data-a="catDrill" data-x="${x.id}">${UI.catBubble(c)}<div class="grow"><div class="t">${U.esc(c.name)}</div><div class="s"><span class="amt">${U.money(x.b, { whole: true })}</span> → <span class="amt">${U.money(x.a, { whole: true })}</span></div></div><div class="r b amt ${x.d > 0 ? 'neg' : 'pos'}">${U.money(x.d, { whole: true, sign: true })}</div></div>`; }).join('')}</div>`;
    // merchants changes
    const ma = E.byMerchant(A); const mb = E.byMerchant(B);
    const mids = [...new Set([...ma.slice(0, 15).map((m) => m.m), ...mb.slice(0, 15).map((m) => m.m)])];
    const md = mids.map((m) => { const x = ma.find((y) => y.m === m); const z = mb.find((y) => y.m === m); return { m, name: (x || z).name, a: x ? x.v : 0, b: z ? z.v : 0 }; }).map((x) => ({ ...x, d: x.a - x.b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 8);
    h += UI.sec('Merchants that moved') + `<div class="list g">${md.map((x) => `<div class="item tap" data-a="merchOpen" data-x="${U.esc(x.m)}"><div class="grow"><div class="t">${U.esc(x.name)}</div><div class="s"><span class="amt">${U.money(x.b, { whole: true })}</span> → <span class="amt">${U.money(x.a, { whole: true })}</span>${!x.b ? ' · <span class="badge acc">new</span>' : !x.a ? ' · <span class="badge">gone</span>' : ''}</div></div><div class="r b amt ${x.d > 0 ? 'neg' : 'pos'}">${U.money(x.d, { whole: true, sign: true })}</div></div>`).join('')}</div>`;

    // Compare items over time
    h += UI.sec('Compare over time', `<button class="link" data-a="cmpItems">${I('plus', 'sm')} Choose</button>`);
    const items = R.items.length ? R.items : E.byCategory(V, E.inRange(all, U.addMonths(U.som(new Date()), -3), new Date())).slice(0, 3).map((c) => 'cat:' + c.cat);
    const m0 = U.addMonths(U.som(new Date()), -11); const m1 = U.addMonths(U.som(new Date()), 1);
    const dss = items.map((it, i) => {
      const [kind, id] = [it.slice(0, it.indexOf(':')), it.slice(it.indexOf(':') + 1)];
      const f = kind === 'cat' ? (t) => t.cat === id : (t) => t.m === id;
      const name = kind === 'cat' ? V.catMap[id] ? V.catMap[id].name : id : ((all.find((t) => t.m === id) || {}).name || id);
      const col = kind === 'cat' && V.catMap[id] ? V.catMap[id].color : U.PALETTE[(i + 3) % U.PALETTE.length];
      const s = E.series(all.filter(f), m0, m1, 'month', 0, (t) => Math.abs(t.amt));
      return { label: name, data: s.vals, borderColor: col, backgroundColor: col, pointRadius: 3, labels: s.labels, tot: U.sum(s.vals), n: all.filter(f).filter((t) => t.ts >= +m0).length };
    });
    if (dss.length) {
      h += card('Last 12 months', items === R.items ? 'your picks' : 'top categories', UI.chart('cItems', { type: 'line', data: { labels: dss[0].labels, datasets: dss }, options: UI.baseOpts() }, 210), legend(dss.map((d) => [d.borderColor, d.label])));
      h += `<div class="list g" style="margin-top:10px">${dss.map((d) => `<div class="item"><i style="width:10px;height:10px;border-radius:3px;background:${d.borderColor};flex:none"></i><div class="grow"><div class="t ell">${U.esc(d.label)}</div><div class="s">${d.n} transactions · avg <span class="amt">${U.money(d.tot / 12, { whole: true })}</span>/mo</div></div><div class="r b amt">${U.money(d.tot, { whole: true })}</div></div>`).join('')}</div>`;
    }
    return h;
  }
  UI.on('cmpPreset', (k) => { const [a, b] = k.split('|'); App.rep.cmpA = a; App.rep.cmpB = b; App.render(); });
  UI.on('cmpPick', (which) => {
    UI.on('cmpSet', (id) => { if (which === 'A') App.rep.cmpA = id; else App.rep.cmpB = id; UI.closeSheet(); App.render(); });
    UI.sheet({ title: 'Period ' + which, body: `<div class="list g flat">${PRESETS.map(([id, l]) => { const [a, b] = presetRange(id); return `<div class="item tap" data-a="cmpSet" data-x="${id}"><div class="grow"><div class="t">${l}</div><div class="s">${U.fmtDate(a)} – ${U.fmtDate(U.addDays(b, -1))}</div></div></div>`; }).join('')}</div>` });
  });
  UI.on('cmpItems', () => {
    const V = Store.V; let tab = 'cat'; let q = '';
    const sel = new Set(App.rep.items);
    const body = () => {
      let h = UI.seg([['cat', 'Categories'], ['m', 'Merchants']], tab, 'ciTab') + `<div class="sp"></div>`;
      if (tab === 'cat') h += `<div class="list g flat">${Store.S.cats.filter((c) => c.kind === 'expense').map((c) => { const on = sel.has('cat:' + c.id); return `<div class="item tap" data-a="ciTog" data-x="cat:${c.id}">${UI.catBubble(c)}<div class="grow t">${U.esc(c.name)}</div><div class="check ${on ? 'on' : ''}">${on ? I('check') : ''}</div></div>`; }).join('')}</div>`;
      else {
        const ms = E.byMerchant(App.list()).filter((m) => !q || m.name.toLowerCase().includes(q)).slice(0, 60);
        h += `<div class="g search" style="margin-bottom:10px">${I('search')}<input data-in="ciQ" placeholder="Find merchant" value="${U.esc(q)}"></div><div class="list g flat">${ms.map((m) => { const on = sel.has('m:' + m.m); return `<div class="item tap" data-a="ciTog" data-x="m:${U.esc(m.m)}"><div class="grow"><div class="t">${U.esc(m.name)}</div><div class="s">${m.n} purchases</div></div><div class="check ${on ? 'on' : ''}">${on ? I('check') : ''}</div></div>`; }).join('')}</div>`;
      }
      return h;
    };
    UI.on('ciTab', (x) => { tab = x; UI.renderSheet(); });
    UI.on('ciQ', U.debounce((v) => { q = v.toLowerCase(); UI.renderSheet(); const i = document.querySelector('[data-in="ciQ"]'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 200));
    UI.on('ciTog', (x) => { if (sel.has(x)) sel.delete(x); else if (sel.size < 5) sel.add(x); else UI.toast('Up to 5 items', 'info'); UI.renderSheet(); });
    UI.on('ciDone', () => { App.rep.items = [...sel]; UI.closeSheet(); App.render(); });
    UI.sheet({ title: 'Compare up to 5', body, full: true, foot: `<button class="btn grow" data-a="ciClear">Reset</button><button class="btn primary grow" data-a="ciDone">Compare</button>` });
    UI.on('ciClear', () => { sel.clear(); UI.renderSheet(); });
  });

  /* ---------------- Leaks ---------------- */
  function leaks() {
    const S = Store.S; const V = Store.V; const all = App.list();
    const ins = App.insights();
    const save = U.sum(ins, (x) => x.save || 0); const earn = U.sum(ins, (x) => x.earn || 0);
    let h = `<div class="g tint pad"><div class="eyebrow" style="color:var(--text)">Potential yearly impact</div><div class="big amt" style="margin-top:6px">${U.money(save + earn, { whole: true })}</div><div class="small muted" style="margin-top:6px"><span class="amt">${U.money(save, { whole: true })}</span> in avoidable spending${earn ? ` · <span class="amt">${U.money(earn, { whole: true })}</span> in missed interest` : ''}</div></div>`;
    if (!ins.length) return h + `<div class="sp"></div><div class="g">${UI.empty('shield-check', 'Looking lean!', 'No hidden expenses stand out right now.')}</div>`;
    h += ins.map((x) => `<div style="margin-top:12px">${App.insightCard(x)}</div>`).join('');
    // Subscription audit list
    const subs = V.recurring.filter((r) => r.active && r.amount < 0).sort((a, b) => a.monthly - b.monthly);
    if (subs.length) {
      h += UI.sec('Recurring charge audit', `<span class="small muted amt">${U.money(-U.sum(subs, (r) => r.monthly), { whole: true })}/mo</span>`);
      h += `<div class="list g">${subs.map((r) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(r.key)}">${UI.catBubble(V.catMap[r.cat])}<div class="grow"><div class="t ell">${U.esc(r.name)}</div><div class="s">${r.freq} · <span class="amt">${U.money(-r.yearly, { whole: true })}</span>/yr${r.priceChange && r.priceChange.pct > 0 ? ` · <span class="badge neg">${I('trending-up')} ${U.pct(r.priceChange.pct)}</span>` : ''}</div></div><div class="r b amt">${U.money(r.amount)}</div></div>`).join('')}</div>`;
    }
    return h;
  }

  /* ---------------- drill-downs ---------------- */
  UI.on('catDrill', (id) => App.openCategory(id));
  // Category drill-down: the transactions of the period you were looking at come first; history below.
  App.openCategory = function (cid, range) {
    range = range || App.viewRange();
    let span = 'period';
    const body = () => {
      const V = Store.V; const c = V.catMap[cid]; const all = App.list().filter((t) => t.cat === cid);
      const sign = c.kind === 'income' ? 1 : -1;
      const now = new Date();
      const r = span === 'period' ? range : span === '3m' ? { a: U.addMonths(U.som(now), -2), b: U.addMonths(U.som(now), 1), label: 'Last 3 months' } : { a: U.addMonths(U.som(now), -11), b: U.addMonths(U.som(now), 1), label: 'Last 12 months' };
      const inR = E.inRange(all, r.a, r.b).sort((x, y) => y.ts - x.ts);
      const tot = U.sum(inR, (t) => sign * t.amt);
      const ms = E.byMerchant(inR, c.kind === 'income' ? 'income' : 'expense');
      const m0 = U.addMonths(U.som(now), -11); const m1 = U.addMonths(U.som(now), 1);
      const s12 = E.series(all, m0, m1, 'month', 0, (t) => sign * t.amt);
      const avg = U.mean(s12.vals.slice(0, -1));
      return `<div class="row">${UI.catBubble(c)}<div class="grow"><div class="h3">${U.esc(c.name)}</div><div class="small muted">${U.esc(r.label)} · <b class="amt">${U.money(tot)}</b> · ${inR.length} transaction${inR.length === 1 ? '' : 's'}</div></div><button class="btn sm" data-a="catEdit" data-x="${cid}">${I('pencil', 'sm')}</button></div>
        <div class="chips" style="margin-top:10px">${[['period', range.label], ['3m', '3 months'], ['12m', '12 months']].map(([id, l]) => `<button class="chip ${span === id ? 'on' : ''}" data-a="cdSpan" data-x="${id}">${U.esc(l)}</button>`).join('')}</div>
        ${ms.length > 1 ? `<div class="g pad-s" style="margin-top:10px">${ms.slice(0, 6).map((m) => `<div class="row tap" data-a="merchOpen" data-x="${U.esc(m.m)}" style="margin:6px 0"><span class="small grow ell">${U.esc(m.name)} <span class="faint">· ${m.n}</span></span><span class="small b amt">${U.money(m.v, { auto: true })}</span></div>${UI.progress(m.v / ms[0].v, c.color)}`).join('')}</div>` : ''}
        ${UI.sec('Transactions')}${inR.length ? `<div class="list g flat">${inR.slice(0, 200).map((t) => UI.txRow(t, { showDate: true })).join('')}</div>${inR.length > 200 ? `<div class="small faint center" style="margin-top:8px">Showing 200 of ${inR.length}</div>` : ''}` : `<div class="g pad-s small muted">Nothing in ${U.esc(r.label)}.</div>`}
        ${UI.sec('Last 12 months', `<span class="small muted">avg <span class="amt">${U.money(avg, { whole: true })}</span>/mo</span>`)}
        <div class="g pad-s">${UI.chart('dCat', { type: 'bar', data: { labels: s12.labels, datasets: [{ label: c.name, data: s12.vals, backgroundColor: UI.grad(c.color, 0.95, 0.35) }, { type: 'line', label: 'Average', data: s12.vals.map(() => avg), borderColor: UI.css('--text3'), borderDash: [4, 4], borderWidth: 1.5 }] }, options: UI.baseOpts() }, 170)}</div>`;
    };
    UI.on('cdSpan', (x) => { span = x; UI.renderSheet(); });
    UI.sheet({ title: 'Category', body, full: true });
  };
  // Period the user is looking at (Reports period, Compare period A, else this month)
  App.viewRange = function () {
    if (App.tab === 'reports' && !App.pages.length) {
      if (App.rep.seg === 'compare') { const [a, b] = presetRange(App.rep.cmpA); return { a, b, label: pLabel(App.rep.cmpA) }; }
      const pr = E.periodRange(App.rep.pid, App.rep.off, null, Store.S.settings.weekStart); return { a: pr.a, b: pr.b, label: pr.label };
    }
    const a = U.som(new Date()); return { a, b: U.addMonths(a, 1), label: U.fmtMonth(a) };
  };
  App.openMerchant = function (m, range) {
    range = range || App.viewRange();
    let span = 'period';
    const body = () => {
      const V = Store.V; const all = V.list.filter((t) => t.m === m && !t.hiddenAcct);
      if (!all.length) return UI.empty('info', 'No transactions');
      const t0 = all[0]; const c = V.catMap[t0.cat];
      const now = new Date();
      const r = span === 'period' ? range : span === '12m' ? { a: U.addMonths(U.som(now), -11), b: U.addMonths(U.som(now), 1), label: 'Last 12 months' } : { a: new Date(0), b: U.addDays(now, 2), label: 'All time' };
      const inR = E.inRangeTs(all, r.a, r.b);
      const tot = U.sum(inR, (t) => Math.abs(t.amt));
      const m0 = U.addMonths(U.som(now), -23); const m1 = U.addMonths(U.som(now), 1);
      const s2 = E.series(all, m0, m1, 'month', 0, (t) => Math.abs(t.amt));
      const recs = V.recurring.filter((x) => x.m === m);
      const rule = Store.S.rules.find((x) => x.match === 'merchant' && x.pattern === m);
      return `<div class="row">${UI.catBubble(c)}<div class="grow"><div class="h3">${U.esc(t0.name)}</div><div class="small muted">${U.esc(c.name)}${rule ? ' · <span class="badge acc">rule</span>' : ''}${recs.length ? ` · <span class="badge">${I('repeat')} ${recs.length > 1 ? recs.length + ' recurring' : recs[0].freq}</span>` : ''}</div></div></div>
        <div class="chips" style="margin-top:10px">${[['period', range.label], ['12m', '12 months'], ['all', 'All time']].map(([id, l]) => `<button class="chip ${span === id ? 'on' : ''}" data-a="mdSpan" data-x="${id}">${U.esc(l)}</button>`).join('')}</div>
        <div class="grid3" style="margin-top:8px"><div class="g kpi"><div class="tiny faint">${U.esc(r.label)}</div><div class="v amt" style="font-size:17px">${U.money(tot, { whole: tot >= 1000 })}</div></div><div class="g kpi"><div class="tiny faint">Transactions</div><div class="v" style="font-size:17px">${inR.length}</div></div><div class="g kpi"><div class="tiny faint">Average</div><div class="v amt" style="font-size:17px">${U.money(inR.length ? tot / inR.length : 0)}</div></div></div>
        ${recs.length ? `<div class="list g flat" style="margin-top:10px">${recs.map((x) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(x.key)}">${UI.bubble('repeat', '#B78CFF')}<div class="grow"><div class="t" style="font-size:14px">${U.esc(x.name)}</div><div class="s">${x.freq} · next ${U.fmtDate(x.next, { rel: true })}</div></div><div class="r b">${U.amt(x.amount, { color: true })}</div></div>`).join('')}</div>` : ''}
        ${UI.sec('Transactions')}${inR.length ? `<div class="list g flat">${inR.slice(0, 200).map((t) => UI.txRow(t, { showDate: true, sub: U.fmtDate(t.ts, { year: true }) + ' · ' + V.catMap[t.cat].name })).join('')}</div>` : `<div class="g pad-s small muted">Nothing in ${U.esc(r.label)}.</div>`}
        <div class="sp"></div><div class="grid2"><button class="btn sm" data-a="merchCat" data-x="${U.esc(m)}">${I('tag', 'sm')} Set category</button><button class="btn sm" data-a="merchCmp" data-x="${U.esc(m)}">${I('git-compare-arrows', 'sm')} Compare</button></div>
        ${UI.sec('Last 24 months')}<div class="g pad-s">${UI.chart('dMerch', { type: 'bar', data: { labels: s2.labels, datasets: [{ label: t0.name, data: s2.vals, backgroundColor: UI.grad(c.color, 0.95, 0.35) }] }, options: UI.baseOpts() }, 160)}</div>`;
    };
    UI.on('mdSpan', (x) => { span = x; UI.renderSheet(); });
    UI.sheet({ title: 'Merchant', body, full: true });
  };
  UI.on('merchCat', (m) => {
    App.pickCategory(null, (id) => {
      Store.upsertRule({ match: 'merchant', pattern: m, cat: id });
      for (const t of Store.V.list) if (t.m === m) Store.setEdit(t.k, { cat: null });
      Store.commit({ silent: true }); UI.renderSheet(); UI.toast('Rule saved — past & future transactions updated', 'sparkles');
    });
  });
  UI.on('merchCmp', (m) => { App.rep.items = ['m:' + m]; App.rep.seg = 'compare'; UI.closeAll(); App.go('reports'); UI.toast('Add more items to compare', 'git-compare-arrows'); });
  UI.on('dayOpen', (ms) => {
    const d = new Date(Number(ms)); const a = U.sod(d); const b = U.addDays(a, 1);
    const list = E.inRangeTs(App.list(), a, b);
    UI.sheet({ title: U.fmtDate(d, { dow: true }), body: list.length ? `<div class="list g flat">${list.map((t) => UI.txRow(t)).join('')}</div>` : UI.empty('calendar', 'No transactions') });
  });

  // Compare selected transactions
  App.compareTxns = function (keys) {
    const V = Store.V;
    const txs = keys.map((k) => V.byKey[k]).filter(Boolean).sort((a, b) => a.ts - b.ts);
    const body = () => {
      const tot = U.sum(txs, (t) => Math.abs(t.amt)); const mx = Math.max(...txs.map((t) => Math.abs(t.amt)));
      const cols = txs.map((t, i) => U.PALETTE[i % U.PALETTE.length]);
      let h = `<div class="grid3"><div class="g kpi"><div class="tiny faint">Total</div><div class="v amt" style="font-size:17px">${U.money(tot)}</div></div><div class="g kpi"><div class="tiny faint">Average</div><div class="v amt" style="font-size:17px">${U.money(tot / txs.length)}</div></div><div class="g kpi"><div class="tiny faint">Spread</div><div class="v amt" style="font-size:17px">${U.money(mx - Math.min(...txs.map((t) => Math.abs(t.amt))))}</div></div></div>`;
      h += `<div class="g pad-s" style="margin-top:12px">${UI.chart('ctx', { type: 'bar', data: { labels: txs.map((t) => t.name.slice(0, 12)), datasets: [{ label: 'Amount', data: txs.map((t) => Math.abs(t.amt)), backgroundColor: cols }] }, options: UI.baseOpts() }, 190)}</div>`;
      h += `<div class="list g flat" style="margin-top:12px">${txs.map((t, i) => { const ctx = E.txnContext(V, t); return `<div class="item tap" data-a="tx" data-x="${U.esc(t.k)}"><i style="width:10px;height:10px;border-radius:3px;background:${cols[i]};flex:none"></i><div class="grow"><div class="t ell">${U.esc(t.name)}</div><div class="s">${U.fmtDate(t.ts, { year: true })} · ${U.pctAbs(Math.abs(t.amt) / tot)} of total · merchant avg <span class="amt">${U.money(ctx.avg)}</span></div></div><div class="r b amt">${U.money(t.amt)}</div></div>`; }).join('')}</div>`;
      const first = txs[0]; const last = txs[txs.length - 1];
      if (txs.length >= 2 && txs.every((t) => t.m === first.m)) h += `<div class="g pad-s small muted" style="margin-top:12px">From ${U.fmtDate(first.ts)} to ${U.fmtDate(last.ts)} (${U.daysBetween(first.ts, last.ts)} days), the amount changed by <b class="${Math.abs(last.amt) > Math.abs(first.amt) ? 'neg' : 'pos'} amt">${U.money(Math.abs(last.amt) - Math.abs(first.amt), { sign: true })}</b> (${U.pct((Math.abs(last.amt) - Math.abs(first.amt)) / Math.abs(first.amt))}).</div>`;
      return h;
    };
    UI.sheet({ title: `Comparing ${txs.length}`, body, full: true });
  };

  /* helpers */
  function kpi(label, val, delta, cls, noAmt) { return `<div class="g kpi"><div class="tiny faint">${label}</div><div class="v ${noAmt ? '' : 'amt'} ${cls || ''}">${val}</div><div class="d">${delta || ''}</div></div>`; }
  function card(title, sub, inner, foot) { return `<div class="g pad" style="margin-top:12px"><div class="row between" style="margin-bottom:10px"><div class="h3">${title}</div><div class="tiny faint">${sub || ''}</div></div>${inner}${foot || ''}</div>`; }
  function legend(items) { return `<div class="legend">${items.map(([c, l]) => `<span><i style="background:${c}"></i>${U.esc(l)}</span>`).join('')}</div>`; }
  App.card = card; App.legend = legend;
})();

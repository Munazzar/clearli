/* Clearli — Plan: Goals & savings planner, Budgets, Recurring calendar, Recurring list */
(function () {
  const I = U.icon;
  const DAY = U.DAY;
  const card = (...a) => App.card(...a);

  UI.on('planSeg', (x) => { App.plan.seg = x; App.render(true); });
  App.screens.plan = function () {
    const P = App.plan;
    let body = UI.seg([['goals', 'Goals'], ['savings', 'Savings'], ['budgets', 'Budgets'], ['recurring', 'Bills']], P.seg, 'planSeg') + '<div class="sp"></div>';
    if (P.seg === 'goals') body += goals();
    else if (P.seg === 'savings') body += savings();
    else if (P.seg === 'budgets') body += budgets();
    else body += recurring();
    const floating = P.seg === 'goals' || P.seg === 'savings' ? `<button class="fab btn primary" style="padding:0" data-a="${P.seg === 'goals' ? 'goalNew' : 'assetNew'}">${I('plus', 'lg')}</button>` : '';
    return { title: 'Plan', actions: App.scopeBtn() + App.eyeBtn(), body, floating };
  };

  /* ---------------- Goals ---------------- */
  function goals() {
    const S = Store.S; const V = Store.V; const list = App.list();
    const base = E.monthlyBaseline(V, list, 3);
    let h = `<div class="g pad"><div class="eyebrow">Your monthly picture · last ${base.months} mo avg</div>
      <div class="grid3" style="margin-top:10px"><div><div class="tiny faint">Income</div><div class="b pos amt">${U.money(base.income, { whole: true })}</div></div><div><div class="tiny faint">Spending</div><div class="b neg amt">${U.money(base.spend, { whole: true })}</div></div><div><div class="tiny faint">Free cash</div><div class="b amt ${base.net >= 0 ? 'pos' : 'neg'}">${U.money(base.net, { whole: true, sign: true })}</div></div></div>
      <div style="margin-top:12px">${UI.progress(base.income ? base.spend / base.income : 1, base.net >= 0 ? 'var(--accent)' : 'var(--neg)')}</div>
      <div class="tiny faint" style="margin-top:6px">${base.income ? `You spend ${Math.round((base.spend / base.income) * 100)}% of what you earn` : 'Not enough income history yet'} · needs <span class="amt">${U.money(base.essential, { whole: true })}</span> · wants <span class="amt">${U.money(base.discretionary, { whole: true })}</span></div></div>`;
    if (!S.goals.length) {
      h += `<div class="sp"></div><div class="g">${UI.empty('target', 'Set your first goal', 'Tell Clearli what you are saving for — it will show how much to put away each month, where to cut and how to earn more.', `<div class="sp"></div><button class="btn primary" data-a="goalNew">${I('plus')} New goal</button>`)}</div>`;
      return h;
    }
    h += UI.sec('Goals', `<span class="small muted">${S.goals.length}</span>`);
    for (const g of S.goals) {
      const pl = E.planGoal(V, list, S, g);
      const pct = g.saved / g.target;
      const status = g.saved >= g.target ? ['pos', 'Reached!'] : pl.needMonthly == null ? ['muted', pl.eta ? 'ETA ' + U.fmtMonth(pl.eta, true) : 'No date'] : pl.gap <= 0 ? ['pos', 'On track'] : ['warn', `Short ${U.money(pl.gap, { whole: true })}/mo`];
      h += `<div class="g pad tap" data-a="goalOpen" data-x="${g.id}" style="margin-bottom:12px"><div class="row">${UI.ring(pct, 64, g.color || 'var(--accent)')}<div class="grow"><div class="row between"><div class="h3 ell">${U.esc(g.name)}</div><span class="badge ${status[0] === 'pos' ? 'pos' : status[0] === 'warn' ? 'warn' : ''}">${UI.maskMoney(status[1])}</span></div>
        <div class="small muted" style="margin-top:4px"><span class="amt">${U.money(g.saved, { whole: true })}</span> of <span class="amt">${U.money(g.target, { whole: true })}</span>${g.date ? ' · by ' + U.fmtMonth(g.date, true) : ''}</div>
        ${pl.needMonthly != null && g.saved < g.target ? `<div class="small" style="margin-top:4px">Save <b class="amt">${U.money(pl.needMonthly, { whole: true })}</b>/mo</div>` : ''}</div></div></div>`;
    }
    return h;
  }
  const GOAL_ICONS = ['target', 'shield-check', 'plane', 'home', 'car', 'graduation-cap', 'gift', 'heart-pulse', 'baby', 'smartphone', 'rocket', 'piggy-bank', 'briefcase', 'sparkles'];
  App.editGoal = function (id) {
    const S = Store.S;
    const g = id ? Object.assign({}, S.goals.find((x) => x.id === id)) : { id: U.uid(), name: '', target: '', saved: 0, date: +U.addMonths(new Date(), 12), icon: 'target', color: U.PALETTE[S.goals.length % U.PALETTE.length], created: Date.now() };
    const body = () => `<label class="field"><span>What are you saving for?</span><input class="inp" data-in="gf" data-x="name" value="${U.esc(g.name)}" placeholder="Emergency fund, trip, car…"></label>
      <div class="grid2"><label class="field"><span>Target amount</span><input class="inp" type="number" inputmode="decimal" data-in="gf" data-x="target" value="${g.target}" placeholder="5000"></label>
      <label class="field"><span>Already saved</span><input class="inp" type="number" inputmode="decimal" data-in="gf" data-x="saved" value="${g.saved}"></label></div>
      <label class="field"><span>Target date</span><input class="inp" type="date" data-ch="gfDate" value="${g.date ? U.inputDate(g.date) : ''}"></label>
      ${(S.assets || []).length ? `<div class="field"><span>Track with savings places (amount saved follows their value)</span><div class="chips wrap">${S.assets.map((a) => `<button class="chip ${(g.assets || []).includes(a.id) ? 'on' : ''}" data-a="gfAsset" data-x="${a.id}">${I(E.assetKind(a).icon)}${U.esc(a.name)}</button>`).join('')}</div></div>` : ''}
      <div class="field"><span>Icon</span><div class="icongrid">${GOAL_ICONS.map((ic) => `<button class="${g.icon === ic ? 'on' : ''}" data-a="gfIcon" data-x="${ic}">${I(ic)}</button>`).join('')}</div></div>
      <div class="field"><span>Color</span><div class="swatches">${U.PALETTE.slice(0, 10).map((c) => `<button class="swatch ${g.color === c ? 'on' : ''}" style="background:${c}" data-a="gfColor" data-x="${c}"></button>`).join('')}</div></div>
      ${id ? `<button class="btn block danger" data-a="gfDel">${I('trash-2')} Delete goal</button>` : ''}`;
    UI.on('gf', (v, el) => { g[el.dataset.x] = el.dataset.x === 'name' ? v : parseFloat(v) || 0; });
    UI.on('gfDate', (v) => { g.date = v ? +U.parseInputDate(v) : null; });
    UI.on('gfIcon', (x) => { g.icon = x; UI.renderSheet(); });
    UI.on('gfAsset', (x) => { g.assets = g.assets || []; g.assets = g.assets.includes(x) ? g.assets.filter((y) => y !== x) : [...g.assets, x]; UI.renderSheet(); });
    UI.on('gfColor', (x) => { g.color = x; UI.renderSheet(); });
    UI.on('gfSave', () => {
      if (!g.name || !(g.target > 0)) { UI.toast('Add a name and a target amount', 'info'); return; }
      const i = S.goals.findIndex((x) => x.id === g.id);
      if (i >= 0) S.goals[i] = g; else S.goals.push(g);
      Store.commit({ silent: true }); UI.closeSheet(); App.render(); if (UI.sheets.length) UI.renderSheet();
      if (!id) App.openGoal(g.id);
    });
    UI.on('gfDel', async () => { if (await UI.confirm('Delete goal?', `“${U.esc(g.name)}” will be removed.`, 'Delete', true)) { S.goals = S.goals.filter((x) => x.id !== g.id); Store.commit({ silent: true }); UI.closeAll(); App.render(); } });
    UI.sheet({ title: id ? 'Edit goal' : 'New goal', body, foot: `<button class="btn primary block" data-a="gfSave">Save goal</button>` });
  };
  UI.on('goalNew', () => App.editGoal(null));
  UI.on('goalOpen', (id) => App.openGoal(id));
  App.openGoal = function (id) {
    const cutsOn = new Set();
    const body = () => {
      const S = Store.S; const V = Store.V; const g = S.goals.find((x) => x.id === id); if (!g) return '';
      const pl = E.planGoal(V, App.list(), S, g);
      const extra = U.sum(pl.cuts.filter((c) => cutsOn.has(c.cat)), (c) => c.cut);
      const monthly = Math.max(0, pl.free) + extra;
      const eta = monthly > 0 ? new Date(Date.now() + (pl.remaining / monthly) * 30.44 * DAY) : null;
      const col = g.color || Store.S.settings.accent;
      let h = `<div class="row">${UI.ring(g.saved / g.target, 86, col)}<div class="grow"><div class="h2">${U.esc(g.name)}</div><div class="small muted" style="margin-top:4px"><span class="amt">${U.money(g.saved, { whole: true })}</span> saved · <span class="amt">${U.money(pl.remaining, { whole: true })}</span> to go</div>${g.date ? `<div class="small muted">Target ${U.fmtDate(g.date, { year: true })} · ${Math.max(0, Math.round(pl.monthsLeft))} months</div>` : ''}</div></div>
        <div class="grid2" style="margin-top:12px"><button class="btn sm" data-a="goalAdd" data-x="${id}">${I('plus', 'sm')} Add money</button><button class="btn sm" data-a="goalEdit" data-x="${id}">${I('pencil', 'sm')} Edit</button></div>`;
      h += `<div class="grid2" style="margin-top:12px">
        <div class="g kpi"><div class="tiny faint">Needed / month</div><div class="v amt">${pl.needMonthly != null ? U.money(pl.needMonthly, { whole: true }) : '—'}</div><div class="d faint">${pl.needMonthly != null ? U.money(pl.needMonthly / 4.33, { whole: true }) + '/week' : 'set a date'}</div></div>
        <div class="g kpi"><div class="tiny faint">You can free up</div><div class="v amt ${pl.free >= 0 ? 'pos' : 'neg'}">${U.money(pl.free, { whole: true })}</div><div class="d faint">avg income − spending${pl.committed ? ' − other goals' : ''}</div></div></div>`;
      const ok = pl.needMonthly == null || pl.gap <= 0;
      h += `<div class="g pad-s" style="margin-top:12px;background:linear-gradient(150deg,${U.hexA(ok ? '#3DDC97' : '#FFB547', 0.25)},${U.hexA(ok ? '#3DDC97' : '#FFB547', 0.04)})"><div class="row">${I(ok ? 'shield-check' : 'alert-triangle')}<div class="small"><b>${ok ? 'You\'re on track.' : `You're short ${U.money(pl.gap, { whole: true })}/month.`}</b> ${ok ? (pl.eta ? `At your current pace you'd reach it around ${U.fmtMonth(pl.eta)}.` : '') : 'Pick some cuts below to close the gap, or move the date.'}</div></div></div>`;
      h += card('Projection', 'monthly', UI.chart('gProj', { type: 'line', data: { labels: pl.chart.labels, datasets: [
        { label: 'Plan', data: pl.chart.proj, borderColor: col, backgroundColor: UI.grad(col, 0.3, 0), fill: true },
        { label: 'Current pace', data: pl.chart.pace, borderColor: UI.css('--text3'), borderDash: [5, 5], borderWidth: 2 },
        { label: 'Target', data: pl.chart.labels.map(() => g.target), borderColor: U.hexA('#3DDC97', 0.7), borderWidth: 1.5, borderDash: [2, 4] },
      ] }, options: UI.baseOpts({ zero: false }) }, 190), App.legend([[col, 'Plan'], [UI.css('--text3'), 'Current pace'], ['#3DDC97', 'Target']]));

      // Cuts
      if (pl.cuts.length) {
        h += UI.sec('Where to cut', `<span class="small ${extra ? 'pos' : 'muted'} amt">${extra ? '+' + U.money(extra, { whole: true }) + '/mo' : 'tap to try'}</span>`);
        h += `<div class="list g">${pl.cuts.slice(0, 8).map((c) => { const on = cutsOn.has(c.cat); return `<div class="item tap" data-a="goalCut" data-x="${c.cat}">${UI.catBubble(c.c)}<div class="grow"><div class="t">${U.esc(c.c.name)}</div><div class="s">Cut ${Math.round(c.rate * 100)}% of <span class="amt">${U.money(c.now, { whole: true })}</span>/mo</div></div><div class="b pos amt" style="margin-right:8px">+${U.money(c.cut, { whole: true })}</div><div class="check ${on ? 'on' : ''}">${on ? I('check') : ''}</div></div>`; }).join('')}</div>`;
        if (extra) h += `<div class="g pad-s small" style="margin-top:10px">${I('sparkles', 'sm')} With these cuts you'd save <b class="amt">${U.money(monthly, { whole: true })}</b>/mo and reach the goal ${eta ? `around <b>${U.fmtMonth(eta)}</b>` : ''}${g.date && eta ? (eta <= g.date ? ' — <span class="pos">before your deadline</span>' : ' — <span class="warn">still after your deadline</span>') : ''}.</div>`;
      }
      if (pl.subs.length) {
        h += UI.sec('Subscriptions to review', `<span class="small muted amt">${U.money(-U.sum(pl.subs, (r) => r.monthly), { whole: true })}/mo</span>`);
        h += `<div class="list g">${pl.subs.map((r) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(r.key)}"><div class="grow"><div class="t">${UI.recName(r)}</div><div class="s">${r.freq} · <span class="amt">${U.money(-r.yearly, { whole: true })}</span>/yr</div></div><div class="r b amt">${U.money(r.amount)}</div></div>`).join('')}</div>`;
      }
      h += UI.sec('Grow your income');
      h += pl.ideas.map((x) => `<div class="g pad-s" style="margin-bottom:10px"><div class="row" style="align-items:flex-start">${UI.bubble(x.icon, '#43D9B8')}<div class="grow"><div class="h3">${x.title}</div><div class="small muted" style="margin-top:3px">${x.body}</div></div></div></div>`).join('');
      h += UI.sec('Where to keep it');
      h += `<div class="g pad-s"><div class="row" style="align-items:flex-start">${UI.bubble('landmark', '#7C8CFF')}<div class="grow"><div class="h3">${pl.where.title}</div><div class="small muted" style="margin-top:3px">${pl.where.body}</div></div></div></div>
        <p class="tiny faint" style="margin:10px 4px">General education, not financial advice. Rates and products change — compare current offers before moving money.</p>`;
      return h;
    };
    UI.on('goalCut', (c) => { if (cutsOn.has(c)) cutsOn.delete(c); else cutsOn.add(c); UI.renderSheet(); });
    UI.sheet({ title: 'Goal plan', body, full: true, onClose: () => App.refresh() });
  };
  UI.on('goalEdit', (id) => App.editGoal(id));
  UI.on('goalAdd', (id) => {
    const g = Store.S.goals.find((x) => x.id === id);
    UI.sheet({ title: 'Add to ' + U.esc(g.name), body: `<label class="field"><span>Amount (use − to withdraw)</span><input class="inp" id="gaV" type="number" inputmode="decimal" placeholder="100"></label>`, foot: `<button class="btn primary block" data-a="goalAddOk" data-x="${id}">Add</button>`, after: (bd) => setTimeout(() => bd.querySelector('#gaV').focus(), 350) });
  });
  UI.on('goalAddOk', (id) => {
    const v = parseFloat(document.getElementById('gaV').value) || 0; const g = Store.S.goals.find((x) => x.id === id);
    g.saved = Math.max(0, (g.saved || 0) + v); Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet();
    UI.toast(g.saved >= g.target ? 'Goal reached! 🎉' : `Saved ${U.money(v)}`, 'piggy-bank');
  });

  /* ---------------- Savings places ---------------- */
  function savings() {
    const S = Store.S; const as = S.assets || [];
    const tot = U.sum(as, E.assetValue); const con = U.sum(as, E.assetContrib);
    let h = `<div class="g tint pad"><div class="eyebrow" style="color:var(--text)">Saved outside your bank feeds</div><div class="big amt" style="margin-top:6px">${U.money(tot)}</div>
      <div class="small muted" style="margin-top:6px">Put in <span class="amt">${U.money(con, { whole: true })}</span>${Math.abs(tot - con) >= 1 ? ` · ${tot >= con ? 'gain' : 'loss'} <b class="amt ${tot >= con ? 'pos' : 'neg'}">${U.money(tot - con, { whole: true, sign: true })}</b>` : ''}</div></div>`;
    if (!as.length) return h + `<div class="sp"></div><div class="g">${UI.empty('piggy-bank', 'Add where you keep savings', 'Cash at home, gold, a brokerage or retirement account, crypto, or an account you\'d rather not connect. Track deposits and value — it all stays on this phone.', `<div class="sp"></div><button class="btn primary" data-a="assetNew">${I('plus')} Add a savings place</button>`)}</div>`;
    if (as.length > 1) {
      const vals = as.map(E.assetValue);
      h += App.card('Mix', '', `<div class="row" style="gap:16px"><div style="width:42%;flex:none">${UI.chart('aMix', { type: 'doughnut', data: { labels: as.map((a) => a.private ? 'Private' : a.name), datasets: [{ data: vals, backgroundColor: as.map((a) => a.color || E.assetKind(a).color), spacing: 2, borderRadius: 6 }] }, options: { cutout: '68%', plugins: { tooltip: { callbacks: { label: UI.ttMoney } } } } }, 140)}</div><div class="grow">${as.map((a, i) => `<div class="row" style="margin:6px 0"><i style="width:9px;height:9px;border-radius:3px;background:${a.color || E.assetKind(a).color}"></i><span class="small grow ell">${a.private ? '••••' : U.esc(a.name)}</span><span class="small b">${Math.round((vals[i] / (tot || 1)) * 100)}%</span></div>`).join('')}</div></div>`);
    }
    h += UI.sec('Places', `<button class="link" data-a="assetNew">${I('plus', 'sm')} Add</button>`);
    h += `<div class="list g">${as.map((a) => { const k = E.assetKind(a); const v = E.assetValue(a); const c = E.assetContrib(a); return `<div class="item tap" data-a="assetOpen" data-x="${a.id}">${UI.bubble(a.icon || k.icon, a.color || k.color)}<div class="grow"><div class="t ell">${a.private ? '<span class="amt-h">' + U.esc(a.name) + '</span> ' + I('lock', 'sm') : U.esc(a.name)}</div><div class="s">${k.name}${a.qty ? ` · ${a.qty} ${U.esc(a.unit || '')}` : ''}${Math.abs(v - c) >= 1 ? ` · <span class="${v >= c ? 'pos' : 'neg'}">${U.pct((v - c) / (c || 1))}</span>` : ''}${a.inNetWorth === false ? ' · not in net worth' : ''}</div></div><div class="r b ${a.private ? 'amt-h' : ''} amt">${U.money(v, { auto: true })}</div></div>`; }).join('')}</div>`;
    const goalsLinked = S.goals.filter((g) => g.assets && g.assets.length);
    if (goalsLinked.length) h += UI.sec('Goals funded here') + goalsLinked.map((g) => `<div class="g pad-s tap row" data-a="goalOpen" data-x="${g.id}" style="margin-bottom:10px">${UI.ring(g.saved / g.target, 48, g.color)}<div class="grow"><div class="b">${U.esc(g.name)}</div><div class="small muted"><span class="amt">${U.money(g.saved, { whole: true })}</span> of <span class="amt">${U.money(g.target, { whole: true })}</span></div></div></div>`).join('');
    h += `<p class="tiny faint" style="margin:14px 6px">Tip: when you move money out of a bank account into one of these, open that transaction and tap “Moved to savings” — it’s logged here and not counted as spending.</p>`;
    return h;
  }
  App.editAsset = function (id) {
    const S = Store.S; S.assets = S.assets || [];
    const orig = id ? S.assets.find((a) => a.id === id) : null;
    const a = orig ? Object.assign({}, orig) : { id: 'as_' + U.uid(), name: '', kind: 'cash', entries: [], inNetWorth: true, private: false, created: Date.now() };
    let opening = '';
    const body = () => { const k = E.assetKind(a); return `<div class="field"><span>Type</span><div class="chips wrap">${E.ASSET_KINDS.map((x) => `<button class="chip ${a.kind === x.id ? 'on' : ''}" data-a="afKind" data-x="${x.id}">${I(x.icon)}${x.name}</button>`).join('')}</div></div>
      <label class="field"><span>Name</span><input class="inp" data-in="afName" value="${U.esc(a.name)}" placeholder="${{ cash: 'Home safe', bank: 'Credit union savings', gold: 'Gold jewelry / coins', investment: 'Brokerage', crypto: 'Bitcoin wallet', retirement: '401(k)', other: 'Savings jar' }[a.kind]}"></label>
      ${!orig ? `<label class="field"><span>Amount already there (optional)</span><input class="inp" type="number" inputmode="decimal" data-in="afOpen" placeholder="0"></label>` : ''}
      ${a.kind === 'gold' || a.kind === 'crypto' || a.kind === 'investment' ? `<div class="grid2"><label class="field"><span>Quantity (optional)</span><input class="inp" type="number" step="any" data-in="afQty" value="${a.qty || ''}" placeholder="${a.kind === 'gold' ? 'e.g. 50' : 'e.g. 0.25'}"></label><label class="field"><span>Unit</span><input class="inp" data-in="afUnit" value="${U.esc(a.unit || '')}" placeholder="${a.kind === 'gold' ? 'grams / oz / tola' : a.kind === 'crypto' ? 'BTC' : 'shares'}"></label></div>
        <label class="field"><span>Current price per unit (optional — value = quantity × price)</span><input class="inp" type="number" step="any" data-in="afPrice" value="${a.unitPrice || ''}"></label>` : ''}
      <div class="list g flat">
        <div class="item"><div class="grow"><div class="t">Include in net worth</div></div>${UI.toggle(a.inNetWorth !== false, 'afTog', 'inNetWorth')}</div>
        <div class="item"><div class="grow"><div class="t">Private</div><div class="s">Blur its name and amount on every screen</div></div>${UI.toggle(a.private, 'afTog', 'private')}</div>
      </div>
      ${orig ? `<div class="sp"></div><button class="btn block danger" data-a="afDel">${I('trash-2')} Delete this place</button>` : ''}`; };
    UI.on('afKind', (x) => { a.kind = x; UI.renderSheet(); });
    UI.on('afName', (v) => { a.name = v; });
    UI.on('afOpen', (v) => { opening = v; });
    UI.on('afQty', (v) => { a.qty = parseFloat(v) || 0; });
    UI.on('afUnit', (v) => { a.unit = v; });
    UI.on('afPrice', (v) => { a.unitPrice = parseFloat(v) || 0; a.priceAt = Date.now(); });
    UI.on('afTog', (k) => { a[k] = k === 'inNetWorth' ? a[k] === false : !a[k]; UI.renderSheet(); });
    UI.on('afSave', () => {
      if (!a.name.trim()) { UI.toast('Give it a name', 'info'); return; }
      a.name = a.name.trim();
      const o = parseFloat(opening); if (!orig && o) a.entries = [{ id: U.uid(), ts: Date.now(), amt: o, note: 'Starting amount' }];
      if (orig) Object.assign(orig, a); else S.assets.push(a);
      Store.commit({ silent: true }); UI.closeSheet(); App.render(); if (UI.sheets.length) UI.renderSheet();
      if (!orig) App.openAsset(a.id);
    });
    UI.on('afDel', async () => {
      if (!(await UI.confirm('Delete savings place?', `“${U.esc(a.name)}” and its history will be removed. Linked transactions go back to their normal category.`, 'Delete', true))) return;
      S.assets = S.assets.filter((x) => x.id !== a.id);
      for (const k in S.edits) if (S.edits[k].stash === a.id) Store.setEdit(k, { stash: null, cat: null });
      for (const g of S.goals) if (g.assets) g.assets = g.assets.filter((x) => x !== a.id);
      Store.commit({ silent: true }); UI.closeAll(); App.render();
    });
    UI.sheet({ title: orig ? 'Edit savings place' : 'New savings place', body, full: true, foot: `<button class="btn primary block" data-a="afSave">Save</button>` });
  };
  UI.on('assetNew', () => App.editAsset(null));
  UI.on('assetOpen', (id) => App.openAsset(id));
  App.openAsset = function (id) {
    const body = () => {
      const S = Store.S; const a = (S.assets || []).find((x) => x.id === id); if (!a) return '';
      const k = E.assetKind(a); const v = E.assetValue(a); const c = E.assetContrib(a); const col = a.color || k.color;
      const ents = [...(a.entries || [])].sort((x, y) => x.ts - y.ts);
      let run = 0; const pts = ents.map((e) => (run += e.amt));
      return `<div class="row">${UI.bubble(a.icon || k.icon, col)}<div class="grow"><div class="h2 ${a.private ? 'amt-h' : ''}">${U.esc(a.name)}</div><div class="small muted">${k.name}${a.qty ? ` · ${a.qty} ${U.esc(a.unit || '')}${a.unitPrice ? ' × ' + U.money(a.unitPrice) : ''}` : ''}</div></div><button class="btn sm" data-a="assetEdit" data-x="${id}">${I('pencil', 'sm')}</button></div>
        <div class="grid3" style="margin-top:12px"><div class="g kpi"><div class="tiny faint">Worth now</div><div class="v amt" style="font-size:17px">${U.money(v, { auto: true })}</div></div><div class="g kpi"><div class="tiny faint">Put in</div><div class="v amt" style="font-size:17px">${U.money(c, { auto: true })}</div></div><div class="g kpi"><div class="tiny faint">${v >= c ? 'Gain' : 'Loss'}</div><div class="v amt ${v >= c ? 'pos' : 'neg'}" style="font-size:17px">${U.money(v - c, { auto: true, sign: true })}</div></div></div>
        <div class="grid3" style="margin-top:12px"><button class="btn sm" data-a="aeAdd" data-x="${id}">${I('plus', 'sm')} Add</button><button class="btn sm" data-a="aeTake" data-x="${id}">${I('arrow-up-right', 'sm')} Take out</button><button class="btn sm" data-a="aeValue" data-x="${id}">${I('trending-up', 'sm')} Value</button></div>
        ${ents.length > 1 ? App.card('Money put in over time', '', UI.chart('aHist', { type: 'line', data: { labels: ents.map((e) => U.fmtDate(e.ts)), datasets: [{ label: 'Put in', data: pts, borderColor: col, backgroundColor: UI.grad(col, 0.3, 0), fill: true, stepped: true, pointRadius: 2 }] }, options: UI.baseOpts({ zero: false }) }, 160)) : ''}
        ${UI.sec('History')}${ents.length ? `<div class="list g flat">${ents.slice().reverse().map((e) => `<div class="item">${UI.bubble(e.amt >= 0 ? 'plus' : 'arrow-up-right', e.amt >= 0 ? '#43D9B8' : '#FF6B81', true)}<div class="grow"><div class="t" style="font-size:14px">${U.esc(e.note || (e.amt >= 0 ? 'Added' : 'Taken out'))}</div><div class="s">${U.fmtDate(e.ts, { year: true })}${e.tx ? ' · from a bank transaction' : ''}</div></div><div class="r b amt ${e.amt >= 0 ? 'pos' : 'neg'}">${U.money(e.amt, { sign: true })}</div><button class="iconbtn" data-a="aeDel" data-x="${id}|${e.id}">${I('x', 'sm')}</button></div>`).join('')}</div>` : '<div class="g pad-s small muted">No entries yet.</div>'}`;
    };
    UI.sheet({ title: 'Savings place', body, full: true, onClose: () => App.refresh() });
  };
  UI.on('assetEdit', (id) => App.editAsset(id));
  const entrySheet = (id, sign) => {
    UI.sheet({ title: sign > 0 ? 'Add money' : 'Take money out', body: `<label class="field"><span>Amount</span><input class="inp" id="aeAmt" type="number" inputmode="decimal" placeholder="0.00"></label><label class="field"><span>Date</span><input class="inp" id="aeDate" type="date" value="${U.inputDate(new Date())}"></label><label class="field"><span>Note (optional)</span><input class="inp" id="aeNote" placeholder="${sign > 0 ? 'Monthly savings' : 'Used for…'}"></label>`,
      foot: `<button class="btn primary block" data-a="aeOk" data-x="${id}|${sign}">Save</button>`, after: (bd) => setTimeout(() => bd.querySelector('#aeAmt').focus(), 350) });
  };
  UI.on('aeAdd', (id) => entrySheet(id, 1));
  UI.on('aeTake', (id) => entrySheet(id, -1));
  UI.on('aeOk', (x) => {
    const [id, sign] = x.split('|'); const v = Math.abs(parseFloat(document.getElementById('aeAmt').value) || 0);
    if (!v) return UI.toast('Enter an amount', 'info');
    const a = Store.S.assets.find((y) => y.id === id);
    a.entries.push({ id: U.uid(), ts: +U.parseInputDate(document.getElementById('aeDate').value) + 12 * 3600000, amt: Number(sign) * v, note: document.getElementById('aeNote').value.trim() });
    Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet();
  });
  UI.on('aeDel', async (x) => {
    const [id, eid] = x.split('|'); const a = Store.S.assets.find((y) => y.id === id); const e = a.entries.find((y) => y.id === eid);
    if (!(await UI.confirm('Remove entry?', `${U.money(e.amt, { sign: true })} on ${U.fmtDate(e.ts)}`, 'Remove', true))) return;
    a.entries = a.entries.filter((y) => y.id !== eid);
    if (e.tx) Store.setEdit(e.tx, { stash: null, cat: null });
    Store.commit({ silent: true }); UI.renderSheet();
  });
  UI.on('aeValue', (id) => {
    const a = Store.S.assets.find((y) => y.id === id);
    const hasQty = a.qty > 0;
    UI.sheet({ title: 'Update value', body: hasQty ? `<p class="small muted" style="margin-top:0">You hold ${a.qty} ${U.esc(a.unit || 'units')}. Enter today's price per ${U.esc(a.unit || 'unit')}.</p><label class="field"><span>Price per ${U.esc(a.unit || 'unit')}</span><input class="inp" id="avV" type="number" step="any" value="${a.unitPrice || ''}"></label>`
      : `<p class="small muted" style="margin-top:0">What is it worth today? Leave empty to use the total you put in.</p><label class="field"><span>Current value</span><input class="inp" id="avV" type="number" step="any" value="${a.value != null ? a.value : ''}"></label>`,
      foot: `<button class="btn primary block" data-a="avOk" data-x="${id}">Save</button>` });
  });
  UI.on('avOk', (id) => {
    const a = Store.S.assets.find((y) => y.id === id); const raw = document.getElementById('avV').value; const v = parseFloat(raw);
    if (a.qty > 0) { a.unitPrice = v || 0; a.priceAt = Date.now(); } else a.value = raw === '' ? null : v;
    a.valueAt = Date.now(); Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet();
  });
  // From a bank transaction: "Moved to savings"
  UI.on('txSave', (k) => {
    const S = Store.S; S.assets = S.assets || [];
    const t = Store.V.byKey[k] || Store.V.byKey[k + '~0']; const raw = S.txns[k]; const cur = (S.edits[k] || {}).stash;
    const pick = (id) => {
      for (const a of S.assets) a.entries = (a.entries || []).filter((e) => e.tx !== k);
      if (id) {
        const a = S.assets.find((x) => x.id === id);
        a.entries.push({ id: U.uid(), ts: raw.ts, amt: -raw.amt, note: t.name, tx: k });
        Store.setEdit(k, { stash: id, cat: 'savings' });
      } else Store.setEdit(k, { stash: null, cat: null });
      Store.commit({ silent: true }); UI.closeSheet(); UI.renderSheet();
      UI.toast(id ? `Logged ${U.money(-raw.amt)} to ${S.assets.find((x) => x.id === id).name}` : 'Unlinked', 'piggy-bank');
    };
    UI.on('tsPick', (id) => pick(id));
    UI.on('tsNew', () => { UI.closeSheet(); App.editAsset(null); });
    UI.sheet({ title: 'Moved to savings', body: `<p class="small muted" style="margin-top:0">Log <b class="amt">${U.money(-raw.amt)}</b> as money moved into one of your savings places. It won't count as spending.</p>
      ${S.assets.length ? `<div class="list g flat">${S.assets.map((a) => `<div class="item tap" data-a="tsPick" data-x="${a.id}">${UI.bubble(a.icon || E.assetKind(a).icon, a.color || E.assetKind(a).color)}<div class="grow t">${U.esc(a.name)}</div>${cur === a.id ? `<div class="check on">${I('check')}</div>` : ''}</div>`).join('')}</div>` : ''}
      <div class="sp"></div><button class="btn block" data-a="tsNew">${I('plus')} New savings place</button>
      ${cur ? `<div class="sp"></div><button class="btn block danger" data-a="tsPick" data-x="">Not moved to savings</button>` : ''}` });
  });

  /* ---------------- Budgets ---------------- */
  function budgets() {
    const S = Store.S; const V = Store.V; const list = App.list();
    const st = E.budgetStatus(V, list, S);
    const base = E.monthlyBaseline(V, list, 3);
    const totB = U.sum(st, (b) => b.budget); const totS = U.sum(st, (b) => b.spent);
    const now = new Date();
    let h = '';
    if (st.length) {
      h += `<div class="g pad"><div class="row between"><div><div class="eyebrow">${U.fmtMonth(now)} budget</div><div class="mid amt" style="margin-top:4px">${U.money(totS, { whole: true })} <span class="small faint">of <span class="amt">${U.money(totB, { whole: true })}</span></span></div></div>${UI.ring(totS / totB, 70, totS > totB ? 'var(--neg)' : 'var(--accent)')}</div>
        <div class="tiny faint" style="margin-top:8px">${U.dim(now) - now.getDate()} days left · the tick shows where you'd be at an even pace</div></div>`;
    }
    h += UI.sec('Categories', `<button class="link" data-a="budSuggest">${I('sparkles', 'sm')} Suggest</button>`);
    const cats = S.cats.filter((c) => c.kind === 'expense');
    const spentNow = E.byCategory(V, E.inRange(list, U.som(now), U.addMonths(U.som(now), 1)));
    h += `<div class="list g">${cats.map((c) => {
      const b = st.find((x) => x.c.id === c.id); const avg = (base.cats.find((x) => x.cat === c.id) || { v: 0 }).v; const sp = (spentNow.find((x) => x.cat === c.id) || { v: 0 }).v;
      if (!b && !avg && !sp) return '';
      return `<div class="item tap" data-a="budEdit" data-x="${c.id}" style="flex-wrap:wrap">${UI.catBubble(c)}<div class="grow"><div class="row between"><div class="t">${U.esc(c.name)}</div><div class="small ${b ? (b.over ? 'neg' : b.ahead ? 'warn' : 'muted') : 'faint'}"><span class="amt">${U.money(sp, { whole: true })}</span>${b ? ` / <span class="amt">${U.money(b.budget, { whole: true })}</span>` : ''}</div></div>
        ${b ? `<div style="margin-top:7px">${UI.progress(b.pct, b.over ? 'var(--neg)' : b.ahead ? 'var(--warn)' : c.color, b.pace)}</div>` : `<div class="s">avg <span class="amt">${U.money(avg, { whole: true })}</span>/mo · tap to set a budget</div>`}</div></div>`;
    }).join('')}</div>`;
    return h;
  }
  UI.on('budEdit', (cid) => {
    const c = Store.S.cats.find((x) => x.id === cid);
    const avg = (E.monthlyBaseline(Store.V, App.list(), 3).cats.find((x) => x.cat === cid) || { v: 0 }).v;
    UI.sheet({ title: U.esc(c.name) + ' budget', body: `<p class="small muted">Your 3-month average is <b class="amt">${U.money(avg, { whole: true })}</b>/mo.</p><label class="field"><span>Monthly budget</span><input class="inp" id="budV" type="number" inputmode="decimal" value="${c.budget || Math.round(avg / 10) * 10 || ''}"></label>
      <div class="chips">${[0.8, 0.9, 1].map((f) => `<button class="chip" data-a="budQuick" data-x="${Math.round((avg * f) / 5) * 5}">${f === 1 ? 'Average' : '−' + Math.round((1 - f) * 100) + '%'} · ${U.money(Math.round((avg * f) / 5) * 5, { whole: true })}</button>`).join('')}</div>`,
      foot: `${c.budget ? `<button class="btn grow" data-a="budClear" data-x="${cid}">Remove</button>` : ''}<button class="btn primary grow" data-a="budSave" data-x="${cid}">Save</button>` });
  });
  UI.on('budQuick', (v) => { document.getElementById('budV').value = v; });
  UI.on('budSave', (cid) => { const c = Store.S.cats.find((x) => x.id === cid); c.budget = parseFloat(document.getElementById('budV').value) || 0; Store.commit({ silent: true }); UI.closeSheet(); App.render(); });
  UI.on('budClear', (cid) => { const c = Store.S.cats.find((x) => x.id === cid); c.budget = 0; Store.commit({ silent: true }); UI.closeSheet(); App.render(); });
  UI.on('budSuggest', async () => {
    if (!(await UI.confirm('Suggest budgets?', 'Sets each category to its 3-month average, trimming flexible categories by 10%. You can adjust any of them afterwards.', 'Apply'))) return;
    const base = E.monthlyBaseline(Store.V, App.list(), 3);
    for (const x of base.cats) { if (x.v < 15 || !x.c) continue; const c = Store.S.cats.find((y) => y.id === x.cat); c.budget = Math.round((x.v * (c.essential ? 1 : 0.9)) / 5) * 5; }
    Store.commit({ silent: true }); App.render(); UI.toast('Budgets set from your history', 'sparkles');
  });

  /* ---------------- Calendar ---------------- */
  function calendar() {
    const V = Store.V; const S = Store.S; const P = App.plan; const ws = S.settings.weekStart;
    const m = U.som(P.cal); const mEnd = U.addMonths(m, 1);
    const today = U.sod(new Date());
    const scoped = new Set(App.list().map((t) => t.acct));
    const proj = E.projectRecurring(V, m, mEnd).filter((x) => scoped.has(x.r.acct) || !App.scope.accts.length);
    const past = App.list().filter((t) => t.recurring && t.ts >= +m && t.ts < +mEnd && t.ts < +today + DAY);
    const byDay = {};
    for (const x of proj) { const k = U.dayKey(x.date); (byDay[k] = byDay[k] || []).push({ name: x.r.name, amt: x.r.amount, cat: x.r.cat, future: true, key: x.r.key }); }
    for (const t of past) { const k = U.dayKey(t.ts); (byDay[k] = byDay[k] || []).push({ name: t.name, amt: t.amt, cat: t.cat, tx: t.k }); }
    const daySpend = {};
    for (const t of App.list()) { if (t.ts < +m || t.ts >= +mEnd || t.kind === 'transfer') continue; const k = U.dayKey(t.ts); daySpend[k] = (daySpend[k] || 0) + t.amt; }
    const expOut = U.sum(proj.filter((x) => x.r.amount < 0), (x) => -x.r.amount); const expIn = U.sum(proj.filter((x) => x.r.amount > 0), (x) => x.r.amount);
    const paidOut = -U.sum(past.filter((t) => t.amt < 0), (t) => t.amt); const gotIn = U.sum(past.filter((t) => t.amt > 0 && t.kind === 'income'), (t) => t.amt);
    let h = `<div class="g row between" style="padding:6px;border-radius:22px;margin-bottom:12px"><button class="iconbtn" data-a="calNav" data-x="-1">${I('chevron-left')}</button><div class="b">${U.fmtMonth(m)}</div><button class="iconbtn" data-a="calNav" data-x="1">${I('chevron-right')}</button></div>`;
    h += `<div class="grid2"><div class="g kpi"><div class="tiny faint">Bills ${+mEnd <= +today ? 'paid' : 'paid + expected'}</div><div class="v neg amt">${U.money(paidOut + expOut, { whole: true })}</div><div class="d faint">${expOut ? `<span class="amt">${U.money(expOut, { whole: true })}</span> still to come` : 'all paid'}</div></div>
      <div class="g kpi"><div class="tiny faint">Recurring income</div><div class="v pos amt">${U.money(gotIn + expIn, { whole: true })}</div><div class="d faint">${expIn ? `<span class="amt">${U.money(expIn, { whole: true })}</span> expected` : ''}</div></div></div>`;
    const first = U.sow(m, ws); const cells = [];
    for (let d = first; d < mEnd || cells.length % 7; d = U.addDays(d, 1)) cells.push(d);
    h += `<div class="g pad-s" style="margin-top:12px"><div class="cal">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="h">${U.DOW[(i + ws) % 7]}</div>`).join('')}${cells.map((d) => {
      const k = U.dayKey(d); const items = byDay[k] || []; const out = d < m || d >= mEnd;
      const tot = +d <= +today ? (daySpend[k] || 0) : U.sum(items, (x) => x.amt);
      return `<div class="d tap ${out ? 'out' : ''} ${+d === +today ? 'today' : ''} ${P.calSel === k ? 'sel' : ''}" data-a="calDay" data-x="${k}"><span>${d.getDate()}</span><div class="dots">${items.slice(0, 4).map((x) => `<i style="background:${V.catMap[x.cat].color};${x.future ? 'opacity:.55;box-shadow:0 0 0 1px ' + V.catMap[x.cat].color : ''}"></i>`).join('')}</div>${tot ? `<span class="v amt ${tot > 0 ? 'pos' : ''}">${U.money(Math.abs(tot), { compact: true, whole: true })}</span>` : ''}</div>`;
    }).join('')}</div><div class="legend"><span><i style="background:var(--accent)"></i>paid</span><span><i style="background:transparent;box-shadow:0 0 0 1px var(--accent)"></i>expected</span></div></div>`;
    // Quick look: every transaction this month (or on the selected day) + what's still expected
    const f = P.calF || 'all';
    const acts = E.inRangeTs(App.list({ includeExcluded: true }), m, mEnd).filter((t) => !P.calSel || U.dayKey(t.ts) === P.calSel);
    const ups = proj.filter((x) => x.date >= today && (!P.calSel || U.dayKey(x.date) === P.calSel)).sort((x, y) => x.date - y.date);
    const upRows = f === 'paid' ? [] : ups.filter((x) => (f === 'income' ? x.r.amount > 0 : f === 'bills' ? x.r.amount < 0 : true));
    const actRows = f === 'upcoming' ? [] : acts.filter((t) => (f === 'income' ? t.kind === 'income' : f === 'bills' ? t.recurring && t.amt < 0 : true));
    const outT = -U.sum(actRows.filter((t) => t.kind === 'expense'), (t) => t.amt); const inT = U.sum(actRows.filter((t) => t.kind === 'income'), (t) => t.amt);
    h += UI.sec(P.calSel ? U.fmtDate(U.parseInputDate(P.calSel), { dow: true }) : 'All of ' + U.MON[m.getMonth()], P.calSel ? `<button class="link" data-a="calDay" data-x="${P.calSel}">Show whole month</button>` : '');
    h += `<div class="chips">${[['all', 'All'], ['paid', 'Paid & received'], ['upcoming', 'Upcoming'], ['income', 'Income'], ['bills', 'Bills']].map(([id, l]) => `<button class="chip ${f === id ? 'on' : ''}" data-a="calF" data-x="${id}">${l}</button>`).join('')}</div>`;
    if (upRows.length) h += `<div class="dayhdr"><span>Upcoming</span><span class="amt">${U.money(U.sum(upRows, (x) => x.r.amount), { whole: true })}</span></div><div class="list g">${upRows.map((x) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(x.r.key)}">${UI.catBubble(V.catMap[x.r.cat])}<div class="grow"><div class="t ell">${UI.recName(x.r)} <span class="badge">Expected</span></div><div class="s">${U.fmtDate(x.date, { rel: true, dow: true })} · ${x.r.freq}</div></div><div class="r b">${U.amt(x.r.amount, { color: true })}</div></div>`).join('')}</div>`;
    if (actRows.length) {
      h += `<div class="dayhdr"><span>${f === 'upcoming' ? '' : 'Paid & received'}</span><span><span class="neg amt">−${U.money(outT, { whole: true })}</span> · <span class="pos amt">+${U.money(inT, { whole: true })}</span></span></div>`;
      const byD = U.groupBy(actRows, (t) => U.dayKey(t.ts));
      for (const [, txs] of byD) h += `<div class="tiny faint" style="margin:10px 8px 6px">${U.fmtDate(txs[0].ts, { rel: true, dow: true })}</div><div class="list g">${txs.map((t) => UI.txRow(t)).join('')}</div>`;
    }
    if (!upRows.length && !actRows.length) h += `<div class="g pad-s small muted">Nothing here${P.calSel ? ' on this day' : ''}.</div>`;
    return h;
  }
  // Calendar has its own tab (next to Home)
  App.screens.calendar = () => ({ title: 'Calendar', actions: App.scopeBtn() + App.eyeBtn(), body: calendar() });
  UI.on('calF', (x) => { App.plan.calF = x; App.render(); });
  UI.on('calNav', (x) => { App.plan.cal = U.addMonths(App.plan.cal, Number(x)); App.plan.calSel = null; App.render(); });
  UI.on('calDay', (k) => { App.plan.calSel = App.plan.calSel === k ? null : k; App.render(); });

  /* ---------------- Recurring list ---------------- */
  function recurring() {
    const V = Store.V; const scoped = new Set(App.list().map((t) => t.acct));
    const rs = V.recurring.filter((r) => !App.scope.accts.length && !App.scope.conns.length ? true : scoped.has(r.acct));
    const active = rs.filter((r) => r.active); const inactive = rs.filter((r) => !r.active);
    const inc = active.filter((r) => r.amount > 0); const bills = active.filter((r) => r.amount < 0 && r.cat !== 'subscriptions'); const subs = active.filter((r) => r.amount < 0 && r.cat === 'subscriptions');
    const mOut = -U.sum(active.filter((r) => r.amount < 0), (r) => r.monthly); const mIn = U.sum(inc, (r) => r.monthly);
    let h = `<div class="grid2"><div class="g kpi"><div class="tiny faint">Recurring out</div><div class="v neg amt">${U.money(mOut, { whole: true })}<span class="small faint">/mo</span></div><div class="d faint amt">${U.money(mOut * 12, { whole: true })}/yr</div></div><div class="g kpi"><div class="tiny faint">Recurring in</div><div class="v pos amt">${U.money(mIn, { whole: true })}<span class="small faint">/mo</span></div><div class="d faint">${mIn ? Math.round((mOut / mIn) * 100) + '% goes to fixed costs' : ''}</div></div></div>`;
    const grp = (title, arr) => (arr.length ? UI.sec(title, `<span class="small muted amt">${U.money(Math.abs(U.sum(arr, (r) => r.monthly)), { whole: true })}/mo</span>`) + `<div class="list g">${arr.map((r) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(r.key)}">${UI.catBubble(V.catMap[r.cat])}<div class="grow"><div class="t ell">${UI.recName(r)} ${r.priceChange && r.amount < 0 && r.priceChange.pct > 0 ? `<span class="badge neg">${I('trending-up')} ${U.pct(r.priceChange.pct)}</span>` : ''}</div><div class="s">${r.freq} · next ${U.fmtDate(r.next, { rel: true })}</div></div><div class="r b">${U.amt(r.amount, { color: true })}</div></div>`).join('')}</div>` : '');
    h += grp('Income', inc) + grp('Bills', bills) + grp('Subscriptions', subs);
    if (inactive.length) h += UI.sec('Stopped or paused') + `<div class="list g">${inactive.map((r) => `<div class="item tap" data-a="recOpen" data-x="${U.esc(r.key)}" style="opacity:.6">${UI.catBubble(V.catMap[r.cat])}<div class="grow"><div class="t ell">${UI.recName(r)}</div><div class="s">last ${U.fmtDate(r.last)}</div></div><div class="r b amt">${U.money(r.amount)}</div></div>`).join('')}</div>`;
    if (!rs.length) h += `<div class="sp"></div><div class="g">${UI.empty('repeat', 'No recurring transactions yet', 'Clearli needs a few months of history to spot patterns. You can also mark a transaction as recurring.')}</div>`;
    return h;
  }
  UI.on('recOpen', (k) => App.openRecurring(k));
  App.openRecurring = function (key) {
    const body = () => {
      const V = Store.V; const r = V.recurring.find((x) => x.key === key);
      if (!r) return UI.empty('repeat', 'Not recurring anymore', `<button class="btn sm" data-a="recUnignore" data-x="${U.esc(key)}">Restore detection</button>`);
      const c = V.catMap[r.cat];
      const hist = [...r.history].sort((a, b) => a.ts - b.ts).slice(-18);
      return `<div class="row">${UI.catBubble(c)}<div class="grow"><div class="h3">${UI.recName(r)}</div><div class="small muted">${r.freq} · ${U.esc(c.name)} · ${r.count} times</div></div><div class="b">${U.amt(r.amount, { color: true })}</div></div>
        <div class="grid3" style="margin-top:12px"><div class="g kpi"><div class="tiny faint">Next</div><div class="v" style="font-size:16px">${r.active ? U.fmtDate(r.next, { rel: true }) : '—'}</div></div><div class="g kpi"><div class="tiny faint">Per month</div><div class="v amt" style="font-size:16px">${U.money(Math.abs(r.monthly))}</div></div><div class="g kpi"><div class="tiny faint">Per year</div><div class="v amt" style="font-size:16px">${U.money(Math.abs(r.yearly), { whole: true })}</div></div></div>
        ${r.priceChange ? `<div class="g pad-s small" style="margin-top:12px"><div>${I('trending-up', 'sm')} Changed from <b class="amt">${U.money(r.priceChange.from)}</b> to <b class="amt">${U.money(r.priceChange.to)}</b> (${U.pct(r.priceChange.pct)}) on ${U.fmtDate(r.priceChange.at)}.</div><button class="btn sm" style="margin-top:10px" data-a="recNoHike" data-x="${U.esc(r.key)}">${I('check', 'sm')} That's expected — not a price increase</button></div>` : ''}
        <div class="g pad-s" style="margin-top:12px">${UI.chart('recH', { type: 'line', data: { labels: hist.map((t) => U.fmtDate(t.ts)), datasets: [{ label: 'Amount', data: hist.map((t) => Math.abs(t.amt)), borderColor: c.color, backgroundColor: UI.grad(c.color, 0.3, 0), fill: true, pointRadius: 3, stepped: true }] }, options: UI.baseOpts({ zero: false }) }, 160)}</div>
        <div class="g pad-s" style="margin-top:12px"><label class="field" style="margin-bottom:10px"><span>Name for this ${r.amount < 0 ? 'charge' : 'deposit'}</span><input class="inp" data-ch="recName" data-x="${U.esc(r.key)}" value="${U.esc((Store.S.recurringOverrides || {})[r.key + '|name'] || '')}" placeholder="${U.esc(r.name)}"></label>
          <div class="item tap" data-a="recCat" data-x="${U.esc(r.key)}" style="padding:6px 2px">${UI.catBubble(c)}<div class="grow"><div class="t" style="font-size:14px">${U.esc(c.name)}</div><div class="s">Category for this ${r.amount < 0 ? 'charge' : 'deposit'} only</div></div>${I('chevron-right')}</div>
          <div class="item" style="padding:6px 2px"><div class="grow"><div class="t" style="font-size:14px">Different amounts are different ${r.amount < 0 ? 'subscriptions' : 'deposits'}</div><div class="s">From ${U.esc(E.titleCase(r.m))} · ${(Store.S.recurringOverrides || {})[r.m + '|split'] === undefined ? 'auto: ' + (E.multiBilled(r.history) || r.key.includes('#') ? 'yes' : 'no') : 'set by you'}</div></div>${UI.toggle(r.key.includes('#'), 'recSplit', r.m)}</div></div>
        <div class="sp"></div><div class="grid2"><button class="btn sm" data-a="merchOpen" data-x="${U.esc(r.m)}">${I('receipt', 'sm')} All charges</button><button class="btn sm danger" data-a="recIgnore" data-x="${U.esc(r.key)}">${I('x', 'sm')} Not recurring</button></div>
        ${UI.sec('History')}<div class="list g flat">${[...r.history].slice(-12).reverse().map((t) => UI.txRow(t, { showDate: true })).join('')}</div>`;
    };
    UI.sheet({ title: 'Recurring', body, full: true, onClose: () => App.refresh() });
  };
  const ovr = () => (Store.S.recurringOverrides = Store.S.recurringOverrides || {});
  UI.on('recName', (v, el) => { const k = el.dataset.x; if (v.trim()) ovr()[k + '|name'] = v.trim(); else delete ovr()[k + '|name']; Store.commit({ silent: true }); UI.renderSheet(); UI.toast('Name saved', 'pencil'); });
  UI.on('recCat', (k) => { const r = Store.V.recurring.find((x) => x.key === k); App.pickCategory(r ? r.cat : null, (id) => { ovr()[k + '|cat'] = id; Store.commit({ silent: true }); UI.renderSheet(); }); });
  UI.on('recSplit', (m) => {
    const cur = Store.V.recurring.some((r) => r.m === m && r.key.includes('#'));
    ovr()[m + '|split'] = !cur; Store.commit({ silent: true }); UI.closeSheet(); App.render();
    UI.toast(!cur ? 'Split by amount — each is its own recurring item now' : 'Combined into one recurring item', 'repeat');
  });
  UI.on('recNoHike', (k) => { Store.S.recurringOverrides[k + '|nohike'] = true; Store.commit({ silent: true }); UI.renderSheet(); UI.toast('Got it — won\'t flag this as a price increase', 'check'); });
  UI.on('recIgnore', (k) => { const ov = Store.S.recurringOverrides; if (k.indexOf('man:') === 0) delete ov[k]; else ov[k] = 'ignore'; Store.commit({ silent: true }); UI.renderSheet(); UI.toast('Removed from recurring', 'x'); });
  UI.on('recUnignore', (k) => { delete Store.S.recurringOverrides[k]; Store.commit({ silent: true }); UI.renderSheet(); });
})();

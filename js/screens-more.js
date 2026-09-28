/* Clearli — More: connection, accounts, categories, rules, appearance, privacy, data, about */
(function () {
  const I = U.icon;
  const row = (icon, color, title, sub, a, x, right) => `<div class="item tap" data-a="${a}" data-x="${x || ''}">${UI.bubble(icon, color)}<div class="grow"><div class="t">${title}</div>${sub ? `<div class="s ell">${sub}</div>` : ''}</div>${right != null ? right : I('chevron-right')}</div>`;

  App.screens.more = function () {
    const S = Store.S; const st = S.settings;
    const host = Store.N.sync('accessHost');
    const nA = Object.keys(S.accounts).length; const nT = Object.keys(S.txns).length;
    let body = `<div class="g pad row">${UI.bubble(st.demo ? 'sparkles' : host ? 'shield-check' : 'alert-triangle', st.demo ? '#FFB547' : host ? '#3DDC97' : '#FF6B81')}<div class="grow"><div class="h3">${st.demo ? 'Sample data' : host ? 'Connected via SimpleFIN' : 'Not connected'}</div><div class="small muted">${nA} accounts · ${U.num(nT)} transactions${S.lastSync ? ' · ' + U.ago(S.lastSync) : ''}</div></div><button class="iconbtn g" data-a="sync">${I('refresh-cw')}</button></div>`;
    body += UI.sec('Data') + `<div class="list g">
      ${row('layers', '#43D9B8', S.sync && S.sync.role === 'member' ? 'Household sync' : 'Web dashboard & sync', S.sync && S.sync.enabled ? (S.sync.role === 'member' ? 'Member of ' + S.sync.email : 'On · ' + (S.sync.lastPush ? 'synced ' + U.ago(S.sync.lastPush) : 'waiting')) : 'Encrypted sync to your computer', 'push', 'websync')}
      ${row('landmark', '#7C8CFF', 'Connection & sync', st.demo ? 'Connect your real banks' : host || 'Set up SimpleFIN', 'push', 'connection')}
      ${row('wallet', '#43D9B8', 'Accounts', 'Rename, hide, set types', 'push', 'accounts')}
      ${row('tag', '#FF6FB5', 'Categories', S.cats.length + ' categories', 'push', 'categories')}
      ${row('sparkles', '#FFB547', 'Rules & learning', S.rules.length + ' rules', 'push', 'rules')}
    </div>`;
    body += UI.sec('Preferences') + `<div class="list g">
      ${row('palette', '#B78CFF', 'Appearance', { 'glass-dark': 'Liquid Glass · Dark', 'glass-light': 'Liquid Glass · Light', aurora: 'Aurora', midnight: 'Midnight OLED' }[st.theme], 'push', 'appearance')}
      ${row('lock', '#3DDC97', 'Privacy & security', st.lock ? 'App lock on' : 'App lock off', 'push', 'privacy')}
      ${row('settings', '#5AC8FA', 'General', `${st.currency} · week starts ${U.DOW[st.weekStart]} · ${st.apy}% APY`, 'push', 'general')}
    </div>`;
    body += UI.sec('Backup & export') + `<div class="list g">
      ${row('file-text', '#FFB547', 'Import bank file', 'CSV, OFX or QFX from Chase, Amex, Capital One and others', 'importFile')}
      ${row('download', '#43D9B8', 'Export transactions (CSV)', 'Open in Excel, Sheets, Numbers', 'exportCsv')}
      ${row('upload', '#7C8CFF', 'Back up everything', 'Your edits, rules, goals & history as a file', 'backup')}
      ${row('undo-2', '#FFB547', 'Restore from backup', '', 'restore')}
    </div>`;
    body += UI.sec('Clearli') + `<div class="list g">
      ${row('rocket', '#FF6FB5', 'What\'s next', 'Web app sync, on-device AI, business mode', 'push', 'roadmap')}
      ${row('info', '#8A93B8', 'About & privacy', 'Version ' + (Store.N.sync('version') || '1.0'), 'push', 'about')}
      ${row('trash-2', '#FF6B81', 'Erase all data', 'Removes everything from this phone', 'wipe')}
    </div>`;
    return { title: 'More', body };
  };

  /* ---------------- Connection ---------------- */
  App.pageDefs.connection = function () {
    const S = Store.S; const st = S.settings;
    if (App.isMember && App.isMember()) return { title: 'Connection & sync', body: `<div class="g pad row">${UI.bubble('layers', '#43D9B8')}<div class="grow"><div class="h3">Banks sync on the main phone</div><div class="small muted" style="margin-top:3px">This phone is a household member. SimpleFIN, history loading and bank-file imports that need a bank account run on the main phone; this one gets updates from it automatically.</div></div></div><div class="sp"></div><button class="btn primary block" data-a="push" data-x="websync">${I('layers')} Household sync</button>` };
    const host = Store.N.sync('accessHost');
    const q = S.quota && S.quota.day === U.dayKey(new Date()) ? S.quota.n : 0;
    let b = `<div class="g pad"><div class="row">${UI.bubble('landmark', '#7C8CFF')}<div class="grow"><div class="h3">SimpleFIN Bridge</div><div class="small muted">${st.demo ? 'Using sample data' : host ? U.esc(host) : 'Not connected'}</div></div></div>
      <div class="grid2" style="margin-top:14px"><div><div class="tiny faint">Last sync</div><div class="b">${S.lastSync ? U.ago(S.lastSync) : 'Never'}</div></div><div><div class="tiny faint">Requests today</div><div class="b">${q} / 24</div></div></div>
      <div class="sp"></div><div class="grid2"><button class="btn sm" data-a="sync">${I('refresh-cw', 'sm')} Sync now</button><button class="btn sm" data-a="fullSync">${I('download', 'sm')} Re-download</button></div></div>`;
    b += UI.sec('Sync') + `<div class="list g">
      <div class="item"><div class="grow"><div class="t">Auto-sync</div><div class="s">When opening the app, at most every 6 hours</div></div>${UI.toggle(st.autoSync, 'setToggle', 'autoSync')}</div>
      <div class="item"><div class="grow"><div class="t">History to download</div><div class="s">Banks usually provide 90 days to 2 years</div></div><select class="inp" style="width:120px;height:40px" data-ch="setHist">${[90, 180, 365, 730].map((d) => `<option value="${d}" ${st.historyDays === d ? 'selected' : ''}>${d === 730 ? '2 years' : d === 365 ? '1 year' : d + ' days'}</option>`).join('')}</select></div>
    </div>`;
    b += UI.sec('History') + `<div class="g pad" id="bfCard">${App.bfCardHtml()}</div><div class="sp" style="height:10px"></div><button class="btn block" data-a="importFile">${I('file-text')} Import older history from a bank file</button>` + App.importsHtml();
    b += `<div class="sp"></div><button class="btn block ${st.demo || !host ? 'primary' : ''}" data-a="reconnect">${I('landmark')} ${st.demo || !host ? 'Connect SimpleFIN' : 'Use a new setup token'}</button>`;
    if (host) b += `<div class="sp"></div><button class="btn block danger" data-a="disconnect">${I('log-out')} Disconnect</button>`;
    if (S.errors && S.errors.length) b += UI.sec('Messages from your banks') + `<div class="list g">${S.errors.map((e) => `<div class="item small warn">${I('alert-triangle', 'sm')}<div class="grow">${U.esc(e)}</div></div>`).join('')}</div>`;
    if (S.syncLog.length) b += UI.sec('Sync history') + `<div class="list g">${S.syncLog.slice(0, 12).map((l) => `<div class="item"><div class="grow"><div class="t" style="font-size:14px">${U.esc(l.msg)}</div><div class="s">${U.fmtDate(l.at, { rel: true })} ${new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>${I(l.ok ? 'check' : 'alert-triangle', l.ok ? 'pos' : 'neg')}</div>`).join('')}</div>`;
    b += `<p class="tiny faint" style="margin:14px 6px">SimpleFIN Bridge asks apps to make no more than 24 requests a day and recommends at most 45 days per request, so a full re-download of 1 year uses ~9 requests.</p>`;
    return { title: 'Connection & sync', body: b };
  };
  UI.on('fullSync', async () => { if (Store.S.settings.demo) return UI.toast('Using sample data', 'info'); if (await UI.confirm('Re-download history?', `Fetches the last ${Store.S.settings.historyDays} days again. Your edits, rules and categories are kept.`, 'Download')) App.doSync({ full: true }); });
  UI.on('setHist', (v) => { Store.S.settings.historyDays = Number(v); Store.save(); });
  UI.on('reconnect', async () => {
    const S = Store.S;
    if (S.settings.demo) {
      if (!(await UI.confirm('Switch to real data?', 'Sample data will be cleared. Your theme and security settings are kept.', 'Continue'))) return;
      const keep = Object.assign({}, S.settings, { demo: false, onboarded: true });
      Store.S = Store.fresh(); Store.S.settings = keep; Store.commit({ silent: true });
    }
    App.restartOnboarding();
  });
  UI.on('disconnect', async () => {
    if (!(await UI.confirm('Disconnect SimpleFIN?', 'The access key is deleted from this phone. Your downloaded history stays until you erase it. To fully revoke access, also remove the app connection in SimpleFIN Bridge.', 'Disconnect', true))) return;
    Store.N.sync('clearCredential'); App.render(); UI.toast('Disconnected', 'log-out');
  });

  /* ---------------- Accounts ---------------- */
  App.pageDefs.accounts = function () {
    const S = Store.S;
    let b = '';
    for (const c of Object.values(S.conns)) {
      const accts = Object.values(S.accounts).filter((a) => a.conn === c.id);
      if (!accts.length) continue;
      const tot = U.sum(accts.filter((a) => !a.hidden && !a.excludeTotals), (a) => a.balance);
      const fresh = Math.min(...accts.filter((a) => !a.hidden && a.balanceDate).map((a) => a.balanceDate));
      b += UI.sec(U.esc(c.name) + (c.manual || !isFinite(fresh) ? '' : ' ' + App.asOfBadge(fresh)), `<span class="small b amt">${U.money(tot, { auto: true })}</span>`);
      b += `<div class="list g">${accts.map((a) => `<div class="item tap" data-a="acctEdit" data-x="${U.esc(a.id)}" style="${a.hidden ? 'opacity:.5' : ''}">${UI.bubble({ checking: 'wallet', savings: 'piggy-bank', credit: 'credit-card', investment: 'trending-up', loan: 'banknote' }[a.type] || 'landmark', { checking: '#7C8CFF', savings: '#43D9B8', credit: '#FF6FB5', investment: '#FFB547', loan: '#B78CFF' }[a.type] || '#8A93B8')}<div class="grow"><div class="t ell">${U.esc(a.alias || a.name)}</div><div class="s">${a.type}${a.hidden ? ' · hidden' : ''}${a.excludeTotals ? ' · not in totals' : ''}${a.balanceDate && !a.manual ? ` · <span class="${App.asOf(a.balanceDate).stale ? 'warn' : ''}">as of ${App.asOf(a.balanceDate).long}</span>` : ''}${App.afterPending(a) ? ` · after pending <span class="amt">${U.money(App.afterPending(a).v, { auto: true })}</span>` : ''}</div></div><div class="r b amt ${a.balance < 0 ? 'neg' : ''}">${U.money(a.balance, { auto: true })}</div></div>`).join('')}</div>`;
    }
    if (!b) b = `<div class="g">${UI.empty('landmark', 'No accounts yet')}</div>`;
    return { title: 'Accounts', body: b };
  };
  UI.on('acctEdit', (id) => {
    const a = Store.S.accounts[id];
    const body = () => `<label class="field"><span>Display name</span><input class="inp" data-ch="acSet" data-x="alias" value="${U.esc(a.alias || '')}" placeholder="${U.esc(a.name)}"></label>
      <div class="field"><span>Type</span><div class="chips wrap">${['checking', 'savings', 'credit', 'investment', 'loan', 'other'].map((t) => `<button class="chip ${a.type === t ? 'on' : ''}" data-a="acType" data-x="${t}">${t}</button>`).join('')}</div></div>
      <div class="list g flat">
        <div class="item"><div class="grow"><div class="t">Hide account</div><div class="s">Remove from every screen</div></div>${UI.toggle(a.hidden, 'acTog', 'hidden')}</div>
        <div class="item"><div class="grow"><div class="t">Exclude from net worth</div><div class="s">Still shows transactions</div></div>${UI.toggle(a.excludeTotals, 'acTog', 'excludeTotals')}</div>
        <div class="item"><div class="grow"><div class="t">Exclude from reports</div><div class="s">e.g. a business or shared account</div></div>${UI.toggle(a.excludeReports, 'acTog', 'excludeReports')}</div>
      </div><p class="tiny faint" style="margin:12px 4px">Bank name: ${U.esc(a.name)} · ${U.esc(a.currency)}${a.avail != null ? ' · available ' + U.money(a.avail) : ''}</p>`;
    UI.on('acSet', (v, el) => { a[el.dataset.x] = v.trim(); Store.commit({ silent: true }); });
    UI.on('acType', (t) => { a.type = t; Store.commit({ silent: true }); UI.renderSheet(); });
    UI.on('acTog', (k) => { a[k] = !a[k]; Store.commit({ silent: true }); UI.renderSheet(); });
    UI.sheet({ title: 'Account', body, onClose: () => App.refresh() });
  });

  /* ---------------- Categories ---------------- */
  App.pageDefs.categories = function () {
    const S = Store.S; const V = Store.V;
    const counts = {}; for (const t of V.list) counts[t.cat] = (counts[t.cat] || 0) + 1;
    let b = `<button class="btn block primary" data-a="catNew">${I('plus')} New category</button>`;
    for (const [k, l] of [['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfers & excluded']]) {
      const cs = S.cats.filter((c) => c.kind === k);
      if (!cs.length) continue;
      b += UI.sec(l) + `<div class="list g">${cs.map((c) => `<div class="item tap" data-a="catEdit" data-x="${c.id}">${UI.catBubble(c)}<div class="grow"><div class="t">${U.esc(c.name)} ${c.custom ? '<span class="badge acc">custom</span>' : ''}</div><div class="s">${counts[c.id] || 0} transactions${c.essential ? ' · essential' : ''}${c.budget ? ' · budget ' + U.money(c.budget, { whole: true }) : ''}</div></div>${I('chevron-right')}</div>`).join('')}</div>`;
    }
    return { title: 'Categories', body: b };
  };
  const CAT_ICONS = ['tag', 'shopping-cart', 'utensils', 'coffee', 'fuel', 'car', 'bus', 'home', 'zap', 'wifi', 'smartphone', 'heart-pulse', 'dumbbell', 'shirt', 'film', 'plane', 'gift', 'graduation-cap', 'baby', 'paw-print', 'scissors', 'receipt', 'repeat', 'briefcase', 'hand-coins', 'banknote', 'landmark', 'building-2', 'wallet', 'credit-card', 'piggy-bank', 'shield-check', 'sparkles', 'rocket', 'target'];
  App.editCategory = function (id, done) {
    const S = Store.S;
    const orig = id ? S.cats.find((c) => c.id === id) : null;
    const c = orig ? Object.assign({}, orig) : { id: 'c_' + U.uid(), name: '', icon: 'tag', color: U.PALETTE[S.cats.length % U.PALETTE.length], kind: 'expense', custom: true };
    const body = () => `<div class="row" style="margin-bottom:14px">${UI.catBubble(c)}<input class="inp grow" data-in="cfName" value="${U.esc(c.name)}" placeholder="Category name"></div>
      <div class="field"><span>Type</span>${UI.seg([['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Excluded']], c.kind, 'cfKind')}</div>
      <div class="list g flat" style="margin-bottom:14px"><div class="item"><div class="grow"><div class="t">Essential</div><div class="s">Needs like rent, groceries, insurance</div></div>${UI.toggle(c.essential, 'cfEss')}</div></div>
      <div class="field"><span>Icon</span><div class="icongrid">${CAT_ICONS.map((ic) => `<button class="${c.icon === ic ? 'on' : ''}" data-a="cfIcon" data-x="${ic}">${I(ic)}</button>`).join('')}</div></div>
      <div class="field"><span>Color</span><div class="swatches">${U.PALETTE.map((x) => `<button class="swatch ${c.color === x ? 'on' : ''}" style="background:${x}" data-a="cfColor" data-x="${x}"></button>`).join('')}</div></div>
      ${orig && orig.custom ? `<button class="btn block danger" data-a="cfDel">${I('trash-2')} Delete category</button>` : ''}`;
    UI.on('cfName', (v) => { c.name = v; });
    UI.on('cfKind', (k) => { c.kind = k; UI.renderSheet(); });
    UI.on('cfEss', () => { c.essential = !c.essential; UI.renderSheet(); });
    UI.on('cfIcon', (x) => { c.icon = x; UI.renderSheet(); });
    UI.on('cfColor', (x) => { c.color = x; UI.renderSheet(); });
    UI.on('cfSave', () => {
      if (!c.name.trim()) { UI.toast('Give it a name', 'info'); return; }
      c.name = c.name.trim();
      if (orig) Object.assign(orig, c); else S.cats.push(c);
      Store.commit({ silent: true }); UI.closeSheet(); App.render(); if (UI.sheets.length) UI.renderSheet();
      if (done) done(c.id);
    });
    UI.on('cfDel', async () => {
      if (!(await UI.confirm('Delete category?', 'Its transactions go back to automatic categorization and rules using it are removed.', 'Delete', true))) return;
      S.cats = S.cats.filter((x) => x.id !== c.id);
      S.rules = S.rules.filter((r) => r.cat !== c.id);
      for (const k in S.edits) if (S.edits[k].cat === c.id) Store.setEdit(k, { cat: null });
      Store.commit({ silent: true }); UI.closeAll(); App.render();
    });
    UI.sheet({ title: orig ? 'Edit category' : 'New category', body, foot: `<button class="btn primary block" data-a="cfSave">Save</button>` });
  };
  UI.on('catNew', () => App.editCategory(null));
  UI.on('catEdit', (id) => App.editCategory(id));

  /* ---------------- Rules ---------------- */
  App.pageDefs.rules = function () {
    const S = Store.S; const V = Store.V;
    let b = `<div class="g pad-s small muted">${I('sparkles', 'sm')} When you move a transaction to another category, Clearli offers to remember that merchant. If you recategorize the same merchant twice, it learns automatically. You can also add “contains” rules for any text.</div><div class="sp"></div>
      <button class="btn block primary" data-a="ruleNew">${I('plus')} New rule</button>`;
    const byM = S.rules.filter((r) => r.match === 'merchant'); const byC = S.rules.filter((r) => r.match !== 'merchant');
    const rrow = (r) => { const c = r.cat ? V.catMap[r.cat] : null; const n = V.list.filter((t) => (r.match === 'merchant' ? t.m === r.pattern && (!r.sign || (t.amt < 0 ? '-' : '+') === r.sign) : (t.desc + ' ' + t.name).toLowerCase().includes(r.pattern.toLowerCase()))).length; return `<div class="item tap" data-a="ruleEdit" data-x="${r.id}">${c ? UI.catBubble(c) : UI.bubble('pencil', '#8A93B8')}<div class="grow"><div class="t ell">${r.match === 'merchant' ? U.esc(E.titleCase(r.pattern)) : '“' + U.esc(r.pattern) + '”'}</div><div class="s ell">${c ? '→ ' + U.esc(c.name) : ''}${r.rename ? ' · shows as “' + U.esc(r.rename) + '”' : ''} · ${n} match${n === 1 ? '' : 'es'}${r.sign ? (r.sign === '-' ? ' · spending only' : ' · money in only') : ''}${r.learned ? ' · learned' : ''}${r.reviewed ? ' · from review' : ''}</div></div>${I('chevron-right')}</div>`; };
    if (byM.length) b += UI.sec('Merchant rules') + `<div class="list g">${byM.map(rrow).join('')}</div>`;
    if (byC.length) b += UI.sec('Text rules') + `<div class="list g">${byC.map(rrow).join('')}</div>`;
    if (!S.rules.length) b += `<div class="sp"></div><div class="g">${UI.empty('sparkles', 'No rules yet', 'They\'ll appear as you categorize.')}</div>`;
    return { title: 'Rules & learning', body: b };
  };
  const editRule = (id) => {
    const S = Store.S;
    const orig = id ? S.rules.find((r) => r.id === id) : null;
    const r = orig ? Object.assign({}, orig) : { id: U.uid(), match: 'contains', pattern: '', cat: '', rename: '', created: Date.now() };
    const body = () => {
      const c = r.cat ? Store.V.catMap[r.cat] : null;
      const matches = r.pattern ? Store.V.list.filter((t) => (r.match === 'merchant' ? t.m === r.pattern : (t.desc + ' ' + t.name).toLowerCase().includes(r.pattern.toLowerCase()))) : [];
      return `${r.match === 'merchant' ? `<div class="g pad-s small">Merchant: <b>${U.esc(E.titleCase(r.pattern))}</b></div><div class="sp"></div>` : `<label class="field"><span>When the description contains</span><input class="inp" data-in="rfPat" value="${U.esc(r.pattern)}" placeholder="e.g. COSTCO GAS"></label>`}
        <div class="list g flat"><div class="item tap" data-a="rfCat">${c ? UI.catBubble(c) : UI.bubble('tag', '#8A93B8')}<div class="grow"><div class="t">${c ? U.esc(c.name) : 'Choose category'}</div><div class="s">Set category to</div></div>${I('chevron-right')}</div></div><div class="sp"></div>
        <label class="field"><span>Rename to (optional)</span><input class="inp" data-in="rfRen" value="${U.esc(r.rename || '')}" placeholder="Friendly name"></label>
        <div class="small muted" style="margin:0 4px 10px">${matches.length} existing transactions match</div>
        ${matches.length ? `<div class="list g flat">${matches.slice(0, 5).map((t) => UI.txRow(t, { showDate: true })).join('')}</div>` : ''}
        ${orig ? `<div class="sp"></div><button class="btn block danger" data-a="rfDel">${I('trash-2')} Delete rule</button>` : ''}`;
    };
    UI.on('rfPat', U.debounce((v) => { r.pattern = v.trim(); const rec = UI.sheets[UI.sheets.length - 1]; UI.renderSheet(rec); const i = rec.el.querySelector('[data-in="rfPat"]'); i.focus(); i.setSelectionRange(v.length, v.length); }, 350));
    UI.on('rfRen', (v) => { r.rename = v.trim(); });
    UI.on('rfCat', () => App.pickCategory(r.cat, (id) => { r.cat = id; UI.renderSheet(); }));
    UI.on('rfSave', () => {
      if (!r.pattern) { UI.toast('Enter some text to match', 'info'); return; }
      if (!r.cat && !r.rename) { UI.toast('Choose a category or a new name', 'info'); return; }
      if (orig) Object.assign(orig, r); else S.rules.push(r);
      Store.commit({ silent: true }); UI.closeSheet(); App.render(); UI.toast('Rule saved', 'sparkles');
    });
    UI.on('rfDel', () => { S.rules = S.rules.filter((x) => x.id !== r.id); Store.commit({ silent: true }); UI.closeSheet(); App.render(); });
    UI.sheet({ title: orig ? 'Edit rule' : 'New rule', body, full: true, foot: `<button class="btn primary block" data-a="rfSave">Save rule</button>` });
  };
  UI.on('ruleNew', () => editRule(null));
  UI.on('ruleEdit', (id) => editRule(id));

  /* ---------------- Appearance ---------------- */
  const ACCENTS = ['#7C8CFF', '#FF6FB5', '#43D9B8', '#FFB547', '#5AC8FA', '#B78CFF', '#FF7A59', '#9BE15D'];
  App.pageDefs.appearance = function () {
    const st = Store.S.settings;
    const themes = [['glass-dark', 'Liquid Glass', 'Dark, colorful, translucent', ['#0B0D1A', '#4B53FF', '#FF3FA0']], ['glass-light', 'Liquid Glass Light', 'Frosted and bright', ['#E9EDF8', '#8C94FF', '#FF8CC6']], ['aurora', 'Aurora', 'Teal & violet glow', ['#07121A', '#00D4A6', '#7A5CFF']], ['midnight', 'Midnight OLED', 'True black, easy on battery', ['#000', '#3B3F9E', '#6B1F4F']]];
    let b = `<div class="grid2">${themes.map(([id, n, d, cols]) => `<button class="g pad-s tap" data-a="setTheme" data-x="${id}" style="text-align:left;${st.theme === id ? 'box-shadow:0 0 0 2px var(--accent),var(--shadow)' : ''}"><div style="height:64px;border-radius:14px;background:radial-gradient(circle at 25% 30%,${cols[1]},transparent 60%),radial-gradient(circle at 80% 70%,${cols[2]},transparent 55%),${cols[0]};margin-bottom:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)"></div><div class="b small">${n}</div><div class="tiny faint">${d}</div></button>`).join('')}</div>`;
    b += UI.sec('Accent') + `<div class="g pad"><div class="swatches">${ACCENTS.map((c) => `<button class="swatch ${st.accent === c ? 'on' : ''}" style="background:${c}" data-a="setAccent" data-x="${c}"></button>`).join('')}</div></div>`;
    b += UI.sec('Effects') + `<div class="list g"><div class="item"><div class="grow"><div class="t">Reduce effects</div><div class="s">Lighter blur, no motion — faster on older phones</div></div>${UI.toggle(st.reduceFx, 'setToggle', 'reduceFx')}</div></div>`;
    return { title: 'Appearance', body: b };
  };
  UI.on('setTheme', (x) => { Store.S.settings.theme = x; Store.save(); App.applyTheme(); App.render(); });
  UI.on('setAccent', (x) => { Store.S.settings.accent = x; Store.save(); App.applyTheme(); App.render(); });
  UI.on('setToggle', (k) => { Store.S.settings[k] = !Store.S.settings[k]; Store.save(); App.applyTheme(); App.render(); });

  /* ---------------- Privacy ---------------- */
  App.pageDefs.privacy = function () {
    const st = Store.S.settings; const secure = Store.N.sync('isDeviceSecure');
    let b = `<div class="list g">
      <div class="item"><div class="grow"><div class="t">App lock</div><div class="s">${secure ? 'Fingerprint, face or device PIN' : 'Set a screen lock in Android settings to enable'}</div></div>${secure ? UI.toggle(st.lock, 'setLock') : ''}</div>
      ${st.lock ? `<div class="item"><div class="grow"><div class="t">Lock after</div></div><select class="inp" style="width:140px;height:40px" data-ch="setLockAfter">${[[0, 'Immediately'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes'], [900, '15 minutes']].map(([v, l]) => `<option value="${v}" ${st.lockAfter === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      <div class="item"><div class="grow"><div class="t">Hide amounts</div><div class="s">Blur all balances until you tap the eye</div></div>${UI.toggle(st.hideAmounts, 'setToggle', 'hideAmounts')}</div>
      <div class="item"><div class="grow"><div class="t">Block screenshots</div><div class="s">Also blanks Clearli in recent apps</div></div>${UI.toggle(st.secureScreen !== false, 'setSecureScr')}</div>
    </div>`;
    b += UI.sec('How your data is protected') + `<div class="g pad">${[
      ['lock', 'AES-256-GCM encryption at rest, key held in Android Keystore (hardware-backed on most phones).'],
      ['eye-off', 'No Clearli servers, analytics, ads or crash reporting. Nothing is sent anywhere except requests to your SimpleFIN access URL.'],
      ['shield-check', 'The interface runs with network access disabled; only the native layer talks to SimpleFIN over HTTPS.'],
      ['landmark', 'SimpleFIN access is read-only — it can\'t move money. Revoke it anytime in SimpleFIN Bridge.'],
      ['download', 'Android cloud backup is disabled so your data isn\'t copied off the device. Use “Back up everything” if you want your own copy.'],
    ].map(([ic, t]) => `<div class="feat" style="padding:8px 0">${I(ic)}<div class="small muted">${t}</div></div>`).join('')}</div>`;
    return { title: 'Privacy & security', body: b };
  };
  UI.on('setLock', async () => {
    const st = Store.S.settings;
    if (!st.lock) { const r = await Store.N.call('requestUnlock'); if (!r.ok) return; }
    st.lock = !st.lock; Store.save(); App.render();
  });
  UI.on('setLockAfter', (v) => { Store.S.settings.lockAfter = Number(v); Store.save(); });
  UI.on('setSecureScr', () => { const st = Store.S.settings; st.secureScreen = st.secureScreen === false; Store.save(); App.applyTheme(); App.render(); });

  /* ---------------- General ---------------- */
  App.pageDefs.general = function () {
    const st = Store.S.settings;
    const cur = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR', 'AED', 'SAR', 'JPY', 'CHF', 'MXN'];
    let b = `<div class="list g">
      <div class="item"><div class="grow"><div class="t">Currency</div><div class="s">Display format for amounts</div></div><select class="inp" style="width:110px;height:40px" data-ch="setCur">${cur.map((c) => `<option ${st.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="item"><div class="grow"><div class="t">Week starts on</div></div><select class="inp" style="width:130px;height:40px" data-ch="setWs">${[0, 1, 6].map((d) => `<option value="${d}" ${st.weekStart === d ? 'selected' : ''}>${U.DOW[d]}</option>`).join('')}</select></div>
      <div class="item"><div class="grow"><div class="t">Savings APY assumption</div><div class="s">Used for idle-cash and goal interest estimates</div></div><input class="inp" type="number" step="0.1" style="width:90px;height:40px" data-ch="setApy" value="${st.apy}"></div>
    </div>`;
    return { title: 'General', body: b };
  };
  UI.on('setCur', (v) => { Store.S.settings.currency = v; U.currency = v; Store.save(); App.render(); });
  UI.on('setWs', (v) => { Store.S.settings.weekStart = Number(v); Store.save(); App.render(); });
  UI.on('setApy', (v) => { Store.S.settings.apy = parseFloat(v) || 0; App._mv = null; Store.save(); });

  /* ---------------- Data ---------------- */
  UI.on('exportCsv', async () => {
    const list = App.list({ includeExcluded: true });
    const r = await Store.N.call('exportFile', `clearli-transactions-${U.dayKey(new Date())}.csv`, 'text/csv', Store.csv(list));
    if (r.ok) UI.toast(`Exported ${list.length} transactions`, 'check'); else if (r.error !== 'cancelled') UI.toast(r.error, 'alert-triangle');
  });
  UI.on('backup', async () => {
    const ok = await UI.confirm('Create backup file?', 'The backup contains your full transaction history in readable form. Store it somewhere private. Your SimpleFIN key is NOT included.', 'Create');
    if (!ok) return;
    const r = await Store.N.call('exportFile', `clearli-backup-${U.dayKey(new Date())}.json`, 'application/json', Store.backup());
    if (r.ok) UI.toast('Backup saved', 'check'); else if (r.error !== 'cancelled') UI.toast(r.error, 'alert-triangle');
  });
  UI.on('restore', async () => {
    if (!(await UI.confirm('Restore from backup?', 'This replaces everything currently in Clearli with the backup contents.', 'Choose file', true))) return;
    const r = await Store.N.call('importFile');
    if (!r.ok) { if (r.error !== 'cancelled') UI.toast(r.error, 'alert-triangle'); return; }
    try { Store.restore(r.content); App.applyTheme(); App.go('home'); UI.toast('Restored', 'check'); } catch (e) { UI.toast(e.message, 'alert-triangle'); }
  });
  UI.on('wipe', async () => {
    if (!(await UI.confirm('Erase everything?', 'All transactions, edits, rules, goals and the SimpleFIN key will be permanently deleted from this phone, and the encryption key destroyed.', 'Erase', true))) return;
    Store.resetAll(); UI.closeAll(); App.pages = []; App.tab = 'home'; App.applyTheme(); App.restartOnboarding();
  });

  /* ---------------- Roadmap / About ---------------- */
  App.pageDefs.roadmap = function () {
    const items = [
      ['layers', '#7C8CFF', 'Web dashboard with sync', 'A bigger-screen view of the same data. Planned as end-to-end encrypted sync so the server only ever stores ciphertext.'],
      ['sparkles', '#FF6FB5', 'On-device AI analyst', 'A small local model to explain spending in plain language, answer questions and predict upcoming months — no data leaves the phone.'],
      ['building-2', '#43D9B8', 'Small business mode', 'Separate business entities, branches/locations, tax categories, P&L and cash-flow reports.'],
      ['receipt', '#FFB547', 'Receipts & splits', 'Attach photos, split a purchase across categories or people.'],
      ['calendar-clock', '#5AC8FA', 'Bill reminders', 'Local notifications before recurring charges hit.'],
    ];
    return { title: 'What\'s next', body: items.map(([ic, c, t, d]) => `<div class="g pad-s" style="margin-bottom:10px"><div class="row" style="align-items:flex-start">${UI.bubble(ic, c)}<div class="grow"><div class="h3">${t}</div><div class="small muted" style="margin-top:3px">${d}</div></div></div></div>`).join('') };
  };
  App.pageDefs.about = function () {
    return { title: 'About', body: `<div class="center" style="padding:10px 0 20px"><div class="logo"><img src="icon.png" alt=""></div><div class="h2">Clearli</div><div class="small muted">Version ${U.esc(Store.N.sync('version') || '1.0')}</div></div>
      <div class="g pad small muted">Clearli is a private, on-device personal finance app. Bank data is provided by SimpleFIN Bridge (simplefin.org), a read-only aggregation service you subscribe to directly. Clearli is not a bank, and insights are estimates for education only — not financial, tax or legal advice.</div>
      <div class="sp"></div><div class="g pad small muted">Open-source components: Chart.js (MIT), Lucide icons (ISC), Inter typeface (OFL).</div>` };
  };
})();

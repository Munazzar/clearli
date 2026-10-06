/* Clearli — import bank files (CSV / OFX / QFX) with full options, preview, progress, dedupe and undo */
(function () {
  const I = U.icon;
  const DAY = U.DAY;
  const IMP = {};

  /* ---------------- parsing ---------------- */
  IMP.parseCSV = function (text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/).slice(0, 10).join('\n');
    const count = (ch) => (first.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
    const delim = [',', ';', '\t', '|'].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
  };
  const looksDate = (s) => /^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$/.test(s) || /^\d{8}$/.test(s);
  const looksNum = (s) => /^[-+(]?\s*\$?\s*[\d,]*\.?\d+\)?\s*(CR|DR)?$/i.test(s.replace(/\s/g, ''));

  IMP.detect = function (rows) {
    let h = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const hits = rows[i].filter((c) => /date|description|amount|debit|credit|payee|memo|details|transaction|posted/i.test(c)).length;
      if (hits >= 2) { h = i; break; }
    }
    let headers, body;
    if (h >= 0) { headers = rows[h].map((x) => x.replace(/\s+/g, ' ')); body = rows.slice(h + 1); }
    else {
      // headerless (e.g. Wells Fargo: date, amount, *, check#, description)
      const n = Math.max(...rows.slice(0, 5).map((r) => r.length));
      headers = Array.from({ length: n }, (_, i) => 'Column ' + (i + 1));
      body = rows;
    }
    const L = headers.map((x) => x.toLowerCase());
    const find = (...res) => { for (const re of res) { const i = L.findIndex((x) => re.test(x)); if (i >= 0) return i; } return -1; };
    const map = {
      date: find(/^transaction date$|^trans\.? date$/, /^date$/, /posting date|post date|posted date|^date/, /date/),
      desc: find(/^description$/, /payee|merchant|^name$/, /description/, /memo/),
      amount: find(/^amount$/, /amount/),
      debit: find(/^debit$|withdrawal|money out|^debit amount/),
      credit: find(/^credit$|deposit|money in|^credit amount/),
      cat: find(/category/),
      type: find(/^type$|transaction type/),
      memo: find(/^memo$|extended details|reference/),
      balance: find(/balance|running bal/),
    };
    if (h < 0) {
      // guess columns by content
      const sample = body.slice(0, 20);
      const colIs = (i, fn) => sample.filter((r) => r[i] != null && fn(r[i])).length >= sample.length * 0.8;
      map.date = headers.findIndex((_, i) => colIs(i, looksDate));
      map.amount = headers.findIndex((_, i) => i !== map.date && colIs(i, looksNum));
      let best = -1, bl = 0;
      headers.forEach((_, i) => { if (i === map.date || i === map.amount) return; const l = U.mean(sample.map((r) => (r[i] || '').length)); if (l > bl) { bl = l; best = i; } });
      map.desc = best;
    }
    if (map.desc === map.date) map.desc = -1;
    // bank presets
    const has = (re) => L.some((x) => re.test(x));
    let preset = 'Generic CSV';
    if (has(/^transaction date$/) && has(/^post date$/) && has(/^category$/) && has(/^type$/)) preset = 'Chase credit card';
    else if (has(/^details$/) && has(/^posting date$/) && has(/^balance$/)) preset = 'Chase checking / savings';
    else if (has(/card member|extended details|^account #$/)) preset = 'American Express';
    else if (has(/^trans\. date$/) && has(/^post date$/)) preset = 'Discover';
    else if (has(/^card no\.?$/) && has(/^debit$/)) preset = 'Capital One';
    else if (has(/^status$/) && has(/^debit$/) && has(/^credit$/)) preset = 'Citi';
    else if (has(/running bal/)) preset = 'Bank of America';
    else if (h < 0) preset = 'No header (e.g. Wells Fargo)';
    return { headers, body, map, preset, headerRow: h };
  };

  IMP.parseDate = function (s, fmt) {
    s = String(s || '').trim().split(/[ T]/)[0];
    if (!s) return null;
    let y, m, d;
    if (/^\d{8}/.test(s)) { y = +s.slice(0, 4); m = +s.slice(4, 6); d = +s.slice(6, 8); }
    else {
      const p = s.split(/[\/\-.]/).map(Number);
      if (p.length !== 3 || p.some(isNaN)) return null;
      if (fmt === 'YMD' || p[0] > 999) { [y, m, d] = p; }
      else if (fmt === 'DMY') { [d, m, y] = p; }
      else { [m, d, y] = p; }
      if (y < 100) y += 2000;
    }
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    return +new Date(y, m - 1, d, 12);
  };
  IMP.guessDateFmt = function (vals) {
    let dmy = 0, mdy = 0, ymd = 0;
    for (const s of vals.slice(0, 200)) {
      const p = String(s).split(/[\/\-.]/).map(Number);
      if (p.length !== 3) continue;
      if (p[0] > 999) ymd++; else if (p[0] > 12) dmy++; else if (p[1] > 12) mdy++;
    }
    return ymd ? 'YMD' : dmy > mdy ? 'DMY' : 'MDY';
  };
  IMP.parseAmt = function (s) {
    if (s == null) return NaN;
    let t = String(s).trim(); if (!t) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (/DR$/i.test(t)) { neg = true; t = t.replace(/DR$/i, ''); }
    t = t.replace(/CR$/i, '').replace(/[$€£₹\s,]/g, '');
    if (/^-/.test(t)) { neg = !neg; t = t.slice(1); }
    if (/^\+/.test(t)) t = t.slice(1);
    const v = parseFloat(t);
    return isNaN(v) ? NaN : neg ? -v : v;
  };

  IMP.parseOFX = function (text) {
    const tag = (blk, name) => { const m = blk.match(new RegExp('<' + name + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
    const rows = [];
    const parts = text.split(/<STMTTRN>/i).slice(1);
    for (const p0 of parts) {
      const p = p0.split(/<\/STMTTRN>/i)[0];
      const dt = tag(p, 'DTPOSTED') || tag(p, 'DTUSER');
      const date = IMP.parseDate(dt.slice(0, 8), 'YMD');
      const amt = IMP.parseAmt(tag(p, 'TRNAMT'));
      if (!date || isNaN(amt)) continue;
      const name = tag(p, 'NAME'); const memo = tag(p, 'MEMO');
      rows.push({ date, amt, desc: (name || memo || 'Transaction').replace(/&amp;/g, '&'), memo: name && memo && memo !== name ? memo : '', type: tag(p, 'TRNTYPE'), fitid: tag(p, 'FITID') });
    }
    const bal = IMP.parseAmt(tag((text.match(/<LEDGERBAL>[\s\S]*?(<\/LEDGERBAL>|<AVAILBAL>|$)/i) || [''])[0], 'BALAMT'));
    return { rows, acctId: tag(text, 'ACCTID'), org: tag(text, 'ORG'), balance: isNaN(bal) ? null : bal, isCard: /<CCSTMTRS>/i.test(text) };
  };

  const CHASE_CATS = { 'food & drink': 'dining', groceries: 'groceries', gas: 'gas', shopping: 'shopping', travel: 'travel', entertainment: 'entertainment', 'bills & utilities': 'utilities', 'health & wellness': 'health', personal: 'personal', home: 'home', automotive: 'auto', education: 'education', 'gifts & donations': 'gifts', 'fees & adjustments': 'fees', 'professional services': 'other', 'merchandise': 'shopping', restaurants: 'dining', 'restaurant': 'dining', supermarkets: 'groceries', 'gasoline': 'gas', 'services': 'other', 'medical services': 'health', 'airfare': 'travel', 'lodging': 'travel', 'car rental': 'travel', 'phone/cable': 'phone', 'insurance': 'insurance' };
  IMP.bankCat = (s) => { if (!s) return null; const k = s.toLowerCase().trim(); if (CHASE_CATS[k]) return CHASE_CATS[k]; for (const key in CHASE_CATS) if (k.includes(key)) return CHASE_CATS[key]; return null; };
  const isPayment = (r) => /^payment$|^pmt$|^ach_credit$/i.test(r.type || '') && r.amt > 0 && /payment|thank you|autopay|epay/i.test(r.desc) || /payment\s*-?\s*thank you|autopay payment|^online payment/i.test(r.desc);

  // Build normalized rows from parsed file + options
  IMP.build = function (P, o) {
    if (P.kind === 'ofx') return P.ofx.rows.map((r) => ({ ...r, amt: o.flip ? -r.amt : r.amt }));
    const out = [];
    const m = o.map;
    for (const r of P.csv.body) {
      const date = IMP.parseDate(r[m.date], o.dateFmt);
      if (!date) continue;
      let amt;
      if (o.amountMode === 'split') { const d = IMP.parseAmt(r[m.debit]); const c = IMP.parseAmt(r[m.credit]); amt = (isNaN(c) ? 0 : Math.abs(c)) - (isNaN(d) ? 0 : Math.abs(d)); if (isNaN(d) && isNaN(c)) continue; }
      else { amt = IMP.parseAmt(r[m.amount]); if (isNaN(amt)) continue; }
      if (o.flip) amt = -amt;
      const desc = (m.desc >= 0 ? r[m.desc] : '') || (m.memo >= 0 ? r[m.memo] : '') || 'Transaction';
      out.push({ date, amt: Math.round(amt * 100) / 100, desc, memo: m.memo >= 0 && m.memo !== m.desc ? r[m.memo] || '' : '', type: m.type >= 0 ? r[m.type] : '', cat: m.cat >= 0 ? r[m.cat] : '', balance: m.balance >= 0 ? IMP.parseAmt(r[m.balance]) : NaN });
    }
    return out;
  };

  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  // Classify every row: import / duplicate / out of range — no state changes
  IMP.plan = function (rows, o) {
    const S = Store.S;
    const acct = o.acct === 'new' ? null : o.acct;
    const existing = acct ? Object.values(S.txns).filter((t) => t.acct === acct) : [];
    const synced = existing.filter((t) => !t.imp);
    const cutoff = synced.length ? Math.min(...synced.map((t) => t.ts)) : null;
    const byCents = new Map();
    for (const t of existing) { const c = Math.round(t.amt * 100); if (!byCents.has(c)) byCents.set(c, []); byCents.get(c).push(t); }
    const used = new Set(); const seen = {};
    let from = o.from ? +U.parseInputDate(o.from) : -Infinity; let to = o.to ? +U.parseInputDate(o.to) + DAY : Infinity;
    if (o.range === 'before' && cutoff) to = Math.min(to, +U.sod(cutoff));
    if (o.range === 'all') { from = -Infinity; to = Infinity; }
    return rows.map((r) => {
      const base = U.dayKey(r.date) + ':' + Math.round(r.amt * 100) + ':' + hash(r.desc.toUpperCase());
      seen[base] = (seen[base] || 0) + 1;
      const key = (acct || 'NEW') + ':imp:' + (r.fitid ? 'f' + hash(r.fitid) : base + ':' + seen[base]);
      let status = 'new';
      if (r.date < from || r.date >= to) status = 'range';
      else if (acct && S.txns[key]) status = 'dup';
      else if (o.dupes === 'skip' && acct) {
        const cands = byCents.get(Math.round(r.amt * 100)) || [];
        const hit = cands.find((t) => !used.has(t) && Math.abs(t.ts - r.date) <= 4 * DAY);
        if (hit) { used.add(hit); status = 'dup'; }
      }
      return { r, key, status };
    });
  };

  /* ---------------- UI ---------------- */
  App.startImport = async function () {
    const f = await Store.N.call('importFile');
    if (!f.ok) { if (f.error !== 'cancelled') UI.toast(f.error, 'alert-triangle'); return; }
    const text = f.content || '';
    let P;
    try {
      if (/<OFX>|OFXHEADER|<STMTTRN>/i.test(text.slice(0, 5000)) || /<STMTTRN>/i.test(text)) {
        const ofx = IMP.parseOFX(text);
        if (!ofx.rows.length) throw new Error('No transactions found in this OFX/QFX file.');
        P = { kind: 'ofx', ofx, preset: 'OFX / QFX' + (ofx.org ? ' · ' + ofx.org : '') };
      } else {
        const rows = IMP.parseCSV(text);
        if (rows.length < 2) throw new Error('This file has no rows. Is it a CSV, OFX or QFX export?');
        const csv = IMP.detect(rows);
        P = { kind: 'csv', csv, preset: csv.preset };
      }
    } catch (e) { UI.toast(e.message || 'Could not read this file', 'alert-triangle'); return; }
    App.importOptions(P);
  };

  App.importOptions = function (P) {
    const S = Store.S; const V = Store.V;
    const accts = Object.values(S.accounts).filter((a) => !a.hidden);
    const o = {
      acct: accts.length === 1 ? accts[0].id : '', newName: '', newBank: P.kind === 'ofx' ? P.ofx.org : P.preset.split(' ')[0] === 'Generic' ? '' : P.preset.split(' ')[0], newType: 'credit', newNet: false,
      map: P.kind === 'csv' ? Object.assign({}, P.csv.map) : null, amountMode: 'single', dateFmt: 'MDY', flip: false,
      range: 'before', from: '', to: '', dupes: 'skip', bankCats: true, payments: true,
    };
    if (P.kind === 'csv') {
      const m = o.map;
      if (m.amount < 0 && m.debit >= 0 && m.credit >= 0) o.amountMode = 'split';
      if (/chase checking/i.test(P.preset)) o.newType = 'checking';
      o.dateFmt = IMP.guessDateFmt(P.csv.body.map((r) => r[m.date]));
    }
    // auto-detect sign: most rows on a statement are spending; if most are positive, amounts are reversed
    const pre = IMP.build(P, o);
    const pos = pre.filter((r) => r.amt > 0 && !isPayment(r)).length;
    if (pre.length >= 5 && pos / pre.length > 0.7) o.flip = true;
    if (/american express|discover/i.test(P.preset)) o.flip = true;
    if (P.kind === 'ofx' && P.ofx.isCard) o.newType = 'credit';

    const known = new Set(V.list.filter((t) => ['manual', 'rule', 'learned'].includes(t.catSrc)).map((t) => t.m));
    const body = () => {
      const rows = IMP.build(P, o);
      const plan = IMP.plan(rows, o);
      const nNew = plan.filter((x) => x.status === 'new').length; const nDup = plan.filter((x) => x.status === 'dup').length; const nRange = plan.filter((x) => x.status === 'range').length;
      const newRows = plan.filter((x) => x.status === 'new');
      const kn = newRows.filter((x) => known.has(E.merchantKey(x.r.desc))).length;
      const span = rows.length ? [Math.min(...rows.map((r) => r.date)), Math.max(...rows.map((r) => r.date))] : null;
      const acct = S.accounts[o.acct];
      const syncedMin = o.acct && o.acct !== 'new' ? Object.values(S.txns).filter((t) => t.acct === o.acct && !t.imp).reduce((m, t) => Math.min(m, t.ts), Infinity) : Infinity;
      const H = P.kind === 'csv' ? P.csv.headers : [];
      const colSel = (key, label, optional) => `<label class="field" style="margin-bottom:8px"><span>${label}</span><select class="inp" style="height:44px" data-ch="imCol" data-x="${key}">${optional ? '<option value="-1">— none —</option>' : ''}${H.map((hh, i) => `<option value="${i}" ${o.map[key] === i ? 'selected' : ''}>${U.esc(hh)}${P.csv.body[0] && P.csv.body[0][i] ? ' · e.g. ' + U.esc(String(P.csv.body[0][i]).slice(0, 22)) : ''}</option>`).join('')}</select></label>`;
      let h = `<div class="g pad-s row">${UI.bubble('file-text', '#7C8CFF')}<div class="grow"><div class="b">${U.esc(P.preset)}</div><div class="small muted">${U.num(rows.length)} transactions${span ? ' · ' + U.fmtDate(span[0], { year: true }) + ' – ' + U.fmtDate(span[1], { year: true }) : ''}</div></div></div>`;

      // 1. account
      h += UI.sec('1 · Which account is this?');
      h += `<div class="list g flat">${accts.map((a) => `<div class="item tap" data-a="imAcct" data-x="${U.esc(a.id)}"><div class="grow"><div class="t ell">${U.esc(a.alias || a.name)}</div><div class="s">${U.esc((S.conns[a.conn] || {}).name || '')} · ${a.type}</div></div><div class="check ${o.acct === a.id ? 'on' : ''}">${o.acct === a.id ? I('check') : ''}</div></div>`).join('')}
        <div class="item tap" data-a="imAcct" data-x="new">${UI.bubble('plus', '#43D9B8', true)}<div class="grow t">New account (e.g. a closed card)</div><div class="check ${o.acct === 'new' ? 'on' : ''}">${o.acct === 'new' ? I('check') : ''}</div></div></div>`;
      if (o.acct === 'new') {
        h += `<div class="sp"></div><div class="grid2"><label class="field"><span>Account name</span><input class="inp" data-ch="imNew" data-x="newName" value="${U.esc(o.newName)}" placeholder="Freedom ••1234"></label><label class="field"><span>Bank</span><input class="inp" data-ch="imNew" data-x="newBank" value="${U.esc(o.newBank)}" placeholder="Chase"></label></div>
          <div class="chips wrap">${['checking', 'savings', 'credit', 'loan', 'other'].map((t) => `<button class="chip ${o.newType === t ? 'on' : ''}" data-a="imNewType" data-x="${t}">${t}</button>`).join('')}</div>
          <div class="list g flat" style="margin-top:8px"><div class="item"><div class="grow"><div class="t">Include in net worth</div><div class="s">Off for closed or historical accounts</div></div>${UI.toggle(o.newNet, 'imTog', 'newNet')}</div></div>`;
      }

      // 2. columns
      if (P.kind === 'csv') {
        h += UI.sec('2 · Columns') + `<div class="g pad-s">${colSel('date', 'Date')}${colSel('desc', 'Description')}
          <div class="field" style="margin-bottom:8px"><span>Amounts are in</span>${UI.seg([['single', 'One column'], ['split', 'Debit & credit columns']], o.amountMode, 'imAmtMode')}</div>
          ${o.amountMode === 'single' ? colSel('amount', 'Amount') : colSel('debit', 'Debit / money out') + colSel('credit', 'Credit / money in')}
          ${colSel('cat', 'Bank category', true)}${colSel('type', 'Type', true)}${colSel('memo', 'Memo / details', true)}${colSel('balance', 'Balance', true)}</div>`;
      }

      // 3. format
      h += UI.sec((P.kind === 'csv' ? '3' : '2') + ' · Format');
      if (P.kind === 'csv') h += `<div class="field"><span>Date format</span>${UI.seg([['MDY', 'MM/DD/YYYY'], ['DMY', 'DD/MM/YYYY'], ['YMD', 'YYYY-MM-DD']], o.dateFmt, 'imDate')}</div>`;
      h += `<div class="field"><span>Money out is shown as</span>${UI.seg([['0', 'Negative −'], ['1', 'Positive +']], o.flip ? '1' : '0', 'imFlip')}</div>`;

      // 4. what to import
      const n = P.kind === 'csv' ? 4 : 3;
      h += UI.sec(n + ' · What to import');
      h += `<div class="field"><span>Dates</span>${UI.seg([['before', 'Older than synced'], ['all', 'Everything'], ['custom', 'Custom']], o.range, 'imRange')}</div>
        ${o.range === 'before' ? `<div class="tiny faint" style="margin:-6px 4px 10px">${isFinite(syncedMin) ? 'Only rows before ' + U.fmtDate(syncedMin, { year: true }) + ', where SimpleFIN data starts.' : 'No synced data for this account yet — everything is imported.'}</div>` : ''}
        ${o.range === 'custom' ? `<div class="grid2" style="margin-bottom:10px"><input type="date" class="inp" data-ch="imFrom" value="${o.from}"><input type="date" class="inp" data-ch="imTo" value="${o.to}"></div>` : ''}
        <div class="field"><span>Duplicates</span>${UI.seg([['skip', 'Skip matches'], ['keep', 'Import all']], o.dupes, 'imDupes')}</div>
        <div class="list g flat">
          <div class="item"><div class="grow"><div class="t">Use my categories & rules</div><div class="s">${kn ? `${U.num(kn)} of these match merchants you've already categorized` : 'Your rules and past choices apply automatically'}</div></div><span class="badge pos">${I('check')} always</span></div>
          <div class="item"><div class="grow"><div class="t">Use bank's categories when unsure</div><div class="s">Only for merchants Clearli doesn't recognize</div></div>${UI.toggle(o.bankCats, 'imTog', 'bankCats')}</div>
          <div class="item"><div class="grow"><div class="t">Card payments are transfers</div><div class="s">"Payment Thank You" won't count as income</div></div>${UI.toggle(o.payments, 'imTog', 'payments')}</div>
        </div>`;

      // preview
      h += UI.sec('Preview');
      h += `<div class="grid3"><div class="g kpi"><div class="tiny faint">Will import</div><div class="v pos" style="font-size:18px">${U.num(nNew)}</div></div><div class="g kpi"><div class="tiny faint">Duplicates</div><div class="v" style="font-size:18px">${U.num(nDup)}</div></div><div class="g kpi"><div class="tiny faint">Out of range</div><div class="v" style="font-size:18px">${U.num(nRange)}</div></div></div>`;
      h += `<div class="list g flat" style="margin-top:10px">${newRows.slice(0, 6).map(({ r }) => `<div class="item"><div class="grow"><div class="t ell" style="font-size:14px">${U.esc(E.titleCase(E.merchantKey(r.desc)))}</div><div class="s ell">${U.fmtDate(r.date, { year: true })} · ${U.esc(r.desc)}</div></div><div class="r b">${U.amt(r.amt, { color: true })}</div></div>`).join('') || '<div class="item small muted">Nothing new to import with these options.</div>'}</div>`;
      if (!o.acct) h += `<div class="small warn" style="margin:10px 4px">${I('info', 'sm')} Choose an account above.</div>`;
      return h;
    };
    const re = () => UI.renderSheet();
    UI.on('imAcct', (x) => { o.acct = x; re(); });
    UI.on('imNew', (v, el) => { o[el.dataset.x] = v; });
    UI.on('imNewType', (x) => { o.newType = x; re(); });
    UI.on('imTog', (k) => { o[k] = !o[k]; re(); });
    UI.on('imCol', (v, el) => { o.map[el.dataset.x] = Number(v); re(); });
    UI.on('imAmtMode', (x) => { o.amountMode = x; re(); });
    UI.on('imDate', (x) => { o.dateFmt = x; re(); });
    UI.on('imFlip', (x) => { o.flip = x === '1'; re(); });
    UI.on('imRange', (x) => { o.range = x; re(); });
    UI.on('imFrom', (v) => { o.from = v; re(); });
    UI.on('imTo', (v) => { o.to = v; re(); });
    UI.on('imDupes', (x) => { o.dupes = x; re(); });
    UI.on('imGo', () => {
      if (!o.acct) return UI.toast('Choose which account this file is for', 'info');
      if (o.acct === 'new' && !o.newName.trim()) return UI.toast('Name the new account', 'info');
      if (o.acct !== 'new' && !IMP.plan(IMP.build(P, o), o).some((x) => x.status === 'new')) return UI.toast('Nothing new to import — try "Everything" under Dates', 'info');
      App.runImport(P, o);
    });
    UI.sheet({ title: 'Import transactions', body, full: true, foot: `<button class="btn grow" data-a="closeSheet">Cancel</button><button class="btn primary grow" data-a="imGo">${I('upload')} Import</button>` });
  };

  App.runImport = async function (P, o) {
    const S = Store.S;
    let acctId = o.acct;
    const rows = IMP.build(P, o);
    // progress sheet
    UI.closeSheet();
    const rec = UI.sheet({ title: 'Importing…', body: `<div style="padding:10px 0 20px"><div class="row between small" style="margin-bottom:10px"><span id="imStage" class="muted">Reading file</span><span id="imPct" class="b">0%</span></div><div class="bar" style="height:12px"><i id="imBar" style="width:0%"></i></div><div class="small faint" id="imCount" style="margin-top:10px"></div></div>` });
    const set = (pct, stage, count) => {
      const b = rec.el.querySelector('#imBar'); if (b) b.style.width = Math.round(pct * 100) + '%';
      const p = rec.el.querySelector('#imPct'); if (p) p.textContent = Math.round(pct * 100) + '%';
      if (stage) { const s = rec.el.querySelector('#imStage'); if (s) s.textContent = stage; }
      if (count) { const c = rec.el.querySelector('#imCount'); if (c) c.textContent = count; }
    };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    await tick(); set(0.05, 'Checking for duplicates');
    if (acctId === 'new') {
      const bank = (o.newBank || 'Imported').trim();
      const connId = 'man_' + bank.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      S.conns[connId] = S.conns[connId] || { id: connId, name: bank, url: '', manual: true };
      acctId = 'man_' + U.uid();
      const withBal = rows.filter((r) => !isNaN(r.balance)).sort((a, b) => b.date - a.date);
      S.accounts[acctId] = { id: acctId, name: o.newName.trim(), conn: connId, type: o.newType, currency: 'USD', balance: withBal.length ? withBal[0].balance : (P.kind === 'ofx' && P.ofx.balance != null ? P.ofx.balance : 0), balanceDate: Date.now(), manual: true, excludeTotals: !o.newNet };
    }
    const plan = IMP.plan(rows, Object.assign({}, o, { acct: acctId }));
    const todo = plan.filter((x) => x.status === 'new');
    const batch = 'imp_' + U.uid();
    const CH = 300;
    for (let i = 0; i < todo.length; i += CH) {
      for (const { r, key } of todo.slice(i, i + CH)) {
        const k = key.replace(/^NEW:/, acctId + ':');
        const t = { id: k.split(':').slice(1).join(':'), acct: acctId, ts: r.date, posted: r.date, amt: r.amt, desc: r.desc, payee: '', memo: r.memo || '', pending: false, imp: batch };
        if (o.bankCats && r.cat) { const bc = IMP.bankCat(r.cat); if (bc) t.bankCat = bc; }
        if (o.payments && isPayment(r)) t.bankCat = 'transfer';
        S.txns[k] = t;
      }
      set(0.1 + 0.8 * Math.min(1, (i + CH) / Math.max(1, todo.length)), 'Adding transactions', `${U.num(Math.min(todo.length, i + CH))} of ${U.num(todo.length)}`);
      await tick();
    }
    set(0.92, 'Applying your categories');
    await tick();
    S.imports = S.imports || [];
    S.imports.unshift({ id: batch, at: Date.now(), acct: acctId, n: todo.length, dup: plan.filter((x) => x.status === 'dup').length, skipped: plan.filter((x) => x.status === 'range').length, from: todo.length ? Math.min(...todo.map((x) => x.r.date)) : null, to: todo.length ? Math.max(...todo.map((x) => x.r.date)) : null, preset: P.preset });
    S.syncLog.unshift({ at: Date.now(), ok: true, msg: `Imported ${todo.length} transactions from ${P.preset}` });
    Store.commit({ silent: true }); Store.saveNow();
    set(1, 'Done');
    const imp = Store.V.list.filter((t) => t.imp === batch);
    const learned = imp.filter((t) => ['rule', 'learned', 'manual'].includes(t.catSrc)).length;
    const ir = S.imports[0];
    rec.o.title = 'Import complete';
    rec.el.querySelector('.hd .h2').textContent = 'Import complete';
    rec.el.querySelector('.bd').innerHTML = `<div class="center" style="padding:6px 0 10px">${UI.bubble('check', '#3DDC97').replace('class="bubble', 'style="margin:0 auto 10px;width:56px;height:56px" class="bubble')}<div class="mid">${U.num(ir.n)} imported</div>
      <div class="small muted" style="margin-top:6px">${ir.from ? U.fmtDate(ir.from, { year: true }) + ' – ' + U.fmtDate(ir.to, { year: true }) : ''}</div></div>
      <div class="list g flat"><div class="item"><div class="grow">Categorized from your rules & past choices</div><div class="b">${U.num(learned)}</div></div><div class="item"><div class="grow">Duplicates skipped</div><div class="b">${U.num(ir.dup)}</div></div><div class="item"><div class="grow">Outside date range</div><div class="b">${U.num(ir.skipped)}</div></div></div>
      <div class="sp"></div><div class="grid2"><button class="btn" data-a="impUndo" data-x="${batch}">${I('undo-2')} Undo</button><button class="btn primary" data-a="impDone">Done</button></div>`;
    App.render();
  };
  UI.on('impDone', () => { UI.closeAll(); App.render(); });
  UI.on('impUndo', async (id) => {
    if (!(await UI.confirm('Undo this import?', 'Removes every transaction added by this import. Your categories and rules stay.', 'Undo import', true))) return;
    App.undoImport(id); UI.closeAll(); App.render(); UI.toast('Import removed', 'undo-2');
  });
  App.undoImport = function (id) {
    const S = Store.S;
    const ir = (S.imports || []).find((x) => x.id === id);
    for (const k in S.txns) if (S.txns[k].imp === id) { delete S.txns[k]; delete S.edits[k]; }
    S.imports = (S.imports || []).filter((x) => x.id !== id);
    if (ir && S.accounts[ir.acct] && S.accounts[ir.acct].manual && !Object.values(S.txns).some((t) => t.acct === ir.acct)) delete S.accounts[ir.acct];
    Store.commit({ silent: true });
  };
  UI.on('importFile', () => App.startImport());
  App.importsHtml = function () {
    const S = Store.S; const L = S.imports || [];
    if (!L.length) return '';
    return UI.sec('Imported files') + `<div class="list g">${L.map((x) => { const a = S.accounts[x.acct] || {}; return `<div class="item"><div class="grow"><div class="t" style="font-size:14px">${U.num(x.n)} from ${U.esc(x.preset)}</div><div class="s">${U.esc(a.alias || a.name || 'account')} · ${x.from ? U.fmtDate(x.from, { year: true }) + ' – ' + U.fmtDate(x.to, { year: true }) : ''} · ${U.fmtDate(x.at)}</div></div><button class="btn sm" data-a="impUndo" data-x="${x.id}">${I('undo-2', 'sm')}</button></div>`; }).join('')}</div>`;
  };

  window.IMP = IMP;
})();

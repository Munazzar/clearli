// Hidden mode: no money visible outside blurred elements, on every main screen
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  // two bills from one company with different amounts -> tagged names
  await p.evaluate(() => { const S = Store.S; const acct = Object.values(S.accounts).find((a) => a.type === 'checking').id; const now = Date.now();
    for (let i = 0; i < 8; i++) { S.txns[acct + ':xa' + i] = { id: 'xa' + i, acct, ts: now - (i * 30 + 3) * 864e5, amt: -46.39, desc: 'ACME TELECOM' }; S.txns[acct + ':xb' + i] = { id: 'xb' + i, acct, ts: now - (i * 30 + 5) * 864e5, amt: -89.99, desc: 'ACME TELECOM' }; }
    Store.S.settings.hideAmounts = true; Store.commit({ silent: true }); App.applyTheme(); });
  console.log('tagged series:', await p.evaluate(() => Store.V.recurring.filter((r) => r.m === 'acme telecom').map((r) => r.name + ' | tag ' + r.tag)));
  const leaks = [];
  const screens = [['home'], ['calendar'], ['activity'], ['reports', 'overview'], ['reports', 'leaks'], ['reports', 'income'], ['plan', 'recurring'], ['plan', 'goals']];
  for (const [tab, seg] of screens) {
    await p.evaluate(([t, s]) => { if (t === 'reports') App.rep.seg = s; if (t === 'plan') App.plan.seg = s; App.go(t); App.render(true); }, [tab, seg]);
    const l = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.getElementById('view'), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (!/[$€£]\s?\d/.test(n.textContent)) continue; if (n.parentElement.closest('.amt,.amt-h')) continue; out.push(n.textContent.trim().slice(0, 60)); } return out; });
    if (l.length) leaks.push(tab + (seg ? '/' + seg : '') + ': ' + [...new Set(l)].slice(0, 4).join(' | '));
  }
  await p.evaluate(() => { App.plan.seg = 'recurring'; App.go('plan'); App.render(true); }); await p.screenshot({ path: 'test/shots/mask-bills.png' });
  console.log(leaks.length ? 'LEAKS:\n' + leaks.join('\n') : 'no visible amounts in hidden mode');
  const snap = await p.evaluate(() => App.widgetSnapshot().items.filter((x) => /telecom/i.test(x.n) && !x.p).slice(0, 2));
  console.log('widget items:', JSON.stringify(snap));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

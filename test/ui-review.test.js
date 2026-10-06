const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  await p.evaluate(() => {
    const S = Store.S; const acct = Object.values(S.accounts).find((a) => a.type === 'checking').id; const now = Date.now();
    const add = (id, desc, amt, d) => { S.txns[acct + ':' + id] = { id, acct, ts: now - d * 864e5, amt, desc }; };
    for (let i = 0; i < 3; i++) add('kz' + i, 'ZTL*KHAN ENTERPRISES 5521', -48 - i, 5 + i * 9);
    add('ab1', 'POS 00123 QWIKPAY 7781 NAPERVILLE', -12, 3);
    add('dp1', 'MOBILE DEPOSIT REF 88213', 200, 4);
    add('dp2', 'KHAN ENTERPRISES REFUND', 30, 6);
    Store.commit({ silent: true }); App.render();
  });
  await p.waitForTimeout(400);
  const badge = await p.$('[data-a=goReview]');
  console.log('home badge:', badge ? (await badge.textContent()).trim() : 'MISSING');
  await p.screenshot({ path: 'test/shots/rv-home.png' });
  await badge.click(); await p.waitForTimeout(400);
  await p.screenshot({ path: 'test/shots/rv-page.png', fullPage: true });
  const groups = await p.evaluate(() => App.reviewGroups().map((o) => `${o.key} ${o.txs.length} ${o.cat} [${o.sugg.join(',')}]`));
  console.log('groups:', groups);
  // teach: Khan Enterprises (spending) = shopping; the refund (money in) must stay separate
  await p.click('[data-a=rvPick][data-x="' + (await p.evaluate(() => App.reviewGroups().find((o) => /ztl/.test(o.m) && o.sign === '-').key)) + '"][data-y=shopping]');
  await p.waitForTimeout(300);
  console.log('khan out:', await p.evaluate(() => Store.V.list.filter((t) => /khan|ztl/.test(t.m)).map((t) => `${t.amt} ${t.cat} ${t.catSrc}`)));
  console.log('rule:', await p.evaluate(() => JSON.stringify(Store.S.rules.filter((r) => r.reviewed).map((r) => [r.pattern, r.sign || '', r.cat]))));
  // skip one
  const sk = await p.evaluate(() => App.reviewGroups()[0].key);
  await p.click(`[data-a=rvSkip][data-x="${sk}"]`); await p.waitForTimeout(200);
  console.log('skipped gone:', await p.evaluate((k) => !App.reviewGroups().some((o) => o.key === k), sk), 'reviewed synced key:', await p.evaluate(() => Cloud.SECTIONS.includes('reviewed')));
  // Other… picker
  const ok = await p.evaluate(() => (App.reviewGroups()[0] || {}).key);
  if (ok) { await p.click(`[data-a=rvMore][data-x="${ok}"]`); await p.waitForTimeout(400); await p.click('[data-a=pcPick][data-x=gifts]'); await p.waitForTimeout(300); console.log('picked other:', await p.evaluate((k) => Store.V.list.filter((t) => t.m + (t.amt < 0 ? '-' : '+') === k).map((t) => t.cat + ' ' + t.catSrc), ok)); }
  // tx sheet shows source + confidence
  await p.evaluate(() => { const t = Store.V.list.find((x) => x.catSrc === 'brand' || x.catSrc === 'keyword'); App.openTx(t.k); }); await p.waitForTimeout(400);
  console.log('src label:', await p.evaluate(() => [...document.querySelectorAll('.sheet.on [data-a=txCat] .s')].map((e) => e.textContent)));
  await p.evaluate(() => UI.closeAll());
  // Activity: needs-review chip + select all
  await p.evaluate(() => { App.act.flag = 'review'; App.go('activity'); }); await p.waitForTimeout(300);
  console.log('activity review rows:', await p.$$eval('#actList .item', (x) => x.length));
  await p.click('[data-a=actSelect]'); await p.click('[data-a=selAll]'); await p.waitForTimeout(200);
  console.log('selected all:', await p.evaluate(() => App.act.sel.size + '/' + App.activityFiltered().length));
  await p.screenshot({ path: 'test/shots/rv-act.png' });
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

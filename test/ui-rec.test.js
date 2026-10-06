const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  // Two amazon purchases with different amounts: mark each as recurring
  const ks = await p.evaluate(() => { const a = Store.V.list.filter((t) => t.m === 'amazon' && t.amt < 0 && !t.recurring && !t.pending); return [a[0].k, a.find((x) => Math.abs(Math.abs(x.amt) - Math.abs(a[0].amt)) > 5).k]; });
  for (const k of ks) {
    await p.evaluate((k) => { UI.closeAll(); App.openTx(k); }, k); await p.waitForTimeout(300);
    await p.click('[data-a=txRec]'); await p.waitForTimeout(300);
    await p.screenshot({ path: 'test/shots/r-mark.png' });
    await p.click('[data-a=mrFreq][data-x=monthly]'); await p.click('[data-a=mrSave]'); await p.waitForTimeout(300);
  }
  console.log('amazon series:', await p.evaluate(() => Store.V.recurring.filter((r) => r.m === 'amazon').map((r) => `${r.key.slice(0, 8)} ${r.name} ${r.amount} n=${r.count}`)));
  console.log('both marked:', await p.evaluate((ks) => ks.map((k) => Store.V.byKey[k].recurring), ks));
  // variable electric bill: any amount
  await p.evaluate(() => { const ov = Store.S.recurringOverrides; delete ov['comed']; ov['comed'] = 'ignore'; Store.commit({ silent: true }); });
  console.log('comed ignored:', await p.evaluate(() => Store.V.recurring.some((r) => r.m === 'comed')));
  const ck = await p.evaluate(() => Store.V.list.find((t) => t.m === 'comed').k);
  await p.evaluate((k) => { UI.closeAll(); App.openTx(k); }, ck); await p.waitForTimeout(300);
  await p.click('[data-a=txRec]'); await p.waitForTimeout(300); await p.screenshot({ path: 'test/shots/r-mark2.png' });
  await p.click('[data-a=mrSave]'); await p.waitForTimeout(300);
  console.log('comed manual:', await p.evaluate(() => Store.V.recurring.filter((r) => r.m === 'comed').map((r) => `${r.name} ${r.count} ${r.freq}`)));
  // stop one amazon series only
  await p.evaluate((k) => { UI.closeAll(); App.openTx(k); }, ks[0]); await p.waitForTimeout(300);
  await p.click('[data-a=txRec]'); await p.waitForTimeout(300); await p.click('[data-a=cfOk]'); await p.waitForTimeout(300);
  console.log('after stop:', await p.evaluate((ks) => ks.map((k) => Store.V.byKey[k].recurring), ks));
  // category drill in Reports shows the period's transactions
  await p.evaluate(() => { UI.closeAll(); App.rep.seg = 'overview'; App.rep.pid = 'M'; App.rep.off = -1; App.go('reports'); App.openCategory('groceries'); }); await p.waitForTimeout(600);
  await p.screenshot({ path: 'test/shots/r-cat.png' });
  console.log('cat sheet header:', (await p.textContent('.sheet.on .bd .small.muted')).trim());
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

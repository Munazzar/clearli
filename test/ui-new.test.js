const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `test/shots/n-${n}.png` }); };
  // calendar list
  await p.evaluate(() => { App.go('calendar'); }); await p.evaluate(() => document.getElementById('view').scrollTo(0, 700)); await shot('cal');
  await p.click('[data-a=calF][data-x=upcoming]'); await shot('cal-up');
  // savings
  await p.evaluate(() => { App.plan.seg = 'savings'; App.go('plan'); }); await shot('sav-empty');
  await p.click('.fab'); await p.click('[data-a=afKind][data-x=gold]'); await p.fill('[data-in=afName]', 'Gold coins'); await p.dispatchEvent('[data-in=afName]', 'input');
  await p.fill('[data-in=afOpen]', '4000'); await p.dispatchEvent('[data-in=afOpen]', 'input');
  await p.fill('[data-in=afQty]', '50'); await p.dispatchEvent('[data-in=afQty]', 'input'); await p.fill('[data-in=afUnit]', 'grams'); await p.dispatchEvent('[data-in=afUnit]', 'input');
  await p.fill('[data-in=afPrice]', '95'); await p.dispatchEvent('[data-in=afPrice]', 'input');
  await p.click('[data-a=afSave]'); await shot('asset');
  await p.evaluate(() => { UI.closeAll(); Store.S.assets.push({ id: 'as2', name: 'Home safe', kind: 'cash', entries: [{ id: 'e', ts: Date.now(), amt: 2500 }], private: true }); Store.commit(); App.render(); }); await shot('sav-list');
  // txn: moved to savings + split + bonus
  await p.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'acme payroll'); Store.S.txns[t.k].amt = 5200; Store.commit({ silent: true }); App.openTx(t.k); }); await shot('tx-bonus');
  await p.click('[data-a=txBonus]'); await shot('split');
  await p.click('[data-a=spSave]'); await shot('after-split');
  await p.evaluate(() => { UI.closeAll(); const t = Store.V.list.find((x) => x.kind === 'transfer' && x.amt < 0); App.openTx(t.k); });
  await p.click('[data-a=txSave]'); await p.click('[data-a=tsPick][data-x=as2]'); await shot('tx-saved');
  // import sheet
  await p.evaluate(() => { UI.closeAll(); const t = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n06/04/2026,06/05/2026,STARBUCKS STORE 12345,Food & Drink,Sale,-6.45,\n06/03/2026,06/03/2026,Payment Thank You-Mobile,,Payment,1250.00,\n'; const rows = IMP.parseCSV(t); const csv = IMP.detect(rows); App.importOptions({ kind: 'csv', csv, preset: csv.preset }); });
  await shot('imp1');
  await p.click('[data-a=imAcct][data-x=sapph]'); await p.evaluate(() => document.querySelector('.sheet .bd').scrollTo(0, 3000)); await shot('imp2');
  await p.click('[data-a=imGo]'); await p.waitForTimeout(800); await shot('imp-done');
  await p.evaluate(() => { UI.closeAll(); App.go('more'); App.push('connection'); document.getElementById('view').scrollTo(0, 600); }); await shot('conn');
  // all screens smoke
  await p.evaluate(async () => { for (const seg of ['overview', 'trends', 'compare', 'leaks']) { App.rep.seg = seg; App.go('reports'); App.render(); } for (const s of ['goals', 'savings', 'budgets', 'calendar', 'recurring']) { App.plan.seg = s; App.go('plan'); App.render(); } App.go('home'); App.go('activity'); });
  await shot('home');
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

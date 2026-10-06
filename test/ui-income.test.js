const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  await p.evaluate(() => { App.rep.seg = 'income'; App.go('reports'); }); await p.waitForTimeout(800); await p.screenshot({ path: 'test/shots/i-income.png' });
  // a Zelle deposit (transfer) -> month control + warning; turn on "always" rule
  await p.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'acme payroll'); App.openTx(t.k); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('.sheet .bd').scrollTo(0, 700)); await p.waitForTimeout(300); await p.screenshot({ path: 'test/shots/i-tx.png' });
  await p.click('[data-a=txNextRule]'); await p.waitForTimeout(400);
  console.log('rule:', await p.evaluate(() => JSON.stringify(Store.S.rules.find((r) => r.nextFrom))), 'shifted count:', await p.evaluate(() => Store.V.list.filter((t) => t.shifted).length));
  await p.evaluate(() => { UI.closeAll(); const t = Store.V.list.find((x) => x.m === 'zelle from' || (x.amt > 0 && x.kind === 'transfer')); App.openTx(t.parent || t.k); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('.sheet .bd').scrollTo(0, 500)); await p.screenshot({ path: 'test/shots/i-tx2.png' });
  // recurring sheet naming
  await p.evaluate(() => { UI.closeAll(); App.openRecurring(Store.V.recurring.find((r) => r.m === 'netflix').key); }); await p.waitForTimeout(600);
  await p.screenshot({ path: 'test/shots/i-rec.png' });
  await p.fill('[data-ch=recName]', 'Netflix Premium'); await p.dispatchEvent('[data-ch=recName]', 'change'); await p.waitForTimeout(300);
  console.log('series name:', await p.evaluate(() => [...new Set(Store.V.list.filter((t) => t.m === 'netflix').map((t) => t.name))]));
  await p.click('[data-a=recSplit]'); await p.waitForTimeout(300);
  console.log('after split toggle:', await p.evaluate(() => Store.V.recurring.filter((r) => r.m === 'netflix').map((r) => r.key + ':' + r.name)));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

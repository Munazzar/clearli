const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(400);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.waitForTimeout(300);
  await p.click('[data-a=obBack][data-x=custom]'); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('onb').scrollTo(0, 500)); await p.waitForTimeout(400);
  await p.screenshot({ path: 'test/shots/bf-onb.png' });
  await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  await p.evaluate(() => { Store.S.settings.demo = false; Store.S.backfill = { target: Date.now() - 700 * 864e5, cursor: Date.now() - 300 * 864e5, started: Date.now(), active: true, status: 'running', msg: '', empty: 0, requests: 16 }; App.render(); });
  await p.waitForTimeout(800); await p.screenshot({ path: 'test/shots/bf-home.png' });
  await p.evaluate(() => { App.go('more'); App.push('connection'); }); await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('view').scrollTo(0, 400)); await p.waitForTimeout(300);
  await p.screenshot({ path: 'test/shots/bf-conn.png' });
  await p.evaluate(() => { Store.S.backfill.active = false; Store.S.backfill.status = 'nohistory'; App.render(); });
  await p.click('[data-a=bfOpen]'); await p.waitForTimeout(700); await p.screenshot({ path: 'test/shots/bf-sheet.png' });
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

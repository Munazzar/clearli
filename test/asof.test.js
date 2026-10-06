const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  await p.evaluate(() => { const S = Store.S; S.accounts.chk.balanceDate = Date.now() - 6 * 3600e3; S.accounts.sapph.balanceDate = Date.now() - 2 * 86400e3; S.accounts.amexg.balanceDate = Date.now() - 20 * 3600e3; Store.commit({ silent: true }); App.render(); });
  await p.evaluate(() => { const el = [...document.querySelectorAll('.sec .h2')].find((x) => x.textContent === 'Accounts'); el.scrollIntoView(); }); await p.waitForTimeout(400);
  await p.screenshot({ path: 'test/shots/asof-home.png' });
  await p.evaluate(() => { App.go('more'); App.push('accounts'); }); await p.waitForTimeout(400); await p.screenshot({ path: 'test/shots/asof-accts.png' });
  console.log(errs.length ? errs : 'NO ERRORS'); await b.close();
})();

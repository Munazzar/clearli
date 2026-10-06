const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__w = []; window.__launch = 'calendar'; });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html'); await p.waitForTimeout(300);
  await p.click('[data-a=obNext]'); await p.click('[data-a=obNext]'); await p.click('[data-a=obDemo]'); await p.click('[data-a=obFinish]');
  // pretend to be the phone shell: capture widget snapshots
  await p.evaluate(() => { Native.widgetData = (j) => window.__w.push(j); Store.commit({ silent: true }); });
  await p.waitForTimeout(1800);
  const snap = await p.evaluate(() => JSON.parse(window.__w[window.__w.length - 1] || 'null'));
  const today = await p.evaluate(() => U.dayKey(new Date()));
  console.log('snapshots pushed:', await p.evaluate(() => window.__w.length), 'items:', snap.items.length, 'paid:', snap.items.filter((x) => x.p).length, 'upcoming:', snap.items.filter((x) => !x.p && x.d >= today).length);
  console.log('sample:', JSON.stringify(snap.items.find((x) => !x.p)), 'keys:', Object.keys(snap));
  console.log('no account numbers:', !/acct|••/.test(JSON.stringify(snap)));
  // tab bar
  console.log('tabs:', await p.$$eval('#tabs button', (x) => x.map((b) => b.textContent)));
  await p.click('[data-a=tab][data-x=calendar]'); await p.waitForTimeout(300);
  console.log('calendar title:', await p.textContent('#top h1'), 'grid cells:', await p.$$eval('.cal .d', (x) => x.length));
  await p.screenshot({ path: 'test/shots/w-caltab.png' });
  console.log('plan segs:', await p.$$eval('[data-a=planSeg]', (x) => x.map((b) => b.dataset.x)).catch(() => 'n/a'));
  // Home "Calendar" link goes to the tab
  await p.evaluate(() => App.go('home')); await p.click('[data-a=goCal]'); await p.waitForTimeout(200);
  console.log('goCal ->', await p.evaluate(() => App.tab));
  // launch from widget
  await p.evaluate(() => { App.go('reports'); App.openFrom('calendar'); });
  console.log('openFrom ->', await p.evaluate(() => App.tab));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

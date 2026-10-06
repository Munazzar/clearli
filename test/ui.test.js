const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' in {} ? undefined : undefined });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error' || /Error|error/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/android/assets/www/index.html');
  await p.waitForTimeout(500);
  const shot = async (n) => { await p.waitForTimeout(900); await p.screenshot({ path: `test/shots/${n}.png` }); };
  await shot('00-welcome');
  await p.click('[data-a=obNext]'); await shot('01-privacy');
  await p.click('[data-a=obNext]'); await shot('02-connect');
  await p.click('[data-a=obDemo]'); await shot('03-lock');
  await p.click('[data-a=obFinish]'); await shot('10-home');
  await p.evaluate(() => document.getElementById('view').scrollTo(0, 900)); await shot('11-home2');
  await p.evaluate(() => document.getElementById('view').scrollTo(0, 2000)); await shot('12-home3');
  const tabs = async (x) => { await p.click(`#tabs [data-x=${x}]`); };
  await tabs('activity'); await shot('20-activity');
  await p.click('#actList [data-a=tx]'); await shot('21-txn');
  await p.evaluate(() => document.querySelector('.sheet .bd').scrollTo(0, 800)); await shot('22-txn2');
  await p.click('.sheet [data-a=txCat]'); await shot('23-catpick');
  await p.click('.sheet.on:last-of-type [data-a=pcPick][data-x=coffee]'); await shot('24-learn');
  await p.click('[data-a=chPick][data-x=all]'); await shot('25-after');
  await p.evaluate(() => UI.closeAll());
  await tabs('reports'); await shot('30-overview');
  for (const y of [700, 1400, 2100, 2800, 3500, 4200]) { await p.evaluate((y) => document.getElementById('view').scrollTo(0, y), y); await shot('31-overview-' + y); }
  await p.click('[data-a=repP][data-x=Y]'); await shot('32-year');
  await p.click('[data-a=repSeg][data-x=trends]'); await shot('33-trends');
  for (const y of [800, 1600, 2400, 3200]) { await p.evaluate((y) => document.getElementById('view').scrollTo(0, y), y); await shot('34-trends-' + y); }
  await p.click('[data-a=repSeg][data-x=compare]'); await shot('35-compare');
  for (const y of [800, 1600, 2400]) { await p.evaluate((y) => document.getElementById('view').scrollTo(0, y), y); await shot('36-compare-' + y); }
  await p.click('[data-a=repSeg][data-x=leaks]'); await shot('37-leaks');
  await p.evaluate(() => document.getElementById('view').scrollTo(0, 1200)); await shot('38-leaks2');
  await tabs('plan'); await shot('40-goals');
  await p.click('[data-a=goalOpen]'); await shot('41-goal');
  await p.click('[data-a=goalCut]'); await p.evaluate(() => document.querySelector('.sheet .bd').scrollTo(0, 700)); await shot('42-goal2');
  await p.evaluate(() => UI.closeAll());
  await p.click('[data-a=planSeg][data-x=budgets]'); await shot('43-budgets');
  await p.click('[data-a=tab][data-x=calendar]'); await shot('44-cal');
  await p.click('[data-a=tab][data-x=plan]'); await p.click('[data-a=planSeg][data-x=recurring]'); await shot('45-rec');
  await p.click('[data-a=recOpen]'); await shot('46-recsheet');
  await p.evaluate(() => UI.closeAll());
  await tabs('more'); await shot('50-more');
  await p.click('[data-a=push][data-x=appearance]'); await shot('51-appearance');
  await p.click('[data-a=setTheme][data-x=glass-light]'); await shot('52-light');
  await tabs('home'); await shot('53-home-light');
  await p.evaluate(() => { Store.S.settings.theme = 'aurora'; App.applyTheme(); App.render(); }); await shot('54-home-aurora');
  await p.evaluate(() => { Store.S.settings.theme = 'midnight'; App.applyTheme(); App.render(); }); await shot('55-home-midnight');
  await p.evaluate(() => { Store.S.settings.theme = 'glass-dark'; App.applyTheme(); App.go('more'); App.push('rules'); }); await shot('56-rules');
  await p.evaluate(() => { App.push('categories'); }); await shot('57-cats');
  await p.evaluate(() => { App.push('connection'); }); await shot('58-conn');
  await p.evaluate(() => { App.push('privacy'); }); await shot('59-privacy');
  await p.evaluate(() => { App.go('home'); document.querySelector('[data-a=scope]').click(); }); await shot('60-scope');
  await p.click('[data-a=scopeConn]'); await p.evaluate(() => UI.closeAll()); await shot('61-scoped-home');
  // select + compare
  await p.evaluate(() => { App.scope = { accts: [], conns: [] }; App.go('activity'); });
  await p.click('[data-a=actSelect]');
  for (const i of [0,2,4]) { const rows = await p.$$('#actList [data-a=txSel]'); await rows[i].click(); }
  await shot('62-select');
  await p.click('[data-a=selCompare]'); await shot('63-compare-tx');
  await p.evaluate(() => UI.closeAll());
  // for each period in overview/trends ensure no errors
  await p.evaluate(async () => { for (const seg of ['overview', 'trends']) for (const pid of ['D','W','M','Q','Y','2Y']) for (const off of [0,-1]) { App.rep = Object.assign(App.rep, { seg, pid, off }); App.go('reports'); App.render(); } });
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close();
})();

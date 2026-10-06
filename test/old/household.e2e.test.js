// Main phone + member phone + web, all against one fake Firebase
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const src = require('fs').readFileSync(path.join(__dirname, 'sync.e2e.test.js'), 'utf8');
const coreSrc = src.slice(src.indexOf('const DB = new Map()'), src.indexOf('function fake(route)'));
const { DB, core } = new Function(coreSrc + ';return { DB, core };')();
(async () => {
  const b = await chromium.launch(); const errs = [];
  const phone = async () => {
    const p = await b.newPage({ viewport: { width: 412, height: 915 } });
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); });
    await p.exposeFunction('fakeNet', (m, u, h, bd) => core(m, u, JSON.parse(h), bd));
    await p.goto('file://' + path.join(__dirname, '..', 'android/assets/www/index.html')); await p.waitForTimeout(300);
    await p.evaluate(() => { Cloud.transport = (m, u, h, bd) => window.fakeNet(m, u, JSON.stringify(h), bd); });
    return p;
  };
  // MAIN phone with sample data, sync on
  const A = await phone();
  await A.click('[data-a=obNext]'); await A.click('[data-a=obNext]'); await A.click('[data-a=obDemo]'); await A.click('[data-a=obFinish]');
  await A.evaluate(() => { App.go('more'); App.push('websync'); });
  await A.fill('[data-x=email]', 'me@test.com'); await A.dispatchEvent('[data-x=email]', 'input'); await A.fill('[data-x=password]', 'pw123456'); await A.dispatchEvent('[data-x=password]', 'input');
  await A.click('[data-a=syGo]'); await A.waitForTimeout(400);
  for (const k of ['pass', 'pass2']) { await A.fill(`[data-x=${k}]`, 'correct horse battery'); await A.dispatchEvent(`[data-x=${k}]`, 'input'); }
  await A.click('[data-a=syGo]'); await A.waitForTimeout(3000);
  console.log('main uploaded:', DB.has('users/U1/meta/state'));
  // WIFE's phone: onboarding → join
  const B = await phone();
  await B.click('[data-a=obNext]'); await B.click('[data-a=obNext]'); await B.click('[data-a=obJoin]'); await B.waitForTimeout(300);
  await B.fill('#jE', 'me@test.com'); await B.fill('#jP', 'pw123456'); await B.fill('#jK', 'correct horse battery');
  await B.click('[data-a=joinGo]'); await B.waitForTimeout(3000);
  await B.screenshot({ path: 'test/shots/h-join-done.png' });
  await B.click('[data-a=obFinish]'); await B.waitForTimeout(800);
  await B.screenshot({ path: 'test/shots/h-member-home.png' });
  console.log('member txns:', await B.evaluate(() => Store.V.list.length), 'role:', await B.evaluate(() => Store.S.sync.role));
  // member edits → main receives
  const k = await B.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'starbucks'); Store.setEdit(t.k, { cat: 'dining', note: 'from wife' }); Store.commit({ silent: true }); return t.k; });
  await B.waitForTimeout(2500);
  await A.evaluate(() => App.cloudTick()); await A.waitForTimeout(2500);
  console.log('main got member edit:', await A.evaluate((k) => JSON.stringify(Store.S.edits[k]), k));
  // main edits → member receives
  await A.evaluate(() => { Store.S.goals.push({ id: 'gX', name: 'New car', target: 9000, saved: 100, date: Date.now() + 3e10, icon: 'car', color: '#43D9B8' }); Store.commit(); });
  await A.waitForTimeout(5500);
  await B.evaluate(() => App.cloudTick()); await B.waitForTimeout(2500);
  console.log('member got main goal:', await B.evaluate(() => Store.S.goals.some((g) => g.name === 'New car')), 'member still has own edit:', await B.evaluate((k) => Store.S.edits[k] && Store.S.edits[k].note, k));
  // member "sync" button must not call SimpleFIN
  const r = await B.evaluate(() => App.doSync({ silent: true })); console.log('member doSync:', JSON.stringify(r));
  // A third phone trying to become main is warned
  const C = await phone();
  await C.click('[data-a=obNext]'); await C.click('[data-a=obNext]'); await C.click('[data-a=obDemo]'); await C.click('[data-a=obFinish]');
  await C.evaluate(() => { App.go('more'); App.push('websync'); });
  await C.fill('[data-x=email]', 'me@test.com'); await C.dispatchEvent('[data-x=email]', 'input'); await C.fill('[data-x=password]', 'pw123456'); await C.dispatchEvent('[data-x=password]', 'input');
  await C.click('[data-a=syGo]'); await C.waitForTimeout(400);
  await C.fill('[data-x=pass]', 'correct horse battery'); await C.dispatchEvent('[data-x=pass]', 'input');
  await C.click('[data-a=syGo]'); await C.waitForTimeout(1500);
  await C.screenshot({ path: 'test/shots/h-second-main.png' });
  await C.click('[data-a=chPick][data-x=join]'); await C.waitForTimeout(2500);
  console.log('third phone became:', await C.evaluate(() => Store.S.sync && Store.S.sync.role), 'has goal:', await C.evaluate(() => Store.S.goals.some((g) => g.name === 'New car')));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();

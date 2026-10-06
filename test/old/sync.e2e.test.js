const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
// ---- fake Firebase (Auth + Firestore REST) ----
const DB = new Map(); let reads = 0, writes = 0;
const PFX = 'projects/clearli-8c132/databases/(default)/documents/';
function core(method, rawUrl, hdrs, body) {
  const url = new URL(rawUrl); const req = { method: () => method, headers: () => hdrs };
  const json = (status, o) => ({ status, body: JSON.stringify(o) });
  if (url.host === 'identitytoolkit.googleapis.com') { const b = JSON.parse(body); if (b.email === 'me@test.com' && b.password === 'pw123456') return json(200, { localId: 'U1', email: b.email, idToken: 'tok1', refreshToken: 'r1', expiresIn: '3600' }); return json(400, { error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } }); }
  if (url.host === 'securetoken.googleapis.com') return json(200, { id_token: 'tok2', refresh_token: 'r2', user_id: 'U1', expires_in: '3600' });
  if (url.host === 'firestore.googleapis.com') {
    const auth = hdrs['authorization'] || hdrs['Authorization'] || '';
    if (!/Bearer tok[12]/.test(auth)) return json(401, { error: { status: 'UNAUTHENTICATED' } });
    const p = decodeURIComponent(url.pathname).replace('/v1/' + PFX, '');
    const own = (x) => x.startsWith('users/U1/');
    if (p.endsWith(':commit') || url.pathname.endsWith(':commit')) {
      for (const w of JSON.parse(body).writes) { const n = (w.update ? w.update.name : w.delete).replace(PFX, ''); if (!own(n)) return json(403, { error: { status: 'PERMISSION_DENIED' } }); if (w.update) DB.set(n, { name: w.update.name, fields: w.update.fields }); else DB.delete(n); writes++; }
      return json(200, { writeResults: [] });
    }
    if (!own(p)) return json(403, { error: { status: 'PERMISSION_DENIED' } });
    const segs = p.split('/');
    if (segs.length % 2 === 1) { const docs = [...DB.entries()].filter(([k]) => k.startsWith(p + '/') && k.split('/').length === segs.length + 1).map(([, v]) => v); reads += docs.length || 1; return json(200, docs.length ? { documents: docs } : {}); }
    reads++; const d = DB.get(p); return d ? json(200, d) : json(404, { error: { code: 404, status: 'NOT_FOUND', message: `Document "projects/clearli-8c132/databases/(default)/documents/${p}" not found.` } });
  }
  return { status: 404, body: '' };
}
function fake(route) {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const r = core(req.method(), req.url(), req.headers(), req.postData());
  return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body });
}
// static server for web/dist
const dist = path.join(__dirname, '..', 'web', 'dist');
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const t = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream'; s.writeHead(200, { 'content-type': t }); s.end(d); }); }).listen(8123);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (vp) => { const p = await b.newPage({ viewport: vp }); await p.route(/googleapis\.com/, fake); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /^ERR|^REJ/.test(m.text())) errs.push(m.text()); }); return p; };
  // PHONE
  const ph = await mk({ width: 412, height: 915 });
  await ph.exposeFunction('fakeNet', (m, u, h, b) => core(m, u, JSON.parse(h), b));
  await ph.goto('file://' + path.join(__dirname, '..', 'android/assets/www/index.html')); await ph.waitForTimeout(300);
  await ph.evaluate(() => { Cloud.transport = (m, u, h, b) => window.fakeNet(m, u, JSON.stringify(h), b); });
  await ph.click('[data-a=obNext]'); await ph.click('[data-a=obNext]'); await ph.click('[data-a=obDemo]'); await ph.click('[data-a=obFinish]');
  await ph.evaluate(() => { App.go('more'); App.push('websync'); });
  await ph.fill('[data-x=email]', 'me@test.com'); await ph.dispatchEvent('[data-x=email]', 'input');
  await ph.fill('[data-x=password]', 'pw123456'); await ph.dispatchEvent('[data-x=password]', 'input');
  await ph.click('[data-a=syGo]'); await ph.waitForTimeout(500);
  for (const k of ['pass', 'pass2']) { await ph.fill(`[data-x=${k}]`, 'correct horse battery'); await ph.dispatchEvent(`[data-x=${k}]`, 'input'); }
  await ph.screenshot({ path: 'test/shots/s-phone-pass.png' });
  await ph.click('[data-a=syGo]'); await ph.waitForTimeout(3500);
  await ph.screenshot({ path: 'test/shots/s-phone-on.png' });
  const docs = [...DB.keys()]; console.log('cloud docs:', docs);
  const vault = DB.get('users/U1/vault/0'); console.log('ciphertext sample:', vault.fields.data.stringValue.slice(0, 60), '… plaintext leak?', /Starbucks|STARBUCKS|Chase/i.test(JSON.stringify([...DB.values()])));
  console.log('meta', JSON.stringify(DB.get('users/U1/meta/state').fields));
  // WEB
  const wb = await mk({ width: 1440, height: 900 });
  await wb.goto('http://localhost:8123/'); await wb.waitForTimeout(500);
  await wb.fill('#wEmail', 'me@test.com'); await wb.fill('#wPw', 'pw123456'); await wb.fill('#wPass', 'wrong passphrase'); await wb.click('#wGo'); await wb.waitForTimeout(2500);
  console.log('wrong pass msg:', await wb.textContent('#onb .neg').catch(() => 'none'));
  await wb.fill('#wPass', 'correct horse battery'); await wb.click('#wGo'); await wb.waitForTimeout(3000);
  await wb.screenshot({ path: 'test/shots/s-web-home.png' });
  console.log('web txns:', await wb.evaluate(() => Store.V.list.length));
  // edit on web
  const k = await wb.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'starbucks'); Store.setEdit(t.k, { cat: 'dining', name: 'Starbucks (web edit)' }); Store.commit(); return t.k; });
  await wb.waitForTimeout(2500);
  console.log('ops in cloud:', [...DB.keys()].filter((x) => x.includes('/ops/')).length, 'status:', await wb.evaluate(() => CW.status));
  // phone merges
  await ph.evaluate(() => App.cloudTick()); await ph.waitForTimeout(2500);
  console.log('phone got edit:', await ph.evaluate((k) => JSON.stringify(Store.S.edits[k]), k), 'ops left:', [...DB.keys()].filter((x) => x.includes('/ops/')).length);
  // web refresh picks new version
  const v1 = await wb.evaluate(() => CW.meta.version); await wb.evaluate(() => CW.refresh(true)); await wb.waitForTimeout(2000);
  console.log('web version advanced:', (await wb.evaluate(() => CW.meta.version)) > v1, 'edit kept:', await wb.evaluate((k) => Store.V.byKey[k].name, k));
  // reload web with remembered key
  await wb.reload(); await wb.waitForTimeout(3000); console.log('remembered unlock ok:', await wb.evaluate(() => !!(Store.V && Store.V.list.length)));
  for (const [tab, name] of [['reports', 'reports'], ['activity', 'activity'], ['plan', 'plan'], ['more', 'more']]) { await wb.evaluate((t) => App.go(t), tab); await wb.waitForTimeout(1200); await wb.screenshot({ path: `test/shots/s-web-${name}.png` }); }
  await wb.evaluate(() => { App.go('activity'); App.openTx(Store.V.list[3].parent || Store.V.list[3].k); }); await wb.waitForTimeout(900); await wb.screenshot({ path: 'test/shots/s-web-sheet.png' });
  console.log('reads', reads, 'writes', writes);
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close(); srv.close();
})();

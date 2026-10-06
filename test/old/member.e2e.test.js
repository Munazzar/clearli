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
  // MEMBER PHONE (wife)
  const mb = await mk({ width: 412, height: 915 });
  await mb.exposeFunction('fakeNet', (m, u, h, b) => core(m, u, JSON.parse(h), b));
  await mb.goto('file://' + path.join(__dirname, '..', 'android/assets/www/index.html')); await mb.waitForTimeout(300);
  await mb.evaluate(() => { Cloud.transport = (m, u, h, b) => window.fakeNet(m, u, JSON.stringify(h), b); });
  await mb.click('[data-a=obNext]'); await mb.click('[data-a=obNext]');
  await mb.click('[data-a=obJoin]'); await mb.waitForTimeout(200);
  await mb.fill('#jE', 'me@test.com'); await mb.fill('#jP', 'pw123456'); await mb.fill('#jK', 'correct horse battery');
  await mb.screenshot({ path: 'test/shots/m-join.png' });
  await mb.click('[data-a=joinGo]'); await mb.waitForTimeout(2500);
  await mb.click('[data-a=obFinish]'); await mb.waitForTimeout(800);
  await mb.screenshot({ path: 'test/shots/m-home.png' });
  console.log('member txns:', await mb.evaluate(() => Store.V.list.length), 'role:', await mb.evaluate(() => Store.S.sync.role));
  // member edits a transaction
  const mk2 = await mb.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'target'); Store.setEdit(t.k, { cat: 'kids', note: 'school supplies' }); Store.commit({ silent: true }); return t.k; });
  await mb.waitForTimeout(2500);
  console.log('ops after member edit:', [...DB.keys()].filter((x) => x.includes('/ops/')).length, 'queue:', await mb.evaluate(() => Store.S.sync.queue.length));
  // primary merges and re-uploads
  await ph.evaluate(() => App.cloudTick()); await ph.waitForTimeout(2500);
  console.log('primary got member edit:', await ph.evaluate((k) => JSON.stringify(Store.S.edits[k]), mk2));
  // primary edits -> member sees it
  const pk = await ph.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'costco'); Store.setEdit(t.k, { name: 'Costco (bulk)' }); Store.commit({ silent: true }); return t.k; });
  await ph.evaluate(() => App.cloudTick(true)); await ph.waitForTimeout(2000);
  await mb.evaluate(() => App.cloudTick()); await mb.waitForTimeout(2500);
  console.log('member sees primary edit:', await mb.evaluate((k) => Store.V.byKey[k] && Store.V.byKey[k].name, pk), '| member edit kept:', await mb.evaluate((k) => JSON.stringify(Store.S.edits[k]), mk2));
  console.log('member doSync (no SimpleFIN):', JSON.stringify(await mb.evaluate(() => App.doSync({ silent: true }))));
  console.log('member theme kept local:', await mb.evaluate(() => Store.S.settings.onboarded));
  console.log('reads', reads, 'writes', writes);
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close(); srv.close();
})();

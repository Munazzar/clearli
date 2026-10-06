const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const G = require('./fake-google');
const dist = path.join(__dirname, '..', 'web', 'dist');
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0].split('#')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const t = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream'; s.writeHead(200, { 'content-type': t }); s.end(d); }); }).listen(8124);
const ok = (label, v) => console.log((v ? 'PASS ' : 'FAIL ') + label);
// fake native Google sign-in for the phone pages
const mockNative = () => {
  const R = {}; const take0 = Native.take;
  Native.take = (k) => { if (k in R) { const v = R[k]; delete R[k]; return v; } return take0(k); };
  const cbk = (id, o) => { const k = 'g' + Math.random().toString(36).slice(2); R[k] = JSON.stringify(o); setTimeout(() => __nativeCb(id, k), 60); };
  let n = 1;
  Native.googleSignIn = (c, s, h, id) => { window.__signins = (window.__signins || 0) + 1; cbk(id, { ok: true, token: 'gt-' + (n++), exp: Date.now() + 3600e3 }); };
  Native.googleToken = (f, id) => { window.__refresh = (window.__refresh || 0) + 1; cbk(id, { ok: true, token: 'gt-' + (n++), exp: Date.now() + 3600e3 }); };
  Native.googleSignOut = () => { window.__signout = true; }; Native.googleCancel = () => { };
  Native.openTab = (u) => { window.__tab = u; };
  GCONFIG.appClientId = 'test-app.apps.googleusercontent.com'; GCONFIG.appClientSecret = 'x';
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (vp) => { const p = await b.newPage({ viewport: vp }); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); }); return p; };
  const phone = async () => {
    const p = await mk({ width: 412, height: 915 });
    await p.exposeFunction('fakeNet', (m, u, h, bd) => G.core(m, u, JSON.parse(h), bd));
    await p.goto('file://' + path.join(__dirname, '..', 'android/assets/www/index.html')); await p.waitForTimeout(300);
    await p.evaluate(() => { Cloud.transport = (m, u, h, bd) => window.fakeNet(m, u, JSON.stringify(h), bd); });
    await p.evaluate(mockNative);
    return p;
  };
  const confirmYes = async (p) => { await p.waitForSelector('.sheet.on [data-a=cfOk], .sheet.on .btn.danger, .sheet.on .btn.primary', { timeout: 5000 }); const btn = await p.$('.sheet.on [data-a=cfOk]') || await p.$('.sheet.on .btn.danger') || await p.$('.sheet.on .btn.primary'); await btn.click(); };

  /* 1) main phone on the OLD Firebase sync */
  const P1 = await phone();
  await P1.click('[data-a=obNext]'); await P1.click('[data-a=obNext]'); await P1.click('[data-a=obDemo]'); await P1.click('[data-a=obFinish]');
  await P1.evaluate(async () => {
    Cloud.device = 'phone'; await Cloud.signIn('me@test.com', 'pw123456');
    await Cloud.setupKey('correct horse battery', { allowCreate: true, extractable: true });
    Store.S.sync = { enabled: true, email: Cloud.auth.email, uid: Cloud.auth.uid, refreshToken: Cloud.auth.refreshToken, keyRaw: await Cloud.exportRaw(Cloud.key), lastPush: 0, lastN: 0 };
    Store.saveNow(); await App.cloudInit(); await App.cloudTick(true);
  });
  ok('firebase has the old encrypted copy', [...G.FB.keys()].some((k) => k.includes('/vault/')));
  const nTx = await P1.evaluate(() => Object.keys(Store.S.txns).length);

  /* 2) migrate to Google Drive */
  await P1.evaluate(() => { App.go('more'); App.push('websync'); }); await P1.waitForTimeout(300);
  await P1.screenshot({ path: 'test/shots/d-move.png' });
  await P1.click('[data-a=syMove]'); await P1.waitForTimeout(2500);
  await P1.screenshot({ path: 'test/shots/d-move-confirm.png' });
  await confirmYes(P1); await P1.waitForTimeout(1500);
  const vault = [...G.DRIVE.values()].find((f) => f.name === 'clearli-vault.json');
  ok('drive vault uploaded', !!vault);
  ok('firebase copy deleted', ![...G.FB.keys()].some((k) => k.startsWith('users/U1/')));
  ok('phone now on drive', await P1.evaluate(() => Store.S.sync.backend === 'drive' && Store.S.sync.role === 'main' && Store.S.sync.email === 'me@gmail.com'));
  await P1.screenshot({ path: 'test/shots/d-phone-on.png' });

  /* 3) web dashboard: Google sign-in popup → loads phone data */
  const W = await mk({ width: 1440, height: 900 });
  await W.context().route(/googleapis\.com/, G.route);
  await W.context().route('**/js/gconfig.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.GCONFIG={webClientId:'test-web.apps.googleusercontent.com',appClientId:'',appClientSecret:''};" }));
  let tokN = 1;
  await W.context().route(/accounts\.google\.com\/o\/oauth2\/v2\/auth/, (r) => { const u = new URL(r.request().url()); r.fulfill({ status: 302, headers: { location: u.searchParams.get('redirect_uri') + '#access_token=wt-' + (tokN++) + '&expires_in=3599&state=' + u.searchParams.get('state') + '&token_type=Bearer' } }); });
  await W.goto('http://localhost:8124/'); await W.waitForTimeout(600);
  await W.screenshot({ path: 'test/shots/d-web-gate.png' });
  await W.click('#wGo'); await W.waitForTimeout(3000);
  ok('web loaded phone data', (await W.evaluate(() => Object.keys(Store.S.txns || {}).length)) === nTx);
  await W.screenshot({ path: 'test/shots/d-web-home.png' });
  // edit on web → op file in Drive
  const k = await W.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'starbucks'); Store.setEdit(t.k, { cat: 'dining', name: 'Starbucks (web)' }); Store.commit(); return t.k; });
  await W.waitForTimeout(2500);
  ok('web edit saved as op file', [...G.DRIVE.values()].some((f) => f.name.startsWith('clearli-op-')));
  await P1.evaluate(() => App.cloudTick()); await P1.waitForTimeout(1500);
  ok('phone applied web edit', await P1.evaluate((k) => (Store.S.edits[k] || {}).name === 'Starbucks (web)', k));
  ok('op file cleaned up', ![...G.DRIVE.values()].some((f) => f.name.startsWith('clearli-op-')));
  // web token expired → cached copy + Continue
  await W.evaluate(() => { const t = JSON.parse(localStorage.getItem('clearli.gtok')); t.exp = Date.now() - 1000; localStorage.setItem('clearli.gtok', JSON.stringify(t)); });
  await W.reload(); await W.waitForTimeout(2000);
  ok('expired token shows cached data', await W.evaluate(() => !!(Store.V && Store.V.list.length) && CW.status === 'signin'));
  await W.screenshot({ path: 'test/shots/d-web-paused.png' });
  await W.click('[data-a=wRenew]'); await W.waitForTimeout(2500);
  ok('continue renews session', await W.evaluate(() => CW.status === 'ok'));

  /* 4) household phone joins with the same Google account */
  const P2 = await phone();
  await P2.click('[data-a=obNext]'); await P2.click('[data-a=obNext]');
  await P2.click('[data-a=obJoin]'); await P2.waitForTimeout(200);
  await P2.screenshot({ path: 'test/shots/d-join.png' });
  await P2.click('[data-a=joinGo]'); await P2.waitForTimeout(2500);
  ok('member joined via Google', await P2.evaluate(() => Store.S.sync && Store.S.sync.role === 'member' && Store.S.sync.backend === 'drive' && Object.keys(Store.S.txns).length > 0));
  await P2.evaluate(() => { const t = Store.V.list.find((x) => x.m === 'netflix') || Store.V.list[5]; window.__k2 = t.k; Store.setEdit(t.k, { note: 'from wife' }); Store.commit(); });
  await P2.waitForTimeout(2500);
  await P1.evaluate(() => App.cloudTick()); await P1.waitForTimeout(1500);
  const k2 = await P2.evaluate(() => window.__k2);
  ok('main phone got member edit', await P1.evaluate((k) => (Store.S.edits[k] || {}).note === 'from wife', k2));
  // silent refresh: force a 401 once → phone asks native for a fresh token, no sign-in UI
  await P2.evaluate(() => { Drive.tok = { t: 'gt-expired', exp: Date.now() + 3600e3 }; window.__signins = 0; });
  await P2.evaluate(() => App.cloudTick(true)); await P2.waitForTimeout(1500);
  ok('401 → silent token refresh, no sign-in', await P2.evaluate(() => window.__signins === 0 && window.__refresh > 0 && !Store.S.sync.lastErr));

  /* 5) SimpleFIN in-app: copied setup token is picked up when the page closes (a new user: empty Drive) */
  G.DRIVE.clear();
  const P3 = await phone();
  ok('signed out: SimpleFIN sync is blocked', await P3.evaluate(async () => { Store.S.settings.demo = false; Native.hasCredential = () => true; let called = 0; Native.fetchAccounts = () => { called++; }; const r = await Store.sync(); return r.signin === true && called === 0; }));
  await P3.evaluate(() => { Native.hasCredential = () => false; });
  await P3.click('[data-a=obNext]'); await P3.click('[data-a=obNext]');
  await P3.screenshot({ path: 'test/shots/d-sfin.png' });
  await P3.click('[data-a=obBridge]');
  ok('SimpleFIN opened in-app', await P3.evaluate(() => window.__tab === 'https://bridge.simplefin.org/'));
  const tok = Buffer.from('https://bridge.simplefin.org/simplefin/claim/DEMO123').toString('base64');
  await P3.evaluate((t) => { Native.clipboard = () => t; Native.claimToken = (x, id) => { window.__claimed = x; }; App.onTabClosed(); }, tok);
  await P3.waitForTimeout(1200);
  ok('Google sign-in happened before connecting', await P3.evaluate(() => window.__signins === 1 && Store.S.sync && Store.S.sync.role === 'main'));
  ok('token picked up and connect started', await P3.evaluate((t) => window.__claimed === t, tok));

  /* 6) web-first: someone with no phone app signs in on the web and imports a bank file from any country */
  G.DRIVE.clear();
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const W2 = await ctx2.newPage(); W2.on('pageerror', (e) => errs.push(e.message));
  await ctx2.route(/googleapis\.com/, G.route);
  await ctx2.route('**/js/gconfig.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "window.GCONFIG={webClientId:'test-web.apps.googleusercontent.com',appClientId:'',appClientSecret:''};" }));
  await ctx2.route(/accounts\.google\.com\/o\/oauth2\/v2\/auth/, (r) => { const u = new URL(r.request().url()); r.fulfill({ status: 302, headers: { location: u.searchParams.get('redirect_uri') + '#access_token=wt-' + (tokN++) + '&expires_in=3599&state=' + u.searchParams.get('state') + '&token_type=Bearer' } }); });
  await W2.goto('http://localhost:8124/'); await W2.waitForTimeout(600);
  await W2.click('#wGo'); await W2.waitForTimeout(2000);
  ok('no data yet → web-first welcome', !!(await W2.$('#wFresh')));
  await W2.screenshot({ path: 'test/shots/d-web-welcome.png' });
  await W2.click('#wFresh'); await W2.waitForTimeout(2000);
  const vault2 = () => [...G.DRIVE.values()].find((f) => f.name === 'clearli-vault.json');
  ok('web created its own vault in Drive', !!vault2() && vault2().appProperties.by === 'web' && (await W2.evaluate(() => CW.role)) === 'main');
  await W2.screenshot({ path: 'test/shots/d-web-empty.png' });
  // a German bank export: semicolons, day-first dates, decimal commas, Windows-1252 encoding
  const de = 'Buchungstag;Valuta;Buchungstext;Verwendungszweck;Betrag;W\xe4hrung\r\n06.10.2026;06.10.2026;Lastschrift;REWE Markt Berlin;-23,45;EUR\r\n05.10.2026;05.10.2026;Gutschrift;Gehalt Oktober;2.500,00;EUR\r\n01.10.2026;01.10.2026;Dauerauftrag;Miete Oktober;-1.150,00;EUR\r\n';
  await W2.evaluate((bytes) => {
    const buf = new Uint8Array(bytes).buffer; window.__deText = CW.decodeText(buf);
    Native.importFile = (id) => { const k = 'imp' + Date.now(); const take0 = Native.take; Native.take = (x) => (x === k ? (Native.take = take0, JSON.stringify({ ok: true, content: window.__deText })) : take0(x)); setTimeout(() => __nativeCb(id, k), 0); };
  }, [...Buffer.from(de, 'latin1')]);
  ok('legacy-encoded file decoded', await W2.evaluate(() => window.__deText.includes('Währung')));
  await W2.click('[data-a=importFile]'); await W2.waitForTimeout(600);
  ok('first import defaults to a new everyday account', !!(await W2.$('.sheet.on [data-a=imAcct][data-x=new] .check.on')));
  await W2.fill('.sheet.on [data-x=newName]', 'Girokonto'); await W2.dispatchEvent('.sheet.on [data-x=newName]', 'input');
  await W2.screenshot({ path: 'test/shots/d-web-import.png' });
  await W2.click('.sheet.on [data-a=imGo]'); await W2.waitForTimeout(1500);
  await W2.click('.sheet.on [data-a=impDone]').catch(() => { }); await W2.waitForTimeout(2500);
  const deTx = await W2.evaluate(() => Object.values(Store.S.txns).map((t) => [U.dayKey(t.ts), t.amt]).sort());
  ok('German file parsed (dates, decimal commas)', JSON.stringify(deTx) === JSON.stringify([['2026-10-01', -1150], ['2026-10-05', 2500], ['2026-10-06', -23.45]]));
  const zlib = require('zlib');
  const readVault = () => { const d = JSON.parse(vault2().content); const raw = Buffer.from(d.data, 'base64'); return JSON.parse((d.gz ? zlib.gunzipSync(raw) : raw).toString()); };
  ok('import saved as a snapshot in the user\'s Drive', Object.keys(readVault().txns).length === 3 && ![...G.DRIVE.values()].some((f) => f.name.startsWith('clearli-op-')));
  ok('currency follows the browser region (EUR expected only for EU locales)', (await W2.evaluate(() => Store.S.settings.currency)) === (await W2.evaluate(() => CW.guessCurrency())));
  await W2.screenshot({ path: 'test/shots/d-web-first-home.png' });
  // an edit made elsewhere (op file) is merged into the web's snapshot
  const k3 = Object.keys(readVault().txns)[0];
  const opBody = JSON.stringify({ at: Date.now(), by: 'member', ops: [{ t: 'edit', k: k3, v: { note: 'from another device' } }] });
  G.DRIVE.set('fop', { id: 'fop', name: 'clearli-op-test.json', appProperties: { at: String(Date.now()), by: 'member' }, createdTime: new Date().toISOString(), content: opBody });
  await W2.evaluate(() => CW.refresh(true)); await W2.waitForTimeout(2000);
  ok('web main merged op file and cleaned it up', (readVault().edits[k3] || {}).note === 'from another device' && !G.DRIVE.has('fop'));

  /* 7) the same person installs the phone app later: connecting SimpleFIN signs in, brings the web data over, and the phone takes over */
  const P4 = await phone();
  await P4.click('[data-a=obNext]'); await P4.click('[data-a=obNext]');
  const now = Math.floor(Date.now() / 1000);
  await P4.evaluate((now) => {
    const R = {}; const take0 = Native.take; Native.take = (k) => (k in R ? (() => { const v = R[k]; delete R[k]; return v; })() : take0(k));
    const cbk = (id, o) => { const k = 's' + Math.random().toString(36).slice(2); R[k] = JSON.stringify(o); setTimeout(() => __nativeCb(id, k), 30); };
    let cred = false;
    Native.hasCredential = () => cred; Native.accessHost = () => (cred ? 'beta-bridge.simplefin.org' : null);
    Native.claimToken = (t, id) => { cred = true; cbk(id, { ok: true }); };
    Native.fetchAccounts = (a, b2, bo, id) => cbk(id, { ok: true, body: JSON.stringify({ errlist: [], connections: [{ conn_id: 'CON-1', name: 'Chase', org_id: 'chase', sfin_url: 'https://x' }], accounts: [{ id: 'ACT-1', name: 'Chase Checking', conn_id: 'CON-1', currency: 'USD', balance: '100.00', 'balance-date': now, transactions: [{ id: 'T1', posted: now - 86400, amount: '-4.50', description: 'STARBUCKS STORE 1234' }] }] }) });
    Native.decodeToken = () => 'https://beta-bridge.simplefin.org/simplefin/claim/X';
  }, now);
  await P4.evaluate(() => { UI.actions.obTok('dGVzdHRva2VuMTIzNDU2Nzg5MA=='); UI.actions.obConnect(); }); await P4.waitForTimeout(4000);
  ok('phone brought in web data and added SimpleFIN', await P4.evaluate(() => Store.S.sync.role === 'main' && Object.values(Store.S.txns).some((t) => t.amt === -1150) && Object.values(Store.S.txns).some((t) => t.amt === -4.5)));
  ok('vault now kept by the phone', vault2().appProperties.by === 'phone' && Object.keys(readVault().txns).length === 4);
  await W2.evaluate(() => CW.refresh(true)); await W2.waitForTimeout(2000);
  ok('web switched to following the phone', await W2.evaluate(() => CW.role === 'member' && Object.keys(Store.S.txns).length === 4));
  await W2.evaluate((k) => { Store.setEdit(k, { name: 'Rent (web)' }); Store.commit(); }, k3); await W2.waitForTimeout(2500);
  ok('web edit after takeover goes as op file', [...G.DRIVE.values()].some((f) => f.name.startsWith('clearli-op-')) && vault2().appProperties.by === 'phone');
  await ctx2.close();

  console.log('drive requests', G.stats.driveReq);
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close(); srv.close();
})();

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.join(__dirname, '..', 'web', 'dist');
const srv = http.createServer((q, s) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const t = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream'; s.writeHead(200, { 'content-type': t }); s.end(d); }); }).listen(8124);
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[2000, 1100], [1280, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8124/'); await p.waitForTimeout(1200);
    await p.screenshot({ path: `test/shots/wl-signin-${w}.png` });
    // inject demo data directly (bypass cloud)
    await p.evaluate(() => { Store.loadDemo(); const S = Store.S; S.settings.onboarded = true; CW.start(JSON.parse(JSON.stringify(S))); });
    await p.waitForTimeout(800);
    for (const [tab, seg] of [['home'], ['reports', 'overview'], ['reports', 'income'], ['reports', 'trends'], ['activity'], ['calendar']]) {
      await p.evaluate(([t, s]) => { if (t === 'reports' && s) App.rep.seg = s; if (t === 'plan' && s) App.plan.seg = s; App.go(t); App.render(true); }, [tab, seg]);
      for (const y of [0, 900, 1800]) { await p.evaluate((y) => document.getElementById('view').scrollTo(0, y), y); await p.waitForTimeout(600); await p.screenshot({ path: `test/shots/wl-${w}-${tab}${seg ? '-' + seg : ''}-${y}.png` }); }
    }
    console.log(w, errs.length ? errs : 'NO ERRORS');
    await p.close();
  }
  await b.close(); srv.close();
})();

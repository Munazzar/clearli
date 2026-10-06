global.window = global; const fs = require('fs'); for (const f of ['icons.js','util.js','engine.js']) eval(fs.readFileSync('android/assets/www/js/' + f, 'utf8'));
const DAY = 864e5; const S = { cats: E.DEFAULT_CATS, rules: [], edits: {}, recurringOverrides: {}, accounts: { A: { id: 'A', conn: 'c' } }, txns: {} };
let i = 0; const add = (ts, amt, desc) => { S.txns['A:' + (++i)] = { id: String(i), acct: 'A', ts, amt, desc }; };
const now = Date.now();
for (let m = 0; m < 8; m++) { const d = now - (m * 30.4 + 3) * DAY; add(d, -2.99, 'APPLE.COM/BILL'); add(d + 3600e3, -10.99, 'APPLE.COM/BILL'); }
for (let m = 0; m < 8; m++) { const d = now - (m * 30.4 + 10) * DAY; add(d, m < 3 ? -22.99 : -15.49, 'NETFLIX.COM'); }
const V = E.derive(S);
for (const r of V.recurring) console.log(r.key, '|', r.name, r.freq, r.amount, r.count, r.priceChange ? `hike ${r.priceChange.from}->${r.priceChange.to}` : 'no hike');
// utilities vary but one bill per month -> single series
for (let m = 0; m < 8; m++) add(now - (m * 30.4 + 5) * DAY, -(60 + (m % 3) * 25), 'COMED ELECTRIC');
// same company, two services with close prices (14.99 & 17.99) billed monthly
for (let m = 0; m < 6; m++) { add(now - (m * 30.4 + 12) * DAY, -14.99, 'GOOGLE *YOUTUBE'); add(now - (m * 30.4 + 14) * DAY, -17.99, 'GOOGLE *YOUTUBE'); }
S.recurringOverrides = { 'youtube#18|name': 'YouTube TV add-on', 'youtube#18|cat': 'entertainment' };
const V2 = E.derive(S);
console.log('---');
for (const r of V2.recurring) console.log(r.key, '|', r.name, r.cat, r.amount, r.count, r.priceChange ? 'hike' : '');
console.log('tx names:', [...new Set(V2.list.filter((t) => t.m === 'youtube').map((t) => t.name + '/' + t.cat))]);

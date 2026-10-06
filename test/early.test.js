global.window = global; const fs = require('fs'); for (const f of ['icons.js','util.js','engine.js']) eval(fs.readFileSync('android/assets/www/js/' + f, 'utf8'));
const S = { settings: {}, cats: E.DEFAULT_CATS, rules: [], edits: {}, recurringOverrides: {}, accounts: { A: { id: 'A', conn: 'c' } }, txns: {} };
const add = (k, d, amt) => S.txns[k] = { id: k, acct: 'A', ts: +d, amt, desc: 'ACME CORP PAYROLL' };
add('1', new Date(2026, 4, 1, 9), 5000); add('2', new Date(2026, 5, 1, 9), 5000); add('3', new Date(2026, 5, 30, 9), 5000); add('4', new Date(2026, 7, 29, 9), 5000);
let V = E.derive(S);
for (const t of V.list) console.log(new Date(t.ts).toDateString(), '-> counts in', U.fmtMonth(t.rts), t.shifted ? '(shifted)' : '');
const aug = E.totals(E.inRange(V.list, new Date(2026, 7, 1), new Date(2026, 8, 1))).income, sep = E.totals(E.inRange(V.list, new Date(2026, 8, 1), new Date(2026, 9, 1))).income;
console.log('Aug income', aug, 'Sep income', sep);
S.edits['4'] = { month: 'this' }; V = E.derive(S); console.log('manual this-month:', U.fmtMonth(V.byKey['4'].rts));

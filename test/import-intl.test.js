// Bank files from around the world: number formats, month names, local-language headers.
global.window = global; global.U = { DAY: 864e5, icon: () => '', mean: (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1) }; global.App = {}; global.UI = { on: () => {} };
require(require('path').join(__dirname, '..', 'android/assets/www/js/importer.js'));
let bad = 0; const eq = (label, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : ' got ' + JSON.stringify(a))); };
const I = window.IMP;
const cases = [['1,234.56', 1234.56], ['1.234,56', 1234.56], ['-12,50', -12.5], ['12,50-', -12.5], ['€ 1.234,56', 1234.56], ['R$ -45,90', -45.9], ['1\'234.50', 1234.5], ['(45.00)', -45], ['45.00 DR', -45], ['¥1,200', 1200], ['₩15,000', 15000], ['-1,234', -1234], ['abc', NaN], ['INR 2,50,000.00', 250000]];
for (const [s, v] of cases) { const r = I.parseAmt(s); eq('amount ' + s, isNaN(r) ? 'NaN' : r, isNaN(v) ? 'NaN' : v); }
const d = (s, f) => { const t = I.parseDate(s, f); return t ? new Date(t).toISOString().slice(0, 10) : null; };
eq('month-name dates', [d('06 Oct 2026'), d('6-Okt-26'), d('Oct 6, 2026'), d('06.10.2026', 'DMY'), d('2026-10-06'), d('15 déc. 2025'), d('3 mars 2026')], ['2026-10-06', '2026-10-06', '2026-10-06', '2026-10-06', '2026-10-06', '2025-12-15', '2026-03-03']);
eq('format guesses', [I.guessDateFmt(['06.10.2026', '07.10.2026']), I.guessDecimal(['-12,50', '1.234,56', '3,00']), I.guessDecimal(['-12.50'])], ['DMY', ',', '.']);
const de = 'Buchungstag;Valuta;Buchungstext;Verwendungszweck;Betrag;Währung\n06.10.2026;06.10.2026;Lastschrift;REWE Markt Berlin;-23,45;EUR\n05.10.2026;05.10.2026;Gutschrift;Gehalt Oktober;2.500,00;EUR\n';
const D = I.detect(I.parseCSV(de)); eq('German columns', [D.map.date, D.map.desc, D.map.amount], [0, 3, 4]);
const fr = 'Date opération;Libellé;Débit;Crédit\n06/10/2026;CARTE CARREFOUR;45,20;\n05/10/2026;VIR SALAIRE;;2 100,00\n';
const F = I.detect(I.parseCSV(fr)); eq('French columns', [F.map.date, F.map.desc, F.map.debit, F.map.credit], [0, 1, 2, 3]);
const o = { map: F.map, amountMode: 'split', dateFmt: I.guessDateFmt(F.body.map((r) => r[F.map.date]), 'DMY'), decimal: I.guessDecimal(F.body.flatMap((r) => [r[F.map.debit], r[F.map.credit]].filter(Boolean))) };
eq('French rows', I.build({ kind: 'csv', csv: F }, o).map((r) => [new Date(r.date).toISOString().slice(0, 10), r.desc, r.amt]), [['2026-10-06', 'CARTE CARREFOUR', -45.2], ['2026-10-05', 'VIR SALAIRE', 2100]]);
const inr = 'Txn Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance\n06/10/26,UPI-SWIGGY,450.00,,10550.00\n05/10/26,NEFT SALARY,,"1,00,000.00",11000.00\n';
const N = I.detect(I.parseCSV(inr)); eq('Indian columns', [N.map.date, N.map.desc, N.map.debit, N.map.credit, N.map.balance], [0, 1, 2, 3, 4]);
eq('Indian rows (lakh grouping)', I.build({ kind: 'csv', csv: N }, { map: N.map, amountMode: 'split', dateFmt: 'DMY', decimal: '.' }).map((r) => [r.desc, r.amt]), [['UPI-SWIGGY', -450], ['NEFT SALARY', 100000]]);
console.log(bad ? bad + ' FAILED' : 'ALL PASS'); process.exit(bad ? 1 : 0);

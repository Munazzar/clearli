global.window = global; global.App = {}; global.UI = { on() {} }; global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
const fs = require('fs'); for (const f of ['icons.js', 'util.js', 'engine.js', 'store.js', 'importer.js']) eval(fs.readFileSync('android/assets/www/js/' + f, 'utf8'));
const S = Store.S; const DAY = 864e5; const now = Date.now();
S.conns.c = { id: 'c', name: 'Chase' };
S.accounts.card = { id: 'card', name: 'Sapphire', conn: 'c', type: 'credit', balance: -100 };
// SimpleFIN-synced overlap: Starbucks on Jul 5 2026 already present
S.txns['card:sf1'] = { id: 'sf1', acct: 'card', ts: +new Date(2026, 6, 5, 12), amt: -6.45, desc: 'STARBUCKS STORE 12345' };
S.txns['card:sf2'] = { id: 'sf2', acct: 'card', ts: +new Date(2026, 6, 6, 12), amt: -30, desc: 'KABOB HOUSE' };
S.edits['card:sf2'] = { cat: 'groceries', name: 'Kabob House (family)' };
Store.recompute();
const chaseCard = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
07/04/2026,07/05/2026,STARBUCKS STORE 12345,Food & Drink,Sale,-6.45,
06/20/2026,06/21/2026,KABOB HOUSE,Food & Drink,Sale,-28.10,
06/15/2026,06/15/2026,Payment Thank You-Mobile,,Payment,1250.00,
06/10/2026,06/11/2026,"SOME NEW SHOP, INC",Shopping,Sale,-99.99,
06/10/2026,06/11/2026,"SOME NEW SHOP, INC",Shopping,Sale,-99.99,
05/02/2026,05/03/2026,AMAZON MKTPL*2K3LL0,Shopping,Return,23.99,
`;
const chaseChk = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,06/26/2026,"COMED ELECTRIC PAYMENT PPD ID: 123",-84.12,ACH_DEBIT,3150.12,,
CREDIT,06/25/2026,"ACME CORP PAYROLL PPD ID: 4455",3150.44,ACH_CREDIT,3234.24,,
`;
const amex = `Date,Description,Card Member,Account #,Amount
06/03/2026,UBER *EATS,JOHN DOE,-11007,24.50
06/02/2026,ONLINE PAYMENT - THANK YOU,JOHN DOE,-11007,-500.00
06/01/2026,NETFLIX.COM,JOHN DOE,-11007,22.99
`;
const ofx = `OFXHEADER:100\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260520120000[-5:EST]<TRNAMT>-45.20<FITID>A1<NAME>SHELL OIL 574<MEMO>GAS</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260521<TRNAMT>100.00<FITID>A2<NAME>REFUND</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>-812.44<DTASOF>20260601</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
const mk = (text) => { const rows = IMP.parseCSV(text); return { kind: 'csv', csv: IMP.detect(rows), preset: IMP.detect(rows).preset }; };
for (const [n, t] of [['chaseCard', chaseCard], ['chaseChk', chaseChk], ['amex', amex]]) { const P = mk(t); console.log(n, P.preset, JSON.stringify(P.csv.map), P.csv.headers.length, P.csv.body[0].length); }
const P = mk(chaseCard);
const o = { acct: 'card', map: P.csv.map, amountMode: 'single', dateFmt: 'MDY', flip: false, range: 'all', dupes: 'skip', bankCats: true, payments: true };
const rows = IMP.build(P, o);
console.log(IMP.plan(rows, o).map((x) => x.status + ' ' + x.r.desc + ' ' + x.r.amt));
console.log('before-range:', IMP.plan(rows, Object.assign({}, o, { range: 'before' })).map((x) => x.status).join(','));
const A = mk(amex); const ar = IMP.build(A, { map: A.csv.map, amountMode: 'single', dateFmt: 'MDY', flip: true });
console.log('amex', ar.map((r) => r.desc + ' ' + r.amt));
const O = IMP.parseOFX(ofx); console.log('ofx', O.rows, O.balance, O.isCard);
// run import core without UI: emulate runImport write
(async () => {
  global.UI = { on() {}, closeSheet() {}, sheet: () => ({ el: { querySelector: () => null }, o: {} }) };
  // simulate import writes directly via plan
  const plan = IMP.plan(rows, o).filter((x) => x.status === 'new');
  for (const { r, key } of plan) S.txns[key] = { id: key, acct: 'card', ts: r.date, amt: r.amt, desc: r.desc, imp: 'b1', bankCat: IMP.bankCat(r.cat) || undefined };
  S.txns[plan.find((x) => /Payment/.test(x.r.desc)).key].bankCat = 'transfer';
  Store.recompute();
  console.log(Store.V.list.filter((t) => t.imp).map((t) => `${t.name} | ${t.cat} (${t.catSrc})`));
  console.log('reimport same file:', IMP.plan(rows, o).map((x) => x.status).join(','));
})();

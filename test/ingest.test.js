global.window = global; global.localStorage = { _: {}, getItem(k){return this._[k]||null}, setItem(k,v){this._[k]=v}, removeItem(k){delete this._[k]} };
global.atob = (s)=>Buffer.from(s,'base64').toString('binary');
const fs=require('fs'); const W='android/assets/www/js/';
for (const f of ['icons.js','util.js','engine.js','store.js']) eval(fs.readFileSync(W+f,'utf8'));
const now = Math.floor(Date.now()/1000), d = 86400;
const v2 = { errlist: [{code:'con.auth', msg:'Chase needs re-authentication', conn_id:'CON-1'}], connections: [{conn_id:'CON-1', name:'Chase', org_id:'chase', sfin_url:'https://x'}],
  accounts: [{ id:'ACT-1', name:'Chase Checking', conn_id:'CON-1', currency:'USD', balance:'1234.56', 'available-balance':'1200.00', 'balance-date': now,
    transactions: [
      { id:'T1', posted: now-3*d, amount:'-4.50', description:'STARBUCKS STORE 1234' },
      { id:'T2', posted: 0, amount:'-12.00', description:'NETFLIX.COM', pending:true, transacted_at: now-1*d },
      { id:'T3', posted: now-10*d, amount:'2500.00', description:'ACME PAYROLL' },
      { id:'T4', posted: now-4*d, amount:'-4.75', description:'SQ *LOCAL BEANS' },
      { id:'T5', posted: now-9*d, amount:'-5.25', description:'SQ *LOCAL BEANS' },
    ] }] };
const v1 = { errors: ['Old-style warning'], accounts: [{ org: { domain:'amex.com', name:'American Express', 'sfin-url':'https://x' }, id:'ACT-2', name:'Amex Gold', currency:'USD', balance:'-500.10', 'balance-date': now,
  transactions: [{ id:'A1', posted: now-2*d, amount:'-60.00', description:'UBER *EATS' }] }] };
let r = Store.ingest(v2, {a:(now-90*d)*1000, b:(now+d)*1000}); console.log('v2', r);
r = Store.ingest(v1, null); console.log('v1', r);
Store.recompute();
console.log(Object.values(Store.S.accounts).map(a=>[a.name,a.conn,a.type,a.balance,a.avail]));
console.log(Object.values(Store.S.conns));
console.log(Store.V.list.map(t=>[t.name,t.cat,t.amt,t.pending, new Date(t.ts).toISOString().slice(0,10)]));
// re-ingest: pending replaced by posted w/ different id
v2.accounts[0].transactions[1] = { id:'T2P', posted: now, amount:'-12.00', description:'NETFLIX.COM', transacted_at: now-1*d };
r = Store.ingest(v2, {a:(now-90*d)*1000, b:(now+d)*1000}); Store.recompute();
console.log('after posting', Store.V.list.filter(t=>t.m==='netflix').map(t=>[t.k,t.pending]));
// learning: manual category twice -> learned rule
const beans = Store.V.list.filter(t=>t.m==='local beans');
console.log('beans key', beans.map(t=>t.cat));
Store.setEdit(beans[0].k,{cat:'dining'}); Store.recompute(); console.log('learn1', E.learn(Store.S, Store.V, beans[0].k));
Store.setEdit(beans[1].k,{cat:'dining'}); Store.recompute(); console.log('learn2', E.learn(Store.S, Store.V, beans[1].k));
Store.S.txns['ACT-1:T9'] = { id:'T9', acct:'ACT-1', ts: Date.now(), amt:-3, desc:'SQ *LOCAL BEANS', pending:false };
Store.recompute(); console.log('future beans ->', Store.V.byKey['ACT-1:T9'].cat, Store.V.byKey['ACT-1:T9'].catSrc);
console.log('decode demo', Native.decodeToken('aHR0cHM6Ly9iZXRhLWJyaWRnZS5zaW1wbGVmaW4ub3JnL3NpbXBsZWZpbi9jbGFpbS9ERU1PLXYyLUMyNDkxOEQ0NUQxMEYyQTNGQjUz'));
console.log('csv', Store.csv(Store.V.list).split('\n').slice(0,3).join('\n'));

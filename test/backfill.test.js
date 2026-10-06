global.window = global; const _st = setTimeout; global.setTimeout = (f, ms) => _st(f, ms >= 4000 ? 1 : ms);
const DAY = 86400000; const now = Date.now(); const bankOldest = now - 500 * DAY; let calls = [];
const res = {}; let n = 0;
global.Native = {
  take: (k) => res[k], hasCredential: () => true, loadData: () => null, saveData: () => true, haptic() {},
  fetchAccounts(a, b, bo, id) {
    calls.push([+a * 1000, +b * 1000]);
    const tx = []; for (let t = +a * 1000; t < +b * 1000; t += 3 * DAY) if (t >= bankOldest) tx.push({ id: 'x' + t, posted: Math.floor(t / 1000), amount: '-10', description: 'STARBUCKS' });
    const k = 'k' + (++n); res[k] = JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ accounts: [{ id: 'A', name: 'Checking', conn_id: 'C', balance: '100', 'balance-date': 1, transactions: tx }], connections: [{ conn_id: 'C', name: 'Bank' }] }) });
    _st(() => __nativeCb(id, k), 1);
  },
};
const fs = require('fs'); for (const f of ['icons.js', 'util.js', 'engine.js', 'store.js']) eval(fs.readFileSync('android/assets/www/js/' + f, 'utf8'));
(async () => {
  let r = await Store.sync({ full: true, days: 90 }); console.log('initial', r.ok, r.added, 'calls', calls.length, 'oldest', new Date(Store.S.oldest).toISOString().slice(0, 10));
  console.log('estimate 3y', Store.backfillEstimate(now - 1095 * DAY));
  console.log('start', Store.backfillStart(now - 1095 * DAY)); calls = [];
  await Store.backfillRun(); let bf = Store.S.backfill;
  console.log('run1', bf.status, bf.msg, 'calls', calls.length, 'quota', Store.S.quota.n, 'cursor', new Date(bf.cursor).toISOString().slice(0, 10));
  console.log('windows <=45d', calls.every(([a, b]) => b - a <= 45 * DAY + 1000), 'contiguous', calls.every((c, i) => !i || c[1] === calls[i - 1][0]));
  // next day
  Store.S.quota = { day: 'yesterday', n: 0 }; calls = [];
  await Store.backfillRun(); bf = Store.S.backfill;
  console.log('run2', bf.status, 'active', bf.active, 'calls', calls.length, Store.S.syncLog[0].msg);
  console.log('txns', Object.keys(Store.S.txns).length);
  // tiny range guard
  console.log('tiny', Store.backfillStart(Store.S.oldest - DAY));
})();

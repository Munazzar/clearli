/* Clearli — end-to-end encrypted sync over Firebase (Auth + Firestore REST, no SDK).
   Google only ever stores ciphertext. Key = PBKDF2(passphrase, salt) → AES-256-GCM.
   Layout: users/{uid}/meta/keys   {salt, iter, check}          (no financial data)
           users/{uid}/meta/state  {version, n, iv, gz, bytes, at, by}
           users/{uid}/vault/{i}   {v, data}                   (encrypted snapshot pieces)
           users/{uid}/ops/{id}    {iv, data, at, by}          (encrypted edits from other devices) */
(function () {
  const C = {};
  C.config = { apiKey: 'AIzaSyCS-0KlTsou9WkiECSNQfenGTwve4Dnu9I', projectId: 'clearli-8c132' };
  C.CHUNK = 900000;
  C.ITER = 310000;
  C.auth = null; // {uid, email, idToken, refreshToken, exp}
  C.key = null; // CryptoKey
  C.device = 'web';

  /* ---------- transport: native on Android (WebView has no network), fetch on the web ---------- */
  C.http = function (method, url, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    let body = null;
    if (opts.form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = Object.entries(opts.form).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'); }
    else if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
    else if (opts.raw !== undefined) body = opts.raw;
    const parse = (status, text) => { let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { } return { status, json: j, text }; };
    if (C.transport) return C.transport(method, url, headers, body).then((r) => parse(r.status, r.body));
    if (window.Native && window.Native.https && Store.N.isNative) {
      return Store.N.call('https', method, url, JSON.stringify(headers), body || '').then((r) => { if (!r.ok && !r.status) throw new Error(r.error || 'Network error'); return parse(r.status, r.body); });
    }
    return fetch(url, { method, headers, body }).then((r) => r.text().then((t) => parse(r.status, t)));
  };

  /* ---------- auth ---------- */
  const AUTH_ERR = { INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.', EMAIL_NOT_FOUND: 'No account with that email.', INVALID_PASSWORD: 'Wrong email or password.', USER_DISABLED: 'This account is disabled.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts — try again in a few minutes.', OPERATION_NOT_ALLOWED: 'Email/Password sign-in is not enabled in Firebase.', INVALID_EMAIL: 'That email address looks wrong.' };
  const errOf = (r) => { const m = r.json && r.json.error && r.json.error.message || ('HTTP ' + r.status); const k = m.split(' ')[0].split(':')[0]; return AUTH_ERR[k] || m; };
  C.signIn = async function (email, password) {
    const r = await C.http('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + C.config.apiKey, { json: { email, password, returnSecureToken: true } });
    if (r.status !== 200) throw new Error(errOf(r));
    const j = r.json;
    C.auth = { uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 };
    return C.auth;
  };
  C.token = async function () {
    if (!C.auth) throw new Error('Not signed in');
    if (C.auth.idToken && Date.now() < C.auth.exp - 60000) return C.auth.idToken;
    const r = await C.http('POST', 'https://securetoken.googleapis.com/v1/token?key=' + C.config.apiKey, { form: { grant_type: 'refresh_token', refresh_token: C.auth.refreshToken } });
    if (r.status !== 200) { const e = new Error(errOf(r)); e.auth = true; throw e; }
    const j = r.json;
    C.auth.idToken = j.id_token; C.auth.refreshToken = j.refresh_token; C.auth.uid = j.user_id; C.auth.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    if (C.onAuth) C.onAuth(C.auth);
    return C.auth.idToken;
  };

  /* ---------- Firestore REST ---------- */
  const base = () => `https://firestore.googleapis.com/v1/projects/${C.config.projectId}/databases/(default)/documents`;
  const docName = (p) => `projects/${C.config.projectId}/databases/(default)/documents/${p}`;
  const toF = (o) => { const f = {}; for (const k in o) { const v = o[k]; if (typeof v === 'number') f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; else if (typeof v === 'boolean') f[k] = { booleanValue: v }; else if (v != null) f[k] = { stringValue: String(v) }; } return { fields: f }; };
  const fromF = (d) => { const o = {}; const f = (d && d.fields) || {}; for (const k in f) { const v = f[k]; o[k] = 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : v.stringValue; } if (d && d.name) o._id = d.name.split('/').pop(); return o; };
  // A missing document is also a 404 whose message mentions "databases/(default)" — only this wording means the database itself is missing.
  const noDb = (r) => r.status === 404 && /does not exist for project/i.test(r.text || '');
  const fsErr = (r) => { const m = (r.json && r.json.error && (r.json.error.message || r.json.error.status)) || 'HTTP ' + r.status; return new Error(r.status === 403 ? 'Firestore denied access — check the security rules.' : noDb(r) ? 'Firestore database not created yet.' : 'Cloud error: ' + m); };
  C.get = async function (path) {
    const r = await C.http('GET', base() + '/' + path, { headers: { Authorization: 'Bearer ' + await C.token() } });
    if (r.status === 404 && !noDb(r)) return null;
    if (r.status !== 200) throw fsErr(r);
    return fromF(r.json);
  };
  C.list = async function (path) {
    const out = []; let page = '';
    do {
      const r = await C.http('GET', base() + '/' + path + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), { headers: { Authorization: 'Bearer ' + await C.token() } });
      if (r.status !== 200) throw fsErr(r);
      (r.json.documents || []).forEach((d) => out.push(fromF(d)));
      page = r.json.nextPageToken || '';
    } while (page);
    return out;
  };
  C.commit = async function (writes) {
    for (let i = 0; i < writes.length; i += 400) {
      const w = writes.slice(i, i + 400).map((x) => (x.del ? { delete: docName(x.del) } : { update: Object.assign({ name: docName(x.path) }, toF(x.data)) }));
      const r = await C.http('POST', base() + ':commit', { headers: { Authorization: 'Bearer ' + await C.token() }, json: { writes: w } });
      if (r.status !== 200) throw fsErr(r);
    }
  };
  const U_ = () => 'users/' + C.auth.uid;

  /* ---------- crypto ---------- */
  const enc = new TextEncoder(); const dec = new TextDecoder();
  C.b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  C.unb64 = (s) => { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
  C.deriveKey = async function (pass, saltB64, iter, extractable) {
    const km = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: C.unb64(saltB64), iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, !!extractable, ['encrypt', 'decrypt']);
  };
  C.importRaw = (b64) => crypto.subtle.importKey('raw', C.unb64(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  C.exportRaw = async (k) => C.b64(await crypto.subtle.exportKey('raw', k));
  C.encrypt = async function (bytes, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key || C.key, bytes);
    return { iv: C.b64(iv), data: C.b64(ct) };
  };
  C.decrypt = async function (ivB64, dataB64, key) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: C.unb64(ivB64) }, key || C.key, C.unb64(dataB64)));
  };
  const stream = async (bytes, S) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(S)).arrayBuffer());
  C.gz = typeof CompressionStream === 'function';
  C.zip = (str) => (C.gz ? stream(enc.encode(str), new CompressionStream('gzip')) : Promise.resolve(enc.encode(str)));
  C.unzip = async (bytes, gz) => dec.decode(gz ? await stream(bytes, new DecompressionStream('gzip')) : bytes);

  /* Sets up (first device) or verifies (other devices) the sync passphrase. */
  C.setupKey = async function (pass, opts) {
    opts = opts || {};
    const k = await C.get(U_() + '/meta/keys');
    if (!k) {
      if (!opts.allowCreate) { const e = new Error('No synced data yet. Turn on sync in the Clearli app on your phone first.'); e.noKeys = true; throw e; }
      const salt = C.b64(crypto.getRandomValues(new Uint8Array(16)));
      const key = await C.deriveKey(pass, salt, C.ITER, opts.extractable);
      const chk = await C.encrypt(enc.encode('clearli-ok'), key);
      await C.commit([{ path: U_() + '/meta/keys', data: { salt, iter: C.ITER, check: chk.iv + ':' + chk.data, created: Date.now() } }]);
      C.key = key; return { created: true, salt };
    }
    const key = await C.deriveKey(pass, k.salt, k.iter, opts.extractable);
    const [iv, data] = String(k.check).split(':');
    try { const t = dec.decode(await C.decrypt(iv, data, key)); if (t !== 'clearli-ok') throw 0; } catch (e) { throw new Error('Wrong sync passphrase.'); }
    C.key = key; return { created: false, salt: k.salt };
  };

  /* ---------- snapshot ---------- */
  C.LOCAL_ONLY = ['sync', 'quota', 'backfill'];
  C.LOCAL_SETTINGS = ['lock', 'lockAfter', 'secureScreen', 'onboarded', 'autoSync', 'hideAmounts', 'reduceFx'];
  C.snapshotOf = function (S) {
    const o = {};
    for (const k in S) if (!C.LOCAL_ONLY.includes(k)) o[k] = S[k];
    o.settings = Object.assign({}, S.settings); C.LOCAL_SETTINGS.forEach((k) => delete o.settings[k]);
    return JSON.stringify(o);
  };
  C.pushSnapshot = async function (json, prevN) {
    const bytes = await C.zip(json);
    const e = await C.encrypt(bytes);
    const parts = []; for (let i = 0; i < e.data.length; i += C.CHUNK) parts.push(e.data.slice(i, i + C.CHUNK));
    const version = Date.now();
    const writes = parts.map((p, i) => ({ path: U_() + '/vault/' + i, data: { v: version, i, data: p } }));
    writes.push({ path: U_() + '/meta/state', data: { version, n: parts.length, iv: e.iv, gz: C.gz, bytes: json.length, at: version, by: C.device } });
    for (let i = parts.length; i < (prevN || 0); i++) writes.push({ del: U_() + '/vault/' + i });
    // one atomic commit when it fits (Firestore request limit ~10 MB); otherwise pieces first, meta last
    if (e.data.length < 8.5e6) await C.commit(writes);
    else { await C.commit(writes.filter((w) => !w.path || !/meta\/state$/.test(w.path))); await C.commit(writes.filter((w) => w.path && /meta\/state$/.test(w.path))); }
    return { version, n: parts.length, bytes: json.length, stored: e.data.length };
  };
  C.meta = () => C.get(U_() + '/meta/state');
  C.pullSnapshot = async function (meta) {
    meta = meta || await C.meta();
    if (!meta) return null;
    const docs = (await C.list(U_() + '/vault')).filter((d) => d.v === meta.version).sort((a, b) => a.i - b.i);
    if (docs.length !== meta.n) throw new Error('Sync data is still uploading — try again in a moment.');
    const bytes = await C.decrypt(meta.iv, docs.map((d) => d.data).join(''));
    return { json: await C.unzip(bytes, meta.gz), meta };
  };

  /* ---------- ops (edits made on another device) ---------- */
  C.pushOps = async function (ops) {
    const writes = [];
    let batch = []; let size = 0;
    const flush = async () => { if (!batch.length) return; const e = await C.encrypt(await C.zip(JSON.stringify(batch))); const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); writes.push({ path: U_() + '/ops/' + id, data: { iv: e.iv, data: e.data, at: Date.now(), by: C.device, n: batch.length, gz: C.gz } }); batch = []; size = 0; };
    for (const op of ops) { const s = JSON.stringify(op).length; if (size + s > 600000) await flush(); batch.push(op); size += s; }
    await flush();
    if (writes.length) await C.commit(writes);
    return writes.length;
  };
  C.pullOps = async function () {
    const docs = (await C.list(U_() + '/ops')).sort((a, b) => a.at - b.at);
    const out = [];
    for (const d of docs) { try { out.push({ id: d._id, at: d.at, ops: JSON.parse(await C.unzip(await C.decrypt(d.iv, d.data), d.gz)) }); } catch (e) { out.push({ id: d._id, at: d.at, ops: [], bad: true }); } }
    return out;
  };
  C.deleteOps = (ids) => C.commit(ids.map((id) => ({ del: U_() + '/ops/' + id })));

  /* ---------- diff / apply (shared by web and phone) ---------- */
  C.SECTIONS = ['rules', 'cats', 'goals', 'assets', 'recurringOverrides', 'conns', 'imports', 'reviewed'];
  C.SHARED_SETTINGS = ['apy', 'weekStart', 'currency', 'earlyIncome', 'historyDays'];
  C.ACCT_FIELDS = ['alias', 'type', 'hidden', 'excludeTotals', 'excludeReports'];
  C.baseOf = function (S) {
    return {
      edits: Object.fromEntries(Object.entries(S.edits).map(([k, v]) => [k, JSON.stringify(v)])),
      sec: Object.fromEntries(C.SECTIONS.map((s) => [s, JSON.stringify(S[s] || null)])),
      set: JSON.stringify(C.SHARED_SETTINGS.map((k) => S.settings[k])),
      acct: Object.fromEntries(Object.values(S.accounts).map((a) => [a.id, JSON.stringify(a.manual ? a : C.ACCT_FIELDS.map((f) => a[f]))])),
      txk: new Set(Object.keys(S.txns)),
    };
  };
  C.diff = function (S, B) {
    const ops = [];
    for (const k of new Set([...Object.keys(S.edits), ...Object.keys(B.edits)])) { const v = S.edits[k] ? JSON.stringify(S.edits[k]) : undefined; if (v !== B.edits[k]) ops.push({ t: 'edit', k, v: S.edits[k] || null }); }
    for (const s of C.SECTIONS) { const v = JSON.stringify(S[s] || null); if (v !== B.sec[s]) ops.push({ t: 'sec', s, v: S[s] }); }
    if (JSON.stringify(C.SHARED_SETTINGS.map((k) => S.settings[k])) !== B.set) ops.push({ t: 'set', v: Object.fromEntries(C.SHARED_SETTINGS.map((k) => [k, S.settings[k]])) });
    for (const a of Object.values(S.accounts)) { const v = JSON.stringify(a.manual ? a : C.ACCT_FIELDS.map((f) => a[f])); if (v !== B.acct[a.id]) ops.push({ t: 'acct', id: a.id, v: a.manual ? a : Object.fromEntries(C.ACCT_FIELDS.map((f) => [f, a[f]])), manual: !!a.manual }); }
    for (const id in B.acct) if (!S.accounts[id]) ops.push({ t: 'acctDel', id });
    const add = {}; let nAdd = 0;
    for (const k in S.txns) if (!B.txk.has(k)) { add[k] = S.txns[k]; nAdd++; if (nAdd >= 1500) { ops.push({ t: 'txAdd', v: Object.assign({}, add) }); for (const x in add) delete add[x]; nAdd = 0; } }
    if (nAdd) ops.push({ t: 'txAdd', v: add });
    const del = []; for (const k of B.txk) if (!S.txns[k]) del.push(k);
    if (del.length) ops.push({ t: 'txDel', v: del });
    return ops;
  };
  C.apply = function (S, ops) {
    for (const op of ops) {
      if (op.t === 'edit') { if (op.v) S.edits[op.k] = op.v; else delete S.edits[op.k]; }
      else if (op.t === 'sec') S[op.s] = op.v;
      else if (op.t === 'set') Object.assign(S.settings, op.v);
      else if (op.t === 'acct') { if (op.manual) S.accounts[op.id] = op.v; else if (S.accounts[op.id]) Object.assign(S.accounts[op.id], op.v); }
      else if (op.t === 'acctDel') { if (S.accounts[op.id] && S.accounts[op.id].manual) delete S.accounts[op.id]; }
      else if (op.t === 'txAdd') Object.assign(S.txns, op.v);
      else if (op.t === 'txDel') op.v.forEach((k) => delete S.txns[k]);
    }
  };

  window.Cloud = C;
})();

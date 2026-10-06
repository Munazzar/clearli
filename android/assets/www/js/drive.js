/* Clearli — sync through the user's own Google Drive (hidden app folder, scope drive.appdata).
   No Clearli server and no Firebase: each person's data lives in their own Drive, in a folder only
   Clearli can see. Same sync model as before — the main phone uploads a snapshot, other devices
   send small "ops" files with their edits, the main phone merges them.
     appDataFolder/clearli-vault.json      {app, v, gz, data}   appProperties {version, by}
     appDataFolder/clearli-op-<id>.json    {at, by, ops}        appProperties {at, by}        */
(function () {
  const D = {};
  const API = 'https://www.googleapis.com/drive/v3';
  const UP = 'https://www.googleapis.com/upload/drive/v3';
  D.SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  D.VAULT = 'clearli-vault.json';
  D.SV = 2;              // sync version 2: every signed-in device (web or phone) reads and writes the vault itself
  D.OP = 'clearli-op-';
  D.tok = null;          // {t, exp}
  D.provider = null;     // async (force) => {t, exp}  — native refresh on Android, popup token on the web
  D.vaultId = null;

  D.token = async function (force) {
    if (!force && D.tok && Date.now() < D.tok.exp - 60000) return D.tok.t;
    if (!D.provider) { const e = new Error('Sign in with Google to sync'); e.auth = true; throw e; }
    D.tok = await D.provider(!!force);
    return D.tok.t;
  };
  const errText = (r) => { const e = r.json && r.json.error; const m = (e && (e.message || e.status)) || ('HTTP ' + r.status); return r.status === 403 && /has not been used|disabled/i.test(m) ? 'Google Drive API is not enabled for this app yet.' : r.status === 401 ? 'Google sign-in expired' : 'Drive error: ' + m; };
  async function req(method, url, opts) {
    opts = opts || {};
    for (let a = 0; a < 2; a++) {
      const headers = Object.assign({ Authorization: 'Bearer ' + await D.token(a > 0) }, opts.headers || {});
      const r = await Cloud.http(method, url, { headers, raw: opts.raw, json: opts.json });
      if (r.status === 401 && a === 0) { D.tok = null; continue; }
      if (r.status === 404 && opts.allow404) return null;
      if (r.status >= 400) { const e = new Error(errText(r)); e.status = r.status; if (r.status === 401) e.auth = true; throw e; }
      return r;
    }
  }
  D.req = req;
  const q = (s) => encodeURIComponent(s);
  async function listFiles(query) {
    const out = []; let page = '';
    do {
      const r = await req('GET', `${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,appProperties,createdTime,size)&q=${q(query + ' and trashed=false')}${page ? '&pageToken=' + q(page) : ''}`);
      (r.json.files || []).forEach((f) => out.push(f));
      page = r.json.nextPageToken || '';
    } while (page);
    return out;
  }
  D.listFiles = listFiles;
  // multipart upload: metadata + JSON body in one request (create or update)
  async function upload(id, meta, content) {
    const B = 'clearli' + Math.random().toString(36).slice(2);
    const raw = `--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${B}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${B}--`;
    const r = id
      ? await req('PATCH', `${UP}/files/${id}?uploadType=multipart&fields=id`, { headers: { 'Content-Type': 'multipart/related; boundary=' + B }, raw })
      : await req('POST', `${UP}/files?uploadType=multipart&fields=id`, { headers: { 'Content-Type': 'multipart/related; boundary=' + B }, raw });
    return r.json.id;
  }
  D.email = async function () {
    const r = await req('GET', `${API}/about?fields=user(emailAddress)`);
    return (r.json && r.json.user && r.json.user.emailAddress) || '';
  };

  /* ---------- snapshot ---------- */
  D.meta = async function () {
    const f = (await listFiles(`name='${D.VAULT}'`)).sort((a, b) => Number((b.appProperties || {}).version || 0) - Number((a.appProperties || {}).version || 0))[0];
    if (!f) { D.vaultId = null; return null; }
    D.vaultId = f.id;
    const ap = f.appProperties || {};
    return { version: Number(ap.version) || Date.parse(f.createdTime) || 0, by: ap.by || '', sv: Number(ap.sv) || 1, id: f.id, n: 1, size: Number(f.size) || 0 };
  };
  D.pushSnapshot = async function (json) {
    const bytes = await Cloud.zip(json);
    const content = JSON.stringify({ app: 'clearli', v: 2, gz: Cloud.gz, data: Cloud.b64(bytes) });
    const version = Date.now();
    const props = { appProperties: { version: String(version), by: Cloud.device, sv: String(D.SV) } };
    if (D.vaultId === null) await D.meta();
    let id = null;
    try { id = await upload(D.vaultId, D.vaultId ? props : Object.assign({ name: D.VAULT, parents: ['appDataFolder'], mimeType: 'application/json' }, props), content); }
    catch (e) { if (e.status !== 404) throw e; D.vaultId = null; id = await upload(null, Object.assign({ name: D.VAULT, parents: ['appDataFolder'], mimeType: 'application/json' }, props), content); }
    D.vaultId = id;
    return { version, n: 1, bytes: json.length, stored: content.length };
  };
  D.pullSnapshot = async function (meta) {
    meta = meta || await D.meta();
    if (!meta) return null;
    const r = await req('GET', `${API}/files/${meta.id}?alt=media`);
    const doc = r.json || JSON.parse(r.text);
    return { json: await Cloud.unzip(Cloud.unb64(doc.data), doc.gz), meta };
  };

  /* ---------- ops: edits from the web or a household member phone ---------- */
  D.pushOps = async function (ops) {
    const files = []; let batch = []; let size = 0;
    const flush = () => { if (batch.length) files.push(batch); batch = []; size = 0; };
    for (const op of ops) { const s = JSON.stringify(op).length; if (size + s > 2000000) flush(); batch.push(op); size += s; }
    flush();
    for (const b of files) {
      const at = Date.now(); const id = at.toString(36) + Math.random().toString(36).slice(2, 7);
      await upload(null, { name: D.OP + id + '.json', parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { at: String(at), by: Cloud.device } }, JSON.stringify({ at, by: Cloud.device, ops: b }));
    }
    return files.length;
  };
  D.pullOps = async function () {
    const fs = (await listFiles(`name contains '${D.OP}'`)).map((f) => ({ f, at: Number((f.appProperties || {}).at) || Date.parse(f.createdTime) || 0 })).sort((a, b) => a.at - b.at);
    const out = [];
    for (const { f, at } of fs) {
      try { const r = await req('GET', `${API}/files/${f.id}?alt=media`, { allow404: true }); if (!r) continue; const d = r.json || JSON.parse(r.text); out.push({ id: f.id, at, ops: d.ops || [] }); }
      catch (e) { if (e.auth) throw e; out.push({ id: f.id, at, ops: [], bad: true }); }
    }
    return out;
  };
  D.deleteOps = async function (ids) { for (const id of ids) await req('DELETE', `${API}/files/${id}`, { allow404: true }); };
  D.wipe = async function () {
    const all = await listFiles(`name contains 'clearli'`);
    for (const f of all) await req('DELETE', `${API}/files/${f.id}`, { allow404: true });
    D.vaultId = null;
    return all.length;
  };

  /* ---------- peer sync (sv 2): web and phones are equals ----------
     Each device keeps a fingerprint of what it last saw (base) and the vault version. On sync it pulls the vault if
     another device saved since, re-applies its own edits on top, merges op files left by older devices, and saves.
       o.local    the device's state            o.base / o.version   what it last saw (base null on first sync)
       o.adopt(R) install remote state R, keeping device-only things; returns the new local state
       o.merge(R, local) first sync of a device that already has data: fold it into R; true if anything was added */
  D.peerSync = async function (o) {
    const meta = o.meta !== undefined ? o.meta : await D.meta();
    let S = o.local; let changed = !!o.force; let remote = false;
    if (meta && meta.version !== o.version) {
      const R = JSON.parse((await D.pullSnapshot(meta)).json);
      if (o.base) { const ops = Cloud.diff(S, o.base); Cloud.apply(R, ops); if (ops.length) changed = true; }
      else if (o.merge && o.merge(R, S)) changed = true;
      S = o.adopt(R); remote = true;
    } else if (!meta || !o.base || Cloud.diff(S, o.base).length) changed = true;
    const batches = await D.pullOps();
    for (const b of batches) Cloud.apply(S, b.ops);
    if (batches.length) changed = true;
    let version = meta ? meta.version : 0;
    if (changed) {
      const r = await D.pushSnapshot(Cloud.snapshotOf(S));
      version = r.version;
      if (batches.length) await D.deleteOps(batches.map((b) => b.id));
    }
    return { S, version, base: Cloud.baseOf(S, true), remote, pushed: changed, applied: batches.reduce((n, b) => n + b.ops.length, 0) };
  };
  // A vault last saved by a phone on Clearli 1.4.0 or older: that phone overwrites the vault without merging,
  // so other devices must keep sending op files until it updates.
  D.legacyMain = (meta) => !!(meta && meta.sv < 2 && meta.by === 'phone' && Date.now() - meta.version < 14 * 86400000);

  // Switch the shared sync code (appsync.js / web.js) onto Drive. Firebase functions stay reachable as Cloud.fb.
  D.use = function () {
    if (Cloud.mode === 'drive') return;
    Cloud.fb = { meta: Cloud.meta, pushSnapshot: Cloud.pushSnapshot, pullSnapshot: Cloud.pullSnapshot, pushOps: Cloud.pushOps, pullOps: Cloud.pullOps, deleteOps: Cloud.deleteOps };
    Object.assign(Cloud, { meta: D.meta, pushSnapshot: D.pushSnapshot, pullSnapshot: D.pullSnapshot, pushOps: D.pushOps, pullOps: D.pullOps, deleteOps: D.deleteOps, mode: 'drive' });
  };
  D.unuse = function () { if (Cloud.mode !== 'drive') return; Object.assign(Cloud, Cloud.fb, { mode: 'firebase' }); D.tok = null; D.vaultId = null; };

  window.Drive = D;
})();

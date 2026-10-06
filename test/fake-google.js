// Fake Google services for tests: Firebase (Auth + Firestore REST) and Drive v3 (appDataFolder).
const PFX = 'projects/clearli-8c132/databases/(default)/documents/';
const FB = new Map(); const DRIVE = new Map(); const stats = { driveReq: 0 };
let nid = 1;
const json = (status, o) => ({ status, body: JSON.stringify(o) });
function firebase(method, url, hdrs, body) {
  if (url.host === 'identitytoolkit.googleapis.com') { const b = JSON.parse(body); if (b.email === 'me@test.com' && b.password === 'pw123456') return json(200, { localId: 'U1', email: b.email, idToken: 'tok1', refreshToken: 'r1', expiresIn: '3600' }); return json(400, { error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } }); }
  if (url.host === 'securetoken.googleapis.com') return json(200, { id_token: 'tok2', refresh_token: 'r2', user_id: 'U1', expires_in: '3600' });
  const auth = hdrs['authorization'] || hdrs['Authorization'] || '';
  if (!/Bearer tok[12]/.test(auth)) return json(401, { error: { status: 'UNAUTHENTICATED' } });
  const p = decodeURIComponent(url.pathname).replace('/v1/' + PFX, '');
  if (url.pathname.endsWith(':commit')) { for (const w of JSON.parse(body).writes) { const n = (w.update ? w.update.name : w.delete).replace(PFX, ''); if (w.update) FB.set(n, { name: w.update.name, fields: w.update.fields }); else FB.delete(n); } return json(200, { writeResults: [] }); }
  const segs = p.split('/');
  if (segs.length % 2 === 1) { const docs = [...FB.entries()].filter(([k]) => k.startsWith(p + '/') && k.split('/').length === segs.length + 1).map(([, v]) => v); return json(200, docs.length ? { documents: docs } : {}); }
  const d = FB.get(p); return d ? json(200, d) : json(404, { error: { code: 404, status: 'NOT_FOUND', message: `Document "${PFX}${p}" not found.` } });
}
function parseMultipart(ct, body) {
  const b = /boundary=([^;]+)/.exec(ct)[1];
  const parts = body.split('--' + b).filter((x) => x.trim() && x.trim() !== '--').map((x) => x.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
  return { meta: JSON.parse(parts[0]), content: parts[1] };
}
function drive(method, url, hdrs, body) {
  stats.driveReq++;
  const auth = hdrs['authorization'] || hdrs['Authorization'] || '';
  if (!/Bearer (gt|wt)-\d+/.test(auth) || /expired/.test(auth)) return json(401, { error: { code: 401, message: 'Invalid Credentials' } });
  if (hdrs['x-http-method-override'] || hdrs['X-HTTP-Method-Override']) method = hdrs['x-http-method-override'] || hdrs['X-HTTP-Method-Override'];
  const path = url.pathname;
  if (path === '/drive/v3/about') return json(200, { user: { emailAddress: 'me@gmail.com' } });
  if (path === '/drive/v3/files' && method === 'GET') {
    const q = url.searchParams.get('q') || '';
    let m;
    const files = [...DRIVE.values()].filter((f) => ((m = /name='([^']+)'/.exec(q)) ? f.name === m[1] : (m = /name contains '([^']+)'/.exec(q)) ? f.name.includes(m[1]) : true));
    return json(200, { files: files.map((f) => ({ id: f.id, name: f.name, appProperties: f.appProperties, createdTime: f.createdTime, size: String(f.content.length) })) });
  }
  let m = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
  if (m) {
    const f = DRIVE.get(m[1]);
    if (!f) return json(404, { error: { code: 404, message: 'File not found' } });
    if (method === 'DELETE') { DRIVE.delete(m[1]); return { status: 204, body: '' }; }
    return { status: 200, body: f.content };
  }
  if (path === '/upload/drive/v3/files' && method === 'POST') {
    const { meta, content } = parseMultipart(hdrs['content-type'] || hdrs['Content-Type'], body);
    if (!(meta.parents || []).includes('appDataFolder')) return json(403, { error: { message: 'must be appDataFolder' } });
    const id = 'f' + (nid++); DRIVE.set(id, { id, name: meta.name, appProperties: meta.appProperties || {}, createdTime: new Date().toISOString(), content });
    return json(200, { id });
  }
  m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path);
  if (m && method === 'PATCH') {
    const f = DRIVE.get(m[1]); if (!f) return json(404, { error: { code: 404, message: 'File not found' } });
    const { meta, content } = parseMultipart(hdrs['content-type'] || hdrs['Content-Type'], body);
    f.content = content; f.appProperties = Object.assign({}, f.appProperties, meta.appProperties || {});
    return json(200, { id: f.id });
  }
  return json(400, { error: { message: 'unhandled ' + method + ' ' + path } });
}
function core(method, rawUrl, hdrs, body) {
  const url = new URL(rawUrl);
  if (url.host === 'www.googleapis.com') return drive(method, url, hdrs, body);
  return firebase(method, url, hdrs, body);
}
function route(r) {
  const req = r.request();
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const x = core(req.method(), req.url(), req.headers(), req.postData());
  return r.fulfill({ status: x.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: x.body });
}
module.exports = { core, route, FB, DRIVE, stats };

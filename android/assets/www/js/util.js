/* Clearli — shared helpers */
(function () {
  const U = {};
  const DAY = 86400000;
  U.DAY = DAY;

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  U.median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  U.mean = (a) => (a.length ? U.sum(a) / a.length : 0);
  U.stdev = (a) => { if (a.length < 2) return 0; const m = U.mean(a); return Math.sqrt(U.mean(a.map((x) => (x - m) ** 2))); };
  U.groupBy = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${(window.ICONS && ICONS[name]) || ICONS['circle-help']}</svg>`;

  /* ---------- money ---------- */
  let fmtCache = {};
  U.currency = 'USD';
  function nf(opts) {
    const k = JSON.stringify(opts) + U.currency;
    if (!fmtCache[k]) {
      try { fmtCache[k] = new Intl.NumberFormat(undefined, Object.assign({ style: 'currency', currency: U.currency }, opts)); }
      catch (e) { fmtCache[k] = new Intl.NumberFormat(undefined, Object.assign({ style: 'currency', currency: 'USD' }, opts)); }
    }
    return fmtCache[k];
  }
  U.money = (v, o) => {
    o = o || {};
    const n = Number(v) || 0;
    if (o.compact && Math.abs(n) >= 10000) return nf({ notation: 'compact', maximumFractionDigits: 1 }).format(n);
    const whole = o.whole || (o.auto && Math.abs(n) >= 1000);
    let s = nf({ minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(o.abs ? Math.abs(n) : n);
    if (o.sign && n > 0) s = '+' + s;
    return s;
  };
  U.amt = (v, o) => `<span class="amt ${o && o.color ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : ''}">${U.money(v, o)}</span>`;
  U.pct = (v, d) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 0 : d) + '%');
  U.pctAbs = (v) => (v == null || !isFinite(v) ? '—' : Math.round(Math.abs(v) * 100) + '%');
  U.num = (v) => new Intl.NumberFormat().format(v);

  /* ---------- dates (local time) ---------- */
  U.sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, dim)); return x; };
  U.som = (d) => new Date(new Date(d).getFullYear(), new Date(d).getMonth(), 1);
  U.soq = (d) => { const x = new Date(d); return new Date(x.getFullYear(), Math.floor(x.getMonth() / 3) * 3, 1); };
  U.soy = (d) => new Date(new Date(d).getFullYear(), 0, 1);
  U.sow = (d, ws) => { const x = U.sod(d); const diff = (x.getDay() - (ws || 0) + 7) % 7; return U.addDays(x, -diff); };
  U.dim = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  U.dayKey = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  U.monthKey = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  U.daysBetween = (a, b) => Math.round((U.sod(b) - U.sod(a)) / DAY);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  U.MON = MON; U.DOW = DOW;
  U.fmtDate = (d, o) => {
    const x = new Date(d); o = o || {};
    if (o.rel) {
      const diff = U.daysBetween(x, new Date());
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      if (diff === -1) return 'Tomorrow';
      if (diff > 1 && diff < 7) return DOW[x.getDay()] + ', ' + MON[x.getMonth()] + ' ' + x.getDate();
    }
    const y = x.getFullYear() !== new Date().getFullYear() || o.year ? ', ' + x.getFullYear() : '';
    return (o.dow ? DOW[x.getDay()] + ', ' : '') + MON[x.getMonth()] + ' ' + x.getDate() + y;
  };
  U.fmtMonth = (d, short) => { const x = new Date(d); return MON[x.getMonth()] + (short ? " '" + String(x.getFullYear()).slice(2) : ' ' + x.getFullYear()); };
  U.ago = (ms) => {
    const s = (Date.now() - ms) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  U.inputDate = (d) => U.dayKey(d);
  U.parseInputDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  /* ---------- colors ---------- */
  U.hexA = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  U.PALETTE = ['#7C8CFF', '#FF6FB5', '#43D9B8', '#FFB547', '#5AC8FA', '#B78CFF', '#FF7A59', '#9BE15D', '#F7D154', '#4F9DFF', '#FF5C7A', '#2EC4B6', '#C792EA', '#FFA07A', '#8BD3DD', '#E0A96D'];

  window.U = U;
})();

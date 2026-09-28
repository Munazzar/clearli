/* Clearli — UI kit: components, sheets, toasts, chart helpers */
(function () {
  const UI = {};
  const I = U.icon;

  /* ---------- action delegation: data-a="name" data-x="arg" ---------- */
  UI.actions = {};
  UI.on = (name, fn) => { UI.actions[name] = fn; };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const fn = UI.actions[el.dataset.a];
    if (fn) { ev.preventDefault(); ev.stopPropagation(); fn(el.dataset.x, el, ev); }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-in]');
    if (el && UI.actions[el.dataset.in]) UI.actions[el.dataset.in](el.value, el, ev);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-ch]');
    if (el && UI.actions[el.dataset.ch]) UI.actions[el.dataset.ch](el.value, el, ev);
  });

  /* ---------- never fail silently ---------- */
  window.addEventListener('error', (e) => { console.log('ERR', e.message, e.filename, e.lineno); try { UI.toast('Something went wrong: ' + (e.message || 'error'), 'alert-triangle'); } catch (x) { } });
  window.addEventListener('unhandledrejection', (e) => { console.log('REJ', e.reason); try { UI.toast('Something went wrong: ' + ((e.reason && e.reason.message) || e.reason), 'alert-triangle'); } catch (x) { } });

  /* ---------- toast ---------- */
  let toastT;
  UI.toast = function (msg, icon) {
    const t = document.getElementById('toast');
    t.innerHTML = (icon ? I(icon, 'sm') : '') + '<span>' + U.esc(msg) + '</span>';
    t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  };

  /* ---------- charts registry ---------- */
  UI.charts = [];
  UI.pendingCharts = [];
  UI.chart = function (id, cfg, h) {
    UI.pendingCharts.push({ id, cfg });
    return `<div class="chart" style="height:${h || 200}px"><canvas id="${id}"></canvas></div>`;
  };
  // Charts are only built when they scroll near the screen — keeps long report pages smooth.
  const makeChart = (el, cfg) => { try { UI.charts.push(new Chart(el.getContext('2d'), typeof cfg === 'function' ? cfg(el) : cfg)); } catch (e) { console.log('chart', e); } };
  const io = window.IntersectionObserver ? new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      if (en.target.isConnected && en.target.__cfg) { makeChart(en.target, en.target.__cfg); en.target.__cfg = null; }
    }
  }, { rootMargin: '300px 0px' }) : null;
  UI.flushCharts = function (root) {
    const list = UI.pendingCharts; UI.pendingCharts = [];
    for (const { id, cfg } of list) {
      const el = (root || document).querySelector('#' + id);
      if (!el) continue;
      if (io) { el.__cfg = cfg; io.observe(el); } else makeChart(el, cfg);
    }
  };
  UI.destroyCharts = function (root) {
    UI.charts = UI.charts.filter((c) => {
      if (!root || root.contains(c.canvas)) { c.destroy(); return false; }
      return true;
    });
  };
  UI.css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  UI.applyChartTheme = function () {
    if (!window.Chart) return;
    const d = Chart.defaults;
    d.font.family = 'Inter, system-ui, sans-serif'; d.font.size = 11; d.color = UI.css('--text3');
    d.borderColor = UI.css('--line');
    d.animation.duration = document.body.classList.contains('fx-low') ? 0 : 350;
    d.plugins.legend.display = false;
    const tt = d.plugins.tooltip;
    tt.backgroundColor = UI.css('--sheet') || 'rgba(20,22,40,.9)'; tt.titleColor = UI.css('--text'); tt.bodyColor = UI.css('--text2');
    tt.borderColor = UI.css('--line'); tt.borderWidth = 1; tt.padding = 10; tt.cornerRadius = 12; tt.displayColors = true; tt.boxPadding = 4;
    tt.titleFont = { weight: '700' };
    d.maintainAspectRatio = false; d.responsive = true;
    d.elements.bar.borderRadius = 7; d.elements.bar.borderSkipped = false;
    d.elements.line.tension = 0.35; d.elements.line.borderWidth = 2.5; d.elements.point.radius = 0; d.elements.point.hoverRadius = 5;
    d.elements.arc.borderWidth = 0;
    d.interaction = { mode: 'index', intersect: false };
  };
  const hidden = () => document.body.classList.contains('hide-amt');
  UI.tickMoney = (v) => (hidden() ? '•••' : U.money(v, { compact: true, whole: true }));
  UI.ttMoney = (ctx) => {
    let v = ctx.raw; if (v && typeof v === 'object') v = v.y != null ? v.y : v.x;
    const type = ctx.chart.config.type;
    const lbl = type === 'doughnut' || type === 'pie' || type === 'polarArea' ? ctx.label : ctx.dataset.label;
    return ` ${lbl ? lbl + ': ' : ''}${hidden() ? '•••' : U.money(v)}`;
  };
  UI.grad = function (hex, a1, a2) {
    return (ctx) => {
      const c = ctx.chart; const area = c.chartArea;
      if (!area) return U.hexA(hex, a1);
      const g = c.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, U.hexA(hex, a1)); g.addColorStop(1, U.hexA(hex, a2)); return g;
    };
  };
  UI.scales = (o) => {
    o = o || {};
    const x = { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } };
    const y = { grid: { color: UI.css('--line') }, border: { display: false }, ticks: { callback: o.pct ? (v) => v + '%' : UI.tickMoney, maxTicksLimit: 5 }, beginAtZero: o.zero !== false };
    if (o.stacked) { x.stacked = true; y.stacked = true; }
    if (o.horizontal) return { x: Object.assign(y, { grid: { color: UI.css('--line') } }), y: Object.assign(x, { ticks: { autoSkip: false } }) };
    return { x, y };
  };
  UI.baseOpts = (o) => Object.assign({ plugins: { tooltip: { callbacks: { label: UI.ttMoney } } }, scales: UI.scales(o) }, o && o.extra);

  /* ---------- components ---------- */
  UI.bubble = (icon, color, round) => `<div class="bubble ${round ? 'round' : ''}" style="background:linear-gradient(160deg,${U.hexA(color, .45)},${U.hexA(color, .18)});color:${color}">${I(icon)}</div>`;
  UI.catBubble = (c) => UI.bubble(c.icon || 'tag', c.color || '#8A93B8');
  UI.toggle = (on, a, x) => `<button class="toggle ${on ? 'on' : ''}" data-a="${a}" data-x="${x || ''}"></button>`;
  UI.delta = (cur, prev, invert) => {
    if (!prev) return '<span class="faint">—</span>';
    const d = (cur - prev) / Math.abs(prev);
    const good = invert ? d < 0 : d > 0;
    return `<span class="${Math.abs(d) < 0.005 ? 'faint' : good ? 'pos' : 'neg'}">${I(d >= 0 ? 'trending-up' : 'trending-down', 'sm')} ${U.pct(d)}</span>`;
  };
  UI.ring = (pct, size, color, label) => {
    const r = (size - 8) / 2; const c = 2 * Math.PI * r; const p = U.clamp(pct, 0, 1);
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--fill)" stroke-width="7" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color || 'var(--accent)'}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" style="transition:stroke-dashoffset 1s;filter:drop-shadow(0 0 6px ${color || 'var(--accent)'})"/></svg><div class="lbl">${label != null ? label : Math.round(pct * 100) + '%'}</div></div>`;
  };
  UI.progress = (pct, color, pace) => `<div class="bar"><i style="width:${U.clamp(pct, 0, 1) * 100}%;background:${color || 'var(--accent)'}"></i>${pace != null ? `<span class="pace" style="left:${U.clamp(pace, 0, 1) * 100}%"></span>` : ''}</div>`;
  UI.empty = (icon, title, sub, btn) => `<div class="empty">${I(icon)}<div class="h3">${title}</div><div class="small muted" style="margin-top:6px">${sub || ''}</div>${btn || ''}</div>`;
  UI.sec = (title, right) => `<div class="sec"><div class="h2">${title}</div>${right || ''}</div>`;
  UI.seg = (items, cur, a) => `<div class="seg g flat">${items.map(([id, l]) => `<button class="${id === cur ? 'on' : ''}" data-a="${a}" data-x="${id}">${l}</button>`).join('')}</div>`;

  UI.txRow = function (t, opts) {
    opts = opts || {};
    const V = Store.V; const c = V.catMap[t.cat];
    const a = Store.S.accounts[t.acct] || {};
    const sub = opts.sub || [c.name, opts.showDate ? U.fmtDate(t.ts) : null, opts.showAcct !== false ? (a.alias || a.name || '').replace(/\s*••\d+$/, '') : null].filter(Boolean).join(' · ');
    const sel = opts.select ? `<div class="check ${opts.selected ? 'on' : ''}">${opts.selected ? I('check') : ''}</div>` : '';
    return `<div class="item tap" data-a="${opts.select ? 'txSel' : 'tx'}" data-x="${U.esc(t.parent || t.k)}">${sel}${UI.catBubble(c)}
      <div class="grow"><div class="t ell">${U.esc(t.name)}${t.parent ? ` <span class="badge">${U.esc(Store.V.catMap[t.cat].name)}</span>` : ''}${t.shifted ? ` <span class="badge acc">${U.MON[new Date(t.rts).getMonth()]}</span>` : ''} ${t.pending ? '<span class="badge warn">Pending</span>' : ''}${t.recurring ? ` <span class="badge">${I('repeat')}</span>` : ''}${t.excluded ? ' <span class="badge">hidden</span>' : ''}</div><div class="s ell">${U.esc(sub)}</div></div>
      <div class="r"><div class="b">${U.amt(t.amt, { color: t.amt > 0 && t.kind !== 'transfer' })}</div>${t.note ? `<div class="s">${I('file-text', 'sm')}</div>` : ''}</div></div>`;
  };

  /* ---------- sheets (stacked bottom sheets) ---------- */
  UI.sheets = [];
  UI.sheet = function (o) {
    // o: {title, body (html or fn), foot, onClose, id, full}
    const scrim = document.getElementById('scrim');
    const el = document.createElement('div');
    el.className = 'sheet';
    if (o.full) el.style.height = '92vh';
    el.innerHTML = `<div class="grab"><i></i></div><div class="hd"><div class="h2 ell">${o.title || ''}</div>${o.headRight || ''}<button class="iconbtn" data-a="closeSheet">${I('x')}</button></div><div class="bd"></div>${o.foot ? `<div class="ft">${o.foot}</div>` : ''}`;
    document.body.appendChild(el);
    const rec = { el, o };
    UI.sheets.push(rec);
    UI.renderSheet(rec);
    scrim.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    // drag to dismiss
    let y0 = null, dy = 0;
    const start = (e) => { y0 = e.touches[0].clientY; dy = 0; el.style.transition = 'none'; };
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; };
    const end = () => { if (y0 == null) return; el.style.transition = ''; el.style.transform = ''; if (dy > 110) UI.closeSheet(); y0 = null; };
    for (const h of el.querySelectorAll('.grab,.hd')) { h.addEventListener('touchstart', start, { passive: true }); h.addEventListener('touchmove', move, { passive: true }); h.addEventListener('touchend', end); }
    Native.haptic && Store.N.sync('haptic');
    return rec;
  };
  UI.renderSheet = function (rec) {
    rec = rec || UI.sheets[UI.sheets.length - 1];
    if (!rec) return;
    const bd = rec.el.querySelector('.bd');
    UI.destroyCharts(bd);
    const st = bd.scrollTop;
    bd.innerHTML = typeof rec.o.body === 'function' ? rec.o.body() : rec.o.body;
    if (rec.o.title && typeof rec.o.title === 'function') rec.el.querySelector('.hd .h2').innerHTML = rec.o.title();
    UI.flushCharts(bd);
    bd.scrollTop = st;
    if (rec.o.after) rec.o.after(bd);
  };
  UI.closeSheet = function () {
    const rec = UI.sheets.pop();
    if (!rec) return false;
    UI.destroyCharts(rec.el);
    rec.el.classList.remove('on');
    setTimeout(() => rec.el.remove(), 420);
    if (!UI.sheets.length) document.getElementById('scrim').classList.remove('on');
    if (rec.o.onClose) rec.o.onClose();
    return true;
  };
  UI.closeAll = function () { while (UI.sheets.length) UI.closeSheet(); };
  UI.on('closeSheet', () => UI.closeSheet());

  /* confirm dialog as sheet */
  UI.confirm = function (title, msg, okLabel, danger) {
    return new Promise((res) => {
      let done = false;
      UI.on('cfOk', () => { done = true; UI.closeSheet(); res(true); });
      UI.on('cfNo', () => { done = true; UI.closeSheet(); res(false); });
      UI.sheet({ title, body: `<p class="muted" style="margin:0 0 6px">${msg}</p>`, foot: `<button class="btn grow" data-a="cfNo">Cancel</button><button class="btn grow ${danger ? 'danger' : 'primary'}" data-a="cfOk">${okLabel || 'OK'}</button>`, onClose: () => { if (!done) res(false); } });
    });
  };
  UI.choice = function (title, msg, options) {
    // options: [{id,label,primary}]
    return new Promise((res) => {
      let done = false;
      UI.on('chPick', (id) => { done = true; UI.closeSheet(); res(id); });
      UI.sheet({ title, body: `<p class="muted" style="margin:0 0 12px">${msg}</p><div class="stack">${options.map((o) => `<button class="btn block ${o.primary ? 'primary' : ''}" data-a="chPick" data-x="${o.id}">${o.label}</button>`).join('')}</div>`, onClose: () => { if (!done) res(null); } });
    });
  };

  window.UI = UI;
})();

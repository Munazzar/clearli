/* Clearli — automatic categorization layers (same code on phone and web):
   1. structural keywords (card payments, payroll, fees, remittances…)
   2. worldwide brand list (OpenStreetMap name-suggestion-index) with amount checks (fuel vs snack)
   3. curated keywords for online services
   4. generic words learned from brand names ("bakery", "burger", "pharmacy"…)
   + a personal model trained on the user's own confirmed categories (applied in engine.derive). */
(function () {
  const C = {};
  const STRUCT = new Set(['transfer', 'income', 'bonus', 'income-other', 'fees', 'cash', 'taxes', 'loans', 'housing', 'remit', 'utilities', 'phone', 'insurance', 'subscriptions']);
  C.norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- brand list ---------- */
  let BR = null, WORDS = null;
  function load() {
    if (BR) return;
    BR = new Map(); WORDS = {};
    const M = window.MERCHANTS;
    if (!M) return;
    for (const cat in M.cats) for (const n of M.cats[cat].split('|')) { BR.set(n, cat); if (n.indexOf(' ') > 0) { const j = n.replace(/ /g, ''); if (!BR.has(j)) BR.set(j, cat); } }
    WORDS = M.words || {};
  }
  C.version = () => (window.MERCHANTS && window.MERCHANTS.v) || 'none';
  // Brands whose worldwide map tag doesn't match how people think of the charge
  const OVR = { target: 'shopping', 'target com': 'shopping', walmart: 'shopping', 'walmart com': 'shopping', dunkin: 'coffee', 'dunkin donuts': 'coffee', 'pret a manger': 'coffee', 'tim hortons': 'coffee', 'krispy kreme': 'coffee' };
  // Institution words beat a brand that happens to share the first word ("NORTHWEST COMMUNITY HOSP")
  const HEALTH_RE = /\b(hosp|hospital|clinic|medical|dental|dentist|pharmacy|urgent care|physician|pediatric|orthodont|dermatolog|radiology|med ctr|medical center|health system)\b/;
  const BC = new Map();
  C.brand = function (desc) {
    load();
    let r = BC.get(desc);
    if (r !== undefined) return r;
    r = null;
    const toks = C.norm(E.cleanDesc(desc)).split(' ').filter(Boolean).slice(0, 7);
    outer: for (let len = 4; len >= 1; len--) {
      for (let st = 0; st <= Math.min(2, toks.length - len); st++) {
        if (len === 1 && (st > 1 || (st === 1 && (toks[0].length > 2 || toks[1].length < 5)))) continue;
        const ph = toks.slice(st, st + len);
        const a = ph.join(' ');
        let cat = BR.get(a);
        if (!cat && len > 1) cat = BR.get(ph.join(''));
        if (cat) { r = { cat: OVR[a] || cat, name: a }; break outer; }
      }
    }
    // brand glued to digits or suffixes, e.g. "SHELL57444"
    if (!r && toks[0]) { const g = toks[0].replace(/\d+$/, ''); if (g.length >= 4 && g !== toks[0] && BR.get(g)) r = { cat: BR.get(g), name: g }; }
    BC.set(desc, r);
    return r;
  };
  const WC = new Map();
  C.words = function (desc) {
    load();
    let r = WC.get(desc);
    if (r !== undefined) return r;
    r = null;
    const votes = {};
    for (const w of C.norm(E.cleanDesc(desc)).split(' ')) { const c = WORDS[w]; if (c) votes[c] = (votes[c] || 0) + 1; }
    let best = 0; for (const c in votes) if (votes[c] > best) { best = votes[c]; r = c; }
    WC.set(desc, r);
    return r;
  };

  /* Amount checks: the same store type means different things at different sizes */
  C.byAmount = function (cat, amt) {
    const v = Math.abs(amt);
    if (cat === 'gasconv') return v >= 20 ? 'gas' : 'coffee';          // gas station: fill-up vs snack
    if (cat === 'conv') return v >= 45 ? 'groceries' : 'coffee';       // convenience store
    if (cat === 'gas' && v < 12) return 'coffee';                      // tiny charge at a fuel brand = snack
    return cat;
  };

  /* Returns {cat, src, conf} for a transaction with no rule/manual choice. */
  C.auto = function (desc, low, amt, catMap) {
    const kw = E.keywordCategory(low, amt);
    if (kw && STRUCT.has(kw)) return { cat: kw, src: 'keyword', conf: 0.9 };
    if (amt < 0 && HEALTH_RE.test(low) && catMap.health) return { cat: 'health', src: 'keyword', conf: 0.85 };
    if (amt < 0) {
      const b = C.brand(desc);
      if (b) { const cat = C.byAmount(b.cat, amt); if (catMap[cat]) return { cat, src: 'brand', conf: b.cat === 'gasconv' || b.cat === 'conv' ? 0.8 : 0.9 }; }
    }
    if (kw) return { cat: amt < 0 ? C.byAmount(kw, amt) : kw, src: 'keyword', conf: 0.75 };
    if (amt < 0) { const w = C.words(desc); if (w && catMap[C.byAmount(w, amt)]) return { cat: C.byAmount(w, amt), src: 'words', conf: 0.55 }; }
    return null;
  };

  /* ---------- personal model: naive Bayes over description words, amount size and account ---------- */
  const bucket = (a) => { const v = Math.abs(a); return v < 5 ? 'a0' : v < 15 ? 'a1' : v < 40 ? 'a2' : v < 100 ? 'a3' : v < 300 ? 'a4' : v < 1000 ? 'a5' : 'a6'; };
  const FC = new Map();
  C.features = function (desc, amt, acct, m) {
    const k = desc + '|' + bucket(amt) + '|' + acct;
    let f = FC.get(k);
    if (f) return f;
    const toks = C.norm(E.cleanDesc(desc)).split(' ').filter((x) => x.length >= 2 && !/^\d+$/.test(x));
    f = [...new Set(toks.slice(0, 6))];
    if (toks.length > 1) f.push(toks[0] + '_' + toks[1]);
    f.push('m:' + m, 'b:' + bucket(amt), (amt < 0 ? 's:-' : 's:+'), 'ac:' + acct);
    FC.set(k, f);
    return f;
  };
  C.train = function (examples) {
    // examples: [{f: [...], cat}]
    const model = { n: 0, cc: {}, fc: {}, tot: {}, vocab: new Set() };
    for (const ex of examples) {
      model.n++; model.cc[ex.cat] = (model.cc[ex.cat] || 0) + 1;
      const fc = model.fc[ex.cat] || (model.fc[ex.cat] = new Map());
      for (const x of ex.f) { fc.set(x, (fc.get(x) || 0) + 1); model.tot[ex.cat] = (model.tot[ex.cat] || 0) + 1; model.vocab.add(x); }
    }
    model.V = model.vocab.size || 1;
    return model;
  };
  C.predict = function (model, f) {
    if (!model || model.n < 15) return null;
    const scores = [];
    for (const c in model.cc) {
      if (model.cc[c] < 2) continue;
      let s = Math.log(model.cc[c] / model.n);
      const fc = model.fc[c]; const den = (model.tot[c] || 0) + model.V;
      let seen = 0;
      for (const x of f) { const n = fc.get(x) || 0; if (n) seen++; s += Math.log((n + 0.5) / den); }
      scores.push({ cat: c, s, seen });
    }
    if (!scores.length) return null;
    const mx = Math.max(...scores.map((x) => x.s));
    let z = 0; for (const x of scores) { x.p = Math.exp(x.s - mx); z += x.p; }
    for (const x of scores) x.p /= z;
    scores.sort((a, b) => b.p - a.p);
    // needs real evidence: at least one description word (not just amount/account) seen with that category
    const top = scores[0];
    const wordSeen = f.some((x) => x.indexOf(':') < 0 && model.fc[top.cat].get(x));
    return { cat: top.cat, p: top.p, alts: scores.slice(0, 4), wordSeen };
  };

  window.CL = C;
})();

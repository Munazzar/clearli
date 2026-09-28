/* Clearli — categorization, learning, recurring detection, analytics, insights, planning.
   Pure functions over the store state; no DOM. */
(function () {
  const E = {};
  const DAY = U.DAY;

  /* ======================= Categories ======================= */
  E.DEFAULT_CATS = [
    { id: 'income', name: 'Paycheck', icon: 'briefcase', color: '#43D9B8', kind: 'income' },
    { id: 'bonus', name: 'Bonus', icon: 'sparkles', color: '#FFD166', kind: 'income' },
    { id: 'income-other', name: 'Other Income', icon: 'hand-coins', color: '#9BE15D', kind: 'income' },
    { id: 'savings', name: 'Savings & Investing', icon: 'piggy-bank', color: '#43D9B8', kind: 'transfer' },
    { id: 'transfer', name: 'Transfers', icon: 'arrow-left-right', color: '#8A93B8', kind: 'transfer' },
    { id: 'housing', name: 'Rent & Mortgage', icon: 'home', color: '#7C8CFF', kind: 'expense', essential: true },
    { id: 'utilities', name: 'Utilities', icon: 'zap', color: '#F7D154', kind: 'expense', essential: true },
    { id: 'phone', name: 'Phone & Internet', icon: 'wifi', color: '#5AC8FA', kind: 'expense', essential: true },
    { id: 'groceries', name: 'Groceries', icon: 'shopping-cart', color: '#2EC4B6', kind: 'expense', essential: true },
    { id: 'dining', name: 'Dining & Delivery', icon: 'utensils', color: '#FF7A59', kind: 'expense' },
    { id: 'coffee', name: 'Coffee & Snacks', icon: 'coffee', color: '#E0A96D', kind: 'expense' },
    { id: 'gas', name: 'Gas & Fuel', icon: 'fuel', color: '#FFB547', kind: 'expense', essential: true },
    { id: 'transport', name: 'Rides & Transit', icon: 'bus', color: '#4F9DFF', kind: 'expense' },
    { id: 'auto', name: 'Auto & Parking', icon: 'car', color: '#8BD3DD', kind: 'expense', essential: true },
    { id: 'insurance', name: 'Insurance', icon: 'shield-check', color: '#B78CFF', kind: 'expense', essential: true },
    { id: 'health', name: 'Health & Pharmacy', icon: 'heart-pulse', color: '#FF5C7A', kind: 'expense', essential: true },
    { id: 'shopping', name: 'Shopping', icon: 'shirt', color: '#FF6FB5', kind: 'expense' },
    { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', color: '#C792EA', kind: 'expense' },
    { id: 'entertainment', name: 'Entertainment', icon: 'film', color: '#FFA07A', kind: 'expense' },
    { id: 'travel', name: 'Travel', icon: 'plane', color: '#5AC8FA', kind: 'expense' },
    { id: 'education', name: 'Education', icon: 'graduation-cap', color: '#9BE15D', kind: 'expense', essential: true },
    { id: 'kids', name: 'Kids & Family', icon: 'baby', color: '#F7D154', kind: 'expense', essential: true },
    { id: 'personal', name: 'Personal Care', icon: 'scissors', color: '#FF6FB5', kind: 'expense' },
    { id: 'fitness', name: 'Fitness', icon: 'dumbbell', color: '#43D9B8', kind: 'expense' },
    { id: 'pets', name: 'Pets', icon: 'paw-print', color: '#E0A96D', kind: 'expense' },
    { id: 'gifts', name: 'Gifts & Charity', icon: 'gift', color: '#FF5C7A', kind: 'expense' },
    { id: 'home', name: 'Home & Garden', icon: 'building-2', color: '#7C8CFF', kind: 'expense' },
    { id: 'fees', name: 'Fees & Interest', icon: 'receipt', color: '#FF3B5C', kind: 'expense' },
    { id: 'taxes', name: 'Taxes', icon: 'landmark', color: '#8A93B8', kind: 'expense', essential: true },
    { id: 'loans', name: 'Loan Payments', icon: 'banknote', color: '#B78CFF', kind: 'expense', essential: true },
    { id: 'cash', name: 'Cash & ATM', icon: 'wallet', color: '#9BE15D', kind: 'expense' },
    { id: 'other', name: 'Uncategorized', icon: 'tag', color: '#8A93B8', kind: 'expense' },
  ];

  // Keyword rules: [category, [substrings matched against the lower-cased description]]
  const KW = [
    ['transfer', ['payment thank you', 'autopay', 'auto pay', 'credit card payment', 'card payment', 'online transfer', 'transfer to', 'transfer from', 'xfer', 'zelle to', 'zelle from', 'venmo cashout', 'internal transfer', 'epay', 'bill pay', 'mobile payment', 'payment - thank', 'online banking transfer', 'crd pmt', 'cardmember serv', 'discover e-payment', 'amex epayment', 'chase credit crd', 'capital one crcardpmt', 'applecard gsbank', 'savings transfer']],
    ['bonus', ['bonus', 'incentive pay', 'commission']],
    ['income', ['payroll', 'direct dep', 'dir dep', 'salary', 'paycheck', 'adp ', 'gusto', 'paychex', 'workday', 'employer']],
    ['income-other', ['interest paid', 'interest earned', 'int pd', 'dividend', 'cashback', 'cash back reward', 'irs treas', 'tax ref', 'venmo from', 'deposit']],
    ['fees', ['overdraft', 'nsf fee', 'late fee', 'service fee', 'monthly fee', 'maintenance fee', 'atm fee', 'foreign transaction', 'interest charge', 'finance charge', 'annual fee', 'returned item', 'wire fee', ' fee ']],
    ['housing', [' rent ', 'rent payment', 'mortgage', 'apartment', 'property mgmt', 'hoa ', 'homeowners assoc', 'zillow rent', 'bilt ', 'realpage', 'appfolio', 'loancare', 'mr cooper', 'rocket mortgage']],
    ['utilities', ['electric', 'comed', 'nicor', 'pg&e', 'con ed', 'duke energy', 'water', 'sewer', 'gas co', 'energy', 'utility', 'waste mgmt', 'republic services', 'peoples gas']],
    ['phone', ['verizon', 't-mobile', 'tmobile', 'at&t', 'att*', 'comcast', 'xfinity', 'spectrum', 'cox comm', 'mint mobile', 'google fi', 'visible', 'cricket', 'internet', 'fiber']],
    ['groceries', ['grocery', 'whole foods', 'trader joe', 'aldi', 'kroger', 'jewel', 'mariano', 'safeway', 'publix', 'heb ', 'h-e-b', 'meijer', 'wegmans', 'sprouts', 'food lion', 'giant eagle', 'patel brothers', 'costco', 'sams club', "sam's club", 'instacart', 'fresh thyme', 'hmart', 'h mart', 'market', 'halal']],
    ['coffee', ['starbucks', 'dunkin', 'peet', 'dutch bros', 'tim hortons', 'coffee', 'cafe', 'caribou', 'krispy', 'bakery', 'boba', 'tea ']],
    ['dining', ['doordash', 'uber eats', 'ubereats', 'grubhub', 'postmates', 'seamless', 'restaurant', 'mcdonald', 'chipotle', 'taco bell', 'wendy', 'burger', 'pizza', 'domino', 'subway', 'chick-fil', 'panera', 'kfc', 'popeyes', 'five guys', 'shake shack', 'sweetgreen', 'panda express', 'olive garden', 'grill', 'kitchen', 'bbq', 'sushi', 'diner', 'tst*', 'toast', 'sq *', 'bar ', 'pub ', 'wingstop', 'jimmy john', 'portillo', 'raising cane', 'noodle', 'thai', 'biryani', 'kabob', 'shawarma']],
    ['gas', ['shell', 'exxon', 'mobil', 'chevron', 'bp ', 'bp#', 'marathon', 'speedway', 'citgo', 'sunoco', 'valero', 'circle k', 'phillips 66', 'casey', 'wawa', 'sheetz', 'quiktrip', 'gas station', 'fuel', 'costco gas']],
    ['transport', ['uber', 'lyft', 'metra', 'cta ', 'ventra', 'transit', 'mta ', 'amtrak', 'bird ', 'lime ', 'divvy', 'greyhound', 'taxi']],
    ['auto', ['parking', 'parkwhiz', 'spothero', 'toll', 'ipass', 'e-zpass', 'ezpass', 'jiffy lube', 'autozone', 'o reilly', 'advance auto', 'car wash', 'firestone', 'midas', 'dmv', 'secretary of state', 'tesla supercharger', 'valvoline', 'discount tire']],
    ['insurance', ['insurance', 'geico', 'state farm', 'progressive', 'allstate', 'liberty mutual', 'lemonade', 'usaa ins', 'farmers ins', 'nationwide']],
    ['health', ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'hospital', 'clinic', 'medical', 'dental', 'dentist', 'doctor', 'labcorp', 'quest diag', 'vision', 'optometr', 'urgent care', 'health', 'hosp', 'physician', 'therapy', 'chiropract', 'kaiser', 'copay']],
    ['subscriptions', ['netflix', 'spotify', 'hulu', 'disney plus', 'disney+', 'hbo', 'max.com', 'paramount', 'peacock', 'youtube', 'apple.com/bill', 'apple com bill', 'itunes', 'icloud', 'google storage', 'google one', 'amazon prime', 'prime video', 'audible', 'kindle unlimited', 'patreon', 'onlyfans', 'dropbox', 'adobe', 'microsoft 365', 'msft', 'openai', 'chatgpt', 'anthropic', 'claude.ai', 'github', 'notion', 'canva', 'duolingo', 'nytimes', 'wsj', 'substack', 'siriusxm', 'pandora', 'crunchyroll', 'playstation', 'xbox', 'nintendo', 'twitch', 'linkedin', '1password', 'lastpass', 'nordvpn', 'expressvpn', 'grammarly', 'calm', 'headspace', 'subscription', 'membership']],
    ['fitness', ['gym', 'planet fitness', 'la fitness', 'equinox', 'orangetheory', 'peloton', 'crossfit', 'yoga', 'lifetime fitness', 'life time', 'anytime fitness', 'ymca', 'strava', 'classpass']],
    ['entertainment', ['cinema', 'amc ', 'regal', 'movie', 'theater', 'theatre', 'ticketmaster', 'stubhub', 'eventbrite', 'steam', 'bowling', 'concert', 'museum', 'zoo', 'arcade', 'golf', 'topgolf']],
    ['travel', ['airline', 'airlines', 'delta air', 'united air', 'american air', 'southwest', 'spirit air', 'frontier', 'jetblue', 'alaska air', 'hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'vrbo', 'expedia', 'booking.com', 'priceline', 'hertz', 'avis', 'enterprise rent', 'budget rent', 'turo', 'tsa ']],
    ['education', ['tuition', 'university', 'college', 'school', 'coursera', 'udemy', 'edx', 'pluralsight', 'books', 'chegg', 'student']],
    ['kids', ['daycare', 'childcare', 'kindercare', 'bright horizons', 'babies', 'buy buy baby', 'carters', "carter's", 'toys', 'lego', 'kids']],
    ['personal', ['salon', 'barber', 'spa ', 'nails', 'ulta', 'sephora', 'great clips', 'supercuts', 'massage', 'cosmetic']],
    ['pets', ['petco', 'petsmart', 'chewy', 'vet ', 'veterinary', 'banfield', 'rover']],
    ['gifts', ['donation', 'charity', 'gofundme', 'red cross', 'unicef', 'church', 'mosque', 'masjid', 'zakat', 'sadaqah', 'islamic relief', 'temple', 'gift']],
    ['home', ['home depot', 'lowe', 'ikea', 'wayfair', 'bed bath', 'menards', 'ace hardware', 'true value', 'crate & barrel', 'pottery barn', 'homegoods', 'furniture']],
    ['taxes', ['irs ', 'tax payment', 'state tax', 'property tax', 'franchise tax', 'dept of revenue', 'treasury']],
    ['loans', ['loan', 'navient', 'nelnet', 'sallie mae', 'mohela', 'great lakes', 'aidvantage', 'sofi', 'upstart', 'lending club', 'auto finance', 'toyota financial', 'honda finance', 'ally auto', 'affirm', 'klarna', 'afterpay']],
    ['cash', ['atm withdrawal', 'atm w/d', 'cash withdrawal', 'atm ']],
    ['shopping', ['amazon', 'amzn', 'walmart', 'target', 'best buy', 'ebay', 'etsy', 'shein', 'temu', 'nike', 'adidas', 'old navy', 'gap ', 'h&m', 'zara', 'uniqlo', 'macy', 'nordstrom', 'kohl', 'tj maxx', 'marshalls', 'ross ', 'apple store', 'dollar tree', 'dollar general', 'five below', 'michaels', 'hobby lobby', 'joann', 'staples', 'office depot', 'shop', 'store', 'outlet', 'mall']],
  ];

  /* ======================= Merchant normalization ======================= */
  const ALIASES = [
    [/AMZN|AMAZON(?!\s*PRIME)|AMAZON\.COM/, 'AMAZON'], [/AMAZON\s*PRIME|PRIME\s*VIDEO/, 'AMAZON PRIME'], [/WAL-?MART|WM SUPERCENTER|WALMART/, 'WALMART'],
    [/UBER\s*\*?\s*EATS/, 'UBER EATS'], [/UBER/, 'UBER'], [/LYFT/, 'LYFT'], [/DOORDASH|DD \*DOORDASH/, 'DOORDASH'], [/GRUBHUB/, 'GRUBHUB'],
    [/NETFLIX/, 'NETFLIX'], [/SPOTIFY/, 'SPOTIFY'], [/HULU/, 'HULU'], [/DISNEY/, 'DISNEY+'], [/PARAMOUNT/, 'PARAMOUNT+'], [/PEACOCK/, 'PEACOCK'], [/HBO|MAX\.COM/, 'MAX'], [/YOUTUBE|GOOGLE \*YT/, 'YOUTUBE'],
    [/APPLE\.COM|APPLE COM BILL|ITUNES/, 'APPLE SERVICES'], [/GOOGLE \*?(STORAGE|ONE)/, 'GOOGLE ONE'], [/STARBUCKS/, 'STARBUCKS'], [/DUNKIN/, 'DUNKIN'],
    [/MCDONALD/, "MCDONALD'S"], [/CHIPOTLE/, 'CHIPOTLE'], [/TARGET/, 'TARGET'], [/COSTCO\s*GAS/, 'COSTCO GAS'], [/COSTCO/, 'COSTCO'], [/WHOLE\s*FOODS|WFM/, 'WHOLE FOODS'],
    [/TRADER JOE/, "TRADER JOE'S"], [/ALDI/, 'ALDI'], [/JEWEL/, 'JEWEL-OSCO'], [/WALGREENS/, 'WALGREENS'], [/CVS/, 'CVS'], [/SHELL/, 'SHELL'],
    [/COMCAST|XFINITY/, 'XFINITY'], [/VERIZON/, 'VERIZON'], [/T-?MOBILE/, 'T-MOBILE'], [/AT&T|ATT\*/, 'AT&T'], [/COMED/, 'COMED'], [/NICOR/, 'NICOR GAS'],
    [/OPENAI|CHATGPT/, 'OPENAI'], [/ANTHROPIC|CLAUDE\.AI/, 'ANTHROPIC'], [/GITHUB/, 'GITHUB'], [/ADOBE/, 'ADOBE'], [/PAYPAL \*(\w+)/, null], [/VENMO/, 'VENMO'], [/ZELLE/, 'ZELLE'],
    [/PAYMENT\s*-?\s*THANK YOU|AUTOPAY PAYMENT|ONLINE PAYMENT/, 'CARD PAYMENT'], [/HOME DEPOT/, 'HOME DEPOT'], [/LOWE'?S/, "LOWE'S"], [/IKEA/, 'IKEA'], [/PLANET FITNESS/, 'PLANET FITNESS'], [/PELOTON/, 'PELOTON'], [/AIRBNB/, 'AIRBNB'],
  ];
  const NOISE = /\b(POS|DEBIT|CREDIT|CARD|PURCHASE|PURCHASED|CHECKCARD|CHECK CARD|VISA|MASTERCARD|MC|ACH|ELECTRONIC|RECURRING|PMT|PAYMENT TO|WITHDRAWAL|ONLINE|WEB|PPD|CCD|WEB ID|CO ID|INDN|DES|TRANSACTION|AUTH|AUTHORIZED|PENDING|SALE|NON-REF|REF|XX+\d*|CONF|TRACE|INC|LLC|CORP|CO|THE|US|USA|NA)\b/g;
  const STATES = /\s(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s*$/;

  E.cleanDesc = function (desc) {
    let s = ' ' + String(desc || '').toUpperCase() + ' ';
    s = s.replace(/PURCHASE AUTHORIZED ON \d{1,2}\/\d{1,2}/g, ' ').replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ');
    s = s.replace(/^\s*(SQ|TST|SP|PY|PP|IN|DD|BT|CKE|PAR|WPY|FSP|EB|ZSK|SQU|GOOGLE|PAYPAL|APLPAY|APPLE PAY)\s*\*\s*/, ' ');
    s = s.replace(/\*[A-Z0-9]{3,}/g, ' ').replace(/#\s*\d+/g, ' ').replace(/\b\d{3,}\b/g, ' ').replace(/\b[A-Z]*\d[A-Z0-9]{5,}\b/g, ' ');
    s = s.replace(/\(\d+\)|\+?\d[\d\-() ]{7,}\d/g, ' ').replace(/[*_#:;,]/g, ' ');
    s = s.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(STATES, '').trim();
    return s;
  };

  E.merchantKey = function (desc) {
    const up = String(desc || '').toUpperCase();
    for (const [re, name] of ALIASES) {
      const m = up.match(re);
      if (m) return (name || m[1] || '').toLowerCase() || E.merchantKey(up.replace(re, ''));
    }
    const s = E.cleanDesc(desc);
    const toks = s.split(' ').filter((t) => t.length > 1 || /[&]/.test(t));
    if (!toks.length) return (s || String(desc || '').trim()).toLowerCase().slice(0, 24) || 'unknown';
    let n = 2;
    if (toks[1] && /^(OF|THE|AND|&|DE|LA|EL|SAN|ST)$/.test(toks[1])) n = 3;
    if (toks[0].length >= 8 && (!toks[1] || toks[1].length <= 3)) n = 1;
    return toks.slice(0, n).join(' ').toLowerCase();
  };

  const KEEP = new Set(['the', 'and', 'of', 'bar', 'pub', 'gas', 'car', 'tea', 'pet', 'one', 'new', 'my', 'go', 'to', 'by', 'at', 'in', 'on', 'for', 'joe', 'bob', 'max', 'ace', 'big', 'fun', 'fit', 'box', 'air', 'day', 'spa', 'zoo', 'inn', 'way', 'pay', 'eat', 'hut', 'co', 'st', 'ave', 'art', 'bay', 'sun', 'sea', 'red', 'top', 'hot', 'mix', 'pro', 'lab', 'kid', 'dog', 'cat', 'tax', 'fee', 'atm', 's']);
  E.titleCase = (s) => String(s).toLowerCase().replace(/([a-z]) s\b/g, "$1's").replace(/[a-z0-9&'+.]+/g, (w) => (w.length <= 3 && !KEEP.has(w) && /^[a-z&]+$/.test(w) ? w.toUpperCase() : w)).replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(Of|And|The)\b/g, (w) => w.toLowerCase()).replace(/'S\b/g, "'s");

  const KWC = new Map();
  E.keywordCategory = function (descLower, amt) {
    const ck = (amt < 0 ? '-' : '+') + descLower;
    let v = KWC.get(ck);
    if (v === undefined) { v = kwRaw(descLower, amt); KWC.set(ck, v); }
    return v;
  };
  const kwRaw = function (descLower, amt) {
    const d = ' ' + descLower + ' ';
    for (const [cat, words] of KW) {
      for (const w of words) {
        if (d.indexOf(w) >= 0) {
          if ((cat === 'income' || cat === 'bonus') && amt < 0) continue;
          if (cat === 'income-other' && amt < 0) continue;
          if (cat === 'utilities' && w === 'water' && /(waterfront|watermelon)/.test(d)) continue;
          if (cat === 'groceries' && w === 'market' && /(marketplace|mktp)/.test(d)) continue;
          return cat;
        }
      }
    }
    return null;
  };

  /* ======================= Derivation (categorize every txn) ======================= */
  // Builds a fast in-memory view: arrays of txns with derived fields.
  const MK = new Map();
  E.derive = function (S) {
    const catMap = {};
    for (const c of S.cats) catMap[c.id] = c;
    const merchRules = {}; const containsRules = [];
    for (const r of S.rules) {
      if (r.match === 'merchant') merchRules[r.pattern] = r; else containsRules.push(r);
    }
    containsRules.sort((a, b) => b.pattern.length - a.pattern.length);
    const mkOf = (t) => { const base = t.payee || t.desc; let m = MK.get(base); if (m === undefined) { m = E.merchantKey(base); MK.set(base, m); } return m; };

    // Learn from everything the user categorized/renamed by hand: the most common choice per merchant
    // (and direction) is applied to that merchant's other transactions — including newly imported ones.
    const tally = {}; const learnedName = {};
    for (const k in S.edits) {
      const e = S.edits[k]; const t = S.txns[k];
      if (!t || (!e.cat && !e.name)) continue;
      const m = mkOf(t);
      if (e.cat) { const key = m + (t.amt < 0 ? '-' : '+'); const o = tally[key] || (tally[key] = {}); o[e.cat] = (o[e.cat] || 0) + 1; }
      if (e.name && (!learnedName[m] || t.ts > learnedName[m].ts)) learnedName[m] = { name: e.name, ts: t.ts };
    }
    const learnedCat = {};
    for (const key in tally) { let best = null, n = 0; for (const c in tally[key]) if (tally[key][c] > n) { best = c; n = tally[key][c]; } learnedCat[key] = best; }

    const list = [];
    for (const key in S.txns) {
      const t = S.txns[key];
      const a = S.accounts[t.acct];
      if (!a) continue;
      const e = S.edits[key] || {};
      const m = mkOf(t);
      const low = (m + ' | ' + t.desc + ' ' + (t.payee || '') + ' ' + (t.memo || '')).toLowerCase();
      let cat = null, name = null, src = 'auto';
      const mr = merchRules[m];
      let cr = null;
      for (const r of containsRules) { if (low.indexOf(r.pattern.toLowerCase()) >= 0) { cr = r; break; } }
      if (e.cat) { cat = e.cat; src = 'manual'; }
      else if (mr && mr.cat) { cat = mr.cat; src = 'rule'; }
      else if (cr && cr.cat) { cat = cr.cat; src = 'rule'; }
      else if (learnedCat[m + (t.amt < 0 ? '-' : '+')]) { cat = learnedCat[m + (t.amt < 0 ? '-' : '+')]; src = 'learned'; }
      else if (t.bankCat === 'transfer') { cat = 'transfer'; src = 'bank'; }
      if (e.name) name = e.name; else if (mr && mr.rename) name = mr.rename; else if (cr && cr.rename) name = cr.rename; else if (learnedName[m]) name = learnedName[m].name;
      if (!cat) {
        cat = E.keywordCategory(low, t.amt);
        if (!cat && t.bankCat && catMap[t.bankCat]) { cat = t.bankCat; src = 'bank'; }
        if (!cat) cat = t.amt > 0 ? 'income-other' : 'other';
      }
      if (!catMap[cat]) cat = t.amt > 0 ? 'income-other' : 'other';
      const item = {
        k: key, id: t.id, acct: t.acct, conn: a.conn, ts: t.ts, rts: t.ts, amt: t.amt, desc: t.desc, pending: !!t.pending,
        m, name: name || E.titleCase(m), rawName: E.titleCase(m), cat, catSrc: src, note: e.note || '', tags: e.tags || [],
        excluded: !!e.excluded || !!a.excludeReports, hiddenAcct: !!a.hidden, imp: t.imp || null, month: e.month || null,
      };
      // A split turns one bank transaction into parts (e.g. salary + bonus) that report separately.
      if (e.splits && e.splits.length > 1) {
        e.splits.forEach((p, i) => list.push(Object.assign({}, item, { k: key + '~' + i, parent: key, amt: p.amt, cat: catMap[p.cat] ? p.cat : item.cat, catSrc: 'manual', part: i, partNote: p.note || '' })));
      } else list.push(item);
    }
    // Auto transfer pairing: opposite amounts across own accounts within 4 days.
    const byAbs = U.groupBy(list.filter((t) => t.catSrc === 'auto' && catMap[t.cat].kind !== 'transfer'), (t) => Math.round(Math.abs(t.amt) * 100));
    for (const [, grp] of byAbs) {
      if (grp.length < 2) continue;
      const used = new Set();
      for (const x of grp) {
        if (x.amt >= 0 || used.has(x.k)) continue;
        for (const y of grp) {
          if (y.amt <= 0 || used.has(y.k) || y.acct === x.acct) continue;
          if (Math.abs(y.ts - x.ts) <= 4 * DAY) { x.cat = 'transfer'; y.cat = 'transfer'; x.catSrc = y.catSrc = 'paired'; used.add(x.k); used.add(y.k); break; }
        }
      }
    }
    list.sort((a, b) => b.ts - a.ts || a.k.localeCompare(b.k));
    const V = { S, list, catMap, byKey: {} };
    for (const t of list) { t.kind = catMap[t.cat].kind; V.byKey[t.k] = t; }
    // Early income: a paycheck that normally lands in the first week but arrives in the last days
    // of the previous month counts toward the month it's meant for (auto), or as the user chooses.
    const nextMonth = (ts) => +U.addDays(U.som(U.addMonths(U.som(ts), 1)), 0) + 12 * 3600000;
    const auto = S.settings && S.settings.earlyIncome !== false;
    const isNextTag = (t) => (t.tags || []).some((g) => /^#?next-?month$/i.test(g));
    for (const t of list) {
      if (t.amt <= 0 || t.month === 'this') continue;
      const r = merchRules[t.m]; const day = new Date(t.ts).getDate();
      if (t.month === 'next' || isNextTag(t) || (r && r.nextFrom && day >= r.nextFrom)) { t.rts = nextMonth(t.ts); t.shifted = true; }
    }
    const incByM = U.groupBy(list.filter((t) => t.kind === 'income' && t.amt > 0 && !t.shifted), (t) => t.m);
    for (const [, txs] of incByM) {
      const early = txs.filter((t) => new Date(t.ts).getDate() <= 7).length;
      const lateMonth = (t) => { const d = new Date(t.ts); return d.getDate() > U.dim(d) - 6; };
      const late = txs.filter(lateMonth).length;
      const usuallyEarly = txs.length >= 2 && early >= Math.max(1, (txs.length - late) * 0.5);
      for (const t of txs) {
        if (t.month === 'this') continue;
        if (t.month === 'next' || (auto && usuallyEarly && lateMonth(t))) { t.rts = nextMonth(t.ts); t.shifted = true; }
      }
    }
    V.recurring = E.detectRecurring(V);
    const ovr = S.recurringOverrides || {};
    for (const r of V.recurring) {
      const nm = ovr[r.key + '|name']; const ct = ovr[r.key + '|cat'];
      for (const h of r.history) {
        const e = S.edits[h.parent || h.k] || {};
        if (nm && !e.name) h.name = nm;
        if (ct && catMap[ct] && h.catSrc !== 'manual') { h.cat = ct; h.kind = catMap[ct].kind; h.catSrc = 'series'; }
        h.series = r.key;
      }
    }
    const recKeys = new Set();
    for (const r of V.recurring) for (const h of r.history) recKeys.add(h.k);
    for (const t of list) t.recurring = recKeys.has(t.k);
    return V;
  };

  /* ======================= Learning ======================= */
  // When the user moves transactions of a merchant to the same category twice, learn a rule automatically.
  E.learn = function (S, V, txKey) {
    const t = V.byKey[txKey];
    if (!t) return null;
    const cat = (S.edits[txKey] || {}).cat;
    if (!cat) return null;
    if (S.rules.some((r) => r.match === 'merchant' && r.pattern === t.m)) return null;
    let n = 0;
    for (const x of V.list) if (x.m === t.m && S.edits[x.k] && S.edits[x.k].cat === cat) n++;
    if (n >= 2) {
      const r = { id: U.uid(), match: 'merchant', pattern: t.m, cat, created: Date.now(), learned: true };
      S.rules.push(r);
      return r;
    }
    return null;
  };

  /* ======================= Filters & scope ======================= */
  E.scoped = function (V, scope, opts) {
    opts = opts || {};
    const accts = scope && scope.accts && scope.accts.length ? new Set(scope.accts) : null;
    const conns = scope && scope.conns && scope.conns.length ? new Set(scope.conns) : null;
    return V.list.filter((t) => {
      if (t.hiddenAcct) return false;
      if (!opts.includeExcluded && t.excluded) return false;
      if (accts && !accts.has(t.acct)) return false;
      if (conns && !conns.has(t.conn)) return false;
      return true;
    });
  };
  E.spendOf = (t) => (t.kind === 'expense' ? -t.amt : 0);
  E.incomeOf = (t) => (t.kind === 'income' ? t.amt : 0);
  E.inRange = (list, a, b) => list.filter((t) => t.rts >= +a && t.rts < +b);
  E.inRangeTs = (list, a, b) => list.filter((t) => t.ts >= +a && t.ts < +b);

  /* ======================= Periods ======================= */
  E.PERIODS = [
    { id: 'D', label: 'Day', unit: 'day', n: 1, ctx: 14, sub: null },
    { id: 'W', label: 'Week', unit: 'week', n: 1, ctx: 12, sub: 'day' },
    { id: 'M', label: 'Month', unit: 'month', n: 1, ctx: 12, sub: 'day' },
    { id: 'Q', label: 'Quarter', unit: 'month', n: 3, ctx: 8, sub: 'week' },
    { id: 'Y', label: 'Year', unit: 'month', n: 12, ctx: 5, sub: 'month' },
    { id: '2Y', label: '2 Years', unit: 'month', n: 24, ctx: 3, sub: 'month' },
  ];
  E.periodRange = function (pid, offset, ref, ws) {
    const p = E.PERIODS.find((x) => x.id === pid) || E.PERIODS[2];
    ref = ref ? new Date(ref) : new Date();
    let a, b;
    if (p.unit === 'day') { a = U.addDays(U.sod(ref), offset); b = U.addDays(a, 1); }
    else if (p.unit === 'week') { a = U.addDays(U.sow(ref, ws), offset * 7); b = U.addDays(a, 7); }
    else {
      let start;
      if (p.n === 1) start = U.som(ref); else if (p.n === 3) start = U.soq(ref); else if (p.n === 12) start = U.soy(ref);
      else start = U.addMonths(U.som(ref), -23);
      a = U.addMonths(start, offset * p.n); b = U.addMonths(a, p.n);
    }
    return { a, b, p, label: E.rangeLabel(p, a, b) };
  };
  E.rangeLabel = function (p, a, b) {
    const last = U.addDays(b, -1);
    if (p.id === 'D') return U.fmtDate(a, { rel: true, dow: true });
    if (p.id === 'W') return U.fmtDate(a) + ' – ' + U.fmtDate(last);
    if (p.id === 'M') return U.fmtMonth(a);
    if (p.id === 'Q') return 'Q' + (Math.floor(a.getMonth() / 3) + 1) + ' ' + a.getFullYear();
    if (p.id === 'Y') return String(a.getFullYear());
    if (p.id === '2Y') return U.fmtMonth(a, true) + ' – ' + U.fmtMonth(last, true);
    return U.fmtDate(a) + ' – ' + U.fmtDate(last);
  };
  E.bucketStart = function (d, unit, ws) {
    if (unit === 'day') return U.sod(d);
    if (unit === 'week') return U.sow(d, ws);
    if (unit === 'month') return U.som(d);
    if (unit === 'quarter') return U.soq(d);
    return U.soy(d);
  };
  E.bucketNext = (d, unit) => (unit === 'day' ? U.addDays(d, 1) : unit === 'week' ? U.addDays(d, 7) : unit === 'month' ? U.addMonths(d, 1) : unit === 'quarter' ? U.addMonths(d, 3) : U.addMonths(d, 12));
  E.buckets = function (a, b, unit, ws) {
    const out = [];
    let d = E.bucketStart(a, unit, ws);
    while (d < b) { const n = E.bucketNext(d, unit); out.push({ a: d, b: n }); d = n; }
    return out;
  };
  E.bucketLabel = function (d, unit) {
    if (unit === 'day') return U.MON[d.getMonth()] + ' ' + d.getDate();
    if (unit === 'week') return U.MON[d.getMonth()] + ' ' + d.getDate();
    if (unit === 'month') return U.MON[d.getMonth()] + (d.getMonth() === 0 ? " '" + String(d.getFullYear()).slice(2) : '');
    if (unit === 'quarter') return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(2);
    return String(d.getFullYear());
  };

  /* ======================= Aggregations ======================= */
  E.totals = function (list) {
    let spend = 0, income = 0, n = 0, transfers = 0;
    for (const t of list) {
      if (t.kind === 'expense') { spend -= t.amt; n++; }
      else if (t.kind === 'income') income += t.amt;
      else transfers += Math.abs(t.amt);
    }
    return { spend, income, net: income - spend, n, transfers, rate: income > 0 ? (income - spend) / income : null };
  };
  E.byCategory = function (V, list) {
    const m = {};
    for (const t of list) {
      if (t.kind !== 'expense') continue;
      m[t.cat] = (m[t.cat] || 0) - t.amt;
    }
    return Object.entries(m).map(([cat, v]) => ({ cat, v, c: V.catMap[cat] })).filter((x) => x.v > 0.005).sort((a, b) => b.v - a.v);
  };
  E.byMerchant = function (list, kind) {
    const m = new Map();
    for (const t of list) {
      if (t.kind !== (kind || 'expense')) continue;
      const k = t.m;
      const o = m.get(k) || { m: k, name: t.name, v: 0, n: 0, cat: t.cat };
      o.v += kind === 'income' ? t.amt : -t.amt; o.n++;
      m.set(k, o);
    }
    return [...m.values()].filter((x) => x.v > 0.005).sort((a, b) => b.v - a.v);
  };
  E.series = function (list, a, b, unit, ws, fn) {
    const bk = E.buckets(a, b, unit, ws);
    const vals = bk.map(() => 0);
    let i = 0;
    const sorted = list.filter((t) => t.rts >= +bk[0].a && t.rts < +bk[bk.length - 1].b).sort((x, y) => x.rts - y.rts);
    for (const t of sorted) {
      while (i < bk.length - 1 && t.rts >= +bk[i].b) i++;
      vals[i] += fn(t);
    }
    return { labels: bk.map((x) => E.bucketLabel(x.a, unit)), buckets: bk, vals };
  };
  E.cumulativeDaily = function (list, a, b, fn) {
    const days = U.daysBetween(a, b);
    const arr = new Array(days).fill(0);
    for (const t of list) { if (t.rts < +a || t.rts >= +b) continue; const i = U.daysBetween(a, t.rts); if (i >= 0 && i < days) arr[i] += fn(t); }
    let c = 0; return arr.map((v) => (c += v));
  };
  E.dowProfile = function (list, a, b) {
    const sums = [0, 0, 0, 0, 0, 0, 0]; const cnt = [0, 0, 0, 0, 0, 0, 0];
    for (let d = new Date(a); d < b; d = U.addDays(d, 1)) cnt[d.getDay()]++;
    for (const t of list) if (t.kind === 'expense' && t.ts >= +a && t.ts < +b) sums[new Date(t.ts).getDay()] -= t.amt;
    return sums.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
  };
  E.dailySpendMap = function (list, a, b) {
    const m = {};
    for (const t of list) { if (t.kind !== 'expense' || t.ts < +a || t.ts >= +b) continue; const k = U.dayKey(t.ts); m[k] = (m[k] || 0) - t.amt; }
    return m;
  };
  E.histogram = function (list) {
    const edges = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, Infinity];
    const labels = ['<$5', '$5–10', '$10–25', '$25–50', '$50–100', '$100–250', '$250–500', '$500–1k', '$1k–2.5k', '$2.5k+'];
    const cnt = new Array(labels.length).fill(0); const tot = new Array(labels.length).fill(0);
    for (const t of list) { if (t.kind !== 'expense' || t.amt >= 0) continue; const v = -t.amt; for (let i = 0; i < labels.length; i++) if (v >= edges[i] && v < edges[i + 1]) { cnt[i]++; tot[i] += v; break; } }
    return { labels, cnt, tot };
  };

  /* Balance history reconstructed backwards from current balances. */
  E.balanceHistory = function (V, scope, a, b, unit) {
    const S = V.S;
    const accts = Object.values(S.accounts).filter((x) => !x.hidden && !x.excludeTotals && (!scope.accts.length || scope.accts.includes(x.id)) && (!scope.conns.length || scope.conns.includes(x.conn)));
    const ids = new Set(accts.map((x) => x.id));
    let bal = U.sum(accts, (x) => x.balance);
    const txs = V.list.filter((t) => ids.has(t.acct) && !t.pending).sort((x, y) => y.ts - x.ts);
    const bk = E.buckets(a, b, unit);
    const pts = [];
    let i = 0;
    for (let j = bk.length - 1; j >= 0; j--) {
      const end = Math.min(+bk[j].b, Date.now());
      while (i < txs.length && txs[i].ts >= end) { bal -= txs[i].amt; i++; }
      pts.unshift(+bk[j].a > Date.now() ? null : bal);
    }
    return { labels: bk.map((x) => E.bucketLabel(x.a, unit)), vals: pts };
  };

  /* ======================= Recurring detection ======================= */
  const FREQS = [
    { id: 'weekly', lo: 6, hi: 8, days: 7, perMonth: 52 / 12 },
    { id: 'biweekly', lo: 12, hi: 16, days: 14, perMonth: 26 / 12 },
    { id: 'monthly', lo: 26, hi: 35, days: 30.44, perMonth: 1 },
    { id: 'quarterly', lo: 84, hi: 98, days: 91.3, perMonth: 1 / 3 },
    { id: 'yearly', lo: 350, hi: 380, days: 365.25, perMonth: 1 / 12 },
  ];
  E.FREQS = FREQS;
  const VARIABLE_BILLS = new Set(['utilities', 'phone', 'insurance', 'health', 'loans', 'taxes', 'kids', 'education', 'housing', 'auto', 'gas', 'transport']);
  // Turns one run of same-merchant transactions into a recurring item (or null if it isn't one).
  // opts: {forced, freq ('auto'|FREQ id), manual}
  function evalSeries(V, key, mk, txs, opts) {
    const ov = V.S.recurringOverrides || {}; const now = Date.now();
    opts = opts || {};
    const pts = [];
    for (const t of txs) { const last = pts[pts.length - 1]; if (last && U.daysBetween(last.ts, t.ts) === 0) { last.amt += t.amt; last.items.push(t); } else pts.push({ ts: t.ts, amt: t.amt, items: [t] }); }
    if (!pts.length || (pts.length < 2 && !opts.manual)) return null;
    const iv = []; for (let i = 1; i < pts.length; i++) iv.push(U.daysBetween(pts[i - 1].ts, pts[i].ts));
    const med = iv.length ? U.median(iv) : 30;
    let f = opts.freq && opts.freq !== 'auto' ? FREQS.find((x) => x.id === opts.freq) : FREQS.find((x) => med >= x.lo && med <= x.hi);
    if (!f && opts.forced) f = FREQS.reduce((best, x) => (Math.abs(x.days - med) < Math.abs(best.days - med) ? x : best), FREQS[2]);
    if (!f) return null;
    const within = iv.length ? iv.filter((d) => d >= f.lo - 2 && d <= f.hi + 2).length / iv.length : 1;
    const amts = pts.map((p) => Math.abs(p.amt));
    const medAmt = U.median(amts.slice(-4));
    const cv = U.stdev(amts.slice(-6)) / (U.mean(amts.slice(-6)) || 1);
    const cat0 = pts[pts.length - 1].items[0].cat;
    // Bills like electricity change every month: if they arrive like clockwork, the amount can vary a lot.
    const maxCv = (VARIABLE_BILLS.has(cat0) && pts.length >= 3) || (within >= 0.85 && pts.length >= 4) ? 0.9 : 0.45;
    const minN = f.id === 'yearly' || f.id === 'quarterly' ? 2 : f.id === 'monthly' ? 3 : 4;
    if (!opts.forced && (pts.length < minN || within < 0.6 || cv > maxCv)) return null;
    // two charges a quarter/year apart only count if the price is identical (and never for pieces split out by amount)
    if (!opts.forced && pts.length < 3 && (f.id === 'quarterly' || f.id === 'yearly') && (cv > 0.02 || key.indexOf('#') >= 0)) return null;
    if (!opts.forced && key.indexOf('#') >= 0 && pts.length < 4) return null;
    const lastP = pts[pts.length - 1];
    const active = U.daysBetween(lastP.ts, now) <= f.hi * 1.5 + 5;
    let next;
    if (f.id === 'monthly') { next = U.addMonths(new Date(lastP.ts), 1); while (+next < U.sod(now) - DAY) next = U.addMonths(next, 1); }
    else if (f.id === 'quarterly') { next = U.addMonths(new Date(lastP.ts), 3); }
    else if (f.id === 'yearly') { next = U.addMonths(new Date(lastP.ts), 12); }
    else { next = U.addDays(new Date(lastP.ts), f.days); while (+next < U.sod(now) - DAY) next = U.addDays(next, f.days); }
    let priceChange = null;
    if (amts.length >= 2) {
      const cur = amts[amts.length - 1];
      let j = amts.length - 2;
      while (j >= 0 && Math.abs(amts[j] - cur) / cur < 0.05) j--;
      if (j >= 0) {
        const prev = amts[j]; const at = pts[j + 1].ts;
        const before = amts.slice(Math.max(0, j - 3), j + 1);
        const stable = before.length >= 2 ? U.stdev(before) / (U.mean(before) || 1) < 0.03 : true;
        if (stable && Math.abs(cur - prev) >= 1 && now - at < 183 * DAY) priceChange = { from: prev, to: cur, pct: (cur - prev) / prev, at };
      }
    }
    if (ov[key + '|nohike'] || cv > 0.45) priceChange = null;
    const t0 = lastP.items[lastP.items.length - 1];
    const sign = lastP.amt < 0 ? -1 : 1;
    return {
      key, m: mk, name: t0.name, cat: t0.cat, kind: t0.kind, acct: t0.acct, freq: f.id, f, amount: sign * medAmt, last: lastP.ts, next: +next, count: pts.length,
      active, monthly: sign * medAmt * f.perMonth, yearly: sign * medAmt * f.perMonth * 12, priceChange, history: txs, forced: !!opts.forced, manual: opts.manual || null,
      variable: cv > 0.15, dom: new Date(lastP.ts).getDate(),
    };
  }
  E.manualMatches = function (V, ms) {
    return V.list.filter((t) => t.m === ms.m && !t.pending && !t.hiddenAcct && (t.amt < 0 ? -1 : 1) === ms.sign && (ms.anyAmt || Math.abs(Math.abs(t.amt) - ms.amt) <= Math.max(1, ms.amt * 0.1))).sort((a, b) => a.ts - b.ts);
  };
  E.detectRecurring = function (V) {
    const S = V.S;
    const ov = S.recurringOverrides || {};
    const out = []; const claimed = new Set();
    // 1) series the user marked by hand (a specific amount, or any amount for bills that vary)
    for (const k in ov) {
      if (k.slice(0, 4) !== 'man:' || !ov[k] || typeof ov[k] !== 'object') continue;
      const ms = ov[k];
      const txs = E.manualMatches(V, ms);
      if (!txs.length) continue;
      txs.forEach((t) => claimed.add(t.k));
      const r = evalSeries(V, k, ms.m, txs, { forced: true, manual: ms, freq: ms.freq || 'auto' });
      if (r) out.push(r);
    }
    // 2) automatic detection on everything else
    const groups = U.groupBy(V.list.filter((t) => t.kind !== 'transfer' && !t.pending && !t.hiddenAcct && !claimed.has(t.k)), (t) => t.m + '|' + (t.amt < 0 ? '-' : '+'));
    for (const [gk, all0] of groups) {
      const mk = gk.split('|')[0];
      if (ov[mk] === 'ignore') continue;
      if (all0.length < 2) continue;
      // One company can bill several different things (e.g. Apple iCloud + Apple Music).
      const series = E.splitSeries(all0, ov[mk + '|split'] === true ? true : ov[mk + '|split'] === false ? false : null);
      for (const sr of series) {
        const key = series.length > 1 ? mk + '#' + Math.round(U.median(sr.map((t) => Math.abs(t.amt)))) : mk;
        if (ov[key] === 'ignore') continue;
        const r = evalSeries(V, key, mk, sr, { forced: ov[mk] === 'force' });
        if (r) out.push(r);
      }
    }
    // Same merchant, several services: give each a distinguishable name
    const byM = U.groupBy(out, (r) => r.m);
    for (const [, rs] of byM) if (rs.length > 1) for (const r of rs) if (!ov[r.key + '|name'] && !(r.manual && r.manual.name)) r.name = r.name + ' · ' + U.money(Math.abs(r.amount));
    for (const r of out) {
      const nm = ov[r.key + '|name'] || (r.manual && r.manual.name); if (nm) r.name = nm;
      if (ov[r.key + '|cat'] && V.catMap[ov[r.key + '|cat']]) { r.cat = ov[r.key + '|cat']; r.kind = V.catMap[r.cat].kind; }
    }
    return out.sort((a, b) => a.monthly - b.monthly);
  };
  // A company that charges more than once in most months is billing for separate things (e.g. two
  // subscriptions, or rent + parking). Only then are charges separated by amount.
  E.multiBilled = function (txs) {
    const byMonth = U.groupBy(txs, (t) => U.monthKey(t.ts));
    const months = [...byMonth.values()];
    return months.length >= 2 && months.filter((g) => g.length > 1).length >= Math.max(2, months.length * 0.5);
  };
  E.splitSeries = function (txs0, force) {
    const txs = [...txs0].sort((a, b) => a.ts - b.ts);
    const multi = force === true || (force !== false && E.multiBilled(txs));
    if (!multi) return [txs];
    const byAmt = [...txs].sort((a, b) => Math.abs(a.amt) - Math.abs(b.amt));
    const clusters = [];
    for (const t of byAmt) {
      const v = Math.abs(t.amt); const c = clusters[clusters.length - 1];
      if (c && v <= c.base * 1.1 + 0.5) c.items.push(t); else clusters.push({ base: v, items: [t] });
    }
    if (clusters.length === 1) return [txs];
    for (const c of clusters) { c.items.sort((a, b) => a.ts - b.ts); c.first = c.items[0].ts; c.last = c.items[c.items.length - 1].ts; }
    clusters.sort((a, b) => a.first - b.first);
    // merge clusters that don't overlap in time (old price ends, new price begins)
    const merged = [];
    for (const c of clusters) {
      const prev = merged.find((p) => p.last <= c.first + 5 * DAY && !merged.some((q) => q !== p && q.first < c.first && q.last > p.last));
      if (prev && prev.items.length >= 2 && c.items.length >= 1) { prev.items = prev.items.concat(c.items); prev.last = c.last; }
      else merged.push(c);
    }
    return merged.map((c) => c.items.sort((a, b) => a.ts - b.ts));
  };
  // Projected occurrences of all active recurring items inside [a,b)
  E.projectRecurring = function (V, a, b) {
    const res = [];
    for (const r of V.recurring) {
      if (!r.active) continue;
      let d = new Date(r.next);
      let guard = 0;
      while (+d < +b && guard++ < 60) {
        if (+d >= +a && +d >= +U.sod(new Date())) res.push({ date: U.sod(d), r });
        d = r.freq === 'monthly' ? U.addMonths(d, 1) : r.freq === 'quarterly' ? U.addMonths(d, 3) : r.freq === 'yearly' ? U.addMonths(d, 12) : U.addDays(d, r.f.days);
      }
    }
    return res;
  };

  /* ======================= Baselines & forecast ======================= */
  E.monthlyBaseline = function (V, list, months) {
    months = months || 3;
    const end = U.som(new Date());
    const start = U.addMonths(end, -months);
    const firstTx = list.length ? Math.min(...list.map((t) => t.ts)) : +end;
    const effStart = new Date(Math.max(+start, +U.som(firstTx)));
    const m = Math.max(1, Math.round((end - effStart) / (30.44 * DAY)));
    const inR = E.inRange(list, effStart, end);
    const tot = E.totals(inR);
    const cats = E.byCategory(V, inR).map((x) => ({ ...x, v: x.v / m }));
    let essential = 0, discretionary = 0;
    for (const c of cats) { if (c.c && c.c.essential) essential += c.v; else discretionary += c.v; }
    return { months: m, income: tot.income / m, spend: tot.spend / m, net: (tot.income - tot.spend) / m, cats, essential, discretionary, hasFull: +effStart <= +start };
  };
  E.forecastMonth = function (V, list) {
    const now = new Date();
    const a = U.som(now); const b = U.addMonths(a, 1);
    const mtd = E.totals(E.inRange(list, a, U.addDays(U.sod(now), 1)));
    const base = E.monthlyBaseline(V, list, 3);
    const daysIn = U.dim(now); const dayN = now.getDate();
    const upcoming = E.projectRecurring(V, U.addDays(U.sod(now), 1), b);
    const upExp = U.sum(upcoming.filter((x) => x.r.amount < 0), (x) => -x.r.amount);
    const upInc = U.sum(upcoming.filter((x) => x.r.amount > 0), (x) => x.r.amount);
    // discretionary daily pace blending this month and baseline
    const recurringMonthly = U.sum(V.recurring.filter((r) => r.active && r.amount < 0), (r) => -r.monthly);
    const baseVar = Math.max(0, base.spend - recurringMonthly) / 30.44;
    const mtdVar = Math.max(0, mtd.spend - U.sum(E.inRange(list, a, now).filter((t) => t.recurring && t.kind === 'expense'), (t) => -t.amt)) / Math.max(1, dayN);
    const w = Math.min(1, dayN / daysIn * 1.5);
    const pace = mtdVar * w + baseVar * (1 - w);
    const remain = daysIn - dayN;
    const projSpend = mtd.spend + upExp + pace * remain;
    const projIncome = mtd.income + upInc;
    return { mtd, projSpend, projIncome, upExp, upInc, pace, base, remain, lastMonthSpend: E.totals(E.inRange(list, U.addMonths(a, -1), a)).spend };
  };
  // Linear trend (least squares) over monthly spend to predict next months
  E.trendPredict = function (vals, ahead) {
    const n = vals.length; if (n < 3) return vals.map(() => null).concat(new Array(ahead).fill(null));
    const xs = vals.map((_, i) => i); const mx = U.mean(xs); const my = U.mean(vals);
    let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (vals[i] - my); den += (xs[i] - mx) ** 2; }
    const slope = den ? num / den : 0; const icpt = my - slope * mx;
    const out = new Array(n).fill(null);
    for (let k = 0; k < ahead; k++) out.push(Math.max(0, icpt + slope * (n + k)));
    out[n - 1] = vals[n - 1];
    return out;
  };

  /* ======================= Hidden expense / leak finder ======================= */
  E.insights = function (V, list, S) {
    const out = [];
    const now = Date.now();
    const d30 = now - 30 * DAY; const d90 = now - 90 * DAY; const d120 = now - 120 * DAY;
    const recent = list.filter((t) => t.ts >= d30);
    // 1. subscriptions
    const subs = V.recurring.filter((r) => r.active && r.amount < 0 && (r.cat === 'subscriptions' || r.cat === 'fitness' || r.cat === 'entertainment' || Math.abs(r.amount) < 60) && !['housing', 'utilities', 'loans', 'insurance', 'transfer', 'taxes'].includes(r.cat));
    if (subs.length) {
      const m = U.sum(subs, (r) => -r.monthly);
      out.push({ id: 'subs', sev: m > 100 ? 3 : 2, icon: 'repeat', title: `${subs.length} subscriptions cost ${U.money(m)}/mo`, body: `That's ${U.money(m * 12, { whole: true })} a year. Review ones you rarely use — cancelling even two usually saves ${U.money(Math.min(m, 2 * U.median(subs.map((s) => -s.monthly))) * 12, { whole: true })}/yr.`, save: m * 12 * 0.3, items: subs.map((r) => ({ label: r.name, sub: r.freq, v: -r.monthly, key: r.key })), action: 'recurring' });
    }
    // 2. price increases
    const hikes = V.recurring.filter((r) => r.active && r.amount < 0 && r.priceChange && r.priceChange.pct > 0.04);
    if (hikes.length) {
      const extra = U.sum(hikes, (r) => (r.priceChange.to - r.priceChange.from) * r.f.perMonth * 12);
      out.push({ id: 'hikes', sev: 3, icon: 'trending-up', title: `${hikes.length} bill${hikes.length > 1 ? 's' : ''} quietly went up`, body: `Price creep adds ${U.money(extra, { whole: true })}/yr. Call or check for loyalty offers, or switch plans.`, save: extra, items: hikes.map((r) => ({ label: r.name, sub: `${U.money(r.priceChange.from)} → ${U.money(r.priceChange.to)}`, v: r.priceChange.to - r.priceChange.from, key: r.key })) });
    }
    // 3. fees & interest
    const fees = list.filter((t) => t.cat === 'fees' && t.ts >= now - 365 * DAY && t.amt < 0);
    if (fees.length) {
      const tot = -U.sum(fees, (t) => t.amt);
      out.push({ id: 'fees', sev: 3, icon: 'receipt', title: `${U.money(tot)} in fees & interest this year`, body: 'Bank fees, late fees and card interest are 100% avoidable money. Set autopay for statement balances and ask banks to waive fees.', save: tot, items: fees.slice(0, 12).map((t) => ({ label: t.name, sub: U.fmtDate(t.ts), v: -t.amt, tx: t.k })) });
    }
    // 4. duplicate charges
    const dups = [];
    const byM = U.groupBy(list.filter((t) => t.kind === 'expense' && t.ts >= d90 && !t.recurring), (t) => t.m + '|' + Math.round(t.amt * 100));
    for (const [, g] of byM) {
      if (g.length < 2) continue;
      const s = [...g].sort((a, b) => a.ts - b.ts);
      for (let i = 1; i < s.length; i++) if (s[i].ts - s[i - 1].ts <= 2 * DAY && s[i].acct === s[i - 1].acct && -s[i].amt >= 5) dups.push([s[i - 1], s[i]]);
    }
    if (dups.length) {
      out.push({ id: 'dups', sev: 2, icon: 'alert-triangle', title: `${dups.length} possible duplicate charge${dups.length > 1 ? 's' : ''}`, body: 'Same merchant, same amount, within 2 days. Worth a quick check — disputes are easy when caught early.', save: U.sum(dups, (p) => -p[1].amt), items: dups.slice(0, 10).map((p) => ({ label: p[1].name, sub: U.fmtDate(p[0].ts) + ' & ' + U.fmtDate(p[1].ts), v: -p[1].amt, tx: p[1].k })) });
    }
    // 5. latte factor: frequent small purchases
    const small = E.byMerchant(recent.filter((t) => t.amt < 0 && t.amt > -25 && !t.recurring)).filter((x) => x.n >= 5);
    if (small.length) {
      const m = U.sum(small, (x) => x.v);
      out.push({ id: 'small', sev: m > 80 ? 2 : 1, icon: 'coffee', title: `Small buys add up: ${U.money(m)} last 30 days`, body: `${small.length} places you visit 5+ times a month. Halving these frees about ${U.money(m * 6, { whole: true })}/yr.`, save: m * 6, items: small.slice(0, 8).map((x) => ({ label: x.name, sub: x.n + ' visits', v: x.v, merchant: x.m })) });
    }
    // 6. category spikes vs prior 3 months
    const prev = list.filter((t) => t.ts >= d120 && t.ts < d30);
    const curC = E.byCategory(V, recent); const prevC = E.byCategory(V, prev);
    const spikes = [];
    for (const c of curC) {
      const p = (prevC.find((x) => x.cat === c.cat) || { v: 0 }).v / 3;
      if (p > 20 && c.v - p > 50 && (c.v - p) / p > 0.25) spikes.push({ c, p, d: c.v - p });
    }
    if (spikes.length) {
      spikes.sort((a, b) => b.d - a.d);
      out.push({ id: 'spikes', sev: 2, icon: 'flame', title: `${spikes[0].c.c.name} is up ${U.pct(spikes[0].d / spikes[0].p)} vs usual`, body: `Last 30 days vs your 3-month average. ${spikes.length > 1 ? spikes.length - 1 + ' other categor' + (spikes.length > 2 ? 'ies' : 'y') + ' also spiked.' : ''}`, note: `${U.money(U.sum(spikes, (s) => s.d), { whole: true })} above usual this month`, items: spikes.map((s) => ({ label: s.c.c.name, sub: `usual ${U.money(s.p, { whole: true })}`, v: s.c.v, cat: s.c.cat })) });
    }
    // 7. delivery vs groceries
    const deliv = recent.filter((t) => /doordash|uber eats|grubhub|postmates|instacart|seamless/.test(t.m) && t.amt < 0);
    if (deliv.length >= 3) {
      const v = -U.sum(deliv, (t) => t.amt);
      out.push({ id: 'delivery', sev: 2, icon: 'utensils', title: `Delivery apps: ${U.money(v)} in 30 days`, body: `Delivery typically costs 30–60% more than the same food picked up. Picking up half of these saves ~${U.money(v * 0.2 * 12, { whole: true })}/yr.`, save: v * 0.2 * 12, items: E.byMerchant(deliv).map((x) => ({ label: x.name, sub: x.n + ' orders', v: x.v, merchant: x.m })) });
    }
    // 8. idle cash
    const apy = (S.settings.apy || 4) / 100;
    const checking = Object.values(S.accounts).filter((a) => !a.hidden && (a.type === 'checking' || (!a.type && /check/i.test(a.name))) && a.balance > 0);
    const base = E.monthlyBaseline(V, list, 3);
    const buffer = Math.max(1000, base.spend * 1.0);
    const idle = U.sum(checking, (a) => a.balance) - buffer;
    if (idle > 1000) {
      out.push({ id: 'idle', sev: 1, icon: 'piggy-bank', title: `${U.money(idle, { whole: true })} is sitting idle`, body: `Checking holds more than a month of spending. At ${(apy * 100).toFixed(1)}% APY in a high-yield savings account it could earn ~${U.money(idle * apy, { whole: true })}/yr.`, earn: idle * apy, items: checking.map((a) => ({ label: a.alias || a.name, sub: 'checking', v: a.balance })) });
    }
    // 9. weekend splurge
    const dow = E.dowProfile(list, new Date(d90), new Date(now));
    const wkend = (dow[0] + dow[6]) / 2; const wkday = (dow[1] + dow[2] + dow[3] + dow[4] + dow[5]) / 5;
    if (wkday > 0 && wkend / wkday > 1.6 && wkend - wkday > 20) {
      out.push({ id: 'weekend', sev: 1, icon: 'calendar', title: `Weekends cost ${(wkend / wkday).toFixed(1)}× more`, body: `You average ${U.money(wkend)} per weekend day vs ${U.money(wkday)} on weekdays. Planning one no-spend weekend a month saves ~${U.money((wkend - wkday) * 2 * 12, { whole: true })}/yr.`, save: (wkend - wkday) * 2 * 12 });
    }
    // 10. uncategorized
    const unc = list.filter((t) => t.cat === 'other' && t.ts >= d90);
    if (unc.length >= 5) out.push({ id: 'unc', sev: 0, icon: 'tag', title: `${unc.length} transactions need a category`, body: 'Categorize a few — Clearli learns the merchant and files future ones automatically.', action: 'uncat' });
    // 11. BNPL / cash advances
    const bnpl = list.filter((t) => /affirm|klarna|afterpay|sezzle|zip pay/.test(t.m) && t.ts >= d90 && t.amt < 0);
    if (bnpl.length) out.push({ id: 'bnpl', sev: 2, icon: 'credit-card', title: `${bnpl.length} buy-now-pay-later payments`, body: 'BNPL makes purchases feel smaller than they are and stacks up quickly. Consider finishing current plans before starting new ones.', items: E.byMerchant(bnpl).map((x) => ({ label: x.name, sub: x.n + ' payments', v: x.v, merchant: x.m })) });
    out.sort((a, b) => (b.sev - a.sev) || ((b.save || 0) - (a.save || 0)));
    return out;
  };

  /* ======================= Goals / savings planner ======================= */
  E.planGoal = function (V, list, S, g) {
    const now = new Date();
    const base = E.monthlyBaseline(V, list, 3);
    const remaining = Math.max(0, g.target - (g.saved || 0));
    const monthsLeft = g.date ? Math.max(0.5, (new Date(g.date) - now) / (30.44 * DAY)) : null;
    const needMonthly = monthsLeft ? remaining / monthsLeft : null;
    const otherGoals = S.goals.filter((x) => x.id !== g.id && x.date);
    const committed = U.sum(otherGoals, (x) => Math.max(0, x.target - (x.saved || 0)) / Math.max(0.5, (new Date(x.date) - now) / (30.44 * DAY)));
    const free = base.net - committed;
    const gap = needMonthly != null ? Math.max(0, needMonthly - Math.max(0, free)) : 0;
    const eta = free > 0 ? new Date(+now + (remaining / free) * 30.44 * DAY) : null;

    // Cut plan: discretionary categories, deeper cuts on the least-essential ones
    const cutRate = { dining: 0.5, coffee: 0.5, shopping: 0.35, entertainment: 0.4, subscriptions: 0.4, travel: 0.3, personal: 0.25, transport: 0.25, cash: 0.3, gifts: 0.15, home: 0.3, fitness: 0.2, other: 0.2, fees: 1 };
    const cuts = [];
    let covered = 0;
    for (const c of base.cats.filter((x) => x.c && !x.c.essential && x.c.kind === 'expense').sort((a, b) => b.v * (cutRate[b.cat] || 0.2) - a.v * (cutRate[a.cat] || 0.2))) {
      const r = cutRate[c.cat] || 0.2;
      const s = c.v * r;
      if (s < 5) continue;
      cuts.push({ cat: c.cat, c: c.c, now: c.v, cut: s, rate: r });
      covered += s;
    }
    const subs = V.recurring.filter((r) => r.active && r.amount < 0 && r.cat === 'subscriptions');
    // Income ideas
    const apy = (S.settings.apy || 4) / 100;
    const ideas = [];
    const liquid = U.sum(Object.values(S.accounts).filter((a) => !a.hidden && a.balance > 0 && a.type !== 'investment' && a.type !== 'credit'), (a) => a.balance);
    ideas.push({ icon: 'piggy-bank', title: 'Park it in a high-yield account', body: `Keep this goal in a separate high-yield savings account (${(apy * 100).toFixed(1)}% APY assumed). ${U.money((g.saved || 0) + remaining / 2, { whole: true })} average balance earns ~${U.money(((g.saved || 0) + remaining / 2) * apy * (monthsLeft || 12) / 12, { whole: true })} toward the goal.`, v: ((g.saved || 0) + remaining / 2) * apy / 12 });
    if (liquid > base.spend * 2) ideas.push({ icon: 'landmark', title: 'Move idle cash to work', body: `You hold ~${U.money(liquid, { whole: true })} in cash accounts. Keeping 1–2 months of spending in checking and moving the rest to HYSA / T-bills could earn ~${U.money((liquid - base.spend * 1.5) * apy, { whole: true })}/yr.`, v: (liquid - base.spend * 1.5) * apy / 12 });
    if (gap > 0) {
      ideas.push({ icon: 'clock', title: 'Side income target', body: `To close the remaining ${U.money(gap, { whole: true })}/mo gap you'd need about ${Math.ceil(gap / 25)} hrs/mo at $25/hr, or ${Math.ceil(gap / 50)} hrs/mo at $50/hr of freelance/consulting work.`, v: 0 });
    }
    ideas.push({ icon: 'percent', title: 'Ask for a raise or rebid bills', body: `A 3% raise on ~${U.money(base.income * 12, { whole: true })}/yr income adds ~${U.money(base.income * 0.03, { whole: true })}/mo. Renegotiating insurance, phone and internet typically trims 10–20%.`, v: base.income * 0.03 });
    ideas.push({ icon: 'banknote', title: 'Sell what you don\'t use', body: 'Listing unused electronics, furniture and clothes is one of the fastest one-time boosts to a goal.', v: 0 });
    ideas.push({ icon: 'undo-2', title: 'Automate on payday', body: 'Schedule an automatic transfer to the goal account the day your paycheck lands — saving first beats saving what\'s left.', v: 0 });

    // Where to keep it by horizon
    let where;
    const mL = monthsLeft || 12;
    if (mL <= 12) where = { title: 'Short horizon (≤ 1 yr)', body: 'Keep it safe and liquid: high-yield savings, money market fund, or 3–6 month T-bills. Avoid stocks — a dip right before you need it hurts.' };
    else if (mL <= 36) where = { title: 'Medium horizon (1–3 yrs)', body: 'High-yield savings plus a CD ladder or short-term Treasuries. You can lock in rates for part of it while keeping some liquid.' };
    else where = { title: 'Long horizon (3+ yrs)', body: 'Consider a mix: emergency portion in HYSA, remainder in low-cost diversified index funds. Tax-advantaged accounts (401k/IRA/HSA/529) if the goal fits.' };

    // projection series (monthly)
    const perMonth = needMonthly != null ? Math.max(needMonthly, 0) : Math.max(0, free);
    const steps = Math.min(120, Math.ceil(monthsLeft || (perMonth > 0 ? remaining / perMonth : 12)) + 1);
    const proj = []; const labels = [];
    for (let i = 0; i <= steps; i++) {
      const d = U.addMonths(now, i);
      labels.push(U.fmtMonth(d, true));
      proj.push(Math.min(g.target, (g.saved || 0) + perMonth * i));
    }
    const pace = []; for (let i = 0; i <= steps; i++) pace.push(Math.min(g.target * 1.5, (g.saved || 0) + Math.max(0, free) * i));
    return { base, remaining, monthsLeft, needMonthly, free, gap, eta, cuts, covered, subs, ideas, where, committed, chart: { labels, proj, pace } };
  };

  /* ======================= Budgets ======================= */
  E.budgetStatus = function (V, list, S) {
    const now = new Date(); const a = U.som(now); const b = U.addMonths(a, 1);
    const cats = E.byCategory(V, E.inRange(list, a, b));
    const frac = (now.getDate() - 1 + now.getHours() / 24) / U.dim(now);
    return S.cats.filter((c) => c.budget > 0).map((c) => {
      const spent = (cats.find((x) => x.cat === c.id) || { v: 0 }).v;
      return { c, spent, budget: c.budget, pct: spent / c.budget, pace: frac, over: spent > c.budget, ahead: spent / c.budget > frac + 0.1 };
    });
  };

  /* ======================= Merchant stats for a txn ======================= */
  E.txnContext = function (V, t) {
    const same = V.list.filter((x) => x.m === t.m && x.k !== t.k && x.kind === t.kind);
    const all = [t, ...same].sort((a, b) => b.ts - a.ts);
    const amts = all.map((x) => Math.abs(x.amt));
    const avg = U.mean(amts);
    const yearAgo = Date.now() - 365 * DAY;
    const ytot = U.sum(all.filter((x) => x.ts >= yearAgo), (x) => Math.abs(x.amt));
    const rank = amts.filter((v) => v < Math.abs(t.amt)).length / Math.max(1, amts.length - 1);
    const prev = all.find((x) => x.ts < t.ts);
    return { all, count: all.length, avg, ytot, rank, prev, first: all.length === 1 };
  };

  /* ======================= Savings places (cash, gold, investments, private accounts) ======================= */
  E.ASSET_KINDS = [
    { id: 'cash', name: 'Cash', icon: 'wallet', color: '#9BE15D' },
    { id: 'bank', name: 'Other account', icon: 'landmark', color: '#7C8CFF' },
    { id: 'gold', name: 'Gold & metals', icon: 'sparkles', color: '#FFD166' },
    { id: 'investment', name: 'Investments', icon: 'trending-up', color: '#43D9B8' },
    { id: 'crypto', name: 'Crypto', icon: 'hand-coins', color: '#FFB547' },
    { id: 'retirement', name: 'Retirement', icon: 'shield-check', color: '#B78CFF' },
    { id: 'other', name: 'Other', icon: 'piggy-bank', color: '#FF6FB5' },
  ];
  E.assetKind = (a) => E.ASSET_KINDS.find((k) => k.id === a.kind) || E.ASSET_KINDS[E.ASSET_KINDS.length - 1];
  E.assetContrib = (a) => U.sum(a.entries || [], (x) => x.amt);
  E.assetValue = function (a) {
    if (a.qty > 0 && a.unitPrice > 0) return a.qty * a.unitPrice;
    if (a.value != null && a.value !== '') return Number(a.value);
    return E.assetContrib(a);
  };
  E.assetsTotal = (S, onlyNet) => U.sum((S.assets || []).filter((a) => !onlyNet || a.inNetWorth !== false), E.assetValue);

  window.E = E;
})();

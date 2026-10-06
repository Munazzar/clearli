global.window = global; const fs = require('fs'); const W = 'android/assets/www/js/';
for (const f of ['icons.js', 'util.js', 'merchants.js', 'classify.js', 'engine.js']) eval(fs.readFileSync(W + f, 'utf8'));
const catMap = {}; E.DEFAULT_CATS.forEach((c) => (catMap[c.id] = c));
const cases = [
  ['REMITLY* Y8H2K 800-123', -250, 'remit'], ['WU *WESTERN UNION 1234', -100, 'remit'], ['MONEYGRAM US 555', -200, 'remit'], ['WISE US INC', -300, 'remit'], ['XOOM TRANSFER', -150, 'remit'],
  ['SHELL OIL 57444321 MOUNT PROSPECT IL', -48.2, 'gas'], ['SHELL OIL 57444321', -4.99, 'coffee'], ['SPEEDWAY 04512 ARLINGTON HTS', -55, 'gas'], ['SPEEDWAY 04512', -3.49, 'coffee'], ['BP#1234567 CHICAGO IL', -41, 'gas'],
  ['CIRCLE K # 12345', -38, 'gas'], ['7-ELEVEN 34512', -6.5, 'coffee'], ['WAWA 812', -52, 'gas'], ['CASEYS #3421', -44, 'gas'], ['MARATHON PETRO123', -35, 'gas'], ['EXXONMOBIL 4432', -61, 'gas'], ['COSTCO GAS #0388', -58, 'gas'], ['COSTCO WHSE #0388', -210, 'groceries'],
  ['MEIJER # 205', -134, 'groceries'], ['JEWEL OSCO 3421', -76, 'groceries'], ['MARIANOS FRESH MKT 523', -64, 'groceries'], ['TRADER JOE S #702', -58, 'groceries'], ['ALDI 72014', -45, 'groceries'], ['WHOLE FOODS MKT 10212', -90, 'groceries'], ['KROGER #845', -120, 'groceries'], ['PUBLIX SUPER MAR 1234', -88, 'groceries'], ['H-E-B #123', -77, 'groceries'], ['SAFEWAY #1234', -66, 'groceries'], ['PATEL BROTHERS SCHAUMBURG', -95, 'groceries'],
  ['TARGET 00012345', -43, 'shopping'], ['WALMART.COM', -60, 'shopping'], ['AMZN MKTP US*2K3LL0', -34, 'shopping'], ['BEST BUY 00123', -299, 'shopping'], ['KOHLS #0876', -45, 'shopping'], ['TJ MAXX #0765', -38, 'shopping'], ['OLD NAVY US 4432', -52, 'shopping'], ['DOLLAR TREE 4521', -12, 'shopping'], ['TEMU.COM', -23, 'shopping'], ['SHEIN.COM', -41, 'shopping'],
  ['THE HOME DEPOT #1922', -87, 'home'], ['LOWES #01234', -120, 'home'], ['MENARDS ARLINGTON', -65, 'home'], ['IKEA SCHAUMBURG', -230, 'home'],
  ['MCDONALD\'S F12345', -9.4, 'dining'], ['CHIPOTLE 2291', -14, 'dining'], ['TST* PORTILLOS SCHAUMBURG', -28, 'dining'], ['RAISING CANES 721', -16, 'dining'], ['DOORDASH*CHIPOTLE', -31, 'dining'], ['UBER *EATS', -26, 'dining'], ['SQ *KABOB HOUSE', -30, 'dining'], ['TACO BELL #031234', -11, 'dining'], ['PANDA EXPRESS #1234', -12, 'dining'], ['CULVERS OF ELK GROVE', -18, 'dining'], ['SUBWAY 04123', -10, 'dining'], ['DOMINO\'S 6789', -22, 'dining'],
  ['STARBUCKS STORE 12345', -6.2, 'coffee'], ['DUNKIN #345521', -4.8, 'coffee'], ['SQ *BLUE BOTTLE COFFEE', -7, 'coffee'], ['PANERA BREAD #601', -15, 'dining'],
  ['CVS/PHARMACY #0443', -19, 'health'], ['WALGREENS #1234', -12, 'health'], ['NORTHWEST COMMUNITY HOSP', -150, 'health'],
  ['PLANET FITNESS CLUB FEES', -24.99, 'fitness'], ['LA FITNESS', -34.99, 'fitness'],
  ['NETFLIX.COM', -22.99, 'subscriptions'], ['SPOTIFY USA', -11.99, 'subscriptions'], ['APPLE.COM/BILL', -2.99, 'subscriptions'], ['OPENAI *CHATGPT SUBSCR', -20, 'subscriptions'], ['YOUTUBE PREMIUM', -13.99, 'subscriptions'],
  ['COMCAST XFINITY', -80, 'phone'], ['T-MOBILE AUTOPAY', -142, 'phone'], ['VERIZON WRLS', -95, 'phone'], ['COMED ELECTRIC PAYMENT', -88, 'utilities'], ['NICOR GAS UTILITY PMT', -60, 'utilities'],
  ['GEICO AUTO', -176, 'insurance'], ['STATE FARM INSURANCE', -120, 'insurance'], ['PROGRESSIVE INS', -98, 'insurance'],
  ['UBER *TRIP', -18, 'transport'], ['LYFT *RIDE', -22, 'transport'], ['METRA MOBILE', -8, 'transport'], ['PARKMOBILE', -6, 'transport'], ['IL TOLLWAY IPASS', -40, 'transport'],
  ['AUTOZONE #1234', -45, 'auto'], ['JIFFY LUBE #123', -79, 'auto'], ['DISCOUNT TIRE', -600, 'auto'],
  ['MARRIOTT HOTELS', -240, 'travel'], ['UNITED AIRLINES', -420, 'travel'], ['AIRBNB * HMQ2', -310, 'travel'], ['HILTON HOTELS', -180, 'travel'],
  ['PETSMART #1234', -40, 'pets'], ['CHASE CREDIT CRD AUTOPAY', -900, 'transfer'], ['CAPITAL ONE AUTOPAY PYMT', -300, 'transfer'], ['WELLS FARGO AUTOPAY', -250, 'transfer'], ['COMED AUTOPAY', -120, 'utilities'], ['STATE FARM AUTOPAY', -140, 'insurance'], ['AMEX EPAYMENT ACH PMT', -500, 'transfer'], ['SHOPRITE #123', -70, 'groceries'], ['NETFLIX.COM', -15.49, 'subscriptions'], ['CAFETERIA UIC', -9, 'dining'], ['PETCO 1234', -30, 'pets'], ['CHEWY.COM', -55, 'pets'],
  ['KINDERCARE LEARNING', -300, 'kids'], ['GREAT CLIPS #221', -22, 'personal'], ['ULTA BEAUTY', -35, 'personal'], ['SEPHORA', -60, 'personal'],
  ['AMC ONLINE', -30, 'entertainment'], ['TICKETMASTER', -120, 'entertainment'],
  ['PAYMENT THANK YOU', 1300, 'transfer'], ['CHASE CREDIT CRD AUTOPAY', -1300, 'transfer'], ['ZELLE TO AHMED', -40, 'transfer'], ['VENMO PAYMENT', -25, 'transfer'],
  ['ACME CORP PAYROLL PPD ID: 4455', 3150, 'income'], ['OVERDRAFT FEE', -35, 'fees'], ['INTEREST CHARGE ON PURCHASES', -22, 'fees'], ['ATM WITHDRAWAL 0012', -100, 'cash'], ['TOYOTA FINANCIAL', -385, 'loans'], ['BILT RENT PAYMENT', -1985, 'housing'],
  // global
  ['TESCO STORES 3021', -34, 'groceries'], ['SAINSBURYS S/MKTS', -41, 'groceries'], ['LIDL GB LONDON', -22, 'groceries'], ['CARREFOUR MARKET', -55, 'groceries'], ['LOBLAWS #1234', -80, 'groceries'], ['TIM HORTONS #123', -6, 'coffee'], ['WOOLWORTHS 1234 SYDNEY', -60, 'groceries'], ['PRET A MANGER', -9, 'coffee'], ['GREGGS', -5, 'dining'], ['BOOTS 1234', -12, 'health'], ['PETRO-CANADA 1234', -70, 'gas'], ['ESSO 1234', -65, 'gas'], ['BIG BAZAAR MUMBAI', -40, 'groceries'], ['CARREFOUR DUBAI', -90, 'groceries'],
];
let ok = 0; const bad = [];
for (const [d, amt, want] of cases) {
  const low = (E.merchantKey(d) + ' | ' + d).toLowerCase();
  const r = CL.auto(d, low, amt, catMap);
  const got = r ? r.cat : 'other';
  if (got === want) ok++; else bad.push(`${d} (${amt}) → ${got}${r ? ' [' + r.src + ']' : ''}  want ${want}`);
}
console.log(`accuracy ${ok}/${cases.length} = ${Math.round((ok / cases.length) * 100)}%`);
console.log(bad.join('\n'));

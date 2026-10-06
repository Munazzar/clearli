#!/usr/bin/env python3
"""Builds android/assets/www/js/merchants.js from the OpenStreetMap name-suggestion-index (BSD-3-Clause).
   npm pack name-suggestion-index && tar xzf ... -> tools/nsi-pkg/  then run this script."""
import json, re, unicodedata, collections, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, 'tools', 'nsi-pkg')
nsi = json.load(open(os.path.join(PKG, 'dist/json/nsi.json')))['nsi']
version = json.load(open(os.path.join(PKG, 'package.json')))['version']

# OSM tag -> Clearli category
M = {}
def m(cat, *tags):
    for t in tags: M[t] = cat
m('gas', 'amenity/fuel', 'shop/gas', 'amenity/charging_station', 'man_made/charge_point', 'waterway/fuel', 'highway/services')
m('conv', 'shop/convenience', 'shop/kiosk', 'shop/newsagent')  # decided by amount at runtime
m('groceries', 'shop/supermarket', 'shop/greengrocer', 'shop/butcher', 'shop/frozen_food', 'shop/dairy', 'shop/deli', 'shop/cheese', 'shop/seafood', 'shop/health_food', 'shop/wholesale', 'shop/spices', 'shop/nuts', 'shop/agrarian', 'shop/country_store')
m('dining', 'amenity/fast_food', 'amenity/restaurant', 'amenity/bar', 'amenity/pub', 'amenity/ice_cream', 'shop/bbq')
m('coffee', 'amenity/cafe', 'shop/coffee', 'shop/tea', 'shop/bakery', 'shop/pastry', 'shop/confectionery', 'shop/chocolate', 'amenity/vending_machine')
m('health', 'amenity/pharmacy', 'shop/chemist', 'amenity/clinic', 'amenity/dentist', 'amenity/doctors', 'amenity/hospital', 'shop/optician', 'shop/medical_supply', 'shop/hearing_aids', 'healthcare/alternative', 'healthcare/audiologist', 'healthcare/laboratory', 'healthcare/physiotherapist', 'healthcare/rehabilitation', 'healthcare/sample_collection', 'healthcare/dialysis', 'healthcare/counselling', 'shop/nutrition_supplements', 'shop/herbalist')
m('shopping', 'shop/clothes', 'shop/shoes', 'shop/department_store', 'shop/variety_store', 'shop/general', 'shop/electronics', 'shop/computer', 'shop/sports', 'shop/outdoor', 'shop/jewelry', 'shop/watches', 'shop/bag', 'shop/fashion_accessories', 'shop/gift', 'shop/mall', 'shop/books', 'shop/stationery', 'shop/camera', 'shop/hifi', 'shop/video_games', 'shop/games', 'shop/music', 'shop/musical_instrument', 'shop/craft', 'shop/fabric', 'shop/art', 'shop/party', 'shop/second_hand', 'shop/charity', 'shop/catalogue', 'shop/leather', 'shop/anime', 'shop/model', 'shop/photo', 'shop/printer_ink', 'shop/mobile_phone_accessories', 'shop/alcohol', 'shop/wine', 'shop/beverages', 'shop/tobacco', 'shop/e-cigarette', 'shop/cannabis', 'shop/video', 'shop/fishing', 'shop/bicycle')
m('personal', 'shop/cosmetics', 'shop/beauty', 'shop/hairdresser', 'shop/perfumery', 'shop/massage', 'shop/tattoo', 'shop/laundry', 'shop/dry_cleaning', 'shop/tailor', 'shop/hairdresser_supply', 'leisure/sauna')
m('home', 'shop/furniture', 'shop/doityourself', 'shop/hardware', 'shop/garden_centre', 'shop/houseware', 'shop/interior_decoration', 'shop/appliance', 'shop/bed', 'shop/kitchen', 'shop/paint', 'shop/trade', 'shop/lighting', 'shop/carpet', 'shop/flooring', 'shop/curtain', 'shop/window_blind', 'shop/bathroom_furnishing', 'shop/household_linen', 'shop/electrical', 'shop/tiles', 'shop/doors', 'shop/power_tools', 'shop/tool_hire', 'shop/candles', 'shop/frame', 'shop/pottery', 'shop/vacuum_cleaner', 'shop/storage_rental', 'shop/locksmith', 'shop/pest_control', 'office/moving_company', 'craft/plumber', 'craft/electrician', 'craft/painter', 'craft/carpenter', 'craft/cleaning', 'shop/swimming_pool')
m('auto', 'shop/car', 'shop/car_repair', 'shop/car_parts', 'shop/tyres', 'amenity/car_wash', 'amenity/parking', 'amenity/vehicle_inspection', 'shop/motorcycle', 'shop/motorcycle_repair', 'shop/truck', 'shop/truck_repair', 'amenity/driving_school')
m('travel', 'tourism/hotel', 'tourism/motel', 'tourism/hostel', 'tourism/caravan_site', 'amenity/car_rental', 'shop/travel_agency', 'shop/caravan', 'tourism/theme_park')
m('transport', 'amenity/bicycle_rental', 'amenity/car_sharing', 'amenity/motorcycle_rental')
m('fitness', 'leisure/fitness_centre', 'leisure/sports_centre', 'leisure/fitness_station', 'leisure/dance')
m('entertainment', 'amenity/cinema', 'leisure/bowling_alley', 'leisure/amusement_arcade', 'leisure/escape_game', 'leisure/trampoline_park', 'leisure/miniature_golf', 'leisure/indoor_play', 'leisure/adult_gaming_centre', 'amenity/casino', 'amenity/gambling', 'shop/lottery', 'shop/bookmaker', 'shop/ticket', 'amenity/karaoke_box', 'leisure/high_ropes_course')
m('pets', 'shop/pet', 'amenity/veterinary', 'amenity/animal_boarding')
m('kids', 'shop/toys', 'shop/baby_goods', 'amenity/childcare', 'amenity/kindergarten')
m('education', 'amenity/school', 'amenity/college', 'amenity/university', 'amenity/language_school', 'amenity/music_school', 'amenity/prep_school', 'amenity/training')
m('insurance', 'office/insurance', 'office/insurance_adjuster')
m('phone', 'shop/mobile_phone', 'shop/telecommunication', 'office/telecommunication')
m('remit', 'amenity/money_transfer', 'amenity/bureau_de_change', 'amenity/payment_centre')
# ATM brands are bank names (would mislabel card payments) — not used
m('gifts', 'shop/florist')
m('loans', 'shop/money_lender', 'shop/pawnbroker', 'office/mortgage')
m('taxes', 'office/tax_advisor')

# Words that appear in bank descriptions and must never be treated as a brand on their own
STOP = set('''online payment payments transfer card debit credit purchase pos mobile bill interest deposit check checking fee fees service services
express direct auto pay cash atm withdrawal zelle recurring pending ach web internet store shop market center centre inc llc co corp company the and of
new one first best star sun total united national american state city capital home family care us usa international global world group
bank banking savings trust federal community financial money transfer credit union plus super mega mini smart fresh value save food fuel gas
station gasoline petrol oil energy power club members member visa mastercard amex discover paypal apple google amazon microsoft sq tst
north south east west central main street avenue park plaza square place mall outlet depot express local town village country
king queen royal golden gold silver diamond blue red green black white orange pink purple yellow
life time day night week year today tomorrow way go get buy big little small good great happy lucky'''.split())
MULTI_BLOCK = set(['credit union', 'online payment', 'post office', 'united states', 'national bank', 'first national', 'savings bank', 'community bank', 'food market', 'gas station', 'service station', 'auto service', 'express mart', 'city market', 'super market'])
words_block = set('super market fresh farm farms food foods pizza burger chicken grill house garden auto motor motors tire tires beauty nails pharmacy dental medical health family pet pets baby kids party paper book books'.split())
generic = json.load(open(os.path.join(PKG, 'dist/json/genericWords.json')))['genericWords']
gen_re = [re.compile(g, re.I) for g in generic]

def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = s.lower().replace('&', ' and ').replace("'", '')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

names = collections.defaultdict(collections.Counter)
variants = collections.defaultdict(collections.Counter)
firsts = collections.defaultdict(collections.Counter)
for key, v in nsi.items():
    if not key.startswith('brands/'): continue
    tag = '/'.join(key.split('/')[1:3])
    cat = M.get(tag)
    if not cat: continue
    for it in v.get('items', []):
        t = it.get('tags', {})
        cands = {it.get('displayName', ''), t.get('brand', ''), t.get('name', ''), t.get('brand:en', ''), t.get('name:en', '')}
        cands |= set(it.get('matchNames', []) or [])
        for c in cands:
            n = norm(c)
            if len(n) < 2 or not re.search('[a-z]', n): continue
            if any(r.fullmatch(c.strip()) for r in gen_re): continue
            toks = n.split()
            if all(x in STOP for x in toks) and (len(toks) == 1 or n in MULTI_BLOCK): continue
            if len(toks) == 1 and (len(n) < 3 and n not in ('bp',)): continue
            names[n][cat] += 1
            # looser variants that bank descriptions often use ("the home depot" -> "home depot", "cvs pharmacy" -> "cvs")
            v = re.sub(r'^the ', '', n)
            v2 = re.sub(r'( (pharmacy|market|fresh market|supermarket|supermarkets|store|stores|restaurant|restaurants|cafe|coffee|grill|kitchen|express|gas station|station|foods|food|shop|shops|and co|company|inc|us|usa))+$', '', v)
            for x in {v, v2} - {n}:
                if len(x) >= 3 and not (all(y in STOP for y in x.split()) and (len(x.split()) == 1 or x in MULTI_BLOCK)): variants[x][cat] += 1
            f = v.split()[0] if v.split() else ''
            if len(v.split()) > 1 and len(f) >= 5 and f not in STOP: firsts[f][cat] += 1

# add variants / distinctive first words only when they don't clash with a real name or across categories
for n, cnt in variants.items():
    if n not in names: names[n] = cnt
for f, cnt in firsts.items():
    if f in names or f in words_block: continue
    if len(cnt) == 1 and sum(cnt.values()) >= 1: names[f] = cnt
out = collections.defaultdict(list)
for n, cnt in names.items():
    cats = set(cnt)
    if 'groceries' in cats: c = 'groceries'  # supermarkets that also sell fuel (Meijer, Kroger): a big trip is groceries
    elif 'gas' in cats and 'conv' in cats: c = 'gasconv'
    elif cats == {'conv'}: c = 'conv'
    else: c = cnt.most_common(1)[0][0]
    out[c].append(n)

# global word model: generic words from brand names that point strongly to one category
wc = collections.defaultdict(collections.Counter)
for n, cnt in names.items():
    c = cnt.most_common(1)[0][0]
    for tok in set(n.split()):
        if len(tok) >= 4 and tok not in STOP and not tok.isdigit(): wc[tok][c] += 1
words = {}
for tok, cnt in wc.items():
    tot = sum(cnt.values()); c, k = cnt.most_common(1)[0]
    if tot >= 4 and k / tot >= 0.75 and c not in ('cash',): words[tok] = c

data = {'v': 'nsi-' + version, 'cats': {c: '|'.join(sorted(v)) for c, v in out.items()}, 'words': words}
js = '/* Brand names from OpenStreetMap name-suggestion-index (BSD-3-Clause), mapped to Clearli categories by tools/build_merchants.py */\nwindow.MERCHANTS=' + json.dumps(data, separators=(',', ':')) + ';\n'
dst = os.path.join(ROOT, 'android/assets/www/js/merchants.js')
open(dst, 'w').write(js)
print('version', version, 'names', sum(len(v) for v in out.values()), {c: len(v) for c, v in sorted(out.items(), key=lambda x: -len(x[1]))}, 'words', len(words), 'size KB', len(js) // 1024)

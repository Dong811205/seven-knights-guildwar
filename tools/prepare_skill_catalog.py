#!/usr/bin/env python3
"""Import original game skill icons from cached 7K Atlas source records.

Usage: python tools/prepare_skill_catalog.py /absolute/source_cache
The source slot mapping is explicit: s1->s1, ultimate->s2, awakened->awakened.
Game battle UI vertical order was matched to supplied screenshots; never derive it
from translated names, array insertion order or the icon filename's last digit.
"""
import concurrent.futures
import json
import pathlib
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = pathlib.Path(sys.argv[1])
ORDER = ['awakened', 's2', 's1']
KEYS = {'s1': 's1', 'ultimate': 's2', 'awakened': 'awakened'}
app = json.loads((ROOT / 'app-data.json').read_text())
assets = ROOT / 'assets' / 'skills'
assets.mkdir(parents=True, exist_ok=True)
urls = {}
heroes = {}
missing = []

def record(hero_id, form, skill):
    source_path = skill['icon']
    filename = pathlib.PurePosixPath(source_path).name
    urls['assets/skills/' + filename] = 'https://7katlas.com/' + source_path
    translated = next((s for s in app['skills'] if s['hero_id'] == hero_id and s['form'] == form and s['game_skill_group_id'] == skill['skill_group_id']), {})
    return {
        'key': KEYS[skill['key']],
        'source_key': skill['key'],
        'skill_group_id': skill['skill_group_id'],
        'icon': 'assets/skills/' + filename,
        'name_tw': translated.get('name_tw') or skill.get('name_tw') or skill.get('name') or '',
        'converts': bool(skill.get('converts')),
    }

for hero in app['heroes']:
    if not hero['released_in_source']:
        continue
    hero_id = hero['hero_id']
    raw = (SOURCE / ('en_' + hero_id + '.js')).read_text()
    data = json.loads(raw[raw.index('(')+1:raw.rindex(')')])
    forms = {}
    for form in dict.fromkeys(s['form'] for s in app['skills'] if s['hero_id'] == hero_id):
        pool = data.get('skills_s6') if form == 's6' else data['skills']
        if not pool:
            missing.append([hero_id, form, 'source_form_missing'])
            continue
        rows = []
        for key in ORDER:
            source_key = next(k for k, v in KEYS.items() if v == key)
            matches = [s for s in pool if s['key'] == source_key]
            if not matches:
                continue
            base = next((s for s in matches if not s.get('converts')), None)
            if base is None:
                missing.append([hero_id, form, source_key])
                continue
            row = record(hero_id, form, base)
            variants = [record(hero_id, form, s) for s in matches if s.get('converts')]
            if variants:
                row['converted_variants'] = variants
            rows.append(row)
        forms[form] = rows
    portraits = {form: 'assets/heroes/' + hero_id + '.webp' for form in forms}
    if 'awakened' in forms:
        portrait_path = 'assets/skill-portraits/' + hero_id + '-awakened.webp'
        portraits['awakened'] = portrait_path
        urls[portrait_path] = 'https://7katlas.com/' + data['portraits']['awk'].replace('images/heroes/raw/', 'images/heroes/thumb/')
    heroes[hero_id] = {'forms': forms, 'portraits': portraits}

if missing:
    raise RuntimeError('Incomplete mapping: ' + json.dumps(missing))

def download(item):
    filename, url = item
    target = ROOT / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes()[:4] == b'RIFF':
        return filename
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                blob = response.read()
            if blob[:4] != b'RIFF' or blob[8:12] != b'WEBP':
                raise ValueError('Not a WebP image: ' + url)
            target.write_bytes(blob)
            return filename
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1)

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(download, urls.items()))

catalog = {
    'updated_at': '2026-11-16',
    'order': ORDER,
    'order_evidence': {
        'source': 'Game battle UI screenshots supplied by the user, 2026-11-16',
        'confirmed_heroes': ['li', 'clemyth', 'giyu-tomioka', 'hayeon'],
        'rule': 'Top to bottom: awakened, Skill 2 (source ultimate), Skill 1 (source s1). Unawakened heroes omit the awakened slot. No sorting by icon filename.',
    },
    'source': 'https://7katlas.com/hero/',
    'heroes': heroes,
}
(ROOT / 'skill-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'heroes': len(heroes), 'forms': sum(len(h['forms']) for h in heroes.values()), 'icons': len(results), 'missing': missing, 'bytes': sum((ROOT / path).stat().st_size for path in urls)}))

#!/usr/bin/env python3
"""Offline, read-only lookup for the Seven Knights database. Standard library only."""
import sqlite3,argparse,json
from pathlib import Path
p=argparse.ArgumentParser(description='七騎士角色技能查詢（離線）')
p.add_argument('keyword',nargs='?',default='')
p.add_argument('--effect',action='store_true',help='依技能效果文字搜尋角色')
p.add_argument('--form',choices=['awakened','s6','source_default'])
p.add_argument('--include-unreleased',action='store_true')
a=p.parse_args();db=sqlite3.connect(Path(__file__).resolve().parent.parent / 'data' / 'seven_knights.sqlite3');db.row_factory=sqlite3.Row
if a.effect:
 rows=db.execute('''SELECT DISTINCT h.name_tw,h.name_en FROM heroes h JOIN skills s USING(hero_id) JOIN skill_effects e USING(skill_id) WHERE (e.description_tw LIKE ? OR e.description_en LIKE ?) AND (? OR h.released_in_source=1) ORDER BY h.name_tw''',('%'+a.keyword+'%','%'+a.keyword+'%',int(a.include_unreleased))).fetchall()
 for r in rows:print(r['name_tw'] or r['name_en'])
 print('共',len(rows),'名；效果文字相符不代表已驗證克制關係。');raise SystemExit
if not a.keyword:
 a.keyword=input('輸入角色名稱（例如 李、艾瑞絲、克萊密絲）：').strip()
rows=db.execute('''SELECT DISTINCT h.* FROM heroes h LEFT JOIN aliases a USING(hero_id) WHERE (h.name_tw LIKE ? OR h.name_en LIKE ? OR a.alias=?) AND (? OR h.released_in_source=1) ORDER BY h.name_tw''',('%'+a.keyword+'%','%'+a.keyword+'%',a.keyword,int(a.include_unreleased))).fetchall()
exact=db.execute('SELECT DISTINCT h.* FROM heroes h JOIN aliases a USING(hero_id) WHERE a.alias=? AND (? OR h.released_in_source=1)',(a.keyword,int(a.include_unreleased))).fetchall()
if exact:rows=exact
if not rows:print('查無角色。');raise SystemExit(1)
for h in rows:
 print('\n'+(h['name_tw'] or h['name_en'])+' / '+h['name_en']+' / '+(h['role_tw'] or '')+' / '+h['rarity'])
 print('狀態：來源已匯入，尚未官方逐項核對。')
 for st in db.execute('SELECT * FROM hero_stats WHERE hero_id=?',(h['hero_id'],)):
  print('基礎面板',st['form'],'生命',st['hp'],'防禦',st['defense'],'速度',st['speed'],'物攻',st['physical_attack'],'魔攻',st['magic_attack'])
 for s in db.execute('SELECT * FROM skills WHERE hero_id=? AND (? IS NULL OR form=?)',(h['hero_id'],a.form,a.form)):
  print('\n['+s['form']+'] '+s['slot_tw']+' '+(s['name_tw'] or s['name_en'] or ''))
  if s['cooldown_value'] is not None:print('冷卻原始值：',s['cooldown_value'])
  for e in db.execute('SELECT * FROM skill_effects WHERE skill_id=? ORDER BY group_order,effect_order',(s['skill_id'],)):
   print('  '+(e['target_tw'] or e['target_en'] or '')+'：'+(e['description_tw'] or e['description_en']))
  for u in db.execute('SELECT * FROM skill_upgrades WHERE skill_id=?',(s['skill_id'],)):
   print('  '+(u['required_tier'] or '技能強化')+'：'+(u['description_tw'] or u['description_en']))
  for d in db.execute('SELECT * FROM effect_definitions WHERE skill_id=?',(s['skill_id'],)):
   print('  效果說明 '+(d['name_tw'] or d['name_en'])+'：'+(d['description_tw'] or d['description_en']))
 print('來源：https://7katlas.com/hero/'+h['hero_id']+'.html')

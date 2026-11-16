#!/usr/bin/env python3
"""Read-only lookup of imported 7K Atlas guild-war recommendations."""
import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser(description='依敵方隊伍查詢7K Atlas出刀建議（離線）')
g=p.add_mutually_exclusive_group(required=True)
g.add_argument('--defense',help='敵方隊伍代碼，例如 physical/9A')
g.add_argument('--heroes',nargs=3,metavar='角色',help='輸入三名敵方角色，可使用唯一的名稱片段')
g.add_argument('--team',help='查看指定隊伍完整配置')
g.add_argument('--list',action='store_true',help='列出來源隊伍代碼')
p.add_argument('--limit',type=int,default=5)
p.add_argument('--include-unused',action='store_true',help='僅列表時顯示未使用變體；不改變推薦排除規則')
a=p.parse_args();db=sqlite3.connect(Path(__file__).resolve().parent.parent / 'data' / 'seven_knights.sqlite3');db.row_factory=sqlite3.Row

def j(v):return json.loads(v) if v else []
def hero(hid):return db.execute('SELECT name_tw FROM heroes WHERE hero_id=?',(hid,)).fetchone()[0]
def show_team(tid):
 t=db.execute('SELECT * FROM guildwar_teams WHERE team_id=?',(tid,)).fetchone()
 if not t:print('查無隊伍：'+tid);return
 print('\n'+tid+'　'+t['heroes_tw']+'　'+t['status_tw']+'　'+('/'.join(j(t['used_in_json']))))
 print('陣型1：'+t['formation1_tw']+('；陣型2：'+t['formation2_tw'] if t['formation2_tw'] else ''))
 for h in db.execute('SELECT * FROM guildwar_team_members WHERE team_id=? ORDER BY member_order',(tid,)):
  print('  '+hero(h['hero_id'])+'：'+('覺醒' if h['source_awakened'] else '未覺醒')+'；F1 '+str(h['formation1_row'])+('；F2 '+str(h['formation2_row']) if h['formation2_row'] else ''))
 print('寵物選項：'+'／'.join(j(t['pet_options_tw_json'])))
 queue=db.execute('SELECT * FROM guildwar_skill_queue WHERE team_id=? ORDER BY position',(tid,)).fetchall()
 print('技能預約：'+' → '.join(hero(q['hero_id'])+' '+q['skill_label_tw'] for q in queue))
 print('配裝參考（同角色／隊伍類別的來源選項，並非每項須同時裝備）：')
 for member in db.execute('SELECT hero_id FROM guildwar_team_members WHERE team_id=? ORDER BY member_order',(tid,)):
  for b in db.execute('SELECT * FROM guildwar_hero_builds WHERE hero_id=? AND category=? ORDER BY variant_order',(member['hero_id'],t['category'])):
   print('  '+hero(b['hero_id'])+' 配裝'+str(b['variant_order'])+'：'+b['gear_set_tw']+'；超越來源值 '+str(b['required_transcendence_source']))
   for key,label in [('weapon','武器'),('armor','防具'),('substats','副屬性'),('accA','飾品A'),('accB','飾品B'),('de','專屬裝備')]:
    if j(b[key+'_tw_json']):print('    '+label+'：'+'／'.join(j(b[key+'_tw_json'])))
 print('來源更新日：'+t['source_updated_date']+'；7K Atlas來源建議，未附實戰勝率。')
 print('來源：https://7katlas.com/guildwar.html')
if a.list:
 for t in db.execute('SELECT * FROM guildwar_teams WHERE (? OR status_source!=?) ORDER BY category,source_order,team_id',(int(a.include_unused),'Unused')):
  print(t['team_id']+'　'+t['heroes_tw']+'　'+t['status_tw'])
 raise SystemExit
if a.team:
 show_team(a.team);raise SystemExit
ids=[]
if a.defense:
 ids=[a.defense]
 if not db.execute('SELECT 1 FROM guildwar_teams WHERE team_id=?',(a.defense,)).fetchone():p.error('查無隊伍代碼，請用 --list 檢查。')
else:
 hids=[]
 for keyword in a.heroes:
  rows=db.execute('SELECT DISTINCT h.hero_id,h.name_tw FROM heroes h JOIN aliases a USING(hero_id) WHERE a.alias=?',(keyword,)).fetchall()
  if not rows:rows=db.execute('SELECT hero_id,name_tw FROM heroes WHERE name_tw LIKE ? OR name_en LIKE ?',('%'+keyword+'%','%'+keyword+'%')).fetchall()
  if len(rows)!=1:p.error('角色「'+keyword+'」無法唯一辨識：'+str([r['name_tw'] for r in rows]))
  hids.append(rows[0]['hero_id'])
 if len(set(hids))!=3:p.error('請輸入三名不同角色。')
 for t in db.execute('SELECT * FROM guildwar_teams WHERE (? OR status_source!=?)',(int(a.include_unused),'Unused')):
  if set(j(t['hero_ids_json']))==set(hids):ids.append(t['team_id'])
 if not ids:print('來源尚無這三名角色的隊伍作業；不推估替代隊伍。');raise SystemExit
print('同名三人組仍需核對覺醒、陣型、站位、技能與寵物。來源建議不等於保證獲勝。')
for tid in ids:
 t=db.execute('SELECT * FROM guildwar_teams WHERE team_id=?',(tid,)).fetchone()
 print('\n目標 '+tid+'　'+t['heroes_tw']+'　'+t['status_tw'])
 print('目標寵物選項：'+'／'.join(j(t['pet_options_tw_json'])))
 # Showing exact target details avoids merging different defensive variants.
 for m in db.execute('SELECT * FROM guildwar_team_members WHERE team_id=? ORDER BY member_order',(tid,)):
  print('  '+hero(m['hero_id'])+' '+('覺醒' if m['source_awakened'] else '未覺醒')+' F1:'+str(m['formation1_row'])+' F2:'+str(m['formation2_row']))
 wins=db.execute('''SELECT c.*,t.used_in_json FROM guildwar_counter_lookup c JOIN guildwar_teams t ON t.team_id=c.attacker_team_id WHERE c.defender_team_id=? ORDER BY CASE c.status_source WHEN 'Major' THEN 0 WHEN 'Minor' THEN 1 ELSE 2 END,c.attacker_team_id LIMIT ?''',(tid,max(1,a.limit))).fetchall()
 if not wins:print('沒有可直接引用的有利作業；未知不代表不能打。')
 for w in wins:
  print('\n來源標記有利：'+w['attacker_team_id']+'　'+w['attacker_heroes_tw'])
  if 'Offense' not in j(w['used_in_json']):print('注意：原站此變體用途未標進攻，但另有有利對局記錄，需人工確認。')
  show_team(w['attacker_team_id'])
 losses=db.execute("SELECT DISTINCT t.team_id,t.heroes_tw FROM guildwar_matchups m JOIN guildwar_teams t ON t.team_id=m.attacker_team_id WHERE m.defender_team_id=? AND m.attack_outcome_source='loss' AND m.eligible_for_recommendation=1",(tid,)).fetchall()
 if losses:print('\n來源標記不利：'+'；'.join(r['team_id']+' '+r['heroes_tw'] for r in losses))
 conflicts=db.execute('SELECT * FROM guildwar_conflicts WHERE defender_team_id=?',(tid,)).fetchall()
 if conflicts:print('\n已排除來源矛盾：'+'、'.join(r['attacker_team_id'] for r in conflicts)+'；同一對局同時標有利與不利。')

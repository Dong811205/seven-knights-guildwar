# 七騎士 Re:BIRTH 角色與技能資料庫 v0.2

## 手機直接查詢

**[開啟七騎士公會戰出刀助手](https://dong811205.github.io/seven-knights-guildwar/)**

手機與電腦皆可直接開啟的公開網站，無需登入。

- 選擇敵方三名角色，查詢來源有利作業。
- 核對站位、覺醒狀態、寵物、技能預約與配裝。
- 查角色技能，設定持有／本場已用角色並篩選。
- 收藏與最近查詢儲存在目前裝置。

[下載手機網站完整原始碼 v0.3](downloads/SevenKnights_Mobile_v0.3.zip)，包含125張角色縮圖、完整資料快照及靜態HTML/JS/CSS。解壓後使用靜態HTTP伺服器開啟；直接雙擊HTML可能因瀏覽器限制而無法讀取JSON。


完整壓縮包：[下載 v0.2](downloads/SevenKnights_Database_v0.2.zip)。

建立日期：2026/11/16。範圍：全球版公開角色資料，附繁中與英文對照。

這是供後續公會戰推薦程式使用的資料庫，並附角色技能查詢與公會戰作業查詢程式。v0.2已加入7K Atlas的公會戰建議。這一版完成來源匯入與資料關聯，尚未完成官方逐項核對、戰鬥模擬及克制規則驗證。不要把「有技能資料」視為「能精確算勝率」。

## 開啟與使用

- `data/seven_knights.sqlite3`：關聯式資料庫，可用 SQLite / DB Browser for SQLite 開啟。
- `data/database.json`：同一份完整資料，供網頁或其他程式匯入。
- `data/csv/*.csv`：各資料表的 UTF-8 BOM 版本，可供試算表或其他工具匯入。
- `data/coverage.json`：本次實際收錄數量與範圍。
- `data/validation.json`：結構檢查結果，以及沒有完成的驗證。
- `tools/lookup.py`：僅使用 Python 標準函式庫的離線查詢程式；SQLite 檔位於 data/ 資料夾。

在資料夾開啟終端機，可執行：

```bash
python tools/lookup.py 艾瑞絲
python tools/lookup.py 李 --form awakened
python tools/lookup.py 復活 --effect
```

不加參數執行 `python tools/lookup.py` 可直接輸入角色名稱。預設排除來源標為未推出的角色，加入 `--include-unreleased` 才會列入。技能名稱或描述若缺繁中，保留英文，不自行編造。

## 資料表

| 表 | 內容 |
|---|---|
| heroes | 穩定角色ID、各語言名稱、類型、稀有度、來源開放狀態、核對狀態 |
| aliases | 繁中、英文、韓文、日文、簡中、泰文別名及使用者別稱 |
| hero_stats | 來源標示的 Lv30 +5 各型態基礎面板；與玩家裝備後面板分開 |
| skills | 普攻、主動、被動、覺醒技能；覺醒前後分開保存 |
| skill_effects | 依來源順序保存技能目標及每條效果，含機率、回合等字面欄位 |
| skill_upgrades | 技能強化與各超越階段的變化，沒有自動套用成滿強化數值 |
| effect_definitions | 每個技能脈絡下的效果定義；同名但數值不同者不合併 |
| skill_tags | 來源的功能標籤，屬註解，不能直接當作結算規則 |
| growth | 角色超越及潛力資料 |
| dedicated_equipment | 來源提供的專屬裝備功能資料 |
| battle_cases / battle_case_stats | 使用者成功出刀案例與裝備後面板 |
| sources | 每名角色的來源網址、取得日期與來源內容雜湊 |
| issues | 匯入過程發現的缺漏；無記錄不等於全部機制已驗證 |
| hero_skill_lookup | 供程式直接查詢中英文技能效果的 SQL view |

## 版本與資料狀態

主要角色來源：7K Atlas 公開角色及繁中資料（https://7katlas.com/）。保留來源引用，未包入角色圖片、背景故事、影片、攻略全文或第三方網站程式。遊戲資料權利屬 Netmarble 及相關權利人。

官方補充參照：https://forum.netmarble.com/sk_rebirth_gl/view/11/7821 （夏娃更新公告）。僅列作核對來源，不表示整份角色資料已獲官方驗證。

來源快照包含125名標為已推出的角色，以及3名未推出角色。這個數量是來源名錄的範圍，不含素材肥料怪；不代表每個地區伺服器皆開放相同角色。`availability_in_user_server=unverified` 特別保留這項差異。

- `released_in_source=0`：來源未推出，排刀時不得使用。
- `verification_status=source_imported`：取得來源資料，尚未以官方／遊戲內逐條核對。
- `combat_ready=0`：尚不能單憑本資料判定對局勝率。
- `chance_pct_literal` 等欄位只抽取明確字面值；空值代表沒有取得，不是0%。
- `first_times_literal` 只記錄文字中第一個「N time(s)」，可能是命中次數或觸發條件，不可直接當作傷害段數。
- `cooldown_value` 保留來源原值；`cooldown_unit` 未核對前不假設單位。
- 技能描述內的攻擊基準、條件、次數上限與例外必須一併閱讀，不能只拿百分比相加。
- 同一角色的 `awakened`、`s6`、`source_default` 是不同資料狀態；推薦時必須選擇正確型態。
- 來源日期是取得日期；不能當成官方技能最後修改日期。後續改版須重取資料並比較差異。

## 使用者出刀案例

2026/11/16，使用者回報以李＋克萊密絲＋艾瑞絲打「炭夏宣」獲勝一次，附三名角色的公會戰進攻面板。

| 角色 | 生命 | 防禦 | 攻速 | 減傷 | 效果抵抗 | 誕生 |
|---|---:|---:|---:|---:|---:|---:|
| 李 | 18,203 | 2,275 | 28 | 32% | 0% | 36% |
| 克萊密絲 | 17,142 | 1,980 | 23 | 42% | 65% | 42% |
| 艾瑞絲 | 14,922 | 1,673 | 25 | 42% | 20% | 48% |

原作業與本次實戰是兩個證據來源。「艾瑞絲改誕生」為原作業文字修正；本次實戰面板顯示誕生48%。不得從原作業推定本次寵物、技能順序與站位，也不由一次成功推算穩拆勝率或最低門檻。敵方正式角色ID及完整配置尚未確認，先保留使用者別稱。

## 後續推薦程式接法

先依角色ID與型態查技能，再套用已確認的技能強化、超越、裝備及寵物。技能條件、解除／免疫的互動與結算順序，需另建經過驗證的規則表。實戰案例提供實際觀察，不能取代機制驗證。

SQL 範例：

```sql
SELECT * FROM hero_skill_lookup WHERE name_tw = '艾瑞絲';
SELECT * FROM skill_upgrades WHERE skill_id LIKE 'li:%';
SELECT * FROM battle_case_stats WHERE case_id = 'user_win_20261116_01';
```


## v0.2：公會戰作業資料

來源：[7K Atlas 公會戰](https://7katlas.com/guildwar.html)，原站標示更新日2026/11/15，取得日2026/11/16。

新增31個隊伍主題、108套隊伍變體、121份角色配裝選項及206筆原始對局關係。原始關係包含對特定變體或整個隊伍主題的標記，展開後共有393組進攻／防守配對、396筆結果記錄。這些是網站推薦關係，不是396場實戰，也沒有來源勝率或樣本數。

### 直接查出刀作業

```bash
python tools/guildwar_lookup.py --heroes 炭治郎 夏言 宣嵐
python tools/guildwar_lookup.py --defense physical/8C
python tools/guildwar_lookup.py --team magic/1C
python tools/guildwar_lookup.py --list
```

輸出會顯示精確敵方變體、覺醒狀態、站位、建議進攻隊、寵物選項、陣型、技能預約與各角色的配裝參考。角色名稱片段必須能唯一對應，不會自動猜測。

- 來源的Major／Minor／Situational／Unused分別顯示為主流／次選／情境使用／未使用；這些是來源標記，不是實戰勝率排序。
- 16套Unused變體仍保留，但預設列表與直接推薦排除。
- 同名三人組不等於同一個作業；覺醒狀態、寵物、技能順序與陣型仍需核對。
- 來源配裝是按角色與隊伍類別整理的選項，未指明每套隊伍必須使用哪個配裝變體。多個選項不表示能同時裝上所有效果。
- 配裝只保留原站提供的條件；不能自行補成最低攻擊力、抗性或速度門檻。
- 若來源對局記錄有利，但該隊用途沒有標Offense，查詢會提示需人工確認。
- 既有使用者成功案例仍獨立保存，沒有假設與網站作業相同。

### 新資料表

| 表 | 用途 |
|---|---|
| guildwar_groups | 31個主題與變體清單 |
| guildwar_teams | 108套隊伍、用途、主流標記、陣型、寵物選項 |
| guildwar_team_members | 對應既有角色ID、覺醒需求、兩種陣型站位 |
| guildwar_skill_queue | 技能預約順序；S1對應s1，S2對應ultimate |
| guildwar_hero_builds | 121份超越、套裝、武防副屬性、飾品及專屬裝備參考 |
| guildwar_matchup_claims | 206筆來源原始有利／不利記錄，保留group與variant範圍 |
| guildwar_matchups | 將主題記錄展開到實際變體，保留原始claim_id以便追查 |
| guildwar_conflicts | 來源自相矛盾的3組對局，暫停推薦 |
| guildwar_counter_lookup | 已排除矛盾與Unused變體的有利出刀查詢view |

### 原站對局矛盾

即死隊death/1A、death/1B、death/1C各自對magic/2F同時出現「特定變體有利」與「所屬整個主題不利」記錄。原站沒有提供消除這項矛盾的條件，因此本版保留兩者，將3組配對標為未解決，排除直接推薦。沒有擅自將較細的標記視為已驗證例外。

### 本版檢查

已檢查所有角色ID、對局引用、三人隊伍成員、技能預約成員、克制方向、整組與特定變體展開，以及矛盾／Unused排除。SQLite完整性與外鍵檢查通過。實際戰鬥結果仍取決於雙方配置，沒有用匯入資料假造勝率。

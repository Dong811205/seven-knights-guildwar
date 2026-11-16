# 選單與視覺素材來源

更新日期：2026-11-16。此專案為玩家公會攻略工具，非官方網站。

- 七騎士 Re:BIRTH 背景與標誌：Netmarble 官方網站 https://sena.netmarble.com/tc/
  - 背景：https://sgimage.netmarble.com/mobile/game/tskgb/brand/v2/img/cdae012f220e.jpg
  - 標誌：https://sgimage.netmarble.com/mobile/game/tskgb/brand/v2/img/55359948a2cb.png
- 傳說寵物名錄與圖片：7K Atlas 寵物圖鑑 https://7katlas.com/pets.tw.html
  - 核對已推出18隻傳說寵物；另外5隻來源標記未推出，不放入已推出選單。
  - 只保存名稱、稀有度、推出日期與原圖，未複製攻略評語、故事、技能全文或網站程式。
- 套裝原圖：7K Atlas 配裝計算器 https://7katlas.com/calculator.tw.html 所引用的遊戲套裝徽章，共9種。
- 陣型：既有公會戰資料中的基本、平衡、攻擊、保護四種陣型與前後排人數。
- 角色新舊排序：依既有資料庫的 `release_date_source`，由新到舊；同日以繁中名稱排序。未知日期排最後，來源標為未推出的角色不列入。

素材權利屬 Netmarble 及相關權利人；資料整理來源為 7K Atlas。沒有加入音樂。

## 裝備與角色類型選單（v0.6）

- 角色類型原圖：`https://7katlas.com/images/classification/RoleIcon_Type0{1..5}_{Attack,Magic,Defense,Support,Universal}.webp`，檔名映射核對 `https://7katlas.com/hero-panel.js`。
- 武器主屬性10種、防具主屬性9種：配裝計算器引用的 `https://7katlas.com/BUILD%20CALCULATOR/gear_stat_scaling.js` 中 `weapon_main` / `armor_main`。
- 飾品效果與稀有度：`https://7katlas.com/acc-icons.js`。分開記錄原始效果，復合戒指由兩個效果構成，不把範例組合當成額外效果。紀念戒指保留獨立名稱。
- 專屬裝備調律屬性：`https://7katlas.com/gear-icons.js` 和 `https://7katlas.com/BUILD%20CALCULATOR/dedicated_tuning.js`；共9種，每種3檔數值。來源計算器對所有角色使用同一調律池，未限制某角色只能抽到某種調律屬性。角色本身專屬裝備技能不混入調律選單。
- 繁中名稱核對 `https://7katlas.com/lang/tw/ui.js`；防禦力主屬性名稱按能力值語境處理，避免誤用「防禦型」角色分類。

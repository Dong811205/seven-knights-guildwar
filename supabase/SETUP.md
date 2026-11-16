# Discord 公會攻略設定

此版本使用 Discord 登入與角色權限，不開放以邀請碼自行加入／自授管理權。

## 1. 套用資料庫

在 Supabase SQL Editor 執行 `migrations/20261116130259_discord_guild_guides.sql`。接著執行 `migrations/20261116130509_discord_config_hardening.sql`（已在此專案套用）。這些是一次性 migration；若已成功套用請勿重跑。所有新表明確啟用 RLS，僅授權 authenticated 必要操作。不要改成公開表或公開圖片 bucket。

## 2. Discord 應用與登入

在 Discord Developer Portal 建立此網站使用的 Application。在 OAuth2 設定新增這個 Redirect URI：

`https://exoolicwwadsjdyuozyu.supabase.co/auth/v1/callback`

在 Supabase Authentication → Sign In / Providers → Discord 啟用，填入該 Application 的 Client ID 與 Client Secret。Client Secret 只輸入 Supabase 設定，禁止提交 GitHub。

Supabase Authentication → URL Configuration：

- Site URL: `https://dong811205.github.io/seven-knights-guildwar/`
- Redirect URLs 加入：`https://dong811205.github.io/seven-knights-guildwar/guild.html`

網站要求 `identify email guilds.members.read` scopes。使用者同意後，Edge Function 會用 OAuth token 讀取本人及指定伺服器的 member/roles；不讀取聊天、不發送訊息、不需要 Discord Bot。

## 3. 指定公會與身分組

開啟 Discord「使用者設定 → 進階 → 開發者模式」，複製伺服器與身分組 ID。於專案 SQL Editor 執行下方設定，先換掉所有範例 ID：

```sql
update gvg_private.discord_config
set discord_guild_id = '你的伺服器ID',
    viewer_role_ids = array['可查看攻略的身分組ID'],
    editor_role_ids = array['會長或幹部投稿的身分組ID'],
    admin_role_ids = array['網站管理身分組ID']
where singleton;
```

- viewer: 看已發布攻略／圖片、留言回報；不能新增或修改攻略。
- editor: 包含查看資格，並能新增及編輯／刪除自己的攻略、圖片。
- admin: 包含投稿資格，能整理全公會攻略、刪除回報，也能查看所有草稿。
- 不需要的角色清單填 `array[]::text[]`。管理身分組不用同時列入 viewer；editor、admin 均自帶閱讀資格。
- 不會因 Discord 的通用 Administrator 權限自動授予本網站管理權，必須明確設定角色 ID。
- 初始設定的身分組陣列皆為空，預設拒絕所有人。

伺服器與角色 ID 並非密碼，但實際配置建議留在資料庫，不提交到公開 repo。角色只認 ID，不認可重名的名稱。

## 4. 部署驗證服務

部署 `functions/discord-access/index.ts` 為 Supabase Edge Function `discord-access`。設定 `verify_jwt=false`（因新版 publishable key），函式本體會對每個請求呼叫 `auth.getUser()` 驗證 Supabase access token，並比對 Discord 真實使用者 ID。部署時保持此驗證，不可刪除。

Supabase 自動提供 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 給 Edge Functions，不把它們加到網頁或 GitHub；後端憑證僅用於角色同步的受限 RPC。沒有任何前端可自行修改會員或角色的資料庫權限。

CLI 已登入時可用：

```sh
supabase functions deploy discord-access --project-ref exoolicwwadsjdyuozyu --no-verify-jwt
```

## 5. 驗證

請用四種真實 DC 帳號測試：未入群、入群但無角色、viewer、editor/admin。角色移除或離群後，資料庫驗證資格最長有效2分鐘；網頁每分鐘重新向 Discord 查詢，網路中斷且資格到期會清空畫面。已下載或截圖的內容無法撤回。

測試普通成員不能用直接 API 投稿、不能讀取草稿、不能讀取其他公會的攻略或私有圖檔。作者草稿只對作者及 admin 開放。這些 RLS 邏輯已有 PGlite PostgreSQL 整合測試，執行 `npm test`；真實 OAuth、Discord 與 Supabase Storage 仍需設定完成後驗證。

圖片走 authenticated download 後建立當頁 blob URL，不使用公開 bucket 或可轉傳的長效 signed URL。攻略與草稿不寫入 localStorage；未儲存內容離頁即失。登入 session 由 Supabase SDK 管理，Discord token 到期／遺失時須重新登入。

## 費用與限制

依 Supabase 與 Discord 的實際用量、配額與 rate limit 運行；不要假設永久免費或無限流量。本版單次最多載入最近500篇攻略，圖片每篇最多12張、每張5MB。外部影片權限由影片平台另外控管。

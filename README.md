# 家的時光

我們家自己的照片時光軸,取代「時光小屋」。手機用,像 App 一樣加到主畫面。

- 小孩的相簿:全家都看得到(阿公阿嬤用邀請連結進來)
- 「我們倆」相簿:只有管理員(爸媽)看得到
- 每一則可以「分享到 LINE」(做一個 30 天有效的連結,不用登入也看得到)
- 上傳從手機相簿選,照片會自動抓拍照日期;iCloud / Google 相簿的照片在手機上都選得到

## 技術

Next.js + Supabase(資料庫 + Storage,RLS 全鎖、只有伺服器用 service role 碰)+ Vercel。
沒有帳號密碼:管理員產生「邀請連結」,家人點了就登入,cookie 兩年。

## 第一次架起來(Eric 要做的)

1. Supabase 開一個新專案(不要跟補習班共用),地區選 Tokyo。
2. SQL Editor 貼 `supabase/migrations/0001_init.sql` 全文,執行。
3. Storage → Settings → Upload file size limit 改成 500 MB(時光小屋最大的影片 117 MB)。
4. Project Settings → API:把 URL 和 service_role key 填進 `.env.local`(照 `.env.local.example`)。
5. 搬時光小屋的資料(照片已經抓在 `~/Documents/family-album-data/timehut/`):
   ```
   node scripts/timehut-import.mjs ~/Documents/family-album-data/timehut/compact.json ~/Documents/family-album-data/timehut
   ```
6. GitHub 開 private repo → Vercel 匯入 → 環境變數填三個(`NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`APP_URL`=正式網址)。
7. 用手機開 `https://<網址>/join/<邀請碼>`(第一組邀請碼在 migration 裡,7 天內有效)。

## 時光小屋搬家的腳本

- `scripts/timehut-download.mjs`:照 `compact.json` 把原檔抓到本機(影片另抓一張封面)。可重跑。
- `scripts/timehut-import.mjs`:把本機的檔案上傳到 Supabase Storage、寫資料表。可重跑(搬過的跳過)。
- `compact.json` 是用 Chrome 登入時光小屋後,從它的網頁 API(`/events/updates`、`/events/<id>.json`、`/events/<id>/comments`)抓下來再壓縮的。原檔網址把 `ae.peekaboocdn.com` 換成 `aehk.peekaboocdn.com` 就不用簽名。

## 資料表

`albums` 相簿、`members` 成員、`invites` 邀請、`sessions` 登入狀態、`moments` 一則、`media` 照片/影片、`likes`、`comments`、`share_links`。
檔案在 Storage 的 `media` bucket(私人),路徑 `<相簿>/<則>/<檔>.jpg`,縮圖 `_t.jpg`。

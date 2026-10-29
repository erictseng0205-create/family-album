<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 這個專案的規矩

- 使用者是非技術人員,對話用繁體中文、不講術語。
- 這是 Eric 自己家的相簿,跟補習班的 reading-cert 完全分開:不同 Supabase 專案、不同 Vercel 專案。
- `git push` 掛了 pre-push hook(`scripts/prepush-check.sh`):自動跑 `tsc --noEmit` + `next build`,失敗會擋下。不要用 `--no-verify`。
  hook 在 `.git/hooks/pre-push`,不會跟著 repo 走;重新 clone 要再裝:`cp scripts/prepush-check.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push`。
- 要 Eric 跑 SQL 時,把 SQL 全文貼在對話裡,不要只給檔案路徑。
- 時光小屋搬家的原始資料在 `~/Documents/family-album-data/timehut/`(不在 repo)。

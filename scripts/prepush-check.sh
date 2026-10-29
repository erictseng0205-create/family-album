#!/bin/sh
# push 之前自動跑:型別檢查 + 正式 build,任一失敗就擋下
cd "$(git rev-parse --show-toplevel)" || exit 1
echo "[pre-push] tsc --noEmit"
npx tsc --noEmit || { echo "[pre-push] 型別檢查失敗,不推"; exit 1; }
echo "[pre-push] next build"
npm run build || { echo "[pre-push] build 失敗,不推"; exit 1; }
echo "[pre-push] OK"

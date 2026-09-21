#!/usr/bin/env bash
# ローカルで Kaname を起動する（DB → API → 画面）。触って確かめるための 1 本。
#   bash scripts/dev/up.sh          起動する
#   bash scripts/dev/up.sh --stop   止める
#   bash scripts/dev/up.sh --status 今どうなっているかだけ見る
# 値は .env.example（ローカル専用の既定）。秘密は入っていない。staging／本番の値はここには置かない。
set -uo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
LOG="$ROOT/.dev-logs"
mkdir -p "$LOG"

export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
API_PORT=3011
WEB_PORT=3124
PG_CONTAINER=kaname-pg

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m●\033[0m %s\n' "$*"; }
ng() { printf '  \033[31m●\033[0m %s\n' "$*"; }
alive() { curl -s -m 3 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null; }

status() {
  say "いまの状態"
  if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then ok "DB（docker $PG_CONTAINER）動いている"; else ng "DB（docker $PG_CONTAINER）止まっている"; fi
  [ "$(alive http://127.0.0.1:$API_PORT/health)" = 200 ] && ok "API  http://127.0.0.1:$API_PORT" || ng "API  http://127.0.0.1:$API_PORT 応答なし"
  [ "$(alive http://127.0.0.1:$WEB_PORT/login)" = 200 ] && ok "画面 http://127.0.0.1:$WEB_PORT" || ng "画面 http://127.0.0.1:$WEB_PORT 応答なし"
}

stop() {
  say "止める"
  lsof -ti:$API_PORT 2>/dev/null | xargs kill 2>/dev/null && ok "API を止めた" || ok "API は動いていない"
  lsof -ti:$WEB_PORT 2>/dev/null | xargs kill 2>/dev/null && ok "画面を止めた" || ok "画面は動いていない"
  echo "  DB（docker $PG_CONTAINER）はそのまま。止めるなら docker stop $PG_CONTAINER"
}

case "${1:-}" in
  --status) status; exit 0 ;;
  --stop) stop; exit 0 ;;
esac

# ---- 1. DB
say "1／4 DB"
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    docker start "$PG_CONTAINER" >/dev/null && ok "起こした（$PG_CONTAINER）"
  else
    docker run -d --name "$PG_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 55433:5432 pgvector/pgvector:pg16 >/dev/null \
      && ok "作った（$PG_CONTAINER・127.0.0.1:55433）" || { ng "DB を作れない。Docker Desktop が動いているか見る"; exit 1; }
    sleep 6
    docker exec "$PG_CONTAINER" psql -U postgres -c "create database kaname_test" >/dev/null 2>&1
  fi
  sleep 3
else ok "動いている（$PG_CONTAINER）"; fi

# ---- 2. 設定（ローカル専用の既定。秘密ではない）
say "2／4 設定"
set -a
# .env.example は「KEY=値」の並び。値に < > や空白が入る行があるので source せずに読む
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  key=${line%%=*}; val=${line#*=}
  case "$key" in *[!A-Za-z0-9_]*) continue ;; esac
  printf -v "$key" '%s' "$val"; export "${key?}"
done < "$ROOT/.env.example"
# ローカルだけの上書き（.env は git に入らない）。Resend の鍵などはここから
if [ -f "$ROOT/.env" ]; then
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    key=${line%%=*}; val=${line#*=}
    case "$key" in *[!A-Za-z0-9_]*) continue ;; esac
    printf -v "$key" '%s' "$val"; export "${key?}"
  done < "$ROOT/.env"
  ok "ローカルの上書きを読んだ（.env）"
fi
PORT=$API_PORT
BASE_URL="http://127.0.0.1:$API_PORT"
# 画面の出どころ（CORS）。本番ビルド 3124 と next dev 3123 の両方を許す
WEB_BASE_URL="http://127.0.0.1:$WEB_PORT,http://localhost:$WEB_PORT,http://localhost:3123"
KANAME_DEV_FAKE_BUCKET=1   # MinIO を立てずに触るため（添付の保存だけ使えない）
KANAME_API_LOG="$LOG/api.log"
set +a
ok "ローカルの既定を読んだ（.env.example）"
echo "  メールが届かなくても http://127.0.0.1:$WEB_PORT/dev/mail からリンクを押せる"

# ---- 3. API
say "3／4 API"
if [ "$(alive http://127.0.0.1:$API_PORT/health)" = 200 ]; then ok "もう動いている"
else
  if ! docker exec "$PG_CONTAINER" psql -U postgres -d kaname_test -tAc "select 1 from pg_roles where rolname='kaname_app'" 2>/dev/null | grep -q 1; then
    echo "  はじめてなので DB を作る（1〜2 分）"
    DATABASE_ADMIN_URL="postgres://postgres:postgres@127.0.0.1:55433/kaname_test" pnpm -s db:migrate >"$LOG/migrate.log" 2>&1 \
      && ok "DB を作った" || { ng "DB を作れない → $LOG/migrate.log"; exit 1; }
  fi
  nohup pnpm -s api:dev >"$LOG/api.log" 2>&1 &
  for _ in $(seq 1 30); do [ "$(alive http://127.0.0.1:$API_PORT/health)" = 200 ] && break; sleep 1; done
  [ "$(alive http://127.0.0.1:$API_PORT/health)" = 200 ] && ok "起動した" || { ng "起動しない → $LOG/api.log"; tail -5 "$LOG/api.log"; exit 1; }
fi

# ---- 4. 画面（本番と同じビルドで出す）
say "4／4 画面"
if [ "$(alive http://127.0.0.1:$WEB_PORT/login)" = 200 ]; then ok "もう動いている"
else
  echo "  ビルドする（初回 1〜2 分）"
  rm -rf apps/web/.next-prod   # 前のビルドの残りが混ざると /404 の生成で落ちる
  # next build は NODE_ENV=production で走らせる（development のままだと /404 の生成で落ちる）
  (cd apps/web && NODE_ENV=production KANAME_DEV_PAGES=1 NEXT_PUBLIC_API_BASE="http://127.0.0.1:$API_PORT" pnpm -s build:test) >"$LOG/build.log" 2>&1 \
    || { ng "ビルドできない → $LOG/build.log"; tail -5 "$LOG/build.log"; exit 1; }
  (cd apps/web && NODE_ENV=production KANAME_DEV_PAGES=1 KANAME_API_LOG="$LOG/api.log" NEXT_PUBLIC_API_BASE="http://127.0.0.1:$API_PORT" nohup pnpm -s start:test >"$LOG/web.log" 2>&1 &)
  for _ in $(seq 1 40); do [ "$(alive http://127.0.0.1:$WEB_PORT/login)" = 200 ] && break; sleep 1; done
  [ "$(alive http://127.0.0.1:$WEB_PORT/login)" = 200 ] && ok "起動した" || { ng "起動しない → $LOG/web.log"; tail -5 "$LOG/web.log"; exit 1; }
fi

say "触れます"
cat <<EOM
  ここから始める   http://127.0.0.1:$WEB_PORT/signup
  見本（土台）     http://127.0.0.1:$WEB_PORT/dev/shell
  手順（何を見るか） 07_tasks/handoff/README.md
  メールの受信箱   http://127.0.0.1:$WEB_PORT/dev/mail（送れなくてもここからリンクを押せる）
  止める           bash scripts/dev/up.sh --stop
EOM

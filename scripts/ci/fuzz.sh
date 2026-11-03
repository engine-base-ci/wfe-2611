#!/usr/bin/env bash
# G36 契約 fuzz（KN-55・Schemathesis・MIT）。
#   1) 本物の DB の列の書き出し（08_api/db-columns.json）が DB と合っている（契約の答えの形の元）
#   2) 実 Postgres＋場合表の種の上に API を立てる（apps/api/test/fuzz/server.ts・偽のセッション Bearer boss）
#   3) 作った口（入口が 501 で止めない口）を、契約から作った入力・契約の外の入力で叩き、
#      500 を返さない・答えの形と状態コードが契約どおり・契約の外のメソッドは 405 を確かめる
#   まだ作っていない口が 501 で止まり何も書かないことは、生成の試験（apps/api/test/generated）が見る。
#   使い方: DATABASE_URL=… bash scripts/ci/fuzz.sh [-n 例の数]
set -euo pipefail
cd "$(dirname "$0")/../.."
N="${FUZZ_EXAMPLES:-30}"
[ "${1:-}" = "-n" ] && N="$2"
ST="${SCHEMATHESIS:-st}"
command -v "$ST" >/dev/null || { echo "[G36] schemathesis が無い（pip install schemathesis==4.33.0）"; exit 1; }
TMP="$(mktemp -d)"
PORT="${FUZZ_PORT:-4791}"

pnpm -s exec tsx packages/db/src/cli.ts columns --check 08_api/db-columns.json

FUZZ_BUILT="$TMP/built.json" FUZZ_PORT="$PORT" pnpm -s exec tsx apps/api/test/fuzz/server.ts > "$TMP/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; wait $SRV 2>/dev/null || true; rm -rf "$TMP"' EXIT
for _ in $(seq 1 120); do
  [ -s "$TMP/built.json" ] && curl -s -o /dev/null "http://127.0.0.1:$PORT/health" && break
  kill -0 $SRV 2>/dev/null || { cat "$TMP/server.log"; echo "[G36] 的が立たなかった"; exit 1; }
  sleep 1
done
mapfile -t OPS < <(python3 -c "import json,sys;[print(x) for x in json.load(open(sys.argv[1]))]" "$TMP/built.json")
echo "[G36] 作った口 ${#OPS[@]} 本を回す（例 $N 個ずつ）"
[ "${#OPS[@]}" -eq 0 ] && { echo "[G36] 作った口が無い"; exit 0; }
INC=()
for o in "${OPS[@]}"; do INC+=(--include-operation-id "$o"); done
"$ST" run 08_api/openapi.yaml -u "http://127.0.0.1:$PORT" -H "Authorization: Bearer boss" "${INC[@]}" \
  -n "$N" -w 2 --seed 20261103 --no-color

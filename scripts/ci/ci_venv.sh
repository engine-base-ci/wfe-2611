#!/usr/bin/env bash
# CI の Python の部品（K-172）。自分の Mac の台に venv を 1 つ置き、回をまたいで使い回す（組の中で pip install しない）。
# 部品の一覧（scripts/ci/requirements-ci.txt）が変わったときだけ入れ直す。venv の bin を後の段の PATH に足す（GITHUB_PATH）。
# 台に runner がいくつもあると、同じ venv をいくつもの組が同時に入れ直しうる。入れ直しはロック（<venv>.lock・中に持ち主の pid）で
# 1 つずつにし、ロックを取った後で印を見直す（先の組が入れていれば入れ直さない）。持ち主が居ないロック（台が落ちた組の残り）は取り直す。
# 生きた持ち主のロックは取らず、KANAME_CI_LOCK_WAIT 秒（既定 300）待っても取れなければ赤。
set -euo pipefail
venv="${KANAME_CI_VENV:-$HOME/.cache/kaname-ci-venv}"
req="${KANAME_CI_REQ:-$(cd "$(dirname "$0")" && pwd)/requirements-ci.txt}"
wait_s="${KANAME_CI_LOCK_WAIT:-300}"
stamp="$venv/.requirements.sha"
lock="$venv.lock"
want=$(shasum -a 256 "$req" | cut -d' ' -f1)
ready() { [ -x "$venv/bin/python3" ] && [ "$(cat "$stamp" 2>/dev/null || true)" = "$want" ]; }
owner_gone() {   # ロックの持ち主が居ない（pid が書かれる前の一瞬は「居る」とみなす）
  local p; p=$(cat "$lock/pid" 2>/dev/null || true)
  [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null
}
take_lock() {
  local end=$(( $(date +%s) + wait_s ))
  mkdir -p "$(dirname "$lock")"
  while :; do
    if mkdir "$lock" 2>/dev/null; then echo $$ > "$lock/pid"; return 0; fi
    if owner_gone; then rm -rf "$lock"; continue; fi
    [ "$(date +%s)" -lt "$end" ] || return 1
    sleep 0.5
  done
}
if ! ready; then
  take_lock || { echo "★ venv のロックが ${wait_s} 秒で取れない（${lock}・持ち主 $(cat "$lock/pid" 2>/dev/null || echo ?)）"; exit 1; }
  trap 'rm -rf "$lock"' EXIT
  if ! ready; then
    [ -x "$venv/bin/python3" ] || python3 -m venv "$venv"
    "$venv/bin/python3" -m pip install -q --disable-pip-version-check -r "$req"
    echo "$want" > "$stamp"
  fi
fi
"$venv/bin/python3" --version
[ -n "${GITHUB_PATH:-}" ] && echo "$venv/bin" >> "$GITHUB_PATH"
true

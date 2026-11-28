#!/usr/bin/env bash
# pid のファイルが指すプロセスと、その子孫を全部止める（K-172）。
# web の組の API と画面は pnpm → node → next-server と孫以下まで伸びる。子だけ止めると孫が番号を持ったまま残る。
# 使い方：kill_tree.sh <pid のファイル>…   ファイルが無い・中身が空なら何もしない。
set -uo pipefail
tree() {   # 子孫を深い順に出す（先に子を集めてから自分）
  local p=$1 c
  for c in $(pgrep -P "$p" 2>/dev/null); do tree "$c"; done
  echo "$p"
}
for f in "$@"; do
  [ -s "$f" ] || continue
  root=$(tr -dc '0-9' < "$f")
  [ -n "$root" ] || continue
  pids=$(tree "$root")
  kill $pids 2>/dev/null
  for _ in $(seq 1 20); do
    alive=""; for p in $pids; do kill -0 "$p" 2>/dev/null && alive="$alive $p"; done
    [ -z "$alive" ] && break; sleep 0.25
  done
  [ -n "$alive" ] && kill -9 $alive 2>/dev/null
done
exit 0

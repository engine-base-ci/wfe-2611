#!/usr/bin/env bash
# CI の Python の部品（K-172）。自分の Mac の台に venv を 1 つ置き、回をまたいで使い回す（組の中で pip install しない）。
# 部品の一覧（scripts/ci/requirements-ci.txt）が変わったときだけ入れ直す。venv の bin を後の段の PATH に足す（GITHUB_PATH）。
set -euo pipefail
venv="${KANAME_CI_VENV:-$HOME/.cache/kaname-ci-venv}"
req="$(cd "$(dirname "$0")" && pwd)/requirements-ci.txt"
stamp="$venv/.requirements.sha"
want=$(shasum -a 256 "$req" | cut -d' ' -f1)
if [ ! -x "$venv/bin/python3" ]; then python3 -m venv "$venv"; fi
if [ "$(cat "$stamp" 2>/dev/null || true)" != "$want" ]; then
  "$venv/bin/python3" -m pip install -q --disable-pip-version-check -r "$req"
  echo "$want" > "$stamp"
fi
"$venv/bin/python3" --version
[ -n "${GITHUB_PATH:-}" ] && echo "$venv/bin" >> "$GITHUB_PATH"
true

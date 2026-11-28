#!/usr/bin/env python3
"""台に残った CI の DB の容れ物を消す（K-172）。

台が落ちる・回を取り消すと「DB を消す」段（if: always()）が走らないことがある。名前に回の番号が入るのでぶつからないが、溜まる。
DB を立てる段の頭で呼び、kaname-ci- で始まり HOURS 時間を過ぎた容れ物だけを消す（今の回の物・新しい物・他の名前は消さない）。

  python3 scripts/ci/ci_db_sweep.py --keep "$PG_NAME" [--hours 6]
"""
from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
import time

PREFIX = "kaname-ci-"


def stale(items: list[tuple[str, float]], now: float, hours: float, keep: str = "") -> list[str]:
    """(名前, 作った時刻の epoch) の一覧から、消してよい名前を返す。"""
    limit = now - hours * 3600
    return [n for n, created in items if n.startswith(PREFIX) and n != keep and created < limit]


def _created(iso: str) -> float:
    # docker の Created は RFC3339 でナノ秒まで（例 2026-11-12T04:12:04.716446Z）。秒まで読む
    head = iso.split(".")[0].rstrip("Z")
    return dt.datetime.fromisoformat(head).replace(tzinfo=dt.timezone.utc).timestamp()


def _docker(*args: str) -> str:
    """docker の出力。docker が無い・落ちている台では空（消さない。DB を立てる段がそこで赤になる）。"""
    try:
        r = subprocess.run(["docker", *args], capture_output=True, text=True)
    except OSError:
        return ""
    return r.stdout if r.returncode == 0 else ""


def listed() -> list[tuple[str, float]]:
    ids = _docker("ps", "-aq", "--filter", f"name=^{PREFIX}").split()
    if not ids:
        return []
    out = _docker("inspect", "-f", "{{.Name}} {{.Created}}", *ids)
    items = []
    for line in out.splitlines():
        name, _, created = line.strip().lstrip("/").partition(" ")
        if name and created:
            items.append((name, _created(created)))
    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", default="")
    ap.add_argument("--hours", type=float, default=6)
    a = ap.parse_args()
    gone = stale(listed(), now=time.time(), hours=a.hours, keep=a.keep)
    for n in gone:
        _docker("rm", "-f", n)
        print(f"残っていた DB の容れ物を消した：{n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

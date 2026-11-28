#!/usr/bin/env python3
"""契約 fuzz（G36）で、入口の回数の上限（429・code RATE_LIMITED）に当たった回を数える（K-424）。

的（apps/api/test/fuzz/server.ts）は上限を大きくして立てるので、入口の 429 は 0 回のはず。
1 回でもあれば、新しい上限の道ができて fuzz が奥に届いていない。黙って緑にせず、道ごとに名指しして赤にする。
記録は的が FUZZ_LIMITED の置き場に 1 行（「方法 道」）ずつ足した物（apps/api/test/fuzz/limits.ts の recordEntryLimited）。

使い方: python3 scripts/ci/fuzz_limited.py <記録>
  0 回（記録が無い・空）なら exit 0。1 回以上なら合計と道ごとの回数（多い順・同じ数は道の字の順）を出して exit 1。
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path


def count(log: Path) -> Counter[str]:
    if not log.is_file():
        return Counter()
    lines = (line.strip() for line in log.read_text(encoding="utf-8").splitlines())
    return Counter(line for line in lines if line)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("使い方: python3 scripts/ci/fuzz_limited.py <記録>", file=sys.stderr)
        return 2
    hits = count(Path(argv[0]))
    total = sum(hits.values())
    if total == 0:
        print("[G36] 入口の上限（429 RATE_LIMITED）は 0 回")
        return 0
    print(f"[G36] 入口の上限（429 RATE_LIMITED）に {total} 回当たった（的の上限を大きくしたのに入口で断られ、奥に届いていない）")
    for path, n in sorted(hits.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {path} ×{n}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

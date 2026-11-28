#!/usr/bin/env python3
"""migration の一覧を作る作り手（K-327）。

  packages/db/migrations/*.sql を名前の順に並べ、packages/db/src/migrations.generated.ts の MIGRATIONS に書く。
  名前は 4 けた（NNNN_名前.sql）か時刻（YYYYMMDDHHMMSS_名前.sql・UTC）。どちらの形でもないファイルがあれば止める。
  並び（続き番号・4 けたの上限・時刻の順）は packages/db/src/index.ts の checkMigrationOrder が見る。

使い方: python3 scripts/ci/gen_migrations.py [--check] [--root DIR]
  --check は書かずに、今の生成物と違えば 1。止まったときは何も書かない（1 で終わり、最後の行に止めたファイル名）
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MIG_DIR = "packages/db/migrations"
OUT = "packages/db/src/migrations.generated.ts"
HEAD = "// 生成物・手で直さない（scripts/ci/gen_migrations.py が packages/db/migrations/ から作る）"

_NAME = re.compile(r"^(\d{4}|\d{14})_[a-z0-9_]+\.sql$")


def migration_names(root: Path) -> tuple[list[str], list[str]]:
    d = root / MIG_DIR
    names = sorted(f.name for f in d.glob("*.sql")) if d.is_dir() else []
    bad = [n for n in names if not _NAME.match(n)]
    return names, bad


def build(names: list[str]) -> str:
    lines = [HEAD, "export const MIGRATIONS = ["]
    lines += [f'  "{n}",' for n in names]
    lines.append("] as const;")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="migration の一覧（MIGRATIONS）を作る")
    ap.add_argument("--check", action="store_true", help="書かずに、今の生成物と違えば 1")
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent.parent))
    a = ap.parse_args(argv)
    root = Path(a.root)
    names, bad = migration_names(root)
    if bad:
        for n in bad:
            print(f"名前の形が違う migration（NNNN_名前.sql か YYYYMMDDHHMMSS_名前.sql）: {MIG_DIR}/{n}", file=sys.stderr)
        print(f"止めた: {', '.join(bad)}", file=sys.stderr)
        return 1
    text = build(names)
    out = root / OUT
    if a.check:
        now = out.read_text(encoding="utf-8") if out.exists() else ""
        if now != text:
            print(f"{OUT} が古い（python3 scripts/ci/gen_migrations.py で作り直す）", file=sys.stderr)
            return 1
        print(f"{OUT}: 最新（{len(names)} 件）")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(f"{OUT}: {len(names)} 件")
    return 0


if __name__ == "__main__":
    sys.exit(main())

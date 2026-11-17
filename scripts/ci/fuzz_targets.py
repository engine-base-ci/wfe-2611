#!/usr/bin/env python3
"""契約の fuzz（G36・K-35）の的に、本物のサーバーが差している hooks が全部入っているかを見る検査（K-62・K-134 を戻した分・D-095）。

  apps/api/src/server.ts の contract の hooks に広げた工場（`...<名前>Hooks(`）と、
  apps/api/test/fuzz/server.ts が差した工場（`<名前>Hooks(`）を比べる。
  本物にあって的に無い工場は、口の名前（apps/api/src/hooks/*.ts の `名前: { ...h["名前"] }`）つきで赤。
  外してよいのは EXEMPT（工場 → 理由）だけ。理由が空・本物に無い工場が残っている（古い）なら赤。

使い方: python3 scripts/ci/fuzz_targets.py [--root DIR] [--no-exempt]
  問題があれば名指しして exit 1・緑なら PASS と数。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SERVER = "apps/api/src/server.ts"
TARGET = "apps/api/test/fuzz/server.ts"
HOOKS_DIR = "apps/api/src/hooks"

# 外してよい工場 → 理由（偽のセッションの的では回せないもの）
EXEMPT: dict[str, str] = {
    "authHooks": "Better Auth の本物の部品が要り、偽のセッション（Bearer boss）の的では回せない。口の振る舞いは K-51〜K-53 と packages/auth の試験が持つ",
    "signupHooks": "Better Auth と送るメールの差し込みが要り、偽のセッションの的では回せない。口の振る舞いは K-51 と packages/auth の試験が持つ",
    "verifyEmailHooks": "Better Auth と送るメールの差し込みが要り、偽のセッションの的では回せない。口の振る舞いは K-52 と packages/auth の試験が持つ",
    "consentTermsHooks": "同意し直しは Better Auth のセッションの印に頼り、偽のセッションの的では回せない。口の振る舞いは K-53 の試験が持つ",
}

_SPREAD = re.compile(r"\.\.\.\s*(\w+Hooks)\s*\(")
_CALL = re.compile(r"(?<![\w.])(\w+Hooks)\s*\(")
_DEF = re.compile(r"export\s+function\s+(\w+Hooks)\s*\(")
_OP = re.compile(r"(\w+)\s*:\s*\{\s*\.\.\.\s*h\[\s*\"(\w+)\"\s*\]")


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.is_file() else ""


def server_factories(root: Path) -> list[str]:
    """本物のサーバーが contract の hooks に広げた工場（現れた順・重複なし）"""
    src = _read(root / SERVER)
    i = src.find("contract:")
    body = src[i:] if i >= 0 else src
    return list(dict.fromkeys(_SPREAD.findall(body)))


def target_factories(root: Path) -> set[str]:
    """fuzz の的が呼んだ工場（定義の行は除く）"""
    src = _read(root / TARGET)
    src = "\n".join(l for l in src.splitlines() if not re.match(r"\s*(import|export\s+function)\b", l))
    return set(_CALL.findall(src))


def factory_ops(root: Path) -> dict[str, list[str]]:
    """工場 → 口の名前（apps/api/src/hooks/*.ts の `名前: { ...h["名前"] }`）"""
    out: dict[str, list[str]] = {}
    d = root / HOOKS_DIR
    if not d.is_dir():
        return out
    for f in sorted(d.glob("*.ts")):
        src = _read(f)
        defs = list(_DEF.finditer(src))
        for n, m in enumerate(defs):
            end = defs[n + 1].start() if n + 1 < len(defs) else len(src)
            out[m.group(1)] = [op for op, _ in _OP.findall(src[m.end():end])]
    return out


def check(root: Path, exempt: dict[str, str] | None = None) -> list[str]:
    ex = EXEMPT if exempt is None else exempt
    built = server_factories(root)
    target = target_factories(root)
    ops = factory_ops(root)
    problems: list[str] = []
    for name, why in ex.items():
        if not (why or "").strip():
            problems.append(f"外す台帳の {name} に理由が無い（理由を書くか、的に差す）")
        if name not in built:
            problems.append(f"外す台帳の {name} は本物のサーバー（{SERVER}）に無い（古い・台帳から消す）")
    for name in built:
        if name in target or name in ex:
            continue
        names = ops.get(name) or []
        listed = "・".join(names) if names else "（口の名前を読めなかった）"
        problems.append(f"{name} が fuzz の的（{TARGET}）に差していない：口 {listed} が契約の fuzz で回らない")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent.parent))
    ap.add_argument("--no-exempt", action="store_true", help="外す台帳を使わない")
    a = ap.parse_args(argv)
    root = Path(a.root)
    problems = check(root, exempt={} if a.no_exempt else None)
    if problems:
        for p in problems:
            print(f"[fuzz-targets] NG {p}")
        print(f"[fuzz-targets] FAIL — {len(problems)} 件")
        return 1
    built = server_factories(root)
    ex = {} if a.no_exempt else EXEMPT
    print(f"[fuzz-targets] PASS — 本物のサーバーの工場 {len(built)} 個（的に差した {len([b for b in built if b not in ex])}・理由つきで外す {len([b for b in built if b in ex])}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""契約の fuzz（G36・K-35）の的に、本物のサーバーが差している hooks が全部入っているかを見る検査（K-62・K-134 を戻した分・D-095）。

K-326 から、本物のサーバーと的は同じ一覧（apps/api/src/hooks/all.generated.ts）を buildHooks で束ねて差す。
そこで比べる物を「server.ts と的の文字」から「hooks の各ファイルの register の fuzz」に替えた：
  ・hooks の工場（`export function <名前>Hooks(`）を持つファイルは register を持つ（無ければ本物にも的にも差さらない）
  ・fuzz が { skip: "<理由>" } の工場だけ的から外してよい。理由が空なら赤（--no-exempt なら skip も赤）
  ・register が作り手の一覧（all.generated.ts）に入っていなければ赤（作り手を流す）
  ・2 つの工場が同じ口を持つなら、ちょうど片方の replaces にその口が要る
赤には工場の名前と口の名前（apps/api/src/hooks/*.ts の `名前: { ...h["名前"] }`）を出す。

使い方: python3 scripts/ci/fuzz_targets.py [--root DIR] [--no-exempt]
  問題があれば名指しして exit 1・緑なら PASS と数。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HOOKS_DIR = "apps/api/src/hooks"
ALL = "apps/api/src/hooks/all.generated.ts"

_DEF = re.compile(r"export\s+function\s+(\w+Hooks)\s*\(")
_OP = re.compile(r"(\w+)\s*:\s*\{\s*\.\.\.\s*h\[\s*\"(\w+)\"\s*\]")
_REGISTER = re.compile(r"export\s+const\s+register\s*=\s*defineHooks\s*\(\s*\{", re.S)
_SKIP = re.compile(r"\bfuzz\s*:\s*\{\s*skip\s*:\s*\"((?:[^\"\\]|\\.)*)\"", re.S)
_REPLACES = re.compile(r"\breplaces\s*:\s*\[(.*?)\]", re.S)
_STR = re.compile(r"\"(\w+)\"")
_IMPORT = re.compile(r"import\s*\{\s*register\s+as\s+\w+\s*\}\s*from\s*\"\./([\w.-]+)\.js\"")


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.is_file() else ""


def _files(root: Path) -> list[Path]:
    d = root / HOOKS_DIR
    return sorted(f for f in d.glob("*.ts") if f.name != "registry.ts" and not f.name.endswith(".generated.ts"))


def modules(root: Path) -> list[dict]:
    """hooks の工場を持つファイルごとに file・factory・ops・registered・skip（理由の文字か None）・replaces"""
    out: list[dict] = []
    if not (root / HOOKS_DIR).is_dir():
        return out
    for f in _files(root):
        src = _read(f)
        defs = list(_DEF.finditer(src))
        if not defs:
            continue
        reg = _REGISTER.search(src)
        reg_body = src[reg.end():] if reg else ""
        skip = _SKIP.search(reg_body)
        rep = _REPLACES.search(reg_body)
        for n, m in enumerate(defs):
            end = defs[n + 1].start() if n + 1 < len(defs) else (reg.start() if reg and reg.start() > m.end() else len(src))
            out.append({
                "file": f.name,
                "factory": m.group(1),
                "ops": [op for op, _ in _OP.findall(src[m.end():end])],
                "registered": bool(reg),
                "skip": skip.group(1) if skip else None,
                "replaces": _STR.findall(rep.group(1)) if rep else [],
            })
    return out


def _listed(ops: list[str]) -> str:
    return "・".join(ops) if ops else "（口の名前を読めなかった）"


def check(root: Path, exempt: dict[str, str] | None = None) -> list[str]:
    """問題の一覧（空なら緑）。exempt={} を渡すと skip も外してよい物と数えない"""
    if not (root / HOOKS_DIR).is_dir():
        return [f"{HOOKS_DIR} が無い（hooks のフォルダを読めない・黙って緑にしない）"]
    strict = exempt is not None and not exempt
    mods = modules(root)
    listed = set(_IMPORT.findall(_read(root / ALL)))
    problems: list[str] = []
    for m in mods:
        name = m["factory"]
        if not m["registered"]:
            problems.append(f"{name}（{m['file']}）に register が無い：口 {_listed(m['ops'])} が本物のサーバーにも fuzz の的にも差さらない")
            continue
        if m["skip"] is not None:
            if not m["skip"].strip():
                problems.append(f"{name}（{m['file']}）が fuzz の的から外す理由（skip）が空：口 {_listed(m['ops'])}")
            elif strict:
                problems.append(f"{name} が fuzz の的から外れている：口 {_listed(m['ops'])} が契約の fuzz で回らない")
    for f in sorted({m["file"] for m in mods if m["registered"]}):
        if Path(f).stem not in listed:
            problems.append(f"{f} が all.generated.ts に無い（作り手 python3 scripts/ci/gen_ts_registries.py を流す）")
    owners: dict[str, list[dict]] = {}
    for m in mods:
        for op in m["ops"]:
            owners.setdefault(op, []).append(m)
    for op, ms in sorted(owners.items()):
        if len(ms) < 2:
            continue
        by = [m for m in ms if op in m["replaces"]]
        if len(by) != 1 or len(ms) != 2:
            names = "・".join(m["factory"] for m in ms)
            problems.append(f"口 {op} を {names} が持つ：差し替える側の register にちょうど 1 つ replaces: [\"{op}\"] を書く")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent.parent))
    ap.add_argument("--no-exempt", action="store_true", help="skip で外した工場も赤にする")
    a = ap.parse_args(argv)
    root = Path(a.root)
    problems = check(root, exempt={} if a.no_exempt else None)
    if problems:
        for p in problems:
            print(f"[fuzz-targets] NG {p}")
        print(f"[fuzz-targets] FAIL — {len(problems)} 件")
        return 1
    mods = modules(root)
    skipped = len([m for m in mods if m["skip"] is not None])
    print(f"[fuzz-targets] PASS — 工場 {len(mods)} 個（的に差す {len(mods) - skipped}・理由つきで外す {skipped}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

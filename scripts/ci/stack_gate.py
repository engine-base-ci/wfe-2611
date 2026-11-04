#!/usr/bin/env python3
"""使っている部品が技術の選定の記録と合っているか（D-128.123・KN-111）。

  python3 scripts/ci/stack_gate.py             記録（02_tech_stack/selected-stack.json の packages）と package.json を 1 対 1 で突き合わせる
  python3 scripts/ci/stack_gate.py --selftest  記録に無い部品を足すと赤になるか

赤になるもの:
  S1 package.json にあるのに記録に無い部品（足すなら、何に使うか・記録のどの選定かを書く）
  S2 記録にあるのにどこでも使っていない部品（外したら記録からも外す）
  S3 記録の「どの選定か」が記録の中に無い（register の道すじが違う・「(本文)」なのに本文に名前が無い）
@types/* は、元の部品が記録にあれば要らない。workspace の部品（@kaname/*）は見ない。
"""
from __future__ import annotations
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(ROOT, "02_tech_stack/selected-stack.json")
BUILTIN_TYPES = {"node"}


def deps(extra: dict[str, list[str]] | None = None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for f in ["package.json"] + sorted(glob.glob("apps/*/package.json", root_dir=ROOT)) + sorted(glob.glob("packages/*/package.json", root_dir=ROOT)):
        j = json.load(open(os.path.join(ROOT, f), encoding="utf-8"))
        for sec in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            for n, v in (j.get(sec) or {}).items():
                if str(v).startswith("workspace:"):
                    continue
                out.setdefault(n, []).append(os.path.dirname(f) or ".")
    for n, w in (extra or {}).items():
        out.setdefault(n, []).extend(w)
    return out


def resolve(reg: dict, path: str) -> bool:
    cur = reg
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return False
        cur = cur[k]
    return True


def check(extra: dict[str, list[str]] | None = None) -> list[str]:
    reg = json.load(open(REG, encoding="utf-8"))
    pk = {k: v for k, v in (reg.get("packages") or {}).items() if not k.startswith("_") and k != "@types/*"}
    body = json.dumps({k: v for k, v in reg.items() if k != "packages"}, ensure_ascii=False).lower()
    used = deps(extra)
    fails = []
    for n, where in sorted(used.items()):
        if n.startswith("@types/"):
            base = n[len("@types/"):]
            base = "@" + base.replace("__", "/") if "__" in base else base
            if base in pk or base in BUILTIN_TYPES or base.split("-")[0] in pk:
                continue
            fails.append(f"S1 型の部品 {n} の元（{base}）が記録に無い（{', '.join(where)}）")
        elif n not in pk:
            fails.append(f"S1 記録に無い部品 {n}（{', '.join(where)}）。selected-stack.json の packages に、何に使うか・どの選定かを書く")
    for n in sorted(pk):
        if n not in used:
            fails.append(f"S2 記録にあるのに使っていない部品 {n}（外したなら packages からも外す）")
    for n, v in sorted(pk.items()):
        r = (v or {}).get("register", "")
        if r == "dev_tools":
            continue
        if r == "(本文)":
            if n.lower() not in body:
                fails.append(f"S3 {n}：「(本文)」なのに記録の本文に名前が無い")
        elif not resolve(reg, r):
            fails.append(f"S3 {n}：記録に {r} が無い")
    return fails


def main() -> int:
    if "--selftest" in sys.argv:
        hit = any("わざと足した部品" in f or "kaname-selftest-pkg" in f for f in check({"kaname-selftest-pkg": ["(試験)"]}))
        print("PASS — 記録に無い部品を見つけた" if hit else "FAIL — 記録に無い部品を見つけられない")
        return 0 if hit else 1
    fails = check()
    for f in fails:
        print("  ★", f)
    n = len(deps())
    print(f"部品 {n} 個（型の部品を含む）")
    print("FAIL — 部品と技術の選定の記録が合わない" if fails else "PASS — 使っている部品は全部、技術の選定の記録にある")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

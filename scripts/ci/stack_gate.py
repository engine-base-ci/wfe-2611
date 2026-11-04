#!/usr/bin/env python3
"""使っている部品が技術の選定の記録と合っているか（D-128.123・KN-111）。

  python3 scripts/ci/stack_gate.py             記録（02_tech_stack/selected-stack.json の packages）と package.json を 1 対 1 で突き合わせる
  python3 scripts/ci/stack_gate.py --selftest  記録に無い部品を足すと赤になるか

赤になるもの:
  S1 package.json にあるのに記録に無い部品（足すなら、何に使うか・記録のどの選定かを書く）
  S2 記録にあるのにどこでも使っていない部品（外したら記録からも外す）
  S3 記録の「どの選定か」が記録の中に無い（register の道すじが違う・「(本文)」なのに本文に名前が無い）
  S4 lockfile で上流が「非推奨」にした部品が、記録（scripts/ci/deprecated_baseline.json）に無い。記録の物が lockfile から消えたら記録から外す（KN-116）
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


def deprecated(lock_text: str) -> dict[str, str]:
    """lockfile の packages の節で deprecated の印がある部品（名前@版 → 理由）"""
    import re
    i, j = lock_text.find("\npackages:\n"), lock_text.find("\nsnapshots:\n")
    sec = lock_text[i:j] if i >= 0 and j > i else ""
    out = {}
    for m in re.finditer(r"\n  '?([^\s']+)'?:\n((?:    .*\n)+)", sec):
        d = re.search(r"    deprecated: (.*)", m.group(2))
        if d:
            out[m.group(1)] = d.group(1)
    return out


def check_deprecated(lock_text: str | None = None) -> list[str]:
    lock_text = lock_text if lock_text is not None else open(os.path.join(ROOT, "pnpm-lock.yaml"), encoding="utf-8").read()
    base = json.load(open(os.path.join(ROOT, "scripts/ci/deprecated_baseline.json"), encoding="utf-8"))["entries"]
    now = deprecated(lock_text)
    fails = [f"S4 上流が非推奨にした部品 {k}（{v[:80]}）。直すか、deprecated_baseline.json にチケットつきで書く" for k, v in sorted(now.items()) if k not in base]
    fails += [f"S4 記録の {k} はもう lockfile に無い（deprecated_baseline.json から外す）" for k in sorted(base) if k not in now]
    return fails


def main() -> int:
    if "--selftest" in sys.argv:
        hit = any("kaname-selftest-pkg" in f for f in check({"kaname-selftest-pkg": ["(試験)"]}))
        fake = "\npackages:\n\n  kaname-old@1.0.0:\n    resolution: {integrity: x}\n    deprecated: 試験\n\nsnapshots:\n"
        hit4 = any("kaname-old@1.0.0" in f for f in check_deprecated(fake))
        print("PASS — 記録に無い部品と、記録に無い非推奨の部品を見つけた" if hit and hit4 else "FAIL — 見つけられない")
        return 0 if hit and hit4 else 1
    fails = check() + check_deprecated()
    for f in fails:
        print("  ★", f)
    n = len(deps())
    print(f"部品 {n} 個（型の部品を含む）")
    print("FAIL — 部品と技術の選定の記録が合わない" if fails else "PASS — 使っている部品は全部、技術の選定の記録にある（非推奨は記録どおり）")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

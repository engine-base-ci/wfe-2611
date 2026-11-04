#!/usr/bin/env python3
"""書いた検査が CI から回っているか（D-128.123・KN-111）。

  python3 scripts/ci/ci_wiring_gate.py            package.json の ci:* と、自己試験（scripts/ci/*.test.mjs・--selftest を持つ検査）が、
                                                  CI（.github/workflows/*.yml）か層の棚卸し（spec-dependencies.yaml・G27 が回す）から回るか
  python3 scripts/ci/ci_wiring_gate.py --selftest どこからも回らない検査を足すと赤になるか

赤になるもの:
  W1 どこからも回らない検査（CI に足すか、scripts/ci/ci_scripts.json に理由を書く）
  W2 壊れていると記録した検査（known_broken）が、もう緑（記録を外して CI に入れる）
  W3 目録に書いたのに、もう無い検査（目録から外す）
由来：検査を書いたのに CI で回しておらず、壊れたまま気づかなかった（contract・env_audit の自己試験）。
"""
from __future__ import annotations
import glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))


def wired_text() -> str:
    t = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, ".github/workflows/*.yml")))
    return t + open(os.path.join(ROOT, "spec-dependencies.yaml"), encoding="utf-8").read()


def items(extra: dict[str, str] | None = None) -> dict[str, str]:
    """検査の名前 → 回し方"""
    s = J("package.json")["scripts"]
    out = {k: v for k, v in s.items() if k.startswith("ci:")}
    for f in sorted(glob.glob(os.path.join(ROOT, "scripts/ci/*.test.mjs")) + glob.glob(os.path.join(ROOT, "scripts/ci/*test*.py"))):
        rel = os.path.relpath(f, ROOT)
        if not any(rel in v for v in out.values()):
            out[rel] = f"node {rel}" if rel.endswith(".mjs") else f"python3 {rel}"
    for f in sorted(glob.glob(os.path.join(ROOT, "scripts/ci/*.py")) + glob.glob(os.path.join(ROOT, "scripts/ci/*.mjs"))):
        rel = os.path.relpath(f, ROOT)
        if rel.endswith((".test.mjs",)) or rel == "scripts/ci/ci_wiring_gate.py":
            continue
        if "--selftest" in open(f, encoding="utf-8").read():
            out[f"{rel} --selftest"] = f"{'python3' if rel.endswith('.py') else 'node'} {rel} --selftest"
    out.update(extra or {})
    return out


def is_wired(name: str, cmd: str, text: str, all_items: dict[str, str]) -> bool:
    if name.startswith("ci:") and re.search(rf"(pnpm (-s )?|run ){re.escape(name)}\b", text):
        return True
    core = cmd.split("&&")[0].strip()
    if core and core in text:
        return True
    # ほかの、回っている ci: から呼ばれている
    for k, v in all_items.items():
        if k != name and k.startswith("ci:") and re.search(rf"\b{re.escape(name)}\b", v) and re.search(rf"\b{re.escape(k)}\b", text):
            return True
    return False


def check(extra: dict[str, str] | None = None) -> list[str]:
    cfg = J("scripts/ci/ci_scripts.json")
    listed = {**cfg.get("generator", {}), **cfg.get("manual", {})}
    broken = cfg.get("known_broken", {})
    text = wired_text()
    it = items(extra)
    fails = []
    for name, cmd in sorted(it.items()):
        if name in listed:
            continue
        if name in broken:
            r = subprocess.run(cmd, cwd=ROOT, shell=True, capture_output=True, text=True)
            if r.returncode == 0:
                fails.append(f"W2 壊れていると記録した {name} が、もう緑（ci_scripts.json の known_broken から外して CI に入れる）")
            continue
        if not is_wired(name, cmd, text, it):
            fails.append(f"W1 どこからも回らない検査 {name}（{cmd[:80]}）")
    for name in [*listed, *broken]:
        if name not in it and not os.path.exists(os.path.join(ROOT, name)):
            fails.append(f"W3 目録に書いたのに、もう無い {name}")
    return fails


def main() -> int:
    if "--selftest" in sys.argv:
        hit = any("kaname-selftest-unwired" in f for f in check({"ci:kaname-selftest-unwired": "node scripts/ci/nothing.mjs"}))
        print("PASS — どこからも回らない検査を見つけた" if hit else "FAIL — どこからも回らない検査を見つけられない")
        return 0 if hit else 1
    fails = check()
    for f in fails:
        print("  ★", f)
    print(f"検査と道具 {len(items())} 個")
    print("FAIL — 回っていない検査がある" if fails else "PASS — 書いた検査は全部、CI か層の棚卸しから回る（理由つきの例外を除く）")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

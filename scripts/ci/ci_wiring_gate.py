#!/usr/bin/env python3
"""書いた検査が CI から回っているか（D-128.123・K-38）。

  python3 scripts/ci/ci_wiring_gate.py            package.json の ci:* と、自己試験（scripts/ci/*.test.mjs・--selftest を持つ検査）が、
                                                  CI（.github/workflows/*.yml）か層の棚卸し（spec-dependencies.yaml・G27 が回す）から回るか
  python3 scripts/ci/ci_wiring_gate.py --selftest どこからも回らない検査を足すと赤になるか

赤になるもの:
  W1 どこからも回らない検査（CI に足すか、scripts/ci/ci_scripts.json に理由を書く）
  W2 壊れていると記録した検査（known_broken）が、もう緑（記録を外して CI に入れる）
  W3 目録に書いたのに、もう無い検査（目録から外す）
  W4 台本が git ls-files を -z 無しで読む（日本語の名前が "\343..." と化けて開けず、黙って飛ばす。G38・G43 で 68 本を見ていなかった・2026-11-04）
  W5 層の棚卸し（spec-dependencies.yaml の layer_checks）で「別の段で流す」（elsewhere: G<N>）と印を付けた層の命令を、
     その段が本当に流していない（段が無い・run に台本のパスも pnpm の名前も無い・範囲で決まる組の段なのに層のファイルが範囲の決まりに無い）。
     印の付いた層の check は「層の棚卸しから回る」に数えない（K-156）
由来：検査を書いたのに CI で回しておらず、壊れたまま気づかなかった（contract・env_audit の自己試験）。
"""
from __future__ import annotations
import glob, json, os, re, subprocess, sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
GATE = re.compile(r"\bG\d+\b")
SCRIPT_TOKEN = re.compile(r"\S+\.(?:py|mjs|js|sh|ts)\b")
PNPM_NAME = re.compile(r"\bpnpm\s+(?:-s\s+)?(?:run\s+)?([A-Za-z][\w:.-]*)")


def spec_deps() -> dict:
    return yaml.safe_load(open(os.path.join(ROOT, "spec-dependencies.yaml"), encoding="utf-8")) or {}


def wired_text(layers: list[dict] | None = None) -> str:
    """CI（.github/workflows）の文字＋層の棚卸しの文字。elsewhere の印の付いた層の check は入れない（その命令は別の段が流す・W5 が見る）"""
    t = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, ".github/workflows/*.yml")))
    cfg = spec_deps()
    layers = cfg.get("layer_checks", []) if layers is None else layers
    rest = {k: v for k, v in cfg.items() if k != "layer_checks"}
    own = "\n".join(c["check"] for c in layers if c.get("check") and not c.get("elsewhere"))
    return t + yaml.safe_dump(rest, allow_unicode=True) + "\n" + own + "\n"


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
    # node の試験は `node --test [旗…]` で流してもよい（K-216：JUnit の記録を出すため）。--check などの流さない旗は数えない
    if name.endswith(".test.mjs") and re.search(rf"node --test(?: --\S+)* {re.escape(name)}\b", text):
        return True
    # ほかの、回っている ci: から呼ばれている
    for k, v in all_items.items():
        if k != name and k.startswith("ci:") and re.search(rf"\b{re.escape(name)}\b", v) and re.search(rf"\b{re.escape(k)}\b", text):
            return True
    return False


LS_FILES = re.compile(r'''(["']git["'],\s*["']ls-files["'](?![^\]\)]*["']-z["']))|(git ls-files(?![^"'`\n]*-z))''')


def ls_files_without_z(texts: dict[str, str]) -> list[str]:
    return [f"W4 {name} が git ls-files を -z 無しで読む（日本語の名前が化けて黙って飛ばす。-z で読み、\\0 で分ける）"
            for name, t in sorted(texts.items()) if LS_FILES.search(t)]


def script_texts() -> dict[str, str]:
    out = {}
    for g in ("scripts/**/*.py", "scripts/**/*.mjs", "scripts/**/*.sh", "apps/*/scripts/**/*.mjs", "05_flow/*.py"):
        for f in glob.glob(os.path.join(ROOT, g), recursive=True):
            rel = os.path.relpath(f, ROOT)
            if rel != "scripts/ci/ci_wiring_gate.py" and "/__pycache__/" not in rel:
                # 説明の行（# や // で始まる行）は見ない
                out[rel] = "\n".join(ln for ln in open(f, encoding="utf-8", errors="ignore").read().splitlines()
                                     if not ln.lstrip().startswith(("#", "//")))
    return out


def _glob_sample(pat: str) -> str:
    return re.sub(r"\*+", "x", pat).split("#", 1)[0]


def _expand(run: str, pkg_scripts: dict[str, str]) -> str:
    """段の run に、pnpm の名前の中身（package.json の scripts）を足した文字"""
    return run + "\n" + "\n".join(pkg_scripts.get(n, "") for n in PNPM_NAME.findall(run))


def _part_ok(part: str, run: str, pkg_scripts: dict[str, str]) -> bool:
    names = PNPM_NAME.findall(part)
    if names:
        return all(re.search(rf"\bpnpm\s+(?:-s\s+)?(?:run\s+)?{re.escape(n)}(?![\w:.-])", run)
                   or (pkg_scripts.get(n) and pkg_scripts[n] in _expand(run, pkg_scripts)) for n in names)
    m = SCRIPT_TOKEN.search(part)
    if m:
        return m.group(0) in _expand(run, pkg_scripts)
    return part in _expand(run, pkg_scripts)


def check_elsewhere(layers: list[dict], jobs: dict, pkg_scripts: dict[str, str], scope_rules: dict) -> list[str]:
    """W5：elsewhere の印の段が、層の check の命令を本当に流しているか（K-156）"""
    from ci_scope import match  # noqa: PLC0415  目録の物（範囲の glob の読み方を 2 つ作らない）
    steps = [(jname, j or {}, st) for jname, j in (jobs or {}).items() for st in ((j or {}).get("steps") or [])]
    fails = []
    for c in layers:
        if not c.get("elsewhere"):
            continue
        f, chk = c.get("file", ""), str(c.get("check") or "")
        for g in GATE.findall(str(c["elsewhere"])) or [str(c["elsewhere"])]:
            hit = [(jn, j, st) for jn, j, st in steps if str(st.get("name", "")).startswith(g + " ")]
            if not hit:
                fails.append(f"W5 {f}：elsewhere {g} の段が workflow に無い（印を外して層の棚卸しで流すか、段の番号を直す）")
                continue
            # 段の番号は組をまたいで重なることがある（static の G28 と spec の G28）。どれか 1 つの段が流していればよい
            why = []
            for jn, j, st in hit:
                run = str(st.get("run") or "")
                missing = [x.strip() for x in chk.split("&&") if x.strip() and not _part_ok(x.strip(), run, pkg_scripts)]
                if missing:
                    why.append(f"{jn} の段が {' と '.join(missing)} を流していない")
                    continue
                if "needs.static.outputs." in str(j.get("if", "")):
                    key = "db.paths" if jn == "database" or jn.startswith("unit") else f"jobs.{jn}.paths"
                    pats = (scope_rules.get("db", {}).get("paths", []) if key == "db.paths"
                            else scope_rules.get("jobs", {}).get(jn, {}).get("paths", []))
                    if not match(_glob_sample(f), pats):
                        why.append(f"範囲で決まる組 {jn} の段なのに、層のファイルが ci_scope.json の {key} に無い（変えても流れない）")
                        continue
                why = []
                break
            if why:
                fails.append(f"W5 {f}：elsewhere {g}：" + "／".join(why))
    return fails


def workflow_jobs() -> dict:
    jobs: dict = {}
    for wf in sorted(glob.glob(os.path.join(ROOT, ".github/workflows/*.yml"))):
        jobs.update((yaml.safe_load(open(wf, encoding="utf-8")) or {}).get("jobs") or {})
    return jobs


def check(extra: dict[str, str] | None = None, layers: list[dict] | None = None) -> list[str]:
    cfg = J("scripts/ci/ci_scripts.json")
    listed = {**cfg.get("generator", {}), **cfg.get("manual", {})}
    broken = cfg.get("known_broken", {})
    layers = spec_deps().get("layer_checks", []) if layers is None else layers
    text = wired_text(layers)
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
    w5 = check_elsewhere(layers, workflow_jobs(), J("package.json").get("scripts", {}), J("scripts/ci/ci_scope.json"))
    return fails + w5 + ls_files_without_z(script_texts())


def main() -> int:
    if "--selftest" in sys.argv:
        hit = any("kaname-selftest-unwired" in f for f in check({"ci:kaname-selftest-unwired": "node scripts/ci/nothing.mjs"}))
        w4 = ls_files_without_z({"a.py": 'subprocess.run(["git", "ls-files"])', "b.mjs": 'execSync("git ls-files")',
                                 "ok.py": 'subprocess.run(["git", "ls-files", "-z"])', "ok.mjs": 'execSync("git ls-files -z --others")'})
        hit = hit and [x.split()[1] for x in w4] == ["a.py", "b.mjs"]
        jobs = {"static": {"steps": [{"name": "G2 type check", "run": "pnpm type-check"}]}}
        w5_bad = check_elsewhere([{"file": "a", "check": "python3 scripts/ci/x.py", "elsewhere": "G2"},
                                  {"file": "b", "check": "pnpm -s type-check", "elsewhere": "G99"}], jobs, {}, {})
        w5_ok = check_elsewhere([{"file": "c", "check": "pnpm -s type-check", "elsewhere": "G2"}], jobs, {}, {})
        hit = hit and len(w5_bad) == 2 and all(x.startswith("W5") for x in w5_bad) and w5_ok == []
        mjs = "scripts/ci/m.test.mjs"
        hit = hit and is_wired(mjs, f"node {mjs}", f"run: node --test --test-reporter=junit {mjs}", {})
        hit = hit and not is_wired(mjs, f"node {mjs}", "run: node --test scripts/ci/other.test.mjs", {})
        hit = hit and not is_wired(mjs, f"node {mjs}", f"run: node --check {mjs}", {})
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

#!/usr/bin/env python3
"""試験はどれも 1 つのチケットに属する（D-128.140）。

  python3 scripts/ci/test_owner_gate.py             単体の試験のファイル・実ブラウザの試験（e2e:k）・口ごとの権限の試験が、
                                                    どれもちょうど 1 つのチケット（11_tickets/K-*.md の tests:）に属するか
  python3 scripts/ci/test_owner_gate.py --selftest  わざと壊した写しで、赤になるべきものが赤になるか
  python3 scripts/ci/test_owner_gate.py --list      チケットごとの試験の数

持ち主の決め方:
  ・試験のファイル → tests: にそのファイル（glob も可）を書いたチケット
  ・CI の段が直に流す検査の自己試験（workflow の `python3 scripts/ci/<名前>_test.py`）も tests: に書ける（K-62）。
    書いたら当たり（TO3 にしない）・2 つ以上のチケットが書けば TO2。ただし持ち主の無いものは、いまは TO1 にしない
    （前からある自己試験に持ち主が無いため。持ち主を付けたら TO1 に入れる）
  ・口ごとの権限の試験（apps/api/src/contract/authz.test.ts の「POST /api/v1/…」の行） → その口の生成した試験
    （apps/api/test/generated/<口>.test.ts）を持つチケット。チケットの apis: の口は、そのチケットが持つ
  ・まだ切っていないまとまり（split: これから）が持つ試験は、そのまとまりを切るまでチケットの実行に入らない
赤になるもの:
  TO1 どのチケットにも属さない試験のファイル（作ったチケットの tests: に書く）
  TO2 2 つ以上のチケットに属する試験のファイル
  TO3 tests: に書いたのに、どのファイルにも当たらない（消した・名前を変えた）
  TO4 apis: に書いた口の、生成した試験を別のチケットが持つ（か、生成した試験が無い）
  TO5 契約の口（08_api/endpoints.json）に生成した試験が無い・生成した試験が契約に無い口を指す（権限の試験の持ち主が決まらない）
  TO6 切ったチケットが、apis: に無い口の生成した試験を持つ（口の持ち主は apis: が正本）
"""
from __future__ import annotations
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "tickets"))
import build_index  # noqa: E402

AUTHZ = "apps/api/src/contract/authz.test.ts"
GEN = "apps/api/test/generated/"
WEB = "apps/web/"
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")

_re: dict[str, re.Pattern] = {}


def glob_re(pat: str) -> re.Pattern:
    """** は 0 個以上のフォルダ、* は / を越えない、? は 1 文字"""
    if pat not in _re:
        out, i = "", 0
        while i < len(pat):
            if pat.startswith("**/", i):
                out, i = out + r"(?:.*/)?", i + 3
            elif pat.startswith("**", i):
                out, i = out + r".*", i + 2
            elif pat[i] == "*":
                out, i = out + r"[^/]*", i + 1
            elif pat[i] == "?":
                out, i = out + r"[^/]", i + 1
            else:
                out, i = out + re.escape(pat[i]), i + 1
        _re[pat] = re.compile(out + r"\Z")
    return _re[pat]


def repo_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True).stdout
    return sorted(p for p in out.split("\0") if p and os.path.exists(os.path.join(ROOT, p)))


def unit_globs() -> list[str]:
    """vitest.config.ts の include（試験のファイルの集め方は vitest と同じにする）"""
    s = open(os.path.join(ROOT, "vitest.config.ts"), encoding="utf-8").read()
    body = re.search(r"include:\s*\[(.*?)\]", s, flags=re.S).group(1)
    return re.findall(r'"([^"]+)"', body)


def e2e_globs() -> list[str]:
    """apps/web の e2e:k（CI の G48 が流す実ブラウザの試験）が読むファイル"""
    s = json.load(open(os.path.join(ROOT, WEB, "package.json"), encoding="utf-8"))["scripts"]["e2e:k"]
    args = [a for a in s.split("playwright test", 1)[1].split() if not a.startswith("-")]
    wf = open(os.path.join(ROOT, ".github/workflows/v3-gate.yml"), encoding="utf-8").read()
    return [WEB + (a if a.endswith(".ts") else a.rstrip("/") + "/**/*.spec.ts") for a in args] + workflow_globs(wf)


def workflow_globs(wf: str) -> list[str]:
    """workflow の段が直に流す実ブラウザの試験（G59 の中間テスト `pnpm --filter @kaname/web exec playwright test tests/skeleton`・K-54）"""
    args = []
    for m in re.finditer(r"--filter @kaname/web exec playwright test ([^\n&|;]+)", wf):
        args += [a for a in m.group(1).split() if not a.startswith("-")]
    return [WEB + (a if a.endswith(".ts") else a.rstrip("/") + "/**/*.spec.ts") for a in args]


def ci_py_tests(wf: str) -> list[str]:
    """workflow の段が直に流す検査の自己試験（`python3 scripts/ci/<名前>_test.py`・K-62）"""
    return sorted(set(re.findall(r"python3 (scripts/ci/[A-Za-z0-9_]+_test\.py)", wf)))


def test_files(files: list[str] | None = None, pats: list[str] | None = None) -> list[str]:
    files = repo_files() if files is None else files
    pats = unit_globs() + e2e_globs() if pats is None else pats
    return sorted(f for f in files if "/node_modules/" not in f and any(glob_re(p).match(f) for p in pats))


def gen_op(path: str, by_route: dict[tuple[str, str], str]) -> str | None:
    """生成した試験が指す口（endpointOf("…") か、頭の行の「POST /api/v1/…」）"""
    s = open(os.path.join(ROOT, path), encoding="utf-8").read()
    m = re.search(r'endpointOf\("(\w+)"\)', s)
    if m:
        return m.group(1)
    m = re.search(r"\b(" + "|".join(METHODS) + r") (/api/v1/\S+)", s.split("\n", 1)[0])
    return by_route.get((m.group(1), m.group(2))) if m else None


def owners(tickets: list[dict], files: list[str]) -> tuple[dict[str, list[str]], list[str]]:
    """ファイル → 持ち主のチケット（重なりも残す）・どのファイルにも当たらない tests: の行"""
    out: dict[str, list[str]] = {}
    dead = []
    for t in tickets:
        for pat in t.get("tests") or []:
            hit = [f for f in files if glob_re(pat).match(f)]
            if not hit:
                dead.append(f"TO3 {t['id']} の tests: {pat} がどのファイルにも当たらない")
            for f in hit:
                if t["id"] not in out.setdefault(f, []):
                    out[f].append(t["id"])
    return out, dead


def check(tickets: list[dict], files: list[str], gen_ops: dict[str, str | None], endpoints: list[str],
          optional: list[str] | None = None) -> list[str]:
    """tickets：チケット（id・split・apis・tests）／files：試験のファイル／gen_ops：生成した試験 → 口／endpoints：契約の口／
    optional：tests: に書けるが持ち主が無くても TO1 にしない試験（CI の段が流す検査の自己試験）"""
    opt = [f for f in (optional or []) if f not in files]
    own, bad = owners(tickets, files + opt)
    for f in files + opt:
        k = own.get(f, [])
        if not k and f in opt:
            continue
        if not k:
            bad.append(f"TO1 {f} がどのチケットにも属さない（作ったチケットの tests: に書く）")
        elif len(k) > 1:
            bad.append(f"TO2 {f} が 2 つ以上のチケットに属する：{', '.join(k)}")
    op_file = {op: f for f, op in gen_ops.items() if op}
    for f, op in sorted(gen_ops.items()):
        if op not in endpoints:
            bad.append(f"TO5 {f} が契約に無い口 {op} を指す")
    for op in endpoints:
        if op not in op_file:
            bad.append(f"TO5 契約の口 {op} に生成した試験（{GEN}）が無い（権限の試験の持ち主が決まらない）")
    for t in tickets:
        mine = {gen_ops.get(f) for f, k in own.items() if t["id"] in k and f in gen_ops}
        for op in t.get("apis") or []:
            f = op_file.get(op)
            if not f or t["id"] not in own.get(f, []):
                bad.append(f"TO4 {t['id']} の apis: の {op} の生成した試験を、{t['id']} が持っていない（{', '.join(own.get(f, [])) or '持ち主なし'}）")
        if t.get("split") != "これから":
            extra = sorted(op for op in mine if op and op not in (t.get("apis") or []))
            for op in extra:
                bad.append(f"TO6 {t['id']}（切ったチケット）が apis: に無い口 {op} の生成した試験を持つ")
    return bad


def ci_py() -> list[str]:
    """いまの workflow（v3-gate.yml）の段が流す検査の自己試験のうち、在るもの"""
    wf = open(os.path.join(ROOT, ".github/workflows/v3-gate.yml"), encoding="utf-8").read()
    return [f for f in ci_py_tests(wf) if os.path.exists(os.path.join(ROOT, f))]


def load() -> tuple[list[dict], list[str], dict[str, str | None], list[str]]:
    tickets = build_index.load()
    files = test_files()
    ep = json.load(open(os.path.join(ROOT, "08_api/endpoints.json"), encoding="utf-8"))["endpoints"]
    by_route = {(e["method"], e["path"]): e["operation_id"] for e in ep}
    gen = {f: gen_op(f, by_route) for f in files if f.startswith(GEN)}
    return tickets, files, gen, [e["operation_id"] for e in ep]


def selftest() -> int:
    files = ["a/x.test.ts", "a/y.test.ts", GEN + "p.test.ts", GEN + "q.test.ts"]
    gen = {GEN + "p.test.ts": "opP", GEN + "q.test.ts": "opQ"}
    good = [{"id": "K-1", "tests": ["a/*.test.ts"]},
            {"id": "K-2", "apis": ["opP"], "tests": [GEN + "p.test.ts"]},
            {"id": "K-3", "split": "これから", "tests": [GEN + "q.test.ts"]}]
    cases = {
        "緑": (good, gen, ["opP", "opQ"], set()),
        "TO1": ([good[0], good[1]], gen, ["opP", "opQ"], {"TO1"}),
        "TO2": (good + [{"id": "K-4", "tests": ["a/x.test.ts"]}], gen, ["opP", "opQ"], {"TO2"}),
        "TO3": (good + [{"id": "K-4", "tests": ["a/gone.test.ts"]}], gen, ["opP", "opQ"], {"TO3"}),
        "TO4": ([good[0], {**good[1], "apis": ["opP", "opQ"]}, good[2]], gen, ["opP", "opQ"], {"TO4"}),
        "TO5": (good, gen, ["opP", "opQ", "opR"], {"TO5"}),
        "TO6": ([good[0], {**good[1], "tests": [GEN + "*.test.ts"]}], gen, ["opP", "opQ"], {"TO6"}),
    }
    ok = True
    for name, (ts, g, eps, want) in cases.items():
        got = {b.split()[0] for b in check(ts, files, g, eps)}
        hit = got == want
        ok &= hit
        print(f"  {'緑' if hit else '★ 赤'} {name}：出たもの {sorted(got) or 'なし'}（あるべきもの {sorted(want) or 'なし'}）")
    # workflow の段が直に流す実ブラウザの試験の読み方（K-54）：正しい workflow なら中間テストのファイルに持ち主が付き、
    #   道を壊した写し（段の道の名前違い・段が消えた）なら、そのチケットの tests: が当たらず TO3 で赤
    spec = WEB + "tests/skeleton/m1.spec.ts"
    wf_good = "run: BASE_URL=x pnpm --filter @kaname/web exec playwright test tests/skeleton\n"
    wf_cases = {"緑（workflow の道）": (wf_good, set()),
                "TO3（workflow の道の名前違い）": (wf_good.replace("tests/skeleton", "tests/skeletn"), {"TO3"}),
                "TO3（workflow の段が無い）": ("run: pnpm --filter @kaname/web e2e:k\n", {"TO3"})}
    for name, (wf, want) in wf_cases.items():
        fs = test_files(files + [spec], ["a/*.test.ts", GEN + "*.test.ts"] + workflow_globs(wf))
        got = {b.split()[0] for b in check(good + [{"id": "K-5", "tests": [spec]}], fs, gen, ["opP", "opQ"])}
        hit = got == want
        ok &= hit
        print(f"  {'緑' if hit else '★ 赤'} {name}：出たもの {sorted(got) or 'なし'}（あるべきもの {sorted(want) or 'なし'}）")
    # CI の段が直に流す検査の自己試験（K-62）：workflow から読み、tests: に書けば当たる。持ち主が無くても TO1 にしない。2 つが書けば TO2
    wf_py = "run: python3 scripts/ci/x_test.py && python3 scripts/ci/y_test.py\n"
    py = ci_py_tests(wf_py)
    py_cases = {"緑（CI の自己試験を tests: に書く）": (good + [{"id": "K-6", "tests": ["scripts/ci/x_test.py"]}], wf_py, set()),
                "緑（CI の自己試験に持ち主が無い）": (good, wf_py, set()),
                "TO3（workflow に無い自己試験を tests: に書く）": (good + [{"id": "K-6", "tests": ["scripts/ci/z_test.py"]}], wf_py, {"TO3"}),
                "TO2（2 つのチケットが同じ自己試験を書く）": (good + [{"id": "K-6", "tests": ["scripts/ci/x_test.py"]},
                                                          {"id": "K-7", "tests": ["scripts/ci/x_test.py"]}], wf_py, {"TO2"})}
    hit_list = py == ["scripts/ci/x_test.py", "scripts/ci/y_test.py"]
    ok &= hit_list
    print(f"  {'緑' if hit_list else '★ 赤'} workflow の自己試験の読み方：{py}")
    for name, (ts, wf, want) in py_cases.items():
        got = {b.split()[0] for b in check(ts, files, gen, ["opP", "opQ"], ci_py_tests(wf))}
        hit = got == want
        ok &= hit
        print(f"  {'緑' if hit else '★ 赤'} {name}：出たもの {sorted(got) or 'なし'}（あるべきもの {sorted(want) or 'なし'}）")
    print("PASS — 壊した写しはどれも赤、正しい写しは緑" if ok else "FAIL — 赤になるべきものが赤にならない")
    return 0 if ok else 1


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    tickets, files, gen, eps = load()
    opt = ci_py()
    bad = check(tickets, files, gen, eps, opt)
    own, _ = owners(tickets, files + [f for f in opt if f not in files])
    per: dict[str, int] = {}
    for f, k in own.items():
        for x in k:
            per[x] = per.get(x, 0) + 1
    if "--list" in sys.argv:
        by = {t["id"]: t for t in tickets}
        for k in sorted(per, key=lambda x: int(x.split("-")[1])):
            print(f"  {k:<5} {per[k]:>4} 本  {'（まだ切っていない：チケットの実行に入らない）' if by[k].get('split') == 'これから' else ''}{by[k]['title'][:40]}")
    for b in bad:
        print("  ★", b)
    print(f"試験のファイル {len(files)} 本（生成した口ごとの試験 {len(gen)}・契約の口 {len(eps)}）・持ち主のチケット {len(per)} 枚")
    print("FAIL — 持ち主の決まらない試験がある" if bad else "PASS — 試験はどれもちょうど 1 つのチケットに属する")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

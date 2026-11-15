#!/usr/bin/env python3
"""K-245 の試験：本線が層の棚卸し（G27）で赤になった所を直す・同じことが範囲の外で通らないよう CI の範囲の決まりを直す。

  python3 scripts/ci/k245_g27_reach_test.py      全部の行（行 ID は K245-G27-NNN。11_tickets/K-245.md の行の表と 1 対 1）

赤の原因：入口の枠（apps/web/features/F1/sign-up/frame.tsx）に待ちの部品 AuthLoading を足したとき、共通の部品の束（@/components/k）を
          読ませた。束 → states.tsx → error-of.ts → @/lib/api → fetch( で、規約の文面の画面（「API を呼ばない画面」の台帳の legal）が
          口を呼ぶコードに届き、static_screens.py の S4 が赤（fb_gate の FB3・FB8・api_gate の A3）。
直し：AuthLoading を別のファイル（apps/web/features/F1/sign-up/auth-loading.tsx）に移し、frame.tsx は束も states も読まない（001〜006）
範囲：apps/web の画面のコードを変えた回で G27 が流れなかった（scripts/ci/ci_scope.json の gates の 27 が層の棚卸しの読む物を持っていない）。
      G27 が読む物（地図 spec-dependencies.yaml・自分で流す層のファイル・決定のトレースが読む成果物・流す台本・apps と packages のコード・
      チケットの md）を当たりにする（007〜012）。この試験が CI から回ること（013）

読むのは本物のリポジトリのファイルだけ（作りもののリポジトリは作らない）。範囲は ci_scope.gates_for に本物の決まりを読ませて、
作りものの変えたファイルの並びを渡す（plan() が重い検査を決めるのと同じ関数）。
"""
from __future__ import annotations

import glob
import pathlib
import re
import subprocess
import sys
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import ci_scope  # noqa: E402
import static_screens  # noqa: E402  画面のコードの import の読み方と道の解き方は台帳の検査の物をそのまま使う（2 つ持たない）

WEB = ROOT / "apps" / "web"
FRAME = WEB / "features/F1/sign-up/frame.tsx"
AUTH_LOADING = WEB / "features/F1/sign-up/auth-loading.tsx"
AUTH_LOADING_SPEC = "@/features/F1/sign-up/auth-loading"
USERS = [WEB / "app/(outside)/verify-email/page.tsx", WEB / "app/(outside)/login/page.tsx"]
BUNDLE = {(WEB / "components/k/index.ts").resolve(), (WEB / "components/k/states.tsx").resolve()}
WORKFLOW = ROOT / ".github/workflows/v3-gate.yml"
BUILD_TESTPLAN = ROOT / "05_flow/build_testplan.py"
LAYER_GATE = "27"


def _src(p: pathlib.Path) -> str:
    return static_screens._strip_comments(p.read_text(encoding="utf-8"))


def _imports(p: pathlib.Path) -> list[str]:
    """ファイルの import・export from・動的 import の指定子（コメントの中は除く）"""
    return [next(g for g in m.groups() if g) for m in static_screens.IMPORT.finditer(_src(p))]


def _reach(entries: list[str]) -> set[pathlib.Path]:
    """台帳の入口から辿れる apps/web のファイル（static_screens.scan_code と同じ辿り方）"""
    todo: list[pathlib.Path] = []
    for e in entries:
        p = ROOT / e
        todo += [x for x in p.rglob("*") if x.is_file() and x.suffix in (".ts", ".tsx", ".js", ".mjs")] if p.is_dir() else [p]
    seen: set[pathlib.Path] = set()
    while todo:
        f = todo.pop().resolve()
        if f in seen or not f.is_file():
            continue
        seen.add(f)
        for spec in _imports(f):
            nxt = static_screens._resolve(WEB, f, spec)
            if nxt:
                todo.append(nxt)
    return seen


def _rel(p: pathlib.Path) -> str:
    return str(p.resolve().relative_to(ROOT.resolve()))


def _rules() -> dict:
    return ci_scope.load_rules(str(HERE / "ci_scope.json"))


def _gates(changes: list[str]) -> list[str]:
    return ci_scope.gates_for(changes, _rules(), full=False)


def _spec_steps() -> list[dict]:
    wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    return wf["jobs"]["spec"]["steps"]


class Fix(unittest.TestCase):
    """入口の枠と待ちの部品"""

    def test_K245_G27_001_frame_does_not_read_bundle_or_states(self) -> None:
        specs = _imports(FRAME)
        self.assertTrue(specs, "入口の枠の import が 1 つも読めない（読み方が壊れている）")
        resolved = {static_screens._resolve(WEB, FRAME.resolve(), s) for s in specs}
        hit = sorted(_rel(r) for r in resolved if r and r.resolve() in BUNDLE)
        self.assertEqual(hit, [], f"入口の枠が共通の部品の束か states を読む: {hit}")
        self.assertNotIn("@/components/k", specs)
        self.assertFalse([s for s in specs if s.rstrip("/").endswith("components/k/states")], specs)

    def test_K245_G27_002_auth_loading_lives_in_own_file(self) -> None:
        self.assertTrue(AUTH_LOADING.is_file(), f"待ちの部品のファイルが無い: {_rel(AUTH_LOADING)}")
        src = _src(AUTH_LOADING)
        self.assertRegex(src, r"export\s+function\s+AuthLoading\s*\(")
        self.assertRegex(src, r"<AuthFrame\b[^>]*foot=\"help\"")
        self.assertRegex(src, r"<Loading\s+delayMs=\{0\}\s*/>")
        self.assertNotRegex(_src(FRAME), r"\bfunction\s+AuthLoading\b", "入口の枠に待ちの部品の定義が残っている")

    def test_K245_G27_003_both_pages_use_auth_loading_file(self) -> None:
        for page in USERS:
            specs = {}
            for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", _src(page)):
                for name in (x.strip() for x in m.group(1).split(",")):
                    specs[name] = m.group(2)
            self.assertEqual(specs.get("AuthLoading"), AUTH_LOADING_SPEC, f"{_rel(page)} が待ちの部品を {specs.get('AuthLoading')!r} から読む")
            self.assertIn("<AuthLoading", _src(page), f"{_rel(page)} が待ちの部品を使っていない")

    def test_K245_G27_004_legal_is_covered_by_static_ledger(self) -> None:
        ledger, _ = static_screens.load_ledger(ROOT)
        self.assertIn("legal", ledger)
        self.assertEqual(static_screens.scan_code(ROOT, ledger["legal"]["code"]), [])
        ok, fails = static_screens.check(ROOT)
        self.assertEqual(fails, [], f"API を呼ばない画面の台帳が赤: {fails}")
        self.assertIn("legal", ok)

    def test_K245_G27_005_static_screens_never_reach_bundle(self) -> None:
        ledger, _ = static_screens.load_ledger(ROOT)
        self.assertTrue(ledger, "台帳が空（何も見ていないのに緑にしない）")
        for sid, ent in sorted(ledger.items()):
            reach = _reach(ent.get("code", []))
            if sid == "legal":   # 入口の枠まで辿れている（辿り方が壊れて何も見ていないのに緑にしない）
                self.assertIn(FRAME.resolve(), reach)
            hit = sorted(_rel(p) for p in reach & BUNDLE)
            self.assertEqual(hit, [], f"[{sid}] から共通の部品の束か states に届く: {hit}")

    def test_K245_G27_006_layer_audit_green_on_real_tree(self) -> None:
        g27 = [s for s in _spec_steps() if str(s.get("name", "")).startswith("G27 ")]
        self.assertEqual(len(g27), 1)
        self.assertIn("scripts/ci/layer_audit.py --run", g27[0]["run"])
        # DB の層は DB の範囲の回だけ（D-133.6）。手元には CI の DB が無いので範囲の外として流す（CI と同じ命令・同じ引数の形）
        r = subprocess.run([sys.executable, "scripts/ci/layer_audit.py", "--run", "--db-range", "false"], cwd=ROOT,
                           capture_output=True, text=True, timeout=600)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, "\n".join(ln for ln in out.splitlines() if "★" in ln)[:4000])
        self.assertIn("PASS — G21", out)


class Scope(unittest.TestCase):
    """CI の範囲の決まり（gates の 27）"""

    def test_K245_G27_007_web_screen_code_runs_g27(self) -> None:
        for f in ["apps/web/features/F1/sign-up/frame.tsx", "apps/web/features/F1/sign-up/auth-loading.tsx",
                  "apps/web/components/k/states.tsx", "apps/web/lib/api/call.ts", "apps/web/app/(outside)/legal/[kind]/page.tsx"]:
            self.assertIn(LAYER_GATE, _gates([f]), f"{f} だけを変えた回で G27 が流れない")

    def test_K245_G27_008_other_code_read_by_layers_runs_g27(self) -> None:
        # boundary.mjs --all は apps と packages のコードを全部読む・bridge の層は組み立てる・claude-terms は bridge と llm を読む
        for f in ["apps/api/src/server.ts", "packages/llm/src/index.ts", "apps/bridge/src/modes.ts", "packages/errors/src/catalog.ts"]:
            self.assertIn(LAYER_GATE, _gates([f]), f"{f} だけを変えた回で G27 が流れない")

    def test_K245_G27_009_map_scripts_and_ledger_run_g27(self) -> None:
        for f in ["spec-dependencies.yaml", "scripts/ci/static_screens.py", "scripts/ci/fb_gate.py", "05_flow/screen_api.py",
                  "scripts/tickets/build_index.py", "scripts/spec-sync/spec-validator.py", "11_tickets/K-245.md"]:
            self.assertIn(LAYER_GATE, _gates([f]), f"{f} だけを変えた回で G27 が流れない")

    def test_K245_G27_010_unread_docs_do_not_run_g27(self) -> None:
        for f in ["09_dispatch/memo.md", "infra/STAGING.md", "README.md"]:
            self.assertNotIn(LAYER_GATE, _gates([f]), f"G27 が読まない文書 {f} で G27 が流れる")
        self.assertEqual(_gates([]), [])

    def test_K245_G27_011_every_layer_g27_reads_is_covered(self) -> None:
        cfg = yaml.safe_load((ROOT / "spec-dependencies.yaml").read_text(encoding="utf-8"))
        products = [p.get("file", "") for p in cfg.get("decision_traceability", {}).get("products", [])]  # 決定のトレース（G27 の層）が読む
        own = [c["file"] for c in cfg.get("layer_checks", []) if c.get("check") and not c.get("elsewhere")]   # G27 が自分で流す層
        self.assertGreaterEqual(len(products), 10, "成果物の一覧が短すぎる（読み方が壊れている）")
        self.assertGreaterEqual(len(own), 20, "G27 が流す層の一覧が短すぎる（読み方が壊れている）")
        globs = _rules()["gates"][LAYER_GATE]
        miss = []
        for f in products + own:
            pat = f.split("#")[0]
            files = sorted(glob.glob(str(ROOT / pat))) if any(ch in pat for ch in "*?[") else [str(ROOT / pat)]
            for x in files or [str(ROOT / pat)]:
                rel = str(pathlib.Path(x).relative_to(ROOT)) if pathlib.Path(x).is_absolute() else x
                if not ci_scope.match(rel, globs):
                    miss.append(rel)
        self.assertEqual(sorted(set(miss)), [], "G27 が読む層のファイルが gates の 27 に当たらない")

    def test_K245_G27_012_files_static_screens_reach_are_covered(self) -> None:
        ledger, _ = static_screens.load_ledger(ROOT)
        globs = _rules()["gates"][LAYER_GATE]
        reach = set()
        for ent in ledger.values():
            reach |= _reach(ent.get("code", []))
        self.assertGreaterEqual(len(reach), 3, "台帳の画面から辿れるファイルが少なすぎる（辿り方が壊れている）")
        miss = sorted(_rel(p) for p in reach if not ci_scope.match(_rel(p), globs))
        self.assertEqual(miss, [], "API を呼ばない画面から辿れるファイルが gates の 27 に当たらない")


class Wiring(unittest.TestCase):
    def test_K245_G27_013_test_runs_in_g65(self) -> None:
        g65 = [s for s in _spec_steps() if str(s.get("name", "")).startswith("G65 ")]
        self.assertEqual(len(g65), 1)
        self.assertIn("python3 scripts/ci/k245_g27_reach_test.py", g65[0]["run"])
        self.assertIn("python3 scripts/ci/k245_g27_reach_test.py", BUILD_TESTPLAN.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)

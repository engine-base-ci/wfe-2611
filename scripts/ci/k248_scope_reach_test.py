#!/usr/bin/env python3
"""K-248 の試験：本線が範囲の台本の試験（G57）で赤になった所を直す・同じことが範囲の外で通らないよう CI の範囲の決まりを直す。

  python3 scripts/ci/k248_scope_reach_test.py      全部の行（行 ID は K248-G57-NNN・K248-G47-NNN。11_tickets/K-248.md の行の表と 1 対 1）

赤の原因：画面の試験 apps/web/tests/features/F5/k247-band-settle.spec.ts が readFileSync で同じ置き場の試験のファイルを読むのに、
          scripts/ci/ci_scope.json の data_links にも reads_ok にも無い（ci_scope_test.py の CS-032 が未登録の読み手として赤）。
直し：data_links に載せる（001・002）。data_links の画面の試験は単体の組（vitest）ではなく画面の組で流す（010〜012）
範囲：G57 の当たり（gates の 57）が台本と設定だけで、CS-032 が歩く apps・packages のコード（.ts・.tsx・.mjs）を持っていなかったので、
      そのチケットの CI と出す前の手元の検査（どちらも範囲の答えの gates を読む）で G57 が流れなかった（003〜009）。
      同じ形（リポジトリのファイルを歩く検査なのに、当たりが台本と設定だけ）の G47 も閉じる：errors_used.mjs が apps・packages を、
      ci_wiring_gate.py が scripts・apps/*/scripts・05_flow の台本を、contract_shape_test.py が apps・packages のコードと migration を歩く（013〜015・018・019）
      読む先を消した・名前を替えた差分でも画面の試験が選ばれる（020・021）

読むのは本物のリポジトリのファイルだけ（作りもののリポジトリは作らない）。範囲は ci_scope.gates_for と ci_scope.plan に本物の決まりを
読ませ、git とチケットの読み取りだけを差し替える（plan() が重い検査と組を決めるのと同じ関数）。
"""
from __future__ import annotations

import contextlib
import json
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

RULES_PATH = ROOT / "scripts/ci/ci_scope.json"
F5 = "apps/web/tests/features/F5/"
SETTLE = F5 + "k247-band-settle.spec.ts"
WORKFLOW = ROOT / ".github/workflows/v3-gate.yml"
BUILDER = ROOT / "05_flow/build_testplan.py"
FLOW_CFG = ROOT / "ticket-flow.yaml"
ERRORS_USED = ROOT / "scripts/ci/errors_used.mjs"
WIRING = ROOT / "scripts/ci/ci_wiring_gate.py"
SCOPE_GATE, ERRORS_GATE = "57", "47"
ME = "python3 scripts/ci/k248_scope_reach_test.py"
DOCS = ["README.md", "09_dispatch/memo.md", "apps/web/README.md", "apps/web/styles/k-extra.css", "infra/STAGING.md"]


def _rules() -> dict:
    return ci_scope.load_rules(str(RULES_PATH))


def _gates(changes: list[str]) -> list[str]:
    return ci_scope.gates_for(changes, _rules(), full=False)


@contextlib.contextmanager
def _patched(changed: list, tid: str = "K-999"):
    """plan() の git の読み取りとチケットの検査だけを差し替える（範囲の決め方・決まり・依存の地図・画面の試験の一覧は本物）。
    changed の物は パス（足した）か ci_scope.Change（消した D・名前を替えた R と古いパス）"""
    saved = {k: getattr(ci_scope, k) for k in ("changed_files", "date_only", "subject_ids", "_ticket_check", "_integration", "_ticket_tests")}
    ci_scope.changed_files = lambda repo, base, head: [x if isinstance(x, ci_scope.Change) else ci_scope.Change("A", x, None) for x in changed]
    ci_scope.date_only = lambda *a: []
    ci_scope.subject_ids = lambda *a: ([tid], [])
    ci_scope._ticket_check = lambda *a: ([], [])
    ci_scope._integration = lambda *a: ([], [], [], {})
    ci_scope._ticket_tests = lambda *a: ([], [])
    try:
        yield
    finally:
        for k, v in saved.items():
            setattr(ci_scope, k, v)


def _plan(changed: list) -> dict:
    with _patched(changed):
        return ci_scope.plan(str(ROOT), "a" * 40, "HEAD", "ticket", _rules(), str(ROOT / "11_tickets"),
                             lambda fs: {f: [] for f in fs}, lambda: [], ticket="K-999")


def _local_imports(path: pathlib.Path) -> list[pathlib.Path]:
    """台本が読み込む同じリポジトリの台本（scripts/ci・scripts/tickets に在る物）"""
    out = []
    for m in re.finditer(r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", path.read_text(encoding="utf-8"), re.M):
        name = (m.group(1) or m.group(2)).split(".")[0]
        for d in ("scripts/ci", "scripts/tickets"):
            f = ROOT / d / f"{name}.py"
            if f.exists():
                out.append(f)
    return out


def _errors_used_walk() -> tuple[list[str], list[str]]:
    """errors_used.mjs が歩く置き場と拡張子（台本の字から読む・手で写さない）"""
    src = ERRORS_USED.read_text(encoding="utf-8")
    dirs = re.search(r"for \(const d of \[([^\]]*)\]\)", src)
    ext = re.search(r"/\\\.\(([\w|]+)\)\$/\.test\(f\)", src)
    return (re.findall(r'"([^"]+)"', dirs.group(1)) if dirs else [], ext.group(1).split("|") if ext else [])


def _wiring_globs() -> list[str]:
    """ci_wiring_gate.py の script_texts が歩く glob（台本の字から読む）"""
    m = re.search(r"def script_texts\(\).*?for g in \(([^)]*)\)", WIRING.read_text(encoding="utf-8"), re.S)
    return re.findall(r'"([^"]+)"', m.group(1)) if m else []


def _sample(glob: str) -> str:
    """glob に当たる作りもののパス（* と ** を名前に替える）"""
    return glob.replace("**/", "k248/").replace("*", "k248")


def _tracked(prefixes: list[str]) -> list[str]:
    out = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z", "--", *prefixes], capture_output=True, check=True).stdout
    return [f for f in out.decode("utf-8").split("\0") if f]


class DataLinkTest(unittest.TestCase):
    def test_K248_G57_001_settle_spec_in_data_links(self) -> None:
        src = (ROOT / SETTLE).read_text(encoding="utf-8")
        self.assertRegex(src, ci_scope.READ_MARK, "読む印が無い（読み手でなければこの直しは要らない）")
        reads = {F5 + n for n in re.findall(r'"([\w.\-]+\.spec\.ts)"', src) if (ROOT / F5 / n).exists() and F5 + n != SETTLE}
        self.assertGreaterEqual(len(reads), 2, f"読む先の試験のファイルが拾えない（読み方が壊れている）: {reads}")
        links = [l for l in _rules()["data_links"] if SETTLE in l.get("tests", [])]
        self.assertEqual(len(links), 1, "data_links に k247-band-settle.spec.ts を tests に持つ行がちょうど 1 つ")
        self.assertEqual(set(links[0]["paths"]), reads, "読む先の試験のファイルを全部、ほかの物を足さずに")

    def test_K248_G57_002_no_unmapped_readers_in_repo(self) -> None:
        rules = _rules()
        self.assertGreater(len(ci_scope.walk_files(str(ROOT), ci_scope.SCAN_EXT)), 100, "歩いたファイルが少なすぎる（歩き方が壊れている）")
        self.assertEqual(ci_scope.unmapped_readers(str(ROOT), rules), [])
        self.assertEqual(ci_scope.no_test_path_reads(str(ROOT), rules), [])


class ScopeGateReachTest(unittest.TestCase):
    def test_K248_G57_003_reader_code_hits_57(self) -> None:
        samples = [f"{top}/k248/x{ext}" for top in ("apps", "packages") for ext in ci_scope.SCAN_EXT]
        samples += [F5 + "k248-new.spec.ts", "packages/llm/test/k248.test.ts", "apps/web/app/k248/page.tsx", "apps/bridge/scripts/k248.mjs"]
        for f in samples:
            self.assertIn(SCOPE_GATE, _gates([f]), f)

    def test_K248_G57_004_docs_do_not_hit_57(self) -> None:
        for f in DOCS:
            self.assertNotIn(SCOPE_GATE, _gates([f]), f)
        self.assertEqual(_gates([]), [])

    def test_K248_G57_005_every_walked_file_hits_57(self) -> None:
        files = ci_scope.walk_files(str(ROOT), ci_scope.SCAN_EXT)
        self.assertGreater(len(files), 100, "歩いたファイルが少なすぎる")
        globs = _rules()["gates"][SCOPE_GATE]
        self.assertEqual([f for f in files if not ci_scope.match(f, globs)], [])

    def test_K248_G57_006_imported_scripts_hit_57(self) -> None:
        mods = sorted({m for s in ("ci_scope.py", "ci_scope_test.py", "ticket_affects_test.py") for m in _local_imports(HERE / s)})
        rel = [str(m.relative_to(ROOT)) for m in mods]
        self.assertGreaterEqual(len(rel), 4, f"読み込む台本が拾えない: {rel}")
        for f in rel:
            self.assertIn(SCOPE_GATE, _gates([f]), f)

    def test_K248_G57_007_files_read_by_real_repo_tests_hit_57(self) -> None:
        for f in [".github/workflows/v3-gate.yml", "05_flow/build_testplan.py", "03_architecture/choke-points.json", "scripts/ci/generated.json",
                  "scripts/ci/ci_scope.json", "vitest.config.ts", "pnpm-workspace.yaml", "apps/web/package.json"]:
            self.assertTrue((ROOT / f).exists(), f)
            self.assertIn(SCOPE_GATE, _gates([f]), f)

    def test_K248_G57_008_plan_outputs_gate_57(self) -> None:
        p = _plan([F5 + "k248-new.spec.ts"])
        self.assertIn(SCOPE_GATE, p["gates"])
        self.assertIn(f",{SCOPE_GATE},", ci_scope.outputs(p)["gates"])

    def test_K248_G57_009_ci_and_preflight_read_the_gates(self) -> None:
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        g57 = [s for s in wf["jobs"]["spec"]["steps"] if str(s.get("name", "")).startswith("G57 ")]
        self.assertEqual(len(g57), 1)
        self.assertIn("contains(steps.scope.outputs.gates, ',57,')", g57[0]["if"])
        self.assertIn("python3 scripts/ci/ci_scope_test.py", g57[0]["run"])
        cfg = yaml.safe_load(FLOW_CFG.read_text(encoding="utf-8"))
        self.assertIn("spec", cfg["preflight_jobs"], "出す前の手元の検査が spec の組（G57 の段）を流す")


class WebDataLinkTest(unittest.TestCase):
    def test_K248_G57_010_read_target_change_selects_settle_spec_in_web(self) -> None:
        p = _plan([F5 + "approve-complete-live.spec.ts"])
        self.assertEqual(p["errors"], [])
        self.assertTrue(p["jobs"]["web"])
        self.assertIn(SETTLE, p["web_g48"] + p["web_g59"])
        self.assertNotIn(SETTLE, p["unit_files"])

    def test_K248_G57_011_vitest_data_link_stays_in_unit(self) -> None:
        p = _plan(["08_api/endpoints.json"])
        self.assertIn("apps/api/src/contract/authz.test.ts", p["unit_files"])

    def test_K248_G57_012_web_spec_not_in_list_is_dropped_quietly(self) -> None:
        # data_links の画面の試験が画面の試験の一覧（G48・G59）に無い（agent-chat.spec.ts）：単体の組に入れず、画面の組も起こさず、止めない
        self.assertNotIn("apps/web/tests/screens/agent-chat.spec.ts", self._domain())
        p = _plan(["scripts/ci/chat_one.mjs"])
        self.assertEqual([f for f in p["unit_files"] if f.startswith(ci_scope.WEB_E2E_PREFIX)], [])
        self.assertEqual(p["errors"], [])
        self.assertFalse(p["jobs"]["web"])

    def _domain(self) -> set[str]:
        import web_select
        return set(web_select.domain_g48(str(ROOT))) | set(web_select.domain_g59(str(ROOT)))

    def test_K248_G57_020_deleted_read_target_selects_settle_spec(self) -> None:
        p = _plan([ci_scope.Change("D", F5 + "approve-complete-live.spec.ts", None)])
        self.assertEqual(p["errors"], [])
        self.assertIn(SETTLE, p["web_g48"] + p["web_g59"])
        self.assertNotIn(SETTLE, p["unit_files"])

    def test_K248_G57_021_renamed_read_target_selects_settle_spec(self) -> None:
        p = _plan([ci_scope.Change("R100", F5 + "approve-complete-live2.spec.ts", F5 + "approve-complete-live.spec.ts")])
        self.assertEqual(p["errors"], [])
        self.assertIn(SETTLE, p["web_g48"] + p["web_g59"])
        self.assertNotIn(SETTLE, p["unit_files"])


class ErrorsGateReachTest(unittest.TestCase):
    def test_K248_G47_013_errors_used_walk_hits_47(self) -> None:
        dirs, exts = _errors_used_walk()
        self.assertGreaterEqual(len(dirs), 2, f"歩く置き場が読めない: {dirs}")
        self.assertGreaterEqual(len(exts), 2, f"拡張子が読めない: {exts}")
        for d in dirs:
            for e in exts:
                self.assertIn(ERRORS_GATE, _gates([f"{d}/k248/x.{e}"]), f"{d} .{e}")
        self.assertIn(ERRORS_GATE, _gates(["07_qa/test-specs/errors.json"]))

    def test_K248_G47_014_every_walked_file_hits_47(self) -> None:
        dirs, exts = _errors_used_walk()
        files = [f for f in _tracked(dirs) if f.rsplit(".", 1)[-1] in exts and "/node_modules/" not in f and "/dist/" not in f]
        self.assertGreater(len(files), 100, "歩いたファイルが少なすぎる")
        globs = _rules()["gates"][ERRORS_GATE]
        self.assertEqual([f for f in files if not ci_scope.match(f, globs)], [])

    def test_K248_G47_015_docs_do_not_hit_47(self) -> None:
        for f in DOCS:
            self.assertNotIn(ERRORS_GATE, _gates([f]), f)

    def test_K248_G47_018_wiring_walk_hits_47(self) -> None:
        globs = _wiring_globs()
        self.assertGreaterEqual(len(globs), 4, f"ci_wiring_gate の歩く glob が読めない: {globs}")
        g47 = _rules()["gates"][ERRORS_GATE]
        for g in globs:
            self.assertIn(ERRORS_GATE, _gates([_sample(g)]), g)
        files = [str(f.relative_to(ROOT)) for g in globs for f in ROOT.glob(g) if f.is_file() and "__pycache__" not in f.parts]
        self.assertGreater(len(files), 100, "歩いたファイルが少なすぎる")
        self.assertEqual([f for f in files if not ci_scope.match(f, g47)], [])

    def test_K248_G47_019_contract_shape_reads_hit_47(self) -> None:
        reads = ["08_api/openapi.yaml", "08_api/db-columns.json", "08_api/endpoints.json", "08_api/types.ts", "05_flow/screen_api.py",
                 "packages/db/src/index.ts", "apps/api/src/hooks/k248.ts", "apps/bridge/src/k248.tsx"]
        reads += [str(f.relative_to(ROOT)) for f in sorted((ROOT / "packages/db/migrations").glob("*.sql"))]
        self.assertGreater(len(reads), 20, "migration が拾えない")
        for f in reads:
            self.assertIn(ERRORS_GATE, _gates([f]), f)


class WiringTest(unittest.TestCase):
    def test_K248_G57_016_runs_in_g65(self) -> None:
        # G65 の並びはチケットごとのファイル scripts/ci/g65.d から作り手が作る（K-376）。最後に置くのは作り手の G65_LAST
        import gate_cmds  # noqa: E402
        self.assertRegex(BUILDER.read_text(encoding="utf-8"), r'G65_LAST = "' + re.escape(ME) + '"', "作り手が k248 を最後に置く")
        g65 = gate_cmds.script(ROOT / "scripts" / "ci" / "g65.d", last=ME)
        self.assertTrue(g65.endswith(f"&& {ME}"), "G65 の並びの最後")
        self.assertIn("python3 scripts/ci/k245_g27_reach_test.py", g65, "ほかの試験を消さない")
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        st = [s for s in wf["jobs"]["spec"]["steps"] if str(s.get("name", "")).startswith("G65 ")]
        self.assertEqual(len(st), 1)
        self.assertTrue(st[0]["run"].endswith(ME))

    def test_K248_G57_017_old_57_globs_kept(self) -> None:
        globs = json.loads(RULES_PATH.read_text(encoding="utf-8"))["gates"][SCOPE_GATE]
        for g in ["scripts/ci/ci_scope*", "scripts/ci/ticket_affects*", "scripts/ci/vitest_related*", "pnpm-workspace.yaml", "**/package.json", "package.json"]:
            self.assertIn(g, globs)


if __name__ == "__main__":
    unittest.main(verbosity=2)

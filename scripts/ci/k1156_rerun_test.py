#!/usr/bin/env python3
"""K-1156 の試験：赤を直した回の範囲（scripts/ci/ci_scope.py の --rerun・--since と、v3-gate.yml の入力 rerun・since）。

  python3 scripts/ci/k1156_rerun_test.py        全部の行（行 ID は K1156-RR-NNN。チケット 11_tickets/K-1156.md の表と 1 対 1）

  作りものの git の写し・決まり・部品（Base・Repo など）は前からの試験 scripts/ci/ci_scope_test.py のものを読み込んで使う。
"""
from __future__ import annotations

import json
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ci_scope  # noqa: E402,F401
from ci_scope_test import MIG2, ROOT, RULES, Base, git, parse_gh_output, ticket  # noqa: E402,F401


class RerunTest(Base):
    """K-1156（2026-11-24・代表の決め）：赤を直した回は、前の回で赤だった行（rerun）と前の回から変えたファイル（since..先頭）に関わる行だけ。
    本線との範囲の確かめは base のまま・入力が無ければ今と同じ・形の違う入力は止める・scope=full は全部"""

    LT = {"apps/x/src/main.ts": ["apps/x/test/main.test.ts"], "apps/w/src/page.ts": ["apps/w/test/page.test.ts"]}
    R1 = "apps/x/test/r1.test.ts"
    R2 = "apps/x/test/r2.test.ts"

    def go(self, base: str | None = None, scope: str = "auto", rerun: str | None = None, since: str | None = None, rules: dict | None = None,
           leaves: str | None = None) -> dict:
        def lt(files: list[str]) -> dict[str, list[str]]:
            return {f: list(self.LT.get(f, [])) for f in files}
        kw = {k: v for k, v in (("rerun", rerun), ("since", since), ("leaves", leaves)) if v is not None}
        return ci_scope.plan(str(self.r.dir), base or self.r.base, "HEAD", scope, rules=rules or RULES, tickets_dir=str(self.r.dir / "11_tickets"),
                             list_tests=lt, db_tests=lambda: ["packages/a/test/rows.test.ts"], **kw)

    def two_rounds(self, affects: list[str] | None = None, tests: str | None = None, ci_wide: list[str] | None = None, **extra: str) -> str:
        """前の回（since）：r1（行 K1-RR-001）と r2（行 K1-RR-002）を足し、w の page.ts と x の main.ts を変える。直した回：x の main.ts だけ"""
        files = {"apps__x__test__r1.test.ts": 'test("K1-RR-001 赤だった行", () => {});\n',
                 "apps__x__test__r2.test.ts": 'test("K1-RR-002 緑だった行", () => {});\n',
                 "11_tickets__K-1.md": ticket("K-1", affects or ["w", "x"], ci_wide, tests=tests or f"[{self.R1}, {self.R2}]"),
                 "apps__x__src__main_ts": "export const x = 5;\n", "apps__w__src__page_ts": "export const w = 4;\n", **extra}
        since = self.r.commit("K-1 test: 前の回", **files)
        self.r.commit("K-1 fix: 赤を直す", apps__x__src__main_ts="export const x = 6;\n")
        return since

    def test_K1156_RR_001_ticket_tests_only_files_with_red_rows(self) -> None:
        r6 = "apps/x/test/r6.test.ts"
        since = self.two_rounds(tests=f"[{self.R1}, {self.R2}, {r6}]", **{"apps__x__test__r6.test.ts": 'test("K1-M2-003 中の段に数字", () => {});\n'})
        p = self.go(rerun="K1-RR-001 K1-M2-003", since=since)   # ci.py は空白区切りで渡す
        self.assertIn(self.R1, p["unit_files"], p["reasons"])
        self.assertIn(r6, p["unit_files"])
        self.assertNotIn(self.R2, p["unit_files"])
        self.assertEqual((p["errors"], p["mismatches"]), ([], []))
        self.assertIn(f"赤を直した回：rerun 2 行・since {since[:10]}", "\n".join(p["reasons"]))

    def test_K1156_RR_002_related_by_since_diff(self) -> None:
        since = self.two_rounds()
        p = self.go(rerun="K1-RR-001", since=since)
        self.assertEqual(p["unit_files"], sorted(["apps/x/test/main.test.ts", self.R1]), p["reasons"])
        self.assertNotIn("apps/w/test/page.test.ts", p["unit_files"])   # base→since だけで変えた page.ts の試験は流さない
        self.assertEqual(p["jobs"], {"unit": True, "database": False, "web": False})   # w の組（database・web）は base→since だけで変えた
        self.assertEqual(p["coverage_args"], ["--coverage.include=apps/x/src/main.ts"])
        q = self.go()
        for f in ("apps/w/test/page.test.ts", self.R2, self.R1, "apps/x/test/main.test.ts"):
            self.assertIn(f, q["unit_files"], f)
        self.assertTrue(q["jobs"]["database"] and q["jobs"]["web"])
        self.assertIn("--coverage.include=apps/w/src/page.ts", q["coverage_args"])
        gated = {**RULES, "gates": {"36": ["apps/w/**"]}}   # 重い検査も since の差分で選ぶ
        self.assertEqual(self.go(rerun="K1-RR-001", since=since, rules=gated)["gates"], [])
        self.assertEqual(self.go(rules=gated)["gates"], ["36"])

    def test_K1156_RR_003_range_check_stays_on_base(self) -> None:
        since = self.two_rounds(affects=["x"])
        p = self.go(rerun="K1-RR-001", since=since)
        self.assertIn("w：変えたのにチケットに無い（K-1 の affects）", p["mismatches"])
        self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})
        self.assertEqual(p["unit_shards"], 0)
        self.assertEqual(p["base"], self.r.base)
        self.assertNotEqual(p["base"], since)

    def test_K1156_RR_004_empty_inputs_same_as_before(self) -> None:
        self.two_rounds()
        a, b = self.go(), self.go(rerun="", since="")
        self.assertEqual(a, b)   # 答えの全体
        self.assertEqual(ci_scope.outputs(a), ci_scope.outputs(b))   # GITHUB_OUTPUT に書く値

    def test_K1156_RR_005_one_input_only_does_not_narrow(self) -> None:
        since = self.two_rounds()
        want = self.go()
        for label, kw in {"rerun だけ": dict(rerun="K1-RR-001"), "since だけ": dict(since=since)}.items():
            with self.subTest(label):
                p = self.go(**kw)
                self.assertEqual(p, want, label)
                self.assertEqual(ci_scope.outputs(p), ci_scope.outputs(want), label)
                self.assertIn(self.R2, p["unit_files"])
                self.assertIn("apps/w/test/page.test.ts", p["unit_files"])
                self.assertEqual(p["errors"], [], label)

    def test_K1156_RR_006_bad_since_stops(self) -> None:
        self.two_rounds()
        for since in ("abc", "0" * 40):
            with self.subTest(since):
                p = self.go(rerun="K1-RR-001", since=since)
                self.assertEqual(p["mode"], "scoped")
                self.assertTrue(any(e.startswith("範囲を決められない（rerun：") and "全部には倒さず止める" in e for e in p["errors"]), p["errors"])
                self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})

    def test_K1156_RR_007_bad_rerun_stops(self) -> None:
        since = self.two_rounds()
        for rerun in ("K1-RR-001;rm", "K1-RR-001 $(x)"):
            with self.subTest(rerun):
                p = self.go(rerun=rerun, since=since)
                self.assertTrue(any(e.startswith("範囲を決められない（rerun：") for e in p["errors"]), p["errors"])
                self.assertEqual(p["jobs"], {"unit": False, "database": False, "web": False})

    def test_K1156_RR_008_scope_full_ignores_rerun(self) -> None:
        r4, r5 = "scripts/ci/r4_test.py", "scripts/ci/r5_test.py"
        since = self.two_rounds(tests=f"[{r4}, {r5}]", ci_wide=["ci"], **{
            "scripts__ci__r4_test.py": "def test_K1_RR_001_x():\n    pass\n",
            "scripts__ci__r5_test.py": "def test_y():\n    pass  # K1-RR-002\n"})
        p = self.go(scope="full", rerun="K1-RR-001", since=since, leaves="K-1")   # stageq が前の回の赤の後に出す形
        self.assertEqual(p["mode"], "full")
        self.assertEqual(p["jobs"], {"unit": True, "database": True, "web": True})
        self.assertEqual(p["errors"], [])
        self.assertEqual(p["py_tests"], [r4, r5])   # K-1305 の leaves の py_tests も rerun で絞らない（r5 を落とさない）

    def test_K1156_RR_009_row_id_forms_and_edges(self) -> None:
        r3, r4, r5 = "apps/x/test/r3.test.ts", "scripts/ci/r4_test.py", "scripts/ci/r5_test.py"
        since = self.two_rounds(tests=f"[{self.R1}, {r3}, {r4}, {r5}]", ci_wide=["ci"], **{
            "apps__x__test__r1.test.ts": 'test("test_K1_RR_001_name", () => {});\n',
            "apps__x__test__r3.test.ts": 'test("K1-RR-0012 別の行", () => {});\ntest("test_K1_RR_0012_x", () => {});\n',
            "scripts__ci__r4_test.py": "def test_K1_RR_001_x():\n    pass\n",
            "scripts__ci__r5_test.py": "def test_y():\n    pass  # K1-RR-002\n"})
        p = self.go(rerun="K1-RR-001", since=since)
        self.assertIn(self.R1, p["unit_files"], p["reasons"])
        self.assertNotIn(r3, p["unit_files"])
        self.assertEqual(p["py_tests"], [r4])

    def test_K1156_RR_013_red_row_in_no_file_is_reported(self) -> None:
        since = self.two_rounds()
        p = self.go(rerun="K1-RR-009", since=since)
        self.assertEqual(p["errors"], [], p["reasons"])
        self.assertTrue(any("K1-RR-009" in r for r in p["reasons"]), p["reasons"])
        self.assertNotIn(self.R1, p["unit_files"])
        self.assertNotIn(self.R2, p["unit_files"])

    def test_K1156_RR_014_db_range_by_since_diff(self) -> None:
        since = self.two_rounds(affects=["a", "w", "x"], ci_wide=["db"], **{"packages__a__migrations__0002_sql": "select 2;\n",
                                                                         "packages__a__src__index_ts": MIG2})
        p = self.go(rerun="K1-RR-001", since=since)
        self.assertEqual(p["errors"], [], p["reasons"])
        self.assertFalse(p["db_range"])
        self.assertEqual(p["migration_files"], [])
        self.assertFalse(p["jobs"]["database"])
        self.assertNotIn("packages/a/test/rows.test.ts", p["unit_files"])
        q = self.go()
        self.assertTrue(q["db_range"])
        self.assertEqual(q["migration_files"], ["packages/a/migrations/0002.sql"])
        self.assertTrue(q["jobs"]["database"])

    def test_K1156_RR_010_main_and_github_output(self) -> None:
        since = self.r.commit("K-1 test: 前の回", **{"apps__x__test__r1.test.ts": 'test("K1-RR-001", () => {});\n',
                                                    "apps__x__test__r2.test.ts": 'test("K1-RR-002", () => {});\n',
                                                    "11_tickets__K-1.md": ticket("K-1", ["x"], tests=f"[{self.R1}, {self.R2}]")})
        self.r.commit("K-1 fix: 赤を直す", **{"07_qa__plan.json": '{"a": 1}\n'})
        out = self.r.dir / "gh_output.txt"
        rules = self.r.dir / "rules.json"
        rules.write_text(json.dumps(RULES), encoding="utf-8")
        rc = ci_scope.main(["--repo", str(self.r.dir), "--base", self.r.base, "--head", "HEAD", "--scope", "ticket",
                            "--rules", str(rules), "--tickets", str(self.r.dir / "11_tickets"), "--no-vitest",
                            "--rerun", "K1-RR-001", "--since", since, "--github-output", str(out)])
        self.assertEqual(rc, 0)
        kv = parse_gh_output(out.read_text(encoding="utf-8"))
        files = json.loads(kv["unit_files"])
        self.assertIn(self.R1, files)
        self.assertNotIn(self.R2, files)
        self.assertEqual(kv["base"], self.r.base)

    def test_K1156_RR_011_mainline_merged_after_since(self) -> None:
        since = self.two_rounds(affects=["x"], apps__w__src__page_ts="export const w = 3;\n")
        git(self.r.dir, "checkout", "-q", "-b", "line", self.r.base)
        main_tip = self.r.commit("K-5 feat: 本線", apps__w__src__page_ts="export const w = 9;\n")
        git(self.r.dir, "checkout", "-q", "main")
        git(self.r.dir, "merge", "-q", "--no-ff", "line", "-m", "K-1 merge: 本線を取り込む")
        p = self.go(base=main_tip, rerun="K1-RR-001", since=since)
        self.assertEqual(p["errors"], [], p["reasons"])
        self.assertEqual(p["tickets"], ["K-1"])
        self.assertIn("apps/w/test/page.test.ts", p["unit_files"])
        self.assertNotIn(self.R2, p["unit_files"])

    def test_K1156_RR_012_workflow_generator_and_flow_config(self) -> None:
        import yaml
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        on = wf.get("on", wf.get(True))
        inputs = on["workflow_dispatch"]["inputs"]
        for k in ("rerun", "since"):
            self.assertIn(k, inputs)
            self.assertEqual((inputs[k].get("type"), inputs[k].get("default")), ("string", ""), k)
        arg = '--rerun "$CI_RERUN_INPUT" --since "$CI_SINCE_INPUT"'
        seen = 0
        for name, job in wf["jobs"].items():
            for st in job.get("steps", []):
                run = str(st.get("run", ""))
                if "scripts/ci/ci_scope.py" in run and "--github-output" in run:
                    seen += 1
                    env = st.get("env") or {}
                    self.assertIn("inputs.rerun", str(env.get("CI_RERUN_INPUT")), name)
                    self.assertIn("inputs.since", str(env.get("CI_SINCE_INPUT")), name)
                    self.assertIn(arg, run, name)
        self.assertEqual(seen, 5)   # static・spec・spec-2・spec-3・spec-parts（K-1307）
        gen = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
        self.assertIn(arg, gen)
        self.assertIn("inputs.rerun", gen)
        self.assertIn("inputs.since", gen)
        ci = (yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8")) or {}).get("ci") or {}
        ins = ci.get("inputs") or {}
        self.assertEqual((ins.get("rerun"), ins.get("since")), ("rerun", "since"))
        for k in ("scope", "ticket", "base", "web"):
            self.assertEqual(ins.get(k), k)


if __name__ == "__main__":
    unittest.main(verbosity=2)

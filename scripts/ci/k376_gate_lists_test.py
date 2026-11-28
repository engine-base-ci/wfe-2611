#!/usr/bin/env python3
"""CI の段の命令の並びをチケットごとのファイルから作る（K-376）。

  python3 scripts/ci/k376_gate_lists_test.py      全部の行（行 ID は K376-GL-NNN。11_tickets/K-376.md の行の表と 1 対 1）

見る物：並びを作る部品 scripts/ci/gate_cmds.py（断片は一時フォルダに作る）・本物の置き場 scripts/ci/g65.d・scripts/ci/g47.d・
作り手 05_flow/build_testplan.py と、作り手が作った CI の定義（.github/workflows/v3-gate.yml）と試験計画（07_qa/test-plan/test-plan.json）・
範囲の決まり（scripts/ci/ci_scope.json）・切る段の道具（scripts/ci/cut_check.py）。DB は使わない。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import gate_cmds  # noqa: E402
from gate_cmds import GateListError  # noqa: E402

G65_DIR = ROOT / "scripts" / "ci" / "g65.d"
G47_DIR = ROOT / "scripts" / "ci" / "g47.d"
K248 = "python3 scripts/ci/k248_scope_reach_test.py"
ME = "python3 scripts/ci/k376_gate_lists_test.py"
BUILDER = ROOT / "05_flow" / "build_testplan.py"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
TESTPLAN_JSON = ROOT / "07_qa" / "test-plan" / "test-plan.json"

# 移す前（本線 588dcab2）の G65・G47 の命令の並び。移した後も全部が残ることを見る（順は G65 の k248 が最後のほかは問わない）
OLD_G65 = [
    "python3 scripts/ci/k172_ci_shape_test.py", "python3 scripts/ci/k173_vm_test.py", "python3 scripts/ci/k174_flow_config_test.py",
    "python3 scripts/ci/k175_flow_config_test.py", "python3 scripts/ci/k176_web_junit_test.py", "python3 scripts/ci/k177_web_scope_test.py",
    "python3 scripts/ci/k178_flow_config_test.py", "python3 scripts/ci/k186_web_artifact_test.py", "python3 scripts/ci/k187_cut_take_test.py",
    "python3 scripts/ci/k188_human_sheet_test.py", "python3 scripts/ci/k191_regen_all_test.py", "python3 scripts/ci/k192_scope_deps_test.py",
    "python3 scripts/ci/k193_hook_timeout_test.py", "python3 scripts/ci/k195_runner_chrome_test.py",
    "python3 scripts/ci/k196_results_on_mainline_test.py", "python3 scripts/ci/k200_staging_health_test.py",
    "python3 scripts/ci/k206_author_gate_test.py", "python3 scripts/ci/k204_staging_workflow_test.py", "python3 scripts/ci/k97_bridge_build_test.py",
    "python3 scripts/ci/k65_staging_spec_test.py", "python3 scripts/ci/k208_staging_expect_test.py", "python3 scripts/ci/k210_gate_holes_test.py",
    "python3 scripts/ci/k245_g27_reach_test.py", "python3 scripts/ci/k213_design_parent_test.py", "python3 scripts/ci/k212_function_region_test.py",
    "python3 scripts/ci/k246_function_config_test.py", "python3 scripts/ci/fidelity_config.py --selftest",
    "python3 scripts/ci/k216_fidelity_config_test.py",
    "node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit "
    "--test-reporter-destination=junit/spec-k216-mjs.xml scripts/ci/k216_fidelity_compare.test.mjs",
    "python3 scripts/ci/k219_canvas_states_test.py", "python3 scripts/ci/k257_canvas_boards_test.py", "python3 scripts/ci/k258_web_defer_test.py",
    "python3 scripts/ci/k232_fidelity_doc_test.py", "python3 scripts/ci/k262_staging_edge_test.py", "python3 scripts/ci/k237_perf_ledger_test.py",
    "python3 scripts/ci/k237_staging_perf_test.py", "python3 scripts/ci/k330_cut_check_test.py", "python3 scripts/ci/k323_spec_split_test.py",
    "python3 scripts/ci/k325_registries_test.py", "python3 scripts/ci/k326_ts_registries_test.py", "python3 scripts/ci/k327_migrations_gen_test.py",
    "python3 scripts/ci/k328_secrets_parents_test.py", K248,
]
OLD_G47 = [
    "python3 scripts/ci/ci_wiring_gate.py --selftest", "python3 scripts/ci/ci_wiring_gate.py", "pnpm -s ci:errors-used",
    "pnpm -s ci:errors-used:selftest", "pnpm -s ci:sql-guard:selftest", "pnpm -s ci:chat-one:selftest", "pnpm -s ci:contract:selftest",
    "pnpm -s ci:env-audit:selftest", "python3 scripts/ci/qa_delta.py --selftest", "python3 scripts/ci/static_screens_test.py",
    "python3 scripts/ci/contract_shape_test.py", "python3 scripts/ci/k185_hook_regions_test.py", "python3 scripts/ci/fuzz_targets_test.py",
]


def write(directory: Path, files: dict[str, str]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (directory / name).write_text(text, encoding="utf-8")
    return directory


def wf_run(gate: int) -> str:
    wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    runs = [str(s.get("run", "")) for job in wf["jobs"].values() for s in job.get("steps", [])
            if str(s.get("name", "")).startswith(f"G{gate} ")]
    assert len(runs) == 1, f"G{gate} の段が {len(runs)} 個"
    return runs[0].strip()


class Parts(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / "g.d"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_K376_GL_001_order_base_then_ticket_numbers(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\ncmd b\n", "K-12.txt": "cmd c\n", "K-3.txt": "cmd d\n", "README.md": "置き方\n"})
        self.assertEqual(gate_cmds.commands(self.dir), ["cmd a", "cmd b", "cmd d", "cmd c"])
        self.assertEqual([p.name for p in gate_cmds.files(self.dir)], ["_base.txt", "K-3.txt", "K-12.txt"])

    def test_K376_GL_002_last_goes_to_the_end(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\nlast one\ncmd b\n", "K-5.txt": "cmd c\n"})
        self.assertEqual(gate_cmds.commands(self.dir, last="last one"), ["cmd a", "cmd b", "cmd c", "last one"])
        other = write(Path(self.tmp.name) / "h.d", {"_base.txt": "cmd a\n", "K-5.txt": "last one\n", "K-6.txt": "cmd z\n"})
        self.assertEqual(gate_cmds.commands(other, last="last one"), ["cmd a", "cmd z", "last one"])

    def test_K376_GL_003_missing_last_stops(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\n"})
        with self.assertRaises(GateListError) as e:
            gate_cmds.commands(self.dir, last="last_k3")
        self.assertIn("last_k3", str(e.exception))

    def test_K376_GL_004_duplicate_across_files_stops(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\n", "K-7.txt": "dup_k7\n", "K-8.txt": "dup_k7\n"})
        with self.assertRaises(GateListError) as e:
            gate_cmds.commands(self.dir)
        for word in ("K-7.txt", "K-8.txt", "dup_k7"):
            self.assertIn(word, str(e.exception))

    def test_K376_GL_005_duplicate_within_file_stops(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\ndup_b5\ndup_b5\n"})
        with self.assertRaises(GateListError) as e:
            gate_cmds.commands(self.dir)
        self.assertIn("dup_b5", str(e.exception))
        self.assertIn("_base.txt", str(e.exception))

    def test_K376_GL_006_names(self) -> None:
        for bad in ("extra.txt", "k-1.txt", "K-1.py", "K-1.txt.bak", "K-007.txt", "K-0.txt"):
            d = write(Path(self.tmp.name) / f"bad-{bad}", {"_base.txt": "cmd a\n", bad: "cmd x\n"})
            with self.assertRaises(GateListError, msg=bad) as e:
                gate_cmds.commands(d)
            self.assertIn(bad, str(e.exception))
        sub = write(Path(self.tmp.name) / "bad-dir", {"_base.txt": "cmd a\n"})
        (sub / "K-2.txt").mkdir()
        with self.assertRaises(GateListError) as e3:
            gate_cmds.commands(sub)
        self.assertIn("K-2.txt", str(e3.exception))
        ok = write(self.dir, {"_base.txt": "cmd a\n", "README.md": "cmd readme\n", ".DS_Store": "x"})
        self.assertEqual(gate_cmds.commands(ok), ["cmd a"])

    def test_K376_GL_007_base_is_required(self) -> None:
        write(self.dir, {"K-1.txt": "cmd a\n"})
        with self.assertRaises(GateListError) as e:
            gate_cmds.commands(self.dir)
        self.assertIn("_base.txt", str(e.exception))
        with self.assertRaises(GateListError) as e2:
            gate_cmds.commands(Path(self.tmp.name) / "nothing.d")
        self.assertIn("_base.txt", str(e2.exception))

    def test_K376_GL_008_one_command_per_line(self) -> None:
        write(self.dir, {"_base.txt": "# 説明\n\n  cmd a  \n", "K-2.txt": "cmd b\n"})
        self.assertEqual(gate_cmds.commands(self.dir), ["cmd a", "cmd b"])
        joins = ("cmd x && cmd y", "cmd x; cmd y", "cmd x || cmd y", "cmd x  # メモ", "cmd x | tee y", "cmd x & cmd y",
                 "cmd `x`", "cmd $(x)")
        for i, joined in enumerate(joins):
            d = write(Path(self.tmp.name) / f"j{i}", {"_base.txt": "cmd a\n", "K-9.txt": joined + "\n"})
            with self.assertRaises(GateListError, msg=joined) as e:
                gate_cmds.commands(d)
            self.assertIn("K-9.txt", str(e.exception))

    def test_K376_GL_009_empty_stops(self) -> None:
        write(self.dir, {"_base.txt": "# 何も無い\n\n"})
        with self.assertRaises(GateListError):
            gate_cmds.script(self.dir)

    def test_K376_GL_010_script_joins(self) -> None:
        write(self.dir, {"_base.txt": "cmd a\nlast one\n", "K-4.txt": "cmd b\n"})
        self.assertEqual(gate_cmds.script(self.dir, last="last one"), "cmd a && cmd b && last one")

    def test_K376_GL_018_two_tickets_merge_without_conflict(self) -> None:
        repo = Path(self.tmp.name) / "repo"
        repo.mkdir()

        def git(*args: str) -> subprocess.CompletedProcess:
            done = subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid",
                                   "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", *args], cwd=repo,
                                  capture_output=True, text=True)
            self.assertEqual(done.returncode, 0, f"git {' '.join(args)}: {done.stdout}{done.stderr}")
            return done

        git("init", "-q", "-b", "main")
        write(repo / "g.d", {"_base.txt": "cmd a\nlast one\n"})
        git("add", "-A"); git("commit", "-qm", "base")
        git("checkout", "-qb", "ta")
        write(repo / "g.d", {"K-1.txt": "cmd one\n"})
        git("add", "-A"); git("commit", "-qm", "a")
        git("checkout", "-q", "main"); git("checkout", "-qb", "tb")
        write(repo / "g.d", {"K-2.txt": "cmd two\n"})
        git("add", "-A"); git("commit", "-qm", "b")
        git("checkout", "-q", "main")
        self.assertEqual(git("merge", "-q", "--no-edit", "ta").returncode, 0)
        merged = git("merge", "-q", "--no-edit", "tb")
        self.assertEqual(merged.returncode, 0, merged.stdout + merged.stderr)
        self.assertEqual(gate_cmds.commands(repo / "g.d", last="last one"), ["cmd a", "cmd one", "cmd two", "last one"])
        self.assertEqual(sorted(git("ls-files", "g.d").stdout.split()), ["g.d/K-1.txt", "g.d/K-2.txt", "g.d/_base.txt"])
        self.assertEqual(git("status", "--porcelain").stdout, "", "取り込んだ後に作業ツリーに残り物が無い")


class Real(unittest.TestCase):
    def test_K376_GL_011_real_lists_keep_everything(self) -> None:
        g65 = gate_cmds.commands(G65_DIR, last=K248)
        self.assertEqual(sorted(set(OLD_G65) - set(g65)), [], "移す前の G65 の命令が消えた")
        self.assertEqual(g65[-1], K248)
        self.assertIn(ME, g65)
        self.assertEqual(Path(G65_DIR / "K-376.txt").read_text(encoding="utf-8").split(), ME.split(), "このチケットの分は K-376.txt")
        g47 = gate_cmds.commands(G47_DIR)
        self.assertEqual(g47[:len(OLD_G47)], OLD_G47, "G47 は _base の分が移す前と同じ命令が同じ順（後ろはチケットごとの足し）")

    def test_K376_GL_012_builder_and_generated(self) -> None:
        text = BUILDER.read_text(encoding="utf-8")
        self.assertNotIn("python3 scripts/ci/k172_ci_shape_test.py", text, "G65 の並びが作り手に残っている")
        self.assertNotIn("pnpm -s ci:errors-used:selftest", text, "G47 の並びが作り手に残っている")
        self.assertIn("gate_cmds", text)
        self.assertRegex(text, r'G65_LAST = "python3 scripts/ci/k248_scope_reach_test\.py"')
        g65 = gate_cmds.script(G65_DIR, last=K248)
        g47 = gate_cmds.script(G47_DIR)
        self.assertEqual(wf_run(65), g65, "v3-gate.yml の G65 が .d から作った並びと違う（作り直していない）")
        self.assertEqual(wf_run(47), g47, "v3-gate.yml の G47 が .d から作った並びと違う")
        plan = json.loads(TESTPLAN_JSON.read_text(encoding="utf-8"))
        found = {g["id"]: g["script"] for g in plan["gates"] if g.get("id") in (65, 47)}
        self.assertEqual(found.get(65), g65, "試験計画の G65")
        self.assertEqual(found.get(47), g47, "試験計画の G47")

    def test_K376_GL_013_commands_point_at_real_things(self) -> None:
        pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8")).get("scripts", {})
        for cmd in [*gate_cmds.commands(G65_DIR, last=K248), *gate_cmds.commands(G47_DIR)]:
            for path in re.findall(r"scripts/ci/[\w./-]+\.(?:py|mjs)\b", cmd):
                self.assertTrue((ROOT / path).is_file(), f"{cmd}: {path} が無い")
            m = re.match(r"pnpm -s ([\w:.-]+)$", cmd)
            if m:
                self.assertIn(m.group(1), pkg, f"{cmd}: package.json に無い")
            self.assertRegex(cmd, r"^(python3|node|pnpm) ", cmd)

    def test_K376_GL_014_registries(self) -> None:
        import ci_scope  # noqa: E402
        import cut_check  # noqa: E402
        full_ci = json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["full"]["ci"]
        base_ci = json.loads((ROOT / "scripts/ci/ci_scope.d/_base.json").read_text(encoding="utf-8"))["full"]["ci"]
        for d in ("scripts/ci/g65.d/**", "scripts/ci/g47.d/**"):
            self.assertIn(d, full_ci)
            self.assertIn(d, base_ci)
        for f in ("05_flow/build_testplan.py", "scripts/ci/gate_cmds.py"):
            self.assertIn(f, full_ci, "作り手と作り手が読む部品は CI の定義の作り手の扱い")
            self.assertIn(f, base_ci)
        for f in ("scripts/ci/g65.d/K-1.txt", "scripts/ci/g47.d/_base.txt"):
            self.assertTrue(ci_scope.match(f, full_ci), f)
            self.assertTrue(cut_check._common(f), f)
        for d in (G65_DIR, G47_DIR):
            head = "\n".join((d / "README.md").read_text(encoding="utf-8").splitlines()[:3])
            for word in ("生成物", "手で直さない", "から生成"):
                self.assertNotIn(word, head, f"{d}/README.md の先頭 3 行に {word}（generated_gate の F3 に当たる）")


if __name__ == "__main__":
    unittest.main(verbosity=2)

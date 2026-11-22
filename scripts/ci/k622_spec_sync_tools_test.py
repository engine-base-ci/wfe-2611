#!/usr/bin/env python3
"""K-622 の試験：spec-sync の監査を、リポジトリの写し（scripts/spec-sync）だけで全段そろえて回せる形にする。

  python3 scripts/ci/k622_spec_sync_tools_test.py      行 ID は K622-TOOL-NNN（11_tickets/K-622.md の行の表と 1 対 1）

決まり：
  ・scripts/spec-sync/audit-manifest.yaml が名指しする「script の段」（D・G・H・T・P・L）の実体は、
    リポジトリの中（scripts/spec-sync か prefer_project）に在る。組織のスキルの置き場を読まない
    （読むと、Kaname の書き方を直した写しの D・G・H が使われず、偽の赤が出る・2026-11-21 の実測）
  ・P（プロジェクト全体の棚卸し）の project_audit.py も写して持つ（無いと「実在しない」で赤）
  ・写しの理由と回し方は scripts/spec-sync/README.md の表に書く
テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SYNC = ROOT / "scripts" / "spec-sync"
MANIFEST = SYNC / "audit-manifest.yaml"
AUDIT = SYNC / "project_audit.py"
P_KEYS = ("P1_map_holes", "P2_no_check", "P3_stale", "P4_ghosts", "P5_sources_without_check",
          "unregistered_decisions", "P6_not_started", "P7_duplicate_keys", "status")


def tiers() -> list[dict]:
    return yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))["tiers"]


class SpecSyncToolsTest(unittest.TestCase):
    def test_K622_TOOL_001_every_script_tier_has_its_script_inside_the_repo(self) -> None:
        missing = []
        for t in tiers():
            if t.get("kind") != "script":
                continue
            here = (SYNC / t["script"]).is_file()
            prefer = t.get("prefer_project") and (ROOT / t["prefer_project"]).is_file()
            if not (here or prefer):
                missing.append(f"{t['id']}:{t['script']}")
        self.assertEqual(missing, [], f"リポジトリの中に実体が無い段: {missing}")

    def test_K622_TOOL_002_project_audit_copy_exists_and_runs_on_the_real_tree(self) -> None:
        self.assertTrue(AUDIT.is_file(), "scripts/spec-sync/project_audit.py が無い")
        r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(ROOT), "--json"],
                           capture_output=True, text=True, cwd=ROOT)
        self.assertIn(r.returncode, (0, 2), r.stderr[-400:])  # 0=緑・2=穴あり。1 や例外では落ちない
        out = json.loads(r.stdout)
        for k in P_KEYS:
            self.assertIn(k, out)

    def test_K622_TOOL_003_readme_table_names_project_audit_and_the_reason(self) -> None:
        text = (SYNC / "README.md").read_text(encoding="utf-8")
        self.assertIn("project_audit.py", text)
        self.assertIn("--tier", text)
        self.assertRegex(text, r"project_audit\.py[^\n]*\|")  # 表の行として在る

    def test_K622_TOOL_004_missing_map_is_reported_not_crashed(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run([sys.executable, str(AUDIT), "--project-root", d, "--json"],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 2)
            self.assertIn("依存マップ", r.stdout)
            self.assertNotIn("Traceback", r.stderr)

    def test_K622_TOOL_005_japanese_named_files_are_read(self) -> None:
        # 本物の木の決定ログ（日本語の名前）を P が正本として読み、決定を数えている（TP-TOOL-01）
        r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(ROOT), "--json"],
                           capture_output=True, text=True, cwd=ROOT)
        out = json.loads(r.stdout)
        self.assertIn("01_hearing/決定ログ_進行中.md", out["sources"])
        self.assertGreater(out["decisions"], 100)

    def test_K622_TOOL_006_all_tiers_of_the_validator_are_in_the_manifest(self) -> None:
        ids = [t["id"] for t in tiers()]
        for need in ("A", "B", "C", "D", "F", "G", "H", "T", "P", "L"):
            self.assertIn(need, ids, f"段 {need} が audit-manifest.yaml に無い")

    def test_K622_TOOL_007_g65_place_holds_this_test_exactly_once(self) -> None:
        hits = [p for p in (ROOT / "scripts/ci/g65.d").glob("*.txt")
                if "k622_spec_sync_tools_test.py" in p.read_text(encoding="utf-8")]
        self.assertEqual([p.name for p in hits], ["K-622.txt"])


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""K-330 が運ぶ切る段の検査の口（scripts/ci/cut_check.py）の試験。scope と prior は DB も部品も使わない。
smoke は本物の DB を作るので、ここでは試験の無い入力（vitest の試験が無い）の形だけを見る。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOOL = ROOT / "scripts" / "ci" / "cut_check.py"


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(TOOL), *args], cwd=ROOT, capture_output=True, text=True, timeout=300)


class CutCheckTest(unittest.TestCase):
    def test_K330_CC_001_scope_db_and_packages(self) -> None:
        """migration と口のコードを changes: にすると、affects に @kaname/api と @kaname/db、ci_wide に db が出る"""
        r = run("scope", "--ticket", "K-330", "--files", "packages/db/migrations/9999_x.sql", "packages/db/src/index.ts", "apps/api/src/server.ts")
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads(r.stdout)
        self.assertIn("@kaname/api", got["affects"])
        self.assertIn("@kaname/db", got["affects"])
        self.assertIn("db", got["ci_wide"])
        self.assertEqual(got["unmapped"], [])

    def test_K330_CC_002_scope_web_only(self) -> None:
        """画面のファイルだけなら affects は @kaname/web だけで ci_wide は空"""
        r = run("scope", "--ticket", "K-330", "--files", "apps/web/features/F2/invite/views.tsx")
        got = json.loads(r.stdout)
        self.assertEqual(got["affects"], ["@kaname/web"])
        self.assertEqual(got["ci_wide"], [])

    def test_K330_CC_003_prior_direct_import(self) -> None:
        """prior は、そのファイルを直に import している試験を出す（auth.ts の口の hooks を読む試験は出し、無関係の試験は出さない）"""
        r = run("prior", "--files", "packages/auth/src/invitations.ts")
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads(r.stdout)
        self.assertIn("packages/auth/test/flows.test.ts", got)
        self.assertNotIn("apps/bridge/test/guard.test.ts", got)

    def test_K330_CC_004_prior_text_reference(self) -> None:
        """prior は、道を文字で書いている試験も出す（台帳 class_ledger.json を読む試験）"""
        got = json.loads(run("prior", "--files", "scripts/ci/class_ledger.json").stdout)
        self.assertIn("scripts/ci/k214_class_gate_test.py", got)

    def test_K330_CC_012_prior_skips_common_entries(self) -> None:
        """ほぼ全部の試験が読む共通の入口（口の入口・fuzz の的・範囲の地図・エラーの一覧・画面と口の表）と
        パッケージの束ね口（packages/<名>/src/index.ts）は探す元から外し、外したことを標準エラーに出す（PM 2026-11-18・行き過ぎを止める）"""
        common = ["apps/api/src/server.ts", "apps/api/src/app.ts", "apps/api/test/fuzz/server.ts", "scripts/ci/ci_scope.json",
                  "07_qa/test-specs/errors.json", "05_flow/screen_api.py", "packages/auth/src/index.ts"]
        r = run("prior", "--files", *common)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout), [])
        self.assertIn("共通の入口", r.stderr)
        for f in common:
            self.assertIn(f, r.stderr)
        # 共通の入口と一緒に渡しても、ほかのファイルを使う試験は今までどおり出る
        got = json.loads(run("prior", "--files", *common, "packages/auth/src/invitations.ts").stdout)
        self.assertIn("packages/auth/test/flows.test.ts", got)
        self.assertNotIn("apps/api/test/auth_routes.test.ts", got)

    def test_K330_CC_006_prior_japanese_test_name(self) -> None:
        """試験のファイルの名前が日本語でも読み落とさない（git ls-files を -z で読む・TP-TOOL-01）。
        一時の git の木に日本語の名前の試験を置き、その木で prior を流す（-z を外すと名前が "\\346…" に化けて出なくなる）"""
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "src").mkdir()
            (root / "src" / "target.txt").write_text("x\n", encoding="utf-8")
            (root / "試験").mkdir()
            (root / "試験" / "日本語_test.py").write_text("# src/target.txt を読む\n", encoding="utf-8")
            subprocess.run(["git", "add", "-A"], cwd=root, check=True)
            r = subprocess.run([sys.executable, str(TOOL), "prior", "--files", "src/target.txt"], cwd=root,
                               capture_output=True, text=True, timeout=120)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads(r.stdout), ["試験/日本語_test.py"])

    def test_K330_CC_008_prior_folder_is_opened(self) -> None:
        """changes: のフォルダは中のファイルに開いて照らす（黙って捨てない）：07_functional/段2-F1/ を渡すと k300 の試験が出る"""
        got = json.loads(run("prior", "--files", "07_functional/段2-F1/").stdout)
        self.assertIn("apps/web/tests/k/k300-stage2-mock.spec.ts", got)

    def test_K330_CC_009_prior_package_relative_path(self) -> None:
        """試験がパッケージの根からの道（join(WEB, "features/…")）で書く物も拾う：段 3 の部品 views.tsx を渡すと k330 の画面の試験が出る"""
        got = json.loads(run("prior", "--files", "apps/web/features/F2/invite/views.tsx").stdout)
        self.assertIn("apps/web/tests/k/k330-stage3-mock.spec.ts", got)

    def test_K330_CC_010_prior_mjs_test(self) -> None:
        """.test.mjs の試験も候補に入る：scripts/ci/fidelity_compare.mjs を渡すと k216_fidelity_compare.test.mjs が出る"""
        got = json.loads(run("prior", "--files", "scripts/ci/fidelity_compare.mjs").stdout)
        self.assertIn("scripts/ci/k216_fidelity_compare.test.mjs", got)

    def test_K330_CC_011_prior_reports_missing(self) -> None:
        """まだ無いファイルは照らさないことを標準エラーに出す（黙って外さない）"""
        r = run("prior", "--files", "zz_not_there_k330.ts")
        self.assertEqual(json.loads(r.stdout), [])
        self.assertIn("zz_not_there_k330.ts", r.stderr)

    def test_K330_CC_007_scope_unmapped_is_reported(self) -> None:
        """どの地図にも当たらない道は unmapped に出す（黙って範囲の外にしない・TP-TOOL-02）"""
        got = json.loads(run("scope", "--ticket", "K-330", "--files", "zz_not_mapped_k330/x.txt").stdout)
        self.assertEqual(got["unmapped"], ["zz_not_mapped_k330/x.txt"])

    def test_K330_CC_005_smoke_without_vitest_tests(self) -> None:
        """vitest の試験が無い（画面の試験だけ）なら DB を作らずに空の JUnit を出して 0 で終わる"""
        with tempfile.TemporaryDirectory() as d:
            out = pathlib.Path(d) / "j.xml"
            r = run("smoke", "--junit", str(out), "--tests", "apps/web/tests/k/k330-stage3-mock.spec.ts")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('tests="0"', out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)

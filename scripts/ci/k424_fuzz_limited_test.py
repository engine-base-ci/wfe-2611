#!/usr/bin/env python3
"""K-424 の試験：契約 fuzz（G36）で、入口の上限（429・RATE_LIMITED）に当たった回を数えて赤にする（scripts/ci/fuzz_limited.py）と、fuzz.sh のつなぎ。

  python3 scripts/ci/k424_fuzz_limited_test.py      行 ID は K424-CI-NNN（11_tickets/K-424.md の行の表と 1 対 1）

的（apps/api/test/fuzz/server.ts）は、入口が上限で断った要求を 1 行（「方法 道」）ずつ FUZZ_LIMITED の置き場に足す（K424-FZ-007）。
fuzz_limited.py はその記録を読み、0 回なら緑、1 回でもあれば道ごとの回数を出して exit 1。作りものの記録は tempfile の中に作る。
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile
import json
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TOOL = HERE / "fuzz_limited.py"
FUZZ_SH = HERE / "fuzz.sh"
sys.path.insert(0, str(HERE))
import ci_scope  # noqa: E402


def run(log: pathlib.Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(TOOL), str(log)], capture_output=True, text=True, timeout=30)


class FuzzLimitedTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_K424_CI_001_missing_log_is_zero(self):
        """K424-CI-001 記録のファイルが無い（入口の 429 が 1 回も無かった）ときは 0 回と出して exit 0"""
        r = run(self.dir / "limited.log")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("[G36] 入口の上限（429 RATE_LIMITED）は 0 回", r.stdout)

    def test_K424_CI_002_empty_or_blank_log_is_zero(self):
        """K424-CI-002 空の記録・空の行と空白だけの記録も 0 回で exit 0"""
        for body in ("", "\n\n", "  \n\t\n"):
            log = self.dir / "limited.log"
            log.write_text(body, encoding="utf-8")
            r = run(log)
            self.assertEqual(r.returncode, 0, f"{body!r}: {r.stdout}{r.stderr}")
            self.assertIn("は 0 回", r.stdout)

    def test_K424_CI_003_hits_are_named_and_fail(self):
        """K424-CI-003 1 回でもあれば、合計と道ごとの回数（多い順・同じ数は道の名前の順）を出して exit 1。行の前後の空白は数えない"""
        log = self.dir / "limited.log"
        log.write_text(
            "POST /api/v1/credentials\nGET /api/v1/b\n POST /api/v1/credentials \nPOST /api/v1/credentials\nGET /api/v1/a\n\n",
            encoding="utf-8",
        )
        r = run(log)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        out = r.stdout + r.stderr
        self.assertIn("[G36] 入口の上限（429 RATE_LIMITED）に 5 回当たった", out)
        lines = [l.strip() for l in out.splitlines() if "×" in l]
        self.assertEqual(lines, ["POST /api/v1/credentials ×3", "GET /api/v1/a ×1", "GET /api/v1/b ×1"])

    def test_K424_CI_004_fuzz_sh_passes_log_to_target_and_checks_after_run(self):
        """K424-CI-004 fuzz.sh は的を立てる行で FUZZ_LIMITED を渡し、schemathesis を流した後に同じ記録を fuzz_limited.py で数える"""
        sh = FUZZ_SH.read_text(encoding="utf-8")
        server_line = next((l for l in sh.splitlines() if "apps/api/test/fuzz/server.ts" in l and l.rstrip().endswith("&")), "")
        self.assertIn('FUZZ_LIMITED="$TMP/limited.log"', server_line, "的を立てる行に FUZZ_LIMITED が無い")
        i_st = sh.find('"$ST" --config-file')
        i_check = sh.find('python3 scripts/ci/fuzz_limited.py "$TMP/limited.log"')
        self.assertGreaterEqual(i_st, 0, "schemathesis を流す行が無い")
        self.assertGreater(i_check, i_st, "schemathesis の後に fuzz_limited.py を流していない")

    def test_K424_CI_005_fuzz_sh_reports_both_and_fails_on_either(self):
        """K424-CI-005 schemathesis が赤でも数える行まで進み、どちらかが赤なら fuzz.sh は 0 以外で終わる（rc を持ち回る形）"""
        lines = [l.strip() for l in FUZZ_SH.read_text(encoding="utf-8").splitlines() if l.strip() and not l.strip().startswith("#")]
        st_i = next(i for i, l in enumerate(lines) if l.startswith('"$ST" --config-file') or "--seed 20261103" in l)
        # 続きの行（\ で終わる行）をつないで 1 つの命令として見る
        cmd, j = lines[st_i], st_i
        while cmd.endswith("\\"):
            j += 1
            cmd = cmd[:-1] + " " + lines[j]
        self.assertIn("rc=0", lines[:st_i], "schemathesis の前に rc=0 が無い")
        self.assertRegex(cmd, r"\|\|\s*rc=\$\?\s*$", "schemathesis の赤で止まらずに rc に持つ形でない")
        self.assertIn('python3 scripts/ci/fuzz_limited.py "$TMP/limited.log" || rc=1', lines[j + 1 :])
        self.assertEqual(lines[-1], 'exit "$rc"')

    def test_K424_CI_006_wired_into_g65(self):
        """K424-CI-006 この試験は CI の G65 の置き場（g65.d/K-424.txt）から流れる"""
        p = ROOT / "scripts" / "ci" / "g65.d" / "K-424.txt"
        self.assertTrue(p.is_file(), "g65.d/K-424.txt が無い")
        cmds = [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
        self.assertIn("python3 scripts/ci/k424_fuzz_limited_test.py", cmds)
        self.assertTrue(all(re.match(r"^python3 scripts/ci/\S+\.py$", c) for c in cmds), cmds)

    def test_K424_CI_007_fuzz_files_wake_g36_and_database_job(self):
        """K424-CI-007 的・fuzz.sh・数える道具を変えた回は、チケットの CI でも G36 と database の組が起きる（範囲の地図）"""
        rules = json.loads((HERE / "ci_scope.json").read_text(encoding="utf-8"))
        fuzz_files = ["scripts/ci/fuzz.sh", "scripts/ci/fuzz_limited.py", "scripts/ci/fuzz_targets.py",
                      "apps/api/test/fuzz/server.ts", "apps/api/test/fuzz/limits.ts"]
        for f in fuzz_files:
            self.assertIn("36", ci_scope.gates_for([f], rules, full=False), f"{f} を変えても G36 が流れない")
        db_paths = rules["jobs"]["database"]["paths"]
        for f in fuzz_files[:3]:   # apps/api/test は @kaname/api の中なので packages で組が起きる
            self.assertTrue(ci_scope.match(f, db_paths), f"{f} を変えても database の組が起きない")
        self.assertNotIn("36", ci_scope.gates_for(["apps/web/README.md"], rules, full=False))


if __name__ == "__main__":
    unittest.main()

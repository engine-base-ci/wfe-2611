#!/usr/bin/env python3
"""K-327 の試験：migration の一覧（packages/db/src/migrations.generated.ts）の作り手と、それを読む地図・設定。

  python3 scripts/ci/k327_migrations_gen_test.py      行 ID は K327-GEN-NNN（チケット 11_tickets/K-327.md の表の行と 1 対 1）
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
GEN = ROOT / "scripts" / "ci" / "gen_migrations.py"
OUT = "packages/db/src/migrations.generated.ts"


class Tree(unittest.TestCase):
    def setUp(self) -> None:
        self._t = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._t.name)
        self.mig = self.root / "packages/db/migrations"
        self.mig.mkdir(parents=True)
        (self.root / "packages/db/src").mkdir(parents=True)

    def tearDown(self) -> None:
        self._t.cleanup()

    def gen(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run([sys.executable, str(GEN), "--root", str(self.root)], capture_output=True, text=True)

    def test_K327_GEN_002_names_in_order(self) -> None:
        for n in ("20261119010000_c.sql", "0002_b.sql", "0001_a.sql"):
            (self.mig / n).write_text("select 1;", encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        out = (self.root / OUT).read_text(encoding="utf-8")
        self.assertIn("手で直さない", out.splitlines()[0])
        self.assertEqual(re.findall(r'"([^"]+\.sql)"', out), ["0001_a.sql", "0002_b.sql", "20261119010000_c.sql"])

    def test_K327_GEN_003_bad_name_stops(self) -> None:
        (self.mig / "0001_a.sql").write_text("select 1;", encoding="utf-8")
        (self.mig / "bad name.sql").write_text("select 1;", encoding="utf-8")
        r = self.gen()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("bad name.sql", (r.stdout + r.stderr).strip().splitlines()[-1])
        self.assertFalse((self.root / OUT).exists())


class Repo(unittest.TestCase):
    def test_K327_GEN_001_generated_matches(self) -> None:
        r = subprocess.run([sys.executable, str(GEN), "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K327_GEN_004_scope_map_reads_both_names(self) -> None:
        ml = json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["db"]["migration_list"]
        self.assertEqual(ml["file"], OUT)
        rx = re.compile(ml["entry"])
        self.assertEqual(rx.match('    "0001_foundation.sql",').group(1), "0001_foundation.sql")
        self.assertEqual(rx.match('    "20261119010000_x.sql",').group(1), "20261119010000_x.sql")

    def test_K327_GEN_005_registered(self) -> None:
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        mine = [g for g in gen["generators"] if "gen_migrations.py" in g["run"]]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["outputs"], [OUT])
        flow = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        self.assertIn(OUT, flow["changes_ignore"])
        team = yaml.safe_load((ROOT / "ai-team.yaml").read_text(encoding="utf-8"))
        self.assertIn(OUT, team["lock_exempt"])
        self.assertNotIn("packages/db/src/index.ts", team["lock_exempt"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

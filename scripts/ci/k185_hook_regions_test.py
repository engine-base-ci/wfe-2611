#!/usr/bin/env python3
"""K-185 の試験：契約の形の検査（scripts/ci/contract_shape_test.py）が、作った口を拾い漏らさない。

  python3 scripts/ci/k185_hook_regions_test.py

行 ID は K185-CS-NNN（11_tickets/K-185.md の表と 1 対 1）。
拾い漏れの形（2026-11-13・K-163 の切り直しで見つけた）：apps/api/src/hooks/approve-complete.ts は口を `{ ...h["getApproval"] }` で並べ、
中身は機能のフォルダ（apps/api/src/features/F5/approve-complete/decide.ts・queue.ts）に 1 行の形 `approveApproval: { before: (a) => … },` で書く。
hook_blocks は `    opName: {` で行が終わる形（複数行）しか口の頭として読まないので、1 行の形の中身が見つからず、口ごと拾われない。
"""
from __future__ import annotations

import pathlib
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import contract_shape_test as cs  # noqa: E402

HOOKS = '''import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { thingHooks as make } from "../features/thing/index.js";

export function thingHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = make(appPool);
  return {
%s
  };
}
'''
FEATURE = '''import type pg from "pg";
import type { Hook, HookArgs } from "../../contract/deps.js";

async function read(pool: pg.Pool, a: HookArgs) {
  if (!a) return fail(404, "見つかりません");
  return { status: 200, body: { data: {} } };
}

export function thingHooks(pool: pg.Pool): Record<string, Hook> {
  return {
%s
  };
}
'''


def regions_in(hooks_lines: list[str], feature_lines: list[str]) -> dict:
    """一時のフォルダに hooks と機能のファイルを置き、そこを hooks の置き場として hook_regions を呼ぶ"""
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "hooks").mkdir()
        (root / "features/thing").mkdir(parents=True)
        (root / "hooks/thing.ts").write_text(HOOKS % "\n".join(hooks_lines), encoding="utf-8")
        (root / "features/thing/index.ts").write_text(FEATURE % "\n".join(feature_lines), encoding="utf-8")
        old = cs.HOOKS_DIR
        cs.HOOKS_DIR = root / "hooks"
        try:
            return cs.hook_regions()
        finally:
            cs.HOOKS_DIR = old


def run_shape(name: str) -> unittest.TestResult:
    r = unittest.TestResult()
    cs.ContractShapeTest(name).run(r)
    return r


class HookRegions(unittest.TestCase):
    def test_K185_CS_001_spread_hooks_with_one_line_bodies_are_picked(self) -> None:
        """hooks のファイルが口を `{ ...h["op"] }` で並べ、中身が機能のファイルに 1 行の形で書いてあっても、その口を拾い、中身（呼ぶ関数）も辿る"""
        got = regions_in(
            ['    getThing: { ...h["getThing"] },', '    putThing: { ...h["putThing"] },'],
            ["    getThing: { before: (a: HookArgs) => read(pool, a) },",
             "    putThing: {",
             "      before: (a: HookArgs) => read(pool, a),",
             "    },"],
        )
        self.assertEqual(sorted(got), ["getThing", "putThing"], "1 行の形の口（getThing）を拾えていない")
        block, defs = got["getThing"]
        self.assertIn("read(pool, a)", block, "1 行の形の中身を読めていない")
        self.assertIn(404, cs.statuses_in(block, {}, defs), "中身から呼ぶ関数（read の 404）を辿れていない")
        # 今の木：承認して完了する（K-63 の孫）の口が全部拾われる
        real = cs.hook_regions()
        for op in ("listApprovalQueue", "getApproval", "approveApproval"):
            self.assertIn(op, real, f"{op} を拾えていない（apps/api/src/hooks/approve-complete.ts）")
            self.assertTrue(real[op][0].strip(), f"{op} の中身が空")

    def test_K185_CS_002_picked_ops_with_uuid_path_have_entrance_rows(self) -> None:
        """拾われるようになった口（getApproval・approveApproval の :id）の入口の 422 の行が UUID_PARAM_CASES にあり、SHAPE_017 が緑"""
        src = (cs.ROOT / "apps/api/test/features/contract/k144-contract.test.ts").read_text(encoding="utf-8")
        for op in ("getApproval", "approveApproval"):
            self.assertRegex(src, r'\["K144-API-\d{3}",\s*"%s",\s*"path",\s*"id"\]' % op, f"{op} の入口の id の行が無い")
        r = run_shape("test_K144_SHAPE_017_every_built_op_has_an_entrance_uuid_row")
        self.assertTrue(r.wasSuccessful(), "SHAPE_017 が赤：" + " / ".join(str(x[1])[-400:] for x in r.failures + r.errors))

    def test_K185_CS_003_listed_op_that_cannot_be_read_is_red(self) -> None:
        """hooks のファイルに並ぶ口なのに中身を読めない（拾い方が壊れた・知らない書き方）なら、黙って外さずに赤（何も見ていないのに緑にしない・TP-TOOL-02）"""
        with self.assertRaises(AssertionError) as e:
            regions_in(
                ['    getThing: { ...h["getThing"] },', '    lostThing: { ...h["lostThing"] },'],
                ["    getThing: { before: (a: HookArgs) => read(pool, a) },",
                 "    lostThing: makeLost(pool),"],
            )
        self.assertIn("lostThing", str(e.exception), "拾えなかった口の名前を出していない")
        with self.assertRaises(AssertionError):   # 1 本も拾えない
            regions_in(['    lostThing: { ...h["lostThing"] },'], ["    lostThing: makeLost(pool),"])

    def test_K185_CS_004_picked_ops_with_body_are_listed_for_required_fields(self) -> None:
        """体を受ける口（approveApproval）が拾われたら、REQUIRED_INPUTS か NO_REQUIRED_INPUTS に載っていて、SHAPE_020 が緑"""
        bodies = cs.ContractShapeTest._bodies()
        self.assertIn("approveApproval", bodies, "approveApproval が体を受けない形になった（この行を見直す）")
        self.assertIn("approveApproval", set(cs.REQUIRED_INPUTS) | set(cs.NO_REQUIRED_INPUTS),
                      "approveApproval が REQUIRED_INPUTS にも NO_REQUIRED_INPUTS にも無い")
        r = run_shape("test_K144_SHAPE_020_required_fields_match_what_the_behaviour_rejects")
        self.assertTrue(r.wasSuccessful(), "SHAPE_020 が赤：" + " / ".join(str(x[1])[-400:] for x in r.failures + r.errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)

#!/usr/bin/env python3
"""K-210 の試験：統合テストを通した後の後始末（配布物の決定の直しと、検査の穴 4 つ）。

  python3 scripts/ci/k210_gate_holes_test.py      全部の行（行 ID は K210-GH-NNN。11_tickets/K-210.md の行の表と 1 対 1）

穴 1：CI の範囲の検査（scripts/ci/ci_scope.py）が、コミットの本文からもチケットの番号を拾う。件名の頭の番号だけを数える（001〜004）
穴 2：試験の置き場（apps/e2e と test・tests の置き場）を製品のコードが import すると、関門と環境の値の検査を回り込める。
      製品のコードが試験の置き場を読んだら赤（scripts/ci/choke.mjs --test-imports・005〜009）
穴 3：生成物が最新かの検査（G38）が、生成物（試験計画の文書など）だけを直した回で流れない。目録の生成物はどれを変えても流れる（010〜012）
穴 4：取り込む順の検査（scripts/ci/ticket_order_gate.py）が、子の一覧を枝の先頭の版からだけ読む。済んでいない子の parent を
      外すと親が満たす。START から枝の中で一度でも載っていた子を数える（013〜015）
配布物の決定の直し（016〜017）と、この試験・検査が CI から回ること（018）

作りもののリポジトリは tempfile の中に作る。git には GIT_ で始まる環境の値を除いて渡す（フックの中で流しても本物に当たらない）。
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import ci_scope  # noqa: E402
import ci_scope_test  # noqa: E402  作りもののワークスペース（Repo）をそのまま使う（同じ物を 2 つ作らない）
import ticket_order_gate  # noqa: E402

WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
CHOKE = ROOT / "scripts" / "ci" / "choke.mjs"
SCOPE_RULES = ROOT / "scripts" / "ci" / "ci_scope.json"
GENERATED = ROOT / "scripts" / "ci" / "generated.json"
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
ANSWERS = ROOT / "01_hearing" / "decider-answers.jsonl"
TICKETS = ROOT / "11_tickets"


def clean_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update({"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"})
    return env


def stop_reasons(p: dict) -> set[str]:
    return {c for c, _ in p["full_reasons"]}


def stopped(p: dict) -> bool:
    return any("全部には倒さず止める" in e for e in p["errors"])


# ---------------------------------------------------------------- 穴 1：件名の頭の番号だけを数える
class ScopeTicketIdsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.r = ci_scope_test.Repo()

    def tearDown(self) -> None:
        self.r.close()

    def test_K210_GH_001_body_number_is_not_counted(self) -> None:
        """K210-GH-001 件名の頭が K-1 のコミットの本文に別の番号（K-2）が在っても、数える番号は K-1 の 1 個で、範囲を決めて続ける"""
        self.r.commit("K-1 feat: x\n\n本文：K-2 の行の書き方にならった。K-3 とも重ならない",
                      apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["tickets"], ["K-1"], "本文の番号を数えた")
        self.assertNotIn("ticket", stop_reasons(p), p["full_reasons"])
        self.assertFalse(stopped(p), p["errors"])
        self.assertEqual(ci_scope.ticket_ids(str(self.r.dir), self.r.base, "HEAD"), ["K-1"])

    def test_K210_GH_002_two_subject_heads_still_stop(self) -> None:
        """K210-GH-002 件名の頭が別の番号（K-1 と K-2）のコミットが混じれば、今までどおり「番号が 2 個」で止める"""
        self.r.commit("K-1 feat: 1", apps__x__src__main_ts="export const x = 5;\n")
        self.r.commit("K-2 feat: 2\n\n本文：K-1 の続き", apps__x__src__main_ts="export const x = 6;\n")
        p = self.r.plan()
        self.assertEqual(sorted(p["tickets"]), ["K-1", "K-2"])
        self.assertIn("ticket", stop_reasons(p))
        self.assertTrue(any("番号が 2 個" in why for c, why in p["full_reasons"] if c == "ticket"), p["full_reasons"])
        self.assertTrue(stopped(p), p["errors"])

    def test_K210_GH_003_number_not_at_subject_head(self) -> None:
        """K210-GH-003 番号が件名の頭に無い（件名の中ほど・本文にだけ在る）コミットは数えない。そのコミットだけなら「番号が 0 個」で止める"""
        self.r.commit("feat: K-1 の続きを直す\n\n本文：K-1", apps__x__src__main_ts="export const x = 5;\n")
        p = self.r.plan()
        self.assertEqual(p["tickets"], [])
        self.assertTrue(any("番号が 0 個" in why for c, why in p["full_reasons"] if c == "ticket"), p["full_reasons"])
        self.assertTrue(stopped(p), p["errors"])
        # 頭に番号のあるコミットが 1 本でも在れば、それだけを数える（件名の中ほどの番号は足さない）
        self.r.commit("K-2 feat: 頭に番号", apps__x__src__main_ts="export const x = 6;\n")
        self.assertEqual(self.r.plan()["tickets"], ["K-2"])

    def test_K210_GH_004_merge_commit_unchanged(self) -> None:
        """K210-GH-004 取り込みのコミット（件名「Merge branch …」・本文に別の番号）は今までどおり番号に数えない。取り込んだ側の件名の頭（K-1）だけを数える"""
        d = self.r.dir
        ci_scope_test.git(d, "checkout", "-q", "-b", "side")
        self.r.commit("K-1 feat: 横の枝", apps__x__src__load_ts="export const l = 1;\n")
        ci_scope_test.git(d, "checkout", "-q", "main")
        self.r.commit("K-1 feat: 縦の枝", apps__x__src__main_ts="export const x = 5;\n")
        ci_scope_test.git(d, "merge", "-q", "--no-ff", "side", "-m", "Merge branch 'side'", "-m", "取り込みの本文：K-2 と K-3 の名")
        p = self.r.plan(tests=["apps/x/test/main.test.ts"])
        self.assertEqual(p["tickets"], ["K-1"])
        self.assertNotIn("ticket", stop_reasons(p), p["full_reasons"])


# ---------------------------------------------------------------- 穴 2：製品のコードが試験の置き場を読んだら赤
NODE_RUN = """
import {{ pathToFileURL }} from "node:url";
const m = await import(pathToFileURL({choke}).href);
if (typeof m.checkTestImports !== "function") {{ console.log(JSON.stringify({{ missing: true }})); process.exit(0); }}
console.log(JSON.stringify({{ v: m.checkTestImports({root}) }}));
"""


def node_check(root: pathlib.Path) -> dict:
    code = NODE_RUN.format(choke=json.dumps(str(CHOKE)), root=json.dumps(str(root)))
    r = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True, env=clean_env())
    if r.returncode != 0:
        raise AssertionError(f"node が落ちた: {r.stderr[-800:]}")
    return json.loads(r.stdout.strip().splitlines()[-1])


def where(violations: list[str]) -> set[tuple[str, int]]:
    out = set()
    for v in violations:
        m = re.match(r"^(\S+?):(\d+) ", v)
        if m:
            out.add((m.group(1), int(m.group(2))))
    return out


class TestImportsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.root = pathlib.Path(tempfile.mkdtemp(prefix="k210-imports-"))
        files = {
            # 赤：apps/e2e を相対の道で読む（1 行目）
            "packages/bad/src/a.ts": 'import { u } from "../../../apps/e2e/staging/_lib/site";\nexport const a = u;\n',
            # 赤：@kaname/e2e を export from・動的 import・require で読む（1〜3 行目）
            "packages/bad/src/b.ts": 'export * from "@kaname/e2e";\nexport const s = await import("@kaname/e2e/staging/_lib/steps");\nexport const r = require("@kaname/e2e");\n',
            # 赤：test・tests の置き場を相対の道で読む（1・2 行目）
            "apps/w/src/c.ts": 'import { h } from "../tests/helpers";\nimport { g } from "../test/fixture";\nexport const c = [h, g];\n',
            # 赤：画面の別名 @/ で tests の置き場を読む（1 行目・apps/web の @/ は apps/web/ の下）
            "apps/web/app/page.tsx": 'import { s } from "@/tests/screens/x";\nexport default function P() { return s; }\n',
            # 赤：ワークスペースの部品の中の test の置き場を読む（1 行目）
            "packages/bad/src/d.ts": 'import { f } from "@kaname/db/test/fixtures";\nexport const d = f;\n',
            # 緑：名前が似ているだけ・部品の名前に test を含むだけ・型だけの import
            "apps/w/src/ok.ts": ('import { test } from "@playwright/test";\nimport { y } from "../../e2e-x/src/y";\n'
                                 'import { z } from "@kaname/e2e-x";\nimport { t } from "./testing-utils";\n'
                                 'import { q } from "../contest/q";\nimport type { T } from "@kaname/e2e";\nexport const ok = [test, y, z, t, q];\n'),
            # 緑：試験の置き場の中どうし・試験のファイルが試験の置き場を読む
            "apps/e2e/staging/_lib/steps.ts": 'import { u } from "./site";\nexport const s = u;\n',
            "apps/e2e/staging/k1.spec.ts": 'import { s } from "./_lib/steps";\nexport const k = s;\n',
            "apps/w/test/t.test.ts": 'import { u } from "../../e2e/staging/_lib/site";\nexport const t = u;\n',
            "apps/web/tests/screens/x.ts": 'import { u } from "../../../e2e/staging/_lib/site";\nexport const s = u;\n',
        }
        for rel, text in files.items():
            p = cls.root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, encoding="utf-8")
        cls.res = node_check(cls.root)

    @classmethod
    def tearDownClass(cls) -> None:
        shutil.rmtree(cls.root, ignore_errors=True)

    def got(self) -> set[tuple[str, int]]:
        self.assertNotIn("missing", self.res, "choke.mjs に checkTestImports が無い")
        return where(self.res["v"])

    def test_K210_GH_005_relative_path_into_e2e(self) -> None:
        """K210-GH-005 apps/e2e の外の製品のファイルが apps/e2e の下を相対の道で読むと、そのファイルと行で赤"""
        self.assertIn(("packages/bad/src/a.ts", 1), self.got())

    def test_K210_GH_006_package_name_e2e(self) -> None:
        """K210-GH-006 @kaname/e2e（とその下の道）を export from・動的 import・require のどれで読んでも赤"""
        got = self.got()
        for line in (1, 2, 3):
            self.assertIn(("packages/bad/src/b.ts", line), got)

    def test_K210_GH_007_test_dirs_too(self) -> None:
        """K210-GH-007 test・tests の置き場（相対の道・画面の別名 @/・部品の中の test）を製品のファイルが読んでも赤"""
        got = self.got()
        for hit in (("apps/w/src/c.ts", 1), ("apps/w/src/c.ts", 2), ("apps/web/app/page.tsx", 1), ("packages/bad/src/d.ts", 1)):
            self.assertIn(hit, got)

    def test_K210_GH_008_no_false_alarm(self) -> None:
        """K210-GH-008 赤はちょうど 8 か所。名前が似ているだけ（@playwright/test・apps/e2e-x・@kaname/e2e-x・testing-utils・contest）・型だけの import・
        試験の置き場の中どうし・試験のファイルは赤にしない"""
        got = self.got()
        self.assertEqual(len(got), 8, self.res)
        self.assertFalse({f for f, _ in got} & {"apps/w/src/ok.ts", "apps/e2e/staging/_lib/steps.ts", "apps/e2e/staging/k1.spec.ts",
                                                 "apps/w/test/t.test.ts", "apps/web/tests/screens/x.ts"}, got)

    def test_K210_GH_009_real_repo_and_design(self) -> None:
        """K210-GH-009 本物のリポジトリで `node scripts/ci/choke.mjs --test-imports` が 0 件で終わりの値 0。赤の作りものでは終わりの値 1。
        設計（03_architecture/choke-points.json の scope_exclude）が試験の置き場を apps/e2e/** で書く（e2e/** の書き方は残さない）"""
        r = subprocess.run(["node", str(CHOKE), "--test-imports"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, r"試験の置き場を製品が読む[^\n]*0 件")
        bad = subprocess.run(["node", str(CHOKE), "--test-imports"], cwd=self.root, capture_output=True, text=True, env=clean_env())
        self.assertEqual(bad.returncode, 1, bad.stdout + bad.stderr)
        self.assertIn("packages/bad/src/a.ts:1", bad.stdout)
        excl = json.loads((ROOT / "03_architecture" / "choke-points.json").read_text(encoding="utf-8"))
        found = [v for v in _walk_values(excl, "scope_exclude")]
        self.assertTrue(found, "scope_exclude が無い")
        for globs in found:
            self.assertIn("apps/e2e/**", globs)
            self.assertNotIn("e2e/**", globs)


def _walk_values(node, key: str):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == key:
                yield v
            else:
                yield from _walk_values(v, key)
    elif isinstance(node, list):
        for v in node:
            yield from _walk_values(v, key)


# ---------------------------------------------------------------- 穴 3：目録の生成物はどれを変えても G38 が流れる
def sample(glob: str) -> str:
    return glob.replace("**", "x/y").replace("*", "x")


class GeneratedGateScopeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rules = ci_scope.load_rules(str(SCOPE_RULES))

    def test_K210_GH_010_test_plan_doc_runs_g38(self) -> None:
        """K210-GH-010 試験計画の文書（07_qa/test-plan/test-plan.md）だけを変えた回で、重い検査の G38 が流れる"""
        for f in ("07_qa/test-plan/test-plan.md", "07_qa/test-plan/test-plan.json"):
            self.assertIn("38", ci_scope.gates_for([f], self.rules, False), f)

    def test_K210_GH_011_every_generated_output_runs_g38(self) -> None:
        """K210-GH-011 scripts/ci/generated.json の作り手の outputs（checked_elsewhere を除く）は、どれを 1 つだけ変えても G38 が流れる"""
        gen = json.loads(GENERATED.read_text(encoding="utf-8"))
        outs = sorted({o for g in gen["generators"] for o in g["outputs"]})
        self.assertGreater(len(outs), 10)
        miss = [o for o in outs if "38" not in ci_scope.gates_for([sample(o)], self.rules, False)]
        self.assertEqual(miss, [], "G38 が流れない生成物（ci_scope.json の gates の 38 に glob を足す）")

    def test_K210_GH_012_reads_ok_indent(self) -> None:
        """K210-GH-012 ci_scope.json の reads_ok の項目は、どれも同じ字下げ（2 字）で並ぶ"""
        text = SCOPE_RULES.read_text(encoding="utf-8")
        block = text.split('"reads_ok": {', 1)[1].split("\n }", 1)[0]
        lines = [l for l in block.splitlines() if l.strip()]
        self.assertGreater(len(lines), 5)
        bad = [l[:60] for l in lines if not re.match(r'^  "', l)]
        self.assertEqual(bad, [], "字下げが前後とそろっていない行")


# ---------------------------------------------------------------- 穴 4：外した子も数える
class OrderChildrenTest(unittest.TestCase):
    def setUp(self) -> None:
        self.d = tempfile.mkdtemp(prefix="k210-order-")
        self.run_git("init", "-q", "-b", "main")

    def tearDown(self) -> None:
        shutil.rmtree(self.d, ignore_errors=True)

    def run_git(self, *a: str) -> str:
        return subprocess.run(["git", *a], cwd=self.d, check=True, capture_output=True, text=True, env=clean_env()).stdout.strip()

    def commit(self, msg: str, path: str, text: str) -> None:
        p = os.path.join(self.d, path)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)
        self.run_git("add", "-A")
        self.run_git("commit", "-qm", msg)

    def tickets(self, msg: str, ts: dict[str, dict]) -> None:
        self.commit(msg, "11_tickets/tickets.json", json.dumps({"tickets": [{"id": k, **v} for k, v in ts.items()]}, ensure_ascii=False))

    @staticmethod
    def family(kid21_parent: bool = True) -> dict[str, dict]:
        ts = {"K-20": {"depends_on": [], "stage": "未着手", "assignee": "代表・実装"},
              "K-1": {"depends_on": [], "stage": "未着手", "assignee": "実装", "parent": "K-20"},
              "K-21": {"depends_on": [], "stage": "未着手", "assignee": "実装", "parent": "K-20"},
              "K-5": {"depends_on": ["K-20"], "stage": "未着手", "assignee": "実装"}}
        if not kid21_parent:
            ts["K-21"] = {k: v for k, v in ts["K-21"].items() if k != "parent"}
        return ts

    def test_K210_GH_013_unparented_unfinished_child_still_counts(self) -> None:
        """K210-GH-013 START の版で親（K-20）の子だった K-21（実装なし）の parent を枝で外しても、K-20 に依存する K-5 の実装は赤（子が全部済んだ親にしない）"""
        self.tickets("K-0 docs: 一覧", self.family())
        start = self.run_git("rev-parse", "HEAD")
        self.commit("K-1 feat: 子の実装", "apps/b.ts", "b")
        self.tickets("K-21 docs: 親を外す", self.family(kid21_parent=False))
        self.commit("K-5 feat: 親に依存", "apps/d.ts", "d")
        bad, legacy, _ = ticket_order_gate.check(self.d, "HEAD", start)
        self.assertTrue(any("K-5 は K-20" in b for b in bad), (bad, legacy))
        self.assertNotIn("K-20（K-5 の依存・子が全部済んだ親）", legacy)

    def test_K210_GH_014_child_added_then_removed_in_branch(self) -> None:
        """K210-GH-014 枝の途中で親の子として載せ（K-21）、後で parent を外した子も数える。K-21 が済んでいなければ K-5 の実装は赤"""
        self.tickets("K-0 docs: 一覧", {k: v for k, v in self.family().items() if k != "K-21"})
        start = self.run_git("rev-parse", "HEAD")
        self.tickets("K-21 docs: 子を足す", self.family())
        self.commit("K-1 feat: 子の実装", "apps/b.ts", "b")
        self.tickets("K-21 docs: 親を外す", self.family(kid21_parent=False))
        self.commit("K-5 feat: 親に依存", "apps/d.ts", "d")
        bad, legacy, _ = ticket_order_gate.check(self.d, "HEAD", start)
        self.assertTrue(any("K-5 は K-20" in b for b in bad), (bad, legacy))

    def test_K210_GH_015_finished_children_still_satisfy(self) -> None:
        """K210-GH-015 外した子も含めて子が全部済んでいれば（K-1・K-21 とも実装が祖先に在る）、今までどおり親は満たす（緑・子が全部済んだ親）"""
        self.tickets("K-0 docs: 一覧", self.family())
        start = self.run_git("rev-parse", "HEAD")
        self.commit("K-1 feat: 子の実装", "apps/b.ts", "b")
        self.commit("K-21 feat: もう 1 つの子の実装", "apps/c.ts", "c")
        self.tickets("K-21 docs: 親を外す", self.family(kid21_parent=False))
        self.commit("K-5 feat: 親に依存", "apps/d.ts", "d")
        bad, legacy, _ = ticket_order_gate.check(self.d, "HEAD", start)
        self.assertEqual(bad, [])
        self.assertIn("K-20（K-5 の依存・子が全部済んだ親）", legacy)


# ---------------------------------------------------------------- 配布物の決定の直し
class DistributionDecisionTest(unittest.TestCase):
    def test_K210_GH_016_decision_log_and_answers(self) -> None:
        """K210-GH-016 決定ログの 142 節：D-142.1 は D-142.3 で置き換えたと分かる形（前の文は残す）。D-142.3 は本番の準備で置き場所ごと決める・
        3 本目は準備待ち・段 1 はそのまま閉じる、を答えの番号つきで持つ。答えの記録に 2 つの答えが在る"""
        log = DECISIONS.read_text(encoding="utf-8")
        row1 = next(l for l in log.splitlines() if l.startswith("| D-142.1 |"))
        self.assertIn("superseded：D-142.3", row1)
        self.assertIn("今置く", row1, "前の文は消さない")
        row3 = next(l for l in log.splitlines() if l.startswith("| D-142.3 |"))
        for word in ("本番の準備", "置き場所ごと", "50MB", "準備待ち", "段 1 はそのまま閉じる", "answer=064feb9f2586"):
            self.assertIn(word, row3)
        ids = {json.loads(l)["id"] for l in ANSWERS.read_text(encoding="utf-8").splitlines() if l.strip()}
        self.assertTrue({"4203a52e802b", "064feb9f2586", "bbdf899108b0"} <= ids)

    def test_K210_GH_017_tickets_follow_decision(self) -> None:
        """K210-GH-017 統合テストのチケットが D-142.3 に結び、3 本目を準備待ちとして段 1 を閉じる条件から外す。置き場所を決めるチケット（K-209）が
        本番の準備のまとまりの下に在り、D-142.3 に結ぶ。「別の枝で起票中」の書き方が残らない"""
        k65 = (TICKETS / "K-65.md").read_text(encoding="utf-8")
        head = k65.split("\n---", 1)[0]
        self.assertRegex(head, r"decisions: \[[^\]]*D-142\.3")
        done = k65.split("## 完了の条件", 1)[1].split("\n## ", 1)[0]
        self.assertIn("K65-STG-01・02・04〜07 が全部 pass", done)
        self.assertRegex(done, r"K65-STG-03 は準備待ち（D-142\.3）[^\n]*段 1 を閉じる条件ではない")
        k209 = (TICKETS / "K-209.md").read_text(encoding="utf-8")
        h209 = k209.split("\n---", 1)[0]
        self.assertIn("parent: K-77", h209)
        self.assertRegex(h209, r"decisions: \[[^\]]*D-142\.3")
        self.assertIn("stage: 未着手", h209)
        for name in ("K-65.md", "K-208.md", "K-209.md"):
            self.assertNotIn("別の枝で起票中）で切る", (TICKETS / name).read_text(encoding="utf-8"), name)


# ---------------------------------------------------------------- CI から回る
class WiringTest(unittest.TestCase):
    def test_K210_GH_018_ci_runs_new_checks(self) -> None:
        """K210-GH-018 CI の定義：G65 の並びにこの試験。static の組に `pnpm ci:test-imports`（= choke.mjs --test-imports）の段が、どの回でも流れる形
        （if は無いか !cancelled()・continue-on-error と || true が無い）で在る。package.json に ci:test-imports"""
        jobs = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]
        runs = "\n".join(str(s.get("run", "")) for j in jobs.values() for s in j.get("steps", []))
        self.assertTrue("python3 scripts/ci/k210_gate_holes_test.py" in runs, "G65 の並びにこの試験が無い")
        steps = [s for s in jobs["static"]["steps"] if "ci:test-imports" in str(s.get("run", ""))]
        self.assertEqual(len(steps), 1, "static の組に ci:test-imports の段がちょうど 1 つ")
        step = steps[0]
        self.assertIn(step.get("if"), (None, "${{ !cancelled() }}"))
        self.assertNotIn("continue-on-error", step)
        self.assertNotIn("|| true", step["run"])
        pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(pkg["scripts"].get("ci:test-imports"), "node scripts/ci/choke.mjs --test-imports")


if __name__ == "__main__":
    unittest.main(verbosity=2)

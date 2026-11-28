#!/usr/bin/env python3
"""K-192 の試験：チケットの CI の範囲の台本（scripts/ci/ci_scope.py）が、中間・統合の試験のチケット（kind: QA）の
「依存がそろった」を、実装のコミットで数える（本文や件名に番号が出ただけでは数えない）。行 ID は K192-CS-NNN。
写しのリポジトリと道具は、範囲の台本の試験（ci_scope_test.py・K-107）の物を使う（同じ組み立てを 2 つ持たない）"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ci_scope  # noqa: E402
from ci_scope_test import Repo, git, ticket, write  # noqa: E402

FLOW = "apps/w/test/flow.test.ts"
OWN = "apps/x/test/main.test.ts"


class DepsTest(unittest.TestCase):
    """K-9（QA・depends_on は K-1 と K-5）。範囲のチケットは K-1。K-5 の入り方だけを変える"""

    def setUp(self) -> None:
        self.r = Repo()

    def tearDown(self) -> None:
        self.r.close()

    def qa(self, tests: str | None = f"[{FLOW}]") -> None:
        extra = {"tests": tests} if tests else {}
        write(self.r.dir, "11_tickets/K-9.md", ticket("K-9", [], kind="QA", depends_on="[K-1, K-5]", **extra))
        write(self.r.dir, "11_tickets/K-5.md", ticket("K-5", ["x"]))

    def plan_k1(self) -> dict:
        base = git(self.r.dir, "rev-parse", "HEAD")
        self.r.commit(apps__x__src__main_ts="export const x = 5;\n")   # K-1 feat（範囲のチケット）
        return self.r.plan(base=base, tests=[OWN])

    def test_K192_CS_001_body_mention_is_not_done(self) -> None:
        # 本文に番号が出ただけ：そろっていない。試験の無い QA のチケットでも範囲は決まる（止まらない）
        self.qa(tests=None)
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-0 docs: 中間の試験のチケット\n\nK-5 の準備を待つ（staging をそろえる）")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [])
        self.assertEqual(p["errors"], [])
        self.assertEqual(p["mode"], "scoped", p["reasons"])
        self.assertEqual(p["unit_files"], [OWN])
        self.assertEqual(ci_scope.impl_ids(str(self.r.dir), "HEAD", {"K-5"}), set())

    def test_K192_CS_002_docs_only_commit_is_not_done(self) -> None:
        # 件名がその番号で始まっても、チケットの文書だけを変えたコミットは実装に数えない
        self.qa()
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-5 docs: 見込みと予定日を書く")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [])
        self.assertEqual(p["unit_files"], [OWN])

    def test_K192_CS_003_feat_commit_is_done(self) -> None:
        # 件名がその番号で始まり、実装のファイルを変えたコミットがある：そろった。QA の試験もこの回に流す
        self.qa()
        self.r.commit("K-0 docs: 中間の試験のチケット")
        self.r.commit("K-5 feat: 実装", apps__x__src__main_ts="export const x = 9;\n")
        p = self.plan_k1()
        self.assertEqual(p["integration"], ["K-9"])
        self.assertEqual(p["unit_files"], [FLOW, OWN])
        self.assertEqual(ci_scope.impl_ids(str(self.r.dir), "HEAD", {"K-5", "K-7"}), {"K-5"})

    def test_K192_CS_004_merge_and_second_id_are_not_done(self) -> None:
        # 取り込みのコミット（変えたファイルが無い）と、件名の 2 つ目の番号（ほかのチケットの実装のコミット）は数えない
        self.qa()
        self.r.commit("K-0 docs: 中間の試験のチケット")
        git(self.r.dir, "commit", "-q", "--allow-empty", "-m", "K-5 merge: main を取り込む")
        self.r.commit("K-2 K-5 chore: まとめて直す", apps__x__src__main_ts="export const x = 7;\n")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [])
        self.assertEqual(p["unit_files"], [OWN])

    def test_K192_CS_005_process_config_only_is_not_done(self) -> None:
        # チケットの文書と進め方の設定（ai-team.yaml）だけを変えたコミットは数えない（取り込む順の検査と同じ見方）
        self.qa()
        write(self.r.dir, "ai-team.yaml", "wip: 3\n")
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-5 chore: 段階の範囲に足す")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [])

    def test_K192_CS_006_other_users_of_history_unchanged(self) -> None:
        # 範囲のチケットの番号の取り方（コミットの文の全部から）は変えない：history_ids は本文の番号も返す
        self.qa()
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-0 docs: 中間の試験のチケット\n\nK-5 の準備を待つ")
        self.assertIn("K-5", ci_scope.history_ids(str(self.r.dir), "HEAD"))


    def test_K192_CS_007_test_only_commit_is_done(self) -> None:
        # 試験だけのチケット（中間テストなど）：件名がその番号で始まり、試験のファイルだけを変えたコミットでも、そろった（コミットの種類の語では決めない）
        self.qa()
        self.r.commit("K-0 docs: 中間の試験のチケット")
        write(self.r.dir, "apps/x/test/skeleton.test.ts", "// K-5 の試験\n")
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-5 test: 中間テストを切る")
        p = self.plan_k1()
        self.assertEqual(p["integration"], ["K-9"])
        self.assertIn(FLOW, p["unit_files"])

    def test_K192_CS_008_japanese_named_docs_only_is_not_done(self) -> None:
        # 日本語の名前の文書だけを変えたコミット：名前を引用の形（"\346…"）で読むと文書に見えず、実装に数えてしまう。-z で読む
        self.qa()
        self.r.commit("K-0 docs: 中間の試験のチケット")
        write(self.r.dir, "01_hearing/決定ログ 進行中.md", "決めたこと\n")
        git(self.r.dir, "add", "-A")
        git(self.r.dir, "commit", "-q", "-m", "K-5 docs: 決定ログに足す")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [])
        self.assertEqual(ci_scope.impl_ids(str(self.r.dir), "HEAD", {"K-5"}), set())

    def parent(self, done: list[str]) -> dict:
        """K-5 は自分のコミットを持たない親。子は K-6・K-7（頭の欄 parent が K-5）。done の子だけ実装のコミットを置く"""
        self.qa()
        write(self.r.dir, "11_tickets/K-6.md", ticket("K-6", ["x"], parent="K-5"))
        write(self.r.dir, "11_tickets/K-7.md", ticket("K-7", ["x"], parent="K-5"))
        self.r.commit("K-0 docs: 親と子のチケット")
        for i, k in enumerate(done):
            self.r.commit(f"{k} feat: 子の実装", apps__x__src__main_ts=f"export const x = {20 + i};\n")
        return self.plan_k1()

    def test_K192_CS_009_parent_done_when_all_children_done(self) -> None:
        p = self.parent(["K-6", "K-7"])
        self.assertEqual(p["integration"], ["K-9"])
        self.assertIn(FLOW, p["unit_files"])

    def test_K192_CS_010_parent_not_done_until_last_child(self) -> None:
        p = self.parent(["K-6"])
        self.assertEqual(p["integration"], [])
        self.assertEqual(p["unit_files"], [OWN])

    def test_K192_CS_011_childless_ticket_needs_own_commit(self) -> None:
        # 子が 1 つも無いチケットは自分のコミットで数える（子が無いことを「全部そろった」と読まない）。孫まで分けた親は孫が全部そろってから
        self.qa()
        write(self.r.dir, "11_tickets/K-6.md", ticket("K-6", ["x"], parent="K-5"))
        write(self.r.dir, "11_tickets/K-7.md", ticket("K-7", ["x"], parent="K-6"))   # 孫
        self.r.commit("K-0 docs: 親・子・孫のチケット")
        p = self.plan_k1()
        self.assertEqual(p["integration"], [], "子 K-6 は自分のコミットも、そろった孫も無い")
        self.r.commit("K-7 feat: 孫の実装", apps__x__src__main_ts="export const x = 30;\n")
        p = self.plan_k1()
        self.assertEqual(p["integration"], ["K-9"], "孫がそろえば子がそろい、子がそろえば親がそろう")


if __name__ == "__main__":
    unittest.main(verbosity=2)

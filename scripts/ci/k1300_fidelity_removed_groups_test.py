#!/usr/bin/env python3
"""K-1300 の試験：突き合わせの設定の検査（scripts/ci/fidelity_config.py）に、入れた組を「組ごと・訳つきで外す」記録を足す。

  python3 scripts/ci/k1300_fidelity_removed_groups_test.py      行 ID は K1300-FR-NNN（11_tickets/K-1300.md の行の表と 1 対 1）

設定 04_design/fidelity.json の頭に、組ごと外した記録 "removed_groups" を足す（対を外す "removed"・K-377 とは別の並び）：
  "removed_groups": [{"group": 組の id, "ticket": 外したチケット, "decision": 決定の番号, "why": 訳}]
外せるのは「正の絵がキャンバスから別の物（下絵 v2 など）に替わり、その組をキャンバスと比べなくなった」ときに、外すチケットが
訳と決定の番号を書いたときだけ（PM の決め 2026-11-24・K-442 の案 A）：
  ・ticket の md が在り、頭の欄 decisions: に decision が、changes: に 04_design/fidelity.json が書いてある（その設定を直すチケット）
  ・ticket は今のチケット：md が分かれ目の版に無いか、そこから変わっていて、stage が確認中・完了でない（前に終わったチケットの名を借りて外せない）
  ・記録の在る組は、段 1 の組（--required）に挙がっていても設定に無くてよい
  ・group は分かれ目（--base-ref）の版の設定に在った組で、今の設定には無い（書いただけは赤）
  ・why は空白を除いて 10 字以上・decision は D-<数>（.<数>）の形・知らない欄は書けない・同じ組の記録は 1 つだけ
  ・通るのは、記録に書いた組を「組ごと」消すことだけ。ほかの組を消す・弱める、記録に書いた組を残したまま値や幅を減らす、は今までどおり赤
  ・記録は消せない・書き替えられない（分かれ目に在った記録は今の版にもそのまま在る）
  ・赤から外す力を持つのは、この版で新しく足した記録だけ。前に入った記録は残っていることだけを見て、もう何も通さない
  ・--no-base（分かれ目と比べない回）は記録の形だけを見る
この葉は仕組みだけを持つ。本物の設定から組を実際に外すのは持ち主の葉（K-442：tickets-new・tickets-new-sections／K-571：ticket-detail）。
作りものの設定は tempfile の中の git に作る（土台は K-216 の試験の Fake・group を使う）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import copy
import json
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from k216_fidelity_config_test import Fake, group  # noqa: E402
import fidelity_config  # noqa: E402

CFG = "04_design/fidelity.json"


def ticket_md(tid: str = "K-900", decisions: str = "D-150.35, D-1", changes: str = f"{CFG}, scripts/ci/x.py") -> str:
    return f"---\nid: {tid}\nstage: 作業中\ndecisions: [{decisions}]\nchanges: [{changes}]\n---\n## 目的\n\n組を外す\n"


def entry(**kw) -> dict:
    e = {"group": "g1", "ticket": "K-900", "decision": "D-150.35", "why": "正の絵が下絵 v2 に替わり、キャンバスと比べなくなった"}
    e.update(kw)
    return e


class RemovedGroupsTest(unittest.TestCase):
    """分かれ目：g1・g2（どちらも enrolled・段 1 の組）・g3（入っていない）。外すチケット K-900 の md は分かれ目の後に書く（今のチケット）"""

    def setUp(self) -> None:
        self.f = Fake()
        self.f.git("init", "-q")
        g1 = group("g1", enrolled=True)
        g1["pairs"][0]["props"].append("letter-spacing")   # 種類に要らない値（減らすと弱めない検査だけが赤にする）
        g1["widths"].append(768)
        self.base = [g1, group("g2", enrolled=True), group("g3")]
        self.f.write("11_tickets/K-800.md", ticket_md("K-800", changes=f"{CFG}"))   # 前に終わったチケット（分かれ目に在る）
        self.put(self.base)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "base")
        self.f.write("11_tickets/K-900.md", ticket_md())

    def tearDown(self) -> None:
        self.f.close()

    # ---- 道具
    def without(self, *gids: str) -> list[dict]:
        return [copy.deepcopy(g) for g in self.base if g["id"] not in gids]

    def put(self, groups: list[dict], removed_groups: object = None, removed: object = None) -> None:
        data: dict = {"_doc": "試し", "groups": groups}
        if removed is not None:
            data["removed"] = removed
        if removed_groups is not None:
            data["removed_groups"] = removed_groups
        self.f.write(CFG, json.dumps(data, ensure_ascii=False))

    def run_gate(self, *extra: str):
        return self.f.run(*(extra or ("--base-ref", "HEAD")), required="g1,g2")

    def code(self, groups: list[dict], removed_groups: object = None, *extra: str) -> int:
        self.put(groups, removed_groups)
        r = self.run_gate(*extra)
        self.assertNotIn("Traceback", r.stderr, "検査が例外で落ちた（1 で終わっても、赤と数えない）")
        return r.returncode

    def shape_red(self, groups: list[dict], removed_groups: object, *extra: str) -> None:
        """形の誤りの行：形のほかに赤になる物が無い設定で 1 になり、出力に removed_groups が出る（黙って捨てる実装では 0 になる）"""
        self.put(groups, removed_groups)
        r = self.run_gate(*extra)
        self.assertNotIn("Traceback", r.stderr, "検査が例外で落ちた")
        self.assertEqual(r.returncode, 1, (removed_groups, r.stdout))
        self.assertIn("removed_groups", r.stdout, removed_groups)

    # ---- 行
    def test_K1300_FR_001_removed_group_with_record_passes(self) -> None:
        """K1300-FR-001 入れた段 1 の組 g1 を組ごと消し、記録（組・チケット・決定・訳）を書けば 0（段 1 の組の「無い」も記録で外れる）"""
        self.put(self.without("g1"), [entry()])
        r = self.run_gate()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K1300_FR_002_no_record_is_red(self) -> None:
        """K1300-FR-002 記録を書かずに入れた組を消すと、今までどおり 1（組の id を出し、段 1 の組が無いとも出す）。removed_groups が空の並びでも同じ"""
        for rg in (None, []):
            self.put(self.without("g1"), rg)
            r = self.run_gate()
            self.assertEqual(r.returncode, 1, rg)
            self.assertIn("g1", r.stdout)
            self.assertIn("段 1 の組 g1", r.stdout)

    def test_K1300_FR_003_ticket_must_declare(self) -> None:
        """K1300-FR-003 チケットの md が無い・decisions: にその決定が無い・字の含みだけ（D-150.350）・changes: に設定が無い・
        分かれ目から変わっていない前のチケット（K-800）・stage が確認中か完了なら 1。そろえば 0"""
        cur = self.without("g1")
        self.assertEqual(self.code(cur, [entry(ticket="K-901")]), 1, "md が無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-1"))
        self.assertEqual(self.code(cur, [entry()]), 1, "decisions に無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-150.350, D-1"))
        self.assertEqual(self.code(cur, [entry()]), 1, "字の含みで比べない")
        self.f.write("11_tickets/K-900.md", ticket_md(changes="scripts/ci/x.py"))
        self.assertEqual(self.code(cur, [entry()]), 1, "changes に設定が無い")
        self.assertEqual(self.code(cur, [entry(ticket="K-800")]), 1, "前に終わったチケットの名を借りた（分かれ目から変わっていない）")
        for st in ("確認中", "完了"):
            self.f.write("11_tickets/K-900.md", ticket_md().replace("stage: 作業中", f"stage: {st}"))
            self.assertEqual(self.code(cur, [entry()]), 1, f"stage が {st}")
        self.f.write("11_tickets/K-900.md", ticket_md())
        self.assertEqual(self.code(cur, [entry()]), 0, "そろえば通る")

    def test_K1300_FR_004_entry_shape(self) -> None:
        """K1300-FR-004 記録の形：訳が 10 字未満・空白だけ・決定の形が違う・空・知らない欄・文字でない値・4 つの欄のどれかが欠ける・
        並びでない・要素が入れ物でない、なら、組を消さない設定でも 1 で出力に removed_groups（検査は例外で落ちない）。
        同じ組の記録が 2 つは、g1 を消して 1 つ目の記録が通る設定で 1 で出力に removed_groups"""
        bads: dict[str, object] = {
            "訳が短い": [entry(why="外した")],
            "訳が空白だけ": [entry(why="            ")],
            "決定の形": [entry(decision="決めた")],
            "決定が空": [entry(decision="")],
            "知らない欄": [{**entry(), "pair": "x"}],
            "文字でない": [entry(why=12345678901)],
            "並びでない": {"g1": entry()},
            "要素が文字": ["g1"],
        }
        for k in ("group", "ticket", "decision", "why"):
            e = entry()
            del e[k]
            bads[f"{k} が欠ける"] = [e]
        for why, rg in bads.items():
            dec = "D-150.35"
            if isinstance(rg, list) and rg and isinstance(rg[0], dict) and isinstance(rg[0].get("decision"), str):
                dec = rg[0]["decision"] or "D-150.35"
            self.f.write("11_tickets/K-900.md", ticket_md(decisions=f"{dec}, D-150.35, D-1"))
            self.shape_red(copy.deepcopy(self.base), rg)
        self.f.write("11_tickets/K-900.md", ticket_md())
        self.shape_red(self.without("g1"), [entry(), entry()])

    def test_K1300_FR_005_record_without_removal_is_red(self) -> None:
        """K1300-FR-005 記録に書いた組が今の設定にまだ在る（書いただけ・enrolled を false にしただけ）なら 1"""
        self.assertEqual(self.code(copy.deepcopy(self.base), [entry()]), 1, "書いただけ")
        back = copy.deepcopy(self.base)
        back[0]["enrolled"] = False
        self.assertEqual(self.code(back, [entry()]), 1, "enrolled を戻しただけ")

    def test_K1300_FR_006_unknown_group_is_red(self) -> None:
        """K1300-FR-006 分かれ目の設定に無かった組の記録は 1（g1 の正しい記録と並べても）"""
        self.assertEqual(self.code(self.without("g1"), [entry(), entry(group="g9")]), 1)

    def test_K1300_FR_007_one_record_covers_one_group(self) -> None:
        """K1300-FR-007 1 つの記録が通すのは、その組を組ごと消すことだけ：g1 の記録で g2 も消す・g2 を弱める・
        g1 を残して値や幅を減らすのは 1。g2 の記録も書けば、2 組を消すのは 0。入っていない組 g3 を消すのは記録なしでも今までどおり 0"""
        self.assertEqual(self.code(self.without("g1", "g2"), [entry()]), 1, "g2 の記録が無い")
        self.assertEqual(self.code(self.without("g1", "g2"), [entry(), entry(group="g2")]), 0, "組ごとに書けば通る")
        weak = self.without("g1")
        weak[0]["pairs"][0]["props"].remove("x")
        self.assertEqual(self.code(weak, [entry()]), 1, "記録に無い g2 の値を外した")
        keep = copy.deepcopy(self.base)
        keep[0]["widths"].remove(768)
        self.assertEqual(self.code(keep, [entry()]), 1, "g1 を残して幅を減らした（書いただけでもある）")
        self.assertEqual(self.code(self.without("g3")), 0, "入っていない組は今までどおり消せる")

    def test_K1300_FR_008_records_are_permanent(self) -> None:
        """K1300-FR-008 入った記録は消せない・書き替えられない。そのままなら次の版でも 0。前に入った記録は何も通さない：
        入っていない形（enrolled: false）で足し直した版を分かれ目にして、記録はそのままで段 1 の組 g1 をまた消すと 1（段 1 の組 g1 が無い）。
        入れた形で足し直すのは 0、その後で記録はそのままに組をまた消すと 1"""
        cur = self.without("g1")
        self.put(cur, [entry()])
        self.assertEqual(self.run_gate().returncode, 0)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "removed")
        self.assertEqual(self.code(cur, [entry()]), 0, "そのまま")
        self.assertEqual(self.code(cur, []), 1, "記録を消した")
        self.assertEqual(self.code(cur, None), 1, "removed_groups ごと消した")
        self.assertEqual(self.code(cur, [entry(why="別の訳に書き替えた。前の訳とは違う文")]), 1, "訳を書き替えた")
        self.assertEqual(self.code(cur, [entry(decision="D-1")]), 1, "決定を書き替えた")
        off = copy.deepcopy(self.base)
        off[0]["enrolled"] = False
        self.assertEqual(self.code(off, [entry()]), 0, "入っていない形で足し直した（前の記録は残したまま）")
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "re-add-off")
        self.put(cur, [entry()])
        r = self.run_gate()
        self.assertEqual(r.returncode, 1, "前の記録のまま、入っていない g1 をまた消した（前の記録は段 1 の組の「無い」を外さない）")
        self.assertIn("段 1 の組 g1", r.stdout)
        self.assertEqual(self.code(copy.deepcopy(self.base), [entry()]), 0, "組を入れた形で足し直した（前の記録は残したまま）")
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "re-add")
        self.assertEqual(self.code(cur, [entry()]), 1, "前の記録のまま、組をまた消した")

    def test_K1300_FR_009_no_base_checks_shape_only(self) -> None:
        """K1300-FR-009 --no-base は記録の形だけを見る：段 1 の組 g1 を消して形の正しい記録が在れば 0・記録が無ければ段 1 の組が無いで 1（今までどおり）・
        入っていない g3 を記録なしで消すのは 0・形の誤り（訳が短い・欄が欠ける・並びでない）は、g3 だけを消した設定でも 1 で出力に removed_groups"""
        self.assertEqual(self.code(self.without("g1"), [entry()], "--no-base"), 0)
        self.assertEqual(self.code(self.without("g1"), None, "--no-base"), 1)
        self.assertEqual(self.code(self.without("g3"), None, "--no-base"), 0)
        lacking = {k: v for k, v in entry().items() if k != "why"}
        for why, rg in {"訳が短い": [entry(why="外した")], "欄が欠ける": [lacking], "並びでない": {"g1": entry()}}.items():
            self.shape_red(self.without("g3"), rg, "--no-base")

    def test_K1300_FR_010_pair_records_still_work(self) -> None:
        """K1300-FR-010 対を外す記録（removed・K-377）と組を外す記録は別の並び：組の記録に対の欄（pair・gone）を書けば 1。
        対の記録（removed）の並びに組の記録を混ぜても 1"""
        cur = self.without("g1")
        self.assertEqual(self.code(cur, [{**entry(), "gone": "apps/web/app/x/page.tsx"}]), 1, "組の記録に gone")
        self.put(copy.deepcopy(self.base), None, removed=[entry()])   # 組は消さない：対の記録の形の赤だけで落ちる
        r = self.run_gate()
        self.assertEqual(r.returncode, 1, "removed に組の記録")
        self.assertIn("removed[0]", r.stdout)


class RealRepoTest(unittest.TestCase):
    def test_K1300_FR_011_real_config(self) -> None:
        """K1300-FR-011 本物の設定の removed_groups（在れば）：どの記録の組も groups に無く、記録のチケットの md が在り、
        その頭の decisions: の要素に記録の決定が、changes: の要素に設定が、ちょうど同じ字で在る（検査と同じ読み方 _head_list。
        今のチケットかどうかは、記録を足した回の検査が見た。ここでは見ない）"""
        data = json.loads((ROOT / CFG).read_text(encoding="utf-8"))
        ids = {g["id"] for g in data["groups"]}
        for e in data.get("removed_groups") or []:
            self.assertNotIn(e["group"], ids, e["group"])
            md = ROOT / "11_tickets" / f"{e['ticket']}.md"
            self.assertTrue(md.is_file(), e["ticket"])
            self.assertIn(e["decision"], fidelity_config._head_list(md, "decisions"), e["ticket"])   # 字の含みで比べない
            self.assertIn(CFG, fidelity_config._head_list(md, "changes"), e["ticket"])

    def test_K1300_FR_012_doc_and_registry(self) -> None:
        """K1300-FR-012 検査の頭の説明に removed_groups の決まりが書いてあり、G65 の置き場にこの試験の命令がちょうど 1 行在る"""
        doc = (HERE / "fidelity_config.py").read_text(encoding="utf-8").split('"""')[1]
        self.assertIn("removed_groups", doc)
        line = "python3 scripts/ci/k1300_fidelity_removed_groups_test.py"
        d = HERE / "g65.d"
        hits = [p.name for p in sorted(d.glob("*.txt")) if line in p.read_text(encoding="utf-8").splitlines()] if d.is_dir() else []
        self.assertEqual(hits, ["K-1300.txt"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

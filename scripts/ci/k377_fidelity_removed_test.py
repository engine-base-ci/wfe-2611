#!/usr/bin/env python3
"""K-377 の試験：突き合わせの設定の検査（scripts/ci/fidelity_config.py）に、入れた組の対を「訳つきで外す」道を足す。

  python3 scripts/ci/k377_fidelity_removed_test.py      行 ID は K377-FR-NNN（11_tickets/K-377.md の行の表と 1 対 1）

設定 04_design/fidelity.json の頭に、外した対の記録 "removed" を足す：
  "removed": [{"group": 組の id, "pair": 対の name, "ticket": 外したチケット, "decision": 決定の番号, "why": 訳, "gone": 消した画面のファイル}]
外せるのは「その画面そのものを消すチケットが、訳と決定の番号を書いたとき」だけ（PM の決め 2026-11-19）：
  ・gone は画面のファイル（apps/web/app/ の下の page.tsx）で、分かれ目（--base-ref）の版に在って、今の木には無い（画面を本当に消した）
  ・ticket の md が在り、頭の欄 decisions: に decision が、changes: に gone が書いてある
  ・why は 10 字以上・decision は D-<数>（.<数>）の形・知らない欄は書けない
  ・通るのは、記録に書いた組の、記録に書いた対を「対ごと」外すことだけ。値や幅を減らす・セレクタを替える・組を消す・enrolled を戻す・
    記録に無い対を外す、は今までどおり赤。対を残したまま記録だけ書くのも赤
  ・記録は消せない・書き替えられない（分かれ目に在った記録は今の版にもそのまま在る）
  ・赤から外す力を持つのは、この版で新しく足した記録だけ。前に入った記録は残っていることだけを見て、もう何も通さない
  ・--no-base（分かれ目と比べない回）は、記録の形だけを見る（弱めない検査を流さない回なので、記録が何かを通すことも無い）
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

GONE = "apps/web/app/old/page.tsx"
NOT_SCREEN = "apps/web/lib/old-util.ts"   # 分かれ目に在るが画面ではないファイル
PAIR = {"name": "前の画面への導線", "role": "band-title", "canvas": '[data-act="old"]', "app": '[data-act="old"]',
        "props": ["font-size", "font-weight", "color", "x"]}


def ticket_md(tid: str = "K-900", decisions: str = "D-128.164, D-1", changes: str = f"{GONE}, 04_design/fidelity.json") -> str:
    return f"---\nid: {tid}\nstage: 作業中\ndecisions: [{decisions}]\nchanges: [{changes}]\n---\n## 目的\n\n前の画面を消す\n"


def entry(**kw) -> dict:
    e = {"group": "g1", "pair": PAIR["name"], "ticket": "K-900", "decision": "D-128.164",
         "why": "前の画面ごと消したので、そこへの導線も無くなった", "gone": GONE}
    e.update(kw)
    return e


class RemovedTest(unittest.TestCase):
    """分かれ目：g1（enrolled・対に「前の画面への導線」）・g2（enrolled・同じ対）・消す画面のファイル・消すチケット K-900"""

    def setUp(self) -> None:
        self.f = Fake()
        self.f.git("init", "-q")
        g1, g2 = group("g1", enrolled=True), group("g2", enrolled=True)
        g1["pairs"].append(copy.deepcopy(PAIR))
        g2["pairs"].append(copy.deepcopy(PAIR))
        # 種類 page に要らない物を足しておく（外すと「形の検査」ではなく「弱めない検査」だけが赤にする・K216-VF-014 と同じ形）
        g1["pairs"][0]["props"].append("letter-spacing")
        g1["widths"].append(768)
        self.base = [g1, g2]
        self.f.write(GONE, "export default function Old() { return null; }\n")
        self.f.write(NOT_SCREEN, "export const old = 1;\n")
        self.f.write("11_tickets/K-900.md", ticket_md())
        self.f.config(self.base)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "base")

    def tearDown(self) -> None:
        self.f.close()

    # ---- 道具
    def without(self, *gids: str) -> list[dict]:
        """名指しの組から、対「前の画面への導線」を対ごと外した今の版"""
        g = copy.deepcopy(self.base)
        for x in g:
            if x["id"] in gids:
                x["pairs"] = [p for p in x["pairs"] if p["name"] != PAIR["name"]]
        return g

    def put(self, groups: list[dict], removed: object = None) -> None:
        data: dict = {"_doc": "試し", "groups": groups}
        if removed is not None:
            data["removed"] = removed
        self.f.write("04_design/fidelity.json", json.dumps(data, ensure_ascii=False))

    def delete_screen(self) -> None:
        (self.f.root / GONE).unlink()

    def run_gate(self):
        return self.f.run("--base-ref", "HEAD", required="g1,g2")

    def code(self, groups: list[dict], removed: object = None) -> int:
        self.put(groups, removed)
        r = self.run_gate()
        self.assertNotIn("Traceback", r.stderr, "検査が例外で落ちた（1 で終わっても、赤と数えない）")
        return r.returncode

    # ---- 行
    def test_K377_FR_001_removed_with_reason_passes(self) -> None:
        """K377-FR-001 画面を消し、対を対ごと外し、記録（組・対・チケット・決定・訳・消したファイル）を書けば 0"""
        self.delete_screen()
        self.put(self.without("g1"), [entry()])
        r = self.run_gate()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K377_FR_002_no_record_is_red(self) -> None:
        """K377-FR-002 記録を書かずに対を外すと、今までどおり 1（組と対の名前を出す）。removed が空の並びでも同じ"""
        self.delete_screen()
        for removed in (None, []):
            self.put(self.without("g1"), removed)
            r = self.run_gate()
            self.assertEqual(r.returncode, 1, removed)
            self.assertIn("g1", r.stdout)
            self.assertIn(PAIR["name"], r.stdout)

    def test_K377_FR_003_screen_still_exists_is_red(self) -> None:
        """K377-FR-003 gone のファイルがまだ今の木に在る（画面を消していない）なら 1"""
        self.assertEqual(self.code(self.without("g1"), [entry()]), 1)

    def test_K377_FR_004_gone_never_existed_is_red(self) -> None:
        """K377-FR-004 gone が分かれ目の版に無かったファイル（もともと無い道）・根の外を指す道・空・
        分かれ目に在って今は無いが画面のファイル（apps/web/app/ の下の page.tsx）でない物なら 1"""
        self.delete_screen()
        (self.f.root / NOT_SCREEN).unlink()
        for gone in ("apps/web/app/never/page.tsx", "../outside.tsx", "/etc/hosts", "", NOT_SCREEN):
            self.f.write("11_tickets/K-900.md", ticket_md(changes=f"{gone}, 04_design/fidelity.json"))
            self.assertEqual(self.code(self.without("g1"), [entry(gone=gone)]), 1, gone)

    def test_K377_FR_005_ticket_must_declare(self) -> None:
        """K377-FR-005 チケットの md が無い・decisions: にその決定が無い・changes: に gone が無いなら 1。3 つそろえば 0"""
        self.delete_screen()
        cur = self.without("g1")
        self.assertEqual(self.code(cur, [entry(ticket="K-901")]), 1, "md が無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-1"))
        self.assertEqual(self.code(cur, [entry()]), 1, "decisions に無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-128.1640, D-1"))
        self.assertEqual(self.code(cur, [entry()]), 1, "字の含みで比べない（D-128.1640 は D-128.164 ではない）")
        self.f.write("11_tickets/K-900.md", ticket_md(changes="04_design/fidelity.json"))
        self.assertEqual(self.code(cur, [entry()]), 1, "changes に無い")
        self.f.write("11_tickets/K-900.md", ticket_md())
        self.assertEqual(self.code(cur, [entry()]), 0, "そろえば通る")

    def test_K377_FR_006_entry_shape(self) -> None:
        """K377-FR-006 記録の形：訳が 10 字未満・決定の形が D-<数> でない・欄が欠ける・知らない欄が在る・文字でない値なら 1"""
        self.delete_screen()
        cur = self.without("g1")
        bads = {
            "訳が短い": entry(why="消した"),
            "訳が空白だけ": entry(why="          "),
            "決定の形": entry(decision="決めた"),
            "決定が空": entry(decision=""),
            "知らない欄": {**entry(), "note": "x"},
            "文字でない": entry(why=12345678901),
        }
        for k in ("group", "pair", "ticket", "decision", "why", "gone"):
            e = entry()
            del e[k]
            bads[f"{k} が欠ける"] = e
        for why, e in bads.items():
            # 決定の形の 2 つは、チケットの md にも同じ値を書く（「md に無い」ではなく「形が違う」で赤になることを見る）
            dec = e.get("decision") if isinstance(e.get("decision"), str) else "D-128.164"
            self.f.write("11_tickets/K-900.md", ticket_md(decisions=f"{dec}, D-128.164, D-1"))
            self.assertEqual(self.code(cur, [e]), 1, why)

    def test_K377_FR_007_only_whole_pair(self) -> None:
        """K377-FR-007 対を残したまま値を減らす・幅を減らす・セレクタを替えるのは、記録を書いても 1（通るのは対ごと外すときだけ）"""
        self.delete_screen()
        edits = {
            "値を減らした": lambda g: g[0]["pairs"][-1]["props"].remove("color"),
            "幅を減らした": lambda g: g[0]["widths"].remove(768),
            "セレクタを替えた": lambda g: g[0]["pairs"][-1].update(app="body"),
        }
        for why, edit in edits.items():
            g = copy.deepcopy(self.base)
            edit(g)
            self.assertEqual(self.code(g, [entry()]), 1, why)

    def test_K377_FR_008_record_without_removal_is_red(self) -> None:
        """K377-FR-008 記録に書いた対がまだ今の組に在る（書いただけで外していない）なら 1"""
        self.delete_screen()
        self.assertEqual(self.code(copy.deepcopy(self.base), [entry()]), 1)

    def test_K377_FR_009_one_record_covers_one_pair(self) -> None:
        """K377-FR-009 1 つの記録が通すのは、その組のその対だけ：別の組 g2 の同じ対・同じ組の別の対（h1）の値や幅を一緒に外すと 1。組ごとに記録を書けば 0"""
        self.delete_screen()
        both = self.without("g1", "g2")
        self.assertEqual(self.code(both, [entry()]), 1, "g2 の記録が無い")
        self.assertEqual(self.code(both, [entry(), entry(group="g2")]), 0, "組ごとに書けば通る")
        other = self.without("g1")
        other[0]["pairs"][0]["props"].remove("letter-spacing")
        self.assertEqual(self.code(other, [entry()]), 1, "記録に無い対 h1 の値（種類に要らない値なので、弱めない検査だけが赤にする）")
        width = self.without("g1")
        width[0]["widths"].remove(768)
        self.assertEqual(self.code(width, [entry()]), 1, "記録の対と一緒に、組の幅 768 を外した（ほかの対の比べる物も減る）")

    def test_K377_FR_010_group_level_changes_stay_red(self) -> None:
        """K377-FR-010 組ごと消す・enrolled を false に戻す・絵（canvas）を替えるのは、記録を書いても 1"""
        self.delete_screen()
        self.put([g for g in self.without("g1") if g["id"] != "g1"], [entry()])
        self.assertEqual(self.f.run("--base-ref", "HEAD", required="g2").returncode, 1, "組ごと消した")
        back = self.without("g1")
        back[0]["enrolled"] = False
        self.assertEqual(self.code(back, [entry()]), 1, "enrolled を戻した")
        st = self.without("g1")
        st[0]["canvas"] = "Main2"
        self.f.write("04_design/canvas/Main2.dc.html", "<h1>チケット</h1>")
        self.assertEqual(self.code(st, [entry()]), 1, "絵を替えた")

    def test_K377_FR_011_records_are_permanent(self) -> None:
        """K377-FR-011 入った記録は消せない・書き替えられない。そのままなら、次の版でも 0（対はもう分かれ目に無い）。
        前に入った記録は何も通さない：対を足し直すのは 0、その後で記録はそのままに対をまた外すと 1"""
        self.delete_screen()
        cur = self.without("g1")
        self.put(cur, [entry()])
        self.assertEqual(self.run_gate().returncode, 0)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "removed")
        self.assertEqual(self.code(cur, [entry()]), 0, "そのまま")
        self.assertEqual(self.code(cur, []), 1, "記録を消した")
        self.assertEqual(self.code(cur, None), 1, "removed ごと消した")
        self.assertEqual(self.code(cur, [entry(why="別の訳に書き替えた。前の訳とは違う文")]), 1, "訳を書き替えた")
        self.assertEqual(self.code(cur, [entry(decision="D-1")]), 1, "決定を書き替えた")
        # 前に入った記録は、もう何も通さない：対を足し直すのは 0（増やすだけ）。それを入れた後、記録はそのままで対をまた外すと 1
        self.assertEqual(self.code(copy.deepcopy(self.base), [entry()]), 0, "対を足し直した（前の記録は残したまま）")
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "re-add")
        self.assertEqual(self.code(cur, [entry()]), 1, "前の記録のまま、対をまた外した")

    def test_K377_FR_012_removed_list_shape(self) -> None:
        """K377-FR-012 removed が並びでない・要素が入れ物でない・同じ（組, 対）が 2 つ・無い組や分かれ目に無かった対を指すなら 1"""
        self.delete_screen()
        cur = self.without("g1")
        bads = {
            "並びでない": {"g1": entry()},
            "要素が文字": ["g1"],
            "同じ記録が 2 つ": [entry(), entry()],
            "無い組": [entry(), entry(group="g9")],
            "分かれ目に無かった対": [entry(), entry(pair="そんな対は無い")],
        }
        for why, removed in bads.items():
            self.assertEqual(self.code(cur, removed), 1, why)

    def test_K377_FR_013_needs_base(self) -> None:
        """K377-FR-013 --no-base（分かれ目と比べない回）は記録の形だけを見る：形の正しい記録が在っても 0・記録が無くても 0（今までどおり）・
        形の誤った記録（訳が短い・欄が欠ける・並びでない）は 1"""
        self.delete_screen()
        self.put(self.without("g1"), [entry()])
        r = self.f.run("--no-base", required="g1,g2")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.put(self.without("g1"))
        self.assertEqual(self.f.run("--no-base", required="g1,g2").returncode, 0)
        short = entry(why="消した")
        lacking = {k: v for k, v in entry().items() if k != "gone"}
        for why, removed in {"訳が短い": [short], "欄が欠ける": [lacking], "並びでない": {"g1": entry()}}.items():
            self.put(self.without("g1"), removed)
            r = self.f.run("--no-base", required="g1,g2")
            self.assertEqual(r.returncode, 1, why)
            self.assertNotIn("Traceback", r.stderr, why)


class RealRepoTest(unittest.TestCase):
    def test_K377_FR_014_real_config_and_registry(self) -> None:
        """K377-FR-014 本物の木：検査の頭の説明に removed の決まりが書いてあり、G65 の置き場にこの試験の命令が 1 行在る。
        本物の設定の removed（在れば）は、どれもチケットの md が在る（消したファイルが無いことは、記録を足した回の検査が見た）"""
        doc = (HERE / "fidelity_config.py").read_text(encoding="utf-8").split('"""')[1]
        for word in ("removed", "gone", "decision"):
            self.assertIn(word, doc, f"fidelity_config.py の頭の説明に {word} が無い")
        line = "python3 scripts/ci/k377_fidelity_removed_test.py"
        d = HERE / "g65.d"
        hits = [p.name for p in sorted(d.glob("*.txt")) if line in p.read_text(encoding="utf-8").splitlines()] if d.is_dir() else []
        self.assertEqual(hits, ["K-377.txt"], "G65 の置き場（scripts/ci/g65.d/K-377.txt）にこの試験の命令がちょうど 1 行")
        data = json.loads((ROOT / "04_design" / "fidelity.json").read_text(encoding="utf-8"))
        for e in data.get("removed") or []:
            self.assertTrue((ROOT / "11_tickets" / f"{e['ticket']}.md").is_file(), e["ticket"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

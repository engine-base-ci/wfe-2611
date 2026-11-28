#!/usr/bin/env python3
"""K-1301 の試験：見た目の突き合わせの設定（04_design/fidelity.json）の組に「幅ごとの絵」（at）を持てる形を入れる。

  python3 scripts/ci/k1301_fidelity_at_test.py      行 ID は K1301-FA-NNN（11_tickets/K-1301.md の行の表と 1 対 1）

組の欄 "at"（幅ごとの絵の記録・K-1301）：
  "at": {"<幅>": {"canvas": 絵の名前, "pairs": {<対の name>: {"canvas": セレクタ, "app": セレクタ}}, "ticket": 替えたチケット,
                  "decision": 決定の番号, "why": 訳}}
  ・その幅だけ、比べる絵とセレクタを替える。対の name・role・props と組の canvas・app・state・widths・pairs は替えない（弱めない検査はそのまま）
  ・形：at は表・幅の鍵は組の widths に在る幅の数字・欄は上の 5 つだけ・canvas の絵が在る・pairs は組の対の name を全部（ちょうど）持ち、
    値は canvas と app の 2 つの欄だけ・why は空白を除いて 10 字以上・decision は D-<数>（.<数>）・y_from を持つ対のある組には書けない
  ・記録は消せない・書き替えられない：分かれ目の版の組に在った at の記録は、組が残っているかぎり 1 字も変えずに在る。
    変えてよいのは対の集まりの分だけ：この版で組に足した対の値を pairs に足す・K-377 の記録（removed）の通った対を pairs から外す（K-1301 の案 A）
  ・この版で新しく足した（書き替えた）記録は、ticket が今のチケット：md が在り、頭の欄 decisions: に decision・changes: に
    04_design/fidelity.json がちょうど同じ字で在り、md が分かれ目の版に無いかそこから変わっていて、stage が確認中・完了でない
  ・--no-base の回は形だけを見る
この葉は仕組みだけを持つ。本物の組 tickets-main に幅 375 の記録を書くのは K-478（一覧の画面をスマホの本文に替える葉）。
作りものの設定は tempfile の中の git に作る（土台は K-216 の試験の Fake・group）。本物の木を読む行は 009〜013。
テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import copy
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from k216_fidelity_config_test import ROLES, Fake, group  # noqa: E402

CFG = "04_design/fidelity.json"
MOBILE_LIST = ROOT / "04_design" / "canvas" / "MobileList.dc.html"
MB = ROOT / "04_design" / "canvas_gen" / "mb.py"
# 組を読んでキャンバスの絵を開く汎用の道具（どの組でも読む）。どれも幅ごとの絵を groupAt で解く
GENERIC = ["apps/web/tests/fidelity/fidelity.spec.ts", "apps/web/tests/k/kit.ts", "scripts/ci/visual_fidelity.mjs"]
# 組（g・G・group）の canvas から絵の道を作る書き方（groupAt の答えの at.canvas は当てない）
CANVAS_PATH = re.compile(r"\b(?:g|G|group)!?\.canvas\}\.dc\.html")


def ticket_md(tid: str = "K-900", decisions: str = "D-151.20, D-1", changes: str = f"{CFG}, scripts/ci/x.py",
              stage: str = "作業中") -> str:
    return f"---\nid: {tid}\nstage: {stage}\ndecisions: [{decisions}]\nchanges: [{changes}]\n---\n## 目的\n\n幅ごとの絵を替える\n"


def at_entry(g: dict, **kw) -> dict:
    e = {"canvas": "Mobile",
         "pairs": {p["name"]: {"canvas": f".m-{p['name']}", "app": p["app"]} for p in g["pairs"]},
         "ticket": "K-900", "decision": "D-151.20", "why": "幅 375 の正はスマホの一覧の絵（本文の箱が別の形）"}
    e.update(kw)
    return e


class AtTest(unittest.TestCase):
    """分かれ目：g1（enrolled・page・幅 1440・375）・g2（入っていない）・前に終わったチケット K-800（分かれ目に在る）。
    今のチケット K-900 の md は分かれ目の後に書く。絵 Main・Mobile が在る"""

    def setUp(self) -> None:
        self.f = Fake()
        self.f.git("init", "-q")
        self.f.write("04_design/canvas/Mobile.dc.html", "<header><h1>チケット</h1></header>")
        self.base = [group("g1", enrolled=True), group("g2")]
        self.f.write("11_tickets/K-800.md", ticket_md("K-800", changes=CFG))
        self.put(self.base)
        self.f.git("add", "-A")
        self.f.git("commit", "-qm", "base")
        self.f.write("11_tickets/K-900.md", ticket_md())

    def tearDown(self) -> None:
        self.f.close()

    # ---- 道具
    def put(self, groups: list[dict]) -> None:
        self.f.write(CFG, json.dumps({"_doc": "試し", "groups": groups}, ensure_ascii=False))

    def with_at(self, at: object, gid: str = "g1", groups: list[dict] | None = None) -> list[dict]:
        out = copy.deepcopy(groups if groups is not None else self.base)
        for g in out:
            if g["id"] == gid:
                g["at"] = at
        return out

    def code(self, groups: list[dict], *extra: str) -> int:
        self.put(groups)
        r = self.f.run(*(extra or ("--base-ref", "HEAD")), required="g1")
        self.assertNotIn("Traceback", r.stderr, "検査が例外で落ちた（1 で終わっても、赤と数えない）")
        return r.returncode

    def commit_base(self, groups: list[dict]) -> None:
        """今の形を分かれ目にする（記録を入れた版を分かれ目にする行で使う）。設定だけを入れ、今のチケット K-900 の md は分かれ目に入れない"""
        self.put(groups)
        self.f.git("add", CFG)
        self.f.git("commit", "-qm", "next")

    # ---- 行
    def test_K1301_FA_001_valid_record_passes(self) -> None:
        """K1301-FA-001 入れた組 g1 に幅 375 の記録（絵・対ごとのセレクタ・チケット・決定・訳）を書けば、分かれ目と比べる回も --no-base の回も 0"""
        cur = self.with_at({"375": at_entry(self.base[0])})
        self.put(cur)
        r = self.f.run("--base-ref", "HEAD", required="g1")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.code(cur, "--no-base"), 0)

    def test_K1301_FA_002_ticket_must_be_current(self) -> None:
        """K1301-FA-002 チケットの md が無い・decisions: に無い・字の含みだけ（D-151.200）・changes: に設定が無い・
        分かれ目から変わっていない前のチケット K-800 の名・stage が確認中・完了 なら 1。そろえば 0"""
        cur = self.with_at({"375": at_entry(self.base[0])})
        self.assertEqual(self.code(self.with_at({"375": at_entry(self.base[0], ticket="K-901")})), 1, "md が無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-1"))
        self.assertEqual(self.code(cur), 1, "decisions に無い")
        self.f.write("11_tickets/K-900.md", ticket_md(decisions="D-151.200, D-1"))
        self.assertEqual(self.code(cur), 1, "字の含みで比べない")
        self.f.write("11_tickets/K-900.md", ticket_md(changes="scripts/ci/x.py"))
        self.assertEqual(self.code(cur), 1, "changes に設定が無い")
        self.assertEqual(self.code(self.with_at({"375": at_entry(self.base[0], ticket="K-800")})), 1,
                         "前に終わったチケットの名を借りた（分かれ目から変わっていない）")
        for st in ("確認中", "完了"):
            self.f.write("11_tickets/K-900.md", ticket_md(stage=st))
            self.assertEqual(self.code(cur), 1, f"stage が {st}")
        self.f.write("11_tickets/K-900.md", ticket_md())
        self.assertEqual(self.code(cur), 0, "そろえば通る")

    def test_K1301_FA_003_entry_shape(self) -> None:
        """K1301-FA-003 記録の形：at が表でない・幅の鍵が数字でない・組の幅に無い・記録が表でない・知らない欄・欄が欠ける・絵が無い・
        pairs が表でない・対が欠ける・知らない対・対の値が表でない・対の値の欄が欠ける・知らない欄・空の字・訳が短い・決定の形 なら 1（例外で落ちない）"""
        g = self.base[0]
        e = at_entry(g)
        one = next(iter(e["pairs"]))
        bads: dict[str, object] = {
            "at が表でない": [e],
            "幅の鍵が数字でない": {"wide": e},
            "組の幅に無い": {"768": e},
            "記録が表でない": {"375": "Mobile"},
            "知らない欄": {"375": {**e, "props": ["x"]}},
            "絵が無い": {"375": {**e, "canvas": "Nothing"}},
            "pairs が表でない": {"375": {**e, "pairs": list(e["pairs"].values())}},
            "対が欠ける": {"375": {**e, "pairs": {k: v for k, v in e["pairs"].items() if k != one}}},
            "知らない対": {"375": {**e, "pairs": {**e["pairs"], "無い対": {"canvas": "x", "app": "y"}}}},
            "対の値が表でない": {"375": {**e, "pairs": {**e["pairs"], one: ".m"}}},
            "対の値の欄が欠ける": {"375": {**e, "pairs": {**e["pairs"], one: {"canvas": ".m"}}}},
            "対の値の知らない欄": {"375": {**e, "pairs": {**e["pairs"], one: {"canvas": ".m", "app": ".a", "props": []}}}},
            "対の値が空の字": {"375": {**e, "pairs": {**e["pairs"], one: {"canvas": " ", "app": ".a"}}}},
            "訳が短い": {"375": {**e, "why": "替えた"}},
            "決定の形": {"375": {**e, "decision": "決めた"}},
            "訳に改行": {"375": {**e, "why": "幅 375 の正は\nスマホの一覧の絵"}},
            "チケットに NUL": {"375": {**e, "ticket": "K-900\x00"}},
            "チケットが空": {"375": {**e, "ticket": ""}},
            "決定が空白だけ": {"375": {**e, "decision": "   "}},
            "対の app に改行": {"375": {**e, "pairs": {**e["pairs"], one: {"canvas": ".m", "app": ".a\n.b"}}}},
        }
        for k in ("canvas", "pairs", "ticket", "decision", "why"):
            bad = dict(e)
            del bad[k]
            bads[f"{k} が欠ける"] = {"375": bad}
        for why, at in bads.items():
            self.assertEqual(self.code(self.with_at(at)), 1, why)
            self.assertEqual(self.code(self.with_at(at), "--no-base"), 1, f"{why}（--no-base）")

    def test_K1301_FA_004_record_cannot_change(self) -> None:
        """K1301-FA-004 記録を入れた版を分かれ目にして：そのままなら 0。at を消す・幅の記録を消す・絵を替える・対のセレクタを替える・訳を替える なら 1。
        入っていない組 g2 の記録も同じ（記録は組の enrolled に関わらず消せない）"""
        rec = at_entry(self.base[0])
        start = self.with_at({"375": rec})
        start = self.with_at({"375": at_entry(self.base[1])}, gid="g2", groups=start)
        self.commit_base(start)
        self.assertEqual(self.code(copy.deepcopy(start)), 0, "そのまま")
        one = next(iter(rec["pairs"]))
        changed = {
            "at を消す": self.with_at({}, groups=start),
            "at の欄ごと消す": [{k: v for k, v in g.items() if k != "at"} if g["id"] == "g1" else g for g in copy.deepcopy(start)],
            "絵を替える": self.with_at({"375": {**rec, "canvas": "Main"}}, groups=start),
            "対のセレクタを替える": self.with_at({"375": {**rec, "pairs": {**rec["pairs"], one: {"canvas": ".z", "app": ".z"}}}}, groups=start),
            "訳を替える": self.with_at({"375": {**rec, "why": "訳を書き替えて別の訳にした"}}, groups=start),
            "入っていない組の記録を消す": self.with_at({}, gid="g2", groups=start),
        }
        for why, cur in changed.items():
            self.assertEqual(self.code(cur), 1, why)
        gone = [g for g in copy.deepcopy(start) if g["id"] != "g2"]
        self.assertEqual(self.code(gone), 0, "at の記録の在る入っていない組 g2 を組ごと消す（組ごと無くなった組の at は見ない）")

    def test_K1301_FA_005_at_does_not_loosen(self) -> None:
        """K1301-FA-005 正しい記録が在っても、組の幅 375 を外す・組の対の app のセレクタを替える・組の canvas を替える・対を 1 つ消す（at からも消す）は今までどおり 1"""
        g = copy.deepcopy(self.base[0])
        rec = at_entry(g)
        no375 = self.with_at({"375": rec})
        no375[0]["widths"] = [1440]
        self.assertEqual(self.code(no375), 1, "幅 375 を外す")
        sel = self.with_at({"375": rec})
        sel[0]["pairs"][0]["app"] = ".changed"
        self.assertEqual(self.code(sel), 1, "組の対のセレクタを替える")
        canvas = self.with_at({"375": rec})
        canvas[0]["canvas"] = "Mobile"
        self.assertEqual(self.code(canvas), 1, "組の canvas を替える")
        drop = self.with_at({"375": {**rec, "pairs": dict(list(rec["pairs"].items())[1:])}})
        drop[0]["pairs"] = drop[0]["pairs"][1:]
        self.assertEqual(self.code(drop), 1, "対を 1 つ消す")

    def test_K1301_FA_006_no_at_with_y_from(self) -> None:
        """K1301-FA-006 y_from（幅で y の読み方を替える・K-230）を持つ対のある組に at を書くと 1（y_from を書いた版を分かれ目にしてから足しても同じ）"""
        base = copy.deepcopy(self.base)
        base[0]["pairs"][0]["y_from"] = {"max_width": 767, "canvas": ".c-box", "app": ".a-box", "why": "幅 767 以下は箱の上端から読む"}
        self.commit_base(base)
        self.assertEqual(self.code(self.with_at({"375": at_entry(base[0])}, groups=base)), 1)

    def test_K1301_FA_007_old_record_passes_nothing_new(self) -> None:
        """K1301-FA-007 記録 375 を入れた版を分かれ目にして、前の記録はそのまま・幅 1440 の記録を今のチケットで足すと 0。
        前の記録のチケット K-800（分かれ目から変わっていない）の名で 1440 を足すと 1"""
        start = self.with_at({"375": at_entry(self.base[0], ticket="K-800")})
        self.commit_base(start)
        rec = start[0]["at"]["375"]
        self.assertEqual(self.code(self.with_at({"375": rec, "1440": at_entry(self.base[0])}, groups=start)), 0, "今のチケットで足す")
        self.assertEqual(self.code(self.with_at({"375": rec, "1440": at_entry(self.base[0], ticket="K-800")}, groups=start)), 1,
                         "前の記録のチケットの名を借りる")

    def test_K1301_FA_019_pairs_follow_group(self) -> None:
        """K1301-FA-019 記録 375 を入れた版を分かれ目にして：組に対を足し at に足さない → 1・at の pairs にもその対を足す → 0
        （前の記録の canvas・ticket・decision・why と前からの対の値はそのまま）。前からの対の値を同時に替える → 1。
        K-377 の記録（removed）つきで対を外し、at の pairs からも外す → 0・at に残す → 1・記録なしで at から外す → 1"""
        self.f.write("apps/web/app/x/page.tsx", "export default function P() { return null; }\n")
        base = copy.deepcopy(self.base)
        base[0]["pairs"].append({"name": "x", "role": "body", "canvas": ".c-x", "app": ".a-x", "props": list(ROLES["body"])})
        rec = at_entry(base[0], ticket="K-800")
        base[0]["at"] = {"375": rec}
        self.f.git("add", "apps/web/app/x/page.tsx")
        self.commit_base(base)
        # 対を足す
        add = copy.deepcopy(base)
        add[0]["pairs"].append({"name": "y", "role": "body", "canvas": ".c-y", "app": ".a-y", "props": list(ROLES["body"])})
        self.assertEqual(self.code(add), 1, "足した対が at に無い")
        add[0]["at"]["375"]["pairs"]["y"] = {"canvas": ".m-y", "app": ".a-y"}
        self.assertEqual(self.code(add), 0, "足した対を at に足す")
        one = base[0]["pairs"][0]["name"]
        add[0]["at"]["375"]["pairs"][one] = {"canvas": ".z", "app": ".z"}
        self.assertEqual(self.code(add), 1, "前からの対の値を同時に替える")
        # K-377 の記録つきで対 x を外す（画面のファイルを消したチケット K-900）
        (self.f.root / "apps/web/app/x/page.tsx").unlink()
        self.f.write("11_tickets/K-900.md", ticket_md(changes=f"{CFG}, apps/web/app/x/page.tsx"))
        removed = [{"group": "g1", "pair": "x", "ticket": "K-900", "decision": "D-151.20",
                    "why": "画面を消したので対 x を外す", "gone": "apps/web/app/x/page.tsx"}]
        cut = copy.deepcopy(base)
        cut[0]["pairs"] = [q for q in cut[0]["pairs"] if q["name"] != "x"]
        keep_in_at = copy.deepcopy(cut)
        cut[0]["at"]["375"]["pairs"].pop("x")
        for groups, want, why in ((cut, 0, "記録つきで外し at からも外す"), (keep_in_at, 1, "at に残す")):
            self.f.write(CFG, json.dumps({"_doc": "試し", "groups": groups, "removed": removed}, ensure_ascii=False))
            r = self.f.run("--base-ref", "HEAD", required="g1")
            self.assertNotIn("Traceback", r.stderr)
            self.assertEqual(r.returncode, want, why + r.stdout)
        self.assertEqual(self.code(cut), 1, "記録なしで対を外す")

    def test_K1301_FA_008_no_base_checks_shape_only(self) -> None:
        """K1301-FA-008 --no-base の回：チケットの md が無くても形が正しければ 0（分かれ目と比べない回はチケットを確かめない）。形の誤りは 1"""
        self.assertEqual(self.code(self.with_at({"375": at_entry(self.base[0], ticket="K-901")}), "--no-base"), 0)
        self.assertEqual(self.code(self.with_at({"375": at_entry(self.base[0], why="短い")}), "--no-base"), 1)


def _texts(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def _real_groups() -> list[dict]:
    return json.loads((ROOT / CFG).read_text(encoding="utf-8"))["groups"]


def _readers() -> list[str]:
    """組の canvas から絵の道を作る読み手（apps/web/tests と scripts/ci の .ts・.mjs）"""
    out = []
    for base in ("apps/web/tests", "scripts/ci"):
        for p in sorted((ROOT / base).rglob("*")):
            if p.suffix in (".ts", ".mjs") and "node_modules" not in p.parts and CANVAS_PATH.search(p.read_text(encoding="utf-8")):
                out.append(str(p.relative_to(ROOT)))
    return out


def stray_readers(with_at: set[str]) -> list[str]:
    """at を持つ組（with_at）を groupAt を通さずに読みうる読み手：groupAt を持たず、引用符の中に組の id を 1 つも書かない（汎用）か、
    at を持つ組の id を書いた読み手。with_at が空なら空"""
    if not with_at:
        return []
    ids = {g["id"] for g in _real_groups()} | set(with_at)
    out = []
    for rel in _readers():
        text = _texts(rel)
        if "groupAt(" in text:
            continue
        named = {m for m in re.findall(r"[\"'`]([a-z0-9-]+)[\"'`]", text) if m in ids}
        if not named or named & with_at:
            out.append(rel)
    return out


class RealTest(unittest.TestCase):
    def test_K1301_FA_009_readers_resolve_at(self) -> None:
        """K1301-FA-009 本物の設定に at を持つ組が在るなら、絵の道を組の canvas から作る読み手は、groupAt を通すか、
        引用符の中に at の無い組の id だけを書いた（その組だけを読む）物。id を書かない汎用の読み手は groupAt を通す。
        本物の設定の at に加え、tickets-main に at が在るとみなした照らしも毎回流す（照らしがこの葉で 1 回も走らないまま緑にならないように）：
        引っかかるのは K-478 が groupAt に替える apps/web/tests/k/list-mock.ts ただ 1 つ"""
        self.assertTrue(_readers(), "読み手が 1 つも見つからない（探し方が壊れた）")
        real = {g["id"] for g in _real_groups() if g.get("at")}
        self.assertEqual(stray_readers(real), [], f"at を持つ組 {sorted(real)} を groupAt を通さずに読む読み手が在る")
        if "tickets-main" not in real:
            self.assertEqual(stray_readers({"tickets-main"}), ["apps/web/tests/k/list-mock.ts"],
                             "tickets-main に at が在るとみなした照らしで引っかかる読み手が list-mock.ts だけでない")

    def test_K1301_FA_010_generic_readers_use_group_at(self) -> None:
        """K1301-FA-010 汎用の道具（fidelity.spec.ts・kit.ts・visual_fidelity.mjs）は、組を幅ごとに groupAt で解いてから絵を開く。
        型の宣言 fidelity_compare.d.mts に groupAt が在る"""
        for rel in GENERIC:
            self.assertTrue("groupAt(" in _texts(rel), f"{rel} が groupAt を読まない")
        self.assertRegex(_texts("scripts/ci/fidelity_compare.d.mts"), r"export function groupAt\(")

    def test_K1301_FA_011_doc_and_g65(self) -> None:
        """K1301-FA-011 検査の頭の説明に幅ごとの絵（"at"）の決まりが在り、G65 の置き場でこの葉の 2 つの試験の命令を持つのは K-1301.txt だけ"""
        doc = _texts("scripts/ci/fidelity_config.py").split('"""')[1]
        self.assertIn('"at"', doc)
        self.assertIn("幅ごとの絵", doc)
        cmds = ["python3 scripts/ci/k1301_fidelity_at_test.py", "scripts/ci/k1301_fidelity_at.test.mjs"]
        own = _texts("scripts/ci/g65.d/K-1301.txt")
        for c in cmds:
            self.assertIn(c, own)
        for p in sorted((ROOT / "scripts/ci/g65.d").glob("*.txt")):
            if p.name != "K-1301.txt":
                for c in cmds:
                    self.assertNotIn(c, p.read_text(encoding="utf-8"), p.name)


def _style(s: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for part in (s or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip()] = v.strip()
    return out


class _Tree(HTMLParser):
    """要素の木（属性・子・中の字）。空要素は子を持たない"""
    VOID = {"meta", "link", "br", "img", "input", "hr", "source", "path", "circle", "rect"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root: dict = {"tag": "#root", "attrs": {}, "kids": []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = {"tag": tag, "attrs": dict(attrs), "kids": []}
        self.stack[-1]["kids"].append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1]["kids"].append({"tag": tag, "attrs": dict(attrs), "kids": []})

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                return


def _all(node: dict):
    yield node
    for k in node["kids"]:
        yield from _all(k)


def _find(text: str, pred) -> list[dict]:
    t = _Tree()
    t.feed(text)
    return [n for n in _all(t.root) if pred(n)]


def _cls(n: dict, c: str) -> bool:
    return c in (n["attrs"].get("class") or "").split()


def check_wrapped(test: unittest.TestCase, text: str) -> None:
    """MobileList の包む要素：見出しの帯 header.kn-mlist-head（見出しの行とタブだけ・下の罫線は帯に 1 本）と、本文の箱 div.kn-mlist-body（絞りの札と並びだけ）"""
    heads = _find(text, lambda n: _cls(n, "kn-mlist-head"))
    bodies = _find(text, lambda n: _cls(n, "kn-mlist-body"))
    test.assertEqual(len(heads), 1, "見出しの帯の包みが 1 つでない")
    test.assertEqual(len(bodies), 1, "本文の箱の包みが 1 つでない")
    head, body = heads[0], bodies[0]
    test.assertEqual(head["tag"], "header")
    test.assertEqual(_style(head["attrs"].get("style")), {"flex": "none", "border-bottom": "1px solid #DDE2E9"})
    test.assertEqual([k["tag"] for k in head["kids"]], ["div", "div"])
    row, tabs = head["kids"]
    test.assertEqual([k["tag"] for k in row["kids"]][:1], ["h1"])
    test.assertEqual(_style(row["attrs"].get("style")), {"display": "flex", "align-items": "center", "gap": "8px", "padding": "14px 16px 6px"})
    test.assertEqual(tabs["attrs"].get("role"), "tablist")
    test.assertEqual(_style(tabs["attrs"].get("style")), {"display": "flex", "gap": "2px", "padding": "0 16px", "overflow-x": "auto"},
                     "タブの下の罫線は帯へ移す（タブには残さない）")
    test.assertEqual(body["tag"], "div")
    test.assertEqual(_style(body["attrs"].get("style")), {"flex": "1", "min-height": "0", "display": "flex", "flex-direction": "column"})
    test.assertEqual([k["tag"] for k in body["kids"]], ["div", "div"])
    chips, rows = body["kids"]
    test.assertEqual(_style(chips["attrs"].get("style")), {"display": "flex", "gap": "8px", "padding": "10px 16px", "overflow-x": "auto"})
    test.assertTrue(all(k["tag"] == "button" for k in chips["kids"]) and chips["kids"], "絞りの札")
    test.assertEqual(_style(rows["attrs"].get("style")), {"flex": "1", "overflow": "auto", "border-top": "1px solid #DDE2E9"})
    test.assertTrue(any(k["tag"] == "sc-for" for k in rows["kids"]), "1 件 1 行の並び")


def unwrap(text: str) -> str:
    """包む前の形（包みの開きと閉じを外し、タブに下の罫線を戻す）。作り手が包むかを確かめる元にする。包みが無ければそのまま返す"""
    if 'class="kn-mlist-head"' not in text or 'class="kn-mlist-body"' not in text:
        return text
    text = re.sub(r'\n? *<header class="kn-mlist-head"[^>]*>', "", text, count=1)
    text = text.replace("</header>", "", 1)
    i = text.index('<div class="kn-mlist-body"')
    j = text.index(">", i) + 1
    depth, k = 1, j
    while depth:
        o, c = text.find("<div", k), text.find("</div>", k)
        if o != -1 and o < c:
            depth, k = depth + 1, o + 4
        else:
            depth, k = depth - 1, c + 6
    text = text[:i] + text[j:k - 6] + text[k:]
    return text.replace('<div role="tablist" style="display: flex; gap: 2px; padding: 0 16px; overflow-x: auto"',
                        '<div role="tablist" style="display: flex; gap: 2px; padding: 0 16px; border-bottom: 1px solid #DDE2E9; overflow-x: auto"', 1)


class CanvasTest(unittest.TestCase):
    def test_K1301_FA_012_mobile_list_is_wrapped(self) -> None:
        """K1301-FA-012 絵 MobileList は、見出しの行とタブを header.kn-mlist-head（下の罫線 1px #DDE2E9 は帯へ移す）で、絞りの札と並びを
        div.kn-mlist-body（flex: 1・min-height: 0・縦に並べる）で包む。中の要素の style は包む前と同じ（タブの下の罫線だけを帯へ移す）"""
        check_wrapped(self, MOBILE_LIST.read_text(encoding="utf-8"))

    def test_K1301_FA_013_generator_wraps_once(self) -> None:
        """K1301-FA-013 作り手 mb.py を写しの置き場（KANAME_CANVAS）で、包む前の MobileList から 2 回流すと、1 回目で包み、2 回目は MobileList が 1 字も変わらない"""
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="k1301-"))
        try:
            dst = tmp / "canvas"
            shutil.copytree(ROOT / "04_design" / "canvas", dst)
            ml = dst / "MobileList.dc.html"
            plain = unwrap(ml.read_text(encoding="utf-8"))
            self.assertEqual(_find(plain, lambda n: _cls(n, "kn-mlist-head") or _cls(n, "kn-mlist-body")), [], "包む前の形を作れていない")
            ml.write_text(plain, encoding="utf-8")
            env = {**os.environ, "KANAME_CANVAS": str(dst) + "/"}
            for _ in range(2):
                r = subprocess.run([sys.executable, str(MB)], cwd=MB.parent, env=env, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stderr)
                if _ == 0:
                    once = ml.read_text(encoding="utf-8")
                    check_wrapped(self, once)
            self.assertEqual(ml.read_text(encoding="utf-8"), once, "2 回目で MobileList が変わった（2 重に包んだ）")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)

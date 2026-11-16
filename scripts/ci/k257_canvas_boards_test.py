#!/usr/bin/env python3
"""K-257 の試験（詳細・帯・小窓の絵を起こし直す）：絵のファイル・canvas.json・対応表・突き合わせの組・絵の文・幅の台帳・比べる 1 枚・作り手。

  python3 scripts/ci/k257_canvas_boards_test.py      行 ID は K257-CV-NNN（11_tickets/K-257.md の行の表と 1 対 1）

絵の形（幅・位置・小窓の置き場）を実 Chrome で数で見る行（K257-UI-NNN）は apps/web/tests/k/k257-canvas-boards.spec.ts が持つ。
K257-CV-010（代表が見比べの 1 枚を見て OK と言う）は人の確かめ（チケットの judge-skip）。
本物の木は読むだけ（作り手は写しの置き場 KANAME_CANVAS で流す）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import html.parser
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CANVAS = ROOT / "04_design" / "canvas"
GEN = ROOT / "04_design" / "canvas_gen"
BOARDS_JSON = CANVAS / "canvas.json"
MAP = ROOT / "04_design" / "canvas-screens.json"
FIDELITY = ROOT / "04_design" / "fidelity.json"
LEDGER = HERE / "canvas_layout_ledger.json"
REVIEW = ROOT / "04_design" / "canvas-review" / "K-257.html"

NEW = ["StApproveModal", "StReturnModal"]
DETAIL = ["TicketDetail", "StRunning", "StFailed", "StBefore", "StConfirmDone", "StDone", "StDelegated"]
PC = ["EdPC", "MePC", "MePCInstalled"]   # PC をつなぐの絵（画面に在ってキャンバスに無い操作を全部描き足す・決める人の答え answer=fd9dcd7a7cc8・形は PM の決め：今の画面の本物の形に絵を合わせる）
CHANGED = DETAIL + NEW + ["StCompleteModal", "Approvals"] + PC
# 絵に出す文（今の画面の本物の文）と、出さない文（絵の例の文・決めで使わない文）
TEXTS = {
    "TicketDetail": (["あなたの承認を待っています", "承認して送る", "自分で直す", "差し戻す", "止める", "確認 検査なし（まだ流していません）"], []),
    "StRunning": (["高本のAI が作っています", "AI と話す", "止める", "受け取る", "作る", "確かめる", "あなたの承認", "実行"], ["が実行しています"]),
    "StFailed": (["高本のAI が止まりました", "AI に任せる", "直し方を AI に伝える", "自分で直す", "検査なし（まだ流していません）"],
                 ["確認で 1 件落ちました", "AI を止める"]),
    "StBefore": (["AI に任せる", "高本のAI が実施事項を進め、確かめてから承認を待ちます"], []),
    "StConfirmDone": (["完了の条件を確かめて完了にしてください", "実施事項は全部終わりました", "完了にする"], []),
    "StDone": (["完了しました（高本・"], ["が完了にしました"]),
    "StDelegated": (["高本のAI に任せました。", "PC が受け取るのを待っています", "AI と話す"], []),
    "StApproveModal": (["承認して送ります", "取り消せません", "成果物を目で見た", "やめる", "承認して送る"], ["本人確認", "パスキー", "戻る"]),
    "StReturnModal": (["差し戻す", "どこを直すか", "理由", "必須", "次は誰が直すか", "AI に直させて、確認からやり直す", "自分で直す",
                       "この理由を AI に覚えさせる候補にする（ナレッジ更新の候補）", "やめる"], ["差し戻して作り直させる"]),
    "StCompleteModal": (["完了にする", "完了の条件", "実施事項", "完了の条件を満たしたことを確かめました", "やめる", "確かめて完了にする"], []),
    "Approvals": (["あなたが決めるもの", "期限切れ", "今日", "7 日以内", "それより後", "期限なし", "（今日）"], ["今週", "来週以降"]),
    "EdPC": (["常駐アプリを入れる", "Mac 用", "Windows 用", "10 分で切れる ・ この PC 専用の鍵が作られ、ほかの PC からは使えない", "新しいコード", "前の設定の画面"],
             []),   # 「…を受け取る」は aria-label に持たせてよいので全文では見ない（枠のボタンにしないことは K257-CV-011 が見る）
    "MePC": (["つないでいる PC", "切れている", "直し方", "Bridge を起こす", "前の設定の画面"], ["切れています"]),   # 戻るは絵にもとから「12/01 に戻る」があるので字では見ない（K257-CV-011 が a[data-act="back"] で見る）
    "MePCInstalled": (["この PC の Bridge につなぐ", "このアカウントに切り替える", "前の設定の画面"], []),
}
CATALOG = ROOT / "packages" / "errors" / "src" / "catalog.ts"
# 今の画面（apps/web/features/F3/connect-pc/connect-pc.tsx）に在って絵に無かった、ほかの 3 つ（決める人の答え：画面に残る操作は全部描き足す）
LEGACY_P = "Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、"   # 画面の「ほかの設定」の文（.k-desc：12px・#4A5563）
LINK_STYLE = ["color: #22345C", "text-decoration: underline"]   # .k-link
SWITCH_STYLE = ["height: 30px", "border-radius: 6px", "font-size: 12px", "border: 1.5px solid #B91C1C", "background: transparent", "color: #B91C1C"]   # 危ない操作のボタン（線と字が赤・地なし）。大きさは隣の「この PC の Bridge につなぐ」と同じ

# 新しいコードと Bridge を起こすの形（PM の決め：今の画面の本物の形に絵を合わせる。形は K-230 の「K-257 に描いてもらう形」と同じ）
NEW_CODE_STYLE = ["font-size: 12px", "border: none", "border-radius: 0", "background: none", "color: #22345C", "font-family: inherit", "font-weight: 400"]   # 字のリンクの形（地なし・線なし・角丸 0・字の色と太さと書体は 1 段目の「Mac 用」と同じ）
WAKE_STYLE = ["height: 30px", "background: #FFFFFF", "border: 1px solid #DDE2E9", "border-radius: 8px", "font-size: 12px", "font-weight: 600"]   # 画面のボタンの形（高さ 30・白地・灰の線・角丸 8・600。足の帯の「あとで」は角丸 6 で太さの指定なし）


def _close_of(s: str, start: int) -> int:
    """start の <span> の対になる </span> の位置（入れ子の span を数える）。見つからなければ -1"""
    depth = 0
    for t in re.finditer(r"<(/?)span\b", s[start:]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            return start + t.start()
    return -1


def _act(s: str, tag: str, act: str, label: str, name: str, style: list[str], bad: list[str]) -> int:
    """data-act=act の <tag> がちょうど 1 つで、字が label、style に style の値が全部在る。在る位置（無ければ -1）"""
    found = list(re.finditer(r'<%s\b([^>]*)data-act="%s"([^>]*)>\s*%s\s*</%s>' % (tag, act, re.escape(label), tag), s))
    if len(found) != 1 or s.count('data-act="%s"' % act) != 1:
        bad.append(f"{name}：data-act={act} の「{label}」の <{tag}> がちょうど 1 つでない")
        return -1
    attrs = found[0].group(1) + found[0].group(2)
    st = re.search(r'style="([^"]*)"', attrs)
    bad += [f"{name}：「{label}」の形に「{v}」が無い" for v in style if not st or v not in st.group(1)]
    return found[0].start()


def _other_acts() -> list[str]:
    """前の設定の画面（3 枚とも・本文の最後の「ほかの設定」の文の中）・戻る（MePC・頭の並びで題の前）・このアカウントに切り替える（MePCInstalled・つなぐの隣）と、見比べの 1 枚の「このときだけ出る」の 1 行"""
    bad: list[str] = []
    for n, after in (("EdPC", "つないでいる PC"), ("MePC", "つないでいる PC"), ("MePCInstalled", "この PC の Bridge につなぐ")):
        s = (CANVAS / f"{n}.dc.html").read_text(encoding="utf-8")
        at = _act(s, "a", "legacy", "前の設定の画面", n, LINK_STYLE, bad)
        if at < 0:
            continue
        if 'href="/setup/bridge/legacy"' not in s[at : s.find(">", at)]:
            bad.append(f"{n}：前の設定の画面の href が /setup/bridge/legacy でない")
        p = max((t.start() for t in re.finditer(r"<p[\s>]", s[:at])), default=-1)   # 前の設定の画面を含む段落の始まり（<path は除く）
        tail = s.find("</a>", at) + 4
        if not (0 <= s.find(after) < p and LEGACY_P in s[p:at] and re.match(r"で行えます。</p>\s*</section>", s[tail:])):
            bad.append(f"{n}：前の設定の画面が、本文の最後（段落の閉じのすぐ後が本文の </section>）の「{LEGACY_P}…で行えます。」の文の中に無い")
        elif not re.search(r'<p\b[^>]*style="[^"]*font-size: 12px[^"]*color: #4A5563', s[p : s.find(">", p) + 1]):
            bad.append(f"{n}：ほかの設定の文が 12px・#4A5563 でない")
    me = (CANVAS / "MePC.dc.html").read_text(encoding="utf-8")
    at = _act(me, "a", "back", "戻る", "MePC", LINK_STYLE, bad)
    main = me.find('<section style="flex: 1')
    head = me.rfind("<div", 0, me.find("<h1", main))   # 題の並び（h1 の親の横並びの div）
    if at >= 0 and not (0 <= main < head < at < me.find("<h1", main)):
        bad.append("MePC：戻るが本文の頭の並び（h1 と同じ親）の、題の前に無い")
    ins = (CANVAS / "MePCInstalled.dc.html").read_text(encoding="utf-8")
    at = _act(ins, "button", "switch-account", "このアカウントに切り替える", "MePCInstalled", SWITCH_STYLE, bad)
    btn = ins.find(">この PC の Bridge につなぐ</button>")
    if at >= 0 and not (0 <= btn < at < ins.find("</div>", btn)):
        bad.append("MePCInstalled：このアカウントに切り替えるが「この PC の Bridge につなぐ」と同じ並びの隣に無い")
    # 写して作る絵に写り込まない（その操作は決まった 1 枚だけ）
    for n, acts in (("EdPC", ("back", "switch-account")), ("MePC", ("switch-account",)), ("MePCInstalled", ("back", "wake", "new-code"))):
        s = (CANVAS / f"{n}.dc.html").read_text(encoding="utf-8")
        bad += [f"{n}：data-act={a} が写り込んでいる" for a in acts if f'data-act="{a}"' in s]
    review = REVIEW.read_text(encoding="utf-8")
    for n, word in (("MePC", "戻る"), ("MePCInstalled", "このアカウントに切り替える")):
        m = re.search(r'<section[^>]*data-board="%s"[^>]*>(.*?)</section>' % n, review, re.S)
        only = re.search(r'<p class="only">([^<]*)</p>', m.group(1)) if m else None
        if not (only and word in only.group(1) and "ときだけ出る" in only.group(1)):
            bad.append(f"見比べの 1 枚：{n} の区画に「{word}は…のときだけ出る」の 1 行（p.only）が無い")
    return bad


def _conn_message() -> str:
    """画面と同じ E-CONN-001 の文（packages/errors/src/catalog.ts）"""
    m = re.search(r'"E-CONN-001":\s*\{.*?"message":\s*"([^"]+)"', CATALOG.read_text(encoding="utf-8"), re.S)
    assert m, "E-CONN-001 の文が見つからない"
    return m.group(1)


class _Text(html.parser.HTMLParser):
    """絵の見える字（script・style・title の中を除く）"""

    def __init__(self) -> None:
        super().__init__()
        self.out: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):  # noqa: ANN001
        if tag in ("script", "style", "title"):
            self.skip += 1

    def handle_endtag(self, tag):  # noqa: ANN001
        if tag in ("script", "style", "title") and self.skip:
            self.skip -= 1

    def handle_data(self, data):  # noqa: ANN001
        if not self.skip:
            self.out.append(data)


def text_of(name: str) -> str:
    p = _Text()
    p.feed((CANVAS / f"{name}.dc.html").read_text(encoding="utf-8"))
    return re.sub(r"\s+", " ", " ".join(p.out))


def groups() -> dict[str, dict]:
    return {g["id"]: g for g in json.loads(FIDELITY.read_text(encoding="utf-8"))["groups"]}


class Boards(unittest.TestCase):
    def test_K257_CV_001_new_boards_registered(self):
        """K257-CV-001 新しい絵 StApproveModal・StReturnModal が 04_design/canvas に在り、canvas.json の boards（page states・空でない title）と対応表の画面 tickets に載る"""
        boards = {k.replace(".dc.html", ""): v for k, v in json.loads(BOARDS_JSON.read_text(encoding="utf-8"))["boards"].items()}
        tickets = json.loads(MAP.read_text(encoding="utf-8"))["screens"]["tickets"]
        for n in NEW:
            self.assertTrue((CANVAS / f"{n}.dc.html").is_file(), n)
            self.assertIn(n, boards, n)
            self.assertEqual(boards[n].get("page"), "states", n)
            self.assertTrue(str(boards[n].get("title", "")).strip(), n)
            self.assertIn(n, tickets, n)

    def test_K257_CV_002_canvas_gate(self):
        """K257-CV-002 canvas_gate.py が 0 で終わる（ファイルと boards が 1 対 1・どの絵もちょうど 1 か所）"""
        r = subprocess.run([sys.executable, "scripts/ci/canvas_gate.py"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K257_CV_003_fidelity_groups(self):
        """K257-CV-003 突き合わせの組：approve-modal の絵は StApproveModal・complete-modal の小窓のセレクタは role=dialog（× を持つふつうの小窓）・
        組 return-modal（kind dialog・絵 StReturnModal・道 /tickets/{ticket}・state return-modal・幅 1440 と 375・持ち主 K-229・enrolled false・役 dialog・dialog-title・primary）が在る"""
        g = groups()
        self.assertEqual(g["approve-modal"]["canvas"], "StApproveModal")
        self.assertTrue(all('role="alertdialog"' not in p["canvas"] for p in g["complete-modal"]["pairs"]))
        self.assertTrue(any('role="dialog"' in p["canvas"] for p in g["complete-modal"]["pairs"]))
        r = g.get("return-modal")
        self.assertTrue(r, "組 return-modal が無い")
        self.assertEqual(
            (r["kind"], r["canvas"], r["app"], r["state"], r["widths"], r["owner"], r["enrolled"]),
            ("dialog", "StReturnModal", "/tickets/{ticket}", "return-modal", [1440, 375], "K-229", False),
        )
        self.assertEqual(sorted(p["role"] for p in r["pairs"]), ["dialog", "dialog-title", "primary"])

    def test_K257_CV_004_real_texts(self):
        """K257-CV-004 絵の文は今の画面の本物の文：絵ごとに出す文が見える字に全部在り、出さない文（絵の例の文・決めで使わない文）が台本を含む全文に無く、台本の差し込みが字のまま残らない"""
        bad = []
        for n, (want, never) in TEXTS.items():
            t = text_of(n)
            whole = (CANVAS / f"{n}.dc.html").read_text(encoding="utf-8")   # 出さない文は台本の中も含めた全文で見る（台本から描く絵の空振りを止める）
            bad += [f"{n}：「{w}」が無い" for w in want if w not in t]
            bad += [f"{n}：「{w}」が在る" for w in never if w in whole]
            if "{{" in t:
                bad.append(f"{n}：台本の差し込み（{{{{…}}}}）が字のまま残る")
        self.assertEqual(bad, [])

    def test_K257_CV_005_approvals_groups(self):
        """K257-CV-005 承認待ちの絵の期限の区切りは今の画面の 5 つ（期限切れ・今日・7 日以内・それより後・期限なし）がこの順で、件数つき（「〈名前〉　N 件」）"""
        t = text_of("Approvals")
        found = [m.group(1) for m in re.finditer(r"(期限切れ|今日|7 日以内|それより後|期限なし)\s+\d+ 件", t)]
        self.assertEqual(found, ["期限切れ", "今日", "7 日以内", "それより後", "期限なし"])

    def test_K257_CV_006_ledger_cleared(self):
        """K257-CV-006 幅の台帳（K-254）に TicketDetail・StRunning・StFailed が無い（このチケットで直した）"""
        names = {e["board"] for e in json.loads(LEDGER.read_text(encoding="utf-8"))["entries"]}
        self.assertEqual(names & {"TicketDetail", "StRunning", "StFailed"}, set())

    def test_K257_CV_007_review_page(self):
        """K257-CV-007 見比べの 1 枚 04_design/canvas-review/K-257.html：変えた 14 枚ごとに section[data-board] が在り、直す前（canvas-review/K-257/before/<絵>.html・ファイルが在る）と後（../canvas/<絵>.dc.html）の iframe と、違いを書いた平易な日本語の段落（.why・20 字以上）を持ち、直す前と後の中身が違う"""
        s = REVIEW.read_text(encoding="utf-8")
        bad = []
        for n in CHANGED:
            m = re.search(r'<section[^>]*data-board="%s"[^>]*>(.*?)</section>' % re.escape(n), s, re.S)
            if not m:
                bad.append(f"{n}：区画が無い")
                continue
            body = m.group(1)
            before = "StModal" if n in NEW else n
            if f'src="K-257/before/{before}.html"' not in body:
                bad.append(f"{n}：直す前の iframe が無い")
            elif not (REVIEW.parent / "K-257" / "before" / f"{before}.html").is_file():
                bad.append(f"{n}：直す前のファイルが無い")
            elif n not in NEW and (REVIEW.parent / "K-257" / "before" / f"{before}.html").read_text(encoding="utf-8") == (CANVAS / f"{n}.dc.html").read_text(encoding="utf-8"):
                bad.append(f"{n}：直す前と後が同じ中身")
            if f'src="../canvas/{n}.dc.html"' not in body:
                bad.append(f"{n}：直した後の iframe が無い")
            why = re.search(r'<p class="why">(.*?)</p>', body, re.S)
            if not why or len(re.sub(r"<[^>]+>|\s", "", why.group(1))) < 20:
                bad.append(f"{n}：違いの説明が無いか短い")
        self.assertEqual(bad, [])

    def test_K257_CV_008_generator_stable(self):
        """K257-CV-008 作り手 k257.py が在り、キャンバスの写しに k257.py と shellfix.py を流しても、どの絵も 1 字も変わらない（手で書いた所が無い）"""
        self.assertTrue((GEN / "k257.py").is_file())
        with tempfile.TemporaryDirectory() as d:
            for f in CANVAS.glob("*.dc.html"):
                shutil.copy(f, d)
            env = dict(os.environ, KANAME_CANVAS=d.rstrip("/") + "/", K257_NO_SIDEFILES="1")
            for script in ("k257.py", "shellfix.py"):
                r = subprocess.run([sys.executable, script], cwd=GEN, env=env, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, script + r.stdout + r.stderr)
            changed = [f.name for f in CANVAS.glob("*.dc.html") if (pathlib.Path(d) / f.name).read_text(encoding="utf-8") != f.read_text(encoding="utf-8")]
        self.assertEqual(changed, [])

    def _tree(self, d: str) -> pathlib.Path:
        """作り手と絵と設定の写しの木（本物の木は読むだけ）。作り手は写しの木の中の 04_design/canvas_gen を流す"""
        t = pathlib.Path(d)
        shutil.copytree(ROOT / "04_design", t / "04_design", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copytree(ROOT / "11_tickets", t / "11_tickets")
        (t / "packages" / "errors" / "src").mkdir(parents=True)
        shutil.copy(CATALOG, t / "packages" / "errors" / "src" / "catalog.ts")
        return t

    def _run(self, t: pathlib.Path, script: str) -> None:
        env = {k: v for k, v in os.environ.items() if k not in ("KANAME_CANVAS", "K257_NO_SIDEFILES")}
        r = subprocess.run([sys.executable, script], cwd=t / "04_design" / "canvas_gen", env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, script + r.stdout[-2000:] + r.stderr[-2000:])

    def test_K257_CV_008_sidefiles_kept(self):
        """K257-CV-008 作り手を設定ごと流し直しても（K257_NO_SIDEFILES なし）、持ち主が後から直した物は戻らない：写しの木で
        組 return-modal・approvals-empty を enrolled: true に、bridge-code の「足のボタン（あとで）」の画面の側のセレクタを替え、canvas.json の StFailed・StApproveModal の題を替えてから
        k257.py と k219.py を流しても、fidelity.json・canvas.json・canvas-screens.json・見比べの 1 枚 K-257.html・K-219.html は 1 字も変わらない（組と絵の置き場は無いときだけ足す）。
        k257.py の後は、どの絵も 1 字も変わらない"""
        with tempfile.TemporaryDirectory() as d:
            t = self._tree(d)
            fp = t / "04_design" / "fidelity.json"
            f = json.loads(fp.read_text(encoding="utf-8"))

            def edit(g: dict) -> dict:
                if g["id"] in ("return-modal", "approvals-empty"):
                    return {**g, "enrolled": True}
                if g["id"] == "bridge-code":
                    return {**g, "pairs": [{**p, "app": ".k-dialog-actions .k-btn"} if p["name"] == "足のボタン（あとで）" else p for p in g["pairs"]]}
                return g

            f["groups"] = [edit(g) for g in f["groups"]]
            fp.write_text(json.dumps(f, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            cp = t / "04_design" / "canvas" / "canvas.json"
            c = json.loads(cp.read_text(encoding="utf-8"))
            for k in ("StFailed.dc.html", "StApproveModal.dc.html"):
                c["boards"][k] = {**c["boards"][k], "title": "持ち主が直した題"}
            cp.write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
            files = ["04_design/fidelity.json", "04_design/canvas/canvas.json", "04_design/canvas-screens.json",
                     "04_design/canvas-review/K-257.html", "04_design/canvas-review/K-219.html"]
            before = {p: (t / p).read_text(encoding="utf-8") for p in files}
            boards = {f.name: f.read_text(encoding="utf-8") for f in (t / "04_design" / "canvas").glob("*.dc.html")}
            self._run(t, "k257.py")
            changed = [n for n, s in boards.items() if (t / "04_design" / "canvas" / n).read_text(encoding="utf-8") != s]
            self._run(t, "k219.py")
            changed += [p for p in files if (t / p).read_text(encoding="utf-8") != before[p]]
        self.assertEqual(changed, [])

    def test_K257_CV_008_other_generators(self):
        """K257-CV-008 承認待ちの絵の持ち主も k257.py：lists.py か k219.py を単独で流しても、その後に k257.py を流しても、
        このチケットの絵（変えた 14 枚と ApEmpty）は今の木と 1 字も変わらない（lists.py は Approvals を書かない・k219.py は今の Approvals から同じ ApEmpty を作る）"""
        mine = [f"{n}.dc.html" for n in CHANGED + ["ApEmpty"]]
        bad = []
        for other in ("lists.py", "k219.py"):
            with tempfile.TemporaryDirectory() as d:
                t = self._tree(d)
                for step, script in (("単独", other), ("k257.py の後", "k257.py")):
                    self._run(t, script)
                    bad += [f"{other}（{step}）：{n}" for n in mine if (t / "04_design" / "canvas" / n).read_text(encoding="utf-8") != (CANVAS / n).read_text(encoding="utf-8")]
        self.assertEqual(bad, [])

    def test_K257_CV_011_pc_actions(self):
        """K257-CV-011 PC をつなぐの絵に、今の画面に在って絵に無かった操作を全部、画面の本物の文と形で描き足す：EdPC の 2 段目の説明の行の中に button[data-act="new-code"]「新しいコード」（字のリンクの形）、MePC の切れている行の直し方の箱の中に E-CONN-001 の文と button[data-act="wake"]「Bridge を起こす」、3 枚とも本文の最後の「ほかの設定」の文の中に a[data-act="legacy"]「前の設定の画面」、MePC の頭の並びで題の前に a[data-act="back"]「戻る」（EdPC・MePCInstalled には無い）、MePCInstalled のつなぐの隣に button[data-act="switch-account"]「このアカウントに切り替える」（危ない操作の形）。条件つきの 2 つ（戻る・切り替える）は見比べの 1 枚に「…のときだけ出る」の 1 行。受け取るは字のリンクのまま（枠のボタンにしない）・行は足さない（札 3 つ・最後に見えた 1 つのまま）"""
        bad = []
        ed = (CANVAS / "EdPC.dc.html").read_text(encoding="utf-8")
        me = (CANVAS / "MePC.dc.html").read_text(encoding="utf-8")

        def one(s: str, act: str, label: str, name: str) -> re.Match | None:
            found = list(re.finditer(r'<button\b([^>]*)data-act="%s"([^>]*)>\s*%s\s*</button>' % (act, re.escape(label)), s))
            if len(found) != 1 or s.count('data-act="%s"' % act) != 1:
                bad.append(f"{name}：data-act={act} の「{label}」の button がちょうど 1 つでない")
                return None
            return found[0]

        m = one(ed, "new-code", "新しいコード", "EdPC")
        if m:
            line = ed.find("10 分で切れる ・ この PC 専用の鍵")
            end = ed.find("</div>", line)
            if not (0 <= line < m.start() < end):
                bad.append("EdPC：新しいコードが 2 段目の説明の行（10 分で切れる…）の中に無い")
            style = re.search(r'style="([^"]*)"', m.group(1) + m.group(2))
            for v in NEW_CODE_STYLE:
                if not style or v not in style.group(1):
                    bad.append(f"EdPC：新しいコードの形に「{v}」が無い")
        for label in ("Mac 用", "Windows 用"):
            if not re.search(r"<a\b[^>]*>%s</a>" % re.escape(label), ed):
                bad.append(f"EdPC：受け取るの字のリンク「{label}」が無い")
            if re.search(r"<button\b[^>]*>[^<]*%s" % re.escape(label), ed):
                bad.append(f"EdPC：「{label}」が枠のボタンになっている")
        m = one(me, "wake", "Bridge を起こす", "MePC")
        if m:
            row = me.find("切れている</span>")
            box = me.rfind("<span", 0, me.find("background: #FFF8EE", row))
            end = _close_of(me, box)   # 直し方の箱の span の対になる閉じタグ（入れ子を数える）
            if not (0 <= row < box < m.start() < end):
                bad.append("MePC：Bridge を起こすが切れている行の直し方の箱の中に無い")
            elif me.find(_conn_message(), box) not in range(box, end):
                bad.append("MePC：直し方の箱に E-CONN-001 の文が無い")
            style = re.search(r'style="([^"]*)"', m.group(1) + m.group(2))
            for v in WAKE_STYLE:
                if not style or v not in style.group(1):
                    bad.append(f"MePC：Bridge を起こすの形に「{v}」が無い")
        if 'data-act="wake"' in ed or _conn_message() in ed:
            bad.append("EdPC：後ろに写る PC の一覧に Bridge を起こすか E-CONN-001 の文を足している（EdPC は新しいコードだけ）")
        for n, s in (("EdPC", ed), ("MePC", me)):
            if s.count("border-radius: 9999px; padding: 1px 8px") != 3 or s.count("最後に見えた") != 1:
                bad.append(f"{n}：行が増えた（札 3 つ・最後に見えた 1 つのまま）")
        bad += _other_acts()
        self.assertEqual(bad, [])

    def test_K257_CV_012_title_size_section(self):
        """K257-CV-012 見比べの 1 枚に、題の大きさを決める人が選ぶ区画 section[data-board="title-size"] が在り、「題が 22px の今の絵」（K-257/before/title-22.html・h1 が 22px・題のほかは起こし直した絵と同じ）と「20px に寄せた絵」（../canvas/TicketDetail.dc.html・h1 が 20px）の iframe と、違いの説明（.why・20 字以上）を持つ"""
        s = REVIEW.read_text(encoding="utf-8")
        m = re.search(r'<section[^>]*data-board="title-size"[^>]*>(.*?)</section>', s, re.S)
        self.assertTrue(m, "題の大きさの区画が無い")
        body = m.group(1)
        self.assertIn('src="K-257/before/title-22.html"', body)
        self.assertIn('src="../canvas/TicketDetail.dc.html"', body)
        why = re.search(r'<p class="why">(.*?)</p>', body, re.S)
        self.assertTrue(why and len(re.sub(r"<[^>]+>|\s", "", why.group(1))) >= 20)
        h22 = (REVIEW.parent / "K-257" / "before" / "title-22.html").read_text(encoding="utf-8")
        h20 = (CANVAS / "TicketDetail.dc.html").read_text(encoding="utf-8")
        self.assertRegex(h22, r"<h1[^>]*font-size: ?22px")
        self.assertRegex(h20, r"<h1[^>]*font-size: ?20px")
        # 題のほかは起こし直した絵とちょうど同じ（決める人が題の大きさだけを見比べられる）
        self.assertEqual(re.sub(r"(<h1[^>]*font-size: ?)22px", r"\g<1>20px", h22, count=1), h20)

    def test_K257_CV_013_k219_review_unchanged(self):
        """K257-CV-013 k219.py の見比べの 1 枚の作り方（review_sheet）を写しの置き場で流すと、今の 04_design/canvas-review/K-219.html と一字同じ
        （k219.py から移した 6 枚の絵は書かないが、見比べの区画は残す。作り手を流し直しても見比べが変わらない）"""
        code = (
            "import sys, pathlib\n"
            "sys.path.insert(0, sys.argv[1])\n"
            "import k219\n"
            "k219.ROOT = sys.argv[2]\n"
            "k219.review_sheet()\n"
        )
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ, KANAME_CANVAS=str(CANVAS) + "/")   # 絵は読むだけ（review_sheet は絵を書かない）
            r = subprocess.run([sys.executable, "-c", code, str(GEN), d], cwd=GEN, env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            got = (pathlib.Path(d) / "04_design" / "canvas-review" / "K-219.html").read_text(encoding="utf-8")
        self.assertEqual(got, (ROOT / "04_design" / "canvas-review" / "K-219.html").read_text(encoding="utf-8"))

    def test_K257_CV_009_no_showcase_for_owned_groups(self):
        """K257-CV-009 段 1 の小窓の組（approve-modal・complete-modal・return-modal）の絵は、どれも小窓がちょうど 1 つの絵（role=dialog と alertdialog の section が 1 つ）"""
        bad = []
        for gid in ("approve-modal", "complete-modal", "return-modal"):
            n = groups()[gid]["canvas"]
            k = len(re.findall(r'<section[^>]*role="(?:alert)?dialog"', (CANVAS / f"{n}.dc.html").read_text(encoding="utf-8")))
            if k != 1:
                bad.append(f"{gid}（{n}）：小窓 {k} 個")
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)

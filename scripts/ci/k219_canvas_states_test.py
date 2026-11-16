#!/usr/bin/env python3
"""K-219 の試験（キャンバスに絵が無い状態の絵）：13 枚の絵・canvas.json・対応表・突き合わせの組・持ち主の頭・比べる 1 枚。

  python3 scripts/ci/k219_canvas_states_test.py      行 ID は K219-CV-NNN（11_tickets/K-219.md の行の表と 1 対 1）

組のセレクタが本当に絵の要素に当たるか（K219-CV-009）は apps/web/tests/k/k219-canvas-boards.spec.ts（実 Chrome）が持つ。
K219-CV-011（代表が絵を見て OK と言う）は人の確かめ（チケットの judge-skip）。
本物の木は読むだけ（検査の台本を流すだけ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import html
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

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CANVAS = ROOT / "04_design" / "canvas"
BOARDS_JSON = CANVAS / "canvas.json"
MAP = ROOT / "04_design" / "canvas-screens.json"
FIDELITY = ROOT / "04_design" / "fidelity.json"
REVIEW = ROOT / "04_design" / "canvas-review" / "K-219.html"
TICKETS = ROOT / "11_tickets"
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
SHELLFIX = ROOT / "04_design" / "canvas_gen" / "shellfix.py"

# 絵: (近い絵, page, 画面, 組の id, 種類, 画面の道, 持ち主, 出す文)
NEW = {
    "AuthVerifying": ("AuthVerify", "auth", "verify-email", "verify-confirming", "doc", "/verify-email", "K-222",
                      ["確認しています", "登録を確定しています…"]),
    "AuthVerifyExpired": ("ErrLinkExpired", "auth", "verify-email", "verify-expired", "auth-msg", "/verify-email", "K-222",
                          ["リンクの期限が切れました"]),
    "AuthVerifyUsed": ("AuthVerify", "auth", "verify-email", "verify-used", "auth-msg", "/verify-email", "K-222",
                       ["登録は終わっています"]),
    "AuthConsent": ("AuthVerify", "auth", "login", "consent-terms", "auth-msg", "/login?step=terms", "K-222",
                    ["利用規約とプライバシーポリシーが新しくなりました", "同意"]),
    "AuthChecking": ("AuthSignup", "auth", "signup", "signup-checking", "doc", "/signup", "K-255", ["確かめています"]),
    "AuthVerifyLoading": ("AuthVerify", "auth", "verify-email", "signup-waiting-loading", "doc", "/verify-email", "K-255",
                          ["読み込んでいます"]),
    "StBefore": ("StRunning", "states", "tickets", "band-before", "band", "/tickets/{ticket}", "K-228", ["AI に任せる"]),
    "StConfirmDone": ("StRunning", "states", "tickets", "band-confirm-done", "band", "/tickets/{ticket}", "K-228",
                      ["完了の条件を確かめて完了にしてください", "完了にする"]),
    "StDone": ("StRunning", "states", "tickets", "band-done", "band", "/tickets/{ticket}", "K-228", ["完了しました"]),
    "StDelegated": ("StRunning", "states", "tickets", "band-delegated", "band", "/tickets/{ticket}", "K-228", ["に任せました"]),
    "StCompleteModal": ("StModal", "states", "tickets", "complete-modal", "dialog", "/tickets/{ticket}", "K-229",
                        ["完了にする", "完了の条件"]),
    "ApEmpty": ("Approvals", "approvals", "approvals", "approvals-empty", "page", "/approvals", "K-231",
                ["いま決めるものはありません"]),
    "MePCInstalled": ("MePC", "me", "bridge-setup", "bridge-installed", "page", "/setup/bridge", "K-230", ["この PC の Bridge"]),
}
EXTRA = ["UiDisabled", "OnHomeLater"]  # 表の 13 枚のほかに作り手が新しく描く絵（使えない形の見本・「あとで」の絵）
OPACITY = r"opacity:\s*0?\.55"
DISABLED_KINDS = {"button": "ボタン", "select": "選ぶ欄", "search": "探す欄", "menuitem": "メニューの項目", "tab": "見え方のタブ"}
NOTE_WORDS = ["3 秒たっても", "すぐ終わるときは"]  # 3 秒の決まりの注記（設計者の説明。絵には描かず比べる 1 枚の「違い：」だけに書く）
NAV = re.compile(r'<nav aria-label="メニュー".*?</nav>', re.S)
BADGE = re.compile(r'<b class="kn-lbl"[^>]*>\s*\d+\s*</b>')
GROUP_N = re.compile(r'<span class="kn-lbl" style="margin-left: auto; font-size: 12px; color: #4A5563">(\d+)</span>')
KIND_WIDTHS = {"doc": [1440, 375], "auth-msg": [1440, 375], "band": [1440, 375], "dialog": [1440, 375], "page": [1440, 375]}


def clean_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def load(p: pathlib.Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def head_of(tid: str) -> dict:
    """チケットの頭の `キー: [a, b]` の並びを読む（頭は YAML ではない：affects の @kaname/web のような値を YAML は読めない。
    チケットの道具（build_index・ticket-flow の header_list）と同じ読み方）"""
    m = re.match(r"^---\n(.*?)\n---\n", (TICKETS / f"{tid}.md").read_text(encoding="utf-8"), re.S)
    assert m, f"{tid} に頭が無い"
    out: dict = {}
    for line in m.group(1).splitlines():
        k, sep, v = line.partition(":")
        v = v.strip()
        if sep and v.startswith("[") and v.endswith("]"):
            out[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
    return out


def review_sections(text: str) -> dict[str, tuple[str, str]]:
    """比べる 1 枚の区画：data-board → (区画の始まりのタグ, 次の data-board の区画までの中身)。区画の中の入れ子の section で切れない"""
    starts = list(re.finditer(r'<section[^>]*data-board="([^"]+)"[^>]*>', text))
    out: dict[str, tuple[str, str]] = {}
    for i, m in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
        out[m.group(1)] = (m.group(0), text[m.end():end])
    return out


class KindParts(html.parser.HTMLParser):
    """data-kind の区画ごとに、押せる部品（button・select・input[type=search]・role=menuitem・role=tab）の
    使える形（aria-disabled が無い）と使えない形（aria-disabled="true"）を数える"""

    VOID = {"input", "br", "img", "hr", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "param", "track"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, str | None]] = []
        self.found: dict[str, dict[str, int]] = {}

    def _kind(self) -> str | None:
        for _tag, k in reversed(self.stack):
            if k:
                return k
        return None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v or "") for k, v in attrs}
        kind = self._kind() if "data-kind" not in a else a["data-kind"]
        part = {"button": "button", "select": "select"}.get(tag)
        if tag == "input" and a.get("type") == "search":
            part = "search"
        if a.get("role") in ("menuitem", "tab"):
            part = a["role"]
        if kind and part == kind:
            c = self.found.setdefault(kind, {"usable": 0, "disabled": 0})
            if a.get("aria-disabled") == "true":
                if re.search(OPACITY, a.get("style", "")):
                    c["disabled"] += 1
            elif "aria-disabled" not in a and "disabled" not in a:
                c["usable"] += 1
        if tag not in self.VOID:
            self.stack.append((tag, a.get("data-kind")))

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return


def groups() -> dict[str, dict]:
    return {g["id"]: g for g in load(FIDELITY)["groups"]}


def owner_in(owner: str) -> str:
    """組を入れて（enrolled: true）よい持ち主か。持ち主が決める（K-255）：
    この木の履歴に件名が「<持ち主> 」で始まるコミットが在る（持ち主の実装がこの木に入っている）か、持ち主の md の stage が確認中か完了か、
    今の CI のチケット（環境の CI_TICKET）が持ち主。取り込み済みの判定は突き合わせの設定の見張り（fidelity_config.py の merged_reason）と同じ。
    入っていいなら訳、まだなら空"""
    sys.path.insert(0, str(HERE))
    try:
        import fidelity_config as fc
    finally:
        sys.path.pop(0)
    subjects, errs = fc.history_subjects(ROOT, "HEAD")
    assert not errs, errs
    kids, stages = fc.ticket_tree(ROOT)
    return fc.merged_reason(owner, kids, stages, subjects or [], os.environ.get("CI_TICKET", "").strip())


def nav_of(body: str) -> str:
    m = NAV.search(body)
    assert m, "左のバーが無い"
    return m.group(0)


def visible_text(body: str) -> str:
    """絵に見える文（helmet・script・タグを外す）"""
    body = re.sub(r"<helmet>.*?</helmet>|<script\b.*?</script>|<style\b.*?</style>", " ", body, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", " ", body))


def styles(tag: str) -> dict[str, str]:
    m = re.search(r'style="([^"]*)"', tag)
    out: dict[str, str] = {}
    for part in (m.group(1) if m else "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip().lower()] = " ".join(v.split()).lower()
    return out


def element_end(body: str, start: int) -> int:
    """body[start] の開きタグに対応する閉じタグの終わり（同じタグ名の入れ子を数える）"""
    tag = re.match(r"<(\w+)", body[start:]).group(1)
    depth = 0
    for m in re.compile(r"<(/?)%s\b[^>]*>" % tag).finditer(body, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.end()
    raise AssertionError(f"<{tag}> の閉じタグが無い")


def design_tokens() -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", DESIGN.read_text(encoding="utf-8"), re.S)
    assert m, "正本に頭が無い"
    return yaml.safe_load(m.group(1))


def resolve(tokens: dict, value: str) -> str:
    def one(m: re.Match) -> str:
        cur: object = tokens
        for k in m.group(1).split("."):
            cur = cur[k]  # type: ignore[index]
        return str(cur)
    return re.sub(r"\{([\w.-]+)\}", one, str(value))


class BarAndBoxTest(unittest.TestCase):
    def _bars(self, folder: pathlib.Path) -> None:
        ap = nav_of((folder / "ApEmpty.dc.html").read_text(encoding="utf-8"))
        self.assertEqual(BADGE.findall(ap), [], "承認待ちが空の絵のバーに件数の印がある")
        self.assertRegex(ap, r'<a href="Approvals\.dc\.html" title="承認待ち" aria-current="page"', "今いる所が承認待ちでない")
        later = nav_of((folder / "OnHomeLater.dc.html").read_text(encoding="utf-8"))
        counts = GROUP_N.findall(later)
        self.assertGreaterEqual(len(counts), 3, "グループの数が読めない")
        self.assertEqual(set(counts), {"0"}, f"グループの数が 0 でない：{counts}")
        self.assertIn("PC がまだ", later)
        self.assertEqual(BADGE.findall(later), [], "「あとで」の絵のバーに件数の印がある")

    def test_K219_CV_014_bars(self) -> None:
        """K219-CV-014 承認待ちが空の絵のバーに件数の印が無く今いる所が承認待ち・「あとで」の絵のバーはグループ 0 件で「PC がまだ」。
        写しの木で shellfix.py を回し直した後も同じ"""
        self._bars(CANVAS)
        with tempfile.TemporaryDirectory() as tmp:
            for f in CANVAS.glob("*.dc.html"):
                shutil.copy(f, tmp)
            env = {**clean_env(), "KANAME_CANVAS": tmp + "/"}
            r = subprocess.run([sys.executable, str(SHELLFIX)], cwd=SHELLFIX.parent, capture_output=True, text=True, env=env, timeout=300)
            self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-2000:])
            self._bars(pathlib.Path(tmp))

    def test_K219_CV_015_empty_box(self) -> None:
        """K219-CV-015 承認待ちが空の絵の空の箱は正本の state-empty の値（地・1px dashed の線・角丸・余白・間と、間が効く display）で、箱の中に文が在る"""
        body = (CANVAS / "ApEmpty.dc.html").read_text(encoding="utf-8")
        tags = list(re.finditer(r'<[^>]*data-part="state-empty"[^>]*>', body))
        self.assertEqual(len(tags), 1, "空の箱がちょうど 1 つでない")
        tok = design_tokens()
        want = tok["components"]["state-empty"]
        got = styles(tags[0].group(0))
        bg = got.get("background-color", got.get("background", ""))
        self.assertEqual(bg, resolve(tok, want["backgroundColor"]).lower(), "地")
        self.assertEqual(got.get("border"), " ".join(resolve(tok, want["border"]).split()).lower(), "線")
        self.assertEqual(got.get("border-radius"), resolve(tok, want["rounded"]).lower(), "角丸")
        self.assertEqual(got.get("padding"), resolve(tok, want["padding"]).lower(), "余白")
        self.assertEqual(got.get("gap"), resolve(tok, want["gap"]).lower(), "間")
        self.assertIn(got.get("display"), ("flex", "inline-flex", "grid"), "間が効かない（display が flex か grid でない）")
        inside = body[tags[0].end():element_end(body, tags[0].start())]
        self.assertIn("いま決めるものはありません", visible_text(inside), "空の箱の中に文が無い")

    def test_K219_CV_016_no_designer_note(self) -> None:
        """K219-CV-016 新しい 15 枚に 3 秒の決まりの注記（設計者の説明）が無く、比べる 1 枚の「違い：」に在る"""
        for name in [*NEW, *EXTRA]:
            text = visible_text((CANVAS / f"{name}.dc.html").read_text(encoding="utf-8"))
            for w in NOTE_WORDS:
                self.assertNotIn(w, text, f"{name} に設計者の説明「{w}」がある")
        review = REVIEW.read_text(encoding="utf-8")
        diffs = " ".join(re.findall(r"<li>違い：(.*?)</li>", review))
        self.assertIn(NOTE_WORDS[0], diffs)


class BoardsTest(unittest.TestCase):
    def test_K219_CV_001_boards_exist(self) -> None:
        """K219-CV-001 新しい絵 13 枚が在り、canvas.json の boards に page（表のとおり）と title つきで在る"""
        boards = load(BOARDS_JSON)["boards"]
        for name, (_ref, page, *_rest) in NEW.items():
            self.assertTrue((CANVAS / f"{name}.dc.html").exists(), name)
            b = boards.get(f"{name}.dc.html")
            self.assertIsNotNone(b, f"{name} が canvas.json に無い")
            self.assertEqual(b.get("page"), page, name)
            self.assertTrue(str(b.get("title", "")).strip(), f"{name} の title が空")

    def test_K219_CV_002_screen_map(self) -> None:
        """K219-CV-002 13 枚が対応表の表どおりの画面に載り、ほかの画面と共通には無い"""
        mp = load(MAP)
        for name, (_ref, _page, screen, *_rest) in NEW.items():
            where = [k for k, v in mp["screens"].items() if name in v]
            self.assertEqual(where, [screen], name)
            self.assertNotIn(name, mp["common"]["boards"], name)

    def test_K219_CV_003_onhome_onloading(self) -> None:
        """K219-CV-003 OnHome・OnLoading は screens.tickets に在り、common.boards に無い"""
        mp = load(MAP)
        for name in ("OnHome", "OnLoading"):
            self.assertIn(name, mp["screens"]["tickets"], name)
            self.assertNotIn(name, mp["common"]["boards"], name)

    def test_K219_CV_004_canvas_gate(self) -> None:
        """K219-CV-004 canvas_gate.py が 0 で終わる"""
        r = subprocess.run([sys.executable, "scripts/ci/canvas_gate.py"], cwd=ROOT, capture_output=True, text=True,
                           env=clean_env(), timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K219_CV_007_texts(self) -> None:
        """K219-CV-007 13 枚それぞれに表の「出す文」が全部在る"""
        for name, (*_rest, texts) in NEW.items():
            body = html.unescape((CANVAS / f"{name}.dc.html").read_text(encoding="utf-8"))
            for t in texts:
                self.assertIn(t, body, f"{name} に「{t}」が無い")


class FidelityTest(unittest.TestCase):
    def test_K219_CV_005_groups(self) -> None:
        """K219-CV-005 突き合わせの設定の 13 組が表どおりで、fidelity_config.py --no-base が 0 で終わる"""
        got = groups()
        for name, (_ref, _page, _screen, gid, kind, app, owner, _texts) in NEW.items():
            g = got.get(gid)
            self.assertIsNotNone(g, f"組 {gid} が無い")
            self.assertEqual((g["kind"], g["canvas"], g["app"], g["owner"]), (kind, name, app, owner), gid)
            self.assertEqual(g["state"], gid, gid)
            # 入れるかは組の持ち主が決める（K-255）。持ち主がまだなら入っていない（false）、持ち主が来ていれば true を許す
            self.assertIsInstance(g["enrolled"], bool, gid)
            if g["enrolled"]:
                self.assertTrue(owner_in(owner), f"{gid}：持ち主 {owner} がまだなのに enrolled: true")
            self.assertTrue(set(KIND_WIDTHS[kind]) <= set(g["widths"]), gid)
            self.assertTrue(g["pairs"], gid)
        r = subprocess.run([sys.executable, "scripts/ci/fidelity_config.py", "--no-base"], cwd=ROOT,
                           capture_output=True, text=True, env=clean_env(), timeout=120)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K219_CV_006_owner_heads(self) -> None:
        """K219-CV-006 持ち主の頭の canvas に、それぞれが持つ組の id が全部在る"""
        want: dict[str, set[str]] = {}
        for (_ref, _page, _screen, gid, _kind, _app, owner, _texts) in NEW.values():
            want.setdefault(owner, set()).add(gid)
        for owner, ids in want.items():
            have = set(head_of(owner).get("canvas") or [])
            self.assertTrue(ids <= have, f"{owner} の canvas に {sorted(ids - have)} が無い")

    def test_K219_CV_010_board_values(self) -> None:
        """K219-CV-010 新しい絵 15 枚（表の 13 枚と UiDisabled・OnHomeLater）は正本に無い色・書体・角丸・文字の大きさを使わない（design_gate の D1〜D4 が 0 件）"""
        names = [*NEW, *EXTRA]
        files = [str(CANVAS / f"{n}.dc.html") for n in names]
        r = subprocess.run([sys.executable, "scripts/ci/design_gate.py", "--design", "04_design/DESIGN-kaname.md",
                            "--mocks", *files, "--part", "--json"], cwd=ROOT, capture_output=True, text=True,
                           env=clean_env(), timeout=120)
        out = json.loads(r.stdout)
        for k in ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い", "D4_文字_段に無い"):
            self.assertEqual(out[k], {}, k)
        self.assertEqual(out["files"], len(names))


class ReviewTest(unittest.TestCase):
    def test_K219_CV_008_review_sheet(self) -> None:
        """K219-CV-008 比べる 1 枚：13 枚それぞれに data-board と data-ref の区画・「違い：」の行・2 つの絵を指す iframe"""
        text = REVIEW.read_text(encoding="utf-8")
        sections = review_sections(text)
        for name, (ref, *_rest) in NEW.items():
            self.assertIn(name, sections, f"{name} の区画が無い")
            start, body = sections[name]
            self.assertIn(f'data-ref="{ref}"', start, name)
            self.assertIn("違い：", body, name)
            self.assertRegex(body, rf'<iframe[^>]+src="[^"]*canvas/{name}\.dc\.html"', name)
            self.assertRegex(body, rf'<iframe[^>]+src="[^"]*canvas/{ref}\.dc\.html"', name)


class DisabledSampleTest(unittest.TestCase):
    def test_K219_CV_012_disabled_sample(self) -> None:
        """K219-CV-012 使えない状態（グレー）の見本の絵 UiDisabled：canvas.json（page on）と対応表の共通に在り、5 種（button・select・search・
        menuitem・tab）の区画それぞれに使える形と使えない形（aria-disabled と不透明度 0.55）が 1 つ以上ずつ在り、比べる 1 枚に区画が在る（D-145.9）"""
        name = "UiDisabled"
        body = (CANVAS / f"{name}.dc.html").read_text(encoding="utf-8")
        self.assertEqual(load(BOARDS_JSON)["boards"].get(f"{name}.dc.html", {}).get("page"), "on")
        mp = load(MAP)
        self.assertIn(name, mp["common"]["boards"])
        self.assertEqual([k for k, v in mp["screens"].items() if name in v], [])
        disabled = re.findall(r'<[^>]*aria-disabled="true"[^>]*>', body)
        self.assertGreaterEqual(len(disabled), 5, "押せない部品が 5 つ未満")
        for tag in disabled:
            self.assertRegex(tag, OPACITY, f"不透明度 0.55 でない：{tag[:80]}")
        parts = KindParts()
        parts.feed(body)
        for kind, label in DISABLED_KINDS.items():
            self.assertIn(label, html.unescape(body), f"見本に {label} が無い")
            got = parts.found.get(kind, {"usable": 0, "disabled": 0})
            self.assertGreaterEqual(got["usable"], 1, f"{label}（data-kind={kind}）に使える形が無い")
            self.assertGreaterEqual(got["disabled"], 1, f"{label}（data-kind={kind}）に使えない形（aria-disabled と 0.55）が無い")
        review = REVIEW.read_text(encoding="utf-8")
        self.assertRegex(review, r'<section[^>]*data-board="UiDisabled"')


class LaterBoardTest(unittest.TestCase):
    def test_K219_CV_013_later_board(self) -> None:
        """K219-CV-013 「はじめにやること」に「あとで」を置いた絵 OnHomeLater：canvas.json（page on）と screens.tickets だけに在り、
        数は「0 ／ 2」・進みの棒は 0%・「あとで」は 1 つで「預ける」と同じ行・パスキーの行は使えない形で ✓ と取り消し線が無い・比べる 1 枚に区画（D-145.14・D-145.15）"""
        name = "OnHomeLater"
        body = html.unescape((CANVAS / f"{name}.dc.html").read_text(encoding="utf-8"))
        self.assertEqual(load(BOARDS_JSON)["boards"].get(f"{name}.dc.html", {}).get("page"), "on")
        mp = load(MAP)
        self.assertEqual([k for k, v in mp["screens"].items() if name in v], ["tickets"])
        self.assertNotIn(name, mp["common"]["boards"])
        self.assertIn("はじめにやること", body)
        self.assertIn("0 ／ 2", body)
        self.assertNotIn("1 ／ 3", body)
        later = re.findall(r"<(?:a|button)\b[^>]*>\s*あとで\s*</(?:a|button)>", body)
        self.assertEqual(len(later), 1, "「あとで」のボタンがちょうど 1 つでない")
        row = re.search(r"ログイン情報を預ける(.*?)(?:いつでも続きから|</aside>)", body, re.S)
        self.assertIsNotNone(row, "ログイン情報を預けるの行が無い")
        self.assertIn("預ける<", row.group(1))
        self.assertIn("あとで", row.group(1))
        pc = re.search(r"PC をつなぐ(.*?)ログイン情報を預ける", body, re.S)
        self.assertIsNotNone(pc)
        self.assertNotIn("あとで", pc.group(1), "PC をつなぐに「あとで」がある")
        passkey = re.findall(r'<[^>]*aria-disabled="true"[^>]*>[^<]*(?:<[^>]*>[^<]*){0,6}パスキーを付ける', body)
        self.assertTrue(passkey, "パスキーを付けるの行が使えない形でない")
        self.assertRegex(passkey[0], OPACITY)
        box = re.search(r"はじめにやること(.*?)PC をつなぐ", body, re.S)
        self.assertIsNotNone(box, "はじめにやることの箱が無い")
        self.assertNotIn("✓", box.group(1), "パスキーの行に ✓ がある")
        self.assertNotIn("line-through", box.group(1), "パスキーの行に取り消し線がある")
        bar = re.search(r"0 ／ 2(.*?)パスキーを付ける", body, re.S)
        self.assertIsNotNone(bar)
        widths = re.findall(r"(?<![-\w])width:\s*(\d+(?:\.\d+)?)%", bar.group(1))
        self.assertIn("0", widths, "進みの棒の幅が 0% でない")
        self.assertEqual([w for w in widths if float(w) != 0], [], f"進みの棒に 0% のほかの幅：{widths}")
        review = REVIEW.read_text(encoding="utf-8")
        m = review_sections(review).get("OnHomeLater")
        self.assertIsNotNone(m, "比べる 1 枚に区画が無い")
        self.assertIn('data-ref="OnHome"', m[0])


# K219-CV-011 は人の確かめ（judge-skip）。代表の OK は 01_hearing/decider-answers.jsonl の答えの記録で PM が決める

if __name__ == "__main__":
    unittest.main(verbosity=2)

#!/usr/bin/env python3
"""K-219 の試験（キャンバスに絵が無い状態の絵）：13 枚の絵・canvas.json・対応表・突き合わせの組・持ち主の頭・比べる 1 枚。

  python3 scripts/ci/k219_canvas_states_test.py      行 ID は K219-CV-NNN（11_tickets/K-219.md の行の表と 1 対 1）

組のセレクタが本当に絵の要素に当たるか（K219-CV-009）は apps/web/tests/k/k219-canvas-boards.spec.ts（実 Chrome）が持つ。
K219-CV-011（代表が絵を見て OK と言う）は人の確かめ（チケットの judge-skip）。
本物の木は読むだけ（検査の台本を流すだけ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import html
import json
import os
import pathlib
import re
import subprocess
import sys
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
    "AuthChecking": ("AuthSignup", "auth", "signup", "signup-checking", "doc", "/signup", "K-222", ["確かめています"]),
    "AuthVerifyLoading": ("AuthVerify", "auth", "verify-email", "signup-waiting-loading", "doc", "/verify-email", "K-222",
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
KIND_WIDTHS = {"doc": [1440, 375], "auth-msg": [1440, 375], "band": [1440, 375], "dialog": [1440, 375], "page": [1440, 375]}


def clean_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def load(p: pathlib.Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def head_of(tid: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", (TICKETS / f"{tid}.md").read_text(encoding="utf-8"), re.S)
    assert m, f"{tid} に頭が無い"
    return yaml.safe_load(m.group(1))


def groups() -> dict[str, dict]:
    return {g["id"]: g for g in load(FIDELITY)["groups"]}


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
            self.assertIs(g["enrolled"], False, gid)
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
        """K219-CV-010 新しい絵 13 枚は正本に無い色・書体・角丸・文字の大きさを使わない（design_gate の D1〜D4 が 0 件）"""
        files = [str(CANVAS / f"{n}.dc.html") for n in NEW]
        r = subprocess.run([sys.executable, "scripts/ci/design_gate.py", "--design", "04_design/DESIGN-kaname.md",
                            "--mocks", *files, "--part", "--json"], cwd=ROOT, capture_output=True, text=True,
                           env=clean_env(), timeout=120)
        out = json.loads(r.stdout)
        for k in ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い", "D4_文字_段に無い"):
            self.assertEqual(out[k], {}, k)
        self.assertEqual(out["files"], len(NEW))


class ReviewTest(unittest.TestCase):
    def test_K219_CV_008_review_sheet(self) -> None:
        """K219-CV-008 比べる 1 枚：13 枚それぞれに data-board と data-ref の区画・「違い：」の行・2 つの絵を指す iframe"""
        text = REVIEW.read_text(encoding="utf-8")
        sections = dict(re.findall(r'<section[^>]*data-board="([^"]+)"[^>]*>(.*?)</section>', text, re.S))
        for name, (ref, *_rest) in NEW.items():
            self.assertIn(name, sections, f"{name} の区画が無い")
            m = re.search(rf'<section[^>]*data-board="{name}"[^>]*>', text)
            self.assertIn(f'data-ref="{ref}"', m.group(0), name)
            body = sections[name]
            self.assertIn("違い：", body, name)
            self.assertRegex(body, rf'<iframe[^>]+src="[^"]*canvas/{name}\.dc\.html"', name)
            self.assertRegex(body, rf'<iframe[^>]+src="[^"]*canvas/{ref}\.dc\.html"', name)


class DisabledSampleTest(unittest.TestCase):
    def test_K219_CV_012_disabled_sample(self) -> None:
        """K219-CV-012 使えない状態（グレー）の見本の絵 UiDisabled：canvas.json（page on）と対応表の共通に在り、押せない部品 5 種以上が
        aria-disabled と不透明度 0.55 で描かれ、比べる 1 枚に区画が在る（D-145.9）"""
        name = "UiDisabled"
        body = (CANVAS / f"{name}.dc.html").read_text(encoding="utf-8")
        self.assertEqual(load(BOARDS_JSON)["boards"].get(f"{name}.dc.html", {}).get("page"), "on")
        mp = load(MAP)
        self.assertIn(name, mp["common"]["boards"])
        self.assertEqual([k for k, v in mp["screens"].items() if name in v], [])
        disabled = re.findall(r'<[^>]*aria-disabled="true"[^>]*>', body)
        self.assertGreaterEqual(len(disabled), 5, "押せない部品が 5 つ未満")
        for tag in disabled:
            self.assertRegex(tag, r"opacity:\s*0\.55", f"不透明度 0.55 でない：{tag[:80]}")
        for kind in ("ボタン", "選ぶ欄", "探す欄", "メニューの項目", "見え方のタブ"):
            self.assertIn(kind, body, f"見本に {kind} が無い")
        review = REVIEW.read_text(encoding="utf-8")
        self.assertRegex(review, r'<section[^>]*data-board="UiDisabled"')


class LaterBoardTest(unittest.TestCase):
    def test_K219_CV_013_later_board(self) -> None:
        """K219-CV-013 「はじめにやること」に「あとで」を置いた絵 OnHomeLater：canvas.json（page on）と screens.tickets だけに在り、
        数は「0 ／ 2」・「あとで」は 1 つで「預ける」と同じ行・パスキーの行は使えない形・比べる 1 枚に区画（D-145.14・D-145.15）"""
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
        self.assertRegex(passkey[0], r"opacity:\s*0\.55")
        review = REVIEW.read_text(encoding="utf-8")
        m = re.search(r'<section[^>]*data-board="OnHomeLater"[^>]*>', review)
        self.assertIsNotNone(m, "比べる 1 枚に区画が無い")
        self.assertIn('data-ref="OnHome"', m.group(0))


# K219-CV-011 は人の確かめ（judge-skip）。代表の OK は 01_hearing/decider-answers.jsonl の答えの記録で PM が決める

if __name__ == "__main__":
    unittest.main(verbosity=2)

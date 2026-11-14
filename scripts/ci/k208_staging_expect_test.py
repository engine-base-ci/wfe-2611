#!/usr/bin/env python3
"""K-208 の形の試験：staging の統合テスト（apps/e2e/staging/k65-walking-skeleton.spec.ts）の期待の誤り 2 つを直した形。行 ID は K208-FM-NNN。
2026-11-15 の staging の回で 1 本目と 5 本目が、製品は決まりどおりなのに試験の期待で赤になった：
  ・1 本目：確定の後の「登録が完了しました」の 1 通を、確認のメールの通数に数えていた（数える道具が件名で分けていなかった）
  ・5 本目：まだ契約だけ（501）のチケットの一覧の口を期待していた（画面は 501 を空として出す）
staging にはつながない。試験の本体は流さない（読むのは試験・道具・製品の件名の定数・チケットの md・CI の定義の字だけ）。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import re
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
STAGING = ROOT / "apps" / "e2e" / "staging"
SPEC = STAGING / "k65-walking-skeleton.spec.ts"
RESEND = STAGING / "_lib" / "resend.ts"
VERIFY_SUBJECT_SRC = ROOT / "packages" / "auth" / "src" / "index.ts"     # 確認のメールを送る所（sendPendingVerification）
DONE_SUBJECT_SRC = ROOT / "apps" / "api" / "src" / "features" / "F1" / "verify-email" / "mail.ts"   # 完了のメール
K65 = ROOT / "11_tickets" / "K-65.md"
K92 = ROOT / "11_tickets" / "K-92.md"
GATE = ROOT / ".github" / "workflows" / "v3-gate.yml"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def code(path: pathlib.Path) -> str:
    """注釈（// の行と行末の // …・/* … */）を除いた中身。注釈に書いた説明の字で緑にしない"""
    text = re.sub(r"/\*.*?\*/", "", read(path), flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def body_of(row: str) -> str:
    """名前の頭が row の試験の中身（注釈を除く）"""
    text = code(SPEC)
    head = re.search(rf'^test\(\s*"{re.escape(row)} ', text, flags=re.M)
    assert head, f"{row} の試験が無い"
    rest = text[head.start():]
    nxt = re.search(r"^test\(", rest[1:], flags=re.M)
    return rest if not nxt else rest[: nxt.start() + 1]


def mail_const(key: str) -> str:
    block = re.search(r"const MAIL = \{(.*?)\} as const;", code(SPEC), flags=re.S)
    assert block, "試験に MAIL の決まりが無い"
    hit = re.search(rf'^\s*{key}:\s*"([^"]+)"', block.group(1), flags=re.M)
    assert hit, f"MAIL.{key} が無い"
    return hit.group(1)


def table_row(doc: str, row: str) -> list[str]:
    """md の行の表の 1 行を欄に分ける"""
    line = re.search(rf"^\| {re.escape(row)} \|.*$", doc, flags=re.M)
    assert line, f"{row} の行が表に無い"
    return [c.strip() for c in line.group(0).strip().strip("|").split(" | ")]


class StagingExpectShape(unittest.TestCase):
    def test_K208_FM_001_count_by_subject(self) -> None:
        text = code(RESEND)
        self.assertRegex(text, r"export async function countTo\(to: string, subject\?: string\): Promise<number>",
                         "数える道具が、件名で絞る引数を持つ（渡さなければ今までどおり宛先だけで数える）")
        fn = text.split("export async function countTo(", 1)[1].split("\nexport ", 1)[0]
        self.assertRegex(fn, r"if \(subject === undefined\) return mine\.length;", "件名を渡さないときは宛先の通数")
        self.assertRegex(fn, r"=== subject\)", "件名を渡したときは、件名が同じ物だけを数える")
        self.assertRegex(fn, r'r\["subject"\]', "件名は一覧の行の subject で比べる")
        self.assertRegex(fn, r"readMail\(", "行に件名が無い形なら 1 通ずつ読んで比べる（読めないまま 0 と数えない）")

    def test_K208_FM_002_first_counts_each_mail(self) -> None:
        body = body_of("K65-STG-01")
        self.assertRegex(body, r"countTo\(me\.email, MAIL\.subject\)[^;]*\.toBe\(1\)", "1 本目：確認のメール（件名で絞る）が 1 通")
        self.assertRegex(body, r"countTo\(me\.email, MAIL\.doneSubject\)[^;]*\.toBe\(1\)", "1 本目：登録が完了しましたのメールも 1 通")
        self.assertNotRegex(body, r"countTo\(me\.email\)", "1 本目に、件名で絞らずに数える確かめが残っていない（完了のメールを混ぜて 2 になる）")

    def test_K208_FM_003_subjects_match_product(self) -> None:
        # 確認のメールを送る所：登録の保留の申し込みに確認のリンクを送る関数（sendPendingVerification）の件名
        parts = read(VERIFY_SUBJECT_SRC).split("export async function sendPendingVerification(", 1)
        self.assertEqual(len(parts), 2, "確認のメールを送る関数が在る")
        verify = re.findall(r'subject:\s*"([^"]+)"', parts[1].split("\nexport ", 1)[0])
        self.assertEqual(len(verify), 1, "確認のメールを送る関数の件名が 1 つ読める")
        self.assertEqual(mail_const("subject"), verify[0], "試験の確認のメールの件名が、製品が送る件名と同じ字")
        done = re.search(r'^export const DONE_SUBJECT = "([^"]+)";', read(DONE_SUBJECT_SRC), flags=re.M)
        self.assertIsNotNone(done, "完了のメールの件名の定数が読める")
        self.assertEqual(mail_const("doneSubject"), done.group(1), "試験の完了のメールの件名が、製品の定数と同じ字")
        self.assertNotEqual(mail_const("subject"), mail_const("doneSubject"), "2 つの件名で分けられる")

    def test_K208_FM_004_second_keeps_its_meaning(self) -> None:
        body = body_of("K65-STG-02")
        self.assertRegex(body, r"countTo\(me\.email\)[^;]*\.toBe\(1\)",
                         "2 本目は確定の前に、件名で絞らずに同じ宛先に 1 通だけを見る（意味を変えない）")
        self.assertNotIn("doneSubject", body, "2 本目は確定しないので、完了のメールを数えない")

    def test_K208_FM_005_fifth_reads_by_api(self) -> None:
        body = body_of("K65-STG-05")
        self.assertNotRegex(body, r'goto\(\s*"/tickets"\s*\)', "5 本目は、まだ契約だけのチケットの一覧の画面で確かめない")
        self.assertNotIn("一覧に B のチケット", body)
        self.assertRegex(
            body,
            r"\[\(await readAs\(page, `/tickets/\$\{tb\}`\)\)\.status, \(await readAs\(page, `/tickets/\$\{tb\}/runs`\)\)\.status\]"
            r"[^;]*\.toEqual\(\[404, 404\]\)",
            "A のブラウザから B のチケットの詳細と記録の口を読み、どちらも 404",
        )
        self.assertRegex(body, r"readAs\(other\.page, `/tickets/\$\{ta\}`\)", "B から A の詳細の確かめ（前から在る）は残る")
        self.assertRegex(body, r"readAs\(other\.page, `/tickets/\$\{ta\}/runs`\)", "B から A の記録の確かめ（前から在る）は残る")

    def test_K208_FM_006_ticket_rows_follow(self) -> None:
        doc = read(K65)
        first = table_row(doc, "K65-STG-01")[3]
        self.assertIn("件名", first, "1 本目の期待結果は、件名で分けて数える")
        self.assertIn("登録が完了しました", first, "1 本目の期待結果に、完了のメールも 1 通")
        fifth = table_row(doc, "K65-STG-05")[3]
        self.assertNotIn("一覧に B のチケット 0 件", fifth, "5 本目の期待結果に、まだ無い一覧の口の確かめが残っていない")
        self.assertRegex(fifth, r"A は B のチケットの詳細と記録の口 404", "5 本目の期待結果は、A から B の口が 404")
        third = table_row(doc, "K65-STG-03")
        self.assertIn("released が true", third[3], "3 本目の期待結果は変えない（環境の側の赤）")
        self.assertIn("2026-11-15 の回：staging の置き場に配布物が未配置で赤", third[4], "3 本目に、その回の赤の訳を書く")
        self.assertRegex(body_of("K65-STG-03"), r"\{ status: 200, released: true, hasLink: true \}", "3 本目の試験の期待は変えない")

    def test_K208_FM_007_handover_to_list_ticket(self) -> None:
        notes = read(K92).split("## 申し送り", 1)
        self.assertEqual(len(notes), 2, "一覧のチケットに申し送りの節が在る")
        self.assertIn("staging の統合テストに、会社をまたいだ一覧の確かめを足す", notes[1])
        self.assertIn("読めなかったのに『まだチケットがありません』と出るのを『読み込めませんでした』にする行を足す", notes[1])

    def test_K208_FM_008_runs_in_ticket_ci(self) -> None:
        steps = yaml.safe_load(read(GATE))["jobs"]["spec"]["steps"]
        g65 = [s for s in steps if "k65_staging_spec_test.py" in str(s.get("run", ""))]
        self.assertEqual(len(g65), 1, "G65 の段が 1 つ")
        self.assertIn("python3 scripts/ci/k208_staging_expect_test.py", str(g65[0]["run"]), "G65 がこの試験を流す")
        self.assertNotIn("continue-on-error", g65[0], "赤を緑にしない")


if __name__ == "__main__":
    unittest.main(verbosity=2)

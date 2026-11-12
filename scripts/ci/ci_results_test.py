#!/usr/bin/env python3
"""ci_results.py（試験の結果の欄を CI の記録から機械で書く・手で書いた PASS を赤にする）と、op_gate.py の今の回の報告の読み方の試験（K-143）。
行 ID（K143-CI-…）は 11_tickets/K-143.md の表に結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
決め：D-129.50（K-62 の前に入れる）・D-129.51（検査は全部の試験の仕様・古い印の無い PASS は台帳・結果の欄は取り込みの台本が書く）。

試験が決める形（scripts/ci/ci_results.py。スキル ai-team-delivery の scripts/gates/result_gate.py の形を Kaname の入力に合わせたもの）:
  ID_PATTERN                               行 ID の形（scripts/ci/op_gate.py の ID_RE と同じ：英大文字の頭・- でつなぐ・3 桁の数・後ろに -A/-B/-C 可）
  record(reports: list[Path], sha: str, records: Path) -> int
      Playwright の JSON 報告（"suites"）と Vitest の JSON 報告（"testResults"）を読み、名前に行 ID を持つ試験から
      records/<sha>.json = {"sha", "made_by": "ci_results.py record", "at", "rows": {行 ID: "pass"|"fail"}} を書く。
      同じ行を受ける試験が 1 つでも passed でなければ fail（skipped・todo・timedOut も fail）。行 ID の形でない名前は数えない。
      報告のファイルが 1 つも無い・読めないなら 1 を返し、記録を書かない
  write(specs: list[str], records: Path, sha: str) -> int
      sha（先頭 7 字以上）の記録から、試験の仕様の表（列 ID・結果）の結果の欄を「PASS（CI <7 字>）」「FAIL（CI <7 字>）」に書く。
      記録に無い行は変えない。前の回の印は新しい回で書き換える。記録が無い・短い sha が 2 つ以上の記録に当たるなら 1 を返し、何も書かない
  check(specs: list[str], records: Path, ledger: dict | None = None, ledger_base: dict | None = None) -> list[str]
      問題の一覧（空なら緑）。結果の欄が PASS の行だけを見る（空・BLOCKED・FAIL は見ない）:
        ・印（「CI <7〜40 字の 16 進>」）の無い PASS は、台帳（ledger の rows に {file, id}）に無ければ赤（手で書いた PASS）
        ・印の回の記録が records に無い・2 つ以上に当たる・その回の記録で pass でないなら赤
        ・行 ID が ID_PATTERN の形でない PASS は赤
        ・PASS の行が無ければ、records が無くても緑（記録は PASS を確かめるときだけ要る・スキルの check と同じ）
        ・台帳：ledger_base（本線の台帳）に無い行が ledger にあれば赤（台帳は減らすだけ）。
          台帳の行が、もう印の無い PASS でない（印が付いた・空に戻った・行が無い）なら赤（台帳から消す）
  python3 scripts/ci/ci_results.py check --specs '07_qa/test-specs/**/*.md' --records 07_qa/ci-results --ledger 07_qa/test-plan/result-ledger.json --ledger-base-ref <本線との分かれ目>
      問題があれば「★」で 1 行ずつ出して exit 1、無ければ PASS と数で exit 0。
      --ledger-base-ref：その ref（git show <ref>:<台帳>）の台帳を本線の台帳として比べる（台帳は減らすだけ・PM の判断 2026-11-08 15:37）。
        ref が読めない（無い ref・空・git でない）なら赤（守りの所で読めないなら止める側）。
        ref に台帳が無い（台帳を入れる回）なら、台帳の行はどれも、その ref の版の試験の仕様（git show <ref>:<ファイル>）で
        「CI の印の無い PASS」の行に当たらなければ赤（入れる回に紛れて増やせない）。CI の spec の段は必ずこの引数を付け、ref は static の段の G0（scope）が出す本線との分かれ目 "${{ needs.static.outputs.base }}"（main の名前は決め打ちにしない）
  読む行と PASS の読み方（K-143 回 5・PM の判断 2026-11-08 17:40 ③）：qa-ladder（scripts/ci/qa-ladder.py）と同じ読み手にそろえる。
      見出しの ID の列は「ID」「行 ID」「ＩＤ」「Id」、結果の列は「結果」を含む名前・「status」「Status」。外側の「|」が無い表・末尾の「|」が無い行も読む。
      ドットの付いたディレクトリの中のファイルも読む。PASS と読むのは NFKC で揃えて大小を問わず PASS・FIXED・OK・合格・完了（**PASS**・✅ PASS も）。
      印つきの形は「PASS（CI <sha>）」「FAIL（CI <sha>）」ちょうどだけで、それ以外の PASS らしい書き方は手で書いた PASS として赤。
      「PASS（該当なし…）」は該当なし（N/A）と読む（PASS に数えず、台帳にも載せない・op_gate と同じ）。qa-ladder の status_of も同じに読む
      同じファイルの同じ行 ID の PASS が 2 行以上あれば赤（台帳の行と同じ番号の新しい行で通さない・④）
  --ledger-base-ref <ref> --target-ref <取り込む先>（PM の判断 2026-11-08 15:58・17:40 ①②）：
      ・<ref> は <取り込む先> の先祖で、HEAD と違うコミットでなければ赤（比べる元を枝が選べない）。--target-ref が無い・読めないなら赤
      ・本線の版と同じ印のまま（同じファイル・行 ID・結果の文字）の行は記録を見直さない（取り込みの台本が write の後に check を流してから本線に入れたので確かめ済み）
      ・枝で足した・変えた印と、--records の記録のファイルの追加・変更は、<ref>..HEAD のコミットのうち本文に
        「Results-Written-By: ci_results.py write CI <40 字の sha>」を持つコミット（取り込みの台本の書き込み）で入ったものだけ通す。それ以外は赤
  scripts/ci/op_gate.py --pending-from-report：結果が空の行は、今の回の報告で passed なら未実施にしない（取り込みの台本が後で書く）。
      failed なら赤・報告に無いなら前のとおり「未実施（結果が空）」
使い方: python3 scripts/ci/ci_results_test.py
"""
import contextlib, io, json, os, re, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import ci_results as cr  # noqa: E402

SHA = "abcdef1234567890abcdef1234567890abcdef12"
SHA2 = "abcdef1999999999999999999999999999999999"
HEAD = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"


def row(rid, result="", view="操作", task="K-1"):
    return f"| {rid} | tickets | {view} | 項目 | 前提 | 操作 | 期待 | {result} |  | {task} | L1 |\n"


def pw_report(*tests):
    """Playwright の JSON 報告：tests は (題, 状態)"""
    return {"suites": [{"title": "k.spec.ts", "specs": [{"title": t, "tests": [{"results": [{"status": st}]}]} for t, st in tests], "suites": []}]}


def vitest_report(*tests):
    """Vitest の JSON 報告（--reporter=json）：tests は (題, 状態)"""
    return {"testResults": [{"assertionResults": [{"ancestorTitles": ["K-1"], "title": t, "status": st} for t, st in tests]}]}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.t = Path(self.tmp.name)
        self.rec = self.t / "ci-results"
        self.spec = self.t / "spec.md"

    def tearDown(self):
        self.tmp.cleanup()

    def put(self, name, obj):
        p = self.t / name
        p.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
        return p

    def record_of(self, rows, sha=SHA):
        self.rec.mkdir(exist_ok=True)
        (self.rec / f"{sha}.json").write_text(json.dumps({"sha": sha, "made_by": "ci_results.py record", "at": "x", "rows": rows}), encoding="utf-8")

    def problems(self, ledger=None, base=None):
        return cr.check([str(self.spec)], self.rec, ledger, base)


class RecordTest(Base):
    def test_K143_CI_001_record_reads_playwright_and_vitest(self):
        """K143-CI-001 record：Playwright と Vitest の JSON 報告から、名前に行 ID を持つ試験の結果を記録にする。同じ行の試験が 1 つでも落ちたら fail。skipped も fail。行 ID の形でない名前は数えない"""
        pw = self.put("pw.json", pw_report(("K62-UI-001 押す", "passed"), ("K62-UI-002 二度押し", "failed"),
                                           ("K62-UI-003 待つ", "passed"), ("K62-UI-003 待つ 2", "timedOut"),
                                           ("K62-UI-004 飛ばした", "skipped"), ("名前に行 ID が無い", "passed"), ("K62-UI-12 形違い", "passed")))
        vt = self.put("vt.json", vitest_report(("K62-API-001 任せる", "passed"), ("K62-API-002 待つ", "todo")))
        self.assertEqual(cr.record([pw, vt], SHA, self.rec), 0)
        out = json.loads((self.rec / f"{SHA}.json").read_text(encoding="utf-8"))
        self.assertEqual(out["sha"], SHA)
        self.assertEqual(out["made_by"], "ci_results.py record")
        self.assertEqual(out["rows"], {"K62-UI-001": "pass", "K62-UI-002": "fail", "K62-UI-003": "fail", "K62-UI-004": "fail",
                                       "K62-API-001": "pass", "K62-API-002": "fail"})

    def test_K143_CI_002_record_without_report_writes_nothing(self):
        """K143-CI-002 record：報告のファイルが無い・JSON でないなら 1 を返し、記録を書かない（空の記録で全部を「流れていない」にしない）"""
        self.assertEqual(cr.record([self.t / "無い.json"], SHA, self.rec), 1)
        bad = self.t / "bad.json"
        bad.write_text("{こわれた", encoding="utf-8")
        self.assertEqual(cr.record([bad], SHA, self.rec), 1)
        self.assertFalse((self.rec / f"{SHA}.json").exists())


class WriteTest(Base):
    def test_K143_CI_003_write_marks_pass_and_fail_and_leaves_others(self):
        """K143-CI-003 write：記録の pass は「PASS（CI abcdef1）」、fail は「FAIL（CI abcdef1）」。記録に無い行は変えない（空も BLOCKED もそのまま）"""
        self.spec.write_text(HEAD + row("K62-UI-001") + row("K62-UI-002") + row("K62-UI-003", "BLOCKED（実装待ち）") + row("K62-UI-004"), encoding="utf-8")
        self.record_of({"K62-UI-001": "pass", "K62-UI-002": "fail"})
        self.assertEqual(cr.write([str(self.spec)], self.rec, SHA[:7]), 0)
        txt = self.spec.read_text(encoding="utf-8")
        self.assertIn("| K62-UI-001 | tickets | 操作 | 項目 | 前提 | 操作 | 期待 | PASS（CI abcdef1） |", txt)
        self.assertIn("| FAIL（CI abcdef1） |", txt)
        self.assertIn("| BLOCKED（実装待ち） |", txt)
        self.assertIn(row("K62-UI-004").strip(), txt)

    def test_K143_CI_004_write_overwrites_previous_mark(self):
        """K143-CI-004 write：前の回の印は新しい回の記録で書き換える（PASS（CI 1111111）→ FAIL（CI abcdef1））"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI 1111111）"), encoding="utf-8")
        self.record_of({"K62-UI-001": "fail"})
        self.assertEqual(cr.write([str(self.spec)], self.rec, SHA), 0)
        txt = self.spec.read_text(encoding="utf-8")
        self.assertIn("FAIL（CI abcdef1）", txt)
        self.assertNotIn("1111111", txt)

    def test_K143_CI_005_write_without_or_ambiguous_record_changes_nothing(self):
        """K143-CI-005 write：その回の記録が無い・短い sha が 2 つの記録に当たるなら 1 を返し、仕様を 1 字も変えない"""
        before = HEAD + row("K62-UI-001")
        self.spec.write_text(before, encoding="utf-8")
        self.assertEqual(cr.write([str(self.spec)], self.rec, SHA[:7]), 1)
        self.record_of({"K62-UI-001": "pass"})
        self.record_of({"K62-UI-001": "pass"}, SHA2)
        self.assertEqual(cr.write([str(self.spec)], self.rec, "abcdef1"), 1)
        self.assertEqual(self.spec.read_text(encoding="utf-8"), before)

    def test_K143_CI_034_write_shrinks_ledger_rows_it_marks(self):
        """K143-CI-034 write が台帳に載った印の無い PASS の行に印を付けたら、同じ実行でその行を台帳から消す（台帳は減らすだけ・
        取り込みの台本の write → check の順で、直後の check が「台帳の行が、もう印の無い PASS でない」で赤にならない）。
        記録に無い行は印も付かず台帳に残る。--ledger を渡さなければ台帳は触らない（テスター Q 回 8 の追加-1）"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS") + row("K57-UI-003"), encoding="utf-8")
        self.record_of({"K57-UI-001": "pass", "K57-UI-003": "pass"})
        ledger = self.t / "ledger.json"
        rows = [{"file": str(self.spec), "id": "K57-UI-001"}, {"file": str(self.spec), "id": "K57-UI-002"}]
        ledger.write_text(json.dumps({"rows": rows, "count": 2}), encoding="utf-8")
        # 台帳を渡さない write は台帳を触らない（印は付く）
        self.assertEqual(cr.write([str(self.spec)], self.rec, SHA), 0)
        self.assertEqual(json.loads(ledger.read_text(encoding="utf-8"))["rows"], rows)
        # 台帳を渡した write は、印を付けた行（001）を台帳から消し、記録に無い行（002）は残す
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS") + row("K57-UI-003"), encoding="utf-8")
        self.assertEqual(cr.write([str(self.spec)], self.rec, SHA, ledger), 0)
        txt = self.spec.read_text(encoding="utf-8")
        self.assertIn("| K57-UI-001 | tickets | 操作 | 項目 | 前提 | 操作 | 期待 | PASS（CI abcdef1） |", txt)
        self.assertIn("| K57-UI-003 | tickets | 操作 | 項目 | 前提 | 操作 | 期待 | PASS（CI abcdef1） |", txt)
        self.assertIn(row("K57-UI-002", "PASS").strip(), txt)
        after = json.loads(ledger.read_text(encoding="utf-8"))
        self.assertEqual(after["rows"], [{"file": str(self.spec), "id": "K57-UI-002"}])
        self.assertEqual(after["count"], 1)
        # 直後の check（本線の台帳 ＝ write の前の台帳）は緑：減らしただけで、増えも「もう印の無い PASS でない行」も無い
        self.assertEqual(self.problems(after, {"rows": rows}), [])


class CheckTest(Base):
    def test_K143_CI_006_unmarked_pass_is_red(self):
        """K143-CI-006 check：印の無い PASS（手で書いた PASS）は、台帳に無ければ赤。どのファイルのどの行かを出す"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS"), encoding="utf-8")
        got = self.problems()
        self.assertEqual(len(got), 1, got)
        self.assertIn("K62-UI-001", got[0])
        self.assertIn(str(self.spec), got[0])

    def test_K143_CI_007_marked_pass_with_record_is_green(self):
        """K143-CI-007 check：印のある PASS で、その回の記録が pass なら緑。空・BLOCKED・FAIL の行は見ない"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI abcdef1）") + row("K62-UI-002") + row("K62-UI-003", "BLOCKED（実装待ち）")
                             + row("K62-UI-004", "FAIL（CI abcdef1）"), encoding="utf-8")
        self.record_of({"K62-UI-001": "pass", "K62-UI-004": "fail"})
        self.assertEqual(self.problems(), [])

    def test_K143_CI_008_marked_pass_but_record_fail_or_missing_is_red(self):
        """K143-CI-008 check：印の回の記録で fail・記録に行が無い・印の回の記録のファイルが無い PASS は赤"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI abcdef1）") + row("K62-UI-002", "PASS（CI abcdef1）")
                             + row("K62-UI-003", "PASS（CI 1234567）"), encoding="utf-8")
        self.record_of({"K62-UI-001": "fail"})
        got = self.problems()
        self.assertEqual(len(got), 3, got)
        self.assertTrue(any("K62-UI-001" in g and "fail" in g for g in got), got)
        self.assertTrue(any("K62-UI-002" in g for g in got), got)
        self.assertTrue(any("K62-UI-003" in g and "1234567" in g for g in got), got)

    def test_K143_CI_009_ambiguous_short_sha_is_red(self):
        """K143-CI-009 check：印の短い sha が 2 つの記録に当たる（1 つに決まらない）PASS は赤"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI abcdef1）"), encoding="utf-8")
        self.record_of({"K62-UI-001": "pass"})
        self.record_of({"K62-UI-001": "pass"}, SHA2)
        got = self.problems()
        self.assertEqual(len(got), 1, got)
        self.assertIn("abcdef1", got[0])

    def test_K143_CI_010_bad_id_shape_pass_is_red(self):
        """K143-CI-010 check：行 ID が op_gate の形（3 桁の数で終わる）でない PASS は赤（記録と結べない）"""
        self.spec.write_text(HEAD + row("K62-UI-12", "PASS（CI abcdef1）"), encoding="utf-8")
        self.record_of({"K62-UI-12": "pass"})
        got = self.problems()
        self.assertEqual(len(got), 1, got)
        self.assertIn("K62-UI-12", got[0])

    def test_K143_CI_011_no_pass_rows_need_no_records(self):
        """K143-CI-011 check：PASS の行が無ければ、記録の置き場が無くても緑（記録は PASS を確かめるときだけ要る）"""
        self.spec.write_text(HEAD + row("K62-UI-001") + row("K62-UI-002", "BLOCKED（実装待ち）"), encoding="utf-8")
        self.assertFalse(self.rec.exists())
        self.assertEqual(self.problems(), [])


class LedgerTest(Base):
    def test_K143_CI_012_ledger_allows_old_unmarked_pass(self):
        """K143-CI-012 台帳（まだ流し直していない行）に載った印の無い PASS は緑。載っていない印の無い PASS は赤"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K62-UI-001", "PASS"), encoding="utf-8")
        ledger = {"rows": [{"file": str(self.spec), "id": "K57-UI-001"}]}
        got = self.problems(ledger, ledger)
        self.assertEqual(len(got), 1, got)
        self.assertIn("K62-UI-001", got[0])

    def test_K143_CI_013_ledger_only_shrinks(self):
        """K143-CI-013 台帳は減らすだけ：本線の台帳に無い行を足したら赤。台帳の行がもう印の無い PASS でない（印が付いた）なら、台帳から消すよう赤"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS（CI abcdef1）"), encoding="utf-8")
        self.record_of({"K57-UI-002": "pass"})
        base = {"rows": [{"file": str(self.spec), "id": "K57-UI-002"}]}
        grown = {"rows": [{"file": str(self.spec), "id": "K57-UI-001"}, {"file": str(self.spec), "id": "K57-UI-002"}]}
        got = self.problems(grown, base)
        self.assertTrue(any("K57-UI-001" in g and "台帳" in g for g in got), got)   # 増えた
        self.assertTrue(any("K57-UI-002" in g and "台帳" in g for g in got), got)   # 印が付いたのに台帳に残る
        # 減らすのは緑：台帳から K57-UI-002 を消した形（印の付いた行）は、印の無い K57-UI-001 の 1 件だけが赤
        shrunk = self.problems({"rows": []}, base)
        self.assertEqual(len(shrunk), 1, shrunk)
        self.assertIn("K57-UI-001", shrunk[0])


class ReaderTest(Base):
    """読む行と PASS の読み方を qa-ladder と同じ読み手にそろえる（PM の判断 2026-11-08 17:40 ③④・N/A）"""

    def test_K143_CI_023_other_pass_spellings_are_hand_written(self):
        """K143-CI-023 PASS の別の書き方（**PASS**・pass・Pass・ＰＡＳＳ・✅ PASS・OK・合格・FIXED・完了）と、飾った印（**PASS**（CI …））は、どれも手で書いた PASS として赤"""
        vals = ["**PASS**", "pass", "Pass", "ＰＡＳＳ", "✅ PASS", "OK", "合格", "FIXED", "完了", "**PASS**（CI abcdef1）"]
        self.spec.write_text(HEAD + "".join(row(f"K62-UI-{i:03d}", v) for i, v in enumerate(vals, 1)), encoding="utf-8")
        self.record_of({f"K62-UI-{i:03d}": "pass" for i in range(1, len(vals) + 1)})
        got = self.problems()
        for i, v in enumerate(vals, 1):
            self.assertTrue(any(f"K62-UI-{i:03d}" in g for g in got), f"{v} が赤にならない：{got}")

    def test_K143_CI_024_header_names_are_read(self):
        """K143-CI-024 見出しの名前：ID の列「行 ID」「ＩＤ」「Id」、結果の列「結果（CI）」「結果列」「status」の表も読み、印の無い PASS を赤にする"""
        for idh, resh in [("行 ID", "結果"), ("ＩＤ", "結果（CI）"), ("Id", "結果列"), ("ID", "status")]:
            self.spec.write_text(f"| {idh} | 項目 | {resh} |\n|---|---|---|\n| K62-UI-001 | 押す | PASS |\n", encoding="utf-8")
            got = self.problems()
            self.assertEqual(len(got), 1, f"{idh}・{resh}：{got}")

    def test_K143_CI_025_tables_without_outer_pipes_are_read(self):
        """K143-CI-025 表の形：外側の「|」が無い表・末尾の「|」が無い行も読み、印の無い PASS を赤にする"""
        self.spec.write_text("ID | 項目 | 結果\n---|---|---\nK62-UI-001 | 押す | PASS\n", encoding="utf-8")
        self.assertEqual(len(self.problems()), 1)
        self.spec.write_text("| ID | 項目 | 結果 |\n|---|---|---|\n| K62-UI-002 | 押す | PASS\n", encoding="utf-8")
        got = self.problems()
        self.assertEqual(len(got), 1, got)
        self.assertIn("K62-UI-002", got[0])

    def test_K143_CI_026_dot_directories_are_read(self):
        """K143-CI-026 ドットの付いたディレクトリの中の試験の仕様も読む（`**/*.md` で集める）"""
        d = self.t / "specs" / ".x"
        d.mkdir(parents=True)
        (d / "a.md").write_text(HEAD + row("K62-UI-001", "PASS"), encoding="utf-8")
        got = cr.check([str(self.t / "specs" / "**" / "*.md")], self.rec, None, None)
        self.assertEqual(len(got), 1, got)
        self.assertIn(".x", got[0])

    def test_K143_CI_028_duplicate_id_of_ledger_row_is_red(self):
        """K143-CI-028 台帳の行と同じ番号の新しい行（同じファイル・同じ行 ID の PASS が 2 行）は赤（台帳の鍵で新しい行を通さない・17:40 ④）"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-001", "PASS"), encoding="utf-8")
        got = self.problems({"rows": [{"file": str(self.spec), "id": "K57-UI-001"}]}, {"rows": [{"file": str(self.spec), "id": "K57-UI-001"}]})
        self.assertTrue(got, "同じ番号の 2 行目が通る")
        self.assertTrue(all("K57-UI-001" in g for g in got), got)

    def test_K143_CI_030_not_applicable_rows(self):
        """K143-CI-030 「PASS（該当なし…）」は該当なし（N/A）と読む：PASS に数えず、印も台帳も要らない。台帳に載っていたら赤（台帳から消す）"""
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（該当なし：この画面に入力が無い）"), encoding="utf-8")
        self.assertEqual(self.problems(), [])
        got = self.problems({"rows": [{"file": str(self.spec), "id": "K62-UI-001"}]}, {"rows": [{"file": str(self.spec), "id": "K62-UI-001"}]})
        self.assertEqual(len(got), 1, got)
        self.assertIn("台帳", got[0])


class NameTest(Base):
    def test_K143_CI_018_japanese_file_name_is_read(self):
        """K143-CI-018 日本語の名前の試験の仕様のファイルも読み落とさない（glob で集める・印の無い PASS を赤にする）"""
        jp = self.t / "試験の仕様.md"
        jp.write_text(HEAD + row("K62-UI-001", "PASS"), encoding="utf-8")
        got = cr.check([str(self.t / "*.md")], self.rec, None, None)
        self.assertEqual(len(got), 1, got)
        self.assertIn("試験の仕様.md", got[0])


class RepoTest(unittest.TestCase):
    def test_K143_CI_014_real_workspace_is_green_with_ledger(self):
        """K143-CI-014 本物の作業場所：07_qa/test-specs の全部に掛けて、台帳（07_qa/test-plan/result-ledger.json）込みで緑。
        台帳は減らすだけ（D-129.51）：取り込みの write が印を付けた行は台帳から消える。K-159 で直した ── 特定のチケット（K57-・K60-）の
        行が残ることは求めず、台帳が本線に入った版（K-143 の取り込み fb2998f7・2444 行）と比べて、増えていない・入れた時点の 2593 行を
        超えない・同じ鍵が 2 行無い・消えた行はどれも、もう印の無い PASS でない（ci_results.ledger_drift が空・PM の判断 (ロ)）。台帳が空になっても赤にしない（K-150 のゴール）"""
        r = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", "07_qa/test-specs/**/*.md",
                            "--records", "07_qa/ci-results", "--ledger", "07_qa/test-plan/result-ledger.json"],
                           cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ledger = json.loads((ROOT / "07_qa/test-plan/result-ledger.json").read_text(encoding="utf-8"))
        self.assertLessEqual(len(ledger["rows"]), 2593, "台帳は入れた時点の 2593 行より増えない")
        entered = cr.ledger_at("fb2998f7cfd368ffa77880fe6f9e7c1acdba0b24", "07_qa/test-plan/result-ledger.json", ROOT)
        self.assertIsNotNone(entered, "台帳が本線に入った版を git から読めない（守りの所で読めないなら止める側）")
        # 何も見ていないのに緑にしない：入った版の 2444 行と比べる
        self.assertEqual(len(entered["rows"]), 2444)
        self.assertEqual(cr.ledger_drift(ledger, entered, ROOT, cap=2593), [])
        # 何も見ていないのに緑にしない：PASS の行を数えて出す（台帳の行は全部、印の無い PASS として数えられている）
        m = re.search(r"PASS (\d+) 行", r.stdout)
        self.assertTrue(m and int(m.group(1)) >= len(ledger["rows"]), r.stdout)
        # 容れ物の中（まっさらな写し）と手元で同じ結果：台帳のファイルは作業場所の頭からの道で持つ（/ で始めない）
        self.assertTrue(all(not x["file"].startswith("/") for x in ledger["rows"]))
        # 「PASS（該当なし…）」の行は台帳に載せない（N/A と読む・PM の判断 17:40）
        na = set()
        for f in {x["file"] for x in ledger["rows"]}:
            for _, rid, res, _ in cr.spec_rows((ROOT / f).read_text(encoding="utf-8")):
                if res.startswith("PASS（該当なし"):
                    na.add((f, rid))
        self.assertFalse(na & {(x["file"], x["id"]) for x in ledger["rows"]}, "該当なしの行が台帳にある")

    def test_K143_CI_027_reads_every_row_qa_ladder_counts_as_passed(self):
        """K143-CI-027 qa-ladder が passed と数える行は、どれも G61 も PASS と読む（qa-ladder が読む行 ⊂ G61 が読む行）。
        「PASS（該当なし…）」は両方とも N/A（status_of が na・G61 も PASS に数えない）"""
        import importlib.util  # noqa: PLC0415

        spec_ = importlib.util.spec_from_file_location("qa_ladder", HERE / "qa-ladder.py")
        ql = importlib.util.module_from_spec(spec_)
        spec_.loader.exec_module(ql)
        self.assertEqual(ql.status_of("PASS（該当なし：入力が無い）"), "na")
        ladder = {(r["file"], r["id"]) for r in ql.load_spec_rows(ROOT / "07_qa/test-specs") if r["status"] == "passed"}
        self.assertTrue(ladder, "qa-ladder が passed と数える行が 1 つも無い（何も見ていない）")
        ours = set()
        for f in cr.spec_files([str(ROOT / "07_qa/test-specs/**/*.md")]):
            rel = os.path.relpath(f, ROOT / "07_qa/test-specs")
            for _, rid, res, _ in cr.spec_rows(Path(f).read_text(encoding="utf-8")):
                if cr.is_pass(res):
                    ours.add((rel, rid))
        self.assertFalse(sorted(ladder - ours)[:20], "qa-ladder が passed と数えるのに G61 が PASS と読まない行")

    def test_K143_CI_015_cli_names_rows_and_exits_1(self):
        """K143-CI-015 コマンドで流すと、赤の行を「★」で 1 行ずつ出して exit 1。緑なら PASS と数で exit 0"""
        with tempfile.TemporaryDirectory() as t:
            spec = Path(t) / "spec.md"
            spec.write_text(HEAD + row("K62-UI-001", "PASS"), encoding="utf-8")
            r = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", str(spec), "--records", str(Path(t) / "rec")],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 1, r.stdout)
            self.assertIn("★", r.stdout)
            self.assertIn("K62-UI-001", r.stdout)
            spec.write_text(HEAD + row("K62-UI-001"), encoding="utf-8")
            ok = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", str(spec), "--records", str(Path(t) / "rec")],
                                capture_output=True, text=True)
            self.assertEqual(ok.returncode, 0, ok.stdout)
            self.assertIn("PASS", ok.stdout)

    def test_K143_CI_016_wired_into_ci(self):
        """K143-CI-016 CI から回る：web の段で e2e:k の後に record を流し、op_gate を --pending-from-report で流し、記録（07_qa/ci-results）を artifacts に出す。
        spec の段は自分の中で scope の台本を流して本線との分かれ目を出し、check に env（CI_LEDGER_BASE）で渡す（run の文字に ${{ … }} を入れない・K107-CS-034）。
        check は --ledger・--ledger-base-ref "$CI_LEDGER_BASE"・--target-ref "$CI_TARGET_REF"（workflow_dispatch の入力 target を env で・枝の中のファイルから読まない）を持つ。
        自己試験も流す。段の一覧は 05_flow/build_testplan.py が持つ"""
        import yaml  # noqa: PLC0415

        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        jobs = yaml.safe_load(wf)["jobs"]
        web = "\n".join(st.get("run", "") for st in jobs["web"]["steps"])
        i_e2e = web.find("e2e:k")
        i_rec = web.find("scripts/ci/ci_results.py record", i_e2e)
        i_op = web.find("scripts/ci/op_gate.py", i_e2e)
        self.assertGreater(i_rec, i_e2e, "e2e:k の後に record")
        self.assertGreater(i_op, i_rec, "record の後に op_gate")
        self.assertRegex(web, r"op_gate\.py[^\n]*--pending-from-report")
        up = [st for st in jobs["web"]["steps"] if "upload-artifact" in str(st.get("uses", "")) and "07_qa/ci-results" in str(st.get("with", {}).get("path", ""))]
        self.assertEqual(len(up), 1, "web の段は記録（07_qa/ci-results）を artifacts に出す（取り込みの台本が写す元）")
        self.assertNotIn("failure()", str(up[0].get("if", "")), "記録は緑の回にこそ要る（落ちた回だけにしない）")
        spec = jobs["spec"]
        scope = [st for st in spec["steps"] if "scripts/ci/ci_scope.py" in st.get("run", "") and "--github-output" in st.get("run", "")]
        self.assertEqual(len(scope), 1, "spec の段は自分の中で scope の台本を流して本線との分かれ目を出す")
        sid = scope[0].get("id")
        self.assertTrue(sid)
        g61 = [st for st in spec["steps"] if "scripts/ci/ci_results.py check" in st.get("run", "")]
        self.assertEqual(len(g61), 1)
        self.assertGreater(spec["steps"].index(g61[0]), spec["steps"].index(scope[0]), "分かれ目を出してから check")
        run = g61[0]["run"]
        self.assertRegex(run, r"--ledger 07_qa/test-plan/result-ledger\.json")
        self.assertRegex(run, r'--ledger-base-ref "\$CI_LEDGER_BASE"')
        self.assertRegex(run, r"--target-ref \S+")
        self.assertNotRegex(run, r"\$\{\{", "run の文字に ${{ … }} を入れない（K107-CS-034）")
        self.assertEqual(g61[0]["env"]["CI_LEDGER_BASE"].replace(" ", ""), "${{steps.%s.outputs.base}}" % sid)
        # 取り込む先（--target-ref）は、枝の中のファイル（.act-ci.env・ai-team.yaml など）でなく、workflow_dispatch の入力 target
        #   （act_ci.sh が台の側で決める比べる元の枝の名前）から env で渡す（PM の判断 2026-11-08 17:52）
        on = yaml.safe_load(wf).get("on") or yaml.safe_load(wf).get(True)
        self.assertIn("target", on["workflow_dispatch"]["inputs"], "workflow_dispatch に入力 target がある")
        self.assertRegex(run, r'--target-ref "\$CI_TARGET_REF"')
        self.assertEqual(g61[0]["env"]["CI_TARGET_REF"].replace(" ", ""), "${{inputs.target||github.event.repository.default_branch}}")   # K-172：空なら既定の枝
        step_text = json.dumps(g61[0], ensure_ascii=False)
        for f in (".act-ci.env", "ai-team.yaml"):
            self.assertNotIn(f, step_text, f"取り込む先を枝の中の {f} から読まない")
        self.assertNotRegex(wf, r"ci_results\.py check[^\n]*--ledger-base-ref main\b")
        self.assertTrue(any("python3 scripts/ci/ci_results_test.py" in st.get("run", "") for st in spec["steps"]))
        self.assertIn("ci_results.py", (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8"))

    def test_K143_CI_022_spec_runs_even_if_static_is_red(self):
        """K143-CI-022 static の段が赤でも spec の段の検査は流れる。K-156 で spec は static の後に流すことにした（needs: [static]・
        act は needs の無い組を 1 段目にまとめるので）。static が赤でも飛ばさないのは組の if の !cancelled() で守る（needs の結果を見ない）。
        段の中の検査にも static の結果を見る if が無い"""
        import yaml  # noqa: PLC0415

        spec = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))["jobs"]["spec"]
        self.assertIn(spec.get("needs"), (None, ["static"]), "spec が待つのは static だけ")
        if "needs" in spec:
            cond = str(spec.get("if", ""))
            self.assertIn("!cancelled()", cond, "static の赤で丸ごと飛ばされない（success() の既定にしない）")
            self.assertNotIn("needs.static", cond, "static の結果・出力で spec を止めない")
        for st in spec["steps"]:
            self.assertNotIn("needs.static", str(st.get("if", "")), st.get("name"))


def git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


class LedgerBaseTest(unittest.TestCase):
    """台帳は減らすだけを、コマンド（--ledger-base-ref）で本線の版と比べて守る（PM の判断 2026-11-08 15:37）"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.t = Path(self.tmp.name)
        git(self.t, "init", "-q", "-b", "main")
        git(self.t, "config", "user.email", "k143@example.invalid")
        git(self.t, "config", "user.name", "k143")
        (self.t / "specs").mkdir()
        self.spec = self.t / "specs" / "a.md"
        self.ledger = self.t / "ledger.json"

    def tearDown(self):
        self.tmp.cleanup()

    def put_ledger(self, ids):
        self.ledger.write_text(json.dumps({"rows": [{"file": "specs/a.md", "id": i} for i in ids]}), encoding="utf-8")

    def commit(self, msg):
        git(self.t, "add", "-A")
        git(self.t, "commit", "-q", "-m", msg)

    def check(self, ref="main", target="main"):
        args = [sys.executable, str(HERE / "ci_results.py"), "check", "--specs", "specs/*.md", "--records", "rec",
                "--ledger", "ledger.json", "--ledger-base-ref", ref]
        if target is not None:
            args += ["--target-ref", target]
        r = subprocess.run(args, cwd=self.t, capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

    def put_record(self, sha, rows):
        (self.t / "rec").mkdir(exist_ok=True)
        (self.t / "rec" / f"{sha}.json").write_text(json.dumps({"sha": sha, "made_by": "ci_results.py record", "at": "x", "rows": rows}), encoding="utf-8")

    def write_commit(self, sha, msg="K-1 results: 結果の欄を CI の記録から書く"):
        """取り込みの台本の書き込みのコミット（本文に Results-Written-By を持つ）"""
        git(self.t, "add", "-A")
        git(self.t, "commit", "-q", "-m", msg, "-m", f"Results-Written-By: ci_results.py write CI {sha}")

    def test_K143_CI_019_ledger_grows_against_base_ref_is_red(self):
        """K143-CI-019 本線（main）に台帳がある：作業の枝で台帳に行を足すと、コマンドが足した行を名指しして exit 1。減らすのは exit 0"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001", "K57-UI-002"])
        self.commit("本線：台帳 2 行")
        git(self.t, "switch", "-q", "-c", "work")
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS") + row("K62-UI-001", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001", "K57-UI-002", "K62-UI-001"])
        self.commit("枝：手で書いた PASS を台帳に足す")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("K62-UI-001", out)
        self.assertIn("★", out)
        # 減らす（K57-UI-002 を流し直して空に戻し、台帳から消した）のは緑
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002"), encoding="utf-8")
        self.put_ledger(["K57-UI-001"])
        self.commit("枝：台帳を減らす")
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_K143_CI_020_unreadable_base_ref_is_red(self):
        """K143-CI-020 本線の ref が読めない（無い ref・空の ref）なら、台帳が正しくても赤（守りの所で読めないなら止める側）"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001"])
        self.commit("本線")
        code, out = self.check("無い-ref")
        self.assertEqual(code, 1, out)
        self.assertIn("無い-ref", out)
        # static の段が分かれ目を出せなかった（空の ref）ときも赤
        code, out = self.check("")
        self.assertEqual(code, 1, out)

    def test_K143_CI_021_first_ledger_only_covers_base_unmarked_pass(self):
        """K143-CI-021 台帳を入れる回（本線に台帳が無い）：台帳の行が、本線の版の試験の仕様で「CI の印の無い PASS」の行にだけ当たるなら通す。
        本線では空・印つき・無い行を台帳に入れたら、その行を名指しして赤（入れる回に紛れて増やせない）"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002") + row("K57-UI-003", "PASS（CI abcdef1）"), encoding="utf-8")
        self.commit("本線：台帳はまだ無い")
        git(self.t, "switch", "-q", "-c", "work")
        self.put_ledger(["K57-UI-001"])
        self.commit("枝：台帳を入れる（本線の印の無い PASS だけ）")
        code, out = self.check()
        self.assertEqual(code, 0, out)
        # 枝で空の行を PASS に書き換え、台帳を入れる回に紛れて足す・本線に無い行を足す・本線で印つきの行を足す
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS") + row("K57-UI-003", "PASS")
                             + row("K57-UI-004", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001", "K57-UI-002", "K57-UI-003", "K57-UI-004"])
        self.commit("枝：紛れて足す")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        for rid in ("K57-UI-002", "K57-UI-003", "K57-UI-004"):
            self.assertIn(rid, out)
        bad = [ln for ln in out.splitlines() if "★" in ln]
        self.assertFalse([ln for ln in bad if "K57-UI-001" in ln], "本線で印の無い PASS だった行は赤にしない")

    def test_K143_CI_033_same_mark_as_base_is_not_rechecked(self):
        """K143-CI-033 本線と同じ印（PM の判断 15:58）：--ledger-base-ref を付けたときだけ、本線の版と同じ印のまま（同じファイル・行 ID・結果の文字）の行は
        記録を見直さない（取り込みの台本が write の後に check を流してから本線に入れたので確かめ済み）。付けないときは記録と照らす"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS（CI abcdef1）"), encoding="utf-8")
        self.put_ledger([])
        self.commit("本線：印つきの行（記録はこの写しに無い）")
        git(self.t, "switch", "-q", "-c", "work")
        (self.t / "notes.txt").write_text("枝の別の変更", encoding="utf-8")
        self.commit("枝：結果の欄は変えない")
        code, out = self.check()
        self.assertEqual(code, 0, out)
        r = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", "specs/*.md", "--records", "rec",
                            "--ledger", "ledger.json"], cwd=self.t, capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout)   # 本線と比べないときは記録と照らす（記録が無いので赤）

    def test_K143_CI_029_reverting_to_old_mark_is_red(self):
        """K143-CI-029 古い印へ戻す：本線で「FAIL（CI dddddd2）」の行を、枝の普通のコミットで前の回の「PASS（CI aaaaaa1）」に書き戻すと赤（記録が pass でも）"""
        a, d = "aaaaaa1" + "0" * 33, "dddddd2" + "0" * 33
        self.put_record(a, {"K57-UI-001": "pass"})
        self.put_record(d, {"K57-UI-001": "fail"})
        self.spec.write_text(HEAD + row("K57-UI-001", "FAIL（CI dddddd2）"), encoding="utf-8")
        self.put_ledger([])
        self.commit("本線：最新の回で落ちた")
        git(self.t, "switch", "-q", "-c", "work")
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS（CI aaaaaa1）"), encoding="utf-8")
        self.commit("枝：前の回の PASS に戻す")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("K57-UI-001", out)

    def test_K143_CI_031_marks_and_records_only_from_write_commit(self):
        """K143-CI-031 記録の出どころ（17:40 ①）：枝が足した印と記録のファイルは、取り込みの台本の書き込みのコミット（Results-Written-By）で入ったものだけ通す。
        普通のコミットで記録を手で置き、印を書くと赤。書き込みのコミットなら緑"""
        sha = "abcdef1" + "1" * 33
        self.spec.write_text(HEAD + row("K62-UI-001"), encoding="utf-8")
        self.put_ledger([])
        self.commit("本線")
        git(self.t, "switch", "-q", "-c", "forged")
        self.put_record(sha, {"K62-UI-001": "pass"})
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI abcdef1）"), encoding="utf-8")
        self.commit("枝：記録を手で置いて印を書く")
        code, out = self.check()
        self.assertEqual(code, 1, out)
        self.assertIn("K62-UI-001", out)
        git(self.t, "switch", "-q", "main")
        git(self.t, "switch", "-q", "-c", "written")
        self.put_record(sha, {"K62-UI-001": "pass"})
        self.spec.write_text(HEAD + row("K62-UI-001", "PASS（CI abcdef1）"), encoding="utf-8")
        self.write_commit(sha)
        code, out = self.check()
        self.assertEqual(code, 0, out)

    def test_K143_CI_032_base_ref_must_be_ancestor_of_target_and_not_head(self):
        """K143-CI-032 比べる元（17:40 ②）：--ledger-base-ref が HEAD と同じ・取り込む先（--target-ref）の先祖でない・--target-ref が無い／読めないなら赤"""
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001"])
        self.commit("本線")
        git(self.t, "switch", "-q", "-c", "atk")
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001", "K57-UI-002"])
        self.commit("枝：手で書いた PASS を台帳に足す")
        head = git(self.t, "rev-parse", "HEAD").strip()
        code, out = self.check(head)   # 比べる元を枝の先（HEAD）にすり替える
        self.assertEqual(code, 1, out)
        git(self.t, "switch", "-q", "-c", "other", "main")
        # stray の台帳と仕様は枝（atk）の HEAD と同じにして、台帳の増えでは赤にならない形にする。
        # こうすると赤の理由は「--ledger-base-ref が取り込む先（--target-ref）の先祖でない」だけになる（精査 回 8 の NG #31）
        self.spec.write_text(HEAD + row("K57-UI-001", "PASS") + row("K57-UI-002", "PASS"), encoding="utf-8")
        self.put_ledger(["K57-UI-001", "K57-UI-002"])
        (self.t / "x.txt").write_text("取り込む先に無いコミット", encoding="utf-8")
        self.commit("取り込む先の先祖でないコミット（台帳と仕様は枝と同じ）")
        stray = git(self.t, "rev-parse", "HEAD").strip()
        git(self.t, "switch", "-q", "atk")
        code, out = self.check(stray)   # 台帳の増えは無い。先祖の確かめだけで赤になること
        self.assertEqual(code, 1, out)
        # --target-ref 無し／読めない の 2 つは、台帳が main と同じ枝（clean）から流す。
        # atk から流すと台帳の増えでも赤になり、--target-ref の確かめを外した実装でも緑にならない（精査 回 8 の NG #31 の続き）
        git(self.t, "switch", "-q", "-c", "clean", "main")
        (self.t / "y.txt").write_text("台帳と仕様は本線のまま。別のファイルだけ足す", encoding="utf-8")
        self.commit("枝：台帳も仕様も変えない")
        code, out = self.check("main", target="main")   # 対照：台帳の増えが無く target も読めるなら緑
        self.assertEqual(code, 0, out)
        code, out = self.check("main", target=None)   # --target-ref 無し だけで赤になること
        self.assertEqual(code, 1, out)
        code, out = self.check("main", target="無い-枝")   # 読めない --target-ref だけで赤になること
        self.assertEqual(code, 1, out)


class OpGateTest(unittest.TestCase):
    def run_op(self, result, status):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            (t / "spec").mkdir()
            (t / "spec" / "a.md").write_text(HEAD + row("K62-UI-001", result), encoding="utf-8")
            (t / "spec" / "op-gate.json").write_text(json.dumps({"evidence_views": ["操作"], "report_max_age_h": 48}), encoding="utf-8")
            (t / "tickets.json").write_text(json.dumps({"tickets": [{"id": "K-1"}]}), encoding="utf-8")
            rep = pw_report(("K62-UI-001 押す", status)) if status else pw_report(("K62-UI-999 別の行", "passed"))
            (t / "rep.json").write_text(json.dumps(rep), encoding="utf-8")
            r = subprocess.run([sys.executable, str(HERE / "op_gate.py"), "--spec", str(t / "spec"), "--tickets", str(t / "tickets.json"),
                                "--report", str(t / "rep.json"), "--all", "--pending-from-report"], capture_output=True, text=True)
            return r.returncode, r.stdout + r.stderr

    def test_K143_CI_017_op_gate_pending_from_report(self):
        """K143-CI-017 op_gate --pending-from-report：結果が空の行は、今の回の報告で passed なら未実施にしない（緑）。
        failed なら赤。報告に無いなら前のとおり「未実施（結果が空）」で赤"""
        code, out = self.run_op("", "passed")
        self.assertEqual(code, 0, out)
        code, out = self.run_op("", "failed")
        self.assertNotEqual(code, 0, out)
        self.assertIn("K62-UI-001", out)
        code, out = self.run_op("", None)
        self.assertNotEqual(code, 0, out)
        self.assertIn("未実施", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)

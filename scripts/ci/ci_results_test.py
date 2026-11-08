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
  scripts/ci/op_gate.py --pending-from-report：結果が空の行は、今の回の報告で passed なら未実施にしない（取り込みの台本が後で書く）。
      failed なら赤・報告に無いなら前のとおり「未実施（結果が空）」
使い方: python3 scripts/ci/ci_results_test.py
"""
import contextlib, io, json, re, subprocess, sys, tempfile, unittest
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
        取り込み済みの K-57・K-60 の印の無い PASS は台帳に載り、空に戻さない（op_gate --all が赤にならない）"""
        r = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", "07_qa/test-specs/**/*.md",
                            "--records", "07_qa/ci-results", "--ledger", "07_qa/test-plan/result-ledger.json"],
                           cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ledger = json.loads((ROOT / "07_qa/test-plan/result-ledger.json").read_text(encoding="utf-8"))
        ids = {x["id"] for x in ledger["rows"]}
        self.assertTrue(any(i.startswith("K57-") for i in ids) and any(i.startswith("K60-") for i in ids))
        self.assertLessEqual(len(ledger["rows"]), 2593, "台帳は入れた時点の 2593 行より増えない")
        # 何も見ていないのに緑にしない：PASS の行を数えて出す（台帳の行も数える）
        m = re.search(r"PASS (\d+) 行", r.stdout)
        self.assertTrue(m and int(m.group(1)) >= len(ledger["rows"]) > 0, r.stdout)
        # 容れ物の中（まっさらな写し）と手元で同じ結果：台帳のファイルは作業場所の頭からの道で持つ（/ で始めない）
        self.assertTrue(all(not x["file"].startswith("/") for x in ledger["rows"]))

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
        """K143-CI-016 CI から回る：v3-gate.yml の web の段で e2e:k の後に record を流し、op_gate を --pending-from-report で流す。
        検査（check）と、この自己試験を CI の段で流す。段の一覧は 05_flow/build_testplan.py が持つ"""
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        i_e2e = wf.find("e2e:k")
        i_rec = wf.find("scripts/ci/ci_results.py record", i_e2e)
        i_op = wf.find("scripts/ci/op_gate.py", i_e2e)
        self.assertGreater(i_rec, i_e2e, "e2e:k の後に record")
        self.assertGreater(i_op, i_rec, "record の後に op_gate")
        self.assertRegex(wf, r"op_gate\.py[^\n]*--pending-from-report")
        self.assertRegex(wf, r"scripts/ci/ci_results\.py check[^\n]*--ledger [^\n]*--ledger-base-ref \"\$\{\{ needs\.static\.outputs\.base \}\}\"",
                         "検査の段は台帳と、static の段が出す本線との分かれ目（main の決め打ちでなく）を必ず付ける")
        self.assertNotRegex(wf, r"ci_results\.py check[^\n]*--ledger-base-ref main\b")
        # その ref の出どころ：static の段の G0（scope）が base を出し、spec の段はそれを待つ
        self.assertRegex(wf, r"\n      base: \$\{\{ steps\.scope\.outputs\.base \}\}")
        spec_job = wf[wf.index("\n  spec:"):]
        head = spec_job[: spec_job.index("steps:")]
        self.assertRegex(head, r"needs: \[?[^\n]*\bstatic\b", "spec の段は static の段を待つ（outputs.base を読む）")
        self.assertRegex(wf, r"python3 scripts/ci/ci_results_test\.py")
        self.assertIn("ci_results.py", (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8"))


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

    def check(self, ref="main"):
        r = subprocess.run([sys.executable, str(HERE / "ci_results.py"), "check", "--specs", "specs/*.md", "--records", "rec",
                            "--ledger", "ledger.json", "--ledger-base-ref", ref], cwd=self.t, capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

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

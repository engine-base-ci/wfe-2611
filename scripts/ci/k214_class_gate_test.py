#!/usr/bin/env python3
"""K-214 の試験：画面のクラスが CSS に在るか・殻（外枠）の決まりを本文で使っていないか（scripts/ci/class_gate.py）。

  python3 scripts/ci/k214_class_gate_test.py      全部の行（行 ID は K214-CG-NNN。11_tickets/K-214.md の行の表と 1 対 1）

由来：段 1 の 4 画面が、どの CSS にも定義の無いクラス（k-page・k-page-head・k-row・k-section・k-list・k-link・k-pre・k-steps・
k-code・k-check）を使い、作る画面は外枠の右のパネルの決まり（.k-panel）を本文の箱に流用していた。どの検査も見ていなかった（調べの H2・H3）。

検査が見るもの（K-214.md の「拾う範囲」）：
  ・apps/web の .tsx の className="…"・className={…} の中の文字（"…"・'…'・`…` の静的な部分。cn() の引数も同じ）・classNames={{ 鍵: "…" }} の値
  ・どの層でも：名前の頭が k の新しい部品の名前（k-・k62- のように k と数字の後に -）が CSS に在るか
  ・新しい層（apps/web/features・apps/web/components/k）では、className の字は全部「CSS に在る k の名前」か sr-only だけ。
    それ以外（page-head・text-[13.5px] などの tailwind の字・[ を含む任意の値）は foreign、style={…} は style で出す
  ・定義は apps/web の .css の .名前（複合・擬似・@media の中も）。node_modules・.next・注釈の中は数えない
  ・赤の種類：undefined（どの CSS にも無い）／shell（components/k/shell.css にだけ在る外枠の決まりを components/k の外で使う）／
    built（`k-btn-${v}` のように名前を組み立てて確かめられない）／unresolved（新しい層で className={変数}・cn(変数, …) と書いて中が読めない。
    受け取った className をそのまま渡すのは除く）／foreign・style（新しい層だけ・上）
  ・台帳 scripts/ci/class_ledger.json：今ある赤は台帳に載せて通す。台帳は減らすだけ（増えたら赤・直したのに残れば赤・本線との分かれ目より行が増えたら赤）

作りものの木は tempfile の中に作る。git には GIT_ で始まる環境の値を除いて渡す（フックの中で流しても本物に当たらない）。
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import class_gate  # noqa: E402  実装の役が作る（この試験が先）

GATE = HERE / "class_gate.py"
# 自己試験の旗の字。この試験のファイルに旗の字をそのまま書くと、CI の配線の検査（ci_wiring_gate）が「旗を持つ検査」と数える
SELF = "--" + "selftest"
LEDGER = HERE / "class_ledger.json"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
TICKETS = ROOT / "11_tickets"

K_CSS = ".k-a { color: var(--k-ink); }\n.k-b.k-c:hover { color: red; }\n@media (max-width: 600px) { .k-d > .k-e { gap: 0; } }\n/* .k-ghost は注釈 */\n.k-tabs { display: flex; }\n"
SHELL_CSS = ".k-shell { display: flex; }\n.k-panel { position: sticky; }\n.k-tabs { gap: 0; }\n"


def clean_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update({"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
                "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"})
    return env


class Tree:
    """作りものの apps/web と 11_tickets（K-1 だけ在る）"""

    def __init__(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k214-"))
        self.write("apps/web/components/k/k.css", K_CSS)
        self.write("apps/web/components/k/shell.css", SHELL_CSS)
        self.write("apps/web/components/k/shell.tsx", 'export const S = () => <div className="k-shell"><aside className="k-panel" /></div>;\n')
        self.write("11_tickets/K-1.md", "---\nid: K-1\n---\n")

    def write(self, rel: str, text: str) -> pathlib.Path:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def ledger(self, entries: list[dict]) -> pathlib.Path:
        return self.write("scripts/ci/class_ledger.json", json.dumps({"_doc": "試し", "entries": entries}, ensure_ascii=False))

    def findings(self) -> set[tuple[str, str, str]]:
        return {(f["kind"], f["cls"], f["file"]) for f in class_gate.scan(self.root)}

    def run(self, *extra: str) -> subprocess.CompletedProcess:
        args = [sys.executable, str(GATE), "--root", str(self.root), "--ledger", str(self.root / "scripts/ci/class_ledger.json"),
                "--tickets", str(self.root / "11_tickets"), *extra]
        return subprocess.run(args, capture_output=True, text=True, env=clean_env(), cwd=self.root)

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


def entry(kind: str, cls: str, file: str, owner: str = "K-1", reason: str = "直すチケットが持つ") -> dict:
    return {"kind": kind, "cls": cls, "file": file, "owner": owner, "reason": reason}


F = "apps/web/features/F9/x/page.tsx"


class ScanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.t = Tree()

    def tearDown(self) -> None:
        self.t.close()

    def test_K214_CG_001_plain_string(self) -> None:
        """K214-CG-001 前の世代の層（components/ai）の className="k-a k-zzz px-2" は k-zzz（どの CSS にも無い）だけを undefined で出し、行の番号 2 も出す。k-a と tailwind の px-2 は出さない"""
        old = "apps/web/components/ai/x.tsx"
        self.t.write(old, 'export const P = () => (\n  <main className="k-a k-zzz px-2" />\n);\n')
        got = class_gate.scan(self.t.root)
        self.assertEqual({(f["kind"], f["cls"], f["file"]) for f in got}, {("undefined", "k-zzz", old)})
        self.assertEqual(got[0]["line"], 2)

    def test_K214_CG_002_braces_cn_and_template(self) -> None:
        """K214-CG-002 className={cn("k-a", on && "k-yyy")} と className={`k-b ${x ? "k-www" : ""}`} の中の文字を拾い、k-yyy と k-www を出す"""
        self.t.write(F, 'export const P = ({on, x}) => (<>\n<p className={cn("k-a", on && "k-yyy")} />\n'
                        '<p className={`k-b ${x ? "k-www" : ""}`} />\n</>);\n')
        self.assertEqual(self.t.findings(), {("undefined", "k-yyy", F), ("undefined", "k-www", F)})

    def test_K214_CG_003_built_name(self) -> None:
        """K214-CG-003 className={`k-btn-${v}`} のように名前を組み立てた所を built で出す（中の名前は確かめられない）"""
        self.t.write(F, "export const P = ({v}) => <p className={`k-a k-btn-${v}`} />;\n")
        kinds = {(k, f) for k, _, f in self.t.findings()}
        self.assertEqual(kinds, {("built", F)})

    def test_K214_CG_004_classnames_object(self) -> None:
        """K214-CG-004 classNames={{ toast: "k-qqq", title: "k-a" }} の値を拾い、k-qqq を出す"""
        self.t.write(F, 'export const P = () => <T classNames={{ toast: "k-qqq", title: "k-a" }} />;\n')
        self.assertEqual(self.t.findings(), {("undefined", "k-qqq", F)})

    def test_K214_CG_005_unresolved_only_in_new_layer(self) -> None:
        """K214-CG-005 features と components/k の className={cls} は unresolved で出す。className={className} の受け渡しと、components/ai の className={cls} は出さない"""
        self.t.write(F, "export const P = ({c}) => { const cls = c; return <p className={cls} />; };\n")
        self.t.write("apps/web/components/k/pass.tsx", "export const Q = ({ className }) => <p className={className} />;\n")
        self.t.write("apps/web/components/ai/old.tsx", "export const R = ({c}) => { const cls = c; return <p className={cls} />; };\n")
        self.assertEqual({(k, f) for k, _, f in self.t.findings()}, {("unresolved", F)})

    def test_K214_CG_006_css_definitions(self) -> None:
        """K214-CG-006 複合（.k-b.k-c:hover）・@media の中（.k-d > .k-e）は定義として数え、注釈の中（.k-ghost）と node_modules・.next の .css は数えない"""
        self.t.write("apps/web/node_modules/x/a.css", ".k-nm { color: red; }\n")
        self.t.write("apps/web/.next/static/b.css", ".k-nx { color: red; }\n")
        self.t.write(F, 'export const P = () => <p className="k-b k-c k-d k-e k-ghost k-nm k-nx" />;\n')
        self.assertEqual({c for _, c, _ in self.t.findings()}, {"k-ghost", "k-nm", "k-nx"})

    def test_K214_CG_007_shell_only_classes(self) -> None:
        """K214-CG-007 components/k/shell.css にだけ在る k-panel を features で使うと shell で出す。shell.tsx の中と、k.css にも在る k-tabs は出さない"""
        self.t.write(F, 'export const P = () => <section className="k-panel k-tabs" />;\n')
        self.assertEqual(self.t.findings(), {("shell", "k-panel", F)})


class LedgerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.t = Tree()
        self.t.write(F, 'export const P = () => <main className="k-zzz k-panel" />;\n')
        self.both = [entry("undefined", "k-zzz", F), entry("shell", "k-panel", F)]

    def tearDown(self) -> None:
        self.t.close()

    def test_K214_CG_008_all_in_ledger_is_green(self) -> None:
        """K214-CG-008 赤が全部台帳に載っていれば 0 で終わり、台帳で通した件数を出す"""
        self.t.ledger(self.both)
        r = self.t.run("--no-base")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("台帳で通した 2", r.stdout)

    def test_K214_CG_009_new_finding_is_red(self) -> None:
        """K214-CG-009 台帳に無い赤が 1 つでもあれば 1 で終わり、その名前とファイル:行を出す（台帳に別の行があっても）"""
        self.t.ledger(self.both[:1])
        r = self.t.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("k-panel", r.stdout)
        self.assertIn(f"{F}:1", r.stdout)

    def test_K214_CG_010_stale_entry_is_red(self) -> None:
        """K214-CG-010 直して赤が消えたのに台帳に残る行があれば 1 で終わり、「台帳から消す」と出す"""
        self.t.ledger(self.both + [entry("undefined", "k-gone", F)])
        r = self.t.run("--no-base")
        self.assertEqual(r.returncode, 1)
        self.assertIn("k-gone", r.stdout)
        self.assertIn("台帳から消す", r.stdout)

    def test_K214_CG_011_ledger_grew_since_base_is_red(self) -> None:
        """K214-CG-011 本線との分かれ目の台帳に無い行が今の台帳に在れば 1（台帳に足して通さない）。比べる版が読めなければ 1。--no-base も --ledger-base-ref も無ければ 1"""
        env = clean_env()
        git = lambda *a: subprocess.run(["git", *a], cwd=self.t.root, env=env, capture_output=True, text=True, check=True)  # noqa: E731
        git("init", "-q")
        self.t.ledger(self.both[:1])
        git("add", "-A")
        git("commit", "-qm", "base")
        self.t.ledger(self.both)
        r = self.t.run("--ledger-base-ref", "HEAD")
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("k-panel", r.stdout)
        self.assertEqual(self.t.run("--ledger-base-ref", "nai-ref-x").returncode, 1)
        self.assertEqual(self.t.run().returncode, 1)

    def test_K214_CG_012_ledger_row_shape(self) -> None:
        """K214-CG-012 台帳の行に持ち主（11_tickets に在るチケット）か理由が無ければ 1"""
        self.t.ledger([entry("undefined", "k-zzz", F, owner="K-99999"), entry("shell", "k-panel", F)])
        self.assertEqual(self.t.run("--no-base").returncode, 1)
        self.t.ledger([entry("undefined", "k-zzz", F, reason=""), entry("shell", "k-panel", F)])
        self.assertEqual(self.t.run("--no-base").returncode, 1)


class RealTreeTest(unittest.TestCase):
    def test_K214_CG_013_real_tree_green_with_ledger(self) -> None:
        """K214-CG-013 本物の木で、本物の台帳（scripts/ci/class_ledger.json）を当てると 0 で終わる"""
        r = subprocess.run([sys.executable, str(GATE), "--no-base"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K214_CG_014_real_ledger_equals_findings(self) -> None:
        """K214-CG-014 本物の木の赤の組（種類・名前・ファイル）と、本物の台帳の組がちょうど同じ（台帳の行はどれも今ある赤・台帳に無い赤は 0。台帳が減って 0 行になっても成り立つ）"""
        found = {(f["kind"], f["cls"], f["file"]) for f in class_gate.scan(ROOT)}
        rows = json.loads(LEDGER.read_text(encoding="utf-8"))["entries"]
        self.assertEqual({(e["kind"], e["cls"], e["file"]) for e in rows}, found)

    def test_K214_CG_015_ledger_rows_have_owner_and_reason(self) -> None:
        """K214-CG-015 本物の台帳のどの行も、持ち主のチケットが 11_tickets に在り、理由が空でない（行が 0 なら見る行が無いだけで通る）"""
        for e in json.loads(LEDGER.read_text(encoding="utf-8"))["entries"]:
            self.assertTrue((TICKETS / f"{e['owner']}.md").exists(), e)
            self.assertTrue(e["reason"].strip(), e)

    def test_K214_CG_017_new_layer_foreign_and_style(self) -> None:
        """K214-CG-017 新しい層の className="page-head text-[13.5px] sr-only k-a" は page-head と text-[13.5px] を foreign で出し、sr-only と k-a は出さない。
        style={{ fontSize: 13 }} は style で出す。前の世代（components/ai）の同じ書き方は出さない"""
        t = Tree()
        try:
            t.write(F, 'export const P = () => (<>\n<p className="page-head text-[13.5px] sr-only k-a" />\n<p style={{ fontSize: 13 }} />\n</>);\n')
            t.write("apps/web/components/ai/old.tsx", 'export const R = () => <p className="text-[13.5px]" style={{ fontSize: 13 }} />;\n')
            got = {(k, c, f) for k, c, f in t.findings()}
            self.assertEqual({(k, c) for k, c, f in got if f == F and k == "foreign"}, {("foreign", "page-head"), ("foreign", "text-[13.5px]")})
            self.assertEqual({k for k, _, f in got if f == F} - {"foreign"}, {"style"})
            self.assertFalse([g for g in got if g[2].startswith("apps/web/components/ai/")])
        finally:
            t.close()

    def test_K214_CG_018_cn_with_variable(self) -> None:
        """K214-CG-018 新しい層の className={cn(base, "k-a")}（名前を変数で渡す）は unresolved で出す。cn(className, "k-a")（受け取った className）は出さない"""
        t = Tree()
        try:
            t.write(F, 'export const P = ({ className }) => { const base = "x"; return (<>\n<p className={cn(base, "k-a")} />\n<p className={cn(className, "k-a")} />\n</>); };\n')
            self.assertEqual({(k, f) for k, _, f in t.findings()}, {("unresolved", F)})
        finally:
            t.close()


class WiringTest(unittest.TestCase):
    def test_K214_CG_016_runs_in_ci(self) -> None:
        """K214-CG-016 CI の spec の組に G67 の段が 1 つ在り、class_gate.py の自己試験と、本線との分かれ目と比べる class_gate.py --ledger-base-ref とこの試験を流す。continue-on-error が無い"""
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        steps = [s for s in wf["jobs"]["spec"]["steps"] if str(s.get("name", "")).startswith("G67 ")]
        self.assertEqual(len(steps), 1, "G67 の段が 1 つでない")
        run = steps[0]["run"]
        self.assertIn("python3 scripts/ci/class_gate.py " + SELF, run)
        self.assertIn("python3 scripts/ci/class_gate.py --ledger-base-ref", run)
        self.assertIn("python3 scripts/ci/k214_class_gate_test.py", run)
        self.assertNotIn("continue-on-error", steps[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)

#!/usr/bin/env python3
"""K-261 design_gate の D8（画面の CSS の生の長さ）と、その台帳・CI の配線の試験。

作りものの木は tempfile の中に作り、design_gate.py を子プロセスで流す。本物の木は読むだけ（CI の段の命令を流すだけ）。
行 ID は K261-RL-001〜018（チケット 11_tickets/K-261.md の表）。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "scripts" / "ci" / "design_gate.py"
CFG = ROOT / "design-gate.json"
TESTPLAN = ROOT / "05_flow" / "build_testplan.py"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
LEDGER_CAP_ROWS = 888        # 台帳を入れた時点の行の数（K-261）。減らすだけ
LEDGER_CAP_COUNT = 888       # 台帳を入れた時点の生の値の数（count の和）

DESIGN = """---
colors:
  primary: "#22345C"
typography:
  body:
    fontSize: 13px
rounded:
  sm: 4px
---
# 作りもの
"""
TOKENS = ":root {\n  --k-s-sm: 8px;\n  --k-s-md: 16px;\n  --k-lh-body: 1.6;\n  --k-shadow: 0 8px 24px #0002;\n}\n"
BASE_CFG = {
    "raw_lengths": {
        "paths": ["web"],
        "token_css": ["web/tokens.css"],
        "token_prefix": "--k-",
        "allow": [{"value": "0", "reason": "零は長さを持たない"}, {"value": "100%", "reason": "親いっぱいはトークンにしない"}],
        "ledger": "ledger.json",
    }
}


class Tree:
    """作りものの木：DESIGN.md・design-gate.json・web/tokens.css・web/a.css・ledger.json"""

    def __init__(self, css: str, cfg: dict | None = None, ledger: list[dict] | None = None) -> None:
        self.dir = Path(tempfile.mkdtemp(prefix="k261-"))
        (self.dir / "DESIGN.md").write_text(DESIGN, encoding="utf-8")
        (self.dir / "web").mkdir()
        (self.dir / "web" / "tokens.css").write_text(TOKENS, encoding="utf-8")
        self.css(css)
        self.cfg(BASE_CFG if cfg is None else cfg)
        self.ledger(ledger or [])

    def css(self, text: str) -> None:
        (self.dir / "web" / "a.css").write_text(text, encoding="utf-8")

    def cfg(self, cfg: dict) -> None:
        (self.dir / "design-gate.json").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")

    def ledger(self, entries: list[dict]) -> None:
        (self.dir / "ledger.json").write_text(json.dumps({"_doc": "試験", "entries": entries}, ensure_ascii=False),
                                              encoding="utf-8")

    def read_ledger(self) -> list[dict]:
        return json.loads((self.dir / "ledger.json").read_text(encoding="utf-8"))["entries"]

    def run(self, *extra: str, base: bool = False) -> subprocess.CompletedProcess:
        args = [sys.executable, str(GATE), "--design", str(self.dir / "DESIGN.md"), "--mocks", str(self.dir / "web"),
                "--css", str(self.dir / "web" / "tokens.css"), "--part", "--no-components", *extra]
        if not base and "--ledger-base-ref" not in extra and "--raw-lengths" in extra:
            args.append("--no-base")
        return subprocess.run(args, cwd=self.dir, capture_output=True, text=True, timeout=120)

    def git(self, *args: str) -> None:
        subprocess.run(["git", "-c", "user.email=t@example.invalid", "-c", "user.name=t", *args], cwd=self.dir,
                       check=True, capture_output=True, text=True)

    def close(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


def d8_lines(out: str) -> list[str]:
    return [ln.strip() for ln in out.splitlines() if ln.strip().startswith("D8 ")]


def entry(sel: str, prop: str, value: str, count: int = 1, reason: str = "前からの値。その画面のチケットが直す") -> dict:
    return {"file": "web/a.css", "selector": sel, "prop": prop, "value": value, "count": count, "reason": reason}


class D8(unittest.TestCase):
    def tree(self, css: str, **kw) -> Tree:
        t = Tree(css, **kw)
        self.addCleanup(t.close)
        return t

    def assertRed(self, css: str, why: str = "") -> subprocess.CompletedProcess:
        r = self.tree(css).run("--raw-lengths")
        self.assertEqual(r.returncode, 1, f"{why}\n{css}\n{r.stdout}{r.stderr}")
        self.assertTrue(d8_lines(r.stdout), f"{why}：D8 の行が無い\n{r.stdout}")
        return r

    def assertGreen(self, css: str, why: str = "") -> subprocess.CompletedProcess:
        r = self.tree(css).run("--raw-lengths")
        self.assertEqual(r.returncode, 0, f"{why}\n{css}\n{r.stdout}{r.stderr}")
        self.assertEqual(d8_lines(r.stdout), [], why)
        return r

    # ---------------------------------------------------------------- 赤と緑
    def test_K261_RL_001_raw_padding_red(self) -> None:
        """K261-RL-001 生の padding を足すと 1 で終わり、ファイル:行・宣言・値を出す"""
        r = self.assertRed(".a {\n  color: inherit;\n  padding: 10px 12px;\n}\n")
        lines = d8_lines(r.stdout)
        self.assertEqual(len(lines), 1, r.stdout)
        self.assertIn("web/a.css:3", lines[0])
        self.assertIn(".a", lines[0])
        self.assertIn("padding: 10px 12px", lines[0])
        self.assertRegex(r.stdout, r"D8_生の長さ: 1 件")

    def test_K261_RL_002_token_green(self) -> None:
        """K261-RL-002 同じ所をトークンにすると 0 で終わる"""
        r = self.assertGreen(".a {\n  color: inherit;\n  padding: var(--k-s-sm) var(--k-s-md);\n}\n")
        self.assertRegex(r.stdout, r"D8_生の長さ: 0 件")

    def test_K261_RL_003_each_property_red(self) -> None:
        """K261-RL-003 大きさ・余白・間・行の高さ・影・枠の太さ・位置・格子・字の間の生の値はどれも赤"""
        decls = [
            "width: 240px", "height: 32px", "min-width: 120px", "max-width: 720px", "min-height: 44px",
            "max-height: 80vh", "padding-top: 4px", "padding-inline: 12px", "margin: 0 auto 16px",
            "margin-left: -2px", "gap: 6px", "row-gap: 4px", "column-gap: 8px", "inset: 0 4px",
            "top: 8px", "right: 8px", "bottom: 8px", "left: 50%", "line-height: 1.9", "line-height: 20px",
            "box-shadow: 0 8px 24px #0002", "border-width: 2px", "border-top-width: 1px", "border: 1px solid #000",
            "border-bottom: 2px solid currentColor", "outline: 2px solid #000", "outline-offset: 2px",
            "flex-basis: 240px", "flex: 1 1 240px", "grid-template-columns: 240px 1fr",
            "grid-template-rows: auto 48px", "transform: translateY(4px)", "letter-spacing: .02em",
            "font: 14px/1.5 sans-serif", "translate: 0 2px",
        ]
        for d in decls:
            with self.subTest(d):
                self.assertRed(f".a {{ {d}; }}\n", d)

    def test_K261_RL_004_each_unit_red(self) -> None:
        """K261-RL-004 単位ごと（px・rem・em・%・vw・vh・ch・大文字の PX）に赤"""
        for v in ("12px", "1rem", "1.5em", "50%", "10vw", "20vh", "60ch", "12PX", ".5rem"):
            with self.subTest(v):
                self.assertRed(f".a {{ width: {v}; }}\n", v)

    def test_K261_RL_005_loopholes_red(self) -> None:
        """K261-RL-005 抜け道はどれも赤：予備の値・自前の変数（定義と使う所）・無いトークン・calc・入れ子・@layer/@supports/@media の中・!important"""
        cases = {
            "予備の値": ".a { gap: var(--k-s-sm, 12px); }",
            "無いトークン": ".a { gap: var(--k-nope); }",
            "calc": ".a { width: calc(100% - 12px); }",
            "入れ子": ".a { color: inherit; &:hover { gap: 6px; } }",
            "@layer": "@layer x { .a { gap: 6px; } }",
            "@supports": "@supports (display: grid) { .a { gap: 6px; } }",
            "@media の中": "@media (max-width: 767px) { .a { gap: 6px; } }",
            "important": ".a { gap: 6px !important; }",
            "自前の --k- の定義": ".a { --k-mine: 240px; }",
        }
        for why, css in cases.items():
            with self.subTest(why):
                self.assertRed(css + "\n", why)
        r = self.assertRed(".a { --w: 240px; }\n.b { width: var(--w); }\n", "自前の変数")
        lines = d8_lines(r.stdout)
        self.assertEqual(len(lines), 2, f"定義と使う所の 2 つ：{r.stdout}")
        self.assertTrue(any("--w: 240px" in ln for ln in lines), r.stdout)
        self.assertTrue(any("width: var(--w)" in ln for ln in lines), r.stdout)

    def test_K261_RL_006_allowed_green(self) -> None:
        """K261-RL-006 許しの値（0・0px・-0・auto・100%）・line-height の normal とトークンは緑。許しに無い 50% は赤"""
        self.assertGreen(".a { margin: 0 auto; padding: 0px; top: -0; width: 100%; height: auto; "
                         "line-height: normal; }\n.b { line-height: var(--k-lh-body); box-shadow: var(--k-shadow); "
                         "min-width: 0%; }\n")
        self.assertRed(".a { width: 50%; }\n", "許しに無い %")

    def test_K261_RL_007_conditions_green(self) -> None:
        """K261-RL-007 @media・@container の条件の区切りの幅と @keyframes の区切りは見ない"""
        self.assertGreen("@media (max-width: 767px) and (min-width: 320px) { .a { gap: var(--k-s-sm); } }\n"
                         "@container side (min-width: 400px) { .a { gap: var(--k-s-sm); } }\n"
                         "@keyframes k { 0% { opacity: 0; } 50% { opacity: .5; } 100% { opacity: 1; } }\n")

    def test_K261_RL_008_not_lengths_green(self) -> None:
        """K261-RL-008 長さでない物は見ない：font-size（D4）・角丸（D3）・色の関数の %・文字・url・時間・数だけの値"""
        r = self.assertGreen(
            ".a { font-size: 13px; border-radius: 4px; border-top-left-radius: 4px; "
            "background: color-mix(in srgb, #22345C 20%, transparent); color: hsl(0 0% 50%); "
            "content: \"12px\"; background-image: url(a-12px.svg); transition: opacity .2s ease 100ms; "
            "z-index: 10; opacity: .5; flex: 1; font-weight: 600; aspect-ratio: 16 / 9; "
            "grid-template-columns: repeat(3, minmax(0, 1fr)); }\n")
        self.assertRegex(r.stdout, r"D4_文字_段に無い: 0 件")

    def test_K261_RL_009_token_file_ignored(self) -> None:
        """K261-RL-009 token_css（トークンの定義元）の宣言は見ない。トークンの外の画面の CSS だけを見る"""
        t = self.tree(".a { gap: var(--k-s-sm); }\n")
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("tokens.css", "\n".join(d8_lines(r.stdout)))

    # ---------------------------------------------------------------- 設定
    def test_K261_RL_010_config_failures_red(self) -> None:
        """K261-RL-010 設定の誤りは黙って緑にしない：raw_lengths が無い・比べ方の指定が無い・理由の無い許し・無い token_css・.css が 0"""
        css = ".a { gap: var(--k-s-sm); }\n"
        t = self.tree(css, cfg={})
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("raw_lengths", r.stdout)
        t = self.tree(css)
        r = t.run("--raw-lengths", base=True)
        self.assertEqual(r.returncode, 1, "比べ方の指定が無いのに緑\n" + r.stdout)
        self.assertIn("--ledger-base-ref", r.stdout + r.stderr)
        bad = json.loads(json.dumps(BASE_CFG))
        bad["raw_lengths"]["allow"].append({"value": "1px"})
        r = self.tree(css, cfg=bad).run("--raw-lengths")
        self.assertEqual(r.returncode, 1, "理由の無い許しで緑\n" + r.stdout)
        bad = json.loads(json.dumps(BASE_CFG))
        bad["raw_lengths"]["token_css"] = ["web/none.css"]
        r = self.tree(css, cfg=bad).run("--raw-lengths")
        self.assertEqual(r.returncode, 1, "無い token_css で緑\n" + r.stdout)
        bad = json.loads(json.dumps(BASE_CFG))
        bad["raw_lengths"]["paths"] = ["nothing"]
        r = self.tree(css, cfg=bad).run("--raw-lengths")
        self.assertEqual(r.returncode, 1, ".css が 0 で緑\n" + r.stdout)

    # ---------------------------------------------------------------- 台帳
    def test_K261_RL_011_ledger(self) -> None:
        """K261-RL-011 台帳：載っていれば緑・数が増えたら赤・直ったのに残れば赤・同じ行 2 つ・理由が空・count 0 は赤"""
        css = ".a { gap: 6px; }\n"
        t = self.tree(css, ledger=[entry(".a", "gap", "6px")])
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 0, r.stdout)
        t.css(".a { gap: 6px; }\n.a { gap: 6px; }\n")
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 1, "同じ宣言が 2 つに増えたのに緑\n" + r.stdout)
        t.css(".a { gap: var(--k-s-sm); }\n")
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 1, "直ったのに台帳に残って緑\n" + r.stdout)
        self.assertIn("台帳", r.stdout)
        for why, led in {
            "同じ行 2 つ": [entry(".a", "gap", "6px"), entry(".a", "gap", "6px")],
            "理由が空": [entry(".a", "gap", "6px", reason=" ")],
            "count 0": [entry(".a", "gap", "6px", count=0)],
        }.items():
            with self.subTest(why):
                r = self.tree(css, ledger=led).run("--raw-lengths")
                self.assertEqual(r.returncode, 1, f"{why}で緑\n{r.stdout}")

    def test_K261_RL_012_ledger_vs_base(self) -> None:
        """K261-RL-012 分かれ目の台帳と比べる：足した行・増やした count は赤・同じか減らすのは緑・読めない版は赤"""
        css = ".a { gap: 6px; }\n.b { gap: 4px; }\n"
        t = self.tree(css, ledger=[entry(".a", "gap", "6px"), entry(".b", "gap", "4px")])
        t.git("init", "-q")
        t.git("add", "-A")
        t.git("commit", "-q", "-m", "base")
        r = t.run("--raw-lengths", "--ledger-base-ref", "HEAD")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        t.css(css + ".c { gap: 2px; }\n")
        t.ledger([entry(".a", "gap", "6px"), entry(".b", "gap", "4px"), entry(".c", "gap", "2px")])
        r = t.run("--raw-lengths", "--ledger-base-ref", "HEAD")
        self.assertEqual(r.returncode, 1, "台帳に足して通った\n" + r.stdout)
        self.assertIn("分かれ目", r.stdout)
        t.css(css + ".a { gap: 6px; }\n")
        t.ledger([entry(".a", "gap", "6px", count=2), entry(".b", "gap", "4px")])
        r = t.run("--raw-lengths", "--ledger-base-ref", "HEAD")
        self.assertEqual(r.returncode, 1, "count を増やして通った\n" + r.stdout)
        t.css(".a { gap: 6px; }\n")
        t.ledger([entry(".a", "gap", "6px")])
        r = t.run("--raw-lengths", "--ledger-base-ref", "HEAD")
        self.assertEqual(r.returncode, 0, "減らしたのに赤\n" + r.stdout)
        r = t.run("--raw-lengths", "--ledger-base-ref", "no-such-ref")
        self.assertEqual(r.returncode, 1, "読めない版で緑\n" + r.stdout)

    def test_K261_RL_013_shrink(self) -> None:
        """K261-RL-013 --shrink-ledger は直った行を消し count を今の数に下げるだけで、台帳に無い赤は足さない"""
        t = self.tree(".a { gap: 6px; }\n.c { gap: 2px; }\n",
                      ledger=[entry(".a", "gap", "6px", count=3), entry(".b", "gap", "4px")])
        r = t.run("--raw-lengths", "--shrink-ledger")
        led = t.read_ledger()
        self.assertEqual([(e["selector"], e["count"]) for e in led], [(".a", 1)], r.stdout)
        self.assertEqual(led[0]["reason"], entry(".a", "gap", "6px")["reason"])
        r = t.run("--raw-lengths")
        self.assertEqual(r.returncode, 1, "台帳に無い .c が足されて緑になった\n" + r.stdout)

    def test_K261_RL_014_json(self) -> None:
        """K261-RL-014 --json に D8_生の長さ（赤の並び）が在り、fails に数える"""
        r = self.tree(".a { gap: 6px; padding: 2px; }\n").run("--raw-lengths", "--json")
        self.assertEqual(r.returncode, 1, r.stdout)
        out = json.loads(r.stdout)
        self.assertEqual(len(out["D8_生の長さ"]), 2, out)
        self.assertGreaterEqual(out["fails"], 2)

    def test_K261_RL_018_off_without_flag(self) -> None:
        """K261-RL-018 --raw-lengths を付けない回は D8 を流さず「掛けていません」と出す（前からの使い方を変えない）"""
        r = self.tree(".a { gap: 6px; }\n").run()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, r"D8_生の長さ: 掛けていません")


class RealTree(unittest.TestCase):
    def gate_entry(self) -> tuple[str, str]:
        src = TESTPLAN.read_text(encoding="utf-8")
        line = next((ln for ln in src.splitlines() if "k261_raw_lengths_test.py" in ln and '"script"' in ln), None)
        self.assertIsNotNone(line, "build_testplan.py に K-261 の段が無い")
        script = re.search(r'"script": "((?:[^"\\]|\\.)*)"', line).group(1).replace('\\"', '"')
        env = re.search(r'"env": "((?:[^"\\]|\\.)*)"', line)
        self.assertIn('"job": "spec"', line)
        self.assertIn('"blocking": True', line)
        return script, (env.group(1) if env else "")

    def test_K261_RL_015_real_tree(self) -> None:
        """K261-RL-015 本物の設定と台帳：置き場・トークン・許しの理由・台帳の上限と形、CI の命令が本物の木で 0 で終わる"""
        conf = json.loads(CFG.read_text(encoding="utf-8"))["raw_lengths"]
        self.assertIn("apps/web", conf["paths"])
        self.assertIn("apps/web/styles/k-tokens.css", conf["token_css"])
        for a in conf["allow"]:
            self.assertGreaterEqual(len(str(a.get("reason") or "").strip()), 6, a)
        self.assertEqual({str(a["value"]) for a in conf["allow"]}, {"0", "100%"})
        led = json.loads((ROOT / conf["ledger"]).read_text(encoding="utf-8"))["entries"]
        self.assertLessEqual(len(led), LEDGER_CAP_ROWS, "台帳の行が入れた時点より増えた")
        self.assertLessEqual(sum(e["count"] for e in led), LEDGER_CAP_COUNT, "台帳の生の値が入れた時点より増えた")
        for e in led:
            self.assertTrue((ROOT / e["file"]).is_file(), e)
            self.assertGreaterEqual(len(e["reason"].strip()), 10, e)
        script, _ = self.gate_entry()
        cmd = script.replace("&& python3 scripts/ci/k261_raw_lengths_test.py", "")
        r = subprocess.run(["bash", "-c", cmd], cwd=ROOT, capture_output=True, text=True, timeout=300,
                           env={**os.environ, "CI_BASE": "HEAD"})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, r"D8_生の長さ: 0 件")

    def test_K261_RL_016_ci_wiring(self) -> None:
        """K261-RL-016 CI の配線：作り手の spec の段が D8 を分かれ目と比べて流し、この試験も流す。v3-gate.yml に同じ段が 1 つ"""
        script, env = self.gate_entry()
        for need in ("scripts/ci/design_gate.py", "--raw-lengths", '--ledger-base-ref "$CI_BASE"',
                     "python3 scripts/ci/k261_raw_lengths_test.py"):
            self.assertIn(need, script)
        self.assertNotIn("--no-base", script)
        self.assertIn("CI_BASE: ${{ steps.scope.outputs.base }}", env)
        yml = WORKFLOW.read_text(encoding="utf-8")
        runs = [ln for ln in yml.splitlines() if "k261_raw_lengths_test.py" in ln and "run:" in ln]
        self.assertEqual(len(runs), 1, "v3-gate.yml に K-261 の段がちょうど 1 つでない（作り手で作り直す）")
        self.assertIn('--raw-lengths --ledger-base-ref "$CI_BASE"', runs[0])
        i = yml.index(runs[0])
        self.assertIn("CI_BASE: ${{ steps.scope.outputs.base }}", yml[i - 600:i + 600])

    def test_K261_RL_017_division_with_class_gate(self) -> None:
        """K261-RL-017 分担：style={…} は class_gate が新しい層で赤にする。D8 が見ない書き方（.scss など・.tsx の <style>）が無い"""
        sys.path.insert(0, str(ROOT / "scripts" / "ci"))
        import class_gate  # noqa: PLC0415

        self.assertIn("style", class_gate.KINDS)
        self.assertIn("apps/web/features/", class_gate.NEW_LAYERS)
        self.assertIn("apps/web/components/k/", class_gate.NEW_LAYERS)
        files = subprocess.run(["git", "ls-files", "apps/web"], cwd=ROOT, capture_output=True, text=True).stdout.split()
        other = [f for f in files if re.search(r"\.(scss|sass|less|styl|pcss)$", f)]
        self.assertEqual(other, [], "D8 が読まない書き方の CSS がある")
        tagged = [f for f in files if f.endswith((".tsx", ".jsx")) and "<style" in (ROOT / f).read_text(encoding="utf-8")]
        self.assertEqual(tagged, [], ".tsx に <style> がある（D8 が読まない）")


if __name__ == "__main__":
    unittest.main(verbosity=2)

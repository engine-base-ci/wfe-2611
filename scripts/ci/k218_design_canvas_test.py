#!/usr/bin/env python3
"""K-218 の試験（正本・トークン・値の検査）：DESIGN-kaname.md の部品をキャンバスの値にし、
design_gate.py に D5（部品の定義 ⇔ CSS の規則）と段の検査（--scales：使われない段・大きさの種類）を足す。

  python3 scripts/ci/k218_design_canvas_test.py      行 ID は K218-DS-NNN（11_tickets/K-218.md の行の表と 1 対 1）

画面の値（ボタン・入力欄・小窓 など）は apps/web/tests/k/k218-design-parts.spec.ts（実 Chrome）が持つ。
作りものの木は tempfile の中に作る。本物の木は読むだけ（G37 の命令を流すだけ）。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GATE = HERE / "design_gate.py"
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
PREVIEW = ROOT / "04_design" / "DESIGN-kaname-preview.html"
WEB_TOKENS = ROOT / "apps" / "web" / "styles" / "k-tokens.css"
BRIDGE_TOKENS = ROOT / "apps" / "bridge" / "src" / "renderer" / "tokens.css"
GEN = ROOT / "04_design" / "gen_tokens.py"
CFG = ROOT / "design-gate.json"
TESTPLAN = ROOT / "05_flow" / "build_testplan.py"

SELECTORS = {
    "button-primary": '.k-btn[data-variant="primary"]',
    "button-primary-lg": '.k-btn[data-size="lg"]',
    "button-outlined": '.k-btn[data-variant="outlined"]',
    "input": ".k-input",
    "input-lg": '.k-field[data-size="lg"] .k-input',
    "label": ".k-label",
    "label-lg": '.k-field[data-size="lg"] .k-label',
    "dialog": ".k-dialog",
    "dialog-title": ".k-dialog-title",
    "state-empty": '.k-state[data-state="empty"]',
}


def front(path: pathlib.Path) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", path.read_text(encoding="utf-8"), re.S)
    assert m, f"{path} にフロントマターが無い"
    return yaml.safe_load(m.group(1))


def comp(name: str) -> dict:
    c = (front(DESIGN).get("components") or {}).get(name)
    assert c is not None, f"正本の components に {name} が無い"
    return c


def run(args: list[str], cwd: pathlib.Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, *args], cwd=cwd, capture_output=True, text=True, timeout=120)


class DesignTest(unittest.TestCase):
    def test_K218_DS_001_buttons(self) -> None:
        """K218-DS-001 正本の button-primary（作業）と button-primary-lg（入口）がキャンバスの値"""
        p = comp("button-primary")
        self.assertEqual(p["backgroundColor"], "{colors.primary}")
        self.assertEqual(p["textColor"], "{colors.on-primary}")
        self.assertEqual(p["typography"], "{typography.body}")
        self.assertEqual(str(p["fontWeight"]), "500")
        self.assertEqual(p["rounded"], "{rounded.md}")
        self.assertEqual(p["height"], "32px")
        self.assertEqual(p["padding"], "0 {spacing.md}")
        lg = comp("button-primary-lg")
        self.assertEqual(lg["backgroundColor"], "{colors.primary}")
        self.assertEqual(lg["typography"], "{typography.body-md}")
        self.assertEqual(str(lg["fontWeight"]), "500")
        self.assertEqual(lg["rounded"], "{rounded.field}")
        self.assertEqual(lg["height"], "44px")

    def test_K218_DS_002_outlined(self) -> None:
        """K218-DS-002 正本の button-outlined は白地（card）・黒字（on-surface）・1px の灰の線（line）"""
        o = comp("button-outlined")
        self.assertEqual(o["backgroundColor"], "{colors.card}")
        self.assertEqual(o["textColor"], "{colors.on-surface}")
        self.assertEqual(o["border"], "1px solid {colors.line}")
        self.assertEqual(o["height"], "32px")

    def test_K218_DS_003_inputs(self) -> None:
        """K218-DS-003 正本の input（作業）と input-lg（入口）"""
        i = comp("input")
        self.assertEqual(i["backgroundColor"], "{colors.card}")
        self.assertEqual(i["border"], "1px solid {colors.line-strong}")
        self.assertEqual(i["rounded"], "{rounded.md}")
        self.assertEqual(i["typography"], "{typography.body}")
        self.assertEqual(i["padding"], "6px 10px")
        lg = comp("input-lg")
        self.assertEqual(lg["backgroundColor"], "{colors.card}")
        self.assertEqual(lg["border"], "1px solid {colors.line}")
        self.assertEqual(lg["rounded"], "{rounded.field}")
        self.assertEqual(lg["typography"], "{typography.body-md}")
        self.assertEqual(lg["height"], "42px")

    def test_K218_DS_004_labels(self) -> None:
        """K218-DS-004 正本の label（作業：400・灰）と label-lg（入口：500・黒）"""
        a, b = comp("label"), comp("label-lg")
        self.assertEqual(a["typography"], "{typography.body-sm}")
        self.assertEqual(str(a["fontWeight"]), "400")
        self.assertEqual(a["textColor"], "{colors.on-surface-variant}")
        self.assertEqual(b["typography"], "{typography.body-sm}")
        self.assertEqual(str(b["fontWeight"]), "500")
        self.assertEqual(b["textColor"], "{colors.on-surface}")

    def test_K218_DS_005_dialog_empty(self) -> None:
        """K218-DS-005 正本の dialog・dialog-title・state-empty"""
        d, t, e = comp("dialog"), comp("dialog-title"), comp("state-empty")
        self.assertEqual(d["backgroundColor"], "{colors.card}")
        self.assertEqual(d["rounded"], "{rounded.lg}")
        self.assertEqual(t["typography"], "{typography.h3}")
        self.assertEqual(str(t["fontWeight"]), "700")
        self.assertEqual(e["border"], "1px dashed {colors.line-strong}")

    def test_K218_DS_006_type_scale(self) -> None:
        """K218-DS-006 文字の段：使われない 3 段が無く、K-217 の 2 段が在り、大きさの種類が 10 以下"""
        t = front(DESIGN)["typography"]
        for gone in ("metric-lg", "display", "chat"):
            self.assertNotIn(gone, t, f"使われない段 {gone} が残っている")
        for need in ("page-title", "section-title"):
            self.assertIn(need, t)
        sizes = {str(v["fontSize"]) for v in t.values() if "fontSize" in v}
        self.assertLessEqual(len(sizes), 10, f"大きさの種類 {sorted(sizes)}")

    def test_K218_DS_007_tokens(self) -> None:
        """K218-DS-007 作り直したトークンに部品の高さと太さが在り、消した段が無い。作り直しが差を出さない"""
        css = WEB_TOKENS.read_text(encoding="utf-8")
        for line in ("--k-c-button-primary-height: 32px;", "--k-c-button-primary-lg-height: 44px;",
                     "--k-c-button-primary-fw: 500;", "--k-c-dialog-title-fw: 700;"):
            self.assertIn(line, css)
        for gone in ("--k-text-metric-lg", "--k-text-chat", "--k-text-display"):
            self.assertNotIn(gone, css)
        r = run([str(GEN), "--web", "--check"], ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        r = run([str(GEN), "--check"], ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("--text-metric-lg", BRIDGE_TOKENS.read_text(encoding="utf-8"))


FAKE_DESIGN = """---
name: T
colors:
  primary: "#22345C"
  line: "#DDE2E9"
typography:
{typo}
rounded:
  md: 6px
  field: 8px
spacing:
  md: 16px
components:
  btn:
    backgroundColor: "{{colors.primary}}"
    rounded: "{{rounded.md}}"
---
# T
"""


class FakeTree:
    """design_gate を流す作りものの木（正本・CSS・使う側のファイル・design-gate.json）"""

    def __init__(self, typo: dict[str, str], css: str, usage: str, cfg: str) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        lines = "\n".join(f"  {k}:\n    fontFamily: \"Noto Sans JP\"\n    fontSize: {v}" for k, v in typo.items())
        (self.root / "DESIGN.md").write_text(FAKE_DESIGN.format(typo=lines), encoding="utf-8")
        (self.root / "ui").mkdir()
        (self.root / "ui" / "a.css").write_text(css, encoding="utf-8")
        (self.root / "use").mkdir()
        (self.root / "use" / "x.tsx").write_text(usage, encoding="utf-8")
        (self.root / "design-gate.json").write_text(cfg, encoding="utf-8")

    def gate(self, *extra: str) -> subprocess.CompletedProcess:
        return run([str(GATE), "--design", str(self.root / "DESIGN.md"), "--mocks", str(self.root / "ui"), "--part", *extra],
                   self.root)

    def close(self) -> None:
        self.tmp.cleanup()


OK_CSS = ".x-btn { background: #22345c; border-radius: 6px; font-size: 13px; }\n"
SEL_CFG = '{"component_selectors": {"btn": ".x-btn"}}'


class GateTest(unittest.TestCase):
    def test_K218_DS_020_d5_value(self) -> None:
        """K218-DS-020 D5：セレクタの規則の角丸が正本（6px）と違えば 1 で、D5・部品・値の名前を出す"""
        t = FakeTree({"body": "13px"}, OK_CSS.replace("6px", "8px"), "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            hit = [ln for ln in out.splitlines() if "D5" in ln and "btn" in ln and "border-radius" in ln]
            self.assertTrue(hit, f"D5・部品 btn・border-radius を 1 行に出していない:\n{out}")
        finally:
            t.close()

    def test_K218_DS_021_d5_missing_rule(self) -> None:
        """K218-DS-021 D5：セレクタの規則が CSS に無ければ 1 で部品の名前を出す。そろえば 0"""
        t = FakeTree({"body": "13px"}, ".other { color: #22345c; font-size: 13px; }\n", "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn("btn", r.stdout + r.stderr)
        finally:
            t.close()
        t = FakeTree({"body": "13px"}, OK_CSS, "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        finally:
            t.close()

    def test_K218_DS_022_unused_scale(self) -> None:
        """K218-DS-022 --scales：どこにも出てこない段（rare）があれば 1 で、その名前を出す"""
        t = FakeTree({"body": "13px", "rare": "17px"}, OK_CSS, "a { font-size: var(--k-text-body); }", SEL_CFG)
        try:
            r = t.gate("--scales", "--usage", str(t.root / "use"))
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn("rare", r.stdout + r.stderr)
        finally:
            t.close()

    def test_K218_DS_023_too_many_sizes(self) -> None:
        """K218-DS-023 --scales：fontSize が 11 種なら 1 で D7 と 11 を出す。10 種で全部使えば 0"""
        eleven = {f"s{i}": f"{10 + i}px" for i in range(11)}
        use = " ".join(f"var(--k-text-{k})" for k in eleven)
        t = FakeTree(eleven, OK_CSS, use, SEL_CFG)
        try:
            r = t.gate("--scales", "--usage", str(t.root / "use"))
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            hit = [ln for ln in out.splitlines() if "D7" in ln and re.search(r"\b11\b", ln)]
            self.assertTrue(hit, f"D7 と 11 を 1 行に出していない:\n{out}")
        finally:
            t.close()
        ten = {f"s{i}": f"{10 + i}px" for i in range(10)}
        use = " ".join(f"var(--k-text-{k})" for k in ten)
        t = FakeTree(ten, OK_CSS, use, SEL_CFG)
        try:
            r = t.gate("--scales", "--usage", str(t.root / "use"))
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        finally:
            t.close()


class RealTreeTest(unittest.TestCase):
    def test_K218_DS_024_config(self) -> None:
        """K218-DS-024 design-gate.json に 10 部品のセレクタと max_type_sizes 10"""
        import json

        cfg = json.loads(CFG.read_text(encoding="utf-8"))
        for k, v in SELECTORS.items():
            got = cfg["component_selectors"].get(k)
            got = got.get("selector") if isinstance(got, dict) else got
            self.assertEqual(got, v, k)
        self.assertEqual(cfg.get("max_type_sizes"), 10)

    def test_K218_DS_025_g37(self) -> None:
        """K218-DS-025 G37 の命令が features・--scales・--usage を含み、本物の木で 0 で終わる"""
        src = TESTPLAN.read_text(encoding="utf-8")
        m = re.search(r'\{"id": 37,.*?"script": "((?:[^"\\]|\\.)*)"', src)
        self.assertIsNotNone(m, "G37 が build_testplan.py に無い")
        script = m.group(1).replace('\\"', '"')
        for need in ("design_gate.py", "apps/web/features", "--scales", "--usage"):
            self.assertIn(need, script)
        cmd = script.replace("&& python3 scripts/ci/k218_design_canvas_test.py", "")
        r = subprocess.run(["bash", "-c", cmd], cwd=ROOT, capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K218_DS_026_preview(self) -> None:
        """K218-DS-026 プレビューに page-title・section-title が在り、metric-lg・chat の段が無い"""
        html = PREVIEW.read_text(encoding="utf-8")
        self.assertIn("page-title", html)
        self.assertIn("section-title", html)
        self.assertNotIn("metric-lg", html)
        self.assertIsNone(re.search(r"typography[^<]{0,40}\bchat\b|\bchat\b[^<]{0,10}13px", html), "chat の段が残っている")


if __name__ == "__main__":
    unittest.main(verbosity=2)

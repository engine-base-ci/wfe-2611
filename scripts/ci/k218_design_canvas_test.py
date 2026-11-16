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
        # 使えない状態（決める人 answer=78cb822fc1f1：隠さずグレーで押せない形）。キャンバスに絵が無いので今の実装の値を写す
        for name in ("button-disabled", "tab-disabled"):
            self.assertEqual(str(comp(name)["opacity"]), "0.55", name)

    def test_K218_DS_002_outlined(self) -> None:
        """K218-DS-002 正本の button-outlined は白地（card）・黒字（on-surface）・1px の灰の線（line）"""
        o = comp("button-outlined")
        self.assertEqual(o["backgroundColor"], "{colors.card}")
        self.assertEqual(o["textColor"], "{colors.on-surface}")
        self.assertEqual(o["border"], "1px solid {colors.line}")
        self.assertEqual(o["height"], "32px")
        self.assertEqual(str(o["fontWeight"]), "400", "キャンバスの従ボタンは太さを付けていない（400）")
        self.assertEqual(o["padding"], "0 14px")

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
        self.assertEqual(str(comp("input-disabled")["opacity"]), "0.55")

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
        self.assertEqual(e["backgroundColor"], "{colors.card}")
        self.assertEqual(e["rounded"], "{rounded.lg}")
        self.assertEqual(e["padding"], "36px 28px")
        self.assertEqual(e["gap"], "12px")
        # 小窓の頭・本文・足・×（StModal）と項目名の間（Create 4px・AuthSignup 6px）も正本の部品に置く
        self.assertEqual(comp("dialog-head")["padding"], "14px 18px")
        self.assertEqual(comp("dialog-head")["borderBottom"], "1px solid {colors.line}")
        self.assertEqual(comp("dialog-body")["padding"], "14px 18px")
        self.assertEqual(comp("dialog-actions")["padding"], "12px 18px")
        self.assertEqual(comp("dialog-actions")["borderTop"], "1px solid {colors.line}")
        self.assertEqual(comp("dialog-close")["width"], "28px")
        self.assertEqual(comp("dialog-close")["height"], "28px")
        self.assertEqual(comp("field")["gap"], "{spacing.xs}")
        self.assertEqual(comp("field-lg")["gap"], "6px")

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
                     "--k-c-button-primary-fw: 500;", "--k-c-button-outlined-fw: 400;",
                     "--k-c-dialog-title-fw: 700;", "--k-c-state-empty-gap: 12px;"):
            self.assertIn(line, css)
        for gone in ("--k-text-metric-lg", "--k-text-chat", "--k-text-display"):
            self.assertNotIn(gone, css)
        r = run([str(GEN), "--web", "--check"], ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        r = run([str(GEN), "--check"], ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("--text-metric-lg", BRIDGE_TOKENS.read_text(encoding="utf-8"))
        # 小窓の頭・本文・足・×・項目名の間・使えない状態も正本の部品から --k-c-* で配る（PM の決め 3）
        for line in ("--k-c-dialog-head-pad: 14px 18px;", "--k-c-dialog-head-border-bottom: 1px solid var(--k-line);",
                     "--k-c-dialog-body-pad: 14px 18px;", "--k-c-dialog-actions-pad: 12px 18px;",
                     "--k-c-dialog-actions-border-top: 1px solid var(--k-line);", "--k-c-dialog-close-width: 28px;",
                     "--k-c-dialog-close-height: 28px;", "--k-c-field-gap: var(--k-s-xs);", "--k-c-field-lg-gap: 6px;",
                     "--k-c-button-disabled-opacity: 0.55;", "--k-c-input-disabled-opacity: 0.55;",
                     "--k-c-tab-disabled-opacity: 0.55;"):
            self.assertIn(line, css)
        # 部品の CSS（k.css）のその規則は var(--k-c-…) で読み、生の値を書かない（レビューの指摘 3 が戻らないように）
        kcss = (ROOT / "apps" / "web" / "components" / "k" / "k.css").read_text(encoding="utf-8")
        for sel, prop, var in ((".k-dialog-head", "padding", "--k-c-dialog-head-pad"),
                               (".k-dialog-head", "border-bottom", "--k-c-dialog-head-border-bottom"),
                               (".k-dialog-body", "padding", "--k-c-dialog-body-pad"),
                               (".k-dialog-actions", "padding", "--k-c-dialog-actions-pad"),
                               (".k-dialog-actions", "border-top", "--k-c-dialog-actions-border-top"),
                               (".k-dialog-close", "width", "--k-c-dialog-close-width"),
                               (".k-dialog-close", "height", "--k-c-dialog-close-height"),
                               ('.k-field[data-size="lg"]', "gap", "--k-c-field-lg-gap"),
                               (".k-input:disabled", "opacity", "--k-c-input-disabled-opacity"),
                               ('.k-tab[data-disabled]', "opacity", "--k-c-tab-disabled-opacity"),
                               (".k-btn:disabled", "opacity", "--k-c-button-disabled-opacity")):
            blocks = [m.group(2) for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", kcss)
                      if sel in [x.strip() for x in m.group(1).split(",")]]
            self.assertTrue(blocks, f"k.css に {sel} の規則が無い")
            vals = [v.strip() for b in blocks for k, _, v in (d.partition(":") for d in b.split(";")) if k.strip() == prop]
            self.assertTrue(vals and all(v == f"var({var})" for v in vals), f"{sel} の {prop} が {vals}（var({var}) で読む）")
        # 部品が太さを持つときは、書体の段から来る太さを重ねて出さない（部品の値が勝つ・1 つの名前に 1 つの値）
        self.assertEqual(css.count("--k-c-button-primary-fw:"), 1)
        # 帯の中のボタン（K-217）は高さ 30 を min-height で持つ。上下の余白が残ると字の段（body 13px）で 30 を超える
        self.assertEqual(comp("page-head-button")["padding"], "0 {spacing.lg}")


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
{comps}
---
# T
"""


DEFAULT_COMPS = (
    "  btn:\n"
    '    backgroundColor: "{colors.primary}"\n'
    '    rounded: "{rounded.md}"'
)

RESOLVE_COMPS = """  btn:
    backgroundColor: "{colors.primary}"
    typography: "{typography.body}"
    border: "1px solid {colors.line}"
    padding: "0 {spacing.md}"
    fontWeight: 500
    height: 32px"""


def d5_lines(out: str, part: str, prop: str) -> list[str]:
    return [ln for ln in out.splitlines() if "D5" in ln and re.search(rf"\b{re.escape(part)}\b", ln) and prop in ln]


class FakeTree:
    """design_gate を流す作りものの木（正本・CSS・使う側のファイル・design-gate.json）"""

    def __init__(self, typo: dict[str, str], css: str, usage: str, cfg: str, comps: str = DEFAULT_COMPS,
                 tokens: str = "") -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        lines = "\n".join(f"  {k}:\n    fontFamily: \"Noto Sans JP\"\n    fontSize: {v}" for k, v in typo.items())
        (self.root / "DESIGN.md").write_text(FAKE_DESIGN.format(typo=lines, comps=comps), encoding="utf-8")
        (self.root / "tokens.css").write_text(tokens, encoding="utf-8")
        (self.root / "ui").mkdir()
        (self.root / "ui" / "a.css").write_text(css, encoding="utf-8")
        (self.root / "use").mkdir()
        (self.root / "use" / "x.tsx").write_text(usage, encoding="utf-8")
        (self.root / "design-gate.json").write_text(cfg, encoding="utf-8")

    def gate(self, *extra: str) -> subprocess.CompletedProcess:
        return run([str(GATE), "--design", str(self.root / "DESIGN.md"), "--mocks", str(self.root / "ui"),
                    "--css", str(self.root / "tokens.css"), "--part", *extra], self.root)

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
        # 値は var() を一緒に読む CSS（--css）から開き、正本は {typography}・{spacing}・{colors} を開いて比べる
        good_tokens = ":root { --x-pad: 0 16px; --x-text: 13px; --x-line: #dde2e9; --x-fw: 500; --x-h: 32px; }\n"
        rule = (".x-btn { background: #22345c; padding: var(--x-pad); font-size: var(--x-text); "
                "border: 1px solid var(--x-line); font-weight: var(--x-fw); min-height: var(--x-h); }\n")
        t = FakeTree({"body": "13px"}, rule, "var(--k-text-body)", SEL_CFG, RESOLVE_COMPS, good_tokens)
        try:
            r = t.gate()
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        finally:
            t.close()
        # 正本の部品にある値が規則に無ければ赤（「CSS に無い」）。gap も比べる
        for prop, drop in (("font-weight", " font-weight: var(--x-fw);"), ("border", " border: 1px solid var(--x-line);")):
            t = FakeTree({"body": "13px"}, rule.replace(drop, ""), "var(--k-text-body)", SEL_CFG, RESOLVE_COMPS, good_tokens)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, 1, f"{prop} を消した: {out}")
                self.assertTrue([ln for ln in d5_lines(out, "btn", prop) if "CSS に無い" in ln], out)
            finally:
                t.close()
        # opacity・width・上の線・下の線も比べる（違えば赤・消せば「CSS に無い」・そろえば 0）
        box_comps = DEFAULT_COMPS + ('\n  box:\n    opacity: 0.55\n    width: 28px\n'
                                     '    borderTop: "1px solid {colors.line}"\n    borderBottom: "1px solid {colors.line}"')
        box_cfg = '{"component_selectors": {"btn": ".x-btn", "box": ".x-box"}}'
        good_box = ".x-box { opacity: 0.55; width: 28px; border-top: 1px solid #dde2e9; border-bottom: 1px solid #dde2e9; }\n"
        cases = [(good_box, 0, None)]
        for prop, good, bad in (("opacity", "0.55", "0.4"), ("width", "28px", "30px"),
                                ("border-top", "1px solid #dde2e9", "1px solid #22345c"),
                                ("border-bottom", "1px solid #dde2e9", "1px solid #22345c")):
            cases.append((good_box.replace(f"{prop}: {good}", f"{prop}: {bad}"), 1, prop))
            cases.append((good_box.replace(f" {prop}: {good};", ""), 1, prop))
        for css_box, code, prop in cases:
            t = FakeTree({"body": "13px"}, OK_CSS + css_box, "var(--k-text-body)", box_cfg, box_comps)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, code, f"{prop}: {css_box}\n{out}")
                if prop:
                    self.assertTrue(d5_lines(out, "box", prop), out)
            finally:
                t.close()
        gap_comps = RESOLVE_COMPS + '\n    gap: "12px"'
        for gap, code in (("12px", 0), ("8px", 1)):
            t = FakeTree({"body": "13px"}, rule.replace("}", f" gap: {gap}; }}"), "var(--k-text-body)", SEL_CFG,
                         gap_comps, good_tokens)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, code, f"gap {gap}: {out}")
                if code:
                    self.assertTrue(d5_lines(out, "btn", "gap"), out)
            finally:
                t.close()
        for prop, bad in (("padding", "--x-pad: 0 20px"), ("font-size", "--x-text: 14px"),
                          ("border", "--x-line: #b8c0cc"), ("font-weight", "--x-fw: 700"), ("height", "--x-h: 36px")):
            name = bad.split(":")[0]
            tokens = re.sub(rf"{re.escape(name)}: [^;]+", bad, good_tokens)
            t = FakeTree({"body": "13px"}, rule, "var(--k-text-body)", SEL_CFG, RESOLVE_COMPS, tokens)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, 1, f"{prop}: {out}")
                self.assertTrue(d5_lines(out, "btn", prop), f"D5・btn・{prop} を 1 行に出していない:\n{out}")
            finally:
                t.close()

    def test_K218_DS_021_d5_missing_rule(self) -> None:
        """K218-DS-021 D5：セレクタの規則が CSS に無ければ 1 で部品の名前を出す。そろえば 0"""
        t = FakeTree({"body": "13px"}, ".other { color: #22345c; font-size: 13px; }\n", "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            self.assertTrue([ln for ln in out.splitlines() if "D5" in ln and re.search(r"\bbtn\b", ln)],
                            f"D5 と部品 btn を 1 行に出していない:\n{out}")
        finally:
            t.close()
        t = FakeTree({"body": "13px"}, OK_CSS, "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        finally:
            t.close()
        # セレクタも訳も無い部品は赤。訳を書けば 0
        extra = DEFAULT_COMPS + '\n  card:\n    rounded: "{rounded.md}"'
        for cfg, code in ((SEL_CFG, 1),
                          ('{"component_selectors": {"btn": ".x-btn"}, "component_exempt": '
                           '[{"part": "card", "reason": "部品のクラスがまだ無い（作る時はまだ決まっていない）"}]}', 0)):
            t = FakeTree({"body": "13px"}, OK_CSS, "var(--k-text-body)", cfg, extra)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, code, out)
                if code:
                    self.assertTrue([ln for ln in out.splitlines() if "D5" in ln and re.search(r"\bcard\b", ln)], out)
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
        # 名前は完全に一致で数える：body-md だけを使っていても body は使われていない
        t = FakeTree({"body": "13px", "body-md": "14px"}, OK_CSS, "a { font-size: var(--k-text-body-md); }", SEL_CFG)
        try:
            r = t.gate("--scales", "--usage", str(t.root / "use"))
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            self.assertTrue([ln for ln in out.splitlines() if "D6" in ln and "'body'" in ln],
                            f"使われない段 'body' を D6 の行に出していない:\n{out}")
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


class GateRulesTest(unittest.TestCase):
    def test_K218_DS_028_d5_rules(self) -> None:
        """K218-DS-028 D5 が見る規則：@media の中・:hover などの状態・子孫のセレクタは見ない。同じセレクタの規則は合わせて見る。
        shape（形の規則）を書いた部品は、形の規則に変種の規則を重ねて比べる"""
        ignored = OK_CSS + ("@media (max-width: 767px) { .x-btn { border-radius: 8px; } }\n"
                            ".x-btn:hover { border-radius: 8px; }\n.wrap .x-btn { border-radius: 8px; }\n")
        t = FakeTree({"body": "13px"}, ignored, "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        finally:
            t.close()
        split = ".x-btn { background: #22345c; font-size: 13px; }\n.x-btn { border-radius: 8px; }\n"
        t = FakeTree({"body": "13px"}, split, "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate()
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            self.assertTrue(d5_lines(out, "btn", "border-radius"), out)
        finally:
            t.close()
        shape_cfg = '{"component_selectors": {"btn": {"selector": ".x-btn.p", "shape": ".x-btn"}}}'
        for radius, code in (("8px", 1), ("6px", 0)):
            css = f".x-btn {{ border-radius: {radius}; font-size: 13px; }}\n.x-btn.p {{ background: #22345c; }}\n"
            t = FakeTree({"body": "13px"}, css, "var(--k-text-body)", shape_cfg)
            try:
                r = t.gate()
                out = r.stdout + r.stderr
                self.assertEqual(r.returncode, code, out)
                if code:
                    self.assertTrue(d5_lines(out, "btn", "border-radius"), out)
            finally:
                t.close()

    def test_K218_DS_030_no_components(self) -> None:
        """K218-DS-030 キャンバス（部品のクラスを持たない絵）に掛けるときは --no-components で D5 を掛けない。README の命令もそうなっている"""
        t = FakeTree({"body": "13px"}, ".other { color: #22345c; font-size: 13px; }\n", "var(--k-text-body)", SEL_CFG)
        try:
            r = t.gate("--no-components")
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 0, out)
            self.assertTrue([ln for ln in out.splitlines() if "D5" in ln and "--no-components" in ln], out)
        finally:
            t.close()
        readme = (ROOT / "04_design" / "canvas_gen" / "README.md").read_text(encoding="utf-8")
        cmd = [ln for ln in readme.splitlines() if "design_gate.py" in ln and "canvas" in ln]
        self.assertTrue(cmd and all("--no-components" in ln for ln in cmd), cmd)


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
        # このチケットで値を変えた部品は比べる。セレクタの無い部品は部品ごとに訳を持つ（訳の無い部品は D5 が赤）
        for k in ("button-secondary", "button-inverted", "page-head-button", "dialog-head", "dialog-body",
                  "dialog-actions", "dialog-close", "field", "field-lg", "button-disabled", "input-disabled", "tab-disabled"):
            self.assertIn(k, cfg["component_selectors"], k)
        exempt = {x["part"]: x["reason"] for x in cfg.get("component_exempt", [])}
        comps = set(front(DESIGN)["components"])
        self.assertEqual(comps - set(cfg["component_selectors"]), set(exempt), "セレクタも訳も無い部品・余分な訳")
        for k, why in exempt.items():
            self.assertGreaterEqual(len(why.strip()), 10, f"{k} の訳が短い")

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
        # D5 が本当に比べている（何も見ていないのに緑でない）：10 部品・比べた値 20 以上
        m = re.search(r"部品 (\d+) 個・比べた値 (\d+) 個", r.stdout)
        self.assertIsNotNone(m, r.stdout)
        import json

        sels = json.loads(CFG.read_text(encoding="utf-8"))["component_selectors"]
        self.assertEqual(int(m.group(1)), len(sels), r.stdout)
        self.assertGreaterEqual(int(m.group(1)), 20, r.stdout)
        self.assertGreaterEqual(int(m.group(2)), 60, r.stdout)
        # セレクタを持つ部品は、どれも比べた値を 1 個以上持つ（比べる値の表に足し忘れた性質で 0 個のまま緑にならない）
        j = subprocess.run([sys.executable, str(GATE), "--design", str(DESIGN), "--mocks", "apps/web/components/k",
                            "apps/web/features", "--css", "apps/web/styles/k-tokens.css", "--part", "--json"],
                           cwd=ROOT, capture_output=True, text=True, timeout=300)
        by_part = json.loads(j.stdout)["d5_by_part"]
        self.assertEqual(set(by_part), set(sels))
        self.assertEqual([k for k, n in by_part.items() if n < 1], [], by_part)

    def test_K218_DS_026_preview(self) -> None:
        """K218-DS-026 プレビューに page-title・section-title が在り、metric-lg・chat の段が無い"""
        html = PREVIEW.read_text(encoding="utf-8")
        r = run([str(ROOT / "04_design" / "gen_preview.py"), "--check"], ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        typo = front(DESIGN)["typography"]
        rows = dict(re.findall(r'data-type="([\w-]+)"[^>]*data-size="([\d.]+px)"', html))
        self.assertEqual(set(rows), set(typo), "プレビューの文字の段が正本の段と同じでない")
        for k, v in typo.items():
            self.assertEqual(rows[k], str(v["fontSize"]), k)
        self.assertNotIn("metric-lg", html)
        for name in ("button-primary", "button-primary-lg", "button-outlined", "input", "input-lg", "dialog"):
            self.assertIn(f'data-part="{name}"', html, name)


if __name__ == "__main__":
    unittest.main(verbosity=2)

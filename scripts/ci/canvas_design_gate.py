#!/usr/bin/env python3
"""キャンバスの値の検査（K-254・G71）：キャンバスの絵の色・書体・角丸・文字の大きさが、正本（DESIGN-kaname.md）の段に在るか。

  python3 scripts/ci/canvas_design_gate.py                    本物のキャンバス（04_design/canvas）を見る
  python3 scripts/ci/canvas_design_gate.py --canvas <置き場>   写しの置き場を見る（作り手を写しで流したとき）
  python3 scripts/ci/canvas_design_gate.py --ledger-base-ref <本線との分かれ目>
                                                              幅の台帳（canvas_layout_ledger.json）を分かれ目の台帳と比べ、増えていたら赤

中身は design_gate.py（D1 色・D2 書体・D3 角丸・D4 文字）をそのまま使う。違いは次のとおり：
  ・design_gate が読まない書き方を、読める形に直した写しを作ってから掛ける（design_gate.py はほかでも使うので変えない）
      - 単一引用符の style 属性（style='…'）は二重引用符にする
      - SVG の fill・stroke・stop-color・color 属性の色も見る（同じ値を style に写す）
      - 透けない rgb()・rgba(…, 1)・hsl()・hsla(…, 1) と、色の名前（red など。transparent・inherit・currentColor・none は除く）は
        #rrggbb に直す。直した値は # で書いた色と同じ決まりで D1 に掛かる（正本に無ければ赤・無彩色は除く）。
        透ける rgba()・hsla() は被せなので見ない（design-system.md D1）
  ・D1〜D4 が赤なら、どの絵がどの値で赤かを絵ごとに出す（design_gate は絵の名前を 3 つまでしか出さない）。
    絵の名前は台帳と同じ書き方（AiChat の形・.dc.html を付けない）
  ・D6（正本にあって絵に無い色・文字）は知らせとして出し、止めない（データの色の残りなど、絵に出ない色がある）
  ・D5（部品）は掛けない（キャンバスの絵は部品のクラスを持たない。部品とキャンバスの突き合わせは G70）
  ・--ledger-base-ref：幅の台帳は減らすだけ。分かれ目に無い絵の行・分かれ目より幅が増えた行・行の数が増えた、のどれかで赤
終わりの数：赤が 1 件でもあれば 1、無ければ 0。
"""
from __future__ import annotations

import argparse
import colorsys
import json
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DESIGN = ROOT / "04_design" / "DESIGN-kaname.md"
CANVAS = ROOT / "04_design" / "canvas"
GATE = HERE / "design_gate.py"
LEDGER = HERE / "canvas_layout_ledger.json"
STOP = ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い", "D4_文字_段に無い")
NOTE = ("D6_未使用_色", "D6_未使用_文字")
SUFFIX = ".dc.html"

# CSS の色の名前（148）→ #rrggbb。Chromium の canvas に色の名前を渡して読み返した値（2026-11-16）
NAMED = dict(x.split(":") for x in """
aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4
black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0
chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff
darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b
darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a
darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1
darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222
floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520
gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082
ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6
lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3
lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899
lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6
magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db
mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585
midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6
olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98
paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd
powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513
salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb
slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c
teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5
yellow:ffff00 yellowgreen:9acd32""".split())

SQ_STYLE = re.compile(r"""style='([^'"]*)'""")
FUNC = re.compile(r"\b(rgba?|hsla?)\(\s*([^)]*)\)", re.I)
# 色を書く所：CSS の色の属性（宣言の値）と、SVG の fill・stroke 属性
COLOR_DECL = re.compile(r"((?:^|[;{\s\"'])(?:color|background(?:-color)?|border(?:-[a-z]+)*-?color|border(?:-[a-z]+)?|outline(?:-color)?|"
                        r"fill|stroke|box-shadow|text-decoration(?:-color)?|caret-color|accent-color|column-rule(?:-color)?)\s*:\s*)([^;}\"']+)", re.I)
COLOR_ATTR = re.compile(r"(\s(?:fill|stroke|color|stop-color)=\")([^\"]+)(\")", re.I)
NAME_WORD = re.compile(r"(?<![#\w-])([a-z]+)(?![\w(-])", re.I)


def _num(tok: str, scale: float) -> float:
    tok = tok.strip()
    return float(tok[:-1]) / 100 * scale if tok.endswith("%") else float(tok)


def _func_hex(m: re.Match) -> str:
    """透けない rgb()・hsl() を #rrggbb に。透けるもの・読めないものはそのまま"""
    kind, parts = m.group(1).lower(), [p for p in re.split(r"[\s,/]+", m.group(2).strip()) if p]
    try:
        if len(parts) == 4 and _num(parts[3], 1.0) < 1:
            return m.group(0)
        if len(parts) not in (3, 4):
            return m.group(0)
        if kind.startswith("rgb"):
            rgb = [round(_num(p, 255)) for p in parts[:3]]
        else:
            h = float(re.sub(r"deg$", "", parts[0])) / 360 % 1
            s, light = _num(parts[1], 1.0), _num(parts[2], 1.0)
            rgb = [round(x * 255) for x in colorsys.hls_to_rgb(h, light, s)]
    except ValueError:
        return m.group(0)
    return "#" + "".join(f"{max(0, min(255, v)):02x}" for v in rgb)


def _names_hex(value: str) -> str:
    return NAME_WORD.sub(lambda m: "#" + NAMED[m.group(1).lower()] if m.group(1).lower() in NAMED else m.group(0), value)


def readable(text: str) -> str:
    """design_gate が読める形に直す（単一引用符の style・透けない rgb()/hsl()・色の名前）"""
    text = SQ_STYLE.sub(lambda m: f'style="{m.group(1)}"', text)
    text = FUNC.sub(_func_hex, text)
    text = COLOR_DECL.sub(lambda m: m.group(1) + _names_hex(m.group(2)), text)
    text = COLOR_ATTR.sub(lambda m: m.group(1) + _names_hex(m.group(2)) + m.group(3), text)
    # SVG の fill・stroke などの属性の色は design_gate が読まない（style と <style> だけを読む）ので、同じ値を style に写して見せる
    attrs = sorted({m.group(2).strip() for m in COLOR_ATTR.finditer(text)})
    return text + "".join(f'\n<i style="color: {v}"></i>' for v in attrs)


def gate(mocks: pathlib.Path, part: bool) -> dict:
    """design_gate.py を流して JSON を読む（置き場はフォルダのまま渡す：絶対の道のグロブは design_gate が読めない）"""
    cmd = [sys.executable, str(GATE), "--design", str(DESIGN), "--mocks", str(mocks), "--no-components", "--json"]
    r = subprocess.run(cmd + (["--part"] if part else []), capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit(f"design_gate.py が読めない結果を返した（{r.returncode}）：{r.stdout[-400:]}{r.stderr[-400:]}")


def per_board(canvas: pathlib.Path) -> dict[str, dict[str, list[str]]]:
    """赤の絵ごとに、D1〜D4 のどの値が赤か（1 枚ずつ design_gate に掛ける。赤のときだけ流すので遅くてよい）"""
    out: dict[str, dict[str, list[str]]] = {}
    for f in sorted(canvas.glob("*" + SUFFIX)):
        res = gate(f, part=True)
        hit = {k: sorted(res.get(k) or {}) for k in STOP if res.get(k)}
        if hit:
            out[f.name.removesuffix(SUFFIX)] = hit
    return out


def values(canvas: pathlib.Path) -> int:
    """値の検査。赤の件数を返す"""
    with tempfile.TemporaryDirectory() as d:
        work = pathlib.Path(d)
        for f in sorted(canvas.glob("*" + SUFFIX)):
            (work / f.name).write_text(readable(f.read_text(encoding="utf-8")), encoding="utf-8")
        whole = gate(work, part=False)
        print(f"キャンバス {whole.get('files')} 枚 / 正本 {DESIGN.name}（D5 は掛けない・D6 は知らせ）")
        red = 0
        for k in STOP:
            n = len(whole.get(k) or {})
            red += n
            print(f"  {k}: {n} 件" + (f"  {sorted(whole[k])[:8]}" if n else ""))
        for k in NOTE:
            v = whole.get(k) or []
            print(f"  {k}: {len(v)} 件（知らせ・止めない）" + (f"  {list(v)[:8]}" if v else ""))
        if red:
            print("赤の絵（絵：項目 値。rgb()・hsl()・色の名前は #rrggbb に直して出す）：")
            for board, hit in per_board(work).items():
                print(f"  {board}：" + " ／ ".join(f"{k.split('_')[0]} {'・'.join(v)}" for k, v in hit.items()))
            print("  直し方：絵は手で直さず、作り手 04_design/canvas_gen で正本の値を書く（段の外の大きさは tokensnap.py の表で寄せる）")
    return red


def _ledger_rows(text: str) -> dict[str, set[int]]:
    entries = json.loads(text)["entries"]
    return {e["board"]: set(e["widths"]) for e in entries}


def ledger_vs_base(ref: str) -> int:
    """幅の台帳は減らすだけ：分かれ目の台帳と比べて増えた所の件数を返す"""
    rel = LEDGER.relative_to(ROOT).as_posix()
    ok = subprocess.run(["git", "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], cwd=ROOT, capture_output=True, text=True)
    if not ref or ok.returncode != 0:
        print(f"幅の台帳：比べる版 {ref or '（空）'} が読めない（黙って比べずに緑にしない）")
        return 1
    try:
        now = _ledger_rows(LEDGER.read_text(encoding="utf-8"))
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(f"幅の台帳：{rel} が読めない（{e}）")
        return 1
    r = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"幅の台帳：分かれ目 {ref[:12]} に台帳が無い（台帳を入れる回。行 {len(now)}・上限は試験 K254-CV-006 が見る）")
        return 0
    try:
        base = _ledger_rows(r.stdout)
    except (ValueError, KeyError, TypeError) as e:
        print(f"幅の台帳：分かれ目の台帳が読めない（{e}）")
        return 1
    bad = [f"分かれ目に無い絵の行：{b}" for b in sorted(set(now) - set(base))]
    bad += [f"分かれ目より幅が増えた：{b} {sorted(now[b] - base[b])}" for b in sorted(set(now) & set(base)) if now[b] - base[b]]
    if len(now) > len(base):
        bad.append(f"行の数が増えた：{len(base)} → {len(now)}")
    if bad:
        print(f"幅の台帳：赤 {len(bad)}（台帳は減らすだけ。崩れた絵は作り手で直す）")
        for b in bad:
            print(f"  ✗ {b}")
        return len(bad)
    print(f"幅の台帳：緑（行 {len(now)}・分かれ目 {len(base)}）")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--canvas", default=str(CANVAS), help="絵の置き場（既定は本物の 04_design/canvas）")
    ap.add_argument("--ledger-base-ref", help="幅の台帳を比べる版（本線との分かれ目）。付けたときだけ比べる")
    a = ap.parse_args()
    canvas = pathlib.Path(a.canvas).resolve()
    if not canvas.is_dir() or not any(canvas.glob("*" + SUFFIX)):
        sys.exit(f"絵（*{SUFFIX}）が 1 枚も無い：{canvas}")
    red = values(canvas)
    if a.ledger_base_ref is not None:
        red += ledger_vs_base(a.ledger_base_ref)
    print("PASS" if red == 0 else f"不合格 {red} 件")
    return 0 if red == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

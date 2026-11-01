#!/usr/bin/env python3
"""D1〜D6：デザインの正本（DESIGN-*.md）と画面を双方向で突き合わせる。

由来 L-017：DESIGN.md を作っても、値を突き合わせる検査が無ければ
正本と画面は別々に育ち、両方それぞれ緑のまま別のデザインになる。

  D1 色      画面に出る色が正本の色トークンに無い
  D2 書体    font-family が正本の fontFamily に無い
  D3 角丸    border-radius が正本の rounded の段に無い
  D4 文字    font-size が正本の typography の段に無い
  D5 部品    components の定義に対応する規則が画面に無い／面の色・角丸が違う
  D6 未使用  正本にあって画面がどこにも使っていない色・型の段（＝絵に描いた餅）

規約: .claude/rules/common/design-system.md
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

import yaml

GREY = re.compile(r"^#(?:(\w)\1\1|(\w\w)\2\2)$", re.I)          # #fff #000 #333 など無彩色
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGBA = re.compile(r"rgba?\(([^)]*)\)")
VARDEF = re.compile(r"(--[\w-]+)\s*:\s*([^;}]+)")
VARUSE = re.compile(r"var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)")
PX = re.compile(r"(-?\d*\.?\d+)px")


def norm_hex(v: str) -> str:
    v = v.strip().lower()
    if len(v) == 4:                                              # #abc -> #aabbcc
        v = "#" + "".join(c * 2 for c in v[1:])
    if len(v) == 9:                                              # 透過は色として比べない
        v = v[:7]
    return v


def is_neutral(v: str) -> bool:
    if GREY.match(v):
        return True
    h = norm_hex(v)
    if len(h) != 7:
        return False
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return r == g == b


def walk(node, out_colors: set, out_fonts: set, out_sizes: set, out_radii: set, parent: str = ""):
    """正本の木を歩いて「色に見える値」「fontSize」「fontFamily」「角丸」を拾う。
    正本の形（テーマの入れ子・状態色を別表にする 等）を決め打ちしない。"""
    if isinstance(node, dict):
        for k, v in node.items():
            kl = str(k).lower()
            if isinstance(v, (dict, list)):
                walk(v, out_colors, out_fonts, out_sizes, out_radii, kl)
                continue
            s = str(v).strip()
            if HEX.fullmatch(s):
                out_colors.add(norm_hex(s))
            elif "fontfamily" in kl:
                out_fonts.add(s.strip('"\'').lower())
            elif "fontsize" in kl and PX.search(s):
                out_sizes.add(PX.search(s).group(1))
            elif kl.startswith(("rounded", "radius", "borderradius")) or parent.startswith(("rounded", "radius")):
                for m in PX.finditer(s):
                    out_radii.add(m.group(1))
    elif isinstance(node, list):
        for v in node:
            walk(v, out_colors, out_fonts, out_sizes, out_radii, parent)


def load_source(p: Path) -> dict:
    t = p.read_text(encoding="utf-8")
    if p.suffix == ".md":
        m = re.match(r"^---\n(.*?)\n---\n", t, re.S)
        if not m:
            sys.exit(f"正本にフロントマターがありません: {p}")
        return yaml.safe_load(m.group(1))
    return yaml.safe_load(t) if p.suffix in (".yaml", ".yml") else json.loads(t)


def css_of(p: Path) -> str:
    t = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix in (".html", ".htm"):
        return "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", t, re.S)) + "\n" + \
               "\n".join(f"x{{{s}}}" for s in re.findall(r'style="([^"]*)"', t))
    return t


def resolve(val: str, vars_: dict, depth: int = 0) -> str:
    if depth > 8:
        return val
    def sub(m):
        name, fallback = m.group(1), (m.group(2) or "").strip()
        return vars_.get(name, fallback)
    out = VARUSE.sub(sub, val)
    return resolve(out, vars_, depth + 1) if "var(" in out and out != val else out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--design", required=True)
    ap.add_argument("--mocks", nargs="+", required=True, help="画面のフォルダかグロブ")
    ap.add_argument("--css", nargs="*", default=[], help="一緒に読む CSS（トークンの定義元を含める）")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--part", action="store_true",
                    help="画面の一部だけを見る（D6 未使用は製品全体でしか判定できないので見ない）")
    a = ap.parse_args()

    root = Path(a.design).resolve().parent
    cfg = {}
    for up in [root, *root.parents]:
        f = up / "design-gate.json"
        if f.exists():
            cfg = json.loads(f.read_text(encoding="utf-8")); break

    src = load_source(Path(a.design))
    colors, fonts, sizes, radii = set(), set(), set(), set()
    walk(src, colors, fonts, sizes, radii)

    files: list[Path] = []
    for pat in [*a.mocks, *a.css]:
        p = Path(pat)
        files += sorted(p.rglob("*.html")) + sorted(p.rglob("*.css")) if p.is_dir() else \
                 [Path(x) for x in sorted(Path().glob(pat))] if any(c in pat for c in "*?[") else ([p] if p.exists() else [])
    ignore = set(cfg.get("ignore_files", []))
    files = [f for f in files if f.name not in ignore and "node_modules" not in f.parts]
    if not files:
        sys.exit("画面が 1 枚も見つかりません")

    vars_: dict[str, str] = {}
    for f in files:
        for name, val in VARDEF.findall(css_of(f)):
            vars_.setdefault(name, val.strip())

    allow_c = {norm_hex(str(x.get("value", x))) for x in cfg.get("allow_colors", [])}
    allow_s = {str(x.get("value", x)).rstrip("px") for x in cfg.get("allow_sizes", [])}
    bad_c, bad_s, bad_r, bad_f = {}, {}, {}, {}
    used_c, used_s = set(), set()

    for f in files:
        css = css_of(f)
        for name, raw in VARDEF.findall(css):                    # 変数の定義そのものも検査対象
            css += f"\n/*def*/x{{color:{raw}}}" if HEX.search(raw) else ""
        for m in HEX.finditer(resolve(css, vars_)):
            v = norm_hex(m.group(0))
            if v in colors:
                used_c.add(v)
            elif not is_neutral(v) and v not in allow_c:
                bad_c.setdefault(v, set()).add(f.name)
        for m in re.finditer(r"font-size\s*:\s*([^;}]+)", css):
            val = resolve(m.group(1), vars_)
            px = PX.search(val)
            if not px:
                continue
            if px.group(1) in sizes:
                used_s.add(px.group(1))
            elif px.group(1) not in allow_s:
                bad_s.setdefault(px.group(1), set()).add(f.name)
        for m in re.finditer(r"border-radius\s*:\s*([^;}]+)", css):
            for px in PX.finditer(resolve(m.group(1), vars_)):
                if px.group(1) not in radii and px.group(1) != "0":
                    bad_r.setdefault(px.group(1), set()).add(f.name)
        for m in re.finditer(r"font-family\s*:\s*([^;}]+)", css):
            first = resolve(m.group(1), vars_).split(",")[0].strip().strip('"\'').lower()
            if fonts and first not in fonts and first not in ("inherit", "ui-monospace"):
                bad_f.setdefault(first, set()).add(f.name)

    res = {
        "D1_色_正本に無い": {k: sorted(v)[:3] for k, v in sorted(bad_c.items())},
        "D2_書体_正本に無い": {k: sorted(v)[:3] for k, v in sorted(bad_f.items())},
        "D3_角丸_段に無い": {k: sorted(v)[:3] for k, v in sorted(bad_r.items())},
        "D4_文字_段に無い": {k: sorted(v)[:3] for k, v in sorted(bad_s.items())},
        "D5_部品": "検査していません（design-gate.json の component_selectors が無い）"
                   if not cfg.get("component_selectors") else {},
        "D6_未使用_色": "一部だけ見ています（--part）" if a.part else sorted(colors - used_c),
        "D6_未使用_文字": "一部だけ見ています（--part）" if a.part else sorted(sizes - used_s, key=float),
    }
    fails = sum(len(res[k]) for k in ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い",
                                      "D4_文字_段に無い", "D6_未使用_色", "D6_未使用_文字")
                if not isinstance(res[k], str))
    if a.json:
        print(json.dumps({"files": len(files), "fails": fails, **res}, ensure_ascii=False, indent=2))
    else:
        print(f"画面 {len(files)} 枚 / 正本 {Path(a.design).name}")
        for k, v in res.items():
            if isinstance(v, str):
                print(f"  {k}: {v}"); continue
            print(f"  {k}: {len(v)} 件" + (f"  {list(v)[:8]}" if v else ""))
        print("PASS" if fails == 0 else f"不合格 {fails} 件")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

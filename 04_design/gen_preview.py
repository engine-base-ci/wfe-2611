#!/usr/bin/env python3
"""正本（DESIGN-kaname.md）からプレビュー（DESIGN-kaname-preview.html）の「文字の段」「部品」「正本の抜粋」と書体を作る（K-218）。
md とプレビューを同じ入力から出す（design-system.md §6）。プレビューの中の印 <!-- gen:<名> --> 〜 <!-- /gen:<名> --> の間だけを書き換える。

  python3 04_design/gen_preview.py            … 書き換える
  python3 04_design/gen_preview.py --check    … 正本どおりか（差があれば 1・CI の G37）
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "DESIGN-kaname.md"
OUT = ROOT / "DESIGN-kaname-preview.html"
CHECK = "--check" in sys.argv

USES = {  # 段の使いどころ（正本の Scale の表と同じ言葉）
    "h1": "ページの題（チケット・ナレッジ・届いた依頼）", "h2": "管理の画面の題・数の札の数字", "h3": "小窓・カードの題",
    "page-title": "ページの型の見出しの帯", "section-title": "ページの型の区画の見出し", "input": "幅 767 以下の入力欄",
    "body-md": "スマホの本文・入口の画面", "body": "本文の既定・作業の画面のボタンと入力欄", "body-sm": "補足・項目名・表の頭",
    "label-md": "小さな補足・sm のボタン", "label-xs": "数のしるし（バッジ）",
}
PARTS = ["button-primary", "button-primary-lg", "button-outlined", "input", "input-lg", "dialog"]


def front() -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", SRC.read_text(encoding="utf-8"), re.S)
    if not m:
        sys.exit(f"正本にフロントマターが無い: {SRC}")
    return yaml.safe_load(m.group(1))


def resolve(d: dict, v) -> str:
    """{colors.x}・{rounded.x}・{spacing.x}・{typography.x}（fontSize）を本当の値に開く"""
    def sub(m: re.Match) -> str:
        g, k = m.group(1), m.group(2)
        val = (d.get(g) or {}).get(k)
        if g == "typography" and isinstance(val, dict):
            return str(val.get("fontSize"))
        if val is None:
            sys.exit(f"正本の参照が開けない: {{{g}.{k}}}")
        return str(val)
    return re.sub(r"\{(\w+)\.([\w-]+)\}", sub, str(v))


def type_section(d: dict) -> str:
    T = d["typography"]
    rows = []
    for name, v in T.items():
        size, fw, lh = v["fontSize"], v.get("fontWeight", 400), v.get("lineHeight", "")
        meta = f"{size} · 太さ{fw}" + (f" · 行間{lh}" if lh else "")
        rows.append(
            f'    <div class="type-card" data-type="{name}" data-size="{size}">\n'
            f'      <div class="type-scale-name">{name}</div>\n'
            f'      <div class="type-sample" style="font-size:{size}; font-weight:{fw};">要の文字 Aa 1,234</div>\n'
            f'      <div class="type-meta">{meta}<br>{html.escape(USES.get(name, ""))}</div>\n'
            f"    </div>")
    sizes = sorted({str(v["fontSize"]) for v in T.values()}, key=lambda x: float(x.rstrip("px")))
    fam = T["body"]["fontFamily"]
    return (
        '<section class="ds-section">\n'
        '  <div class="ds-section-title">Typography ── 1 書体・段は大きさの種類で 10 まで</div>\n'
        f'  <div class="ds-note"><b>{html.escape(fam)} の単一書体。</b> 段は {len(T)} 個・大きさの種類は {len(sizes)} 個'
        f'（{" / ".join(sizes)}）。1 度も使われない段は置かない（design_gate の --scales）。数値は tabular-nums と右寄せで桁を揃える。</div>\n'
        '  <div class="type-grid">\n' + "\n".join(rows) + "\n  </div>\n</section>")


def part_sample(name: str, c: dict, d: dict) -> str:
    st = []
    for key, prop in (("backgroundColor", "background"), ("textColor", "color"), ("border", "border"),
                      ("rounded", "border-radius"), ("padding", "padding"), ("height", "min-height"),
                      ("fontWeight", "font-weight"), ("typography", "font-size")):
        if key in c:
            st.append(f"{prop}:{resolve(d, c[key])}")
    style = "; ".join(st)
    meta = html.escape(" · ".join(f"{k} {resolve(d, v)}" for k, v in c.items()))
    if name.startswith("button"):
        label = {"button-primary": "作る", "button-primary-lg": "次へ", "button-outlined": "やめる"}[name]
        body = f'<button type="button" style="{style}; display:inline-flex; align-items:center; box-sizing:border-box;">{label}</button>'
    elif name.startswith("input"):
        body = f'<input type="text" value="見積を送る" style="{style}; box-sizing:border-box; width:240px;">'
    else:
        title = d["components"].get("dialog-title", {})
        tsize = resolve(d, title.get("typography", "15px"))
        body = (f'<div style="{style}; border:1px solid {d["colors"]["line"]}; width:280px;">'
                f'<div style="padding:14px 18px; border-bottom:1px solid {d["colors"]["line"]}; font-size:{tsize}; '
                f'font-weight:{title.get("fontWeight", 700)};">完了にする <span style="float:right;">×</span></div>'
                f'<div style="padding:12px 18px; border-top:1px solid {d["colors"]["line"]}; margin-top:24px; text-align:right;">やめる ／ 決める</div></div>')
    return (f'    <div class="type-card" data-part="{name}">\n      <div class="type-scale-name">{name}</div>\n'
            f"      <div>{body}</div>\n      <div class=\"type-meta\">{meta}</div>\n    </div>")


def parts_section(d: dict) -> str:
    C = d["components"]
    missing = [p for p in PARTS if p not in C]
    if missing:
        sys.exit(f"正本の components に無い部品: {missing}")
    return (
        '<section class="ds-section">\n'
        '  <div class="ds-section-title">Components ── 作業の画面（32）と入口の画面（44）・小窓</div>\n'
        '  <div class="type-grid">\n' + "\n".join(part_sample(p, C[p], d) for p in PARTS) + "\n  </div>\n</section>")


def source_section(d: dict) -> str:
    excerpt = {k: d[k] for k in ("colors", "typography", "rounded", "spacing") if k in d}
    excerpt["components"] = {p: d["components"][p] for p in PARTS}
    body = yaml.safe_dump(excerpt, allow_unicode=True, sort_keys=False, width=200)
    return ('<section class="ds-section">\n  <div class="ds-section-title">DESIGN.md Source（抜粋・正本から作る）</div>\n'
            f'  <div class="source-block">---\n{html.escape(body)}---</div>\n</section>')


def put(doc: str, name: str, block: str, start: str | None = None, end: str | None = None) -> str:
    """印の間を書き換える。印がまだ無いとき（初回）は start〜end の古い塊を印つきで置き換える"""
    a, b = f"<!-- gen:{name} -->", f"<!-- /gen:{name} -->"
    wrapped = f"{a}\n{block}\n{b}"
    if a in doc and b in doc:
        return doc[:doc.index(a)] + wrapped + doc[doc.index(b) + len(b):]
    if start is None or start not in doc or (end is not None and end not in doc):
        sys.exit(f"プレビューに印 {a} が無く、置き換える古い塊も見つからない")
    i = doc.index(start) + len(start)
    j = doc.index(end, i) if end else i
    return doc[:i] + "\n" + wrapped + "\n\n" + doc[j:]


def build(doc: str, d: dict) -> str:
    fam = d["typography"]["body"]["fontFamily"]
    doc = re.sub(r"(--font-(?:headline|body|label): )[^;]*;", rf"\g<1>'{fam}', 'Hiragino Sans', sans-serif;", doc)
    doc = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?family=[^"]*"',
                 f'<link href="https://fonts.googleapis.com/css2?family={fam.replace(" ", "+")}:wght@400;500;700&display=swap"', doc)
    doc = put(doc, "type", type_section(d), "<!-- 4. TYPOGRAPHY -->", "<!-- 5. COMPONENTS IN CONTEXT -->")
    doc = put(doc, "parts", parts_section(d), "<!-- 5b. PARTS -->", None) if "<!-- 5b. PARTS -->" in doc or \
        "<!-- gen:parts -->" in doc else doc.replace("<!-- 6. SPACING", "<!-- 5b. PARTS -->\n<!-- gen:parts -->\n"
                                                      + parts_section(d) + "\n<!-- /gen:parts -->\n\n<!-- 6. SPACING", 1)
    doc = put(doc, "source", source_section(d), "<!-- 8. SOURCE -->", "<footer")
    return doc


def main() -> int:
    d = front()
    old = OUT.read_text(encoding="utf-8")
    new = build(old, d)
    if CHECK:
        if new != old:
            print(f"{OUT.name} が正本と違う。python3 04_design/gen_preview.py で作り直す")
            return 1
        print(f"{OUT.name} は正本どおり")
        return 0
    OUT.write_text(new, encoding="utf-8")
    print(f"{OUT.name} を書いた（文字の段 {len(d['typography'])}・部品 {len(PARTS)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

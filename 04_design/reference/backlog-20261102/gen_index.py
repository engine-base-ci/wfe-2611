# -*- coding: utf-8 -*-
"""notes.json から見返すためのページ（index.html）と README.md を作る。notes.json を直したら回す"""
import json, html
N = json.load(open("notes.json", encoding="utf-8"))
e = html.escape
rows = "".join(
    f'<section id="{e(s["file"][:2])}"><h2>{e(s["file"][:2])}　{e(s["name"])}</h2>'
    f'<dl><dt>何がある</dt><dd>{e(s["what"])}</dd><dt>採る</dt><dd>{e(s["keep"])}</dd>'
    f'<dt>採らない</dt><dd>{e(s["drop"])}</dd><dt>Kaname では</dt><dd>{e(s["kaname"])}</dd></dl>'
    f'<a href="{e(s["file"])}" target="_blank"><img src="{e(s["file"])}" alt="{e(s["name"])}" loading="lazy"></a></section>'
    for s in N["screens"])
toc = "".join(f'<li><a href="#{e(s["file"][:2])}">{e(s["file"][:2])} {e(s["name"])}</a></li>' for s in N["screens"])
common = "".join(f'<tr><td>{"採る" if "keep" in c else "採らない"}</td><td>{e(c.get("keep") or c.get("drop"))}</td><td>{e(c["kaname"])}</td></tr>' for c in N["common"])
page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Backlog 参考画面</title><style>
:root{{--bg:#F7F8FA;--fg:#131B27;--sub:#4A5563;--line:#DDE2E9;--card:#fff;--pri:#22345C}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0F141C;--fg:#E6EAF0;--sub:#A3ADBA;--line:#2A3340;--card:#161D27;--pri:#9DB4E0}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.7 "Noto Sans JP",system-ui,sans-serif}}
main{{max-width:1200px;margin:0 auto;padding:16px}}h1{{font-size:22px}}h2{{font-size:17px;margin:0 0 8px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin:16px 0}}
dl{{display:grid;grid-template-columns:7em 1fr;gap:4px 12px;margin:0 0 12px}}dt{{color:var(--sub)}}dd{{margin:0}}
img{{max-width:100%;border:1px solid var(--line);border-radius:4px}}a{{color:var(--pri)}}
table{{border-collapse:collapse;width:100%}}td:first-child{{white-space:nowrap}}td{{border-top:1px solid var(--line);padding:6px;vertical-align:top}}
.note{{color:var(--sub)}}ol{{columns:2}}@media (max-width:640px){{ol{{columns:1}}dl{{grid-template-columns:1fr}}}}
</style></head><body><main><h1>{e(N["title"])}</h1><p class="note">{e(N["source"])}<br>⚠ {e(N["caution"])}</p>
<section><h2>全体で採るもの・採らないもの</h2><table>{common}</table></section>
<section><h2>目次</h2><ol>{toc}</ol></section>{rows}</main></body></html>"""
open("index.html", "w", encoding="utf-8").write(page)
md = [f"# {N['title']}", "", N["source"], "", f"> ⚠ {N['caution']}", "", "見返すときは `index.html` をブラウザで開く（画像と所見が並ぶ）。所見を直すときは `notes.json` を直して `python3 gen_index.py`。", "", "## 全体で採るもの・採らないもの", "", "| | Backlog | Kaname では |", "|---|---|---|"]
md += [f'| {"採る" if "keep" in c else "採らない"} | {c.get("keep") or c.get("drop")} | {c["kaname"]} |' for c in N["common"]]
md += ["", "## 画面ごと", "", "| # | 画面 | 採る | 採らない | Kaname では |", "|---|---|---|---|---|"]
md += [f'| [{s["file"][:2]}]({s["file"]}) | {s["name"]} | {s["keep"]} | {s["drop"]} | {s["kaname"]} |' for s in N["screens"]]
md += ["", "根拠: 決定ログ D-128.4（Backlog を参考にする）・D-128.7（左のバーから 1 枚ずつ精査）"]
open("README.md", "w", encoding="utf-8").write("\n".join(md) + "\n")
print("ok")

#!/usr/bin/env python3
"""段 7 の下絵の頁（1 枚の HTML・写しは data: で埋め込む）を、モックの写しから作る。段 4 の段4-下絵.html と同じ形。

  python3 07_functional/段7-F6/下絵の頁の作り手.py <写しの置き場（mock-shots.mjs の出す場所）> <出す先>…
状態の並び・名前・製品の時点・仮の葉は apps/web/app/(dev)/dev/mock/f6/mocks.tsx の MOCKS から読む（手で書き写さない）。
"""
import base64
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOCKS = ROOT / "apps/web/app/(dev)/dev/mock/f6/mocks.tsx"
ENTRY = re.compile(
    r'\{\s*id: "([^"]+)",\s*screen: "[^"]+",\s*ps: "([^"]+)",\s*label: "([^"]+)",\s*ticket: "[^"]+",\s*leaf: "([^"]+)",?\s*\}',
    re.S,
)
PS = {"PS0": "PS0 登録直後（PC なし）", "PS2": "PS2 使っている（AI の実行・承認待ちが在る）"}
GROUPS = [("prog-", "A. 自分で進める（作業の段・実績）"), ("talk-", "B. 話す（やり取り）"), ("dec-", "C. 決める（決定ログ）")]

DECIDED = [
    "① 段を変えるのは、頭の行の段の札を押して選ぶ（書く欄の「状態 ▾」でも変えられる）",
    "② 段を変えられるのは、そのチケットを書ける人（閲覧のみの人は字の札のまま）",
    "③ 段のメニューに「完了にする…」（作業中のときだけ押せ、今の完了の小窓を開く）",
    "④ 保留中は題名の下に帯（理由・再開の条件・［作業中に戻す］）",
    "⑤ 完了したチケットを「開き直す」を段 7 に入れる（段の札のメニュー）",
    "⑥ 実績は人の分を「時間」と「分」で入れ、AI の分は自動で足す（「1 時間 12 分（AI 12 分・人 1 時間）」）",
    "⑧ 読める人は書ける（閲覧のみの人も書き込める。段と決定は変えられない）",
    "⑨ 書く欄の「知らせる人」を残す（最初から担当者と承認する人・候補はそのチケットを見られる人だけ）",
    "⑬ まだ読んでいない書き込みに「新しい」の印、タブに数",
    "⑯ AI の決定の案は、段 7 では人が書く所まで（AI の案の欄と本文を直す案はグレーで出す）",
    "⑰ 決定の取り消しは、取り消した印と理由を付けて残す（消さない）",
    "㉑ 狭い幅は今の形のまま（パネルは本文の下）。題名の下に「やり取り 3 ↓」の飛び先",
    "そのほか（⑦⑩⑪⑫⑭⑮⑱⑲⑳㉒㉓）も勧めのとおり",
]

CSS = (
    "body{font-family:system-ui,sans-serif;margin:24px;background:#f4f5f8;color:#1b2030}"
    "section{background:#fff;border-radius:10px;padding:16px;margin:0 0 18px}h1{font-size:20px}"
    "h2{font-size:16px;margin:0 0 6px}h3{font-size:18px;margin:28px 0 10px}small{color:#667;font-weight:400}"
    "p{margin:0 0 10px;font-size:14px}.r{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}"
    "figure{margin:0}img{border:1px solid #dde;border-radius:6px;height:auto;max-width:100%}"
    "figcaption{font-size:12px;color:#667}li{margin:6px 0;font-size:14px}"
)


def data_uri(path: Path) -> str:
    mime = "image/jpeg" if path.suffix == ".jpg" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def build(shots: Path) -> str:
    entries = ENTRY.findall(MOCKS.read_text(encoding="utf-8"))
    if not entries:
        raise SystemExit(f"{MOCKS} の MOCKS が読めない")
    e = html.escape
    parts = [
        '<!DOCTYPE html><html lang="ja"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>段 7 自分で進める・話す・決める 下絵</title><style>{CSS}</style>",
        f"<h1>段 7（F6 自分で進める・話す・決める）の下絵：{len(entries)} の状態</h1>",
        "<p><b>本番と同じ部品で作った下絵です</b>（前の版は手で描いた絵でした。作り直しました）。"
        "チケットの詳細（/tickets/[id]）の中の 4 つの所 ── 頭の行の段の札・題名の下の帯・本文の決定ログ・右のパネルの「やり取り」── に入れます。"
        "新しい画面は足しません。開発用の置き場 /dev/mock/f6/&lt;名前&gt; で幅を変えて見られます。"
        "色・字・余白は今ある正本の値だけで描いています（キャンバスと細かな px が違う所は、詳細のモックで正本に載せてから寄せます）。</p>",
        "<section><h2>代表の答えで決まった事（2026-11-20）</h2><ul>"
        + "".join(f"<li>{e(d)}</li>" for d in DECIDED)
        + "</ul></section>",
        "<section><h2>直したところ（2026-11-20・代表の見た結果「基本的にはいい」の 4 つ）</h2><ol>"
        "<li><b>書く欄の字が大きい</b> → 書く欄を 1 行の高さからにし、字を本文の書き込みと同じ 13px にした。"
        "ただしスマホ（幅 767 以下）の打った字は 16px のまま（16px より小さいと iPhone が打つたびに画面を拡大する・決めてある D-144.7）。薄い案内の字はスマホでも 13px</li>"
        "<li><b>やり取りが長いとスマホで下まで流し続ける</b> → 最初は新しい方から 20 件だけ出し、上に「前の書き込みを見る（あと N 件）」。押すと 20 件ずつ古い方を足す</li>"
        "<li><b>段のメニュー</b> → 選ぶ物を、頭の段の札と同じ色つきの札で並べた（書く欄の「状態 ▾」も同じ）</li>"
        "<li><b>スマホの頭の行</b> → 開始日・期限・段の札を横に並べ、頭の行を 2 行にした（幅 375 で溢れない）</li>"
        "</ol></section>",
        "<section><h2>決めてほしいこと</h2><ol>"
        "<li><b>PC の幅のやり取りの読み方</b>：(a) スマホと同じ形（新しい方から 20 件・上に「前の書き込みを見る（あと N 件）」・パネルの中でスクロール）［勧め：読み方が 1 つで迷わない。開いたらいちばん新しい所が見え、口の形も 1 つで済む］"
        "／(b) PC だけ、パネルの中を上へ流すと自動で前を読む（押す物は無い）</li>"
        "<li><b>直した 4 つの形でよいか</b>（勧め：OK）</li>"
        "</ol></section>",
        "<section><h2>導線（どこを通って何をするか）</h2><ul>"
        "<li><b>進める</b>：段の札 → メニュー → 作業中（その場で）／保留にする小窓 → 保留の帯 →［作業中に戻す］／完了にする…（今の完了の小窓）／完了なら 開き直す。属性の「実績」→ 直す</li>"
        "<li><b>話す</b>：タブ「やり取り」→ 読む（新しい方から 20 件・前の書き込みを見る・すべて・話だけ・自分あて）→ 書く（@・知らせる人・状態 ▾）→ 自分の書き込みの「…」で 直す／消す・☆・引用</li>"
        "<li><b>決める</b>：書き込みの「決定にする」→ 小窓 → 本文の決定ログ →「＋ 決定を足す」・改める・取り消す →「元：やり取り →」で書き込みへ戻る</li>"
        "</ul></section>",
    ]
    n = 0
    for prefix, title in GROUPS:
        parts.append(f"<h3>{e(title)}</h3>")
        for sid, ps, label, leaf in entries:
            if not sid.startswith(prefix):
                continue
            n += 1
            figs = []
            for w, width, ext in ((375, 260, "png"), (1440, 620, "jpg")):
                img = shots / f"{sid}-{w}.{ext}"
                if not img.exists():
                    raise SystemExit(f"写しが無い：{img}")
                figs.append(
                    f'<figure><img alt="{e(sid)} 幅 {w}" width="{width}" src="{data_uri(img)}">'
                    f"<figcaption>幅 {w}</figcaption></figure>"
                )
            parts.append(
                f"<section><h2>{n}. {e(label)} <small>{e(sid)}・{e(PS.get(ps, ps))}・葉 {e(leaf)}（仮）</small></h2>"
                f'<div class="r">{"".join(figs)}</div></section>'
            )
    if n != len(entries):
        raise SystemExit(f"組に入らない状態がある（{len(entries) - n} 個）")
    return "".join(parts) + "</html>"


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    page = build(Path(sys.argv[1]))
    for out in sys.argv[2:]:
        Path(out).write_text(page, encoding="utf-8")
    print(len(page), "bytes")

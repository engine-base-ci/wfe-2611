# -*- coding: utf-8 -*-
"""索引。flow.json の backbone のフェーズ順に並べる（機能グループ順にしない）。"""
import sys, json, collections
sys.path.insert(0,'.')
from _tokens import TOKENS, BASE
from _icons import ic, LOGO
from _shell import FLOW, SCR, ICON, NAV, ROLES, SECT_BY_ROLE

CSS = """
.ix{padding:36px 40px 90px;max-width:1560px}
.ix-h{display:flex;align-items:center;gap:11px;font-size:26px;font-weight:700;margin-bottom:8px}
.ix-h svg{width:26px;height:26px;color:var(--primary)}
.ix-sub{font-size:14px;color:var(--on-sv);line-height:1.9;max-width:900px;margin-bottom:24px}
.ix-flow{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px 20px;margin-bottom:26px}
.ix-flow .fh{font-size:13px;font-weight:700;margin-bottom:12px}
.ix-flow .fr{display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:12.5px}
.ix-flow .fr a{background:var(--sv);padding:5px 11px;border-radius:var(--r-full);font-weight:600}
.ix-flow .fr a:hover{background:var(--primary-c)}
.ix-flow .fr span{color:var(--on-sv)}
.ix-sec{font-size:12px;font-weight:700;letter-spacing:.08em;color:#fff;background:var(--primary);
  padding:7px 14px;border-radius:var(--r-md);display:inline-block;margin:30px 0 14px}
.ix-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}
.ix-grid>*{min-width:0}
.ix-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 17px;display:block;transition:.14s}
.ix-card:hover{border-color:var(--primary);transform:translateY(-1px)}
.ix-card .t{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14.5px;margin-bottom:6px}
.ix-card .t svg{color:var(--primary)}
.ix-step{width:23px;height:23px;border-radius:var(--r-full);background:var(--primary);color:#fff;
  display:grid;place-items:center;font-size:11.5px;font-weight:700;flex:none;font-variant-numeric:tabular-nums}
.ix-card .d{font-size:12.5px;color:var(--on-sv);line-height:1.7;margin-bottom:10px;min-height:44px}
.ix-card .b{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.ix-card .b span{font-size:10.5px;font-weight:600;background:var(--sv);color:var(--on-sv);padding:2px 8px;border-radius:var(--r-full)}
.ix-card .b .pa{background:var(--primary-c);color:var(--on-primary-c)}
.ix-card .b .ck{font-family:var(--font-code);background:#EDEAF6;color:var(--on-tertiary-c)}
.ix-note{background:#FEF6EC;border-radius:var(--r-md);padding:14px 17px;font-size:13px;line-height:1.85;display:flex;gap:11px;margin-bottom:24px}
.ix-roles{display:grid;gap:12px;margin-bottom:26px}
@media(min-width:1000px){.ix-roles{grid-template-columns:repeat(4,1fr)}}
.ix-role{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:15px 16px}
.ix-role b{font-size:13px}.ix-role .n{font-size:11.5px;color:var(--on-sv);margin:3px 0 9px}
.ix-role .l{font-size:12px;color:var(--on-sv);line-height:1.7}
@media(max-width:900px){.ix{padding:24px 16px 90px}.ix-h{font-size:21px}
 .ix-flow .fr{font-size:12px}.ix-card .d{min-height:0}}
"""

PHASES = [(p["phase"], [a for a in p["acts"]]) for p in FLOW["backbone"]]
# 画面をフェーズ順に並べる（初出のフェーズに置く）
order, seen = [], set()
for ph, acts in PHASES:
    for a in acts:
        for s in FLOW["act_to_screen"].get(a["id"], []):
            s = s.replace("new:", "")
            if s in seen or SCR[s]["release"] != "v1": continue
            seen.add(s); order.append((ph, s))

by_phase = collections.OrderedDict()
for ph, s in order: by_phase.setdefault(ph, []).append(s)

n = 0; secs = ""
for ph, ss in by_phase.items():
    cards = ""
    for sid in ss:
        n += 1; s = SCR[sid]
        acts = ""
        cards += (f'<a class="ix-card" href="v1-{sid}.html">'
                  f'<div class="t"><span class="ix-step">{n}</span>{ic(ICON.get(sid,"file"))}{s["name"]}</div>'
                  f'<div class="d">{s["purpose"]}</div>'
                  f'<div class="b"><span class="pa">{s["primary_action"]}</span>{acts}</div></a>')
    secs += f'<div class="ix-sec">{ph.split(" ", 1)[1] if ph[:1] == "P" and " " in ph else ph}</div><div class="ix-grid">{cards}</div>'

SK = FLOW["walking_skeleton"]
ACTS = {a["id"]: a for p in FLOW["backbone"] for a in p["acts"]}
first = {}
for a in SK:
    for s in FLOW["act_to_screen"].get(a, []):
        first.setdefault(a, s.replace("new:", ""))
flow_row = "<span>→</span>".join(
    f'<a href="v1-{first[a]}.html">{ACTS[a]["act"]}</a>' for a in SK if a in first)

roles = "".join(
  f'<div class="ix-role"><b>{ROLES[r]["name"]}</b>'
  f'<div class="n">サイドバー {len(SECT_BY_ROLE[r])}本 ／ 中の画面 {len(NAV[r])}</div>'
  f'<div class="l">{" / ".join(SCR[x]["name"] for x in NAV[r])}</div></div>'
  for r in ["R1","R2","R3","R4"])

html = f"""<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kaname V1 — モックアップ一覧</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+2:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{TOKENS}{BASE}{CSS}</style></head><body>
<div class="mockbar"><b>モックアップ</b><span class="tagv" style="background:#186F69">V1</span>
<span style="opacity:.7">段階1（最初に出せる状態）</span><span class="sp"></span>
<span class="mut">実データ・API連携は含みません</span></div>
<div class="ix">
 <div class="ix-h">{LOGO}Kaname — 段階1（最初に出せる状態）</div>
 <div class="ix-sub"><b>{n} 画面。</b>すべて <span style="font-family:var(--font-code);font-size:12.5px">05_flow/flow.json</span>
 の行為から導出しています（画面を先に列挙していません・根拠 決定ログ）。<b>並びは使う手順の順</b>です。各画面の下部に根拠の決定IDが出ます。<br>
 各画面の上部で <b>アカウントタイプ</b>（ひとり社長／代表＋数人／担当者／閲覧のみ）を切り替えると、<b>サイドバーの本数と中身そのものが変わります</b>（最大6本・中は開閉）。
 権限で見えない画面を開くと、その旨が出ます。</div>
 <div class="ix-flow"><div class="fh">最初の一周（walking skeleton）── ここが通らない製品は、機能が何個あっても使われない</div>
  <div class="fr">{flow_row}</div></div>
 <div class="ix-roles">{roles}</div>
 <div class="ix-note">{ic("warn")}<div>これはモックアップです。<b>実データ・API 連携・ログインは含まれていません。</b>
  各画面の上部タブで状態（通常／空／エラー／実行中など）を切り替えられます。
  ブラウザ幅を狭めるとスマートフォン表示になります。</div></div>
 {secs}
</div></body></html>"""
open('v1/v1-index.html','w',encoding='utf-8').write(html)
print(f"v1-index.html ok / {n} 画面 / フェーズ {len(by_phase)}")

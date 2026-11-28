# -*- coding: utf-8 -*-
"""flow.json（信頼源）から HTML と MD を生成する。三層出力の2層目・3層目。手で書かない。"""
import json, html, collections
F=json.load(open('flow.json',encoding='utf-8'))
ACTS={a['id']:a for p in F['backbone'] for a in p['acts']}
SCR={s['id']:s for s in F['screens']}
ROLE={r['id']:r for r in F['roles']}
JOB={j['id']:j for j in F['jobs']}
def e(x): return html.escape(str(x))

# ---------------------------------------------------------------- HTML
CSS = """
:root{--primary:#22345C;--on-primary:#fff;--secondary:#186F69;--tertiary:#6D4AA6;--tc:#E9E0F5;--otc:#33235C;
--surface:#F7F8FA;--on-surface:#131B27;--sv:#E9ECF1;--on-sv:#4A5563;--card:#fff;--line:#DDE2E9;--soft:#EDF0F4;
--su:#166534;--wa:#B45309;--da:#B91C1C;--pr:#1D4ED8;--r:6px;--rl:12px;
--f:'M PLUS 2','Hiragino Sans',sans-serif;--fc:ui-monospace,Menlo,monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--surface);color:var(--on-surface);font-family:var(--f);font-size:14px;line-height:1.75;-webkit-font-smoothing:antialiased}
svg{width:16px;height:16px;flex:none}
.num{font-variant-numeric:tabular-nums}
header{background:var(--primary);color:#fff;padding:38px 40px}
header h1{font-size:30px;font-weight:700;letter-spacing:-.01em;margin-bottom:10px}
header p{font-size:14.5px;line-height:1.9;opacity:.88;max-width:900px}
header .k{background:rgba(255,255,255,.16);padding:2px 8px;border-radius:4px;font-weight:600}
.stats{display:flex;gap:26px;margin-top:22px;flex-wrap:wrap}
.stats div span{display:block;font-size:11px;opacity:.65;font-weight:600;letter-spacing:.06em}
.stats div b{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
nav.toc{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:11px 40px;display:flex;gap:6px;overflow-x:auto}
nav.toc a{font-size:12.5px;font-weight:600;color:var(--on-sv);padding:6px 12px;border-radius:999px;white-space:nowrap;text-decoration:none}
nav.toc a:hover{background:var(--sv);color:var(--on-surface)}
main{padding:0 40px 90px;max-width:1560px}
section{padding-top:44px}
h2{font-size:20px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px;display:flex;align-items:center;gap:11px}
h2 .n{width:26px;height:26px;border-radius:999px;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700}
.lead{font-size:13.5px;color:var(--on-sv);margin-bottom:20px;max-width:940px;line-height:1.9}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--rl);padding:20px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.06em;color:var(--on-sv);padding:0 10px 8px 0;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 10px 9px 0;border-bottom:1px solid var(--soft);vertical-align:top}
tr:last-child td{border-bottom:0}
.wrap{overflow-x:auto}
.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap}
.p1{background:var(--pr)}.p2{background:var(--su)}.p3{background:var(--wa)}.p4{background:var(--da)}.p5{background:#8A94A3}
.tag{display:inline-block;font-size:10.5px;font-weight:600;background:var(--sv);color:var(--on-sv);padding:2px 8px;border-radius:999px;margin:1px 2px 1px 0;white-space:nowrap}
.tag.ai{background:var(--tc);color:var(--otc)}
.tag.ck{background:#DCE4F2;color:#101C33;font-family:var(--fc)}
.phase{font-size:13px;font-weight:700;background:var(--primary);color:#fff;padding:7px 13px;border-radius:var(--r);display:inline-block;margin-bottom:11px}
.skel{display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:12.5px}
.skel b{background:var(--primary);color:#fff;padding:5px 11px;border-radius:999px;font-weight:600}
.skel span{color:var(--on-sv)}
.mono{font-family:var(--fc);font-size:12px}
.ok{color:var(--su);font-weight:700}.ng{color:var(--da);font-weight:700}
.gate{background:var(--on-surface);color:#D8DEE9;border-radius:var(--rl);padding:18px 20px;font-family:var(--fc);font-size:12px;line-height:1.8;white-space:pre;overflow-x:auto}
.grid2{display:grid;gap:16px}
@media(min-width:1000px){.grid2{grid-template-columns:1fr 1fr}}
.navcol{border-left:3px solid var(--primary);padding-left:13px;margin-bottom:14px}
.navcol b{font-size:13px}
.navcol div{font-size:12.5px;color:var(--on-sv)}
@media(max-width:900px){header,nav.toc,main{padding-left:16px;padding-right:16px}.wrap table{min-width:640px}}
"""

def h_roles():
    rows="".join(f"<tr><td class='mono'>{e(r['id'])}</td><td><b>{e(r['name'])}</b></td><td>{e(r['desc'])}</td><td class='num'>{e(r['frequency'])}</td></tr>" for r in F['roles'])
    jrows=""
    for j in F['jobs']:
        rs="".join(f"<span class='tag'>{e(x)}</span>" for x in j['roles'])
        jrows+=f"<tr><td class='mono'>{e(j['id'])}</td><td><b>{e(j['statement'])}</b></td><td>{rs}</td><td class='num'>{e(j['when'])}</td><td style='color:var(--on-sv)'>{e(j['pain'])}</td></tr>"
    return f"""<section id="s1"><h2><span class="n">1</span>役割 × 用事（Jobs to be Done）</h2>
<p class="lead">役割は<b>肩書ではなく状況</b>で書く。用事は<b>痛みとセット</b>で書く。「効率化したい」のような汎用ゴールを書いた時点で、そこからは何も導けない。</p>
<div class="card"><div class="wrap"><table><thead><tr><th>ID</th><th>役割</th><th>どういう人か</th><th>頻度</th></tr></thead><tbody>{rows}</tbody></table></div></div>
<div class="card"><div class="wrap"><table><thead><tr><th>ID</th><th>〜したい</th><th>誰の</th><th>いつ</th><th>いま何が起きているか（痛み）</th></tr></thead><tbody>{jrows}</tbody></table></div></div></section>"""

def h_backbone():
    out=""
    for p in F['backbone']:
        rows=""
        for a in p['acts']:
            rl="".join(f"<span class='tag'>{e(x)}</span>" for x in a['roles'])
            jb="".join(f"<span class='tag ai'>{e(x)}</span>" for x in a['jobs'])
            v2=" <span class='pill p5'>段階2</span>" if a['release']=='v2' else ""
            sc="".join(f"<span class='tag'>{e(s.replace('new:',''))}</span>" for s in F['act_to_screen'].get(a['id'],[]))
            rows+=f"<tr><td class='mono'>{e(a['id'])}</td><td><b>{e(a['act'])}</b>{v2}</td><td>{rl}</td><td class='num'>{e(a['frequency'])}</td><td>{jb}</td><td>{sc}</td></tr>"
        out+=f"<div class='card'><div class='phase'>{e(p['phase'])}</div><div class='wrap'><table><thead><tr><th>ID</th><th>行為</th><th>誰が</th><th>頻度</th><th>用事</th><th>画面</th></tr></thead><tbody>{rows}</tbody></table></div></div>"
    sk=" ".join(f"<b>{e(ACTS[a]['act'])}</b><span>→</span>" for a in F['walking_skeleton'])[:-len("<span>→</span>")]
    return f"""<section id="s2"><h2><span class="n">2</span>行為の背骨（User Story Mapping）</h2>
<p class="lead">フェーズは<b>頻度</b>で切る。機能では切らない。頻度で切ったときだけ、リリースを横に切れる。<br>
<b>行為 {len(ACTS)}件</b>（段階1が41、段階2が2）。すべて動詞で終わっている ──「◯◯管理」は1つも無い。</p>
<div class="card" style="border-color:var(--primary)"><b style="font-size:13px">最初の一周（walking skeleton）── ここが通らない製品は、機能が何個あっても使われない</b>
<div class="skel" style="margin-top:12px">{sk}</div></div>{out}</section>"""

def h_objects():
    rows="".join(f"<tr><td><b>{e(o['name'])}</b></td><td>{e(o['desc'])}</td><td>{''.join(f'<span class=tag>{e(x)}</span>' for x in o['relates_to'])}</td></tr>" for o in F['objects'])
    return f"""<section id="s3"><h2><span class="n">3</span>オブジェクト（OOUX）</h2>
<p class="lead">背骨の文から名詞を抜き、同義語をまとめた <b>{len(F['objects'])}件</b>。画面より先にオブジェクトと関係を決める。</p>
<div class="card"><div class="wrap"><table><thead><tr><th>オブジェクト</th><th>何か</th><th>関係するもの</th></tr></thead><tbody>{rows}</tbody></table></div></div></section>"""

def h_blueprint():
    out=""
    for p in F['backbone']:
        rows=""
        for a in p['acts']:
            b=F['blueprint'][a['id']]
            ck="".join(f"<span class='tag ck'>{e(c)}</span>" for c in b['choke_points'])
            auto=f"<b style='color:var(--tertiary)'>{e(b['auto'])}</b>" if b['auto']!='—' else "<span style='color:#8A94A3'>—</span>"
            rows+=(f"<tr><td class='mono'>{e(a['id'])}</td><td>{e(b['human'])}</td><td><span class='tag'>{e(b['screen'])}</span></td>"
                   f"<td>{auto}</td><td style='color:var(--on-sv)'>{e(b['backstage'])}</td><td>{ck}</td></tr>")
        out+=f"<div class='card'><div class='phase'>{e(p['phase'])}</div><div class='wrap'><table><thead><tr><th>ID</th><th>人がすること</th><th>画面</th><th>自動側がすること</th><th>裏で動くもの</th><th>関門</th></tr></thead><tbody>{rows}</tbody></table></div></div>"
    auto_n=sum(1 for v in F['blueprint'].values() if v['auto']!='—')
    return f"""<section id="s3b"><h2><span class="n">3b</span>サービスブループリント</h2>
<p class="lead">裏で自動処理が動く製品では、<b>画面（frontstage）だけ描いても意味が通らない</b>。人 / 画面 / 自動側 / 裏で動くもの / 通る関門 の5レーンを全行為ぶん埋める。<br>
<b>{auto_n}/{len(F['blueprint'])}件（{round(auto_n/len(F['blueprint'])*100)}%）に自動側がある。</b>関門は <span class="mono">03_architecture/choke-points.json</span> の C1〜C8。</p>{out}</section>"""

def h_screens():
    rows=""
    for s in F['screens']:
        acts="".join(f"<span class='tag'>{e(a)}</span>" for a in s['acts'])
        rel="<span class='pill p5'>段階2</span>" if s['release']=='v2' else "<span class='pill p2'>段階1</span>"
        sh="" if s['has_shell'] else "<span class='tag'>シェル無し</span>"
        rows+=(f"<tr><td class='mono'>{e(s['id'])}</td><td><b>{e(s['name'])}</b> {sh}</td><td>{acts}</td>"
               f"<td>{e(s['purpose'])}</td><td><b style='color:var(--primary)'>{e(s['primary_action'])}</b></td>"
               f"<td class='mono' style='font-size:10.5px;color:var(--on-sv)'>{' '.join(s['source'])}</td><td>{rel}</td></tr>")
    return f"""<section id="s4"><h2><span class="n">4</span>画面の導出（双方向）</h2>
<p class="lead">画面は<b>行為から出てくる</b>。<code>purpose</code>（この画面で何をするか1文）を<b>画面を作る前に</b>書く。書けない画面は作らない。<br>
<b>{len(F['screens'])}画面</b>（段階1が{sum(1 for x in F['screens'] if x['release']=='v1')}、段階2が{sum(1 for x in F['screens'] if x['release']=='v2')}）。担う行為が空の画面は<b>0件</b>。<br>
各画面の <code>source</code> は <span class="mono">01_hearing/決定ログ_進行中.md</span> の決定ID。要約が正本になりすますのを防ぐ。</p>
<div class="card"><div class="wrap"><table><thead><tr><th>画面ID</th><th>画面名</th><th>担う行為</th><th>この画面で何をするか（purpose）</th><th>主アクション</th><th>根拠（決定ID）</th><th></th></tr></thead><tbody>{rows}</tbody></table></div></div></section>"""

def h_nav():
    cols=""
    for rid, ss in F['navigation']['by_role'].items():
        secs=""
        for sec in F['navigation']['sections']:
            hit=[x for x in sec['screens'] if x in ss]
            if hit: secs+=f"<div class='navcol'><b>{e(sec['label'])}</b><div>{' / '.join(SCR[x]['name'] for x in hit)}</div></div>"
        hidden=[SCR[x]['name'] for x in SCR if SCR[x]['has_shell'] and x not in ss and SCR[x]['release']=='v1' and rid!='R6']
        cols+=(f"<div class='card'><div style='font-size:13px;font-weight:700;margin-bottom:4px'>{e(rid)} {e(ROLE[rid]['name'])}</div>"
               f"<div style='font-size:11.5px;color:var(--on-sv);margin-bottom:13px'>サイドバー {len(F['navigation']['sections_by_role'][rid])}本 ／ 中の画面 {len(ss)}</div>{secs}"
               + (f"<div style='font-size:11.5px;color:var(--on-sv);margin-top:11px'><b>見えない画面 {len(hidden)}</b>：{e('／'.join(hidden[:9]))}{'…' if len(hidden)>9 else ''}</div>" if hidden else "")
               + "</div>")
    sub="".join(f"<tr><td class='mono'>{e(k)}</td><td><b>{e(SCR[k]['name'])}</b></td><td>{' ｜ '.join(e(x['label']) for x in v)}</td></tr>" for k,v in F['navigation']['sub_by_screen'].items())
    dup=sum(1 for _,c in collections.Counter(tuple(x['label'] for x in v) for v in F['navigation']['sub_by_screen'].values()).items() if c>1)
    return f"""<section id="s5"><h2><span class="n">5</span>導線（Information Architecture）</h2>
<p class="lead">ナビは設計物ではなく<b>構造の写像</b>。<b>サイドバーは6本まで</b>（フラットに並べると分かりづらくUXを落とす）。中は画面ごとの第2ナビ（タブ）で分ける。<br>
主ナビに出る画面は<b>「その section の画面」×「その役割に権限がある画面」で機械導出</b>している。手で並べていない。</p>
<div class="grid2">{cols}</div>
<div class="card"><b style="font-size:13px">画面ごとの第2ナビ</b>
<div style="font-size:12.5px;color:var(--on-sv);margin:6px 0 13px">第2ナビが同一の画面の組：<span class="{'ok' if dup==0 else 'ng'}">{dup} 組</span>（0でなければ規約違反）</div>
<div class="wrap"><table><thead><tr><th>画面ID</th><th>画面名</th><th>第2ナビの項目</th></tr></thead><tbody>{sub}</tbody></table></div></div></section>"""

def h_gate(gate_text, gate9):
    return f"""<section id="s6"><h2><span class="n">6</span>機械ゲート</h2>
<p class="lead">「行為から考えました」と書くだけでは不可。<b>G1〜G10 が緑であること</b>を出力で示す。</p>
<div class="card"><b style="font-size:13px">flow.json 単体（G1〜G8・G10）</b><div class="gate" style="margin-top:11px">{e(gate_text)}</div></div>
<div class="card"><b style="font-size:13px">既存モックとの照合（G9）── これが ui-mockup への作業指示になる</b>
<div class="gate" style="margin-top:11px">{e(gate9)}</div></div></section>"""

def build(gate_text, gate9):
    toc="".join(f'<a href="#{i}">{t}</a>' for i,t in
        [("s1","① 役割×用事"),("s2","② 行為の背骨"),("s3","③ オブジェクト"),("s3b","③b ブループリント"),
         ("s4","④ 画面の導出"),("s5","⑤ 導線"),("s6","⑥ ゲート")])
    return f"""<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kaname — 使ってもらい方の設計</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+2:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<header><h1>Kaname — 使ってもらい方の設計</h1>
<p><span class="k">画面から始めるな。行為から導け。</span> 誰が・何のために・どこを通って・何をするかを先に決め、画面はその結果として導出する。
この文書は <span class="mono">05_flow/flow.json</span> から自動生成している（手で書いていない）。</p>
<div class="stats">
 <div><span>役割</span><b>{len(F['roles'])}</b></div>
 <div><span>用事 JTBD</span><b>{len(F['jobs'])}</b></div>
 <div><span>行為</span><b>{len(ACTS)}</b></div>
 <div><span>オブジェクト</span><b>{len(F['objects'])}</b></div>
 <div><span>画面（導出）</span><b>{len(F['screens'])}</b></div>
 <div><span>最初の一周</span><b>{len(F['walking_skeleton'])} 手</b></div>
</div></header>
<nav class="toc">{toc}</nav>
<main>{h_roles()}{h_backbone()}{h_objects()}{h_blueprint()}{h_screens()}{h_nav()}{h_gate(gate_text,gate9)}</main>
</body></html>"""

import subprocess, os
os.chdir('..')
g1=subprocess.run(["python3","scripts/ci/flow_gate.py","--flow","05_flow/flow.json","--choke","03_architecture/choke-points.json"],capture_output=True,text=True).stdout
g9=subprocess.run(["python3","scripts/ci/flow_gate.py","--flow","05_flow/flow.json","--mocks","06_mockup/v1","--choke","03_architecture/choke-points.json"],capture_output=True,text=True).stdout
open('05_flow/flow.html','w',encoding='utf-8').write(build(g1.strip(),g9.strip()))
print("flow.html 生成")

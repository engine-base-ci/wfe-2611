# -*- coding: utf-8 -*-
"""全モックを iframe に並べ、指定幅での横溢れをまとめて実測する治具を作る。"""
import os, sys, html
d = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 375
CH = int(sys.argv[3]) if len(sys.argv) > 3 else 6
base = os.path.basename(d.rstrip('/'))
files = sorted(f for f in os.listdir(d) if f.startswith(f'{base}-') and f.endswith('.html'))   # 治具（measure-*, _runner 等）は対象外
for i in range(0, len(files), CH):
    grp = files[i:i+CH]
    fr = "".join(f'<iframe data-n="{f}" srcdoc="{html.escape(open(os.path.join(d,f)).read(),quote=True)}" '
                 f'style="width:{W}px;height:230px;border:1px solid #ccc;flex:none"></iframe>' for f in grp)   # ★flex:none が無いと iframe が pane 幅に縮み、指定幅で測れていない
    open(f'{d}/measure-{i//CH}.html', 'w').write(
f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>m</title></head><body style="margin:0">
<div style="display:flex;flex-wrap:wrap;gap:5px;width:max-content">{fr}</div>
<script>window.measure=async()=>{{const r=[];for(const f of document.querySelectorAll('iframe')){{
const d2=f.contentDocument;if(d2.fonts)await d2.fonts.ready;const de=d2.documentElement;
const ov=de.scrollWidth-de.clientWidth;let bad=[];
const mn=d2.querySelector('.main');const sd=d2.querySelector('.side.on');
if(de.clientWidth<768&&sd&&getComputedStyle(sd).display!=='none')bad.push('★サイドバーがスマホ幅で表示');
if(de.clientWidth<768&&mn&&mn.getBoundingClientRect().top>400)bad.push('★本文が'+Math.round(mn.getBoundingClientRect().top)+'px下に押し出し');
if(ov>0){{bad=[...d2.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>de.clientWidth+1
 &&!e.closest('.t-wrap')&&!e.closest('.code')&&!e.closest('.subnav-b')).slice(0,3)
 .map(e=>e.tagName+'.'+String(e.className).slice(0,18)+'|'+(e.getAttribute('style')||'').slice(0,40));}}
r.push({{n:f.dataset.n,ov:ov+(bad.some(b=>b.startsWith('★'))?1000:0),bad}});}}return r;}};</script></body></html>""")
print(f'{d}/measure-*.html を {(len(files)+CH-1)//CH} 枚（{len(files)} ファイル・幅 {W}px）')

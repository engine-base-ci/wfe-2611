#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""レイアウト検査の治具を作る（全画面 × 全役割で本体幅を実測）。
 由来: .norole{display:grid} が hidden 属性を上書きし、隠れるはずの要素が
       flex:1 で幅を奪って本文が1/3に潰れた事故（2026-09-09）。
       横スクロールは 0 のままだったため check_wide では捕まらなかった。"""
import os, sys, html
d = sys.argv[1] if len(sys.argv) > 1 else 'v1'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1400
CH = 6
files = sorted(f for f in os.listdir(d) if f.startswith(f'{d}-') and f.endswith('.html') and not f.endswith('-index.html'))
JS = """const sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.layout=async()=>{const out=[];
for(const f of document.querySelectorAll('iframe')){
 const d2=f.contentDocument; if(d2.fonts) await d2.fonts.ready;
 const btns=[...d2.querySelectorAll('.rolebar button')];
 const vw=d2.documentElement.clientWidth;
 const row={n:f.dataset.n, vw, r:{}};
 if(!btns.length){ const c=d2.querySelector('.content');
   row.r='shell無:'+(c?Math.round(c.getBoundingClientRect().width):0); out.push(row); continue; }
 for(const b of btns){
  b.click(); await sleep(70);
  const side=d2.querySelector('.side.on'), sub=d2.querySelector('.subnav'), main=d2.querySelector('.main');
  const nr=d2.querySelector('.norole:not([hidden])');
  const vis=[...d2.querySelectorAll('.norole')].filter(x=>getComputedStyle(x).display!=='none').length;
  if(main && getComputedStyle(main).display!=='none'){
    const sw=side?side.getBoundingClientRect().width:0; const ap=d2.querySelector('.aipanel.on'); const pw=(ap&&getComputedStyle(ap).display!=='none'&&getComputedStyle(ap).position!=='fixed')?ap.getBoundingClientRect().width:0;
    const bw=(sub&&getComputedStyle(sub).display!=='none'&&Math.abs(sub.getBoundingClientRect().top-main.getBoundingClientRect().top)<5)?sub.getBoundingClientRect().width:0;
    const mw=main.getBoundingClientRect().width, expect=vw-sw-bw-pw;
    row.r[b.dataset.role]= Math.abs(mw-expect)<3 ? 'OK' : `★本体${Math.round(mw)} / 期待${Math.round(expect)}`;
    if(vis>0) row.r[b.dataset.role]+=` ★見えないはずのnorole${vis}個が表示`;
  } else {
    row.r[b.dataset.role]= nr ? (vis===1?'見えません':`★norole${vis}個`) : '★何も出ない';
  }
 }
 btns[0].click(); out.push(row);}
return out;};"""
for i in range(0, len(files), CH):
    fr = "".join(f'<iframe data-n="{f}" srcdoc="{html.escape(open(os.path.join(d,f)).read(),quote=True)}" '
                 f'style="width:{W}px;height:100px;border:1px solid #ccc;flex:none"></iframe>' for f in files[i:i+CH])
    open(f'{d}/ly{i//CH}.html', 'w').write(
      f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>ly</title></head><body style="margin:0">'
      f'<div style="display:flex;flex-direction:column;gap:2px">{fr}</div><script>{JS}</script></body></html>')
print(f'{d}/ly*.html を {(len(files)+CH-1)//CH} 枚作成（{len(files)} 画面 × 4役割・幅 {W}px）')
print('ブラウザで開き window.layout() を呼ぶ。★が付いたものが FAIL。')

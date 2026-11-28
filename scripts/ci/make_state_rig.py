#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""実機検査の治具（製品状態・アイコン整列・見出し整列）を作る。ブラウザで開いて window.audit() を呼ぶ。

 1) 製品状態：各状態タブを順に押し、その時点の caps に無い data-requires 要素が見えていたら ★
             caps に data が無いのに .badge（件数）が見えていたら ★
 2) アイコン：svg の中心が親の1行の中心から 3px 以上ずれていたら ★（縦横のズレ）
 3) 見出し：第2ナビの見出し上端と、本体の見出し上端の差が 6px 以上なら ★（上寄り）
 4) 操作要素：hover / focus-visible の指定が無い・24px 未満（WCAG 2.2 2.5.8）なら ★
 5) 文字：コントラスト 4.5:1 未満（大きい文字は 3:1）・11px 未満なら ★。スマホ幅で 16px 未満の入力欄も ★
 6) 本文：幅 1180 以上で .main が 720px（RIG_MIN_MAIN）未満なら ★
 6) 折り返さない文字（nowrap）が箱からはみ出していたら ★（タブが増えて縮み、隣と重なって読めない事故）

使い方: python3 make_state_rig.py <モックのフォルダ> <flow.json> <幅=1400> [1ページの枚数=2]  → <フォルダ>/st*.html。window.audit() か audit(番号)
"""
import os, sys, html, json
d = sys.argv[1]; flow = json.load(open(sys.argv[2], encoding="utf-8"))
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1400
CH = int(sys.argv[4]) if len(sys.argv) > 4 else 2   # iframe は重い。1ページ 2 枚まで
caps = {p["id"]: p.get("caps", []) for p in flow.get("product_states", [])}
# 部品→cap のセレクタ設定（任意）。シェルが data-requires を付け忘れても捕まえる
reqcfg = json.load(open(os.path.join(d, "state-requires.json"), encoding="utf-8")) if os.path.exists(os.path.join(d, "state-requires.json")) else {}
files = sorted(f for f in os.listdir(d) if f.startswith(f'{d.rstrip("/").split("/")[-1]}-') and f.endswith('.html') and 'index' not in f)
MINMAIN = int(os.environ.get("RIG_MIN_MAIN", "720"))   # 本文の最小幅（px）。環境変数で変えられる
JS = "const CAPS=" + json.dumps(caps, ensure_ascii=False) + ";const REQ=" + json.dumps(reqcfg, ensure_ascii=False) + ";const MINMAIN=" + str(MINMAIN) + r""";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vis=el=>{ if(el.closest('[hidden]')) return false; const r=el.getClientRects(); return r.length>0 && r[0].width>0 && r[0].height>0; };   // getComputedStyle は iframe 越しに遅い
window.audit=async(only)=>{const out=[];
for(const [fi,f] of [...document.querySelectorAll('iframe')].entries()){ if(only!==undefined&&fi!==only) continue;
 const d2=f.contentDocument; if(d2.fonts) await d2.fonts.ready;
 const row={n:f.dataset.n, bad:[]};
 const tabs=[...d2.querySelectorAll('.states button[data-t]')];
 const panes=[...d2.querySelectorAll('.statepane')];
 const check=(pane)=>{
  const ps=pane.dataset.ps, cs=CAPS[ps]||[];
  for(const el of d2.querySelectorAll('[data-requires]')){
   if(!vis(el)) continue; if(el.closest('.statepane')&&el.closest('.statepane')!==pane) continue;
   for(const c of el.dataset.requires.split(' ')) if(!cs.includes(c)) row.bad.push(`★${ps}: ${c} が無い時点で ${el.className||el.tagName} が見えている`);
  }
  for(const [sel,cap] of Object.entries(REQ)) if(!cs.includes(cap)) for(const el of d2.querySelectorAll(sel)) if(vis(el)&&(!el.closest('.statepane')||el.closest('.statepane')===pane)) row.bad.push(`★${ps}: ${cap} が無い時点で ${sel} が見えている`);
  if(!cs.includes('data')) for(const b of d2.querySelectorAll('.badge,.bdg,.sn .n')) if(vis(b)&&(!b.closest('.statepane')||b.closest('.statepane')===pane)) row.bad.push(`★${ps}: データ無しの時点で件数 "${b.textContent.trim()}" が見えている`);
 };
 // タブは click しない（ページ側の scrollTo が隠れた pane では 1〜2 秒かかる）。パネルを直接切り替えて applyPS を呼ぶ
 const w=d2.defaultView; const show=(p)=>{ panes.forEach(x=>x.hidden=(x!==p)); if(w.applyPS) w.applyPS(); };
 if(panes.length){ for(const p of panes){ show(p); check(p);} show(panes[0]); }
 // 0) CSS が最後まで読めているか（番兵 .css-sentinel が効いていなければ途中で壊れている）
 const sen=d2.querySelector('.css-sentinel'); if(sen && d2.defaultView.getComputedStyle(sen).visibility!=='hidden') row.bad.push('★CSS が途中で壊れている（番兵に届いていない）');
 // 1.5) 入力欄は会話の下・同じ列にあるか（入力だけが右に落ちる事故）
 for(const c of d2.querySelectorAll('.composer')){ if(!vis(c)) continue; const chat=c.parentElement&&c.parentElement.querySelector('.chat,.msgs,.thread'); const cr=c.getBoundingClientRect();
   if(!chat){ row.bad.push('★入力欄が会話と同じ箱に無い'); continue; } const hr=chat.getBoundingClientRect();
   // sticky（画面下に貼り付く入力欄）は設計どおり。流れの中での位置で判定するため一時的に static にして測る
   const w2=d2.defaultView; let top=cr.top; if(w2.getComputedStyle(c).position==='sticky'){ const bk=c.style.position; c.style.position='static'; top=c.getBoundingClientRect().top; c.style.position=bk; }
   if(top < hr.bottom-2 || Math.abs(cr.left-hr.left)>8) row.bad.push(`★入力欄が会話の下に無い（会話 x=${Math.round(hr.left)} 下端=${Math.round(hr.bottom)} / 入力 x=${Math.round(cr.left)} 上端=${Math.round(cr.top)}）`); }
 // 2) アイコン整列（見えている svg だけ・状態は先頭）
 let mis=0, ex=[];
 for(const s of d2.querySelectorAll('svg')){ if(!vis(s)) continue; const p=s.parentElement; if(!p) continue; const pr=p.getBoundingClientRect(), sr=s.getBoundingClientRect();
   if(pr.height>44||pr.height<8) continue; // 複数行の親は対象外
   const dy=Math.abs((sr.top+sr.bottom)/2-(pr.top+pr.bottom)/2); if(dy>3){mis++; if(ex.length<3) ex.push(`${p.tagName}.${String(p.className).slice(0,14)} dy=${Math.round(dy)}`);}}
 if(mis) row.bad.push(`★アイコンの縦ズレ ${mis}個: ${ex.join(' / ')}`);
 // 4) 操作要素の状態（hover / focus-visible の指定・大きさ）── 「押せるものは押せると分かり、キーボードでも辿れる」
 const rules=[]; for(const ss of d2.styleSheets){ let rs; try{rs=ss.cssRules}catch(e){continue}
   for(const r of rs){ if(r.selectorText) rules.push(r.selectorText); else if(r.cssRules) for(const r2 of r.cssRules) if(r2.selectorText) rules.push(r2.selectorText);} }
 const strip=(pseudo)=>rules.flatMap(s=>s.split(',')).map(s=>s.trim()).filter(s=>s.includes(pseudo))
   .map(s=>{ let t=s.split(pseudo).join(''); if(t==='') t='*'; if(/[\s>+~]$/.test(t)) t+='*'; return t; });
 const fv=strip(':focus-visible'), hv=strip(':hover');
 const matchAny=(el,list)=>list.some(s=>{ try{ return el.matches(s) }catch(e){ return false } });
 const SKIP='.mockbar,.rolebar,.states,.state-note';
 const gcs0=el=>d2.defaultView.getComputedStyle(el);
 const inter=[...d2.querySelectorAll('button,a[href],[role=tab],[role=button],input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter(e=>vis(e)&&!e.closest(SKIP));
 let noF=0,noH=0,small=0,ex4=[];
 for(const e of inter){ const nm=e.tagName+'.'+String(e.className).slice(0,16);
   if(!e.disabled&&!matchAny(e,fv)){noF++; if(ex4.length<4) ex4.push('focus:'+nm);}
   if(!/INPUT|TEXTAREA|SELECT/.test(e.tagName)&&!e.disabled&&!matchAny(e,hv)){noH++; if(ex4.length<4) ex4.push('hover:'+nm);}
   // 文中のリンク（display:inline で行の高さに縛られるもの）は WCAG 2.5.8 の例外。それ以外は 24px 以上
   // 大きさ：24px 未満でも (a) 文中のリンク (b) label の中の checkbox/radio（label が的）(c) 24px の円が他の的に触れない（間隔の例外）なら可
   let r=e.getBoundingClientRect(); const inl=e.tagName==='A'&&gcs0(e).display==='inline';
   const lab=(e.type==='checkbox'||e.type==='radio')&&e.closest('label'); if(lab) r=lab.getBoundingClientRect();
   const cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
   const spaced=()=>!inter.some(o=>{ if(o===e||o.contains(e)||e.contains(o)) return false; const q=o.getBoundingClientRect(); const dx=Math.max(q.left-cx,0,cx-q.right), dy=Math.max(q.top-cy,0,cy-q.bottom); return Math.hypot(dx,dy)<12; });
   if(!inl&&(r.width<24||r.height<24)&&!spaced()){small++; if(ex4.length<4) ex4.push(`小:${nm} ${Math.round(r.width)}x${Math.round(r.height)}`);} }
 if(noF) row.bad.push(`★focus-visible の無い操作要素 ${noF}個`);
 if(noH) row.bad.push(`★hover の無い操作要素 ${noH}個`);
 if(small) row.bad.push(`★24px 未満の操作要素 ${small}個（WCAG 2.2 2.5.8）`);
 if(ex4.length) row.bad.push('   例: '+ex4.join(' / '));
 // 5) 文字の読みやすさ（コントラスト 4.5:1・大きい文字は 3:1・11px 未満）
 const W2=d2.defaultView, gcs=el=>W2.getComputedStyle(el);
 const rgba=c=>{const m=(c||'').match(/[\d.]+/g)||['255','255','255','0']; return {r:+m[0],g:+m[1],b:+m[2],a:m.length>3?+m[3]:1};};
 const over=(c,bg)=>({r:c.r*c.a+bg.r*(1-c.a),g:c.g*c.a+bg.g*(1-c.a),b:c.b*c.a+bg.b*(1-c.a)});
 const bgOf=el=>{ let e=el, st=[]; while(e&&e.nodeType===1&&st.length<12){ const c=rgba(gcs(e).backgroundColor); if(c.a>0) st.push(c); if(c.a>=1) break; e=e.parentElement; }
   let bg={r:255,g:255,b:255}; for(const c of st.reverse()) bg=over(c,bg); return bg; };
 const opOf=el=>{ let e=el,o=1,d=0; while(e&&e.nodeType===1&&d<8){ o*=parseFloat(gcs(e).opacity||1); e=e.parentElement; d++; } return o; };
 const Lm=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
 const ratio=(a,b)=>{const x=Lm(a),y=Lm(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 let lowc=0,tiny=0,ex5=[]; const seen=new Set(); const tw=d2.createTreeWalker(d2.body,NodeFilter.SHOW_TEXT); let tn;
 while(tn=tw.nextNode()){ if(!tn.textContent.trim()) continue; const el=tn.parentElement; if(!el||seen.has(el)||!vis(el)||el.closest(SKIP+',script,style,.css-sentinel,[disabled],[aria-disabled="true"]')) continue; seen.add(el);   // 無効な操作要素の文字は WCAG の対象外
   const cs=gcs(el); const fs=parseFloat(cs.fontSize); const nm=el.tagName+'.'+String(el.className).slice(0,14);
   if(fs<11){tiny++; if(ex5.length<4) ex5.push(`小文字:${nm} ${fs}px`);}
   const fg=rgba(cs.color); fg.a*=opOf(el); const bg=bgOf(el); const c=ratio(over(fg,bg),bg);
   const big= fs>=24||(fs>=18.66&&parseInt(cs.fontWeight)>=700); const need=big?3:4.5;
   if(c<need){lowc++; if(ex5.length<4) ex5.push(`薄い:${nm} ${c.toFixed(1)}:1`);} }
 if(d2.documentElement.clientWidth<768){ const smallIn=[...d2.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea,select')].filter(e=>vis(e)&&!e.closest(SKIP)&&parseFloat(gcs(e).fontSize)<16).length;
   if(smallIn) row.bad.push(`★スマホ幅で 16px 未満の入力欄 ${smallIn}個（iOS が自動ズームする）`); }
 if(lowc) row.bad.push(`★コントラスト不足の文字 ${lowc}個（4.5:1 未満）`);
 if(tiny) row.bad.push(`★11px 未満の文字 ${tiny}個`);
 if(ex5.length) row.bad.push('   例: '+ex5.join(' / '));
 // 6) 折り返さない文字が箱からはみ出していないか（縮んだタブ・チップの文字が隣と重なって読めなくなる事故）
 let spill=0, ex6=[];
 for(const el of d2.querySelectorAll('button,a,span,div,th,td,label')){ if(!vis(el)||el.closest(SKIP)) continue; const c=gcs(el);
   if(c.whiteSpace!=='nowrap'||c.overflowX!=='visible'||!el.textContent.trim()) continue;
   if(el.scrollWidth>el.clientWidth+2){ spill++; if(ex6.length<4) ex6.push(`${el.tagName}.${String(el.className).slice(0,14)} ${el.scrollWidth}>${el.clientWidth}`); } }
 if(spill) row.bad.push(`★折り返さない文字が箱からはみ出している ${spill}個（縮んだタブ・チップ）: ${ex6.join(' / ')}`);
 // 6) 本文の最小幅（幅 1180 以上で .main が MINMAIN px 未満なら ★。サイドバー＋第2ナビ＋補助パネルの組み合わせで本文が痩せる事故）
 { const mn=d2.querySelector('.main'); const vw=d2.documentElement.clientWidth;
   if(mn&&vis(mn)&&vw>=1180){ const mw=mn.getBoundingClientRect().width; if(mw<MINMAIN) row.bad.push(`★本文が ${Math.round(mw)}px（${MINMAIN}px 未満・幅 ${vw}）`); } }
 // 3) 見出し整列
 const sh=d2.querySelector('.subnav-h .ttl'), h1=d2.querySelector('.topbar h1');
 // 第2ナビが本体の横に並んでいるときだけ（スマホ・タブレットでは上の帯になるので対象外）
 const sbn=d2.querySelector('.subnav'), mn0=d2.querySelector('.main');
 const sideBySide = sbn&&mn0&&vis(sbn)&&sbn.getBoundingClientRect().right<=mn0.getBoundingClientRect().left+2;
 if(sideBySide&&sh&&h1&&vis(sh)&&vis(h1)){ const dy=Math.abs(sh.getBoundingClientRect().top-h1.getBoundingClientRect().top); if(dy>6) row.bad.push(`★第2ナビ見出しが本体見出しと ${Math.round(dy)}px ずれ`); }
 out.push(row);}
return out;};"""
for i in range(0, len(files), CH):
    fr = "".join(f'<iframe data-n="{f}" srcdoc="{html.escape(open(os.path.join(d,f), encoding="utf-8").read(), quote=True)}" '
                 f'style="width:{W}px;height:120px;border:1px solid #ccc;flex:none"></iframe>' for f in files[i:i+CH])
    open(f'{d}/st{i//CH}.html', 'w', encoding='utf-8').write(
      f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>st</title></head><body style="margin:0">'
      f'<div style="display:flex;flex-direction:column;gap:2px;width:max-content">{fr}</div><script>{JS}</script></body></html>')
print(f'{d}/st*.html を {(len(files)+CH-1)//CH} 枚（{len(files)} 画面・幅 {W}px）。ブラウザで開き window.audit() を呼ぶ。★が FAIL。')

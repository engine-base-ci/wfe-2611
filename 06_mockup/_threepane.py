# -*- coding: utf-8 -*-
"""三画面の型（D-072・C 型）── 左：一覧（選ぶ）／中央：選んだ 1 件の中身（読む・押す）／右：自分のAIのパネル（頼む）
 今日・タスク・承認待ち が同じ部品を使う。一覧の行は 1 つの関数、中身も 1 つの関数。
 一覧 380px（--queue-w・1 行 48px・罫線・上に時間の帯）・中央は 640 以上、パネルを閉じれば 720 以上（D-070）。列ごとに別々にスクロール（--tp-top を JS が測る）。サイドバーはレール（72）に畳む（_shell.py の data-layout=threepane）。
 幅 1023 以下は一覧と中身を切り替える（行を押す → 中身、「一覧へ」で戻る）。
"""
from _icons import ic
from _parts import pill

TP_CSS = """
/* 三画面（D-072 改）：左 380（一覧・自分でスクロール）｜中央（選んだ 1 件・自分でスクロール）｜右 パネル。ページ自体はスクロールしない */
.tp{display:grid;grid-template-columns:var(--queue-w) minmax(0,1fr);margin:0 -32px -64px;height:calc(100vh - var(--tp-top,200px))}
.que{border-right:1px solid var(--line);background:var(--card);min-width:0;display:flex;flex-direction:column;min-height:0}
.que .qhd{padding:14px 16px 10px;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:10px;scroll-margin-top:0}
.que .qhd h2{font-size:20px;font-weight:700;letter-spacing:-.01em}
.que .qhd .date{font-size:13px;color:var(--on-sv)}
.que .qhd .sp{flex:1}
.que .qhd button,.que .qhd a{color:var(--on-sv);padding:4px;border-radius:var(--r-sm);display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600}
.que .qhd button:hover,.que .qhd a:hover{background:var(--surface);color:var(--on-surface)}
.que .qs{overflow-y:auto;min-height:0;flex:1;overscroll-behavior:contain;padding-bottom:40px}
.dtl{padding:28px 40px 64px;min-width:0;background:var(--card);overflow-y:auto;min-height:0;overscroll-behavior:contain}
.dtl>*{max-width:880px}
.que .grp{background:var(--card);display:flex;align-items:center;gap:8px;padding:14px 16px 6px;font-size:12px;font-weight:700;color:var(--on-sv);letter-spacing:.03em}
.que .grp .n{color:var(--on-sv);font-weight:500}
.que .grp .sp{flex:1}
.que .grp a,.que .grp button{font-weight:500;color:var(--on-sv);font-size:12px;padding:2px 4px;border-radius:var(--r-sm)}
.que .grp a:hover,.que .grp button:hover{color:var(--on-surface);background:var(--surface)}
.que .qnote{font-size:12.5px;color:var(--on-sv);padding:8px 16px 10px;line-height:1.65;border-bottom:1px solid var(--line-soft)}
/* 見て分かる行：左に「印」（種類のアイコン／チェック／AI の顔／進み具合）、題名は 1 行だけ、下にチップ、右に期限。文は書かない */
.qr .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none}
.qr .ico svg{width:16px;height:16px}
.qr .ico.mail{background:#DCE4F2;color:#22345C}.qr .ico.inv{background:#FCEBD5;color:#7E570D}.qr .ico.send{background:#E9E0F5;color:#6D4AA6}.qr .ico.ledger{background:#CFEAE7;color:#0A3330}
.qr .ico.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c);border-radius:50%}
.qr .ico.ok{background:#DCFCE7;color:#166534;border-radius:50%}
.qr .ico.brain{background:#E9E0F5;color:#6D4AA6}.qr .ico.rule{background:#FCEBD5;color:#7E570D}.qr .ico.person{background:#DCE4F2;color:#22345C}.qr .ico.route{background:#CFEAE7;color:#0A3330}.qr .ico.book{background:#E8F1E6;color:#2E5B26}.qr .ico.building{background:#EEF0F4;color:#3B4453}
.qr .ring{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--on-sv);background:conic-gradient(var(--primary) calc(var(--pct)*1%),var(--sv) 0);flex:none}
.qr .ring i{width:22px;height:22px;border-radius:50%;background:var(--card);display:grid;place-items:center;font-style:normal}
.qr .chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.qr .chips .pill{padding:1px 7px;font-size:11px}
.qr .chips .pill.soft{background:var(--sv);color:var(--on-sv)}
.qr .chips .pill.soft.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.qr .chips .pill.soft.ok{background:#DCFCE7;color:#166534}
.qr .chips .pill.soft.run{background:#DBEAFE;color:#1E40AF}
.qr .chips .pill.soft.wa{background:#FCEBD5;color:#7E570D}
.qr .chips .pill .spin{border-color:rgba(30,64,175,.25);border-top-color:#1E40AF;width:10px;height:10px}
.qr .r .due{display:inline-block;padding:2px 8px;border-radius:var(--r-full);font-size:11.5px;font-weight:700;background:var(--sv);color:var(--on-sv)}
.qr .r .due.late{background:#FEE2E2;color:#991B1B}
.qr .r .est{display:block;font-size:11.5px;color:var(--on-sv);font-variant-numeric:tabular-nums}
.qr .r .act{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:var(--r-md);background:var(--primary);color:#fff;font-size:12px;font-weight:700}
.qr .r .act svg{width:12px;height:12px}
.qr.v{grid-template-columns:30px minmax(0,1fr) auto;gap:12px;padding:10px 14px;min-height:56px;align-items:center}
.qr.v.parent{grid-template-columns:30px 18px minmax(0,1fr) auto;gap:8px 10px}
.qr.v .r{display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-left:4px}
.qr.v .t{white-space:normal;font-size:15px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.qr.v.child{padding-left:56px;min-height:44px;background:var(--surface)}
.qr.v.child .t{font-size:13.5px;font-weight:500;-webkit-line-clamp:1}
.qr.v.child::after{left:29px}
.qr.v .chev{position:static;width:18px;height:18px;margin:0}
.qr.v[aria-expanded] .chev{display:grid}
/* 群の見出し：色の棒＋件数の丸。帯で区切る */
.que .grp.v{padding:10px 14px 8px;font-size:13px;color:var(--on-surface);background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line-soft)}
.que .grp.v::before{content:"";width:4px;height:16px;border-radius:2px;background:var(--gc,var(--primary))}
.que .grp.v .n{background:var(--card);border:1px solid var(--line);border-radius:var(--r-full);padding:0 8px;font-size:11.5px;font-weight:700;color:var(--on-surface)}
/* この件の動き：レーンの流れ図（誰が・いつ・何を）。文字の行は使わない */
.flow{margin-top:22px;border-top:1px solid var(--line);padding-top:14px}
.flow .lh{font-size:12px;font-weight:700;color:var(--on-sv);letter-spacing:.04em;margin-bottom:10px;display:flex;gap:10px;align-items:center}
.flow .lh .now{margin-left:auto;font-weight:600;color:var(--st-progress);font-size:12px}
.flow .fgs{overflow-x:auto}
.flow .fg{display:grid;grid-template-columns:96px minmax(0,1fr);border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--card);min-width:calc(96px + var(--n) * 118px)}
.flow .fl{display:contents}
.flow .fl>div{border-bottom:1px solid var(--line-soft);min-height:44px}
.flow .fl:last-child>div{border-bottom:0}
.flow .who{display:flex;align-items:center;gap:8px;padding:0 10px;font-size:12.5px;font-weight:600;background:var(--surface);border-right:1px solid var(--line)}
.flow .who .av{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;flex:none}
.flow .who .av.me{background:var(--primary-c);color:var(--on-primary-c)}.flow .who .av.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c)}.flow .who .av.st{background:var(--secondary-c);color:var(--on-secondary-c)}
.flow .who .av svg{width:12px;height:12px}
.flow .lane{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));align-items:center}
.flow .lane::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--line-soft)}
.flow .st{position:relative;margin:6px 4px;padding:5px 8px;border-radius:var(--r-md);font-size:12px;font-weight:600;line-height:1.3;background:var(--sv);color:var(--on-surface);border-left:3px solid var(--neutral);min-width:0}
.flow .st small{display:block;font-weight:500;color:var(--on-sv);font-size:11px;font-variant-numeric:tabular-nums}
.flow .st.ok{border-left-color:var(--st-success);background:#EAF7EE}
.flow .st.back{border-left-color:var(--st-danger);background:#FDECEC}
.flow .st.now{border-left-color:var(--st-progress);background:#DBEAFE;box-shadow:0 0 0 2px #BFDBFE}
.flow .st.wait{border-left-color:var(--st-warning);background:#FCEBD5}
.flow .ax{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));font-size:11px;color:var(--on-sv);padding:4px 0 0 96px;font-variant-numeric:tabular-nums;min-width:calc(96px + var(--n) * 118px)}
.flow .ax span{padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 1 件＝1 行（48px）。境は罫線。選んだ行は左の縦線＋薄い青 */
.qr{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:center;padding:0 16px;min-height:48px;border-bottom:1px solid var(--line-soft);cursor:pointer;position:relative;width:100%;text-align:left;background:var(--card)}
.qr:hover{background:var(--surface)}
.qr[aria-selected="true"]{background:var(--primary-c)}
.qr[aria-selected="true"]::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--primary)}
.qr .t{font-size:14px;font-weight:500;line-height:1.35;color:var(--on-surface);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qr .s{font-size:12px;color:var(--on-sv);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;line-height:1.5}
.qr .s span+span::before{content:" · "}
.qr .s .late{color:var(--st-danger);font-weight:600}
.qr .s .who-ai{color:var(--tertiary);font-weight:600}
.qr .s .miss{color:var(--st-danger);font-weight:600}
.qr .r{font-size:12px;color:var(--on-sv);white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
.qr .r b{font-weight:600;color:var(--on-surface)}
.qr .r .late{color:var(--st-danger);font-weight:600}
.qr .mk{width:20px;height:20px;display:grid;place-items:center}
.qr .mk i{width:8px;height:8px;border-radius:50%;background:var(--neutral);display:block}
.qr .mk.warn i{background:var(--st-warning)}.qr .mk.ok i{background:var(--st-success)}.qr .mk.run i{background:var(--st-progress)}.qr .mk.bad i{background:var(--st-danger)}
.qr .mk input{width:16px;height:16px;accent-color:var(--primary);margin:0}
.qr.done .t{text-decoration:line-through;color:var(--on-sv);font-weight:400}
/* 親子：親の行に ▸ を置き、押すと子が下に開く（インデント）。子は自分の中身を持つ */
.qr .chev{width:20px;height:20px;display:grid;place-items:center;color:var(--on-sv);border-radius:var(--r-sm);margin-left:-6px}
.qr .chev svg{width:14px;height:14px;transition:transform .15s}
.qr .chev:hover{background:var(--sv);color:var(--on-surface)}
.qr[aria-expanded="true"] .chev svg{transform:rotate(90deg)}
.qr.parent{grid-template-columns:20px 16px minmax(0,1fr) auto}
.qr .sub{font-size:11.5px;color:var(--on-sv);font-variant-numeric:tabular-nums;margin-left:6px;font-weight:500}
.qr.child{padding-left:48px;min-height:42px;background:var(--surface)}
.qr.child .t{font-size:13.5px;font-weight:400}
.qr.child::after{content:"";position:absolute;left:25px;top:0;bottom:0;width:1px;background:var(--line)}
.qr.child[aria-selected="true"]{background:var(--primary-c)}
.dtl .kids{margin-top:18px;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden}
.dtl .kids .kh{display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:12px;font-weight:700;color:var(--on-sv);background:var(--surface);border-bottom:1px solid var(--line)}
.dtl .kids .kh .sp{flex:1}.dtl .kids .kh button{color:var(--primary);font-weight:600;font-size:12px}
.dtl .kids .kr{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line-soft);font-size:13.5px}
.dtl .kids .kr:last-child{border-bottom:0}
.dtl .kids .kr input{width:15px;height:15px;accent-color:var(--primary);margin:0}
.dtl .kids .kr .r{font-size:12px;color:var(--on-sv);white-space:nowrap}
.dtl .kids .kr.done span{text-decoration:line-through;color:var(--on-sv)}
/* 時間の帯：使える／やる分／会議／余り と 9〜18 時 */
.tstrip{padding:12px 16px 10px;border-bottom:1px solid var(--line);background:var(--surface);scroll-margin-top:0}
.tstrip .nums{display:flex;gap:14px;font-size:12px;color:var(--on-sv);margin-bottom:8px;align-items:baseline;flex-wrap:wrap}
.tstrip .nums b{font-size:14px;color:var(--on-surface);font-variant-numeric:tabular-nums;font-weight:700}
.tstrip .nums .sp{flex:1}
.tstrip .nums .left{color:var(--st-success);font-weight:700}
.tstrip .nums .over{color:var(--st-danger);font-weight:700}
.tstrip .nums .plan{font-size:12px}.tstrip .nums .plan button{color:var(--primary);font-weight:600;font-size:12px;padding:0 2px}
.tbar{position:relative;height:22px;border-radius:5px;background:var(--card);border:1px solid var(--line);overflow:hidden}
.tbar i{position:absolute;top:0;bottom:0;display:block}
.tbar i.mt{background:#D9E4F5;overflow:hidden}

.tbar i.tk{background:var(--primary);opacity:.85;border-radius:2px;top:5px;bottom:5px}
.tbar i.now{width:2px;background:var(--st-danger);z-index:2}
.tticks{display:flex;justify-content:space-between;font-size:11px;color:var(--on-sv);margin-top:4px;font-variant-numeric:tabular-nums}
.tleg{display:flex;gap:4px 14px;flex-wrap:wrap;font-size:11.5px;color:var(--on-sv);margin-top:6px}
.tleg span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:2px;background:#D9E4F5;margin-right:5px;vertical-align:-1px}
.tleg span.tk::before{background:var(--primary)}
.que .lact{margin:14px 16px 0}
.que .bulk{margin:0}
.dpane{display:none}.dpane.on{display:block}
.dtl .kind{font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--st-warning)}
.dtl .kind.task{color:var(--primary)}.dtl .kind.who-ai{color:var(--tertiary)}
.dtl h2{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:6px 0 16px;line-height:1.35}
.dtl .dkv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 20px;font-size:13.5px;margin-bottom:18px}
.dtl .dkv dt{color:var(--on-sv);white-space:nowrap}
.dtl .dkv .late{color:var(--st-danger);font-weight:600}
.dtl .dkv .who-ai{color:var(--tertiary);font-weight:600}
.dtl .dkv .miss{color:var(--st-danger);font-weight:600}
.dtl .mail{border:1px solid var(--line);border-radius:var(--r-lg);padding:18px 20px;font-size:14.5px;line-height:1.9;white-space:pre-wrap;background:var(--surface)}
.dtl .ainote{margin-top:14px;border-left:3px solid var(--tertiary);padding:9px 14px;font-size:13.5px;color:var(--on-sv);background:var(--tertiary-c);border-radius:0 var(--r-md) var(--r-md) 0;line-height:1.75}
.dtl .acts{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;align-items:center}
.dtl .acts .btn{min-height:34px}
.dtl .acts .keys{margin-left:auto;font-size:12px;color:var(--on-sv);display:flex;gap:6px;align-items:center}
.dtl .acts .keys kbd{font:600 11px/1 var(--font);border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:2px 5px;color:var(--on-sv);background:var(--surface)}
.dtl .lbl{font-size:12px;font-weight:700;color:var(--on-sv);letter-spacing:.04em;margin-bottom:6px}
.dtl .nxt{border:1px solid var(--line);border-radius:var(--r-md);padding:12px 14px;font-size:14px;background:var(--surface);display:flex;gap:10px;align-items:flex-start;line-height:1.7}
.dtl .nxt svg{flex:none;margin-top:5px;color:var(--neutral)}
.dtl .nxt .blank{color:var(--tertiary)}
.dtl .log{margin-top:22px;border-top:1px solid var(--line);padding-top:14px}
.dtl .log .lh{font-size:12px;font-weight:700;color:var(--on-sv);letter-spacing:.04em;margin-bottom:8px}
.dtl .log .lr{display:flex;gap:10px;font-size:13px;padding:5px 0;color:var(--on-sv)}
.dtl .log .lr .tm{font-variant-numeric:tabular-nums;color:var(--on-sv);min-width:44px}
.dtl .log .lr b{color:var(--on-surface);font-weight:500}
.dtl .back{display:none}
@media(min-width:768px) and (max-width:1179px){.tp{margin:0 -24px -64px}.dtl{padding:22px 24px 60px}}
@media(max-width:1023px){.tp{grid-template-columns:1fr;height:auto}.que{border-right:0;display:block}.que .qs{overflow:visible}.que .grp{position:static}.dtl{display:none;overflow:visible}.tp.open .que{display:none}.tp.open .dtl{display:block}.dtl .back{display:inline-flex;margin-bottom:12px}}
@media(max-width:767px){.tp{margin:0 -16px -92px}.dtl{padding:18px 16px 92px}}
"""

TP_JS = ("<script>(function(){const fit=()=>{const tp=[...document.querySelectorAll('.statepane:not([hidden]) .tp')].find(x=>!x.closest('[hidden]')); if(!tp) return; const wide=window.innerWidth>=1024; document.documentElement.style.overflow=wide?'hidden':''; if(!wide){tp.style.removeProperty('--tp-top');return;} tp.style.setProperty('--tp-top', Math.round(tp.getBoundingClientRect().top+window.scrollY)+'px');};"
         " window.addEventListener('load',fit); window.addEventListener('resize',fit); document.addEventListener('click',()=>setTimeout(fit,0)); setTimeout(fit,0); window.fitThreePane=fit;})();"
         "document.addEventListener('click',e=>{const r=e.target.closest('.qr'); if(!r||e.target.closest('input')) return;"
         " const tp=r.closest('.tp'); tp.querySelectorAll('.qr').forEach(x=>x.setAttribute('aria-selected',String(x===r)));"
         " tp.querySelectorAll('.dpane').forEach(p=>p.classList.toggle('on',p.dataset.d===r.dataset.d)); tp.classList.add('open'); });"
         "document.addEventListener('click',e=>{const b=e.target.closest('.dtl .back'); if(!b) return; b.closest('.tp').classList.remove('open');});"
         "document.addEventListener('click',e=>{const c=e.target.closest('.qr .chev'); if(!c) return; e.stopPropagation(); const r=c.closest('.qr'); const open=r.getAttribute('aria-expanded')!=='true'; r.setAttribute('aria-expanded',String(open)); document.querySelectorAll('.qr.child[data-parent=\"'+r.dataset.d+'\"]').forEach(k=>k.hidden=!open); if(window.fitThreePane) setTimeout(window.fitThreePane,0); }, true);"
         "document.addEventListener('click',e=>{const b=e.target.closest('.open-panel'); if(!b) return; const t=document.querySelector('.ap-toggle'); if(t&&t.getAttribute('aria-pressed')!=='true') t.click();});</script>")

def qrow(id_, title, sub=(), mark="", checkbox=False, selected=False, done=False, right="", kids=None, parent=None, expanded=False):
    """一覧の 1 行。sub=[(文字, クラス)] は 2 行目、right は右端（期限・待ち）。checkbox=True なら丸の代わりにチェック。
       kids=(終わった数, 全部) なら親（▸ で開く）。parent=親の id なら子（インデント。畳まれていれば hidden）"""
    mk = f'<span class="mk"><input type="checkbox" aria-label="選ぶ"{" checked" if done else ""}></span>' if checkbox else f'<span class="mk {mark}"><i></i></span>'
    s = "".join(f'<span class="{c}">{t}</span>' if c else f'<span>{t}</span>' for t, c in sub if t)
    r = f'<span class="r">{right}</span>' if right else ""
    cls = "qr" + (" done" if done else "") + (" parent" if kids else "") + (" child" if parent else "")
    chev = f'<span class="chev" role="button" aria-label="子を開く">{ic("right")}</span>' if kids else ""
    ex = f' aria-expanded="{str(expanded).lower()}"' if kids else ""
    pa = f' data-parent="{parent}"' if parent else ""
    hid = "" if (not parent or expanded) else " hidden"
    tail = f'<span class="sub">{kids[0]}/{kids[1]}</span>' if kids else ""
    return (f'<button class="{cls}" data-d="{id_}" aria-selected="{str(selected).lower()}"{ex}{pa}{hid}>{mk}{chev}'
            f'<span><span class="t">{title}{tail}</span><span class="s">{s}</span></span>{r}</button>')

def qhead(title, date="", right="", sec=None):
    a = f' id="sec-{sec}" data-sec="{sec}"' if sec is not None else ""
    return f'<div class="qhd"{a}><h2>{title}</h2>' + (f'<span class="date">{date}</span>' if date else "") + f'<span class="sp"></span>{right}</div>'

def tstrip(avail, planned, meetings, day=(9, 18), tasks=(), now=None, extra="", sec=None):
    """時間の帯。avail/planned=分、meetings=[(開始h, 終了h, 名前)]、tasks=[(開始h, 長さ分)]、now=時刻(h)"""
    a = f' id="sec-{sec}" data-sec="{sec}"' if sec is not None else ""
    span = day[1] - day[0]; pct = lambda h: (h - day[0]) / span * 100
    mt_min = sum(int((b - s) * 60) for s, b, _ in meetings)
    left = avail - planned
    fmt = lambda m: f'{m//60}h{m%60:02d}'
    bars = "".join(f'<i class="mt" data-l="{n}" style="left:{pct(s):.1f}%;width:{(b-s)/span*100:.1f}%"></i>' for s, b, n in meetings)
    bars += "".join(f'<i class="tk" style="left:{pct(s):.1f}%;width:{m/60/span*100:.1f}%"></i>' for s, m in tasks)
    if now is not None: bars += f'<i class="now" style="left:{pct(now):.1f}%"></i>'
    ticks = "".join(f'<span>{h}:00</span>' for h in range(day[0], day[1] + 1, 2)) + (f'<span>{day[1]}:00</span>' if (day[1] - day[0]) % 2 else "")
    rest = (f'<span class="left">余り {fmt(left)}</span>' if left >= 0 else f'<span class="over">{fmt(-left)} 超えている</span>')
    leg = "".join(f'<span>{int(s)}:{int((s%1)*60):02d} {n}</span>' for s, b, n in meetings) + '<span class="tk">タスクの見込み</span>'
    return (f'<div class="tstrip"{a}><div class="nums"><span>使える <b>{fmt(avail)}</b></span><span>やる分 <b>{fmt(planned)}</b></span><span>会議 <b>{fmt(mt_min)}</b></span><span class="sp"></span>{rest}{extra}</div>'
            f'<div class="tbar">{bars}</div><div class="tticks">{ticks}</div><div class="tleg">{leg}</div></div>')

def vrow(id_, title, lead, chips=(), right="", selected=False, done=False, kids=None, parent=None, expanded=False):
    """見て分かる行。lead＝左の印の html（ico / ring / checkbox）。chips＝[(文字, 種類)] 種類: ai/ok/run/wa/None。right＝右端の html"""
    ch = "".join(f'<span class="pill soft{(" "+k) if k else ""}">{c}</span>' for c, k in chips if c)
    cls = "qr v" + (" done" if done else "") + (" parent" if kids else "") + (" child" if parent else "")
    chev = f'<span class="chev" role="button" aria-label="子を開く">{ic("right")}</span>' if kids else ""
    ex = f' aria-expanded="{str(expanded).lower()}"' if kids else ""
    pa = f' data-parent="{parent}"' if parent else ""
    hid = "" if (not parent or expanded) else " hidden"
    return (f'<button class="{cls}" data-d="{id_}" aria-selected="{str(selected).lower()}"{ex}{pa}{hid}>{lead}{chev}'
            f'<span><span class="t">{title}</span>{f"<span class=chips>{ch}</span>" if ch else ""}</span><span class="r">{right}</span></button>')

def ico(kind):
    cls = {"card": "inv", "ai": "aiw", "user": "person"}.get(kind, kind)   # 共通の .card / .ai / .user と衝突させない（S5）
    icon = {"mail":"mail","card":"card","send":"send","ledger":"ledger","ai":"ai","ok":"check","brain":"brain","rule":"policy","user":"user","route":"route","book":"book","building":"building","person":"user"}[kind]
    return f'<span class="ico {cls}">{ic(icon)}</span>'
def ring(done, total): return f'<span class="ring" style="--pct:{round(done/total*100) if total else 0}"><i>{done}/{total}</i></span>'
def cbox(checked=False): return f'<span class="mk"><input type="checkbox" aria-label="終わり"{" checked" if checked else ""}></span>'
def due(text, late=False): return f'<span class="due{" late" if late else ""}">{text}</span>'

def vgroup(title, n, rows, sec=None, right="", color="var(--primary)"):
    a = f' id="sec-{sec}" data-sec="{sec}"' if sec is not None else ""
    return f'<div{a}><div class="grp v" style="--gc:{color}">{title}<span class="n">{n}</span><span class="sp"></span>{right}</div>{rows}</div>'

def flow_lanes(steps, actors, title="この件の動き", now_label=""):
    """steps=[(時刻, 誰, 何を, 種類)] 種類: ok/back/now/wait/None。actors=[(名前, 種類 me/ai/st)]。誰が・いつ・何をしたかをレーンの棒で"""
    n = max(len(steps), 1)
    lanes = ""
    for name, kind in actors:
        cells = "".join((f'<div class="st {k or ""}" style="grid-column:{i+1}">{what}<small>{tm}</small></div>' if who == name else f'<div style="grid-column:{i+1}"></div>')
                        for i, (tm, who, what, k) in enumerate(steps))
        av = (ic("clone") if kind == "aiw" else ic("ai") if kind == "st" else name[:1])
        lanes += f'<div class="fl"><div class="who"><span class="av {kind}">{av}</span>{name}</div><div class="lane" style="--n:{n}">{cells}</div></div>'
    ax = "".join(f'<span>{tm}</span>' for tm, *_ in steps)
    return (f'<div class="flow" style="--n:{n}"><div class="lh">{title}' + (f'<span class="now">{now_label}</span>' if now_label else "") + f'</div>'
            f'<div class="fgs"><div class="fg">{lanes}</div><div class="ax" style="--n:{n}">{ax}</div></div></div>')

def group(title, n, rows, sec=None, right=""):
    """一覧の段。sec を渡すと第2ナビ（anchors）の飛び先になる"""
    a = f' id="sec-{sec}" data-sec="{sec}"' if sec is not None else ""
    return f'<div{a}><div class="grp">{title}<span class="n">{n}</span><span class="sp"></span>{right}</div>{rows}</div>'

def qsum(total, cap, extra=""):
    pct = min(round(total / cap * 100), 100) if cap else 0
    over = total > cap
    return (f'<div class="qsum{" over" if over else ""}"><span>見込み <b class="tot">{total//60}h{total%60:02d}</b> / 使える <b>{cap//60}h{cap%60:02d}</b></span>'
            f'<span class="qcap"><i class="{"over" if over else ""}" style="width:{pct}%"></i></span>{extra}</div>')

def dpane(id_, html, on=False):
    return f'<div class="dpane{" on" if on else ""}" data-d="{id_}"><button class="btn btn-g btn-sm back">{ic("undo")}一覧へ</button>{html}</div>'

def dkv(pairs):
    return '<dl class="dkv">' + "".join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in pairs) + '</dl>'

def dlog(rows, title="この件の動き"):
    return (f'<div class="log"><div class="lh">{title}</div>'
            + "".join(f'<div class="lr"><span class="tm">{a}</span><b>{b}</b></div>' for a, b in rows) + '</div>')

def threepane(queue_html, panes_html, head="", flush=False):
    """head＝一覧の頭（見出し・時間の帯。スクロールしない部分）。queue_html はスクロールする部分"""
    return f'<div class="tp"><div class="que">{head}<div class="qs">{queue_html}</div></div><div class="dtl">{panes_html}</div></div>'

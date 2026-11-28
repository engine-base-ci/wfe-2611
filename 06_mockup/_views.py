import re
# -*- coding: utf-8 -*-
"""見え方の部品（D-068）── データは 1 つ、見え方は複数。
 view_bar : リスト／カンバン／カレンダー／タイムライン の切り替え（押すと状態タブに飛ぶ。URL に残る想定）
 kanban   : 列＝状態 or 工程 or 担当。列は増やさせない（状態 4 つ・工程は台帳定義から）
 week_cal : 週の時間割（今日＝リスト＋時間、仕事＝週）
 gantt    : 施策・目標の期間バー（タスクは 1 日単位なので線が短すぎる → 施策・目標の層だけ）
 keys_bar : キーボードの手引き（j/k・e・t・d）とまとめ操作
"""
from _icons import ic

VIEWS_CSS = """
.vbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.vseg{display:inline-flex;background:var(--sv);border-radius:var(--r-full);padding:3px;gap:2px}
.vseg button{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:var(--r-full);font-size:12.5px;font-weight:600;color:var(--on-sv);min-height:28px;white-space:nowrap;flex:none}
.vseg{max-width:100%;overflow-x:auto;flex:none}
.vseg button svg{width:14px;height:14px}
.vseg button:hover{color:var(--on-surface)}
.vseg button[aria-pressed="true"]{background:var(--card);color:var(--primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.vbar .sp{flex:1}
.vbar .hint{font-size:12px;color:var(--on-sv);display:inline-flex;gap:12px;flex-wrap:wrap}
.vbar .hint kbd{font-family:var(--font-code);font-size:11px;background:var(--sv);padding:1px 6px;border-radius:3px;color:var(--on-surface)}

/* タスクの行（人と AI社員は同じ一覧）── 3 列：選ぶ｜本文（題名・次の一手・メタ 1 行）｜操作。メタはアイコン無し・3 つまで */
.trow{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:14px;align-items:start;padding:12px 6px;border-bottom:1px solid var(--line-soft)}
.trow:last-of-type{border-bottom:0}
.trow:hover{background:var(--surface)}
.trow.sel{background:var(--primary-c)}
.trow>input,.trow>svg{margin-top:3px}
.trow .tt{font-weight:600;font-size:15px;line-height:1.5}
.trow .nx{font-size:13px;color:var(--on-sv);margin-top:2px;display:flex;gap:5px;align-items:center}
.trow .nx svg{width:12px;height:12px;flex:none}
.trow .nx.blank{color:var(--tertiary)}
.trow .meta{display:flex;align-items:center;flex-wrap:wrap;margin-top:5px;font-size:12.5px;color:var(--on-sv);gap:0}
.trow .meta>*+*::before{content:"・";margin:0 6px;color:var(--neutral)}
.trow .gl{min-width:0}
.trow .gl b{color:var(--on-surface);font-weight:600}
.trow .gl.orphan{color:var(--st-danger);font-weight:600}
.trow .gl.orphan a{text-decoration:underline;text-underline-offset:3px}
.trow .who.is-ai{color:var(--tertiary);font-weight:600}
.trow .tm{font-variant-numeric:tabular-nums;white-space:nowrap}
.trow .due.late{color:var(--st-danger);font-weight:600}
.trow .ops{display:flex;gap:4px;opacity:0;transition:opacity var(--dur)}
.trow:hover .ops,.trow:focus-within .ops,.trow.sel .ops{opacity:1}
.trow .ops button{width:30px;height:30px;border-radius:var(--r-md);display:grid;place-items:center;color:var(--on-sv)}
.trow .ops button:hover{background:var(--sv);color:var(--on-surface)}
.trow .ops button svg{width:15px;height:15px}
.trow.done .tt{text-decoration:line-through;color:var(--on-sv);font-weight:500}
.trow.first{background:var(--card);border:1px solid var(--primary-c);border-radius:var(--r-lg);padding:16px 14px;margin:2px 0 10px}
.trow.first .lead{font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--primary);margin-bottom:4px}
.trow.first .tt{font-size:19px;line-height:1.4}
.trow.first .ops{opacity:1}
.lact{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;font-size:12.5px}
.lact .muted{flex-basis:100%}
@media(max-width:767px){.trow .ops{opacity:1}.trow .meta{gap:2px 0}}
.tgrp{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--on-sv);padding:14px 8px 6px;display:flex;gap:8px;align-items:center}
.tgrp .n{font-weight:600;color:var(--on-surface);font-variant-numeric:tabular-nums}
.tsum{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:var(--surface);border-radius:var(--r-md);font-size:12.5px;color:var(--on-sv);margin-bottom:10px}
.tsum b{color:var(--on-surface);font-variant-numeric:tabular-nums}
.tsum .over{color:var(--st-danger);font-weight:700}
.tsum .cap{flex:1;height:6px;background:var(--sv);border-radius:var(--r-full);overflow:hidden;min-width:120px}
.tsum .cap i{display:block;height:100%;background:var(--primary)}
.tsum .cap i.over{background:var(--st-danger)}
.bulk{display:flex;gap:8px;align-items:center;padding:8px 12px;background:var(--primary);color:#fff;border-radius:var(--r-md);font-size:12.5px;margin-bottom:10px;flex-wrap:wrap}
.bulk .btn{background:rgba(255,255,255,.14);color:#fff}
.bulk .btn:hover{background:rgba(255,255,255,.26)}
.blk{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:var(--r-full);background:#FEF6EC;color:#92400E;vertical-align:middle}
.blk svg{width:12px;height:12px}
@media(max-width:767px){.trow .ops{opacity:1}}

/* カンバン */
.kb{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:12px;overflow-x:auto;padding-bottom:6px;align-items:start}
.kb .kcol{background:var(--surface);border-radius:var(--r-lg);padding:10px;min-height:120px}
.kb .kh{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;padding:2px 4px 10px}
.kb .kh .n{margin-left:auto;font-weight:600;color:var(--on-sv);font-variant-numeric:tabular-nums}
.kb .kh .dot{width:8px;height:8px;border-radius:50%}
.kb .kc{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:10px 11px;margin-bottom:8px;font-size:13px;cursor:grab}
.kb .kc:hover{border-color:var(--primary)}
.kb .kc:active{cursor:grabbing;transform:scale(.99)}
.kb .kc .kt{font-weight:600;margin-bottom:4px}
.kb .kc .km{display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--on-sv);flex-wrap:wrap}
.kb .kc .km .tav{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--primary-c);color:var(--on-primary-c)}
.kb .kc .km .tav.is-ai{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.kb .kc .km .tav.is-ai svg{width:11px;height:11px}
.kb .kc .km .amt{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--on-surface);font-weight:600}
.kb .kc.stuck{border-left:3px solid var(--st-danger)}
.kb .kadd{width:100%;text-align:left;padding:8px 10px;border-radius:var(--r-md);font-size:12.5px;color:var(--on-sv);display:flex;gap:6px;align-items:center;min-height:32px}
.kb .kadd:hover{background:var(--card);color:var(--on-surface)}
.kb .kadd svg{width:14px;height:14px}
.kb .kcol.drop{outline:2px dashed var(--primary);outline-offset:-4px}

/* 週カレンダー */
.wc{display:grid;grid-template-columns:52px repeat(var(--days,5),minmax(0,1fr));border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;background:var(--card)}
.wc .wh{padding:8px 6px;font-size:12px;font-weight:700;text-align:center;border-bottom:1px solid var(--line);background:var(--surface)}
.wc .wh.today{color:var(--primary)}
.wc .wh small{display:block;font-weight:500;color:var(--on-sv);font-size:11px}
.wc .wt{font-size:11px;color:var(--on-sv);text-align:right;padding:4px 6px 0 0;border-right:1px solid var(--line-soft);height:44px;font-variant-numeric:tabular-nums}
.wc .wd{position:relative;border-right:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);height:44px}
.wc .wd:last-child{border-right:0}
.wc .ev{position:absolute;left:3px;right:3px;border-radius:var(--r-sm);padding:4px 7px;font-size:11.5px;line-height:1.35;overflow:hidden;background:var(--primary-c);color:var(--on-primary-c);border-left:3px solid var(--primary)}
.wc .ev.mt{background:var(--sv);color:var(--on-surface);border-left-color:var(--neutral)}
.wc .ev.is-ai{background:var(--tertiary-c);color:var(--on-tertiary-c);border-left-color:var(--tertiary)}
.wc .ev.free{background:transparent;border:1px dashed var(--line);color:var(--on-sv);text-align:center}
.wc .ev b{display:block;font-weight:600}
.wc .now{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--st-danger)}
.wcs{overflow-x:auto}
@media(max-width:767px){.wc{min-width:640px}}

/* タイムライン（ガント） */
.gt{border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;background:var(--card)}
.gt .gr{display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid var(--line-soft)}
.gt .gr:last-child{border-bottom:0}
.gt .gh{background:var(--surface);font-size:11px;font-weight:700;color:var(--on-sv)}
.gt .gl{padding:10px 12px;font-size:12.5px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.gt .gl b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gt .gl small{color:var(--on-sv);font-size:11.5px}
.gt .gl.sub{padding-left:28px}
.gt .gb{position:relative;min-height:44px;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100%/var(--cols) - 1px),var(--line-soft) calc(100%/var(--cols) - 1px),var(--line-soft) calc(100%/var(--cols)))}
.gt .gh .gb{display:grid;grid-template-columns:repeat(var(--cols),1fr);text-align:center;padding:8px 0;min-height:0;background:none}
.gt .bar{position:absolute;top:11px;height:22px;border-radius:var(--r-sm);background:var(--primary-c);border-left:3px solid var(--primary);font-size:11px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--on-primary-c)}
.gt .bar i{position:absolute;left:0;top:0;bottom:0;background:var(--primary);opacity:.18}
.gt .bar.ms{background:var(--secondary-c);border-left-color:var(--secondary);color:var(--on-secondary-c)}
.gt .bar.ms i{background:var(--secondary)}
.gt .bar.chk{background:var(--sv);border-left-color:var(--neutral);color:var(--on-sv)}
.gt .dia{position:absolute;top:15px;width:14px;height:14px;transform:rotate(45deg);background:var(--tertiary);border-radius:2px}
.gt .today{position:absolute;top:0;bottom:0;width:0;border-left:2px solid var(--st-danger)}
.gt .gr:nth-child(2) .today::after{content:"今日";position:absolute;top:-2px;left:4px;font-size:11px;color:var(--st-danger);font-weight:700;white-space:nowrap}
.gt .dep{position:absolute;top:22px;height:0;border-top:1px dashed var(--on-sv)}
@media(max-width:767px){.gt .gr{grid-template-columns:130px 1fr}}
@media(max-width:767px){.vbar .hint{display:none}.vseg button{padding:5px 9px}}
"""

_VIEW_ICONS = {"リスト":"list","カンバン":"layers","カレンダー":"today","ガント":"route","タイムライン":"route","木":"org"}

def view_bar(views, cur, states, hint=True, extra=""):
    """views: 表示名の並び / cur: 今の表示名 / states: 表示名→状態タブID。押すと状態タブへ（実装では URL の ?view=）"""
    seg = "".join(f'<button aria-pressed="{str(v==cur).lower()}" data-view="{states.get(v,"")}" title="{v}">{ic(_VIEW_ICONS.get(v,"list"))}{v}</button>' for v in views)
    h = ('<span class="hint"><span><kbd>j</kbd><kbd>k</kbd> 移動</span><span><kbd>e</kbd> 終わり</span><span><kbd>t</kbd> 今日へ</span>'
         '<span><kbd>d</kbd> 引き継いでもらう</span><span><kbd>space</kbd> 選ぶ</span></span>') if hint else ""
    return f'<div class="vbar"><div class="vseg">{seg}</div>{extra}<div class="sp"></div>{h}</div>'

VIEW_JS = ("<script>document.addEventListener('click',e=>{const b=e.target.closest('.vseg button[data-view]');if(!b||!b.dataset.view)return;"
           "const t=document.querySelector('.states button[data-t=\"'+b.dataset.view+'\"]');if(t)t.click();});</script>")

def av(who):
    """担当チップ。AI社員は紫、人は紺"""
    if who.startswith("AI"):
        return f'<span class="who"><span class="tav is-ai">{ic("ai")}</span>{who}</span>'
    return f'<span class="who"><span class="tav">{who[0]}</span>{who}</span>'

def trow(title, next_, goal, who, est, due, ops=None, orphan=False, state="", note="", sel=False, done=False, contrib="", first=False):
    """1 行＝1 タスク。goal=("目標名","寄与") / est=("見込み","実") / due=("表示", late?) / ops=[(icon,title)]"""
    nx = (f'<div class="nx">{ic("right")}{next_}</div>' if next_ else f'<div class="nx blank">{ic("clone")}次の一手が空。高本AIが下書きします</div>')
    if orphan:
        gl = f'<span class="gl orphan">行き先がない <a href="#">目標を選ぶ</a></span>'
    else:
        gl = f'<span class="gl"><b>{goal[0]}</b>' + (f' → {goal[1]}' if len(goal) > 1 and goal[1] else "") + '</span>'
    st = f' <span class="blk">{state}</span>' if state else ""
    who_s = f'<span class="who{" is-ai" if who.startswith("AI") else ""}">{who}</span>'
    tm = f'<span class="tm">{est[0]}' + (f'（実 {est[1]}）' if len(est) > 1 and est[1] else "") + (f' · <span class="due{" late" if len(due) > 1 and due[1] else ""}">{due[0]}</span>' if due and due[0] else "") + '</span>'
    o = "".join(f'<button title="{t}" aria-label="{t}">{ic(i)}</button>' for i, t in (ops or [("check","終わりにする"),("send","引き継いでもらう"),("clock","明日へ"),("more","その他")]))
    cb = ic("check") if done else f'<input type="checkbox" aria-label="選ぶ" style="width:18px;height:18px;accent-color:#22345C"{" checked" if sel else ""}>'
    lead = '<div class="lead">まずこれ</div>' if first else ""
    return (f'<div class="trow{" sel" if sel else ""}{" done" if done else ""}{" first" if first else ""}">{cb}<div>{lead}<div class="tt">{title}{st}</div>{nx}{note}'
            f'<div class="meta">{gl}{who_s}{tm}</div></div><div class="ops">{o}</div></div>')

def tgrp(label, n=""):
    return f'<div class="tgrp">{label}<span class="n">{n}</span></div>'

def tsum(total, cap, extra=""):
    pct = min(round(total / cap * 100), 100) if cap else 0
    over = total > cap
    return (f'<div class="tsum"><span>見込み <b>{total//60}h{total%60:02d}</b></span><span>使える時間 <b>{cap//60}h{cap%60:02d}</b></span>'
            f'<span class="cap"><i class="{"over" if over else ""}" style="width:{pct}%"></i></span>'
            + (f'<span class="over">{(total-cap)//60}h{(total-cap)%60:02d} 超えています</span>' if over else f'<span>残り <b>{(cap-total)//60}h{(cap-total)%60:02d}</b></span>') + extra + '</div>')

def bulk(n, buttons):
    return f'<div class="bulk">{ic("check")}<b>{n}件</b> 選択中{buttons}</div>'

def kanban(cols, add=True):
    """cols=[(title, color, [(title, who, meta, amount, stuck)])]"""
    out = []
    for title, color, cards in cols:
        cs = "".join(
            f'<div class="kc{" stuck" if stuck else ""}" draggable="true"><div class="kt">{t}</div><div class="km">'
            + (f'<span class="tav is-ai">{ic("ai")}</span>' if who.startswith("AI") else f'<span class="tav">{who[0]}</span>') + f'{who}'
            + (f'<span>· {meta}</span>' if meta else "") + (f'<span class="amt">{amt}</span>' if amt else "") + '</div></div>'
            for t, who, meta, amt, stuck in cards)
        a = f'<button class="kadd">{ic("plus")}足す</button>' if add else ""
        out.append(f'<div class="kcol"><div class="kh"><span class="dot" style="background:{color}"></span>{title}<span class="n">{len(cards)}</span></div>{cs}{a}</div>')
    return f'<div class="kb">{"".join(out)}</div>'

def week_cal(days, hours, events, today_idx=1, now=None):
    """days=[("月","9/8"),…] / hours=[9,10,…] / events=[(day_idx, start_h, dur_h, title, sub, kind)]"""
    n = len(days); h0 = hours[0]
    head = '<div class="wh"></div>' + "".join(f'<div class="wh{" today" if i==today_idx else ""}">{d}<small>{dt}</small></div>' for i,(d,dt) in enumerate(days))
    rows = ""
    for h in hours:
        rows += f'<div class="wt">{h}:00</div>' + "".join('<div class="wd"></div>' for _ in days)
    evs = "".join(
        f'<div class="ev {kind}" style="grid-column:{di+2};top:{(sh-h0)*44+2}px;height:{dur*44-4}px;position:absolute"><b>{t}</b>{s}</div>'
        for di, sh, dur, t, s, kind in events)
    # イベントは各日の列に絶対配置するため、列ごとの箱に入れる
    events = [(d2, sh, dur, t, s_, ("is-ai" if kind == "ai" else kind)) for d2, sh, dur, t, s_, kind in events]
    cols = ""
    for di in range(n):
        inner = "".join(f'<div class="ev {kind}" style="top:{(sh-h0)*44+2}px;height:{dur*44-4}px"><b>{t}</b>{s}</div>'
                        for d2, sh, dur, t, s, kind in events if d2 == di)
        nowl = f'<div class="now" style="top:{(now-h0)*44}px"></div>' if (now is not None and di == today_idx) else ""
        cols += f'<div style="position:relative;grid-column:{di+2};grid-row:2 / span {len(hours)}">{inner}{nowl}</div>'
    return (f'<div class="wcs"><div class="wc" style="--days:{n}">{head}{rows}{cols}</div></div>')

def gantt(cols, rows, today_col=None):
    """cols=["9月","10月",…] / rows=[(label, sub, start, span, kind, text, indent)] start/span は列単位（小数可）"""
    n = len(cols)
    head = '<div class="gr gh"><div class="gl"></div><div class="gb" style="--cols:' + str(n) + '">' + "".join(f'<span>{c}</span>' for c in cols) + '</div></div>'
    body = ""
    for label, sub, start, span, kind, text, indent in rows:
        left = start / n * 100; width = span / n * 100
        if kind == "dia":
            bar = f'<div class="dia" style="left:calc({left}% - 7px)" title="{text}"></div>'
        else:
            prog = f'<i style="width:{text[1]}%"></i>' if isinstance(text, tuple) else ""
            label2 = text[0] if isinstance(text, tuple) else text
            bar = f'<div class="bar {kind}" style="left:{left}%;width:{width}%">{prog}{label2}</div>'
        tl = f'<div class="today" style="left:{today_col/n*100}%"></div>' if today_col is not None else ""
        body += f'<div class="gr"><div class="gl{" sub" if indent else ""}"><b>{label}</b><small>{sub}</small></div><div class="gb" style="--cols:{n}">{tl}{bar}</div></div>'
    return f'<div class="gt">{head}{body}</div>'

TL_CSS = """
.tlw{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
.tlw .gt .gr:not(.gh){cursor:pointer}.tlw .gt .gr:not(.gh):hover{background:var(--surface)}.tlw .gt .gr.on{background:var(--primary-c)}
.tlw .gt .gr:not(.gh):focus-visible{outline:2px solid var(--primary);outline-offset:-2px}
.tld{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:14px 16px;position:sticky;top:12px}
.tld h3{font-size:15px;font-weight:700;margin:0 0 4px}.tld .k{font-size:12px;color:var(--on-sv)}
.tld dl{display:grid;grid-template-columns:96px 1fr;gap:6px 10px;font-size:13px;margin:12px 0}.tld dt{color:var(--on-sv)}.tld dd{margin:0}
.tld .bar{height:8px;border-radius:4px;background:var(--surface);overflow:hidden;margin:4px 0 8px}.tld .bar i{display:block;height:100%;background:var(--primary)}
.tlw .tl-back{display:none}
@media(max-width:1023px){.tlw{grid-template-columns:1fr}.tlw[data-open] .gt{display:none}.tlw:not([data-open]) .tld{display:none}.tlw .tl-back{display:inline-flex;margin-bottom:10px}}
"""
TL_JS = """<script>if(!window.__tlJs){window.__tlJs=1;document.addEventListener('click',e=>{const r=e.target.closest('.tlw .gt .gr:not(.gh)');const b=e.target.closest('.tlw .tl-back');
 if(b){b.closest('.tlw').removeAttribute('data-open');return;} if(!r)return;const w=r.closest('.tlw');w.querySelectorAll('.gr.on').forEach(x=>x.classList.remove('on'));r.classList.add('on');
 w.querySelectorAll('.tld[data-for]').forEach(d=>d.hidden=d.dataset.for!==r.dataset.tl);w.setAttribute('data-open','1');});}</script>"""

def timeline(cols, rows, details, today_col=None, first=None):
    """gantt に詳細パネルを付ける（D-079）。rows は gantt と同じ。details={id: html}。行 i の id は rows の順（0..）。first=最初に開く id"""
    g = gantt(cols, rows, today_col=today_col); i = [-1]
    def tag(m):
        i[0] += 1; return f'<div class="gr" data-tl="{i[0]}" tabindex="0"' + (' ' if m.group(1) else '') + m.group(1)
    g = re.sub(r'<div class="gr"( ?)', tag, g)
    first = 0 if first is None else first
    g = g.replace(f'data-tl="{first}"', f'data-tl="{first}" class="on"', 1).replace('<div class="gr" data-tl="%d" class="on"' % first, '<div class="gr on" data-tl="%d"' % first, 1)
    panes = "".join(f'<div class="tld" data-for="{k}"{"" if k == first else " hidden"}><button class="btn btn-g btn-sm tl-back" type="button">← 一覧へ</button>{v}</div>' for k, v in details.items())
    return f'<div class="tlw">{g}{panes}</div>' + TL_JS

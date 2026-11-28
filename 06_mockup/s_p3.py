# -*- coding: utf-8 -*-
"""P3 毎週：goals / goal-allocation / goal-edit / my-progress
 目標はログインしている個人まで落ちる。層は可変。層ごとに見せる範囲を切る。"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _views import VIEWS_CSS, gantt, view_bar, timeline, TL_CSS
from _org import ORG_CSS, lock_chip

LAYER_C = {"会社":"var(--d-indigo)","事業":"var(--d-plum)","部署":"var(--d-teal)","個人":"var(--d-amber)","AI社員":"var(--tertiary)"}

_DETS = []; _GN = [0]
def _gid(): _GN[0] += 1; return f"g{_GN[0]}"
def node(layer, owner, goals, depth=0, me=False, vis="", roll="", children="", note="", unit="", editable=True):
    """goals = [(name, target, actual, unit, alloc|None)] → 木の表の行（1 目標 = 1 行）。gtree() で包む。行を押すと 1 件の中身（_DETS）"""
    out = ""
    for i, (name, tg, ac, un, alloc) in enumerate(goals):
        gid = _gid(); pct = round(ac / tg * 100) if tg else 0
        unal = alloc is not None and alloc < tg
        cls = "ok" if pct >= 90 else ("warn" if pct >= 60 else "bad")
        chev = (f'<button class="chev" aria-label="畳む・開く">{ic("right")}</button>' if (i == 0 and children) else '<span class="chev sp0"></span>')
        who = ((f'<span class="lt" style="background:{LAYER_C[layer]}">{layer}</span><b>{owner}</b>'
                + (f'<span class="me">あなた</span>' if me else "")
                + (f'<div class="rl">{roll}</div>' if roll else "")) if i == 0 else "")
        out += (f'<div class="gtr{" isme" if me else ""}{" sub" if i else ""}" style="--d:{depth}" data-depth="{depth}" data-layer="{layer}" data-unit="{unit}" data-g="{gid}" aria-expanded="true">'
                f'<div class="c who">{chev if i == 0 else "<span class=\"chev sp0\"></span>"}<div>{who}</div></div>'
                f'<div class="c gn">{name}' + (f'<span class="un">未配分 {tg-alloc:,}{un}</span>' if unal else "") + '</div>'
                f'<div class="c num tg">{tg:,}<i>{un}</i></div><div class="c num ac">{ac:,}<i>{un}</i></div>'
                f'<div class="c bar"><span class="bar"><i class="{cls}" style="width:{min(pct,100)}%"></i></span></div>'
                f'<div class="c pct"><span class="mob">{ac:,}／{tg:,}{un}</span>{pct}%</div>'
                f'<div class="c vis">' + (f'{ic("eye")}{vis}' if (vis and i == 0) else "") + '</div></div>')
        h = (len(name) * 7 + len(owner) * 3) % 5
        links = f'施策 {h % 3 + (1 if layer in ("会社","部署") else 0)} · タスク {h * 2 + 3} · AI社員 {1 if layer in ("個人","部署") else 0}'
        acts = ('<div class="acts">' + btn("直す","p","pen","v1-goal-edit.html") + btn("配る","o","layers","v1-goal-allocation.html") + btn("自分のAIに聞く","g","chat","v1-clone-chat.html") + '</div>' if editable else
                '<div class="acts">' + lock_chip("見るだけ（配った人が直す）") + btn("自分のAIに聞く","g","chat","v1-clone-chat.html") + '</div>')
        _DETS.append(f'<div class="gd" data-g="{gid}"><div class="kind" style="color:{LAYER_C[layer]}">{layer} · {owner}</div><h3>{name}</h3>'
                     f'<div class="big"><b>{ac:,}</b><i>{un}</i><span class="of">／ {tg:,}{un}</span><span class="pc {cls}">{pct}%</span></div><span class="bar" style="display:block;margin:6px 0 12px"><i class="{cls}" style="width:{min(pct,100)}%"></i></span>'
                     + '<dl class="dkv">' + "".join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in [("残り", f"{max(tg-ac,0):,}{un}"), ("積み上げ方", roll or "そのまま足す"), ("見せる相手", vis or "本人と上の層"), ("未配分", f'<b style="color:var(--st-danger)">{tg-alloc:,}{un}</b>' if unal else "なし"), ("紐づくもの", links)]) + '</dl>'
                     + (f'<div class="muted" style="font-size:12px">{note}</div>' if note else "") + acts + '</div>')
    return out + children

def gfilter(layers, units):
    b = lambda k, v, lbl, on=False: f'<button data-{k}="{v}" aria-pressed="{str(on).lower()}">{lbl}</button>'
    return ('<div class="gfil"><span>層</span>' + b("fl","","全部",True) + "".join(b("fl",l,l) for l in layers)
            + ('<span class="sep"></span><span>絞る</span>' + b("fu","","全員",True) + "".join(b("fu",u,u) for u in units) if units else "") + '</div>')

def gtree(rows, filters=""):
    dets = "".join(_DETS); _DETS.clear()
    dets = dets.replace('class="gd"', 'class="gd on"', 1)
    return (filters + '<div class="gwrap"><div class="gtree"><div class="gth"><div class="c who">誰の</div><div class="c gn">目標</div><div class="c num tg">降ろした</div>'
            '<div class="c num ac">積み上がった</div><div class="c bar">進み</div><div class="c pct"></div><div class="c vis">見せる相手</div></div>' + rows + '</div>'
            f'<aside class="gdet">{dets}</aside></div>')

GOALS_JS = """<script>(function(){
 if(window.__goalsJs) return; window.__goalsJs=1;   // 状態ごとに同じ script が入るので 1 回だけ（2 回入ると畳む→開くで打ち消す）
 document.addEventListener('click',e=>{
  const ch=e.target.closest('.gtr .chev:not(.sp0)');
  if(ch){ e.stopPropagation(); const r=ch.closest('.gtr'); const d=+r.dataset.depth; const open=r.getAttribute('aria-expanded')!=='true'; r.setAttribute('aria-expanded',String(open));
    let s=r.nextElementSibling; while(s&&s.classList.contains('gtr')&&+s.dataset.depth>d){ s.classList.toggle('col',!open); if(open) s.setAttribute('aria-expanded','true'); s=s.nextElementSibling; } return; }
  const fb=e.target.closest('.gfil button'); if(fb){ const bar=fb.closest('.gfil'); const k=('fl' in fb.dataset)?'fl':'fu'; bar.querySelectorAll('button[data-'+k+']').forEach(x=>x.setAttribute('aria-pressed',String(x===fb)));
    const wrap=bar.nextElementSibling; const fl=bar.querySelector('button[data-fl][aria-pressed=true]').dataset.fl; const fuB=bar.querySelector('button[data-fu][aria-pressed=true]'); const fu=fuB?fuB.dataset.fu:'';
    wrap.classList.toggle('flat',!!fl); wrap.querySelectorAll('.gtr').forEach(r=>{ const ok=(!fl||r.dataset.layer===fl)&&(!fu||r.dataset.unit===fu); r.classList.toggle('fo',!ok); }); return; }
  const r=e.target.closest('.gtr[data-g]'); if(r){ const w=r.closest('.gwrap'); w.querySelectorAll('.gtr').forEach(x=>x.classList.toggle('sel',x===r)); w.querySelectorAll('.gd').forEach(x=>x.classList.toggle('on',x.dataset.g===r.dataset.g)); }
 });
})();</script>"""

GCSS = """
.gfil{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px;font-size:12.5px}
.gfil span{color:var(--on-sv);margin-right:2px}.gfil .sep{width:1px;height:16px;background:var(--line);margin:0 4px}
.gfil button{padding:4px 11px;border-radius:var(--r-full);border:1px solid var(--line);background:var(--card);font-size:12.5px;min-height:26px}
.gfil button:hover{border-color:var(--primary)}.gfil button[aria-pressed=true]{background:var(--primary);color:#fff;border-color:transparent}
.gwrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
.gtree{border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;background:var(--card);min-width:0}
.gth,.gtr{display:grid;grid-template-columns:minmax(230px,1.4fr) minmax(130px,1fr) 100px 110px minmax(110px,.9fr) 118px minmax(110px,auto);align-items:center;column-gap:12px;padding:0 14px}
.gth{min-height:34px;font-size:11.5px;font-weight:600;color:var(--on-sv);background:var(--surface);border-bottom:1px solid var(--line)}
.gth .num,.gth .pct{text-align:right}
.gtr{min-height:46px;padding-top:6px;padding-bottom:6px;border-top:1px solid var(--line-soft);font-size:13px;cursor:pointer}
.gtr:hover{background:var(--surface)}
.gtr.sub{min-height:34px;border-top:0;padding-top:0;color:var(--on-sv)}
.gtr.isme{box-shadow:inset 3px 0 0 var(--primary);background:var(--surface)}
.gtr.sel{background:var(--primary-c)}.gtr.sel .gn,.gtr.sel .num,.gtr.sel .pct{color:var(--on-primary-c)}
.gtr.col,.gtr.fo{display:none}
.gtr .who{min-width:0;padding-left:calc(var(--d)*22px);position:relative;align-self:stretch;display:flex;align-items:center;gap:4px}
.gtr .who::before{content:"";position:absolute;left:0;top:-7px;bottom:-7px;width:calc(var(--d)*22px);background:repeating-linear-gradient(90deg,transparent 0 9px,var(--line) 9px 10px,transparent 10px 22px)}
.gwrap.flat .gtr .who{padding-left:0}.gwrap.flat .gtr .who::before{display:none}
.gtr .chev{width:22px;height:22px;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;color:var(--on-sv);background:transparent}
.gtr .chev:hover{background:var(--sv)}.gtr .chev svg{width:14px;height:14px;transition:transform .12s}
.gtr[aria-expanded=true] .chev svg{transform:rotate(90deg)}.gtr .chev.sp0{visibility:hidden}
.gtr .who>div{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;min-width:0}
.gtr .who b{font-size:13.5px;color:var(--on-surface)}
.gtr .lt{color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:var(--r-full);white-space:nowrap}
.gtr .me{background:var(--primary);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:var(--r-full)}
.gtr .rl{font-size:11.5px;color:var(--on-tertiary-c);background:var(--tertiary-c);padding:1px 8px;border-radius:var(--r-full)}
.gtr .gn{font-weight:600;color:var(--on-surface);min-width:0}
.gtr.sub .gn{font-weight:500}
.gtr .gn .un{display:block;color:var(--st-danger);font-weight:700;font-size:12px}
.gtr .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.gtr .num i{font-style:normal;color:var(--on-sv);margin-left:2px;font-size:11.5px}
.gtr .bar .bar{display:block;margin:0}
.gtr .pct{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.gtr .pct .mob{display:none}
.gtr .vis{font-size:11.5px;color:var(--on-sv);display:inline-flex;gap:5px;align-items:center;white-space:nowrap}.gtr .vis svg{width:13px;height:13px}
.gdet{position:sticky;top:12px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:16px 18px;min-height:120px}
.gd{display:none}.gd.on{display:block}
.gd .kind{font-size:11.5px;font-weight:600;margin-bottom:4px}.gd h3{font-size:17px;font-weight:700;margin-bottom:10px;line-height:1.35}
.gd .big{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap}.gd .big b{font-size:26px;font-variant-numeric:tabular-nums}.gd .big i{font-style:normal;color:var(--on-sv)}
.gd .big .of{color:var(--on-sv);font-size:13px;margin-left:4px}.gd .big .pc{margin-left:auto;font-weight:700;font-size:15px}.gd .big .pc.bad{color:var(--st-danger)}.gd .big .pc.warn{color:var(--st-warning)}.gd .big .pc.ok{color:var(--st-success)}
.gd .dkv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12.5px;margin:0}.gd .dkv dt{color:var(--on-sv);white-space:nowrap}.gd .dkv dd{margin:0}
.gd .acts .btn{font-size:12.5px}
@media(max-width:1179px){.gwrap{grid-template-columns:1fr}.gdet{position:static}
 .gth,.gtr{grid-template-columns:minmax(200px,1.4fr) minmax(120px,1fr) 100px minmax(90px,.8fr) 112px}.gth .tg,.gtr .tg,.gth .vis,.gtr .vis{display:none}}
@media(max-width:1023px){.gth,.gtr{grid-template-columns:minmax(150px,1.3fr) minmax(90px,1fr) 84px minmax(70px,.8fr) 60px;column-gap:8px}}
@media(max-width:767px){.gth{display:none}.gtr{grid-template-columns:minmax(0,1fr) auto;row-gap:4px}.gtr .pct{white-space:normal}.gtr .who{grid-column:1/-1}.gtr .who::before{display:none}.gtr .who{padding-left:calc(var(--d)*10px)}
 .gtr .gn{grid-column:1/-1}.gtr .ac{display:none}.gtr .pct .mob{display:block;font-weight:500;color:var(--on-sv);font-size:11.5px}}
.casc{display:flex;flex-direction:column}
.cs{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-size:13px;position:relative}
.cs+.cs{margin-top:10px}.cs+.cs::before{content:"";position:absolute;left:38px;top:-11px;height:10px;width:1px;background:var(--line)}
.cs .lt{font-size:11px;font-weight:700;color:#fff;background:var(--lc);padding:2px 8px;border-radius:var(--r-full);justify-self:start;white-space:nowrap}
.cs .ch{display:flex;flex-wrap:wrap;gap:4px 16px;min-width:0}.cs .ch span{white-space:normal}.cs .ch b{color:var(--on-surface)}
.cs .ch .to{color:var(--st-progress);font-weight:700;display:inline-flex;align-items:center;gap:3px;margin-left:3px}.cs .ch .to svg{width:12px;height:12px}
.cs .wh{font-size:11.5px;color:var(--on-sv);text-align:right;max-width:170px}
.cs.top{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-c)}
@media(max-width:1179px){.cs{grid-template-columns:76px minmax(0,1fr)}.cs .wh{grid-column:2;text-align:left;max-width:none}}@media(max-width:767px){.cs{grid-template-columns:1fr}.cs .wh{grid-column:1}.cs+.cs::before{left:20px}}
"""

def tree_full(me="高本", editable=True):
    ed = editable
    return gtree(node("会社","ENGINE BASE",[("受注",10,4,"件",10),("売上",12_000_000,8_330_000,"円",12_000_000),("納期遵守",95,97,"%",None)],vis="経営層だけ",editable=ed,
      children=node("事業","受託開発",[("受注",10,4,"件",10)],1,vis="事業の長まで",editable=ed,
        children=node("部署","営業",[("受注",10,4,"件",10)],2,vis="部署の全員",roll="変換して足す（×平均単価120万→売上）",unit="営業",editable=ed,
          children=node("個人","高本",[("受注",7,3,"件",7)],3,me=(me=="高本"),vis="本人と部門長",unit="営業",editable=ed,
                        children=node("AI社員","AI営業社員（高本の）",[("新規リード／月",60,41,"件",None)],4,roll="足さない（成約率2.6%の仮説で繋ぐ）",unit="営業",editable=ed))
                 + node("個人","田中",[("受注",3,1,"件",3)],3,me=(me=="田中"),vis="本人と部門長",unit="営業",editable=ed))
        + node("部署","制作",[("納期遵守",95,97,"%",None)],2,vis="部署の全員",roll="足さない（仮説で繋ぐ）",unit="制作",editable=ed,
          children=node("個人","佐藤",[("納期遵守",100,100,"%",None)],3,me=(me=="佐藤"),vis="本人と部門長",unit="制作",editable=ed))
        + node("部署","CS",[("一次返信（時間以内）",24,9,"h",None)],2,vis="部署の全員",roll="足さない",unit="CS",editable=ed))),
      filters=gfilter(["会社","事業","部署","個人","AI社員"], ["営業","制作","CS"]))

_layers_note = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + "".join(f'<span class="pill" style="background:{c}">{k}</span>' for k,c in LAYER_C.items()) + '<span class="muted" style="font-size:12px;align-self:center">層の数と名前は会社ごと。この会社は 会社 › 事業 › 部署 › 個人 › AI社員 の5層</span></div>'
_tree_r1 = gtree(node("会社","ENGINE BASE（高本）",[("受注",10,4,"件",None),("売上",12_000_000,8_330_000,"円",None)],0,me=True,vis="あなただけ",
    children=node("AI社員","AI営業社員",[("新規リード／月",60,41,"件",None)],1,roll="足さない（仮説で繋ぐ）",unit="営業")), filters=gfilter(["会社","AI社員"], []))
_tree_r3 = gtree(node("部署","制作",[("納期遵守",95,97,"%",None)],0,vis="部署の全員",unit="制作",editable=True)
    + node("個人","佐藤",[("納期遵守",100,100,"%",None)],1,me=True,vis="本人と部門長",unit="制作",editable=True,
           note="上の会社・事業の目標は「見せない」設定なので出ません。自主目標はここで自由に足せます。"), filters=gfilter(["部署","個人"], []))
_gs_main = ('<div data-roles="R2">' + card(head("会社から自分まで", btn("配分を見直す","o","layers","v1-goal-allocation.html") + btn("＋層を足す","g","plus","v1-members.html") + btn("改訂する","g","pen","v1-goal-edit.html"), "今期 2026 Q3 · 9/10 時点") +
    _layers_note + tree_full() + '<div class="muted" style="font-size:12px;margin-top:6px">▸ で段を畳めます。層や担当で絞れます。行を押すと右に 1 件の中身。単位は目標ごとに違い、親子で単位が変わるところは「変換して足す」か「足さない（仮説で繋ぐ）」で繋いでいます。</div>') + '</div>' +
   '<div data-roles="R1">' + card(head("会社＝あなた", btn("自分のAI社員に配る","o","layers","v1-goal-allocation.html") + btn("改訂する","g","pen","v1-goal-edit.html"), "今期 2026 Q3 · 9/10 時点 · 層は 1 段（会社の層も部署も無い）") +
    _tree_r1 + '<div class="muted" style="font-size:12px;margin-top:6px">人を招いて層を足せば、同じ表が伸びます。</div>') + '</div>' +
   '<div data-roles="R3">' + card(head("あなたの層", btn("自主目標を足す","o","plus","v1-my-progress.html"), "制作 › 佐藤 · 会社の数字は見えません") + _tree_r3) + '</div>')
_gs = ('<div data-sec="0">' + _gs_main + '</div>' +
  '<div data-roles="R1 R2">' +
  '<div data-sec="1" hidden>' + card(head("降ろした数", sub="上から配った目標") + table(["層","誰に","目標",("降ろした","r"),"単位"], [
     ["会社","ENGINE BASE","受注",("10","n"),"件"],["事業","受託開発","受注",("10","n"),"件"],["部署","営業","受注",("10","n"),"件"],
     ["個人","高本（あなた）","受注",("7","n"),"件"],["個人","田中","受注",("3","n"),"件"],["AI社員","AI営業社員","新規リード／月",("60","n"),"件"],
     ["部署","制作","納期遵守",("95","n"),"%"],["部署","CS","一次返信",("24","n"),"時間以内"]])) + '</div>' +
  '<div data-sec="2" hidden>' + card(head("積み上がった数", sub="下から上がってきた実績") + table(["層","誰の","目標",("実績","r"),("達成","r")], [
     ["AI社員","AI営業社員","新規リード／月",("41 件","n"),("68%","n")],["個人","高本（あなた）","受注",("3 件","n"),("43%","n")],["個人","田中","受注",("1 件","n"),("33%","n")],
     ["部署","営業","受注",("4 件","n"),("40%","n")],["会社","ENGINE BASE","売上",("8,330,000 円","n"),("69%","n")],["会社","ENGINE BASE","納期遵守",("97 %","n"),("102%","n")]])) + '</div>' +
  '<div data-sec="3" hidden>' + card(head("未配分", sub="配り切れていないところ") + empty("check","未配分はありません","親の目標は子に配り切られています。単位が違う親子は「変換」か「仮説」で繋がっています。", btn("配分を見る","o","layers","v1-goal-allocation.html"))) +
    card(head("行き先のないタスク", btn("タスクで整理","o","check","v1-tasks.html"), "どの目標にも紐づいていないもの") + table(["やること","なぜ","担当"], [["◇◇様 前回提案の再打診","目標「Q2 新規開拓」が終了","高本"],["名刺のデータ化（8月分）","足したときに目標を決めなかった","AI事務社員"],["SOICO 提案書のたたき台","足したときに目標を決めなかった","AI営業社員"]]) +
    note("<b>3件</b>。未配分と同じで、消えるまで赤で残します。", "danger")) + '</div>' +
  '<div data-sec="4" hidden>' + card(head("かけたもの と 出たもの", btn("経費を紐づける","g","tag"), "営業 › 受注 10件 · 今期") +
    grid([card(metric("かけたもの（実コスト）","384,000","予算 600,000 に対して 64% · 交通 128,000 ／ 宿泊 96,000 ／ 広告 110,000 ／ 外注 50,000", 64)),
          card(metric("時間","62<span style=\"font-size:19px;font-weight:500;color:var(--on-sv)\"> 時間</span>","高本 41 ／ 田中 21 · 訪問 9件・提案 6件・面談 4件", None)),
          card(metric("出たもの","4<span style=\"font-size:19px;font-weight:500;color:var(--on-sv)\"> 件</span>","受注 · 1件あたり 96,000円 · 目標 10件なら 予算内で届く計算", 40, "warn"))], "g3") +
    '<div style="height:14px"></div>' +
    table(["施策",("予算","r"),("実コスト","r"),("時間","r"),("出たもの","r"),"費用対効果"], [
      ["紹介元への近況メール（CS社員）",("0","n"),("0","n"),("2 h","n"),("紹介 2件","n"),pill("効いている","su")],
      ["発注ナビ 30件アプローチ",("120,000","n"),("110,000","n"),("18 h","n"),("受注 1件","n"),pill("検証中","wa")],
      ["東京 訪問 2回（交通・宿泊）",("200,000","n"),("224,000","n"),("22 h","n"),("受注 1件","n"),pill("効いている","su")],
      ["△△社 提案書の外注",("50,000","n"),("50,000","n"),("—","n"),("提案 1件","n"),pill("検証中","wa")],
    ]) + note("経費台帳のレコードとタスクの実績時間を、目標／施策に紐づけて集めています。紐づけの候補は高本AIが出します（「セイコー案件の出張ですね」）。予算の置き方・見る指標は目標スキル側で決めます。", "info")) + '</div>' +
  clone_box("高本AI","このままの進みだと受注は <b>8件</b> で着地します（残り3週・提案中2件の確度から）。あなたの7件は残り4件。田中さんの3件は残り2件で、田中さんの手が空きそうなので <b>あなたの提案中の1件を田中さんに引き継いでもらう</b> 案があります。", btn("仮説を見る","o","flask","v1-hypotheses.html")+btn("田中さんに聞く","g","users"))) + '</div>'

_gs_un = ('<div data-sec="0 3">' + card(head("会社から自分まで", sub="未配分があります") +
    gtree(node("会社","ENGINE BASE",[("受注",10,4,"件",8),("売上",12_000_000,8_330_000,"円",9_600_000)],vis="経営層だけ",
      children=node("部署","営業",[("受注",8,4,"件",8)],1,vis="部署の全員",children=node("個人","高本",[("受注",7,3,"件",7)],2,me=True)+node("個人","田中",[("受注",1,1,"件",1)],2)))) +
    note("<b>受注 2件・売上 2,400,000円 が誰にも配られていません。</b> 目標管理の「未配分」は設計の「未反映」と同じで、赤で出して消えるまで残します。", "danger") +
    btn("配分する","p","layers","v1-goal-allocation.html")) + '</div>' +
  clone_box("高本AI","受注2件は田中さんに（今の1件 → 3件）、売上2,400,000は既存客の追加受注として CS に降ろすのが自然です。配りますか？", btn("そうする","p","check")+btn("別の考え","g")))

_gs_r3 = ('<div data-sec="0 1 2 3">' + note("佐藤さん（担当者）の見え方。<b>会社の目標は見えません</b>。部署に落とした目標と、自分の分だけです。上をどこまで見せるかは配分側で決めます。", "info") +
  card(head("あなたの層") + gtree(node("部署","制作",[("納期遵守",95,97,"%",None)],0,vis="部署の全員") + node("個人","佐藤",[("納期遵守",100,100,"%",None)],1,me=True)) +
    '<div class="muted" style="font-size:12px;margin-top:6px">会社・事業の目標は「見せない」設定なので出ません。</div>') + '</div>')

_gs_solo = ('<div data-sec="0 1 2 3">' + note("一人社長の見え方。会社＝自分なので <b>1段</b>。層を足せば同じ画面が伸びます。", "info") +
  card(head("会社＝あなた") + gtree(node("会社","ENGINE BASE（高本）",[("受注",10,4,"件",None),("売上",12_000_000,8_330_000,"円",None)],0,me=True,
    children=node("AI社員","AI営業社員",[("新規リード／月",60,41,"件",None)],1,roll="足さない（仮説で繋ぐ）")))) + '</div>')

def _tld(kind, title, sub, kv, prog=None, buttons=""):
    p = f'<div class="bar"><i style="width:{prog[1]}%"></i></div><div class="k">{prog[0]}</div>' if prog else ""
    return (f'<div class="k">{kind}</div><h3>{title}</h3><div class="k">{sub}</div>{p}<dl>' + "".join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in kv) + '</dl>' + (f'<div class="acts">{buttons}</div>' if buttons else ""))
_gs_tl = ('<div data-sec="0 1 2 3 4">' + view_bar(["木","タイムライン"], "タイムライン", {"木":"n","タイムライン":"tl"}, hint=False) +
  card(head("目標と施策の期間", sub="Q3（7〜9月）〜 Q4。棒＝期間、線＝前後関係、ひし形＝検証の時期。棒を押すと右に詳細") +
  timeline(["7月","8月","9月","10月","11月","12月"], [
    ("会社 · 今期の売上 12,000,000", "積み上がった 8,330,000（69%）", 0, 6, "", ("売上 12,000,000 · 69%", 69), False),
    ("営業 · 受注 10件", "4件 · 残り 3 週", 0, 3, "", ("受注 10件 · 40%", 40), True),
    ("あなた · 受注 7件", "3件", 0, 3, "", ("受注 7件 · 43%", 43), True),
    ("施策 · 発注ナビは数ではなく絞る", "予算 0 · 9/10〜", 2.3, 1.7, "ms", "取り込み条件を変える", True),
    ("検証 · 発注ナビ経由の成約率 5%", "10月末に判定", 3.9, 0, "dia", "10/31 判定", True),
    ("施策 · 納品先への近況メール", "予算 20,000 · 10〜12月", 3, 3, "ms", ("近況メール · 実コスト 0", 0), True),
    ("検証 · 既存客の追加受注 2,400,000", "12月末に判定", 5.9, 0, "dia", "12/31 判定", True),
    ("AI営業社員 · 新規リード 60件／月", "41件", 2, 1, "chk", "60件／月 · 68%", True),
  ], {
    0: _tld("会社の目標", "今期の売上 12,000,000 円", "7〜12月 · 第 3 版 · 営業目標（受託開発）第 3 版のスキルで組んだ", [("積み上がった","8,330,000 円（69%）"),("下に配った","営業 10 件 ／ 制作 納期遵守 95%"),("未配分","0"),("かけたもの","予算 70,000 円 · 実コスト 50,000 円 · 42 時間"),("担当","高本")], ("売上 12,000,000 · 69%", 69), btn("改訂する","o","pen","v1-goal-edit.html")+btn("配分を見る","g","layers","v1-goal-allocation.html")),
    1: _tld("層の目標", "営業 · 受注 10 件", "7〜9月 · 会社の売上から逆算 · 単位：件 → 円（平均 1,200,000）", [("実績","4 件（40%）· 残り 3 週"),("配った先","あなた 7 件 ／ 田中 3 件"),("合意","田中：合意済み 9/2"),("かけたもの","時間 28 h"),("仮説","発注ナビは数ではなく絞る")], ("受注 10 件 · 40%", 40), btn("配分を見る","o","layers","v1-goal-allocation.html")),
    2: _tld("個人の目標", "あなた · 受注 7 件", "7〜9月 · 営業から配られた", [("実績","3 件（43%）"),("今日の寄与","セイコー 提案（1 件分）"),("かけたもの","時間 19 h")], ("受注 7 件 · 43%", 43), btn("自分の進み","o","user","v1-my-progress.html")),
    3: _tld("施策", "発注ナビは数ではなく絞る", "9/10〜10/31 · 仮説「数を増やしても成約しない」", [("予算","0 円"),("実コスト","AI営業社員 12 時間"),("検証","10/31 発注ナビ経由の成約率 5%"),("担当","AI営業社員"),("スキル","営業目標（受託開発）第 3 版の工程")], None, btn("施策を直す","o","pen","v1-hypotheses.html")),
    4: _tld("検証", "発注ナビ経由の成約率 5%", "10/31 に判定 · 母数が 20 件未満なら延ばす", [("今","3 / 41（7.3%）"),("判定","母数が足りない（41 件 → 見込み 55 件）"),("効かなかったら","条件を戻し、次の仮説「提案の質」へ")], None, btn("検証の表へ","o","flask","v1-hypotheses.html")),
    5: _tld("施策", "納品先への近況メール", "10〜12月 · 仮説「既存客からの追加受注が取れていない」", [("予算","20,000 円"),("実コスト","0（未着手）"),("検証","12/31 既存客の追加受注 2,400,000"),("担当","CS社員が下書き → あなたが承認")], ("実コスト 0 / 予算 20,000", 0), btn("施策を直す","o","pen","v1-hypotheses.html")),
    6: _tld("検証", "既存客の追加受注 2,400,000 円", "12/31 に判定", [("今","0 円"),("母数","納品先 14 社"),("効いたら","近況メールを担当業務に昇格")], None, btn("検証の表へ","o","flask","v1-hypotheses.html")),
    7: _tld("AI社員の目標", "AI営業社員 · 新規リード 60 件／月", "9月 · 営業の受注 10 件から変換（受注率 10% → リード 100 件 → 上限 60）", [("実績","41 件（68%）"),("止まっている","9/14 発注ナビの画面変更"),("かけたもの","自律実行 42 回")], ("60 件／月 · 68%", 68), btn("AI社員の動き","o","route","v1-ai-activity.html")),
  }, today_col=2.33) +
  '<div class="muted" style="font-size:12px;margin-top:10px">ひし形は検証の時期。線が切れている施策（検証が無い）は赤で出ます。1023 以下では一覧と詳細を切り替えます。</div>') + '</div>')
GOALS = ("goals", [("n","階層で見る","",_gs + GOALS_JS),("tl","タイムライン","目標・施策の期間と前後関係。この層だけガントにする。",_gs_tl),("u","未配分がある","未配分＝親−子。赤で出す。",_gs_un + GOALS_JS)], GCSS + VIEWS_CSS + ORG_CSS, False, {"階層で見る":"5層","未配分":"!3","かけたもの":"384,000"})

# ============================================================ goal-allocation
_alloc_tbl = card(head("営業 › 受注 10件 を配る", btn("＋層を足す","g","plus"), "配る権限：部門長 · 合意を取る") +
  table(["層","誰に",("配る","r"),"単位",("積み上がり","r"),"状態"], [
    [pill("個人","ne"),"高本（あなた）",(inp("7","","text","num","width:72px;text-align:right"),"n"),"件",("3","n"),pill("成立","su")],
    [pill("個人","ne"),"田中",(inp("3","","text","num","width:72px;text-align:right"),"n"),"件",("1","n"),pill("合意待ち","wa","clock")],
    [pill("AI社員","ne"),"AI営業社員（高本の）",(inp("60","","text","num","width:72px;text-align:right"),"n"),"件／月 リード",("41","n"),pill("成立","su")],
  ]) + f'<div style="display:flex;gap:12px;align-items:center;margin-top:12px;font-size:13px"><span>合計 <b class="num">10 / 10 件</b></span>{pill("配分済み","su","check")}<span class="sp"></span>{btn("配る","p","check")}</div>')

_vis_tbl = card(head("見せる範囲", sub="層ごとに決める。既定は上の層を継承") + table(["層","この層の目標を見せる相手","下をどこまで見るか","横（同じ層の他の人）"], [
    [pill("会社","ne"),"経営層だけ","全部","—"],[pill("事業","ne"),"事業の長まで","部署まで","—"],
    [pill("部署 営業","ne"),"部署の全員","個人まで","見せる（引き継ぎのため）"],[pill("部署 制作","ne"),"部署の全員","個人まで","見せない"],
    [pill("個人","ne"),"本人と部門長","自分のAI社員","—"]]) +
  note("「会社の売上目標は部署に見せない。でも部署に落とした受注目標はその部署が見る」がここで決まります。担当者は既定で自分の層＋見せると決めた上位だけです。", "info"))

_ga = ('<div data-sec="0">' + _alloc_tbl + '</div><div data-sec="1" hidden>' +
  card(head("未配分") + empty("check","未配分はありません","この層の目標は配り切られています。")) + '</div><div data-sec="2" hidden>' + _vis_tbl + '</div><div data-sec="3" hidden>' +
  card(head("単位の変換", sub="親と子で単位が違うところ") + '<div style="display:flex;flex-direction:column;gap:8px">' + "".join(
    f'<div style="padding:11px 13px;background:var(--surface);border-radius:var(--r-md);font-size:13px"><b>{a}</b> → <b>{b}</b><div class="muted" style="font-size:12px;margin-top:3px">{d}</div></div>'
    for a,b,d in [("会社 売上 12,000,000円","営業 受注 10件","変換して足す：平均単価 1,200,000円 × 件数"),("営業 受注 10件","AI営業社員 リード 60件／月","足さない：成約率 2.6% の仮説で繋ぐ。効かなければ仮説を見直す"),("会社 売上","制作 納期遵守 95%","足さない：納期遵守→リピート率の仮説")]) + '</div>') + '</div>')

_ga_layer = ('<div data-sec="0 1 2 3">' + card(head("層を足す") + field("層の名前", inp("","例：チーム、拠点、プロジェクト")) + field("どこの下に", inp("部署 営業")) +
  field("この層の目標を見せる相手", inp("層の全員")) + btn("足す","p","plus") + '<div class="muted" style="font-size:12px;margin-top:12px">層の数は決めていません。足した層にも同じ配分・可視性の設定が付きます。</div>') + '</div>')
_ga_unit = ('<div data-sec="0 1 2 3">' + card(head("単位を作る") + field("名前", inp("","例：面談、レビュー、リード")) + field("記号", inp("","例：件、回、人")) +
  field("小数", inp("0")) + btn("作る","p","plus") + '<div class="muted" style="font-size:12px;margin-top:12px">単位は運営が決めません。会社ごとに作れます。</div>') + '</div>')
_ga_mode = ('<div data-sec="0 1 2 3">' + card(head("配り方", sub="合意を取る／そのまま指示する。層ごとに既定を持ち、目標 1 本ごとに上書きできる") + table(["層","既定","この目標（営業 › 受注 10 件）",""], [
  ["会社 → 事業・部署",pill("そのまま指示","ne"),"そのまま指示",btn("変える","g","pen")],["部署 → 個人",pill("合意を取る","su"),"合意を取る（田中さんは合意待ち）",btn("変える","g","pen")],["個人 → 自分のAI社員",pill("そのまま指示","ne"),"そのまま指示",btn("変える","g","pen")]]) +
  note("「合意を取る」だと相手が受けるまで「合意待ち」で、その分は未配分と同じく赤で見えます。「そのまま指示」は即成立。", "info") + '<div class="acts">' + btn("保存する","p","check") + '</div>') + '</div>')
_ga_r1 = ('<div data-sec="0 1 2 3">' + card(head("会社 › 受注 10 件 を配る", sub="層が無い会社。配る先は あなた と 自分のAI社員 だけ") + table(["配る先","目標","単位","状態"], [
  ["あなた（高本）",("6 件","n"),"件",pill("確定","su")],[f'{ic("ai")} 営業社員',("4 件 → 新規リード 40 件","n"),"件 → 件（変換）",pill("確定","su")],["未配分",("0","n"),"",pill("なし","su")]]) +
  clone_box("高本AI","4 件を営業社員に配るなら、過去の受注率 10% から新規リード 40 件に変換して持たせます。あなたの 6 件は既存の関係先からの見込みです。") +
  '<div class="acts">' + btn("この配分で確定","p","check") + btn("層を足す（人を招く）","g","plus","v1-members.html") + '</div>') + '</div>')
GOAL_ALLOC = ("goal-allocation", [("n","配る","",'<div data-roles="R2">' + _ga + '</div><div data-roles="R1">' + _ga_r1 + '</div>'),("m","配り方","合意を取る／そのまま指示する。層ごとの既定。",_ga_mode),("l","層を足す","",_ga_layer),("u","単位を作る","",_ga_unit)], GCSS + TL_CSS, False, {"未配分":"0","見せる範囲":"5","単位の変換":"3","配り方":""})

# ============================================================ goal-edit
def _cs(layer, chain, who, top=False):
    return (f'<div class="cs{" top" if top else ""}" style="--lc:{LAYER_C.get(layer, "var(--on-sv)")}"><span class="lt">{layer}</span><div class="ch">'
            + "".join(f'<span>{c}</span>' for c in chain) + f'</div><span class="wh">{who}</span></div>')
def _to(a, b): return f'<b>{a}</b><span class="to">{ic("right")}{b}</span>'
_casc = card(head("逆算の案", sub="大きい目標を変えると、下は逆算して配り直す。各層の長が合意して確定") +
  '<div class="casc">' +
  _cs("会社", [f'受注 {_to("10 件","12 件")}'], "あなたが決める", top=True) +
  _cs("事業", [f'受託開発 受注 {_to("10","12")}'], "そのまま降りる") +
  _cs("部署", [f'営業 受注 {_to("10","12")}'], "部署の長（高本）が合意") +
  _cs("個人", [f'高本 {_to("7","8")}', f'田中 {_to("3","4")}'], "本人が合意 · 田中さんは合意待ちになる") +
  _cs("AI社員", [f'営業社員 リード／月 {_to("60","72")}'], "成約率 2.6% の仮説から逆算") +
  _cs("施策", [f'発注ナビ アプローチ／月 {_to("30","40")}', '近況メール 10月 → 9月に前倒し'], "高本AIの案 · 仮説の画面に載る") +
  _cs("タスク", ['印が付く <b>3 件</b>', '追加の案 <b>2 件</b>（田中：△△社 提案書）'], "今日・タスクの画面に出る") +
  '</div><div class="acts" style="margin-top:14px">' + btn("この案で配る","p","check") + btn("自分で配り直す","o","layers","v1-goal-allocation.html") + btn("案を変えてもらう","g","ai") + '</div>')
_impact = card(head("下への影響", sub="直すと誰の配分と、どのタスクが変わるか") +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:6px">配分</div>' +
    table(["層","誰の",("今","r"),("改訂後","r")], [["部署","営業",("10 件","n"),("12 件","n")],["個人","高本",("7 件","n"),("8 件","n")],["個人","田中",("3 件","n"),("4 件","n")],["AI社員","営業社員",("60 件／月","n"),("72 件／月","n")]]) +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin:14px 0 6px">紐づくタスク（印が付く）</div>' +
    table(["やること","担当","印"], [["セイコー様へ提案の一次返信","高本",pill("目標が変わった","wa")],["京蟻 契約書案を送る","高本",pill("目標が変わった","wa")],["△△社 提案書の一次案","田中",pill("目標が変わった","wa")]]) +
    note("改訂すると部署の合計が足りなくなります。配り直しとタスクの増減は高本AIが案を出します。", "warn"))
_ge = ('<div data-sec="0">' + card(head("会社 › 受注 を改訂する", sub="第 3 版になる · 前の版は残る") + grid([field("目標", inp("12","","text","num")), field("単位", inp("件")), field("理由", inp("Q3 の受注が想定より早く進んだ"))], "g3") +
    '<div class="acts">' + btn("改訂する（逆算の案を出す）","p","check") + btn("やめる","g") + '</div>' +
    '<div class="muted" style="font-size:12px;margin-top:12px">改訂は上から。下の数字は自動では変わらず、下の逆算の案を各層の長が合意して確定します。合意が揃うまで「未配分」として赤で残ります。</div>') + _casc + '</div>' +
  '<div data-sec="1" hidden>' + card(head("目標を無くす・終える", sub="消しません。終了日を付けます") +
    '<div style="padding:12px 14px;background:var(--surface);border-radius:var(--r-md);margin-bottom:14px;font-size:13.5px"><b>Q2 新規開拓 12件</b><div class="muted" style="font-size:12px;margin-top:3px">会社 › 営業 · 期間 4/1〜6/30 · 実績 9件</div></div>' +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:6px">紐づいているもの（行き先を決めるまで赤で残る）</div>' +
    table(["種類","内容","担当","行き先"], [
      [pill("タスク","ne"),"◇◇様 前回提案の再打診","高本",'<span style="display:inline-flex;gap:6px">'+btn("付け替え","o","target")+btn("自主に","g","flag")+btn("やめる","g","x")+'</span>'],
      [pill("タスク","ne"),"□□社 デモの再提案","田中",'<span style="display:inline-flex;gap:6px">'+btn("付け替え","o","target")+btn("自主に","g","flag")+btn("やめる","g","x")+'</span>'],
      [pill("配分","ne"),"田中 4件 ／ 高本 8件","—","終了と同時に閉じる"],
      [pill("仮説","ne"),"展示会経由で新規が増える","—",'<span style="display:inline-flex;gap:6px">'+btn("残す（効かなかった）","o","flask")+'</span>'],
    ]) + note("<b>行き先のないもの 3件</b>。決めるまでこの目標は終了できますが、赤は残ります。", "danger") +
    btn("終了する","d","ban") + " " + btn("高本AIの振り分け案で一括","p","ai")) + '</div>' +
  '<div data-sec="2" hidden>' + _impact + '</div>' +
  '<div data-sec="3" hidden>' + card(head("版の履歴") + table(["版","いつ","何を","誰が","タスクへの反映"], [["2","9/1","受注 8 → 10 件","高本","3件に印 → 高本AIが2件追加を提案 → 採用"],["1","7/1","初版","高本AI（たたき台）","—"]])) + '</div>')
_ge_r1 = ('<div data-sec="0 1">' + card(head("会社 › 受注 を改訂する", sub="第 3 版になる · 前の版は残る · 層が無いので逆算は 自分 と AI社員 の 2 行") +
  grid([field("目標", inp("12","","text","num")), field("単位", '<select class="inp"><option>件</option></select>')], "g2") + field("なぜ変えるか（版に残る）", inp("セイコーの受注で四半期の見込みが上がった")) +
  '<div style="font-size:12.5px;font-weight:600;color:var(--on-sv);margin:14px 0 8px">逆算の案（下に配り直す）</div>' + table(["配る先","今","案","差"], [["あなた",("6 件","n"),("7 件","n"),"+1"],[f'{ic("ai")} 営業社員',("4 件 → リード 40","n"),("5 件 → リード 50","n"),"+10 リード"]]) +
  '<div class="acts">' + btn("第 3 版として保存","p","check") + btn("逆算の案を全部採る","o","layers") + btn("やめる","g") + '</div>') + '</div>')
GOAL_EDIT = ("goal-edit", [("n","改訂","版で残す。大きい目標を変えたら下は逆算。",'<div data-roles="R2">' + _ge + '</div><div data-roles="R1">' + _ge_r1 + '</div>')], GCSS, False, {"版の履歴":"2","逆算の案":"7"})

# ============================================================ my-progress（本人の層）
def _mine(me, layer_html, own, ai_rows, tasks):
    return ('<div data-sec="0">' + card(head("配られた分", sub="上から降りてきた目標") + layer_html) + '</div>' +
      '<div data-sec="1" hidden>' + card(head("自主目標", btn("＋足す","g","plus"), "上と関係なく自分で決めたもの。本人だけが触る") + own) + '</div>' +
      '<div data-sec="2" hidden>' + card(head("自分のAI社員", sub="自分のAI社員に配った分") + ai_rows) + '</div>' +
      '<div data-sec="3" hidden>' + card(head("自分のタスク") + tasks) + '</div>')

_mp_me = _mine("高本",
  gtree(node("部署","営業",[("受注",10,4,"件",10)],0,vis="部署の全員") + node("個人","高本",[("受注",7,3,"件",7)],1,me=True)) +
  '<div class="muted" style="font-size:12px;margin-top:6px">あなたの層です。<b>ここは本人が直接触れます</b>（即反映・承認なし）。</div>',
  table(["目標",("いま","r"),"単位",""], [["提案書の質を上げる（レビュー指摘 3件以下）",("5","n"),"件",btn("直す","g","pen")],["残業を月5時間減らす",("−3","n"),"時間",btn("直す","g","pen")]]),
  table(["AI社員","目標",("配った","r"),("実績","r")], [["AI営業社員","新規リード／月",("60","n"),("41","n")],["AI経理社員","請求の当日発行",("100","n"),("100 %","n")]]) + f'<div style="margin-top:10px">{btn("配り直す","o","layers")}</div>',
  table(["","やること","期限"], [["☐","セイコー様へ提案の一次返信を取りに行く","今日"],["☐","京蟻 契約書案を送る","明日"]]))
_mp_r3 = ('<div data-sec="0 1 2 3">' + note("佐藤さん（担当者）。自分の層だけ。会社の数字は見えません。", "info") + '</div>' +
  _mine("佐藤", gtree(node("部署","制作",[("納期遵守",95,97,"%",None)],0,vis="部署の全員") + node("個人","佐藤",[("納期遵守",100,100,"%",None)],1,me=True)),
  table(["目標",("いま","r"),"単位"], [["レビュー指摘を減らす",("2","n"),"件"]]),
  empty("ai","自分のAI社員はまだいません","部門長に頼むか、託されたAI社員を使えます。"),
  table(["","やること","期限"], [["☐","ScoliVio 会津データ受領の段取り確認","9/10"]])))
_mp_r4 = card(head("共有された案件の進み", sub="2件") + table(["案件","段階","次の予定"], [["セイコー 食品パッケージ画像編集SaaS","提案","一次返信の確認 · 今週"],["京蟻 オンラインガチャ","受注","契約書の締結 · 9/11"]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">閲覧のみ。目標・タスク・金額は見えません。</div>')
MY_PROGRESS = ("my-progress", [("me","自分","ログインしている本人の層。本人が管理する。担当者は配られた分だけ、閲覧のみは共有された分だけ。",'<div data-roles="R1 R2">' + _mp_me + '</div><div data-roles="R3">' + _mp_r3 + '</div><div data-roles="R4">' + _mp_r4 + '</div>' + GOALS_JS)], GCSS + ORG_CSS, False, {"配られた分":"1","自主目標":"2","自分のAI社員":"2","自分のタスク":"2"})

SCREENS = [GOALS, GOAL_ALLOC, GOAL_EDIT, MY_PROGRESS]

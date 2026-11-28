# -*- coding: utf-8 -*-
"""P4 毎月：review / hypotheses"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _views import VIEWS_CSS, gantt, view_bar, timeline, TL_CSS

_rv = grid([
  card(head("8月のふりかえり", sub="高本AIが書きました · 9/1") +
    table(["目標",("降ろした","r"),("積み上がった","r"),("差","r")], [
      ["売上（月）",("4,000,000","n"),("3,410,000","n"),('<span style="color:var(--st-danger);font-weight:600">−590,000</span>',"n")],
      ["成約（月）",("3 件","n"),("1 件","n"),('<span style="color:var(--st-danger);font-weight:600">−2</span>',"n")],
      ["アプローチ（月）",("38 件","n"),("41 件","n"),('<span style="color:var(--st-success);font-weight:600">+3</span>',"n")],
      ["既存客の追加受注",("800,000","n"),("1,060,000","n"),('<span style="color:var(--st-success);font-weight:600">+260,000</span>',"n")]]) +
    f'<div class="ai" style="margin-top:16px"><div class="ai-h">{ic("clone")}なぜ届かなかったか（高本AIの読み）</div>'
    'アプローチは目標を超えたのに成約が1件。<b>数ではなく質</b>の問題です。8月の提案 6件のうち 4件は発注ナビ経由で、成約率は 0%。紹介経由 2件は 1件成約。'
    '「アプローチ数を増やせば成約が増える」という仮説は、発注ナビでは効いていません。</div>'),
  card(head("要因の候補", sub="効いた／効かなかった") + '<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">' + "".join(
    f'<div style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;background:var(--surface);border-radius:var(--r-md)">{pill(k,c)}<div><b>{t}</b><div class="muted" style="font-size:12px">{d}</div></div></div>'
    for k,c,t,d in [("効かなかった","da","発注ナビのアプローチ数を増やす","41件 → 成約0。成約率の仮説 2.6% が発注ナビには当てはまらない"),
                    ("効いた","su","納品先への近況メール","2件送って1件が追加受注（1,060,000）"),
                    ("分からない","ne","提案書の構成を変えた","8月から。判断には母数が足りない")]) + '</div>' +
    '<div style="margin-top:14px"><a class="btn btn-p btn-sm" href="v1-hypotheses.html">' + ic("flask") + '仮説を見る</a></div>'),
], "g2")
_rv_q = card(head("Q2（4〜6月）のふりかえり", sub="四半期") + table(["目標",("降ろした","r"),("積み上がった","r"),("達成","r")], [
  ["売上",("10,000,000","n"),("9,840,000","n"),("98%","n")],["成約",("8 件","n"),("9 件","n"),("113%","n")]]) +
  clone_box("高本AI","Q2 は届きました。効いたのは既存客のリピート（3件）。Q3 は新規の比率が上がっているので、同じやり方では届きません。"))
_rv_carry = card(head("未達の繰り越し", sub="月の未達は翌月に上乗せして四半期を守る") + table(["目標","8月",("未達","r"),"9月（上乗せ後）","10月（残り）","守れるか"], [
  ["受注（営業 10件／四半期）","3 件（目標 3）",("0","n"),"3 + 0 = 3 → 実績 1（9/15 時点）","4 + 2 = 6",pill("厳しい","wa")],["新規リード 60件／月（AI営業社員）","52 件",("8","n"),"60 + 8 = 68 → 41（9/15 時点）","60 + 27 = 87",pill("届かない","da")],["納期遵守 95%（制作）","100%",("—","n"),"97%","—",pill("届く","su")]]) +
  clone_box("高本AI","新規リードは 10 月に 87 件が要り、発注ナビの条件を絞った今の見込み（月 45 件）では届きません。会社の目標「受注 10 件」を 8 件に見直すか、リードの経路を 1 つ足すか。改訂の提案を出せます。", btn("目標の改訂を見る","o","pen","v1-goal-edit.html")+btn("経路を足す案","g","flask","v1-hypotheses.html")))
REVIEW = ("review", [("n","月次","",_rv),("q","四半期","",_rv_q),("c","繰り越し","未達は翌月に上乗せ。守れないなら見直しを提案。",_rv_carry)], "", False, {"差分":"","要因の候補":"3","前期との比較":"","繰り越し":"!2"})

HY_CSS = """
.hst{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px;margin-bottom:14px}
.hst>div{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:10px 12px;border-left:4px solid var(--hc)}
.hst b{display:block;font-size:22px;font-variant-numeric:tabular-nums;line-height:1.1}.hst small{color:var(--on-sv);font-size:11.5px}
.hwrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}
.htb{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden}
.hth,.hr{display:grid;grid-template-columns:minmax(220px,1.5fr) 112px minmax(150px,1fr) minmax(150px,1.1fr) 92px 92px;column-gap:12px;align-items:center;padding:0 14px}
.hth{min-height:34px;font-size:11.5px;font-weight:600;color:var(--on-sv);background:var(--surface);border-bottom:1px solid var(--line)}
.hr{min-height:56px;padding-top:8px;padding-bottom:8px;border-top:1px solid var(--line-soft);font-size:13px;cursor:pointer}
.hr:hover{background:var(--surface)}.hr.sel{background:var(--primary-c)}
.hr .t b{display:block;font-weight:600;line-height:1.35}.hr .t small{display:block;color:var(--on-sv);font-size:11.5px;margin-top:2px}
.hr .st{display:inline-flex;gap:5px;align-items:center;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:var(--r-full);white-space:nowrap}
.hr .st.c{background:var(--sv);color:var(--on-sv)}.hr .st.r{background:#DBEAFE;color:#1E3A8A}.hr .st.ok{background:#DCFCE7;color:#166534}.hr .st.ng{background:#FEE2E2;color:#991B1B}.hr .st.un{background:#FCEBD5;color:#7E570D}
.hr .mt{font-size:12px;color:var(--on-sv)}.hr .mt b{color:var(--on-surface);font-variant-numeric:tabular-nums}
.eff{display:flex;flex-direction:column;gap:3px}
.eff .rail{position:relative;height:8px;background:var(--sv);border-radius:4px;overflow:hidden}
.eff .rail i{position:absolute;top:0;height:100%;border-radius:4px;background:var(--st-success)}.eff .rail i.ng{background:var(--st-danger)}.eff .rail i.un{background:var(--st-warning)}
.eff .rail::after{content:"";position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--on-sv);opacity:.5}
.eff small{font-size:11px;color:var(--on-sv);display:flex;justify-content:space-between}
.hr .num{text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px}.hr .num small{display:block;color:var(--on-sv);font-size:11px}
.hr .dt{font-size:12px;text-align:right;color:var(--on-sv)}.hr .dt b{display:block;color:var(--on-surface)}
.hdet{position:sticky;top:12px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:16px 18px}
.hd{display:none}.hd.on{display:block}
.hd .kind{font-size:11.5px;font-weight:600;color:var(--on-sv);margin-bottom:4px}.hd h3{font-size:16px;font-weight:700;line-height:1.4;margin-bottom:10px}
.hd p{font-size:13px;line-height:1.7;color:var(--on-sv);margin:0 0 10px}
.hd .stp{display:flex;flex-direction:column;gap:6px;margin:8px 0 12px}
.hd .stp>div{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start;font-size:12.5px}
.hd .stp>div>span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--primary-c);color:var(--on-primary-c)}
.hd .stp b{display:block}.hd .stp small{color:var(--on-sv);font-size:11.5px}
.hd .dkv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:12.5px;margin:0}.hd .dkv dt{color:var(--on-sv);white-space:nowrap}.hd .dkv dd{margin:0}
@media(max-width:1179px){.hwrap{grid-template-columns:1fr}.hdet{position:static}.hth,.hr{grid-template-columns:minmax(200px,1.5fr) 112px minmax(140px,1.1fr) 88px}.hth .c4,.hr .c4,.hth .c5,.hr .c5{display:none}}
@media(max-width:767px){.hth{display:none}.hr{grid-template-columns:1fr auto;row-gap:6px}.hr .t{grid-column:1/-1}.hr .c3{grid-column:1/-1}}
"""
# (id, 仮説, どこから, 状態, 施策, 見る数字, 今, 目標, 効き目 -100..100, 確度, 予算, 実コスト, 判定日, 誰が, 手順)
HYPS = [
 ("h1","発注ナビは数ではなく絞る","高本AIの候補 · 成約 0 の原因分析","c","営業社員の取り込み条件を 100万円以上・Web/アプリ に","発注ナビ経由の成約率",0,5,None,"—",0,0,"10/31","高本AI → あなた",
   [("条件を変える","営業社員の担当業務の変更 → 承認待ち","今日"),("20 件アプローチ","営業社員が下書き・あなたが送る","9月"),("成約率を判定","5% を超えるか。母数 20 未満なら延ばす","10/31")]),
 ("h2","納品先への近況メールを定期にする","高本AIの候補 · 2 件で 1 件追加受注","c","CS社員に定期の下書きを配る。あなたが承認して送る","既存客の追加受注",1_060_000,2_400_000,None,"—",20_000,0,"12/31","高本AI → あなた",
   [("納品 3 か月後の全件に下書き","CS社員 · 施策「近況メール」","10月〜"),("あなたが承認して送る","1 通 1 承認","毎週"),("追加受注を判定","2,400,000 に届くか","12/31")]),
 ("h3","提案書の構成を変える（結論を先に）","あなたが試している","r","新テンプレで提案 3 件","提案の成約率",33,40,12,"低（母数 3）",50_000,50_000,"9/30","あなた",
   [("新テンプレで 3 件提案","8/1〜","済"),("成約率を判定","母数が足りなければ延ばす","9/30")]),
 ("h4","既存客のリピートは近況メールで増える","Q2 のふりかえり","ok","紹介元への近況メール（CS社員）","紹介からの受注",2,1,64,"高（3 か月）",0,0,"8/31 判定済","あなた",
   [("近況メール 12 通","CS社員 · あなたが承認","6〜8月"),("紹介 2 件 → 受注 1 件","1,060,000","8月"),("効いた → 定期にする（h2）","","9月")]),
 ("h5","アプローチ数を増やせば成約が増える（発注ナビ）","あなたが試した","ng","発注ナビ 41 件アプローチ","成約",0,2,-70,"高（母数 41）",120_000,110_000,"8/31 判定済","あなた",
   [("41 件アプローチ","営業社員が下書き","8月"),("成約 0","成約率の仮説 2.6% が発注ナビには当てはまらない","8/31"),("効かなかった → 絞る（h1）","同じことを試さないために残す","9月")]),
 ("h6","土曜の作業をやめても納期は守れる","佐藤の候補","un","金曜午後を作業に固定","納期遵守",97,95,8,"分からない（1 か月）",0,0,"10/31","佐藤",
   [("金曜午後の打ち合わせをやめる","記憶「金曜午後は入れない」","9月"),("納期遵守を判定","95% を下回らないか","10/31")]),
]
ST = {"c":("候補","c","flask"),"r":("試している","r","play"),"ok":("効いた","ok","check"),"ng":("効かなかった","ng","x"),"un":("分からない","un","info")}
def _fmt(v, unit=""):
    return "—" if v is None else (f"{v:,}" if isinstance(v, int) and v >= 1000 else str(v))
def _hr(h, sel=False):
    hid, title, src, st, meas, metric, now, tgt, eff, conf, bud, cost, due, who, steps = h
    lbl, cls, icn = ST[st]
    if eff is None: rail = '<div class="eff"><div class="rail"></div><small><span>まだ判定していない</span><span>{}</span></small></div>'.format(due)
    else:
        w = abs(eff) / 2; left = 50 if eff >= 0 else 50 - w
        rail = f'<div class="eff"><div class="rail"><i class="{"ng" if eff < 0 else ("un" if st == "un" else "")}" style="left:{left}%;width:{w}%"></i></div><small><span>{"+" if eff > 0 else ""}{eff}%</span><span>確度 {conf}</span></small></div>'
    unit = "円" if isinstance(tgt, int) and tgt >= 1000 else ("%" if metric.endswith("率") or metric == "納期遵守" else "件")
    return (f'<div class="hr{" sel" if sel else ""}" data-h="{hid}"><div class="t"><b>{title}</b><small>{src}</small></div>'
            f'<span class="st {cls}">{ic(icn)}{lbl}</span>'
            f'<div class="mt c3">{metric}<br><b>{_fmt(now)}</b>{unit} → <b>{_fmt(tgt)}</b>{unit}</div>'
            f'<div class="c4">{rail}</div>'
            f'<div class="num c5">{_fmt(cost)}<small>予算 {_fmt(bud)}</small></div>'
            f'<div class="dt"><b>{due.split(" ")[0]}</b>{"判定済" if "済" in due else "判定"}</div></div>')
def _hd(h, on=False):
    hid, title, src, st, meas, metric, now, tgt, eff, conf, bud, cost, due, who, steps = h
    lbl, cls, icn = ST[st]
    stp = "".join(f'<div><span>{i+1}</span><div><b>{a}</b><small>{b}{" · " + c if c else ""}</small></div></div>' for i, (a, b, c) in enumerate(steps))
    acts = ('<div class="acts">' + btn("採る（施策とタスクに落とす）","p","check") + btn("採らない","g") + '</div>' if st == "c" else
            '<div class="acts">' + btn("タイムラインで見る","o","today") + btn("目標に反映する","g","target","v1-goal-edit.html") + '</div>' if st == "ok" else
            '<div class="acts">' + btn("施策を直す","o","pen") + btn("やめる","g","x") + '</div>')
    return (f'<div class="hd{" on" if on else ""}" data-h="{hid}"><div class="kind">{lbl} · {who}</div><h3>{title}</h3><p>{meas}</p>'
            f'<div style="font-size:12.5px;font-weight:600;color:var(--on-sv);margin-bottom:6px">手順</div><div class="stp">{stp}</div>'
            + '<dl class="dkv">' + "".join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in [("見る数字", f"{metric}：{_fmt(now)} → {_fmt(tgt)}"), ("効き目", "まだ" if eff is None else f"{'+' if eff>0 else ''}{eff}%（確度 {conf}）"), ("予算／実コスト", f"{_fmt(bud)} ／ {_fmt(cost)}"), ("判定", due), ("目標", "営業 › 受注 10 件" if hid in ("h1","h5") else ("会社 › 売上 1,200 万" if hid in ("h2","h4") else "制作 › 納期遵守 95%"))]) + '</dl>' + acts + '</div>')
_hst = '<div class="hst">' + "".join(f'<div style="--hc:{c}"><b>{n}</b><small>{l}</small></div>' for l, n, c in [("候補",2,"var(--on-sv)"),("試している",1,"#1E3A8A"),("効いた",1,"var(--st-success)"),("効かなかった",1,"var(--st-danger)"),("分からない",1,"var(--st-warning)")]) + '</div>'
_hy_tbl = ('<div class="hwrap"><div class="htb"><div class="hth"><div>仮説 · どこから</div><div>状態</div><div class="c3">見る数字 · 今 → 目標</div><div class="c4">効き目（右が効いた）· 確度</div><div class="c5" style="text-align:right">実コスト</div><div style="text-align:right">判定</div></div>'
           + "".join(_hr(h, sel=(i == 0)) for i, h in enumerate(HYPS)) + '</div><aside class="hdet">' + "".join(_hd(h, on=(i == 0)) for i, h in enumerate(HYPS)) + '</aside></div>')
HY_JS = "<script>document.addEventListener('click',e=>{const r=e.target.closest('.hr[data-h]'); if(!r) return; const w=r.closest('.hwrap'); w.querySelectorAll('.hr').forEach(x=>x.classList.toggle('sel',x===r)); w.querySelectorAll('.hd').forEach(x=>x.classList.toggle('on',x.dataset.h===r.dataset.h));});</script>"
_hy = ('<div data-sec="0 1 3">' + card(head("仮説と施策", btn("仮説を足す","o","plus") + btn("高本AIに候補を出してもらう","g","ai","v1-clone-chat.html"), "1 行 1 検証。効き目は判定日に決まる。効かなかったものも消さない（同じことをまた試さないため）") + _hst + _hy_tbl) + '</div>' +
       clone_box("高本AI","候補 2 つのうち「発注ナビは絞る」は今日から動かせます（営業社員の条件を変えるだけ・費用 0）。「近況メール」は 10 月からで、CS社員の下書きをあなたが週 1 で承認する手間が増えます。", btn("両方採る","p","check")+btn("絞るだけ採る","o")) + HY_JS)
_hy_adopt = card(f'<div style="display:flex;gap:12px;align-items:center;padding:14px;background:#DCFCE7;border-radius:var(--r-md);margin-bottom:16px">{ic("check")}<div><b>「発注ナビは数ではなく絞る」を採りました。</b>施策とタスクまで落としました。</div></div>' +
  table(["落ちたもの","誰に","いつ"], [["営業社員の取り込み条件を「100万円以上・Web/アプリ」に変える","営業社員（担当業務の変更 → 承認待ち）","今日"],["月のアプローチ目標を 38 → 20 に改訂（提案）","あなた（目標の改訂）","今週"],["9月末に成約率を判定するタスク","あなた","9/30"]]) +
  clone_box("高本AI","目標「月のアプローチ 38件」はこの仮説と矛盾するので、改訂の提案を出しました。あなたが承認すれば変わります。", btn("目標の改訂を見る","o","pen","v1-goal-edit.html")))
def _tld(kind, title, sub, kv, prog=None, buttons=""):
    p = f'<div class="bar"><i style="width:{prog[1]}%"></i></div><div class="k">{prog[0]}</div>' if prog else ""
    return (f'<div class="k">{kind}</div><h3>{title}</h3><div class="k">{sub}</div>{p}<dl>' + "".join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in kv) + '</dl>' + (f'<div class="acts">{buttons}</div>' if buttons else ""))
_hy_tl = (view_bar(["リスト","タイムライン"], "タイムライン", {"リスト":"n","タイムライン":"tl"}, hint=False) +
  card(head("施策のタイムライン", sub="始めた日・予算・検証の時期。棒を押すと右に詳細。効いたかは検証の時期に判定する") +
  timeline(["8月","9月","10月","11月","12月"], [
    ("提案書の構成を変える", "予算 50,000 · 実コスト 50,000", 0, 2, "ms", ("新テンプレで提案 · 3 件", 60), False),
    ("検証 · 提案の成約率", "9月末に判定（母数が足りなければ延ばす）", 1.95, 0, "dia", "9/30 判定", True),
    ("発注ナビは数ではなく絞る", "予算 0 · 9/10〜", 1.3, 1.7, "ms", "取り込み条件を 100万円以上・Web/アプリ に", False),
    ("検証 · 発注ナビ経由の成約率 5%", "10月末に判定", 2.9, 0, "dia", "10/31 判定", True),
    ("納品先への近況メール", "予算 20,000 · 10〜12月", 2, 3, "ms", ("CS社員が下書き → あなたが承認", 0), False),
    ("検証 · 既存客の追加受注 2,400,000", "12月末に判定", 4.9, 0, "dia", "12/31 判定", True),
    ("（効かなかった）アプローチ数を増やす", "8月 · 41件 → 成約 0", 0, 1, "chk", "効かなかった", False),
  ], {
    0: _tld("施策", "提案書の構成を変える", "8〜9月 · 仮説「提案が長くて読まれていない」", [("予算","50,000 円"),("実コスト","50,000 円 · 6 時間"),("検証","9/30 提案の成約率"),("担当","あなた ＋ 高本AI（下書き）"),("かけたもの","3 件の提案に適用")], ("新テンプレで提案 · 3 件", 60), btn("施策を直す","o","pen")),
    1: _tld("検証", "提案の成約率", "9/30 に判定 · 母数 3 件（足りなければ 10/15 まで延ばす）", [("今","1 / 3"),("比べる相手","7 月までの成約率 12%"),("効いたら","テンプレを運営配布の候補に（公開は審査）")], None, btn("判定を記録","o","check")),
    2: _tld("施策", "発注ナビは数ではなく絞る", "9/10〜10/31 · 仮説「数を増やしても成約しない」", [("予算","0 円"),("実コスト","AI営業社員 12 時間"),("検証","10/31 成約率 5%"),("担当","AI営業社員"),("スキル","営業目標（受託開発）第 3 版の工程")], None, btn("施策を直す","o","pen")),
    3: _tld("検証", "発注ナビ経由の成約率 5%", "10/31 に判定", [("今","3 / 41（7.3%）"),("判定","母数が足りない（見込み 55 件）"),("効かなかったら","条件を戻し「提案の質」へ")], None, btn("判定を記録","o","check")),
    4: _tld("施策", "納品先への近況メール", "10〜12月 · 仮説「既存客からの追加受注が取れていない」", [("予算","20,000 円"),("実コスト","0（未着手）"),("検証","12/31 追加受注 2,400,000"),("担当","CS社員が下書き → あなたが承認")], ("実コスト 0 / 予算 20,000", 0), btn("施策を直す","o","pen")),
    5: _tld("検証", "既存客の追加受注 2,400,000 円", "12/31 に判定", [("今","0 円"),("母数","納品先 14 社"),("効いたら","近況メールを担当業務に昇格")], None, btn("判定を記録","o","check")),
    6: _tld("効かなかった施策", "アプローチ数を増やす", "8月 · 仮説「数を増やせば成約が増える」→ 効かなかった", [("実績","41 件 → 成約 0"),("かけたもの","AI営業社員 30 時間 · 予算 0"),("学び","絞る方向へ（次の施策）"),("残す理由","同じ仮説を二度試さない")], None, ""),
  }, today_col=1.33) +
  '<div class="muted" style="font-size:12px;margin-top:10px">効かなかった施策も線として残します（同じ仮説を二度試さない）。1023 以下では一覧と詳細を切り替えます。</div>'))
HYPOTHESES = ("hypotheses", [("n","検証の表","目標とタスクの間に仮説と施策を置く。1 行 1 検証。",_hy),("tl","タイムライン","施策の期間・予算・検証の時期。",_hy_tl),("a","採ったあと","仮説→施策→タスクに落ち、矛盾する目標の改訂を提案する。",_hy_adopt)],
  VIEWS_CSS + HY_CSS + TL_CSS, False, {"候補":"2","試している":"1","効いた":"1","効かなかった":"1"})

SCREENS = [REVIEW, HYPOTHESES]

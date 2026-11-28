# -*- coding: utf-8 -*-
"""P6 人が増えたら：members / ai-staff / ai-staff-detail"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _org import *
from _leave import LEAVE, KIND_JA, LEAVE_CSS, leave_table, EVENT_JA

# ============================================================ members（組織図：層は会社ごと。1 人を押すと権限の表。層と権限の既定：D-073）
MB_CSS = """
.oc{display:flex;flex-direction:column;align-items:center}
.oc .top{width:min(100%,340px);border:1px solid var(--primary);border-radius:var(--r-lg);background:var(--card);box-shadow:0 0 0 2px var(--primary-c)}
.oc .band{width:min(100%,520px);border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);border-top:3px solid var(--d-plum);padding:8px 14px;display:flex;gap:10px;align-items:center;font-size:13px}
.oc .band .lt{font-size:11px;font-weight:700;color:#fff;background:var(--d-plum);padding:2px 8px;border-radius:var(--r-full)}
.oc .band small{color:var(--on-sv);margin-left:auto;font-size:11.5px}
.oc .stem{width:1px;height:18px;background:var(--line)}
.oc .depts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:12px;width:100%;position:relative;padding-top:18px}
.oc .depts::before{content:"";position:absolute;top:0;left:12%;right:12%;height:1px;background:var(--line)}
.oc .dept{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);position:relative;overflow:hidden}
.oc .dh{padding:9px 12px;font-size:13px;font-weight:700;border-top:3px solid var(--dc);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.oc .dh .lt{font-size:10.5px;font-weight:700;color:#fff;background:var(--dc);padding:1px 7px;border-radius:var(--r-full);font-size:11px}
.oc .dh .n{margin-left:auto;font-weight:500;color:var(--on-sv);font-size:11.5px}
.oc .dh small{width:100%;font-weight:500;color:var(--on-sv);font-size:11.5px}
.pc{display:flex;gap:9px;align-items:center;padding:9px 12px;border-top:1px solid var(--line-soft);font-size:13px;min-width:0;color:inherit;text-decoration:none}
a.pc:hover{background:var(--surface)}
.oc .top .pc{border-top:0;padding:12px 14px}
.pc .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--primary-c);color:var(--on-primary-c);flex:none}
.pc .av.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.pc .av.inv{background:var(--surface);color:var(--on-sv);border:1px dashed var(--line)}
.pc .tx{min-width:0;flex:1}.pc b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc small{display:block;color:var(--on-sv);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc .pill{flex:none}
.oc .lg{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--on-sv);align-self:flex-start}
.oc .lg span{display:inline-flex;gap:6px;align-items:center}.oc .lg i{width:10px;height:10px;border-radius:50%;display:inline-block}
.lyr{display:grid;grid-template-columns:110px 1fr;gap:10px 14px;align-items:center;font-size:13px}
.lyr .lt{font-size:11px;font-weight:700;color:#fff;padding:2px 8px;border-radius:var(--r-full);justify-self:start;white-space:nowrap}
.lyr .u{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.lyr .u span{border:1px solid var(--line);border-radius:var(--r-full);padding:3px 10px;background:var(--card);font-size:12.5px}
.lyr .u span b{font-weight:600}.lyr .u span small{color:var(--on-sv);margin-left:4px;font-size:11.5px}
.lyr .d{grid-column:2;font-size:12px;color:var(--on-sv);margin-top:-4px}
.prof{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.prof .av{width:48px;height:48px;border-radius:50%;background:var(--primary-c);color:var(--on-primary-c);display:grid;place-items:center;font-size:18px;font-weight:700}
.prof h2{font-size:18px;font-weight:700;margin:0}.prof .m{font-size:12.5px;color:var(--on-sv);display:flex;gap:10px;flex-wrap:wrap;margin-top:3px}
.prof .r{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
@media(max-width:767px){.oc .depts::before{display:none}.lyr{grid-template-columns:1fr}.lyr .d{grid-column:1}}
"""
def _pc(name, sub, kind="p", pl="", href=""):
    av = (f'<span class="av aiw">{ic("ai")}</span>' if kind == "ai" else (f'<span class="av inv">{ic("mail")}</span>' if kind == "inv" else f'<span class="av">{name[0]}</span>'))
    tag = "a" if href else "div"; h = f' href="{href}"' if href else ""
    return f'<{tag} class="pc"{h}>{av}<div class="tx"><b>{name}</b><small>{sub}</small></div>{pl}</{tag}>'
ORG = [
 ("営業", "高本", [_pc("高本 雅人","代表 · 営業の長 · 兼務",pl=pill("代表","ne"),href="v1-member-detail.html"), _pc("田中","担当者 · 受注 3 件",pl=pill("担当者","ne"),href="v1-member-detail.html"), _pc("営業社員","運営配布 · 止まっている","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html")]),
 ("制作", "佐藤", [_pc("佐藤 健","担当者 · 制作の長 · 案件 2 件",pl=pill("担当者","ne"),href="v1-member-detail.html")]),
 ("CS",   "高本", [_pc("CS社員","会社作成 · 稼働中","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html")]),
 ("経理", "高本", [_pc("経理社員","運営配布 · 稼働中","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html")]),
 ("外部", "—",   [_pc("鈴木 美咲","閲覧のみ · 共有した案件 2 件",pl=pill("閲覧","ne"),href="v1-member-detail.html"), _pc("yamamoto@example.com","招待中 · 9/9 送付 · 期限 9/16","inv",btn("取り消す","g","x"))]),
]
_org = ('<div class="oc"><div class="top">' + _pc("高本 雅人","代表 · info@engine-base.com · すべて見える・すべて直せる",pl=pill("代表","ne"),href="v1-member-detail.html") + '</div><span class="stem"></span>'
  '<div class="band"><span class="lt">事業</span><b>受託開発</b><span class="muted" style="font-size:12px">長：高本</span><small>この会社が決めた層 1</small></div><div class="depts">'
  + "".join(f'<div class="dept" style="--dc:{UNIT_C[d]}"><div class="dh"><span class="lt">{"部署" if d != "外部" else "外部"}</span>{d}<span class="n">{len(ps)}</span>' + (f'<small>長：{lead} · 直す・配る・承認はこの人</small>' if lead != "—" else '<small>層に属さない。共有した台帳だけ見える</small>') + f'</div>{"".join(ps)}</div>' for d, lead, ps in ORG) + '</div>'
  '<div class="lg"><span><i style="background:var(--primary-c)"></i>人 4</span><span><i style="background:var(--tertiary-c)"></i>AI社員 3</span><span><i style="background:var(--surface);border:1px dashed var(--line)"></i>招待中 1</span><span>プラン上限 5 人 · AI社員 5 体</span><span>人を押すと権限の表</span></div></div>')
_org_r1 = card(head("あなた 1 人", btn("人を招く","p","plus") + btn("層を足す","g","plus"), "層はありません（会社＝あなた）。人を招くと層を足せます") +
  '<div class="oc"><div class="top">' + _pc("高本 雅人","代表 · info@engine-base.com",pl=pill("代表","ne"),href="v1-member-detail.html") + '</div><span class="stem"></span><div class="depts" style="grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))">'
  '<div class="dept" style="--dc:var(--tertiary)"><div class="dh"><span class="lt">AI社員</span>あなたのAI社員<span class="n">3</span></div>'
  + _pc("営業社員","運営配布","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html") + _pc("経理社員","運営配布","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html") + _pc("CS社員","自分で作った","ai",pill("AI社員","ne"),href="v1-ai-staff-detail.html") + '</div></div></div>')
_mb = ('<div data-roles="R2">' + card(head("組織", btn("招待する","p","plus") + btn("層を足す","g","plus"), "4 人 · 招待中 1 · AI社員 3 · 層：会社 › 事業 › 部署 › 個人（この会社の呼び方。担当業務・目標・記憶・ルールにも同じ層が出ます）") + _org) + '</div>'
       '<div data-roles="R1">' + _org_r1 + '</div>')
def _mrow(name, mail, layer, role, scope, extra=""):
    return [f'<a href="v1-member-detail.html" style="color:inherit"><b>{name}</b></a><div class="muted" style="font-size:12px">{mail}</div>', layer, pill(role,"ne"), scope, pill("有効","su"), btn("権限","o","user","v1-member-detail.html")]
_mb_list = grid([
  card(head("メンバー", btn("招待する","p","plus"), "4人 · プラン上限 5 · 名前を押すと 1 人の権限") + table(["名前","層","役割","既定から足した権限","状態",""], [
    _mrow("高本 雅人","info@engine-base.com","事業 受託開発 · 部署 営業（長）","代表","すべて（代表）"),
    _mrow("田中","tanaka@example.com","部署 営業","担当者","なし（担当者の既定）"),
    _mrow("佐藤 健","sato@example.com","部署 制作（長）","担当者","制作の 直す・配る・承認（長）"),
    _mrow("鈴木 美咲","suzuki@partner.example","外部（層に属さない）","閲覧のみ","案件 2 件の段階だけ")]) +
    head("招待中", sub="1件") + table(["宛先","層","役割","送った","状態",""], [["yamamoto@example.com","部署 営業",pill("担当者","ne"),("9/9","n"),pill("未承諾 · 期限 9/16","wa"),btn("取り消す","g","x")]])),
  card(head("招待する") + field("メールアドレス", inp("","name@example.com","email")) +
    field("層", '<select class="inp"><option>部署 営業</option><option>部署 制作</option><option>部署 CS</option><option>部署 経理</option><option>外部（層に属さない・閲覧だけ）</option></select>') +
    field("役割（権限の既定）", '<select class="inp"><option>担当者（自分の層を見る・自分のものを直す）</option><option>閲覧のみ（共有した台帳を見るだけ）</option><option>代表と同じ（すべて）</option></select>') +
    field("この層の長にする", '<label style="display:flex;gap:8px;font-size:13px"><input type="checkbox" style="accent-color:#22345C">長にする（その層の 直す・配る・承認 が付く）</label>') +
    btn("招待を送る","p","send") + '<div class="muted" style="font-size:12px;margin-top:12px">細かい権限（何を・どの層で・見る／直す／配る／承認する）は参加後に 1 人の画面で変えられます。招待は7日で失効します。</div>'),
], "g21")
def _lyrow(layer, units, note):
    us = "".join(f'<span><b>{u}</b><small>長：{l}</small></span>' for u, l in units)
    return f'<span class="lt" style="background:{LAYER_C[layer]}">{layer}</span><div class="u">{us}{btn("足す","g","plus") if layer not in ("会社","個人") else ""}</div><div class="d">{note}</div>'
_mb_layers = grid([
  card(head("この会社の層", btn("＋層を足す","p","plus"), "会社と個人の間は 0〜n 層。名前も数もこの会社が決める。目標・担当業務・ルール・記憶・テンプレに同じ層が出る") +
    '<div class="lyr">' + _lyrow("会社", [("ENGINE BASE","高本")], "全員：会社のルール・記憶・担当業務を見る（会社の目標は見せない設定）。代表・権限のある人：直す・配る・承認") +
    _lyrow("事業", [("受託開発","高本")], "全員：事業の目標を見る。長：直す・配る・承認") +
    _lyrow("部署", [("営業","高本"),("制作","佐藤"),("CS","高本"),("経理","高本")], "全員：自分の部署の目標・担当業務・記憶を見る。長：直す・配る・承認。横（同じ部署の他の人）は営業だけ見せる") +
    _lyrow("個人", [("本人","本人")], "本人：自分のもの（自主目標・記憶・ルール・自分のAI社員）を権限なしで自由に。上の層は「見せる」と決めた分だけ") + '</div>'),
  card(head("層を足す") + field("層の名前", inp("","例：チーム、拠点、プロジェクト")) + field("どこの下に", '<select class="inp"><option>部署 の下</option><option>事業 の下</option><option>会社 の下</option></select>') +
    field("最初の単位と長", inp("","例：東京チーム · 長：田中")) +
    field("この層の既定の権限", '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<label style="display:flex;gap:8px"><input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C">{x}</label>' for x, c in [("層の全員：この層の目標・担当業務・記憶・ルールを見る",True),("長：直す・消す",True),("長：配る（目標・タスク）",True),("長：承認する（外に出るもの）",False),("層の全員：横（同じ層の他の人）の目標とタスクを見る",False)]) + '</div>') +
    btn("足す","p","plus") + '<div class="muted" style="font-size:12px;margin-top:12px">足した層は会社モデルの第 5 版として残ります。既定の権限は 1 人ごとに上書きできます。</div>'),
], "g21")
_mb_rev = card(head("佐藤 健 の範囲を変える") + note("権限を変えると、<b>佐藤さんの今のセッションと Bridge 接続は切れます</b>。入り直してもらってください。", "warn") +
  field("層", '<select class="inp"><option>部署 制作</option><option>部署 営業</option><option>部署 CS</option><option>部署 経理</option></select>') +
  field("役割", '<select class="inp"><option>担当者</option><option>閲覧のみ</option><option>無効にする</option></select>') +
  '<div class="acts">' + btn("変える","p","check") + btn("細かく決める","o","user","v1-member-detail.html") + btn("やめる","g") + '</div>')
_mb_del = ('<div data-sec="0 1 2">' + card(head("部署「CS」を消すときに起きること", sub="全 42 種類。層の中身は上の層に移すか消すかを選ぶ。決めるまで消せない") + leave_table("layer-delete") +
    '<div class="grid g21">' + card(head("上の層へ移すか、消すか") + table(["何を",("件数","r"),"案","決める"], [["目標 一次返信 24h",("1","n"),"会社に戻す（未配分）",btn("戻す","o","layers")],["担当業務 2 件",("2","n"),"会社の範囲へ",btn("会社へ","o","check")+" "+btn("消す","g","trash")],["記憶・ルール",("2","n"),"会社の範囲へ",btn("会社へ","o","check")],["AI社員 CS社員",("1","n"),"会社のAI社員に",btn("会社へ","o","check")],["人",("0","n"),"—","—"]]) +
      '<div class="acts">' + btn("消す（4／5 決定）","d","trash") + btn("やめる","g") + '</div>') + clone_box("高本AI","CS を消すと CS社員は会社のAI社員になり、担当業務の効く範囲は会社になります。会社モデルは第 5 版になります。") + '</div></div>'))
MEMBERS = ("members", [("n","組織図","層ごとに人と AI社員。人を押すと権限の表。",_mb),("l","一覧と招待","",_mb_list),("p","層と権限","この会社の層の呼び方と、層ごとの既定の権限。",_mb_layers),("x","層を消す","依存を片づけてから消す。",_mb_del),("r","範囲を変える","権限変更で既存セッションを全部無効化（G-14）。",_mb_rev)],
  MB_CSS + ORG_CSS + LEAVE_CSS, False, {"組織図":"4","一覧と招待":"1","層と権限":"4"})

# ============================================================ member-detail（1 人：所属する層・役割・権限の表。本人のものは権限なしで自由：D-073）
THINGS = ["目標","台帳","担当業務","AI社員","ルール","記憶","テンプレ"]
COLS = ["見る","作る・直す・消す","配る","承認する"]
def _pt(label, on=True, fixed=False, title=""):
    if fixed: return f'<span class="pt fixed" aria-pressed="{str(on).lower()}" title="{title}">{ic("lock")}{label}</span>'   # 本人のもの：押せない（変えられない）
    return f'<button class="pt" aria-pressed="{str(on).lower()}">{label}</button>'
# 佐藤（担当者・制作の長）の権限。各セル = [(範囲, on, fixed)]。fixed = 本人のもの（権限なしで自由・変えられない）
PERM_SATO = {
 "目標":   {"見る":[("自分",1,1),("制作",1,0),("会社",0,0)], "作る・直す・消す":[("自主目標",1,1),("制作",1,0),("会社",0,0)], "配る":[("制作 → 人",1,0),("自分のAI社員",1,1)], "承認する":[("制作の配分",1,0)]},
 "台帳":   {"見る":[("自分の担当",1,1),("制作",1,0),("会社",0,0)], "作る・直す・消す":[("自分の担当",1,1),("制作",1,0)], "配る":[("—",0,1)], "承認する":[("—",0,1)]},
 "担当業務":{"見る":[("制作",1,0),("会社",1,0)], "作る・直す・消す":[("制作",1,0),("会社",0,0)], "配る":[("制作のAI社員へ",1,0)], "承認する":[("制作の変更",1,0)]},
 "AI社員": {"見る":[("託された",1,1),("制作",1,0)], "作る・直す・消す":[("自分が作った",1,1),("制作",0,0),("会社",0,0)], "配る":[("制作 → 人に託す",0,0)], "承認する":[("制作のAI社員の外向き",1,0)]},
 "ルール": {"見る":[("自分",1,1),("制作",1,0),("会社",1,0)], "作る・直す・消す":[("自分",1,1),("制作",1,0),("会社",0,0)], "配る":[("—",0,1)], "承認する":[("—",0,1)]},
 "記憶":   {"見る":[("自分",1,1),("制作",1,0),("会社",1,0)], "作る・直す・消す":[("自分",1,1),("制作",1,0),("会社",0,0)], "配る":[("—",0,1)], "承認する":[("制作の確認待ち",1,0)]},
 "テンプレ":{"見る":[("自分",1,1),("制作",1,0),("会社",1,0)], "作る・直す・消す":[("自分",1,1),("制作",1,0),("会社",0,0)], "配る":[("—",0,1)], "承認する":[("—",0,1)]},
}
def perm_table(perm):
    rows = "".join(f'<tr><td>{th}</td>' + "".join('<td><div class="cell">' + "".join(_pt(l, bool(on), bool(fx), "本人のもの（権限なしで自由）" if fx else "") for l, on, fx in perm[th][c]) + '</div></td>' for c in COLS) + '</tr>' for th in THINGS)
    return f'<div class="t-wrap"><table class="ptbl"><thead><tr><th>何を</th>' + "".join(f'<th>{c}</th>' for c in COLS) + f'</tr></thead><tbody>{rows}</tbody></table></div>'
_md_prof = (f'<div class="prof"><span class="av">佐</span><div><h2>佐藤 健</h2><div class="m"><span>sato@example.com</span><span>部署 制作 · 長</span><span>担当者</span><span>参加 9/1</span>{pill("有効","su")}</div></div>'
            f'<div class="r">{btn("範囲を変える","o","pen")}{btn("無効にする","g","ban")}</div></div>')
_md = ('<div data-sec="0 1">' + card(_md_prof) + '</div>' +
  '<div data-sec="0 1">' + card(head("権限", sub="何を × どの層で × できること。鍵の付いた灰色は本人のもの（権限なしで自由・ここでは変えられない）。青は付いている・白は付いていない。押して切り替える") +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;font-size:13px"><span>役割の既定：</span><select class="inp" style="width:auto;max-width:100%;min-width:0"><option>担当者（自分の層を見る・自分のものを直す）</option><option>閲覧のみ</option><option>代表と同じ</option></select>'
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" checked style="accent-color:#22345C">制作の長（制作の 直す・配る・承認 が付く）</label></div>' + perm_table(PERM_SATO) +
    note("変えると <b>佐藤さんの今のセッションと Bridge 接続は切れます</b>（G-14）。付けた権限は証跡に残ります。", "warn") +
    '<div class="acts">' + btn("保存する","p","check") + btn("既定に戻す","g","undo") + '</div>') + '</div>' +
  '<div data-sec="2" hidden>' + card(head("託されたAI社員", sub="使えるが、定義は直せない（会社のもの）。個人ルールだけ足せる") + table(["AI社員","出どころ","できること","足した個人ルール"], [
    [f'{ic("ai")} CS社員',pill("会社作成","ne"),"使う · 指示する · 個人ルールを足す","納品先には金曜に送らない"],[f'{ic("ai")} 佐藤の助手',pill("自分で作った","ne"),"すべて（本人のもの）","—"]]) +
    '<div class="acts">' + btn("AI社員を託す","o","ai","v1-ai-staff.html") + '</div>') + '</div>' +
  '<div data-sec="3" hidden>' + card(head("セッション", btn("全部切る","d","ban"), "ログイン中の端末と Bridge") + table(["端末","場所","最終","Bridge",""], [
    ["MacBook Pro · Chrome","東京",("9/10 09:12","n"),pill("つながっている","su"),btn("切る","g","x")],["iPhone · Safari","東京",("9/9 22:40","n"),pill("なし","ne"),btn("切る","g","x")]])) + '</div>')

_md_leave = ('<div data-sec="0 1 2 3 4">' + card(head("佐藤 健 が抜けるときに起きること", sub="全 39 種類。引き継ぎ先を決めてから無効にする。無効にした瞬間にセッション・Bridge・資格情報・招待は失効（G-14）") + leave_table("person")) +
  '<div class="grid g21">' + card(head("引き継ぎ先を決める", sub="佐藤AIが案を出しました。決めるまで無効にできません") + table(["何を",("件数","r"),"案","決める"], [
     ["タスク",("5","n"),"制作の残り 3 件 → 田中、レビュー 2 件 → 高本",btn("この案で","o","check")+" "+btn("自分で選ぶ","g")],
     ["承認待ち（佐藤が承認者）",("1","n"),"納品の承認 → 高本（承認者が 1 人になるので注意）",btn("この案で","o","check")],
     ["制作の長",("1","n"),"高本（兼務）。長が空くと制作の 直す・配る・承認 が止まる",btn("高本にする","o","check")],
     ["目標の配分 納期遵守 100%",("1","n"),"親（制作 95%）に戻して未配分（赤）。田中に配り直す案",btn("配り直す","o","layers","v1-goal-allocation.html")],
     ["自分で作ったAI社員「佐藤の助手」",("1","n"),"消す／会社に移す（会社に移すと定義は会社のものに）",btn("会社に移す","o","ai")+" "+btn("消す","g","trash")],
     ["託されたAI社員 CS社員",("1","n"),"会社に返す。佐藤が足した個人ルール 1 件は消える",pill("自動","ne")],
     ["資格情報（佐藤が預けた 1 件）",("1","n"),"即失効・消去。会社で使うなら高本へ移管",btn("高本へ移管","o","key")+" "+btn("消す","g","trash")]]) +
     note("決めていないものが <b>4 件</b>。決めるまで「無効にする」は押せません。決めた内容と無効化は証跡に残ります。", "warn") +
     '<div class="acts">' + btn("無効にする（引き継ぎ 3／7 決定）","d","ban") + btn("佐藤AIの案を全部採る","o","ai") + btn("やめる","g") + '</div>') +
  clone_box("佐藤AI","抜ける前に、佐藤さん本人の分だけ書き出せます（自分の記憶・自分のタスクの記録）。会社のものは持ち出せません。", btn("本人の分を書き出す","o","download")) + '</div></div>')
_md_perm = ('<div data-sec="0 1 2 3 4">' + card(head("権限を変えるときに起きること", sub="佐藤 健 · 制作の長を外す／担当者 → 閲覧のみ にする場合。全 42 種類") + leave_table("permission-change") +
    note("変えた瞬間に佐藤さんのセッションと Bridge は失効（入り直し）。制作の長を外すと、制作の 直す・配る・承認 が止まるので、先に長を決める。", "warn") +
    '<div class="acts">' + btn("権限の表に戻る","o","user") + '</div>') + '</div>')
MEMBER_DETAIL = ("member-detail", [("n","佐藤 健","権限は 何を × どの層で × できること。本人のものは自由。",_md),("c","権限を変えるとき","依存（全オブジェクト）。",_md_perm),("o","抜ける","依存を片づけてから無効にする。",_md_leave)], MB_CSS + ORG_CSS + LEAVE_CSS, False, {"基本":"","権限":"7","託されたAI社員":"2","セッション":"2","抜ける":"!4"})

# ============================================================ ai-staff
def _staff(name, src, duties, scope, state, href="v1-ai-staff-detail.html"):
    return (f'<a class="card" href="{href}" style="display:block;padding:16px"><div style="display:flex;gap:9px;align-items:center;margin-bottom:8px">{ic("ai")}<b>{name}</b><span style="flex:1"></span>{pill(src,"ne")}</div>'
            f'<div style="font-size:13px;color:var(--on-sv);line-height:1.7">{duties}</div><div style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12px"><span class="muted">効く範囲 {scope}</span><span style="flex:1"></span>{state}</div></a>')
_as = (clone_box("高本AI","AI社員はあなたと直接はやりとりしません。<b>私が窓口</b>になって指示を配り、上がってきたものを一次確認します。今 3体、プランの上限は 5体です。") +
  '<div style="height:18px"></div>' +
  '<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))">' +
  _staff("営業社員","運営配布","発注ナビの取り込み ／ アプローチ文の下書き","会社",pill("止まっている（覚え直し待ち）","wa","warn")) +
  _staff("経理社員","運営配布","請求書の作成 ／ 入金の照合","会社",pill("稼働中","su","check")) +
  _staff("CS社員","会社作成","問い合わせの一次返信 ／ 近況メール","会社",pill("稼働中","su","check")) +
  f'<a class="card" href="#" style="display:grid;place-items:center;padding:24px;border-style:dashed;color:var(--on-sv)"><div style="text-align:center">{ic("plus")}<div style="font-weight:600;margin-top:6px">AI社員を作る</div><div class="muted" style="font-size:12px">あと 2体</div></div></a>' +
  '</div>')
_as_new = grid([
  card(head("AI社員を作る") + field("名前", inp("","例：見積社員")) +
    field("どこから", '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<label style="display:flex;gap:8px;align-items:flex-start"><input type="radio" name="src" {"checked" if c else ""} style="margin-top:3px;accent-color:#22345C"><div><b>{t}</b><div class="muted" style="font-size:12px">{d}</div></div></label>' for t,d,c in [("運営配布から選ぶ","定義は編集できない。個人ルールだけ足せる",True),("会社で作る","担当業務を高本AIと一緒に定義する",False),("個人で作る","自分だけが使う。会社には見えない",False)]) + '</div>') +
    field("誰に託す", '<select class="inp"><option>自分だけ</option><option>会社の全員</option><option>営業部（部署）</option><option>佐藤</option></select>') +
    btn("高本AIと担当業務を決める","p","clone")),
  card(head("運営配布のAI社員") + table(["AI社員","やること",""], [["見積社員","案件の要件から見積の下書きを作る",btn("選ぶ","o","check")],["議事録社員","打ち合わせの録音から議事録と次のタスクを作る",btn("選ぶ","o","check")],["採用社員","応募者の一次スクリーニング",pill("プロプランのみ","ne")]]) +
    '<div class="muted" style="font-size:12px;margin-top:10px">制限はプラン・会社・権限の3軸。使えないものは理由が出ます。</div>'),
], "g2")
AI_STAFF = ("ai-staff", [("n","一覧","3経路（運営配布／会社作成／個人作成）。",_as),("a","作る","",_as_new)], "", False, {"会社のAI社員":"3","託されたAI社員":"0","作る":""})

# ============================================================ ai-staff-detail
_asd = grid([
  card(f'<a href="v1-ai-staff.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:12px">{ic("undo")}AI社員に戻る</a>'
    f'<div class="card-h">{ic("ai")}<h2 style="font-size:18px">経理社員</h2>{pill("運営配布","ne")}{pill("稼働中","su","check")}</div>' +
    kv([("出どころ","運営配布 · 定義は編集できません"),("託されている","高本（自分）"),("効く範囲","会社"),("直近の実行",'<span class="num">9/10 06:31</span> 入金の照合 2件'),("差し戻し","今週 2回（京蟻 請求書）")]) +
    head("やること（担当業務）", btn("担当業務を編集","o","pen","v1-duties.html")) + table(["業務","いつ","外に出る"], [["納品済み案件の請求書を作る","納品になったら",pill("承認必須","wa")],["入金を照合して台帳に書く","毎朝 6:30",pill("出ない","su")]]) +
    head("個人ルール", sub="運営配布でも、これだけは足せる") + '<div style="display:flex;flex-direction:column;gap:6px;font-size:13.5px">' + "".join(f'<div style="display:flex;gap:9px;align-items:center;padding:9px 11px;background:var(--surface);border-radius:var(--r-md)">{ic("policy")}{t}</div>' for t in ["京蟻は税込を先に書く・月末締め翌月末払い","請求書の備考にプロジェクト名を入れる"]) + f'<div style="display:flex;gap:9px;align-items:center;padding:9px 11px;border:1.5px dashed var(--line);border-radius:var(--r-md);color:var(--on-sv)">{ic("plus")}足す</div></div>'),
  card(head("守るルール") + '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("check")}{t}</div>' for t in ["外に出るものは承認","銀行は触らない（freee 正規APIのみ）","資格情報は預かり先の番号だけ"]) + '</div>') +
  card(head("証跡", sub="直近") + '<div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px">' + "".join(f'<div style="display:flex;gap:9px"><span class="num muted" style="min-width:40px">{t}</span>{x}</div>' for t,x in [("06:42","承認待ちへ（高本AI確認）"),("06:38","差し戻し2 → 期日を修正"),("06:35","差し戻し1 → 税込に修正"),("06:31","入金 2件を台帳に")]) + '</div><div style="margin-top:10px"><a href="v1-audit.html" style="color:var(--primary);font-weight:600;font-size:13px">すべて見る →</a></div>'),
], "g21")
_asd_means = ('<div data-sec="0 1 2 3">' + card(head("使える手段", sub="5 方式。会社が絞った範囲だけ使える") + table(["手段","何に使う","この AI社員","会社の制限"], [
    ["ブラウザ操作","本人のログイン済みセッションで画面を操作（Bridge）",pill("使う","su"),"承認が要るもの：外向きの送信"],["API・正規連携（MCP）","freee・Gmail などの正規 API",pill("使う","su"),"サービス台帳の範囲"],
    ["ローカル（ファイル・PC）","指定したフォルダの読み書き",pill("使う","su"),"フォルダ：~/Kaname だけ"],["人へのハンドオフ","CAPTCHA・禁止サービス・判断が要るものは人に渡す",pill("使う","su"),"—"],
    ["コード実行","集計・変換・グラフ・ファイル処理をコードで正確に",pill("使う","su"),"外部への通信は決まった出口からだけ"]]) +
    note("使える手段は運営配布の定義に含まれる。会社の権限者が「使わせる手段」を絞れる（AI にやらせる範囲・ルールの画面）。", "info")) + '</div>')
_asd_del = ('<div data-sec="0 1 2 3">' + card(head("経理社員 を消すときに起きること", pill("運営配布","ne"), "全 42 種類。引き継ぎ先を決めるまで消せない。運営配布の定義は運営に残り、この会社の設定だけ消える") + leave_table("staff-delete") +
    '<div class="grid g21">' + card(head("引き継ぎ先を決める", sub="高本AIが案を出しました") + table(["何を",("件数","r"),"案","決める"], [
      ["担当業務",("2","n"),"「請求書を作る」「入金を照合」→ 止める（人がやる）か、営業社員に足す",btn("止める","o","pause")+" "+btn("営業社員に足す","g","ai")],["覚えた操作",("1","n"),"freee の入金読み取り → 会社の範囲に昇格して残す",btn("残す","o","check")],
      ["目標の配分 請求の当日発行 100%",("1","n"),"親（会社 売上）に戻して未配分",btn("配り直す","o","layers","v1-goal-allocation.html")],["承認待ち",("1","n"),"セイコー 着手金の請求書 → 破棄（人が作り直す）",btn("先に承認する","o","check","v1-approvals.html")]]) +
      note("決めていないものが <b>3 件</b>。決めるまで「消す」は押せません。", "warn") + '<div class="acts">' + btn("消す（引き継ぎ 1／4 決定）","d","trash") + btn("高本AIの案を全部採る","o","ai") + btn("やめる","g") + '</div>') +
    clone_box("高本AI","消すより「止める」で足りるかもしれません。止めると定義と覚えた操作は残り、月の体数の枠だけ空きます。", btn("止める","o","pause")) + '</div></div>'))
_asd_skill = ('<div data-sec="0 1 2 3 4">' + card(head("使えるスキル", pill("運営配布","ne"), "装着されたスキルと版。会社の権限者は外せる。個人のスキルは足せない") + table(["スキル","種類","版","付けた経路","状態",""], [
    ["営業目標（受託開発）",pill("目標スキル","ne"),"第 3 版","プラン（スタンダード）",pill("使う","su"),btn("外す","g","x")],["担当業務の定義",pill("構築メタ","ne"),"第 5 版","自分のAI（高本AI）経由",pill("使う","su"),""],
    ["請求書の型（税込・内訳）",pill("業務スキル","ne"),"第 2 版 · 第 3 版あり","会社の詳細で配布",pill("版が古い","wa"),btn("版を上げる（運営へ）","o","upload")],["トラブル対応",pill("構築メタ","ne"),"第 4 版","運営",pill("使う","su"),""],
    ["改善提案の作り方",pill("構築メタ","ne"),"第 2 版","運営",pill("外した","ne"),btn("戻す","g","undo")]]) +
    note("担当業務は、会社が決めた定義 ＋ 運営の業務スキル（型）＋ 覚えた操作で動きます。スキルの中身は見えません（名前・目的・版だけ）。どのスキルが働いたかは AI社員の動きと証跡に出ます。", "info") + '<div class="acts">' + btn("会社の範囲で絞る","o","policy","v1-policies.html") + '</div>') + '</div>')
AI_STAFF_DETAIL = ("ai-staff-detail", [("n","中身","託されたAI社員は定義を編集できない。個人ルールだけ足せる。",_asd),("m","使える手段","5 方式と会社の制限。",_asd_means),("k","使えるスキル","装着されたスキルと版。会社の権限者が外せる。",_asd_skill),("x","消す","依存を片づけてから消す。G16。",_asd_del)], LEAVE_CSS, False, {"やること":"2","託し先":"1","守るルール":"3","証跡":"12","使える手段":"5","使えるスキル":"!1"})

SCREENS = [MEMBERS, MEMBER_DETAIL, AI_STAFF, AI_STAFF_DETAIL]

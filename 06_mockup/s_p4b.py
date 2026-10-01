# -*- coding: utf-8 -*-
"""P4：duties / clone-memory / ledger-def / company-model"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _threepane import TP_CSS, TP_JS, vrow, vgroup, ico, dpane, dkv, threepane, qhead
from _views import VIEWS_CSS, view_bar, kanban
from _org import *

# ============================================================ duties（全部＝部署の群で並べる／部署ごと＝列で見る）
DUTIES_DATA = [
 ("営業", [("発注ナビの新着を台帳に入れる","毎朝 6:00 · 100万円以上・Web/アプリ","営業社員","会社",False,1),("アプローチ文を下書きする","新着が入ったら","営業社員","会社",True,0),("見積の下書きを作る","要件が揃ったら","営業社員","部署 · 営業",True,0)]),
 ("経理", [("納品済み案件の請求書を作る","納品になったら · freee 正規API","経理社員","運営配布",True,0),("入金を照合して台帳に書く","毎朝 6:30 · freee から読む","経理社員","運営配布",False,0)]),
 ("CS",   [("問い合わせに一次返信する","承認済みテンプレの範囲 · 値段の話はしない","CS社員","会社",False,0),("納品先に近況メールを出す","納品 3 か月後 · 施策「近況メール」","CS社員","会社",True,0)]),
]
DEPT_C = {"営業":"var(--d-indigo)","経理":"var(--d-amber)","CS":"var(--d-teal)"}
def _duty_row(i, d, sel=False):
    name, when, who, scope, out, learned = d
    chips = [(who, "aiw"), (scope, None)] + ([("外に出る · 承認必須", "wa")] if out else [("外に出ない", "ok")]) + ([(f"覚えた操作 {learned}", None)] if learned else [])
    return vrow(f"d{i}", name, ico("ai"), chips, right=f'<span class="est">{when.split(" · ")[0]}</span>', selected=sel)
def _duty_detail(d, dept):
    name, when, who, scope, out, learned = d
    return (f'<div class="kind task">担当業務 · {dept} · {who}</div><h2>{name}</h2>'
        + field("やること", f'<textarea class="inp" rows="3">{name}。合わないものは理由を付けて見送る。</textarea>')
        + field("いつ", inp(when)) + field("効く範囲", f'<select class="inp"><option>{scope}</option><option>会社</option><option>部署 · {dept}</option><option>個人</option></select>')
        + field("外に出るか", f'<select class="inp"><option>{"出る（承認必須）" if out else "出ない（承認は不要）"}</option><option>{"出ない（承認は不要）" if out else "出る（承認必須）"}</option></select>')
        + (f'<div class="nxt">{ic("route")}<div><b>覚えた操作 {learned} 件</b> · 発注ナビ 新着案件の取り込み · 6 手順 · 最終 9/10 {btn("見る","g","eye","v1-automation-repair.html")}</div></div>' if learned else "")
        + clone_box("高本AI", f"条件を変えると、{who}の次の実行から効きます。この業務は目標「新規リード 60件／月」につながっています。")
        + '<div class="acts">' + btn("保存する","p","check") + btn("引き継ぎ先を変える","o","users") + btn("止める","g","pause") + '</div>')
_q_all = "".join(vgroup(dept, str(len(rows)), "".join(_duty_row(f"{di}{ri}", d, sel=(di == 0 and ri == 0)) for ri, d in enumerate(rows)), sec=di, color=DEPT_C[dept], right=f'<button>{ic("plus")}足す</button>') for di, (dept, rows) in enumerate(DUTIES_DATA))
_p_all = "".join(dpane(f"d{di}{ri}", _duty_detail(d, dept), on=(di == 0 and ri == 0)) for di, (dept, rows) in enumerate(DUTIES_DATA) for ri, d in enumerate(rows))
DUTY_VIEWS = {"全部":"n","層ごと":"k"}
def _dvb(cur): return view_bar(["全部","層ごと"], cur, DUTY_VIEWS, hint=False)
_du = _dvb("全部") + threepane(_q_all, _p_all, head=qhead("担当業務", "3 体 · 7 業務", right=f'<button>{ic("plus")}足す</button>'))
_du_k = _dvb("層ごと") + card(kanban([(dept, DEPT_C[dept], [(name, who, when, ("承認必須" if out else ""), False) for name, when, who, scope, out, learned in rows]) for dept, rows in DUTIES_DATA]) +
   '<div class="muted" style="font-size:12.5px;margin-top:10px">列＝この会社の層（部署）。カードを別の列に落とすと、その層のAI社員に引き継がれます（担当業務の効く範囲もその層に変わります）。層の名前は会社ごとです。</div>')
_du_r2 = card(head("担当業務", sub="会社 → 部署 → 個人") + table(["業務","AI社員","効く範囲","託し先"], [
  ["発注ナビの新着を台帳に入れる",f'{ic("ai")} 営業社員',pill("会社","ne"),"営業部 全員"],
  ["見積の下書きを作る",f'{ic("ai")} 営業社員',pill("部署 · 営業","ne"),"佐藤・田中"],
  ["佐藤の日報をまとめる",f'{ic("ai")} 佐藤の助手',pill("個人 · 佐藤","ne"),"佐藤（本人が作成）"]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">効く範囲（運営／会社／部署／個人）を、担当業務・ルール・テンプレ・覚えた操作・記憶すべてで同じ形で使います。</div>')
_du_test = ('<div data-sec="0 1 2 3">' + grid([card(head("テストで動かす", pill("外に出ない","su","check"), "発注ナビの新着を台帳に入れる · 条件を変えたあとの確認") +
    field("何を", inp("発注ナビの新着を台帳に入れる（営業社員）")) + field("どう変えたか", inp("条件：100万円以上・Web/アプリ → 80万円以上・Web/アプリ/業務システム")) +
    '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin:8px 0 14px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("check")}{x}</div>' for x in ["実データは読む（発注ナビの新着 12 件）","台帳への書き込みは仮想（本番の台帳には入らない）","メール・投稿・外部更新は一切しない","終わったら「本番だとこうなります」を見せる"]) + '</div>' +
    '<div class="acts">' + btn("テストで 1 回動かす","p","play") + btn("やめる","g") + '</div>'),
  card(head("結果（前回 9/10 07:02）") + table(["手順","結果"], [["1 ログイン",pill("OK","su")],["2 新着一覧",pill("OK · 12 件","su")],["3 条件で絞る",pill("OK · 5 件","su")],["4 詳細を読む",pill("OK","su")],["5 台帳へ（仮想）",pill("5 件 · 本番なら案件が 5 件増える","wa")],["6 見送り理由",pill("OK · 7 件","su")]]) +
    clone_box("高本AI","本番だと案件が 5 件増え、うち 2 件は既存の会社です。この条件でよければ「本番で動かす」に切り替えます。", btn("本番で動かす","p","zap")+btn("条件を直す","o","pen")))], "g21") + '</div>')
_du_r1 = ('<div data-sec="0 1 2 3">' + card(head("担当業務", btn("足す","p","plus"), "3 体 · 5 業務 · 層が無いので効く範囲は 会社 か 個人") + table(["担当業務","誰が","いつ","効く範囲","外に出る",""], [
  ["発注ナビの新着を台帳に入れる",f'{ic("ai")} 営業社員',"毎朝 7:00",pill("会社","ne"),"—",btn("開く","g","eye")],["アプローチ文を作る",f'{ic("ai")} 営業社員',"新着ごと",pill("会社","ne"),pill("承認必須","wa"),btn("開く","g","eye")],
  ["請求書を作る",f'{ic("ai")} 経理社員',"月末・着手金",pill("会社","ne"),pill("承認必須","wa"),btn("開く","g","eye")],["入金を照合する",f'{ic("ai")} 経理社員',"毎朝",pill("会社","ne"),"—",btn("開く","g","eye")],
  ["問い合わせに一次返信",f'{ic("ai")} CS社員',"来たら",pill("個人（あなた）","ne"),pill("承認必須","wa"),btn("開く","g","eye")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">人を招いて層を作ると、効く範囲に「部署」が増えます。</div>') + '</div>')
DUTIES = ("duties", [("n","全部","層がある会社は部署の群、無い会社は 会社／個人 の 2 段。",'<div data-roles="R2">' + _du + '</div><div data-roles="R1">' + _du_r1 + '</div>' + TP_JS),("k","層ごと","列＝この会社の層（ここでは部署）。営業なら営業だけを見る。",_du_k),("t","テストで動かす","定義を変えたあと、外に出さずに 1 回動かす。",_du_test),("r2","代表+数人","効く範囲（運営／会社／部署／個人）。",_du_r2)], VIEWS_CSS + TP_CSS, False, {"担当業務":"7","覚えた操作":"1","効く範囲":"3","テストで動かす":""})

# ============================================================ clone-memory（記憶＝ナレッジ。範囲 = 運営／会社／会社が決めた層／個人／AI社員。役割ごとに見える・直せるが変わる：D-073）
# (id, 層, 単位, 種類, 題名, 本文, 出どころ, 日付, 使われた回数)  種類: rule/brain/person/route/book
MEMORIES = [
 ("m0","運営","","rule","外に出るものは必ず承認を挟む","メール・請求書・投稿・台帳の外部更新は、AI社員が作って自分のAIが一次確認し、人が押してから出る。","運営ルール（変えられない）","—",41),
 ("m00","運営","","rule","CAPTCHA は突破しない・銀行はブラウザで触らない","出たら止めて人に渡す。会計は正規連携だけ。","運営ルール（変えられない）","—",7),
 ("m1","会社","","rule","着手金は契約時に 3 割、残金は納品時","請求書は契約時に着手金 30%、納品時に残金 70%。分割の相談があれば高本に聞く。","はじめの設定 · 高本","9/4",14),
 ("m3","会社","","person","京蟻は税込を先に書く・月末締め翌月末払い","請求書は税込を先に。支払条件は月末締め翌月末。担当は法務の方なので文面は丁寧に。","差し戻しから · 高本AI提案 → 高本承認","9/10",3),
 ("m4","会社","","book","見積は必ず 2 案（機能を削った安い方を添える）","1 案だけだと高いと言われて終わる。安い方は機能を削って理由を書く。","高本が教えた","9/5",6),
 ("m5","事業","受託開発","brain","受託は工数の 1.3 倍で見積る","手戻り分を最初から乗せる。乗せないと赤字になる。","高本が教えた","9/3",9),
 ("m6","部署","営業","brain","発注ナビは 100万円以上・Web/アプリだけ拾う","小さい案件は工数が合わない。条件外は理由を付けて見送り、台帳には入れない。","仮説「発注ナビは絞る」から · 高本","9/8",22),
 ("m7","部署","営業","book","アプローチ文は 3 段落・実績は 1 つだけ","長いと読まれない。似た業種の実績を 1 つ選ぶ。","過去のアプローチ文 12 通から · 高本AI提案 → 承認","9/6",9),
 ("m8","部署","経理","rule","請求書は税込表示・内訳の行を付ける","税抜だけの請求書は出さない。消費税の行を必ず入れる。","差し戻しから · 高本AI提案 → 承認","9/10",2),
 ("m9","部署","制作","book","納品物は必ずステージングで 1 日置いてから出す","翌日に見直すと直したい所が出る。1 日置く。","佐藤が教えた","9/2",5),
 ("m10","個人","高本","brain","初回は紹介でも値引きしない","紹介案件でも初回は定価。値引きは 2 件目以降に高本が判断。","会話から · 高本AI提案 → 承認","9/10",4),
 ("m11","個人","高本","book","メールは短く。結論を先に","3 行以内で結論、その下に理由。件名に用件を入れる。","過去メール 38 通から · 高本AI","9/4",31),
 ("m12","個人","高本","person","山田様（セイコー）はメールを好む","電話より返事が早い。午前中に送ると当日に返る。","やりとりから · 高本AI提案 → 承認","9/8",5),
 ("m13","個人","佐藤","book","レビュー指摘は 1 件ずつ Issue に切る","まとめて書くと漏れる。1 指摘 1 Issue。","佐藤が教えた","9/5",3),
 ("m14","個人","佐藤","brain","金曜の午後は打ち合わせを入れない","集中して手を動かす時間。","会話から · 佐藤AI提案 → 佐藤承認","9/9",2),
 ("m15","個人","鈴木","book","進捗は週明けにまとめて見る","月曜の朝に 2 件の段階だけ確認する。","鈴木が教えた","9/8",1),
 ("m16","AI社員","営業社員","route","発注ナビ 新着案件の取り込み（覚えた操作・6 手順）","ログイン → 新着一覧 → 条件で絞る → 案件を開く → 台帳に転記 → 見送り理由を書く。画面が変わると止まる。","高本が画面を見せて覚えさせた","9/2",18),
 ("m17","AI社員","経理社員","book","請求書の下書きの型（京蟻）","税込・内訳あり・期日 10/31。次から差し戻し無しで作れる。","差し戻しの結果 · 高本AI","9/10",1),
 ("m18","AI社員","CS社員","book","一次返信の型（問い合わせ）","承認済みテンプレの範囲だけ。値段の話はしない。","会社作成 · 高本","9/6",12),
]
# 確認待ち（AI が拾ったもの。認めた人の範囲に入る）(id, 層, 単位, 種類, 題名, 出どころ)
PENDING = [("p1","個人","高本","brain","土曜は打ち合わせを入れない","9/6 の会話「土曜は無理」から"),("p2","部署","営業","brain","SOICO は先方の工数表を基準に見積る","9/9 の会話から"),
           ("p3","個人","佐藤","book","納品前チェックは Lighthouse を先に回す","9/10 の会話から")]
KIND_JA = {"rule":"ルール","brain":"判断の癖","person":"相手ごと","route":"覚えた操作","book":"やり方"}
AFFECTS = {"運営":"すべての会社・すべてのAI社員","会社":"会社の全員とすべてのAI社員","個人":"本人と本人のAI","AI社員":"そのAI社員だけ"}
def _affects(l, u): return AFFECTS.get(l) or f"{u}の人と{u}のAI社員"
def _ai_way(l, u):
    return {"運営":"変わらない","個人":"本人のAIの提案 → 本人が認める","AI社員":"AI社員が覚えた → 自分のAIが一次確認 → 管理者が承認"}.get(l) or f"自分のAIの提案 → {editor(l,u)} が承認"
def _mem_row(role, m, sel=False):
    mid, l, u, kind, title, body, src, date, uses = m
    ok = can_edit(role, l, u)
    right = (f'<span class="est">使った {uses} 回</span>' if ok else lock_chip()) + (f'<span class="est">{date}</span>' if date != "—" else "")
    return vrow(f"{role}-{mid}", title, ico(kind), [(KIND_JA[kind], None), (src.split(" · ")[0], None)], right=right, selected=sel)
def _mem_detail(role, m):
    mid, l, u, kind, title, body, src, date, uses = m
    ok = can_edit(role, l, u); c = LAYER_C[l]
    you = (f'<span class="you ok">{ic("check")}あなた：{you_line(role,l,u)}</span>' if ok else f'<span class="you">{ic("lock")}あなた：{you_line(role,l,u)}</span>')
    acts = ('<div class="acts">' + btn("直す","p","pen") + btn("範囲を変える","o","layers") + btn("消す","g","trash") + btn("使われた場面を見る","g","route","v1-ai-activity.html") + '</div>' if ok else
            '<div class="acts">' + btn(f"{editor(l,u).split('（')[0]} に直してもらう","o","chat","v1-clone-chat.html") + btn("使われた場面を見る","g","route","v1-ai-activity.html") + '</div>')
    return (f'<div class="kind" style="color:{c}">{scope_name(l,u)} · {KIND_JA[kind]}</div><h2>{title}</h2><div style="margin:-6px 0 12px">{you}</div>'
        f'<div class="mail" style="white-space:normal">{body}</div>'
        + dkv([("効く相手", _affects(l,u)), ("編集できる人", f"<b>{editor(l,u)}</b>"), ("AI が変えるとき", _ai_way(l,u)), ("出どころ", src), ("覚えた日", date), ("使われた回数", f"{uses} 回")]) + acts)
def _pend_detail(role, pd):
    pid, l, u, kind, title, src = pd
    return (f'<div class="kind" style="color:var(--st-warning)">確認待ち · {scope_name(l,u)} · {KIND_JA[kind]}</div><h2>{title}</h2>'
        f'<div class="ainote">{me_of(role)}AIが {src} 拾いました。認めると「{scope_name(l,u)}」の記憶になり、{_affects(l,u)} に効きます。編集は {editor(l,u)}。</div>'
        '<div class="acts">' + btn("そのとおり（覚える）","p","check") + btn("範囲を変えて覚える","o","layers") + btn("違う","g","x") + '</div>')
def _mem_queue(role):
    cfg = ROLE_ORG[role]; me = cfg["me"]; out = ""; sec = 0; first = True
    order = ["運営", "会社"] + cfg["layers"] + ["個人", "AI社員"]
    for l in order:
        items = [m for m in MEMORIES if m[1] == l and can_see(role, l, m[2])]
        if not items: continue
        units = []
        for m in items:
            if m[2] not in units: units.append(m[2])
        rows = ""; any_edit = False
        for u in units:
            ok = can_edit(role, l, u); any_edit |= ok
            if len(units) > 1 or (u and l != "個人"):
                lbl = (f"{u}（あなた）" if (l == "個人" and u == me) else u)
                rows += f'<div class="qnote" style="border-bottom:0;padding-bottom:2px"><b style="color:{LAYER_C[l]}">{lbl}</b> · 編集：{editor(l,u)}' + ("" if ok else f' · {lock_chip()}') + '</div>'
            for m in items:
                if m[2] != u: continue
                rows += _mem_row(role, m, sel=first); first = False
        title = "自分" if (l == "個人" and role == "R1") else l
        right = (f'<button>{ic("plus")}教える</button>' if any_edit else lock_chip("変えられない" if l == "運営" else "見るだけ"))
        out += vgroup(title, str(len(items)), rows, sec=sec, color=LAYER_C[l], right=right); sec += 1
    pend = [pd for pd in PENDING if can_see(role, pd[1], pd[2]) and can_edit(role, pd[1], pd[2])]
    if pend:
        prow = "".join(vrow(f"{role}-{pid}", title, ico(kind), [(scope_name(l,u), None), (src, None)], right=f'<span class="act">{ic("check")}そのとおり</span>') for pid, l, u, kind, title, src in pend)
        out += vgroup("確認待ち", str(len(pend)), prow + f'<div class="qnote">{me}AIが会話から拾ったもの。認めてから使います。人が直接書いたものは即反映。</div>', sec=5, color="var(--st-warning)")
    return out
def _mem_panes(role):
    seen = [m for m in MEMORIES if can_see(role, m[1], m[2])]
    pend = [pd for pd in PENDING if can_see(role, pd[1], pd[2]) and can_edit(role, pd[1], pd[2])]
    return ("".join(dpane(f"{role}-{m[0]}", _mem_detail(role, m), on=(i == 0)) for i, m in enumerate(seen))
            + "".join(dpane(f"{role}-{pd[0]}", _pend_detail(role, pd), on=False) for pd in pend))
def _mem_head(role):
    cfg = ROLE_ORG[role]; layers = "会社 › " + " › ".join(cfg["layers"]) + " › 個人" if cfg["layers"] else "個人だけ（会社の層は無い）"
    return qhead("記憶とナレッジ", right=f'<button>{ic("plus")}教える</button>') + f'<div class="qnote" style="padding-top:0">層：{layers}。自分のものは自由。それ以外は権限のある人だけが直せる</div>'
_cm = "".join(f'<div data-roles="{r}">' + threepane(_mem_queue(r), _mem_panes(r), head=_mem_head(r)) + '</div>' for r in ("R1","R2","R3","R4"))

# ---- 教える：書く → 誰に効くか（直せる範囲だけ選べる）→ 種類 → 自分のAIの「こう覚えます」→ 覚えさせる。ファイルからも
TEACH_CSS = """
.teach{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.teach .ta{width:100%;min-height:150px;font-size:15px;line-height:1.7;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);resize:vertical}
.teach .ta:focus{outline:2px solid var(--primary);outline-offset:-1px}
.teach .ex{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.teach .ex button{font-size:12px;padding:4px 10px;border:1px dashed var(--line);border-radius:var(--r-full);color:var(--on-sv);background:var(--card)}
.teach .ex button:hover{border-color:var(--primary);color:var(--primary)}
.teach h4{font-size:12.5px;font-weight:600;color:var(--on-sv);margin:18px 0 8px}
.scp2{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))}
.scp2 label{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);cursor:pointer;font-size:13px;position:relative}
.scp2 label::before{content:"";width:4px;border-radius:2px;background:var(--lc);align-self:stretch;flex:none}
.scp2 label b{display:block}.scp2 label small{display:block;color:var(--on-sv);font-size:11.5px;line-height:1.5;margin-top:2px}
.scp2 label input{position:absolute;opacity:0}
.scp2 label:has(input:checked){border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-c)}
.scp2 label.no{opacity:.55;cursor:not-allowed;background:var(--surface)}
.scp2 label .ro{position:absolute;right:10px;top:10px}
.kinds{display:flex;gap:6px;flex-wrap:wrap}
.kinds label{display:inline-flex;gap:6px;align-items:center;padding:6px 12px;border:1px solid var(--line);border-radius:var(--r-full);font-size:13px;cursor:pointer;background:var(--card)}
.kinds label input{position:absolute;opacity:0}.kinds label:has(input:checked){background:var(--primary);color:#fff;border-color:transparent}
.kinds label svg{width:14px;height:14px}
.prev{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:14px 16px;position:sticky;top:12px}
.prev .ph{display:flex;gap:8px;align-items:center;font-weight:700;font-size:13.5px;margin-bottom:10px}.prev .ph .av{width:24px;height:24px;border-radius:50%;background:var(--primary-c);color:var(--on-primary-c);display:grid;place-items:center}
.prev .ph .av svg{width:13px;height:13px}
.prev .card2{border:1px solid var(--line);border-radius:var(--r-md);padding:10px 12px;font-size:13px;background:var(--surface)}
.prev .card2 .k{font-size:11px;color:var(--on-sv);font-weight:600;margin-bottom:2px}
.prev .card2+.card2{margin-top:8px}
.drop{margin-top:14px;border:1px dashed var(--line);border-radius:var(--r-lg);padding:16px;text-align:center;font-size:12.5px;color:var(--on-sv);background:var(--surface)}
.drop svg{display:block;margin:0 auto 6px;width:20px;height:20px}
@media(max-width:1023px){.teach{grid-template-columns:1fr}.prev{position:static}}
"""
def _teach(role):
    cfg = ROLE_ORG[role]; me = cfg["me"]
    scopes = [("個人", me, f"自分だけ", "本人が自由に直せる"), ]
    if role == "R1": scopes += [("AI社員","営業社員","AI社員 営業社員","担当業務の管理者（あなた）")]
    else:
        for l in cfg["layers"]:
            for u, lead in UNITS[l]:
                if can_see(role, l, u) or role == "R2": scopes.append((l, u, f"{l} {u}", f"{u}の全員に効く · 編集：{editor(l,u)}"))
        scopes.append(("会社", "", "会社の全員", "全員とすべてのAI社員に効く · 編集：代表・権限のある人"))
        scopes.append(("AI社員", "経理社員", "AI社員 経理社員", "そのAI社員だけ · 編集：担当業務の管理者"))
    cards = ""
    for i, (l, u, name, sub) in enumerate(scopes):
        ok = can_edit(role, l, u)
        cards += (f'<label class="{"" if ok else "no"}" style="--lc:{LAYER_C[l]}"><input type="radio" name="sc-{role}" {"checked" if i == 0 else ""} {"" if ok else "disabled"}><div><b>{name}</b><small>{sub}</small></div>'
                  + ("" if ok else lock_chip("権限なし")) + '</label>')
    kinds = "".join(f'<label><input type="radio" name="kd-{role}" {"checked" if i == 0 else ""}>{ic(ic_)}{ja}</label>' for i, (ic_, ja) in enumerate([("brain","判断の癖"),("policy","ルール"),("book","やり方"),("user","相手ごと")]))
    left = (f'<textarea class="ta" placeholder="覚えてほしいことを、そのまま書く。例：見積は必ず 2 案出す。安い方は機能を削って理由を書く。"></textarea>'
            '<div class="ex">' + "".join(f'<button>{x}</button>' for x in ["初回は値引きしない","メールは 3 行以内で結論を先に","山田様は午前中にメール","納品は 1 日置いてから"]) + '</div>'
            f'<h4>誰に効くか（直せる範囲だけ選べます）</h4><div class="scp2">{cards}</div>'
            f'<h4>種類</h4><div class="kinds">{kinds}</div>'
            f'<div class="drop">{ic("upload")}ファイル・スクショ・メールをここに落とすと、{me}AIが読んで「覚える候補」を出します（形式は問いません）</div>'
            '<div class="acts">' + btn("覚えさせる","p","brain") + btn("やめる","g") + '</div>')
    right = (f'<div class="prev"><div class="ph"><span class="av">{ic("clone")}</span>{me}AI · こう覚えます</div>'
             '<div class="card2"><div class="k">題名</div><b>見積は必ず 2 案（安い方は機能を削る）</b></div>'
             '<div class="card2"><div class="k">効く相手</div>' + ("あなたとあなたのAI" if role != "R2" else "あなたとあなたのAI（範囲を変えると広がります）") + '</div>'
             '<div class="card2"><div class="k">いつ使うか</div>見積の下書きを作るとき・提案の文面を書くとき</div>'
             '<div class="card2"><div class="k">出どころ</div>あなたが 9/15 に教えた（即反映）</div>'
             f'<div class="muted" style="font-size:12px;margin-top:10px">人が書いたものは承認なしで即反映。{me}AIが毎朝のまとめで拾ったものは、あなたの範囲なら自動で入り（前と後を残して戻せる）、上の層へはあなたが送ってから確認待ちに置きます。</div></div>')
    return f'<div data-roles="{role}" class="teach"><div>{left}</div>{right}</div>'
_cm_teach = '<div data-sec="0 1 2 3 4 5">' + "".join(_teach(r) for r in ("R1","R2","R3","R4")) + '</div>'
from _memdigest import review_queue, DIGEST_CSS
_cm_up = ('<div data-sec="0 1 2 3 4 5"><div data-roles="R1 R2">' + review_queue() + '</div><div data-roles="R3 R4">' + card(head("確認待ち") + '<p class="muted" style="font-size:14px">あなたが確認する層はありません。あなたが上げた候補は「送った」のまま、OK が出るまであなたの記憶として効いています。</p>') + '</div></div>')
CLONE_MEMORY = ("clone-memory", [("n","範囲ごと","",_cm + TP_JS),("up","確認待ち（上がってきた記憶・食い違い）","上げ先の層の確認者が決める。確認者がいない層は 1 つ上へ。決まるまでは送った人の記憶として効く。決めたら両者に知らせる。",_cm_up),("t","教える","人が書いたものは即反映。AIが拾ったものは提案→承認。直せる範囲だけ選べる。",_cm_teach)],
  TP_CSS + ORG_CSS + TEACH_CSS + DIGEST_CSS, False, {"運営":"2","会社":"3","層ごと":"5","個人":"3","AI社員":"3","確認待ち":"!2"})

# ============================================================ ledger-def
_ld = grid([
  card(head("台帳「案件」の形", btn("台帳を足す","g","plus")) +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:8px">段階</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">' + "".join(
      f'<span style="display:inline-flex;gap:6px;align-items:center;font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:var(--r-full);background:var(--primary-c)">{s}{ic("x")}</span>'
      for s in ["引合","提案","受注","制作中","納品","請求","入金"]) + f'<span style="display:inline-flex;gap:6px;align-items:center;font-size:12.5px;padding:5px 11px;border-radius:var(--r-full);border:1.5px dashed var(--line);color:var(--on-sv)">{ic("plus")}段階を足す</span></div>' +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:8px">項目</div>' +
    table(["項目","種類","必須",""], [["案件名","文字",ic("check"),""],["顧客","文字",ic("check"),""],["金額","金額（円）",ic("check"),""],["着手金","金額（円）","",""],["確度","割合（%）","",""],["出どころ","選択（紹介／発注ナビ／既存客）","",""],["担当","メンバー",ic("check"),""],
      [f'<span style="color:var(--on-sv)">{ic("plus")} 項目を足す</span>',"","",""]]) +
    '<div style="display:flex;gap:9px;margin-top:14px">' + btn("保存する","p","check") + btn("やめる","g") + '</div>'),
  card(head("既存への影響") + '<p style="font-size:13.5px;line-height:1.8">台帳「案件」には <b>6件</b> あります。項目を消すと値も消えます。段階を消すと、その段階にある案件は「未設定」になります。</p>' +
    clone_box("高本AI","「確度」を足すなら、過去の6件は私が提案書の内容から埋めておきます。合っているかは台帳で直せます。") +
    '<div style="height:16px"></div>' + head("計算しないが、結果は持つ") + '<p class="muted" style="font-size:12.5px;line-height:1.8">請求や会計の計算は freee 等に任せます。Kaname の台帳は「結果」だけを持ちます（請求済み・入金済み・金額）。だから台帳の形は自由に変えられます。</p>'),
], "g21")
LEDGER_DEF = ("ledger-def", [("n","項目と段階","台帳は『計算しないが、結果は持つ』。台帳ごとに画面を作らない。",_ld)], "", False, {"項目":"7","段階":"7","既存への影響":"6"})

# ============================================================ company-model（図で見せる：中心の定義と、それを読む 3 つ。周りの 7 つは小さな図つき）
CM_CSS = """
.hub{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;margin:4px 0 22px}
.hub .core{border:2px solid var(--primary);border-radius:var(--r-xl);padding:18px 22px;background:var(--card);text-align:center;min-width:260px}
.hub .core .v{font-size:12px;color:var(--on-sv);font-weight:600;letter-spacing:.06em}
.hub .core h2{font-size:22px;font-weight:700;margin:2px 0 4px}
.hub .core .m{font-size:12.5px;color:var(--on-sv)}
.hub .rd{display:flex;flex-direction:column;gap:8px}
.hub .rd>div{display:flex;gap:10px;align-items:center;font-size:13px;padding:9px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card)}
.hub .rd>div svg{color:var(--primary)}
.hub .rd>div b{display:block;font-size:13px}.hub .rd>div small{color:var(--on-sv);font-size:11.5px}
.hub .arr{display:grid;gap:8px;justify-items:end}
.hub .arr span{font-size:11px;color:var(--on-sv);border-bottom:1px dashed var(--line);padding-bottom:2px}
.cmg{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}
.cmc{display:block;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:14px 16px 12px;min-height:150px}
.cmc:hover{border-color:var(--primary);text-decoration:none}
.cmc .h{display:flex;gap:9px;align-items:center;margin-bottom:10px}
.cmc .h .ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center}
.cmc .h b{font-size:15px}.cmc .h .n{margin-left:auto;font-size:12px;color:var(--on-sv)}
.cmc .viz{min-height:64px}
.cmc .foot{font-size:11.5px;color:var(--on-sv);margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cmc .foot .chg{color:var(--st-progress);font-weight:700}
.mb{display:flex;align-items:center;gap:8px;font-size:12px;margin:3px 0}
.mb .l{width:64px;color:var(--on-sv);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mb .b{flex:1;height:6px;background:var(--sv);border-radius:3px;overflow:hidden}.mb .b i{display:block;height:100%;border-radius:3px;background:var(--primary)}
.mb .v{width:44px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.stg{display:flex;gap:3px;align-items:flex-end;height:70px;margin-top:4px}
.stg div{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--on-sv)}
.stg div i{width:100%;background:var(--primary-c);border-radius:3px 3px 0 0;display:block}
.stg div b{font-size:12px;color:var(--on-surface)}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cols>div{border-radius:var(--r-md);padding:8px 10px;background:var(--surface);font-size:12px}
.cols>div b{display:block;font-size:12.5px;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.cols>div b::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--dc)}
.cols>div span{display:block;color:var(--on-sv);line-height:1.5}
.ppl{display:flex;flex-direction:column;gap:6px;font-size:12.5px}
.ppl>div{display:flex;align-items:center;gap:8px}
.ppl .av{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--primary-c);color:var(--on-primary-c);flex:none}
.ppl .av.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.ppl .st{margin-left:auto;width:8px;height:8px;border-radius:50%;background:var(--st-success)}.ppl .st.wa{background:var(--st-warning)}
.ppl .sub{margin-left:32px;color:var(--on-sv);font-size:12px}
.org{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
.org .row{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.org .p{border:1px solid var(--line);border-radius:var(--r-full);padding:2px 10px;background:var(--card);display:inline-flex;gap:5px;align-items:center}
.org .p.aiw{background:var(--tertiary-c);color:var(--on-tertiary-c);border-color:transparent}
.org .ln{width:1px;height:8px;background:var(--line)}
.rls{display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.rls>div{display:flex;gap:8px;align-items:center}
.rls>div svg{width:14px;height:14px;flex:none}
.rls .k{font-size:11px;font-weight:700;padding:1px 7px;border-radius:var(--r-full);background:var(--sv);color:var(--on-sv);margin-left:auto;white-space:nowrap}
.rls .k.no{background:#FEE2E2;color:#991B1B}.rls .k.ok{background:#FCEBD5;color:#7E570D}
.scp{display:flex;gap:6px;flex-wrap:wrap}
.scp span{font-size:12px;padding:3px 9px;border-radius:var(--r-full);background:var(--surface);display:inline-flex;gap:6px;align-items:center}
.scp span i{width:8px;height:8px;border-radius:50%;display:inline-block;background:var(--dc)}
.scp span b{font-variant-numeric:tabular-nums}
@media(max-width:1023px){.hub{grid-template-columns:1fr}.hub .arr{justify-items:start}}
"""
def _cmcard(icon, kind, title, n, viz, foot, href):
    return (f'<a class="cmc" href="{href}"><div class="h"><span class="ico {kind}">{ic(icon)}</span><b>{title}</b><span class="n">{n} {ic("right")}</span></div>'
            f'<div class="viz">{viz}</div><div class="foot">{foot}</div></a>')
_viz_goal = "".join(f'<div class="mb"><span class="l">{l}</span><span class="b"><i style="width:{p}%"></i></span><span class="v">{p}%</span></div>' for l, p in [("受注 10件",40),("売上 1,200万",69),("納期遵守 95%",100)])
_viz_ledger = '<div class="stg">' + "".join(f'<div><b>{n}</b><i style="height:{max(6, n*5)}px"></i>{s}</div>' for s, n in [("引合",4),("提案",3),("受注",2),("制作",3),("納品",1),("請求",2),("入金",6)]) + '</div>'
_viz_duty = '<div class="cols">' + "".join(f'<div style="--dc:{DEPT_C[d]}"><b>{d} {len(rows)}</b>' + "".join(f'<span>{r[0][:14]}</span>' for r in rows[:2]) + '</div>' for d, rows in DUTIES_DATA) + '</div>'
_viz_staff = '<div class="ppl">' + "".join(f'<div><span class="av aiw">{ic("ai")}</span>{n}<span class="muted" style="font-size:11.5px">{s}</span><span class="st{" wa" if w else ""}"></span></div>' for n, s, w in [("営業社員","運営配布 · 止まっている",True),("経理社員","運営配布 · 稼働中",False),("CS社員","会社作成 · 稼働中",False)]) + '</div>'
_viz_org = (f'<div class="org"><div class="row"><span class="p"><b>高本</b> 代表</span></div><span class="ln"></span><div class="row"><span class="p">田中 · 担当者</span><span class="p">佐藤 · 担当者</span><span class="p">鈴木 · 閲覧</span><span class="p">山本 · 招待中</span></div>'
            f'<span class="ln"></span><div class="row"><span class="p aiw">{ic("ai")}営業社員</span><span class="p aiw">{ic("ai")}経理社員</span><span class="p aiw">{ic("ai")}CS社員</span></div></div>')
_viz_rule = '<div class="rls">' + "".join(f'<div>{ic(i)}{t}<span class="k {k}">{kl}</span></div>' for i, t, k, kl in [("ban","銀行はブラウザで触らない","no","運営"),("ban","CAPTCHA は突破しない","no","運営"),("inbox","外に出るものは承認必須","ok","会社"),("flag","初回は値引きしない","","個人")]) + '</div>'
_viz_mem = '<div class="scp">' + "".join(f'<span style="--dc:{c}"><i></i>{k} <b>{n}</b></span>' for k, n, c in [("会社",4,"var(--d-indigo)"),("部署",3,"var(--d-teal)"),("個人",3,"var(--d-plum)"),("AI社員",2,"var(--tertiary)"),("確認待ち",2,"var(--st-warning)")]) + '</div><div class="muted" style="font-size:12px;margin-top:8px">直近：京蟻は税込を先に（会社）・請求書は内訳の行を付ける（経理）</div>'
_cmod = ('<div class="hub"><div class="arr"><span>画面が読む → 1 画面が定義どおりに描く</span><span>AI社員が読む → 何のための仕事か理解して動く</span><span>自動実行が読む → いつ何を起動するか定義から</span></div>'
  '<div class="core"><div class="v">会社モデル · 第 4 版 · 9/10</div><h2>ENGINE BASE の定義</h2><div class="m">目標 · 台帳 · 担当業務 · AI社員 · 組織 · ルール · 記憶 ── 全部データ。コードではない</div></div>'
  f'<div class="rd"><div>{ic("today")}<div><b>画面</b><small>40 画面がこの定義を読む</small></div></div><div>{ic("ai")}<div><b>AI社員 3 体</b><small>担当業務・ルール・記憶を読んで動く</small></div></div><div>{ic("zap")}<div><b>自動実行</b><small>毎朝 6:00 / 6:30 / 納品時</small></div></div></div></div>'
  '<div class="cmg">' +
  _cmcard("target","person","目標","5 層", _viz_goal, '<span class="chg">第 3 版で改訂</span>· 未配分 0', "v1-goals.html") +
  _cmcard("ledger","route","台帳の定義","3 台帳", _viz_ledger, '案件 7 段階 · 請求 4 · 問い合わせ 4 · レコード 21', "v1-ledger-def.html") +
  _cmcard("duty","building","担当業務","7 業務", _viz_duty, '<span class="chg">第 4 版で変更</span>· 発注ナビの条件', "v1-duties.html") +
  _cmcard("ai","aiw","AI社員","3 体", _viz_staff, 'プラン上限 5 · 運営配布 2 · 会社作成 1', "v1-ai-staff.html") +
  _cmcard("users","person","組織","4 人 + 3 体", _viz_org, '層：会社 › 事業 › 部署 › 個人（この会社の呼び方）', "v1-members.html") +
  _cmcard("policy","rule","ルール","8", _viz_rule, '運営 4（変更不可）· 会社 3 · 個人 1', "v1-policies.html") +
  _cmcard("brain","brain","記憶とナレッジ","14", _viz_mem, '<span class="chg">第 4 版で +2</span>', "v1-clone-memory.html") +
  '</div>')
_cmod_ver = card(head("版の履歴", sub="会社モデル全体") + table(["版","日付","変わったところ","誰が"], [
  ["第4版",("9/10","n"),"担当業務の条件・記憶 2件","高本AI（承認済み）"],["第3版",("9/8","n"),"目標「今期の売上」改訂","高本"],["第2版",("9/5","n"),"本番切替 · AI社員 3体 確定","高本"],["第1版",("9/4","n"),"はじめの設定（高本AIのたたき台）","高本AI → 高本"]]))
_cmod_tpl = card(head("テンプレ", sub="定義のスナップショット") + table(["テンプレ","出どころ","中身",""], [
  ["受託開発（一人社長）",pill("運営配布","ne"),"目標 2階層 · 台帳 3 · AI社員 3",btn("これを元にした","g")],["自社の現在の定義",pill("会社作成","ne"),"第4版のスナップショット",btn("保存する","o","download")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">テンプレは自動では共有されません。運営配布・各社作成・明示的な公開だけです。業界別の別製品は作りません。定義のスナップショットが違うだけです。</div>')
_cmod_r1 = ('<div data-sec="0 1 2 3">' + card(head("会社モデル 第 4 版", btn("改訂する","o","pen","v1-goal-edit.html"), "層が無い会社。会社 → あなた → AI社員 の 3 段だけ") + '<div class="hub">' +
  '<div class="hub-c"><b>会社（あなた）</b><small>受注 10 件／四半期 · 売上 3,000 万</small></div>' +
  '<div class="hub-r"><div class="hub-c"><b>あなた</b><small>受注 6 件 · 提案 · 制作</small></div><div class="hub-c"><b>営業社員</b><small>新規リード 40 件 · 発注ナビ</small></div><div class="hub-c"><b>経理社員</b><small>請求の当日発行 100%</small></div><div class="hub-c"><b>CS社員</b><small>一次返信 24h</small></div></div></div>' +
  '<div class="muted" style="font-size:12px;margin-top:10px">人を招くと「層」が増え、目標は層ごとに配れるようになります。</div>') + '</div>')
COMPANY_MODEL = ("company-model", [("n","全体","製品の背骨。1つの定義を全員が読む。層が無い会社は 会社 → あなた → AI社員。",'<div data-roles="R2">' + _cmod + '</div><div data-roles="R1">' + _cmod_r1 + '</div>'),("v","版の履歴","",_cmod_ver),("t","テンプレ","自動共有しない。業界別製品は作らない。",_cmod_tpl)],
  CM_CSS + TP_CSS, False, {"全体":"","版の履歴":"4","テンプレ":"2"})

SCREENS = [DUTIES, CLONE_MEMORY, LEDGER_DEF, COMPANY_MODEL]

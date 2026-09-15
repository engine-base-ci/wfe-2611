# -*- coding: utf-8 -*-
"""P2 毎日：clone-chat（会話モード）/ search。会話の部品は _wiz（D-066）で、右パネル・はじめの設定と共通。"""
from _icons import ic
from _parts import *
from _wiz import *

CHAT_CSS = WIZ_CSS + """
.tc{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);margin-top:10px;overflow:hidden}
.tc-h{display:flex;gap:9px;align-items:center;padding:10px 13px;background:var(--surface);font-size:12.5px;font-weight:600}
.tc-h .st{margin-left:auto}
.tc-b{padding:11px 13px;font-size:13px}
.tl{display:flex;flex-direction:column;gap:0}
.tl>div{display:flex;gap:10px;align-items:flex-start;padding:6px 0;font-size:12.5px}
.tl>div .d{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none;background:var(--neutral)}
.tl>div.done .d{background:var(--st-success)}.tl>div.now .d{background:var(--st-progress);box-shadow:0 0 0 3px #DBE5FB}
.tl>div .t{color:var(--on-sv);min-width:42px;font-variant-numeric:tabular-nums}
.gate{border-left:3px solid var(--st-warning);background:#FEF6EC}
.gate .tc-h{background:transparent}
.mem{border-left:3px solid var(--tertiary);background:var(--tertiary-c)}
.att{display:flex;gap:9px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-size:12.5px;margin-top:6px}
.branch{display:inline-flex;gap:6px;align-items:center;font-size:11.5px;color:var(--on-sv);margin-top:6px}
.branch button{border:1px solid var(--line);border-radius:var(--r-full);padding:1px 8px;font-size:11px}
.welcome{padding:26px 8px 10px}
.welcome h2{font-size:20px;font-weight:700;margin-bottom:6px}
.prompts{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));margin-top:14px}
.prompts button{text-align:left;border:1px solid var(--line);border-radius:var(--r-lg);padding:12px 13px;background:var(--card);font-size:13px;line-height:1.6}
.prompts button:hover{border-color:var(--primary)}
.prompts button b{display:block;font-size:12px;color:var(--on-sv);font-weight:600;margin-bottom:3px}
.chatwrap{max-width:920px;margin:0 auto;min-width:0;width:100%}   /* auto マージンのグリッド子は fit-content になり中身の最小幅で広がる。幅を明示して中身側で折り返す */   /* グリッドの子は min-width:auto で中身の幅に広がる。狭い幅では中身を折り返す */
.convo{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}
.convo.closed{grid-template-columns:minmax(0,1fr)}
.convo.closed .ctree{display:none}
.ctree{position:sticky;top:60px;align-self:start}
.ctree .card{padding:14px}
.ctree .tl>div{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:12px}
.ctree .tl .d{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none;background:var(--neutral)}
.ctree .tl .done .d{background:var(--st-success)}.ctree .tl .now .d{background:var(--st-progress)}
.ctop{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--on-sv);margin-bottom:12px;flex-wrap:wrap}
.ctop .crumbs{min-width:0;flex:1 1 160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctop .crumbs b{color:var(--on-surface)}
@media(max-width:1180px){.convo{grid-template-columns:minmax(0,1fr)}.ctree{display:none}}
/* 固定枠（D-072）：会話の中だけがスクロールし、見出し・入力欄・この会話の動き は動かない */
@media(min-width:1024px){
  .convo[data-fix]{height:calc(100vh - var(--fix-top,180px) - var(--fix-bottom,0px));min-height:0;margin-bottom:-64px}
  .convo[data-fix] .chatwrap{display:flex;flex-direction:column;min-height:0;height:100%}
  .convo[data-fix] .chatwrap .ctop{flex:none}
  .convo[data-fix] .chatwrap .chat{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 12px 0;overscroll-behavior:contain}
  .convo[data-fix] .chatwrap .composer{position:static;flex:none;padding-bottom:8px}
  .convo[data-fix] .ctree{position:static;overflow-y:auto;min-height:0;align-self:stretch}
}
"""

def ctop(area, obj, flow="今日"):
    return (f'<div class="ctop"><span class="crumbs">{area} › <b>{obj}</b> · {flow}</span><span class="pill p-ne" style="font-size:11px">高本AIが分類</span>'
            f'<span class="sp" style="flex:1"></span><button class="btn btn-g btn-sm ctree-toggle">{ic("route")}この会話の動き</button></div>')
def ctree_card(rows):
    tl = "".join(f'<div class="{c}"><span class="d"></span><span>{t}</span></div>' for c,t in rows)
    return (f'<aside class="ctree"><div class="card"><div style="font-size:12px;font-weight:700;color:var(--on-sv);margin-bottom:6px">この会話の動き（誰が何をしたか）</div>'
            f'<div class="tl">{tl}</div><a href="v1-ai-activity.html" style="font-size:12px;color:var(--primary);font-weight:600;display:inline-block;margin-top:8px">動きを全部見る →</a></div></aside>')
TREE_SEIKO=[("done","高本AI が配った 09:14"),("done","経理社員 受け取り → 台帳を読む"),("done","経理社員 freee で下書き（正規API）"),("done","高本AI 一次確認 → 差し戻し"),("done","経理社員 文面を直す"),("done","高本AI 確認 OK"),("now","承認待ち（あなた）")]

def tool_card(title, who, steps, state, foot=""):
    tl = "".join(f'<div class="{c}"><span class="d"></span><span class="t">{t}</span><span>{x}</span></div>' for c,t,x in steps)
    return (f'<div class="tc"><div class="tc-h">{ic("ai")}{who} ── {title}<span class="st">{state}</span></div>'
            f'<div class="tc-b"><div class="tl">{tl}</div>{foot}</div></div>')
def gate_card(title, body, memo):
    return (f'<div class="tc gate"><div class="tc-h">{ic("inbox")}承認待ち ── {title}<span class="st">{pill("高本AI確認済み","su","check")}</span></div>'
            f'<div class="tc-b">{body}<div class="ai" style="margin-top:10px"><div class="ai-h">{ic("clone")}確認メモ</div>{memo}</div>'
            f'<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">{btn("承認して送る","p","send")}{btn("直してから","o","pen")}{btn("止める（差し戻し）","d","undo")}</div></div></div>')
def side_card():
    return card(head("高本AIが今できること") + capabilities())

def state(area, obj, flow, body, tree=True, composer=None):
    return ('<div class="convo' + ('' if tree else ' closed') + '" data-fix><div class="chatwrap">' + ctop(area, obj, flow) +
            '<div class="chat">' + body + '</div>' + (composer or composer3()) + '</div>' + ctree_card(TREE_SEIKO) + '</div>')

SEIKO_GATE = gate_card("セイコー 着手金 請求書 990,000円",
   kv([("宛先","株式会社セイコー 山田 様"),("金額",'<span class="num">990,000</span> 円（税込）'),("期日",'<span class="num">2026-09-30</span>'),("経路","メール送付 · 送信の直前で止めています"),("本文","「先日はありがとうございました。着手金のご請求を…」"+cite(1,"本文を全部見る"))]),
   "契約書 "+cite(2,"案件 セイコー")+" の「着手金 30%・契約時」から作りました。京蟻のときの差し戻し（税込を先に書く）は記憶 "+cite(3,"判断の癖")+" から反映済みです。")

# ---- 指示する（配布・承認・引用）
_cc = state("営業","案件 セイコー","今日",
  daysep("今日 9/10（水）") +
  umsg("セイコーの着手金、請求書作っておいて", read="高本AI が読んだ 09:14") +
  cmsg("経理社員に配りました。案件「セイコー 食品パッケージ画像編集SaaS」の着手金 <b>990,000円（税込）</b>で作らせています。" +
       tool_card("着手金 990,000 の請求書を作る","経理社員",
         [("done","09:14","高本AIが指示を配った（案件・金額・期日を渡す）"),("done","09:15","経理社員が下書きを作った（freee 正規API）"),
          ("done","09:16","高本AIが一次確認 → 税込表示OK・期日 契約時 OK"),("now","09:16","承認待ちに上げた")],
         pill("承認待ち","wa","clock"), f'<div style="margin-top:8px"><a href="v1-clone-thread.html" style="color:var(--primary);font-weight:600;font-size:12.5px">やりとりを見る →</a></div>') +
       SEIKO_GATE, conf="hi"))

# ---- 選択肢で答える（その他・あとで）
_cc_choice = state("営業","案件 セイコー","今日",
  umsg("セイコーの追い、どうする？") +
  cmsg("提案から7日、先方の検討期限が明後日です。3つ考えられます。どれにしますか？",
       opts=["追いメールを送る（下書きあり）","電話する（明日 10:00 に予定を入れる）","来週まで待つ"], conf="lo") +
  umsg("その他：山田さんに LINE で軽く聞いてみる") +
  cmsg("分かりました。LINE は自動操作を禁じているので "+cite(4,"サービス台帳")+"、<b>私は送れません</b>。文面だけ用意します。送るのはあなたです。",
       opts=["文面を作って","やっぱりメールで"]))

# ---- 数値をきく（生成UI・引用・自信）
_cc_num = state("会社全体・目標","目標 受注 10件","今日",
  umsg("チャネル別に、今年どこから受注してる？") +
  cmsg("台帳「案件」の受注 14件 "+cite(1,"台帳 案件 14件")+" を出どころで分けると：<div style='margin-top:10px'>" +
       table(["出どころ",("件数","r"),("金額","r"),("成約率","r")], [["紹介",("6","n"),("5,870,000","n"),("46%","n")],["発注ナビ",("5","n"),("2,410,000","n"),("8%","n")],["既存客",("3","n"),("1,560,000","n"),("75%","n")]]) +
       "</div><div style='display:flex;gap:6px;align-items:flex-end;height:70px;margin:12px 0 6px'>" +
       "".join(f"<div style='flex:1;display:flex;flex-direction:column;align-items:center;gap:4px'><div style='width:100%;height:{h}px;background:var(--{c});border-radius:3px 3px 0 0'></div><span class='muted' style='font-size:11px'>{l}</span></div>" for l,h,c in [("紹介",60,"d-indigo"),("発注ナビ",25,"d-teal"),("既存客",16,"d-sage")]) +
       "</div>紹介が金額でも成約率でも強いです。発注ナビは数は出ますが成約率 8% なので、<b>30件アプローチして2〜3件</b>という計算です。", conf="hi") +
  umsg("じゃあ紹介を増やすには？") +
  cmsg("紹介元は 6件中 4件が <b>過去の納品先</b> "+cite(2,"案件 納品済み 4件")+" です。納品から3か月後に近況を聞くメールを CS社員に定期で出させる、という施策が考えられます。<b>仮説として登録</b>しておきますか？ 効いたかは3か月後の紹介数で見ます。",
       opts=["仮説にする","もう少し他の案も"], conf="lo"), tree=False)

# ---- 考え方を教える（記憶）
_cc_teach = state("会社全体・目標","判断の癖","教えたこと",
  umsg("初回の案件は値引きしない。紹介でも同じ。") +
  cmsg("覚えます。" +
       f'<div class="tc mem"><div class="tc-h">{ic("brain")}記憶に入れる<span class="st">{pill("確認待ち","wa")}</span></div><div class="tc-b">'
       '<b>初回は紹介でも値引きしない</b><div class="muted" style="font-size:12px;margin-top:3px">判断の癖 · 効く範囲：個人 · 出どころ：この会話</div>'
       '<div style="font-size:12.5px;margin-top:8px">認めると、<b>これ以降の見積・返信・提案の判断でこの方針を使います</b>。一覧は <a href="v1-clone-memory.html" style="color:var(--primary);font-weight:600">高本AIの記憶 › 判断の癖</a> で見直せます。会社のルールにすると、AI社員全員に効きます。</div>'
       '<div style="display:flex;gap:8px;margin-top:10px">' + btn("そのとおり","p","check") + btn("会社のルールにする","o","policy") + btn("違う","g","x") + '</div></div></div>'
       "さっきの◇◇様の件は、この方針で返します。CS社員にも伝えます。", actions=True), tree=False)

# ---- 添付・音声
_cc_file = state("営業","案件 SOICO","昨日",
  umsg('<div class="att">' + ic("file") + '<div><b>SOICO_工数表.xlsx</b><div class="muted" style="font-size:11.5px">65.5人日 · 38 KB</div></div></div>'
       '<div class="att">' + ic("file") + '<div><b>打ち合わせメモ.m4a</b><div class="muted" style="font-size:11.5px">音声 12分</div></div></div>これで見積の概算出して') +
  typing("読んでいます… 工数表 65.5人日、音声から要件 9項目を拾いました（2/2 ファイル）") +
  cmsg("先方の工数表 65.5人日 を基準に、あなたの単価（記憶 "+cite(1,"エンジニア 1人日 60,000円")+"）で <b>3,930,000円</b>。音声で「決済は後回し」と言っていたので "+cite(2,"文字起こし 07:12")+"、決済分 8人日 を外すと <b>3,450,000円</b>。どちらで見積社員に下書きさせますか？",
       opts=["3,930,000 で","3,450,000 で","両方出す"], conf="lo"), tree=False,
  composer=composer3(voice=True, atts=["SOICO_工数表.xlsx","打ち合わせメモ.m4a"]))

# ---- 生成中（段階・停止）
_cc_stream = state("営業","案件 セイコー","今日",
  umsg("セイコーの着手金、請求書作っておいて", read="高本AI が読んだ 09:14") +
  cmsg("経理社員に配りました。" + tool_card("着手金 990,000 の請求書を作る","経理社員",
         [("done","09:14","高本AIが指示を配った"),("now","09:15","経理社員が freee で下書きを作っている…")], pill("実行中","pr","play")), actions=False) +
  typing("経理社員の下書きを待っています（普段は 1〜2分）"))

# ---- 受領（承認した後）
_cc_receipt = state("営業","案件 セイコー","今日",
  cmsg("承認ありがとうございます。送りました。" +
       receipt("請求書を送りました", [("何を","セイコー 着手金 請求書 990,000円（税込）"),("どこへ","yamada@seiko-example.co.jp · メール"),("誰が","経理社員（承認：高本 09:41）"),("反映","台帳「請求」に1件 "+cite(1,"請求 #2026-042")+"、案件の段階を「請求済み」に")], undo="取り消す（先方に取消メールを送ります）") +
       autonomy("経理社員の請求書はこれで <b>10件連続で承認</b>されています。「税込・期日 契約時・宛先が台帳と一致」の条件を満たすときだけ、<b>次から承認なしで送る</b>ようにしますか？ いつでも戻せます。",
                btn("条件つきで自動にする","p","zap")+btn("今のまま（毎回承認）","o")), conf="hi"))

# ---- PC が閉じている・送れない
_cc_off = state("営業","案件 セイコー","今日",
  errbar("off","<b>あなたの PC が閉じているので、高本AIは動けません。</b>PC を起こすと、溜まった分（承認待ち 2・指示 1）を順に片づけます。ここで書いたものは残ります。", btn("PC の状態を見る","o","bridge","v1-bridge-setup.html")) +
  umsg("京蟻の請求書も今日中に") +
  '<div class="muted" style="font-size:12px;margin:-6px 0 8px 40px">未送信 · PC が起きたら送ります</div>' +
  errbar("fail","さっきの「セイコー 追いメール」の送信が <b>先方のメールサーバーの都合で失敗</b>しました（相手には届いていません）。", btn("もう一度送る","p","repeat")+btn("メールをやめて電話にする","g")),
  tree=False, composer=composer3(disabled=True))

# ---- /コマンド補完・@AI社員
_cc_slash = state("経理","請求","今日",
  umsg("/", actions=False) +
  cmsg("入力欄の「/」で入口が出ます。「@経理社員」と書けば、私を通さず直接その社員に渡せます（それでも外に出す前は承認を挟みます）。", actions=False),
  tree=False, composer=composer3(slash=True))

# ---- 分岐・やり直し
_cc_branch = state("営業","案件 セイコー","今日",
  umsg("セイコー様への追いメール、もう少し柔らかく書き直して" + '<div class="branch">' + ic("repeat") + ' 2 / 2 <button>‹</button><button>›</button> 編集して送り直した</div>') +
  cmsg("柔らかくしました。金額や期日には触れず、「ご検討の状況をうかがえれば」に留めています。" +
       tool_card("追いメールの下書きを直す","営業社員",[("done","09:31","高本AIが差し戻し：もう少し柔らかく"),("done","09:32","営業社員が書き直した"),("done","09:32","高本AIが確認 → 承認待ちを更新")],pill("承認待ち","wa","clock")) +
       '<div class="branch">' + ic("eye") + ' <button>2つの版を並べる</button><button>前の版に戻す</button></div>'))

# ---- 最初（空）：未読・できること
_cc_empty = ('<div class="convo closed" data-fix><div class="chatwrap">' + ctop("今日","新しい会話","") +
  '<div class="chat">' + daysep("昨日 9/9") + umsg("SOICO の概算、3,450,000 で下書きして", actions=False) +
  cmsg("見積社員に配りました。下書きは承認待ちにあります。", actions=False) + unread(2) +
  cmsg("おはようございます。夜のうちに3体が動きました。<b>承認待ちが3件</b>あります。何から始めますか？",
       opts=["承認待ちの3件を順に見せて","今月の売上、どのくらい行きそう？","セイコーの着手金の請求書を作って"], actions=False) +
  to_latest() + '</div>' + composer3() + '</div>' + '<aside class="ctree"><div class="card">' + capabilities() + '</div></aside></div>')

def _cstate(area, obj, body, comp):
    return '<div class="convo closed" data-fix><div class="chatwrap">' + ctop(area, obj) + '<div class="chat">' + body + '</div>' + comp + '</div></div>'
_cc_r3 = _cstate("制作","あなたのタスク", daysep("今日 9/10（水）") +
  umsg("今日やることを並べて", read="佐藤AI が読んだ 09:00") + cmsg("配られているのは 3 件です。<b>京蟻 ガチャ演出の実装</b>（今日・3h）、<b>セイコー 提案書の図</b>（9/17・1h）、京蟻 β の不具合（済み）。会社の数字や他の人の分は私には見えません。") +
  umsg("提案書の図、下書きしておいて") + cmsg("提案書の図を下書きします。外に出るものではないので承認は要りません。できたらタスクに付けます。"), composer3()).replace("高本AIが分類","佐藤AIが分類")
_cc_r4 = _cstate("共有","京蟻 オンラインガチャ", daysep("今日 9/10（水）") +
  umsg("β 公開はいつ？", read="読んだ 11:20") + cmsg("共有された案件「京蟻 オンラインガチャ」の予定は <b>9/30 β 公開</b> です。進行中のタスクは 1 件、不具合の対応は終わっています。") +
  cmsg("この会話では聞くことだけできます。指示・依頼は担当の佐藤さんへ。"), composer3()).replace("高本AIが分類","閲覧のみ")
CLONE_CHAT = ("clone-chat", [
  ("n","指示する（配布・承認）","高本AI→AI社員→一次確認→承認待ち がカードで出て、承認カードは中身（宛先・金額・本文・経路）を全部見せる。引用は台帳・記憶へ。担当者は自分のAIに自分の分だけ、閲覧のみは聞くだけ。",'<div data-roles="R1 R2">' + _cc + '</div><div data-roles="R3">' + _cc_r3 + '</div><div data-roles="R4">' + _cc_r4 + '</div>'),
  ("c","選択肢で答える","質問には選択肢＋「その他（自由に書く）」「あとで」。できないことは先に言う（LINE は自動操作を禁じている）。",_cc_choice),
  ("q","数値をきく","表・グラフの生成UI。台帳を引用。自信の表示。固定の分析画面は作らない。",_cc_num),
  ("t","考え方を教える","会話がそのまま記憶になる。認めてから使う。",_cc_teach),
  ("f","添付・音声","形式不問・複数。読んでいる途中が見える。",_cc_file),
  ("s","生成中（止められる）","段階つきの表示と停止。AI社員の実行を待つときも同じ。",_cc_stream),
  ("r","送った後（受領・取り消し）","何が変わった・どこ・誰が・取り消し。同じ承認が続いたら条件つきの自動化を提案。",_cc_receipt),
  ("x","PC が閉じている・送れなかった","失敗は種類ごとに回復の一手。書いたものは残る。",_cc_off),
  ("k","/コマンド・@AI社員","入力欄の補完と直接渡し。",_cc_slash),
  ("b","分岐・やり直し","前の版は消えない。2つの版を並べられる。",_cc_branch),
  ("0","最初（未読・できること）","日付の区切り・未読の線・最新へ・できること／できないこと。",_cc_empty),
 ], CHAT_CSS, False, {"営業":"4","経理":"2","会社全体・目標":"3","今日":"3"},
 [{"group":"領域（担当業務から自動）","label":"営業","desc":"案件・提案・追い","state":"n"},
  {"group":"領域（担当業務から自動）","label":"経理","desc":"請求・入金","state":"r"},
  {"group":"領域（担当業務から自動）","label":"会社全体・目標","desc":"目標・数値・考え方","state":"q"},
  {"group":"対象（台帳・目標に紐づく）","label":"案件 セイコー","desc":"着手金／追いメール","state":"n"},
  {"group":"対象（台帳・目標に紐づく）","label":"案件 SOICO","desc":"見積の概算","state":"f"},
  {"group":"対象（台帳・目標に紐づく）","label":"目標 受注 10件","desc":"届くか・チャネル別","state":"q"},
  {"group":"流れ","label":"今日","desc":"3本","state":"n"},
  {"group":"流れ","label":"教えたこと","desc":"記憶に入ったもの","state":"t"},
  {"group":"流れ","label":"新しい会話","desc":"話を切って始める","state":"0"}])
CHAT_JS = "<script>document.addEventListener('click',e=>{const b=e.target.closest('.ctree-toggle');if(!b)return;b.closest('.convo').classList.toggle('closed');});</script>"
CLONE_CHAT = (CLONE_CHAT[0], [(a,b,c,d+CHAT_JS) for a,b,c,d in CLONE_CHAT[1]], CLONE_CHAT[2], CLONE_CHAT[3], CLONE_CHAT[4], CLONE_CHAT[5])

# ============================================================ search
_sr = card('<div style="display:flex;gap:9px;margin-bottom:18px">' + inp("セイコー 着手金","","text","","font-size:15px") + btn("探す","p","search") + '</div>' +
  '<div class="muted" style="font-size:12.5px;margin-bottom:16px">「セイコー 着手金」に近いもの · 台帳 3件 · 記憶 1件 · 証跡 4件</div>' +
  '<div class="dl" style="display:flex;flex-direction:column;gap:8px">' + "".join(
    f'<a href="{h}" style="display:flex;gap:11px;align-items:flex-start;padding:12px;background:var(--surface);border-radius:var(--r-md)">{ic(i)}<div style="flex:1"><div style="font-weight:600;font-size:13.5px">{t}</div><div class="muted" style="font-size:12px">{d}</div></div>{pill(k,"ne")}</a>'
    for i,t,d,k,h in [
      ("ledger","セイコー 食品パッケージ画像編集SaaS","案件 · 提案済 · 3,300,000 · 着手金 990,000（30%）","台帳","v1-record-detail.html"),
      ("file","請求書 下書き · セイコー 着手金 990,000","請求 · 承認待ち · 経理社員が作成","台帳","v1-approvals.html"),
      ("brain","着手金は契約時に3割、残金は納品時","あなたの判断の癖 · 個人 · 2026-09-04","記憶","v1-clone-memory.html"),
      ("log","高本AIが経理社員に「セイコー 着手金の請求書」を配った","9/10 09:14 · 会話から","証跡","v1-audit.html"),
    ]) + '</div>')
_sr0 = card('<div style="display:flex;gap:9px;margin-bottom:18px">' + inp("","言葉で探す（例：先月の入金、京蟻の契約書、値引きの方針）","text","","font-size:15px") + btn("探す","p","search") + '</div>' +
  empty("search","台帳・記憶・証跡を横断して探します","案件名でも、金額でも、「あのとき決めたこと」でも。意味で探すので言い回しが違っても見つかります。"))
SEARCH = ("search", [("n","結果","",_sr),("0","最初","",_sr0)], "", False, {"台帳":"3","記憶":"1","証跡":"4"})

SCREENS = [CLONE_CHAT, SEARCH]

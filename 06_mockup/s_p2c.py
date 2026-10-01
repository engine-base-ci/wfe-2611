# -*- coding: utf-8 -*-
"""P2 毎日：clone-chat（会話モード）/ search。会話の部品は _wiz（D-066）で、右パネル・はじめの設定と共通。"""
from _icons import ic
from _parts import *
from _wiz import *
from _threadlist import thread_list

CHAT_CSS = WIZ_CSS + """
.convo{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}
.convo.closed{grid-template-columns:minmax(0,1fr)}
.convo.closed .ctree{display:none}
.chatwrap{max-width:880px;margin:0 auto;min-width:0;width:100%}
.ctree{position:sticky;top:60px;align-self:start}
.ctree .card{padding:14px}
.ctree .tl>div{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:12px}
.ctree .tl .d{width:8px;height:8px;border-radius:var(--r-full);margin-top:6px;flex:none;background:var(--neutral)}
.ctree .tl .done .d{background:var(--st-success)}.ctree .tl .now .d{background:var(--st-progress)}
.ctop{display:flex;gap:6px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.ctop .ttl{font-size:15px;font-weight:600;min-width:0;flex:1 1 160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctop .ib{display:grid;place-items:center;width:32px;height:32px;border-radius:var(--r-md);color:var(--on-sv)}
.ctop .ib:hover{background:var(--sv);color:var(--on-surface)}
.ctop .ib.on{color:var(--st-warning)}
.ctop .inc{font-size:12px;color:var(--on-sv);background:var(--sv);border-radius:var(--r-full);padding:1px 8px}
.clist{display:flex;flex-direction:column;gap:2px}
.clist .cs{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.clist .cs input{flex:1;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;font:inherit;font-size:16px;background:var(--card)}
.clist .grp{font-size:12px;color:var(--on-sv);font-weight:600;margin:10px 0 4px}
.clist a{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:var(--r-md);font-size:14px}
.clist a:hover{background:var(--sv)}
.clist a .ago{margin-left:auto;font-size:12px;color:var(--on-sv)}
.clist a .hit{font-size:12px;color:var(--on-sv);display:block}
.clist a .dot{width:8px;height:8px;border-radius:var(--r-full);background:var(--primary);flex:none}
.clist a svg{width:14px;height:14px;color:var(--on-sv);flex:none}
.clist .menu{margin-left:auto;display:flex;gap:2px}
.rename{display:flex;gap:8px;align-items:center;flex:1}
.rename input{flex:1;border:1px solid var(--primary);border-radius:var(--r-md);padding:4px 8px;font:inherit;font-size:16px}
@media(max-width:1180px){.convo{grid-template-columns:minmax(0,1fr)}.ctree{display:none}}
@media(min-width:1024px){
  .convo[data-fix]{height:calc(100vh - var(--fix-top,180px) - var(--fix-bottom,0px));min-height:0;margin-bottom:-64px}
  .convo[data-fix] .chatwrap{display:flex;flex-direction:column;min-height:0;height:100%}
  .convo[data-fix] .chatwrap .ctop{flex:none}
  .convo[data-fix] .chatwrap .chat{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 12px 0;overscroll-behavior:contain}
  .convo[data-fix] .chatwrap .composer{position:static;flex:none}
  .convo[data-fix] .ctree{position:static;overflow-y:auto;min-height:0;align-self:stretch}
}
"""

def ctop(title="セイコー 着手金の請求書", star=False, inc=False, renaming=False):
    """会話の頭：自動で付いた名前（押すと直せる）・星・記憶に使わない・この会話の動き（D-104.1・D-062.2）"""
    t = (f'<span class="rename"><input value="{title}" aria-label="会話の名前"><button class="btn btn-p btn-sm">保存</button></span>' if renaming
         else f'<span class="ttl" title="押すと名前を直せます">{title}</span><button class="ib" title="名前を直す" aria-label="名前を直す">{ic("pen")}</button>')
    return (f'<div class="ctop">{t}{"<span class=inc>記憶に使わない会話</span>" if inc else ""}'
            f'<button class="ib{" on" if star else ""}" title="星を付ける" aria-label="星を付ける">{ic("star")}</button>'
            f'<button class="ib ctree-toggle" title="この会話の動き" aria-label="この会話の動き">{ic("route")}</button>'
            f'<button class="ib" title="ほかの操作（記憶に使わない・消す）" aria-label="ほかの操作">{ic("more")}</button></div>')
def ctree_card(rows):
    tl = "".join(f'<div class="{c}"><span class="d"></span><span>{t}</span></div>' for c,t in rows)
    return (f'<aside class="ctree"><div class="card"><div style="font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:6px">この会話の動き（誰が何をしたか）</div>'
            f'<div class="tl">{tl}</div><a href="v1-ai-activity.html" style="font-size:12px;color:var(--primary);font-weight:600;display:inline-block;margin-top:8px">動きを全部見る →</a></div></aside>')
TREE_SEIKO=[("done","高本AI が配った 09:14"),("done","経理社員 受け取り → 台帳を読む"),("done","経理社員 freee で下書き（正規API）"),("done","高本AI 一次確認 → 差し戻し"),("done","経理社員 文面を直す"),("done","高本AI 確認 OK"),("now","承認待ち（あなた）")]

def state(body, title="セイコー 着手金の請求書", composer=None, star=False, inc=False, renaming=False):
    return ('<div class="convo closed" data-fix><div class="chatwrap">' + ctop(title, star, inc, renaming) +
            '<div class="chat" role="log" aria-label="自分のAIとの会話">' + body + '</div>' + (composer or chat_composer(mem=False)) + '</div>' + ctree_card(TREE_SEIKO) + '</div>')

CTX = ["この画面：案件 セイコー"]

# ---- 書式（D-104.3）：見出し・表・コード・注意の帯・チェックリスト・数式・折りたたみ・目次・出典・タブ・キー・蛍光ペン・印・大きな数字
_fmt_body = (
  umsg("今月の受注の見込みと、来週やることを整理して") +
  cmsg(toc(["今月の見込み", "来週やること", "計算のしかた"]) +
       h("今月の見込み") +
       f'<p class="mp">このままだと <b>8 件</b>で着地します{cite(1,"台帳 案件")}。{mark("提案中 2 件のうち 1 件が決まれば 9 件")}です。</p>' +
       bignum("69.4", "%", "目標 受注 12 件に対して", "先週 +8.3") +
       mtable(["案件", "段階", "金額", "担当", "期限"],
              [["セイコー", schip("wa","提案中"), "3,300,000", pchip("高本","高"), dchip("9/30（火）")],
               ["京蟻", schip("pr","見積"), "1,450,000", pchip("佐藤","佐"), dchip("10/3（金）")],
               ["SOICO", schip("da","止まっている"), "3,450,000", pchip("田中","田"), dchip("9/20（土）", late=True)]]) +
       callout("warn", "SOICO が 7 日止まっています", "先方の返事待ちです。追いの下書きを作れます。") +
       h("来週やること") +
       checklist([(True, "セイコーの着手金の請求書を送る"), (False, "京蟻の見積を出す"), (False, "SOICO に追いの連絡")]) +
       f'<p class="mp">承認待ちは {kbd("⌘","J")} でいつでも開けます。コードでいうと {icode("tasks.status = today")} の 3 件です。</p>' +
       h("計算のしかた") + math_frac() +
       details("計算に使った数（押すと開く）", "降ろした数 12（会社 → 営業）· 積み上がった数 8.33（受注 8 ＋ 提案中の見込み 0.33）") +
       tabs(["案 A 追いメール", "案 B 電話", "案 C 待つ"], "先方の検討期限が明後日なので、今日の夕方に柔らかい追いメールを送る案です。") +
       sources([("ledger","台帳 案件 14 件","受注・提案中・止まっている"), ("target","目標 受注 12 件（Q4）","会社 → 営業"), ("brain","記憶 追いは期限の前日","判断の癖")]),
       work=("4 つの操作 · 1分12秒", "台帳「案件」を読んだ · 目標「受注 12 件」を読んだ · 先週のタスクを集めた · 表を作った")))
_cc_fmt = ('<div data-roles="R1 R2">' + state(_fmt_body, "今月の受注の見込み", composer=chat_composer(ctx=CTX, mem=False)) + '</div>'
  '<div data-roles="R3">' + state(umsg("今日やることを並べて") + cmsg("配られているのは 3 件です。" + checklist([(False,"京蟻 ガチャ演出の実装（今日・3 時間）"),(False,"セイコー 提案書の図（9/17・1 時間）"),(True,"京蟻 β の不具合")]) + '<p class="mp">会社の数字や他の人の分は私には見えません。</p>', who="佐藤AI"), "今日やること") + '</div>'
  '<div data-roles="R4">' + state(umsg("β 公開はいつ？") + cmsg("共有された案件「京蟻 オンラインガチャ」の予定は <b>9/30 β 公開</b>です。この会話では聞くことだけできます。指示・依頼は担当の佐藤さんへ。", who="山本AI", actions=False), "京蟻の予定") + '</div>')

# ---- 図とデータ（D-104.4）
_cc_viz = state(
  umsg("セイコーの案件、どこまで進んでる？流れで見せて") +
  cmsg(h("いまの位置") + flowchart([("引合","done"),("提案","done"),("見積","done"),("承認待ち","now"),("請求",""),("入金","")]) +
       pbar("目標 受注 12 件（Q4）", 69) +
       h("これからの予定") + timeline([("9/30（火）","着手金の請求書を送る"),("10/3（金）","キックオフ"),("10/31（金）","中間の納品")]) +
       h("チャネル別") + mtable(["出どころ","件数","金額","成約率"], [["紹介","6","5,870,000","46%"],["発注ナビ","5","2,410,000","8%"],["既存客","3","1,560,000","75%"]], sort=2) +
       '<p class="mp">表の見出しを押すと並べ替えできます。</p>', work=("2 つの操作 · 38秒", None)), "セイコーの進み")

# ---- 実物のカード（D-104.5）
_cc_ent = state(
  umsg("セイコーの件で関係するもの全部出して") +
  cmsg('<p class="mp">関係するものです。押すとその画面で開きます。</p><div class="ecards">' +
       goal_card("受注 12 件（Q4）", 69, "12/31", "届きそう") + task_card("セイコー 提案書の図", "佐藤", "9/17", "今日") +
       person_card("佐藤 真", "制作", "京蟻の実装") + person_card("経理社員", "請求・入金", "セイコーの請求書", ai=True) +
       approval_card("セイコー 着手金 請求書 990,000 円", [("宛先","株式会社セイコー 山田 様"),("金額","990,000 円（税込）"),("経路","メール · 送信の直前で止めています")]) +
       '</div>', work=("3 つの操作 · 22秒", None)) +
  staff("請求書の下書きを作りました。高本AI の確認を待っています。", name="経理社員", actions=False), "セイコーの関係するもの")

# ---- 資料（D-104.5）
_cc_mat = ('<div class="artwrap">' + state(
  umsg("SOICO の見積書を作って。比較の表と、先方サイトの要点も") +
  cmsg('<p class="mp">見積書を作りました。横で開いて直せます。</p>' + file_card("SOICO_見積書_v2.pdf", "PDF · 3 ページ · 成果物に入りました") +
       pdf_prev("SOICO_見積書_v2.pdf") +
       sheet(["項目","人日","単価","金額"], [["要件定義","8","60,000","480,000"],["実装","49.5","60,000","2,970,000"],["テスト","8","60,000","480,000"]]) +
       h("先方サイトの要点") + link_prev("SOICO 食品パッケージ画像編集 SaaS", "soico.example.co.jp") +
       results([("SOICO 会社概要","soico.example.co.jp"),("導入事例 3 社","soico.example.co.jp/cases"),("料金ページ","soico.example.co.jp/pricing")]) +
       image_box("先方の画面の写真") + media("a","打ち合わせの録音") + map_box("SOICO 本社（大阪市北区）") + screen_prev("見積の確認画面"),
       work=("6 つの操作 · 3分04秒", None)), "SOICO の見積書") +
  '<aside class="artifact" aria-label="横で開いた成果物"><div class="ah">' + ic("file") + '<b>SOICO_見積書_v2</b><span class="v">版 2 · 前の版に戻す</span></div>'
  '<div class="ab">' + h("御見積書", 2) + '<p>株式会社SOICO 御中</p>' + mtable(["項目","金額"], [["要件定義","480,000"],["実装","2,970,000"],["合計（税込）","3,795,000"]]) + '</div>'
  '<div class="af">' + btn("PDF で落とす","o","download") + btn("Word","g") + btn("承認に出す（外に出すとき）","p","send") + '</div></aside></div>')

# ---- 成果物を直す・版を戻す（D-106）
_cc_art = ('<div class="artwrap">' + state(
  umsg("京蟻の見積の方針をまとめて") +
  cmsg('<p class="mp">まとめました。</p>' + h("京蟻 見積の方針") + '<p class="mp">先週の工数表から 1,450,000 円。着手金は 3 割。</p>' +
       '<div class="receipt"><div class="rh">' + ic("check") + '成果物に書き出しました</div>京蟻 見積の方針 · 版 3 · 横で開いています</div>' +
       file_card("京蟻 見積の方針", "文書 · 版 3 · 成果物")) , "京蟻の見積") +
  artifact_panel("京蟻 見積の方針", 3, [(3, "10:42", "高本", 1), (2, "10:31", "高本", None), (1, "10:20", "高本（書き出し）", None)],
                 "# 京蟻 見積の方針\n\n先週の工数表から 1,450,000 円。\n着手金は 3 割（435,000 円）。") + '</div>')

# ---- 作業の記録（D-104.6）
_cc_rec = state(
  umsg("請求書のテンプレを直して。何を変えたか見せて") +
  cmsg('<p class="mp">テンプレの 2 か所を直しました。</p>' +
       diff("請求書テンプレ.md", [("","# 御請求書"),("r","お支払い期日：月末"),("a","お支払い期日：契約時（着手金）／納品時（残金）"),("","宛先：{{会社名}} 御中"),("a","※ 金額は税込で先に書く")], 2, 1) +
       terminal("freee-cli template validate 請求書テンプレ.md", "OK: 項目 12 / 必須 8 / 警告 0") +
       tree(["請求書/", "├── 請求書テンプレ.md   ← 直した", "├── 2026-042_セイコー.pdf", "└── 2026-043_京蟻.pdf"]) +
       '<p class="mp">使った道具の中身の全文はあなたの PC に置いたままです。ここに出しているのは、私が返事に書いたものだけです。</p>',
       work=("3 つの操作 · 48秒", "テンプレを読んだ · テンプレを書き換えた · 形を確かめた（freee-cli）")), "請求書テンプレの直し")

# ---- 問い合わせ（D-104.7）
_cc_q = state(
  umsg("セイコーの追い、どうする？") +
  cmsg('<p class="mp">決める前に 2 つ教えてください。</p>', actions=False) +
  qcard([{"h":"送り方","q":"追いの連絡はどうしますか？","sel1":0,"show_prev":True,
          "opts":[("柔らかい追いメール","今日の夕方に送る。金額や期日には触れない",True,"件名：先日のご提案について\n\n山田様\n\n先日はお時間をいただきありがとうございました。\nご検討の状況をうかがえればと思い、ご連絡しました。"),
                  ("電話","明日 10:00 に予定を入れる",False,None),("来週まで待つ","検討期限を過ぎてから連絡",False,None)]},
         {"h":"同封","q":"一緒に送るものは？","multi":True,"sel":[0],
          "opts":[("提案書（最新版）","先週の v3",True,None),("導入事例","同業 2 社",False,None),("見積書","990,000 円の着手金",False,None)]}]),
  "セイコーの追い")

# ---- 作業中（D-104.8・D-104.9）：吹き出しの外に 1 行・手順・経過時間・道具。書きながら出る。止める・止めずに直す・順番待ち
_cc_run = state(
  umsg("セイコーの着手金、請求書作っておいて") +
  work_live("台帳「請求」を調べています…",
            steps=[("done","案件の金額と期日を確かめる"),("done","経理社員に配る"),("now","下書きを確かめる"),("todo","承認に上げる")],
            tools=[("台帳を読む","請求.csv","0.4秒",True),("コマンド","freee-cli invoice draft --amount 990000","3.1秒",True)], elapsed="1分08秒") +
  umsg("宛先は山田さんじゃなくて経理の鈴木さんで", actions=False) + steer_note("宛先を 鈴木 様 に変える") +
  cmsg('<p class="mp">経理社員の下書きを確かめています。金額 990,000 円（税込）・期日 契約時 は合っています。宛先を鈴木様に<span class="streaming">…</span></p>', actions=False),
  composer=chat_composer(ctx=CTX, running=True, queue=["京蟻の見積も今日中に", "終わったら今日のタスクに足して"]))

# ---- 許可（D-104.14）：今回だけ／いつも／しない＋一言。AI社員からは名前とアイコン
_cc_ask = state(
  umsg("セイコーの着手金、請求書作っておいて") +
  work_live("許可を待っています", steps=[("done","下書きを作る"),("now","先方に送る")], elapsed="2分31秒") +
  perm_card("メールを送る：株式会社セイコー 鈴木 様", "freee-cli invoice send --id 2026-042 --to suzuki@seiko-example.co.jp") +
  perm_card("ファイルを書く：請求書/2026-042_セイコー.pdf", "Write 請求書/2026-042_セイコー.pdf", staff_name="経理社員"))

# ---- 許可のモード（全部許可は自分で選んだときだけ）
_cc_mode = state(
  cmsg('<p class="mp">許可のしかたは入力欄の右下で切り替えられます。<b>全部許可</b>にすると、外への送信や削除も確かめずに進めます。この会話だけに効きます。</p>', actions=False),
  "許可のしかた", composer=chat_composer(picker="perm"))

# ---- 止まった（D-104.15）：理由だけ。ボタンは置かず、入力欄は開いたまま
_cc_stp = state(
  umsg("セイコーの着手金、請求書作っておいて") +
  work_done("2 つの操作 · 1分40秒") +
  stopped("あなたの PC がスリープに入りました（最後の知らせ 2 分前）。ここまでの下書きは経理社員の手元に残っています。"),
  composer=chat_composer(ctx=CTX, mem=False))

# ---- AI が Chrome を使えなかった（D-119.4・D-120）：理由と、その場でやる一手（つなぎ方・確かめる・切り替える）
_cc_br = state(
  umsg("発注ナビの今週の新着案件、見ておいて") +
  work_done("1 つの操作 · 12秒") +
  browser_off() +
  cmsg('<p class="mp">Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。発注ナビの新着は、つながってからもう一度頼んでください。</p>'),
  composer=chat_composer(ctx=CTX, mem=False))

# ---- PC が閉じている・送れなかった・使用量（D-104.15・D-104.16）
_cc_off = state(
  errbar("off","<b>あなたの PC が閉じているので、高本AI は動けません。</b>ここで書いたことは起きたら順に送ります。", btn("PC の状態を見る","o","bridge","v1-bridge-setup.html")) +
  umsg("京蟻の請求書も今日中に", failed=True) +
  usage_bar("near") + usage_bar("lim"),
  composer=chat_composer(disabled=True))

# ---- 資料と画像を付ける・声で入力（D-104.11）
_cc_file = state(
  umsg(file_card("SOICO_工数表.xlsx","表計算 · 38 KB") + file_card("打ち合わせメモ.m4a","音声 · 12 分") + "これで見積の概算出して") +
  work_done("2 つの操作 · 1分22秒", "工数表を読んだ（65.5 人日）· 音声を文字にした（要件 9 項目）") +
  cmsg('<p class="mp">先方の工数表 65.5 人日を基準に、あなたの単価（記憶：エンジニア 1 人日 60,000 円）で <b>3,930,000 円</b>。音声で「決済は後回し」と言っていたので、決済分 8 人日を外すと <b>3,450,000 円</b>です。</p>',
       opts=["3,930,000 で","3,450,000 で","両方出す"]),
  "SOICO の概算", composer=chat_composer(voice=True, atts=["見積の前提.pdf",("画面の写真.png","error")]))

# ---- 文脈・@・モデルと使うもの（D-104.10・D-104.12・D-104.13）
_cc_ctx = state(
  cmsg('<p class="mp">いま見ている画面と選んでいる 1 件は、入力欄の上に出ています。外すと私には渡しません。</p>', actions=False) +
  '<div class="opts" style="margin-left:38px"><button>この案件の次の一手は？</button><button>止まっている理由をまとめて</button><button>追いの下書きを作って</button></div>',
  "案件 セイコーについて", composer=chat_composer(ctx=CTX + ["選んでいる 1 件：請求 2026-042"], mention=True))
_cc_model = state(
  cmsg('<p class="mp">モデルと考える強さ、使うもの（運営や会社が用意したスキル・道具）は、入力欄の下で選べます。</p>', actions=False),
  "モデルと使うもの", composer=chat_composer(picker="model"))
_cc_tools = state(
  cmsg('<p class="mp">使うものを選んでおくと、その会話ではそれを使って進めます。</p>', actions=False),
  "使うもの", composer=chat_composer(picker="tools"))

# ---- 会話の一覧（D-104.1）：探す（中身も）・星・名前を直す・消す・記憶に使わない
_cc_list = ('<div class="chatwrap"><div class="clist">'
  '<div class="cs">' + inp("着手金","会話を探す（名前も中身も）","text") + btn("新しく話す","p","plus") + '</div>'
  '<div class="grp">「着手金」を含む会話 3</div>'
  '<a href="#">' + ic("chat") + '<span>セイコー 着手金の請求書<span class="hit">…<mark>着手金</mark> 990,000 円（税込）で作らせています…</span></span><span class="ago">今日</span></a>'
  '<a href="#">' + ic("chat") + '<span>京蟻の契約<span class="hit">…<mark>着手金</mark>は契約時に 3 割…</span></span><span class="ago">9/04</span></a>'
  '<div class="grp">星</div>'
  '<a href="#">' + ic("star") + '<span>今月の受注の見込み</span><span class="dot" title="見ていない間の返事 1"></span><span class="ago">今日</span></a>'
  '<div class="grp">最近</div>'
  '<a href="#">' + ic("chat") + '<span>SOICO の概算</span><span class="ago">昨日</span></a>'
  '<a href="#">' + ic("eyeoff") + '<span>給与の相談（記憶に使わない会話）</span><span class="ago">9/08</span></a>'
  '<a href="#">' + ic("chat") + '<span>請求書テンプレの直し</span><span class="ago">9/07</span>'
  '<span class="menu">' + btn("","g","pen") + btn("","g","star") + btn("","g","eyeoff") + btn("","d","trash") + '</span></a>'
  '</div></div>')

# ---- 返事への操作（D-104.17）：コピー・直して送り直す・タスクにする・引用して続ける・書き出す（成果物へ）
_cc_act = state(
  umsg("来週やることを 3 つに絞って") +
  cmsg('<p class="mp">絞りました。<span class="sel">京蟻の見積を出す</span><span class="selpop"><button>' + ic("chat") + '引用して続ける</button><button>' + ic("file") + 'コピー</button></span>・セイコーの請求書・SOICO への追い、です。</p>') +
  umsg("ここをもう少し詳しく", quote="京蟻の見積を出す") +
  cmsg('<p class="mp">京蟻の見積は、先週の工数表から 1,450,000 円で下書きがあります。</p>' +
       '<div class="receipt"><div class="rh">' + ic("check") + '成果物に書き出しました</div>京蟻_見積の方針.md · 成果物 › 見積。外に出すときだけ承認を挟みます</div>' +
       '<div class="receipt"><div class="rh">' + ic("check") + 'タスクにしました</div>京蟻の見積を出す · 目標 受注 12 件 · 期限 10/3</div>'),
  "来週やること")

# ---- 覚えました（D-105.1）
_cc_mem = state(
  umsg("初回の案件は値引きしない。紹介でも同じ。覚えて") +
  cmsg('<p class="mp">覚えました。これからの見積・返信・提案でこの方針を使います。</p>') + memo_line("初回は紹介でも値引きしない（個人）") +
  cmsg('<p class="mp">会社全体の決まりにしたいときは、明日の朝の「昨日の会話をまとめる」で上げる候補に入ります。</p>', actions=False),
  "値引きの方針")

# ---- 最初（あいさつだけ・D-104.2）
_cc_empty = ('<div class="convo closed" data-fix><div class="chatwrap">' + ctop("新しい会話") +
  '<div class="chat" role="log" aria-label="自分のAIとの会話">' + greet() + '</div>' + chat_composer() + '</div></div>')

CLONE_CHAT = ("clone-chat", [
  ("n","書式（表・コード・注意・数式・目次・出典）","返事は Claude のデスクトップと同じだけの書式で出す。表・図・コード・カードは会話の幅いっぱい。担当者は自分の分だけ、閲覧のみは聞くだけ。",_cc_fmt),
  ("v","図とデータ","流れ図・進み具合・予定の流れ・並べ替えできる表。",_cc_viz),
  ("e","実物のカード","目標・タスク・人・AI社員・承認待ちを実物で出し、押すと開く。承認はその場で。",_cc_ent),
  ("m","資料（横で開く・PDF・表計算・画像ほか）","成果物は横で開いて直せる。書き出したものは成果物に入る。",_cc_mat),
  ("art","成果物（横で直す・版を戻す）","返事から書き出すと横で開く。直して保存すると新しい版、版の一覧から戻す（戻すのも新しい版で、どの版も消さない）。画像・PDF は見るだけ。",_cc_art),
  ("w","作業の記録（差分・コマンド・フォルダ）","自分のAI が返事に書いたものだけ。道具の返り値の全文は PC に置いたまま。",_cc_rec),
  ("q","問い合わせ（選択肢・見本・複数の問い）","自分のAI が聞くときは Claude のデスクトップと同じ形。全部答えてから送る。",_cc_q),
  ("s","作業中（止める・直す・順番待ち）","吹き出しの外に 1 行・手順・経過時間・道具。書きながら出る。送るが止めるに変わる。",_cc_run),
  ("a","許可（今回だけ／いつも／しない）","Claude と同じ 3 択と一言。AI社員からは名前とアイコン。答えは証跡に残る。",_cc_ask),
  ("pm","許可のモード","毎回聞く／編集は自動／自動で判断／計画だけ／全部許可。全部許可は自分で選んだときだけ。",_cc_mode),
  ("stp","止まった（理由だけ）","ボタンは置かず、入力欄は開いたまま。次に送る文で決まる。",_cc_stp),
  ("br","AI が Chrome を使えなかった","黙って終わらない。理由と、その場でやる一手（つなぎ方・もう一度確かめる・Bridge 専用のブラウザに切り替える）を 1 行で出す。同じ仕事では 1 回だけ。",_cc_br),
  ("x","PC が閉じている・送れなかった・使用量","送れなかった文は消さずにもう一度送る。サブスクの枠が近い・達したら案内。",_cc_off),
  ("f","資料と画像を付ける・声で入力","＋・ドラッグ・貼り付け。送る前に一覧で外せる。声は文字にしてから送る。",_cc_file),
  ("c","文脈・@ で指す","渡している文脈は入力欄の上に見せ、外せる。画面ごとのよく頼むこと。",_cc_ctx),
  ("mo","モデルと考える強さ","あなたのサブスクで使えるものだけ出る。",_cc_model),
  ("tl","使うもの（スキル・道具）","運営や会社が用意したスキル・道具をオン・オフ。",_cc_tools),
  ("l","会話の一覧（探す・星・消す）","新しい会話は人が作る。名前は自動で付き直せる。記憶に使わない会話。",_cc_list),
  ("k","返事への操作","コピー・直して送り直す・タスクにする・引用して続ける・書き出す（成果物へ）。",_cc_act),
  ("mem","覚えました","「覚えて」はその場で入れる。押すと記憶の画面で直せる。",_cc_mem),
  ("0","最初（あいさつだけ）","まだ何も話していない会話はあいさつだけ。",_cc_empty),
 ], CHAT_CSS, False, {"星":"1","最近":"4"},
 # 会話の一覧は左パネルの一覧の共通の部品（1 行 32px・日付の見出し・操作は「…」・2026-09-30）
 thread_list([("星", [("今月の受注の見込み", "on")]),
              ("今日", [("セイコー 着手金の請求書", "unread:1"), ("SOICO の概算", "")]),
              ("昨日", [("請求書テンプレの直し", ""), ("社外秘の値引きの話", "incog")]),
              ("それより前", [("値引きの方針", "")])]))
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

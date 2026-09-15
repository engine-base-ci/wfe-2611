# -*- coding: utf-8 -*-
"""P1 はじめの設定：onboard-interview / onboard-draft"""
from _icons import ic
from _parts import *
from _wiz import *

# ============================================================ onboard-interview
_learn = card(head("分かったこと", sub="記憶に落ちています") + '<div class="learn">' + "".join(
  f'<div class="it">{ic("check")}<div><div class="k">{k}</div>{v}</div></div>' for k, v in [
   ("何をしている会社か","受託開発（Web・アプリ）。一人で営業から納品まで"),
   ("お金の流れ","案件ごとに見積→契約→着手金→納品→残金。月2〜3件"),
   ("案件の入口","発注ナビ・紹介・既存客のリピート"),
   ("いま困っていること","月30件のアプローチと請求・入金確認が全部自分"),
   ("目標","今期 売上1,200万 と言っていたが、成約数で考えるほうが自然かもしれない"),
  ]) + '</div>')

_iv = grid([
 CHAT_OPEN +
 cmsg("はじめまして。私は高本AI、あなたの代わりに動くAIです。これから会社のことを教えてもらって、私が目標・台帳・担当業務・AI社員のたたき台を作ります。"
      "<b>あなたが欄を埋めることはありません。</b>訊かれたことに答えるだけで大丈夫です。まず、何をしている会社ですか？") +
 umsg("Web とアプリの受託開発。営業も制作も経理も自分一人でやってる。") +
 cmsg("一人で全部、ですね。案件はどこから来ることが多いですか？") +
 umsg("発注ナビと紹介。あとは既存の客のリピート。") +
 cmsg("では、案件が来てからお金が入るまでの流れを聞かせてください。ざっくりで構いません。") +
 umsg("見積出して、契約して、着手金もらって、作って納品して、残金請求。月2〜3件くらい。") +
 cmsg("分かりました。いま一番時間を取られているのはどこですか？",
      ["営業のアプローチ","見積・提案書","請求と入金確認","進行の管理"]) +
 chat_close(composer()),
 _learn], "g21")

_iv0 = grid([
 CHAT_OPEN +
 cmsg("はじめまして。私は高本AI、あなたの代わりに動くAIです。これから会社のことを教えてもらって、私が目標・台帳・担当業務・AI社員のたたき台を作ります。"
      "<b>あなたが欄を埋めることはありません。</b>訊かれたことに答えるだけで大丈夫です。まず、何をしている会社ですか？",
      ["受託・制作","店舗・サービス業","EC・物販","その他"]) +
 chat_close(composer()),
 card(head("分かったこと") + empty("brain","まだ何もありません","答えるたびに、ここに積み上がります。あとから見直せますし、直せます。"))], "g21")

_ivf = grid([
 CHAT_OPEN +
 cmsg("いま困っていることは分かりました。<b>去年の請求書や案件の一覧があれば、投げてください。</b>形式は何でも構いません。私が読んで、台帳の項目と単価の相場を掴みます。") +
 umsg('<div style="display:flex;gap:9px;align-items:center">' + ic("file") + '<div><div style="font-weight:600">2025_請求一覧.xlsx</div><div class="muted" style="font-size:12px">38 KB</div></div></div>'
      '<div style="display:flex;gap:9px;align-items:center;margin-top:8px">' + ic("file") + '<div><div style="font-weight:600">案件メモ.pdf</div><div class="muted" style="font-size:12px">1.2 MB</div></div></div>') +
 cmsg('<div style="display:flex;gap:8px;align-items:center"><span class="spin dark"></span>読んでいます… 請求 27件・案件 14件を見つけました</div>') +
 chat_close(composer()),
 card(head("分かったこと", sub="ファイルから") + '<div class="learn">' + "".join(
  f'<div class="it">{ic("check")}<div><div class="k">{k}</div>{v}</div></div>' for k, v in [
   ("去年の売上","9,840,000円（請求27件）"),("平均単価","364,000円 · 最大 2,670,000円"),
   ("よく出る項目","案件名／顧客／金額／着手金／残金／入金日"),("段階の候補","引合 → 提案 → 受注 → 制作中 → 納品 → 請求 → 入金"),
  ]) + '</div>')], "g21")

_iv_nb = card(empty("bridge","先に自分のPCをつないでください",
  "高本AIはあなたのPCで、あなたのサブスクで動きます。つながるまで話せません（API は使いません）。",
  btn("PCをつなぐ","p","bridge","v1-bridge-setup.html")))
INTERVIEW = ("onboard-interview", [
  ("nb","Bridge 未接続","段階1は Bridge のみ。無言の空画面にしない。",wiz("onboard-interview",_iv_nb,"高本AIと話す","")),
  ("n","途中","",wiz("onboard-interview",_iv,"高本AIと話す","訊かれたことに答えるだけ。10分ほどで、会社のたたき台ができます。")),
  ("0","最初","何も知らない状態から。選択肢を出して、書かせない。",wiz("onboard-interview",_iv0,"高本AIと話す","訊かれたことに答えるだけ。10分ほどで、会社のたたき台ができます。")),
  ("f","資料を読ませる","形式を指定しない。AIが読んで台帳の形と相場を掴む。",wiz("onboard-interview",_ivf,"高本AIと話す","持っているものを投げてください。私が読みます。")),
 ], WIZ_CSS, True)

# ============================================================ onboard-draft
def _goal_card(diff=False):
    rows = [("今期の売上","12,000,000","円","会社"),("今期の成約","8","件","会社 → 営業"),("月のアプローチ","30","件","営業 → 週ごと"),("稼働率","75","%","制作")]
    body = '<div class="dl">' + "".join(
      f'<div class="{"diff" if diff and i==1 else ""}"><span style="flex:1">{n}</span><b class="num">{v}</b><span class="u">{u}</span><span class="muted" style="font-size:11.5px;white-space:nowrap">{s}</span></div>'
      for i,(n,v,u,s) in enumerate(rows)) + '</div>'
    note = ('<div class="muted" style="font-size:12px;margin-top:10px">単位は目標ごとに違います。売上は円、成約は件、稼働率は%。'
            '親子で単位が変わるところは、私が変換のしかたを訊きます。</div>')
    return card(head(f'{ic("target")}目標のたたき台', btn("会話で直す","g","chat")) + body + note)
def _ledger_card():
    return card(head(f'{ic("ledger")}台帳のたたき台', btn("会話で直す","g","chat")) +
      '<div class="dl">' + "".join(f'<div><span style="flex:1">{n}</span><span class="muted" style="font-size:12px">{d}</span></div>' for n,d in [
        ("案件","引合 → 提案 → 受注 → 制作中 → 納品 → 請求 → 入金 ／ 顧客・金額・着手金・残金・担当"),
        ("請求","下書き → 送付 → 入金待ち → 入金 ／ 案件・金額・期日"),
        ("問い合わせ","新着 → 返信済 → 商談 → 終了 ／ 出どころ・要件"),
      ]) + '</div><div class="muted" style="font-size:12px;margin-top:10px">去年の請求一覧から項目を拾いました。台帳ごとに画面は作りません。定義が違うだけです。</div>')
def _duty_card():
    return card(head(f'{ic("duty")}担当業務とAI社員', btn("会話で直す","g","chat")) +
      '<div class="dl">' + "".join(f'<div>{ic("ai")}<div style="flex:1"><b>{n}</b><div class="muted" style="font-size:12px">{d}</div></div>{pill(s,"ne")}</div>' for n,d,s in [
        ("営業社員","発注ナビの新着を台帳に入れる／アプローチ文を下書きする","運営配布"),
        ("経理社員","納品済み案件の請求書を作る／入金を照合して台帳に書く","運営配布"),
        ("CS社員","問い合わせに一次返信する（承認テンプレの範囲で）","会社作成"),
      ]) + '</div><div class="muted" style="font-size:12px;margin-top:10px">AI社員は私（高本AI）が窓口になって指示を配り、上がってきたものを一次確認します。あなたが押すのは最後だけです。</div>')
def _rule_card():
    return card(head(f'{ic("policy")}最初のルール') +
      '<div class="dl">' + "".join(f'<div>{ic("check")}<span>{t}</span></div>' for t in [
        "外に出るもの（メール・請求書・投稿）は必ずあなたが承認してから",
        "銀行はブラウザで触らない（会計ソフトの正規連携だけ）",
        "CAPTCHA は突破しない。出たら止めてあなたに渡す",
        "資格情報は私にもAI社員にも見えない（預かり先の番号だけ）",
      ]) + '</div>')

_dr = ('<div class="draft">' + _goal_card() + _ledger_card() + _duty_card() + _rule_card() + '</div>' +
  '<div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">' + btn("違うところを言う","o","chat") +
  '<a class="btn btn-p" href="v1-bridge-setup.html">' + ic("check") + 'これでいく</a></div>')

_dr_fix = grid([
 CHAT_OPEN +
 cmsg("たたき台を見て、違うところがあれば教えてください。") +
 umsg("成約は8件じゃなくて10件。あと稼働率は要らない。") +
 cmsg("直しました。今期の成約を <b>8 → 10件</b> に。稼働率の目標は消しました。<br>成約10件だと、月のアプローチは <b>30 → 38件</b> が目安になります（去年の成約率 2.6% から）。アプローチも上げますか？",
      ["38件にする","30のままでいい","別の考え方がある"]) +
 chat_close(composer("違うところを言う")),
 card(head("直したところ") + '<div class="dl">'
   '<div class="diff"><span style="flex:1">今期の成約</span><span class="num"><span class="del">8</span> → <b>10</b></span><span class="u">件</span></div>'
   '<div class="diff del"><span style="flex:1">稼働率 75%</span><span class="muted" style="font-size:12px">消した</span></div>'
   '<div class="diff"><span style="flex:1">月のアプローチ</span><span class="num"><span class="del">30</span> → <b>38</b>？</span><span class="u">件</span><span class="muted" style="font-size:11.5px">確認中</span></div>'
   '</div><div class="muted" style="font-size:12px;margin-top:10px">会話で直したものは、私が提案 → あなたが承認、で反映されます。</div>')], "g21")

_dr_edit = ('<div class="draft">' +
  card(head(f'{ic("target")}目標のたたき台', pill("直接編集中","pr","pen")) +
    '<div class="dl">' + "".join(
      f'<div><span style="flex:1">{n}</span>{inp(v,"","text","num","width:120px;text-align:right")}<span class="u">{u}</span></div>'
      for n,v,u in [("今期の売上","12,000,000","円"),("今期の成約","10","件"),("月のアプローチ","38","件")]) +
    f'<div style="display:flex;gap:8px;align-items:center;padding:10px 12px;border:1.5px dashed var(--line);border-radius:var(--r-md);color:var(--on-sv)">{ic("plus")}目標を足す　<span class="muted" style="font-size:12px">／　単位を作る</span></div></div>' +
    '<div class="muted" style="font-size:12px;margin-top:10px"><b>あなたが直接変えたものは、その場で反映されます</b>（承認は挟みません）。提案→承認が要るのはAIが変えるときだけです。</div>') +
  _ledger_card() + _duty_card() + _rule_card() + '</div>')

DRAFT = ("onboard-draft", [
  ("n","たたき台","",wiz("onboard-draft",_dr,"たたき台を確かめる","高本AIが会話と資料から作りました。違うところを言えば直します。自分で直接触っても構いません。")),
  ("f","会話で直す","AIが変えるときだけ提案→承認。差分を横に出す。",wiz("onboard-draft",_dr_fix,"たたき台を確かめる","違うところを言ってください。")),
  ("e","直接編集","人が変えるときは即反映・承認を挟まない。単位は顧客が作れる。",wiz("onboard-draft",_dr_edit,"たたき台を確かめる","自分で直すこともできます。")),
 ], WIZ_CSS, True)

SCREENS = [INTERVIEW, DRAFT]

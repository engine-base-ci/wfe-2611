# -*- coding: utf-8 -*-
"""P1 立ち上げ（続き）：credentials / ai-add / duty-test / ledger-def"""
from _icons import ic
from _parts import *

# ============================================================ credentials
_cr_list = (note("<b>AI は資格情報の中身を一度も見ません。</b> ID・パスワード・ワンタイムパスワードは暗号化して保管し、"
                 "AI に渡すのは<b>参照ID だけ</b>です。入力はブラウザを動かす仕組みの側が行い、"
                 "画面録画・ログ・スクリーンショットからも自動で伏せられます。", "primary") +
 card(table(["サービス", "種類", "自動操作", "持ち主", ("最終使用","r"), ""], [
   ["<b>発注ナビ</b><div class='muted' style='font-size:12px'>developer.hnavi.co.jp</div>",
    f'<span class="tag">{ic("eyeoff")} ID / パスワード</span>', pill("許可","su"), "<span class='muted'>会社</span>",
    ("今日 07:39","n"), (btn("編集"),"r")],
   ["<b>freee 会計</b>", f'<span class="tag">{ic("key")} OAuth 連携</span>', pill("許可（API）","su"),
    "<span class='muted'>会社</span>", ("昨日 17:41","n"), (btn("編集"),"r")],
   ["<b>Slack</b>", f'<span class="tag">{ic("key")} OAuth 連携</span>', pill("許可（API）","su"),
    "<span class='muted'>会社</span>", ("昨日 18:00","n"), (btn("編集"),"r")],
   ["<b>◯◯銀行</b>", f'<span class="tag">{ic("eyeoff")} ID / パスワード / ワンタイム</span>',
    pill("閲覧のみ（例外）","wa","warn"), "<span class='muted'>個人</span>", ("9/5","n"), (btn("編集"),"r")],
   ["<b>X（旧Twitter）</b>", f'<span class="tag">{ic("eyeoff")} ID / パスワード</span>',
    pill("禁止","da","x") + "<div class='muted' style='font-size:11.5px;margin-top:3px'>規約で自動操作が禁止されています</div>",
    "<span class='muted'>会社</span>", ("—","n"), (btn("編集"),"r")],
 ]), style="padding:0", ) if False else
 card(table(["サービス", "種類", "自動操作", "持ち主", ("最終使用","r"), ""], [
   ["<b>発注ナビ</b><div class='muted' style='font-size:12px'>developer.hnavi.co.jp</div>",
    f'<span class="tag">{ic("eyeoff")} ID / パスワード</span>', pill("許可","su"), "<span class='muted'>会社</span>",
    ("今日 07:39","n"), (btn("編集"),"r")],
   ["<b>freee 会計</b>", f'<span class="tag">{ic("key")} OAuth 連携</span>', pill("許可（API）","su"),
    "<span class='muted'>会社</span>", ("昨日 17:41","n"), (btn("編集"),"r")],
   ["<b>Slack</b>", f'<span class="tag">{ic("key")} OAuth 連携</span>', pill("許可（API）","su"),
    "<span class='muted'>会社</span>", ("昨日 18:00","n"), (btn("編集"),"r")],
   ["<b>◯◯銀行</b>", f'<span class="tag">{ic("eyeoff")} ID / パスワード / ワンタイム</span>',
    pill("閲覧のみ（例外）","wa","warn"), "<span class='muted'>個人</span>", ("9/5","n"), (btn("編集"),"r")],
   ["<b>X（旧Twitter）</b>", f'<span class="tag">{ic("eyeoff")} ID / パスワード</span>',
    pill("禁止","da","x") + "<div class='muted' style='font-size:11.5px;margin-top:3px'>規約で自動操作が禁止されています</div>",
    "<span class='muted'>会社</span>", ("—","n"), (btn("編集"),"r")],
 ])))

_cr_add = card(
  head("資格情報を登録する") +
  field("サービス名", inp("発注ナビ", "", "text", "", "max-width:420px")) +
  field("URL", inp("https://developer.hnavi.co.jp", "", "text", "", "max-width:420px")) +
  field("種類", '<select class="inp" style="max-width:420px"><option>ID / パスワード</option>'
        '<option>ID / パスワード / ワンタイムパスワード</option><option>OAuth 連携（推奨）</option>'
        '<option>API キー</option></select>',
        "OAuth や API が使えるサービスは、そちらを選んでください。ブラウザ操作より速く、壊れにくく、権限も細かく絞れます") +
  '<div style="border:1.5px solid var(--primary);border-radius:var(--r-md);padding:16px;background:var(--primary-c);margin-bottom:16px">'
  f'<div style="display:flex;gap:9px;align-items:center;margin-bottom:13px;font-weight:600;font-size:13.5px">{ic("lock")}ここから先は AI に渡りません</div>' +
  field("ID", inp("info@engine-base.com", "", "text", "", "background:var(--card)")) +
  '<div class="field" style="margin-bottom:0"><label>パスワード</label>' +
  inp("............", "", "password", "", "background:var(--card)") +
  '<div class="help">暗号化して保管します。この画面を閉じたあと、あなたも含めて誰も中身を見られません（差し替えのみ可能）。</div></div></div>' +
  field("自動操作の扱い", '<div style="display:flex;flex-direction:column;gap:9px">' + "".join(
    f'<label style="display:flex;gap:11px;align-items:flex-start;padding:13px;border:1.5px solid '
    f'{"var(--primary)" if i==0 else "var(--line)"};{"background:var(--primary-c);" if i==0 else ""}border-radius:var(--r-md)">'
    f'<input type="radio" name="a" {"checked" if i==0 else ""} style="margin-top:3px;accent-color:#22345C">'
    f'<div><b style="font-size:13.5px">{t}</b><div class="muted" style="font-size:12.5px">{d}</div></div></label>'
    for i, (t, d) in enumerate([
      ("許可する", "AI が Bridge 経由であなたのPCのブラウザを動かします"),
      ("閲覧のみ許可する", "読み取りだけ。書き込み・送信・申込みはしません"),
      ("保管するだけ（自動操作しない）", "人が使うためだけに保管します")])) + '</div>') +
  note("このサービスの利用規約を確認してください。<b>自動操作を明示的に禁じているサービスは登録できません。</b>"
       "銀行の振込操作、CAPTCHA の突破も同様に禁止です（アカウント凍結を招くため）。", "warn"))

CREDENTIALS = ("credentials", [("l","一覧","",_cr_list),
  ("a","登録する","「AIには渡らない」を UI の構造で見せる。囲いの中に入れたものは渡らない、と分かる形にする。",_cr_add)], "", False)

# ============================================================ ai-add
_ai_tpl = ('<p class="muted" style="font-size:13px;margin-bottom:18px">'
 'テンプレは<b>出発点</b>です。作ったあと、あなたの会社のやり方に合わせて担当業務を書き換えていきます。'
 'その書き換えの履歴が、そのままあなたの会社の資産になります。</p>' +
 grid(["".join([
   f'<div class="card" style="margin:0"><div class="card-h">{ic("ai")}<h2 style="font-size:14px">{n}</h2></div>'
   f'<div class="muted" style="font-size:12.5px;line-height:1.8;margin-bottom:14px">{d}</div>'
   f'<div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;margin-bottom:15px">'
   + "".join(f'<div style="display:flex;gap:7px"><span class="muted">·</span><span>{x}</span></div>' for x in du)
   + f'</div>{btn("この型で作る","o",None,None,"width:100%")}</div>'])
   for n, d, du in [
     ("AI 営業社員", "案件を集め、追いをかけ、見積を作る。受注したら経理に引き継ぐ。",
      ["新着案件の取り込み", "提案から3日で追いの文面を作る", "見積の作成"]),
     ("AI 経理社員", "請求書を作って送り、入金を消し込み、仕訳を登録する。",
      ["月次の請求書を作って送る", "入金の消込", "会計ソフトへの仕訳登録"]),
     ("AI CS 社員", "問い合わせに一次返信し、FAQ を育てる。",
      ["問い合わせの一次返信", "FAQ の更新", "解約の兆候を知らせる"]),
     ("AI 事務社員", "定型の入力・提出・申請をこなす。",
      ["勤怠の入力", "経費精算の登録", "各種申請の提出"]),
     ("AI 採用社員", "応募者を管理し、日程を調整する。",
      ["応募の取り込み", "日程調整", "選考状況の更新"]),
     ("白紙から作る", "型を使わず、担当業務をゼロから書きます。", ["名前と所属だけ決める"]),
   ]], "g3"))

_ai_chat = card(
  f'<div class="card-h">{ic("ai")}<h2>会話で作る</h2></div>' +
  '<div style="display:flex;flex-direction:column;gap:16px;margin-bottom:18px">' + "".join([
    '<div style="display:flex;gap:11px;max-width:80%"><div style="width:28px;height:28px;border-radius:var(--r-full);'
    f'background:var(--tertiary-c);color:var(--on-tertiary-c);display:grid;place-items:center;flex:none">{ic("ai")}</div>'
    '<div style="background:var(--tertiary-c);color:var(--on-tertiary-c);border-radius:var(--r-md);padding:11px 14px;'
    'font-size:13.5px;line-height:1.8">どんな仕事をしてほしいですか。いまあなたが手でやっていて、面倒なことをそのまま話してください。</div></div>',
    '<div style="display:flex;gap:11px;max-width:80%;margin-left:auto;flex-direction:row-reverse">'
    '<div style="width:28px;height:28px;border-radius:var(--r-full);background:var(--primary);color:#fff;'
    'display:grid;place-items:center;font-size:11px;font-weight:700;flex:none">高</div>'
    '<div style="background:var(--primary);color:#fff;border-radius:var(--r-md);padding:11px 14px;font-size:13.5px;'
    'line-height:1.8">毎朝、発注ナビを見て新しい案件が出てないか確認してる。条件に合うのだけ拾いたい。応募は自分でやる。</div></div>',
    '<div style="display:flex;gap:11px;max-width:80%"><div style="width:28px;height:28px;border-radius:var(--r-full);'
    f'background:var(--tertiary-c);color:var(--on-tertiary-c);display:grid;place-items:center;flex:none">{ic("ai")}</div>'
    '<div style="background:var(--tertiary-c);color:var(--on-tertiary-c);border-radius:var(--r-md);padding:11px 14px;'
    'font-size:13.5px;line-height:1.8">分かりました。3つだけ確認させてください。<br>'
    '① 「条件に合う」の条件は何ですか（例：Web/アプリ・金額の下限）<br>'
    '② 拾ったものはどこに入れますか（台帳を作りますか）<br>'
    '③ 条件から外れたものは、捨てますか・理由を残しますか</div></div>']) + '</div>' +
  '<div style="display:flex;gap:9px;align-items:flex-end">'
  '<textarea class="inp" rows="2" placeholder="答える" style="resize:none"></textarea>'
  f'<button class="btn btn-p">{ic("arrow")}送る</button></div>')

_ai_conf = card(
  f'<div class="card-h">{ic("ai")}<h2>この内容で作ります</h2></div>' +
  field("名前", inp("AI 営業社員", "", "text", "", "max-width:420px")) +
  field("所属", '<select class="inp" style="max-width:420px"><option>高本 雅人 の配下</option></select>') +
  field("権限", '<select class="inp" style="max-width:420px"><option>担当者（案件パイプラインのみ）</option></select>') +
  '<div class="card-h" style="margin-top:22px"><h2 style="font-size:13.5px">最初に持つ担当業務</h2></div>' +
  rail("毎朝7時に発注ナビを開き、新着案件のうち<br>"
       "・Web / アプリ開発であること<br>・想定金額が 1,000,000 以上であること<br>"
       "を満たすものを台帳「案件パイプライン」に段階「問い合わせ」で追加する。<br>"
       "条件を外れたものは追加せず、外した理由を1行で記録する。<br><br>"
       "<b>やってはいけないこと：案件に応募する / CAPTCHA を突破する / 二重に登録する</b>") +
  '<div class="card-h" style="margin-top:18px"><h2 style="font-size:13.5px">この AI 社員が通る関門</h2></div>'
  '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:18px">' +
  "".join(pill(x, "pr") for x in ["C1 ネットワーク", "C2 永続化", "C3 モデル呼び出し", "C8 秘密"]) + '</div>' +
  note("<b>最初はテストモードで動かします。</b>実データを読みますが、外に出る操作と書き込みはすべて止めます。"
       "結果を見てから本番に切り替えてください。", "warn"))

AI_ADD = ("ai-add", [("t","テンプレから","",_ai_tpl),("c","会話で作る","",_ai_chat),("f","確認","",_ai_conf)], "", False)

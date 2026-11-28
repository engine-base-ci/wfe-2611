# -*- coding: utf-8 -*-
"""P2 毎日（続き）：approvals / approval-detail / ledger / record-detail"""
from _icons import ic
from _parts import *

# ============================================================ approvals
def _row(gate, who, title, body, meta, risk):
    return card(
      f'<div style="display:flex;gap:14px;align-items:flex-start">'
      f'<div style="flex:1;min-width:0">'
      f'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:7px">'
      f'{ai_pill(who)}<span class="tag">関門 <b style="color:var(--on-surface)">{gate}</b></span>'
      f'<span class="tag">{meta}</span></div>'
      f'<div style="font-weight:600;font-size:15px;margin-bottom:5px">'
      f'<a href="v1-approval-detail.html">{title}</a></div>'
      f'<div class="muted" style="font-size:13px;line-height:1.8">{body}</div></div>'
      f'<div style="display:flex;flex-direction:column;gap:7px;flex:none;width:150px">'
      + btn("承認して実行","p","check") + btn("修正を指示","g","chat")
      + btn("却下","g","x",None,"color:var(--error)") + '</div></div>'
      f'<div style="background:var(--surface);border-top:1px solid var(--line-soft);margin:16px -20px -20px;'
      f'padding:9px 20px;font-size:12px;color:var(--on-sv);display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      f'{ic("policy")}<span>承認すると <b>{risk}</b></span></div>')

_ap = ('<div style="display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap">' +
 pill("承認待ち 3","wa","clock") +
 '<span class="muted" style="font-size:12.5px">AI 社員の提案は、外に出る直前でここに必ず止まります。ここ以外に出口はありません。</span>'
 '<div style="flex:1"></div>' + btn("自動承認の条件を決める","g","policy","v1-policies.html") + '</div>' +
 _row("C1 ネットワーク","AI 経理社員","株式会社◯◯ 様への請求書を送る",
   "9月分の受託開発費として請求書を作りました。金額は契約書の月額と一致しています。宛先は経理ご担当の accounting@ 宛です。",
   "3分前","<b>PDFが添付されたメールが実際に送信されます</b>（取り消せません）") +
 _row("C1 ネットワーク","AI 営業社員","セイコー様への追いのメールを送る",
   "提案から7日経過し、先方の検討期限が明後日です。催促に見えない書き方で一次返信を促す文面にしました。",
   "1時間前","<b>先方にメールが届きます</b>。文面はあなたの過去の送信文から学習しています") +
 _row("C2 永続化","AI 営業社員","案件パイプラインに 5件を追加する",
   "発注ナビの新着12件のうち、条件（Web/アプリ・100万円以上）に合う5件を台帳に入れます。残り7件は理由を付けて見送りにします。",
   "7時間前","台帳に5行が追加されます（あとから削除できます）"))

_ap_empty = (card(empty("check", "承認待ちはありません",
  "AI 社員が外に出る操作をしようとすると、必ずここに止まります。いまは止まっているものがありません。",
  btn("今日実行されたものを見る","o","log","v1-runs.html"))) +
 card(head("直近で承認したもの", btn("すべて見る","g","right","v1-runs.html")) +
   table(["内容","AI社員","関門",("承認","r"),"結果"], [
     ["問い合わせ4件への一次返信","AI CS 社員","<span class='muted'>C1</span>",("07:02","n"),pill("完了","su","check")],
     ["週次レポートを Slack に投稿","AI 経営クローン","<span class='muted'>C6</span>",("昨日 18:00","n"),pill("完了","su","check")],
     ["freee への売上仕訳の登録","AI 経理社員","<span class='muted'>C1</span>",("昨日 17:41","n"),pill("完了","su","check")],
   ])))

APPROVALS = ("approvals", [("n","通常（3件）","",_ap),("e","空（0件）","",_ap_empty)], "", False)

# ============================================================ approval-detail
_ad = (f'<a href="v1-approvals.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 grid([
  card('<div class="card-h">' + ai_pill("AI 経理社員") + '<h2>株式会社◯◯ 様への請求書を送る</h2></div>' +
    '<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-md);padding:20px;margin-bottom:16px">'
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">'
    '<div><div style="font-size:17px;font-weight:700">請求書</div>'
    '<div class="muted num" style="font-size:12px">INV-2026-0912</div></div>'
    '<div style="text-align:right;font-size:12px" class="muted">株式会社ENGINE BASE<br>東京都◯◯区◯◯ 1-2-3</div></div>' +
    table(["品目",("数量","r"),("単価","r"),("金額","r")], [
      ["受託開発費（2026年9月分）",("1","n"),("1,200,000","n"),("1,200,000","n")],
      ["消費税",("—","n"),("—","n"),("120,000","n")],
      ["<b>合計</b>",("","n"),("","n"),('<b style="font-size:16px">1,320,000</b>',"n")],
    ]) + '</div>' +
    '<div style="display:flex;gap:9px;flex-wrap:wrap">'
    f'<button class="btn btn-p">{ic("check")}承認して実行</button>'
    f'<button class="btn btn-o">{ic("chat")}修正を指示</button>'
    f'<button class="btn btn-g" style="color:var(--error)">{ic("x")}却下</button></div>'),
  card(head("この操作が通る関門") +
    '<div style="display:flex;flex-direction:column;gap:11px;font-size:13px">' + "".join(
      f'<div style="display:flex;gap:10px">{pill(c, k)}'
      f'<div><b>{n}</b><div class="muted" style="font-size:12px">{d}</div></div></div>'
      for c, k, n, d in [("C1","pr","ネットワーク","メール送信（外部に出る・取り消せない）"),
                         ("C4","ne","ファイル","PDF の生成と保管"),
                         ("C2","ne","永続化","請求台帳に「送付済」を書く")]) + '</div>') +
  card(head("判断の材料") +
    kv([("金額の根拠","契約書 §3 月額 1,200,000"),("宛先の根拠","前回請求と同一（3か月連続）"),
        ("使う資格情報", f'<span class="tag">{ic("lock")} メール送信用（AIは中身を見ていません）</span>'),
        ("この判断の確度", '<span class="num">0.92</span>')])) +
  card(head("今後これを自動にする") +
    '<p class="muted" style="font-size:12.5px;margin-bottom:12px">'
    '同じ形の請求（既存顧客・契約書と一致・100万円以下）を毎回止めずに自動で送るようにできます。</p>' +
    btn("条件を決める","o","policy","v1-policies.html",'width:100%')),
 ], "g21"))

_ad_mail = (f'<a href="v1-approvals.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 grid([
  card('<div class="card-h">' + ai_pill("AI 営業社員") + '<h2>セイコー様への追いのメールを送る</h2></div>' +
    kv([("宛先","yamada@seiko-example.co.jp"),("差出人","info@engine-base.com"),
        ("件名","画像編集SaaS のご提案につきまして")]) +
    '<div style="margin:16px 0">' + rail(
      "セイコー 山田様<br>お世話になっております。ENGINE BASE の高本です。<br><br>"
      "先日ご提案しました画像編集SaaSの件、社内でのご検討状況はいかがでしょうか。<br>"
      "仕様のご相談だけでも承りますので、お気軽にお申し付けください。<br><br>"
      "何卒よろしくお願いいたします。") + '</div>' +
    note("<b>この文面はあなたの過去の送信文から学習しています。</b>「お世話になっております」で始めるのは、"
         "あなたの個人ルールとして記憶されています。", "info") +
    '<div style="display:flex;gap:9px;flex-wrap:wrap">'
    f'<button class="btn btn-p">{ic("check")}承認して実行</button>'
    f'<button class="btn btn-o">{ic("chat")}修正を指示</button>'
    f'<button class="btn btn-g" style="color:var(--error)">{ic("x")}却下</button></div>'),
  card('<div class="card-h">' + ic("warn") + '<h2 style="font-size:14px">押すと取り消せません</h2></div>'
    '<p style="font-size:13px;line-height:1.85">送信したメールは<b>取り消せません</b>。'
    '文面と宛先を確認してから押してください。<br><br>'
    '台帳への書き込み（「追い済」）だけは、あとから実行ログで取り消せます。</p>') +
  card(head("この案件") +
    f'<a href="v1-record-detail.html" style="display:flex;gap:9px;align-items:center;padding:11px;'
    f'background:var(--surface);border-radius:var(--r-md)">{dot("d-indigo")}'
    '<div style="flex:1"><div style="font-size:13px;font-weight:600">セイコー 食品パッケージ画像編集SaaS</div>'
    '<div class="muted num" style="font-size:11.5px">3,300,000 · 提案済 · 7日経過</div></div>' + ic("right") + '</a>'),
 ], "g21"))

APPROVAL_DETAIL = ("approval-detail", [
  ("i","請求書","押す前に「何が起きるか・どの関門を通るか・どの資格情報を使うか」が全部見える形にする。",_ad),
  ("m","メール","",_ad_mail)], "", False)

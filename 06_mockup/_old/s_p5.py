# -*- coding: utf-8 -*-
"""P5 例外：procedures / procedure-detail / runs / run-detail / policies"""
from _icons import ic
from _parts import *

# ============================================================ procedures
_pr = ('<p class="muted" style="font-size:13px;margin-bottom:18px">'
 '初回は AI が画面を見ながら操作します。<b>その手順を覚えて、2回目以降はそのまま再生します</b>（LLM を呼びません）。'
 '画面が変わって再生が失敗したときだけ、AI が出てきて覚え直します。</p>' +
 grid([card(metric("覚えた操作","12","習得済 9 · 学習中 2 · 要再学習 1")),
       card(metric("直近30日の再生","1,284 回","うち LLM を呼んだのは 23回（1.8%）")),
       card(metric("LLM の従量課金","¥0","Bridge 経由で実行しているため"))], "g3") +
 '<div style="height:16px"></div>' +
 card(table(["覚えた操作","対象","状態",("手順","r"),("再生","r"),("失敗","r"),("最終確認","r")], [
   ['<a href="v1-procedure-detail.html"><b>発注ナビ 新着案件の取り込み</b></a>',
    '<span class="muted">developer.hnavi.co.jp</span>', pill("習得済","su","check"),
    ("6","n"),("218","n"),("3","n"),("今日 07:41","n")],
   ['<a href="v1-procedure-detail.html"><b>freee に売上仕訳を登録</b></a>',
    '<span class="muted">freee 会計</span>', pill("習得済","su","check"),
    ("9","n"),("64","n"),("0","n"),("昨日 17:41","n")],
   ['<a href="v1-procedure-detail.html"><b>◯◯銀行の入金明細を確認</b></a>'
    '<div class="muted" style="font-size:12px">画面が変わって再生に失敗しました</div>',
    '<span class="muted">（銀行）</span>', pill("要再学習","da","warn"),
    ("7","n"),("41","n"),('<span style="color:var(--st-danger)">2</span>',"n"),("9/5","n")],
   ['<a href="v1-procedure-detail.html"><b>Slack に週次レポートを投稿</b></a>',
    '<span class="muted">Slack</span>', pill("習得済","su","check"),
    ("3","n"),("18","n"),("0","n"),("昨日 18:00","n")],
   ['<a href="v1-procedure-detail.html"><b>Google カレンダーに商談を入れる</b></a>',
    '<span class="muted">Google Calendar</span>', pill("学習中","wa","clock"),
    ("5","n"),("4","n"),("1","n"),("9/6","n")],
 ])))

PROCEDURES = ("procedures", [("l","一覧","",_pr)], "", False)

# ============================================================ procedure-detail
_pd = (f'<a href="v1-procedures.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 grid([
  card(head("発注ナビ 新着案件の取り込み", btn("テスト再生","o","play")) +
    '<div style="margin-bottom:14px">' + pill("習得済","su","check") + '</div>'
    '<p class="muted" style="font-size:12.5px;margin-bottom:16px">'
    '手順は<b>日本語で見えます</b>。中で使っている画面上の位置情報は、書き換えられると事故になるため表示しません。</p>'
    '<div style="display:flex;flex-direction:column;gap:0">' + "".join(
      f'<div style="display:flex;gap:13px;align-items:flex-start;padding:13px 0;border-bottom:1px solid var(--line-soft)">'
      f'<span class="num" style="width:24px;height:24px;border-radius:var(--r-full);background:var(--sv);'
      f'display:grid;place-items:center;font-size:11.5px;font-weight:700;flex:none">{i}</span>'
      f'<div style="flex:1"><div style="font-weight:500;font-size:13.5px">{t}</div>'
      f'<div class="muted" style="font-size:12px;margin-top:2px">{m}</div></div>{v}</div>'
      for i, t, m, v in [
        (1,"developer.hnavi.co.jp にログインする","資格情報「発注ナビ」を使用（中身は AI に渡していません）",
         f'<span class="tag">{ic("lock")} 秘密</span>'),
        (2,"新着案件の一覧を開く","",""),
        (3,"条件で絞り込む（Web/アプリ・100万円以上）","この条件は担当業務の定義から読む", pill("可変")),
        (4,"1件ずつ詳細を開いて要件を読む","",""),
        (5,"台帳「案件パイプライン」に追加する","段階＝問い合わせ",""),
        (6,"条件を外れたものは理由を記録する","",""),
      ]) + '</div>'),
  card(head("この操作の実績") +
    kv([("再生回数",'<span class="num">218</span>'),("失敗",'<span class="num">3（1.4%）</span>'),
        ("平均所要",'<span class="num">1分52秒</span>'),("初回学習",'<span class="num">2026-06-14</span>'),
        ("最終確認",'<span class="num">今日 07:41</span>')])) +
  card(head("スコープ") +
    '<p style="font-size:13px;line-height:1.8">この操作は<b>会社</b>のものです。ENGINE BASE の中でだけ使えます。</p>'
    '<p class="muted" style="font-size:12px;margin-top:10px">'
    '他社に自動で共有されることはありません。共有するには明示的に「公開」する必要があります。</p>') +
  card(head("やってはいけないこと") +
    '<ul style="font-size:12.5px;line-height:1.85;padding-left:18px;color:var(--on-sv)">'
    '<li>案件に応募する</li><li>CAPTCHA を突破する</li><li>同じ案件を二重登録する</li></ul>'),
 ], "g21"))

_pd_re = (f'<a href="v1-procedures.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 card('<div class="card-h">' + ic("warn") +
  '<h2 style="color:var(--st-danger)">◯◯銀行の入金明細を確認 — 画面が変わりました</h2></div>'
  '<p style="font-size:14px;line-height:1.85;margin-bottom:16px">'
  '手順4「明細一覧を開く」で、覚えていた場所にボタンがありませんでした。'
  '<b>勝手に別の場所を押すことはしません</b>（誤操作は取り返しがつかないため）。ここで止めています。</p>' +
  code("""[09:12:04] 覚えた操作「◯◯銀行の入金明細を確認」を再生
[09:12:06] 手順 1/7  ログイン                        OK
[09:12:11] 手順 2/7  ワンタイムパスワードを入力      OK
[09:12:14] 手順 3/7  口座を選ぶ                      OK
[09:12:16] 手順 4/7  明細一覧を開く                  <b style="color:#F87171">見つかりません</b>
[09:12:16] 中断しました。人に引き継ぎます。""") +
  '<div style="margin-top:18px">' + ai("AI 経理社員",
    "画面を見比べたところ、「明細照会」というメニューが新しく増えており、以前の「入出金明細」はその中に移動したようです。"
    "<b>覚え直してよければ、私がもう一度画面を見て手順を作り直します。</b>"
    "作り直した手順は、実行する前にあなたに見せます。",
    btn("覚え直させる","p","check") + btn("自分で手順を直す","g","route") + btn("この操作を止めておく")) + '</div>',
  style="border-color:var(--st-danger)") +
 card(head("この操作は銀行を対象にしています") +
   note("<b>銀行サイトのブラウザ操作は、既定では禁止です。</b>"
        "この操作は「明細の閲覧のみ・振込操作を含まない」として例外登録されています。"
        "<b>振込・送金の手順を含む操作は、例外登録があっても作れません。</b>"
        "入出金の取り込みは freee / マネーフォワードの正規連携を使うことを推奨します。", "warn") +
   '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
   btn("例外登録を見る","o","policy","v1-policies.html") + btn("正規連携に切り替える") + '</div>'))

PROCEDURE_DETAIL = ("procedure-detail", [
  ("d","手順","手順は日本語で見せ、画面上の位置情報は書き換え事故を防ぐため見せない。",_pd),
  ("r","要再学習","画面が変わって再生に失敗した状態。勝手に別の場所を押さず、必ず人に引き継ぐ。",_pd_re)], "", False)

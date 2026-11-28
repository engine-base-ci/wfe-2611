# -*- coding: utf-8 -*-
"""P2 毎日（続き2）：ledger / record-detail / chat / search"""
from _icons import ic
from _parts import *

# ============================================================ ledger（3画面を統合したもの）
_SWITCH = ('<div style="display:flex;gap:9px;align-items:center;margin-bottom:18px;flex-wrap:wrap">'
  f'<button class="btn btn-p btn-sm">{dot("d-indigo")}案件パイプライン</button>'
  f'<button class="btn btn-g btn-sm">{dot("d-teal")}請求</button>'
  '<span style="width:1px;height:22px;background:var(--line);margin:0 4px"></span>'
  '<button class="btn btn-p btn-sm">ファネル</button><button class="btn btn-g btn-sm">一覧</button>'
  '<div style="flex:1"></div>' + btn("定義を編集","g","settings","v1-ledger-def.html") + '</div>')

def _stage(name, color, cnt, amount, cards):
    body = "".join(
      f'<a href="v1-record-detail.html" style="display:block;background:var(--card);border:1px solid var(--line);'
      f'border-radius:var(--r-md);padding:11px 12px">'
      f'<div style="font-weight:600;font-size:13px;line-height:1.5;margin-bottom:6px">{c[0]}</div>'
      f'<div class="num" style="font-size:14px;font-weight:600;margin-bottom:5px">{c[1]}</div>'
      f'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">{c[2]}</div></a>' for c in cards)
    return (f'<div style="flex:1;min-width:196px">'
      f'<div style="display:flex;align-items:center;gap:7px;margin-bottom:9px">{dot(color)}'
      f'<b style="font-size:12.5px">{name}</b><span class="muted num" style="font-size:11.5px">{cnt}</span>'
      f'<div style="flex:1"></div><span class="num muted" style="font-size:11.5px">{amount}</span></div>'
      f'<div style="background:var(--surface);border-radius:var(--r-md);padding:9px;display:flex;'
      f'flex-direction:column;gap:8px;min-height:150px">{body}</div></div>')

_lg_funnel = (_SWITCH + '<div class="t-wrap"><div style="display:flex;gap:12px;min-width:900px">' +
 _stage("問い合わせ","d-indigo","8件","4,100,000",[
   ("介護施設の予約管理システム","1,200,000",'<span class="tag">発注ナビ</span>'),
   ("EC の在庫連携","800,000",'<span class="tag">紹介</span>')]) +
 _stage("ヒアリング","d-indigo","6件","5,300,000",[
   ("SOICO QRテーブル注文","2,400,000",pill("商談予定","pr"))]) +
 _stage("提案済","d-amber","5件","6,800,000",[
   ("セイコー 画像編集SaaS","3,300,000",pill("7日経過","wa") + ai_pill("追い提案あり")),
   ("ScoliVio 3D 追加開発","1,500,000",'<span class="tag">確度 60%</span>')]) +
 _stage("内定","d-sage","3件","2,400,000",[
   ("京蟻 オンラインガチャ","1,826,000",pill("条件合意","su"))]) +
 _stage("受注","d-sage","12件","—",[
   ("SLM createGO 音声通訳","—",pill("受注","su","check"))]) +
 '</div></div>' +
 card(ai("AI 営業社員",
   "「提案済」に <b>7日以上動いていないものが3件</b>あります。過去の実績では、提案から10日を超えると受注率が "
   "34% → 11% に落ちています。3件それぞれに合わせた追いの文面を作りました。",
   btn("3件を承認箱に送る","p","arrow","v1-approvals.html"))))

_lg_table = (_SWITCH.replace('<button class="btn btn-p btn-sm">ファネル</button><button class="btn btn-g btn-sm">一覧</button>',
                             '<button class="btn btn-g btn-sm">ファネル</button><button class="btn btn-p btn-sm">一覧</button>') +
 card(table(["案件","段階","担当",("想定金額","r"),("確度","r"),("最終更新","r")], [
   ['<a href="v1-record-detail.html"><b>セイコー 食品パッケージ画像編集SaaS</b></a>'
    '<div class="muted" style="font-size:12px">株式会社セイコー</div>', pill("提案済","wa"), "高本",
    ("3,300,000","n"),("70%","n"),("7日前","n")],
   ['<a href="v1-record-detail.html"><b>SOICO QRテーブル注文</b></a>'
    '<div class="muted" style="font-size:12px">SOICO株式会社</div>', pill("ヒアリング","pr"), "高本",
    ("2,400,000","n"),("50%","n"),("2日前","n")],
   ['<a href="v1-record-detail.html"><b>京蟻 オンラインガチャ</b></a>'
    '<div class="muted" style="font-size:12px">株式会社京蟻</div>', pill("内定","su"), "高本",
    ("1,826,000","n"),("90%","n"),("昨日","n")],
   ['<a href="v1-record-detail.html"><b>ScoliVio 3D 追加開発</b></a>'
    '<div class="muted" style="font-size:12px">株式会社ScoliVio</div>', pill("提案済","wa"), "高本",
    ("1,500,000","n"),("60%","n"),("4日前","n")],
   ['<a href="v1-record-detail.html"><b>介護施設の予約管理システム</b></a>'
    '<div class="muted" style="font-size:12px">（発注ナビ経由・社名未開示）</div>' + ai_pill("AIが追加"),
    pill("問い合わせ"), "AI 営業社員", ("1,200,000","n"),("20%","n"),("今日 07:41","n")],
 ])))

_lg_inv = ('<div style="display:flex;gap:9px;align-items:center;margin-bottom:18px;flex-wrap:wrap">'
  f'<button class="btn btn-g btn-sm">{dot("d-indigo")}案件パイプライン</button>'
  f'<button class="btn btn-p btn-sm">{dot("d-teal")}請求</button>'
  '<div style="flex:1"></div>' + btn("定義を編集","g","settings","v1-ledger-def.html") + '</div>' +
 grid([card(metric("今期の入金","8,330,000","目標 12,000,000 に対して 69.4%",69.4)),
       card(metric("送付済・未入金",'<span style="color:var(--st-warning)">2,640,000</span>',"3件 · うち期限超過 1件")),
       card(metric("未送付","1,320,000",'1件 · <a href="v1-approvals.html" style="color:var(--primary);font-weight:600">承認待ち</a>'))],
      "g3") + '<div style="height:16px"></div>' +
 card(table(["請求書","取引先","状態",("金額","r"),("発生日","r"),("支払期限","r")], [
   [('<a href="v1-record-detail.html" class="num">INV-2026-0912</a>'),"株式会社◯◯",pill("承認待ち","wa","clock"),
    ("1,320,000","n"),("2026-09-08","n"),("2026-10-31","n")],
   [('<a href="v1-record-detail.html" class="num">INV-2026-0811</a>'),"株式会社ScoliVio",pill("期限超過","da","warn"),
    ("1,100,000","n"),("2026-08-05","n"),('<span style="color:var(--st-danger)">2026-08-31</span>',"n")],
   [('<a href="v1-record-detail.html" class="num">INV-2026-0810</a>'),"SLM株式会社",pill("送付済","pr","clock"),
    ("1,540,000","n"),("2026-08-01","n"),("2026-09-30","n")],
   [('<a href="v1-record-detail.html" class="num">INV-2026-0709</a>'),"株式会社REMARE",pill("入金済","su","check"),
    ("880,000","n"),("2026-07-10","n"),("2026-08-31","n")],
 ])) +
 card(ai("AI 経理社員",
   'ScoliVio 様の <span class="num">1,100,000</span> が期限を8日超過しています。前回も7日遅れており、'
   '担当者の方は月初に処理される傾向があります。<b>今週金曜に丁寧な確認メール</b>を出すのが最も回収が早い見込みです。',
   btn("確認メールの下書きを作る","p","mail"))))

_lg_empty = card(empty("ledger", "この台帳にはまだ1行もありません",
  "手で足す、CSV を取り込む、AI社員に集めさせる ── どれでも同じ台帳に入ります。",
  btn("1行足す","p","plus") + btn("CSV を取り込む","o","file") + btn("AI に集めさせる","o","ai")))

LEDGER = ("ledger", [
  ("f","案件パイプライン（ファネル）","",_lg_funnel),
  ("t","案件パイプライン（一覧）","同じ定義を一覧として描いたもの。画面は1つで、ビューの種類が違うだけ。",_lg_table),
  ("i","請求（取引型）","<b>同じ画面です。</b>台帳の定義が違うだけで、画面を作り分けていません。",_lg_inv),
  ("e","空","",_lg_empty)], "", False)

# ============================================================ record-detail
_rd = (f'<a href="v1-ledger.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}台帳に戻る</a>' +
 grid([
  card('<div class="card-h">' + pill("提案済","wa") +
    '<h2>セイコー 食品パッケージ画像編集SaaS</h2><div class="sp"></div>'
    '<span class="muted num" style="font-size:12.5px">7日経過</span></div>' +
    grid([kv([("会社名","株式会社セイコー"),("担当","高本 雅人"),("流入元","発注ナビ"),
              ("発生日",'<span class="num">2026-08-20</span>')]),
          kv([("想定金額",'<b class="num" style="font-size:16px">3,300,000</b>'),("確度",'<span class="num">70%</span>'),
              ("次の段階","内定"),("期限まで",'<span class="num" style="color:var(--st-danger)">あと3日</span>')])]) +
    '<div style="height:18px"></div>' +
    ai("この案件についての要約",
      "8/20 に発注ナビ経由で問い合わせ。8/25 に商談し、画像編集の自動化と権限管理が要件。"
      "9/1 に 3,300,000 で提案。<b>以降7日間、先方から反応がありません。</b><br>"
      "山田様は前回のやり取りで「社内の稟議に2週間かかる」と言われています。"
      "検討期限が明後日なので、<b>いま一次返信をもらえるかで決まります</b>。",
      btn("追いの文面を承認する","p","check","v1-approval-detail.html"))) +
  card(head("履歴") +
    '<div style="display:flex;flex-direction:column;gap:0">' + "".join(
      f'<div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line-soft)">'
      f'<span class="num muted" style="min-width:52px;font-size:12px">{d}</span>'
      f'<div style="flex:1;font-size:13px"><b>{t}</b>'
      f'<div class="muted" style="font-size:12px">{s}</div></div>{w}</div>'
      for d, t, s, w in [
        ("09-08","AI が追いの文面を作った","承認箱で待機中",ai_pill("AI")),
        ("09-01","提案済 に移動","3,300,000 で提案書を送付",'<span class="tag">高本</span>'),
        ("08-25","ヒアリング に移動","Zoom 商談 60分",'<span class="tag">高本</span>'),
        ("08-20","問い合わせ として追加","発注ナビの新着から",ai_pill("AI")),
      ]) + '</div>'),
  card(head("この行が関わるもの") +
    '<div style="display:flex;flex-direction:column;gap:9px">' + "".join(
      f'<a href="{h}" style="display:flex;gap:9px;align-items:center;padding:11px;background:var(--surface);'
      f'border-radius:var(--r-md)">{ic(i)}<div style="flex:1"><div style="font-size:13px;font-weight:600">{t}</div>'
      f'<div class="muted" style="font-size:11.5px">{s}</div></div>{ic("right")}</a>'
      for i, t, s, h in [
        ("target","Q3 受注 4件","この案件が決まれば達成","v1-goals.html"),
        ("check","セイコー様へ一次返信を取りに行く","今日が期限","v1-task-detail.html"),
        ("chat","セイコー様との会話","3スレッド","v1-chat.html"),
        ("log","この行に対する実行","4件","v1-runs.html"),
        ("inbox","承認待ちの操作","1件","v1-approval-detail.html"),
      ]) + '</div>'),
 ], "g21"))

RECORD_DETAIL = ("record-detail", [
  ("d","案件の詳細","一覧だけ作って詳細が無い、が最も出やすい抜け。ここが「1件を開いて中を見る」の受け皿。",_rd)], "", False)

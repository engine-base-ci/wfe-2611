# -*- coding: utf-8 -*-
"""P2/P3：records / record-detail"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _views import VIEWS_CSS, VIEW_JS, view_bar, kanban

STAGES = ["引合","提案","受注","制作中","納品","請求","入金"]
def _stage_bar(cur):
    i = STAGES.index(cur)
    return '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">' + "".join(
      f'<span style="font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:var(--r-full);'
      f'background:{"var(--primary)" if j==i else ("var(--primary-c)" if j<i else "var(--sv)")};color:{"#fff" if j==i else ("var(--on-primary-c)" if j<i else "var(--on-sv)")}">{s}</span>'
      for j,s in enumerate(STAGES)) + '</div>'

ROWS = [
 ("セイコー 食品パッケージ画像編集SaaS","株式会社セイコー","提案","3,300,000","高本","7日","d-indigo",True),
 ("京蟻 オンラインガチャ","京蟻","受注","1,826,000","高本","2日","d-indigo",False),
 ("ScoliVio 3D解析","会津大学","制作中","2,670,000","高本","—","d-sage",False),
 ("SOICO QRテーブル注文","SOICO","引合","—","高本","1日","d-teal",False),
 ("△△ コーポレートサイト","△△","制作中","480,000","佐藤","—","d-sage",False),
 ("◯◯商事 業務システム","◯◯商事","提案","1,200,000","佐藤","12日","d-indigo",True),
]
def _rows(sel):
    return [[f'<a href="v1-record-detail.html" style="font-weight:600">{n}</a><div class="muted" style="font-size:12px">{c}</div>',
             f'<span class="tag">{dot(col)}{st}</span>', (a,"n"), w,
             (f'<span style="{"color:var(--st-danger);font-weight:600" if stuck else ""}">{d}</span>',"n")]
            for n,c,st,a,w,d,col,stuck in ROWS if sel(st,w,stuck)]

_rc = card(head("案件", btn("足す","g","plus") + btn("台帳の形を変える","g","settings","v1-ledger-def.html"), "6件 · 見込み合計 9,476,000") +
  '<div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap">' + "".join(
    f'<span style="font-size:12px;font-weight:600;padding:4px 11px;border-radius:var(--r-full);background:{"var(--primary-c)" if i==0 else "var(--sv)"}">{s}</span>'
    for i,s in enumerate(["すべて"]+STAGES)) + '</div>' +
  table(["案件","段階",("金額","r"),"担当",("止まって","r")], _rows(lambda st,w,k: True)))

_rc_stuck = card(head("止まっている", sub="段階が7日以上動いていないもの") + table(["案件","段階",("金額","r"),"担当",("止まって","r")], _rows(lambda st,w,k: k)) +
  clone_box("高本AI","◯◯商事は佐藤さんの提案が12日止まっています。先方の担当者が異動したと問い合わせに出ていました。佐藤さんに新しい担当者宛の再提案を配りますか？", btn("配る","p","check")+btn("私がやる","g")))

_rc_r3 = card(head("案件", sub="あなたの担当 2件") + table(["案件","段階",("金額","r"),("止まって","r")],
  [[r[0],r[1],r[2],r[4]] for r in _rows(lambda st,w,k: w=="佐藤")]))

_rc_other = card(head("請求", btn("台帳を切り替える","g","down"), "5件 · 入金待ち 1,620,000") +
  table(["請求","案件","段階",("金額","r"),("期日","r")], [
    ['<a href="v1-record-detail.html" style="font-weight:600">INV-0027</a>',"京蟻 オンラインガチャ",f'<span class="tag">{dot("d-amber")}送付済</span>',("1,826,000","n"),("10/31","n")],
    ['<a href="v1-record-detail.html" style="font-weight:600">INV-0026</a>',"ScoliVio 3D解析（中間）",f'<span class="tag">{dot("d-amber")}入金待ち</span>',("1,335,000","n"),("9/30","n")],
    ['<a href="v1-record-detail.html" style="font-weight:600">INV-0025</a>',"△△ コーポレートサイト",f'<span class="tag">{dot("d-teal")}入金</span>',("480,000","n"),("9/5","n")],
  ]) + '<div class="muted" style="font-size:12px;margin-top:10px">台帳ごとに画面は作りません。定義（項目・段階）が違うだけで、同じ画面です。</div>')

_rc_kanban = (view_bar(["カンバン","リスト"], "カンバン", {"カンバン":"k","リスト":"n"}, hint=False) +
  kanban([(s, c, [(n, w, d if d != "—" else "", a if a != "—" else "", k) for n,co,st,a,w,d,col,k in ROWS if st == s])
          for s, c in zip(STAGES, ["var(--d-teal)","var(--d-indigo)","var(--primary)","var(--d-sage)","var(--d-amber)","var(--d-plum)","var(--st-success)"])], add=False) +
  '<div style="height:14px"></div>' +
  note("列＝台帳の定義にある工程（引合→提案→受注→制作中→納品→請求→入金）。列は台帳の定義でしか増やせません。カードを次の列に落とすと「次の段階へ」と同じで、高本AIが次の仕事を配ります（外せる）。赤い縁は 7 日以上止まっているもの。", "info"))
_rc_list = view_bar(["カンバン","リスト"], "リスト", {"カンバン":"k","リスト":"n"}, hint=False) + _rc
_rc_r4 = card(head("共有された案件", pill("閲覧のみ","ne","eye"), "渡された範囲だけ。書き込まない・金額は出ない") + table(["案件","段階","次の予定","更新"], [
  ["セイコー 食品パッケージ画像編集",pill("提案","ne"),"9/18 提案書を出す",("9/15","n")],["京蟻 オンラインガチャ",pill("制作","su"),"9/30 β 公開",("9/14","n")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">見える範囲は会社の権限者が決めています。質問は担当者へ。</div>')
RECORDS = ("records", [("k","カンバン（工程）","ファネル型の台帳は列に流れる。既定はカンバン。",'<div data-roles="R1 R2">' + _rc_kanban + '</div><div data-roles="R3">' + _rc_r3 + '</div><div data-roles="R4">' + _rc_r4 + '</div>' + VIEW_JS),("n","リスト","",_rc_list + VIEW_JS),("s","止まっている","",_rc_stuck),("o","別の台帳（請求）","台帳ごとに画面を作らない。",_rc_other)], VIEWS_CSS, False, {"すべて":"6","止まっている":"!2","自分の担当":"4"})

# ============================================================ record-detail
_rd = grid([
  card(f'<a href="v1-records.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:12px">{ic("undo")}台帳に戻る</a>'
    '<div class="card-h"><h2 style="font-size:18px">セイコー 食品パッケージ画像編集SaaS</h2>' + pill("提案 · 7日","wa","clock") + '</div>' +
    _stage_bar("提案") +
    '<div style="margin-top:18px">' + kv([("顧客","株式会社セイコー · 山田 様"),("金額",'<span class="num">3,300,000</span> 円（税込）'),("着手金",'<span class="num">990,000</span>（30%・契約時）'),
      ("確度","70%"),("出どころ","紹介（マックスキッチン様）"),("担当","高本"),("提案日",'<span class="num">2026-09-03</span>')]) + '</div>' +
    '<div style="display:flex;gap:9px;margin-top:18px;flex-wrap:wrap">' + btn("次の段階へ（受注）","p","arrow") + btn("直接編集","o","pen") + btn("高本AIに頼む","g","clone","v1-clone-chat.html") + '</div>'),
  card(head("つながっているもの") +
    '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">' + "".join(
      f'<a href="{h}" style="display:flex;gap:9px;align-items:center;padding:10px 12px;background:var(--surface);border-radius:var(--r-md)">{ic(i)}<div style="flex:1"><b>{t}</b><div class="muted" style="font-size:12px">{d}</div></div>{ic("right")}</a>'
      for i,t,d,h in [("check","一次返信を取りに行く","タスク · 今日","v1-tasks.html"),("inbox","追いメール（下書き）","承認待ち · 高本AI確認済み","v1-approvals.html"),
                      ("file","提案書_セイコー_v2.pdf","添付 · 9/3","#"),("log","証跡 11件","最終：9/10 06:40 営業社員が追いメールを下書き","v1-audit.html")]) + '</div>') +
  card(head("直接編集は即反映") + '<p class="muted" style="font-size:12.5px;line-height:1.8">あなたが値を変えたら、その場で保存されます（承認は挟みません）。提案→承認になるのはAIが変えるときだけです。</p>')
], "g21")

_rd_move = grid([
  card(head("次の段階へ", pill("提案 → 受注","pr","arrow")) +
    _stage_bar("受注") +
    field("受注日", inp("2026-09-10","","date"), style="") if False else
    '<div style="margin-top:16px">' + field("受注日", inp("2026-09-10","","date")) + field("契約金額（税込）", inp("3,300,000","","text","num")) + '</div>' +
    '<div style="display:flex;gap:9px">' + btn("受注にする","p","check") + btn("やめる","g") + '</div>'),
  card(head("受注にすると、高本AIが配るもの", sub="止めたいものは外せる") + '<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">' + "".join(
    f'<label style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--surface);border-radius:var(--r-md)"><input type="checkbox" checked style="accent-color:#22345C">{ic("ai")}<div style="flex:1"><b>{t}</b><div class="muted" style="font-size:12px">{d}</div></div></label>'
    for t,d in [("経理社員 → 着手金 990,000 の請求書","確認後、承認待ちへ"),("営業社員 → キックオフ日程の候補メール","確認後、承認待ちへ"),("目標「今期の成約」に +1","実績として積む。承認は不要")]) + '</div>')
], "g2")

_rd_r4 = card('<div class="card-h"><h2 style="font-size:18px">セイコー 食品パッケージ画像編集SaaS</h2>' + pill("提案","ne") + '</div>' + _stage_bar("提案") +
  '<div style="margin-top:18px">' + kv([("段階","提案（9/3〜）"),("次の予定","一次返信の確認 · 今週")]) + '</div>' +
  '<div class="muted" style="font-size:12.5px;margin-top:14px">閲覧のみ。金額・担当・添付は表示されません。</div>')

RECORD_DETAIL = ("record-detail", [("n","中身","",'<div data-roles="R1 R2 R3">' + _rd + '</div><div data-roles="R4">' + _rd_r4 + '</div>'),("m","次の段階へ","段階が動くと高本AIが次の仕事を配る。人は外せる。",_rd_move)], "", False, {"中身":"","タスク":"2","添付":"1","証跡":"11"})

SCREENS = [RECORDS, RECORD_DETAIL]

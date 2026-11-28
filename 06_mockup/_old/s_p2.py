# -*- coding: utf-8 -*-
"""P2 毎日：today / task-detail / approvals / approval-detail"""
from _icons import ic
from _parts import *

# ============================================================ today
_t_norm = (ai("AI 経営クローンからの今日の焦点",
  "今週の受注目標に <b>1件</b> 足りません。パイプラインで最も確度が高いのは "
  "<b>株式会社セイコー・食品パッケージ画像編集SaaS</b>（提案済・7日経過）です。"
  "先方の検討期限が明後日なので、<b>今日中に一次返信</b>を取りに行くのが最短です。追いのメール下書きは作ってあります。",
  btn("下書きを承認して送る","p","check") + btn("下書きを見る","g",None,"v1-approval-detail.html")) +
 '<div style="height:18px"></div>' +
 grid([
  card(head("自分がやること", btn("追加","g","plus"), "残り 3") +
    table([("","" ), "やること", "つながる目標", ("期限","r")], [
      ['<input type="checkbox" style="width:17px;height:17px;accent-color:#22345C">',
       '<a href="v1-task-detail.html" style="font-weight:500">セイコー様へ提案の一次返信を取りに行く</a>'
       f'<div class="tag" style="margin-top:3px">{dot("d-indigo")}案件パイプライン · 提案済</div>',
       '<span class="muted" style="font-size:12.5px">Q3 受注 4件</span>',
       ('<span style="color:var(--st-danger);font-weight:600">今日</span>',"n")],
      ['<input type="checkbox" style="width:17px;height:17px;accent-color:#22345C">',
       '<a href="v1-task-detail.html" style="font-weight:500">京蟻オンラインガチャ 契約書案を送る</a>'
       f'<div class="tag" style="margin-top:3px">{dot("d-indigo")}案件パイプライン · 内定</div>',
       '<span class="muted" style="font-size:12.5px">Q3 受注 4件</span>', ("明日","n")],
      ['<input type="checkbox" style="width:17px;height:17px;accent-color:#22345C">',
       '<a href="v1-task-detail.html" style="font-weight:500">ScoliVio 会津データ受領の段取り確認</a>'
       f'<div class="tag" style="margin-top:3px">{dot("d-sage")}制作 · 進行中</div>',
       '<span class="muted" style="font-size:12.5px">—　<span style="font-size:11px;border:1px solid var(--line);'
       'padding:1px 6px;border-radius:var(--r-full)">自主</span></span>', ("9/10","n")],
      [ic("check"), '<span style="text-decoration:line-through;opacity:.55">週次の売上を台帳から締める</span>',
       '<span class="muted" style="font-size:12.5px;opacity:.55">Q3 売上 1,200万</span>', ("完了","n")],
    ])) +
  card(f'<div class="card-h">{ic("ai")}<h2>AI 社員がやっていること</h2><div class="sp"></div>'
    '<span class="muted" style="font-size:12px">3体が稼働中</span></div>'
    '<div style="display:flex;flex-direction:column;gap:11px">' + "".join(
      f'<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--surface);border-radius:var(--r-md)">'
      f'{p}<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">{t}</div>'
      f'<div class="muted" style="font-size:12.5px;margin-top:3px">{d}</div>{extra}</div>{right}</div>'
      for p, t, d, extra, right in [
        (pill("実行中","pr","play"), "AI 営業社員 — 発注ナビの新着案件を台帳に入れる",
         "12件中 8件を確認済み · 覚えた操作で実行（LLM 呼び出しなし）",
         '<div class="bar" style="margin-top:8px"><i style="width:67%"></i></div>', ""),
        (pill("承認待ち","wa","clock"), "AI 経理社員 — 株式会社◯◯ 様への請求書を作った",
         "金額 1,320,000円 · 送信の直前で止まっています", "",
         btn("承認へ","o",None,"v1-approval-detail.html")),
        (pill("完了","su","check"), "AI CS 社員 — 問い合わせ4件に一次返信した",
         "7:02 完了 · 全件があなたの承認済みテンプレの範囲内", "", ""),
      ]) + '</div>'),
  card(metric("今週の受注", '3<span style="font-size:19px;font-weight:500;color:var(--on-sv)"> 件</span>',
              "目標 4件 に対して 75%", 75, "warn")) +
  card(metric("今期の売上", "8,330,000", "目標 12,000,000 に対して 69.4%", 69.4) +
    f'<div style="display:flex;gap:6px;align-items:center;margin-top:13px;font-size:12.5px;'
    f'color:var(--st-success);font-weight:600">{ic("up")}先週比 +12.4%</div>') +
  card(head("今日の予定") + '<div style="display:flex;flex-direction:column;gap:10px;font-size:13px">' + "".join(
    f'<div style="display:flex;gap:10px"><span class="num muted" style="min-width:42px">{t}</span><span>{x}</span></div>'
    for t, x in [("11:00","SOICO 様 Zoom 商談"),("15:00","ScoliVio 定例"),
                 ("18:00",'<span class="muted">（AI）日次の締めと明日の再計画</span>')]) + '</div>'),
 ], "g21"))

_t_empty = (card(empty("today", "今日やることはまだありません",
  "目標を作ると、そこから逆算されたタスクがここに並びます。まだ目標が無い場合は先に目標を作ってください。",
  btn("目標を作る","p","target","v1-goals.html") + btn("自分でタスクを足す","o","plus"))) +
 card(ai("AI 経営クローン",
   "目標がまだ無いので、何を優先すべきか判断できません。"
   "「今期いくら売りたいか」だけ決めてもらえれば、四半期・月・今週まで私が割ります。",
   btn("会話で決める","p","chat","v1-chat.html"))))

_t_run = (card(
  '<div class="card-h"><span class="pill p-pr"><span class="spin"></span>実行中</span>'
  '<h2>AI 営業社員 — 発注ナビの新着案件を台帳に入れています</h2><div class="sp"></div>' +
  btn("止める","o","pause") + '</div>'
  '<div class="bar" style="margin-bottom:16px"><i style="width:67%"></i></div>'
  '<div class="muted" style="font-size:12.5px;margin-bottom:14px">12件中 8件を確認済み · 経過 1分42秒 · '
  '<b>覚えた操作で再生中のため LLM の呼び出しはありません</b></div>' +
  code("""[07:41:02] 覚えた操作「発注ナビ 新着案件の取り込み」を再生
[07:41:03] 手順 1/6  developer.hnavi.co.jp にログイン        OK
[07:41:06] 手順 2/6  新着案件の一覧を開く                      OK
[07:41:09] 手順 3/6  条件（Web/アプリ・100万円以上）で絞る     OK  12件
[07:41:12] 手順 4/6  1件ずつ詳細を開いて要件を読む            8/12
[07:41:12]           → 台帳「案件パイプライン」に 5件を追加
[07:41:12]           → 3件は条件に合わないため見送り（理由を記録）
                     関門 C1（ネットワーク）· C2（永続化）を通過""") +
  '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
  btn("手順を見る","g","route","v1-procedure-detail.html") + btn("証跡を見る","g","log","v1-run-detail.html") + '</div>',
  style="border-color:var(--st-progress)") +
 card(head("先に進められること") +
   '<p class="muted" style="font-size:13px">AI の実行が終わるのを待つ必要はありません。あなたのタスクはそのまま進められます。</p>'
   '<div style="margin-top:14px;display:flex;flex-direction:column;gap:9px">' + "".join(
     f'<label style="display:flex;gap:11px;align-items:center;padding:11px;background:var(--surface);border-radius:var(--r-md)">'
     f'<input type="checkbox" style="width:17px;height:17px;accent-color:#22345C"><span style="font-weight:500">{t}</span>'
     f'<span style="flex:1"></span><span class="num" style="{c}font-size:12.5px">{d}</span></label>'
     for t, d, c in [("セイコー様へ提案の一次返信を取りに行く","今日","color:var(--st-danger);font-weight:600;"),
                     ("京蟻オンラインガチャ 契約書案を送る","明日","")]) + '</div>'))

TODAY = ("today", [("n","通常","",_t_norm),("e","空（目標が無い）","目標が1つも無い状態。ここで「何をすればいいか分からない」を作らない。",_t_empty),
                   ("r","AI が実行中","AI社員が動いている最中。人は待たずに自分の作業を続けられる。",_t_run)], "", False)

# ============================================================ task-detail
_td = grid([
  card(f'<a href="v1-today.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:12px">{ic("undo")}今日に戻る</a>'
    '<div class="card-h"><h2>セイコー様へ提案の一次返信を取りに行く</h2>' + pill("今日が期限","da","clock") + '</div>' +
    rail("提案から7日経過。先方の検討期限が明後日。<br>"
         "電話が最速だが、前回のやり取りでは山田様がメールを好まれていた。<br>"
         "AI が作った追いの文面が承認箱にあるので、それを送るのが最短。") +
    '<div style="margin-top:18px">' +
    table(["やること", "状態"], [
      ["<b>1.</b> 承認箱の追い文面を確認して送る", pill("承認待ち","wa","clock")],
      ["<b>2.</b> 返信が来たら商談日を押さえる", pill("未着手")],
      ["<b>3.</b> 来なければ 9/10 に電話する", pill("未着手")],
    ]) + '</div>'),
  card(head("つながる目標") +
    '<a href="v1-goals.html" style="display:block;padding:13px;background:var(--surface);border-radius:var(--r-md);margin-bottom:12px">'
    '<div style="font-size:12px;color:var(--on-sv)">Q3 受注</div>'
    '<div class="metric-sm" style="margin:4px 0">3 / 4 件</div>'
    '<div class="bar"><i class="warn" style="width:75%"></i></div>'
    '<div class="muted" style="font-size:12px;margin-top:7px">この案件が決まれば達成</div></a>' +
    head("関連する台帳の行") +
    f'<a href="v1-record-detail.html" style="display:flex;gap:9px;align-items:center;padding:11px;'
    f'background:var(--surface);border-radius:var(--r-md);margin-bottom:12px">{dot("d-indigo")}'
    '<div style="flex:1"><div style="font-size:13px;font-weight:600">セイコー 食品パッケージ画像編集SaaS</div>'
    '<div class="muted num" style="font-size:11.5px">3,300,000 · 提案済 · 確度70%</div></div>' + ic("right") + '</a>' +
    head("実行の記録") +
    kv([("作られた経緯", "AI が目標から逆算"), ("作成", '<span class="num">2026-09-01</span>'),
        ("担当", "高本 雅人"), ("関連する実行", '<a href="v1-run-detail.html" style="color:var(--primary);font-weight:600">3件</a>')])),
], "g21")

TASK_DETAIL = ("task-detail", [("d","タスクの詳細","",_td)], "", False)

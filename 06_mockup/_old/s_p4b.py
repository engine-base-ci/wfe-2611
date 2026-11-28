# -*- coding: utf-8 -*-
"""P4 毎月：retro / duties / duty-detail"""
from _icons import ic
from _parts import *

# ============================================================ retro
_r_norm = (card(ai("AI 経営クローンの自己評価 — 2026年8月",
  "8月の売上目標 4,000,000 に対して実績 2,180,000（54.5%）で<b>未達</b>でした。<br>"
  "私が担当した「新規案件の取り込み」は目標30件に対し34件で達成しています。"
  "<b>取れなかったのは私の側ではなく、提案から受注までの区間</b>です。"
  "提案は12件出ていますが、うち7件が10日以上返信を待つ状態になっていました。"), style="padding:0;border:0") +
 grid([card(metric("8月 売上",'<span style="color:var(--st-danger)">2,180,000</span>',"目標 4,000,000 · 54.5%",54.5,"bad")),
       card(metric("新規案件の取り込み",'<span style="color:var(--st-success)">34 件</span>',"目標 30件 · 113.3%",100,"ok")),
       card(metric("提案 → 受注",'<span style="color:var(--st-warning)">16.7%</span>',"12件中 2件 · 前月 34.0%",16.7,"warn"))], "g3") +
 '<div style="height:16px"></div>' +
 card(head("仮説 → 施策 → 検証", "", "目標とタスクの間の層。ここが無いと目標がただの数字になる") +
   '<div style="display:flex;flex-direction:column;gap:0">'
   '<div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--line-soft)">' +
   pill("仮説","pr") + '<div style="flex:1">'
   '<div style="font-weight:600;margin-bottom:5px">提案後の追いが人手依存なので、忙しい週に止まっている</div>'
   '<div class="muted" style="font-size:13px;line-height:1.8">'
   '根拠：提案から返信までの日数の中央値が、受注できた案件は 3日、失注は 11日。'
   '高本さんが商談で埋まっていた週（8/11・8/25）に提案した5件は、いずれも追いが7日以上空いています。</div></div>' +
   ai_pill("AI が立てた") + '</div>'
   '<div style="display:flex;gap:14px;padding:16px 0 16px 30px;border-bottom:1px solid var(--line-soft)">' +
   pill("施策") + '<div style="flex:1">'
   '<div style="font-weight:600;margin-bottom:5px">提案から3日経ったら AI 営業社員が追いの文面を作り、承認箱に入れる</div>'
   '<div class="muted" style="font-size:13px;line-height:1.8">'
   '期待する効果：追いが人の空き時間に依存しなくなる。提案→受注率を 16.7% → 30% に戻す。</div>'
   '<div style="display:flex;gap:9px;margin-top:11px;flex-wrap:wrap">' +
   btn("採用して担当業務に足す","p","check","v1-duty-detail.html") + btn("別の施策を出させる") + btn("却下") + '</div></div></div>'
   '<div style="display:flex;gap:14px;padding:16px 0 16px 60px">' +
   pill("検証") + '<div style="flex:1">'
   '<div style="font-weight:600;margin-bottom:5px">9月末に「提案→受注率」を測る</div>'
   '<div class="muted" style="font-size:13px;line-height:1.8">'
   '30% 以上なら仮説は正しい。届かなければ、原因は追いの速さではなく<b>提案の中身</b>にあると考え直します。</div></div></div></div>') +
 card(head("先月までの検証結果") +
   table(["仮説","施策",("検証","r"),"判定"], [
     ["発注ナビの巡回が週1では新着を取り逃す","AI が毎朝7時に巡回する",("取り込み 18→34件","n"),pill("効いた","su","check")],
     ["見積の作成に時間がかかり提案が遅れている","過去見積からテンプレを作る",("作成 4.2h→1.1h","n"),pill("効いた","su","check")],
     ["単価を上げれば件数が減っても売上は維持できる","最低単価を100万に設定",("件数 −38% / 売上 −22%","n"),pill("効かなかった","da","x")],
   ]) +
   '<p class="muted" style="font-size:12.5px;margin-top:14px">'
   '効かなかった仮説も消しません。<b>「これは試して駄目だった」を残すことが、次に同じ手を打たないための資産</b>になります。</p>'))

_r_rev = card(
  '<div class="card-h">' + ai_pill("AI からの提案") + '<h2>目標そのものを変えることを提案します</h2></div>'
  '<div style="font-size:14.5px;line-height:1.9;margin-bottom:18px">'
  'Q3 の売上目標 12,000,000 は、残り22日・パイプラインの内容から見て<b>達成できません</b>。'
  '見込みは 10,000,000（83.3%）です。<br><br>'
  'ここで「頑張る」と書いても数字は動きません。取れる選択肢は次の3つです。</div>'
  '<div style="display:flex;flex-direction:column;gap:11px">' + "".join(
    f'<div style="display:flex;gap:13px;align-items:flex-start;padding:15px;background:var(--surface);border-radius:var(--r-md)">'
    f'<span class="pill p-pr" style="min-width:26px;justify-content:center">{k}</span>'
    f'<div style="flex:1"><div style="font-weight:600;margin-bottom:4px">{t}</div>'
    f'<div class="muted" style="font-size:13px">{d}</div></div>{b}</div>'
    for k, t, d, b in [
      ("A","目標を 10,000,000 に下げる",
       "現実に合わせる。ただし年間 48,000,000 の達成には Q4 で 19,590,000 が必要になり、Q4 が過去最高の1.6倍になります。", btn("この案にする")),
      ("B","既存顧客の追加開発を前倒しして 12,000,000 を守る",
       "ScoliVio 1,500,000 ＋ REMARE 600,000 を今期に寄せる。先方の予算期を確認する必要があります。", btn("この案にする","p","check")),
      ("C","年間目標のほうを 44,000,000 に見直す",
       "Q1・Q2 の実績（20,080,000）から見て、48,000,000 は当初から強気でした。", btn("この案にする")),
    ]) + '</div>'
  '<p class="muted" style="font-size:12.5px;margin-top:16px">'
  'どれを選んでも<b>改訂履歴に理由つきで残ります</b>。「いつ・なぜ目標を変えたか」が後から追えます。</p>',
  style="border-color:var(--tertiary)")

_r_none = (card(empty("review","まだふりかえる期間がありません",
  "1か月ぶんの実績がたまると、AI が目標に照らして自己評価し、仮説・施策・検証を提案します。",
  '<div class="muted" style="font-size:12.5px">最初のふりかえりは <b class="num">2026-10-01</b> に自動で作られます</div>')) +
 card(head("ふりかえりで出てくるもの") + grid([
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">達成／未達の切り分け</div>'
   '<div class="muted" style="font-size:12.5px">どこまでは動いていて、どの区間で止まったか</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">仮説と施策</div>'
   '<div class="muted" style="font-size:12.5px">なぜ届かなかったか、次に何を変えるか</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">定義の改訂案</div>'
   '<div class="muted" style="font-size:12.5px">担当業務・台帳・目標そのものを直す提案</div></div>'], "g3")))

RETRO = ("retro", [("n","通常（8月分）","",_r_norm),
  ("r","目標の改訂提案","AI が「その目標は達成できないので変えろ」と言ってくる画面。競合に無いのはここ。",_r_rev),
  ("e","まだ無い","",_r_none)], "", False)

# ============================================================ duties
_du = ('<p class="muted" style="font-size:13px;margin-bottom:18px">'
 '担当業務は AI 社員が持つ<b>仕事の定義</b>です。改訂履歴が残るので、<b>いつ・なぜ仕事のやり方を変えたか</b>が追えます。'
 'これが Kaname で一番貯まる資産です。</p>' +
 card(table(["担当業務","持ち主","スコープ",("改訂","r"),"習得",("直近30日","r")], [
   ['<a href="v1-duty-detail.html"><b>発注ナビの新着案件を取り込む</b></a>'
    '<div class="muted" style="font-size:12px">条件に合うものだけ台帳に入れ、外れたものは理由を残す</div>',
    ai_pill("AI 営業社員"),'<span class="muted" style="font-size:12.5px">会社</span>',("v7","n"),
    pill("習得済","su","check"),("30回 / 失敗 0","n")],
   ['<a href="v1-duty-detail.html"><b>提案から3日で追いの文面を作る</b></a>'
    '<div class="muted" style="font-size:12px">催促に見えない書き方。承認箱に入れる</div>',
    ai_pill("AI 営業社員"),'<span class="muted" style="font-size:12.5px">会社</span>',("v2","n"),
    pill("学習中","wa","clock"),("4回 / 失敗 1","n")],
   ['<a href="v1-duty-detail.html"><b>月次の請求書を作って送る</b></a>'
    '<div class="muted" style="font-size:12px">契約書の月額と照合し、一致しない場合は止める</div>',
    ai_pill("AI 経理社員"),'<span class="muted" style="font-size:12.5px">会社</span>',("v11","n"),
    pill("習得済","su","check"),("6回 / 失敗 0","n")],
   ['<a href="v1-duty-detail.html"><b>問い合わせに一次返信する</b></a>'
    '<div class="muted" style="font-size:12px">承認済みテンプレの範囲内なら自動、外れたら承認箱へ</div>',
    ai_pill("AI CS 社員"),'<span class="muted" style="font-size:12.5px">会社</span>',("v4","n"),
    pill("習得済","su","check"),("112回 / 失敗 2","n")],
   ['<b style="opacity:.6">週次レポートを作る</b>'
    '<div class="muted" style="font-size:12px">運営から配られた標準テンプレ（中身は非公開）</div>',
    ai_pill("AI 経営クローン"),f'<span class="muted" style="font-size:12.5px">運営 {ic("lock")}</span>',("—","n"),
    pill("習得済","su","check"),("4回 / 失敗 0","n")],
 ])))

DUTIES = ("duties", [("l","一覧","",_du)], "", False)

# ============================================================ duty-detail
_dd = (f'<a href="v1-duties.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 grid([
  card(head("発注ナビの新着案件を取り込む", '<span class="muted num" style="font-size:12.5px">v7 · 2026-09-02 改訂</span>') +
    '<div style="margin-bottom:14px">' + pill("習得済","su","check") + '</div>' +
    rail("毎朝7時に developer.hnavi.co.jp を開き、新着案件のうち<br>"
         "・Web / アプリ開発であること<br>・想定金額が 1,000,000 以上であること<br>"
         "を満たすものを台帳「案件パイプライン」に段階「問い合わせ」で追加する。<br>"
         "条件を外れたものは追加せず、<b>外した理由を1行で記録する</b>。<br>"
         "判断に迷ったものは追加せず、承認箱に「判断してほしい」として入れる。") +
    '<div class="card-h" style="margin-top:20px"><h2 style="font-size:13.5px">やってはいけないこと</h2></div>'
    '<ul style="font-size:13.5px;line-height:1.9;padding-left:20px;color:var(--on-sv)">'
    '<li>案件に<b>応募する</b>（応募は必ず人が判断する）</li>'
    '<li>CAPTCHA を突破しようとする（アカウント凍結のリスク）</li>'
    '<li>同じ案件を二重に登録する</li></ul>' +
    '<div style="display:flex;gap:9px;margin-top:18px;flex-wrap:wrap">' +
    btn("テストで動かす","o","play","v1-duty-test.html") + '</div>') +
  card(head("改訂履歴", "", "7回") +
    table([("版","" ),"変えたこと","理由",("誰が","r"),("日付","r")], [
      [("v7","num"),"金額の下限を 50万→100万","50万台の案件は受注しても採算が合わなかった",("高本","r"),("09-02","n")],
      [("v6","num"),"外した理由の記録を必須に","なぜ落としたかが後で分からなかった",(ai_pill("AI"),"r"),("08-19","n")],
      [("v5","num"),"「応募しない」を明記","1度だけ応募まで進んでしまった（8/12 の事故）",("高本","r"),("08-12","n")],
      [("v4","num"),"実行を毎朝7時に固定","不定期だと新着を取り逃す",(ai_pill("AI"),"r"),("07-30","n")],
    ])),
  card(head("実績") +
    kv([("実行回数",'<span class="num">218回</span>'),("失敗",'<span class="num">3回（1.4%）</span>'),
        ("平均所要",'<span class="num">1分52秒</span>'),("LLM 呼び出し",'<span class="num">0回 / 直近30日</span>')]) +
    '<p class="muted" style="font-size:12px;margin-top:12px">'
    '覚えた操作として再生しているため、LLM を呼びません。画面が変わったときだけ AI が出てきます。</p>') +
  card(head("使う関門") +
    '<div style="display:flex;flex-direction:column;gap:9px;font-size:13px">' + "".join(
      f'<div style="display:flex;gap:9px">{pill(c,"pr")}<span>{d}</span></div>'
      for c, d in [("C1","ネットワーク（ブラウザ操作）"),("C2","永続化（台帳への書き込み）"),
                   ("C8","秘密（ログイン情報の参照）")]) + '</div>') +
  card(head("覚えた操作") +
    f'<a href="v1-procedure-detail.html" style="display:flex;gap:9px;align-items:center;padding:11px;'
    f'background:var(--surface);border-radius:var(--r-md)">{ic("route")}'
    '<div style="flex:1"><div style="font-size:13px;font-weight:600">発注ナビ 新着案件の取り込み</div>'
    '<div class="muted" style="font-size:11.5px">6手順 · 最終確認 今日 07:41</div></div>' + ic("right") + '</a>'),
 ], "g21"))

DUTY_DETAIL = ("duty-detail", [
  ("d","詳細と改訂履歴","改訂履歴＝「いつ・なぜ仕事のやり方を変えたか」。ここが堀の実体。",_dd)], "", False)

# -*- coding: utf-8 -*-
"""P1 立ち上げ（続き2）：duty-test / ledger-def"""
from _icons import ic
from _parts import *

# ============================================================ duty-test
_dt_run = card(
  '<div class="card-h">' + pill("テストモード","pr","play") +
  '<h2>提案から3日で追いの文面を作る</h2><div class="sp"></div>'
  '<span class="muted" style="font-size:12.5px">外に一切出しません</span></div>' +
  '<p class="muted" style="font-size:13px;margin-bottom:16px">'
  '実際の台帳データを読んで動かしますが、<b>メール送信・書き込み・課金はすべて止めます</b>。'
  '「この定義で本当に望む結果になるか」を、事故を起こさずに確かめるための状態です。</p>' +
  code("""[テスト] 担当業務「提案から3日で追いの文面を作る」v2 を実行
[テスト] 関門 C2（永続化・読み取り）… 台帳「案件パイプライン」を読む
[テスト]   段階=提案済 かつ 最終更新>3日 → 3件
[テスト] 1件目：セイコー 食品パッケージ画像編集SaaS（7日経過）
[テスト]   関門 C3（モデル呼び出し）… 文面を生成          <b style="color:#7DD3A0">実行</b>
[テスト]   関門 C1（ネットワーク）… メール送信            <b style="color:#F0A868">止めました</b>
[テスト]   関門 C2（永続化）… 「追い済」を書き込み          <b style="color:#F0A868">止めました</b>
[テスト]   関門 C6（通知）… 承認箱への通知                <b style="color:#F0A868">止めました</b>
[テスト] 生成された文面 ↓""") +
  '<div style="margin-top:16px">' + rail(
    "セイコー 山田様<br>お世話になっております。ENGINE BASE の高本です。<br>"
    "先日ご提案しました画像編集SaaSの件、社内でのご検討状況はいかがでしょうか。<br>"
    "仕様のご相談だけでも承りますので、お気軽にお申し付けください。") + '</div>' +
  '<div style="display:flex;gap:9px;margin-top:18px;flex-wrap:wrap">' +
  btn("文面が硬いと伝える","g","chat") + btn("残り2件も見る") + '</div>',
  style="border-color:var(--st-progress)")

_dt_result = (card(
  '<div class="card-h">' + pill("テスト完了","su","check") + '<h2>3件すべて生成できました</h2>'
  '<div class="sp"></div><span class="muted num" style="font-size:12.5px">所要 8.4秒 · トークン 4,210</span></div>' +
  table(["案件", "経過", "生成", "止めた操作", ""], [
    ["セイコー 食品パッケージ画像編集SaaS", ("7日","n"), pill("できた","su","check"),
     "<span class='muted' style='font-size:12px'>送信 · 書き込み · 通知</span>", (btn("文面を見る"),"r")],
    ["ScoliVio 3D 追加開発", ("4日","n"), pill("できた","su","check"),
     "<span class='muted' style='font-size:12px'>送信 · 書き込み · 通知</span>", (btn("文面を見る"),"r")],
    ["REMARE Cloudflare 移行", ("5日","n"), pill("できた","su","check"),
     "<span class='muted' style='font-size:12px'>送信 · 書き込み · 通知</span>", (btn("文面を見る"),"r")],
  ])) +
 card(head("本番に切り替えると、次からこうなります") +
   '<div style="display:flex;flex-direction:column;gap:11px;font-size:13.5px">' + "".join(
     f'<div style="display:flex;gap:11px"><span class="pill p-{k}" style="min-width:66px;justify-content:center">{lab}</span>'
     f'<span>{t}</span></div>' for k, lab, t in [
       ("su","そのまま","台帳の読み取り・文面の生成は、いまと同じように動きます"),
       ("wa","承認へ","<b>メールは送られず、承認箱に入ります</b>（ポリシーが「承認」のため）"),
       ("wa","承認へ","台帳への「追い済」の書き込みも、承認後に行われます"),
       ("ne","変わらず","応募・CAPTCHA突破・二重登録は、本番でも禁止のままです"),
     ]) + '</div>' +
   note("いまのポリシーでは<b>メールは必ず承認箱を通ります</b>。承認なしで送るようにしたい場合は、"
        "<a href='v1-policies.html' style='color:var(--primary);font-weight:600'>ポリシー</a>で条件を決めてください。", "info")))

_dt_fail = card(
  '<div class="card-h">' + pill("テスト失敗","da","warn") + '<h2>1件目で止まりました</h2></div>' +
  '<p style="font-size:14px;line-height:1.85;margin-bottom:16px">'
  '担当業務に「金額が入っていない案件は対象外」と書かれていないため、<b>想定金額が空の案件で文面が作れませんでした</b>。'
  'テストモードなので実害はありません。定義を直してもう一度試してください。</p>' +
  code("""[テスト] 2件目：介護施設の予約管理システム
[テスト]   関門 C3（モデル呼び出し）… 文面を生成
[テスト]   <b style="color:#F87171">失敗</b>：想定金額が空のため「ご提案した金額」を書けません
[テスト]   中断しました。定義に条件が不足しています。""") +
  ai("直し方の提案",
     "担当業務の定義に、次の1行を足すのがよさそうです。<br><br>"
     "<b>「想定金額が入っていない案件は対象外とし、代わりに『金額を確認する』タスクを作る」</b><br><br>"
     "この1行を足すと、今回のような案件は文面を作らず、あなたのタスクとして「今日」に出ます。",
     btn("この1行を足して再テスト","p","check") + btn("自分で書き直す","g",None,"v1-duty-detail.html")),
  style="border-color:var(--st-danger)")

DUTY_TEST = ("duty-test", [
  ("r","実行中","本番のデータを読みつつ、外に出る操作だけ関門で封じる。事故を起こさずに定義を確かめる。",_dt_run),
  ("d","結果","",_dt_result),
  ("f","失敗","失敗しても実害が無いことが、テストモードの価値。直し方まで出す。",_dt_fail),
], "", False)

# ============================================================ ledger-def
_ld_f = (note("ここで作った定義を、台帳の画面がそのまま読んで描きます。<b>業種ごとに画面を作らないための仕組み</b>です。", "info") +
 card(head("基本") +
   field("台帳の名前", inp("案件パイプライン", "", "text", "", "max-width:420px")) +
   field("型", '<div style="display:flex;gap:10px;flex-wrap:wrap">' + "".join(
     f'<label style="display:flex;gap:9px;align-items:center;padding:11px 15px;border:1.5px solid '
     f'{"var(--primary)" if i==0 else "var(--line)"};{"background:var(--primary-c);" if i==0 else ""}'
     f'border-radius:var(--r-md);font-size:13.5px"><input type="radio" name="k" {"checked" if i==0 else ""} '
     f'style="accent-color:#22345C"><b>{x}</b></label>' for i, x in enumerate(["ファネル型", "取引型"])) + '</div>') +
   field("色", '<div style="display:flex;gap:9px">' + "".join(
     f'<button style="width:30px;height:30px;border-radius:var(--r-md);background:var(--{c});'
     f'{"outline:2px solid var(--on-surface);outline-offset:2px" if c=="d-indigo" else ""}"></button>'
     for c in ["d-indigo","d-teal","d-amber","d-coral","d-sage","d-plum"]) + '</div>',
     "色は区別のためだけに使います。意味は持ちません。画面には必ず名前と一緒に出ます")) +
 card(head("項目", btn("項目を足す","o","plus")) +
   table([("","" ), "表示名", "種類", "必須", "絞り込み", "集計に使う", ""], [
     [ic("more"), f"<b>{n}</b>", f"<span class='muted'>{t}</span>",
      pill("必須") if req else "<span class='muted'>—</span>",
      pill("","su","check") if f else "<span class='muted'>—</span>", fx, (btn("編集"),"r")]
     for n, t, req, f, fx in [
       ("案件名","短いテキスト",True,True,"<span class='muted'>—</span>"),
       ("会社名","短いテキスト",True,True,"<span class='muted'>—</span>"),
       ("想定金額","金額",True,True,pill("目標「売上」","pr")),
       ("確度","割合",False,True,"<span class='muted'>—</span>"),
       ("担当","メンバー",True,True,pill("担当別集計","pr")),
       ("発生日","日付",True,True,pill("期間集計","pr")),
       ("流入元","選択肢",False,True,"<span class='muted'>—</span>"),
       ("失注理由","長いテキスト",False,False,"<span class='muted'>—</span>"),
     ]]) +
   note("<b>「絞り込み」を入れた項目には索引を自動で作ります。</b>あとから入れても、既存のデータを止めずに追加します。"
        "<b>「集計に使う」に指定した項目だけが目標に積み上がります</b>（それ以外は自由項目として保存されます）。", "info")))

_ld_s = (card(head("段階", btn("段階を足す","o","plus")) +
  '<p class="muted" style="font-size:13px;margin-bottom:16px">上から順に進みます。並べ替えると、既にある行の段階はそのまま保たれます。</p>'
  '<div style="display:flex;flex-direction:column;gap:9px">' + "".join(
    f'<div style="display:flex;gap:12px;align-items:center;padding:13px;background:var(--surface);border-radius:var(--r-md)">'
    f'{ic("more")}<span class="num" style="width:22px;height:22px;border-radius:var(--r-full);background:var(--card);'
    f'display:grid;place-items:center;font-size:11px;font-weight:700">{i}</span>'
    f'<b style="flex:1;font-size:13.5px">{n}</b><span class="muted num" style="font-size:12.5px">{c}件</span>'
    f'<span class="tag" style="font-size:11.5px">{r}</span>{btn("編集")}</div>'
    for i, n, c, r in [(1,"問い合わせ",8,"確度 20% 既定"),(2,"ヒアリング",6,"確度 50% 既定"),
                       (3,"提案済",5,"金額が必須になる"),(4,"内定",3,"確度 90% 既定"),
                       (5,"受注",12,"請求台帳に自動で1行作る"),(6,"失注",0,"失注理由が必須になる")]) + '</div>') +
 card(head("段階のルール") +
   table(["段階", "入るときの条件", ("期限","r"), "越えたら"], [
     ["提案済", "想定金額が入っていること", ("10日","n"), ai_pill("AI が追いを提案")],
     ["内定", "—", ("14日","n"), pill("通知","wa")],
     ["失注", "失注理由が入っていること", ("—","n"), "<span class='muted'>—</span>"]]) +
   '<p class="muted" style="font-size:12.5px;margin-top:14px">'
   '値の範囲・必須・遷移の条件は<b>データベース側でも同じ検査をします</b>。画面だけの検査にはしません。</p>'))

_ld_p = (note("いま編集している定義で、実際の台帳画面がどう描かれるかです。保存する前にここで確かめられます。", "info") +
 card(table(["案件名", "会社名", "段階", "担当", ("想定金額","r"), ("確度","r")], [
   ["<b>セイコー 食品パッケージ画像編集SaaS</b>", "株式会社セイコー", pill("提案済","wa"), "高本", ("3,300,000","n"), ("70%","n")],
   ["<b>SOICO QRテーブル注文</b>", "SOICO株式会社", pill("ヒアリング","pr"), "高本", ("2,400,000","n"), ("50%","n")],
 ])) +
 card('<div class="card-h">' + ic("warn") + '<h2>保存すると何が変わるか</h2></div>'
   '<div style="display:flex;flex-direction:column;gap:11px;font-size:13.5px">' + "".join(
     f'<div style="display:flex;gap:10px">{pill(lab, k)}<span>{t}</span></div>' for k, lab, t in [
       ("su","安全","項目「失注理由」を追加 — 既存34行は空のまま。データは失われません"),
       ("su","安全","段階「失注」を追加 — 既存の段階は変わりません"),
       ("wa","注意","項目「確度」を絞り込み対象に — 索引を作ります（34行なので数秒。行が多い場合は裏で作ります）"),
     ]) + '</div>'))

LEDGER_DEF = ("ledger-def", [("f","項目","",_ld_f),("s","段階","",_ld_s),("p","保存前の確認","",_ld_p)], "", False)

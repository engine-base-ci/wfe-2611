# -*- coding: utf-8 -*-
"""P5 例外（続き）：runs / run-detail / policies"""
from _icons import ic
from _parts import *

# ============================================================ runs
_ru = ('<div style="display:flex;gap:9px;align-items:center;margin-bottom:18px;flex-wrap:wrap">'
 '<button class="btn btn-p btn-sm">すべて</button><button class="btn btn-g btn-sm">失敗のみ</button>'
 '<button class="btn btn-g btn-sm">承認を通ったもの</button>'
 '<input class="inp" placeholder="関門・AI社員で絞る" style="max-width:210px;padding:7px 12px;font-size:13px">'
 '<div style="flex:1"></div><span class="muted num" style="font-size:12.5px">今日 47件</span></div>' +
 card(table([("時刻","r"),"実行したこと","誰が","関門","結果",("所要","r"),("トークン","r")], [
   [("07:41:12","n muted"),'<a href="v1-run-detail.html">発注ナビの新着案件を取り込む</a>'
    '<div class="muted" style="font-size:12px">5件追加 / 7件見送り</div>',
    ai_pill("営業"),'<span class="muted num">C1 · C2 · C8</span>', pill("成功","su","check"),("1:52","n"),("0","n muted")],
   [("07:02:38","n muted"),'<a href="v1-run-detail.html">問い合わせ4件に一次返信</a>'
    '<div class="muted" style="font-size:12px">全件テンプレの範囲内</div>',
    ai_pill("CS"),'<span class="muted num">C1 · C3</span>', pill("成功","su","check"),("0:44","n"),("3,180","n muted")],
   [("09:12:16","n muted"),'<a href="v1-run-detail.html">◯◯銀行の入金明細を確認</a>'
    '<div class="muted" style="font-size:12px">手順4で画面が変わっていた</div>',
    ai_pill("経理"),'<span class="muted num">C1 · C8</span>', pill("中断","da","warn"),("0:12","n"),("0","n muted")],
   [("昨日 18:00","n muted"),'<a href="v1-run-detail.html">週次レポートを Slack に投稿</a>',
    ai_pill("クローン"),'<span class="muted num">C6 · C3</span>', pill("成功","su","check"),("0:21","n"),("8,420","n muted")],
   [("昨日 17:41","n muted"),'<a href="v1-run-detail.html">freee に売上仕訳を登録</a>'
    '<div class="muted" style="font-size:12px">高本が承認</div>',
    ai_pill("経理"),'<span class="muted num">C1 · C2</span>', pill("成功","su","check"),("1:04","n"),("0","n muted")],
 ])))

RUNS = ("runs", [("l","一覧","",_ru)], "", False)

# ============================================================ run-detail
_rd = (f'<a href="v1-runs.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 grid([
  card('<div class="card-h">' + pill("成功","su","check") +
    '<h2>発注ナビの新着案件を取り込む</h2><div class="sp"></div>'
    '<span class="muted num" style="font-size:12.5px">2026-09-08 07:39:20 〜 07:41:12</span></div>' +
    code("""07:39:20  関門 C8（秘密）    資格情報「発注ナビ」を参照 → 参照ID のみ AI に渡した
07:39:21  関門 C1（ネットワーク）  サービス台帳を確認 → 自動操作：許可
07:39:22  覚えた操作「発注ナビ 新着案件の取り込み」v3 を再生（LLM 呼び出しなし）
07:39:24  手順 1/6  ログイン                             OK
07:39:29  手順 2/6  新着案件の一覧を開く                   OK
07:39:33  手順 3/6  条件で絞る（Web/アプリ・100万円以上）    OK  12件
07:40:58  手順 4/6  1件ずつ詳細を開いて要件を読む          12件
07:41:05  手順 5/6  関門 C2（永続化）  台帳に 5行を追加
07:41:12  手順 6/6  見送り 7件の理由を記録
07:41:12  完了。監査証跡に記録しました。""")) +
  card(head("この実行で書き込まれたもの") +
    table(["対象","操作",("件数","r"),""], [
      [f'<span class="tag">{dot("d-indigo")}案件パイプライン</span>',"追加",("5","n"),
       (btn("見る","g",None,"v1-ledger.html"),"r")],
      ["見送りの理由","追加",("7","n"),(btn("見る"),"r")]]) +
    '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap;align-items:center">' +
    btn("この実行を取り消す","o","undo") +
    '<span class="muted" style="font-size:12px">台帳への書き込みのみ取り消せます。外に出たもの（送信済メール等）は取り消せません。</span></div>'),
  card(head("通った関門") +
    '<div style="display:flex;flex-direction:column;gap:10px;font-size:13px">' + "".join(
      f'<div style="display:flex;gap:9px">{pill(c,"pr")}'
      f'<div><b>{n}</b><div class="muted" style="font-size:12px">{d}</div></div></div>'
      for c, n, d in [("C8","秘密","AI には参照IDのみ"),("C1","ネットワーク","サービス台帳で自動操作を許可済み"),
                      ("C2","永続化","テナント文脈つきで書き込み")]) + '</div>') +
  card(head("費用") +
    kv([("LLM 呼び出し",'<span class="num">0回</span>'),("入力トークン",'<span class="num">0</span>'),
        ("出力トークン",'<span class="num">0</span>'),("実行経路","Bridge（高本さんのPC・サブスク内）")]) +
    '<p class="muted" style="font-size:12px;margin-top:11px">覚えた操作の再生なので LLM を使っていません。</p>') +
  card(head("証跡") +
    '<p class="muted" style="font-size:12.5px">この記録は<b>追記専用</b>です。書き換えも削除もできません（管理者にもできません）。</p>'
    '<div style="margin-top:11px">' + btn("証跡を見る","g","file","v1-audit.html") + '</div>'),
 ], "g21"))

_rd_undo = (f'<a href="v1-runs.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}一覧に戻る</a>' +
 card('<div class="card-h">' + ic("warn") + '<h2>この実行を取り消しますか</h2></div>' +
  '<p style="font-size:14px;line-height:1.85;margin-bottom:18px">'
  '<b>台帳への書き込みだけ</b>を元に戻します。外に出たものは戻せません。</p>' +
  table(["対象",("件数","r"),"取り消し"], [
    [f'<span class="tag">{dot("d-indigo")}案件パイプラインに追加した5行</span>',("5","n"), pill("戻せる","su","check")],
    ["見送りの理由の記録",("7","n"), pill("戻せる","su","check")],
    ["<b>送信済みのメール</b>",("0","n"), pill("この実行では送っていません","ne")],
    ["<b>証跡（audit_events）</b>",("12","n"), pill("戻せない（追記専用）","da","x")],
  ]) +
  note("取り消しも<b>1つの操作として証跡に残ります</b>。「取り消したこと」自体が消えるわけではありません。", "warn") +
  '<div style="display:flex;gap:9px;flex-wrap:wrap">'
  f'<button class="btn btn-d">{ic("undo")}5行を取り消す</button>' + btn("やめる","g") + '</div>',
  style="border-color:var(--st-warning)"))

RUN_DETAIL = ("run-detail", [
  ("d","実行の詳細","どの関門を通り・何を書き込み・いくらかかったかを1画面で見せる。",_rd),
  ("u","取り消す","戻せるものと戻せないものを、押す前に分けて見せる。",_rd_undo)], "", False)

# ============================================================ policies
_po = ('<p class="muted" style="font-size:13px;margin-bottom:18px">'
 'AI が「勝手にやってよいこと」「必ず止まること」「そもそもやらないこと」を決めます。'
 '<b>スコープ4層の下の層が上を上書き</b>しますが、<b>運営の安全ルールだけは上書きできません</b>。</p>' +
 card('<div class="card-h">' + ic("lock") + '<h2>運営の安全ルール（変更できません）</h2></div>'
   '<div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px">' + "".join(
     f'<div style="display:flex;gap:10px">{pill(lab,k,"" )}<span>{t}</span></div>' for k, lab, t in [
       ("da","禁止","銀行サイトでの<b>振込・送金操作</b>（閲覧のみ例外登録可）"),
       ("da","禁止","CAPTCHA・ボット判定の<b>突破</b>（顧客のアカウント凍結を招くため）"),
       ("da","禁止","利用規約で自動操作を明示的に禁じているサービスへの操作"),
       ("wa","承認","顧客の口座番号・カード番号を含む操作は<b>必ず承認を挟む</b>"),
       ("wa","承認","AI に資格情報の<b>中身</b>を渡すことはできない（参照IDのみ）"),
     ]) + '</div>', style="background:var(--primary-c);border-color:var(--primary)") +
 card(head("会社のルール", btn("ルールを足す","o","plus"), "株式会社ENGINE BASE") +
   table(["操作","対象","扱い","条件",""], [
     ["メールを送る",'<span class="muted">既存顧客</span>', pill("承認","wa","clock"),
      '<span class="muted" style="font-size:12.5px">すべて承認箱を通す</span>',(btn("変える"),"r")],
     ["請求書を送る",'<span class="muted">既存顧客</span>', pill("承認","wa","clock"),
      '<span class="muted" style="font-size:12.5px">金額に関わらず承認</span>',(btn("変える"),"r")],
     ["台帳に書き込む",'<span class="muted">案件パイプライン</span>', pill("自動","su","check"),
      '<span class="muted" style="font-size:12.5px">追加のみ。削除は承認</span>',(btn("変える"),"r")],
     ["ブラウザで操作する",'<span class="muted">発注ナビ</span>', pill("自動","su","check"),
      '<span class="muted" style="font-size:12.5px">閲覧・取り込みのみ。<b>応募は禁止</b></span>',(btn("変える"),"r")],
     ["ブラウザで操作する",'<span class="muted">◯◯銀行</span>', pill("承認","wa","clock"),
      '<span class="muted" style="font-size:12.5px">明細閲覧のみ（例外登録済）</span>',(btn("変える"),"r")],
     ["ファイルを消す",'<span class="muted">すべて</span>', pill("やらない","ne","x"),
      '<span class="muted" style="font-size:12.5px">AI には削除をさせない</span>',(btn("変える"),"r")],
   ])) +
 card(head("自分のルール", btn("足す","o","plus"), "高本 雅人") +
   '<div style="display:flex;flex-direction:column;gap:9px;font-size:13.5px">' + "".join(
     f'<div style="display:flex;gap:10px;padding:11px;background:var(--surface);border-radius:var(--r-md)">'
     f'{pill(lab)}<span>{t}</span></div>' for lab, t in [
       ("書き方","送信文は必ず「お世話になっております」で始める。絵文字は使わない"),
       ("時間","21時以降と土日は、外に出る操作をしない（承認箱に貯めておく）")]) + '</div>'))

_po_edit = (card(head("請求書を送る — 扱いを決める", "", "スコープ：会社") +
  '<div style="display:flex;flex-direction:column;gap:11px;margin-bottom:20px">' + "".join(
    f'<label style="display:flex;gap:13px;align-items:flex-start;padding:15px;border:1.5px solid '
    f'{"var(--primary)" if sel else "var(--line)"};{"background:var(--primary-c);" if sel else ""}'
    f'border-radius:var(--r-md);cursor:pointer">'
    f'<input type="radio" name="m" {"checked" if sel else ""} style="margin-top:4px;accent-color:#22345C">'
    f'<div><div style="font-weight:600;display:flex;gap:8px;align-items:center">{p}{t}</div>'
    f'<div class="muted" style="font-size:12.5px;margin-top:4px">{d}</div></div></label>'
    for p, t, d, sel in [
      (pill("自動","su","check"), "止めずに実行する", "条件を満たすものは承認箱を通さず、そのまま送ります", False),
      (pill("承認","wa","clock"), "承認箱に入れて止める", "あなたが押すまで送りません（いまはこれ）", True),
      (pill("やらない","ne","x"), "AI にはやらせない", "提案もしません", False)]) + '</div>' +
  '<div class="card-h"><h2 style="font-size:13.5px">自動にする条件</h2></div>'
  '<div style="opacity:.5;pointer-events:none">' +
  field("金額の上限", inp("1,000,000","","text","num","max-width:220px")) +
  field("対象", '<select class="inp" style="max-width:300px"><option>既存顧客のみ（3か月以上の取引）</option></select>') +
  field("そのほか", '<label style="display:flex;gap:9px;align-items:center;font-size:13.5px;font-weight:400">'
        '<input type="checkbox" checked style="accent-color:#22345C">契約書の月額と一致する場合のみ</label>') + '</div>'
  '<div class="state-note" style="margin-top:14px">「承認」を選んでいるため、自動の条件は使いません。'
  '「自動」に切り替えると入力できます。</div>') +
 card('<div class="card-h">' + ic("warn") + '<h2>この設定を変えると何が起きるか</h2></div>'
  '<p style="font-size:13.5px;line-height:1.85">'
  '「自動」にすると、条件に合う請求書は<b>あなたが見ないまま先方に届きます</b>。'
  '金額の誤りがあっても送信後は取り消せません。<br>'
  '直近30日で条件に合ったのは <b class="num">6件・7,920,000</b> です。</p>'))

POLICIES = ("policies", [("l","一覧","",_po),
  ("e","1つを変える","「自動にすると何が起きるか」を必ず数字で見せる。押す前に取り返しがつくかが分かる。",_po_edit)], "", False)

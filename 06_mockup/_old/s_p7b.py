# -*- coding: utf-8 -*-
"""P7（続き）：bridge-capability / settings / account-close"""
from _icons import ic
from _parts import *

# ============================================================ bridge-capability
def _cap(rows, kind):
    return "".join(
      f'<div style="display:flex;gap:11px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line-soft)">'
      f'{ic("check") if kind=="can" else ic("x")}'
      f'<div style="flex:1"><div style="font-weight:500;font-size:13.5px">{t}</div>'
      f'<div class="muted" style="font-size:12.5px">{s}</div></div></div>' for t, s in rows)

_bc = (note("<b>この画面は、そのまま社内説明に使えるように作っています。</b>"
  "情シス・コンプライアンス部門に「何ができて何ができないアプリか」を聞かれたとき、"
  "ここを見せるか、右上から書き出したファイルを渡してください。", "primary") +
 grid([
  card('<div class="card-h" style="color:var(--st-success)">' + ic("check") +
    '<h2>できること</h2></div>' +
    _cap([("管理者が許可したサービスのブラウザ操作","資格情報を登録し、自動操作を「許可」にしたサービスのみ"),
          ("ローカルのAI CLI の起動","Claude Code / Codex / Gemini CLI を、作業フォルダの中でだけ"),
          ("作業フォルダ内のファイル読み書き","指定した1フォルダの中だけ。範囲外は Bridge 内で拒否"),
          ("Kaname サーバーとの通信","実行の指示を受け取り、結果と証跡を返す")], "can")) +
  card('<div class="card-h" style="color:var(--st-danger)">' + ic("x") +
    '<h2>できないこと</h2></div>' +
    _cap([("管理者が許可していないサービスの操作","サービス台帳に無いドメインには接続しません"),
          ("銀行での振込・送金","設定を変えてもできません。運営の安全ルールで固定"),
          ("CAPTCHA・ボット判定の突破","突破しません。人に引き継ぎます"),
          ("作業フォルダ外のファイル操作","デスクトップ・書類フォルダ等には触れません"),
          ("画面の常時録画・キーロギング","していません"),
          ("他のアプリの操作","ブラウザと指定した CLI 以外は起動しません")], "cannot")),
 ]) + '<div style="height:16px"></div>' +
 grid([
  card(head("サーバーに送るもの") +
    '<ul style="font-size:13.5px;line-height:1.95;padding-left:20px">'
    '<li>実行の結果（成功／失敗・所要時間）</li><li>台帳に書き込む値</li>'
    '<li>証跡（いつ・何を・どの関門を通ったか）</li><li>エラーの内容</li></ul>') +
  card('<div class="card-h" style="color:var(--st-danger)">' + ic("lock") + '<h2>送らないもの</h2></div>'
    '<ul style="font-size:13.5px;line-height:1.95;padding-left:20px">'
    '<li><b>ID・パスワード・ワンタイムパスワード</b></li>'
    '<li>作業フォルダ外のファイル</li><li>画面のスクリーンショット（明示的に添付した場合を除く）</li>'
    '<li>ブラウザの閲覧履歴・Cookie</li></ul>'),
 ]) + '<div style="height:16px"></div>' +
 card(head("配布・更新・アンインストール") +
   table(["項目","内容"], [
     ["配布","MDM 配布に対応。バージョン固定・強制更新が可能"],
     ["更新","自動更新／管理者承認後のみ、を選べる"],
     ["アンインストール","<b>残留物ゼロ</b>。設定・キャッシュ・鍵をすべて削除します"],
     ["通信先","Kaname のサーバー、および管理者が許可したサービスのみ"],
     ["ログ","全操作の証跡を管理者が閲覧・エクスポートできます"],
   ])))

BRIDGE_CAP = ("bridge-capability", [("c","できること・できないこと","§42「情シスに止められたら売れない」への出口。ここが無いと商談で詰まる。",_bc)], "", False)

# ============================================================ settings
_se = grid([
  card(head("会社") +
    field("会社名", inp("株式会社ENGINE BASE")) +
    field("タイムゾーン", '<select class="inp"><option>Asia/Tokyo (UTC+9)</option></select>') +
    field("期首", '<select class="inp"><option>4月</option></select>', "目標の「年」の区切りに使います") +
    field("通貨", '<select class="inp"><option>日本円 (JPY)</option></select>')) +
  card(head("AI の実行経路") +
    '<div style="display:flex;flex-direction:column;gap:10px">' + "".join(
      f'<label style="display:flex;gap:11px;align-items:flex-start;padding:13px;border:1.5px solid '
      f'{"var(--primary)" if sel else "var(--line)"};{"background:var(--primary-c);" if sel else ""}'
      f'border-radius:var(--r-md);{"opacity:.55" if dis else ""}">'
      f'<input type="radio" name="r" {"checked" if sel else ""} {"disabled" if dis else ""} style="margin-top:3px;accent-color:#22345C">'
      f'<div><b style="font-size:13.5px">{t}</b><div class="muted" style="font-size:12.5px">{d}</div></div></label>'
      for t, d, sel, dis in [
        ("Bridge（自分のサブスク内）",
         '追加費用なし · <a href="v1-bridge.html" style="color:var(--primary);font-weight:600">接続済み</a>', True, False),
        ("自分の API キー","従量課金。請求は各社から直接あなたに届きます", False, False),
        ("Kaname 運営の API を使う","運営側で無効にしています（既定はオフ）", False, True)]) + '</div>'),
  card(head("通知") +
    '<div style="display:flex;flex-direction:column;gap:12px;font-size:13.5px">' + "".join(
      f'<label style="display:flex;gap:11px;align-items:flex-start">'
      f'<input type="checkbox" {"checked" if c else ""} style="margin-top:3px;accent-color:#22345C">'
      f'<div><b>{t}</b><div class="muted" style="font-size:12.5px">{s}</div></div></label>'
      for t, s, c in [("承認箱に入ったとき","外に出る操作が止まったことを知らせます",True),
                      ("AI の実行が失敗したとき","画面が変わって止まった場合など",True),
                      ("目標が未達で着地しそうなとき","AI が見立てを更新したタイミング",True),
                      ("毎朝の焦点","今日やるべきことを1つだけ",True),
                      ("AI が実行を完了するたび","件数が多いので既定は切っています",False)]) + '</div>' +
    field("通知しない時間", '<div style="display:flex;gap:9px;align-items:center;margin-top:18px">'
      '<input class="inp num" value="21:00" style="max-width:100px"><span class="muted">〜</span>'
      '<input class="inp num" value="08:00" style="max-width:100px"></div>')) +
  card('<div class="card-h">' + ic("warn") + '<h2 style="color:var(--error)">取り返しのつかない操作</h2></div>'
    '<div style="display:flex;flex-direction:column;gap:14px">'
    '<div><b style="font-size:13.5px">すべてのデータを書き出す</b>'
    '<div class="muted" style="font-size:12.5px;margin-bottom:9px">'
    '台帳・目標・担当業務・会話・証跡をまとめて取り出せます。ロックインしません。</div>' +
    btn("書き出す","o","file") + '</div>'
    '<div style="border-top:1px solid var(--line-soft);padding-top:14px">'
    '<b style="font-size:13.5px;color:var(--error)">この会社を削除する（退会）</b>'
    '<div class="muted" style="font-size:12.5px;margin-bottom:9px">'
    '全メンバーのアクセスが即座に切れ、発行済みのトークン・共有リンクもすべて無効になります。</div>' +
    btn("退会の手続きへ","d","trash","v1-account-close.html") + '</div></div>',
    style="border-color:var(--error)"),
], "g2")

SETTINGS = ("settings", [("s","設定","",_se)], "", False)

# ============================================================ account-close
_ac = grid([
  card('<div class="card-h">' + ic("warn") + '<h2>退会すると何が起きるか</h2></div>' +
    '<p style="font-size:13.5px;line-height:1.85;margin-bottom:18px">'
    '<b>先にデータを書き出してください。</b>退会後は取り出せません。</p>' +
    '<div style="display:flex;flex-direction:column;gap:0">' + "".join(
      f'<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line-soft)">'
      f'{pill(lab, k)}<div style="flex:1;font-size:13.5px">{t}</div></div>'
      for k, lab, t in [
        ("da","即時","<b>全メンバーがサインアウト</b>されます（発行済みのセッションを全て無効化）"),
        ("da","即時","<b>Bridge の接続が切れます</b>。顧客PCのアプリは動かなくなります"),
        ("da","即時","<b>発行済みの共有リンク・Webhook が全て無効</b>になります"),
        ("da","即時","AI社員の実行が全て停止します（承認待ちのものは破棄）"),
        ("da","即時","<b>資格情報を完全に削除</b>します（復元できません）"),
        ("wa","30日後","台帳・目標・担当業務・会話を完全に削除します"),
        ("ne","法定期間","<b>証跡だけは法定保存期間のあいだ保持</b>します（追記専用のため削除できません）"),
      ]) + '</div>' +
    note("<b>「退会したのに動いていた」を起こさないため、トークン・接続・共有リンクは退会と同時に無効化します。</b>"
         "あとから止め忘れが見つかる、ということがありません。", "warn")) +
  card(head("先にやってください") +
    '<div style="display:flex;flex-direction:column;gap:11px">' + "".join(
      f'<div style="display:flex;gap:11px;align-items:center;padding:12px;background:var(--surface);border-radius:var(--r-md)">'
      f'{ic(i)}<div style="flex:1"><div style="font-size:13px;font-weight:600">{t}</div>'
      f'<div class="muted" style="font-size:11.5px">{s}</div></div>{b}</div>'
      for i, t, s, b in [
        ("file","データを全部書き出す","台帳・目標・担当業務・会話・証跡", btn("書き出す","p")),
        ("users","メンバーに知らせる","4名がアクセスできなくなります", btn("知らせる")),
        ("bridge","Bridge をアンインストール","残留物ゼロで消えます", btn("手順を見る","g",None,"v1-bridge-capability.html")),
      ]) + '</div>') +
  card('<div class="card-h" style="color:var(--error)">' + ic("trash") + '<h2>退会する</h2></div>' +
    field("確認のため会社名を入力してください", inp("","株式会社ENGINE BASE")) +
    field("差し支えなければ理由を教えてください",
      '<select class="inp"><option>選択してください</option><option>費用が合わなかった</option>'
      '<option>期待した効果が出なかった</option><option>他のツールに移行する</option>'
      '<option>事業を終了する</option><option>その他</option></select>') +
    f'<button class="btn btn-d" style="width:100%">{ic("trash")}退会する</button>',
    style="border-color:var(--error)"),
], "g21")

ACCOUNT_CLOSE = ("account-close", [
  ("c","退会","主アクションを「先にデータを書き出す」にしている。取り返しのつかない操作を主アクションにしない。",_ac)], "", False)

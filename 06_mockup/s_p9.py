# -*- coding: utf-8 -*-
"""P9 運営と往復するもの・自分で整えるもの（D-075・D-076）：inquiry / notices / billing / account / company-settings / import / services"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _leave import LEAVE_CSS, leave_table

P9_CSS = """
.stt{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px;margin-bottom:14px}
.stt>div{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:11px 13px;display:flex;gap:10px;align-items:center}
.stt .dot{width:10px;height:10px;border-radius:50%;background:var(--st-success);flex:none}.stt .dot.wa{background:var(--st-warning)}.stt .dot.da{background:var(--st-danger)}.stt .dot.ne{background:var(--on-sv)}
.stt b{display:block;font-size:13.5px}.stt small{display:block;color:var(--on-sv);font-size:11.5px}
.ub{display:flex;flex-direction:column;gap:10px}
.ub>div{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;gap:12px;align-items:center;font-size:13px}
.ub .bar{height:8px}.ub .v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.inq{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden}
.inq .ir{display:grid;grid-template-columns:30px minmax(0,1fr) 110px 90px;gap:12px;align-items:center;padding:11px 14px;border-top:1px solid var(--line-soft);font-size:13px}
.inq .ir:first-child{border-top:0}.inq .ir b{display:block}.inq .ir small{display:block;color:var(--on-sv);font-size:11.5px}
.inq .ir .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--sv);color:var(--on-sv)}
.thread{display:flex;flex-direction:column;gap:10px}
.thread .m{max-width:640px;padding:10px 14px;border-radius:var(--r-lg);font-size:13.5px;line-height:1.7;background:var(--surface)}
.thread .m.me{align-self:flex-end;background:var(--primary-c);color:var(--on-primary-c)}
.thread .m.bot{border:1px solid var(--line);background:var(--card)}
.thread .who{font-size:11.5px;color:var(--on-sv);margin-bottom:3px}
.svc{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:12px}
.svc>div{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:12px 14px;border-top:3px solid var(--sc)}
.svc b{display:block;font-size:14px}.svc small{display:block;color:var(--on-sv);font-size:12px;line-height:1.5;margin:4px 0 8px}
.dropz{border:1px dashed var(--line);border-radius:var(--r-xl);padding:34px 20px;text-align:center;background:var(--surface);font-size:13.5px}
.dropz svg{display:block;margin:0 auto 10px;width:26px;height:26px;color:var(--on-sv)}
.dropz small{display:block;color:var(--on-sv);font-size:12px;margin-top:6px}
@media(max-width:767px){.inq .ir{grid-template-columns:30px 1fr}.inq .ir .st,.inq .ir .dt{grid-column:2}.ub>div{grid-template-columns:1fr 70px}.ub>div .l{grid-column:1/-1}}
"""

# ============================================================ inquiry（問い合わせ）
def _ir(icon, title, sub, st, cls, date):
    return f'<div class="ir"><span class="ico">{ic(icon)}</span><div><b>{title}</b><small>{sub}</small></div><span class="st">{pill(st, cls)}</span><span class="dt num muted" style="font-size:12px;text-align:right">{date}</span></div>'
_iq_new = card(head("運営に聞く", sub="まず高本AIが答えます。解けなければ運営に送ります（構成だけが伝わり、台帳の中身は送りません）") +
  field("種類", '<select class="inp"><option>使い方が分からない</option><option>止まっている・動かない</option><option>請求・プラン</option><option>要望</option><option>その他</option></select>') +
  field("内容", '<textarea class="inp" rows="4" placeholder="例：発注ナビの取り込みが 9/14 から止まっています。覚え直させるを押しても手順 3 で止まります。"></textarea>') +
  f'<div class="dropz" style="padding:16px">{ic("upload")}スクショや書き出したファイルを落とせます<small>台帳の中身は自動では付きません</small></div>' +
  '<div class="acts">' + btn("高本AIに聞く（まず）","p","clone") + btn("運営に送る","o","send") + '</div>' +
  clone_box("高本AI","「発注ナビの取り込みが止まっている」なら、運営に送る前に私が見られます：覚えた操作の手順 3 が画面の変更で止まっています。覚え直させるで直せそうです。直らなければ、この内容をそのまま運営に送ります。", btn("覚え直させる","o","wrench","v1-automation-repair.html")))
_iq_list = card(head("問い合わせ", btn("新しく聞く","p","plus"), "返答待ち 1 · 返答あり 1 · 解決 3") + '<div class="inq">' +
  _ir("wrench","発注ナビの取り込みが止まっている","止まっている・動かない · 高本AIが先に答えた → 運営へ","返答待ち","wa","9/14 18:20") +
  _ir("card","請求書の宛名を変えたい","請求・プラン · 運営 田村が返答","返答あり","su","9/10") +
  _ir("info","記憶の範囲を後から変えられるか","使い方 · 高本AIが答えて解決","解決","ne","9/6") +
  _ir("flag","承認をスマホで押したい","要望 · 段階2 の予定と回答","解決","ne","8/30") + '</div>')
_iq_thread = card(head("発注ナビの取り込みが止まっている", pill("返答待ち","wa"), "止まっている・動かない · 9/14 18:20 · 運営に届いています") + '<div class="thread">' +
  '<div class="m me"><div class="who">あなた · 9/14 18:20</div>発注ナビの取り込みが 9/14 から止まっています。覚え直させるを押しても手順 3 で止まります。</div>' +
  '<div class="m bot"><div class="who">高本AI · 18:21</div>手順 3「条件で絞る」が、発注ナビ側の画面の変更で見つかりません。覚え直させるで直せる型ですが、2 回失敗しているので運営に送ります。送るのは「構成（プラン・営業社員 第 6 版・止まっている型）」と「覚えた操作の手順」だけで、台帳の中身は送りません。</div>' +
  '<div class="m"><div class="who">運営 田村 · 18:45</div>発注ナビの絞り込みが「検索条件」パネルに移動しています。覚え直させるの画面で「AI に覚え直させる」を押すと、画面を見て手順を作り直します。直らなければ 3 日のサポートアクセスを許可してください（手順だけ見ます）。</div>' + '</div>' +
  '<div class="acts">' + btn("覚え直させる","p","wrench","v1-automation-repair.html") + btn("サポートアクセスを許可する","o","key","v1-audit.html") + btn("解決した","g","check") + '</div>')
INQUIRY = ("inquiry", [("n","問い合わせ","まず自分のAIが答え、解けなければ運営へ。",_iq_list),("t","1 件のやりとり","",_iq_thread),("w","新しく聞く","",_iq_new)], P9_CSS, False, {"問い合わせる":"","返答待ち":"!1","返答あり":"1","解決した":"3"})

# ============================================================ notices（お知らせと通知）
_nt_status = ('<div class="stt">' + "".join(f'<div><span class="dot {c}"></span><div><b>{t}</b><small>{s}</small></div></div>' for t, s, c in [
  ("Kaname","正常 · 9/15 09:00 確認",""),("あなたの Bridge","つながっている · MacBook Pro · 9/15 09:12",""),("AI の経路","Bridge（本人のサブスク）。PC が閉じている間はサーバー経路に切り替わる",""),
  ("発注ナビ","画面が変わった（9/14）。覚え直しが要る","wa"),("freee 正規連携","正常","")]) + '</div>')
def _nrow(kind, cls, title, sub, date):
    return f'<div class="ir"><span class="ico">{ic(kind)}</span><div><b>{title}</b><small>{sub}</small></div><span class="st">{pill({"rel":"リリース","inc":"障害","mnt":"メンテ","rule":"ルールの版"}[cls], {"rel":"su","inc":"da","mnt":"wa","rule":"ne"}[cls])}</span><span class="dt num muted" style="font-size:12px;text-align:right">{date}</span></div>'
_nt = ('<div data-sec="0">' + card(head("お知らせ", sub="運営から。あなたのプラン（スタンダード）向け") + '<div class="inq">' +
  _nrow("zap","rel","目標に「逆算の案」が付きました","大きい目標を変えると下の配り直しの案が出ます · 会社モデル 第 4 版から","9/15") +
  _nrow("warn","inc","9/14 18:00〜18:40 承認待ちの表示が遅れました","原因：通知の配信の詰まり。押した内容は失われていません","9/14") +
  _nrow("clock","mnt","9/20（土）02:00〜04:00 メンテ","この間 Bridge は待機し、溜まった分は再開後に順に片づけます","9/12") +
  _nrow("policy","rule","運営ルール 第 2 版：自動操作を禁じるサービスに 3 件追加","サービス台帳を見てください。該当があれば人へのハンドオフに落ちます","9/12") + '</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("稼働状況", sub="今どの経路で動いているか。止まっているものは赤") + _nt_status +
  '<div class="muted" style="font-size:12px">PC が閉じている間はサーバー経路（段階2 で本格化）に切り替わり、溜まった分は起きたときに順に片づけます。切り替わった記録は証跡に残ります。</div>') + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("通知の届け先", sub="承認待ち・止まった・お知らせを、どこに届けるか") + '<div class="t-wrap"><table class="ptbl"><thead><tr><th>何を</th><th>アプリ内</th><th>メール</th><th>スマホ（段階2）</th></tr></thead><tbody>' +
  "".join(f'<tr><td>{w}</td><td><input type="checkbox" {"checked" if a else ""} style="accent-color:#22345C"></td><td><input type="checkbox" {"checked" if b else ""} style="accent-color:#22345C"></td><td><input type="checkbox" disabled></td></tr>' for w, a, b in [("承認待ちが来た",1,1),("AI が止まった",1,1),("承認者が自分 1 人になった",1,1),("お知らせ（障害・メンテ）",1,1),("お知らせ（リリース）",1,0),("問い合わせに返答が来た",1,1)]) + '</tbody></table></div>' +
  '<div class="acts">' + btn("保存する","p","check") + '</div>') + '</div>')
NOTICES = ("notices", [("n","お知らせと通知","",_nt)], P9_CSS, False, {"お知らせ":"4","稼働状況":"!1","通知の届け先":""})

# ============================================================ billing（プランと請求）
_bl_use = card(head("プラン：スタンダード", btn("プランを変える","o","layers"), "月額 80,000 円 · 請求書払い · 次の請求 10/1") + '<div class="ub">' + "".join(
  f'<div><span class="l">{k}</span><span class="bar"><i class="{"bad" if v/m > .9 else ("warn" if v/m > .7 else "ok")}" style="width:{round(v/m*100)}%"></i></span><span class="v">{v} / {m}</span></div>'
  for k, v, m in [("AI社員",3,5),("担当業務",7,20),("自律実行（今日）",42,100),("人",4,5),("層（会社が決めた）",2,2)]) + '</div>' +
  '<div class="muted" style="font-size:12px;margin-top:12px">上限に近いものは高本AIが先に言います。上限を超えた分は止まるだけで消えません。</div>' +
  clone_box("高本AI","人が 4/5 です。山本さんの招待が通ると 5/5 で、次の招待はプロにするか誰かを外すかになります。"))
_bl_inv = card(head("請求書", sub="月ごと。PDF で出せます") + table(["月",("金額","r"),"内訳","状態",""], [
  ["2026/9",("80,000 円","n"),"スタンダード 1 か月",pill("請求書を送付 · 9/1","ne"),btn("PDF","g","download")],["2026/8",("80,000 円","n"),"スタンダード 1 か月",pill("入金済み · 8/28","su"),btn("PDF","g","download")],
  ["2026/7",("53,333 円","n"),"スタンダード 日割り（7/12〜）",pill("入金済み · 7/30","su"),btn("PDF","g","download")]]))
_bl_pay = card(head("支払い方法", sub="段階2 でカード登録。今は請求書払い") + note("v1 は請求書払いです。運営が入金を記録すると、ここが「入金済み」になります。カードの登録は段階2。", "info") + field("請求先", inp("株式会社ENGINE BASE 経理 · info@engine-base.com")) + btn("会社の設定で変える","g","settings","v1-company-settings.html"))
_bl_change = ('<div data-sec="0 1 2 3">' + card(head("プランを変える", sub="下げるときは、上限を超える分がどうなるかを先に見る") +
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + "".join(f'<label style="flex:1;min-width:180px;padding:12px 14px;border:1px solid {"var(--primary)" if cur else "var(--line)"};border-radius:var(--r-lg);font-size:13px"><input type="radio" name="pl" {"checked" if cur else ""} style="accent-color:#22345C"> <b>{n}</b><div class="muted" style="font-size:12px;margin-top:4px">{d}</div></label>' for n, d, cur in [("エントリー 30,000","AI社員 2 · 担当業務 6 · 1 人 · 会社の層なし",False),("スタンダード 80,000","AI社員 5 · 担当業務 20 · 5 人 · 会社＋個人",True),("プロ 150,000","AI社員 15 · 無制限 · 承認フロー · 会社が決めた層",False)]) + '</div>' +
  '<div style="font-size:12.5px;font-weight:600;color:var(--on-sv);margin-bottom:8px">エントリーに下げると起きること（全オブジェクト）</div>' + leave_table("plan-change") +
  note("超えている分：AI社員 3 → 2（1 体を止める）・人 4 → 1（3 人が無効）・層 2 → 0（部署の範囲は会社に畳む）。どれを止めるかは次の画面で選びます。", "warn") +
  '<div class="acts">' + btn("下げる（止めるものを選ぶ）","d","layers") + btn("やめる","g") + '</div>') + '</div>')
_bl = '<div data-sec="0 1">' + _bl_use + '</div><div data-sec="2"><div style="height:14px"></div>' + _bl_inv + '</div><div data-sec="3"><div style="height:14px"></div>' + _bl_pay + '</div>'
BILLING = ("billing", [("n","プランと請求","",_bl),("c","プランを変える","下げるときの依存（全オブジェクト）。",_bl_change)], P9_CSS + LEAVE_CSS, False, {"プラン":"","使った量":"!1","請求書":"3","支払い方法":""})

# ============================================================ account（自分のアカウント）
_ac_basic = ('<div data-sec="0">' + card(head("自分のアカウント") + field("名前", inp("高本 雅人")) + field("メールアドレス", inp("info@engine-base.com","","email")) +
  field("表示する名前の AI", inp("高本AI")) + '<div class="acts">' + btn("保存する","p","check") + '</div>' +
  '<div class="muted" style="font-size:12px;margin-top:10px">メールを変えると確認のメールが届き、確認するまで古いメールでログインします。</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("パスワードと 2 段階認証") + field("今のパスワード", inp("","","password")) + field("新しいパスワード", inp("","12 文字以上","password")) +
  '<div class="acts">' + btn("パスワードを変える","p","key") + '</div>' + '<div style="height:12px"></div>' +
  '<div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);font-size:13px">' + ic("lock") + '<div><b>2 段階認証：有効</b><div class="muted" style="font-size:12px">認証アプリ · 回復コード 8 個のうち 2 個使用</div></div><span style="margin-left:auto">' + btn("再設定","o","undo") + btn("回復コードを出し直す","g","key") + '</span></div>' +
  note("パスワード・2 段階認証を変えると、<b>他の端末と Bridge の接続は即失効</b>します。入り直してください（G-14）。", "warn")) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("端末", btn("この端末以外を切る","d","ban"), "ログイン中の端末と Bridge") + table(["端末","場所","最終","Bridge",""], [
    ["MacBook Pro · Chrome（この端末）","東京",("9/15 09:12","n"),pill("つながっている","su"),""],["iPhone · Safari","東京",("9/14 22:40","n"),pill("なし","ne"),btn("切る","g","x")],["Windows · Edge","大阪（出張）",("9/8 11:02","n"),pill("なし","ne"),btn("切る","g","x")]])) + '</div>')
ACCOUNT = ("account", [("n","自分のアカウント","変えると他の端末は即失効（G-14）。",_ac_basic)], P9_CSS + LEAVE_CSS, False, {"基本":"","パスワードと 2 段階認証":"","端末":"3"})

# ============================================================ company-settings（会社の設定）
_cs = ('<div data-sec="0">' + card(head("会社") + grid([field("会社名", inp("株式会社ENGINE BASE")), field("タイムゾーン", '<select class="inp"><option>Asia/Tokyo（日本）</option><option>UTC</option></select>')], "g2") +
  field("請求先", inp("経理 · info@engine-base.com · 東京都〇〇区…")) + '<div class="acts">' + btn("保存する","p","check") + '</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("データの所在", sub="台帳・会話・記憶をどこに置くか。学習には使わない（固定）") + '<div style="display:flex;flex-direction:column;gap:8px">' + "".join(
    f'<label style="display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border:1px solid {"var(--primary)" if on else "var(--line)"};border-radius:var(--r-md);font-size:13px"><input type="radio" name="loc" {"checked" if on else ""} style="accent-color:#22345C;margin-top:3px"><div><b>{a}</b><div class="muted" style="font-size:12px;margin-top:2px">{b}</div></div></label>'
    for a, b, on in [("日本（東京）","Kaname のサーバー。AI の経路は Bridge（本人のサブスク）なので、AI 側へは仕事に必要な分だけ",True),("海外の経路も許す（+10%）","AI の経路で東京以外を使う場合。学習には使わない契約",False),("ローカル LLM（将来）","段階3 以降。社内から出さない",False)]) + '</div>' +
  '<div class="acts">' + btn("保存する","p","check") + '</div>' + '<div class="muted" style="font-size:12px;margin-top:10px">変えた記録は証跡に残り、「できること・できないこと」に反映されます。</div>') + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("AI の経路", sub="既定は Bridge（あなたの PC・本人のサブスク）") + table(["経路","状態","誰が払う"], [
    ["Bridge（本人のサブスク）",pill("既定 · 使用中","su"),"本人のサブスク"],["サーバー（PC が閉じている間）",pill("段階2 で本格化","ne"),"—"],["運営マネージド（運営の API）",pill("段階2 · 既定 OFF","ne"),"運営（プランに含む）"],["BYOK（自社の API キー）",pill("段階2","ne"),"自社"]]) +
  note("運営マネージドの切替はここに置きます（段階2）。今は Bridge だけです。", "info")) + '</div>')
COMPANY_SETTINGS = ("company-settings", [("n","会社の設定","",_cs)], P9_CSS, False, {"会社":"","データの所在":"日本","AI の経路":"Bridge"})

# ============================================================ import（取り込み）
_im = ('<div data-sec="0">' + card(head("取り込む", sub="形式は問いません。PDF・Excel・CSV・画像・メール・音声。高本AIが読んで候補を出します") +
  f'<div class="dropz">{ic("upload")}ここに落とす、または選ぶ<small>顧客リスト（CSV・Excel）→ 台帳の下書き ／ 過去の請求書・提案書（PDF・Word）→ 書式の候補 ／ 画面のスクショ → 覚える操作の元 ／ メール → やりとりの型</small></div>' +
  '<div class="acts">' + btn("ファイルを選ぶ","p","upload") + btn("Google Drive から","o","globe") + '</div>' +
  '<div class="muted" style="font-size:12px;margin-top:10px">取り込んだものは「読んだ結果」に出て、人が押すまで本番の台帳には入りません。</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("読んだ結果", sub="高本AIの候補。押すと本番に入る") + table(["入れたもの","読んで分かったこと","候補","",""], [
    ["顧客リスト_2026.xlsx（212 行）","会社名・担当・電話・最終接触日","台帳「案件」に 212 件の下書き（重複 8 件は 1 つに）",pill("確認待ち","wa"),btn("見て入れる","p","check")],
    ["請求書_京蟻_7月.pdf","税込・内訳あり・期日 30 日","テンプレ「請求書（税込・内訳）」の候補",pill("確認待ち","wa"),btn("テンプレにする","o","check")],
    ["発注ナビ_絞り込み.png","画面の操作 6 手順","営業社員の覚えた操作の候補",pill("確認待ち","wa"),btn("覚えさせる","o","route")]]) +
  clone_box("高本AI","顧客リストの 212 行のうち 8 行は同じ会社です。1 つにまとめる案にしました。電話番号の全角・半角は揃えます。")) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("取り込み済み") + table(["いつ","何を",("件数","r"),"入った先"], [[("9/4","n"),"過去のアプローチ文 12 通",("12","n"),"記憶「アプローチ文は 3 段落」の元"],[("9/4","n"),"過去メール 38 通",("38","n"),"記憶「メールは短く」の元"]])) + '</div>')
IMPORT = ("import", [("n","取り込み","何でも受け取って自分のAIが読む。本番には人が押してから。",_im)], P9_CSS, False, {"入れる":"","読んだ結果":"!3","取り込み済み":"2"})

# ============================================================ services（外部サービスの連携と可否）
def _svc(name, kind, why, conn, c):
    return f'<div style="--sc:{c}"><b>{name}</b><small>{why}</small><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">{pill(kind, {"api":"su","allowed":"su","unspecified":"ne","forbidden":"da","bank":"da"}[kind.split(" ")[0]] if False else ("su" if kind.startswith(("正規","ブラウザ")) else ("da" if kind.startswith(("禁止","銀行")) else "ne")))}<span class="muted" style="font-size:12px">{conn}</span></div></div>'
_sv = ('<div data-sec="0">' + card(head("使っているサービス", sub="運営のサービス台帳（可否と理由）と、あなたの接続。禁止のものは高本AIが「なぜ」を答えます") + '<div class="svc">' +
  _svc("freee","正規連携（API）","会計。請求書と入金は API で読み書き。ブラウザでは触らない","つながっている · 9/15 06:30 に読んだ","var(--st-success)") +
  _svc("発注ナビ","ブラウザ操作 OK","規約に自動操作の禁止なし。本人のログイン済みセッションで操作","覚えた操作 6 手順 · 画面が変わって止まっている","var(--st-warning)") +
  _svc("Google Workspace","正規連携（API）","メールの送信は Gmail API。送る前に必ず承認","つながっている","var(--st-success)") +
  _svc("X（旧 Twitter）","ブラウザ操作 OK（投稿は承認必須）","規約は自動投稿を API に限る → 投稿は API、閲覧はブラウザ","未接続","var(--on-sv)") +
  _svc("〇〇銀行","銀行 · 触らない","運営ルール。会計ソフトの正規連携経由でだけ入金を読む","freee 経由","var(--st-danger)") +
  _svc("△△クラウド（勤怠）","禁止（規約）","規約で自動操作を禁止。人へのハンドオフに落ちる","—","var(--st-danger)") + '</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("正規連携", btn("つなぐ","p","plus"), "OAuth でつなぐもの。資格情報は預けない") + table(["サービス","範囲","つないだ","状態",""], [
    ["freee","請求書の作成・入金の参照",("7/12","n"),pill("有効","su"),btn("外す","g","x")],["Google Workspace","メール送信（承認後）・カレンダー参照",("7/12","n"),pill("有効","su"),btn("外す","g","x")]])) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("今の接続", sub="どの経路で動いているか") + _nt_status) + '</div>')
SERVICES = ("services", [("n","外部サービスの連携","可否は運営のサービス台帳。正規連携は資格情報を預けない。",_sv)], P9_CSS, False, {"使っているサービス":"6","正規連携":"2","今の接続":""})

SCREENS = [INQUIRY, NOTICES, BILLING, ACCOUNT, COMPANY_SETTINGS, IMPORT, SERVICES]

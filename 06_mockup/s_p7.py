# -*- coding: utf-8 -*-
"""P7 外に説明する・出る：security-brief / export / account-close"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _leave import LEAVE, KIND_JA, LEAVE_CSS, leave_table, EVENT_JA

SB_CSS = """
.tc-hero{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;border:1px solid var(--line);border-radius:var(--r-xl);background:var(--card);padding:20px 24px;margin-bottom:14px}
.tc-hero h2{font-size:20px;font-weight:700;margin:0 0 4px}.tc-hero p{margin:0;color:var(--on-sv);font-size:13px}
.tc-hero .bd{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.tc-hero .bd span{display:inline-flex;gap:6px;align-items:center;font-size:12px;padding:5px 10px;border-radius:var(--r-full);background:var(--surface);border:1px solid var(--line)}
.tc-hero .bd span svg{width:13px;height:13px;color:var(--st-success)}
.tc-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:10px;margin-bottom:14px}
.tc-sum>div{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:12px 14px;display:flex;gap:10px;align-items:center}
.tc-sum .ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
.tc-sum .ic.ok{background:#DCFCE7;color:#166534}.tc-sum .ic.no{background:#FEE2E2;color:#991B1B}.tc-sum .ic.ne{background:var(--sv);color:var(--on-sv)}
.tc-sum b{display:block;font-size:20px;line-height:1.1}.tc-sum small{color:var(--on-sv);font-size:11.5px}
.tc-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:14px;margin-bottom:14px}
.tc{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden}
.tc .th{display:flex;gap:9px;align-items:center;padding:11px 14px;border-bottom:1px solid var(--line);font-weight:700;font-size:14px}
.tc .th .n{margin-left:auto;font-weight:500;color:var(--on-sv);font-size:11.5px}
.tc .it{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:start;padding:11px 14px;border-top:1px solid var(--line-soft);font-size:13px}
.tc .it:first-of-type{border-top:0}
.tc .it .m{width:26px;height:26px;border-radius:50%;display:grid;place-items:center}.tc .it .m svg{width:14px;height:14px}
.tc .it .m.ok{background:#DCFCE7;color:#166534}.tc .it .m.no{background:#FEE2E2;color:#991B1B}
.tc .it b{display:block}.tc .it small{display:block;color:var(--on-sv);font-size:12px;line-height:1.5;margin-top:2px}
.tc .it .ev{font-size:11px;color:var(--on-sv);white-space:nowrap;display:inline-flex;gap:4px;align-items:center;padding-top:4px}.tc .it .ev svg{width:12px;height:12px}
.flow3{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:10px;align-items:stretch}
.flow3 .bx{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--surface);padding:12px 14px;font-size:12.5px}
.flow3 .bx h4{font-size:13.5px;font-weight:700;margin:0 0 6px;display:flex;gap:6px;align-items:center}.flow3 .bx h4 svg{width:15px;height:15px}
.flow3 .bx ul{margin:0;padding-left:16px;color:var(--on-sv);line-height:1.6}
.flow3 .ar{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;font-size:11px;color:var(--on-sv);text-align:center;min-width:96px}
.flow3 .ar svg{width:18px;height:18px}.flow3 .ar .no{color:var(--st-danger)}
.dm{width:100%;border-collapse:collapse;font-size:13px}.dm th,.dm td{padding:8px 10px;border-bottom:1px solid var(--line-soft);text-align:left}.dm th{font-size:11.5px;color:var(--on-sv);font-weight:600;background:var(--surface)}
.dm .y{color:#166534;font-weight:700}.dm .n{color:#991B1B;font-weight:700}.dm .p{color:#7E570D;font-weight:700}
@media(max-width:1023px){.flow3{grid-template-columns:1fr}.flow3 .ar{flex-direction:row;min-width:0}.flow3 .ar svg{transform:rotate(90deg)}}
@media(max-width:767px){.tc-hero{grid-template-columns:1fr}.tc .it .ev{white-space:normal}}
"""
def _it(ok, t, d, ev):
    return f'<div class="it"><span class="m {"ok" if ok else "no"}">{ic("check" if ok else "x")}</span><div><b>{t}</b><small>{d}</small></div><span class="ev">{ic("log")}{ev}</span></div>'
_sb = ('<div class="tc-hero"><div><div class="muted" style="font-size:12px;font-weight:600;letter-spacing:.06em">ENGINE BASE · KANAME</div><h2>この製品でできること・できないこと</h2><p>情シス・コンプラの方へ。Bridge（あなたのPCで動く実行器）の権限を完全に列挙します。ここに無いことはできません。最終更新 9/10 · 第 4 版の会社モデルに基づく</p>'
       f'<div class="bd"><span>{ic("check")}全操作に証跡</span><span>{ic("check")}資格情報は AI に渡らない</span><span>{ic("check")}データの所在は日本（選択可）</span><span>{ic("check")}学習に使わない</span><span>{ic("check")}いつでも持ち出せる</span></div></div>'
       '<div class="acts" style="margin:0">' + btn("PDFで出す","p","download") + btn("証跡を書き出す","o","log","v1-audit.html") + '</div></div>'
  '<div class="tc-sum">' + "".join(f'<div><span class="ic {k}">{ic(i)}</span><div><b>{n}</b><small>{l}</small></div></div>' for k, i, n, l in [("ok","check","5","できること"),("no","ban","5","できないこと（運営ルール）"),("ne","send","3","送るもの"),("ne","lock","3","送らないもの")]) + '</div>'
  '<div class="tc-g">'
  '<div class="tc"><div class="th">' + ic("check") + 'できること<span class="n">完全列挙 · これ以外はできません</span></div>'
  + _it(True,"あなたのブラウザを操作する","あなたのPC・あなたのログイン済みセッションで。画面の中身は Kaname に送らない","証跡 · 操作ごと")
  + _it(True,"資格情報を入力する","預かり先の番号から実行器が入力。AI には値が渡らない","証跡 · 使った時刻")
  + _it(True,"外部サービスと通信する","必ず 1 本の出口を通る。サービス台帳で可否を判定。規約で禁じるサービスは通らない","証跡 · 宛先")
  + _it(True,"ファイルを読む・書く","あなたが指定したフォルダだけ","証跡 · パス")
  + _it(True,"PC が閉じたら止まる","起きたときに溜まった分を順に片づける（段階 1）","状態 · 接続") + '</div>'
  '<div class="tc"><div class="th">' + ic("ban") + 'できないこと<span class="n">運営ルール · 誰も上書きできない</span></div>'
  + _it(False,"CAPTCHA を突破する","出たら止めて人に渡す。突破すると顧客のアカウントが凍結される","止まった記録")
  + _it(False,"銀行をブラウザで触る","会計ソフトの正規連携（API）経由のみ","サービス台帳")
  + _it(False,"規約で自動操作を禁じるサービスを操作する","サービス台帳で判定し、通さない","サービス台帳")
  + _it(False,"資格情報を AI に渡す","AI が見るのは預かり先の番号だけ","設計 · vault")
  + _it(False,"承認なしに外に出す","メール・請求書・投稿・台帳の外部更新は人が押してから","承認の記録") + '</div></div>'
  + card(head("データの流れ", sub="何がどこへ行くか。3 か所しか無い") +
    '<div class="flow3"><div class="bx"><h4>' + ic("bridge") + 'あなたの PC</h4><ul><li>ブラウザ（あなたのセッション）</li><li>Bridge（実行器）</li><li>本人サブスクの公式 CLI が AI を動かす</li></ul></div>'
    '<div class="ar">' + ic("right") + '<span>台帳の中身・タスク・証跡</span><span class="no">画面の中身・資格情報の値は送らない</span></div>'
    '<div class="bx"><h4>' + ic("building") + 'Kaname（所在：日本）</h4><ul><li>会社モデル・台帳・タスク・証跡</li><li>資格情報は暗号化して預かる（値は AI に渡さない）</li><li>学習には使わない</li></ul></div>'
    '<div class="ar">' + ic("right") + '<span>仕事に必要な分だけ</span><span class="no">資格情報・画面は送らない</span></div>'
    '<div class="bx"><h4>' + ic("ai") + 'AI モデル（本人のサブスク）</h4><ul><li>段階 1 は Bridge 経由だけ</li><li>運営の API・BYOK は段階 2 以降</li><li>ローカル LLM は将来</li></ul></div></div>') +
  card(head("送るもの・送らないもの") + '<div class="t-wrap"><table class="dm"><thead><tr><th>データ</th><th>Kaname のサーバーへ</th><th>AI モデルへ</th><th>根拠</th></tr></thead><tbody>'
    + "".join(f'<tr><td>{a}</td><td class="{b[0]}">{b[1]}</td><td class="{c[0]}">{c[1]}</td><td class="muted" style="font-size:12px">{d}</td></tr>' for a, b, c, d in [
      ("台帳の中身",("y","送る（あなたが選んだ所在）"),("p","仕事に必要な分だけ"),"承認・タスク・目標の集計に要る"),
      ("資格情報",("p","暗号化して預かる"),("n","送らない"),"AI には預かり先の番号だけ"),
      ("ブラウザの画面",("n","送らない"),("n","送らない"),"Bridge があなたの PC の中で読む"),
      ("会話（自分のAI）",("y","送る"),("y","送る"),"記憶に落とすため。学習には使わない"),
      ("証跡（誰が・いつ・何を）",("y","送る"),("n","送らない"),"管理者が書き出せる"),
      ("持ち出し（エクスポート）",("y","いつでも"),("n","—"),"囲い込まない。出せるから入れてもらえる")]) + '</tbody></table></div>'
    '<div class="muted" style="font-size:12px;margin-top:10px">学習には使わせません。データの所在（リージョン）はあなたが選びます。退会時の残留物はゼロです（30 日で完全消去）。</div>' +
    clone_box("高本AI","情シスから「何を送っているか」と聞かれたら、このページをそのまま渡してください。全操作の証跡も管理者が書き出せます。")))
SECURITY_BRIEF = ("security-brief", [("n","一覧","情シス・コンプラが必ず聞くこと。Bridge の権限を完全列挙。",_sb)], SB_CSS, False, {"できること":"5","できないこと":"5","送るもの/送らないもの":"","証跡":""})

_ex = grid([
  card(head("持ち出す") + field("何を", '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<label style="display:flex;gap:8px"><input type="checkbox" checked style="accent-color:#22345C">{t}</label>' for t in ["会社モデル（目標・台帳の定義・担当業務・組織・ルール・記憶）","台帳のデータ（案件 6 · 請求 5 · 問い合わせ 10）","添付ファイル（14 · 22 MB）","証跡（31件）","高本AIとの会話"]) + '</div>') +
    field("形式", '<select class="inp"><option>JSON（会社モデルはそのまま別の Kaname に読める）</option><option>CSV（台帳だけ）</option><option>まとめて ZIP</option></select>') +
    btn("書き出す","p","download") + '<div class="muted" style="font-size:12px;margin-top:12px">あえて許しています。囲い込みません。書き出したファイルはサーバーに残りません。</div>'),
  card(head("書き出しの履歴") + table([("日付",""),"何を","誰が"], [[("9/1","n"),"台帳（CSV）","高本"],[("8/1","n"),"まとめて ZIP","高本"]])),
], "g2")
EXPORT = ("export", [("n","持ち出す","エクスポートはあえて許す。ポータビリティ。",_ex)], "", False, {"会社モデル":"","台帳":"3","まとめて":""})


_ac_dep = ('<div data-sec="0">' + card(head("退会すると何が起きるか", btn("持ち出す（先に）","p","download","v1-export.html"), "全 39 種類。消えるものは 30 日の猶予のあとに完全に消えます。即失効するもの（接続・鍵・招待）は猶予なし") + leave_table("company")) + '</div>' +
  '<div data-sec="1"><div class="grid g2">' + card(head("退会の前に済ませること", sub="自分のAIが確かめました") + '<div style="display:flex;flex-direction:column;gap:8px">' + "".join(
    f'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md);font-size:13px"><input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C;margin-top:3px"><div><b>{a}</b><div class="muted" style="font-size:12px;margin-top:2px">{b}</div></div></label>'
    for a, b, c in [("会社モデル・台帳・証跡を書き出した","9/1 の書き出しのあと 31 件のレコードが増えています。もう一度書き出してください",False),("承認待ち 3 件を片づけた","破棄されます（外に出ません）。京蟻の請求書は送ってから退会するなら先に承認",False),
                    ("動いている自動実行 3 本を止めた","退会と同時に止まります。発注ナビの取り込みが途中なら台帳に半端が残ります",True),("メンバー 3 人に伝えた","退会と同時に全員が無効になります。佐藤さんの託されたAI社員も止まります",False),
                    ("資格情報を他で使う予定が無い","即消去・復元不能。freee の連携は freee 側でも解除してください",True)]) + '</div>') +
  clone_box("高本AI","退会すると私も消えます。「使わない期間があるだけ」なら休止（料金なし・自動実行だけ止める）があります。退会するなら、先に書き出しをもう一度。31 件分が 9/1 の書き出しに入っていません。", btn("休止にする","o","pause") + btn("もう一度書き出す","o","download","v1-export.html")) + '</div></div>')
_ac = ('<div data-sec="0 1 2">' + grid([
  card(head("退会する", pill("取り消せません","da","warn")) +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin:4px 0 8px">即時に起きること</div><div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:16px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("ban")}{x}</div>' for x in ["全端末のセッションと Bridge の接続を切る","資格情報を消す（復元不能）","招待・共有リンク・通知を止める","AI社員・自動実行を止める。承認待ちは破棄（外に出ない）","メンバー全員を無効にして通知する"]) + '</div>' +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin:4px 0 8px">30 日後に起きること</div><div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:16px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("trash")}{x}</div>' for x in ["会社モデル・台帳・添付・会話・記憶・証跡を完全に消す（それまではログインで復元できる）","運営が消去の証明を出す（運営は中身を見ない）"]) + '</div>' +
    '<div style="font-size:12px;font-weight:600;color:var(--on-sv);margin:4px 0 8px">残るもの</div><div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:16px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center">{ic("file")}{x}</div>' for x in ["請求の記録（法令で 7 年・運営が別保管）","あなたが書き出したファイル（あなたの手元）","運営配布のAI社員・テンプレの定義（運営のもの。あなたの設定は消える）"]) + '</div>' +
    field("確認のため会社名を入力", inp("","株式会社ENGINE BASE")) +
    '<div class="acts">' + btn("退会する","d","trash") + btn("休止にする","o","pause") + btn("やめる","g") + '</div>'),
  card(head("退会のあとの 30 日") + table(["日","起きること"], [["0 日","即時失効（上の 5 つ）。運営には「退会予定」と見える"],["1〜30 日","ログインすれば復元できる。データは読めない状態で保管"],["30 日","完全消去。運営が消去の証明を作る"],["7 年","請求の記録だけ運営が法令で保管"]]) +
    note("依存の確認（上の帯）に戻って、承認待ち・自動実行・メンバーへの伝達を先に済ませてください。", "warn")),
], "g21") + '</div>')
_ac_done = card(f'<div style="text-align:center;padding:36px 20px"><div style="width:60px;height:60px;border-radius:var(--r-full);background:var(--sv);display:grid;place-items:center;margin:0 auto 18px;color:var(--on-sv)">{ic("check")}</div>'
  '<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">退会しました</h2><p class="muted" style="max-width:560px;margin:0 auto;line-height:1.85">全端末のセッション・Bridge の接続・資格情報・招待・通知を無効にし、AI社員と自動実行を止めました。メンバー 3 人に通知しました。データは 30 日後に完全に消えます。それまでに戻る場合は、ログインすれば復元できます。消去の証明は 10/15 にメールで届きます。</p></div>')
_ac_pause = ('<div data-sec="0 1 2">' + card(head("休止する（退会しない）", pill("料金なし","su"), "使わない期間があるだけなら。AI社員と自動実行だけ止まり、データと設定は全部残る") + leave_table("suspend") +
    '<div class="acts">' + btn("休止する","p","pause") + btn("やめる","g") + '</div>' + '<div class="muted" style="font-size:12px;margin-top:10px">再開はログインして「再開する」を押すだけ。運営には休止として見える。未収が 30 日を超えたときも運営がこの状態にする。</div>') + '</div>')
ACCOUNT_CLOSE = ("account-close", [("d","依存の確認","全オブジェクトで何が起きるかを見てから。",_ac_dep),("p","休止","止めるだけ。データは残る。",_ac_pause),("n","退会","口座状態の波及：セッション・トークン・接続・鍵を全部無効化（G-14）。",_ac),("x","退会した","",_ac_done)],
  LEAVE_CSS, False, {"依存の確認":"39","持ち出す":"!31","退会":""})

SCREENS = [SECURITY_BRIEF, EXPORT, ACCOUNT_CLOSE]

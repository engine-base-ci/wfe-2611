# -*- coding: utf-8 -*-
"""P8 運営（R6）：ops-home / ops-catalog / ops-support（D-073・D-027・D-037・D-030）
 顧客のデータは見ない。見るのは構成（プラン・体数・版）と失敗の型だけ。"""
from _icons import ic
from _parts import *

OPS_CSS = """
.ost{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px;margin-bottom:14px}
.ost>div{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:10px 12px;border-left:4px solid var(--hc)}
.ost b{display:block;font-size:22px;font-variant-numeric:tabular-nums;line-height:1.1}.ost small{color:var(--on-sv);font-size:11.5px}
.plan{display:inline-flex;font-size:11px;font-weight:700;padding:2px 8px;border-radius:var(--r-full)}
.plan.e{background:var(--sv);color:var(--on-sv)}.plan.s{background:#DBEAFE;color:#1E3A8A}.plan.p{background:#E9E0F5;color:#6D4AA6}
.dotst{display:inline-flex;gap:6px;align-items:center;font-size:12.5px}.dotst i{width:8px;height:8px;border-radius:50%;display:inline-block;background:var(--st-success)}.dotst i.wa{background:var(--st-warning)}.dotst i.da{background:var(--st-danger)}.dotst i.ne{background:var(--on-sv)}
.cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:12px}
.ci{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:12px 14px}
.ci .h{display:flex;gap:9px;align-items:center;margin-bottom:8px}.ci .h .av{width:30px;height:30px;border-radius:8px;background:var(--tertiary-c);color:var(--on-tertiary-c);display:grid;place-items:center;flex:none}
.ci .h b{display:block}.ci .h small{display:block;color:var(--on-sv);font-size:11.5px}
.ci .h .ver{margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:var(--r-full);background:var(--sv);color:var(--on-sv);white-space:nowrap}
.ci .pl{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.ci .pl label{display:inline-flex;gap:5px;align-items:center;font-size:12px;padding:4px 9px;border:1px solid var(--line);border-radius:var(--r-full);background:var(--card)}
.ci .pl label input{accent-color:#22345C;margin:0}
.ci .st{display:flex;gap:12px;font-size:12px;color:var(--on-sv);flex-wrap:wrap}
.ci .st b{color:var(--on-surface)}
.ftype{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:12px}
.ft{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);padding:12px 14px;border-top:3px solid var(--fc)}
.ft b{display:block;font-size:13.5px}.ft small{display:block;color:var(--on-sv);font-size:12px;line-height:1.5;margin:4px 0 8px}
.ft .n{font-size:12px;color:var(--on-sv)}.ft .n b{display:inline;font-size:12px}
"""
def _plan(k): return {"e":'<span class="plan e">エントリー</span>',"s":'<span class="plan s">スタンダード</span>',"p":'<span class="plan p">プロ</span>'}[k]
def _dot(k, t): return f'<span class="dotst"><i class="{k}"></i>{t}</span>'
COMPANIES = [
 ("ENGINE BASE","p",4,3,("","稼働中"),"—","9/15 09:12"),("ミナト建装","s",3,2,("wa","AI が止まっている"),"覚えた操作が壊れた（発注ナビ）","9/14 18:03"),
 ("ハヤシ工房（個人）","e",1,2,("","稼働中"),"—","9/15 07:40"),("北村会計事務所","s",6,3,("da","承認が滞留"),"承認待ち 12 件が 3 日","9/12 11:20"),
 ("スミレ食品","p",9,5,("","稼働中"),"—","9/15 08:55"),("Orbit Design（個人）","e",1,1,("ne","PC をつないでいない"),"はじめの設定で止まっている","9/8 14:02"),
 ("ヤマネ物流","s",4,3,("wa","AI が止まっている"),"PC が 5 日閉じたまま","9/10 17:30"),
]
_ost = '<div class="ost">' + "".join(f'<div style="--hc:{c}"><b>{n}</b><small>{l}</small></div>' for l, n, c in [("会社",38,"var(--primary)"),("稼働中",31,"var(--st-success)"),("詰まっている",4,"var(--st-danger)"),("今月の新規",6,"var(--d-plum)"),("AI社員の合計",97,"var(--tertiary)")]) + '</div>'
_oh = (_ost + card(head("会社の一覧", btn("会社を招く","p","plus"), "中身（台帳・会話・記憶）は見えない。見えるのは構成と状態だけ") +
  table(["会社","プラン",("人","r"),("AI社員","r"),"状態","詰まりの型","最終ログイン",""], [
    [f'<b>{n}</b>', _plan(p), (str(h),"n"), (str(a),"n"), _dot(*st), (f'<span style="color:var(--st-danger)">{d}</span>' if d != "—" else '<span class="muted">—</span>'), (last,"n"), btn("詰まりを開く","o","lifebuoy","v1-ops-support.html") if d != "—" else btn("構成","g","building")]
    for n, p, h, a, st, d, last in COMPANIES])))
_oh_stuck = card(head("詰まっている会社", sub="失敗の型で並べる。型ごとに対処がある") + table(["会社","型","いつから","対処",""], [
  ["ミナト建装",pill("覚えた操作が壊れた","wa"),"9/14 18:03","覚え直しの案内（画面が変わったとき）",btn("送る","p","send","v1-ops-support.html")],
  ["北村会計事務所",pill("承認が滞留","da"),"9/12","承認の人を増やす／CS の一次返信だけ自動に",btn("送る","p","send","v1-ops-support.html")],
  ["ヤマネ物流",pill("PC が閉じたまま","wa"),"9/10","Bridge の常駐の案内",btn("送る","p","send","v1-ops-support.html")],
  ["Orbit Design",pill("はじめの設定で止まっている","ne"),"9/8","PC をつなぐ手順の案内",btn("送る","p","send","v1-ops-support.html")]]))
_oh_plan = card(head("プラン", sub="上限と配布内容。プランを変えると配布物の「使う／使わない」が変わる") + table(["プラン",("会社","r"),"AI社員の上限","担当業務の上限","自律実行","層","配布するもの"], [
  [_plan("e"),("14","n"),"2 体","6","1 日 20 回","個人だけ（会社の層なし）","営業社員・経理社員"],
  [_plan("s"),("18","n"),"5 体","20","1 日 100 回","会社 ＋ 個人","＋ CS社員・請求テンプレ"],
  [_plan("p"),("6","n"),"15 体","無制限","1 日 500 回","会社 ＋ 会社が決めた層 ＋ 個人","＋ 承認フロー・監査の書き出し"]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">プランは運営が決める。会社の中の制限（誰が作れるか・承認が要るか）は会社の権限者が決める。</div>')
OPS_HOME = ("ops-home", [("n","会社の一覧","",_oh),("s","詰まっている","失敗の型で並べる。",_oh_stuck),("p","プラン","",_oh_plan)], OPS_CSS, False, {"会社の一覧":"38","詰まっている":"!4","プラン":"3"})

# ---------------------------------------------------------- ops-catalog
def _ci(name, sub, ver, plans, stats, kind="ai"):
    pl = "".join(f'<label><input type="checkbox" {"checked" if on else ""}>{p}</label>' for p, on in [("エントリー", "e" in plans), ("スタンダード", "s" in plans), ("プロ", "p" in plans)])
    return (f'<div class="ci"><div class="h"><span class="av">{ic("ai" if kind == "ai" else kind)}</span><div><b>{name}</b><small>{sub}</small></div><span class="ver">{ver}</span></div>'
            f'<div class="pl">{pl}</div><div class="st">' + "".join(f'<span>{k} <b>{v}</b></span>' for k, v in stats) + '</div>'
            '<div class="acts" style="margin-top:10px">' + btn("版を出す","o","upload") + btn("中身","g","eye") + '</div></div>')
_oc_ai = card(head("運営配布のAI社員", btn("作る","p","plus"), "既定 ON。会社ごとに OFF にできる。定義は運営だけが直す（会社はコピーして自社版に）") + '<div class="cat">' +
  _ci("営業社員","新着案件の取り込み・アプローチ文の下書き","第 6 版 · 9/10", "esp", [("使っている会社","31"),("止まっている","2"),("担当業務","4")]) +
  _ci("経理社員","請求書の作成・入金の照合（freee／マネフォ正規連携）","第 4 版 · 9/1", "esp", [("使っている会社","29"),("止まっている","0"),("担当業務","6")]) +
  _ci("CS社員","問い合わせの一次返信・近況メール","第 2 版 · 8/20", "sp", [("使っている会社","12"),("止まっている","0"),("担当業務","3")]) +
  _ci("事務社員","日報のまとめ・名刺のデータ化","第 1 版 · 9/12（新）", "p", [("使っている会社","3"),("止まっている","0"),("担当業務","2")]) + '</div>')
_oc_duty = card(head("運営配布の担当業務", btn("作る","p","plus"), "AI社員にぶら下がる。会社は「使う／使わない」だけ。コピーすれば自社版として直せる") + table(["担当業務","AI社員","版","配布",("使っている会社","r"),""], [
  ["発注ナビの新着を台帳に入れる","営業社員","第 3 版",_plan("e")+" "+_plan("s")+" "+_plan("p"),("31","n"),btn("版を出す","o","upload")],
  ["納品済み案件の請求書を作る","経理社員","第 2 版",_plan("e")+" "+_plan("s")+" "+_plan("p"),("29","n"),btn("版を出す","o","upload")],
  ["入金を照合して台帳に書く","経理社員","第 2 版",_plan("s")+" "+_plan("p"),("18","n"),btn("版を出す","o","upload")],
  ["問い合わせに一次返信する","CS社員","第 1 版",_plan("s")+" "+_plan("p"),("12","n"),btn("版を出す","o","upload")]]))
_oc_rule = card(head("運営ルール", sub="全社共通。誰も上書きできない。変えると全社に効くので版と理由を残す") + table(["ルール","理由","版",""], [
  ["CAPTCHA は突破しない","顧客のアカウント凍結を防ぐ","第 1 版",pill("固定","ne","lock")],["銀行はブラウザで触らない","会計ソフトの正規連携のみ","第 1 版",pill("固定","ne","lock")],
  ["規約で自動操作を禁じるサービスは操作しない","サービス台帳で判定","第 2 版（9/1 に 3 サービス追加）",btn("台帳","g","ledger")],["資格情報を AI に渡さない","預かり先の番号だけ","第 1 版",pill("固定","ne","lock")],
  ["外に出るものは承認を挟む","メール・請求書・投稿・外部更新","第 1 版",pill("固定","ne","lock")]]) +
  note("運営ルールは会社の画面では鍵つきで出ます（ルールの画面 · 運営の札）。", "info"))
_oc_tpl = card(head("運営配布のテンプレ", btn("作る","p","plus"), "出力の書式。会社はコピーして自社版に") + table(["テンプレ","用途","版","配布",""], [
  ["請求書（税込・内訳あり）","経理社員の下書き","第 3 版",_plan("e")+" "+_plan("s")+" "+_plan("p"),btn("版を出す","o","upload")],
  ["アプローチ文（3 段落・実績 1 つ）","営業社員の下書き","第 2 版",_plan("s")+" "+_plan("p"),btn("版を出す","o","upload")],
  ["受託開発（一人社長）の会社モデル","はじめの設定のたたき台","第 4 版",_plan("e")+" "+_plan("s")+" "+_plan("p"),btn("版を出す","o","upload")]]) +
  note("他社が作ったものは自動では共有しない。会社が明示的に「公開する」と決めたものだけ、匿名化と運営の審査を通してここに入る。", "info"))
_oc_skill = card(head("目標スキル", btn("作る","p","plus"), "目標の設計・工程・数値・FB の型（運営の資産）。Kaname は器で、中身はここで配る") + table(["スキル","業種","何を決めるか","版","配布",("使っている会社","r"),""], [
  ["営業目標（受託開発）","受託開発","件数・単価・工程（引合→提案→受注）・FB の観点","第 3 版",_plan("s")+" "+_plan("p"),("14","n"),btn("版を出す","o","upload")],
  ["営業目標（飲食）","飲食","来店・客単価・リピート・工程","第 1 版",_plan("p"),("3","n"),btn("版を出す","o","upload")],
  ["納期遵守（制作）","制作","納期・手戻り・レビュー指摘","第 2 版",_plan("s")+" "+_plan("p"),("9","n"),btn("版を出す","o","upload")]]) +
  note("顧客側は目標の画面に「どのスキルで組んだか」が出る。スキルを直しても、会社の目標は版を上げるまで変わらない。", "info"))
_oc_plan = card(head("プランの定義", btn("版を出す","o","upload"), "第 3 版 · 9/1。価格と上限。変えると各社の「使った量」の上限が変わる") + table(["プラン",("月額","r"),"AI社員","担当業務","自律実行／日","人","層","配るもの"], [
    [_plan("e"),("30,000","n"),"2","6","20","1","会社の層なし","営業社員・経理社員"],[_plan("s"),("80,000","n"),"5","20","100","5","会社＋個人","＋ CS社員・請求テンプレ"],[_plan("p"),("150,000","n"),"15","無制限","500","15","会社が決めた層","＋ 承認フロー・監査の書き出し・目標スキル"]]) +
  note("プランは運営が決める。会社の中の制限（誰が作れるか・承認が要るか）は会社の権限者が決める。", "info"))
OPS_CATALOG = ("ops-catalog", [("n","AI社員","",_oc_ai),("d","担当業務","",_oc_duty),("r","ルール","誰も上書きできない。",_oc_rule),("t","テンプレ","",_oc_tpl),("g","目標スキル","運営の資産。目標の設計の型。",_oc_skill),("p","プランの定義","マスタ。価格・上限・配るもの。",_oc_plan)], OPS_CSS, False, {"AI社員":"4","担当業務":"4","ルール":"5","テンプレ":"3","目標スキル":"3","プランの定義":"3"})

# ---------------------------------------------------------- ops-support
_os_inbox = card(head("受信箱", sub="問い合わせと詰まり。未返答から") + table(["会社","何","種類","いつ","担当","状態",""], [
    ["ミナト建装","発注ナビの取り込みが止まっている",pill("問い合わせ","wa"),("9/14 18:20","n"),"田村",pill("返答済み · 未解決","wa"),btn("会社の詳細で返答","o","eye","v1-ops-tenant.html")],
    ["北村会計事務所","承認が滞留（詰まりの型）",pill("詰まり","da"),("9/12","n"),"—",pill("未返答","da"),btn("会社の詳細で対処","p","eye","v1-ops-tenant.html")],
    ["スミレ食品","請求書の宛名を変えたい",pill("問い合わせ","ne"),("9/10","n"),"田村",pill("解決","su"),""],
    ["ヤマネ物流","PC が閉じたまま（詰まりの型）",pill("詰まり","wa"),("9/10","n"),"田村",pill("案内済み","ne"),""]]) +
    '<div class="muted" style="font-size:12px;margin-top:10px">返答は会社の「問い合わせ」に届き、両方の証跡に残る。データはサポートアクセスの許可が無ければ見ない。</div>')
_os = _os_inbox + '<div style="height:14px"></div>' + grid([
  card(head("詰まっている会社", sub="データを見ずに分かる範囲。会社を選ぶと右に対処") + table(["会社","型","いつから","構成"], [
    ["<b>ミナト建装</b>",pill("覚えた操作が壊れた","wa"),"9/14 18:03","スタンダード · 営業社員 第 6 版 · 発注ナビ"],
    ["北村会計事務所",pill("承認が滞留","da"),"9/12","スタンダード · 承認者 1 人 · 承認待ち 12"],
    ["ヤマネ物流",pill("PC が閉じたまま","wa"),"9/10","スタンダード · Bridge 5 日未接続"],
    ["Orbit Design",pill("はじめの設定で止まっている","ne"),"9/8","エントリー · PS0（PC 未接続）"]]) +
    head("失敗の型", sub="よくある詰まりと、型ごとの対処") + '<div class="ftype">' + "".join(
      f'<div class="ft" style="--fc:{c}"><b>{t}</b><small>{d}</small><span class="n">今月 <b>{n}</b> 社 · 対処：{a}</span></div>' for t, d, n, a, c in [
        ("覚えた操作が壊れた","外部サービスの画面が変わった。AI が止まり、覚え直し待ち",5,"覚え直しの案内（自動で画面を見て直す）","var(--st-warning)"),
        ("承認が滞留","承認できる人が 1 人で、外向きのものが溜まる",3,"承認者を足す／一次返信だけ自動に","var(--st-danger)"),
        ("PC が閉じたまま","Bridge が動いていない。溜まった分は起きたときに片づく",6,"常駐の案内・スマホ通知","var(--st-warning)"),
        ("はじめの設定で止まっている","PC をつなぐ前に離脱",4,"つなぐ手順を短く案内","var(--on-sv)")]) + '</div>'),
  card(head("対処を送る", sub="ミナト建装 · 覚えた操作が壊れた") +
    field("型", '<select class="inp"><option>覚えた操作が壊れた（発注ナビ）</option><option>承認が滞留</option><option>PC が閉じたまま</option></select>') +
    field("送る文面（型のテンプレ）", '<textarea class="inp" rows="6">発注ナビの画面が変わり、営業社員が「新着案件の取り込み」の手順 3 で止まっています。\n「覚え直させる」の画面で「AI に覚え直させる」を押すと、画面を見て手順を作り直し、テストモードで 1 回動かして見せます。\n（この案内は構成だけを見て送っています。台帳や会話の中身は見ていません）</textarea>') +
    field("送り先", inp("ミナト建装 · 代表（メール＋アプリ内）")) +
    '<div class="acts">' + btn("対処を送る","p","send") + btn("運営ルールを見直す","g","policy","v1-ops-catalog.html") + '</div>' +
    note("送った対処は運営側の証跡に残る。会社の証跡にも「運営から案内」として残る。", "info")),
], "g21")
OPS_SUPPORT = ("ops-support", [("n","受信箱","問い合わせと詰まりを同じ場所で。データは見ない。",_os)], OPS_CSS, False, {"受信箱":"!2","失敗の型":"4","返答と対処":""})

# ---------------------------------------------------------- ops-tenant（1 社。中身は見ない）
_ot_head = ('<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><div><div class="muted" style="font-size:12px">会社</div><h2 style="font-size:20px;font-weight:700;margin:0">ミナト建装</h2></div>'
            + _plan("s") + _dot("wa","AI が止まっている") + '<span class="muted" style="font-size:12.5px">契約 2026/6/1 · 3 人 · AI社員 2 体 · 最終ログイン 9/14 18:03</span><span style="margin-left:auto">' + btn("返答する","p","send") + '</span></div>')
_ot_bill = card(head("請求と入金", btn("入金を記録する","p","check"), "この会社だけ。スタンダード 80,000 円／月 · 請求書払い") + table(["月",("請求","r"),"入金","状態",""], [
    ["2026/9",("80,000","n"),"—",pill("未収 · 15 日超","da"),btn("連絡した記録を残す","o","chat")],["2026/8",("80,000","n"),"8/28",pill("入金済み","su"),""],["2026/7",("53,333","n"),"7/30",pill("入金済み · 日割り","su"),""]]) +
    '<div class="grid g2" style="margin-top:14px">' + card(head("利用量と上限", sub="スタンダードの上限") + table(["もの","今","上限"], [["AI社員","5","5"],["担当業務","19","20"],["自律実行（今日）","70","100"],["人","3","5"]])) +
    card(head("プラン変更の申請") + table(["いつ","何を","状態",""], [[("9/13","n"),"スタンダード → プロ",pill("申請中","wa"),btn("承認する","p","check")+" "+btn("却下","g","x")]]) +
      note("未収が 30 日を超えたら休止の案内をこの会社のお知らせから出す。休止中はデータは残り、AI社員と自動実行だけ止まる。", "info")) + '</div>')
_ot_inq = card(head("問い合わせ", sub="この会社とのやりとり。返答は会社側の問い合わせと両方の証跡に残る") + table(["いつ","何","担当","状態",""], [
    [("9/14 18:20","n"),"発注ナビの取り込みが止まっている（高本AIが先に答えた）","田村",pill("返答済み · 未解決","wa"),btn("返答する","p","send")],[("9/10","n"),"請求書の宛名を変えたい","田村",pill("解決","su"),btn("開く","g","eye")],[("8/2","n"),"承認が滞留（詰まりの型）","田村",pill("直った","su"),btn("開く","g","eye")]]) +
    '<div style="height:12px"></div>' + field("返答（発注ナビの取り込みが止まっている）", '<textarea class="inp" rows="3">発注ナビの絞り込みが「検索条件」パネルに移動しています。覚え直させるの画面で「AI に覚え直させる」を押してください。</textarea>') + '<div class="acts">' + btn("返答を送る","p","send") + btn("定型の対処を差し込む","g","policy") + '</div>')
_ot_dist = card(head("配布したもの", sub="この会社が使っている運営配布物と版。プラン（スタンダード）で出し分け。会社ごとの上書きはここで分かる") + table(["配布物","種類","運営の版","この会社","上書き",""], [
    ["営業社員",pill("AI社員","ne"),"第 6 版","第 6 版 · 止まっている","個人ルール 2 件",btn("版を送る","o","upload")],["経理社員",pill("AI社員","ne"),"第 4 版","第 4 版","—",""],["CS社員",pill("AI社員","ne"),"第 2 版","使わない",pill("会社が外した","ne"),""],
    ["請求書（税込・内訳）",pill("テンプレ","ne"),"第 3 版","第 2 版",pill("1 版遅れ","wa"),btn("版を送る","o","upload")],["営業目標（受託開発）",pill("目標スキル","ne"),"第 3 版","第 3 版","—",""],["安全ルール 5 本",pill("ルール","ne"),"第 2 版","第 2 版（上書き不可）","—",""]]) +
    '<div class="muted" style="font-size:12px;margin-top:10px">マスタ（定義そのもの）を直すのは「配るもの」。ここは 1 社への配布と版の状態。</div>')
_ot_rev = card(head("審査", sub="この会社が明示的に公開したもの。匿名化を確かめて承認・却下する") + table(["出したもの","種類","匿名化",("出した日","r"),""], [
    ["建設業の見積テンプレ（人工計算つき）",pill("テンプレ","ne"),pill("金額の例が 1 か所残る","wa"),("9/12","n"),btn("承認して公開する","p","check")+" "+btn("置き換えを依頼","o","undo")+" "+btn("却下","g","x")],["現場写真の整理手順",pill("担当業務","ne"),pill("公開済み","su"),("8/20","n"),""]]) +
    note("公開すると出どころは「建設業の会社」と表示され、会社名は出ない。", "info"))
_ot_aud = card(head("証跡とサポートアクセス", btn("書き出す","o","download"), "運営がこの会社にしたこと。会社側の証跡にも同じ行が出る") + table(["いつ","運営の誰が","何を","根拠"], [
    [("9/14 18:45","n"),"田村","対処を送った（覚え直しの案内）","問い合わせ 9/14"],[("9/14 18:41","n"),"田村","覚えた操作の手順 3 を閲覧","サポートアクセス 9/14〜9/17"],[("9/1","n"),"高本","入金を記録（8 月分）","請求 2026/8"],[("8/2 10:40","n"),"田村","対処を送った（承認者を足す案内）","詰まりの型：承認が滞留"]]) +
    '<div style="height:12px"></div>' + head("サポートアクセス", sub="会社が許可した範囲と期限") + table(["いつ","範囲","期限","状態"], [[("9/14 18:20","n"),"構成＋覚えた操作の手順","9/17 まで",pill("有効","su")],[("8/2 10:05","n"),"構成＋証跡","24 時間",pill("期限切れ","ne")]]) +
    '<div class="acts">' + btn("許可の範囲で見る","o","eye") + btn("追加の許可を依頼する","g","send") + '</div>')
_ot_ntc = card(head("お知らせ", sub="この会社向け。全体のお知らせと同じ部品で、会社側の「お知らせ」に届く") + table(["いつ","種類","題名","状態"], [[("9/10","n"),pill("個別","ne"),"9 月分の請求書を送付しました",pill("届いた · 既読","su")],[("8/2","n"),pill("個別","ne"),"承認者を足す案内",pill("届いた","su")]]) +
    '<div style="height:12px"></div>' + grid([field("種類", '<select class="inp"><option>個別の案内</option><option>未収の連絡</option><option>休止の案内</option></select>'), field("題名", inp("9 月分の請求が未入金です"))], "g2") +
    field("本文", '<textarea class="inp" rows="3">9/1 に送付した 9 月分の請求書（80,000 円）が未入金です。9/30 までに入金が無い場合は休止（AI社員と自動実行の停止・データは保持）となります。</textarea>') + '<div class="acts">' + btn("この会社に出す","p","send") + btn("下書き","g") + '</div>')
_ot_leave = card(head("退会と猶予", sub="この会社は退会していません。退会したら、ここに猶予と消去の証明が出ます") + table(["段階","状態"], [["退会予定","なし"],["休止","なし（未収 30 日超で運営が休止にできる）"],["猶予（30 日・復元可）","—"],["完全消去","—"],["消去の証明","—（消去の完了時に自動で作り、会社の代表に送る）"],["法令保管（請求の記録 7 年）","2026/6〜 3 件"]]) +
    '<div class="muted" style="font-size:12px;margin-top:10px">退会は会社の代表だけができます。運営は代理で退会させません（代表が連絡できないときは本人確認のうえ手順を案内）。</div>')
_ot = ('<div data-sec="0">' + card(_ot_head + '<div class="grid g2">' +
   '<div>' + head("構成と状態", sub="見えるのは版と数だけ") + table(["もの","状態"], [["会社モデル","第 3 版 · 9/12"],["AI社員","営業社員 第 6 版（止まっている）· 経理社員 第 4 版"],["担当業務","運営配布 5 · 会社作成 2"],["層","会社 › 部署（3）› 個人"],["Bridge","1 台 · 9/14 18:03 まで接続"],["自動実行","毎朝 6:00 / 6:30（止まっている）"],["請求",'<span style="color:var(--st-danger);font-weight:600">未収 80,000 円 · 15 日超</span>'],["問い合わせ","未解決 1"]]) + '</div>' +
   '<div>' + head("見られないもの", sub="設計上、運営には出ない") + '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<div style="display:flex;gap:8px;align-items:center;color:var(--on-sv)">{ic("lock")}{x}</div>' for x in ["台帳の中身・レコード","会話・記憶","承認待ちの本文","資格情報（運営にも復号できない）","証跡の中身（許可があるときだけ）"]) + '</div>' +
   note("この会社は 9/14 に「構成＋覚えた操作の手順」を 3 日だけ許可しています。許可の外は見られません。", "info") + '</div></div>') + '</div>' +
  '<div data-sec="1" hidden>' + _ot_bill + '</div><div data-sec="2" hidden>' + _ot_inq + '</div><div data-sec="3" hidden>' + _ot_dist + '</div><div data-sec="4" hidden>' + _ot_rev + '</div>' +
  '<div data-sec="5" hidden>' + _ot_aud + '</div><div data-sec="6" hidden>' + _ot_ntc + '</div><div data-sec="7" hidden>' + _ot_leave + '</div>')
OPS_TENANT = ("ops-tenant", [("n","ミナト建装","会社ごとの対応は全部ここ（8 面）。横断の一覧は入口。中身は見ない。",_ot)], OPS_CSS, False, {"構成と状態":"!2","請求と入金":"!1","問い合わせ":"1","配布したもの":"6","審査":"1","証跡とサポートアクセス":"4","お知らせ":"2","退会と猶予":"—"})

# ---------------------------------------------------------- ops-review（公開の審査）
_orv = ('<div data-sec="0">' + card(head("審査待ち", sub="会社が明示的に「公開する」と決めたもの。自動では集まらない。横断の入口：承認・却下は会社の詳細の「審査」で行う") + table(["出したもの","会社","種類","匿名化",("出した日","r"),""], [
    ["建設業の見積テンプレ（人工計算つき）","ミナト建装",pill("テンプレ","ne"),pill("確認待ち","wa"),("9/12","n"),btn("会社の詳細で審査","p","eye","v1-ops-tenant.html")],
    ["問い合わせの一次返信（飲食）","スミレ食品",pill("担当業務","ne"),pill("固有名 2 か所","da"),("9/10","n"),btn("審査する","p","eye")]])) + '</div>' +
  '<div data-sec="1" hidden>' + grid([card(head("匿名化の確認", sub="建設業の見積テンプレ · ミナト建装") + '<div style="display:flex;flex-direction:column;gap:8px">' + "".join(
    f'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md);font-size:13px"><input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C;margin-top:3px"><div><b>{a}</b><div class="muted" style="font-size:12px;margin-top:2px">{b}</div></div></label>'
    for a, b, c in [("会社名・人名・住所・電話が無い","機械で 0 件。目視でも 0 件",True),("金額・単価が例に置き換わっている","「1 人工 25,000 円」が残っている → 例の値に置き換えを依頼",False),("顧客名・案件名が無い","0 件",True),("運営ルールに反する手順が無い","外向きの送信は承認を挟む形になっている",True)]) + '</div>' +
    '<div class="acts">' + btn("承認して公開する","p","check") + btn("置き換えを依頼して差し戻す","o","undo") + btn("却下する","g","x") + '</div>'),
    card(head("公開したらどうなるか") + table(["項目","内容"], [["出どころ","「ミナト建装」ではなく「建設業の会社」と表示"],["使う側","運営配布と同じく「使う／使わない」。コピーして自社版にできる"],["版","公開した版で固定。元の会社が直しても自動では更新されない"],["取り下げ","元の会社はいつでも取り下げられる（使っている会社のコピーは残る）"]]))], "g2") + '</div>' +
  '<div data-sec="2" hidden>' + card(head("承認した", sub="公開済み") + table(["もの","出どころ（匿名）","種類",("使っている会社","r"),("公開日","r")], [["受託開発（一人社長）の会社モデル","受託開発の会社",pill("テンプレ","ne"),("14","n"),("7/1","n")],["納品先への近況メール","受託開発の会社",pill("担当業務","ne"),("6","n"),("8/20","n")]])) + '</div>' +
  '<div data-sec="3" hidden>' + card(head("却下した", sub="理由つき。出した会社に返す") + table(["もの","会社","理由",("日","r")], [["顧客リストの取り込み手順","北村会計事務所","顧客の固有名と電話が本文に残っていた（置き換え依頼にも応答なし）",("8/30","n")]])) + '</div>')
OPS_REVIEW = ("ops-review", [("n","公開の審査","自動では共有しない。匿名化＋運営の審査。",_orv)], OPS_CSS, False, {"審査待ち":"!2","匿名化の確認":"","承認した":"2","却下した":"1"})

# ---------------------------------------------------------- ops-audit（運営の証跡・運営メンバー）
_oa = ('<div data-sec="0">' + card(head("運営の証跡", btn("書き出す","o","download"), "運営の誰が・どの会社に・何をしたか。顧客側の証跡にも同じ記録が残る") + table(["いつ","運営の誰が","会社","何を","根拠"], [
    [("9/15 09:10","n"),"田村","ミナト建装","覚えた操作の手順 3 を閲覧","サポートアクセス（9/17 まで）"],[("9/14 18:45","n"),"田村","ミナト建装","対処「覚え直しの案内」を送付","詰まりの型"],
    [("9/12 11:00","n"),"高本","全社","運営ルール 第 2 版（サービス台帳に 3 サービス追加）","運営ルールの版"],[("9/10 15:20","n"),"田村","スミレ食品","公開申請の匿名化を確認（差し戻し）","公開の審査"],
    [("9/1 09:00","n"),"高本","全社","経理社員 第 4 版を配布（全プラン）","配るもの"],[("8/31 10:00","n"),"自動","Orbit Design","退会後 30 日の完全消去・消去の証明を送付","退会"]])) + '</div>' +
  '<div data-sec="1" hidden>' + card(head("運営メンバー", btn("招く","p","plus"), "運営側の権限。顧客のデータを見る権限は誰にも無い（許可があるときだけ・証跡つき）") + table(["名前","役割","できること","状態",""], [
    ["高本",pill("運営の代表","ne"),"配布物の版・運営ルール・公開の審査・プラン・運営メンバー",pill("有効","su"),""],["田村",pill("サポート","ne"),"詰まりの対処・許可の範囲での閲覧・公開の審査",pill("有効","su"),btn("権限","o","user")],
    ["（招待中）sato-ops@example.com",pill("サポート","ne"),"—",pill("未承諾","wa"),btn("取り消す","g","x")]]) +
   note("運営メンバーが抜けるときも同じ依存の表（§74）で処理し、セッションは即失効します。", "info")) + '</div>')
OPS_AUDIT = ("ops-audit", [("n","運営の証跡","運営がしたことは全部残る。",_oa)], OPS_CSS, False, {"運営の証跡":"6","運営メンバー":"2"})

# ---------------------------------------------------------- ops-notices（お知らせと稼働状況を出す）
_on = ('<div data-sec="0">' + card(head("お知らせを出す") + grid([field("種類", '<select class="inp"><option>リリース</option><option>障害</option><option>メンテ</option><option>ルールの版</option></select>'),
  field("対象", '<select class="inp"><option>全プラン</option><option>スタンダード以上</option><option>プロだけ</option><option>特定の会社</option></select>')], "g2") +
  field("題名", inp("9/20（土）02:00〜04:00 メンテ")) + field("本文", '<textarea class="inp" rows="4">この間 Bridge は待機し、溜まった分は再開後に順に片づけます。承認待ちは失われません。</textarea>') +
  grid([field("公開", '<select class="inp"><option>今すぐ</option><option>予約（日時）</option></select>'), field("通知", '<select class="inp"><option>アプリ内＋メール（各社の設定に従う）</option><option>アプリ内だけ</option></select>')], "g2") +
  '<div class="acts">' + btn("出す","p","send") + btn("下書き","g") + '</div>') + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("出したもの", sub="公開済み・予約") + table(["いつ","種類","題名","対象",("届いた会社","r"),"状態"], [
    [("9/15 09:00","n"),pill("リリース","su"),"目標に「逆算の案」が付きました","全プラン",("38","n"),pill("公開","su")],[("9/14 19:10","n"),pill("障害","da"),"9/14 18:00〜18:40 承認待ちの表示が遅れました","全プラン",("38","n"),pill("公開","su")],
    [("9/12","n"),pill("メンテ","wa"),"9/20（土）02:00〜04:00 メンテ","全プラン",("38","n"),pill("予約 9/19 10:00 再送","ne")],[("9/12","n"),pill("ルールの版","ne"),"運営ルール 第 2 版","全プラン",("38","n"),pill("公開","su")]])) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("稼働状況を登録する", sub="顧客の「お知らせと通知」の稼働状況に出る") + table(["何","状態","いつから","次"], [
    ["Kaname",_dot("","正常"),"—","—"],["AI の経路（Bridge）",_dot("","正常"),"—","—"],["サーバー経路",_dot("ne","段階2"),"—","—"],["発注ナビ（外部）",_dot("wa","画面が変わった"),"9/14","覚え直しの案内を送付済み"],["freee API",_dot("","正常"),"—","—"]]) +
  '<div class="acts">' + btn("障害を登録する","o","warn") + btn("メンテを登録する","o","clock") + '</div>') + '</div>')
OPS_NOTICES = ("ops-notices", [("n","お知らせ","",_on)], OPS_CSS, False, {"出す":"","出したもの":"4","稼働状況":"!1"})

# ---------------------------------------------------------- ops-billing（請求と入金・利用量・プランの定義）
_ob = ('<div data-sec="0">' + card(head("請求と入金（2026/9）", btn("請求書を一括で出す","p","send"), "38 社 · 請求 3,140,000 円 · 入金 2,860,000 円 · 未収 280,000 円") + table(["会社","プラン",("請求","r"),"入金","状態",""], [
    ["ENGINE BASE",_plan("p"),("150,000","n"),"9/28",pill("入金済み","su"),""],["ミナト建装",_plan("s"),("80,000","n"),"—",pill("未収 · 15 日超","da"),btn("会社の詳細で対応","o","eye","v1-ops-tenant.html")],["ハヤシ工房",_plan("e"),("30,000","n"),"9/25",pill("入金済み","su"),""],
    ["北村会計事務所",_plan("s"),("80,000","n"),"—",pill("未収 · 3 日","wa"),btn("会社の詳細で対応","o","eye","v1-ops-tenant.html")],["スミレ食品",_plan("p"),("150,000","n"),"9/26",pill("入金済み","su"),""],["Orbit Design",_plan("e"),("15,000","n"),"—",pill("退会 · 日割り","ne"),""]])) + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("未収", sub="対処の順") + table(["会社",("金額","r"),"期日から","対処","次"], [["ミナト建装",("80,000","n"),"15 日","メールで連絡済み（9/10）",btn("電話の記録を残す","o","chat")],["北村会計事務所",("80,000","n"),"3 日","—",btn("メールで連絡","o","send")]]) +
  note("未収が 30 日を超えたら休止（停止）の案内。休止中はデータは残り、AI社員と自動実行だけ止まる。", "info")) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("利用量と上限", sub="プランの上限に近い会社") + table(["会社","プラン","AI社員","担当業務","自律実行（今日）","人","近い"], [
    ["ENGINE BASE",_plan("p"),"3 / 15","7 / 無制限","42 / 500","4 / 15",pill("—","ne")],["スミレ食品",_plan("p"),"5 / 15","18 / 無制限","480 / 500","9 / 15",pill("自律実行 96%","wa")],["ミナト建装",_plan("s"),"5 / 5","19 / 20","70 / 100","3 / 5",pill("AI社員 100%","da")]])) + '</div>' +
  '<div data-sec="3"><div style="height:14px"></div>' + card(head("プラン変更", sub="申請と履歴") + table(["会社","いつ","何を","状態",""], [["ミナト建装",("9/13","n"),"スタンダード → プロ",pill("申請中","wa"),btn("会社の詳細で承認","o","eye","v1-ops-tenant.html")],["Orbit Design",("9/1","n"),"エントリー → 退会",pill("済み","ne"),""]])) + '</div>' +
  '')
OPS_BILLING = ("ops-billing", [("n","請求と入金","横断の入口。入金の記録・連絡・承認は会社の詳細で。",_ob)], OPS_CSS, False, {"請求と入金":"38","未収":"!2","利用量と上限":"2","プラン変更":"1"})

# ---------------------------------------------------------- ops-services（サービス台帳）
_osv = ('<div data-sec="0">' + card(head("サービス台帳", btn("サービスを足す","p","plus"), "外部サービスごとの自動操作の可否。全社に効く。第 2 版 · 9/12") + table(["サービス","可否","理由","版",""], [
    ["freee",pill("api · 正規連携のみ","su"),"会計。ブラウザでは触らない","第 1 版",btn("直す","g","pen")],["マネーフォワード",pill("api · 正規連携のみ","su"),"同上","第 1 版",btn("直す","g","pen")],["発注ナビ",pill("allowed · ブラウザ OK","su"),"規約に自動操作の禁止なし（9/1 確認）","第 1 版",btn("直す","g","pen")],
    ["X（旧 Twitter）",pill("api · 投稿は API のみ","su"),"規約：自動投稿は API に限る。閲覧はブラウザ可","第 2 版",btn("直す","g","pen")],["△△クラウド（勤怠）",pill("forbidden · 禁止","da"),"規約で自動操作を禁止（9/12 追加）","第 2 版",btn("直す","g","pen")],["すべての銀行",pill("bank · 触らない","da"),"運営ルール","第 1 版",pill("固定","ne","lock")],["（未登録）",pill("unspecified","ne"),"初回は人へのハンドオフ。会社から申請が来たら判定","—",""]]) +
  note("可否を変えると、その版から全社の AI社員に効きます。禁止に変えたときは、使っている会社に自動でお知らせが出ます。", "info")) + '</div>' +
  '<div data-sec="1"><div style="height:14px"></div>' + card(head("版の履歴") + table(["版","いつ","何を","誰が"], [["第 2 版",("9/12","n"),"△△クラウド・□□予約・◇◇EC を禁止に（規約の改定）","高本"],["第 1 版",("7/1","n"),"初版 6 サービス","高本"]])) + '</div>' +
  '<div data-sec="2"><div style="height:14px"></div>' + card(head("会社からの申請", sub="「このサービスは触れるか」") + table(["会社","サービス","いつ","判定",""], [["スミレ食品","〇〇食材卸の発注サイト",("9/13","n"),pill("未判定","wa"),btn("規約を読んで判定","p","eye")],["ミナト建装","建設業の見積サイト",("9/8","n"),pill("allowed","su"),""]])) + '</div>')
OPS_SERVICES = ("ops-services", [("n","サービス台帳","可否は運営が版で持つ。全社に効く。",_osv)], OPS_CSS, False, {"サービス台帳":"7","版の履歴":"2","会社からの申請":"!1"})

SCREENS = [OPS_HOME, OPS_TENANT, OPS_CATALOG, OPS_REVIEW, OPS_SUPPORT, OPS_AUDIT, OPS_NOTICES, OPS_BILLING, OPS_SERVICES]

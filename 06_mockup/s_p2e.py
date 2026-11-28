# -*- coding: utf-8 -*-
"""P2 毎日：ai-activity（AI社員の動き＝誰が何をしたかの1本の流れ）"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _threepane import TP_CSS, flow_lanes

ACT_CSS = """
.tree-wrap .flow{margin-top:6px;border-top:0;padding-top:0}
.sec-h{margin-top:4px}
.tree{display:flex;flex-direction:column;gap:6px}
.tn{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);font-size:13px}
.tn .who{font-weight:700;min-width:96px}
.tn .what{flex:1;min-width:0}
.tn .meta{font-size:11.5px;color:var(--on-sv);margin-top:2px}
.tn .t{font-size:11.5px;color:var(--on-sv);font-variant-numeric:tabular-nums;white-space:nowrap}
.tn.ai{border-left:3px solid var(--tertiary)}
.tn.st{border-left:3px solid var(--d-teal)}
.tn.me{border-left:3px solid var(--st-warning);background:#FEF6EC}
.tn.bad{border-left:3px solid var(--st-danger);background:#FDF2F2}
.tn.l1{margin-left:22px}.tn.l2{margin-left:44px}
.tn .gate{font-size:11px;font-family:var(--font-code);background:var(--sv);color:var(--on-sv);padding:1px 6px;border-radius:var(--r-full);margin-left:6px}
@media(max-width:767px){.tn.l1{margin-left:10px}.tn.l2{margin-left:20px}.tn .who{min-width:0;width:100%}.tn{flex-wrap:wrap}}
"""

def tn(cls, who, what, meta="", t="", gate=""):
    g = f'<span class="gate">{gate}</span>' if gate else ""
    return (f'<div class="tn {cls}"><span class="who">{who}</span><div class="what">{what}{g}'
            f'{f"<div class=meta>{meta}</div>" if meta else ""}</div><span class="t">{t}</span></div>')

SEIKO = [("09:14","高本AI","配った：着手金の請求書","ok"),("09:14","経理社員","台帳「案件」を読む","ok"),("09:15","経理社員","freee で下書き 990,000円","ok"),
         ("09:15","高本AI","差し戻し：税込を先に","back"),("09:16","経理社員","直した","ok"),("09:16","高本AI","一次確認 OK","ok"),("","あなた","承認待ち","now")]
STUCK = [("07:00","高本AI","配った：新着を台帳に","ok"),("07:00","営業社員","発注ナビにログイン","ok"),("07:02","営業社員","新着一覧で止まった（画面が変わった）","back"),
         ("07:02","高本AI","止めて報告","wait"),("","あなた","覚え直させる","now")]
CS = [("06:58","高本AI","配った：一次返信","ok"),("07:02","CS社員","2 件に返信（Gmail）","ok"),("07:03","高本AI","確認 → 完了（承認不要）","ok")]
ACTORS = {"高本AI":"aiw","あなた":"me"}
def lanes(steps, title="", now_label=""):
    names = []
    for _, who, *_r in steps:
        if who not in names: names.append(who)
    return flow_lanes(steps, [(n, ACTORS.get(n, "st")) for n in names], title=title, now_label=now_label)

def tree_seiko():
    return lanes(SEIKO, title="誰が・いつ・何を", now_label="いま：あなた · 承認待ち")

def tree_seiko_text():
    return ('<div class="tree">' +
      tn("ai","高本AI","配った：セイコー 着手金の請求書（案件・金額・期日を渡す）","あなたの指示「セイコーの着手金、請求書作っておいて」から","09:14") +
      tn("st l1","経理社員","受け取った → 台帳「案件」を読んだ","案件 セイコー · 契約 3,300,000 · 着手金 30%","09:14","") +
      tn("st l1","経理社員","freee で請求書の下書きを作った","正規API · 990,000円（税込）","09:15","") +
      tn("ai l1","高本AI","一次確認 → 差し戻し：税込を先に書く","京蟻のときの差し戻しを記憶から適用","09:15") +
      tn("st l2","経理社員","文面を直した","","09:16") +
      tn("ai l1","高本AI","一次確認 → OK","","09:16") +
      tn("me","あなた","承認待ち","押せば送る· 承認待ちの1件から同じ流れに着く","—") + '</div>')

def tree_stuck():
    return lanes(STUCK, title="誰が・いつ・何を", now_label="いま：あなた · 覚え直させる")

def tree_stuck_text():
    return ('<div class="tree">' +
      tn("ai","高本AI","配った：発注ナビの新着を台帳に入れる","毎朝 7:00 の定期 · スキル：営業目標（受託開発）第 3 版の工程","07:00") +
      tn("st l1","営業社員","発注ナビにログインした","Bridge · 本人のブラウザ","07:00","") +
      tn("bad l1","営業社員","新着一覧を開いた → 画面が変わっていて止まった","覚えた操作「新着案件の取り込み」手順3。CAPTCHAではない","07:02","") +
      tn("ai l1","高本AI","止めた → あなたに報告（申し送り）","覚え直させれば再開できる","07:02") +
      tn("me","あなた","覚え直させる","AI社員に画面を見せて手順を作り直させる","—") + '</div>')

_today = ('<div data-sec="0">' + card(head("今日の動き", sub="高本AIが配った順 · 3体 · 7:00〜") + '<div style="display:flex;flex-direction:column;gap:14px">' +
   f'<div><div class="sec-h"><b>セイコー 着手金の請求書</b><span>{pill("承認待ち","wa","clock")}</span></div>{tree_seiko()}</div>' +
   f'<div><div class="sec-h"><b>発注ナビの新着を台帳に</b><span>{pill("止まっている","da","warn")}</span></div>{tree_stuck()}</div>' +
   f'<div><div class="sec-h"><b>問い合わせ2件に一次返信</b><span>{pill("完了","su","check")}</span></div>' +
   lanes(CS, title="誰が・いつ・何を") + '</div></div>') + '</div>' +
  '<div data-sec="1" hidden>' + card(head("止まっている", sub="差し戻し中・待ち・失敗") + tree_stuck() +
    clone_box("高本AI","営業社員が発注ナビの画面変更で止まっています。<b>覚え直させれば再開</b>できます。他の2体は動いています。", btn("覚え直させる","p","wrench","v1-automation-repair.html")+btn("今日は止めておく","g"))) + '</div>' +
  '<div data-sec="2" hidden>' + card(head("AI社員ごと", sub="1体ずつ自分のセッション（会話履歴）を持つ") + table(["AI社員","今日","状態","最後の動き",""], [
    [f'{ic("ai")} 営業社員',("2 件","n"),pill("止まっている","da"),"07:02 新着一覧で止まった",btn("セッションを見る","o","history")],
    [f'{ic("ai")} 経理社員',("1 件","n"),pill("承認待ち","wa"),"09:16 一次確認 OK",btn("セッションを見る","o","history")],
    [f'{ic("ai")} CS社員',("1 件","n"),pill("完了","su"),"07:03 2件に返信",btn("セッションを見る","o","history")],
  ])) + '</div>' +
  '<div data-sec="3" hidden>' + card(head("対象ごと", sub="案件・請求・目標ごとに") + table(["対象","動き","状態",""], [
    ["案件 セイコー",("3 本","n"),pill("承認待ち","wa"),btn("動きを見る","o","route")],["台帳 案件（新着）",("1 本","n"),pill("止まっている","da"),btn("動きを見る","o","route")],["問い合わせ",("1 本","n"),pill("完了","su"),btn("動きを見る","o","route")]])) + '</div>')

_one = ('<div data-sec="0 1 2 3">' + card(head("セイコー 着手金の請求書", pill("承認待ち","wa","clock"), "1本の流れ。会話のカード・承認待ちの1件からもここに着く") + tree_seiko() +
   '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' + btn("承認待ちで押す","p","inbox","v1-approvals.html") + btn("会話を見る","o","chat","v1-clone-chat.html") + btn("証跡で全部見る","g","log","v1-audit.html") + '</div>') + '</div>')

_today_r3 = ('<div data-sec="0 1 2 3">' + card(head("今日の動き", sub="佐藤AI · あなたに配られた分だけ · 他の人と会社の AI社員の動きは出ない") + '<div class="tree">' +
   tn("ai","田中AI","配った：京蟻 ガチャ演出の実装","制作 › 佐藤","09:00") + tn("st l1","佐藤AI","前回の型で下書き（2.4 秒）","外に出ない作業 · 承認なし","10:02","") +
   tn("me l1","あなた","2.0 秒に直させた","","10:05") + tn("ai l1","佐藤AI","直した → タスクに付けた","","10:06") + '</div>' +
   '<div class="muted" style="font-size:12px;margin-top:10px">会社の動き（承認待ち・他の AI社員）は権限者が見ます。</div>') + '</div>')
AI_ACTIVITY = ("ai-activity", [("n","今日の動き","担当者は自分のAIと自分に配られた分だけ。",'<div data-roles="R1 R2">' + _today + '</div><div data-roles="R3">' + _today_r3 + '</div>'),("one","1本の流れ","会話のカード／承認待ちの1件／ここ の3か所から同じ流れに着く。",_one)],
  ACT_CSS + TP_CSS, False, {"今日の動き":"3","止まっている":"!1","AI社員ごと":"3","対象ごと":"3"})

SCREENS = [AI_ACTIVITY]

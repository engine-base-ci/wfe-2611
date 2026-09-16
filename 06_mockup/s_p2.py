# -*- coding: utf-8 -*-
"""P2 毎日：today / approvals"""
from _icons import ic
from _parts import *

CB = '<input type="checkbox" style="width:18px;height:18px;accent-color:#22345C">'

def clone_box(title, body, buttons=""):
    b = f'<div style="display:flex;gap:9px;margin-top:13px;flex-wrap:wrap">{buttons}</div>' if buttons else ""
    return (f'<div class="ai"><div class="ai-h">{ic("clone")}{title}</div>'
            f'<div style="font-size:14px;line-height:1.85">{body}</div>{b}</div>')

# ============================================================ 今日（D-071・D-072）：三画面。左＝押してほしいもの → 今日やる分 → 夕方、中央＝選んだ 1 件、右＝高本AI（申し送りは会話の最初の 1 通）
from _threepane import TP_CSS, TP_JS, qrow, group, dpane, dkv, dlog, threepane, qhead, vrow, vgroup, ico, due, flow_lanes
from _taskdata import task_queue, TODAY, CAP, EST

TP_TODAY_CSS = ""

# --- 承認待ち（一覧の行と中央の中身）。approvals 画面も同じ 3 件・同じ関数を使う
APPROVALS = [
 dict(id="a1", kind="メール送信", icon="mail", title="セイコー 山田様へ 追いメール", who="営業社員", check="高本AI確認済み · 柔らかい言い回しに直させた", wait="2 時間", late="先方の期限 明後日",
      kv=[("宛先","山田 様 <yamada@seiko-example.co.jp>"),("件名","ご提案の件（食品パッケージ画像編集SaaS）"),("作った人","営業社員"),("経路","Google Workspace（正規API）"),("期限",'<span class="late">先方の検討期限 9/12</span>')],
      body="山田様\n\n先日はお時間をいただきありがとうございました。\nご提案した画像編集SaaSについて、もしお時間があればご検討状況をお聞かせください。\nご不明な点や追加でご説明が必要な点があれば、いつでもお声がけください。\n\n高本",
      note="前回のやり取りで山田様はメールを好まれていたので、電話ではなくメールにしました。文面はあなたの過去の追いメール 3 通の書き方に寄せています。金額や期日には触れていません。",
      primary="承認して送る", log=[("06:20","営業社員","下書き","ok"),("06:31","高本AI","差し戻し：柔らかく","back"),("06:35","営業社員","直した","ok"),("06:36","高本AI","一次確認 OK","ok"),("06:36","あなた","承認待ち","now")]),
 dict(id="a2", kind="請求書送付", icon="card", title="京蟻 請求書 1,826,000円（税込）", who="経理社員", check="差し戻し → 修正 → 確認済み", wait="14 時間", late="",
      kv=[("宛先","株式会社京蟻 御中"),("金額","1,826,000円（内 消費税 166,000円）"),("支払期日","2026-10-31（月末締め翌月末払い）"),("作った人","経理社員"),("経路","freee（正規API）")],
      body="請求書 No. 2026-0912\n\n件名：オンラインガチャ開発 一式\n金額：1,826,000円（税込）\n　内訳：開発費 1,660,000円／消費税 166,000円\n支払期日：2026年10月31日\n振込先：台帳「会社情報」の口座",
      note="税抜のまま出てきたので税込に直させました。期日も契約（月末締め翌月末払い）に合わせて 10/31 にしています。契約書の金額と一致しています。",
      primary="承認して送る", log=[("06:10","経理社員","下書き（税抜）","ok"),("06:12","高本AI","差し戻し：税込に","back"),("06:20","経理社員","直した","ok"),("06:38","高本AI","差し戻し：期日 10/31","back"),("06:40","経理社員","直した","ok"),("06:42","高本AI","一次確認 OK","ok"),("06:42","あなた","承認待ち","now")]),
 dict(id="a3", kind="投稿", icon="send", title="X 週次の実績投稿", who="営業社員", check="数字は台帳と一致", wait="1 日", late="",
      kv=[("投稿先","X（@engine_base）"),("作った人","営業社員"),("数字の出どころ","台帳「今週の成約」「新規リード」"),("経路","X API（正規）")],
      body="今週の ENGINE BASE\n・新規のご相談 12 件\n・ご成約 2 件（食品パッケージ画像編集SaaS／オンラインガチャ）\n来週も Kaname で一人社長の毎日を整えます。",
      note="数字は台帳と一致しています。社名は公開済みの案件だけにしました（セイコー様は未公開なので入れていません）。",
      primary="承認して投稿", log=[("昨日 18:00","営業社員","下書き","ok"),("昨日 18:05","高本AI","一次確認 OK","ok"),("昨日 18:05","あなた","承認待ち","now")]),
]

def approval_row(a, selected=False):
    right = (due(a["late"], True) if a["late"] else due(f'待ち {a["wait"]}')) + f'<span class="act">{ic("check")}{a["primary"].replace("承認して", "")}</span>'
    return vrow(a["id"], a["title"], ico(a["icon"]), [(a["who"], None), ("AI確認済", "ok")], right=right, selected=selected)

def approval_detail(a):
    names = []
    for _, who, *_r in a["log"]:
        if who not in names: names.append(who)
    actors = [(nm, "me" if nm == "あなた" else "aiw" if nm == "高本AI" else "st") for nm in names]
    nowl = next((f'いま：{who} · {what}' for tm, who, what, k in a["log"] if k == "now"), "")
    return (f'<div class="kind">承認待ち · {a["kind"]} · 高本AI確認済み</div><h2>{a["title"]}</h2>{dkv(a["kv"])}'
            f'<div class="mail">{a["body"]}</div><div class="ainote">{a["note"]}</div>'
            f'<div class="acts">{btn(a["primary"],"p","send")}{btn("直してから送る","o","pen")}{btn("止める（AI社員に戻す）","g","undo")}{btn("誰が何をしたか","g","route","v1-ai-activity.html")}<span class="keys"><kbd>a</kbd>承認 <kbd>e</kbd>直す <kbd>j</kbd><kbd>k</kbd>次へ</span></div>'
            + flow_lanes(a["log"], actors, now_label=nowl))

def approval_queue(items, sec=None, right="", title="押してほしいもの", first_selected=True):
    rows = "".join(approval_row(a, selected=(first_selected and i == 0)) for i, a in enumerate(items))
    return vgroup(title, str(len(items)), rows, sec=sec, right=right, color="var(--st-warning)")

# --- 今日（通常）：左の一覧 = 申し送りの要点 → 朝の計画 1 行 → 押してほしいもの → 今日やる分 → 夕方
_q_tasks, _p_tasks = task_queue("normal", head=False)
_head = (qhead("今日", "9月10日（水）", right=f'<button class="open-panel">{ic("clone")}申し送り</button><button>{ic("plus")}足す</button>', sec=0)
         + f'<div class="qnote" id="sec-1" data-sec="1">{ic("check")} 朝の計画 7:42 に確定（候補 5 → 3）<button style="color:var(--primary);font-weight:600;margin-left:6px">直す</button> · 時間の割り振りは <a href="v1-tasks.html" style="color:var(--primary);font-weight:600">タスク</a> で</div>')
_q_today = (approval_queue(APPROVALS, sec=2, right='<a href="v1-approvals.html">承認待ちへ →</a>')
  + _q_tasks
  + vgroup("夕方", "18:00", '<div class="qnote">高本AIが残りの振り分け案（消す／明日へ／引き継いでもらう）を出します。 <button style="color:var(--primary);font-weight:600">今すぐ整理する</button></div>', sec=4, color="var(--neutral)"))
_p_today = "".join(dpane(a["id"], approval_detail(a), on=(i == 0)) for i, a in enumerate(APPROVALS)) + _p_tasks
_t_norm = threepane(_q_today, _p_today, head=_head)

def _tp_state(mode):
    q, p = task_queue(mode)
    return '<div data-sec="0 1 2 3 4">' + threepane(q, p, head=qhead("今日", "9月10日（水）")) + '</div>'
_plan_card = _tp_state("plan")
_carry_card = _tp_state("carry")

_t_r3 = ('<div data-sec="0">' + clone_box("田中AIからの申し送り · 9/10 7:30",
  "佐藤さんの担当は3件です。<b>◯◯商事の見積</b>が今日期限なので、先に片づけてもらえると助かります。承認待ちが1件（あなた宛のメール下書き）あります。",
  btn("承認待ちを見る（1）","p","inbox","v1-approvals.html")) + '<div style="height:18px"></div>' +
  card(metric("自分の担当", '3<span style="font-size:19px;font-weight:500;color:var(--on-sv)"> 件</span>', "今週 配られた分 5件 のうち 2件 完了", 40) +
    f'<div style="margin-top:12px"><a href="v1-my-progress.html" style="color:var(--primary);font-weight:600;font-size:13px">自分の目標を見る →</a></div>') + '</div>' +
  '<div data-sec="1 2 3" hidden>' + card(head("今日やること", sub="配られた分だけ") + table(["", "やること", "案件", ("期限","r")], [
      [CB, '<a href="v1-tasks.html" style="font-weight:500">◯◯商事 見積を出す</a>', "◯◯商事 · 提案", ('<span style="color:var(--st-danger);font-weight:600">今日</span>',"n")],
      [CB, '<a href="v1-tasks.html" style="font-weight:500">△△様 修正版を送る</a>', "△△ · 制作中", ("明日","n")]])) + '</div>' +
  '<div data-sec="4" hidden>' + card(head("承認待ち（1）") + table(["種類","内容",("待ち","r"),""], [[pill("メール","pr"),"◯◯商事 見積の送付文",("3時間","n"),btn("見る","o",None,"v1-approvals.html")]])) + '</div>')

_t_empty = ('<div data-sec="0 1 2 3 4">' + card(empty("today", "まだはじめの設定が終わっていません",
  "PCをつないで、高本AIと話して、たたき台を作るところからです。10分ほどで終わります。",
  btn("はじめの設定へ","p","bridge","v1-bridge-setup.html"))) + '</div>')

_t_stop = ('<div data-sec="0 1 2 3 4">' + clone_box("高本AI",
  "<b>自動実行を止めています。</b>止めた理由：発注ナビの画面が変わり、営業社員の覚えた操作が途中で止まりました。覚え直させれば再開できます。それまで他のAI社員は動いています。",
  btn("覚え直させる","p","wrench","v1-automation-repair.html") + btn("このまま止めておく","g")) +
  '<div style="height:18px"></div>' + card(head("今日やること（自分の分）", sub="残り 3") +
  '<p class="muted" style="font-size:13px">AIが止まっていても、あなたのタスクはそのまま進められます。</p>') + '</div>')

TODAY = ("today", [("n","通常","",'<div data-roles="R1 R2">' + _t_norm + '</div><div data-roles="R3">' + _t_r3 + '</div>' + TP_JS),
  ("m","朝の計画","自分のAIの候補にチェック → 今日を確定。見込みの合計 vs 使える時間。勝手に詰めない。",_plan_card + TP_JS),
  ("v","夕方の持ち越し","残りを 消す／明日へ／引き継いでもらう。実時間を目標の実コストに積む。",_carry_card + TP_JS),
  ("e","はじめの設定の前","",_t_empty),
  ("s","自動実行が止まっている","止まった理由と、回復の1手を出す。",_t_stop)], TP_CSS + TP_TODAY_CSS, False, {"申し送り":"","朝の計画":"5","承認待ち":"!3","今日のタスク":"3","持ち越し":"3"})

# ============================================================ approvals
def _ap_row(kind, who, what, meta, since, urgent=False):
    return [f'{pill(kind,"ne")}', f'<b>{what}</b><div class="muted" style="font-size:12px">{who} が作成 → {meta}</div>',
            (f'<span style="{"color:var(--st-danger);font-weight:600" if urgent else ""}">{since}</span>',"n"),
            btn("見る","o","eye")]

_ap_stopped = [dict(id="s1", kind="メール送信", icon="mail", title="◯◇様 値引きの回答", who="CS社員", check="あなたが止めた：初回は値引きしない", wait="止めて 40 分", late="",
  kv=[("宛先","◯◇ 様"),("作った人","CS社員"),("止めた理由","初回は値引きしない。紹介案件でも同じ"),("今","AI社員が直している（高本AIが理由を伝えた）")],
  body="（直し中。直ったら高本AIが一次確認して、ここに戻ります）", note="止めた理由はそのまま担当業務のルールに足しました。次からは差し戻しなしで作れます。",
  primary="直ったら知らせる", log=[("06:21","高本AI","判断できない → 聞く","wait"),("08:02","あなた","止めた：値引きしない","back"),("08:03","高本AI","CS社員に伝えた","ok"),("","CS社員","直している","now")])]
_ap_hist_rows = [("9/10 06:42","請求書送付","セイコー 着手金の請求書 990,000円","承認 → 送った"),("9/9 17:30","メール送信","◯◯商事 見積の送付文","承認 → 送った"),
                 ("9/9 11:05","台帳の更新","◇◇様 案件を「失注」に","承認"),("9/8 09:12","投稿","X 週次の実績投稿","直してから承認"),("9/8 08:40","メール送信","△△様 修正版のご案内","止めた → 直し → 承認")]
_ap = ('<div data-sec="0">' + threepane(approval_queue(APPROVALS, title="未処理", right='<a href="v1-ai-activity.html">AI社員の動き →</a>') + '<div class="qnote">高本AIが一次確認したものだけが、ここに来ます。外に出るものは必ずここを通ります。</div>',
        "".join(dpane(a["id"], approval_detail(a), on=(i == 0)) for i, a in enumerate(APPROVALS)), head=qhead("承認待ち", "高本AIが一次確認したもの")) + '</div>'
       '<div data-sec="1" hidden>' + threepane(approval_queue(_ap_stopped, title="止めたもの"), "".join(dpane(a["id"], approval_detail(a), on=True) for a in _ap_stopped), head=qhead("承認待ち", "高本AIが一次確認したもの")) + '</div>'
       '<div data-sec="2" hidden>' + card(head("履歴", sub="押した記録 28 件。外に出たものは全部ここに残る") + table(["いつ","種類","内容","結果"], [[(w,"n"),pill(k,"ne"),c,r] for w,k,c,r in _ap_hist_rows])) + '</div>' + TP_JS)

_ap_r3 = card(head("未処理", sub="あなた宛の1件") + table(["種類","内容",("待ち","r"),""], [
  _ap_row("メール送信","CS社員","◯◯商事 様への見積送付メール","田中AI確認済み","20分")]))

_ap_stop = grid([
  card(head("止める", pill("AI社員に戻します","wa","undo")) +
    '<p style="font-size:13.5px;line-height:1.8;margin-bottom:14px">止めた理由を一言書くと、高本AIがAI社員に伝えて直させます。空でも止められます。</p>' +
    field("何を直す？", '<textarea class="inp" rows="3" placeholder="例：金額の話を入れないで。来週の打ち合わせ候補日を2つ入れて。"></textarea>') +
    '<div style="display:flex;gap:9px">' + btn("止めて戻す","d","undo") + btn("やめる","g") + '</div>'),
  card(head("止めたあと") + '<div class="dl" style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">' + "".join(
    f'<div style="display:flex;gap:10px;padding:10px 12px;background:var(--surface);border-radius:var(--r-md)">{ic("right")}{t}</div>' for t in [
    "高本AIが理由をAI社員に伝える","AI社員が直して、高本AIにもう一度上げる","高本AIが確認して、承認待ちに戻る（あなたには通知）","やりとりは「高本AIとAI社員のやりとり」で追える"]) + '</div>')], "g2")

_ap_empty = card(empty("inbox","承認待ちはありません","高本AIが一次確認して上げるものが来ると、ここに並びます。外に出るものは必ずここを通ります。"))

APPROVALS = ("approvals", [("n","通常","",'<div data-roles="R1 R2">' + _ap + '</div><div data-roles="R3">' + _ap_r3 + '</div>'),
  ("s","止める","止める＝AI社員に差し戻す。理由を書けば高本AIが伝える。",_ap_stop),("e","空","",_ap_empty)],
  TP_CSS, False, {"未処理":"!3","止めたもの":"1","履歴":"28"})

SCREENS = [TODAY, APPROVALS]

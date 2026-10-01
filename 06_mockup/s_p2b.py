# -*- coding: utf-8 -*-
"""P2 毎日：clone-thread / tasks"""
from _icons import ic
from _parts import *
from _wiz import cmsg, umsg, WIZ_CSS, CHAT_OPEN, chat_close
from _composer import chat_composer
from s_p2 import CB, clone_box

def amsg(text, who="経理社員"):
    return f'<div class="msg c"><div class="av" style="background:var(--secondary-c);color:var(--on-secondary-c)">{ic("ai")}</div><div class="bub"><div class="who">{who}</div>{text}</div></div>'

# ============================================================ clone-thread
_ct = grid([
  CHAT_OPEN +
  cmsg("京蟻の請求書、金額が <b>税抜 1,660,000円</b> になっています。契約は税込 1,826,000円 です。税込表示に直してください。", who="高本AI → 経理社員") +
  amsg("直しました。税込 1,826,000円（内 消費税 166,000円）。内訳の行も足しました。") +
  cmsg("確認しました。期日が「請求日から30日」になっていますが、京蟻との契約は <b>月末締め翌月末払い</b> です。期日を 10/31 にしてください。", who="高本AI → 経理社員") +
  amsg("期日を 2026-10-31 にしました。") +
  cmsg("OKです。承認待ちに上げます。", who="高本AI") +
  '<div style="text-align:center;font-size:12px;color:var(--on-sv);padding:8px">— 承認待ちへ · 9/10 06:42 —</div>' +
  chat_close(chat_composer("高本AIに伝える（例：京蟻は来月から税込を先に書いて）")),
  card(head("この差し戻し") + kv([("AI社員","経理社員"),("仕事","京蟻 請求書の作成"),("差し戻し","2回"),("今","承認待ち"),("かかった時間","6分")]) +
    f'<div class="ai" style="margin-top:14px"><div class="ai-h">{ic("clone")}高本AIが覚えたこと</div>京蟻は「税込を先に書く」「月末締め翌月末払い」。次からは差し戻しなしで作れるよう、担当業務のルールに足しました。</div>' +
    '<div style="margin-top:12px"><a href="v1-approvals.html" style="color:var(--primary);font-weight:600;font-size:13px">承認待ちを見る →</a></div>')
], "g21")

_ct_list = card(head("差し戻し中", sub="高本AIがAI社員に返しているもの") + table(["AI社員","仕事","差し戻し","今",""], [
  [f'{ic("ai")} 経理社員',"京蟻 請求書の作成","2回",pill("承認待ちへ","su","check"),btn("見る","o","eye")],
  [f'{ic("ai")} 営業社員',"発注ナビ 新着の取り込み","1回",'<span style="display:flex;gap:6px;align-items:center"><span class="spin dark"></span>直している</span>',btn("見る","o","eye")],
  [f'{ic("ai")} CS社員',"◇◇様 問い合わせへの返信","3回",pill("高本AIが判断保留 → あなたに聞く","wa","warn"),btn("見る","o","eye")],
]))

_ct_ask = grid([
  CHAT_OPEN +
  cmsg("◇◇様の問い合わせ、3回直させましたが、<b>値引きに応じるかどうか</b>は私では決められません。過去にあなたは「初回は値引きしない」と言っていましたが、◇◇様は紹介案件です。どうしますか？",
       ["値引きしない","1割まで","私が直接返す"], who="高本AI → あなた") +
  chat_close(chat_composer("ここに書く。声で話しても、資料を投げても構いません")),
  card(head("やりとりの経緯") + '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">' + "".join(
    f'<div style="display:flex;gap:9px;padding:9px 11px;background:var(--surface);border-radius:var(--r-md)"><span class="num muted" style="min-width:40px">{t}</span>{x}</div>'
    for t,x in [("06:10","CS社員が一次返信を下書き"),("06:12","高本AI差し戻し：値段の話をしない"),("06:15","CS社員が直す → 値引きの質問に答えていない"),
                ("06:16","高本AI差し戻し：質問には答える"),("06:20","CS社員が直す → 1割引で回答"),("06:21","高本AI：判断できない → あなたに聞く")]) + '</div>')
], "g21")

THREAD_CSS = WIZ_CSS   # 会話の固定枠は共通の FRAME_CSS（_chat.py）。WIZ_CSS に入っている
_ct = _ct.replace('<div class="grid g21">', '<div class="grid g21" data-chat-frame>', 1); _ct_ask = _ct_ask.replace('<div class="grid g21">', '<div class="grid g21" data-chat-frame>', 1)
_ct_r3 = grid([card(head("佐藤AI とのやりとり", pill("差し戻し 1 件","wa"), "京蟻 ガチャ演出の実装 · あなたの分だけ") +
  '<div class="chat">' + umsg("演出の 2 つ目、前回の型で下書きして", read="佐藤AI が読んだ 10:02") + cmsg("フェード → 拡大の型で 1 案作りました。尺が 2.4 秒で、前回の 1.8 秒より長いです。<b>短くしますか？</b>") +
  umsg("2.0 秒にして") + cmsg("2.0 秒に直しました。実装のタスクに付けています。終わったら「終わり」を押してください。") + '</div>' + chat_composer()),
  card(head("経緯") + '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">' + "".join(
    f'<div style="display:flex;gap:9px;padding:9px 11px;background:var(--surface);border-radius:var(--r-md)"><span class="num muted" style="min-width:40px">{a}</span>{b}</div>'
    for a,b in [("10:02","佐藤AI が下書き（2.4 秒）"),("10:05","あなた：2.0 秒に"),("10:06","佐藤AI が直した → タスクに付けた")]) + '</div>' +
    '<div class="muted" style="font-size:12px;margin-top:10px">会社の承認は要りません（外に出ない作業）。外に出るものは田中さんの承認待ちに入ります。</div>')], "g21")
CLONE_THREAD = ("clone-thread", [("n","1件のやりとり","担当者は自分のAIとのやりとりだけ。",'<div data-roles="R1 R2">' + _ct + '</div><div data-roles="R3">' + _ct_r3 + '</div>'),("l","差し戻し中の一覧","",_ct_list),
  ("a","高本AIが判断できない","高本AIは勝手に決めない。判断の材料と選択肢を出して人に聞く。",_ct_ask)],
  THREAD_CSS, False, {"差し戻し中":"!3","やりとりの履歴":"41"})

# ============================================================ tasks（D-068：人と AI社員は同じ一覧。状態 4 つ。見え方はリスト／カンバン／カレンダー）
from _views import VIEWS_CSS, VIEW_JS, view_bar, trow, tgrp, tsum, bulk, kanban, week_cal, gantt, av

VIEW_STATES = {"リスト":"n","カンバン":"k","カレンダー":"c","ガント":"g"}
def vb(cur): return view_bar(["リスト","カンバン","カレンダー","ガント"], cur, VIEW_STATES)

# --- 今日（リスト）＝ today の「今日やる分」と同じ部品・同じデータ（_taskdata.task_queue）。三画面（D-072）：左に行、中央に選んだ 1 件
from _taskdata import task_queue, today_strip
from _threepane import TP_CSS, TP_JS, threepane
def _tp_list(mode, right="", strip=True):
    q, p = task_queue(mode, right=right)
    return threepane(q, p, head=(today_strip() if strip else ""))
_tk_list = (vb("リスト") + _tp_list("normal", right='<button>' + ic("plus") + '足す</button>', strip=False))
_tk_week = (vb("リスト") + _tp_list("week", strip=False))

# --- 詰まっている（理由必須・理由ごとの一手）
_tk_blocked = (card(head("詰まっている", sub="理由の無い「詰まっている」は作れない。理由ごとに一手が付く") +
  '<div class="t-wrap"><table><thead><tr><th>やること</th><th>理由</th><th>いつから</th><th>一手</th></tr></thead><tbody>' + "".join(
    f'<tr><td><b>{t}</b><div class="muted" style="font-size:12px">{who}</div></td><td><span class="blk">{ic("clock")}{r}</span><div class="muted" style="font-size:12px;margin-top:3px">{d}</div></td><td class="n">{s}</td><td>{b}</td></tr>'
    for t, who, r, d, s, b in [
      ("◯◯商事 見積の再提出", "佐藤", "返事待ち", "先方の担当者が異動。新しい担当が未定", "12日", btn("催促のメールを下書かせる","o","mail") + btn("来期に回す","g","clock")),
      ("セイコー 着手金の請求書", "AI経理社員", "承認待ち", "あなたの承認で止まっている", "14時間", btn("承認カードを開く","p","inbox")),
      ("発注ナビ 新着の確認", "AI営業社員", "AI社員が止まった", "画面が変わり、覚えた操作が途中で止まった", "2時間", btn("覚え直させる","o","wrench","v1-automation-repair.html")),
      ("経費の領収書を読み込む", "AI事務社員", "PC が閉じている", "あなたの PC が起きたら続きから", "昨夜", btn("起きたら続き（そのまま）","g","pause")),
    ]) + '</tbody></table></div>') +
  clone_box("高本AI", "4 件のうち、あなたが動けば解けるのは <b>承認待ち 1 件</b>だけです。◯◯商事は催促の下書きを作っておきます。"))

_tk_late_c = card(head("期限切れ", sub="2件") +
  trow("◇◇様 前回提案の再打診", "", ("",""), "高本", ("20分",), ("9/5",True), orphan=True, ops=[("clock","今日に動かす"),("x","やめる")]) +
  trow("名刺のデータ化（8月分）", "", ("",""), "AI事務社員", ("—",), ("8/31",True), orphan=True, ops=[("ai","AI社員にやらせる"),("x","やめる")]) +
  clone_box("高本AI", "期限切れの 2 件、まだやりますか？ ◇◇様は先方の予算期が過ぎたので<b>来期に回す</b>のが自然です。名刺は私の AI社員で片づけられます。", btn("◇◇様は来期に","o") + btn("名刺は AI社員に","o","ai") + btn("両方やめる","g")))

# --- 引き継げる仕事（自分の今日が空になったときだけ下に出る）
_tk_pick = (card(head("引き継げる仕事", sub="同じ部署（営業）で残っているもの。あなたの分は今日ぶん終わっています") +
  trow("△△社 提案書の一次案を作る", "要件の 3 点を先方に確認してから", ("田中の受注 3件","終わると 残り 2（実績は田中さんの目標に積む）"), "田中", ("2h00",), ("明日",False), ops=[("users","引き継ぐ"),("eye","中を見る")]) +
  trow("◎◎社 見積の再提出", "", ("田中の受注 3件",""), "田中", ("40分",), ("9/12",False), ops=[("users","引き継ぐ"),("eye","中を見る")]) +
  trow("発注ナビ 新着の確認（今日ぶん）", "", ("新規リード 60件／月",""), "AI営業社員", ("—",), ("今日",False), state="実行中", ops=[("eye","動きを見る")]) +
  note("引き継ぐと田中さん（または部門長）に合意を取ります。成立したらあなたのタスクになり、実績は<b>田中さんの目標に積みます</b>（誰の目標かは変わりません）。", "info")) +
  clone_box("高本AI", "あなたの今日の分は終わりました。田中さんの<b>△△社 提案書</b>は明日期限で、田中さんは今日 SOICO の商談で手が塞がっています。あなたが引き継ぐなら、私が一次案を作って上げます。", btn("引き継いで一次案を作らせる","p","users") + btn("今日はここまで","g")))

# --- 足す（行の中で目標を選ぶ。別画面に飛ばない）
_tk_add = (card(head("タスクを足す", sub="必ず目標（か自主）に紐づける。紐づかないものは赤で残る") +
   field("やること", inp("SOICO 様へ概算見積の金額帯を回答する")) +
   field("次の一手", inp("先方の工数表 65.5 人日を基準に金額帯を出す", "1 行。空なら高本AIが下書きします")) +
   field("どの目標に", '<div style="display:flex;flex-direction:column;gap:6px">' + "".join(
     f'<label style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--surface);border-radius:var(--r-md);font-size:13.5px"><input type="radio" name="g" {"checked" if i==0 else ""} style="accent-color:#22345C"><span style="flex:1">{t}</span>{pill(k,"ne") if k else ""}</label>'
     for i,(t,k) in enumerate([("あなたの受注 7件（営業 › 高本）","高本AIの候補"),("今期の売上 12,000,000円（会社）",""),("自主目標にする（上と関係なく自分で決める）",""),("まだ決めない（行き先のないタスクとして赤で残る）","")])) + '</div>') +
   grid([field("担当", inp("自分（高本）")), field("見込み時間", inp("1h30")), field("期限", inp("9/12","","date"))], "g3") +
   note("高本AIの候補：<b>SOICO は発注ナビ経由の案件</b>なので「あなたの受注 7件」に紐づけるのが自然です。終えると受注の実績には積まず（見積段階）、案件の段階が「提案」に動きます。", "primary") +
   btn("足す","p","plus") + " " + btn("AI社員にやらせる","o","ai")))

# --- 引き継いでもらう（表の中で完結。相手の負荷が横に出る）
_tk_hand = (card(head("引き継いでもらう・担当を変える", sub="誰の目標かは変わらない。実績は元の人の目標に積む") +
   '<div style="padding:12px 14px;background:var(--surface);border-radius:var(--r-md);margin-bottom:14px;font-size:13.5px"><b>京蟻 契約書案を送る</b><div class="muted" style="font-size:12px;margin-top:3px">あなたの受注 7件 · 期限 明日 · 見込み 45分 · 今の担当：高本</div></div>' +
   head("誰に", sub="今週の負荷を見てから") + table(["","相手",("今週の見込み","r"),"手が空くのは","合意"], [
     ['<input type="radio" name="h" checked style="accent-color:#22345C">',"田中（営業）",("4 件 · 9h","n"),"明日の午後",pill("合意を取る","wa")],
     ['<input type="radio" name="h" style="accent-color:#22345C">',"佐藤（制作・外注）",("6 件 · 14h","n"),"来週",pill("合意を取る","wa")],
     ['<input type="radio" name="h" style="accent-color:#22345C">',"AI経理社員",("—","n"),"今すぐ",pill("そのまま","su")],
   ]) + field("ひとこと", inp("契約書のひな形は台帳の添付にあります。押印欄だけ確認してください")) +
   note("引き継いでもらうと田中さんに <b>合意待ち</b> が届きます。受けたらタスクは田中さんの「今日」に並び、<b>終えたときの実績はあなたの受注 7件に積まれます</b>（誰の目標かは変わりません）。", "info") +
   btn("引き継いでもらう","p","send") + " " + btn("担当だけ変える（指示）","o","users")))

_tk_orphan = (card(head("行き先のないタスク", sub="どの目標にも紐づいていない。消えるまで赤で残る") +
  trow("◇◇様 前回提案の再打診", "", ("",""), "高本", ("20分",), ("9/5",True), orphan=True, note='<div class="muted" style="font-size:12px">目標「Q2 新規開拓」が終了した</div>', ops=[("target","付け替える"),("x","やめる")]) +
  trow("名刺のデータ化（8月分）", "", ("",""), "AI事務社員", ("—",), ("8/31",True), orphan=True, note='<div class="muted" style="font-size:12px">足したときに目標を決めなかった</div>', ops=[("flag","自主目標に"),("x","やめる")]) +
  trow("SOICO 提案書のたたき台", "", ("",""), "AI営業社員", ("—",), ("9/12",False), orphan=True, note='<div class="muted" style="font-size:12px">足したときに目標を決めなかった</div>', ops=[("target","付け替える"),("x","やめる")]) +
  note("<b>3件</b>。目標管理の「未配分」と同じで、赤で出して消えるまで残します。「目標を選ぶ」は行の中で終わります。", "danger")) +
  clone_box("高本AI","3件の振り分け案です：◇◇様は <b>あなたの受注 7件</b> へ、SOICO は同じく受注へ、名刺は <b>自主目標</b> に。まとめて反映しますか？", btn("まとめて反映","p","check")+btn("1件ずつ","g")))

# --- カンバン（列＝状態 4 つ。担当を列にする切替もある）
_tk_kanban = (vb("カンバン") +
  '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:12.5px;color:var(--on-sv)">列：' +
  '<span class="vseg"><button aria-pressed="true">状態</button><button aria-pressed="false">担当</button></span><span>· 列は増やせません（状態は 4 つ）。カードを列に落とすと状態が変わり、担当の列に落とすと引き継ぎになります</span></div>' +
  kanban([
    ("今日", "var(--primary)", [("セイコー様へ提案の一次返信", "高本", "30分 · 今日", "", False), ("京蟻 契約書案を送る", "高本", "45分 · 明日", "", False), ("発注ナビ 新着の確認", "AI営業社員", "実行中", "", False), ("セイコー 着手金の請求書", "AI経理社員", "承認待ち", "990,000", False)]),
    ("あとで", "var(--neutral)", [("ScoliVio 会津データ受領の段取り", "高本", "9/12", "", False), ("SOICO 概算見積を出す", "高本", "1h30 · 9/12", "", False), ("X 週次の実績投稿", "AI営業社員", "承認待ち · 9/12", "", False)]),
    ("詰まっている", "var(--st-danger)", [("◯◯商事 見積の再提出", "佐藤", "返事待ち 12日", "", True), ("経費の領収書を読み込む", "AI事務社員", "PC が閉じている", "", True)]),
    ("終わった", "var(--st-success)", [("週次の売上を台帳から締める", "高本", "11分 · 今日", "", False), ("問い合わせ 2 件に一次返信", "AICS社員", "7:02", "", False)]),
  ]) + '<div style="height:14px"></div>' +
  note("主画面はリストで、カンバンは見え方の 1 つです。列は「状態」か「担当」のどちらかで、工程の列は案件（台帳）の側にあります。", "info"))

# --- カレンダー（週の時間割。会議は予定、タスクは見込み時間で置く）
_tk_cal = (vb("カレンダー") +
  card(tsum(95, 240, '<span>会議 <b>2h00</b></span>') +
  week_cal([("月","9/8"),("火","9/9"),("水","9/10"),("木","9/11"),("金","9/12")], list(range(9, 19)), [
    (2, 9, 0.5, "セイコー様へ電話", "30分", ""), (2, 11, 1, "SOICO 様 Zoom 商談", "予定", "mt"), (2, 13, 0.75, "京蟻 契約書案", "45分", ""),
    (2, 15, 1, "ScoliVio 定例", "予定", "mt"), (2, 16, 2, "空き 2h", "引き継げる仕事へ", "free"),
    (3, 10, 1.5, "SOICO 概算見積", "1h30", ""), (3, 14, 0.5, "ScoliVio 議事録", "AI事務社員が下書き", "ai"),
    (4, 9, 1, "X 週次の実績投稿", "AI営業社員 → 承認", "ai"), (4, 13, 2, "△△社 提案書（引き継ぎ候補）", "田中 · 2h", ""),
    (0, 9, 1, "週次の売上を締める", "完了", ""), (1, 14, 1, "発注ナビ 新着の確認", "AI営業社員", "ai"),
  ], today_idx=2, now=10.5) +
  '<div class="muted" style="font-size:12px;margin-top:10px">タスクは見込み時間の分だけ置きます。ドラッグで時間を動かすと「今日／あとで」が変わります。会議は予定（Google カレンダー・段階 4 で連携）。</div>'))

# --- ガント（今週〜来週。親の下に子。会議は薄い枠。今日の線）
_tk_gantt = (vb("ガント") + card(gantt(["9/8 月","9/9 火","9/10 水","9/11 木","9/12 金","9/15 月","9/16 火"], [
  ("セイコー様へ提案の一次返信", "高本 · 30分", 2.0, 0.5, "run", "今日", 0),
  ("山田様に電話", "10分", 2.05, 0.2, "run", "", 1),
  ("追いメールを承認", "5分 · 承認待ち", 2.3, 0.2, "wait", "", 1),
  ("京蟻 契約書案を送る", "高本 · 45分", 2.5, 1.5, "plan", ("明日まで", 25), 0),
  ("押印欄を足す", "20分", 2.5, 0.5, "plan", "", 1),
  ("送付文を書く", "AI事務社員 · 下書き中", 2.6, 0.8, "ai", "", 1),
  ("送る", "5分", 3.6, 0.3, "plan", "", 1),
  ("ScoliVio 会津データ受領の段取り確認", "高本 · 20分", 3.0, 2.0, "plan", "9/12", 0),
  ("SOICO 概算見積を出す", "高本 · 1h30", 3.0, 2.0, "plan", "9/12", 0),
  ("△△社 提案書の一次案", "田中 · 2h00", 2.0, 1.5, "plan", "明日", 0),
  ("発注ナビ 新着の確認", "AI営業社員 · 毎朝", 0.0, 7.0, "ai", "繰り返し", 0),
  ("SOICO 商談", "予定 11:00", 2.1, 0.15, "dia", "SOICO 商談 11:00", 0),
], today_col=2.2) + '<div class="muted" style="font-size:12.5px;margin-top:10px">親の下に子が並びます。棒を横に伸ばすと期限が動き、子の棒は親の中に収まります。会議は予定の印。</div>'))

_tk_done = ('<div data-sec="0 1 2 3 4 5">' + card(f'<div style="display:flex;gap:12px;align-items:center;padding:14px;background:#DCFCE7;border-radius:var(--r-md);margin-bottom:16px">{ic("check")}<div><b>終わりにしました。</b>実際にかかった時間 <b>12分</b>（見込み 30分）。あなたの受注に <b>+1件</b> 積み上がりました（3 → 4 / 7）。部署は 4 → 5 / 10。</div><div class="sp"></div>{btn("取り消す","g","undo")}</div>' +
   clone_box("高本AI","今日の分は全部終わりです。次は<b>同じ部署で残っている仕事</b>から引き継げます。田中さんの △△社 提案書（明日期限）が一番近いです。", btn("引き継げる仕事を見る","p","users")+btn("今日はここまで","g"))) + '</div>')

_wrap = lambda html: '<div data-sec="0 1 2 3 4 5">' + html + '</div>'
_tk = ('<div data-sec="0">' + _tk_list + '</div><div data-sec="1" hidden>' + _tk_week + '</div><div data-sec="2" hidden>' + _tk_blocked + '</div>'
       '<div data-sec="3" hidden>' + _tk_late_c + '</div><div data-sec="4" hidden>' + _tk_pick + '</div><div data-sec="5" hidden>' + _tk_orphan + '</div>')
_tk_r3 = ('<div data-sec="0 1 2 3 4">' + card(head("あなたのタスク", pill("配られた分だけ","ne"), "佐藤 · 制作 · 会社の数字は出ない") + table(["","タスク","次の一手","期限",("見込み","r")], [
  ['<input type="checkbox" aria-label="終わり" style="accent-color:#22345C">',"京蟻 ガチャ演出の実装","演出 3 パターンのうち 2 つ目",pill("今日","wa"),("3h","n")],
  ['<input type="checkbox" aria-label="終わり" style="accent-color:#22345C">',"セイコー 提案書の図を直す","佐藤AI が下書き → あなたが直す",pill("9/17","ne"),("1h","n")],
  ['<input type="checkbox" checked aria-label="終わり" style="accent-color:#22345C">',"京蟻 β の不具合 2 件","終わった",pill("済み","su"),("2h","n")]]) +
  '<div class="muted" style="font-size:12px;margin-top:10px">配られたタスクの「目標への寄与」は、あなたに見える目標（納期遵守 95%）だけに出ます。</div>' +
  clone_box("佐藤AI","演出の 2 つ目は前回の型（フェード → 拡大）で下書きできます。作っておきますか？", btn("作っておいて","p","ai") + btn("自分でやる","g"))) + '</div>')
_tk_r4 = ('<div data-sec="0 1 2 3 4">' + card(head("進み", pill("閲覧のみ","ne","eye"), "共有された案件のタスクだけ。書き込まない・担当者名は出ない") + table(["案件","タスク","状態","予定"], [
  ["京蟻 オンラインガチャ","ガチャ演出の実装",pill("進行中","su"),"9/16"],["京蟻 オンラインガチャ","β の不具合",pill("完了","su"),"9/14"],["セイコー 提案","提案書",pill("下書き","ne"),"9/18"]])) + '</div>')
TASKS = ("tasks", [("n","リスト（今日）","人と AI社員は同じ一覧。行に次の一手・目標への寄与・見込み／実時間。担当者は配られた分だけ、閲覧のみは進みだけ。",'<div data-roles="R1 R2">' + _tk + '</div><div data-roles="R3">' + _tk_r3 + '</div><div data-roles="R4">' + _tk_r4 + '</div>'),
  ("k","カンバン","列＝状態 4 つ（今日／あとで／詰まっている／終わった）か担当。列は増やせない。",_wrap(_tk_kanban)),
  ("c","カレンダー","週の時間割。タスクは見込み時間の分だけ置く。",_wrap(_tk_cal)),
  ("g","ガント","親子で期限を見る。棒を伸ばすと期限が動く。",_wrap(_tk_gantt)),
  ("b","詰まっている","理由必須。理由ごとに一手。",_wrap(_tk_blocked)),
  ("a","足す","必ず目標に紐づける。次の一手と見込み時間も。AIが候補を出す。",_wrap(_tk_add)),
  ("h","引き継いでもらう","合意か指示。誰の目標かは変わらない。",_wrap(_tk_hand)),
  ("d","終わったとき","実時間を記録し目標の実績に積む。取り消せる。自分のAIが次（引き継ぎ）を出す。",_tk_done),
  ("p","引き継げる仕事","自分の分が終わったら同じ層の残りから。合意で成立。",_wrap(_tk_pick)),
  ("o","行き先のないタスク","目標に紐づかないものは赤で残す。行の中で目標を選ぶ。",_wrap(_tk_orphan))], VIEWS_CSS + TP_CSS, False,
  {"今日":"3","今週":"5","詰まっている":"!4","期限切れ":"!2","引き継げる仕事":"2","行き先のないタスク":"!3"})
TASKS = (TASKS[0], [(a,b,c,d+VIEW_JS+TP_JS) for a,b,c,d in TASKS[1]], TASKS[2], TASKS[3], TASKS[4])

SCREENS = [CLONE_THREAD, TASKS]

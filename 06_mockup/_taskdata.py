# -*- coding: utf-8 -*-
"""タスクのデータと一覧（D-071・D-072）── 「今日やる分」はタスク一覧の「今日」そのもの。
 today（入口）も tasks（作業台）も、この 1 つの関数（task_queue）の出力を使う。データも 1 つ。
 見え方は三画面（_threepane）：左に行、中央に選んだ 1 件の中身。"""
from _icons import ic
from _parts import btn
from _threepane import qrow, group, qsum, dpane, dkv, dlog, tstrip, vrow, vgroup, ico, ring, cbox, due, flow_lanes

# 1 行＝1 タスク。人と AI社員は同じ形
TODAY = [
 dict(id="t1", title="セイコー様へ提案の一次返信を取りに行く", next="山田様に電話（11:00 の商談前）。出なければ追いメールを承認へ", goal=("あなたの受注 7件","残り 3 → 段階「提案」が動く"), who="高本", est=("30分","12分"), due=("今日",True), first=True,
      log=[("07:30","高本AI","今日の候補に入れた","ok"),("07:42","あなた","今日を確定","ok"),("11:00","あなた","山田様に電話","now"),("","高本AI","返事を台帳へ","")],
      children=[dict(id="t1a", title="山田様に電話（11:00 の商談前）", next="", goal=("あなたの受注 7件",""), who="高本", est=("10分",), due=("今日",True)),
                dict(id="t1b", title="出なければ追いメールを承認する", next="承認待ちのカードを押す", goal=("あなたの受注 7件",""), who="高本", est=("5分",), due=("今日",True)),
                dict(id="t1c", title="返事を台帳の案件に書く", next="", goal=("あなたの受注 7件",""), who="高本", est=("5分",), due=("今日",False))]),
 dict(id="t2", title="京蟻 契約書案を送る", next="台帳の添付「契約書ひな形」に押印欄だけ足す", goal=("あなたの受注 7件","残り 3 → 2"), who="高本", est=("45分",), due=("明日",False),
      log=[("昨日","AI事務社員","契約条件を台帳に記録","ok"),("07:30","高本AI","今日の候補に入れた","ok"),("","AI事務社員","送付文を下書き","now"),("明日","あなた","押印欄を足して送る","")],
      children=[dict(id="t2a", title="ひな形に押印欄を足す", next="", goal=("あなたの受注 7件",""), who="高本", est=("20分",), due=("明日",False)),
                dict(id="t2b", title="送付文を書く（AI事務社員が下書き）", next="", goal=("あなたの受注 7件",""), who="AI事務社員", est=("—",), due=("明日",False), state="下書き中"),
                dict(id="t2c", title="送る", next="", goal=("あなたの受注 7件",""), who="高本", est=("5分",), due=("明日",False)),
                dict(id="t2d", title="契約条件を台帳に転記", next="", goal=("あなたの受注 7件",""), who="高本", est=("10分",), due=("完了",False), done=True)]),
 dict(id="t3", title="ScoliVio 会津データ受領の段取り確認", next="", goal=("自主","会津大学との定例で確認"), who="高本", est=("20分",), due=("9/12",False),
      log=[("07:30","高本AI","今日の候補に入れた","ok"),("07:42","あなた","今日を確定","ok"),("","高本AI","次の一手を下書き","now"),("15:00","あなた","定例で確認","")]),
 dict(id="t4", title="発注ナビ 新着の確認（今日ぶん）", next="12件を条件で絞って台帳へ", goal=("新規リード 60件／月","41 → 53"), who="AI営業社員", est=("—",), due=("今日",False), state="実行中",
      log=[("06:00","高本AI","配った","ok"),("06:02","AI営業社員","発注ナビを読む","ok"),("06:40","AI営業社員","12 件を台帳へ","now"),("","高本AI","一次確認",""),("","あなた","承認は不要","")]),
 dict(id="t5", title="セイコー 着手金の請求書", next="承認待ち。押すと送る", goal=("今期の売上 12,000,000","+990,000"), who="AI経理社員", est=("—",), due=("今日",False), state="承認待ち",
      log=[("06:10","高本AI","配った","ok"),("06:30","AI経理社員","請求書を下書き","ok"),("06:38","高本AI","一次確認 OK","ok"),("06:42","あなた","承認待ち","wait")]),
 dict(id="t6", title="週次の売上を台帳から締める", next="", goal=("今期の売上 12,000,000",""), who="高本", est=("15分","11分"), due=("完了",False), done=True,
      log=[("07:42","あなた","今日を確定","ok"),("08:20","あなた","終わりにした（実 11 分）","ok"),("08:20","高本AI","今期の売上に反映","ok")]),
]
CANDIDATES = TODAY[:3] + [
 dict(id="c4", title="SOICO 概算見積を出す", next="工数表 65.5 人日を基準に金額帯", goal=("あなたの受注 7件","段階「提案」へ"), who="高本", est=("1h30",), due=("9/12",False), sel=False,
      log=[("07:30","高本AI","候補に入れた","ok"),("","あなた","今日に入れるか決める","now")]),
 dict(id="c5", title="◇◇様 前回提案の再打診", next="", goal=("",""), who="高本", est=("20分",), due=("9/5",True), orphan=True, sel=False,
      log=[("9/4","あなた","持ち越し","back"),("07:30","高本AI","目標が終了。行き先を決めるか消すか","wait"),("","あなた","決める","now")]),
]
WEEK = [
 dict(id="w1", title="SOICO 概算見積を出す", next="先方の工数表 65.5 人日を基準に金額帯を出す", goal=("あなたの受注 7件","終わると 段階「提案」へ"), who="高本", est=("1h30",), due=("9/12",False)),
 dict(id="w2", title="ScoliVio 定例の議事録を送る", next="", goal=("自主",""), who="AI事務社員", est=("—",), due=("9/11",False), state="下書き中"),
 dict(id="w3", title="◇◇様 前回提案の再打診", next="", goal=("",""), who="高本", est=("20分",), due=("9/5",True), orphan=True),
 dict(id="w4", title="△△社 提案書の一次案を作る", next="要件の 3 点を先方に確認してから", goal=("田中の受注 3件","終わると 残り 2"), who="田中", est=("2h00",), due=("明日",False)),
 dict(id="w5", title="X 週次の実績投稿", next="数字は台帳と一致を確認", goal=("新規リード 60件／月",""), who="AI営業社員", est=("—",), due=("9/12",False), state="承認待ち"),
]
CAP = 240   # 使える時間（分）
EST = 95    # 今日の見込み合計（分）
MEETINGS = [(11, 12, "SOICO 商談"), (15, 16, "ScoliVio 定例")]
NOW = 10.5
TASK_BLOCKS = [(9.4, 30), (10.0, 45), (12.1, 20)]   # 見込みを空き時間に置いた案（帯に描く）

def today_strip(sec=None, extra=""):
    return tstrip(CAP, EST, MEETINGS, tasks=TASK_BLOCKS, now=NOW, sec=sec, extra=extra)

def _is_ai(d): return d["who"].startswith("AI")

def _sub(d):
    """カードの 2 行目：担当（AI社員なら紫）・次の一手（無ければ自分のAIが下書き）"""
    out = []
    if d.get("orphan"): out.append(("行き先がない", "miss"))
    if _is_ai(d): out.append((d["who"], "who-ai"))
    elif d["who"] != "高本": out.append((d["who"], ""))
    if d.get("done"): out.append((f'見込み {d["est"][0]} → 目標に反映', ""))
    else: out.append((d["next"], "") if d.get("next") else ("次の一手が空 · 高本AIが下書きします", "who-ai"))
    return out

def _right(d):
    """行の右端：見込み · 期限（AI社員は状態）"""
    if d.get("done"): return f'実 {d["est"][1] if len(d["est"]) > 1 else d["est"][0]}'
    if _is_ai(d): return d.get("state", "")
    due = f'<span class="late">{d["due"][0]}</span>' if d["due"][1] else d["due"][0]
    return (f'<b>{d["est"][0]}</b> · ' if d["est"][0] != "—" else "") + due

def _mark(d):
    if d.get("done"): return "ok"
    if d.get("state") == "実行中": return "run"
    if d.get("state") == "承認待ち": return "warn"
    return ""

def _chips(d, mode):
    out = []
    if d.get("orphan"): out.append(("行き先なし", "wa"))
    if _is_ai(d):
        st = d.get("state", "")
        out.append((d["who"], "aiw"))
        if st == "実行中": out.append(('<span class="spin"></span>実行中', "run"))
        elif st: out.append((st, "wa"))
    elif d["who"] != "高本": out.append((d["who"], None))
    if not _is_ai(d) and not d.get("done") and not d.get("next") and mode not in ("plan", "child"): out.append(("AI が下書き", "aiw"))
    if d.get("done"): out.append(("終わった", "ok"))
    return out

def _vright(d, mode):
    if d.get("done"): return f'<span class="est">実 {d["est"][1] if len(d["est"]) > 1 else d["est"][0]}</span>'
    if _is_ai(d): return ""
    late = bool(d["due"][1])
    r = due(d["due"][0], late) if d.get("due") else ""
    if d["est"][0] != "—": r += f'<span class="est">{d["est"][0]}</span>'
    return r

def _lead(d, mode):
    kids = d.get("children") or []
    if d.get("done"): return ico("ok")
    if _is_ai(d): return ico("ai")
    if kids: return ring(sum(1 for k in kids if k.get("done")), len(kids))
    return cbox(d.get("sel", True) if mode == "plan" else False)

def task_row(d, mode="normal", selected=False, parent=None, expanded=False):
    """見て分かる行。親は進み具合の輪（1/4）と ▸、子はその下に続く。文は書かない"""
    kids = d.get("children") or []
    kk = (sum(1 for k in kids if k.get("done")), len(kids)) if kids else None
    row = vrow(d["id"], d["title"], _lead(d, mode), _chips(d, mode), right=_vright(d, mode), selected=selected, done=d.get("done", False) and mode != "plan",
               kids=kk, parent=parent, expanded=expanded)
    return row + "".join(vrow(k["id"], k["title"], _lead(k, "child"), _chips(k, "child"), right=_vright(k, "child"), done=k.get("done", False), parent=d["id"], expanded=expanded) for k in kids)

def _all(items):
    """親と子を平らに（中身のパネル用）"""
    out = []
    for d in items:
        out.append(d); out += d.get("children") or []
    return out

def task_detail(d, mode="normal"):
    """中央に出す 1 件の中身。行為はここで押す（終わりにする／引き継いでもらう／明日へ／止める…）"""
    ai = _is_ai(d)
    st = d.get("state") or ("終わった" if d.get("done") else "今日")
    nx = (f'<div class="nxt">{ic("right")}<div>{d["next"]}</div></div>' if d.get("next") else
          f'<div class="nxt">{ic("clone")}<div class="blank">次の一手が空です。高本AIが下書きします（台帳と前回のやりとりから）</div></div>')
    g0, g1 = (d["goal"] + ("",))[:2]
    goal = (g0 + (f' → {g1}' if g1 else "")) if g0 else '<span class="miss">行き先がない（目標に紐づいていない）</span>'
    est = d["est"][0] + (f'（実 {d["est"][1]}）' if len(d["est"]) > 1 and d["est"][1] else "")
    due = f'<span class="late">{d["due"][0]}</span>' if d["due"][1] else d["due"][0]
    who = f'<span class="who-ai">{d["who"]}</span>' if ai else d["who"]
    kv = dkv([("状態", st), ("つながる目標", goal), ("担当", who), ("見込み・実時間", est), ("期限", due)])
    if mode == "plan":
        acts = btn("今日に入れる","p","check") + btn("明日へ","g","clock") + btn("今日はやらない","g","x")
    elif mode == "carry":
        acts = btn("明日へ","p","clock") + btn("引き継いでもらう","o","send") + btn("消す","g","trash")
    elif ai:
        acts = ((btn("承認カードを開く","p","inbox","v1-approvals.html") + btn("AI社員に戻す","g","undo")) if d.get("state") == "承認待ち"
                else btn("動きを見る","o","eye","v1-ai-activity.html") + btn("止める","g","pause"))
    elif d.get("done"):
        acts = btn("取り消す","g","undo")
    else:
        acts = btn("終わりにする","p","check") + btn("引き継いでもらう","o","send") + btn("明日へ","g","clock") + btn("高本AIに頼む","g","chat")
    goal_fix = (f'<div class="ainote">目標に紐づいていません。高本AIの候補：<b>あなたの受注 7件</b>（前回の提案と同じ案件）。{btn("この目標にする","o","target")} {btn("消す","g","trash")}</div>'
                if d.get("orphan") else "")
    kind = "AI社員のタスク" if ai else "タスク"
    kids = d.get("children") or []
    kh = ""
    if kids:
        rows = "".join(f'<div class="kr{" done" if k.get("done") else ""}"><input type="checkbox"{" checked" if k.get("done") else ""} aria-label="終わり"><span>{k["title"]}</span><span class="r">{_right(k)}</span></div>' for k in kids)
        kh = f'<div class="kids"><div class="kh">子タスク <span>{sum(1 for k in kids if k.get("done"))}/{len(kids)}</span><span class="sp"></span><button>{ic("plus")}足す</button><button>高本AIに分けてもらう</button></div>{rows}</div>'
    lg = d.get("log") or [("07:30","高本AI","候補に入れた","ok")]
    names = []
    for _, who, *_r in lg:
        if who not in names: names.append(who)
    actors = [(nm, "me" if nm == "あなた" else "aiw" if nm == "高本AI" else "st") for nm in names]
    nowl = next((f'いま：{who} · {what}' for tm, who, what, k in lg if k == "now"), "")
    return (f'<div class="kind {"who-ai" if ai else "task"}">{kind} · {st}</div><h2>{d["title"]}</h2>'
            f'<div class="lbl">次の一手</div>{nx}{goal_fix}{kh}<div style="height:18px"></div>{kv}<div class="acts">{acts}</div>'
            + flow_lanes(lg, actors, now_label=nowl))

def task_queue(mode="normal", head=True, right=""):
    """(一覧の html, 中身の html)。mode: normal（日中）／plan（朝の計画＝候補にチェック）／carry（夕方＝残りを振り分け）／week（今週）"""
    if mode == "plan":
        items = CANDIDATES
        q = ((vgroup("高本AIの候補", f"{len(items)}", "", right=right, color="var(--tertiary)") if head else "")
             + qsum(EST, CAP, '<span>会議 <b>2h00</b></span>')
             + "".join(task_row(d, "plan", selected=(i == 0)) for i, d in enumerate(items))
             + f'<div class="lact">{btn("今日を確定","p","check")}{btn("SOICO も今日に","g","plus")}</div>'
             + '<div class="qnote">見込みの合計が使える時間を超えると赤になります。超えたまま確定はできますが、高本AIが「明日へ」の候補を出します。</div>')
    elif mode == "carry":
        items = [d for d in TODAY if not d.get("done") and d["who"] == "高本"]
        q = ((vgroup("残ったもの", str(len(items)), "", right=right, color="var(--st-warning)") if head else "")
             + "".join(task_row(d, "carry", selected=(i == 0)) for i, d in enumerate(items))
             + f'<div class="lact">{btn("高本AIの案どおりに整理する","p","check")}{btn("1 件ずつ","g")}</div>'
             + '<div class="qnote">今日終えたのは 2 件 · 実時間 23 分（見込み 1h15）。あなたの受注に +1。明日の候補は朝に出し直します。</div>')
    elif mode == "week":
        items = WEEK
        q = vgroup("今週", str(len(items)), "".join(task_row(d, selected=(i == 0)) for i, d in enumerate(items)), right=right)
    else:
        items = TODAY
        mine = [d for d in items if not _is_ai(d) and not d.get("done")]
        ai = [d for d in items if _is_ai(d)]
        done = [d for d in items if d.get("done")]
        sel = lambda d: d is items[0] and head
        q = (vgroup("今日やる分", str(len(mine)), "".join(task_row(d, selected=sel(d), expanded=(i == 0)) for i, d in enumerate(mine)), sec=(None if head else 3), right=right, color="var(--primary)")
             + vgroup("AI社員が進めている", str(len(ai)), "".join(task_row(d) for d in ai), right='<a href="v1-ai-activity.html">動きを見る →</a>', color="var(--tertiary)")
             + vgroup("終わった", str(len(done)), "".join(task_row(d) for d in done), color="var(--st-success)"))
    panes = "".join(dpane(d["id"], task_detail(d, mode), on=(i == 0 and head)) for i, d in enumerate(_all(items)))
    return q, panes

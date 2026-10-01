# -*- coding: utf-8 -*-
"""自分のAIとの会話の部品（D-104）。会話を出す 5 か所（会話モード・右パネル・聞き取り・たたき台・やりとり）は全部これ。
 コードの AgentChat／Conversation と 1 対 1。入力欄だけは _composer.chat_composer（D-103・chat_one の検査）。

 決めたこと（D-104）
 - 両方とも吹き出し。自分は淡い灰の面、AI は白い面＋罫線 1 本。表・図・コード・カードだけ会話の幅いっぱい
 - 作業中は吹き出しを出さず、枠なしの行（〇〇を調べています・手順・経過時間・道具の行）。終わると 1 行に畳む
 - 止まったら理由だけ（ボタンは置かない・入力欄は開いたまま）。送れなかった文は消さずに「もう一度送る」
 - 返事への操作：コピー・直して送り直す（自分）／コピー・タスクにする・書き出す（AI）。一部を選ぶと「引用して続ける」
 - 自信の表示・もう一度・分岐・記憶に入れる・日付の区切り・読んだ印 は置かない（D-066.5・D-066.7 を改めた）
 色・文字・角丸は DESIGN-kaname.md の段だけ（design_gate D1〜D4）。"""
from _icons import ic
from _browser import BROWSER_CSS, fix as browser_fix
from _parts import btn

AI_NAME = "高本AI"

# ============================================================ 吹き出し
def umsg(text, av="高", actions=True, read=None, failed=False, quote=None):
    """自分の吹き出し（淡い灰）。read（読んだ印）は D-104.18 で置かない（引数は互換のため残す）"""
    q = f'<div class="qt">{ic("chat")}<span>{quote}</span></div>' if quote else ""
    f = (f'<div class="sendfail" role="status">{ic("warn")}送れませんでした（回線が切れていました）。書いた文は残っています'
         f'<button class="btn btn-o btn-sm">{ic("repeat")}もう一度送る</button></div>') if failed else ""
    a = (f'<div class="mact end"><button>{ic("pen")}直して送り直す</button><button>{ic("file")}コピー</button></div>') if actions and not failed else ""
    return f'<div class="msg u{" failed" if failed else ""}"><div class="av">{av}</div><div class="mcol"><div class="bub">{q}{text}</div>{f}{a}</div></div>'

def cmsg(text, opts=None, who=None, other=True, actions=True, conf=None, read=None, work=None, icon="clone", wide=False):
    """自分のAI（または AI社員）の吹き出し（白い面＋罫線）。work は畳んだ作業の 1 行（例：3 つの操作・2分14秒）。
       opts は短い選択肢（押すとその文で送る）。問い合わせのカードは qcard。conf（自信）は D-066.5 を改めて出さない"""
    who = who or AI_NAME
    w = work_done(*work) if work else ""
    o = ""
    if opts:
        chips = "".join(f"<button>{x}</button>" for x in opts)
        if other: chips += '<button class="alt">その他（自分で書く）</button>'
        o = f'<div class="opts">{chips}</div>'
    a = (f'<div class="mact"><button>{ic("file")}コピー</button><button>{ic("list-checks")}タスクにする</button>'
         f'<button>{ic("upload")}書き出す</button></div>') if actions else ""
    return (f'<div class="msg c{" wide" if wide else ""}"><div class="av">{ic(icon)}</div><div class="mcol"><div class="who">{who}</div>{w}'
            f'<div class="bub">{text}{o}</div>{a}</div></div>')

def staff(text, name="経理社員", **kw):
    """AI社員の発言（D-104.14・名前とアイコンで自分のAI と分ける）"""
    return cmsg(text, who=name, icon="ai", **kw)

# ============================================================ 作業中（吹き出しの外・D-104.8）
def work_live(status, steps=None, tools=None, elapsed="0分42秒"):
    """動いている間：「〇〇を調べています…」の 1 行・手順のチェックリスト・経過時間・道具の行（押すと対象・成否・時間）"""
    st = ""
    if steps:
        st = '<ol class="wsteps">' + "".join(
            f'<li class="{s}">{ic("check") if s=="done" else (ic("play") if s=="now" else ic("clock"))}<span>{t}</span></li>' for s, t in steps) + '</ol>'
    tl = ""
    if tools:
        tl = '<div class="wtools">' + "".join(
            f'<details class="wtool"><summary>{ic("zap")}<b>{n}</b><span class="tg">{tg}</span><span class="ms">{ms}</span></summary>'
            f'<div class="wd">対象 {tg} · {"成功" if ok else "失敗"} · {ms}<br><span class="muted">道具の返り値の全文はあなたの PC に置いたままです</span></div></details>'
            for n, tg, ms, ok in tools) + '</div>'
    # 道具の行は並べない。いまの動きは 1 行が切り替わって伝える（D-111.1）。tools は受け取っても描かない（終わった後の 1 行に畳む）
    return (f'<div class="work live" role="status" aria-busy="true"><div class="wl"><span class="spin"></span><span class="ws">{status}</span>'
            f'<span class="el">{elapsed}</span></div>{st}</div>')

def work_done(summary, detail=None):
    """終わった作業は 1 行に畳まれて吹き出しの上に残る（押すと開く）"""
    d = detail or "目標「Q4 売上」を読んだ · 先週のタスクを集めた · 下書きを書いた"
    return f'<details class="work done"><summary>{ic("check")}<span>{summary}</span></summary><div class="wd">{d}</div></details>'

def queued(items):
    """動いている間に送った文の順番待ち（D-104.9）。取り消せる"""
    return ('<div class="queue" aria-label="順番待ち"><div class="qh">順番待ち（今の作業が終わったら順に）</div>' + "".join(
        f'<div class="qi">{ic("clock")}<span>{x}</span><button title="取り消す">{ic("x")}</button></div>' for x in items) + '</div>')

def steer_note(text):
    """止めずに直す（D-104.9）：送った文は次の区切りで効く"""
    return f'<div class="steer">{ic("route")}<span>{text}</span><span class="muted">次の区切りで伝えます</span></div>'

# ============================================================ 問い合わせ・許可・止まった
def qcard(questions, active=0, who=None):
    """自分のAI からの問い合わせ（D-104.7）。1〜4 問・選択肢（説明・推奨の印・見本）・複数選べる問い・「その他」と一言。
       全部答えてから送る。文で答えてもよい"""
    tabs = "".join(f'<button class="{"on" if i==active else ""}{" ok" if i<active else ""}">{ic("check") if i<active else ""}{q["h"]}</button>' for i, q in enumerate(questions))
    q = questions[active]
    multi = q.get("multi")
    rows = ""
    for i, (lab, desc, rec, prev) in enumerate(q["opts"]):
        on = (i in q.get("sel", [])) or (not multi and i == q.get("sel1", -1))
        mark = f'<span class="box{" m" if multi else ""}">{ic("check") if on else ""}</span>'
        rows += (f'<label class="qo{" on" if on else ""}">{mark}<span class="ql"><b>{lab}{" <em>おすすめ</em>" if rec else ""}</b><span>{desc}</span></span></label>')
    prev = next((p for _, _, _, p in q["opts"] if p), None)
    pv = f'<div class="qprev"><div class="qph">見本</div><pre>{prev}</pre></div>' if prev and q.get("show_prev") else ""
    return (f'<div class="qcard" role="group" aria-label="{who or AI_NAME}からの問い合わせ"><div class="qhd">{ic("chat")}{who or AI_NAME}からの問い合わせ'
            f'<span class="muted">{len(questions)} 問 · 全部答えてから送ります</span></div>'
            f'<div class="qtabs">{tabs}</div><div class="qq">{q["q"]}{"（いくつでも）" if multi else ""}</div>'
            f'<div class="qbody"><div class="qopts">{rows}<label class="qo other"><span class="box{" m" if multi else ""}"></span>'
            f'<span class="ql"><b>その他（自分で書く）</b><input placeholder="ここに書く"></span></label></div>{pv}</div>'
            f'<div class="qfoot"><input class="memo" placeholder="一言添える（なくてもよい）"><button class="btn btn-g btn-sm">戻る</button>'
            f'<button class="btn btn-p btn-sm">{"次へ" if active < len(questions)-1 else "送る"}</button></div></div>')

def perm_card(summary, detail, who=None, staff_name=None):
    """許可（D-104.14）：Claude と同じ 3 択（今回だけ／いつも／しない）＋一言。AI社員からは名前とアイコンで。答えは証跡に残る"""
    by = (f'<span class="pby">{ic("ai")}{staff_name}から</span>') if staff_name else ""
    return (f'<div class="perm" role="group" aria-label="許可の問い"><div class="ph">{ic("shield")}<b>あなたの PC でこれを実行していいですか</b>{by}</div>'
            f'<div class="psum">{summary}</div><pre class="pcode">{detail}</pre>'
            f'<div class="pbtn"><button class="btn btn-p btn-sm">今回だけ許可</button><button class="btn btn-o btn-sm">いつも許可（このコマンド）</button>'
            f'<button class="btn btn-g btn-sm">許可しない</button><input placeholder="一言添える（例：送る前に下書きを見せて）"></div>'
            f'<div class="muted pnote">答えるまで待っています。答えは証跡に残ります。「いつも」にしたものは ルール › 個人 で取り消せます</div></div>')

def stopped(reason):
    """止まったら理由だけ（D-104.15）。ボタンは置かず、入力欄は開いたまま。続けるかは次に送る文で決まる"""
    return (f'<div class="stopline" role="status">{ic("pause")}<div><b>ここで止まりました。</b>{reason}'
            f'<div class="muted">続けるなら「続けて」、ほかのことならそのまま書いてください。勝手には動き出しません</div></div></div>')

def browser_off():
    """AI が Chrome を使えなかった（D-119.4・D-120.2〜4）。理由と、その場でやる一手（つなぎ方・もう一度確かめる・切り替える）"""
    return (f'<div class="stopline" role="status" data-notice="browser-off">{ic("globe")}<div><b>AI が Chrome を使えませんでした。</b>'
            f'拡張機能「Claude in Chrome」とつながっていません。ブラウザを使わない作業はそのまま続けます。{browser_fix()}</div></div>')

def memo_line(text):
    """「覚えました」（D-105.1）。押すと記憶の画面で直せる"""
    return f'<a class="memline" href="v1-clone-memory.html">{ic("brain")}<span>覚えました：{text}</span><span class="muted">直す</span></a>'

def usage_bar(kind="near"):
    """使用量（D-104.16）。近い・達したときだけ会話に出す"""
    if kind == "near":
        return (f'<div class="usage" role="status">{ic("clock")}<div><b>サブスクの 5 時間の枠が 82% です。</b>18:40 に戻ります。長い作業は戻ってからの方が止まりにくいです'
                f'<a href="v1-account.html">使用量を見る</a></div></div>')
    return (f'<div class="usage lim" role="status">{ic("pause")}<div><b>サブスクの 5 時間の枠に達しました。</b>18:40 に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）'
            f'<a href="v1-account.html">使用量を見る</a></div></div>')

def to_bottom():
    """上を読んでいる間は常に出る丸い矢印。押すと最後のやりとりへ一気に戻る（D-104.18・2026-09-30）。新しい返事が来ていれば件数を添える"""
    return f'<button class="tobottom" aria-label="いちばん下へ" title="いちばん下へ（最後のやりとり）">{ic("down")}<span class="nb">新しい返事 1</span></button>'

def greet(text=None):
    """まだ何も話していない会話はあいさつだけ（D-104.2）"""
    return f'<div class="greet"><div class="av">{ic("clone")}</div><div>{text or "おはようございます、高本さん。何から始めますか？"}</div></div>'

# ============================================================ 返事の中の書式（D-104.3〜D-104.6）
def h(t, n=3): return f'<h{n} class="mh">{t}</h{n}>'
def mtable(head, rows, sort=None):
    th = "".join(f'<th>{c}{(" " + ic("down")) if sort == i else ""}</th>' for i, c in enumerate(head))
    tr = "".join("<tr>" + "".join(f"<td{' class=n' if str(c)[:1].isdigit() else ''}>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="mtable"><div class="mtbar"><span class="muted">表</span><button>{ic("file")}コピー</button></div><div class="tscroll"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div></div>'
def code(lang, html, lines=None):
    return (f'<div class="codeblk"><div class="cbar"><span>{lang}</span><button>{ic("file")}コピー</button></div><pre><code>{html}</code></pre>'
            + (f'<button class="cmore">残り {lines} 行を開く</button>' if lines else "") + '</div>')
def kw(x): return f'<i class="k">{x}</i>'
def st(x): return f'<i class="s">{x}</i>'
def nm(x): return f'<i class="n">{x}</i>'
def cm(x): return f'<i class="c">{x}</i>'
def fn(x): return f'<i class="f">{x}</i>'
def ty(x): return f'<i class="t">{x}</i>'
def callout(kind, title, text):
    icn = {"info": "info", "warn": "alert", "danger": "warn"}[kind]
    return f'<div class="callout {kind}" role="note">{ic(icn)}<div><b>{title}</b>{text}</div></div>'
def checklist(items): return '<ul class="chk">' + "".join(f'<li class="{"on" if d else ""}"><span class="box">{ic("check") if d else ""}</span>{t}</li>' for d, t in items) + '</ul>'
def kbd(*keys): return "+".join(f"<kbd>{k}</kbd>" for k in keys)
def mark(t): return f"<mark>{t}</mark>"
def icode(t): return f'<code class="ic">{t}</code>'
def math_frac():
    return ('<math display="block"><mrow><mi>達成率</mi><mo>=</mo><mfrac><mrow><mi>積み上がった数</mi></mrow><mrow><mi>降ろした数</mi></mrow></mfrac>'
            '<mo>×</mo><mn>100</mn><mo>=</mo><mfrac><mn>8.33</mn><mn>12</mn></mfrac><mo>×</mo><mn>100</mn><mo>≈</mo><mn>69.4</mn></mrow></math>')
def details(summary, body): return f'<details class="mdet"><summary>{summary}</summary><div>{body}</div></details>'
def toc(items): return '<nav class="mtoc" aria-label="この返事の目次"><b>目次</b>' + "".join(f'<a href="#">{i+1}. {t}</a>' for i, t in enumerate(items)) + '</nav>'
def cite(n, label=None):
    return f'<sup class="cn"><a href="#" title="{label or ""}">{n}</a></sup>'
def sources(items):
    return '<ol class="srcs" aria-label="出典">' + "".join(f'<li><a href="#">{ic(i)}{t}</a><span class="muted">{d}</span></li>' for i, t, d in items) + '</ol>'
def tabs(names, body): return '<div class="mtabs"><div class="tb">' + "".join(f'<button class="{"on" if i==0 else ""}">{n}</button>' for i, n in enumerate(names)) + f'</div><div class="tp">{body}</div></div>'
def schip(kind, label):
    icn = {"su": "check", "pr": "play", "wa": "clock", "da": "warn"}[kind]
    return f'<span class="schip {kind}">{ic(icn)}{label}</span>'
def pchip(name, ini): return f'<a class="pchip" href="v1-member-detail.html"><span class="pa">{ini}</span>{name}</a>'
def dchip(label, late=False): return f'<span class="dchip{" late" if late else ""}">{ic("clock")}{label}</span>'
def bignum(v, unit, label, diff):
    return f'<div class="bignum"><span class="v">{v}<small>{unit}</small></span><span class="l">{label}<span class="df">{diff}</span></span></div>'
def pbar(label, pct): return f'<div class="pbar"><div class="pl"><span>{label}</span><b>{pct}%</b></div><div class="pt"><i style="width:{pct}%"></i></div></div>'
def flowchart(nodes):
    """流れ図・順序図（Mermaid で描いたものの見本）"""
    return '<div class="fchart" role="img" aria-label="流れ図">' + f'<span class="fa">{ic("right")}</span>'.join(f'<span class="fn{" " + k if k else ""}">{t}</span>' for t, k in nodes) + '</div>'
def timeline(items): return '<ol class="mtime">' + "".join(f'<li><span class="td">{d}</span><span class="tt">{t}</span></li>' for d, t in items) + '</ol>'

# ---- 実物のカード（Kaname の目標・タスク・人・AI社員・承認待ち。押すと開く）
def goal_card(name, pct, due, state):
    return (f'<a class="ecard" href="v1-goals.html"><span class="et">{ic("target")}目標</span><b>{name}</b>'
            f'<div class="pt"><i style="width:{pct}%"></i></div><span class="em">{pct}% · 期限 {due} · {state}</span></a>')
def task_card(name, who, due, state):
    return (f'<a class="ecard" href="v1-tasks.html"><span class="et">{ic("list-checks")}タスク</span><b>{name}</b>'
            f'<span class="em">{who} · {due} · {state}</span></a>')
def person_card(name, role, now, ai=False):
    return (f'<a class="ecard" href="{"v1-ai-staff-detail.html" if ai else "v1-member-detail.html"}"><span class="et">{ic("ai" if ai else "user")}{"AI社員" if ai else "人"}</span>'
            f'<b>{name}</b><span class="em">{role} · いま：{now}</span></a>')
def approval_card(title, rows):
    kv = "".join(f'<div><span class="muted">{k}</span><span>{v}</span></div>' for k, v in rows)
    return (f'<div class="ecard ap"><span class="et">{ic("inbox")}承認待ち</span><b>{title}</b><div class="akv">{kv}</div>'
            f'<div class="abtn"><button class="btn btn-p btn-sm">承認して送る</button><button class="btn btn-o btn-sm">差し戻す</button><a href="v1-approvals.html">中身を全部見る</a></div></div>')

# ---- 資料
def file_card(name, meta, kind="file"):
    return (f'<div class="fcard">{ic(kind)}<div><b>{name}</b><span class="muted">{meta}</span></div>'
            f'<button class="btn btn-g btn-sm">横で開く</button><button class="btn btn-g btn-sm">{ic("down")}落とす</button></div>')
def sheet(head, rows):
    return ('<div class="sheet"><div class="mtbar"><span class="muted">表計算 · 並べ替え・絞り込みできます</span><button>CSV</button><button>Excel</button></div>'
            + mtable(head, rows, sort=2).replace('<div class="mtable">', '<div class="mtable in">') + '</div>')
def image_box(cap): return f'<figure class="imgbox"><div class="ph" role="img" aria-label="{cap}">{ic("eye")}</div><figcaption>{cap} · 押すと大きく</figcaption></figure>'
def media(kind, cap): return f'<div class="media">{ic("play")}<div><b>{cap}</b><span class="muted">{"動画 2:14" if kind=="v" else "音声 12:03"}</span></div><div class="mbar"><i></i></div></div>'
def map_box(place): return f'<figure class="mapbox"><div class="ph" role="img" aria-label="地図 {place}">{ic("map")}</div><figcaption>{place}</figcaption></figure>'
def link_prev(title, site): return f'<a class="lprev" href="#"><div><b>{title}</b><span class="muted">{site}</span></div><div class="lth" aria-hidden="true"></div></a>'
def results(items): return '<div class="results"><div class="muted">調べたページ ' + str(len(items)) + ' 件</div>' + "".join(f'<a href="#">{ic("search")}<b>{t}</b><span class="muted">{s}</span></a>' for t, s in items) + '</div>'
def pdf_prev(name): return f'<div class="pdfprev"><div class="pp">{ic("file")}<b>{name}</b><span class="muted">PDF · 3 ページ</span></div><div class="pg"><i></i><i></i><i></i></div></div>'
def artifact_panel(title, cur, versions, body, mode="edit", kind="md"):
    """横で開く成果物（D-106）：見る／直す・保存で新しい版・版の一覧から戻す（戻すのも新しい版）。画像・PDF は見るだけ"""
    tabs = ('' if kind not in ("md", "csv") else
            f'<div class="atabs" role="tablist"><button role="tab" aria-selected="{"false" if mode=="edit" else "true"}"{" class=on" if mode!="edit" else ""}>見る</button>'
            f'<button role="tab" aria-selected="{"true" if mode=="edit" else "false"}"{" class=on" if mode=="edit" else ""}>直す</button></div>')
    main = (f'<textarea class="aedit" aria-label="成果物の中身">{body}</textarea>' if mode == "edit" else f'<div class="ab">{body}</div>')
    if kind not in ("md", "csv"): main = f'<div class="ab"><div class="aview">{ic("eye")}この種類は見るだけです（直せません）</div>{body}</div>'
    vers = "".join(f'<li class="{"on" if v==cur else ""}"><button class="vopen" title="この版を開く">版 {v}</button><span class="muted">{when} · {who}{" · 版 " + str(fr) + " に戻した" if fr else ""}</span>'
                   + ('<span class="now">いまの版</span>' if v == cur else '<button class="btn btn-g btn-sm">この版に戻す</button>') + '</li>'
                   for v, when, who, fr in versions)
    save = (btn("保存（新しい版にする）","p","check") if mode == "edit" and kind in ("md", "csv") else "")
    return (f'<aside class="artifact" aria-label="横で開いた成果物"><div class="ah">{ic("file")}<button class="atitle" title="名前を直す">{title}</button><span class="v">版 {cur}</span>'
            f'<button class="aclose" title="閉じる" aria-label="成果物を閉じる">{ic("x")}</button></div>{tabs}{main}'
            f'<details class="avers" open><summary>版の一覧（{len(versions)}）</summary><ol>{vers}</ol></details>'
            f'<div class="af">{save}{btn("いまの版を落とす","o","download")}</div></aside>')
def screen_prev(name): return f'<div class="scrprev"><div class="sb"><i></i><i></i><i></i><span>{name}</span></div><div class="sc"><div></div><div></div><div></div></div></div>'

# ---- 作業の記録（自分のAI が返事に書いたもの・D-104.6）
def diff(name, lines, add, rem):
    body = "".join(f'<div class="dl {k}"><span class="sg">{"+" if k=="a" else ("−" if k=="r" else " ")}</span>{t}</div>' for k, t in lines)
    return f'<div class="diffblk"><div class="cbar"><span>{name}</span><span class="dc"><i class="a">+{add}</i> <i class="r">−{rem}</i></span></div>{body}</div>'
def terminal(cmd, out): return f'<div class="term"><div class="cbar"><span>打ったコマンド</span><button>{ic("file")}コピー</button></div><pre><b>$ {cmd}</b>\n{out}</pre></div>'
def tree(lines): return '<pre class="ftree">' + "\n".join(lines) + '</pre>'


# 会話の固定枠（D-072「会話の固定枠」・user「チャットは動いていい。周りは固定」）。会話を本文に出す画面はどれもこれ（L-008）。
# 768 以上で枠の高さを画面の残りに合わせ、中の吹き出しだけがスクロールする（入力欄・見出し・段の帯・右の欄は動かない。D-072 の 1024 を D-064.7 で 768 に）。
# 枠の高さはモックでは --fix-top／--fix-bottom（_shell.py の台本）、実装では components/ai/frame.tsx が直に入れる。
# 会話の中（.kc）に閉じない規則なので、export_web_css.py はこれを閉じずに書き出す
FRAME_CSS = """
@media(min-width:768px){
  [data-chat-frame]{height:calc(100vh - var(--fix-top,180px) - var(--fix-bottom,0px));min-height:0;align-items:stretch;grid-template-rows:minmax(0,1fr)}
  [data-chat-frame] .col,[data-chat-frame] [data-chat-col],[data-chat-frame] [data-chat-state],[data-chat-frame] .kc[data-part="conversation"]{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
  /* 枠の中の見出し（会話の名前）や注意書きは縮めない。縮むと会話が溢れたとき 15px に潰れて頭が切れる（2026-10-01 実測） */
  [data-chat-frame]>h2,[data-chat-frame]>p{flex:none}
  /* 会話の中だけが動く。スクロールバーは出さない（出たり消えたりで中身が横にずれる・2026-09-30 user「スクロールバーいらない」） */
  /* overflow-x:hidden：会話の欄は横に動かさない（幅の広い表・コードはその箱の中で横に送る。トラックパッドで欄ごと横にずれる・2026-09-30 user）。
     position:relative：中の読み上げ用の隠し文字（sr-only・絶対位置）を会話の欄の中に置く。無いとページの下にはみ出してページごと縦に動く（2026-09-30 実測 487px） */
  [data-chat-frame] .chat{position:relative;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
  [data-chat-frame] .chat::-webkit-scrollbar{display:none}
  /* 会話の画面は本文の上下の余白を詰め、入力欄を下へ（会話に高さを渡す） */
  .content:has([data-chat-frame]){padding-top:12px;padding-bottom:12px}
  /* relative：入力欄の上に浮かせる「いちばん下へ」の基準を入力欄にする（static だと画面の外に出て押せなかった・2026-09-30） */
  [data-chat-frame] .composer{position:relative;flex:none}
  [data-chat-frame]>.card,[data-chat-frame] [data-chat-side]{overflow-y:auto;min-height:0}
  /* 入力欄を詰める（2026-09-29 user「やり取りスペースが小さすぎて見づらい」）：画面のチップは道具の段と同じ 1 段に。入力は低く始め、書くと伸びる。
     「Shift+Enter で改行」の行は文字が入っている間だけ出す。入力欄にいる間（focus）で出し入れすると、下の道具のボタンを押した瞬間に
     入力欄から外れて行が引っ込み、ボタンがずれて押し損ねる（2026-09-30 許可のしかたが開かない実例） */
  [data-chat-frame] .composer{padding:8px 0 4px}
  [data-chat-frame] .composer .cbox{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px}
  [data-chat-frame] .composer textarea{order:1;flex:1 0 100%;min-height:30px}
  [data-chat-frame] .composer .cchips{order:2;margin:0}
  [data-chat-frame] .composer .cbar2{order:3;flex:1 1 auto}
  [data-chat-frame] .composer .chint{display:none}
  [data-chat-frame] .composer:has(textarea:not(:placeholder-shown)) .chint{display:flex}
  /* 会話を広げる：段の帯・見出しの説明・右の欄を閉じて、会話だけにする（もう一度押すと戻る） */
  [data-chat-wide] [data-chat-side]{display:none}
  [data-chat-wide] [data-chat-frame].grid{grid-template-columns:minmax(0,1fr)!important} /* 画面側の 2 列の指定（utilities）より強く */
}
"""

CHAT_CSS = BROWSER_CSS + """
/* ===== 会話（D-104）：DESIGN の chat-* / code-block / callout-* / kbd ===== */
.chat{display:flex;flex-direction:column;gap:14px;min-width:0;overflow-wrap:anywhere}
.chat,.chat *{min-width:0}
.msg{display:flex;gap:10px;align-items:flex-start;max-width:100%}
.msg .av{width:28px;height:28px;border-radius:var(--r-full);display:grid;place-items:center;flex:none;font-size:12px;font-weight:600}
.msg.c .av{background:var(--ai-c);color:var(--tertiary)}
.msg.u{flex-direction:row-reverse;margin-left:auto;max-width:min(560px,88%)}
.msg.u .av{background:var(--sv);color:var(--on-sv)}
.msg .mcol{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:100%}
.msg.c .mcol{flex:1}
.msg .who{font-size:12px;font-weight:600;color:var(--on-sv)}
.msg .bub{font-size:13px;line-height:1.65;border-radius:var(--r-lg);min-width:0}
.msg.u .bub{background:var(--sv);color:var(--on-surface);padding:10px 14px}
.msg.c .bub{background:var(--card);border:1px solid var(--line);padding:12px 16px}
.msg.c .bub>p,.msg.c .bub>.mp,.msg.c .bub>.mdoc>p{max-width:60em}
/* 段落・表・箇条書きの間を空ける。実装は返事を包み（.mdoc・display:contents）の中に入れるので、包みの中にも当てる（無いと生成の内容がくっつく・2026-09-30） */
.msg.c .bub>*+*,.msg .bub>.mdoc>*+*{margin-top:10px}
.msg .qt{display:flex;gap:6px;align-items:flex-start;font-size:13px;color:var(--on-sv);border-left:2px solid var(--line);padding-left:8px;margin-bottom:6px}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opts button{border:1px solid var(--line);background:var(--card);border-radius:var(--r-full);padding:4px 12px;font-size:13px}
.opts button:hover{border-color:var(--primary);color:var(--primary)}
.opts button.alt{border-style:dashed;color:var(--on-sv)}
.mact{display:flex;gap:2px;flex-wrap:wrap;opacity:.7}
.mact.end{justify-content:flex-end}
.msg:hover .mact,.mact:focus-within{opacity:1}
.mact button{font-size:12px;color:var(--on-sv);padding:2px 8px;min-height:24px;border-radius:var(--r-sm);display:inline-flex;gap:4px;align-items:center}
.mact button:hover{background:var(--sv);color:var(--on-surface)}
.mact button:focus-visible,.opts button:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.mact button svg{width:12px;height:12px}
.sendfail{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--st-danger)}
.msg.u.failed .bub{outline:1px dashed var(--st-danger)}
/* 作業中（吹き出しの外）と、畳んだ作業 */
.work{font-size:13px;color:var(--on-sv);margin-left:38px}
.work .wl{display:flex;gap:8px;align-items:center}
/* 作業中は 1 行が切り替わる（D-111.1）・内部の名前は出さない（D-111.2） */
.work .ws{color:var(--on-surface)}
.work .ws a.lk{margin-left:8px;font-weight:600;text-decoration:underline;color:inherit}
.work .el{margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px}
.spin{width:12px;height:12px;border-radius:var(--r-full);border:2px solid var(--line);border-top-color:var(--tertiary);animation:sp 1s linear infinite;flex:none}
@keyframes sp{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}
.wsteps{list-style:none;margin:8px 0 0;display:flex;flex-direction:column;gap:3px}
.wsteps li{display:flex;gap:7px;align-items:center;font-size:13px}
.wsteps li svg{width:14px;height:14px}
.wsteps li.done svg{color:var(--st-success)}.wsteps li.done span{color:var(--on-sv)}
.wsteps li.now span{color:var(--on-surface);font-weight:600}.wsteps li.now svg{color:var(--st-progress)}
.wtools{margin-top:6px;display:flex;flex-direction:column;gap:2px}
.wtool summary,.work.done summary{display:flex;gap:7px;align-items:center;cursor:pointer;list-style:none;font-size:12px;padding:2px 0}
.wtool summary::-webkit-details-marker,.work.done summary::-webkit-details-marker{display:none}
.wtool .tg{font-family:var(--font-code);color:var(--on-sv);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wtool .ms{margin-left:auto;font-variant-numeric:tabular-nums}
.wtool svg,.work.done svg{width:12px;height:12px}
.wd{font-size:12px;padding:4px 0 4px 19px;line-height:1.6}
.work.done{margin:0}
.work.done summary{color:var(--on-sv)}
.work.done summary svg{color:var(--st-success)}
.queue{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:8px 12px;margin-bottom:8px}
.queue .qh{font-size:12px;color:var(--on-sv);margin-bottom:4px}
.queue .qi{display:flex;gap:8px;align-items:center;font-size:13px;padding:2px 0}
.queue .qi svg{width:14px;height:14px;color:var(--on-sv)}
.queue .qi button{margin-left:auto;color:var(--on-sv);min-width:24px;min-height:24px;display:grid;place-items:center;border-radius:var(--r-sm)}
.queue .qi button:hover{background:var(--sv)}
.steer{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--on-sv);margin-left:38px}
.steer span:first-of-type{color:var(--on-surface)}
/* 止まった・使用量・覚えました */
.stopline,.usage{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.7;margin-left:38px;padding:10px 12px;border-radius:var(--r-md)}
.stopline{background:var(--st-warning-c);color:var(--on-st-warning-c)}
.stopline .muted{color:var(--on-st-warning-c);opacity:.85;font-size:12px}
.usage{background:var(--st-progress-c);color:var(--on-st-progress-c)}
.usage.lim{background:var(--st-warning-c);color:var(--on-st-warning-c)}
.usage a,.usage button.lk{margin-left:8px;font-weight:600;text-decoration:underline}
.usage button.lk{background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer}
.usage button.lk:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.stopline svg,.usage svg{flex:none;margin-top:4px}
.memline{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--tertiary);margin-left:38px}
.memline .muted{margin-left:4px}
.memline:hover span:first-of-type{text-decoration:underline}
.tobottom{pointer-events:auto;display:inline-flex;gap:6px;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-full);box-shadow:0 4px 12px rgba(0,0,0,.10);font-size:12px;font-weight:600;color:var(--on-surface)}
.tobottom:hover{background:var(--sv)}
.tobottom:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.tobottom svg{width:16px;height:16px}
.tobottom .nb{background:var(--primary);color:var(--on-primary);border-radius:var(--r-full);padding:0 6px;font-size:11px}
.greet{display:flex;gap:12px;align-items:center;font-size:16px;padding:24px 0 12px}
.greet .av{flex:none;width:36px;height:36px;border-radius:var(--r-full);display:grid;place-items:center;background:var(--ai-c);color:var(--tertiary)}
/* 問い合わせ（D-104.7） */
.qcard{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);margin-left:38px;overflow:hidden}
.qhd{display:flex;gap:8px;align-items:center;padding:10px 14px;font-size:13px;font-weight:600;border-bottom:1px solid var(--line-soft)}
.qhd .muted{margin-left:auto;font-weight:400;font-size:12px}
.qtabs{display:flex;gap:4px;padding:8px 14px 0;flex-wrap:wrap}
.qtabs button{font-size:12px;padding:3px 10px;border-radius:var(--r-full);border:1px solid var(--line);display:inline-flex;gap:4px;align-items:center}
.qtabs button.on{border-color:var(--primary);color:var(--primary);font-weight:600}
.qtabs button.ok{color:var(--st-success)}
.qtabs button svg{width:12px;height:12px}
.qq{padding:10px 14px 4px;font-size:13px;font-weight:600}
.qbody{display:grid;gap:12px;padding:4px 14px 12px}
@media(min-width:900px){.qbody{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.qopts{display:flex;flex-direction:column;gap:6px}
.qo{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line);border-radius:var(--r-md);cursor:pointer}
.qo:hover{border-color:var(--primary)}
.qo.on{border-color:var(--primary);background:var(--primary-c)}
.qo .box{width:16px;height:16px;border-radius:var(--r-full);border:1.5px solid var(--neutral);flex:none;margin-top:3px;display:grid;place-items:center}
.qo .box.m{border-radius:var(--r-sm)}
.qo.on .box{border-color:var(--primary);background:var(--primary);color:var(--on-primary)}
.qo .box svg{width:12px;height:12px}
.qo .ql{display:flex;flex-direction:column;gap:2px;font-size:13px;flex:1}
.qo .ql span{font-size:12px;color:var(--on-sv)}
.qo .ql em{font-style:normal;font-size:11px;color:var(--secondary);border:1px solid var(--secondary);border-radius:var(--r-full);padding:0 6px;margin-left:6px}
.qo.other input{border:0;border-bottom:1px solid var(--line);background:none;font:inherit;font-size:14px;padding:2px 0}
.qprev{border:1px solid var(--line-soft);border-radius:var(--r-md);background:var(--surface);padding:10px 12px}
.qprev .qph{font-size:11px;color:var(--on-sv);margin-bottom:4px}
.qprev pre{font-family:var(--font-code);font-size:12px;white-space:pre-wrap;line-height:1.6}
.qfoot{display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid var(--line-soft)}
.qfoot .memo{flex:1;border:0;background:none;font:inherit;font-size:14px}
/* 許可（D-104.14・全部許可でも台帳で禁止のサービスは PC の上で止める D-107.2） */
.perm{border:1px solid var(--line);border-left:3px solid var(--st-progress);border-radius:var(--r-md);background:var(--card);padding:10px 14px;margin-left:38px}
.perm .ph{display:flex;gap:8px;align-items:center;font-size:13px}
.perm .pby{margin-left:auto;display:inline-flex;gap:4px;align-items:center;font-size:12px;color:var(--on-sv)}
.perm .psum{font-size:13px;margin-top:6px}
.perm .pcode{font-family:var(--font-code);font-size:12px;background:var(--surface);border-radius:var(--r-sm);padding:6px 8px;margin-top:6px;white-space:pre-wrap}
.perm .pbtn{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
.perm .pbtn input{flex:1 1 200px;border:0;border-bottom:1px solid var(--line);background:none;font:inherit;font-size:14px;padding:4px 0}
.perm .pnote{font-size:12px;margin-top:6px}
/* 返事の中の書式（D-104.3・D-104.4） */
.mh{font-weight:600;line-height:1.4}
h2.mh{font-size:18px}h3.mh{font-size:16px}h4.mh{font-size:14px}
.bub ul:not(.chk),.bub ol:not(.srcs):not(.mtime):not(.wsteps){padding-left:20px}
/* 箇条書きの点と番号・項目の間を明示する（実装の土台 Tailwind が点を消す。無いと生成の内容がくっついて見える・2026-09-30） */
.bub ul:not(.chk):not(.srcs):not(.mtime):not(.wsteps){list-style:disc}
.bub ol:not(.srcs):not(.mtime):not(.wsteps){list-style:decimal}
.bub li+li{margin-top:4px}
.bub li>ul,.bub li>ol{margin-top:4px}
.bub li::marker{color:var(--on-sv)}
.bub hr{border:0;border-top:1px solid var(--line)}
.mtable{border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden}
.mtable.in{border:0;border-radius:0}
.mtbar{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:4px 8px;background:var(--surface);border-bottom:1px solid var(--line-soft);font-size:12px}
.mtbar .muted{margin-right:auto}
.mtbar button{font-size:12px;color:var(--on-sv);display:inline-flex;gap:4px;align-items:center;padding:2px 6px;border-radius:var(--r-sm)}
.mtbar button:hover{background:var(--sv)}
.mtbar button svg{width:12px;height:12px}
.tscroll{overflow-x:auto}
.mtable table{width:100%;border-collapse:collapse;font-size:13px}
.mtable th{text-align:left;font-weight:600;font-size:12px;color:var(--on-sv);padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.mtable td{padding:6px 10px;border-bottom:1px solid var(--line-soft)}
.mtable td.n{text-align:right;font-variant-numeric:tabular-nums}
.codeblk,.diffblk,.term{border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface);overflow:hidden}
.cbar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:4px 10px;font-size:12px;color:var(--on-sv);border-bottom:1px solid var(--line-soft)}
.cbar button{display:inline-flex;gap:4px;align-items:center;font-size:12px;color:var(--on-sv)}
.cbar button svg{width:12px;height:12px}
.codeblk pre,.term pre{font-family:var(--font-code);font-size:12px;line-height:1.6;padding:10px 12px;overflow-x:auto;white-space:pre}
.codeblk i{font-style:normal}
.codeblk .k{color:var(--syn-keyword);font-weight:600}.codeblk .s{color:var(--syn-string)}.codeblk .n{color:var(--syn-number)}
.codeblk .c{color:var(--syn-comment)}.codeblk .f{color:var(--syn-function)}.codeblk .t{color:var(--syn-type)}
.cmore{display:block;width:100%;font-size:12px;color:var(--primary);padding:4px;border-top:1px solid var(--line-soft)}
code.ic{font-family:var(--font-code);font-size:12px;background:var(--sv);padding:0 4px;border-radius:var(--r-sm)}
.callout{display:flex;gap:10px;align-items:flex-start;padding:8px 14px;border-radius:var(--r-md);font-size:13px;line-height:1.7}
.callout svg{flex:none;margin-top:4px}
.callout b{display:block}
.callout.info{background:var(--st-progress-c);color:var(--on-st-progress-c)}
.callout.warn{background:var(--st-warning-c);color:var(--on-st-warning-c)}
.callout.danger{background:var(--st-danger-c);color:var(--on-st-danger-c)}
.chk{list-style:none;display:flex;flex-direction:column;gap:4px}
.chk li{display:flex;gap:8px;align-items:center;font-size:13px}
.chk .box{width:16px;height:16px;border:1.5px solid var(--neutral);border-radius:var(--r-sm);display:grid;place-items:center;flex:none}
.chk li.on .box{background:var(--st-success);border-color:var(--st-success);color:var(--on-primary)}
.chk li.on{color:var(--on-sv);text-decoration:line-through}
.chk .box svg{width:12px;height:12px}
kbd{font-family:var(--font-code);font-size:12px;background:var(--card);border:1px solid var(--line);border-bottom-width:2px;border-radius:var(--r-sm);padding:0 6px}
mark{background:var(--mark);color:var(--on-surface);padding:0 2px;border-radius:var(--r-sm)}
math{font-size:18px}
.mdet{border:1px solid var(--line-soft);border-radius:var(--r-md);padding:6px 12px}
.mdet summary{cursor:pointer;font-size:13px;font-weight:600}
.mdet>div{font-size:14px;padding-top:6px}
.mtoc{display:flex;flex-direction:column;gap:2px;font-size:14px;border-left:2px solid var(--line);padding-left:10px}
.mtoc b{font-size:12px;color:var(--on-sv)}
.mtoc a{color:var(--primary)}
sup.cn a{font-size:11px;font-weight:600;color:var(--primary);background:var(--primary-c);border-radius:var(--r-full);padding:0 5px;margin-left:2px}
.srcs{list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12px;border-top:1px solid var(--line-soft);padding-top:8px;counter-reset:s}
.srcs li{display:flex;gap:8px;align-items:center;counter-increment:s}
.srcs li::before{content:counter(s);font-weight:600;color:var(--primary);min-width:12px}
.srcs a{display:inline-flex;gap:4px;align-items:center;color:var(--on-surface);font-weight:600}
.srcs svg{width:12px;height:12px}
.mtabs .tb{display:flex;gap:2px;border-bottom:1px solid var(--line)}
.mtabs .tb button{font-size:14px;padding:6px 12px;border-bottom:2px solid transparent;margin-bottom:-1px}
.mtabs .tb button.on{border-bottom-color:var(--primary);color:var(--primary);font-weight:600}
.mtabs .tp{padding-top:10px;font-size:13px}
.schip,.dchip,.pchip{display:inline-flex;gap:4px;align-items:center;font-size:12px;font-weight:600;border-radius:var(--r-full);padding:1px 8px;vertical-align:middle}
.schip svg,.dchip svg{width:12px;height:12px}
.schip.su{background:var(--st-success-c);color:var(--on-st-success-c)}.schip.pr{background:var(--st-progress-c);color:var(--on-st-progress-c)}
.schip.wa{background:var(--st-warning-c);color:var(--on-st-warning-c)}.schip.da{background:var(--st-danger-c);color:var(--on-st-danger-c)}
.dchip{background:var(--sv);color:var(--on-sv)}.dchip.late{background:var(--st-danger-c);color:var(--on-st-danger-c)}
.pchip{background:var(--sv);color:var(--on-surface);padding-left:2px}
.pchip .pa{width:18px;height:18px;border-radius:var(--r-full);background:var(--primary-c);color:var(--on-primary-c);display:grid;place-items:center;font-size:11px}
.bignum{display:flex;gap:12px;align-items:baseline}
.bignum .v{font-size:34px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.bignum .v small{font-size:15px;margin-left:2px}
.bignum .l{display:flex;flex-direction:column;font-size:12px;color:var(--on-sv)}
.bignum .df{color:var(--st-success);font-weight:600}
.pbar .pl{display:flex;justify-content:space-between;font-size:14px}
.pbar .pt,.ecard .pt{height:6px;background:var(--sv);border-radius:var(--r-full);overflow:hidden;margin-top:4px}
.pbar .pt i,.ecard .pt i{display:block;height:100%;background:var(--primary)}
.fchart{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid var(--line-soft);border-radius:var(--r-md)}
.fchart .fn{border:1px solid var(--line);border-radius:var(--r-md);padding:4px 10px;font-size:14px;background:var(--card)}
.fchart .fn.now{border-color:var(--st-progress);color:var(--st-progress);font-weight:600}
.fchart .fn.done{color:var(--on-sv)}
.fchart .fa svg{width:14px;height:14px;color:var(--neutral)}
.mtime{list-style:none;border-left:2px solid var(--line);padding-left:12px;display:flex;flex-direction:column;gap:6px}
.mtime li{display:flex;gap:10px;font-size:14px;position:relative}
.mtime li::before{content:"";position:absolute;left:-17px;top:8px;width:8px;height:8px;border-radius:var(--r-full);background:var(--primary)}
.mtime .td{color:var(--on-sv);min-width:64px;font-variant-numeric:tabular-nums}
.ecards{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))}
.ecard{display:flex;flex-direction:column;gap:4px;border:1px solid var(--line);border-radius:var(--r-md);padding:10px 12px;background:var(--card);font-size:14px}
a.ecard:hover{border-color:var(--primary)}
.ecard .et{display:inline-flex;gap:4px;align-items:center;font-size:11px;color:var(--on-sv);font-weight:600}
.ecard .et svg{width:12px;height:12px}
.ecard .em{font-size:12px;color:var(--on-sv)}
.ecard.ap{border-left:3px solid var(--st-warning);grid-column:1/-1}
.ecard .akv{display:flex;flex-direction:column;gap:2px;font-size:14px}
.ecard .akv div{display:flex;gap:10px}.ecard .akv .muted{min-width:48px}
.ecard .abtn{display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap}
.ecard .abtn a{font-size:12px;color:var(--primary);font-weight:600}
.fcard{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;font-size:14px}
.fcard>div{display:flex;flex-direction:column;flex:1}
.fcard .muted{font-size:12px}
.sheet{border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden}
.sheet>.mtbar button{border:1px solid var(--line)}
.imgbox,.mapbox{border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;max-width:420px}
.imgbox .ph,.mapbox .ph{height:160px;display:grid;place-items:center;background:var(--sv);color:var(--on-sv)}
.mapbox .ph{background:var(--secondary-c)}
.imgbox figcaption,.mapbox figcaption{font-size:12px;color:var(--on-sv);padding:4px 10px}
.media{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;font-size:14px;max-width:420px}
.media>div:first-of-type{display:flex;flex-direction:column}
.media .muted{font-size:12px}
.media .mbar{flex:1;height:4px;background:var(--sv);border-radius:var(--r-full)}
.media .mbar i{display:block;width:30%;height:100%;background:var(--primary);border-radius:var(--r-full)}
.lprev{display:flex;gap:10px;align-items:stretch;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;max-width:520px;font-size:14px}
.lprev>div:first-child{display:flex;flex-direction:column;flex:1}
.lprev .muted{font-size:12px}
.lprev .lth{width:64px;border-radius:var(--r-sm);background:var(--sv)}
.results{display:flex;flex-direction:column;gap:4px;font-size:14px}
.results .muted{font-size:12px}
.results a{display:flex;gap:8px;align-items:center}
.results a svg{width:12px;height:12px;color:var(--on-sv)}
.results a .muted{margin-left:auto}
.pdfprev{border:1px solid var(--line);border-radius:var(--r-md);padding:10px 12px;max-width:520px}
.pdfprev .pp{display:flex;gap:8px;align-items:center;font-size:14px}
.pdfprev .pp .muted{margin-left:auto;font-size:12px}
.pdfprev .pg{display:flex;gap:8px;margin-top:8px}
.pdfprev .pg i{width:72px;height:96px;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r-sm)}
.scrprev{border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;max-width:520px}
.scrprev .sb{display:flex;gap:4px;align-items:center;padding:4px 8px;background:var(--surface);border-bottom:1px solid var(--line-soft);font-size:12px;color:var(--on-sv)}
.scrprev .sb i{width:8px;height:8px;border-radius:var(--r-full);background:var(--line)}
.scrprev .sb span{margin-left:6px}
.scrprev .sc{display:flex;flex-direction:column;gap:6px;padding:12px}
.scrprev .sc div{height:10px;background:var(--sv);border-radius:var(--r-sm)}
.scrprev .sc div:nth-child(2){width:70%}.scrprev .sc div:nth-child(3){width:40%}
.diffblk .dc i{font-style:normal;font-weight:600}.diffblk .dc .a{color:var(--st-success)}.diffblk .dc .r{color:var(--st-danger)}
.diffblk .dl{font-family:var(--font-code);font-size:14px;padding:0 12px;white-space:pre-wrap}
.diffblk .dl.a{background:var(--st-success-c)}.diffblk .dl.r{background:var(--st-danger-c)}
.diffblk .sg{display:inline-block;width:14px;color:var(--on-sv)}
.ftree{font-family:var(--font-code);font-size:14px;line-height:1.6;border:1px solid var(--line-soft);border-radius:var(--r-md);padding:8px 12px;background:var(--surface)}
/* 横で開く成果物（D-104.5） */
.artwrap{display:grid;gap:14px}
@media(min-width:1180px){.artwrap{grid-template-columns:minmax(0,1fr) 420px}}
.artifact{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);display:flex;flex-direction:column;overflow:hidden}
.artifact .ah{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line-soft);font-size:14px}
.artifact .ah .v{margin-left:auto;font-size:12px;color:var(--on-sv)}
.artifact .ab{padding:14px 16px;font-size:14px;line-height:1.7;display:flex;flex-direction:column;gap:8px}
.artifact .af{display:flex;gap:8px;padding:8px 12px;border-top:1px solid var(--line-soft);flex-wrap:wrap}
/* 成果物を直す・版を戻す（D-106）。会話の画面では右に寄せて固定、狭い画面は全面 */
.artifact .atitle{font-weight:600;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:var(--r-sm);padding:2px 4px}
.artifact .atitle:hover{background:var(--sv)}
.artifact .ah input{flex:1;min-width:0;font-size:14px;border:1px solid var(--line);border-radius:var(--r-sm);padding:2px 8px;background:var(--surface);color:var(--on-surface)}
.artifact .aold{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 12px 0;padding:8px 12px;border-radius:var(--r-md);background:var(--st-warning-c);color:var(--on-st-warning-c);font-size:14px}
.artifact .avers .vopen{font-weight:600;border-radius:var(--r-sm);padding:0 4px}
.artifact .avers .vopen:hover{background:var(--sv)}
.artifact .avers li.on .vopen{color:var(--primary)}
.artifact .amedia{max-width:100%;border-radius:var(--r-md)}
.artifact .apdf{width:100%;min-height:480px;border:1px solid var(--line-soft);border-radius:var(--r-md)}
.artifact .aclose{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--r-sm);color:var(--on-sv)}
.artifact .aclose:hover{background:var(--sv)}
.artifact .atabs{display:flex;gap:4px;padding:6px 12px 0}
.artifact .atabs button{padding:4px 12px;border-radius:var(--r-sm);font-size:14px;color:var(--on-sv)}
.artifact .atabs button.on,.artifact .atabs button[aria-selected=true]{background:var(--sv);color:var(--on-surface);font-weight:600}
.artifact .aedit{margin:8px 12px;min-height:280px;flex:1;resize:vertical;font-family:var(--font-code);font-size:14px;line-height:1.6;border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;background:var(--surface);color:var(--on-surface)}
.artifact .aview{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--on-sv)}
.artifact .avers{border-top:1px solid var(--line-soft);padding:8px 12px;font-size:14px}
.artifact .avers summary{cursor:pointer;font-weight:600}
.artifact .avers ol{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.artifact .avers li{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0}
.artifact .avers li .muted{font-size:12px}
.artifact .avers li .now,.artifact .avers li button{margin-left:auto}
.artifact .avers li .now{font-size:12px;color:var(--primary);font-weight:600}
.artdock{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:40;display:flex;box-shadow:-8px 0 24px rgba(0,0,0,.12)}
.artdock .artifact{flex:1;border-radius:0;border-width:0 0 0 1px;overflow:auto}
@media(max-width:1179px){.artdock{width:100vw}}
@media(min-width:1180px){.kc[data-art]{padding-right:476px}}
/* 一部を選んで引用して続ける（D-104.17） */
.selpop{display:inline-flex;gap:2px;background:var(--on-surface);color:var(--card);border-radius:var(--r-md);padding:2px;font-size:12px;vertical-align:middle;margin-left:4px}
.selpop button{color:var(--card);padding:2px 8px;border-radius:var(--r-sm);display:inline-flex;gap:4px;align-items:center}
.selpop button svg{width:12px;height:12px}
.sel{background:var(--primary-c)}
.streaming{color:var(--on-sv);animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.streaming{animation:none}}
"""

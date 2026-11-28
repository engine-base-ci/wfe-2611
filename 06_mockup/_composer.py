# -*- coding: utf-8 -*-
"""自分のAIとの会話の入力欄（D-103・D-104.10）。モックの会話を出す場所は、どこもこの 1 つ（会話モード・聞き取り・たたき台・やりとり・右パネル）。
 コードの AgentChat／Conversation と同じく、場所ごとに違うのは入力欄の見本（ph）と、右パネルで詰めるか（compact）だけ。
 状態（録音中・添付あり・文脈・@ の候補・選択の開いた一覧・動いている・順番待ち・長すぎる・PC が閉じている）は引数で出す。
 別の組み立てを書くと scripts/ci/chat_one.mjs が赤にする。

 D-104.10：下に固定の大きな箱。上に文脈のチップ（× で外す）と添付、下の列に ＋・マイク・モデル・使うもの・許可のモード・送る。
 Shift+Enter で改行・それ以外の Enter で送る（変換を確定する Enter では送らない）。/ のコマンドは作らない（D-066.8 を改めた）。"""
from _icons import ic

# モデルは版まで入った名前で 1 行ずつ（Claude のデスクトップのモデルの箱と同じ・2026-09-30 user「モデル単位になっている？？ 見比べてみろや」）。
# いちばん上は「PC の設定」＝何も選ばない（PC の Claude Code がふだん使うモデル）。コードの MODELS（composer.tsx）と同じ並び
MODELS = ["Opus 5.5", "Fable 5.1", "Sonnet 5.5", "Haiku 4.5"]
# 考える強さ（--effort）。ボタンには短い名前だけを出す（Claude の「中」「高」と同じ）
EFFORTS = [("PC の設定のまま", "既定"), ("低", "低"), ("中", "中"), ("高", "高"), ("最高", "最高"), ("最大", "最大")]
TOOLS = [("会社モデル構築", "スキル · 運営", True), ("目標の分解", "スキル · 運営", True), ("見積の作り方", "スキル · 会社", False), ("freee", "道具 · 正規連携", True), ("ブラウザ操作", "道具 · あなたの PC", False)]
MODES = [("毎回聞く", "道具を使う前に毎回たずねます（既定）"), ("編集は自動", "ファイルの編集は聞かずに進め、それ以外は聞きます"),
         ("自動で判断", "Claude が危なさを見て、危ないものだけ聞きます"), ("計画だけ", "動かずに、進め方だけ出します"),
         ("全部許可", "何も聞かずに進めます。外への送信・削除も確かめません。自分で選んだときだけ・この会話だけ")]
MENTION = [("target", "目標", "受注 10 件（Q4）"), ("list-checks", "タスク", "セイコー 提案書の図"), ("user", "人", "佐藤 真"), ("ai", "AI社員", "経理社員"), ("brain", "記憶", "初回は値引きしない")]


def chat_composer(ph="聞く・頼む・相談する", voice=False, atts=None, slash=False, disabled=None, compact=False,
                  ctx=None, mention=False, picker=None, running=False, queue=None, long=False, mode="毎回聞く", model="Opus 5.5", mem=None):
    """slash は D-104.10 で廃止（互換のため引数だけ残し、何も出さない）"""
    rec = (f'<div class="rec" role="status">{ic("mic")}<span>聞いています 0:07 · 話し終えたら止めると文字になります（直してから送れます）</span>'
           f'<button class="btn btn-o btn-sm">{ic("square")}止める</button></div>') if voice else ""
    chips = ""
    for c in (ctx or []):
        chips += f'<span class="cchip ctx" title="自分のAIに添える文脈">{ic("eye")}{c}<button title="外す" aria-label="{c}を外す">{ic("x")}</button></span>'
    att_err = False
    for a in (atts or []):
        # ("名前", "error")：置き場に置けなかった資料（E-CHAT-002）。一覧に残し、もう一度送る／外す を出す（2026-10-01）
        if isinstance(a, tuple):
            att_err = True
            chips += (f'<span class="cchip att err" data-att-state="error">{ic("paperclip")}{a[0]}（置けませんでした）'
                      f'<button title="もう一度送る" aria-label="{a[0]}をもう一度送る">{ic("refresh")}</button>'
                      f'<button title="外す" aria-label="{a[0]}を外す">{ic("x")}</button></span>')
            continue
        chips += f'<span class="cchip att">{ic("paperclip")}{a}<button title="外す" aria-label="{a}を外す">{ic("x")}</button></span>'
    chips = f'<div class="cchips">{chips}</div>' if chips else ""
    if att_err:
        chips += '<p class="catt-err" role="status">資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください</p>'
    pop = ""
    if mention:
        pop = ('<div class="cpop" role="listbox" aria-label="@ で指す">' + "".join(
            f'<div class="{"on" if i == 0 else ""}" role="option">{ic(i_)}<b>{k}</b><span>{v}</span></div>' for i, (i_, k, v) in enumerate(MENTION)) + '</div>')
    elif picker == "model":
        # 1 行＝1 モデル。選んでいるものに右端のチェック、ほかは数字（押しても・数字のキーでも選べる）
        rows = [("PC の設定（Opus 5.5）", None)] + [(m, i + 1) for i, m in enumerate(MODELS)]
        pop = ('<div class="cpop cmenu cmodel" role="listbox" aria-label="モデル">' + "".join(
            f'<div class="{"on" if n == model else ""}" role="option" aria-selected="{"true" if n == model else "false"}"><b>{n}</b>'
            f'{ic("check") if n == model else (f"<kbd>{k}</kbd>" if k else "<i></i>")}</div>' for n, k in rows) + '</div>')
    elif picker == "effort":
        pop = ('<div class="cpop cmenu cmodel ceffort" role="listbox" aria-label="考える強さ">' + "".join(
            f'<div class="{"on" if i == 2 else ""}" role="option" aria-selected="{"true" if i == 2 else "false"}"><b>{n}</b>{ic("check") if i == 2 else "<i></i>"}</div>'
            for i, (n, _) in enumerate(EFFORTS)) + '</div>')
    elif picker == "tools":
        pop = ('<div class="cpop" role="listbox" aria-label="使うもの">' + "".join(
            f'<div role="option"><b>{n}</b><span>{d}</span><span class="tg{" on" if on else ""}" aria-checked="{"true" if on else "false"}"><i></i></span></div>' for n, d, on in TOOLS) + '</div>')
    elif picker == "perm":
        pop = ('<div class="cpop cmenu left" role="listbox" aria-label="許可のモード">' + "".join(
            f'<div class="{"on" if m == mode else ""}{" danger" if m == "全部許可" else ""}" role="option" aria-selected="{"true" if m == mode else "false"}"><b>{m}</b><span>{d}</span>{ic("check") if m == mode else ""}</div>' for m, d in MODES) + '</div>')
    q = ""
    if queue:
        q = ('<div class="cqueue" aria-label="順番待ち">' + "".join(
            f'<div>{ic("clock")}<span>{x}</span><button title="取り消す" aria-label="取り消す">{ic("x")}</button></div>' for x in queue) + '</div>')
    ph_ = "PC が閉じています。書いたことは起きたら順に送ります" if disabled else ("動いている間に書いたことは、次の区切りで伝えます" if running else ph)
    send = (f'<button class="csend stop" title="止める" aria-label="止める">{ic("square")}</button>' if running
            else f'<button class="csend" title="送る（Enter）" aria-label="送る">{ic("send")}</button>')
    cnt = '<span class="ccount">残り 1,240 字</span>' if long else ""
    # この会話を記憶に使わない（D-104.1）：その会話だけに効くので入力欄の側に置く（2026-09-30 user「セッションの入力あたりに」）。
    # mem=None は出さない（はじめの設定の聞き取りは会社を覚える場なので出さない）。True はオン
    memsw = "" if mem is None else (f'<label class="cmem{" on" if mem else ""}" title="オンにすると、自分のAIが毎朝まとめる記憶にこの会話を入れません">'
                                     f'<input type="checkbox" role="switch" aria-label="この会話を記憶に使わない"{" checked" if mem else ""}>記憶に使わない</label>')
    bar = (f'<div class="cbar2"><button class="cbtn" title="資料・画像を付ける" aria-label="資料・画像を付ける">{ic("plus")}</button>'
           f'<button class="cbtn{" on" if voice else ""}" title="声で入力" aria-label="声で入力">{ic("mic")}</button>'
           f'<button class="cpick{" open" if picker == "perm" else ""}{" warn" if mode == "全部許可" else ""}">{ic("shield")}{mode}{ic("down")}</button>'
           f'{memsw}<span class="csp"></span>{cnt}'
           f'<button class="cpick{" open" if picker == "tools" else ""}">{ic("sliders")}使うもの 3{ic("down")}</button>'
           f'<button class="cpick{" open" if picker == "model" else ""}">{model}</button>'
           f'<button class="cpick{" open" if picker == "effort" else ""}" title="考える強さ">中</button>'
           f'{send}</div>')
    hint = "" if compact else '<div class="chint"><span><kbd>Shift</kbd>+<kbd>Enter</kbd> で改行</span><span><kbd>@</kbd> で目標・タスク・人・記憶を指す</span></div>'
    if mem:
        hint = '<div class="cmem-note">この会話は、自分のAIが毎朝まとめる記憶に入れません</div>' + hint
    return (f'<div class="composer{" compact" if compact else ""}" data-part="composer">{q}{rec}'
            f'<div class="cbox">{pop}{chips}<textarea rows="1" placeholder="{ph_}" aria-label="自分のAIに書く"></textarea>{bar}</div>{hint}</div>')


COMPOSER_CSS = """
.composer{position:sticky;bottom:0;background:var(--surface);padding:12px 0 8px}
/* 入力欄のすぐ上に浮かせる（いちばん下へ 等）。下に固定の入力欄に隠れて押せない、を作らない */
.composer .cabove{position:absolute;left:0;right:0;bottom:100%;display:flex;justify-content:center;padding-bottom:8px;pointer-events:none}
.composer .cabove>*{pointer-events:auto}
.composer,.composer *{min-width:0}
.composer .cbox{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r-xl);padding:8px 12px}
.composer:focus-within .cbox{border-color:var(--primary);outline:2px solid var(--primary-c)}
.composer textarea{display:block;width:100%;border:0;background:none;font:inherit;font-size:14px;line-height:1.5;resize:none;min-height:48px;max-height:240px;padding:6px 2px}
.composer textarea:focus-visible{outline:none}
.cchips{display:flex;gap:6px;flex-wrap:wrap;padding:2px 0 6px}
.cchip{display:inline-flex;gap:4px;align-items:center;font-size:12px;font-weight:600;background:var(--sv);color:var(--on-surface);border-radius:var(--r-full);padding:2px 4px 2px 10px}
.cchip.ctx{background:var(--primary-c);color:var(--on-primary-c)}
.cchip svg{width:12px;height:12px}
.cchip button{display:grid;place-items:center;min-width:24px;min-height:24px;border-radius:var(--r-full)}
.cchip button:hover{background:var(--card)}
/* 置き場に置けなかった資料（E-CHAT-002）：赤い札にして、もう一度送る／外す。下に理由の 1 行 */
.cchip.err{background:var(--st-danger-c);color:var(--st-danger)}
.catt-err{font-size:12px;color:var(--st-danger);margin:0 0 6px;padding-left:2px}
.cbar2{display:flex;gap:4px;align-items:center}
.cbar2 .csp{flex:1}
.cbtn{display:grid;place-items:center;width:32px;height:32px;border-radius:var(--r-full);color:var(--on-sv)}
.cbtn:hover{background:var(--sv);color:var(--on-surface)}
.cbtn.on{background:var(--st-danger-c);color:var(--st-danger)}
.cpick{display:inline-flex;gap:4px;align-items:center;font-size:12px;color:var(--on-sv);padding:4px 8px;min-height:32px;border-radius:var(--r-md)}
.cpick:hover,.cpick.open{background:var(--sv);color:var(--on-surface)}
.cpick.warn{color:var(--st-danger);font-weight:600}
.cpick svg{width:12px;height:12px}
.csend{display:grid;place-items:center;width:32px;height:32px;border-radius:var(--r-full);background:var(--primary);color:var(--on-primary);margin-left:4px}
.csend:hover{background:var(--primary-hover,var(--primary))}
.csend.stop{background:var(--on-surface)}
.csend svg{width:16px;height:16px}
.cbtn:focus-visible,.cpick:focus-visible,.csend:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.ccount{font-size:12px;color:var(--st-warning);font-variant-numeric:tabular-nums;margin-right:4px}
/* 選択肢の箱（モデル・考える強さ・許可のしかた・@ で指す）：押したボタンの側に寄せた小さな箱（2026-09-30 user「デカすぎる・デザインクソ」）。
   幅は中身なり（320px まで）、行は 30px・13px、説明は 11px。入力欄の幅いっぱいに広げない */
.cpop{position:absolute;right:8px;left:auto;width:max-content;max-width:min(320px,calc(100% - 16px));bottom:calc(100% + 6px);background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:0 8px 24px rgba(0,0,0,.12);padding:4px;display:flex;flex-direction:column;gap:1px;z-index:5;max-height:min(420px,60vh);overflow-y:auto}
.cpop>div{display:flex;gap:8px;align-items:baseline;min-height:30px;padding:5px 8px;border-radius:var(--r-sm);font-size:13px;cursor:pointer}
.cpop>div:hover{background:var(--sv)}
.cpop>div.on{background:var(--primary-c)}
.cpop>div b{white-space:nowrap;flex:none;font-weight:600}
.cpop>div span{color:var(--on-sv);font-size:11px}
.cpop>div.danger b{color:var(--st-danger)}
.cpop .sep{font-size:11px;color:var(--on-sv);padding:8px 8px 2px;border-top:1px solid var(--line);margin-top:4px}
.cpop .note{font-size:11px;color:var(--on-sv);padding:6px 8px 4px;max-width:280px}
.cpop .tg{margin-left:auto;width:32px;height:18px;border-radius:var(--r-full);background:var(--line);position:relative;flex:none}
.cpop .tg i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:var(--r-full);background:var(--card)}
.cpop .tg.on{background:var(--primary)}.cpop .tg.on i{left:16px}
.cqueue{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.cqueue>div{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--on-sv);background:var(--card);border:1px dashed var(--line);border-radius:var(--r-md);padding:4px 4px 4px 10px}
.cqueue svg{width:14px;height:14px}
.cqueue button{margin-left:auto;display:grid;place-items:center;min-width:24px;min-height:24px;border-radius:var(--r-sm)}
.rec{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--st-danger);margin-bottom:6px}
.rec span{flex:1;color:var(--on-surface)}
.chint{font-size:12px;color:var(--on-sv);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap}
.composer.compact{position:static;padding:8px 10px;border-top:1px solid var(--line-soft);background:var(--card)}
.composer.compact .cbox{border-radius:var(--r-lg);background:var(--surface)}
.composer.compact textarea{font-size:14px;min-height:32px}
.composer.compact .cpick .muted{display:none}
/* スマホは 16px（iPhone は 16px 未満の入力欄で勝手に拡大する・G14）。後ろに置く（同じ詳細度では後勝ち） */
@media(max-width:767px){.composer textarea,.composer.compact textarea{font-size:16px}}
/* この会話を記憶に使わない：入力欄の下の段（2026-09-30）。オンのときは入力欄の下に何が起きるかを出す */
.cmem{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px;border-radius:var(--r-md);font-size:12px;color:var(--on-sv);cursor:pointer;white-space:nowrap}
.cmem:hover{background:var(--sv);color:var(--on-surface)}
.cmem:has(input:focus-visible){outline:2px solid var(--primary);outline-offset:1px}
.cmem input{margin:0;accent-color:var(--primary)}
.cmem.on{color:var(--on-surface);font-weight:600}
.cmem-note{font-size:12px;color:var(--on-sv);margin-top:6px;padding-left:14px}
/* モデル・許可のしかたの箱（.cmenu）：Claude のモデルの箱と同じ形（2026-09-30）。名前 13px・太字、その下に説明 11px、選んでいるものは右端にチェック */
.cpop.cmenu{min-width:260px}
.cmenu>div[role=option]{display:grid;grid-template-columns:minmax(0,1fr) 16px;column-gap:12px;row-gap:1px;align-items:center;padding:6px 8px}
.cmenu>div[role=option] b{grid-column:1;font-size:13px;font-weight:600;white-space:normal}
.cmenu>div[role=option] span{grid-column:1;font-size:11px;line-height:1.5;color:var(--on-sv)}
.cmenu>div[role=option] svg{grid-column:2;grid-row:1/3;width:16px;height:16px;color:var(--primary)}
.cmenu>div[role=option].on{background:none}
.cmenu>div[role=option].on:hover,.cmenu>div[role=option]:hover{background:var(--sv)}
.cmenu>div.danger b{color:var(--st-danger)}
/* 考える強さ：箱の下の段の横並びの切り替え（Claude の「拡張思考」と同じ位置） */
/* 実装では選ぶ箱をいちばん上の層（popover）に出し、右パネル等の枠に切られないようにする。位置は入力欄の箱から決める */
.cpop[popover]{margin:0;color:var(--on-surface)}
/* 左の許可のしかたは左端から開く */
.cpop.left{left:8px;right:auto}
/* モデル・考える強さの箱（.cmodel）：Claude と同じく 1 行＝1 つ。名前の右にチェック（選んでいるもの）か数字（押すキー） */
.cpop.cmodel{min-width:220px}
.cmodel>div[role=option]{grid-template-columns:minmax(0,1fr) 20px;min-height:32px;padding:4px 8px}
.cmodel>div[role=option] b{font-weight:500;white-space:nowrap}
.cmodel>div[role=option].on b{font-weight:600}
.cmodel>div[role=option] svg{grid-row:1}
.cmodel kbd{grid-column:2;justify-self:center;font:400 12px/1 var(--font);color:var(--on-sv);min-width:16px;text-align:center;background:none;border:0;padding:0}
/* 考える強さは短い語だけなので細い箱 */
.cpop.cmodel.ceffort{min-width:168px}
"""

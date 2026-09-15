# -*- coding: utf-8 -*-
"""P1 はじめの設定（高本AIと作る）で共通の骨格。シェル無し・6段のウィザード。"""
from _icons import ic, LOGO
from _parts import *

WSTEPS = [("bridge-setup","PCをつなぐ"),("onboard-interview","話す"),("onboard-draft","たたき台"),
          ("credentials","ログイン情報"),("onboard-testrun","テスト"),("onboard-golive","本番へ")]

WIZ_CSS = AUTH_CSS + """
.ob{max-width:1120px;margin:0 auto;padding:26px 24px 80px}
.ob-top{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.ob-top .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;color:var(--primary)}
.ob-top .brand svg{width:20px;height:20px}
.chat{display:flex;flex-direction:column;gap:14px}
.msg{display:flex;gap:11px;align-items:flex-start;max-width:min(720px,100%)}
.chat{min-width:0}
.msg .av{width:30px;height:30px;border-radius:var(--r-full);display:grid;place-items:center;flex:none;font-size:12px;font-weight:700}
.msg.c .av{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.msg.u{margin-left:auto;flex-direction:row-reverse}
.msg.u .av{background:var(--primary);color:#fff}
.msg .bub{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:12px 15px;font-size:14px;line-height:1.85;min-width:0;max-width:100%;overflow-wrap:anywhere}
.msg .bub .t-wrap{margin:0;padding:0;overflow-x:auto}
.msg .bub table{min-width:0}
.msg.u .bub{background:var(--primary-c);border-color:transparent}
.msg .bub .who{font-size:11px;font-weight:600;color:var(--on-sv);margin-bottom:4px;letter-spacing:.04em}
.msg .bub .opts{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.msg .bub .opts button{border:1.5px solid var(--primary);color:var(--primary);border-radius:var(--r-full);padding:5px 13px;font-size:12.5px;font-weight:600}
.msg .bub .opts button:hover{background:var(--primary-c)}
.composer{position:sticky;bottom:0;background:var(--surface);padding:14px 0 0}
.composer .box{display:flex;gap:9px;align-items:flex-end;background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:10px 12px}
.composer textarea{flex:1;border:0;background:none;font:inherit;font-size:14px;resize:none;min-height:24px}
.composer textarea:focus-visible{outline:none}
.composer:focus-within{outline:2px solid var(--primary);outline-offset:2px}
.learn{position:sticky;top:50px}
.learn .it{display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line-soft);font-size:13px}
.learn .it svg{color:var(--st-success);margin-top:3px}
.learn .it .k{font-size:11.5px;color:var(--on-sv)}
.draft{display:grid;gap:16px}
@media(min-width:768px){.draft{grid-template-columns:1fr 1fr}}
.draft .card h2{display:flex;align-items:center;gap:8px}
.dl{display:flex;flex-direction:column;gap:8px;font-size:13.5px}
.dl>div{display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--surface);border-radius:var(--r-md);flex-wrap:wrap}
.dl>div>*{min-width:0}
.dl .u{font-size:11.5px;color:var(--on-sv);background:var(--sv);padding:1px 8px;border-radius:var(--r-full);white-space:nowrap}
.dl .diff{border-left:3px solid var(--tertiary);background:var(--tertiary-c)}
.dl .del{opacity:.7;text-decoration:line-through}
"""

def wiz(active, inner, title, sub="", brand=True):
    bar = ""
    idx = [w[0] for w in WSTEPS].index(active)
    for i, (sid, lb) in enumerate(WSTEPS):
        cls = "done" if i < idx else ("on" if i == idx else "")
        bar += f'<div class="{cls}"><a href="v1-{sid}.html" style="display:block">{i+1}. {lb}</a></div>'
    top = (f'<div class="ob-top"><div class="brand">{LOGO}Kaname</div>'
           f'<span class="muted" style="font-size:12.5px">はじめの設定 ── PCをつないで、高本AIと作る</span></div>') if brand else ""
    return (f'<div class="ob">{top}'
            f'<div class="wiz-steps">{bar}</div>'
            f'<h1 style="font-size:22px;font-weight:700;margin-bottom:6px">{title}</h1>'
            f'<div class="muted" style="font-size:13.5px;margin-bottom:20px;line-height:1.8">{sub}</div>{inner}</div>')

def cmsg(text, opts=None, who="高本AI"):
    o = f'<div class="opts">{"".join(f"<button>{x}</button>" for x in opts)}</div>' if opts else ""
    return f'<div class="msg c"><div class="av">{ic("clone")}</div><div class="bub"><div class="who">{who}</div>{text}{o}</div></div>'
def umsg(text, av="高"):
    return f'<div class="msg u"><div class="av">{av}</div><div class="bub">{text}</div></div>'
CHAT_OPEN = '<div class="col"><div class="chat">'   # 会話の列の開き。閉じは chat_close()。入力欄が別セルに落ちない
def chat_close(composer_html): return '</div>' + composer_html + '</div>'

def convo_col(messages_html, composer_html):
    """会話と入力欄は必ず1つの列。入力欄だけが別セルに落ちる事故（2026-09-10・6か所）を構造で潰す。"""
    return f'<div class="col"><div class="chat">{messages_html}</div>{composer_html}</div>'

def composer(ph="ここに書く。声で話しても、資料を投げても構いません"):
    return (f'<div class="composer"><div class="box">{btn("","g","upload")}<textarea placeholder="{ph}"></textarea>'
            f'<button class="btn btn-p btn-sm">{ic("send")}送る</button></div>'
            f'<div class="muted" style="font-size:11.5px;margin-top:6px">ファイルは形式を選びません。名刺・請求書・スプレッドシート・議事録、何でも読みます。</div></div>')

# ============================================================ 会話の部品（D-066）。会話モード・右パネル・はじめの設定で同じものを使う
CHAT_PARTS_CSS = """
.opts .alt{border-style:dashed;color:var(--on-sv)}
.chat,.chat *,.composer,.composer *{min-width:0}
.slash{flex-wrap:wrap}
.chat{overflow-wrap:anywhere}   /* メール・URL・金額などの切れない文字列で吹き出しが画面幅を超えない */
.mact{display:flex;gap:2px;margin-top:6px;flex-wrap:wrap}
.mact button{color:var(--on-sv);min-height:26px;padding:2px 7px;border-radius:var(--r-sm);display:inline-flex;align-items:center;gap:4px}
.mact button:hover{background:var(--sv);color:var(--on-surface)}
.opts button:hover,.branch button:hover{background:var(--primary-c);color:var(--on-primary-c)}
.branch button{min-width:24px;min-height:24px;border-radius:var(--r-sm)}
.msg:hover .mact{opacity:1}
.mact button{font-size:11px;color:var(--on-sv);padding:3px 7px;border-radius:var(--r-md);display:inline-flex;gap:4px;align-items:center}
.mact button svg{width:12px;height:12px}
.mact button:hover{background:var(--sv);color:var(--on-surface)}
.cite{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;background:var(--sv);color:var(--on-sv);padding:2px 8px;min-height:24px;border-radius:var(--r-full);margin:0 2px;vertical-align:middle}
.cite:hover{background:var(--primary-c);color:var(--on-primary-c)}
.conf{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--r-full);margin-top:8px}
.conf.hi{background:#DCFCE7;color:var(--st-success)}.conf.lo{background:#FEF6EC;color:var(--st-warning)}
.typing{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--on-sv)}
.typing .dots i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--neutral);margin-right:3px;animation:tp 1s infinite}
.typing .dots i:nth-child(2){animation-delay:.2s}.typing .dots i:nth-child(3){animation-delay:.4s}
@keyframes tp{0%,80%,100%{opacity:.3}40%{opacity:1}}
.daysep{display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--on-sv);margin:4px 0}
.daysep::before,.daysep::after{content:"";flex:1;height:1px;background:var(--line)}
.unread{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--st-danger);font-weight:600}
.unread::before,.unread::after{content:"";flex:1;height:1px;background:var(--st-danger)}
.tolatest{position:sticky;bottom:96px;align-self:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r-full);padding:6px 14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.readby{font-size:11px;color:var(--on-sv);text-align:right;margin-top:3px}
.receipt{border:1px solid var(--line);border-left:3px solid var(--st-success);border-radius:0 var(--r-md) var(--r-md) 0;padding:10px 13px;margin-top:10px;background:#F4FBF6;font-size:13px}
.receipt .rh{display:flex;gap:8px;align-items:center;font-weight:700;margin-bottom:6px}
.receipt .rh svg{color:var(--st-success)}
.attlist{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.attlist span{display:inline-flex;gap:6px;align-items:center;font-size:12px;background:var(--sv);padding:4px 9px;border-radius:var(--r-md)}
.attlist span svg{width:13px;height:13px}
.slashpop{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:6px;margin-bottom:8px;box-shadow:0 4px 16px rgba(0,0,0,.08)}
.slashpop div{display:flex;gap:10px;align-items:center;padding:7px 9px;border-radius:var(--r-md);font-size:13px}
.slashpop div.on{background:var(--primary-c)}
.slashpop div b{font-family:var(--font-code);font-size:12px;min-width:70px}
.slashpop div span{color:var(--on-sv);font-size:12px}
.slashpop div.on span{color:var(--on-primary-c)}
.chint{font-size:11px;color:var(--on-sv);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap}
.chint kbd{font-family:var(--font-code);font-size:11px;background:var(--sv);padding:1px 5px;border-radius:3px}
.errbar{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:var(--r-md);font-size:13px;line-height:1.7;margin-bottom:12px}
.errbar.off{background:#FEF6EC;color:#7A4A05}.errbar.fail{background:#FDF2F2;color:var(--error)}
.errbar svg{margin-top:3px;flex:none}
.auto{border:1px dashed var(--tertiary);background:var(--tertiary-c);border-radius:var(--r-md);padding:11px 13px;font-size:13px;margin-top:10px}
.cap{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));margin-top:12px}
.cap div{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:12px 14px;font-size:12.5px;line-height:1.7}
.cap b{display:block;font-size:12px;color:var(--on-sv);margin-bottom:4px}
"""

def cmsg(text, opts=None, who="高本AI", other=True, actions=True, conf=None, read=None):
    """自分のAIの吹き出し。質問には選択肢＋「その他（自由に書く）」「あとで」を必ず付ける（D-066）。"""
    o = ""
    if opts:
        chips = "".join(f"<button>{x}</button>" for x in opts)
        if other: chips += '<button class="alt">その他（自由に書く）</button><button class="alt">あとで</button>'
        o = f'<div class="opts">{chips}</div>'
    c = f'<div class="conf {"hi" if conf=="hi" else "lo"}">{ic("check") if conf=="hi" else ic("alert")}{"自信：高" if conf=="hi" else "自信：要確認 ── 根拠を見て決めてください"}</div>' if conf else ""
    a = (f'<div class="mact"><button>{ic("file")}コピー</button><button>{ic("repeat")}もう一度</button><button>{ic("route")}ここから分岐</button>'
         f'<button>{ic("brain")}記憶に入れる</button><button>{ic("eye")}根拠を見る</button></div>') if actions else ""
    return f'<div class="msg c"><div class="av">{ic("clone")}</div><div><div class="bub"><div class="who">{who}</div>{text}{c}{o}</div>{a}</div></div>'

def umsg(text, av="高", actions=True, read=None):
    a = f'<div class="mact" style="justify-content:flex-end"><button>{ic("pen")}編集して送り直す</button><button>{ic("file")}コピー</button></div>' if actions else ""
    r = f'<div class="readby">{read}</div>' if read else ""
    return f'<div class="msg u"><div class="av">{av}</div><div><div class="bub">{text}</div>{r}{a}</div></div>'

def cite(n, label): return f'<a class="cite" href="#" title="押すと右で開く">{n} {label}</a>'
def daysep(t): return f'<div class="daysep">{t}</div>'
def unread(n): return f'<div class="unread">ここから未読 {n}件</div>'
def to_latest(): return f'<button class="tolatest">{ic("down")} 最新へ</button>'
def typing(stage, stop=True):
    s = f'<button class="btn btn-o btn-sm">{ic("pause")}停止</button>' if stop else ""
    return f'<div class="msg c"><div class="av">{ic("clone")}</div><div class="bub"><div class="typing"><span class="dots"><i></i><i></i><i></i></span><span>{stage}</span>{s}</div></div></div>'
def receipt(title, rows, undo="取り消す"):
    body = "".join(f'<div style="display:flex;gap:10px"><span class="muted" style="min-width:64px">{k}</span><span>{v}</span></div>' for k, v in rows)
    return (f'<div class="receipt"><div class="rh">{ic("check")}{title}</div>{body}'
            f'<div style="display:flex;gap:8px;margin-top:8px">{btn(undo,"o","undo")}{btn("証跡を見る","g","log","v1-audit.html")}</div></div>')
def errbar(kind, text, buttons=""):
    return f'<div class="errbar {kind}">{ic("warn" if kind=="fail" else "bridge")}<div>{text}<div style="display:flex;gap:8px;margin-top:8px">{buttons}</div></div></div>'
def autonomy(text, buttons=""):
    return f'<div class="auto"><div style="display:flex;gap:8px;align-items:center;font-weight:700;margin-bottom:4px">{ic("zap")}自動にしますか？</div>{text}<div style="display:flex;gap:8px;margin-top:8px">{buttons}</div></div>'
def capabilities():
    return ('<div class="cap">'
      '<div><b>できること</b>AI社員に配る／数値を答える（台帳と目標から）／承認待ちをその場で押す／あなたの考え方を覚える／台帳・記憶・証跡を探す</div>'
      '<div><b>できないこと</b>承認なしで外に出す（メール・請求書・投稿）／資格情報を読む／銀行をブラウザで触る／CAPTCHA を突破する／PC が閉じている間に動く</div>'
      '<div><b>入口</b><span style="font-family:var(--font-code)">/配る /数値 /覚えて /承認待ち /探す</span>、<span style="font-family:var(--font-code)">@経理社員</span> で直接渡す、声で話す、ファイルを投げる</div></div>')
def composer3(ph="聞く・頼む・相談する", voice=False, atts=None, slash=False, disabled=None):
    rec = f'<div class="rec">{ic("pause")}録音中 0:07<div class="wave"></div>{btn("止めて送る","d","check")}</div>' if voice else ""
    al = ('<div class="attlist">' + "".join(f'<span>{ic("file")}{a}<button title="外す">{ic("x")}</button></span>' for a in atts) + '</div>') if atts else ""
    sp = ('<div class="slashpop">' + "".join(f'<div class="{"on" if i==0 else ""}"><b>{c}</b><span>{d}</span></div>' for i,(c,d) in enumerate([("/配る","AI社員に仕事を渡す"),("/数値","台帳と目標から答える"),("/覚えて","記憶に入れる"),("/承認待ち","いま押せるもの"),("/探す","台帳・記憶・証跡")])) + '</div>') if slash else ""
    dis = ' disabled placeholder="PC が閉じているので送れません。起きたら続きから"' if disabled else f' placeholder="{ph}"'
    return (f'<div class="composer">{rec}{sp}<div class="slash"><span>/配る</span><span>/数値</span><span>/覚えて</span><span>/承認待ち</span><span>/探す</span><span>@AI社員</span></div>'
            f'<div class="box">{al and ""}{btn("","g","upload")}<div style="flex:1;min-width:0">{al}<textarea{dis}></textarea></div>'
            f'<button class="btn btn-g btn-sm" title="声で話す">{ic("chat")}</button><button class="btn btn-p btn-sm"{" disabled" if disabled else ""}>{ic("send")}送る</button></div>'
            f'<div class="chint"><span><kbd>Enter</kbd> 送る（変換中は送らない）</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> 改行</span><span><kbd>/</kbd> コマンド</span><span><kbd>@</kbd> AI社員に直接</span><span>下書きは残ります</span><span>外に出るものは必ず承認を挟みます</span></div></div>')

WIZ_CSS = WIZ_CSS + CHAT_PARTS_CSS   # 会話の部品の見た目は WIZ_CSS を使う全画面に入る

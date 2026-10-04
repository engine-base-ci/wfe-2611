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
.learn{position:sticky;top:50px}
.wiz-next{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;gap:14px;margin-top:22px;padding:12px 0;background:var(--surface);border-top:1px solid var(--line)}
.wiz-next .muted{font-size:13px;margin-right:auto}
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

# 下の帯（D-116）：次の段へ進む主ボタンは 1 つだけ、画面の下に常に見える（スクロールしても消えない）。
# 進めないときは、何をすれば進めるかを帯に書く。帯を出すのは はじめの設定の枠の段（1〜3）。4 は設定の画面のまま（D-116.3）
WIZ_NEXT = {"bridge-setup": ("次へ：2. 話す", "v1-onboard-interview.html"),
            "onboard-interview": ("次へ：3. たたき台", "v1-onboard-draft.html"),
            "onboard-draft": ("これでいく（次：4. ログイン情報）", "v1-credentials.html"),
            # 5 テスト ができた（T-U-11）。6 本番へ はまだ無い（AI社員を動かす仕組みと一緒に作る）。まだ無いものを隠さず、5 の帯からいま使える所へ送る（D-089.6）
            "credentials": ("次へ：5. テスト", "v1-onboard-testrun.html")}
NEXT_NOTE = {"onboard-testrun": "次の「6. 本番へ」からは、AI社員を動かす仕組みと一緒に作っています（まだ使えません）。切り替えたら、いま使える画面へ移ります。"}
def next_bar(label, href=None, hint=""):
    b = (f'<a class="btn btn-p" href="{href}">{ic("check")}{label}</a>' if href
         else f'<span class="btn btn-p" aria-disabled="true" style="opacity:.5;cursor:not-allowed">{label}</span>')
    return f'<div class="wiz-next" data-wiz-next><span class="muted">{hint}</span>{b}</div>'

def wiz(active, inner, title, sub="", brand=True, wait=None):
    """wait：まだ進めない状態なら、何をすれば進めるか（帯のボタンを押せない形にして、その文を出す）"""
    bar = ""
    idx = [w[0] for w in WSTEPS].index(active)
    for i, (sid, lb) in enumerate(WSTEPS):
        cls = "done" if i < idx else ("on" if i == idx else "")
        bar += f'<div class="{cls}"><a href="v1-{sid}.html" style="display:block">{i+1}. {lb}</a></div>'
    top = (f'<div class="ob-top"><div class="brand">{LOGO}Kaname</div>'
           f'<span class="muted" style="font-size:12.5px">はじめの設定 ── PCをつないで、高本AIと作る</span></div>') if brand else ""
    nx = WIZ_NEXT.get(active)
    nb = (next_bar(nx[0], None, wait) if wait else next_bar(nx[0], nx[1], NEXT_NOTE.get(active, ""))) if nx else ""
    return (f'<div class="ob">{top}'
            f'<div class="wiz-steps">{bar}</div>'
            f'<h1 style="font-size:22px;font-weight:700;margin-bottom:6px">{title}</h1>'
            f'<div class="muted" style="font-size:13.5px;margin-bottom:20px;line-height:1.8">{sub}</div>{inner}{nb}</div>')

CHAT_OPEN = '<div class="col"><div class="chat">'   # 会話の列の開き。閉じは chat_close()。入力欄が別セルに落ちない
def chat_close(composer_html): return '</div>' + composer_html + '</div>'

def convo_col(messages_html, composer_html):
    """会話と入力欄は必ず1つの列。入力欄だけが別セルに落ちる事故（2026-09-10・6か所）を構造で潰す。"""
    return f'<div class="col"><div class="chat">{messages_html}</div>{composer_html}</div>'

# 入力欄は _composer.chat_composer の 1 つだけ（D-103）。ここでは定義しない
from _composer import chat_composer, COMPOSER_CSS

# ============================================================ 会話の部品（D-104）。会話モード・右パネル・はじめの設定で同じもの（_chat.py）
from _chat import *   # umsg / cmsg / staff / work_live / work_done / qcard / perm_card / stopped / memo_line / usage_bar / 書式の見本 / CHAT_CSS
CHAT_PARTS_CSS = CHAT_CSS + """
.receipt{border:1px solid var(--line);border-left:3px solid var(--st-success);border-radius:0 var(--r-md) var(--r-md) 0;padding:10px 14px;margin-top:10px;background:var(--st-success-c);font-size:14px}
.receipt .rh{display:flex;gap:8px;align-items:center;font-weight:600;margin-bottom:6px}
.receipt .rh svg{color:var(--st-success)}
.errbar{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:var(--r-md);font-size:14px;line-height:1.7;margin-bottom:12px}
.errbar.off{background:var(--st-warning-c);color:var(--on-st-warning-c)}.errbar.fail{background:var(--st-danger-c);color:var(--on-st-danger-c)}
.errbar svg{margin-top:4px;flex:none}
.auto{border:1px dashed var(--tertiary);background:var(--tertiary-c);border-radius:var(--r-md);padding:10px 14px;font-size:14px;margin-top:10px}
.cap{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));margin-top:12px}
.cap div{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:12px 14px;font-size:14px;line-height:1.7}
.cap b{display:block;font-size:12px;color:var(--on-sv);margin-bottom:4px}
"""
# 互換（D-104 で置かないもの）：日付の区切り・未読の線・読んだ印は出さない。最新へ＝いちばん下へ
def daysep(t): return ""
def unread(n): return ""
def to_latest(): return to_bottom()
def typing(stage, stop=True): return work_live(stage)
def progress(lines): return work_live(lines[-1] if lines else "動いています", tools=[(x.split("：")[0].replace("「","").replace("」を使っています",""), x.split("：")[-1], "", True) for x in lines[:-1]])
def stopped_msg(reason, who="高本AI"): return stopped(reason)
def ask_msg(summary, detail, who="高本AI"): return perm_card(summary, detail)
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
      '<div><b>入口</b>@ で目標・タスク・人・AI社員・記憶を指す／声で話す／資料や画像を付ける／使うもの（スキル・道具）を入力欄で選ぶ</div></div>')


WIZ_CSS = WIZ_CSS + CHAT_PARTS_CSS + COMPOSER_CSS   # 会話の部品の見た目は WIZ_CSS を使う全画面に入る
# 会話の固定枠（D-072）。モックの台本は枠の下の兄弟しか引かないので、.ob の下の余白を打ち消す（実装は frame.tsx が実測する）
WIZ_CSS = WIZ_CSS + FRAME_CSS + "@media(min-width:1024px){[data-chat-frame]{margin-bottom:-64px}}"

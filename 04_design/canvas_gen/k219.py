"""K-219：キャンバスに絵が無い状態の絵を起こす（13 枚＋使えない形の見本＋「あとで」を置いた絵）。

近い絵を読み込んで写し、見出し・文・ボタン・箱の色だけを替えて書き出す。値は近い絵と正本（DESIGN-kaname.md）の段だけを使う。
書き出した後に shellfix.py（左のバー・上の帯・行き先・値の段のそろえ）を回す。shellfix が全部の画面に同じに掛ける所のうち、
この絵だけ違うもの（承認待ちが空の絵のバーの印と今いる所・はじめて入ったときの絵のバー）は、shellfix.py が最後に after_shellfix() を呼んで直す。
canvas.json・対応表（canvas-screens.json）・突き合わせの設定（fidelity.json）・持ち主のチケットの頭（canvas）も、ここで足す。
何度流しても同じになる。

  cd 04_design/canvas_gen && python3 k219.py
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import P, btn, icon, load  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MUTED = "#4A5563"


def save(name, title, s):
    s = s.replace(re.search(r"<title>.*?</title>", s).group(0), "<title>%s</title>" % title, 1)
    with open(P + name + ".dc.html", "w", encoding="utf-8") as f:
        f.write(s)


def block_end(s, start, tag):
    """s[start] から始まる <tag …> の閉じタグの終わりの位置（入れ子を数える）"""
    depth = 0
    for m in re.compile(r"<(/?)%s\b[^>]*>" % tag).finditer(s, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.end()
    raise ValueError("閉じタグが無い：%s" % tag)


def replace_block(s, opener, new, tag="div"):
    i = s.index(opener)
    return s[:i] + new + s[block_end(s, i, tag):]


# ---------- 共通の部品（近い絵と同じ値） ----------
SPIN = ('<span aria-hidden="true" style="width: 16px; height: 16px; flex: none; border-radius: 9999px; border: 2px solid #DDE2E9; '
        'border-top-color: #22345C; box-sizing: border-box; display: inline-block"></span>')
CARD = ('<div style="width: 100%; max-width: 440px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; padding: 26px 28px; '
        'box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">')
TITLE = '<b style="font-size: 18px; text-align: center">%s</b>'
LEAD = '<div style="font-size: 13px; color: #4A5563; text-align: center; line-height: 1.7">%s</div>'
PRIMARY = ('<a href="%s" style="height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; '
           'text-decoration: none; font-size: 14px; font-weight: 500; background: #22345C; color: #FFFFFF">%s</a>')
WARN = ('<div style="background: #FFF8EE; border: 1px solid #F3D3A7; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #7A4A05; '
        'line-height: 1.7">%s</div>')
INFO = '<div style="background: #F7F8FA; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #4A5563; line-height: 1.7">%s</div>'
WAITING = ('<div role="status" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: #4A5563">'
           + SPIN + '<span>%s</span></div>')
CENTER = '<div style="display: flex; justify-content: center">%s</div>'
CARD_OPEN = re.compile(r'<div style="width: 100%; max-width: 4\d0px; background: #FFFFFF;')


def auth_board(ref, name, title, inner):
    """入口の箱（x-dc > div > div:nth-of-type(2)）の中身を替える。箱は登録の画面と同じ形にそろえる"""
    s = load(ref + ".dc.html")
    opener = CARD_OPEN.search(s).group(0)
    s = replace_block(s, opener, CARD + inner + "</div>")
    save(name, title, s)


def auth_boards():
    auth_board("AuthVerify", "AuthVerifying", "確認しています",
               TITLE % "確認しています" + WAITING % "登録を確定しています…")
    auth_board("ErrLinkExpired", "AuthVerifyExpired", "メールの確認 期限切れ",
               CENTER % icon("期", "#B45309", 44) + TITLE % "リンクの期限が切れました"
               + WARN % "リンクの期限が切れました。もう一度登録してください" + PRIMARY % ("AuthSignup.dc.html", "もう一度登録する"))
    auth_board("AuthVerify", "AuthVerifyUsed", "メールの確認 使用済み",
               CENTER % icon("✓", "#166534", 44) + TITLE % "登録は終わっています"
               + INFO % "このメールアドレスの登録は確認まで終わっています。ログインしてください" + PRIMARY % ("AuthLogin.dc.html", "ログイン"))
    terms = ('<div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 4px 12px; font-size: 13px">'
             '<div style="display: flex; align-items: center; padding: 8px 0"><a href="https://kaname.example/terms" target="_blank" rel="noopener" style="flex: 1">利用規約</a>'
             '<span style="font-size: 12px; color: #4A5563">11/01 の版</span></div>'
             '<div style="display: flex; align-items: center; padding: 8px 0; border-top: 1px solid #EDF0F4"><a href="https://kaname.example/privacy" target="_blank" rel="noopener" style="flex: 1">プライバシーポリシー</a>'
             '<span style="font-size: 12px; color: #4A5563">11/01 の版</span></div></div>'
             '<label style="display: flex; gap: 8px; align-items: center; font-size: 13px"><input type="checkbox">利用規約とプライバシーポリシーに同意します</label>')
    auth_board("AuthVerify", "AuthConsent", "規約の同意",
               TITLE % "利用規約とプライバシーポリシーが新しくなりました" + LEAD % "新しい版を読んで同意してから、続けてください" + terms
               + PRIMARY % ("Main.dc.html", "同意して続ける")
               + '<button type="button" style="height: 36px; border: 0; background: transparent; color: #4A5563; font-size: 13px">ログアウト</button>')
    auth_board("AuthSignup", "AuthChecking", "アカウントを作る 確かめ中",
               TITLE % "アカウントを作る" + WAITING % "確かめています…")
    auth_board("AuthVerify", "AuthVerifyLoading", "確認メールを送りました 読み込み中",
               TITLE % "確認メールを送りました" + WAITING % "読み込んでいます…")


# 帯の 4 枚（StBefore・StConfirmDone・StDone・StDelegated）と完了の小窓（StCompleteModal）の持ち主は k257.py（詳細の形にそろえて起こし直した・K-257）


# ---------- 承認待ちが空（Approvals から） ----------
def approvals_empty():
    s = load("Approvals.dc.html")
    s = s.replace('<span style="color: #4A5563">あなたが決めるもの 9 件</span>', '<span style="color: #4A5563">あなたが決めるもの 0 件</span>', 1)
    s = re.sub(r'\n    <a href="ApprovalsFocus\.dc\.html"[^>]*>続けて裁く（9 件）</a>', "", s, count=1)
    empty = ('<div style="padding: 16px 24px; display: flex; flex-direction: column; gap: 12px">\n'
             # 空の箱は正本の state-empty（地 card・1px dashed line-strong・角丸 lg・余白 36px 28px・間 12px）
             '   <section data-part="state-empty" style="background: #FFFFFF; border: 1px dashed #B8C0CC; border-radius: 12px; padding: 36px 28px; '
             'display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center">'
             + icon("✓", "#166534", 44)
             + '<b style="font-size: 16px">いま決めるものはありません</b>'
             '<div style="font-size: 13px; color: #4A5563; max-width: 460px; line-height: 1.7">AI が成果物を作り、確かめが終わると、ここに並びます</div>'
             + btn("決めた履歴", "", "ApHistory.dc.html") + "</section>\n  </div>")
    s = replace_block(s, '<div style="padding: 16px 24px; display: flex; flex-direction: column; gap: 12px">', empty)
    save("ApEmpty", "承認待ち 空", s)


# この PC に Bridge が入っている（MePCInstalled）の持ち主は k257.py（画面に在る操作を描き足した・K-257）


# ---------- 使えない形の見本（OnLoading の外枠に） ----------
GRAY = 'aria-disabled="true" title="%s" style="%s; opacity: 0.55; cursor: not-allowed"'


def disabled_sample():
    s = load("OnLoading.dc.html")
    btn_st = "height: 30px; border-radius: 6px; border: 1px solid #22345C; background: #22345C; color: #FFFFFF; padding: 0 12px; font-size: 12px; font-weight: 500"
    sel_st = "height: 30px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 8px; font-size: 12px; background: #FFFFFF; color: #131B27"
    srch_st = "height: 30px; width: 220px; border: 1px solid #DDE2E9; border-radius: 9999px; padding: 0 12px; font-size: 12px; background: #F7F8FA; box-sizing: border-box"
    item_st = "display: flex; align-items: center; height: 32px; padding: 0 10px; border-radius: 6px; text-decoration: none; color: #131B27"
    tab_st = "padding: 8px 12px; border-bottom: 2px solid transparent; color: #4A5563; text-decoration: none"
    why = "まだ使えません"

    def area(kind, label, ok, ng):
        return ('<div data-kind="%s" style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">'
                '<b style="font-size: 15px">%s</b>'
                '<div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start">'
                '<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; color: #4A5563">使える形</span>%s</div>'
                '<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; color: #4A5563">使えない形（薄く・押せない）</span>%s</div>'
                "</div></div>") % (kind, label, ok, ng)

    areas = "".join([
        area("button", "ボタン", '<button type="button" style="%s">AI に任せる</button>' % btn_st,
             '<button type="button" %s>AI に任せる</button>' % (GRAY % (why, btn_st))),
        area("select", "選ぶ欄", '<select style="%s"><option>高本 聖斗</option></select>' % sel_st,
             '<select %s><option>高本 聖斗</option></select>' % (GRAY % (why, sel_st))),
        area("search", "探す欄", '<input type="search" placeholder="チケットを探す" style="%s">' % srch_st,
             '<input type="search" placeholder="チケットを探す" %s>' % (GRAY % (why, srch_st))),
        area("menuitem", "メニューの項目",
             '<div role="menu" style="width: 200px; border: 1px solid #DDE2E9; border-radius: 10px; padding: 6px"><a role="menuitem" href="TdDuplicate.dc.html" style="%s">複製する</a></div>' % item_st,
             '<div role="menu" style="width: 200px; border: 1px solid #DDE2E9; border-radius: 10px; padding: 6px"><a role="menuitem" %s>ほかのグループへ移す</a></div>' % (GRAY % (why, item_st))),
        area("tab", "見え方のタブ",
             '<div role="tablist" style="display: flex; gap: 2px"><a role="tab" aria-selected="true" href="Main.dc.html" style="padding: 8px 12px; border-bottom: 2px solid #22345C; color: #22345C; font-weight: 500; text-decoration: none">一覧</a></div>',
             '<div role="tablist" style="display: flex; gap: 2px"><a role="tab" %s>ガント</a></div>' % (GRAY % (why, tab_st))),
    ])
    page = ('<header style="background: #FFFFFF; border-bottom: 1px solid #DDE2E9">\n'
            '   <div style="display: flex; align-items: center; gap: 10px; padding: 12px 24px; flex-wrap: wrap">\n'
            '    <h1 style="font-size: 18px; margin: 0">使えない形の見本</h1>\n'
            '    <span style="color: #4A5563">まだ使えない物も隠さず、薄くして押せなくする</span>\n'
            '   </div>\n  </header>\n'
            '  <div style="padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 900px">' + areas + "</div>\n ")
    i = s.index("<header", s.index('class="kn-bar"'))
    j = s.rindex("</main>")
    s = s[:i] + page + s[j:]
    save("UiDisabled", "使えない形の見本", s)


# ---------- はじめにやること に「あとで」（OnHome から） ----------
def home_later():
    s = load("OnHome.dc.html")
    s = s.replace('<span style="font-size: 12px; color: #4A5563">1 ／ 3</span>', '<span style="font-size: 12px; color: #4A5563">0 ／ 2</span>', 1)
    s = s.replace('<div style="width: 33%; height: 100%; border-radius: 9999px; background: #166534"></div>',
                  '<div style="width: 0%; height: 100%; border-radius: 9999px; background: #166534"></div>', 1)
    old = re.search(r'<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #EDF0F4"><span[^>]*>✓</span>'
                    r'<span style="flex: 1"><b[^>]*>パスキーを付ける</b><span[^>]*>[^<]*</span></span></div>', s)
    if old:
        new = ('<div aria-disabled="true" title="まだ付けられません" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #EDF0F4; opacity: 0.55; cursor: not-allowed">'
               '<span style="width: 22px; height: 22px; flex: none; border-radius: 9999px; display: grid; place-items: center; font-size: 12px; border: 2px solid #B8C0CC; box-sizing: border-box"></span>'
               '<span style="flex: 1"><b style="font-weight: 600; display: block; ">パスキーを付ける</b>'
               '<span style="font-size: 12px; color: #4A5563; line-height: 1.6">まだ付けられません。数には入れていません</span></span></div>')
        s = s.replace(old.group(0), new, 1)
    later = ('<button type="button" style="height: 30px; border-radius: 6px; padding: 0 10px; font-size: 12px; border: 0; background: transparent; color: #4A5563">あとで</button>')
    keep = re.search(r'(<a href="MeSecretAdd\.dc\.html" style="[^"]*">預ける</a>)(</div>)', s)
    if keep:
        s = s.replace(keep.group(0), '<span style="display: flex; gap: 4px; flex: none">' + keep.group(1) + later + "</span>" + keep.group(2), 1)
    save("OnHomeLater", "はじめにやること あとで", s)


# ---------- shellfix のあと、この絵だけ違う所 ----------
BADGE = re.compile(r'<b class="kn-lbl" style="margin-left: auto; font-size: 11px; background: #B45309; color: #FFFFFF; border-radius: 9999px; padding: 0 7px">\d+</b>')
NAV = re.compile(r' <nav aria-label="メニュー".*?</nav>\n', re.S)


def after_shellfix():
    """shellfix.py の最後から呼ぶ（絵が無い木では何もしない）"""
    if not all(os.path.exists(P + n + ".dc.html") for n in ("Approvals", "ApEmpty", "OnHome", "OnHomeLater")):
        return
    ap = load("Approvals.dc.html")
    s = load("ApEmpty.dc.html")
    s = NAV.sub(lambda _m: BADGE.sub("", NAV.search(ap).group(0)), s, count=1)
    with open(P + "ApEmpty.dc.html", "w", encoding="utf-8") as f:
        f.write(s)
    # はじめて入ったときのバー（件数 0・印なし・PC がまだ）は OnHome と同じ物を写す（edwire.firsttime は値の段をそろえる前の形にしか当たらない）
    home = load("OnHome.dc.html")
    s = load("OnHomeLater.dc.html")
    s = NAV.sub(lambda _m: NAV.search(home).group(0), s, count=1)
    with open(P + "OnHomeLater.dc.html", "w", encoding="utf-8") as f:
        f.write(s)


# ---------- 置き場の表 ----------
# 絵: (近い絵, page, 画面 か "common", title, 組 (id, 種類, 画面の道, 持ち主, 組を写す元) か None)
BOARDS = {
    "AuthVerifying": ("AuthVerify", "auth", "verify-email", "メールの確認・確定中 ← 確認メールのリンクを押した", ("verify-confirming", "doc", "/verify-email", "K-256", "signup-waiting")),
    "AuthVerifyExpired": ("ErrLinkExpired", "auth", "verify-email", "メールの確認・期限切れ ← 30 分を過ぎたリンクを押した", ("verify-expired", "auth-msg", "/verify-email", "K-256", "signup-waiting")),
    "AuthVerifyUsed": ("AuthVerify", "auth", "verify-email", "メールの確認・使用済み ← 確定した後にもう一度リンクを押した", ("verify-used", "auth-msg", "/verify-email", "K-256", "signup-waiting")),
    "AuthConsent": ("AuthVerify", "auth", "login", "規約の同意 ← ログインの続き（規約が新しくなった）", ("consent-terms", "auth-msg", "/login?step=terms", "K-256", "signup-waiting")),
    "AuthChecking": ("AuthSignup", "auth", "signup", "登録・確かめ中 ← アカウントを作るを開いた直後", ("signup-checking", "doc", "/signup", "K-255", "signup-waiting")),
    "AuthVerifyLoading": ("AuthVerify", "auth", "verify-email", "確認メールを送りました・読み込み中 ← 登録の次へを押した直後", ("signup-waiting-loading", "doc", "/verify-email", "K-255", "signup-waiting")),
    "ApEmpty": ("Approvals", "approvals", "approvals", "承認待ち・空 ← 決めるものが無いとき", ("approvals-empty", "page", "/approvals", "K-231", "approvals")),
    "UiDisabled": ("OnLoading", "on", "common", "使えない形の見本 ← どの画面でも（まだ使えない物は薄く押せない）", None),
    "OnHomeLater": ("OnHome", "on", "tickets", "はじめにやること に「あとで」 ← はじめて入ったとき", None),
}

# 絵の持ち主は k257.py に移したが、見比べの 1 枚（K-219.html）の区画は残す（流し直しても見比べが変わらない・K-257）。並びは元の表の順
MOVED = {
    "StBefore": ("StRunning", "states", "tickets", "帯・任せる前 ← チケットを作った直後", ("band-before", "band", "/tickets/{ticket}", "K-228", "band-running")),
    "StConfirmDone": ("StRunning", "states", "tickets", "帯・完了の確かめ ← 実行が終わって承認待ちが無い", ("band-confirm-done", "band", "/tickets/{ticket}", "K-228", "band-running")),
    "StDone": ("StRunning", "states", "tickets", "帯・完了 ← 完了にした", ("band-done", "band", "/tickets/{ticket}", "K-228", "band-running")),
    "StDelegated": ("StRunning", "states", "tickets", "帯・任せました（作る段） ← AI に任せるを押した", ("band-delegated", "band", "/tickets/{ticket}", "K-228", "band-running")),
    "StCompleteModal": ("StModal", "states", "tickets", "完了にするの小窓 ← 帯の完了にする", ("complete-modal", "dialog", "/tickets/{ticket}", "K-229", "approve-modal")),
    "MePCInstalled": ("MePC", "me", "bridge-setup", "この PC に Bridge が入っている ← PC をつなぐを開いた", ("bridge-installed", "page", "/setup/bridge", "K-230", "bridge-connected")),
}
REVIEW_ORDER = ["AuthVerifying", "AuthVerifyExpired", "AuthVerifyUsed", "AuthConsent", "AuthChecking", "AuthVerifyLoading", "StBefore", "StConfirmDone",
                "StDone", "StDelegated", "StCompleteModal", "ApEmpty", "MePCInstalled", "UiDisabled", "OnHomeLater"]



def dump(path, data, newline):
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + ("\n" if newline else ""))


def update_canvas_json():
    path = P + "canvas.json"
    c = json.load(open(path, encoding="utf-8"))
    boards = dict(c["boards"])
    for name, (ref, page, _screen, title, _g) in BOARDS.items():
        key = name + ".dc.html"
        if key in boards:   # 在る絵の置き場と題は持ち主が後から直すので触らない（無い絵だけ足す・K-257）
            continue
        r = boards[ref + ".dc.html"]
        col = [b for b in boards.values() if b.get("page") == page and b.get("x") == r["x"]]
        y = max(b["y"] + b["h"] for b in col) + 240
        boards[key] = {k: v for k, v in sorted({**{k: r[k] for k in ("w", "h") if k in r}, **({"expand": r["expand"]} if "expand" in r else {}),
                                                "page": page, "title": title, "x": r["x"], "y": y}.items())}
    c["boards"] = dict(sorted(boards.items()))
    c["order"] = list(c["order"]) + [n + ".dc.html" for n in BOARDS if n + ".dc.html" not in c["order"]]
    dump(path, c, False)


def update_screens():
    path = os.path.join(ROOT, "04_design", "canvas-screens.json")
    d = json.load(open(path, encoding="utf-8"))
    # 決まった所に在る絵は並びを動かさない（流し直しても対応表が変わらない・K-257）。違う所に在る絵だけ外して足す
    want = {name: screen for name, (_ref, _page, screen, _t, _g) in BOARDS.items()}
    screens = {k: [b for b in v if b not in want or want[b] == k] for k, v in d["screens"].items()}
    common = [b for b in d["common"]["boards"] if (b not in want or want[b] == "common") and b not in ("OnHome", "OnLoading")]
    for name, screen in want.items():
        if screen == "common":
            if name not in common:
                common.append(name)
        elif name not in screens[screen]:
            screens[screen] = screens[screen] + [name]
    for name in ("OnHome", "OnLoading"):
        if name not in screens["tickets"]:
            screens["tickets"] = screens["tickets"] + [name]
    d = {**d, "screens": screens, "common": {**d["common"], "boards": common}}
    dump(path, d, False)


def update_fidelity():
    path = os.path.join(ROOT, "04_design", "fidelity.json")
    f = json.load(open(path, encoding="utf-8"))
    groups = [g for g in f["groups"]]
    have = {g["id"]: g for g in groups}
    new = []
    for name, (_ref, _page, _screen, _t, g) in BOARDS.items():
        if not g:
            continue
        gid, kind, app, owner, src = g
        base = have[src]
        roles = {"doc": ("card", "h1")}.get(kind)
        pairs = [p for p in base["pairs"] if not roles or p["role"] in roles]
        new.append({"id": gid, "kind": kind, "canvas": name, "app": app, "state": gid, "widths": [1440, 375], "owner": owner,
                    "enrolled": False, "pairs": [dict(p) for p in pairs]})
    # 組は無いときだけ足す（持ち主が後から enrolled にしたり pairs を直したりした組を戻さない・K-257）
    f = {**f, "groups": groups + [g for g in new if g["id"] not in have]}
    dump(path, f, True)


def update_owner_heads():
    want = {}
    for _name, (_ref, _page, _screen, _t, g) in BOARDS.items():
        if g:
            want.setdefault(g[3], []).append(g[0])
    for owner, ids in want.items():
        path = os.path.join(ROOT, "11_tickets", owner + ".md")
        s = open(path, encoding="utf-8").read()
        m = re.search(r"^canvas: \[(.*)\]$", s, re.M)
        have = [x.strip() for x in m.group(1).split(",") if x.strip()]
        line = "canvas: [%s]" % ", ".join(have + [i for i in ids if i not in have])
        s = s[:m.start()] + line + s[m.end():]
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(s)


# ---------- 代表に見せる見比べの 1 枚 ----------
DIFF = {
    "AuthVerifying": ["確認メールの箱の中身を「確認しています」の見出しと、回る印つきの「登録を確定しています…」に替えた", "文は 3 秒たっても終わらないときだけ出す（すぐ終われば見出しだけで次へ）。この決まりは絵には書いていない"],
    "AuthVerifyExpired": ["箱を登録の画面と同じ形にそろえ、見出しを「リンクの期限が切れました」にした", "案内の文と「もう一度登録する」のボタンを置いた"],
    "AuthVerifyUsed": ["印を緑の ✓ にし、見出しを「登録は終わっています」にした", "ログインへ進む文と「ログイン」のボタンを置いた"],
    "AuthConsent": ["見出しを「利用規約とプライバシーポリシーが新しくなりました」にした", "2 つの文書と版・同意のチェック・「同意して続ける」と「ログアウト」を置いた"],
    "AuthChecking": ["入力欄を外し、見出しの下に回る印つきの「確かめています…」だけを置いた", "文は 3 秒たっても終わらないときだけ出す"],
    "AuthVerifyLoading": ["本文とボタンを外し、見出しの下に回る印つきの「読み込んでいます…」だけを置いた", "文は 3 秒たっても終わらないときだけ出す"],
    "StBefore": ["帯を白い箱にし、紺の「AI に任せる」のボタンを置いた", "実施事項はどれもまだ。右の「PC のブラウザ」は動いていないので外した", "題の文字は、決まった大きさの段に合わせて少し小さくした"],
    "StConfirmDone": ["帯を白い箱にし、「完了の条件を確かめて完了にしてください」と紺の「完了にする」を置いた", "実施事項は全部済みの印。右のパネルは外した", "題の文字は、決まった大きさの段に合わせて少し小さくした"],
    "StDone": ["帯を緑の箱にし、「完了しました」と完了にした人と時刻を出した", "上の印を「完了」にした。右のパネルは外した", "題の文字は、決まった大きさの段に合わせて少し小さくした"],
    "StDelegated": ["帯を橙の箱にし、「高本のAI に任せました」「PC が受け取るのを待っています」を出した", "実施事項はどれもまだ。右のパネルは外した", "題の文字は、決まった大きさの段に合わせて少し小さくした"],
    "StCompleteModal": ["小窓を 1 つにし、題を「完了にする」にした", "完了の条件・実施事項のチェック・「確かめました」のチェック・「確かめて完了にする」を置いた"],
    "ApEmpty": ["表を外し、「いま決めるものはありません」と「決めた履歴」へのボタンを置いた", "空の箱は、ほかの空の画面と同じ点線の箱にした", "件数を 0 にし、左のバーの件数の印も外した"],
    "MePCInstalled": ["「この PC の Bridge」の箱と「この PC の Bridge につなぐ」のボタンを置いた", "つないでいる PC はまだ無い形にした"],
    "UiDisabled": ["ボタン・選ぶ欄・探す欄・メニューの項目・見え方のタブ の使える形と使えない形を並べた", "使えない形は薄く（不透明度 0.55）して押せないようにした"],
    "OnHomeLater": ["パスキーの行を薄く押せない形にし、数に入れないので「0 ／ 2」・進みの棒を 0 にした", "「ログイン情報を預ける」の「預ける」の横に「あとで」を置いた"],
}


def review_sheet():
    out = os.path.join(ROOT, "04_design", "canvas-review", "K-219.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    secs = []
    for name in REVIEW_ORDER:
        ref, _page, _screen, title, _g = {**BOARDS, **MOVED}[name]
        what = title.split(" ← ")[0]
        diffs = "".join("<li>違い：%s</li>" % d for d in DIFF[name])
        frame = lambda b, cap: ('<figure><figcaption>%s</figcaption><div class="frame"><iframe src="../canvas/%s.dc.html" '
                                'title="%s"></iframe></div></figure>') % (cap, b, cap)
        secs.append('<section data-board="%s" data-ref="%s"><h2>%s</h2><ul>%s</ul><div class="pair">%s%s</div></section>'
                    % (name, ref, what, diffs, frame(ref, "元の絵"), frame(name, "起こした絵")))
    html = ("<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>絵が無かった状態の絵（見比べ）</title>\n<style>\n"
            "body{margin:0;font-family:system-ui,sans-serif;color:#131B27;background:#F2F4F7;font-size:14px;line-height:1.7}\n"
            "main{padding:24px;display:flex;flex-direction:column;gap:20px}\nh1{font-size:20px;margin:0}\nh2{font-size:16px;margin:0}\n"
            "main>p{margin:0;color:#4A5563}\nsection{background:#FFFFFF;border:1px solid #DDE2E9;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px}\n"
            "ul{margin:0;padding-left:18px;color:#4A5563}\n.pair{display:flex;gap:16px;flex-wrap:wrap}\nfigure{margin:0;display:flex;flex-direction:column;gap:6px}\n"
            "figcaption{font-size:12px;color:#4A5563}\n.frame{width:576px;height:400px;overflow:hidden;border:1px solid #DDE2E9;border-radius:8px;background:#FFFFFF}\n"
            ".frame iframe{width:1440px;height:1000px;border:0;transform:scale(.4);transform-origin:0 0}\n"
            "@media (max-width:700px){main{padding:16px 12px}.frame{width:316px;height:220px}.frame iframe{transform:scale(.22)}}\n"
            "</style>\n</head>\n<body>\n<main>\n<h1>絵が無かった状態の絵（見比べ）</h1>\n"
            "<p>左が元にした絵、右が起こした絵です。それぞれ、何を足したか・替えたかを上に書いています。</p>\n"
            + "\n".join(secs) + "\n</main>\n</body>\n</html>\n")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    auth_boards()
    approvals_empty()
    disabled_sample()
    home_later()
    subprocess.run([sys.executable, "shellfix.py"], cwd=HERE, check=True, stdout=subprocess.DEVNULL)  # 最後に after_shellfix() を呼ぶ
    update_canvas_json()
    update_screens()
    update_fidelity()
    update_owner_heads()
    review_sheet()
    print("K-219 の絵", len(BOARDS), "枚")

# -*- coding: utf-8 -*-
"""全モック共通のシェル。ナビは flow.json から生成する。画面ごとに手書きしない。
 正本: 05_flow/flow.json ／ 規約: screen-derivation.md ・ decision-traceability.md
 ★2026-09-09 全面改訂：
   - サイドバーは6本（section）。中の画面は flow.json の by_role（section×権限で機械導出）
   - 各画面に根拠の決定ID（source）を埋め込む。trace_gate の T6（mockup 層）がこれを読む"""
import json, os
from _tokens import TOKENS, BASE
from _icons import ic, LOGO
from _ps import ROLE_SAME, COVER
from _composer import chat_composer, COMPOSER_CSS
from _chat import CHAT_CSS as _CHAT_CSS, FRAME_CSS as _FRAME_CSS

FLOW = json.load(open(os.path.join(os.path.dirname(__file__), "..", "05_flow", "flow.json"), encoding="utf-8"))
SCR   = {s["id"]: s for s in FLOW["screens"]}
ROLES = {r["id"]: r for r in FLOW["roles"]}
NAV   = FLOW["navigation"]["by_role"]
SECT  = FLOW["navigation"]["sections"]
SECT_BY_ROLE = FLOW["navigation"]["sections_by_role"]
SUB   = FLOW["navigation"]["sub_by_screen"]
SUB_MODE = FLOW["navigation"].get("sub_mode", {}).get("by_screen", {})   # D-070：入口画面は anchors（上の帯・隠さない）
LAYOUT   = FLOW["navigation"].get("layout", {}).get("by_screen", {})     # D-072：三画面（一覧｜中身｜自分のAI）の画面。サイドバーはレールに畳む
ACTS  = {a["id"]: a for p in FLOW["backbone"] for a in p["acts"]}
PHASE = {a["id"]: p["phase"] for p in FLOW["backbone"] for a in p["acts"]}
SEC_OF = {sid: sec["key"] for sec in SECT for sid in sec["screens"]}

SHOW_ROLES = ["R1", "R2", "R3", "R4", "R6"]
USERS = {"R1": ("高", "高本 雅人", "代表・ひとり"),
         "R2": ("田", "田中 誠", "代表・社員3名"),
         "R3": ("佐", "佐藤 健", "外注・担当者"),
         "R4": ("鈴", "鈴木 美咲", "パートナー・閲覧のみ"),
         "R6": ("運", "運営 ENGINE BASE", "Kaname 運営")}
ROLE_SHORT = {"R1": "ひとり社長", "R2": "代表＋数人", "R3": "担当者", "R4": "閲覧のみ", "R6": "運営"}

SEC_ICON = {"today": "today", "clone": "clone", "work": "list", "goal": "target",
            "model": "building", "ops": "settings", "admin": "lifebuoy"}
ICON = {
 "today":"today","approvals":"inbox","clone-thread":"repeat","ai-activity":"route","tasks":"check","records":"ledger",
 "record-detail":"file","clone-chat":"chat","search":"search","goals":"target","goal-allocation":"layers",
 "goal-edit":"pen","my-progress":"gauge","review":"review","hypotheses":"flask","duties":"duty",
 "clone-memory":"brain","ledger-def":"settings","company-model":"building","automation-repair":"wrench",
 "audit":"log","policies":"policy","members":"users","ai-staff":"ai","ai-staff-detail":"ai",
 "bridge-setup":"bridge","credentials":"key","security-brief":"shield","export":"download",
 "account-close":"trash","ops-support":"lifebuoy","ops-home":"building","ops-catalog":"layers","ops-skills":"zap","member-detail":"user","signup":"login","verify-email":"mail",
 "invite-accept":"users","mfa-setup":"lock","billing-setup":"card","login":"login",
 "password-reset":"key","onboard-interview":"clone","onboard-draft":"building",
 "onboard-testrun":"flask","onboard-golive":"zap",
}
# モックの数字（バッジ）。役割で変わる
BADGE = {("approvals","R1"):"3",("approvals","R2"):"3",("approvals","R3"):"1",
         ("today","R1"):"4",("today","R2"):"4",("today","R3"):"2",("clone-thread","R1"):"1",("clone-thread","R2"):"1"}

def _ai(role): return USERS[role][1].split()[0] + "AI"
def _lbl(text, role): return text.replace("自分のAI", _ai(role))

def _nav_for(role, active, ver):
    """主ナビ＝6本の section。開いている section は中の画面を出す。"""
    allowed = NAV[role]; out = []
    for key in SECT_BY_ROLE[role]:
        sec = next(x for x in SECT if x["key"] == key)
        hit = [m for m in sec["screens"] if m in allowed and SCR[m]["release"] <= ver]   # 先の段階の画面は今の段階のナビに出さない（時点の正直さ・L-007）
        if not hit: continue
        is_on = SEC_OF.get(active) == key
        req = "" if key in ("today", "ops", "admin") else ' data-requires="model"'
        if len(hit) == 1:
            m = hit[0]; b = BADGE.get((m, role), "")
            b = f'<span class="badge" data-requires="data">{b}</span>' if b else ""
            out.append(f'<a class="side-item{" on" if m == active else ""}" href="{_href(m, ver)}"{req}>'
                       f'{ic(SEC_ICON[key])}<span>{_lbl(sec["label"], role)}</span>{b}</a>')
            continue
        tot = sum(int(BADGE.get((m, role), 0)) for m in hit)
        b = f'<span class="badge" data-requires="data">{tot}</span>' if tot and not is_on else ""
        out.append(f'<button class="side-item side-grp{" open" if is_on else ""}" data-sec="{key}" aria-expanded="{str(is_on).lower()}"{req}>'
                   f'{ic(SEC_ICON[key])}<span>{_lbl(sec["label"], role)}</span>{b}<i class="chev">{ic("down")}</i></button>')
        subs = ""
        for m in hit:
            bb = BADGE.get((m, role), "")
            bb = f'<span class="badge" data-requires="data">{bb}</span>' if bb else ""
            subs += f'<a class="{"on" if m == active else ""}" href="{_href(m, ver)}">{ic(ICON.get(m,"file"))}<span>{_lbl(SCR[m]["name"], role)}</span>{bb}</a>'
        out.append(f'<div class="side-sub" data-sec="{key}"{" data-last" if is_on else " hidden"}{req}>{subs}</div>')
    return "\n".join(out)

def _href(m, ver):
    """段階をまたぐリンク：その画面の段階の置き場（v1/・v2/）を指す。v2 のページから v1 の画面は ../v1/ へ"""
    rel = SCR[m]["release"]
    return f'{rel}-{m}.html' if rel == ver else f'../{rel}/{rel}-{m}.html'
def _index_href(ver): return 'v1-index.html' if ver == 'v1' else '../v1/v1-index.html'

def _sidebar(role, active, ver):
    av, nm, co = USERS[role]
    n = len(SECT_BY_ROLE[role])
    return (f'<aside class="side" data-role="{role}" data-requires="app">'
            f'<div class="side-brand">{LOGO}<span>Kaname</span></div>'
            f'<nav class="side-nav" aria-label="主ナビ（{n}本）">{_nav_for(role, active, ver)}</nav>'
            f'<div class="side-foot"><div class="av">{av}</div><div class="who">'
            f'<div class="nm">{nm}</div><div class="co">{co}</div></div></div></aside>')

def _tabbar(role, active, ver):
    items = NAV[role][:4]; out = []
    for m in items:
        b = BADGE.get((m, role), "")
        b = f'<span class="bdg" data-requires="data">{b}</span>' if b else ""
        out.append(f'<a class="{"on" if m == active else ""}" href="{_href(m, ver)}">{ic(ICON.get(m,"file"))}{b}<span>{_lbl(SCR[m]["name"], role)}</span></a>')
    out.append(f'<a href="{_index_href(ver)}">{ic("menu")}<span>メニュー</span></a>')
    return f'<nav class="tabbar" data-role="{role}" data-requires="app">{"".join(out)}</nav>'

def _subnav(sid, ver, counts=None, sub=None):
    """第2ナビ＝画面ごとに変える。押すと画面の中（data-sec）が切り替わる。項目は1行の説明を持つ（D-059）。
       sub を渡すと flow.json の定義の代わりに使う（例：会話画面はスレッド一覧）。"""
    if isinstance(sub, str):   # 項目の代わりに中身をそのまま出す（会話の一覧＝左パネルの一覧の共通の部品・_threadlist.py）
        s = SCR[sid]
        meta = f'<!-- acts: {" ".join(s["acts"])} / roles: {" ".join(s.get("roles", []))} / source: {" ".join(s.get("source", []))} -->'
        # 1179 以下では左からの引き出し（D-064.7）。見出しの行の「会話の一覧」で開き、選ぶ・外を押す・Esc で閉じる
        return (f'<div class="sub-scrim" hidden data-sub-scrim></div>'
                f'<aside class="subnav has-body" id="subnav" data-mode="column" data-requires="app">{meta}<div class="subnav-b" data-sub-body>{sub}</div></aside>')
    items = sub if sub is not None else SUB.get(sid)
    if not items: return ""
    s = dict(SCR[sid]); s['name'] = _lbl(s['name'], 'R1'); s['purpose'] = _lbl(s['purpose'], 'R1'); rows = []; counts = counts or {}
    last_group = None
    for i, it in enumerate(items):
        label, desc = it["label"], it.get("desc", "")
        if it.get("group") and it["group"] != last_group:
            rows.append(f'<div class="subnav-sec">{it["group"]}</div>'); last_group = it["group"]
        n = counts.get(label, "")
        num = f'<span class="n{" warn" if str(n).startswith("!") else ""}" data-requires="data">{str(n).lstrip("!")}</span>' if n != "" else ""
        st = f' data-state="{it["state"]}"' if it.get("state") else ""
        rows.append(f'<a class="sn{" on" if i == 0 else ""}" href="#sec-{i}" data-i="{i}"{st} title="{desc}">'
                    f'<span class="sn-l">{label}{num}</span>{f'<span class="sn-d">{desc}</span>' if desc else ""}</a>')
    meta = f'<!-- acts: {" ".join(s["acts"])} / roles: {" ".join(s.get("roles", []))} / source: {" ".join(s.get("source", []))} -->'
    sec_key = SEC_OF.get(sid); crumb = next((x["label"] for x in SECT if x["key"] == sec_key), "")
    mode = SUB_MODE.get(sid, "column")
    # 見出し（くくり・画面名・説明）は本文の上の帯（.shead）に 1 つだけ。第2ナビには出さない（2026-09-30）
    return (f'<aside class="subnav" data-mode="{mode}" data-requires="app">{meta}'
            f'<div class="subnav-b">{"".join(rows)}</div></aside>')

PANEL_MSGS = {
 "goals": [("u","このままで受注10件いく？"),("a","このままだと <b>8件</b> で着地します。あなたの提案中2件のうち1件が決まれば9件。田中さんの残り2件を1件引き継ぐ案があります。")],
 "goal-allocation": [("u","受注10件、田中さんに3件でいい？"),("a","田中さんの今期実績は1件で、残り3週です。<b>2件</b>にして残り1件を AI営業社員のリード目標に変換して持たせるのが現実的です。")],
 "record-detail": [("u","この案件、次は何をすればいい？"),("a","提案から7日です。検討期限が明後日なので<b>今日中に一次返信</b>を取りに行くのが最短。追いメールの下書きは承認待ちにあります。")],
 "records": [("u","止まってる案件だけ見せて"),("a","<b>3件</b>が2週間以上動いていません。中央を「止まっている」に絞りました。")],
 "tasks": [("u","今日の分、終わった"),("a","お疲れさまです。同じ部署で残っている <b>田中さんの △△社 提案書</b>（明日期限）を引き継げます。一次案は私が作れます。")],
 "today": [("a","<span class=\"pm-when\">申し送り · 9/10（水）7:30</span>おはようございます。夜のうちに 3 体が動きました。<b>まずセイコー様です。</b>山田様への追いメールが承認待ちで、先方の検討期限が明後日なので、今日中に押してもらえると間に合います。<br>京蟻の請求書は税込表示になっていなかったので私が差し戻して直させました。今は問題ありません。今週の成約はあと 1 件で目標です。<br>今日やる分は 3 件・見込み 1 時間 35 分。会議が 2 時間あるので、13 時から 15 時が空きます。<div class=\"opts\"><button class=\"btn btn-g btn-sm\">差し戻しの経緯</button><a class=\"btn btn-g btn-sm\" href=\"v1-ai-activity.html\">AI社員の動き</a></div>"),
           ("u","今日いちばん大事なのは？"),("a","<b>セイコー様への追いメールの承認</b>です。次に一次返信の電話。契約書案は明日で間に合います。")],
 "approvals": [("u","セイコーの追いメール、もう少し柔らかくして"),("a","直させました。<b>中央に反映しています</b>（差し戻し1回）。押せば送ります。")],
}
PANEL_BY_PS = {
 "PS1": [("a","PC がつながりました。まだ会社のことを何も知らないので、<b>次は「話す」で教えてください</b>。訊かれたことに答えるだけで大丈夫です。<div class=\"opts\"><a class=\"btn btn-p btn-sm\" href=\"v1-onboard-interview.html\">話すへ</a><button class=\"btn btn-g btn-sm\">あとで</button></div>")],
 "PS2": [("a","たたき台を作りました。<b>違うところを言えば直します</b>。AI社員はまだテストモードで、外には一切出しません。")],
}
PANEL_DEFAULT = [("u","この画面で気になるところある？"),("a","いま見ている内容で止まっているものはありません。変えたいことがあれば言ってください。中央に反映します。")]

def _aipanel(sid, role):
    """作業モードの右パネル。会話全体が読めて続けて話せる。入力だけを置く形は禁止（D-062）。"""
    s = SCR[sid]; nm = _ai(role)
    msgs = PANEL_MSGS.get(sid, PANEL_DEFAULT)
    body = "".join(f'<div class="pm {k}" data-requires="model">{_lbl(t, role)}</div>' for k, t in msgs)
    body += "".join(f'<div class="pm {k}" data-ps-only="{ps}">{_lbl(t, role)}</div>' for ps, ms in PANEL_BY_PS.items() for k, t in ms)
    tree = ('<details class="ptree" data-requires="staff"><summary>この会話の動き（誰が何をしたか）</summary>'
            '<div class="tl"><div class="done"><span class="d"></span><span>{nm} が配った</span></div>'
            '<div class="done" style="padding-left:16px"><span class="d"></span><span>経理社員 受け取り → 台帳を読む → freee 下書き</span></div>'
            '<div class="done" style="padding-left:16px"><span class="d"></span><span>{nm} 一次確認 → 差し戻し → 直し → OK</span></div>'
            '<div class="now"><span class="d"></span><span>承認待ち（あなた）</span></div></div>'
            '<a href="v1-ai-activity.html" style="font-size:12px;color:var(--primary);font-weight:600">動きを全部見る →</a></details>').replace("{nm}", nm)
    return (f'<aside class="aipanel" data-role="{role}" data-requires="ai app"><div class="ap-h"><div class="av">{ic("clone")}</div>'
            f'<div style="min-width:0"><div class="nm">{nm}</div><div class="ctx">いま見ている：{_lbl(s["name"], role)}</div></div>'
            f'<a class="btn btn-g btn-sm ap-new" href="v1-clone-chat.html" title="新しく話す（新しい会話）">{ic("plus")}</a>'
            f'<a class="btn btn-g btn-sm" href="v1-clone-chat.html" title="会話モードで開く（一覧から前の会話へ）">{ic("chat")}</a>'
            f'<button class="btn btn-g btn-sm ap-close" title="閉じる">{ic("x")}</button></div>'
            f'<div class="ap-b">{body}{tree}</div>'
            f'{chat_composer("続けて話す", compact=True, ctx=["この画面：" + _lbl(s["name"], role)])}</aside>')

def _blocked(sid, ver):
    """権限判定は screens[].roles（主ナビに出るかとは別物）。"""
    allowed = SCR[sid].get("roles", SHOW_ROLES); out = []
    for r in SHOW_ROLES:
        if r in allowed: continue
        seen = "、".join(SCR[x]["name"] for x in NAV[r][:4])
        out.append(f'<div class="norole" data-role="{r}" hidden>{ic("lock")}'
                   f'<h3>この画面は「{ROLES[r]["name"]}」には見えません</h3>'
                   f'<p>{ROLES[r]["desc"]}<br>権限で主ナビの項目そのものが変わるため、この画面への入口がありません。</p>'
                   f'<div class="go">この権限で見られるもの：{seen}</div></div>')
    return "".join(out)

CAPS_JSON = json.dumps({p['id']: p.get('caps', []) for p in FLOW.get('product_states', [])}, ensure_ascii=False)
VER_META = {"v1": ("段階1（最初に出せる状態）", "#186F69"),
            "v2": ("完全版（段階2を含む）", "#6D4AA6")}


def _rail_css(pre):
    """サイドバーをレール（72px・アイコン＋11px の名前）にする規則。pre='' はタブレットの media 内、pre='.shell[data-layout=threepane]' は三画面の画面"""
    P = (pre + " ") if pre else ""
    return "\n".join(f"{P}{sel}{{{body}}}" for sel, body in [
        (".side", "width:72px"),
        (".side-brand", "justify-content:center;padding:16px 0 10px"), (".side-brand span", "display:none"),
        (".side-nav", "padding:4px 6px"),
        (".side-item", "flex-direction:column;gap:4px;padding:9px 2px;font-size:11px;line-height:1.2;text-align:center;border-radius:var(--r-md)"),
        (".side-item svg", "width:20px;height:20px"),
        (".side-item .badge", "position:absolute;top:4px;right:6px;margin:0"),
        (".side-grp .chev", "display:none"),
        (".side-sub", "position:fixed;left:72px;top:34px;bottom:0;width:216px;background:var(--side-bg);border-right:1px solid var(--line);padding:14px 10px;z-index:57;box-shadow:8px 0 24px rgba(0,0,0,.12);gap:2px"),
        (".side-sub a", "font-size:13px;padding:8px 10px"),
        (".side-sub:not([data-last])", "display:none"),   # 横に飛び出すので、最後に押した 1 つだけ（重ならない）
        (".side-foot", "padding:10px 6px;justify-content:center"), (".side-foot .who", "display:none"),
    ])

from _threadlist import THREADLIST_CSS, CONFIRM_CSS  # noqa: E402
SHELL_CSS = THREADLIST_CSS + CONFIRM_CSS + """
.side-grp{width:100%;text-align:left}
.side-grp .chev{margin-left:auto;display:flex;opacity:.55;transition:.15s}
.side-grp .chev svg{width:14px;height:14px}
.side-grp.open .chev{transform:rotate(180deg)}
.side-grp .badge{margin-left:auto}
.side-grp .badge+.chev{margin-left:6px}
.side-sub a.on{background:var(--side-on);color:var(--on-surface);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.side-sub a svg{width:13px;height:13px;opacity:.8}
.side-sub a .badge{margin-left:auto;background:var(--st-warning);color:#fff;font-size:11px;font-weight:600;padding:0 6px;border-radius:var(--r-full)}
/* レール（アイコン＋小さな名前）。タブレットと、三画面（D-072）の画面で使う。1 か所に書き、接頭辞だけ変える */
@media(min-width:1180px){
.shell[data-layout=threepane]{--sidebar-w:72px}
""" + _rail_css(".shell[data-layout=threepane]") + """
}
.sn{flex-direction:column;align-items:flex-start;gap:2px}
.sn .sn-l{display:flex;align-items:center;gap:8px;width:100%}
.sn .sn-l .n{margin-left:auto}
.sn .sn-d{font-size:11px;color:var(--on-sv);line-height:1.5;font-weight:400}
.sn.on .sn-d{color:var(--on-primary-c);opacity:.8}
@media(max-width:767px){.sn .sn-d{display:none}}
.aipanel{width:340px;flex:none;background:var(--card);border-left:1px solid var(--line);position:sticky;top:34px;height:calc(100vh - 34px);display:none;flex-direction:column}
.shell.panel-open .aipanel.on{display:flex}
.ap-h{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line-soft)}
.ap-h .av{width:32px;height:32px;border-radius:var(--r-full);background:var(--tertiary-c);color:var(--on-tertiary-c);display:grid;place-items:center;flex:none}
.ap-h .nm{font-size:13.5px;font-weight:700}.ap-h .ctx{font-size:11.5px;color:var(--on-sv);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ap-h .btn-sm{padding:5px 7px}
.ap-b{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
/* 右パネルの吹き出しは会話モードと同じ部品（D-104.2）。パネルの幅に合わせて詰めるだけ */
.pm{max-width:92%;padding:8px 12px;border-radius:var(--r-lg);font-size:14px;line-height:1.7}
.pm.u{align-self:flex-end;background:var(--sv);color:var(--on-surface)}
.pm.a{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.pm .pm-when{display:block;font-size:11px;color:var(--tertiary);font-weight:600;margin-bottom:2px}
.pm .opts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ap-h .ap-new{margin-left:auto}
.ap-toggle .ap-unread{min-width:16px;height:16px;border-radius:var(--r-full);background:var(--primary);color:var(--on-primary);font-size:11px;display:inline-grid;place-items:center;padding:0 4px}
.ptree{border:1px solid var(--line);border-radius:var(--r-md);padding:8px 11px;font-size:12.5px}
.ptree summary{cursor:pointer;font-weight:600;color:var(--on-sv);font-size:12px}
.ptree .tl{margin-top:8px}
.ptree .tl>div{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:12px}
.ptree .tl .d{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none;background:var(--neutral)}
.ptree .tl .done .d{background:var(--st-success)}.ptree .tl .now .d{background:var(--st-progress)}
.ap-toggle[aria-pressed="true"]{background:var(--primary-c)}
.ai-stopped{color:var(--st-warning);font-weight:600}
/* はじめの設定の枠（運用前）：サイドバー・第2ナビ・下タブは data-requires=app で隠れる。格子も1列に */
.shell[data-frame="wizard"]{display:block!important}
.shell[data-frame="wizard"] .main{width:100%}
[data-ps-only]{display:none}
.ai-fab{display:none}
/* ============ 本文の最小幅（D-070）：本文が 720px を下回るなら第2ナビを上の帯に畳む。入口画面（anchors）は常に上の帯 ============ */
@media(min-width:1180px){
  /* 見出しの帯は第2ナビと本文の上にまたがる（左からサイドバー｜第2ナビ｜本文｜右パネル、上の行が見出し） */
  .shell:not(.sub-chips):not([data-frame="wizard"]){display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr)}
  .shell:not(.sub-chips) .side{grid-column:1;grid-row:1/3}
  .shell:not(.sub-chips) .shead{grid-column:2/4;grid-row:1}
  .shell:not(.sub-chips) .subnav{grid-column:2;grid-row:2;position:static;height:auto;overflow:visible}   /* 帯の分だけページが余分に動かないよう、一覧だけを画面に貼り付ける */
  .subnav-b[hidden]{display:none}
  .shell:not(.sub-chips) .subnav>.subnav-b{position:sticky;top:34px;max-height:calc(100vh - 34px);overflow-y:auto}
  .shell:not(.sub-chips) .main{grid-column:3;grid-row:2}
  .shell:not(.sub-chips) .aipanel{grid-column:4;grid-row:1/3}
  .shell:not(.sub-chips) .norole,.shell:not(.sub-chips) .blocked{grid-column:2/4;grid-row:1/3}
  .shell.sub-chips{display:grid;grid-template-columns:var(--sidebar-w) minmax(0,1fr) auto;grid-template-rows:auto auto minmax(0,1fr)}
  .shell.sub-chips .side{grid-column:1;grid-row:1/4}
  .shell.sub-chips .shead{grid-column:2;grid-row:1}
  .shell.sub-chips .subnav{grid-column:2;grid-row:2;width:auto;height:auto;position:static;border-right:0;border-bottom:1px solid var(--line);flex-direction:column}
  .shell.sub-chips .subnav-b{flex-direction:row;overflow-x:auto;gap:6px;padding:8px 28px 12px}
  .shell.sub-chips .subnav-b .sn{white-space:nowrap;background:var(--sv);flex:none;flex-direction:row;padding:6px 12px}
  .shell.sub-chips .subnav-sec{display:none}.shell.sub-chips .sn .sn-d{display:none}
  .shell.sub-chips .main{grid-column:2;grid-row:3}
  .shell.sub-chips .aipanel{grid-column:3;grid-row:1/4}
  .shell.sub-chips .norole{grid-column:2;grid-row:1/4}
  .shell.sub-chips .blocked{grid-column:2;grid-row:1/4}
}
@media(max-width:767px){
  .aipanel{position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;height:72vh;z-index:58;border-left:0;border-top:1px solid var(--line);border-radius:var(--r-xl) var(--r-xl) 0 0}
  .ap-toggle .ap-name{display:none}
  .shell.panel-open .subnav{display:block}
}
.sec-h{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:12px;color:var(--on-sv)}
.sec-h b{font-size:15px;color:var(--on-surface)}
.src-foot{font-size:11px;color:var(--on-sv);padding:14px 32px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.src-foot .ck{font-size:11px;font-weight:600;font-family:var(--font-code);background:#F4EFDA;color:#5C4A0E;padding:1px 6px;border-radius:var(--r-full)}
@media(max-width:767px){.src-foot{padding:12px 16px 0}}

/* ============ 上を詰める（D-072）：状態タブはモック帯の中へ、三画面の画面では見出し行を消して主ボタンを第2ナビの行に ============ */
.mockbar .states{background:none;padding:0;margin-left:6px;gap:0;overflow-x:auto;max-width:46vw}
.mockbar .states button{padding:3px 8px;font-size:11px;color:rgba(255,255,255,.6);border-bottom:0;border-radius:var(--r-full);gap:5px}
.mockbar .states button[aria-selected="true"]{color:#fff;background:rgba(255,255,255,.16)}
.mockbar .states button .mk{display:none}
.shell[data-layout=threepane] .topbar{display:none}
.shell[data-layout=threepane] .shead{display:none}
.shell[data-layout=threepane] .subnav-b{align-items:center;padding:8px 24px}
.shell[data-layout=threepane] .subnav-b .sn{flex:none}
.shell[data-layout=threepane] .subnav-b .sn-acts{margin-left:auto;display:flex;gap:8px;flex:none;align-items:center}
@media(max-width:1023px){
  .shell[data-layout=threepane] .subnav-b{flex-wrap:wrap;overflow:visible;padding:8px 16px}
  .shell[data-layout=threepane] .subnav-b .sn-acts{flex-basis:100%;justify-content:flex-end;margin-left:0}
}
@media(max-width:767px){.mockbar .states{max-width:100%;flex-basis:100%;order:9}}

/* 第2ナビの中身（会話の一覧）は 1179 以下で左からの引き出し（D-064.7）。右の自分のAIのパネルと同じ「重なる引き出し」の型。
   開きっぱなしの重なるパネルは本文を隠す（2026-10-01 user「レスポンシブ全くできていない」） */
.shell .sub-toggle{display:none}   /* .shell .btn より強く（1180 以上では左の列にあるので出さない） */
.sub-scrim{display:none}
@media(max-width:1179px){
  .shell .sub-toggle{display:inline-flex}
  .sub-toggle[aria-expanded="true"]{background:var(--primary-c)}
  .sub-scrim{display:block;position:fixed;inset:34px 0 0 0;z-index:56;background:rgba(0,0,0,.25)}
  .sub-scrim[hidden]{display:none}
  .shell .subnav.has-body{display:none;position:fixed;left:72px;top:34px;bottom:0;width:280px;height:auto;z-index:57;overflow-y:auto;background:var(--card);border-right:1px solid var(--line);border-bottom:0;box-shadow:8px 0 24px rgba(0,0,0,.12)}
  .shell .subnav.has-body.open{display:block}
  .shell .subnav.has-body .subnav-b[data-sub-body]{display:block;padding:14px 12px;overflow:visible}
}
@media(max-width:767px){.shell .subnav.has-body{left:0;width:min(320px,88vw)}}
/* 1179 以下：見出しの帯は上に貼り付く（下へ読み進めても一覧を開ける・2026-10-01）。手本：Claude・ChatGPT の狭い幅＝上の帯は固定・一覧は左の引き出し・入力欄は下に固定 */
@media(max-width:1179px){
  .shell .shead{position:sticky;top:34px;z-index:50}
  .shell .side{z-index:60}   /* レールは sticky（重なり順の文脈）。中の引き出しが見出しの下に潜らないよう、レールごと上に */
  .topbar{flex-wrap:nowrap}.topbar .tt{flex:1 1 auto;min-width:0}.topbar h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.topbar .sp{display:none}
}
@media(max-width:767px){.shead .purpose{display:none}.topbar .crumb{display:none}.topbar{padding:12px 16px}}
/* タブレットは基本規則より後に置く（同じ詳細度では後勝ち） */
/* ============ タブレット 768〜1179（D-064）：レール＋横チップの第2ナビ＋重なるパネル ============ */
@media(min-width:768px) and (max-width:1179px){
  .shell{display:grid;grid-template-columns:72px minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);min-height:calc(100vh - 34px)}
  .side{grid-column:1;grid-row:1/4}
  .shead{grid-column:2;grid-row:1}
""" + _rail_css("") + """
  .subnav{grid-column:2;grid-row:2;width:auto;height:auto;position:static;border-right:0;border-bottom:1px solid var(--line);flex-direction:column}
  .subnav-b{flex-direction:row;overflow-x:auto;gap:6px;padding:8px 20px 12px}
  .subnav-b .sn{white-space:nowrap;background:var(--sv);flex:none;flex-direction:row;padding:6px 12px}
  .subnav-sec{display:none}.sn .sn-d{display:none}
  .main{grid-column:2;grid-row:3}
  .norole{grid-column:2;grid-row:1/4}
  .content{padding:20px 24px 64px}
  .topbar{padding:12px 20px 4px}.purpose{padding:10px 20px}
  .aipanel{position:fixed;right:0;top:34px;bottom:0;width:360px;height:auto;z-index:58;box-shadow:-8px 0 24px rgba(0,0,0,.12);border-radius:0}
  .ap-toggle .ap-name{display:none}
}
"""

def _cover_na(na):
    """na = "empty stopped 理由" → 当てはまらない種類ごとに 1 つの宣言（coverage_review.py は先頭の 1 語を種類として読む）"""
    if not na: return ""
    w = na.split(); keys = []
    while w and w[0] in ("empty", "stopped"): keys.append(w.pop(0))
    return "".join(f'<!-- cover-na: {k} {" ".join(w)} -->' for k in keys)

def _page(ver, sid, states, extra_css="", actions_extra="", no_shell=False, counts=None, sub=None):
    """states = [(id, タブ名, 補足, html), ...] 先頭が既定"""
    s = dict(SCR[sid]); s['name'] = _lbl(s['name'], 'R1'); s['purpose'] = _lbl(s['purpose'], 'R1')
    vlabel, vcolor = VER_META[ver]
    ph = PHASE.get(s["acts"][0], "") if s["acts"] else ""
    src = " ".join(s.get("source", []))
    # 内部フェーズ名（P1 はじめの設定 ── …）をそのまま出さない。顧客の言葉に落とす
    sec_key = SEC_OF.get(sid)
    if sec_key: crumb = next(x["label"] for x in SECT if x["key"] == sec_key)
    else:       crumb = {"P0": "登録", "P1": "はじめの設定"}.get(ph[:2], "")

    tabs = ""
    if len(states) > 1:
        tabs = "".join(f'<button role="tab" aria-selected="{"true" if i==0 else "false"}" data-t="{t[0]}">'
                       f'<span class="mk"></span>{t[1]}</button>' for i, t in enumerate(states))
        tabs = f'<div class="states" role="tablist">{tabs}</div>'
    panes = "".join(f'<div class="statepane" id="p-{t[0]}" data-ps="{t[4] if len(t) > 4 else ""}"{"" if i==0 else " hidden"}>'
                    f'{f"<div class=state-note>{t[2]}</div>" if t[2] else ""}{t[3]}</div>'
                    for i, t in enumerate(states))
    foot = ""

    primary = f'<button class="btn btn-p">{ic("check")}{s["primary_action"]}</button>'
    # 第2ナビの中身（会話の一覧）を 1179 以下で引き出しとして開く（D-064.7）。1180 以上では出ない（左の列にある）
    sub_btn = (f'<button class="btn btn-o sub-toggle" aria-expanded="false" aria-controls="subnav" data-sub-toggle>{ic("panel-left")}<span>会話の一覧</span></button>'
               if isinstance(sub, str) else "")
    ai_btn = "" if (no_shell or sid in ("clone-chat", "clone-thread")) else (   # 会話そのものが本文の画面に、もう 1 つの会話を並べない
        f'<button class="btn btn-o ap-toggle" aria-pressed="false" data-requires="ai app">{ic("clone")}<span class="ap-name">高本AI</span><span class="ap-unread" title="見ていない間の返事" data-requires="model">1</span></button>'
        f'<a class="btn btn-g ai-stopped" data-requires="stopped app" href="v1-automation-repair.html" title="AI は止まっています">{ic("pause")}<span>AI は止まっています</span></a>'
        f'<a class="btn btn-g ai-stopped" data-requires="nobridge" hidden href="v1-bridge-setup.html">{ic("bridge")}<span>PC をつなぐと話せます</span></a>')
    same = f'<!-- role-same: {ROLE_SAME[sid]} -->' if sid in ROLE_SAME else ''
    cv = COVER.get(sid, {}); same += ('<!-- cover: ' + ' '.join(f'{k}={v}' for k, v in cv.items() if k != 'na') + ' -->' if any(k != 'na' for k in cv) else '') + _cover_na(cv.get('na'))   # G18：時点の被覆の宣言   # G15：役割ごとに同じ中身でよいと決めた宣言
    # 見出しの帯：第2ナビと本文の上にまたがる 1 つだけ（2026-09-30 user「同じ文章が 2 回・ヘッドはパネルの幅も」）
    head = (f'<header class="shead"><div class="topbar"><div class="tt">'
            f'<div class="crumb">{crumb}<span class="path" style="font-size:11px;font-family:ui-monospace,SFMono-Regular,monospace;margin-left:8px">{s.get("route", "")}</span></div>'
            f'<h1 title="{s["purpose"]}">{s["name"]}</h1></div>'
            f'<div class="sp"></div>{sub_btn}{ai_btn}{actions_extra}{primary}</div>'
            f'<div class="purpose">{ic("info")}<div title="{s["purpose"]}">{s["purpose"]}</div></div></header>')
    main = (f'{same}<main class="main">'
            f'{tabs}<div class="content">{panes}</div>{foot}</main>')

    if no_shell:
        body = f'<div class="shell" style="flex-direction:column">{head}{main}</div>'; rolebar = ""
    else:
        sides = '<div class="sub-scrim" hidden data-side-scrim></div>' + "".join(_sidebar(r, sid, ver) for r in SHOW_ROLES)   # レールの引き出しの幕
        tabbars = "".join(_tabbar(r, sid, ver) for r in SHOW_ROLES)
        panels = "" if sid in ("clone-chat", "clone-thread") else "".join(_aipanel(sid, r) for r in SHOW_ROLES)
        body = f'<div class="shell" data-layout="{LAYOUT.get(sid, "page")}">{sides}{head}{_subnav(sid, ver, counts, sub)}{main}{panels}{_blocked(sid, ver)}</div>{tabbars}'
        btns = "".join(f'<button data-role="{r}" aria-pressed="{"true" if i==0 else "false"}" '
                       f'title="{ROLES[r]["name"]}">{ROLE_SHORT[r]}</button>' for i, r in enumerate(SHOW_ROLES))
        rolebar = f'<span class="rolebar"><b>アカウント</b>{btns}</span>'

    return f'''<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kaname {ver.upper()} — {s["name"]}</title>
<!-- screen: {sid} / acts: {" ".join(s["acts"])} / source: {src} / shell: D-052 D-053 D-059 D-060 D-065 D-066 -->
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+2:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{TOKENS}{BASE}{SHELL_CSS}{_CHAT_CSS}{_FRAME_CSS}{COMPOSER_CSS}{extra_css}
.css-sentinel{{visibility:hidden;position:absolute}}</style></head><body><i class="css-sentinel" aria-hidden="true"></i>
<div class="mockbar"><b>モックアップ</b><span class="tagv" style="background:{vcolor}">{ver.upper()}</span>
<span class="ph">{crumb}</span>{rolebar}<span class="sp"></span>
<span class="wsw"><b>幅</b><button data-w="375">スマホ</button><button data-w="768">タブレット</button><button data-w="1024">横</button><button data-w="1440">PC</button></span>
<a href="{_index_href(ver)}">手順の一覧</a><span class="mut">実データ・API連携は含みません</span></div>
{body}
<script>
(function(){{ const st=document.querySelector('.states'); const mb=document.querySelector('.mockbar'); if(st&&mb){{ const sp=mb.querySelector('.sp'); mb.insertBefore(st, sp); }}
 const sh=document.querySelector('.shell'); if(sh&&sh.dataset.layout==='threepane'){{ const nb=document.querySelector('.subnav-b'); const tb=document.querySelector('.topbar'); if(nb&&tb){{ const acts=document.createElement('span'); acts.className='sn-acts'; [...tb.querySelectorAll('.ap-toggle,.ai-stopped,.btn-p')].forEach(b=>acts.appendChild(b)); nb.appendChild(acts); }} }}
 if(window.fitThreePane) setTimeout(window.fitThreePane,0); }})();
(function(){{ const fit=()=>{{ const els=[...document.querySelectorAll('.statepane:not([hidden]) [data-fix], .statepane:not([hidden]) [data-chat-frame]')]; const wide=window.innerWidth>=768;   /* 会話の固定枠はタブレットでも（D-064.7） */ if(!els.length) return; document.documentElement.style.overflow=wide?'hidden':''; els.forEach(el=>{{ if(!wide){{ el.style.removeProperty('--fix-top'); return; }} el.style.setProperty('--fix-top', Math.round(el.getBoundingClientRect().top+window.scrollY)+'px'); let b=0, s=el.nextElementSibling; while(s){{ const cs=getComputedStyle(s); b+=s.offsetHeight+parseFloat(cs.marginTop)+parseFloat(cs.marginBottom); s=s.nextElementSibling; }} el.style.setProperty('--fix-bottom', Math.round(b)+'px'); }}); }};
 window.addEventListener('load',fit); window.addEventListener('resize',fit); document.addEventListener('click',()=>setTimeout(fit,0)); setTimeout(fit,0); window.fitFixed=fit; }})();
// パスワードの見る・隠す（D-087）。押すたびに type と読み上げの名前が変わる
document.addEventListener('click',e=>{{ const b=e.target.closest('.pw-btn'); if(!b)return;
 const i=b.parentElement.querySelector('.pw-inp'); if(!i)return;
 const show=i.type==='password'; i.type=show?'text':'password';
 b.setAttribute('aria-pressed',String(show));
 b.setAttribute('aria-label',show?'パスワードを隠す':'パスワードを表示');
 i.focus(); }});
document.querySelectorAll('.mockbar .wsw button').forEach(b=>b.addEventListener('click',()=>{{ const f=location.pathname.split('/').pop(); const top=(window.top===window)?window:window.top; top.location.href='_viewer.html?p='+encodeURIComponent(f)+'&w='+b.dataset.w; }}));
document.querySelectorAll('.states').forEach(b=>b.addEventListener('click',e=>{{
 const t=e.target.closest('button[data-t]'); if(!t)return;
 b.querySelectorAll('button[data-t]').forEach(x=>x.setAttribute('aria-selected',String(x===t)));
 document.querySelectorAll('.statepane').forEach(p=>p.hidden=p.id!=='p-'+t.dataset.t);
 window.scrollTo({{top:0,behavior:'instant'}});}}));
document.querySelectorAll('.subnav .sn').forEach(a=>a.addEventListener('click',e=>{{
 e.preventDefault(); const nav=a.closest('.subnav'); nav.querySelectorAll('.sn').forEach(x=>x.classList.toggle('on',x===a));
 if(a.dataset.state){{ const b=document.querySelector('.states button[data-t="'+a.dataset.state+'"]'); if(b) b.click(); }}
 const pane=[...document.querySelectorAll('.statepane')].find(p=>!p.hidden); if(!pane) return;
 const secs=pane.querySelectorAll('[data-sec]'); if(!secs.length) return;
 if(nav.dataset.mode==='anchors'){{ const t=[...secs].find(el=>el.dataset.sec.split(' ').indexOf(a.dataset.i)>=0); if(t) t.scrollIntoView({{behavior:'smooth',block:'start'}}); return; }}   // 入口画面：隠さず、その段へ送る
 secs.forEach(el=>{{ el.hidden = el.dataset.sec.split(' ').indexOf(a.dataset.i)<0; }});
 window.scrollTo({{top:0,behavior:'instant'}});}}));
if(!document.querySelector('.subnav[data-mode="anchors"]'))
 document.querySelectorAll('.statepane').forEach(p=>{{const secs=p.querySelectorAll('[data-sec]'); secs.forEach(el=>{{el.hidden=el.dataset.sec.split(' ').indexOf('0')<0;}});}});
(function(){{
 const CAPS=__CAPS__;
 const applyPS=()=>{{ const pane=[...document.querySelectorAll('.statepane')].find(p=>!p.hidden); const ps=pane?pane.dataset.ps:''; const cs=CAPS[ps]||[];
  document.querySelectorAll('[data-requires]').forEach(el=>{{ const ok=el.dataset.requires.split(' ').every(c=>cs.includes(c)); if(!ok){{ el.hidden=true; el.dataset.psHid='1'; }} else if(el.dataset.psHid){{ el.hidden=false; delete el.dataset.psHid; }} }});   /* 時点で隠したものだけ戻す。畳んだ区分などの自前の hidden は触らない */
  document.querySelectorAll('[data-ps-only]').forEach(el=>{{ el.style.display=(el.dataset.psOnly===ps)?'':'none'; }});
  document.body.dataset.ps=ps; const sh=document.querySelector('.shell'); if(sh) sh.dataset.frame = cs.includes('app') ? 'app' : 'wizard'; }};
 window.applyPS=applyPS; applyPS();
 document.querySelectorAll('.states').forEach(b=>b.addEventListener('click',()=>setTimeout(applyPS,0)));
}})();
(function(){{
 const shell=document.querySelector('.shell'); const tg=document.querySelector('.ap-toggle'); if(!shell||!tg) return;
 const set=o=>{{shell.classList.toggle('panel-open',o); tg.setAttribute('aria-pressed',String(o)); if(window.innerWidth>=1180) try{{localStorage.setItem('kaname-panel',o?'1':'0')}}catch(e){{}}}};   // 覚えるのは広い幅だけ。スマホで閉じた状態を PC に持ち込まない
 // 本文の最小幅（D-070）：本文 = 幅 − サイドバー216 − 第2ナビ230（列のとき）− パネル340（開いているとき）。720 を下回るなら第2ナビを上の帯に畳む
 const sub=document.querySelector('.subnav'); const anchors=sub&&sub.dataset.mode==='anchors';
 const tp=shell.dataset.layout==='threepane'; const sideW=()=>(tp&&window.innerWidth>=1180)?72:216; const queueW=tp?380:0; const needW=tp?640:720;   // 三画面（D-072）：サイドバーはレール、本文＝中央（一覧の最小 360 を引く）。中央は 640 以上で開く
 const fit=()=>{{ const vw=window.innerWidth; if(vw<1180){{ shell.classList.remove('sub-chips'); return; }}
   const open=shell.classList.contains('panel-open'); const subCol=!!sub&&!anchors; const mainW=vw-sideW()-(subCol?230:0)-(open?340:0)-queueW;
   shell.classList.toggle('sub-chips', anchors || tp || (subCol && mainW<720)); }};   // 三画面の画面は第2ナビを常に上の帯に（左に列を 2 本作らない）
 window.addEventListener('resize',fit); window.fitShell=fit;
 const roomWithPanel=window.innerWidth-sideW()-((sub&&!anchors)?230:0)-340-queueW>=needW;   // パネルの既定は本文が 720（三画面では中央が 640）を保てるときだけ開く
 let init=roomWithPanel;   // 三画面の画面では自分のAIは右パネルとして常に見える（D-072。D-071 の「入口画面では閉じる」を置き換え）
 try{{const v=localStorage.getItem('kaname-panel'); if(v!==null && window.innerWidth>=1180) init=v==='1';}}catch(e){{}}   // 重なる幅（〜1179）では覚えた状態を使わない。開いたまま別端末で覆われる事故を防ぐ
 set(init); fit();
 tg.addEventListener('click',()=>{{set(!shell.classList.contains('panel-open')); fit();}});
 document.querySelectorAll('.ap-close').forEach(b=>b.addEventListener('click',()=>set(false)));
}})();
(function(){{ const mq=window.matchMedia('(min-width:768px) and (max-width:1179px)'); const sh=document.querySelector('.shell');
 const tab={{get matches(){{ return mq.matches || (!!sh && sh.dataset.layout==='threepane' && window.innerWidth>=1180); }}}};   // レールのときは開いた section を外側クリックで閉じる
 const closeAll=()=>{{document.querySelectorAll('.side-grp.open').forEach(b=>{{b.classList.remove('open');b.setAttribute('aria-expanded','false');const sub=b.parentElement.querySelector('.side-sub[data-sec="'+b.dataset.sec+'"]');if(sub) sub.hidden=true;}}); const sc=document.querySelector('[data-side-scrim]'); if(sc) sc.hidden=true;}};
 window.railCloseAll=closeAll;
 if(tab.matches) closeAll();
 mq.addEventListener('change',()=>{{ if(tab.matches) closeAll(); }});   // 幅が変わってレールになった瞬間も閉じる（開きっぱなしで本文に重ねない・D-064.7）
 document.addEventListener('click',e=>{{ if(tab.matches && !e.target.closest('.side-nav')) closeAll(); }});
 document.addEventListener('keydown',e=>{{ if(tab.matches && e.key==='Escape') closeAll(); }});
}})();
(function(){{ const t=document.querySelector('.sub-toggle'), sn=document.querySelector('.subnav.has-body'), sc=document.querySelector('[data-sub-scrim]'); if(!t||!sn) return;   // 会話の一覧の引き出し（D-064.7）
 const set=o=>{{ sn.classList.toggle('open',o); t.setAttribute('aria-expanded',String(o)); if(sc) sc.hidden=!o; }}; window.subDrawerSet=set;
 t.addEventListener('click',()=>set(!sn.classList.contains('open')));
 if(sc) sc.addEventListener('click',()=>set(false));
 document.addEventListener('keydown',e=>{{ if(e.key==='Escape') set(false); }});
 sn.addEventListener('click',e=>{{ if(e.target.closest('.tl-open,.tl-new')) set(false); }});
}})();
document.querySelectorAll('.side-grp').forEach(b=>b.addEventListener('click',()=>{{   // 押した分類だけ開け閉め。ほかは開いたまま（2026-09-30）
 if(window.matchMedia('(max-width:1179px)').matches && window.subDrawerSet) window.subDrawerSet(false);   // 左に 2 枚重ねない
 const open=!b.classList.contains('open'); b.classList.toggle('open',open); b.setAttribute('aria-expanded',String(open));
 document.querySelectorAll('.side-sub[data-last]').forEach(x=>x.removeAttribute('data-last'));   // 細いサイドバーは最後に押した 1 つだけ飛び出す
 const sub=b.parentElement.querySelector('.side-sub[data-sec="'+b.dataset.sec+'"]'); if(sub){{ sub.hidden=!open; sub.setAttribute('data-last',''); }}
 const rail=window.matchMedia('(max-width:1179px)').matches || document.querySelector('.shell')?.dataset.layout==='threepane';
 const sc=document.querySelector('[data-side-scrim]'); if(sc) sc.hidden=!(rail&&open); }}));
document.querySelectorAll('.side-sub a').forEach(a=>a.addEventListener('click',()=>{{ if(window.matchMedia('(max-width:1179px)').matches && window.railCloseAll) window.railCloseAll(); }}));
(function(){{
 const apply=r=>{{
  document.querySelectorAll('.side[data-role]').forEach(s=>s.classList.toggle('on',s.dataset.role===r));
  document.querySelectorAll('[data-roles]').forEach(el=>el.hidden=!el.dataset.roles.split(' ').includes(r));   // 役割ごとに中身が変わる塊（D-073）
  if(window.fitThreePane) setTimeout(window.fitThreePane,0); if(window.fitFixed) setTimeout(window.fitFixed,0);
  document.querySelectorAll('.tabbar[data-role]').forEach(s=>s.style.display=s.dataset.role===r?'':'none');
  document.querySelectorAll('.aipanel[data-role]').forEach(s=>s.classList.toggle('on',s.dataset.role===r));
  const apn=document.querySelector('.ap-toggle .ap-name'); if(apn) apn.textContent=({{R1:'高本AI',R2:'田中AI',R3:'佐藤AI',R4:'鈴木AI'}})[r];
  const blk=document.querySelector('.norole[data-role="'+r+'"]');
  document.querySelectorAll('.norole').forEach(n=>n.hidden=true);
  document.querySelectorAll('.subnav,.main').forEach(el=>el.style.display=blk?'none':'');
  if(blk) blk.hidden=false;
  document.querySelectorAll('.rolebar button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===r)));
  const AI={{R1:'高本AI',R2:'田中AI',R3:'佐藤AI',R4:'鈴木AI'}}[r];
  document.querySelectorAll('.topbar h1,.purpose div,.subnav-h .ttl,.subnav-h .why').forEach(el=>{{
   if(!el.dataset.o) el.dataset.o=el.textContent; el.textContent=el.dataset.o.replace(/高本AI/g,AI);}});
  try{{localStorage.setItem('kaname-role',r)}}catch(e){{}}
 }};
 let init='R1'; try{{init=localStorage.getItem('kaname-role')||'R1'}}catch(e){{}}
 if(!document.querySelector('.side[data-role="'+init+'"]')) init='R1';
 document.querySelectorAll('.rolebar button').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.role)));
 if(document.querySelector('.rolebar')) apply(init);
}})();
</script></body></html>
'''.replace('__CAPS__', CAPS_JSON)

def page(ver, sid, states, extra_css="", actions_extra="", no_shell=False, counts=None, sub=None):
    """段階の置き場（v1/・v2/）に合わせる：v2 のページでは、部品が持つ v1 固定のリンクを ../v1/ に向ける（死にリンクにしない・G-04）"""
    import re as _re
    h = _page(ver, sid, states, extra_css=extra_css, actions_extra=actions_extra, no_shell=no_shell, counts=counts, sub=sub)
    if ver != "v1": h = _re.sub(r'href="v1-([a-z0-9-]+)\.html"', r'href="../v1/v1-\1.html"', h)
    return h

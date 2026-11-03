import os, sys, re, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
from subnav import build, SV, IC
MAIN = open(P + "Main.dc.html", encoding="utf-8").read()
def av(c, bg, n=28): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
IC2 = dict(IC); IC2["shield"] = '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"></path><path d="M9 12l2 2 4-4"></path>'
def sub(cur):
    return build("ワークスペースの中", [("", [("WsPeople.dc.html", SV % IC2["people"], "メンバー", "7", False), ("WsRules.dc.html", SV % IC2["shield"], "決まり", "", False), ("WsLog.dc.html", SV % IC2["clock"], "記録", "", False), ("WsSettings.dc.html", SV % IC2["gear"], "設定", "", False)])], cur, "直せるのは管理者と、権限を付けた人")
def page(name, title, crumb, body, side=""):
    s = MAIN
    a = s.index('<nav aria-label="いまの場所"'); b = s.index("</nav>", a) + 6
    s = s[:a] + '<nav aria-label="いまの場所" style="display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; white-space: nowrap; overflow: hidden"><a href="WsPeople.dc.html" style="color: #4A5563; text-decoration: none">ワークスペースの管理</a><span style="color: #B8C0CC">›</span><b style="font-weight: 500; color: #131B27">%s</b></nav>' % crumb + s[b:]
    bar_end = s.index("</span></div>", s.index('class="kn-bar"')) + len("</span></div>")
    mend = s.rindex("</main>")
    hdr = '\n  <header style="background: #FFFFFF; border-bottom: 1px solid #DDE2E9; padding: 12px 24px; display: flex; align-items: center; gap: 12px">' + icon("E", NAVY, 32) + '<div><h1 style="font-size: 18px; margin: 0">株式会社ENGINE BASE</h1><div style="font-size: 12px; color: %s">ワークスペースの管理 ・ あなたは管理者（権限のある人だけに出る）</div></div></header>' % MUTED
    s = s[:bar_end] + hdr + '\n  <div style="display: flex; min-height: 0">' + sub({"WsShape.dc.html": "WsRules.dc.html", "WsBills.dc.html": "WsSettings.dc.html", "WsMember.dc.html": "WsPeople.dc.html"}.get(name, name)) + '<section style="flex: 1; min-width: 0; padding: 20px 28px; display: flex; flex-direction: column; gap: 14px">' + body + '</section>' + side + '</div>\n ' + s[mend:]
    save(name, title, s); return s
def ttl(h, note, act=""): return '<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap"><h2 style="font-size: 18px; margin: 0">%s</h2><span style="font-size: 12px; color: %s">%s</span>%s</div>' % (h, MUTED, note, '<span style="margin-left: auto; display: flex; gap: 6px">%s</span>' % act if act else "")
ROLE = {"管理者": ("#22345C", "#FFFFFF"), "マネージャー": ("#DCE4F2", "#22345C"), "メンバー": ("#EEF0F4", MUTED), "閲覧のみ": ("#F7F8FA", MUTED)}
def rolesel(r): return '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; border-radius: 6px; padding: 2px 8px; background: %s; color: %s; white-space: nowrap">%s ▾</span>' % (ROLE[r] + (r,))
dot = lambda ok, t: '<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: %s; white-space: nowrap"><span style="width: 7px; height: 7px; border-radius: 99px; background: %s"></span>%s</span>' % ("#4A5563" if ok else "#B45309", "#166534" if ok else "#B45309", t)
def person(c, bg, n, mail, r, ok, st, extra=""):
    return '<div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid #EDF0F4">%s<span style="flex: 1; min-width: 0"><a href="WsMember.dc.html" style="display: block; color: #131B27; text-decoration: none">%s%s</a><span style="font-size: 11px; color: %s">%s</span></span>%s<span style="width: 150px; text-align: right">%s</span><span style="color: #8A94A3; width: 16px; text-align: center">⋯</span></div>' % (av(c, bg), n, extra, MUTED, mail, rolesel(r), dot(ok, st))
def group(code, bg, name, sub_, rows):
    return ('<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden"><div style="display: flex; align-items: center; gap: 10px; padding: 10px 16px">%s<b style="font-weight: 600">%s</b><span style="font-size: 12px; color: %s">%s</span><a href="WsInvite.dc.html" style="margin-left: auto; font-size: 12px">＋ このグループに招く</a></div>%s</div>' % (icon(code, bg, 24), name, MUTED, sub_, "".join(rows)))
TAG = lambda t: ' <span style="font-size: 11px; color: %s">%s</span>' % (MUTED, t)
# ---------- 人 ----------
body = (ttl("メンバー", "グループごとに並ぶ。役割はその場で変えられる", btn("＋ グループ") + btn("＋ 招く", "p", "WsInvite.dc.html"))
  + '<div style="display: flex; gap: 10px; align-items: center; background: #FFF8EE; border: 1px solid #F1D9A8; border-radius: 10px; padding: 10px 14px; font-size: 13px">' + icon("!", "#B45309", 24) + '<span style="flex: 1">田中さんの PC が 3 日つながっていません。田中さんの分身は止まっています ・ 招待中 1 人（kimura@…）</span>' + btn("田中さんに知らせる") + '</div>'
  + group("EG", "#186F69", "営業", "4 人", [person("佐", "#186F69", "佐藤 花子", "sato@engine-base.example", "マネージャー", True, "分身 動いている"), person("高", "#6B5B99", "高本 聖斗", "自分", "管理者", True, "分身 動いている"), person("鈴", "#2F4B7C", "鈴木 一郎", "suzuki@engine-base.example", "メンバー", True, "分身 動いている"), person("田", "#7E570D", "田中 美咲", "tanaka@engine-base.example", "メンバー", False, "PC 3 日つながっていない", TAG("経理も兼ねる"))])
  + group("JD", "#6D4AA6", "受託開発", "2 人", [person("佐", "#186F69", "佐藤 花子", "兼ねている", "マネージャー", True, "分身 動いている"), person("山", "#4A5563", "山口 健", "yamaguchi@engine-base.example", "閲覧のみ", True, "分身なし（見るだけ）")])
  + group("KR", "#B45309", "経理", "1 人 ＋ 招待中 1", [person("田", "#7E570D", "田中 美咲", "兼ねている", "メンバー", False, "PC 3 日つながっていない"), '<div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid #EDF0F4; color: %s">%s<span style="flex: 1">kimura@engine-base.example<span style="display: block; font-size: 11px">招待中 ・ あと 6 日</span></span>%s</div>' % (MUTED, av("？", "#B8C0CC"), btn("送り直す"))])
  + '<div style="font-size: 12px; color: %s">「⋯」から：グループを移す・兼ねる・一時的に止める・ワークスペースから外す（外すときは担当しているチケットの引き継ぎ先を選ぶ）</div>' % MUTED)
WP = page("WsPeople.dc.html", "ワークスペース メンバー", "メンバー", body)
# ---------- 招く ----------
s = modal(WP, mhead("招く", "WsPeople.dc.html", "", "メールが届き、7 日のあいだ入れる")
  + mbody('<div>' + lab("メール") + '<div style="border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 6px 8px; display: flex; gap: 4px; flex-wrap: wrap; min-height: 40px; align-items: center">' + pill("kimura@engine-base.example ×", "#EEF3FD", NAVY) + '<span style="color: %s; font-size: 12px">続けて入れる・カンマで分ける</span></div></div>' % MUTED
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("グループ") + field("経理 ▾") + '</div><div>' + lab("役割") + field("メンバー ▾") + '</div></div>'
  + '<details style="font-size: 12px"><summary style="color: %s; cursor: pointer">ひとこと・リンクで招く</summary><div style="padding-top: 8px; display: flex; flex-direction: column; gap: 8px">%s%s</div></details>' % (MUTED, field("ひとこと（任意）", True), btn("招待のリンクを作る（7 日・1 回だけ）")))
  + mfoot(btn("やめる", "", "WsPeople.dc.html"), btn("招く", "p", "WsPeople.dc.html"), left='<span style="font-size: 12px; color: %s">入ると、その人の PC をつなぐ案内が出る</span>' % MUTED), 520, "招く")
save("WsInvite.dc.html", "招く", s)
RTABS = lambda cur: '<div style="display: flex; border-bottom: 1px solid #DDE2E9; margin-top: -4px">' + "".join('<a href="%s" style="padding: 8px 14px; border-bottom: 2px solid %s; color: %s; text-decoration: none; %s">%s</a>' % (h, NAVY if k == cur else "transparent", NAVY if k == cur else MUTED, "font-weight: 600" if k == cur else "", t) for k, t, h in [("rules", "守ること・承認・やり方", "WsRules.dc.html"), ("shape", "チケットの形", "WsShape.dc.html")]) + '</div>'
# ---------- 決まり ----------
def tile(m, name, sub_, lock=False, bg="#186F69"):
    return '<a href="#" style="position: relative; display: flex; flex-direction: column; gap: 6px; border: 1px solid #DDE2E9; background: #FFFFFF; border-radius: 10px; padding: 12px; text-decoration: none; color: #131B27"><span style="width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; font-size: 15px; font-weight: 700; color: #FFFFFF; background: %s">%s</span><b style="font-weight: 500">%s</b><span style="font-size: 11px; color: %s">%s</span></a>' % (bg, m, name, MUTED, sub_)
add = '<a href="RoomAddRule.dc.html" style="display: grid; place-items: center; border: 1px dashed #B8C0CC; border-radius: 10px; color: #4A5563; text-decoration: none; min-height: 110px; font-size: 22px">＋</a>'
grid = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px">'
lim = lambda what, cond, to: '<div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid #EDF0F4"><span style="flex: 1">%s<span style="display: block; font-size: 11px; color: %s">%s</span></span><span style="font-size: 12px">→ %s</span><span style="color: #8A94A3">⋯</span></div>' % (what, MUTED, cond, to)
body = (ttl("決まり", "全員の分身とチケットに効く。足すとき、ぶつかりを分身が点検する") + RTABS("rules")
  + '<div style="font-size: 13px; font-weight: 600; margin-top: 4px">必ず守ること</div>'
  + '<div style="font-size: 12px; color: %s; margin-top: -8px">ワークスペース全体</div>' % MUTED
  + grid + tile("署", "署名はワークスペースの署名", "22 回") + tile("締", "請求は 25 日締め", "9 回") + tile("禁", "値引きを書かない", "11 回") + tile("秘", "口座番号は本文に書かない", "7 回") + add + '</div>'
  + '<div style="font-size: 12px; color: %s">層：営業</div>' % MUTED + grid + tile("字", "応募文は 400 字以内", "14 回", bg="#5E8F8B") + add + '</div>'
  + '<div style="font-size: 13px; font-weight: 600; margin-top: 10px">承認を上に回すとき</div>'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden">' + lim("見積", "100 万円を超える", "そのグループのマネージャー") + lim("外へのメール", "はじめて送る相手", "担当者のほかにマネージャーも") + lim("持ち出し", "チケットを CSV で書き出す", "管理者") + '<div style="padding: 10px 16px; border-top: 1px solid #EDF0F4"><a href="#" style="font-size: 12px">＋ 回す決まりを足す</a></div></div>'
  + '<div style="font-size: 13px; font-weight: 600; margin-top: 10px">やり方（全員で使う）</div>'
  + grid + tile("経", "経費の申請", "v3 ・ 11 回", bg=NAVY) + tile("応", "求人の応募文", "層：営業 ・ v6", bg=NAVY) + '<a href="RoomType.dc.html" style="display: grid; place-items: center; border: 1px dashed #B8C0CC; border-radius: 10px; color: #4A5563; text-decoration: none; min-height: 110px; font-size: 22px">＋</a></div>'
  )
page("WsRules.dc.html", "ワークスペース 決まり", "決まり", body)
# ---------- 記録 ----------
row = lambda when, who, what, where: '<div style="display: flex; gap: 12px; align-items: flex-start; padding: 10px 16px; border-top: 1px solid #EDF0F4"><span style="width: 92px; flex: none; font-size: 12px; color: %s">%s</span><span style="flex: 1; min-width: 0">%s %s<span style="display: block; font-size: 11px; color: %s">%s</span></span></div>' % (MUTED, when, who, what, MUTED, where)
W = lambda c, bg, n: '<b style="font-weight: 500">%s</b>' % n
body = (ttl("記録", "ワークスペースで起きた大事なこと。消せない・直せない", btn("書き出す"))
  + '<div style="display: flex; gap: 8px; align-items: center; background: #FFFFFF; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 10px; padding: 0 14px; height: 46px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5563" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><span style="flex: 1; font-size: 14px">鈴木さんの役割を変えたのは誰？</span><span style="font-size: 11px; color: %s">ことばで探せる</span></div>' % MUTED
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + chip("権限が変わった") + chip("持ち出し") + chip("外に出した") + chip("新しい端末で入った") + chip("分身に許可した") + chip("消した（30 日は戻せる）") + '</div>'
  + '<div style="font-size: 12px; color: %s">2 件見つかりました</div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden">'
  + row("11/02 09:58", W("高", "#6B5B99", "高本 聖斗"), "が 鈴木 一郎 を 営業 の マネージャー → メンバー にした", "理由：兼務が終わったため ・ iPhone から ・ 本人確認を取り直した")
  + row("10/12 14:20", W("高", "#6B5B99", "高本 聖斗"), "が 鈴木 一郎 を 営業 の マネージャー にした", "MacBook から")
  + '</div><div style="font-size: 12px; color: %s">自分の操作と、自分が関わるチケットの記録は誰でも見られる。ワークスペース全体は管理者と権限を付けた人だけ。契約中はずっと残る</div>' % MUTED)
page("WsLog.dc.html", "ワークスペース 記録", "記録", body)
# ---------- 設定 ----------
def blk(t, rows): return '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 4px 18px"><div style="font-weight: 600; padding: 12px 0 4px">%s</div>%s</div>' % (t, "".join('<div style="display: flex; gap: 16px; align-items: center; padding: 12px 0; border-top: 1px solid #EDF0F4; flex-wrap: wrap"><span style="flex: 1 1 240px"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span><span style="display: flex; gap: 6px; align-items: center">%s</span></div>' % (a, MUTED, b, c) for a, b, c in rows))
sel = lambda v: field(v + " ▾").replace("min-height: 34px", "min-height: 30px")
body = (ttl("設定", "変えることがあるものだけ")
  + '<div style="display: flex; flex-direction: column; gap: 12px; max-width: 760px">'
  + blk("このワークスペース", [("名前", "会社名・チーム名・自分の名前など", field("株式会社ENGINE BASE")), ("ロゴ", "左上と招待のメールに出る", icon("E", NAVY, 28) + btn("変える"))])
  + blk("プランと支払い", [("チーム", "10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000", btn("プランを変える", "", "EdPlan.dc.html") + btn("請求書", "", "WsBills.dc.html"))])
  + blk("取引先", [("社内で見える人", "取引先（先方の人・決まり・いま）を見られる人の既定。取引先ごとに絞れる", sel("ワークスペースの全員")), ("依頼の届け先", "担当グループが 2 つ以上の取引先は、分身が中身を見て振り分け、取引先の担当者が確かめる", pill("分身が振り分ける"))])
  + blk("誰ができるか", [("プランと支払い", "", sel("管理者")), ("チケット・記録を書き出す", "", sel("管理者とマネージャー")), ("ワークスペースを消す", "", sel("管理者"))])
  + '<div style="font-size: 12px; color: %s; padding: 0 4px">ログインはパスキーを勧めます。2 段階認証はそれぞれが自分の設定で付けられ、パスキーを持たずパスワードだけで入る人は必須です。操作がないと 12 時間で切れます。PC が閉じている間に承認した仕事は、承認から 24 時間を過ぎると実行の前にもう一度聞きます（どちらも決まっていて、変えられません）</div>' % MUTED
  + '<div style="display: flex; align-items: center; gap: 12px; border: 1px solid #F3C7C7; border-radius: 10px; padding: 12px 18px; background: #FFFFFF"><span style="flex: 1">ワークスペースを消す<span style="display: block; font-size: 11px; color: %s">チケット・記録・分身の記憶をすべて消す。消す前に書き出せる</span></span>%s</div></div>' % (MUTED, btn("消す手続き", "d")))
page("WsSettings.dc.html", "ワークスペース 設定", "設定", body)

# ---------- チケットの形（決まりの中） ----------
kinds = [("タスク", "#186F69", "区画 10 ・ 必須 3", True), ("課題", "#B45309", "区画 9 ・ 必須 3", False), ("QA", "#B91C1C", "区画 8 ・ 必須 4", False), ("会議", "#6D4AA6", "区画 6 ・ 必須 2", False)]
klist = "".join('<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; text-decoration: none; color: #131B27; %s"><span style="display: inline-block; min-width: 44px; text-align: center; font-size: 11px; font-weight: 500; border-radius: 99px; padding: 1px 8px; color: #FFFFFF; background: %s">%s</span><span style="flex: 1; font-size: 12px; color: %s">%s</span></a>' % ("background: #F1F3F6; font-weight: 600" if on else "", c, n, MUTED, d) for n, c, d, on in kinds)
def card(t, cnt, rows, add, note):
    return ('<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 8px 12px"><div style="display: flex; align-items: center; padding: 4px 0 6px"><b style="flex: 1">%s</b><span style="font-size: 11px; color: %s">%s</span></div>%s<a href="#" style="display: block; padding: 8px 0 4px; font-size: 12px">%s</a><div style="font-size: 11px; color: %s; padding-bottom: 4px">%s</div></div>' % (t, MUTED, cnt, rows, add, MUTED, note))
crow = lambda a, b="": '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid #EDF0F4; font-size: 12px"><span style="color: #B8C0CC">⋮⋮</span><span style="flex: 1">%s</span><span style="font-size: 11px; color: %s">%s</span></div>' % (a, MUTED, b)
SIDECARDS = (card("作業の段", "4 ／ 8", crow("未着手") + crow("作業中") + crow("保留") + crow("完了"), "＋ 段を足す", "名前を変えられる。確認中・承認待ち・実行中は仕組みの段で変えられない。使っている段を消すときは移し先を選ぶ")
  + card("分類の軸", "1 ／ 5", crow("優先度", "製品の軸") + crow("部門", "営業・開発・経理"), "＋ 軸を足す", "一覧で絞る・並べるときに使う。値を消すときは移し先を選ぶ")
  + card("担当を渡すとき", "", crow("子・孫のチケット", "毎回聞く ▾") + crow("派生・関連のチケット", "毎回聞く ▾") + crow("グループ", "いつも ▾") + crow("部門（軸）", "毎回聞く ▾"), "", "渡すときに一緒に切り替えるか。毎回聞く・いつも・しない"))
seg = lambda cur: '<span style="display: inline-flex; border: 1px solid #DDE2E9; border-radius: 6px; overflow: hidden; font-size: 11px">' + "".join('<span style="padding: 3px 9px; %s">%s</span>' % ("background: #22345C; color: #FFFFFF" if x == cur else "background: #FFFFFF; color: #4A5563", x) for x in ["必須", "出す", "外す"]) + '</span>'
def sec(name, cur, sample, note=""):
    off = cur == "外す"
    return ('<div style="border: 1px solid #DDE2E9; border-radius: 8px; background: %s; opacity: %s"><div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #EDF0F4"><span style="color: #B8C0CC">⋮⋮</span><b style="font-weight: 600; flex: 1">%s%s</b>%s</div><div style="padding: 8px 12px 10px; font-size: 12px; color: %s">%s</div></div>'
            % ("#FFFFFF" if not off else "#F7F8FA", "1" if not off else ".6", name, ' <span style="font-size: 11px; font-weight: 400; color: %s">%s</span>' % (MUTED, note) if note else "", seg(cur), MUTED, sample))
form = ('<div style="display: flex; flex-direction: column; gap: 8px">'
  + sec("目的", "必須", "何のためにやるか（1〜2 文）")
  + sec("完了の条件", "必須", "終わったと言える条件。ここからテスト仕様の案ができる")
  + sec("前提と制約", "出す", "支払期日・送り方・使ってはいけないもの")
  + sec("相手", "出す", "宛先・CC・先方の担当")
  + sec("実施事項", "必須", "やることの一覧（チェックつき）")
  + sec("テスト仕様と確認の結果", "出す", "① 機械 ② AI ③ 人 の確認")
  + sec("成果物", "出す", "作ったもの（請求書・見積・メール など）")
  + sec("決定ログ", "出す", "決まったこと")
  + sec("リスクと懸念", "出す", "気になること")
  + sec("自由欄", "外す", "（このワークスペースでは使わない）")
  + '<a href="#" style="display: block; text-align: center; border: 1px dashed #B8C0CC; border-radius: 8px; padding: 10px; color: #4A5563; text-decoration: none; font-size: 12px">＋ 区画を足す</a></div>')
body = (ttl("決まり", "全員の分身とチケットに効く。足すとき、ぶつかりを分身が点検する") + RTABS("shape")
  + '<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start">'
  + '<div style="flex: 0 1 280px; min-width: 220px; display: flex; flex-direction: column; gap: 12px">'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 8px"><div style="display: flex; align-items: center; padding: 4px 6px 8px"><b style="flex: 1">種別</b><span style="font-size: 11px; color: %s">4 ／ 10</span></div>%s<a href="#" style="display: block; padding: 10px 12px; font-size: 12px">＋ 種別を足す</a></div>' % (MUTED, klist)
  + SIDECARDS + '</div>'
  + '<div style="flex: 1 1 460px; min-width: 0"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap"><b style="font-size: 15px">タスク の形</b><span style="font-size: 12px; color: %s">チケットを作るとき、この順で欄が並ぶ。つかんで並べ替え</span><span style="margin-left: auto; display: flex; gap: 6px">%s%s</span></div>' % (MUTED, btn("元に戻す"), btn("この形にする", "p"))
  + form + '<div style="font-size: 12px; color: %s; margin-top: 10px">直した形は、これから作るチケットから効く。もう作ったチケットはそのまま。運営のひな形に新しい版が出たら、ここに知らせが出る</div></div></div>' % MUTED)
page("WsShape.dc.html", "ワークスペースの管理 チケットの形", "決まり", body)

# ---------- 請求書（設定の中） ----------
ir = lambda m, amt, iss, due, st, paid: '<tr style="border-top: 1px solid #EDF0F4"><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px">%s</td><td style="padding: 9px 8px"><a href="#">PDF</a></td></tr>' % (m, amt, iss, due, st, paid)
body = (ttl("請求書", "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い", btn("設定に戻る", "", "WsSettings.dc.html"))
  + '<div style="display: flex; gap: 12px; flex-wrap: wrap; max-width: 900px">'
  + '<div style="flex: 1 1 280px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px 16px"><b>振込先</b><div style="margin-top: 6px">〇〇銀行 本店 普通 1234567<br>カ）エンジンベース</div><div style="font-size: 11px; color: %s; margin-top: 6px">振込手数料はご負担ください（仮）</div></div>' % MUTED
  + '<div style="flex: 1 1 280px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px 16px"><b>請求先</b><div style="margin-top: 6px">株式会社ENGINE BASE 経理 ご担当<br><span style="font-size: 12px; color: %s">keiri@engine-base.example</span></div><a href="#" style="font-size: 12px">変える</a></div></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: auto; max-width: 900px"><table style="width: 100%; border-collapse: collapse; font-size: 13px"><thead><tr><th>月</th><th>金額（税込）</th><th>出した日</th><th>期限</th><th>状態</th><th>入金を確かめた日</th><th></th></tr></thead><tbody>'
  + ir("10 月分", "¥16,500", "11/01", "11/30", pill("お支払い待ち", "#DCE4F2", NAVY), "—") + ir("9 月分", "¥16,500", "10/01", "10/31", pill("払われた", "#E3F1E7", "#1E5A33"), "10/28") + ir("8 月分", "¥16,500", "09/01", "09/30", pill("払われた", "#E3F1E7", "#1E5A33"), "09/29")
  + '</tbody></table></div><div style="font-size: 12px; color: %s; max-width: 900px">請求書は請求先のメールにも届く。入金は運営が確かめてから「払われた」になる（数日かかることがある）。期限を過ぎると管理者に知らせが出る。値段は仮。カード払いは後のフェーズ</div>' % MUTED)
page("WsBills.dc.html", "ワークスペースの管理 請求書", "設定 › 請求書", body)

# ---------- メンバーの 1 人 ----------
kv = lambda k, v: '<div style="display: flex; gap: 12px; padding: 9px 0; border-top: 1px solid #EDF0F4"><span style="width: 120px; flex: none; color: %s; font-size: 12px">%s</span><span style="flex: 1; min-width: 0">%s</span></div>' % (MUTED, k, v)
box = lambda t, inner, act="": '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 12px 16px"><div style="display: flex; align-items: center; gap: 8px; padding-bottom: 4px"><b>%s</b>%s</div>%s</div>' % (t, '<span style="margin-left: auto; display: flex; gap: 6px">%s</span>' % act if act else "", inner)
body = ('<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">' + av("鈴", "#2F4B7C", 44) + '<div style="min-width: 0"><h2 style="font-size: 18px; margin: 0">鈴木 一郎</h2><div style="font-size: 12px; color: %s">suzuki@engine-base.example ・ 2026-04-10 から</div></div>' % MUTED
  + '<span style="margin-left: auto; display: flex; gap: 6px">' + btn("一時的に止める") + btn("ワークスペースから外す", "d", "EdMemberRemove.dc.html") + '</span></div>'
  + '<div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start"><div style="flex: 1 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 12px">'
  + box("グループと役割", kv("営業", rolesel("メンバー") + ' <span style="font-size: 11px; color: %s">11/02 にマネージャーから（高本）</span>' % MUTED) + kv("兼ねるグループ", '<a href="EdMemberMenu.dc.html" style="font-size: 12px">＋ 兼ねるグループを足す</a>'), btn("グループを移す", "", "EdMemberMenu.dc.html"))
  + box("できること", kv("役割の束", "メンバー（チケットを作る・自分の担当を進める・承認待ちに答える）") + kv("個別に足したもの", pill("見積を承認（100 万円まで）") + ' <span style="font-size: 11px; color: %s">高本が 10/12 に足した</span>' % MUTED) + kv("個別に外したもの", '<span style="color: #8A94A3">なし</span>'), btn("足す・外す"))
  + box("担当しているもの", kv("チケット", '<a href="List.dc.html">担当 6 件</a> ・ 承認する人 2 件 ・ 期限切れ 0') + kv("取引先", '<a href="CuPage.dc.html">株式会社ソラ</a>（取引先の担当）'))
  + '</div><div style="flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 12px">'
  + box("分身", kv("PC", dot(True, "つながっている（MacBook Air）")) + kv("今月の実行", "212 回 ・ 人ごとの枠の 41%") + kv("止まった（7 日）", "0"))
  + box("ログイン", kv("入り方", "パスキー 2 つ") + kv("2 段階認証", "付けていない（パスキーで入るので要らない）") + kv("最後に入った", "11/02 09:12 ・ iPhone") + '<div style="font-size: 11px; color: %s; padding-top: 6px">パスワードで入る人が認証アプリをなくしたときは、ここから 2 段階認証を戻せる（記録に残る）</div>' % MUTED)
  + box("最近の記録", kv("11/02 09:58", "役割が マネージャー → メンバー（高本）") + kv("10/12 14:20", "見積の承認を足した（高本）"), '<a href="WsLog.dc.html" style="font-size: 12px">記録をすべて見る</a>')
  + '</div></div>')
page("WsMember.dc.html", "ワークスペース メンバーの 1 人", "メンバー › 鈴木 一郎", body)

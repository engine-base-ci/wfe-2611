import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
from subnav import ws_sub
MAIN = open(P + "Main.dc.html", encoding="utf-8").read()
def av(c, bg, n=26): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
SUB = [("CoMembers", "メンバー", "5 人 ・ 招待中 1"), ("CoGroups", "層とグループ", "層 3 ・ グループ 3"), ("CoMaster", "マスタ", "種別・段・分類・ルール"), ("CoAudit", "証跡", "いつ誰が何をしたか"), ("CoSettings", "ワークスペースの設定", "ログイン・承認・データ")]
def subnav(cur):
    out = '<aside aria-label="ワークスペースの中" style="width: 220px; flex: none; background: #FFFFFF; border-right: 1px solid #DDE2E9; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box">'
    for k, t, d in SUB:
        on = k == cur
        out += '<a href="%s.dc.html"%s style="display: flex; flex-direction: column; padding: 8px 12px; border-radius: 8px; text-decoration: none; color: #131B27; %s"><b style="font-weight: 500">%s</b><span style="font-size: 11px; color: %s">%s</span></a>' % (k, ' aria-current="page"' if on else "", "background: #F1F3F6; font-weight: 600" if on else "", t, MUTED, d)
    out += '<div style="margin-top: auto; font-size: 11px; color: %s; padding: 8px 12px">ここは管理者と、権限を付けた人だけが直せる。見るだけの人もいる</div></aside>' % MUTED
    return out
def page(name, cur, title, crumb, body, side=""):
    s = MAIN
    a = s.index('<nav aria-label="いまの場所"'); b = s.index("</nav>", a) + 6
    s = s[:a] + '<nav aria-label="いまの場所" style="display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; white-space: nowrap; overflow: hidden"><a href="CoMembers.dc.html" style="color: #4A5563; text-decoration: none">ワークスペース</a><span style="color: #B8C0CC">›</span><b style="font-weight: 500; color: #131B27">%s</b></nav>' % crumb + s[b:]
    bar_end = s.index("</span></div>", s.index('class="kn-bar"')) + len("</span></div>")
    mend = s.rindex("</main>")
    hdr = '\n  <header style="background: #FFFFFF; border-bottom: 1px solid #DDE2E9; padding: 12px 24px; display: flex; align-items: center; gap: 12px">' + icon("E", NAVY, 32) + '<div><h1 style="font-size: 18px; margin: 0">株式会社ENGINE BASE</h1><div style="font-size: 12px; color: %s">ワークスペース ・ 管理者 高本・佐藤 ・ プラン：チーム（10 人まで）</div></div></header>' % MUTED
    content = '\n  <div style="display: flex; min-height: 0">' + ws_sub(cur + ".dc.html") + '<section style="flex: 1; min-width: 0; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px">' + body + '</section>' + side + '</div>\n '
    s = s[:bar_end] + hdr + content + s[mend:]
    save(name, title, s)
    return s
def ttl(h, note, act=""): return '<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap"><h2 style="font-size: 17px; margin: 0">%s</h2><span style="font-size: 12px; color: %s">%s</span>%s</div>' % (h, MUTED, note, '<span style="margin-left: auto; display: flex; gap: 6px">%s</span>' % act if act else "")
def aside(inner, w=340): return '<aside aria-label="選んだもの" style="width: %dpx; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px">%s</aside>' % (w, inner)
def kv(rows): return '<div style="display: grid; grid-template-columns: 84px 1fr; gap: 6px; font-size: 12px">' + "".join('<span style="color: %s">%s</span><span>%s</span>' % (MUTED, k, v) for k, v in rows) + '</div>'
TH = 'font-size: 12px; color: #4A5563; font-weight: 500; text-align: left; padding: 0 10px; height: 34px; border-bottom: 1px solid #DDE2E9; background: #FAFBFC; white-space: nowrap'
TD = 'padding: 0 10px; height: 44px; border-bottom: 1px solid #EDF0F4; white-space: nowrap; font-size: 13px'
def table(heads, rows, sel=-1):
    h = "".join('<th style="%s">%s</th>' % (TH, x) for x in heads)
    r = "".join('<tr style="%s">%s</tr>' % ("background: #F1F3F6" if i == sel else "", "".join('<td style="%s">%s</td>' % (TD, c) for c in row)) for i, row in enumerate(rows))
    return '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 8px; overflow-x: auto"><table style="border-collapse: collapse; width: 100%%"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (h, r)
def who(c, bg, n, sub): return '<span style="display: inline-flex; gap: 8px; align-items: center">%s<span><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span></span>' % (av(c, bg), n, MUTED, sub)
ROLE = {"管理者": ("#22345C", "#FFFFFF"), "マネージャー": ("#DCE4F2", "#22345C"), "メンバー": ("#EEF0F4", MUTED), "閲覧のみ": ("#F7F8FA", MUTED)}
def role(r): return pill(r, *ROLE[r])
dot = lambda ok, t: '<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: %s"><span style="width: 8px; height: 8px; border-radius: 99px; background: %s"></span>%s</span>' % ("#131B27" if ok else MUTED, "#166534" if ok else "#B8C0CC", t)

# ---------- メンバー ----------
rows = [
 [who("高", "#6B5B99", "高本 聖斗（自分）", "takamoto@engine-base.example"), role("管理者"), "営業", dot(True, "MacBook ・ つながっている"), "パスキー", "いま"],
 [who("佐", "#186F69", "佐藤 花子", "sato@engine-base.example"), role("管理者") + " " + role("マネージャー"), "営業 ＋ 受託開発", dot(True, "つながっている"), "パスキー", "10 分前"],
 [who("鈴", "#2F4B7C", "鈴木 一郎", "suzuki@engine-base.example"), role("メンバー"), "営業", dot(True, "つながっている"), "パスワード＋2 段階", "1 時間前"],
 [who("田", "#7E570D", "田中 美咲", "tanaka@engine-base.example"), role("メンバー"), "営業 ＋ 経理", dot(False, "3 日つながっていない"), "パスワード＋2 段階", "3 日前"],
 [who("山", "#4A5563", "山口 健", "yamaguchi@engine-base.example"), role("閲覧のみ"), "受託開発", dot(False, "PC なし"), "パスキー", "昨日"],
 [who("？", "#B8C0CC", "kimura@engine-base.example", "招待中 ・ 11/01 に送った ・ あと 6 日"), role("メンバー"), "経理", "—", "—", btn("送り直す")],
]
body = (ttl("メンバー", "5 人 ／ 10 人まで ・ 招待中 1", btn("＋ メンバーを招く", "p", "CoInvite.dc.html"))
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">' + chip("すべて 6", True) + chip("管理者 2") + chip("マネージャー 1") + chip("メンバー 2") + chip("閲覧のみ 1") + chip("招待中 1") + '<input placeholder="名前・メールで探す" style="margin-left: auto; height: 30px; width: 220px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; font-family: inherit; font-size: 12px"></div>'
  + table(["名前", "役割", "所属（主＋兼務）", "分身の PC", "ログイン", "最後に使った"], rows, 2)
  + '<div style="font-size: 12px; color: %s">役割は 管理者・マネージャー・メンバー・閲覧のみ。マネージャーは「配る・承認する・記憶を確かめる」をまとめた権限で、グループごとに付ける</div>' % MUTED)
side = aside('<div style="display: flex; gap: 10px; align-items: center">' + av("鈴", "#2F4B7C", 40) + '<div><b style="font-size: 15px">鈴木 一郎</b><div style="font-size: 12px; color: %s">suzuki@engine-base.example</div></div></div>' % MUTED
  + kv([("役割", role("メンバー") + ' <a href="#" style="font-size: 12px">変える</a>'), ("主の所属", "営業"), ("兼務", '<a href="#">＋ 足す</a>'), ("分身", "鈴木のAI ・ Windows ・ つながっている"), ("ログイン", "パスワード＋認証アプリ"), ("入った日", "2026/09/12"), ("担当", "4 件（承認待ち 0）")])
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px"><b style="font-weight: 500">グループごとの権限</b><div style="display: flex; justify-content: space-between; margin-top: 6px"><span>営業</span><span>メンバー</span></div><div style="color: %s; margin-top: 4px">マネージャーにすると、このグループのチケットを配る・承認する・記憶を確かめる ができる</div></div>' % MUTED
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + btn("役割を変える") + btn("一時的に止める") + btn("ワークスペースから外す", "d") + '</div>'
  + '<div style="font-size: 11px; color: %s; border-top: 1px solid #EDF0F4; padding-top: 10px">役割を変える・外すときは、あなたの本人確認を取り直す。外すときは担当しているチケットの引き継ぎ先を選ぶ段がある</div>' % MUTED)
CM = page("CoMembers.dc.html", "CoMembers", "ワークスペース メンバー", "メンバー", body, side)

# ---------- 招く（小窓） ----------
s = modal(CM, mhead("メンバーを招く", "CoMembers.dc.html", "", "招かれた人にメールが届き、7 日のあいだ入れる")
  + mbody('<div>' + lab("メール", "（いくつでも。改行かカンマで分ける）") + '<div style="border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 6px 8px; display: flex; gap: 4px; flex-wrap: wrap; min-height: 40px; align-items: center">' + pill("kimura@engine-base.example ×", "#EEF3FD", NAVY) + pill("ono@engine-base.example ×", "#EEF3FD", NAVY) + '</div></div>'
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("役割") + field("メンバー ▾") + '</div><div>' + lab("主の所属") + field("経理 ▾") + '</div></div>'
  + '<div>' + lab("兼務", "（任意）") + field("＋ グループを足す", True) + '</div>'
  + '<div style="display: flex; flex-direction: column">' + check("入ったらすぐ分身を用意する", True, "その人の PC をつなぐ案内が最初に出る。つなぐまで分身は動かない") + check("パスキーでのログインを勧める", True, "パスワードで入る人は 2 段階認証が必ず要る") + '</div>'
  + '<div>' + lab("ひとこと", "（招待のメールに入る）") + field("経理の月次をいっしょに回してもらいます。よろしくお願いします", True) + '</div>'
  + '<div style="display: flex; gap: 8px; align-items: center; background: #F7F8FA; border-radius: 8px; padding: 8px 10px; font-size: 12px"><span style="flex: 1">招待のリンクをコピーして渡す（7 日で切れる・1 回だけ使える）</span>' + btn("リンクを作る") + '</div>')
  + mfoot(btn("やめる", "", "CoMembers.dc.html"), btn("2 人を招く", "p", "CoMembers.dc.html"), left='<span style="font-size: 12px; color: %s">招くと 7 人 ／ 10 人まで</span>' % MUTED), 600, "メンバーを招く")
save("CoInvite.dc.html", "メンバーを招く", s)

# ---------- 層とグループ ----------
def node(t, sub, lvl, sel=False, kind="グループ"):
    return '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-left: %dpx; border-radius: 8px; %s"><span style="color: #B8C0CC">⋮⋮</span>%s<span style="flex: 1"><b style="font-weight: 500">%s</b><span style="display: block; font-size: 11px; color: %s">%s</span></span>%s</div>' % (lvl * 24, "background: #F1F3F6; font-weight: 600" if sel else "", pill(kind, "#E6EAF2" if kind == "層" else "#E3F1EF", NAVY if kind == "層" else "#186F69"), t, MUTED, sub, '<span style="color: #4A5563">⋯</span>')
tree = ('<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 10px">'
  + node("株式会社ENGINE BASE", "ワークスペース ・ 5 人", 0, kind="ワークスペース").replace(pill("ワークスペース", "#E3F1EF", "#186F69"), pill("ワークスペース", "#22345C", "#FFFFFF"))
  + node("営業", "層 ・ マネージャー 佐藤", 1, kind="層") + node("営業", "グループ ・ 4 人 ・ チケット 18", 2, True)
  + node("開発", "層", 1, kind="層") + node("受託開発", "グループ ・ 2 人 ・ チケット 42", 2)
  + node("管理", "層", 1, kind="層") + node("経理", "グループ ・ 1 人 ・ チケット 9", 2)
  + '<div style="display: flex; gap: 12px; padding: 10px 10px 2px; font-size: 12px"><a href="#">＋ 層を足す</a><a href="#">＋ グループを足す</a></div></div>')
body = (ttl("層とグループ", "つかんで並べ替え・入れ替え。層は大きなまとまり、グループは日々のチケットの置き場", btn("運営のひな形から足す"))
  + '<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start"><div style="flex: 1 1 380px">' + tree + '</div>'
  + '<div style="flex: 1 1 280px; background: #F7F8FA; border-radius: 10px; padding: 12px 14px; font-size: 12px; display: flex; flex-direction: column; gap: 6px"><b style="font-weight: 500">層ごとに置けるもの</b><span style="color: %s">・ 守ること（その層の全員の分身に効く）</span><span style="color: %s">・ やり方（業務の型）</span><span style="color: %s">・ 承認の決まり（上位の承認へ回す条件）</span><b style="font-weight: 500; margin-top: 6px">ワークスペースで共通のもの</b><span style="color: %s">種別・作業の段・分類の軸はワークスペースで 1 つ（グループを渡っても段がずれない）</span></div></div>' % (MUTED, MUTED, MUTED, MUTED))
side = aside('<div style="display: flex; gap: 10px; align-items: center">' + icon("EG", "#186F69", 40) + '<div><b style="font-size: 15px">営業</b><div style="font-size: 12px; color: %s">グループ ・ 層：営業</div></div></div>' % MUTED
  + kv([("短い名前", "EG（番号の頭）"), ("マネージャー", "佐藤 花子"), ("メンバー", "高本・鈴木・田中（＋兼務 佐藤）"), ("分身", "4 人分 ・ グループの分身 0"), ("チケット", "18 件 ・ 承認待ち 2"), ("守ること", "層から 1 ・ グループ 0"), ("承認の決まり", "100 万円を超える見積はマネージャーへ")])
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + btn("名前を変える") + btn("メンバー", "", "OvGroup.dc.html") + btn("別の層へ移す") + '</div>'
  + '<div style="font-size: 11px; color: %s; border-top: 1px solid #EDF0F4; padding-top: 10px">消すときは、中のチケットの移し先を選ぶ。移したことは各チケットの記録に残る</div>' % MUTED)
page("CoGroups.dc.html", "CoGroups", "ワークスペース 層とグループ", "層とグループ", body, side)

# ---------- マスタ ----------
mt = lambda t, n, on=False: '<a href="#" style="padding: 8px 12px; border-bottom: 2px solid %s; color: %s; text-decoration: none; white-space: nowrap; %s">%s <span style="font-size: 11px; color: %s">%s</span></a>' % (NAVY if on else "transparent", NAVY if on else MUTED, "font-weight: 500;" if on else "", t, MUTED, n)
kinds = "".join('<div style="display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid #EDF0F4; %s"><span style="color: #B8C0CC">⋮⋮</span><span style="display: inline-block; min-width: 44px; text-align: center; font-size: 11px; font-weight: 500; border-radius: 99px; padding: 1px 8px; color: #FFFFFF; background: %s">%s</span><span style="flex: 1; font-size: 12px; color: %s">%s</span><span style="font-size: 12px; color: %s">%s</span></div>' % ("background: #F1F3F6" if n == "タスク" else "", c, n, MUTED, d, MUTED, u) for n, c, d, u in [("タスク", "#186F69", "区画 12 ・ 必須 3", "使用 58"), ("課題", "#B45309", "区画 9 ・ 必須 3", "使用 21"), ("QA", "#B91C1C", "区画 8 ・ 必須 4", "使用 7"), ("会議", "#6D4AA6", "区画 6 ・ 必須 2", "使用 12")])
sect = "".join('<div style="display: flex; align-items: center; gap: 8px; padding: 7px 0; border-top: 1px solid #EDF0F4; font-size: 12px"><span style="color: #B8C0CC">⋮⋮</span><span style="flex: 1">%s</span>%s</div>' % (n, "".join(chip(x, x == st) for x in ["必須", "出す", "外す"])) for n, st in [("目的", "必須"), ("完了の条件", "必須"), ("前提と制約", "出す"), ("相手", "出す"), ("実施事項", "必須"), ("テスト仕様と確認の結果", "出す"), ("成果物", "出す"), ("決定ログ", "出す"), ("リスクと懸念", "出す"), ("自由欄", "外す")])
body = (ttl("マスタ", "ワークスペースで共通の決まり。直すと全員のチケットに効く")
  + '<div style="display: flex; gap: 10px; align-items: center; border: 1px solid #C9D6EE; background: #F3F6FC; border-radius: 8px; padding: 8px 12px; font-size: 12px">' + icon("新", NAVY, 22) + '<span style="flex: 1">運営のひな形「中小の営業・受託」に新しい版（v5）が出ました。種別「QA」の区画が 1 つ増えています</span>' + btn("差分を見る") + '</div>'
  + '<div style="display: flex; border-bottom: 1px solid #DDE2E9; overflow-x: auto">' + mt("種別", "4 / 10", True) + mt("作業の段", "6 / 8") + mt("分類の軸", "3 ＋ ワークスペース 1 / 5") + mt("成果物の形", "5") + mt("ルールと禁止事項", "ワークスペース 4 ・ グループ 1") + mt("一緒に切り替えるもの", "4") + '</div>'
  + '<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start">'
  + '<div style="flex: 1 1 300px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden"><div style="display: flex; align-items: center; padding: 10px 12px"><b style="flex: 1">種別</b><a href="#" style="font-size: 12px">＋ 種別を足す</a></div>' + kinds + '</div>'
  + '<div style="flex: 2 1 420px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 12px 14px"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px"><b style="flex: 1">タスクの区画</b><span style="font-size: 12px; color: %s">新しく作るチケットから効く</span></div>' % MUTED + sect
  + '<div style="font-size: 11px; color: %s; margin-top: 8px">使われている値を消すときは、置き換え先を選んでから消す</div></div></div>' % MUTED)
page("CoMaster.dc.html", "CoMaster", "ワークスペース マスタ", "マスタ", body)

# ---------- 証跡 ----------
A = lambda c, bg, n: '<span style="display: inline-flex; gap: 6px; align-items: center">%s%s</span>' % (av(c, bg, 20), n)
AI = lambda n: '<span style="display: inline-flex; gap: 6px; align-items: center">%s%s</span>' % (icon("AI", NAVY, 20), n)
k = lambda t, c: pill(t, *c)
LG = ("#EEF0F4", MUTED); PW = ("#FCEBD5", "#7A4A05"); AP = ("#E8F5EC", "#166534"); EX = ("#E6EAF2", NAVY); DL = ("#FDECEC", "#B91C1C")
rows = [
 ["11/02 10:52", A("高", "#6B5B99", "高本 聖斗"), k("承認", AP), "まとめて承認 3 件（KR-031・EG-127・EG-133）", "MacBook ・ 東京"],
 ["11/02 10:42", AI("高本のAI"), k("外に出した", EX), "EG-128 請求書のメールの下書きを作成（送信はまだ）", "高本の MacBook"],
 ["11/02 09:58", A("佐", "#186F69", "佐藤 花子"), k("権限", PW), "鈴木 一郎 を 営業 の マネージャー → メンバー", "iPhone ・ 本人確認を取り直した"],
 ["11/02 09:30", A("高", "#6B5B99", "高本 聖斗"), k("ログイン", LG), "パスキーで入った", "MacBook ・ 東京"],
 ["11/01 18:20", A("田", "#7E570D", "田中 美咲"), k("持ち出し", DL), "経理 のチケット 9 件を CSV で書き出した", "Windows ・ 大阪"],
 ["11/01 09:06", A("高", "#6B5B99", "高本 聖斗"), k("許可", PW), "高本のAI に 先方の請求書システムを見ることを今回だけ許した（EG-128）", "MacBook"],
 ["11/01 08:12", AI("高本のAI"), k("実行", EX), "EG-128 本文を版 2 に（請求書を作った）", "高本の MacBook"],
]
body = (ttl("証跡", "ワークスペースの中で起きた大事なことの記録。消せない・直せない", btn("書き出す（CSV）"))
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">' + chip("すべて", True) + chip("ログイン") + chip("権限") + chip("承認") + chip("外に出した") + chip("持ち出し") + chip("許可") + '<span style="margin-left: auto; display: flex; gap: 6px; font-size: 12px; color: %s">人：すべて ▾　分身：すべて ▾　期間：この 1 週間 ▾</span></div>' % MUTED
  + table(["いつ", "誰", "種類", "何をした", "どこから"], rows, 2)
  + '<div style="font-size: 12px; color: %s">ワークスペース全体の証跡を見られるのは管理者と権限を付けた人。自分の操作と自分が関わるチケットの記録は誰でも見られる。契約中はずっと残す</div>' % MUTED)
side = aside('<b style="font-size: 14px">権限の変更</b>' + kv([("いつ", "11/02 09:58:14"), ("誰", "佐藤 花子（管理者）"), ("何を", "鈴木 一郎 の 営業 の役割"), ("前", "マネージャー"), ("後", "メンバー"), ("本人確認", "取り直した（パスキー）"), ("端末", "iPhone ・ 東京 ・ 203.0.113.24")])
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px"><b style="font-weight: 500">理由</b><div style="color: %s; margin-top: 4px">兼務が終わったため（佐藤）</div></div>' % MUTED
  + '<div style="display: flex; gap: 6px">' + btn("鈴木さんの記録だけ見る") + '</div>', 320)
page("CoAudit.dc.html", "CoAudit", "ワークスペース 証跡", "証跡", body, side)

# ---------- ワークスペースの設定 ----------
def block(t, rows):
    return '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 4px 16px"><div style="font-weight: 500; padding: 10px 0 4px">%s</div>%s</div>' % (t, "".join('<div style="display: flex; gap: 16px; align-items: center; padding: 10px 0; border-top: 1px solid #EDF0F4; flex-wrap: wrap"><span style="flex: 1 1 260px"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span><span style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap">%s</span></div>' % (a, MUTED, b, c) for a, b, c in rows))
body = (ttl("ワークスペースの設定", "直せるのは管理者と、権限を付けた人。作った人だから特別、ということはない。大事な変更は本人確認を取り直し、証跡に残る")
  + '<div style="display: flex; flex-direction: column; gap: 12px; max-width: 920px">'
  + block("ワークスペースの情報", [("ワークスペースの名前", "会社名・チーム名・自分の名前など。メールの差出人にも出る", field("株式会社ENGINE BASE")), ("ロゴ", "左上と招待のメールに出る", icon("E", NAVY, 28) + btn("変える"))])
  + block("ログインと安全", [("ログインの方法", "パスキーを勧める。パスワードは 12 文字以上", chip("パスキーを勧める", True) + chip("パスキーだけ")), ("2 段階認証", "パスワードで入る人は必ず要る（認証アプリ）", pill("必須", "#22345C", "#FFFFFF")), ("操作がないと切る", "既定 12 時間 ・ 最長 7 日", field("12 時間 ▾").replace("min-height: 34px", "min-height: 30px")), ("新しい端末で入ったら", "本人に知らせる", toggle(True))])
  + block("承認", [("まとめて承認してよい条件", "確認がすべて通っている ・ ③ が済んでいる ・ 金額 50 万円以下 ・ 送る先が前と同じ", btn("条件を直す")), ("人が見る項目を 1 つずつ確かめる", "承認の前に「見た」を押さないと OK できない。見たことが証跡に残る", toggle(True)), ("上位の承認へ回す", "グループごとに 層とグループ で決める", '<a href="CoGroups.dc.html" style="font-size: 12px">層とグループへ →</a>')])
  + block("分身", [("分身が動く場所", "それぞれの人の PC だけで動く。PC が閉じていると待つ", pill("PC だけ")), ("外に出す前は必ず承認", "メールを送る・外のサービスに書き込む前に、担当者の承認を取る", pill("必須", "#22345C", "#FFFFFF")), ("5 時間の枠", "1 人ずつの使える量。超えそうなら知らせる", toggle(True))])
  + block("権限", [("プランと支払い", "見られる・変えられる人", field("管理者 ▾").replace("min-height: 34px", "min-height: 30px")), ("持ち出し", "チケット・証跡を CSV で書き出せる人", field("管理者とマネージャー ▾").replace("min-height: 34px", "min-height: 30px")), ("ワークスペースを消す", "消せる人。消すと退会の順番ですべてのデータを消す", field("管理者 ▾").replace("min-height: 34px", "min-height: 30px") + btn("消す手続き", "d"))])
  + '</div>')
page("CoSettings.dc.html", "CoSettings", "ワークスペースの設定", "ワークスペースの設定", body)

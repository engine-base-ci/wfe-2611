import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
B = os.path.dirname(os.path.abspath(__file__)) + "/base/"
def base(n, wire=True):
    s = open(B + n + ".dc.html", encoding="utf-8").read()
    if n == "Main":
        s = s.replace('自分の AI の動き<a href="#" style="margin-left: auto; font-size: 12px; font-weight: 400">AI の動きへ</a>', '高本のAI のいま<a href="Room.dc.html" style="margin-left: auto; font-size: 12px; font-weight: 400">分身の部屋へ</a>')
        s = s.replace('<a href="#" style="margin-left: auto; font-size: 12px; font-weight: 400">すべて</a>', '<a href="Approvals.dc.html" style="margin-left: auto; font-size: 12px; font-weight: 400">すべて</a>')
        s = s.replace('<a href="#">京蟻 追加開発の見積を出す', '<a href="TicketDetail.dc.html">京蟻 追加開発の見積を出す')
        if wire: s = wire_buttons(s, {"表示設定": "MnView.dc.html", "条件を保存": "LsSave.dc.html"})
    if n == "Overview":
        s = s.replace('<a href="#">{{m.name}}</a>', '<a href="List.dc.html">{{m.name}}</a>')
        a = s.index('<span style="margin-left: auto; display: flex; gap: 4px; align-items: center">')
        s = s[:a] + '<a href="OvGroup.dc.html" title="メンバーと決まり" style="margin-left: auto; display: flex; gap: 4px; align-items: center; text-decoration: none">' + s[a + len('<span style="margin-left: auto; display: flex; gap: 4px; align-items: center">'):]
        e = s.index("</span>", s.index('>田</span>', a) + 10)
        s = s[:e] + "</a>" + s[e + 7:]
    return s
def av(c, bg, n=26): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
M = base("Main"); O = base("Overview")
open(P + "Main.dc.html", "w", encoding="utf-8").write(M); open(P + "Overview.dc.html", "w", encoding="utf-8").write(O)
# 1 自分に関わるもの 表示設定
sec = lambda t, on=True: '<div style="display: flex; align-items: center; gap: 8px; padding: 4px 6px"><span style="color: #B8C0CC">⋮⋮</span>%s<span style="flex: 1">%s</span></div>' % (check("", on).replace("padding: 4px 0", "padding: 0"), t)
view = ('<div style="display: flex; align-items: center; padding: 0 4px 6px"><b style="flex: 1">自分に関わるものの見え方</b><a href="#" style="font-size: 12px">はじめに戻す</a></div>'
  + '<div style="font-size: 11px; color: %s; padding: 2px 6px">上の数字（つかんで並べ替え）</div>' % MUTED + sec("期限切れ") + sec("今日まで") + sec("自分が承認") + sec("AI が動いている") + sec("今週まで", False)
  + SEP + '<div style="font-size: 11px; color: %s; padding: 2px 6px">右に出すもの</div>' % MUTED + sec("自分の承認を待っているもの") + sec("高本のAI のいま") + sec("最近の知らせ") + sec("ウォッチしているものの動き", False)
  + SEP + '<div style="display: grid; grid-template-columns: 80px 1fr; gap: 8px; align-items: center; font-size: 12px; padding: 4px 6px"><span style="color: %s">表の分け方</span><span style="display: flex; gap: 4px; flex-wrap: wrap">%s%s%s</span><span style="color: %s">入れるもの</span><span style="display: flex; flex-direction: column">%s%s%s</span></div>' % (MUTED, chip("期限", True), chip("グループ"), chip("状態"), MUTED, check("担当しているもの", True), check("承認するもの・渡されたもの", True), check("ウォッチしているもの", False))
  + '<div style="font-size: 11px; color: %s; padding: 4px 6px">自分だけの見え方。ほかの人には変わらない</div>' % MUTED)
save("MnView.dc.html", "自分に関わるものの見え方", wire_buttons(anchor_pop(base("Main", False), "表示設定", view, 320), {"条件を保存": "LsSave.dc.html"}))
# 2 グループのメンバーと決まり
mem = lambda c, bg, n, role, ai, load: '<div style="display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid #EDF0F4">%s<div style="flex: 1; min-width: 0"><div>%s %s</div><div style="font-size: 11px; color: %s">%s</div></div><span style="font-size: 11px; color: %s; width: 80px; text-align: right">%s</span><span style="color: #4A5563">⋯</span></div>' % (av(c, bg), n, pill(role) if role else "", MUTED, ai, MUTED, load)
tab = lambda t, on: '<a href="#" style="padding: 8px 14px; border-bottom: 2px solid %s; color: %s; text-decoration: none; %s">%s</a>' % (((NAVY, NAVY, "font-weight: 500") if on else ("transparent", MUTED, "")) + (t,))
dr = ('<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4">' + icon("EG", "#186F69", 30) + '<div><b style="font-size: 15px">営業</b><div style="font-size: 12px; color: %s">グループ ・ 層：営業 ・ メンバー 4 人</div></div><a href="Overview.dc.html" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>' % MUTED
  + '<div style="display: flex; border-bottom: 1px solid #EDF0F4; padding: 0 18px">' + tab("メンバー 4", True) + tab("このグループの決まり", False) + tab("通知", False) + '</div>'
  + '<div style="flex: 1; overflow: auto; padding: 8px 18px 14px">'
  + '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 0 10px"><input placeholder="名前で探す" style="flex: 1; height: 30px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 8px; font-family: inherit; font-size: 12px">' + btn("＋ メンバーを足す") + '</div>'
  + '<div style="display: flex; font-size: 11px; color: %s; padding: 0 0 4px"><span style="flex: 1">名前・分身</span><span style="width: 80px; text-align: right">今週の担当</span><span style="width: 14px"></span></div>' % MUTED
  + mem("佐", "#186F69", "佐藤 花子", "マネージャー", "佐藤のAI ・ 実行 OK ・ 1 件 実行中", "9 件")
  + mem("高", "#6B5B99", "高本 聖斗（自分）", "", "高本のAI ・ 実行 OK ・ 1 件 実行中", "7 件")
  + mem("鈴", "#2F4B7C", "鈴木 一郎", "", "鈴木のAI ・ 実行 OK ・ 確認で直し中", "4 件")
  + mem("田", "#7E570D", "田中 美咲", "", "田中のAI ・ PC がつながっていない", "2 件")
  + '<div style="margin-top: 14px; background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><b style="font-weight: 500">このグループで決まっていること</b><span style="color: %s">種別：タスク・課題・QA・会議 ・ 分類 6 ・ 節目 4</span><span style="color: %s">承認：100 万円を超える見積はマネージャーへ回す</span><span style="color: %s">層「営業」の守ること 1 ・ やり方 2 が全員の分身に効く</span><a href="#">決まりを開く →</a></div>' % (MUTED, MUTED, MUTED)
  + '<div style="font-size: 11px; color: %s; margin-top: 10px">メンバーを足す・外す・マネージャーにするのは、マネージャーと管理者だけ</div></div>' % MUTED)
save("OvGroup.dc.html", "グループのメンバーと決まり", drawer(O, dr, 520, "グループのメンバーと決まり"))
# 3 自分のメニュー（右上）
mi = lambda t, sub="", href="#", danger=False: '<a href="%s" style="display: flex; flex-direction: column; padding: 7px 10px; border-radius: 6px; text-decoration: none; color: %s">%s%s</a>' % (href, "#B91C1C" if danger else "#131B27", t, '<span style="font-size: 11px; color: %s">%s</span>' % (MUTED, sub) if sub else "")
me = ('<div style="display: flex; gap: 10px; align-items: center; padding: 4px 6px 10px">' + av("高", "#6B5B99", 36) + '<div><b>高本 聖斗</b><div style="font-size: 11px; color: %s">株式会社ENGINE BASE ・ 営業</div></div></div>' % MUTED
  + '<div style="display: flex; align-items: center; gap: 8px; border: 1px solid #DDE2E9; border-radius: 8px; padding: 6px 10px; margin: 0 4px 6px; font-size: 12px"><span style="width: 8px; height: 8px; border-radius: 99px; background: #166534"></span><span style="flex: 1">高本の MacBook がつながっている<span style="display: block; font-size: 11px; color: %s">分身はこの PC で実行する</span></span></div>' % MUTED
  + mi("分身の部屋", "高本のAI ・ 覚えたいこと 4", "Room.dc.html") + mi("自分の設定", "名前・ログイン・PC・預けたログイン情報・知らせ", "MeProfile.dc.html") + mi("自分の使った量", "5 時間の枠 32% ・ 今月 41%", "MePC.dc.html")
  + SEP + '<div style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 12px; flex-wrap: wrap"><span style="flex: 1; white-space: nowrap">見た目</span>' + chip("明るい", True) + chip("暗い") + chip("PC に合わせる") + '</div>'
  + mi("キーボードの操作", "? で一覧") + mi("困ったとき・お知らせ")
  + SEP + mi("ログアウト", "", "#", True))
save("TopMe.dc.html", "自分のメニュー", anchor_pop(M, "高▾", me, 300))
# 4 ワークスペースを切り替える（左上）
ROLEC = {"管理者": ("#22345C", "#FFFFFF"), "マネージャー": ("#DCE4F2", "#22345C"), "メンバー": ("#EEF0F4", MUTED), "閲覧のみ": ("#F7F8FA", MUTED), "依頼する側": ("#FCEBD5", "#7A4A05"), "自分だけ": ("#E3F1EF", "#186F69")}
def ws(m, bg, n, sub, role, on=False, href="#"):
    return '<a href="%s" style="display: flex; gap: 10px; align-items: center; padding: 8px; border-radius: 8px; text-decoration: none; color: #131B27; %s">%s<span style="flex: 1; min-width: 0"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span>%s%s</a>' % (href, "background: #F1F3F6" if on else "", icon(m, bg, 28), n, MUTED, sub, pill(role, *ROLEC[role]), '<b style="color: #22345C; margin-left: 4px">✓</b>' if on else '<span style="width: 14px"></span>')
orgh = (ws("E", NAVY, "株式会社ENGINE BASE", "", "管理者", True, "Main.dc.html").replace('<span style="font-size: 11px; color: #4A5563"></span>', "")
  + ws("高", "#6B5B99", "高本 聖斗", "", "自分だけ").replace('<span style="font-size: 11px; color: #4A5563"></span>', "")
  + ws("京", "#6D4AA6", "京蟻システム株式会社", "", "メンバー").replace('<span style="font-size: 11px; color: #4A5563"></span>', "")
  + ws("ミ", "#186F69", "合同会社ミナト", "クライアントの場所", "依頼する側")
  + SEP + '<a href="#" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; text-decoration: none; color: #131B27"><span style="flex: 1">届いた招待</span><b style="font-size: 11px; background: #B45309; color: #FFFFFF; border-radius: 99px; padding: 0 7px">1</b><span style="color: #8A94A3">›</span></a>'
  + mi("＋ 新しいワークスペースを作る", "", "TnNew.dc.html"))
s = M
s = s.replace('<b class="kn-lbl" style="font-weight: 700">ENGINE BASE ▾</b>', '<b class="kn-lbl" style="font-weight: 700; background: #DDE2E9; border-radius: 4px; padding: 0 4px">ENGINE BASE ▾</b>', 1)
save("TopOrg.dc.html", "ワークスペースを切り替える", float_pop(s, orgh, "top: 48px; left: 8px; width: 320px; max-width: calc(100vw - 16px)"))

# 5 新しいワークスペースを作る
kind = lambda t, d, on=False: '<label style="flex: 1 1 150px; display: flex; flex-direction: column; gap: 2px; border: 1px solid %s; background: %s; border-radius: 8px; padding: 10px 12px"><b style="font-weight: 500">%s</b><span style="font-size: 11px; color: %s">%s</span></label>' % (NAVY if on else "#DDE2E9", "#F1F3F6" if on else "#FFFFFF", t, MUTED, d)
s = modal(M, '<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4"><b style="font-size: 15px">新しいワークスペースを作る</b><a href="TopOrg.dc.html" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>'
  + '<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">'
  + '<div>' + lab("どう使う？", "（はじめの層とひな形が変わる。あとで直せる）") + '<div style="display: flex; gap: 8px; flex-wrap: wrap">' + kind("会社・事業", "部署を層にして、人を招く", True) + kind("チーム・プロジェクト", "数人で 1 つの仕事を回す") + kind("自分ひとり", "個人の仕事。あとで人を招ける") + '</div></div>'
  + '<div>' + lab("名前", "（会社名・チーム名・自分の名前など）") + field("株式会社ENGINE BASE 新規事業") + '</div>'
  + '<div>' + lab("ひな形") + field("中小の営業・受託（層 3・種別 4・やり方 5） ▾") + '<div style="font-size: 11px; color: %s; margin-top: 4px">運営が用意したひな形。取り込んだあとは独立して直せる</div></div>' % MUTED
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><b style="font-weight: 500">作るとこうなる</b><span style="color: %s">・ あなたが最初の管理者になる（あとで権限を人に付けられる）</span><span style="color: %s">・ 今のワークスペースとは中身も分身の記憶も分かれる</span><span style="color: %s">・ プランは無料で始まる。人を招くとき・使う量が増えたときに選ぶ</span></div>' % (MUTED, MUTED, MUTED)
  + '</div>' + mfoot(btn("やめる", "", "TopOrg.dc.html"), btn("作って入る", "p", "Main.dc.html")), 600, "新しいワークスペースを作る")
save("TnNew.dc.html", "新しいワークスペースを作る", s)

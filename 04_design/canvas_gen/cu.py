import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
from subnav import build
MAIN = open(P + "Main.dc.html", encoding="utf-8").read()
def shell(name, title, crumbs, content):
    s = MAIN
    a = s.index('<nav aria-label="いまの場所"'); b = s.index("</nav>", a) + 6
    cr = '<span style="color: #B8C0CC">›</span>'.join(('<a href="%s" style="color: #4A5563; text-decoration: none">%s</a>' % (h, t)) if h else '<b style="font-weight: 500; color: #131B27">%s</b>' % t for t, h in crumbs)
    s = s[:a] + '<nav aria-label="いまの場所" style="display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; white-space: nowrap; overflow: hidden">%s</nav>' % cr + s[b:]
    bar_end = s.index("</span></div>", s.index('class="kn-bar"')) + len("</span></div>")
    mend = s.rindex("</main>")
    s = s[:bar_end] + content + "\n " + s[mend:]
    save(name, title, s); return s
def av(c, bg, n=24): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 10px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
MARK = lambda m, bg: '<span style="width: 20px; height: 20px; flex: none; border-radius: 6px; background: %s; color: #FFFFFF; display: grid; place-items: center; font-size: 10px; font-weight: 700">%s</span>' % (bg, m)
def sub(cur):
    return build("取引先の中", [("", [("CuList.dc.html", MARK("全", "#4A5563"), "すべての取引先", "6", False), ("CuRequests.dc.html", MARK("依", "#B45309"), "届いた依頼", "3", True), ("#rev", MARK("検", "#6D4AA6"), "検収待ち", "2", False)]),
        ("担当している取引先", [("CuPage.dc.html", MARK("セ", "#186F69"), "セイコー株式会社", "", False), ("#", MARK("京", "#6D4AA6"), "京蟻システム", "", False), ("#", MARK("ミ", "#B45309"), "合同会社ミナト", "", False)])], cur)
EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>'
seen = lambda t="先方に見える": '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #7A4A05; background: #FFF4E0; border-radius: 99px; padding: 1px 8px">' + EYE + t + '</span>'
priv = lambda t="社内だけ": '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #4A5563; background: #F2F4F7; border-radius: 99px; padding: 1px 8px">' + LOCK + t + '</span>'
TH = 'font-size: 12px; color: #4A5563; font-weight: 500; text-align: left; padding: 0 12px; height: 34px; border-bottom: 1px solid #DDE2E9; background: #FAFBFC; white-space: nowrap'
TD = 'padding: 0 12px; height: 48px; border-bottom: 1px solid #EDF0F4; white-space: nowrap; font-size: 13px'
def table(heads, rows):
    return '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow-x: auto"><table style="border-collapse: collapse; width: 100%%"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % ("".join('<th style="%s">%s</th>' % (TH, h) for h in heads), "".join("<tr>" + "".join('<td style="%s">%s</td>' % (TD, c) for c in r) + "</tr>" for r in rows))
cl = lambda m, bg, n, sub_, href="CuPage.dc.html": '<a href="%s" style="display: inline-flex; gap: 10px; align-items: center; text-decoration: none; color: #131B27">%s<span><b style="font-weight: 600; display: block">%s</b><span style="font-size: 11px; color: %s">%s</span></span></a>' % (href, icon(m, bg, 30), n, MUTED, sub_)
GC = {'営業': ('EG', '#186F69'), '受託開発': ('JD', '#6D4AA6'), '経理': ('KR', '#B45309')}
grp = lambda *gs: '<span style="display: inline-flex; gap: 4px; flex-wrap: wrap">' + ''.join('<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; border: 1px solid #DDE2E9; border-radius: 99px; padding: 1px 8px 1px 3px; background: #FFFFFF"><span style="width: 14px; height: 14px; border-radius: 4px; background: %s; color: #FFFFFF; font-size: 8px; display: grid; place-items: center">%s</span>%s</span>' % (GC[g][1], GC[g][0], g) for g in gs) + '</span>'
num = lambda n, warn=False: '<b style="font-weight: 600; color: %s">%s</b>' % ("#B45309" if warn else "#131B27", n)
# ---------- 一覧 ----------
body = ('\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + sub("CuList.dc.html")
  + '<section style="flex: 1; min-width: 0; padding: 22px 28px; display: flex; flex-direction: column; gap: 14px">'
  + '<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">取引先</h1><span style="font-size: 12px; color: %s">取引先ごとにチケット・依頼・検収・決まりが集まる</span><span style="margin-left: auto">%s</span></div>' % (MUTED, btn("＋ 取引先", "p"))
  + '<div style="display: flex; gap: 6px; align-items: center">' + chip("すべて 6", True) + chip("自分が担当 3") + chip("営業 4") + chip("受託開発 2") + chip("経理 2") + chip("依頼あり 2") + '<input placeholder="取引先・先方の人で探す" style="margin-left: auto; height: 30px; width: 220px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; font-family: inherit; font-size: 12px"></div>'
  + table(["取引先", "担当グループ", "担当", "動いているチケット", "届いた依頼", "検収待ち", "最後のやり取り"], [
      [cl("セ", "#186F69", "セイコー株式会社", "保守 ・ 請求 ・ 先方 3 人"), grp("営業", "経理"), '<span style="display: inline-flex; gap: 6px; align-items: center">' + av("高", "#6B5B99", 20) + '高本</span>', num(4), num(1, True), num(1, True), "今日 10:20"],
      [cl("京", "#6D4AA6", "京蟻システム株式会社", "受託開発 ・ 先方 4 人"), grp("営業", "受託開発"), '<span style="display: inline-flex; gap: 6px; align-items: center">' + av("佐", "#186F69", 20) + '佐藤</span>', num(7), num(2, True), num(0), "昨日"],
      [cl("ミ", "#B45309", "合同会社ミナト", "請求 ・ 先方 1 人"), grp("経理"), '<span style="display: inline-flex; gap: 6px; align-items: center">' + av("高", "#6B5B99", 20) + '高本</span>', num(1), num(0), num(1, True), "10/30"],
      [cl("ソ", "#2F4B7C", "株式会社ソラ", "提案中 ・ 先方をまだ招いていない") + ' ' + priv("担当グループだけ"), grp("営業"), '<span style="display: inline-flex; gap: 6px; align-items: center">' + av("鈴", "#2F4B7C", 20) + '鈴木</span>', num(2), num(0), num(0), "10/28"]])
  + '<div style="font-size: 12px; color: %s">取引先は 1 社に 1 つ。担当グループをいくつでも付けられ、先方の人と決まりは共通。社内で見える人はワークスペースごとに決める（いまは全員。「担当グループだけ」にした取引先には鍵のしるし）</div>' % MUTED
  + '</section></div>')
shell("CuList.dc.html", "取引先", [("取引先", None)], body)
# ---------- 取引先のページ ----------
tabs = lambda cur: '<nav style="display: flex; gap: 2px; padding: 0 28px; background: #FFFFFF; border-bottom: 1px solid #DDE2E9">' + "".join('<a href="%s" style="padding: 10px 12px; border-bottom: 2px solid %s; color: %s; text-decoration: none; %s">%s</a>' % (h, NAVY if k == cur else "transparent", NAVY if k == cur else MUTED, "font-weight: 500" if k == cur else "", t) for k, t, h in [("now", "いま", "CuPage.dc.html"), ("tk", "チケット 4", "#"), ("rq", "依頼 1", "CuRequests.dc.html"), ("rule", "決まり 3", "#"), ("share", "人と見せ方", "CuShare.dc.html")]) + '</nav>'
head = ('<header style="background: #FFFFFF; padding: 14px 28px 6px; display: flex; align-items: center; gap: 12px">' + icon("セ", "#186F69", 38) + '<div><h1 style="font-size: 19px; margin: 0">セイコー株式会社</h1><div style="font-size: 12px; color: ' + MUTED + '; display: flex; gap: 8px; align-items: center; flex-wrap: wrap">担当 高本 ・ 担当グループ ' + grp("営業", "経理") + ' ・ 保守契約 ・ 2024/04 から</div></div><span style="margin-left: auto; display: flex; gap: 6px">' + btn("クライアントの場所を見る", "", "CpHome.dc.html") + btn("＋ チケット", "p", "Create.dc.html") + '</span></header>')
def item(kind, kc, t, sub_, act=""):
    return '<div style="display: flex; gap: 12px; align-items: center; padding: 10px 14px; border-top: 1px solid #EDF0F4">%s<span style="flex: 1; min-width: 0"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span>%s</div>' % (pill(kind, *kc), t, MUTED, sub_, act)
tl = lambda when, who, t: '<div style="display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid #EDF0F4; font-size: 12px"><span style="width: 70px; color: %s">%s</span><span style="flex: 1">%s %s</span></div>' % (MUTED, when, who, t)
detail = ('<aside aria-label="取引先のこと" style="width: 320px; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">'
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 6px"><div style="display: flex; align-items: center; gap: 6px"><b style="font-weight: 500; flex: 1">社内で見える人</b><span style="border: 1px solid #DDE2E9; border-radius: 6px; padding: 1px 8px; background: #FFFFFF">ワークスペースの全員 ▾</span></div><span style="color: #4A5563">ワークスペースの既定どおり。この取引先だけ「担当グループだけ」にもできる</span><div style="display: flex; align-items: center; gap: 6px"><b style="font-weight: 500; flex: 1">担当グループ</b>' + grp("営業", "経理") + '<a href="#" style="font-size: 11px">＋</a></div><span style="color: #4A5563">チケットは今までどおり、そのグループの権限で見える</span></div>'
  + '<div><b style="font-size: 13px">先方の人</b><div style="margin-top: 6px; display: flex; flex-direction: column; gap: 8px">'
  + "".join('<div style="display: flex; gap: 8px; align-items: center; font-size: 13px">%s<span style="flex: 1"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span>%s</div>' % (av(c, bg), n, MUTED, r, x) for c, bg, n, r, x in [("山", "#7E570D", "山田 花子 様", "経理部 ・ 請求の宛先", seen("入っている")), ("鈴", "#2F4B7C", "鈴木 健太 様", "営業部 ・ CC", seen("入っている")), ("田", "#4A5563", "田村 様", "情報システム部", priv("招いていない"))])
  + '</div></div>'
  + '<div><b style="font-size: 13px">取引先の決まり</b><span style="font-size: 11px; color: %s"> ・ このチケットを扱うとき分身が守る</span><div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 12px">' % MUTED
  + "".join('<div style="display: flex; gap: 8px; align-items: center">%s<span>%s</span></div>' % (icon(m, "#186F69", 22), t) for m, t in [("宛", "宛名は経理部 山田様、CC に営業の鈴木様"), ("締", "締めは 20 日（会社の 25 日より先）"), ("書", "請求書のファイル名は 請求書_年月_社名.pdf")])
  + '<a href="RoomAddRule.dc.html" style="font-size: 12px">＋ 決まりを足す</a></div></div>'
  + '<div><b style="font-size: 13px">関わるナレッジ</b><div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 12px"><a href="KnPage.dc.html">請求のルール</a><a href="#">セイコー様 保守契約の範囲</a></div></div>'
  + '</aside>')
now = ('\n  <div style="display: flex; flex-direction: column; flex: 1 0 auto; min-height: 0">' + head + tabs("now")
  + '<div style="display: flex; flex: 1 0 auto; min-height: 0"><section style="flex: 1; min-width: 0; padding: 18px 28px; display: flex; flex-direction: column; gap: 14px">'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden"><div style="padding: 10px 14px; font-weight: 600">いまやること</div>'
  + item("依頼", ("#FFF4E0", "#7A4A05"), "追加で 12 月分の作業報告書もほしい", "鈴木 健太 様 ・ 今日 10:20 ・ 分身がチケットの案を作った", btn("さばく", "p", "CuRequests.dc.html"))
  + item("検収待ち", ("#F1ECF9", "#6D4AA6"), "EG-128 11月分の請求書", "山田 様に確認をお願いした ・ 11/02 ・ 返事の期限 11/04", btn("催促する"))
  + item("期限", ("#FDECEC", "#B91C1C"), "EG-126 保守更新の見積", "期限 11/05 ・ 確認中", btn("開く", "", "TicketDetail.dc.html"))
  + '</div>'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 10px 14px"><div style="font-weight: 600; padding-bottom: 6px">最近のやり取り</div>'
  + tl("今日 10:20", "<b style=\"font-weight: 500\">鈴木 健太 様</b>", "が依頼を出した：「12 月分の作業報告書」 " + seen())
  + tl("11/02", "<b style=\"font-weight: 500\">高本</b>", "が EG-128 の検収を頼んだ（成果物 1） " + seen())
  + tl("11/01", "<b style=\"font-weight: 500\">高本のAI</b>", "が EG-128 の請求書を作った（取引先の決まり 2 つを使った） " + priv())
  + tl("10/28", "<b style=\"font-weight: 500\">山田 花子 様</b>", "が「支払期日は月末締め翌月末で」と返事 " + seen())
  + '</div></section>' + detail + '</div></div>')
CP = shell("CuPage.dc.html", "取引先 セイコー株式会社", [("取引先", "CuList.dc.html"), ("セイコー株式会社", None)], now)
# ---------- 届いた依頼 ----------
rq = lambda cmark, cbg, client, t, who, when, st, on=False: '<a href="#" style="display: flex; gap: 10px; padding: 10px 12px; border-radius: 8px; text-decoration: none; color: #131B27; %s">%s<span style="flex: 1; min-width: 0"><span style="display: block; font-weight: inherit">%s</span><span style="font-size: 11px; color: %s">%s ・ %s ・ %s</span></span>%s</a>' % ("background: #FFFFFF; box-shadow: 0 1px 2px rgba(19,27,39,.08), 0 0 0 1px rgba(19,27,39,.06); font-weight: 600" if on else "", icon(cmark, cbg, 26), t, MUTED, client, who, when, pill(st))
lst = ('<aside aria-label="依頼の一覧" class="kn-sub" style="width: 320px">' + '<div class="kn-sub-h">届いた依頼 ・ 3</div>'
  + rq("セ", "#186F69", "セイコー", "12 月分の作業報告書もほしい", "鈴木 様", "今日", "新しい", True)
  + rq("京", "#6D4AA6", "京蟻", "管理画面に CSV の書き出し", "大橋 様", "昨日", "聞いている")
  + rq("京", "#6D4AA6", "京蟻", "ログイン画面の文言を直してほしい", "大橋 様", "10/31", "新しい")
  + '<div class="kn-sub-h">さばいたもの</div>' + rq("ミ", "#B45309", "ミナト", "10 月分の請求書の再発行", "小林 様", "10/30", "チケットにした") + '</aside>')
msg = lambda who, c, bg, when, t, side="l": '<div style="display: flex; gap: 10px; %s">%s<div style="max-width: 76%%"><div style="font-size: 11px; color: %s; %s">%s ・ %s</div><div style="background: %s; border-radius: 10px; padding: 8px 12px; margin-top: 2px; line-height: 1.7">%s</div></div></div>' % ("flex-direction: row-reverse" if side == "r" else "", av(c, bg, 28), MUTED, "text-align: right" if side == "r" else "", who, when, "#DCE4F2" if side == "r" else "#F2F4F7", t)
draft = ('<div style="border: 1px solid #C9D6EE; background: #F3F6FC; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
  + '<div style="display: flex; gap: 8px; align-items: center">' + icon("AI", NAVY, 22) + '<b style="font-weight: 600">高本のAI のチケットの案</b><span style="font-size: 11px; color: %s">依頼と保守契約の範囲から</span></div>' % MUTED
  + '<div style="display: grid; grid-template-columns: 80px 1fr; gap: 6px; font-size: 13px"><span style="color: %s">題名</span><span>セイコー様 12 月分の作業報告書を作って送る</span><span style="color: %s">種別</span><span>タスク ・ 業務の型「作業報告書」v2</span><span style="color: %s">担当</span><span>高本（分身が実行）</span><span style="color: %s">期限</span><span>12/26（12 月分の締めのあと）</span><span style="color: %s">費用</span><span>保守契約の範囲内（追加費用なし）</span></div>' % (MUTED, MUTED, MUTED, MUTED, MUTED)
  + '<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: 1px solid #C9D6EE; padding-top: 8px; font-size: 13px"><span style="color: #4A5563; width: 80px">届け先</span>' + grp("営業") + '<span style="font-size: 12px; color: #4A5563">分身の案：作業報告書は保守契約の仕事なので 営業（経理ではない）</span><span style="margin-left: auto; font-size: 12px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 1px 8px; background: #FFFFFF">変える ▾</span></div>'
  + '<div style="font-size: 12px; color: #7A4A05">分身が先方に聞きたいこと：報告書の形は 11 月分と同じでよいか ・ 宛先は山田様か鈴木様か</div></div>')
detail2 = ('<section style="flex: 1; min-width: 0; padding: 18px 28px; display: flex; flex-direction: column; gap: 12px">'
  + '<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">' + icon("セ", "#186F69", 28) + '<div><b style="font-size: 16px">12 月分の作業報告書もほしい</b><div style="font-size: 12px; color: %s">セイコー株式会社 ・ 鈴木 健太 様 ・ 今日 10:20 ・ 同じ取引先の人にも見えている</div></div></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px">'
  + msg("鈴木 健太 様", "鈴", "#2F4B7C", "今日 10:20", "いつもありがとうございます。11 月分と同じ形で、12 月分の作業報告書もいただけますか。年内に社内に回したいです。")
  + '</div>' + draft
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 10px 12px"><div style="font-size: 12px; color: %s; margin-bottom: 6px">先方に返す ' % MUTED + seen() + '</div><div style="font-size: 13px; line-height: 1.7; color: #131B27">鈴木様　承知しました。11 月分と同じ形で、12/26 までにお送りします。宛先は山田様でよろしいでしょうか。</div><div style="font-size: 11px; color: %s; margin-top: 6px">分身が下書きした返事。直せる</div></div>' % MUTED
  + '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center"><span style="flex: 1; font-size: 12px; color: %s">受けるとチケットになり、依頼とつながったまま残る。先方には「受けました」と期限が見える</span>%s%s%s</div>' % (MUTED, btn("断る（理由を返す）"), btn("返事を送って詳しく聞く"), btn("受けてチケットにする", "p", "TicketDetail.dc.html"))
  + '</section>')
rqpage = '\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + lst + detail2 + '</div>'
shell("CuRequests.dc.html", "取引先 届いた依頼", [("取引先", "CuList.dc.html"), ("届いた依頼", None)], rqpage)
# ---------- 人と見せ方 ----------
row = lambda c, bg, n, mail, role, st: '<div style="display: flex; gap: 12px; align-items: center; padding: 10px 14px; border-top: 1px solid #EDF0F4">%s<span style="flex: 1"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span><span style="font-size: 12px; border-radius: 6px; padding: 2px 8px; background: #F2F4F7">%s ▾</span><span style="width: 120px; text-align: right; font-size: 12px; color: %s">%s</span></div>' % (av(c, bg, 28), n, MUTED, mail, role, MUTED, st)
vis = lambda name, on, note="", fixed=False: '<div style="display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid #EDF0F4"><span style="flex: 1">%s%s</span>%s</div>' % (name, '<span style="display: block; font-size: 11px; color: %s">%s</span>' % (MUTED, note) if note else "", (priv("見せられない") if fixed else (seen("見せる") if on else priv())))
preview = ('<div style="border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden; background: #F7F8FA"><div style="font-size: 11px; color: %s; padding: 6px 10px; border-bottom: 1px solid #DDE2E9; background: #FFFFFF">先方からの見え方（見本）</div><div style="padding: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 12px">' % MUTED
  + '<div style="background: #FFFFFF; border-radius: 8px; padding: 8px 10px"><b style="font-weight: 600">11月分の請求書を送る</b><div style="display: flex; gap: 8px; margin-top: 4px; color: %s"><span>進み：確認中</span><span>期限 11/01</span></div><div style="margin-top: 6px; display: flex; gap: 6px; align-items: center">%s<span>請求書 No.2026-1101.pdf</span></div></div>' % (MUTED, icon("P", "#B91C1C", 20))
  + '<div style="color: %s">社内のメモ・テスト仕様・決定ログ・分身の記録は出ない</div></div></div>' % MUTED)
share = ('\n  <div style="display: flex; flex-direction: column; flex: 1 0 auto; min-height: 0">' + head + tabs("share")
  + '<div style="padding: 18px 28px; display: flex; gap: 18px; flex-wrap: wrap; align-items: flex-start">'
  + '<div style="flex: 1 1 520px; display: flex; flex-direction: column; gap: 14px">'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden"><div style="display: flex; align-items: center; padding: 10px 14px"><b style="font-weight: 600; flex: 1">先方の人</b>%s</div>' % btn("＋ 先方の人を招く", "p")
  + row("山", "#7E570D", "山田 花子 様", "yamada@seiko.example ・ 経理部", "依頼できる", "最後 11/02")
  + row("鈴", "#2F4B7C", "鈴木 健太 様", "suzuki@seiko.example ・ 営業部", "依頼できる", "最後 今日")
  + row("田", "#4A5563", "田村 様", "tamura@seiko.example ・ 情報システム部", "見るだけ", "招待中 ・ あと 6 日")
  + '<div style="padding: 8px 14px 12px; font-size: 11px; color: %s; border-top: 1px solid #EDF0F4">同じ取引先の人は互いの依頼が見える。「見るだけ」の人は依頼を出せない</div></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 10px 14px"><div style="display: flex; align-items: center; gap: 8px"><b style="font-weight: 600; flex: 1">チケットで先方に見せるもの</b><span style="font-size: 12px; color: %s">種別</span><span style="font-size: 12px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 2px 8px">タスク ▾</span></div><div style="font-size: 11px; color: %s; margin: 2px 0 6px">既定はすべて社内だけ。ここで決めたものが、この取引先のチケットに最初から付く（チケットごとに変えられる）</div>' % (MUTED, MUTED)
  + vis("題名と進み（状態）", True) + vis("期限", True) + vis("成果物", True, "検収を頼むと、その成果物だけ先に見える") + vis("先方あての書き込み", True, "やり取りで「先方にも見せる」を付けたものだけ") + vis("担当者の名前", False) + vis("本文", False, "見せるなら区画ごとに選ぶ") + vis("テスト仕様と確認の結果・決定ログ・分身の実行の記録", False, "", True)
  + '</div></div>'
  + '<div style="flex: 0 1 320px; min-width: 260px">' + preview + '</div></div></div>')
shell("CuShare.dc.html", "取引先 人と見せ方", [("取引先", "CuList.dc.html"), ("セイコー株式会社", "CuPage.dc.html"), ("人と見せ方", None)], share)
# ---------- 検収を頼む（チケットの詳細から） ----------
TD_ = open(P + "TicketDetail.dc.html", encoding="utf-8").read()
s = modal(TD_, mhead("先方に確かめてもらう（検収）", "TicketDetail.dc.html", "", "EG-128 セイコー様へ 11月分の請求書を送る")
  + mbody('<div>' + lab("確かめてもらう成果物") + '<div style="display: flex; gap: 10px; align-items: center; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px">' + icon("P", "#B91C1C", 26) + '<span style="flex: 1">請求書 No.2026-1101.pdf<span style="display: block; font-size: 11px; color: %s">成果物の版 1 ・ 1,716,000 円</span></span>%s</div></div>' % (MUTED, seen())
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("確かめる人") + field(av("山", "#7E570D", 20) + "&nbsp;山田 花子 様 ▾") + '</div><div>' + lab("返事の期限") + field("11/04（火） ▾") + '</div></div>'
  + '<div>' + lab("ひとこと", "（先方に届く）") + field("11 月分の請求書です。内容をご確認ください。問題なければ OK を押してください", True) + '</div>'
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><span>・ 先方の OK が、このチケットの完了の条件になる</span><span>・ 「直してほしい」が来たら、やり取りに入り、担当（あなた）に知らせる</span><span>・ 期限までに返事がなければ、前日に先方へひとこと催促する</span></div>')
  + mfoot(btn("やめる", "", "TicketDetail.dc.html"), btn("確かめてもらう", "p", "CpReview.dc.html")), 580, "検収を頼む")
save("CuReview.dc.html", "検収を頼む", s)

# ---------- クライアントの場所（先方の画面） ----------
base = MAIN
i0 = base.index("<div data-shell"); i1 = base.index("</x-dc>")
def portal(name, title, inner):
    page = ('<div data-shell style="min-height: 100vh; background: #F2F4F7; display: flex; flex-direction: column">'
      + '<header style="background: #FFFFFF; border-bottom: 1px solid #DDE2E9; height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 24px">' + icon("E", NAVY, 28) + '<div><b>ENGINE BASE</b><div style="font-size: 11px; color: %s">セイコー株式会社 の場所</div></div>' % MUTED
      + '<span style="margin-left: auto; display: flex; gap: 10px; align-items: center; font-size: 12px; color: %s">山田 花子 様（経理部）%s</span></header>' % (MUTED, av("山", "#7E570D", 28))
      + '<main style="flex: 1; width: 100%; max-width: 960px; margin: 0 auto; padding: 24px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px">' + inner + '</main>'
      + '<footer style="text-align: center; font-size: 11px; color: %s; padding: 14px">この場所で見えるのは、ENGINE BASE が見せると決めたものだけです</footer></div>\n' % MUTED)
    s = base[:i0] + page + base[i1:]
    save(name, title, s); return s
pc = lambda t, sub_, st, bar=None: '<div style="display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid #EDF0F4"><span style="flex: 1; min-width: 0"><span style="display: block; font-weight: 500">%s</span><span style="font-size: 12px; color: %s">%s</span>%s</span>%s</div>' % (t, MUTED, sub_, ('<span style="display: block; height: 4px; border-radius: 99px; background: #EEF0F4; margin-top: 6px; max-width: 240px"><span style="display: block; height: 100%%; width: %d%%; background: #22345C; border-radius: 99px"></span></span>' % bar) if bar is not None else "", pill(st))
home = ('<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">ENGINE BASE とのやり取り</h1><span style="margin-left: auto">%s</span></div>' % btn("＋ 依頼を出す", "p", "CpNew.dc.html")
  + '<div style="background: #FFFFFF; border: 1px solid #E2D6F3; border-radius: 12px; overflow: hidden"><div style="padding: 12px 16px; background: #F7F3FC; display: flex; gap: 8px; align-items: center"><b>確認してほしいもの</b>' + pill("1", "#6D4AA6", "#FFFFFF") + '</div>'
  + '<div style="display: flex; gap: 12px; align-items: center; padding: 14px 16px">' + icon("P", "#B91C1C", 32) + '<span style="flex: 1"><b style="font-weight: 600; display: block">11月分の請求書</b><span style="font-size: 12px; color: %s">高本さんから ・ 11/02 ・ 返事の期限 11/04</span></span>%s</div></div>' % (MUTED, btn("中身を見て返事する", "p", "CpReview.dc.html"))
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; overflow: hidden"><div style="padding: 12px 16px"><b>依頼</b><span style="font-size: 12px; color: %s"> ・ セイコー株式会社の皆さんの依頼</span></div>' % MUTED
  + pc("12 月分の作業報告書もほしい", "鈴木 健太 様 ・ 今日 10:20 ・ ENGINE BASE から返事：「12/26 までにお送りします。宛先は山田様で…」", "返事あり")
  + pc("10 月分の請求書の宛名を変えたい", "山田 花子 様 ・ 10/12", "済み") + '</div>'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; overflow: hidden"><div style="padding: 12px 16px"><b>進んでいる仕事</b></div>'
  + pc("11月分の請求書を送る", "期限 11/01 ・ 確認してほしいものあり", "確認中", 80)
  + pc("保守更新の見積", "期限 11/05", "作っている", 50)
  + pc("12 月分の作業報告書", "期限 12/26 ・ 今日受けた", "これから", 5) + '</div>')
portal("CpHome.dc.html", "クライアントの場所", home)
rev = ('<a href="CpHome.dc.html" style="font-size: 12px">← 戻る</a><h1 style="font-size: 20px; margin: 0">11月分の請求書</h1><div style="font-size: 12px; color: %s">高本さんから ・ 「11 月分の請求書です。内容をご確認ください。問題なければ OK を押してください」</div>' % MUTED
  + '<div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start"><div style="flex: 1 1 420px; background: #EEF0F4; border-radius: 12px; padding: 20px; display: grid; place-items: center">'
  + '<div style="background: #FFFFFF; width: 100%; max-width: 400px; aspect-ratio: 1 / 1.414; box-shadow: 0 2px 12px rgba(0,0,0,.12); padding: 26px; box-sizing: border-box; font-size: 11px; display: flex; flex-direction: column; gap: 8px"><b style="font-size: 18px">請求書</b><span>セイコー株式会社 経理部 山田 様</span><div style="border-top: 2px solid #131B27; padding-top: 8px; font-size: 14px">ご請求金額 <b>¥1,716,000</b>（税込）</div><div style="display: grid; grid-template-columns: 1fr 40px 80px; gap: 4px; border-top: 1px solid #DDE2E9; padding-top: 6px"><span>システム保守（11月分）</span><span>1 式</span><span style="text-align: right">1,500,000</span><span>追加対応</span><span>2 回</span><span style="text-align: right">60,000</span></div><div style="margin-top: auto; color: #4A5563">お支払期日 2026/12/31</div></div></div>'
  + '<div style="flex: 0 1 320px; min-width: 260px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px"><b>返事</b>'
  + '<label style="display: flex; gap: 10px; align-items: flex-start; border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px 12px"><span style="width: 16px; height: 16px; margin-top: 2px; border-radius: 99px; border: 1px solid #B8C0CC; flex: none"></span><span><b style="font-weight: 500">OK（このままで大丈夫）</b><span style="display: block; font-size: 11px; color: %s">ENGINE BASE の仕事が完了になる</span></span></label>' % MUTED
  + '<label style="display: flex; gap: 10px; align-items: flex-start; border: 1px solid #22345C; background: #F1F3F6; border-radius: 8px; padding: 10px 12px"><span style="width: 16px; height: 16px; margin-top: 2px; border-radius: 99px; border: 5px solid #22345C; box-sizing: border-box; flex: none"></span><span><b style="font-weight: 500">直してほしい</b><span style="display: block; font-size: 11px; color: %s">どこをどう直すか書く</span></span></label>' % MUTED
  + '<textarea style="width: 100%; box-sizing: border-box; min-height: 90px; border: 1px solid #DDE2E9; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px">10/19 の追加対応はお約束どおり無償のはずなので、外していただけますか。</textarea>'
  + btn("返事を送る", "p", "CpHome.dc.html") + '</div></div>')
portal("CpReview.dc.html", "検収（先方）", rev)
new = ('<a href="CpHome.dc.html" style="font-size: 12px">← 戻る</a><h1 style="font-size: 20px; margin: 0">依頼を出す</h1><div style="font-size: 12px; color: %s">ENGINE BASE の担当（高本さん）に届きます。セイコー株式会社の皆さんにも見えます</div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 14px; max-width: 680px">'
  + '<div>' + lab("何をしてほしいか") + '<textarea style="width: 100%; box-sizing: border-box; min-height: 90px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 14px">来年 1 月から請求書の宛先を経理部の佐野に変えたいです</textarea></div>'
  + '<div style="display: flex; gap: 10px; align-items: flex-start; background: #F3F6FC; border: 1px solid #C9D6EE; border-radius: 8px; padding: 10px 12px; font-size: 13px">' + icon("AI", NAVY, 22) + '<span style="flex: 1; line-height: 1.7">伝わりやすくするために、ひとつ教えてください：<b style="font-weight: 600">佐野様のメールアドレス</b>と、<b style="font-weight: 600">CC は今と同じ鈴木様のままでよいか</b>。<span style="display: block; font-size: 11px; color: %s">ENGINE BASE の担当の AI が聞いています</span></span></div>' % MUTED
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("いつまでに", "（任意）") + field("12/20 ▾") + '</div><div>' + lab("添付", "（任意）") + field("＋ ファイルを足す", True) + '</div></div>'
  + '<div style="display: flex; justify-content: flex-end">' + btn("依頼を出す", "p", "CpHome.dc.html") + '</div></div>')
portal("CpNew.dc.html", "依頼を出す（先方）", new)

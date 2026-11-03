import os; os.environ["NOGEN"]="1"
import re
from boards import btn, pill, icon, chip, MUTED, NAVY, LINE
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
BASE = open(os.path.dirname(os.path.abspath(__file__)) + "/TicketDetail.base.html", encoding="utf-8").read()
WATCH = '<button type="button" style="height: 30px; border-radius: 6px; border: 1px solid #DDE2E9; background: #FFFFFF; padding: 0 10px; font-size: 12px; color: #131B27">ウォッチ 3</button>'
MORE = '<button type="button" aria-label="ほかの操作" style="height: 30px; width: 32px; border-radius: 6px; border: 1px solid #DDE2E9; background: #FFFFFF; color: #131B27">…</button>'
ASIDE = '<aside aria-label="チケットのパネル" style="'
assert WATCH in BASE and MORE in BASE and ASIDE in BASE
def title(t, s):
    return s.replace(re.search(r"<title>.*?</title>", s).group(0), "<title>%s</title>" % t, 1)
from wire import wire
def save(name, t, s):
    s = wire(s)
    open(P + name, "w", encoding="utf-8").write(title(t, s)); print(name, len(s))
POP = "position: absolute; z-index: 20; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; box-shadow: 0 10px 30px rgba(19,27,39,.18); padding: 8px; box-sizing: border-box; text-align: left; font-size: 13px; color: #131B27; white-space: normal"
def anchor_pop(s, anchor, html, w=280, align="right: 0"):
    pressed = anchor.replace('style="', 'aria-expanded="true" style="box-shadow: 0 0 0 2px #DCE4F2; ', 1)
    return s.replace(anchor, '<span style="position: relative; display: inline-flex">%s<div role="dialog" style="%s; top: 36px; %s; width: %dpx">%s</div></span>' % (pressed, POP, align, w, html), 1)
def aside_pop(s, top, html):
    s = s.replace(ASIDE, ASIDE + "position: relative; ", 1)
    i = s.index(">", s.index(ASIDE)) + 1
    return s[:i] + '<div role="dialog" style="%s; top: %dpx; left: 0; right: 0">%s</div>' % (POP, top, html) + s[i:]
def modal(s, html, w=600, tt=""):
    m = ('<div role="dialog" aria-label="%s" style="position: fixed; inset: 0; background: rgba(19,27,39,.45); display: grid; place-items: center; padding: 16px; z-index: 30">'
         '<div style="width: 100%%; max-width: %dpx; max-height: calc(100vh - 32px); overflow: auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); display: flex; flex-direction: column">%s</div></div>\n' % (tt, w, html))
    return s.replace("</x-dc>", m + "</x-dc>", 1)
def drawer(s, html, w=520, tt=""):
    m = ('<div role="dialog" aria-label="%s" style="position: fixed; inset: 0; background: rgba(19,27,39,.30); z-index: 30; display: flex; justify-content: flex-end">'
         '<div style="width: %dpx; max-width: 100%%; height: 100%%; background: #FFFFFF; box-shadow: -12px 0 40px rgba(0,0,0,.2); display: flex; flex-direction: column">%s</div></div>\n' % (tt, w, html))
    return s.replace("</x-dc>", m + "</x-dc>", 1)
def mhead(t, ic="", sub=""):
    return ('<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4">%s<div style="min-width: 0"><b style="font-size: 15px">%s</b>%s</div><a href="TicketDetail.dc.html" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>'
            % (ic, t, '<div style="font-size: 12px; color: %s">%s</div>' % (MUTED, sub) if sub else ""))
def mbody(h): return '<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">%s</div>' % h
def mfoot(*b, left=""): return '<div style="display: flex; gap: 8px; align-items: center; padding: 12px 18px; border-top: 1px solid #EDF0F4; flex-wrap: wrap">%s<span style="margin-left: auto; display: flex; gap: 8px">%s</span></div>' % (left, "".join(b))
def lab(t, note=""): return '<div style="font-size: 12px; font-weight: 500; margin-bottom: 6px">%s%s</div>' % (t, ' <span style="font-weight: 400; color: %s">%s</span>' % (MUTED, note) if note else "")
def field(v, ph=False): return '<div style="height: 34px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; display: flex; align-items: center; color: %s">%s</div>' % (MUTED if ph else "#131B27", v)
def check(t, on=True, note=""):
    return '<label style="display: flex; gap: 8px; align-items: flex-start; padding: 4px 0"><span style="width: 16px; height: 16px; margin-top: 2px; flex: none; border-radius: 4px; border: 1px solid %s; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span><span>%s%s</span></label>' % (NAVY if on else "#B8C0CC", NAVY if on else "#FFFFFF", "✓" if on else "", t, '<span style="display: block; font-size: 11px; color: %s">%s</span>' % (MUTED, note) if note else "")
def mi(t, key="", danger=False, sub=""):
    return '<a href="%s" style="display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; text-decoration: none; color: %s"><span style="flex: 1">%s%s</span><span style="font-size: 11px; color: %s">%s</span></a>' % ("#", "#B91C1C" if danger else "#131B27", t, '<span style="display: block; font-size: 11px; color: %s">%s</span>' % (MUTED, sub) if sub else "", MUTED, key)
SEP = '<div style="border-top: 1px solid #EDF0F4; margin: 4px 0"></div>'
AV = lambda c, bg: '<span style="width: 24px; height: 24px; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span>' % (bg, c)

open(P + 'TicketDetail.dc.html', 'w', encoding='utf-8').write(wire(BASE))
# 1 … menu
more = (mi("複製する", "⌘D").replace('href="#"', 'href="TdDuplicate.dc.html"') + mi("ほかのグループへ移す") + mi("種別を変える", "", sub="タスク → 依頼 など") + mi("ひな形にする", "", sub="この本文の形を次から使う")
        + SEP + mi("リンクをコピー", "⌘L") + mi("PDF にする・印刷") + mi("版と差分を見る").replace('href="#"', 'href="TdVersions.dc.html"') + mi("実行の記録を見る").replace('href="#"', 'href="TdRunLog.dc.html"')
        + SEP + mi("消す", "", True).replace('href="#"', 'href="TdDelete.dc.html"'))
save("TdMore.dc.html", "ほかの操作", anchor_pop(BASE, MORE, more, 260))

# 2 delete confirm
s = modal(BASE, mhead("このチケットを消しますか", icon("!", "#B91C1C", 30), "EG-128 セイコー様へ 11月分の請求書を送る")
  + mbody('<div style="border: 1px solid #F3C7C7; background: #FDF3F3; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><b style="color: #B91C1C; font-weight: 500">一緒に起きること</b><span>・ 承認待ちから取り下げられる（高本 宛 1 件）</span><span>・ 子チケット 0 件、つながり 2 件（EG-097・KR-031）は外れるだけで残る</span><span>・ 添付 1 件・成果物 1 件も消える</span></div>'
  + '<div style="font-size: 12px; color: %s">消したチケットは 30 日間「ワークスペース › 消したもの」から戻せる。証跡（いつ誰が消したか）は残る</div>' % MUTED
  + '<div>' + lab("理由", "（任意・証跡に残る）") + field("重複して作ってしまった", False) + '</div>')
  + mfoot(btn("やめる", "", "TicketDetail.dc.html"), '<a href="Main.dc.html" style="height: 30px; border-radius: 6px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; text-decoration: none; background: #B91C1C; color: #FFFFFF">消す</a>'), 520, "消す")
save("TdDelete.dc.html", "チケットを消す", s)

# 3 duplicate
s = modal(BASE, mhead("複製する", "", "EG-128 から新しいチケットを作る")
  + mbody('<div>' + lab("題名") + field("セイコー様へ 12月分の請求書を送る") + '<div style="font-size: 11px; color: %s; margin-top: 4px">分身が「11月 → 12月」に読み替えた案。直せる</div></div>' % MUTED
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("グループ") + field("営業（EG） ▾") + '</div><div>' + lab("期限") + field("12/01（月） ▾") + '</div></div>'
  + '<div>' + lab("写すもの") + check("本文", True, "日付・金額は分身が新しい月に合わせて書き直す") + check("担当者・承認する人", True) + check("テスト仕様", True) + check("参照するもの", True) + check("子チケット（0 件）", False) + check("添付（保守契約書.pdf）", False) + check("やり取りと記録", False, "写さない。元のチケットへのつながりだけ残す") + '</div>'
  + '<div style="display: flex; gap: 8px; align-items: center; background: #F7F8FA; border-radius: 8px; padding: 8px 10px; font-size: 12px">' + icon("型", NAVY, 24) + '<span>毎月くり返すなら <a href="#">くり返しにする</a> と、月初に分身が自動で複製する</span></div>')
  + mfoot(btn("やめる", "", "TicketDetail.dc.html"), btn("複製して開く", "p", "TicketDetail.dc.html")), 600, "複製する")
save("TdDuplicate.dc.html", "複製する", s)

# 4 watch
row = lambda c, bg, n, sub, x="": '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 4px">%s<span style="flex: 1"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span>%s</div>' % (AV(c, bg), n, MUTED, sub, x)
xb = '<button type="button" aria-label="外す" style="border: 0; background: transparent; color: #4A5563">×</button>'
watch = ('<div style="padding: 4px 4px 8px; display: flex; align-items: center; gap: 8px"><b style="flex: 1">ウォッチしている人 3</b><span style="font-size: 12px; color: #166534">自分も入っている</span></div>'
  + row("高", "#6B5B99", "高本 聖斗（自分）", "担当者なので外せない") + row("鈴", "#2F4B7C", "鈴木 一郎", "営業 ・ 書き込みで入った", xb) + row("佐", "#186F69", "佐藤 花子", "マネージャー ・ 自分で入った", xb)
  + '<div style="border: 1px solid #DDE2E9; border-radius: 6px; height: 32px; display: flex; align-items: center; padding: 0 10px; color: #4A5563; margin: 4px 0 8px">＋ 人を足す（名前で探す）</div>'
  + SEP + '<div style="padding: 6px 4px 2px; font-size: 12px; font-weight: 500">自分に知らせること</div>'
  + '<div style="padding: 0 4px">' + check("書き込み・@で呼ばれたとき", True) + check("状態が変わったとき", True) + check("分身が実行したとき", False, "やったことは部屋で見られる") + '</div>'
  + SEP + '<button type="button" style="width: 100%; height: 30px; border: 0; background: transparent; color: #B91C1C; font-size: 12px; text-align: left; padding: 0 8px">ウォッチをやめる</button>')
save("TdWatch.dc.html", "ウォッチ", anchor_pop(BASE, WATCH, watch, 300))

# 5 assignee picker
opt = lambda c, bg, n, sub, on=False: '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; background: %s">%s<span style="flex: 1"><span style="display: block">%s</span><span style="font-size: 11px; color: %s">%s</span></span>%s</div>' % ("#F1F3F6" if on else "transparent", AV(c, bg), n, MUTED, sub, '<b style="color: #22345C">✓</b>' if on else "")
asg = ('<input placeholder="名前で探す" style="width: 100%; box-sizing: border-box; height: 32px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 6px; padding: 0 10px; font-family: inherit; font-size: 12px; margin-bottom: 6px">'
  + '<div style="font-size: 11px; color: %s; padding: 4px 8px">担当者</div>' % MUTED
  + opt("高", "#6B5B99", "高本 聖斗（自分）", "営業 ・ 今週 7 件", True) + opt("鈴", "#2F4B7C", "鈴木 一郎", "営業 ・ 今週 4 件") + opt("佐", "#186F69", "佐藤 花子", "営業 マネージャー ・ 今週 9 件")
  + SEP + '<div style="font-size: 11px; color: %s; padding: 4px 8px">実行を分身に任せる</div>' % MUTED
  + '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; background: #F1F3F6">' + icon("AI", NAVY, 24) + '<span style="flex: 1"><span style="display: block">担当者の分身が実行する</span><span style="font-size: 11px; color: %s">高本のAI ・ 業務の型「請求書を作る v3」</span></span><span style="width: 30px; height: 16px; border-radius: 99px; background: #186F69; position: relative"><span style="position: absolute; right: 2px; top: 2px; width: 12px; height: 12px; border-radius: 99px; background: #FFFFFF"></span></span></div>' % MUTED
  + '<div style="font-size: 11px; color: %s; padding: 6px 8px 2px">担当者を変えると、その人の分身が引き継ぐ。前の話は要約して渡す</div>' % MUTED)
save("TdAssignee.dc.html", "担当者を変える", aside_pop(BASE, 70, asg))

# 6 due date picker
days = ""
cal = [["", "", "", "", "", "", "1"]] + [[str(d) for d in range(w, w + 7)] for w in (2, 9, 16, 23)] + [["30", "", "", "", "", "", ""]]
for wk in cal:
    for d in wk:
        st = "color: #131B27"
        if d == "1": st = "background: #FDECEC; color: #B91C1C; font-weight: 700"
        if d == "2": st = "background: #22345C; color: #FFFFFF; font-weight: 700"
        if d == "5": st = "color: #131B27; box-shadow: inset 0 0 0 1px #B45309"
        days += '<span style="height: 30px; display: grid; place-items: center; border-radius: 6px; font-size: 12px; %s">%s</span>' % (st, d)
due = ('<div style="display: flex; gap: 6px; flex-wrap: wrap; padding: 2px 2px 8px">' + chip("今日") + chip("明日") + chip("今週の金曜") + chip("来週の月曜") + '</div>'
  + '<div style="display: flex; align-items: center; padding: 0 4px 6px"><b style="flex: 1">2026年 11月</b><span style="color: #4A5563">‹　›</span></div>'
  + '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px; color: %s">%s</div>' % (MUTED, "".join("<span>%s</span>" % w for w in "日月火水木金土"))
  + '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px">' + days + '</div>'
  + '<div style="display: flex; gap: 6px; align-items: center; padding: 8px 4px 4px; font-size: 12px"><span style="color: %s">時刻</span><span style="border: 1px solid #DDE2E9; border-radius: 6px; padding: 2px 8px">18:00</span><span style="margin-left: auto; color: #B45309">□ 先方の締め 11/05</span></div>' % MUTED
  + '<div style="background: #FFF8EE; border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #7A4A05; margin-top: 4px">期限を延ばすと、承認する人（高本）とウォッチしている 2 人に知らせが出る</div>'
  + '<div style="display: flex; gap: 6px; justify-content: flex-end; padding-top: 8px">' + btn("期限をなくす") + btn("11/02 にする", "p") + '</div>')
save("TdDue.dc.html", "期限を変える", aside_pop(BASE, 250, due))

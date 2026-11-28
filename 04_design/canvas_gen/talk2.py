import os; os.environ["NOGEN"] = "1"
import re
from talk import tabs, PANEL, P, ROBOT
from boards import pill, chip, btn, icon, MUTED, NAVY
AVC = {"高": "#6B5B99", "鈴": "#2F4B7C", "佐": "#186F69", "山": "#7E570D"}
def av(c, n=28): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: %dpx; display: grid; place-items: center">%s</span>' % (n, n, AVC.get(c, "#4A5563"), 11 if n > 22 else 10, c)
def chg(t): return '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #4A5563; background: #F2F4F7; border-radius: 4px; padding: 1px 7px">%s</span>' % t
def post(c, who, when, text, changes=(), notify="", star=0, me=False, decided=False, new=False):
    acts = ('<span style="display: flex; gap: 10px; font-size: 11px; color: #4A5563; margin-top: 6px"><a href="#" style="color: #4A5563; text-decoration: none">☆ %s</a><a href="#" style="color: #4A5563; text-decoration: none">引用</a>%s</span>'
            % (star or "", '<span style="color: #166534">✓ 決定にした</span>' if decided else '<a href="TdDecision.dc.html" style="color: #4A5563; text-decoration: none">決定にする</a>'))
    return ('<div style="display: flex; gap: 10px; padding: 12px 0; %s">%s<div style="flex: 1; min-width: 0">'
            '<div style="display: flex; gap: 8px; align-items: baseline; font-size: 12px"><b style="font-weight: 500">%s</b><span style="color: %s">%s</span>%s</div>'
            '%s%s%s%s</div></div>'
            % ("background: #FFFBF3; margin: 0 -16px; padding: 12px 16px; box-shadow: inset 3px 0 0 #B45309;" if new else "", av(c), who, MUTED, when, pill("新しい", "#B45309", "#FFFFFF") if new else "",
               '<div style="margin-top: 2px; line-height: 1.7">%s</div>' % text if text else "",
               '<div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px">%s</div>' % "".join(chg(x) for x in changes) if changes else "",
               '<div style="font-size: 11px; color: %s; margin-top: 4px">知らせた：%s</div>' % (MUTED, notify) if notify else "", acts))
def small(c, text, when):  # change-only line
    return '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 0 6px 4px; font-size: 12px; color: %s">%s<span style="flex: 1; min-width: 0">%s</span><span style="font-size: 11px">%s</span></div>' % (MUTED, av(c, 20), text, when)
def airun(text, when, res, rc):
    return ('<a href="TdRunLog.dc.html" style="display: flex; gap: 8px; align-items: center; margin: 4px 0; padding: 8px 10px; border: 1px solid #DDE2E9; border-radius: 8px; text-decoration: none; color: #131B27; font-size: 12px">%s<span style="flex: 1; min-width: 0"><b style="font-weight: 500">高本のAI</b> %s<span style="display: block; font-size: 11px; color: %s">%s ・ 実行の記録を見る →</span></span>%s</a>'
            % (icon("AI", NAVY, 22), text, MUTED, when, pill(res, *rc)))
day = lambda t: '<div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: %s; padding: 10px 0 2px"><span style="flex: 1; border-top: 1px solid #EDF0F4"></span>%s<span style="flex: 1; border-top: 1px solid #EDF0F4"></span></div>' % (MUTED, t)
thread = (day("10/28（火）")
  + post("高", "高本 聖斗", "14:02", "山田様（セイコー）から、支払期日は<b>月末締め翌月末</b>でよいと返事がありました。", notify="鈴木", star=1, decided=True)
  + day("10/30（木）")
  + small("高", "<b style=\"font-weight: 500; color: #131B27\">高本</b> がチケットを作った ・ ひな形「請求書を作る v3」", "17:44")
  + day("11/01（土）")
  + airun("が請求書を作り、確認を流した", "09:00 → 09:12 ・ 12 分", "通った", ("#E8F5EC", "#166534"))
  + small("高", "確認 ①② が通り、状態が <b style=\"font-weight: 500; color: #131B27\">確認中 → 承認待ち</b> になった", "09:12")
  + post("鈴", "鈴木 一郎", "10:20", "10/19 の追加対応は先方の都合で無償にした件、反映が要るかもしれません。<span style=\"color: #22345C; background: #EEF3FD; border-radius: 4px; padding: 0 4px\">@高本</span> さん確認お願いします", changes=["未決事項に足した"], notify="高本・佐藤")
  + post("佐", "佐藤 花子", "10:41", "無償で合意済みなら外してOKです。先方の締めが 11/05 なので今日中に出せると助かります", changes=["期限：11/01 → 11/02", "優先度：中 → 高"], notify="高本・鈴木", new=True))
composer = ('<div style="flex: none; background: #FFFFFF; border-top: 1px solid #DDE2E9; padding: 10px 16px 12px">'
  '<div style="border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px">'
  '<textarea style="width: 100%; box-sizing: border-box; border: 0; border-radius: 8px 8px 0 0; padding: 8px 10px; font: inherit; min-height: 64px; resize: none">佐藤さん了解です。10/19 分を外して今日中に送ります</textarea>'
  '<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 6px 8px; border-top: 1px solid #EDF0F4; background: #FAFBFC; border-radius: 0 0 8px 8px; font-size: 12px">'
  '<span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 1px 8px; background: #FFFFFF">状態 <b style="font-weight: 500">変えない ▾</b></span>'
  '<span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 1px 8px; background: #FFFFFF">担当 <b style="font-weight: 500">変えない ▾</b></span>'
  '<span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 1px 8px; background: #FFFFFF">📎</span></div></div>'
  + ('<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 8px; font-size: 12px"><span style="color: %s">知らせる人</span>' % MUTED)
  + ''.join('<span style="display: inline-flex; align-items: center; gap: 4px; border-radius: 99px; background: #EEF3FD; padding: 1px 8px 1px 2px">%s%s ×</span>' % (av(c, 18), n) for c, n in [("佐", "佐藤"), ("鈴", "鈴木")])
  + '<span style="color: #22345C">＋</span>' + '<span style="margin-left: auto">' + btn("書き込む", "p") + '</span></div>'
  + ('<div style="font-size: 11px; color: %s; margin-top: 6px">状態や担当を変えると、この書き込みと一緒に残る ・ @ で呼ぶ ・ # でチケット</div></div>' % MUTED))
head = ('<div style="display: flex; gap: 6px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #EDF0F4; flex-wrap: wrap">' + chip("すべて", True) + chip("話だけ") + chip("自分あて 1")
        + '<span style="margin-left: auto; font-size: 11px; color: %s">古い順 ▾</span></div>' % MUTED)
body = head + '<div class="kn-thread"><div style="padding: 0 16px 8px; display: flex; flex-direction: column">' + thread + '</div></div>' + composer

s = open(P + "TicketDetail.dc.html", encoding="utf-8").read()
s = s.replace(tabs("attr"), tabs("talk"), 1)
a = s.index('<div class="kn-pbody"'); b = s.index("</aside>", a)
b = s.rindex("    </div>", a, b) + len("    </div>")
s = s[:a] + '<div class="kn-pbody" style="display: flex; flex-direction: column; overflow: hidden">' + body + '</div>' + s[b:]
s = s.replace(re.search(r"<title>.*?</title>", s).group(0), "<title>チケットのやり取り</title>", 1)
open(P + "TdTalk.dc.html", "w", encoding="utf-8").write(s); print("TdTalk", len(s))

# StAiPanel: replace own header with the shared tabs
s = open(P + "StAiPanel.dc.html", encoding="utf-8").read()
if "パネルのタブ" not in s:
    a = s.index('    <div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #DDE2E9">')
    b = s.index("    </div>\n", a) + len("    </div>\n")
    s = s[:a] + "    " + tabs("ai") + '\n    <div style="font-size: 11px; color: %s; padding: 6px 14px; border-bottom: 1px solid #EDF0F4">EG-128 のセッション ・ 前の話は要約して引き継ぎ済み ・ やり取りの書き込みも読んでいる</div>\n' % MUTED + s[b:]
    s = s.replace('<aside class="kn-side" aria-label="自分の AI" style="width: 460px;', '<aside class="kn-side" aria-label="自分の AI" style="width: 420px; border-left: 1px solid #DDE2E9;', 1)
open(P + "StAiPanel.dc.html", "w", encoding="utf-8").write(s); print("StAiPanel ok")

from room import page
MUTED="#4A5563"; LINE="#DDE2E9"; NAVY="#22345C"
def chip(t, on=False):
    return ('<button type="button" style="height: 28px; border: 1px solid %s; background: %s; color: %s; border-radius: 99px; padding: 0 12px; font-size: 12px">%s</button>'
            % (((NAVY, NAVY, "#FFFFFF") if on else (LINE, "#FFFFFF", MUTED)) + (t,)))
def btn(t, kind="", href=None):
    st = {"": "border: 1px solid #DDE2E9; background: #FFFFFF; color: #131B27",
          "p": "border: 1px solid #22345C; background: #22345C; color: #FFFFFF",
          "d": "border: 1px solid #DDE2E9; background: #FFFFFF; color: #B91C1C"}[kind]
    base = "height: 30px; border-radius: 6px; padding: 0 12px; font-size: 12px; display: inline-flex; align-items: center; text-decoration: none; " + st
    if href: return '<a href="%s" style="%s">%s</a>' % (href, base, t)
    return '<button type="button" style="%s">%s</button>' % (base, t)
def pill(t, bg="#EEF0F4", fg=MUTED):
    return '<span style="font-size: 11px; background: %s; color: %s; border-radius: 99px; padding: 1px 8px">%s</span>' % (bg, fg, t)
def icon(m, bg, size=36, fg="#FFFFFF"):
    return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 10px; background: %s; color: %s; display: grid; place-items: center; font-weight: 700; font-size: %dpx">%s</span>' % (size, size, bg, fg, size//2.4, m)

SEC = '   <section style="flex: 1; min-width: 0; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px">\n'
def title(h, note, action=""):
    return '    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap"><h2 style="font-size: 17px; margin: 0">%s</h2><span style="font-size: 12px; color: %s">%s</span>%s</div>\n' % (h, MUTED, note, ('<span style="margin-left: auto; display: flex; gap: 6px">%s</span>' % action) if action else "")
def aside(inner, w=340):
    return '   <aside aria-label="選んだもの" style="width: %dpx; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px">\n%s\n   </aside>' % (w, inner)
def kv(rows):
    return '<div style="display: grid; grid-template-columns: 72px 1fr; gap: 6px; font-size: 12px">' + "".join('<span style="color: %s">%s</span><span>%s</span>' % (MUTED, k, v) for k, v in rows) + '</div>'

# ---------- RoomWays ----------
def way(m, name, ver, scope, uses, ok, last, note, bg=NAVY, sel=False, lock=False):
    border = "border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2" if sel else "border: 1px solid #DDE2E9"
    return ('<a href="RoomType.dc.html" style="position: relative; display: flex; flex-direction: column; gap: 8px; %s; background: #FFFFFF; border-radius: 10px; padding: 14px; text-decoration: none; color: #131B27">'
      '<div style="display: flex; gap: 10px; align-items: center">%s<div style="min-width: 0"><b style="font-weight: 500; display: block">%s</b><span style="font-size: 11px; color: %s">%s ・ %s</span></div></div>'
      '<span style="font-size: 12px; color: %s">%s</span>'
      '<div style="display: flex; gap: 12px; font-size: 11px; color: %s; border-top: 1px solid #EDF0F4; padding-top: 8px"><span>使った %s 回</span><span>そのまま通った %s</span><span style="margin-left: auto">%s</span></div>%s</a>'
      % (border, icon(m, "#5E6F93" if lock else bg), name, MUTED, ver, scope, MUTED, note, MUTED, uses, ok, last,
         '<span style="position: absolute; top: 10px; right: 10px; font-size: 10px; color: #4A5563; border: 1px solid #DDE2E9; border-radius: 99px; padding: 0 6px">直せない</span>' if lock else ""))
grid = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px">'
ways = SEC + title("やり方", "その仕事のときだけ分身が使う手順。カードを開くと組む・試すに進む", btn("＋ やり方を作る", "p", "RoomType.dc.html"))
ways += '    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">' + chip("すべて 8", True) + chip("自分 5") + chip("層から 2") + chip("ワークスペースから 1") + '<span style="margin-left: auto; font-size: 12px; color: %s">並べ方 <b style="font-weight: 500; color: #131B27">よく使う順 ▾</b></span></div>\n' % MUTED
ways += ('    <div style="display: flex; gap: 12px; align-items: center; border: 1px dashed #B45309; background: #FFF8EE; border-radius: 10px; padding: 10px 14px">%s<div style="flex: 1; min-width: 0"><b style="font-weight: 500">同じ流れを 3 回やっています：「月末の請求書を作って送る」</b><div style="font-size: 12px; color: %s">EG-112・EG-120・EG-128 の手順がほぼ同じ。やり方にしておくと次から迷わない</div></div>%s%s</div>\n'
         % (icon("？", "#FCEBD5", 32, "#7A4A05"), MUTED, btn("やり方にする", "p", "RoomType.dc.html"), btn("今はいい")))
ways += '    <div style="font-size: 12px; color: %s; font-weight: 500">自分</div>\n    ' % MUTED + grid
ways += way("請", "請求書を作って送る", "v4", "自分", 18, "17", "11/01", "見積から請求書を作り、宛名を確かめてメールで送る", sel=True)
ways += way("見", "見積を作る", "v2", "自分", 9, "8", "10/30", "過去の見積と単価表から下書き。値引きは書かない")
ways += way("議", "打ち合わせのまとめ", "v3", "自分", 14, "14", "10/31", "録音の文字起こしから決まったこと・宿題を分けて書く")
ways += way("返", "問い合わせに返す", "v1", "自分", 6, "4", "10/27", "よくある質問の答えを元に返信の下書き")
ways += way("週", "週の振り返りを書く", "v1", "自分", 3, "3", "10/25", "今週のチケットと承認から振り返りを書く")
ways += '</div>\n    <div style="font-size: 12px; color: %s; font-weight: 500; margin-top: 4px">層・ワークスペースから（自分では直せない。写して自分用にできる）</div>\n    ' % MUTED + grid
ways += way("応", "求人の応募文を書く", "v6", "層：営業", 22, "19", "10/31", "求人票から 400 字以内の応募文", lock=True)
ways += way("提", "提案書の骨組み", "v2", "層：営業", 7, "6", "10/22", "ヒアリングのメモから提案書の章立て", lock=True)
ways += way("経", "経費の申請", "v3", "ワークスペース", 11, "11", "10/29", "領収書の写真から経費の申請を作る", lock=True)
ways += '</div>\n   </section>\n'
ways += aside(
  '<div style="display: flex; gap: 10px; align-items: center">%s<div><b style="font-size: 15px">請求書を作って送る</b><div style="font-size: 12px; color: %s">v4 ・ 自分 ・ 11/01 に直した</div></div></div>' % (icon("請", NAVY, 40), MUTED)
  + '<div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px">' + "".join('<div style="display: flex; gap: 8px; align-items: center; border: 1px solid #DDE2E9; border-radius: 8px; padding: 6px 10px"><b style="width: 18px; height: 18px; border-radius: 99px; background: #EEF3FD; color: #22345C; display: grid; place-items: center; font-size: 11px">%d</b>%s</div>' % (i+1, s) for i, s in enumerate(["見積のチケットを読む", "請求書のひな形に写す", "宛名と CC を確かめる（守ること）", "自分に承認を出す", "メールで送る"])) + '</div>'
  + kv([("使う時", "種別『請求』のチケット"), ("止まる所", "4. 自分の承認"), ("通った", "18 回中 17 回"), ("最後", '<a href="TicketDetail.dc.html">EG-128 11/01</a>')])
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + btn("組む・試す", "p", "RoomType.dc.html") + btn("版と差分") + btn("写す") + btn("止める") + '</div>')
page("RoomWays.dc.html", "知っていること やり方", "RoomKnows.dc.html", ways, "RoomWays.dc.html")

# ---------- RoomMemory ----------
def mem(m, bg, text, src, when, auto=False, sel=False):
    border = "background: #FFFFFF; border-color: #22345C; box-shadow: 0 0 0 2px #DCE4F2" if sel else "background: #FFFFFF"
    return ('<div style="display: flex; gap: 12px; align-items: center; border: 1px solid #DDE2E9; %s; border-radius: 8px; padding: 10px 12px">%s<div style="flex: 1; min-width: 0"><div>%s</div><div style="font-size: 11px; color: %s; display: flex; gap: 8px; flex-wrap: wrap">%s<span>元：%s</span><span>%s</span></div></div><button type="button" aria-label="消す" style="width: 28px; height: 28px; border: 1px solid #DDE2E9; background: #FFFFFF; border-radius: 6px; color: #B91C1C">×</button></div>'
            % (border, icon(m, bg, 30), text, MUTED, pill("自動で覚えた", "#F1ECF9", "#6D4AA6") if auto else pill("自分で足した"), src, when))
memb = SEC + title("覚えていること", "話や仕事から分身が自動で覚える。いらないものは × で消せる",
    '<label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: %s">自動で覚える <span style="width: 34px; height: 18px; border-radius: 99px; background: #186F69; position: relative; display: inline-block"><span style="position: absolute; right: 2px; top: 2px; width: 14px; height: 14px; border-radius: 99px; background: #FFFFFF"></span></span></label>' % MUTED + btn("＋ 覚えさせる"))
memb += ('    <div style="display: flex; gap: 0; border-bottom: 1px solid #DDE2E9">'
         '<a href="#" style="padding: 8px 14px; border-bottom: 2px solid #22345C; color: #22345C; font-weight: 500; text-decoration: none">好み 9</a>'
         '<a href="#" style="padding: 8px 14px; border-bottom: 2px solid transparent; color: #4A5563; text-decoration: none">事実 8</a>'
         '<a href="#" style="padding: 8px 14px; border-bottom: 2px solid transparent; color: #4A5563; text-decoration: none">実例 6</a>'
         '<input placeholder="覚えていることを探す" style="margin-left: auto; height: 30px; width: 220px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; font-family: inherit; font-size: 12px; align-self: center"></div>\n')
memb += '    <div style="font-size: 12px; color: %s">この 1 週間で覚えた ・ 3</div>\n    <div style="display: flex; flex-direction: column; gap: 6px">' % MUTED
memb += mem("好", "#6D4AA6", "メールの書き出しは「いつもお世話になっております」より「お世話になっております」", '<a href="AiChat.dc.html">壁打ち 10/31</a>', "10/31", True, True)
memb += mem("好", "#6D4AA6", "表は列を少なく。金額は右寄せ・税込", '<a href="TicketDetail.dc.html">EG-124 で直した</a>', "10/29", True)
memb += mem("好", "#6D4AA6", "朝 9 時より前に人へ知らせを送らない", "自分で足した", "10/29")
memb += '</div>\n    <div style="font-size: 12px; color: %s; margin-top: 4px">それより前</div>\n    <div style="display: flex; flex-direction: column; gap: 6px">' % MUTED
memb += mem("好", "#6D4AA6", "提案書の最初のページに結論を 3 行で", '<a href="TicketDetail.dc.html">EG-098 の差し戻し</a>', "10/20", True)
memb += mem("好", "#6D4AA6", "社内向けは箇条書き、社外向けは文章で", '<a href="AiChat.dc.html">壁打ち 10/18</a>', "10/18", True)
memb += mem("好", "#6D4AA6", "日付は「11/2（月）」の形", "自分で足した", "10/12")
memb += '</div>\n   </section>\n'
memb += aside(
  '<div style="display: flex; gap: 10px; align-items: center">%s<div><b style="font-size: 15px">メールの書き出し</b><div style="font-size: 12px; color: %s">好み ・ 10/31 に自動で覚えた</div></div></div>' % (icon("好", "#6D4AA6", 40), MUTED)
  + '<div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px 12px">メールの書き出しは「いつもお世話になっております」より「お世話になっております」</div>'
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px"><b style="font-weight: 500">覚えたきっかけ</b><div style="color: %s; margin-top: 4px">壁打ちで「いつも、はいらない」と 2 回言われたため</div><a href="AiChat.dc.html" style="font-size: 12px">その話を開く →</a></div>' % MUTED
  + kv([("使った", "4 回（最後 11/01）"), ("見える人", "自分だけ"), ("守ることに", "まだしていない")])
  + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + btn("直す") + btn("必ず守ることにする", "", "RoomAddRule.dc.html") + btn("消す", "d") + '</div>'
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 10px; font-size: 12px; color: %s">消すと、分身はこのことを使わなくなる。消したものは 30 日間「消したもの」から戻せる</div>' % MUTED)
page("RoomMemory.dc.html", "知っていること 覚えていること", "RoomKnows.dc.html", memb, "RoomMemory.dc.html")

# ---------- RoomWants ----------
def want(kind, kbg, kfg, text, why, src, actions, extra=""):
    return ('<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">'
            '<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">%s<span style="font-size: 11px; color: %s">きっかけ：%s</span></div>'
            '<div style="font-size: 14px">%s</div><div style="font-size: 12px; color: %s">%s</div>%s'
            '<div style="display: flex; gap: 6px; flex-wrap: wrap">%s</div></div>'
            % (pill(kind, kbg, kfg), MUTED, src, text, MUTED, why, extra, actions))
wb = SEC + title("覚えたいこと", "分身が覚えたいと言っているもの。決めるまで使わない",
    '<span style="font-size: 12px; color: %s">きっかけ</span>' % MUTED)
wb += '    <div style="display: flex; gap: 6px; flex-wrap: wrap">' + chip("すべて 4", True) + chip("直したところ 1") + chip("差し戻し 1") + chip("話の中で 1") + chip("同じ流れ 1") + chip("ナレッジ 0") + '</div>\n'
wb += '    <div style="display: flex; flex-direction: column; gap: 10px; max-width: 880px">'
wb += want("必ず守ること", "#E3F1EF", "#186F69", "セイコー様の見積は 5% 引いた額で出す",
    "EG-131 で高本さんが見積の金額を 2 回とも 5% 下げて直したため", '<a href="TicketDetail.dc.html">EG-131 で直したところ</a>',
    btn("ワークスペースの決まりとの扱いを決める", "p") + btn("自分の好みとして覚える") + btn("覚えない"),
    '<div style="border: 1px solid #F3C7C7; background: #FDF3F3; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 6px">'
    '<b style="color: #B91C1C; font-weight: 500">分身の点検：ワークスペースの決まりとぶつかります</b>'
    '<span>ワークスペースの「値引きを書かない」（直せない）と反対のことになる</span>'
    '<span style="color: %s">このまま守ることにするには、セイコー様だけの例外としてマネージャー（佐藤）の OK が要る。OK が出るまでは今の決まりで動く</span>'
    '<span style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px">%s%s</span></div>' % (MUTED, btn("例外にして OK をもらう", "", "Approvals.dc.html"), btn("今の決まりに合わせる")))
wb += want("やり方", "#E6EAF2", NAVY, "「月末の請求書を作って送る」をやり方にする",
    "EG-112・EG-120・EG-128 で同じ流れを 3 回やった", "同じ流れ",
    btn("組んでみる", "p", "RoomType.dc.html") + btn("あとで") + btn("覚えない"))
wb += want("覚えていること", "#F1ECF9", "#6D4AA6", "鈴木様（営業）は電話より Chat が早い",
    "壁打ちで 10/30 に話していた", '<a href="AiChat.dc.html">壁打ち 10/30</a>',
    btn("覚える", "p") + btn("直して覚える") + btn("覚えない"),
    '<div style="font-size: 12px; color: #166534">分身の点検：ぶつかりなし ・ 似ているものなし</div>')
wb += want("必ず守ること", "#E3F1EF", "#186F69", "提案書の最初のページに結論を書く",
    "EG-098 がマネージャーに「結論が先に見えない」と差し戻された", '<a href="TicketDetail.dc.html">EG-098 の差し戻し</a>',
    btn("覚える", "p") + btn("直して覚える") + btn("覚えない"),
    '<div style="font-size: 12px; color: #7A4A05">分身の点検：覚えていること「最初のページに結論を 3 行で」と似ている → まとめて 1 つにする</div>')
wb += '</div>\n   </section>\n'
wb += aside(
  '<b style="font-size: 14px">分身が覚えたくなる 5 つのきっかけ</b>'
  + '<div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px">' + "".join(
      '<div style="display: flex; gap: 10px; align-items: flex-start">%s<div><b style="font-weight: 500">%s</b><div style="color: %s">%s</div></div></div>' % (icon(m, "#EEF0F4", 28, NAVY), h, MUTED, d)
      for m, h, d in [("直", "直したところ", "分身の下書きを自分が直した"), ("戻", "差し戻し", "承認で差し戻された理由"), ("話", "話の中で", "壁打ちで言ったこと"), ("繰", "同じ流れ", "同じ手順を何度もやった"), ("知", "ナレッジ", "ワークスペースの資料が新しくなった")]) + '</div>'
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 10px; font-size: 12px; color: %s">覚えていること（好み・事実）は自動で入る。必ず守ること・やり方は、ここで決めるまで使わない</div>' % MUTED)
page("RoomWants.dc.html", "知っていること 覚えたいこと", "RoomKnows.dc.html", wb, "RoomWants.dc.html")

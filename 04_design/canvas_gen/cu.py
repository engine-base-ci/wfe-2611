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
EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>'
seen = lambda t="先方に見える": '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #7A4A05; background: #FFF4E0; border-radius: 99px; padding: 1px 8px">' + EYE + t + '</span>'
priv = lambda t="社内だけ": '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #4A5563; background: #F2F4F7; border-radius: 99px; padding: 1px 8px">' + LOCK + t + '</span>'
TH = 'font-size: 12px; color: #4A5563; font-weight: 500; text-align: left; padding: 0 12px; height: 34px; border-bottom: 1px solid #DDE2E9; background: #FAFBFC; white-space: nowrap'
TD = 'padding: 0 12px; height: 48px; border-bottom: 1px solid #EDF0F4; white-space: nowrap; font-size: 13px'
def table(heads, rows):
    return '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow-x: auto"><table style="border-collapse: collapse; width: 100%%"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % ("".join('<th style="%s">%s</th>' % (TH, h) for h in heads), "".join("<tr>" + "".join('<td style="%s">%s</td>' % (TD, c) for c in r) + "</tr>" for r in rows))
GC = {'営業': ('EG', '#186F69'), '受託開発': ('JD', '#6D4AA6'), '経理': ('KR', '#B45309')}
grp = lambda *gs: '<span style="display: inline-flex; gap: 4px; flex-wrap: wrap">' + ''.join('<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; border: 1px solid #DDE2E9; border-radius: 99px; padding: 1px 8px 1px 3px; background: #FFFFFF"><span style="width: 14px; height: 14px; border-radius: 4px; background: %s; color: #FFFFFF; font-size: 8px; display: grid; place-items: center">%s</span>%s</span>' % (GC[g][1], GC[g][0], g) for g in gs) + '</span>'
num = lambda n, warn=False: '<b style="font-weight: 600; color: %s">%s</b>' % ("#B45309" if warn else "#131B27", n)
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
  + '<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">' + icon("セ", "#186F69", 28) + '<div><b style="font-size: 16px">12 月分の作業報告書もほしい</b><div style="font-size: 12px; color: %s">セイコー株式会社 ・ 鈴木 健太 様 ・ 今日 10:20 ・ 同じゲストのグループの人にも見えている</div></div></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px">'
  + msg("鈴木 健太 様", "鈴", "#2F4B7C", "今日 10:20", "いつもありがとうございます。11 月分と同じ形で、12 月分の作業報告書もいただけますか。年内に社内に回したいです。")
  + '</div>' + draft
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 10px 12px"><div style="font-size: 12px; color: %s; margin-bottom: 6px">先方に返す ' % MUTED + seen() + '</div><div style="font-size: 13px; line-height: 1.7; color: #131B27">鈴木様　承知しました。11 月分と同じ形で、12/26 までにお送りします。宛先は山田様でよろしいでしょうか。</div><div style="font-size: 11px; color: %s; margin-top: 6px">分身が下書きした返事。直せる</div></div>' % MUTED
  + '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center"><span style="flex: 1; font-size: 12px; color: %s">受けるとチケットになり、依頼とつながったまま残る。先方には「受けました」と期限が見える</span>%s%s%s</div>' % (MUTED, btn("断る（理由を返す）"), btn("返事を送って詳しく聞く"), btn("受けてチケットにする", "p", "TicketDetail.dc.html"))
  + '</section>')
rqpage = '\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + lst + detail2 + '</div>'
shell("CuRequests.dc.html", "届いた依頼", [("届いた依頼", None)], rqpage)

# ---------- クライアントの場所（先方の画面） ----------
base = MAIN
i0 = base.index("<div data-shell"); i1 = base.index("</x-dc>")
def portal(name, title, inner):
    page = ('<div data-shell style="min-height: 100vh; background: #F2F4F7; display: flex; flex-direction: column">'
      + '<header style="background: #FFFFFF; border-bottom: 1px solid #DDE2E9; height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 24px">' + icon("E", NAVY, 28) + '<div><b>ENGINE BASE</b><div style="font-size: 11px; color: %s">セイコー株式会社 の場所</div></div>' % MUTED
      + '<span style="margin-left: auto; display: flex; gap: 10px; align-items: center; font-size: 12px; color: %s">山田 花子 様（経理部）%s</span></header>' % (MUTED, av("山", "#7E570D", 28))
      + '<main style="flex: 1; width: 100%; max-width: 960px; margin: 0 auto; padding: 24px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px">' + inner + '</main>'
      + '<footer style="text-align: center; font-size: 11px; color: %s; padding: 14px">この場所で見えるのは、ENGINE BASE が見せると決めたものだけです。確認のお願いや返事はメールでも届きます</footer></div>\n' % MUTED)
    s = base[:i0] + page + base[i1:]
    save(name, title, s); return s
pc = lambda t, sub_, st, bar=None: '<div style="display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid #EDF0F4"><span style="flex: 1; min-width: 0"><span style="display: block; font-weight: 500">%s</span><span style="font-size: 12px; color: %s">%s</span>%s</span>%s</div>' % (t, MUTED, sub_, ('<span style="display: block; height: 4px; border-radius: 99px; background: #EEF0F4; margin-top: 6px; max-width: 240px"><span style="display: block; height: 100%%; width: %d%%; background: #22345C; border-radius: 99px"></span></span>' % bar) if bar is not None else "", pill(st))
home = ('<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">ENGINE BASE とのやり取り</h1><span style="margin-left: auto">%s</span></div>' % btn("＋ 依頼を出す", "p", "CpNew.dc.html")
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; overflow: hidden"><div style="padding: 12px 16px"><b>依頼</b><span style="font-size: 12px; color: %s"> ・ セイコー株式会社の皆さんの依頼</span></div>' % MUTED
  + pc("12 月分の作業報告書もほしい", "鈴木 健太 様 ・ 今日 10:20 ・ ENGINE BASE から返事：「12/26 までにお送りします。宛先は山田様で…」", "返事あり")
  + pc("10 月分の請求書の宛名を変えたい", "山田 花子 様 ・ 10/12", "済み") + '</div>'
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; overflow: hidden"><div style="padding: 12px 16px"><b>見せてもらったチケット</b></div>'
  + pc("11月分の請求書を送る", "期限 11/01", "確認中", 80)
  + pc("保守更新の見積", "期限 11/05", "作っている", 50)
  + pc("12 月分の作業報告書", "期限 12/26 ・ 今日受けた", "これから", 5) + '</div>')
portal("CpHome.dc.html", "クライアントの場所", home)
new = ('<a href="CpHome.dc.html" style="font-size: 12px">← 戻る</a><h1 style="font-size: 20px; margin: 0">依頼を出す</h1><div style="font-size: 12px; color: %s">ENGINE BASE の担当（高本さん）に届きます。セイコー株式会社の皆さんにも見えます</div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 14px; max-width: 680px">'
  + '<div>' + lab("何をしてほしいか") + '<textarea style="width: 100%; box-sizing: border-box; min-height: 90px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 14px">来年 1 月から請求書の宛先を経理部の佐野に変えたいです</textarea></div>'
  + '<div style="display: flex; gap: 10px; align-items: flex-start; background: #F3F6FC; border: 1px solid #C9D6EE; border-radius: 8px; padding: 10px 12px; font-size: 13px">' + icon("AI", NAVY, 22) + '<span style="flex: 1; line-height: 1.7">伝わりやすくするために、ひとつ教えてください：<b style="font-weight: 600">佐野様のメールアドレス</b>と、<b style="font-weight: 600">CC は今と同じ鈴木様のままでよいか</b>。<span style="display: block; font-size: 11px; color: %s">ENGINE BASE の担当の AI が聞いています。答えなくても出せます（担当が席にいないときは、あとで依頼のやり取りで聞きます）</span></span></div>' % MUTED
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("いつまでに", "（任意）") + field("12/20 ▾") + '</div><div>' + lab("添付", "（任意）") + field("＋ ファイルを足す", True) + '</div></div>'
  + '<div style="display: flex; justify-content: flex-end">' + btn("依頼を出す", "p", "CpHome.dc.html") + '</div></div>')
portal("CpNew.dc.html", "依頼を出す（先方）", new)

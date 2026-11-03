import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
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
DOCI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><path d="M14 3v6h6"></path></svg>'
MARK = lambda m, bg: '<span style="width: 20px; height: 20px; flex: none; border-radius: 6px; background: %s; color: #FFFFFF; display: grid; place-items: center; font-size: 10px; font-weight: 700">%s</span>' % (bg, m)
def ti(href, label, depth, cur, kind="page", open_=None, n="", flag=""):
    car = ('<span style="width: 12px; color: #8A94A3; font-size: 10px">%s</span>' % ("▾" if open_ else "▸")) if open_ is not None else '<span style="width: 12px"></span>'
    ic = DOCI if kind == "page" else kind
    return '<a href="%s"%s class="kn-sub-i" style="height: 32px; padding-left: %dpx">%s<span class="kn-sub-ic">%s</span><span class="kn-sub-t" style="font-weight: inherit">%s</span>%s%s</a>' % (href, ' aria-current="page"' if cur else "", 6 + depth * 14, car, ic, label, flag, '<span class="kn-sub-n">%s</span>' % n if n else "")
DUE = '<span style="width: 7px; height: 7px; border-radius: 99px; background: #B45309; flex: none" title="確かめ期限が過ぎた"></span>'
def tree(cur):
    c = lambda k: cur == k
    return ('<aside aria-label="ナレッジの置き場" class="kn-sub" style="width: 260px">'
      + ti("KnHome.dc.html", "ホーム", 0, c("home"), MARK("家", "#4A5563"))
      + ti("KnVerify.dc.html", "確かめること", 0, c("verify"), MARK("確", "#B45309")).replace('</a>', '<b class="kn-sub-badge">2</b></a>')
      + ti("KnProposal.dc.html", "直す案", 0, c("prop"), MARK("案", "#6D4AA6")).replace('</a>', '<b class="kn-sub-badge">2</b></a>')
      + '<div class="kn-sub-h">置き場</div>'
      + ti("#", "ワークスペース全体", 0, False, MARK("E", NAVY), True, "11")
      + ti("#", "請求", 1, False, "page", True)
      + ti("KnPage.dc.html", "請求のルール", 2, c("page"))
      + ti("#", "インボイスの書き方", 2, False)
      + ti("#", "請求書のひな形", 2, False)
      + ti("#", "見積", 1, False, "page", False)
      + ti("#", "経理の月次の流れ", 1, False)
      + ti("#", "営業", 0, False, MARK("EG", "#186F69"), True, "8")
      + ti("#", "営業の進め方", 1, False, flag=DUE)
      + ti("#", "提案書の組み立て", 1, False)
      + ti("#", "問い合わせの返し方", 1, False, flag=DUE)
      + ti("#", "受託開発", 0, False, MARK("JD", "#6D4AA6"), False, "3")
      + ti("#", "自分のページ", 0, False, MARK("高", "#6B5B99"), False, "2")
      + '<div class="kn-sub-h">話題</div><div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 0 10px">' + "".join(pill("#" + t) for t in ["請求", "見積", "インボイス", "セイコー", "発注ナビ"]) + '</div>'
      + '<a href="#" class="kn-sub-i" style="margin-top: 8px; height: 32px; color: #6B7585"><span class="kn-sub-ic">' + DOCI + '</span><span class="kn-sub-t">しまったページ</span><span class="kn-sub-n">4</span></a>'
      + '</aside>')
OK = lambda d: pill("✓ 確かめ済み " + d, "#E8F5EC", "#166534")
LATE = lambda d: pill("確かめ期限が過ぎた " + d, "#FFF4E0", "#7A4A05")
DRAFT = pill("下書き", "#F2F4F7", "#4A5563")
def av(c, bg, n=20): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 10px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
OWN = {"高": "#6B5B99", "佐": "#186F69", "鈴": "#2F4B7C", "田": "#7E570D"}
# ---------- ホーム ----------
def prow(t, path, owner, ver, used, upd, href="KnPage.dc.html"):
    return ('<a href="%s" style="display: flex; align-items: center; gap: 14px; padding: 11px 16px; border-top: 1px solid #EDF0F4; text-decoration: none; color: #131B27"><span style="color: #8A94A3">%s</span><span style="flex: 1; min-width: 0"><span style="display: block; font-weight: 500">%s</span><span style="font-size: 11px; color: %s">%s</span></span><span style="width: 90px; display: flex; gap: 6px; align-items: center; font-size: 12px">%s%s</span><span style="width: 170px">%s</span><span style="width: 110px; font-size: 12px; color: %s">分身 %s 回</span><span style="width: 60px; text-align: right; font-size: 12px; color: %s">%s</span></a>'
            % (href, DOCI, t, MUTED, path, av(owner, OWN[owner]), {"高": "高本", "佐": "佐藤", "鈴": "鈴木", "田": "田中"}[owner], ver, MUTED, used, MUTED, upd))
card = lambda title, n, body, href="#": '<div style="flex: 1 1 260px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; gap: 6px"><b style="font-weight: 600">%s</b><span style="font-size: 12px; color: %s">%s</span><a href="%s" style="margin-left: auto; font-size: 12px">すべて</a></div>%s</div>' % (title, MUTED, n, href, body)
mini = lambda t, sub, href="KnPage.dc.html": '<a href="%s" style="display: flex; flex-direction: column; text-decoration: none; color: #131B27; font-size: 13px">%s<span style="font-size: 11px; color: %s">%s</span></a>' % (href, t, MUTED, sub)
sup = lambda n: '<sup style="font-size: 10px; color: #22345C; background: #EEF3FD; border-radius: 4px; padding: 0 4px; margin-left: 2px">%s</sup>' % n
home = ('\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + tree("home")
  + '<section style="flex: 1; min-width: 0; padding: 22px 28px; display: flex; flex-direction: column; gap: 16px">'
  + '<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">ナレッジ</h1><span style="font-size: 12px; color: %s">会社のやり方の文書 ・ 24 ページ</span><span style="margin-left: auto; display: flex; gap: 6px">%s%s</span></div>' % (MUTED, btn("取り込む", "", "KnImport.dc.html"), btn("＋ ページを書く", "p", "KnNew.dc.html"))
  + '<div style="display: flex; gap: 10px; align-items: center; background: #FFFFFF; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 12px; padding: 0 16px; height: 50px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A5563" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><span style="flex: 1; font-size: 15px">セイコー様への請求書は誰に送る？</span><span style="font-size: 11px; color: %s">ことばで聞ける ・ 見られる公開のページだけから答える（PC がつながっていないときは、当てはまるページと行を出す）</span></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">'
  + '<div style="display: flex; gap: 8px; align-items: center">' + icon("AI", NAVY, 22) + '<b style="font-weight: 600">答え</b><span style="font-size: 11px; color: %s">2 つのページから</span></div>' % MUTED
  + '<div style="font-size: 14px; line-height: 1.8">宛名は先方の経理部 山田様、CC に営業の鈴木様を入れます%s。PDF をメールに添付して送り、先方の請求書システムへの登録は要りません%s。</div>' % (sup("1"), sup("2"))
  + '<div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #EDF0F4; padding-top: 8px; font-size: 12px">'
  + '<a href="#" style="display: flex; gap: 8px; align-items: center; text-decoration: none; color: #131B27"><b style="color: #22345C; width: 16px">1</b>取引先のルール：セイコー様 ・ 宛名と CC ' + OK("10/28") + '</a>'
  + '<a href="KnPage.dc.html" style="display: flex; gap: 8px; align-items: center; text-decoration: none; color: #131B27"><b style="color: #22345C; width: 16px">2</b>請求のルール › 3. 送り方 ' + OK("10/28") + '</a></div>'
  + '<div style="display: flex; gap: 6px"><span style="font-size: 11px; color: %s">この答えは役に立った？</span><a href="#" style="font-size: 11px">はい</a><a href="#" style="font-size: 11px">いいえ（直す案にする）</a></div></div>' % MUTED
  + '<div style="display: flex; gap: 12px; flex-wrap: wrap">'
  + card("確かめること", "あなたが持ち主 ・ 2", mini("営業の進め方", "期限 10/31 を過ぎた ・ 90 日ごと", "KnVerify.dc.html") + mini("問い合わせの返し方", "期限 10/12 を過ぎた", "KnVerify.dc.html"), "KnVerify.dc.html")
  + card("直す案", "2", mini("請求のルール ・ 3. 送り方", "EG-128 から ・ 高本のAI", "KnProposal.dc.html") + mini("新しいページ：年末の請求の早め締め", "EG-126 から ・ 鈴木のAI", "KnProposal.dc.html"), "KnProposal.dc.html")
  + card("最近見た", "", mini("請求のルール", "ワークスペース全体 › 請求") + mini("見積の作り方と単価表", "ワークスペース全体 › 見積"))
  + '</div>'
  + '<div style="display: flex; align-items: center; gap: 8px"><b>よく使われるページ</b><span style="margin-left: auto; font-size: 12px; color: %s">並べ方：よく使われる順 ▾</span></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden">'
  + '<div style="display: flex; gap: 14px; padding: 8px 16px; font-size: 11px; color: %s; background: #FAFBFC"><span style="width: 14px"></span><span style="flex: 1">題名・置き場</span><span style="width: 90px">持ち主</span><span style="width: 170px">確かめ</span><span style="width: 110px">使われ方</span><span style="width: 60px; text-align: right">直した</span></div>' % MUTED
  + prow("請求のルール", "ワークスペース全体 › 請求 ・ 版 4", "高", OK("10/28"), 41, "10/28")
  + prow("見積の作り方と単価表", "ワークスペース全体 › 見積 ・ 版 7", "佐", OK("10/15"), 27, "10/15")
  + prow("営業の進め方", "営業 ・ 版 3", "高", LATE("10/31"), 19, "8/02")
  + prow("提案書の組み立て", "営業 ・ 版 2", "鈴", OK("9/20"), 12, "9/20")
  + prow("経理の月次の流れ", "ワークスペース全体 ・ 版 5", "田", OK("10/31"), 9, "10/31")
  + prow("年末の請求の早め締め", "ワークスペース全体 › 請求", "鈴", DRAFT, 0, "11/02")
  + '</div></section></div>')
H = shell("KnHome.dc.html", "ナレッジ", [("ナレッジ", None)], home)
# ---------- ページ ----------
h2 = lambda t, i: '<h2 id="s%d" style="font-size: 16px; margin: 24px 0 6px; padding-bottom: 6px; border-bottom: 1px solid #DDE2E9">%s</h2>' % (i, t)
meta = ('<div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: %s; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid #EDF0F4; border-bottom: 1px solid #EDF0F4; margin-top: 10px">' % MUTED
  + '<span style="display: inline-flex; gap: 6px; align-items: center">持ち主 ' + av("高", OWN["高"]) + '<span style="color: #131B27">高本</span></span>'
  + '<span>' + OK("10/28") + ' 次は 1/28（90 日ごと）</span><span>公開 ・ 版 4</span><span style="display: flex; gap: 4px">' + pill("#請求") + pill("#インボイス") + '</span></div>')
toc = '<div style="float: right; width: 200px; margin: 0 0 10px 20px; background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px"><b style="font-weight: 500; display: block; margin-bottom: 4px">目次</b>' + "".join('<a href="#s%d" style="display: block; padding: 2px 0">%s</a>' % (i, t) for i, t in enumerate(["1. 締めと支払期日", "2. 請求書に入れること", "3. 送り方", "4. 関わる決まり"])) + '</div>'
ref = lambda key, t, sub: '<a href="TicketDetail.dc.html" style="display: flex; gap: 8px; padding: 5px 0; text-decoration: none; color: #131B27; font-size: 13px"><span style="color: #22345C; min-width: 52px">%s</span><span>%s</span><span style="margin-left: auto; font-size: 11px; color: %s">%s</span></a>' % (key, t, MUTED, sub)
doc = ('<article style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 18px 28px 28px; max-width: 860px">'
  + '<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: %s"><a href="#" style="color: %s">ワークスペース全体</a><span>›</span><a href="#" style="color: %s">請求</a><span style="margin-left: auto; display: flex; gap: 6px">%s%s%s</span></div>' % (MUTED, MUTED, MUTED, btn("直す", "", "KnEdit.dc.html"), btn("ウォッチ"), btn("…"))
  + '<h1 style="font-size: 26px; margin: 8px 0 2px">請求のルール</h1><div style="font-size: 13px; color: %s">請求書を作って送るときの、このワークスペースの決まりと手順</div>' % MUTED
  + meta + '<div style="margin-top: 14px">' + toc
  + h2("1. 締めと支払期日", 0) + '<ul style="margin: 0; padding-left: 20px; line-height: 1.9"><li>締めは毎月 25 日。翌月 1 日に請求書を作る</li><li>支払期日は「月末締め翌月末」が基本。取引先ごとの決まりがあればそちら</li></ul>'
  + h2("2. 請求書に入れること", 1) + '<ul style="margin: 0; padding-left: 20px; line-height: 1.9"><li>登録番号 T1234567890123</li><li>税率ごとの金額（10% と 8% を分ける）</li><li>値引きは書かない</li></ul>'
  + h2("3. 送り方", 2) + '<p style="margin: 0; line-height: 1.8">PDF をメールに添付して、宛名は先方の経理の担当者、CC に当社の営業担当を入れる。先方の請求書システムへの登録は不要。</p>'
  + '<div style="margin-top: 10px; border: 1px solid #E2D6F3; background: #F7F3FC; border-radius: 8px; padding: 8px 12px; font-size: 12px; display: flex; gap: 8px; align-items: center">' + icon("案", "#6D4AA6", 20) + '<span style="flex: 1">このところに直す案があります（EG-128 から）</span><a href="KnProposal.dc.html" style="font-size: 12px">確かめる →</a></div>'
  + h2("4. 関わる決まり", 3) + '<div style="display: flex; gap: 6px; flex-wrap: wrap"><a href="WsRules.dc.html" style="text-decoration: none">' + pill("守ること：値引きを書かない", "#E3F1EF", "#186F69") + '</a><a href="WsRules.dc.html" style="text-decoration: none">' + pill("守ること：請求は 25 日締め", "#E3F1EF", "#186F69") + '</a><a href="RoomType.dc.html" style="text-decoration: none">' + pill("やり方：請求書を作って送る v4", "#E6EAF2", NAVY) + '</a></div></div>'
  + '<div style="clear: both; margin-top: 26px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px">'
  + '<div><b style="font-size: 13px">このページの下のページ</b><div style="margin-top: 6px">' + "".join('<a href="#" style="display: flex; gap: 8px; align-items: center; padding: 5px 0; text-decoration: none; color: #131B27; font-size: 13px"><span style="color: #8A94A3">%s</span>%s</a>' % (DOCI, t) for t in ["取引先ごとの宛名の決め方", "請求の取り消しと出し直し"]) + '<a href="KnNew.dc.html" style="font-size: 12px">＋ 下にページを書く</a></div></div>'
  + '<div><b style="font-size: 13px">このページを参照しているもの</b><span style="font-size: 12px; color: %s"> ・ 21</span><div style="margin-top: 6px">' % MUTED + ref("ページ", "経理の月次の流れ", "2 か所") + ref("ページ", "見積の作り方と単価表", "1 か所") + ref("決まり", "やり方：請求書を作って送る v4", "手順の 2") + ref("EG-128", "セイコー様へ 11月分の請求書", "参照するもの") + '<a href="#" style="font-size: 12px">チケット 17 件をすべて見る</a></div></div></div>'
  + '</article>')
ptab = lambda on: '<nav aria-label="パネルのタブ" style="display: flex; flex: none; border-bottom: 1px solid #DDE2E9; padding: 0 6px">' + "".join('<a href="#" style="padding: 10px 9px; border-bottom: 2px solid %s; color: %s; text-decoration: none; white-space: nowrap; font-size: 12px; %s">%s</a>' % (NAVY if t == on else "transparent", NAVY if t == on else MUTED, "font-weight: 500" if t == on else "", t) for t in ["使われ方", "つながり", "版 4", "やり取り 2"]) + '</nav>'
use = lambda key, t, when, how: '<a href="TicketDetail.dc.html" style="display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid #EDF0F4; text-decoration: none; color: #131B27; font-size: 12px"><span style="color: #22345C; width: 52px">%s</span><span style="flex: 1">%s<span style="display: block; font-size: 11px; color: %s">%s ・ %s</span></span></a>' % (key, t, MUTED, when, how)
panel = ('<aside aria-label="選んだもの" style="width: 320px; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; display: flex; flex-direction: column">' + ptab("使われ方")
  + '<div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px">'
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px"><div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px"><b style="font-size: 20px">41</b><div style="font-size: 11px; color: %s">分身が読んだ（3 か月）</div></div><div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px"><b style="font-size: 20px">0</b><div style="font-size: 11px; color: %s">差し戻しに関わった</div></div></div>' % (MUTED, MUTED)
  + '<div style="font-size: 12px; font-weight: 500">最近読んだチケット</div><div>' + use("EG-128", "セイコー様へ 11月分の請求書", "11/01 高本のAI", "参照するもの") + use("KR-031", "入金の照合（10月分）", "10/31 田中のAI", "自分で探して読んだ") + use("EG-120", "ミナト様へ 10月分の請求書", "10/01 高本のAI", "参照するもの") + '</div>'
  + '<div style="font-size: 12px; font-weight: 500">よく読まれるところ</div><div style="font-size: 12px; color: %s; display: flex; flex-direction: column; gap: 4px"><span>3. 送り方 ・ 28 回</span><span>2. 請求書に入れること ・ 19 回</span></div>' % MUTED
  + '<div style="font-size: 11px; color: %s; border-top: 1px solid #EDF0F4; padding-top: 10px">分身は公開のページだけ読む。確かめ期限が過ぎたページを読んだときは、実行の記録に残し持ち主に知らせる</div>' % MUTED
  + '</div></aside>')
page = '\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + tree("page") + '<section style="flex: 1; min-width: 0; padding: 22px 28px">' + doc + '</section>' + panel + '</div>'
PG = shell("KnPage.dc.html", "ナレッジ 請求のルール", [("ナレッジ", "KnHome.dc.html"), ("ワークスペース全体", "KnHome.dc.html"), ("請求", "KnHome.dc.html"), ("請求のルール", None)], page)
# ---------- 下書き（直している） ----------
tools = '<div style="display: flex; gap: 2px; align-items: center; padding: 6px 8px; border: 1px solid #DDE2E9; border-radius: 8px; background: #FAFBFC; margin: 10px 0; font-size: 12px; color: #4A5563">' + "".join('<span style="padding: 2px 8px; border-radius: 4px">%s</span>' % t for t in ["B", "I", "見出し", "・", "1.", "☐", "表", "画像", "リンク", "引用", "注意"]) + '<span style="margin-left: auto">「/」で部品</span></div>'
ed = (PG.split('<section style="flex: 1; min-width: 0; padding: 22px 28px">')[0])  # not used
s = PG
s = s.replace('<span style="margin-left: auto; display: flex; gap: 6px">' + btn("直す", "", "KnEdit.dc.html") + btn("ウォッチ") + btn("…") + '</span>', '<span style="margin-left: auto; display: flex; gap: 6px">' + DRAFT + '</span>', 1)
s = s.replace('<p style="margin: 0; line-height: 1.8">PDF をメールに添付して、宛名は先方の経理の担当者、CC に当社の営業担当を入れる。先方の請求書システムへの登録は不要。</p>',
  tools + '<p style="margin: 0; line-height: 1.8; outline: 2px solid #DCE4F2; border-radius: 4px; padding: 4px 6px">PDF をメールに添付して、宛名は先方の経理の担当者、<span style="background: #E6F6EA">CC は取引先のルールで決めた担当を入れる（決まりがなければ当社の営業担当）</span>。先方の請求書システムへの登録は不要。担当の決め方は <span style="color: #22345C; background: #EEF3FD; border-radius: 4px; padding: 0 3px">[[取引先ごと</span><span style="display: inline-block; width: 2px; height: 16px; background: #22345C; vertical-align: middle"></span></p>'
  + '<div style="position: relative; height: 0"><div style="position: absolute; left: 180px; top: 2px; z-index: 12; width: 320px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; box-shadow: 0 10px 30px rgba(19,27,39,.18); padding: 6px; font-size: 13px">'
  + '<div style="font-size: 11px; color: #4A5563; padding: 2px 8px 4px">ページにつなぐ（[[ で呼ぶ）</div>'
  + '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; background: #F1F3F6; font-weight: 600"><span style="color: #8A94A3">' + DOCI + '</span>取引先ごとの宛名の決め方<span style="margin-left: auto; font-size: 11px; color: #4A5563; font-weight: 400">請求 の下</span></div>'
  + '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px"><span style="color: #8A94A3">' + DOCI + '</span>取引先のルール：セイコー様<span style="margin-left: auto; font-size: 11px; color: #4A5563">取引先</span></div>'
  + '<div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px; color: #22345C">＋ 「取引先ごと」という新しいページを作ってつなぐ</div></div></div>', 1)
banner = ('<div style="position: sticky; top: 0; z-index: 15; display: flex; align-items: center; gap: 10px; background: #FFF8EE; border-bottom: 1px solid #F1D9A8; padding: 10px 24px; flex-wrap: wrap"><b style="color: #7A4A05">下書き</b><span style="font-size: 12px; color: #7A4A05">ほかの人と分身には版 4 が見えている ・ 公開するまで知らせは出ない ・ 自動で保存しました 11:20</span>'
  + '<span style="margin-left: auto; display: flex; gap: 6px">' + btn("下書きを捨てる", "", "KnPage.dc.html") + '<button type="button" aria-expanded="true" style="height: 30px; border-radius: 6px; padding: 0 12px; font-size: 12px; border: 1px solid #22345C; background: #22345C; color: #FFFFFF; box-shadow: 0 0 0 2px #DCE4F2">公開する</button></span></div>')
i = s.index("</span></div>", s.index('class="kn-bar"')) + len("</span></div>")
s = s[:i] + banner + s[i:]
pub = ('<b style="display: block; padding: 2px 4px 8px">版 5 として公開する</b>'
  + '<div style="padding: 0 4px">' + lab("何を直したか", "（版に残る）") + field("CC を取引先のルールに合わせる書き方にした（EG-128 の直す案から）") + '</div>'
  + '<div style="padding: 8px 4px 0">' + check("ウォッチしている 3 人に知らせる", True) + check("確かめ済みにする（次は 2/2）", True, "直した中身をあなたが確かめた") + '</div>'
  + '<div style="display: flex; justify-content: flex-end; gap: 6px; padding: 8px 4px 2px">' + btn("やめる") + btn("公開する", "p", "KnPage.dc.html") + '</div>')
s = float_pop(s, pub, "top: 96px; right: 24px; width: 360px")
save("KnEdit.dc.html", "ナレッジ 下書き", s)
# ---------- 確かめること ----------
def vcard(t, path, owner, due, interval, check_, act, tone="#FFF8EE", bd="#F1D9A8"):
    return ('<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden"><div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; flex-wrap: wrap"><span style="color: #8A94A3">%s</span><span style="flex: 1; min-width: 0"><a href="KnPage.dc.html" style="font-weight: 600; color: #131B27; text-decoration: none">%s</a><span style="display: block; font-size: 11px; color: %s">%s ・ 持ち主 %s ・ %s</span></span>%s</div>'
            '<div style="margin: 0 16px 12px; border: 1px solid %s; background: %s; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; gap: 8px">%s<span style="flex: 1; line-height: 1.7"><b style="font-weight: 500">分身の点検</b><br>%s</span></div>'
            '<div style="display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid #EDF0F4; flex-wrap: wrap; align-items: center">%s</div></div>'
            % (DOCI, t, MUTED, path, owner, interval, LATE(due), bd, tone, icon("AI", NAVY, 22), check_, act))
ver = ('\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + tree("verify")
  + '<section style="flex: 1; min-width: 0; padding: 22px 28px; display: flex; flex-direction: column; gap: 14px; max-width: 980px">'
  + '<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">確かめること</h1><span style="font-size: 12px; color: %s">確かめ期限が来たページ。持ち主が 確かめた／直す／しまう を選ぶ</span></div>' % MUTED
  + '<div style="display: flex; gap: 6px">' + chip("あなたが持ち主 2", True) + chip("すべて 3") + chip("もうすぐ期限 4") + '</div>'
  + vcard("営業の進め方", "営業", "高本（あなた）", "10/31", "90 日ごと",
          "この 3 か月で 19 回読まれ、差し戻しは 0 件。ただし 3. 発注ナビへの応募 の手順は、9 月に発注ナビの画面が変わって EG-127 で止まった。そこだけ直す必要がありそう",
          btn("確かめた（次は 2/2）") + btn("直す", "p", "KnEdit.dc.html") + btn("しまう") + '<span style="margin-left: auto; font-size: 11px; color: %s">分身は 3. の直す案を書ける</span>' % MUTED)
  + vcard("問い合わせの返し方", "営業", "高本（あなた）", "10/12", "90 日ごと",
          "読まれたのは 3 か月で 6 回、最後は 7/11。同じ中身の新しいページ「問い合わせの返し方（2026 年版）」がある（版 2・よく読まれている）",
          btn("確かめた（次は 1/12）") + btn("直す") + btn("しまう（新しいページへつなぐ）", "p") , "#F7F8FA", "#DDE2E9")
  + '<div style="font-size: 12px; color: %s">しまったページは探しても出ず、分身も読まない。版と記録は残り、いつでも戻せる</div>' % MUTED
  + '</section></div>')
shell("KnVerify.dc.html", "ナレッジ 確かめること", [("ナレッジ", "KnHome.dc.html"), ("確かめること", None)], ver)
# ---------- 直す案 ----------
DEL = 'background: #FDECEC; color: #991B1B; text-decoration: line-through'; ADD = 'background: #E6F6EA; color: #166534'
prop = ('\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + tree("prop")
  + '<section style="flex: 1; min-width: 0; padding: 22px 28px; display: flex; flex-direction: column; gap: 14px; max-width: 980px">'
  + '<div style="display: flex; align-items: center; gap: 10px"><h1 style="font-size: 20px; margin: 0">直す案</h1><span style="font-size: 12px; color: %s">チケットが終わったときに分身が出した案。持ち主が確かめるまでページは変わらない</span></div>' % MUTED
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; overflow: hidden">'
  + '<div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #EDF0F4; flex-wrap: wrap">' + icon("AI", NAVY, 26) + '<span style="flex: 1; min-width: 0"><b style="font-weight: 600">請求のルール › 3. 送り方 を直す</b><span style="display: block; font-size: 11px; color: %s">高本のAI ・ <a href="TicketDetail.dc.html">EG-128</a> が完了したとき ・ 11/02 ・ 持ち主：高本（あなた）</span></span></div>' % MUTED
  + '<div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.8"><div style="padding: 2px 8px">PDF をメールに添付して、宛名は先方の経理の担当者、</div><div style="padding: 2px 8px; border-radius: 4px; %s">CC に当社の営業担当を入れる。</div><div style="padding: 2px 8px; border-radius: 4px; %s">CC は取引先のルールで決めた担当を入れる（決まりがなければ当社の営業担当）。</div><div style="padding: 2px 8px">先方の請求書システムへの登録は不要。</div></div>' % (DEL, ADD)
  + '<div style="margin: 0 16px 14px; background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px"><b style="font-weight: 500">分身の理由</b><div style="color: %s; margin-top: 4px">EG-128 では取引先のルール（セイコー様：CC は営業 鈴木様）に合わせて送った。ページのままだと取引先ごとの CC と食い違う。同じことが EG-120 でもあった（2 回目）</div></div>' % MUTED
  + '<div style="display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #EDF0F4; flex-wrap: wrap"><span style="flex: 1; font-size: 12px; color: %s">入れると版 5 で公開され、次から分身はこの書き方で読む</span>%s%s%s</div></div>' % (MUTED, btn("入れない（理由を残す）"), btn("直して入れる", "", "KnEdit.dc.html"), btn("入れる", "p", "KnPage.dc.html"))
  + '<div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 12px 16px; display: flex; gap: 10px; align-items: center">' + icon("AI", NAVY, 26) + '<span style="flex: 1"><b style="font-weight: 600">新しいページ「年末の請求の早め締め」を、請求 の下に作る</b><span style="display: block; font-size: 11px; color: %s">鈴木のAI ・ EG-126 が完了したとき ・ 12 月は 20 日締めになる話が 2 回出た ・ 下書きにしてある</span></span>%s</div>' % (MUTED, btn("下書きを見る", "", "KnEdit.dc.html"))
  + '<div style="font-size: 12px; color: %s">入れなかった案も理由つきで残る（一度きり・もうページにある など）。自分のページの案は確かめずに入り、あとで戻せる</div>' % MUTED
  + '</section></div>')
shell("KnProposal.dc.html", "ナレッジ 直す案", [("ナレッジ", "KnHome.dc.html"), ("直す案", None)], prop)
# ---------- 新しいページ ----------
kind = lambda t, d, on=False: '<label style="flex: 1 1 140px; display: flex; flex-direction: column; gap: 2px; border: 1px solid %s; background: %s; border-radius: 8px; padding: 10px 12px"><b style="font-weight: 500">%s</b><span style="font-size: 11px; color: %s">%s</span></label>' % (NAVY if on else "#DDE2E9", "#F1F3F6" if on else "#FFFFFF", t, MUTED, d)
s = modal(H, mhead("ページを書く", "KnHome.dc.html", "", "下書きで始まる。公開するまでほかの人に知らせは出ない")
  + mbody('<div>' + lab("題名") + field("年末の請求の早め締め") + '</div>'
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("置き場") + field("ワークスペース全体 ▾") + '</div><div>' + lab("親ページ", "（任意）") + field("請求 ▾") + '</div></div>'
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("持ち主", "（正しさに責任を持つ人）") + field(av("高", OWN["高"]) + "&nbsp;高本（自分） ▾") + '</div><div>' + lab("確かめの間隔") + field("90 日ごと ▾") + '</div></div>'
  + '<div>' + lab("形") + '<div style="display: flex; gap: 8px; flex-wrap: wrap">' + kind("手順", "順番にやること", True) + kind("決まり・仕様", "表と箇条書き") + kind("まとめ", "ほかのページを集める") + kind("白紙", "何もない") + '</div></div>'
  + '<div style="display: flex; gap: 8px; align-items: center; background: #F7F8FA; border-radius: 8px; padding: 8px 10px; font-size: 12px">' + check("", True).replace("padding: 4px 0", "padding: 0") + '<span>分身にたたき台を書いてもらう（関わるチケットとやり取りから）</span></div>'
  + '<div style="font-size: 11px; color: %s">ワークスペース全体のページはメンバー以上、グループのページはそのグループのメンバー以上が書いて直せる（閲覧のみは読むだけ）。自分のページは自分だけ</div>' % MUTED)
  + mfoot(btn("やめる", "", "KnHome.dc.html"), btn("下書きで書き始める", "p", "KnEdit.dc.html")), 600, "ページを書く")
save("KnNew.dc.html", "ページを書く", s)

# ---------- つながり（ページの右パネル） ----------
def node(x, y, label, kind, cur=False):
    col = {"page": ("#FFFFFF", "#22345C", "#131B27"), "rule": ("#E3F1EF", "#186F69", "#186F69"), "ticket": ("#EEF0F4", "#8A94A3", "#4A5563"), "client": ("#FCEBD5", "#B45309", "#7A4A05")}[kind]
    w = max(70, len(label) * 12 + 16)
    return '<g><rect x="%d" y="%d" width="%d" height="26" rx="13" fill="%s" stroke="%s" stroke-width="%s"></rect><text x="%d" y="%d" font-size="11" text-anchor="middle" fill="%s" font-family="Noto Sans JP" font-weight="%s">%s</text></g>' % (x - w // 2, y - 13, w, "#22345C" if cur else col[0], col[1], 2 if cur else 1, x, y + 4, "#FFFFFF" if cur else col[2], 700 if cur else 400, label)
E = lambda x1, y1, x2, y2, dash=False: '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#B8C0CC" stroke-width="1.2"%s></line>' % (x1, y1, x2, y2, ' stroke-dasharray="4 3"' if dash else "")
svg = ('<svg viewBox="0 0 320 230" width="100%" style="background: #F7F8FA; border-radius: 10px">'
  + E(160, 115, 76, 40) + E(160, 115, 246, 40) + E(160, 115, 70, 120) + E(160, 115, 256, 120) + E(160, 115, 84, 196) + E(160, 115, 240, 196) + E(246, 40, 256, 120, True)
  + node(76, 40, "経理の月次の流れ", "page") + node(246, 40, "見積の作り方", "page") + node(70, 120, "値引きを書かない", "rule") + node(256, 120, "セイコー様", "client")
  + node(84, 196, "EG-128 ほか 17", "ticket") + node(240, 196, "請求書を作って送る", "rule") + node(160, 115, "請求のルール", "page", True) + '</svg>')
um = lambda t, ctx: '<div style="display: flex; gap: 8px; align-items: flex-start; padding: 8px 0; border-top: 1px solid #EDF0F4; font-size: 12px"><span style="color: #8A94A3">' + DOCI + '</span><span style="flex: 1">%s<span style="display: block; font-size: 11px; color: %s">…%s…</span></span>%s</div>' % (t, MUTED, ctx, btn("つなぐ"))
links = ('<aside aria-label="選んだもの" style="width: 320px; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; display: flex; flex-direction: column">' + ptab("つながり")
  + '<div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px">'
  + '<div style="display: flex; align-items: center"><b style="font-size: 12px; font-weight: 500">このページのまわり</b><span style="margin-left: auto; font-size: 11px; color: %s">1 つ先まで ▾</span></div>' % MUTED + svg
  + '<div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: %s"><span>○ ページ</span><span style="color: #186F69">○ 決まり</span><span style="color: #7A4A05">○ 取引先</span><span>○ チケット</span><span>--- 間接</span></div>' % MUTED
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 10px"><b style="font-size: 12px; font-weight: 500">まだつないでいない言及</b><span style="font-size: 11px; color: %s"> ・ 「請求のルール」と書いてあるがリンクになっていない</span></div>' % MUTED
  + um("経理の月次の流れ", "請求書は請求のルールのとおりに作り、25 日に") + um("問い合わせの返し方（2026 年版）", "支払いの質問には請求のルールの 1. を") + um("自分の段取りメモ", "月初は請求のルールを見ながら")
  + '<div style="font-size: 11px; color: %s">分身も、書くときに [[ でつなげそうな所を教える</div>' % MUTED
  + '</div></aside>')
pl = '\n  <div style="display: flex; flex: 1 0 auto; min-height: 0">' + tree("page") + '<section style="flex: 1; min-width: 0; padding: 22px 28px">' + doc + '</section>' + links + '</div>'
shell("KnLinks.dc.html", "ナレッジ つながり", [("ナレッジ", "KnHome.dc.html"), ("ワークスペース全体", "KnHome.dc.html"), ("請求", "KnHome.dc.html"), ("請求のルール", None)], pl)
# ---------- 取り込む ----------
src = lambda m, bg, t, d, on=False: '<label style="flex: 1 1 150px; display: flex; gap: 10px; align-items: center; border: 1px solid %s; background: %s; border-radius: 8px; padding: 10px 12px">%s<span><b style="font-weight: 500; display: block">%s</b><span style="font-size: 11px; color: %s">%s</span></span></label>' % (NAVY if on else "#DDE2E9", "#F1F3F6" if on else "#FFFFFF", icon(m, bg, 28), t, MUTED, d)
s2 = modal(H, mhead("ほかの所から取り込む", "KnHome.dc.html", "", "今あるメモや Wiki を、そのままナレッジのページにする")
  + mbody('<div style="display: flex; gap: 8px; flex-wrap: wrap">' + src("O", "#6D4AA6", "Obsidian", "保管庫のフォルダ", True) + src("N", "#131B27", "Notion", "書き出した zip") + src("M", "#4A5563", "Markdown", ".md のファイル") + '</div>'
  + '<div style="border: 1px dashed #B8C0CC; border-radius: 10px; padding: 18px; text-align: center; font-size: 13px; color: %s">ここにフォルダを落とす ・ または <a href="#">選ぶ</a></div>' % MUTED
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><b style="font-weight: 500">見つかったもの：営業メモ（Obsidian）</b><span style="color: %s">ページ 38 ・ フォルダ 6 ・ [[リンク]] 112 ・ 話題（#タグ）14 ・ 画像 21</span><span style="color: %s">フォルダはページの木に、[[リンク]] はつながりに、#タグ は話題に、上の項目（properties）は持ち主・話題に読み替える</span></div>' % (MUTED, MUTED)
  + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("置き場") + field("営業 ▾") + '</div><div>' + lab("状態") + field("下書きで入れる ▾") + '</div></div>'
  + '<div style="font-size: 11px; color: %s">下書きで入れると、持ち主が確かめて公開するまで分身は読まない。ナレッジのページはいつでも Markdown で書き出せる</div>' % MUTED)
  + mfoot(btn("やめる", "", "KnHome.dc.html"), btn("38 ページを取り込む", "p", "KnHome.dc.html")), 620, "取り込む")
save("KnImport.dc.html", "ほかの所から取り込む", s2)

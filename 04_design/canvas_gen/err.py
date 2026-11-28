import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
MAIN = open(P + "Main.dc.html", encoding="utf-8").read()
i0 = MAIN.index("<div data-shell"); i1 = MAIN.index("</x-dc>")
LOGO = '<div style="display: flex; align-items: center; gap: 10px; justify-content: center"><span style="width: 36px; height: 36px; border-radius: 10px; background: #22345C; color: #FFFFFF; display: grid; place-items: center; font-weight: 700; font-size: 18px">K</span><b style="font-size: 20px">Kaname</b></div>'
def bare(name, title, inner):
    page = ('<div data-shell style="min-height: 100vh; background: #F2F4F7; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; box-sizing: border-box; gap: 18px">' + LOGO
      + '<div style="width: 100%; max-width: 480px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 14px; padding: 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; text-align: center; align-items: center">' + inner + '</div>'
      + '<div style="font-size: 11px; color: %s"><a href="#" style="color: %s">いまの様子</a> ・ <a href="#" style="color: %s">困ったとき</a></div></div>\n' % (MUTED, MUTED, MUTED))
    save(name, title, MAIN[:i0] + page + MAIN[i1:])
def inapp(name, title, inner):
    he = MAIN.index("</header>", MAIN.index("<header", MAIN.index('class="kn-bar"'))) + 9
    mend = MAIN.rindex("</main>")
    s = MAIN[:he] + '\n  <div style="flex: 1 0 auto; display: grid; place-items: center; padding: 40px 24px"><div style="max-width: 520px; display: flex; flex-direction: column; gap: 14px; text-align: center; align-items: center">' + inner + '</div></div>\n ' + MAIN[mend:]
    save(name, title, s)
code = lambda c: '<div style="font-size: 11px; color: #8A94A3">%s</div>' % c
T = lambda t: '<b style="font-size: 20px">%s</b>' % t
D = lambda t: '<div style="font-size: 13px; color: %s; line-height: 1.8">%s</div>' % (MUTED, t)
row = lambda *b: '<div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center">%s</div>' % "".join(b)
inapp("ErrNotFound.dc.html", "見つからない", icon("?", "#8A94A3", 52) + T("見つかりませんでした") + D("このチケットは消されたか、見る権限が無いかもしれません。番号は別のグループへ移っても変わりません") + row(btn("自分に関わるものへ", "p", "Main.dc.html"), btn("探す")) + '<div style="font-size: 12px; color: %s">消したチケットは 30 日のあいだ、管理者が戻せる</div>' % MUTED + code("番号：EG-099 ・ 404"))
inapp("ErrNoAccess.dc.html", "権限がない", icon("鍵", "#B45309", 52) + T("この画面を見る権限がありません") + D("経理グループのチケットです。見る必要があれば、グループのマネージャーに頼めます。頼んだことは相手に知らせ、記録に残ります") + '<div style="width: 100%; max-width: 420px; text-align: left">' + field("見たい理由（任意）：請求書の宛名を確かめたい", True) + '</div>' + row(btn("マネージャー（田中さん）に頼む", "p"), btn("戻る", "", "Main.dc.html")) + code("KR-031 ・ 403"))
bare("ErrSession.dc.html", "ログインが切れた", icon("時", "#2F4B7C", 48) + T("ログインが切れました") + D("安全のため、しばらく操作がなかったのでログアウトしました（12 時間）。書きかけのものはこの PC に残っています。入り直すと続きから書けます") + '<a href="AuthLogin.dc.html" style="width: 100%; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; text-decoration: none; background: #22345C; color: #FFFFFF; font-weight: 500">パスキーで入り直す</a>' + '<div style="font-size: 12px; color: %s">場所や端末が急に変わったときも、入り直してもらうことがある</div>' % MUTED)
bare("ErrLinkExpired.dc.html", "リンクの期限切れ", icon("期", "#B45309", 48) + T("このリンクは使えなくなりました") + D("招待のリンクは 7 日、パスワードの作り直しは 30 分で切れます。もう一度使ったリンクも使えません") + '<div style="width: 100%; display: flex; flex-direction: column; gap: 8px">' + btn("招待した人（高本さん）に送り直してもらう", "p") + btn("パスワードの作り直しをもう一度", "", "AuthReset.dc.html") + '</div>' + code("招待 ・ 11/01 に送った ・ 11/08 に切れた"))
bare("ErrMaintenance.dc.html", "メンテナンス中", icon("工", "#22345C", 48) + T("いまメンテナンス中です") + D("11/10（月）2:00〜3:00 の予定です。終わると自動でこの画面が切り替わります") + '<div style="width: 100%; background: #F7F8FA; border-radius: 10px; padding: 12px 14px; font-size: 12px; text-align: left; line-height: 1.8"><b style="font-weight: 600">分身の作業は</b><br>・ 実行中のものは、メンテナンスの前に区切りまで進めて止めた<br>・ 承認したものは「実行待ち」になり、終わってから動く<br>・ 書きかけはこの PC に残っている</div>' + '<div style="font-size: 12px; color: %s">お知らせは 11/03 に出しました</div>' % MUTED)
bare("ErrDown.dc.html", "Kaname の調子が悪い", icon("!", "#B91C1C", 48) + T("Kaname の調子が悪くなっています") + D("ご迷惑をおかけしています。運営が直しています。あなたの操作や PC の問題ではありません") + '<div style="width: 100%; border: 1px solid #F3C7C7; background: #FDF3F3; border-radius: 10px; padding: 12px 14px; font-size: 12px; text-align: left; line-height: 1.8"><b style="font-weight: 600; color: #991B1B">いまの様子（10:42 更新）</b><br>チケットの保存が遅くなっている。読むことはできる。分身の実行は止めている（承認したものは直ったら順に動く）</div>' + row(btn("もう一度", "p"), btn("いまの様子を見る")) + code("10:38 から ・ 障害の番号 INC-2611-03"))

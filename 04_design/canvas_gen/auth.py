import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
MAIN = open(P + "Main.dc.html", encoding="utf-8").read()
i0 = MAIN.index("<div data-shell"); i1 = MAIN.index("</x-dc>")
LOGO = '<div style="display: flex; align-items: center; gap: 10px; justify-content: center"><span style="width: 36px; height: 36px; border-radius: 10px; background: #22345C; color: #FFFFFF; display: grid; place-items: center; font-weight: 700; font-size: 18px">K</span><b style="font-size: 20px; letter-spacing: .02em">Kaname</b></div>'
def authpage(name, title, inner, w=420):
    page = ('<div data-shell style="min-height: 100vh; background: #F2F4F7; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; box-sizing: border-box; gap: 18px">'
      + LOGO + '<div style="width: 100%%; max-width: %dpx; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 14px; padding: 26px 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">' % w + inner + '</div>'
      + '<div style="font-size: 11px; color: %s; display: flex; gap: 12px"><a href="#" style="color: %s">利用規約</a><a href="#" style="color: %s">プライバシー</a><a href="#" style="color: %s">困ったとき</a></div></div>\n' % (MUTED, MUTED, MUTED, MUTED))
    save(name, title, MAIN[:i0] + page + MAIN[i1:])
big = lambda t, kind="p", href="#": '<a href="%s" style="height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 14px; font-weight: 500; %s">%s</a>' % (href, "background: #22345C; color: #FFFFFF" if kind == "p" else "border: 1px solid #DDE2E9; background: #FFFFFF; color: #131B27", t)
inp = lambda ph, v="", focus=False, typ="text": '<input type="%s" placeholder="%s" value="%s" style="width: 100%%; box-sizing: border-box; height: 42px; border: 1px solid %s; %s border-radius: 8px; padding: 0 12px; font-family: inherit; font-size: 14px">' % (typ, ph, v, "#22345C" if focus else "#DDE2E9", "box-shadow: 0 0 0 2px #DCE4F2;" if focus else "")
FP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11c0 3-1 6-3 8M8 7a5 5 0 0 1 9 3c0 4-1 7-3 10M5 10a7 7 0 0 1 2-4M19 14c-.2 2-.8 4-1.6 6"></path></svg>'
boxes = lambda code, n=6: '<div style="display: flex; gap: 8px; justify-content: center">' + "".join('<span style="width: 44px; height: 52px; border: 1px solid %s; %s border-radius: 8px; display: grid; place-items: center; font-size: 22px; font-weight: 700">%s</span>' % ("#22345C" if i == len(code) else "#DDE2E9", "box-shadow: 0 0 0 2px #DCE4F2;" if i == len(code) else "", code[i] if i < len(code) else "") for i in range(n)) + '</div>'
# 1 ログイン
authpage("AuthLogin.dc.html", "ログイン",
  '<b style="font-size: 18px; text-align: center">ログイン</b>'
  + big(FP + "パスキーで入る", "p", "Main.dc.html")
  + '<div style="font-size: 11px; color: %s; text-align: center; margin-top: -6px">指・顔・PC のロックで入る。いちばん安全で速い ・ この PC にパスキーが無いときは <a href="AuthQR.dc.html">スマホで QR を読み取る</a></div>' % MUTED
  + '<div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: %s"><span style="flex: 1; border-top: 1px solid #EDF0F4"></span>またはメールとパスワード<span style="flex: 1; border-top: 1px solid #EDF0F4"></span></div>' % MUTED
  + inp("メール", "takamoto@engine-base.example") + inp("パスワード", "••••••••••••••", True, "password")
  + big("次へ", "s", "Auth2FA.dc.html")
  + '<div style="display: flex; justify-content: space-between; font-size: 12px"><a href="AuthReset.dc.html">パスワードを忘れた</a><a href="AuthRecover.dc.html">端末をなくした</a></div>'
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 12px; font-size: 12px; text-align: center">はじめての方は <a href="AuthSignup.dc.html">アカウントを作る</a></div>')
# 2 2段階のコード
authpage("Auth2FA.dc.html", "2 段階認証",
  '<b style="font-size: 18px; text-align: center">確認のコード</b>'
  + '<div style="font-size: 13px; color: %s; text-align: center; line-height: 1.7">2 段階認証を付けているので、認証アプリ（Google Authenticator・1Password など）に出ている 6 けたの数字を入れてください</div>' % MUTED
  + boxes("4829")
  + '<div style="font-size: 11px; color: %s; text-align: center">数字は 30 秒ごとに変わる ・ 6 つそろうと自動で進む</div>' % MUTED
  + big("入る", "p", "Main.dc.html")
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; text-align: center"><a href="AuthRecover.dc.html">認証アプリが使えない</a><span style="color: %s">この画面は 2 段階認証を付けている人だけに出る</span></div>' % MUTED)
# 3 端末をなくした
opt = lambda ic, t, d, href: '<a href="%s" style="display: flex; gap: 12px; align-items: flex-start; border: 1px solid #DDE2E9; border-radius: 10px; padding: 12px 14px; text-decoration: none; color: #131B27">%s<span style="flex: 1"><b style="font-weight: 600; display: block">%s</b><span style="font-size: 12px; color: %s; line-height: 1.6">%s</span></span><span style="color: #8A94A3">›</span></a>' % (href, icon(ic, NAVY, 30), t, MUTED, d)
authpage("AuthRecover.dc.html", "端末をなくしたとき",
  '<a href="AuthLogin.dc.html" style="font-size: 12px">← ログインに戻る</a><b style="font-size: 18px">端末をなくしたとき</b>'
  + '<div style="font-size: 13px; color: %s; line-height: 1.7">パスキーの端末や認証アプリが使えないときは、次のどちらかで入れます。SMS では入れません（乗っ取りに弱いため）。</div>' % MUTED
  + opt("鍵", "バックアップコードで入る", "2 段階認証を付けたときに保存した 10 個のコードのうち 1 つを入れる。1 つは 1 回だけ使える", "#")
  + '<div style="display: flex; gap: 8px; margin-top: -4px">' + inp("例：7KQM-2XPA") + '</div>'
  + opt("管", "ワークスペースの管理者に再設定を頼む", "管理者が本人であることを確かめて、入り方を作り直す。頼んだこと・作り直したことは記録に残る", "#")
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.7">入れたら、すぐに新しいパスキーを付け、なくした端末を「ログインと安全」から取り消してください。なくした端末の分身の作業は止まります</div>', 460)

# 4 2段階認証を付ける（MeLogin の上の小窓）
ML = open(P + "MeLogin.dc.html", encoding="utf-8").read()
step = lambda n, t, d, st: '<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #EDF0F4"><span style="width: 26px; height: 26px; flex: none; border-radius: 99px; display: grid; place-items: center; font-size: 12px; font-weight: 700; %s">%s</span><div style="flex: 1; min-width: 0"><b style="font-weight: 600">%s</b><div style="font-size: 12px; color: %s; margin-top: 4px; line-height: 1.7">%s</div></div></div>' % ({"done": "background: #166534; color: #FFFFFF", "now": "background: #22345C; color: #FFFFFF", "next": "background: #EEF0F4; color: #4A5563"}[st], "✓" if st == "done" else n, t, MUTED, d)
qr = '<svg width="120" height="120" viewBox="0 0 21 21" style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 8px; padding: 6px">' + "".join('<rect x="%d" y="%d" width="1" height="1" fill="#131B27"></rect>' % (x, y) for y in range(21) for x in range(21) if ((x * 7 + y * 13 + x * y) % 5 < 2) or (x < 7 and y < 7 and (x in (0, 6) or y in (0, 6) or (1 < x < 5 and 1 < y < 5))) or (x > 13 and y < 7 and (x in (14, 20) or y in (0, 6) or (15 < x < 19 and 1 < y < 5))) or (x < 7 and y > 13 and (x in (0, 6) or y in (14, 20) or (1 < x < 5 and 15 < y < 19)))) + '</svg>'
s = modal(ML, mhead("パスワードと 2 段階認証を付ける", "MeLogin.dc.html", "", "パスワードで入るときに要る。パスキーで入るときは要らない")
  + mbody(step("1", "本人確認", "パスキーで確かめました（11:24）", "done")
  + step("2", "パスワードを決める", '12 文字以上 ・ 漏れたことのあるパスワードは使えない<div style="margin-top: 6px">' + inp("新しいパスワード", "•••••••••••••••", False, "password") + '</div><span style="color: #166534">✓ 強さ：十分（16 文字）</span>', "done")
  + step("3", "認証アプリで読み取る", '<div style="display: flex; gap: 14px; align-items: center; margin-top: 6px; flex-wrap: wrap">' + qr + '<div style="font-size: 12px; line-height: 1.8">Google Authenticator・1Password などで読み取る<br>読み取れないときは手で入れる：<br><code style="font-size: 13px; background: #F2F4F7; border-radius: 4px; padding: 2px 6px">JBSW Y3DP EHPK 3PXP</code> <a href="#" style="font-size: 11px">写す</a></div></div>', "now")
  + step("4", "アプリに出た 6 けたを入れる", boxes("51") + '<div style="font-size: 11px; color: %s; margin-top: 6px; text-align: center">合っていれば、次にバックアップコードが出る</div>' % MUTED, "next"))
  + mfoot(btn("やめる", "", "MeLogin.dc.html"), btn("確かめる", "p", "MeBackup.dc.html")), 600, "2 段階認証を付ける")
save("MeTotp.dc.html", "2 段階認証を付ける", s)
# 5 バックアップコード
codes = ["7KQM-2XPA", "Q9RT-6LMV", "H2DW-8NCE", "P5XB-3JFU", "M8ZK-1TQS", "C4VN-7HRY", "W6GE-9PLD", "T3JA-5BXK", "R1UF-4MWZ", "E7LC-2YQN"]
s = modal(ML, mhead("バックアップコード", "MeLogin.dc.html", icon("鍵", NAVY, 28), "端末をなくしたときに入るためのコード。いまだけ表示する")
  + mbody('<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: #F7F8FA; border-radius: 10px; padding: 14px">' + "".join('<code style="font-size: 15px; letter-spacing: .06em; text-align: center; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 6px; padding: 6px">%s</code>' % c for c in codes) + '</div>'
  + '<div style="display: flex; gap: 8px; justify-content: center">' + btn("ダウンロード（.txt）") + btn("写す") + btn("印刷") + '</div>'
  + '<div style="border: 1px solid #F1D9A8; background: #FFF8EE; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.7"><b style="font-weight: 500; color: #7A4A05">この画面を閉じると、二度と表示されません</b><br>パスワード管理アプリか、紙に書いて安全な所にしまってください。1 つは 1 回だけ使えます。足りなくなったら作り直せます（前のコードは使えなくなる）</div>'
  + check("コードを安全な所に保存した", True))
  + mfoot(btn("2 段階認証を付けて閉じる", "p", "MeLogin.dc.html")), 520, "バックアップコード")
save("MeBackup.dc.html", "バックアップコード", s)

# 6 スマホで QR を読み取って入る
st = lambda n, t: '<div style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px"><b style="width: 22px; height: 22px; flex: none; border-radius: 99px; background: #EEF3FD; color: #22345C; display: grid; place-items: center; font-size: 11px">%s</b><span style="line-height: 1.6">%s</span></div>' % (n, t)
authpage("AuthQR.dc.html", "スマホで入る",
  '<a href="AuthLogin.dc.html" style="font-size: 12px">← ログインに戻る</a><b style="font-size: 18px; text-align: center">スマホのパスキーで入る</b>'
  + '<div style="display: flex; justify-content: center">' + qr.replace('width="120" height="120"', 'width="180" height="180"') + '</div>'
  + st("1", "スマホのカメラでこの QR を読み取る") + st("2", "スマホに「Kaname にログイン」と出たら、指か顔で確かめる") + st("3", "この PC がログインした状態になる")
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: %s; line-height: 1.7">スマホと PC が近くにある必要がある（Bluetooth で近さを確かめる）。離れた所の人に QR を送っても入れないので、だまし取られにくい ・ QR は 2 分で変わる</div>' % MUTED
  + '<div style="font-size: 12px; text-align: center; color: %s"><span style="width: 8px; height: 8px; border-radius: 99px; background: #B45309; display: inline-block; margin-right: 6px"></span>スマホからの返事を待っています…</div>' % MUTED, 440)
# 7 この PC にもパスキーを付ける？
authpage("AuthAddPasskey.dc.html", "この PC にもパスキーを付ける",
  '<div style="display: flex; justify-content: center">' + icon("✓", "#166534", 40) + '</div><b style="font-size: 18px; text-align: center">入れました</b>'
  + '<div style="font-size: 13px; color: %s; text-align: center; line-height: 1.7">この PC にもパスキーを付けると、次からはスマホを使わずに、この PC の指紋・顔・ロックだけで入れます</div>' % MUTED
  + big(FP + "この PC にパスキーを付ける", "p", "Main.dc.html") + big("今回はしない", "s", "Main.dc.html")
  + '<div style="font-size: 11px; color: %s; text-align: center">人と共用の PC なら付けないでください ・ あとから 自分の設定 › ログインと安全 でも付けられる</div>' % MUTED)

# 8 2段階認証を付ける（パスワードなし・任意）
ML = open(P + "MeLogin.dc.html", encoding="utf-8").read()
s = modal(ML, mhead("2 段階認証を付ける", "MeLogin.dc.html", "", "付けると、入るたびに認証アプリの 6 けたも打つ。いつでも外せる")
  + mbody(step("1", "本人確認", "パスキーで確かめました（11:30）", "done")
  + step("2", "認証アプリで QR を読み取る（この 1 回だけ）", '<div style="display: flex; gap: 14px; align-items: center; margin-top: 6px; flex-wrap: wrap">' + qr + '<div style="font-size: 12px; line-height: 1.8">Google Authenticator・1Password などで読み取る<br>読み取ると、アプリにこのアカウントが入る<br>読み取れないときは手で入れる：<br><code style="font-size: 13px; background: #F2F4F7; border-radius: 4px; padding: 2px 6px">JBSW Y3DP EHPK 3PXP</code></div></div>', "now")
  + step("3", "アプリに出た 6 けたを入れる", boxes("") + '<div style="font-size: 11px; color: %s; margin-top: 6px; text-align: center">合っていれば、バックアップコードが出て、付け終わる</div>' % MUTED, "next")
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.7">付けたあとは、パスキーで入るときも 6 けたを打つ。スマホをなくしたらバックアップコードで入る</div>')
  + mfoot(btn("やめる", "", "MeLogin.dc.html"), btn("確かめる", "p", "MeBackup.dc.html")), 600, "2 段階認証を付ける")
save("Me2FA.dc.html", "2 段階認証を付ける", s)

# ===== はじめての登録・忘れた・招待 =====
authpage("AuthSignup.dc.html", "アカウントを作る",
  '<b style="font-size: 18px; text-align: center">アカウントを作る</b>'
  + '<div style="font-size: 12px; color: %s; text-align: center; margin-top: -6px">登録したらすぐ使い始められる。設定の段はない</div>' % MUTED
  + '<div>' + lab("メール") + inp("you@example.com", "takamoto@engine-base.example") + '</div>'
  + '<div>' + lab("名前") + inp("例：高本 聖斗", "高本 聖斗") + '</div>'
  + '<div>' + lab("会社・チームの名前", "（空なら、あなたの名前で個人のワークスペースになる。あとで人を招ける）") + inp("例：株式会社ENGINE BASE", "株式会社ENGINE BASE", True) + '</div>'
  + big("次へ（メールを確かめる）", "p", "AuthVerify.dc.html")
  + '<div style="font-size: 11px; color: %s; text-align: center">続けると <a href="#">利用規約</a> と <a href="#">プライバシー</a> に同意したことになる</div>' % MUTED
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 12px; font-size: 12px; text-align: center">アカウントがある方は <a href="AuthLogin.dc.html">ログイン</a></div>', 440)
authpage("AuthVerify.dc.html", "メールを確かめる",
  '<a href="AuthSignup.dc.html" style="font-size: 12px">← 戻る</a><b style="font-size: 18px; text-align: center">メールを確かめる</b>'
  + '<div style="font-size: 13px; color: %s; text-align: center; line-height: 1.7">takamoto@engine-base.example に 6 けたの数字を送りました。10 分のあいだ使えます</div>' % MUTED
  + boxes("38")
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 14px; display: flex; flex-direction: column; gap: 10px"><b style="font-size: 14px">入り方を決める</b>'
  + big(FP + "パスキーを作る（おすすめ）", "p", "OnHome.dc.html")
  + '<div style="font-size: 11px; color: %s; text-align: center; margin-top: -4px">この PC の指紋・顔・ロックで入る。パスワードは要らない</div>' % MUTED
  + big("パスワードにする", "s", "MeTotp.dc.html") + '<div style="font-size: 11px; color: %s; text-align: center; margin-top: -4px">パスワードだけで入るなら、2 段階認証も一緒に付ける</div></div>' % MUTED
  + '<div style="font-size: 12px; text-align: center"><a href="#">メールが届かない</a>（迷惑メール・アドレスの打ち間違いを確かめる・送り直す）</div>', 440)
authpage("AuthReset.dc.html", "パスワードを忘れた",
  '<a href="AuthLogin.dc.html" style="font-size: 12px">← ログインに戻る</a><b style="font-size: 18px">パスワードを作り直す</b>'
  + '<div style="display: flex; gap: 10px; align-items: flex-start; background: #F1FAF4; border: 1px solid #CDE8D5; border-radius: 8px; padding: 10px 12px; font-size: 13px">' + icon("✓", "#166534", 22) + '<span style="line-height: 1.7">登録されていれば、takamoto@engine-base.example に作り直しのリンクを送りました。30 分のあいだ、1 回だけ使えます</span></div>'
  + '<div style="font-size: 12px; color: %s; line-height: 1.7">・ 届いたリンクを開くと、新しいパスワードを決められる<br>・ 2 段階認証を付けている人は、作り直したあとも 6 けたが要る<br>・ 作り直すと、ほかの端末はすべてログアウトする</div>' % MUTED
  + '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px">パスキーがあるなら、パスワードを作り直さなくても <a href="AuthLogin.dc.html">パスキーで入れる</a></div>'
  + '<div style="font-size: 12px; text-align: center"><a href="#">もう一度送る</a>（1 分あとから）</div>', 440)
authpage("AuthInvite.dc.html", "招待されて入る",
  '<div style="display: flex; justify-content: center">' + icon("E", NAVY, 44) + '</div>'
  + '<b style="font-size: 18px; text-align: center">株式会社ENGINE BASE に招待されています</b>'
  + '<div style="font-size: 13px; color: %s; text-align: center; line-height: 1.7">高本 聖斗 さんから ・ 経理グループの メンバー として<br>「経理の月次をいっしょに回してもらいます。よろしくお願いします」</div>' % MUTED
  + '<div>' + lab("メール") + inp("", "kimura@engine-base.example").replace("<input ", "<input readonly ") + '</div>'
  + '<div>' + lab("名前") + inp("例：木村 太郎", "木村 優", True) + '</div>'
  + big(FP + "パスキーを作って入る", "p", "OnHome.dc.html") + big("パスワードにする", "s", "MeTotp.dc.html")
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 12px; font-size: 12px; text-align: center; line-height: 1.7">もう Kaname のアカウントがある方は <a href="AuthLogin.dc.html">ログインして入る</a><br><span style="color: %s">招待は 11/08 まで ・ 心当たりがなければ、このページを閉じる</span></div>' % MUTED, 460)

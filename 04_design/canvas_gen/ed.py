import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
def L(n): return open(P + n + ".dc.html", encoding="utf-8").read()
def av(c, bg, n=24): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 99px; background: %s; color: #FFFFFF; font-size: 10px; display: grid; place-items: center">%s</span>' % (n, n, bg, c)
def radio(t, d, on=False):
    return '<label style="flex: 1 1 160px; display: flex; gap: 8px; align-items: flex-start; border: 1px solid %s; background: %s; border-radius: 8px; padding: 9px 11px"><span style="width: 14px; height: 14px; margin-top: 3px; border-radius: 99px; border: %s; box-sizing: border-box; flex: none"></span><span><b style="font-weight: 500; display: block">%s</b><span style="font-size: 11px; color: %s">%s</span></span></label>' % (((NAVY, "#F1F3F6", "4px solid #22345C") if on else ("#DDE2E9", "#FFFFFF", "1px solid #B8C0CC")) + (t, MUTED, d))
NOTE = lambda t: '<div style="background: #F7F8FA; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.7">%s</div>' % t
OKB = lambda t: '<div style="display: flex; gap: 8px; align-items: center; border: 1px solid #CDE8D5; background: #F1FAF4; border-radius: 8px; padding: 8px 10px; font-size: 12px"><b style="color: #166534">✓</b><span>%s</span></div>' % t
WARNB = lambda t: '<div style="display: flex; gap: 8px; align-items: flex-start; border: 1px solid #F1D9A8; background: #FFF8EE; border-radius: 8px; padding: 8px 10px; font-size: 12px"><b style="color: #7A4A05">!</b><span>%s</span></div>' % t

def main():
    # 1 守ることを直す
    s = modal(L("RoomKnows"), mhead("守ることを直す", "RoomKnows.dc.html", icon("宛", "#186F69", 28), "取引先：セイコー ・ 版 2 ・ 10/28 高本が作った ・ 3 回効いた")
      + mbody('<div>' + lab("守ること") + '<textarea style="width: 100%; box-sizing: border-box; min-height: 60px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px">宛名は経理部 山田様、CC に営業の鈴木様と、1 月からは経理部 佐野様も入れる</textarea></div>'
      + '<div>' + lab("どこで効かせる") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("自分の仕事すべて", "どのチケットでも") + radio("取引先", "セイコー株式会社", True) + radio("種別", "請求・見積など") + '</div></div>'
      + '<div>' + lab("分身の点検") + OKB("ほかの守ることとぶつからない") + '<div style="height: 6px"></div>' + WARNB("取引先の人に「佐野 様」がまだいない。先方の人に足すと、宛先に使える（<a href=\"CuShare.dc.html\">先方の人へ</a>）") + '</div>'
      + NOTE("直すと版 3 になり、これから分身が読むものから効く。前の版は「効いた記録」から見られる"))
      + mfoot(btn("消す", "d"), btn("止める（一時的に効かせない）"), btn("やめる", "", "RoomKnows.dc.html"), btn("直す", "p", "RoomKnows.dc.html")), 600, "守ることを直す")
    save("EdRule.dc.html", "守ることを直す", s)

    # 2 覚えていることを直す（右のパネルでそのまま直す）
    s = L("RoomMemory")
    a = s.index('<div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px 12px">メールの書き出しは')
    b = s.index("</div>", a) + 6
    s = s[:a] + '<div><textarea style="width: 100%; box-sizing: border-box; min-height: 70px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px">メールの書き出しは「お世話になっております」。社外の初めての相手には「はじめてご連絡いたします」</textarea><div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px">' + btn("やめる", "", "RoomMemory.dc.html") + btn("直す", "p", "RoomMemory.dc.html") + '</div><div style="font-size: 11px; color: %s; margin-top: 4px">直したら、分身は次から新しい書き方で覚えている</div></div>' % MUTED + s[b:]
    save("EdMemory.dc.html", "覚えていることを直す", s)

    # 3 取引先を足す
    s = modal(L("CuList"), mhead("取引先を足す", "CuList.dc.html")
      + mbody('<div>' + lab("取引先の名前") + field("株式会社ハルカ") + '</div>'
      + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("担当") + field(av("高", "#6B5B99", 20) + " 高本（自分） ▾") + '</div><div>' + lab("担当グループ", "（いくつでも）") + '<div style="border: 1px solid #DDE2E9; border-radius: 6px; min-height: 34px; padding: 4px 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap">' + pill("営業 ×", "#E3F1EF", "#186F69") + '<span style="font-size: 12px; color: #4A5563">＋</span></div></div></div>'
      + '<div>' + lab("社内で見える人") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("ワークスペースの全員", "ワークスペースの既定", True) + radio("担当グループの人だけ", "鍵のしるしが付く") + '</div></div>'
      + '<div>' + lab("先方のメールのドメイン", "（任意）") + field("haruka.example") + '<div style="font-size: 11px; color: %s; margin-top: 4px">先方の人を足すとき、このドメインのメールならこの取引先に当てる。分身がチケットやメールを読むときも取引先の案を出す（Kaname がメールを受け取るわけではない）</div></div>' % MUTED
      + '<div style="display: flex; gap: 8px; align-items: center; background: #F3F6FC; border: 1px solid #C9D6EE; border-radius: 8px; padding: 8px 10px; font-size: 12px">' + icon("AI", NAVY, 22) + '<span>分身の案：これまでのチケットに「ハルカ」が 2 件ある（EG-088・EG-101）。この取引先につなぐ</span>' + check("", True).replace("padding: 4px 0", "padding: 0") + '</div>')
      + mfoot(btn("やめる", "", "CuList.dc.html"), btn("足して先方の人を招く", "", "EdContact.dc.html"), btn("足す", "p", "CuPage.dc.html")), 600, "取引先を足す")
    save("EdClient.dc.html", "取引先を足す", s)

    # 4 先方の人を招く・直す
    s = modal(L("CuShare"), mhead("先方の人を招く", "CuShare.dc.html", "", "セイコー株式会社 ・ 招いた人は「クライアントの場所」に入れる")
      + mbody('<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><div>' + lab("名前") + field("佐野 恵 様") + '</div><div>' + lab("部署") + field("経理部") + '</div></div>'
      + '<div>' + lab("メール") + field("sano@seiko.example") + '</div>'
      + '<div>' + lab("役割") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("依頼できる", "依頼を出し、見せた仕事と成果物を見て、検収に答える", True) + radio("見るだけ", "見せた仕事を見るだけ") + '</div></div>'
      + '<div>' + lab("分身が宛先に使うとき", "（取引先の決まりにつながる）") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + chip("請求の宛先", True) + chip("CC") + chip("使わない") + '</div></div>'
      + '<div style="display: flex; flex-direction: column">' + check("招待のメールを送る（7 日で切れる）", True) + check("いまは招かず、宛先としてだけ登録する", False, "クライアントの場所には入れない") + '</div>'
      + NOTE("同じ取引先の人は互いの依頼が見える。社内のチケットやメモは見えない"))
      + mfoot(btn("やめる", "", "CuShare.dc.html"), btn("招く", "p", "CuShare.dc.html")), 580, "先方の人を招く")
    save("EdContact.dc.html", "先方の人を招く", s)

    # 5 メンバーの ⋯
    W = L("WsPeople")
    mi = lambda t, sub="", href="#", danger=False: '<a href="%s" style="display: flex; flex-direction: column; padding: 7px 10px; border-radius: 6px; text-decoration: none; color: %s">%s%s</a>' % (href, "#B91C1C" if danger else "#131B27", t, '<span style="font-size: 11px; color: %s">%s</span>' % (MUTED, sub) if sub else "")
    menu = ('<div style="padding: 4px 10px 8px; font-size: 12px; color: %s">鈴木 一郎</div>' % MUTED + mi("役割を変える", "いま：メンバー") + mi("グループを移す", "いま：営業") + mi("兼ねるグループを足す") + mi("担当しているチケットを見る", "4 件", "List.dc.html")
      + SEP + mi("一時的に止める", "入れなくなる・分身も止まる。担当はそのまま") + mi("ワークスペースから外す", "担当の引き継ぎ先を選ぶ", "EdMemberRemove.dc.html", True))
    dots = [m.start() for m in re.finditer(r'<span style="color: #8A94A3; width: 16px; text-align: center">⋯</span>', W)]
    Lx = len('<span style="color: #8A94A3; width: 16px; text-align: center">⋯</span>')
    W2 = W[:dots[2]] + '<span style="color: #22345C; width: 16px; text-align: center; background: #DCE4F2; border-radius: 4px">⋯</span>' + W[dots[2] + Lx:]
    W2 = float_pop(W2, menu, "top: 242px; right: 36px; width: 270px")
    save("EdMemberMenu.dc.html", "メンバーの操作", W2)
    tk = lambda key, t, st: '<div style="display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid #EDF0F4; font-size: 13px"><span style="color: #22345C; width: 56px; font-size: 12px">%s</span><span style="flex: 1">%s</span>%s<span style="border: 1px solid #DDE2E9; border-radius: 6px; padding: 2px 8px; font-size: 12px; display: inline-flex; gap: 4px; align-items: center">%s ▾</span></div>' % (key, t, pill(st), av("佐", "#186F69", 18) + " 佐藤")
    s = modal(W, mhead("鈴木 一郎 さんをワークスペースから外す", "WsPeople.dc.html", icon("!", "#B91C1C", 28), "外すと入れなくなり、鈴木のAI も止まる")
      + mbody('<div>' + lab("担当しているチケット 4 件の引き継ぎ先") + '<div style="display: flex; gap: 6px; margin-bottom: 6px">' + chip("全部を同じ人に", True) + chip("1 件ずつ決める") + '</div>'
      + tk("EG-126", "セイコー様 更新の見積", "確認中") + tk("EG-129", "契約書の更新版を送る", "未着手") + tk("EG-131", "セイコー様 来期の提案", "作業中") + tk("EG-119", "問い合わせ（山田様）に一次返信", "渡し中") + '</div>'
      + WARNB("渡し中の EG-119 は、外す前に取り消される（佐藤 さんへの渡しは成り立っていない）")
      + NOTE("<b>すぐ消える（戻せない）</b>：鈴木 さんの個人の記憶・会話・預けたログイン情報・PC の接続・出した招待<br><b>残る</b>：書いたやり取り・決定ログ・作った成果物・ワークスペースや層の記憶（名前はそのまま出る）")
      + NOTE("外したことは記録に残る。30 日のあいだは同じメールで招き直すと、グループと役割だけ戻る"))
      + mfoot(btn("やめる", "", "WsPeople.dc.html"), '<a href="WsPeople.dc.html" style="height: 30px; border-radius: 6px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; text-decoration: none; background: #B91C1C; color: #FFFFFF">本人確認して外す</a>'), 620, "メンバーを外す")
    save("EdMemberRemove.dc.html", "メンバーを外す", s)

    # 6 グループを足す
    s = modal(W, mhead("グループを足す", "WsPeople.dc.html", "", "グループは日々のチケットの置き場。チケットの番号の頭になる")
      + mbody('<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px"><div>' + lab("名前") + field("カスタマーサポート") + '</div><div>' + lab("短い名前", "（番号の頭）") + field("CS") + '<div style="font-size: 11px; color: %s; margin-top: 4px">CS-1、CS-2 …</div></div></div>' % MUTED
      + '<div>' + lab("層") + field("営業 ▾") + '<div style="font-size: 11px; color: %s; margin-top: 4px">層の守ること・やり方・承認の決まりが、このグループにも効く</div></div>' % MUTED
      + '<div>' + lab("マネージャー") + field(av("佐", "#186F69", 20) + " 佐藤 花子 ▾") + '</div>'
      + '<div>' + lab("メンバー") + '<div style="border: 1px solid #DDE2E9; border-radius: 6px; padding: 6px 8px; display: flex; gap: 4px; flex-wrap: wrap; align-items: center">' + pill("鈴木 一郎 ×", "#EEF0F4", "#131B27") + pill("田中 美咲 ×", "#EEF0F4", "#131B27") + '<span style="font-size: 12px; color: #4A5563">＋ 名前で探す</span></div></div>'
      + '<div>' + lab("色") + '<div style="display: flex; gap: 6px">' + "".join('<span style="width: 22px; height: 22px; border-radius: 6px; background: %s; %s"></span>' % (c, "box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #22345C" if i == 2 else "") for i, c in enumerate(["#186F69", "#6D4AA6", "#2F4B7C", "#B45309", "#B91C1C", "#4A5563"])) + '</div></div>')
      + mfoot(btn("やめる", "", "WsPeople.dc.html"), btn("足す", "p", "WsPeople.dc.html")), 580, "グループを足す")
    save("EdGroup.dc.html", "グループを足す", s)

    # 7 承認を上に回す決まりを足す
    s = modal(L("WsRules"), mhead("承認を上に回す決まりを足す", "WsRules.dc.html", "", "担当者の承認のほかに、もう 1 人の承認が要るとき")
      + mbody('<div>' + lab("何のとき") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + chip("見積・請求の金額") + chip("外へのメール", True) + chip("持ち出し") + chip("種別") + chip("取引先") + '</div></div>'
      + '<div>' + lab("条件") + '<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap">' + field("送る相手").replace("min-height: 34px", "min-height: 30px") + field("が").replace("min-height: 34px", "min-height: 30px") + field("はじめて送る相手 ▾").replace("min-height: 34px", "min-height: 30px; min-width: 200px") + '</div></div>'
      + '<div>' + lab("回す先") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("そのグループのマネージャー", "いちばん多い", True) + radio("決まった人", "例：管理者") + radio("取引先の担当", "") + '</div></div>'
      + '<div>' + lab("効く範囲") + field("ワークスペース全体 ▾") + '</div>'
      + '<div style="display: flex; gap: 8px; align-items: center; background: #F3F6FC; border: 1px solid #C9D6EE; border-radius: 8px; padding: 8px 10px; font-size: 12px">' + icon("AI", NAVY, 22) + '<span>この 1 か月なら 3 件が当てはまっていた（EG-127・JD-198・KR-030）</span></div>')
      + mfoot(btn("やめる", "", "WsRules.dc.html"), btn("足す", "p", "WsRules.dc.html")), 600, "承認の決まりを足す")
    save("EdApproval.dc.html", "承認を上に回す決まりを足す", s)

    # 8 区画を足す
    s = modal(L("WsShape"), mhead("区画を足す", "WsShape.dc.html", "", "種別「タスク」の形に足す")
      + mbody('<div>' + lab("区画の名前") + field("お客様への説明") + '</div>'
      + '<div>' + lab("中身の形") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("文章", "", True) + radio("箇条書き", "") + radio("表", "列を決める") + radio("チェックリスト", "") + radio("日付", "") + '</div></div>'
      + '<div>' + lab("書くときの手がかり", "（入力欄に薄く出る・分身もこれを見て書く）") + field("先方に送る説明。専門用語を避け、3〜5 行で", True) + '</div>'
      + '<div>' + lab("扱い") + '<div style="display: flex; gap: 6px">' + chip("必須") + chip("出す", True) + chip("外す") + '</div></div>'
      + '<div style="display: flex; flex-direction: column">' + check("先方に見せられる区画にする", False, "取引先の「人と見せ方」で選べるようになる") + check("完了の条件の確かめに使う", False, "分身がテスト仕様の案に入れる") + '</div>'
      + NOTE("足した区画は、これから作るチケットから出る。区画は種別ごとに 20 まで"))
      + mfoot(btn("やめる", "", "WsShape.dc.html"), btn("足す", "p", "WsShape.dc.html")), 600, "区画を足す")
    save("EdSection.dc.html", "区画を足す", s)

    # 9 PC をつなぐ
    step = lambda n, t, d, st: '<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #EDF0F4"><span style="width: 26px; height: 26px; flex: none; border-radius: 99px; display: grid; place-items: center; font-size: 12px; font-weight: 700; %s">%s</span><div style="flex: 1"><b style="font-weight: 600">%s</b><div style="font-size: 12px; color: %s; margin-top: 2px; line-height: 1.7">%s</div></div></div>' % ({"done": "background: #166534; color: #FFFFFF", "now": "background: #22345C; color: #FFFFFF", "next": "background: #EEF0F4; color: #4A5563"}[st], "✓" if st == "done" else n, t, MUTED, d)
    s = modal(L("MePC"), mhead("PC をつなぐ", "MePC.dc.html", "", "分身はこの PC で動く。3 分ほど")
      + mbody(step("1", "常駐アプリを入れる", "Mac・Windows に入れる小さなアプリ。ブラウザを動かし、預けたログイン情報を入れる役目 ・ <a href=\"#\">Mac 用</a> ／ <a href=\"#\">Windows 用</a>", "done")
      + step("2", "アプリにこのコードを入れる", '<span style="display: inline-flex; gap: 6px; margin-top: 6px">' + "".join('<span style="width: 34px; height: 42px; border: 1px solid #22345C; border-radius: 8px; display: grid; place-items: center; font-size: 20px; font-weight: 700; color: #131B27; background: #FFFFFF">%s</span>' % c for c in "KQ7M2X") + '</span><br>10 分で切れる ・ この PC 専用の鍵が作られ、ほかの PC からは使えない', "now")
      + step("3", "試しに動かす", "分身が「ナレッジのページを開いて閉じる」を試す。終わればつながった", "next")
      + WARNB("つなぐ PC は、あなたしか使わないものにする。共用の PC だと、ほかの人があなたの分身の作業を見られる"))
      + mfoot(btn("あとで", "", "MePC.dc.html"), '<span style="font-size: 12px; color: %s; display: inline-flex; align-items: center; gap: 6px"><span style="width: 8px; height: 8px; border-radius: 99px; background: #B45309"></span>アプリからの返事を待っています…</span>' % MUTED), 580, "PC をつなぐ")
    save("EdPC.dc.html", "PC をつなぐ", s)

    # 10 ほかのグループへ移す
    s = modal(L("TicketDetail"), mhead("ほかのグループへ移す", "TdMore.dc.html", "", "EG-128 セイコー様へ 11月分の請求書を送る")
      + mbody('<div>' + lab("移す先") + field('<span style="width: 18px; height: 18px; border-radius: 4px; background: #B45309; color: #FFFFFF; font-size: 9px; display: inline-grid; place-items: center; margin-right: 6px">KR</span>経理 ▾') + '<div style="font-size: 11px; color: %s; margin-top: 4px">番号は EG-128 のまま変わらない（生まれたグループの番号）</div></div>' % MUTED
      + '<div>' + lab("一緒に切り替えるもの", "（ワークスペースの決まり：毎回聞く）") + check("子チケット（0 件）", False) + check("派生・関連のチケット（EG-097・KR-031）", False, "関連のまま残り、移さない") + check("担当を経理の人にする", True, "田中 美咲 さんに渡す（受けてもらって成り立つ）") + '</div>'
      + WARNB("経理のチケットになると、営業の人は「見るだけ」になる。いまの承認待ちは取り消され、経理の承認する人に回る")
      + '<div>' + lab("ひとこと", "（やり取りに残る）") + field("請求は経理で持つことになったため", True) + '</div>')
      + mfoot(btn("やめる", "", "TicketDetail.dc.html"), btn("移す", "p", "TicketDetail.dc.html")), 600, "ほかのグループへ移す")
    save("EdMove.dc.html", "ほかのグループへ移す", s)

if __name__ == '__main__':
    main()

import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
from ed import L, av, radio, NOTE, OKB, WARNB
os.environ["NOGEN"] = "1"
# 1 種別を足す
s = modal(L("WsShape"), mhead("種別を足す", "WsShape.dc.html", "", "いま 4 ／ 10")
  + mbody('<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px"><div>' + lab("名前") + field("依頼") + '</div><div>' + lab("色") + '<div style="display: flex; gap: 6px; padding-top: 6px">' + "".join('<span style="width: 22px; height: 22px; border-radius: 6px; background: %s; %s"></span>' % (c, "box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #22345C" if i == 3 else "") for i, c in enumerate(["#186F69", "#B45309", "#6D4AA6", "#2F4B7C", "#B91C1C"])) + '</div></div></div>'
  + '<div>' + lab("区画の始め方") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("タスクの形を写す", "区画 10 をそのまま", True) + radio("運営のひな形から", "依頼・問い合わせ・会議 など") + radio("白紙から", "目的と完了の条件だけ") + '</div></div>'
  + '<div>' + lab("説明", "（作るときに出る・分身が種別を選ぶ手がかり）") + field("先方や社内から頼まれた仕事。誰から・何を・いつまで を書く", True) + '</div>'
  + NOTE("足した種別は、チケットを作るとき・一覧で絞るときに出る。消すときは、使っているチケットの移し先を選ぶ"))
  + mfoot(btn("やめる", "", "WsShape.dc.html"), btn("足して形を決める", "p", "WsShape.dc.html")), 580, "種別を足す")
save("EdKind.dc.html", "種別を足す", s)
# 2 親チケットを決める
res = lambda k, t, g, st, sel=False: '<div style="display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 6px; %s"><span style="font-size: 12px; color: #22345C; width: 56px">%s</span><span style="flex: 1">%s</span><span style="font-size: 11px; color: %s">%s</span>%s</div>' % ("background: #F1F3F6; font-weight: 600" if sel else "", k, t, MUTED, g, pill(st))
C = L("Create")
mm = re.search(r'<a href="[^"]*" style="font-size: 12px; margin-bottom: 8px">親チケットを決める</a>', C); a = mm.start(); alen = len(mm.group(0))
pop = ('<span style="position: relative; display: inline-block"><a href="#" style="font-size: 12px; margin-bottom: 8px; background: #DCE4F2; border-radius: 4px; padding: 0 4px">親チケットを決める</a><div role="dialog" style="%s; top: 24px; left: 0; width: 420px">' % POP
  + '<input value="保守" style="width: 100%; box-sizing: border-box; height: 32px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 6px; padding: 0 10px; font-family: inherit; font-size: 13px; margin-bottom: 6px">'
  + res("EG-124", "【親】セイコー様 保守契約の更新", "営業", "作業中", True) + res("EG-097", "セイコー様 保守契約の見積", "営業", "完了") + res("JD-150", "京蟻 保守運用（年間）", "受託開発", "作業中")
  + '<div style="border-top: 1px solid #EDF0F4; margin-top: 6px; padding: 8px 6px 2px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><span style="color: %s">親にすると、親の期限（11/15）より後にはできない。親の進みにこの子が数えられる</span><span>%s</span></div></div></span>' % (MUTED, check("親の担当・取引先・節目を写す", True).replace("padding: 4px 0", "padding: 0")))
save("EdParent.dc.html", "親チケットを決める", C[:a] + pop + C[a + alen:])
# 3 分身に覚えさせる
s = modal(L("RoomMemory"), mhead("高本のAI に覚えさせる", "RoomMemory.dc.html", icon("憶", "#6D4AA6", 28), "好み・事実・実例。短く 1 つずつ")
  + mbody('<div>' + lab("覚えること") + '<textarea style="width: 100%; box-sizing: border-box; min-height: 64px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px">京蟻の大橋様は、電話より Slack の方が返事が早い</textarea></div>'
  + '<div>' + lab("種類") + '<div style="display: flex; gap: 6px">' + chip("好み") + chip("事実", True) + chip("実例") + '</div></div>'
  + '<div>' + lab("見える人") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("自分だけ", "自分の分身だけが使う", True) + radio("グループにも勧める", "マネージャーが確かめると、営業の全員の分身が使う") + '</div></div>'
  + OKB("分身の点検：ぶつかりなし ・ 似ているものなし")
  + NOTE("いつも必ず守らせたいことなら <a href=\"RoomAddRule.dc.html\">守ること</a> に、手順なら <a href=\"RoomType.dc.html\">やり方</a> に"))
  + mfoot(btn("やめる", "", "RoomMemory.dc.html"), btn("覚えさせる", "p", "RoomMemory.dc.html")), 560, "覚えさせる")
save("EdTeach.dc.html", "分身に覚えさせる", s)
# 4 種別を変える
s = modal(L("TicketDetail"), mhead("種別を変える", "TdMore.dc.html", "", "EG-128 セイコー様へ 11月分の請求書を送る ・ いま：タスク")
  + mbody('<div>' + lab("新しい種別") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + "".join('<span style="display: inline-block; min-width: 56px; text-align: center; font-size: 12px; font-weight: 500; border-radius: 99px; padding: 4px 10px; color: #FFFFFF; background: %s; %s">%s</span>' % (c, "box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #22345C" if n == "依頼" else "opacity: .85", n) for n, c in [("タスク", "#186F69"), ("課題", "#B45309"), ("QA", "#B91C1C"), ("会議", "#6D4AA6"), ("依頼", "#2F4B7C")]) + '</div></div>'
  + '<div><b style="font-size: 12px; font-weight: 500">区画がこう変わる</b><div style="margin-top: 6px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><span style="color: #166534">＋ 誰から（足される・空のまま）</span><span>＝ 目的・完了の条件・実施事項・成果物（そのまま）</span><span style="color: #7A4A05">− テスト仕様と確認の結果（依頼には無い区画。中身は消さず、本文のいちばん下に「前の種別の区画」としてしまう）</span></div></div>'
  + WARNB("確認の結果が無くなるので、承認待ちから外れて「作業中」に戻る"))
  + mfoot(btn("やめる", "", "TicketDetail.dc.html"), btn("依頼にする", "p", "TicketDetail.dc.html")), 580, "種別を変える")
save("EdTypeChange.dc.html", "種別を変える", s)
# 5 プランを変える
plan = lambda n, price, d, cur=False, rec=False: '<div style="flex: 1 1 160px; border: 1px solid %s; background: %s; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 6px">%s<b style="font-size: 16px">%s</b><span style="font-size: 18px; font-weight: 700">%s</span><span style="font-size: 12px; color: %s; line-height: 1.7">%s</span>%s</div>' % (NAVY if rec else "#DDE2E9", "#F3F6FC" if rec else "#FFFFFF", pill("いま", "#22345C", "#FFFFFF") if cur else (pill("おすすめ", "#E8F5EC", "#166534") if rec else ""), n, price, MUTED, d, btn("このプランにする", "p" if rec else "") if not cur else "")
s = modal(L("WsSettings"), mhead("プランを変える", "WsSettings.dc.html", "", "株式会社ENGINE BASE ・ いま 5 人")
  + mbody('<div style="display: flex; gap: 10px; flex-wrap: wrap">' + plan("無料", "¥0", "3 人まで ・ 分身の実行は月 50 回") + plan("チーム", "¥15,000 ／月", "10 人まで ・ 分身の実行は人ごとの枠", True) + plan("ビジネス", "¥40,000 ／月", "30 人まで ・ 取引先の場所・承認の決まり・記録の書き出しを増やす", False, True) + '</div>'
  + NOTE("上げるとすぐ使える（今月の残り日数分だけ払う）。下げると次の請求日（12/01）から。人数が上限を超えるときは下げられない")
  + '<div style="font-size: 12px; color: %s">払い方：請求書払い（月末締め・翌月 1 日に出す・月末払い）<a href="WsBills.dc.html" style="margin-left: 8px">請求書</a> ・ 値段は仮 ・ カード払いは後のフェーズ</div>' % MUTED)
  + mfoot(btn("閉じる", "", "WsSettings.dc.html")), 720, "プランを変える")
save("EdPlan.dc.html", "プランを変える", s)
# 6 ワークスペースを消す
s = modal(L("WsSettings"), mhead("株式会社ENGINE BASE を消す", "WsSettings.dc.html", icon("!", "#B91C1C", 28), "消すと戻せません")
  + mbody('<div style="border: 1px solid #F3C7C7; background: #FDF3F3; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.8"><b style="color: #991B1B; font-weight: 600">消えるもの</b><br>チケット 69 件・ナレッジ 24 ページ・取引先 4 社と先方の人・記録・預けたログイン情報・メンバー 5 人の分身の記憶（このワークスペースの分）</div>'
  + '<div style="font-size: 12px; line-height: 1.8">・ 消す前に <a href="#">すべてを書き出す</a>（チケット・ナレッジ・記録を zip で）<br>・ 先方の人（クライアントの場所）にも、使えなくなったことを知らせる<br>・ メンバーのアカウントは消えない（ほかのワークスペースはそのまま）<br>・ 消す手続きから 14 日は取り消せる。そのあと完全に消える</div>'
  + '<div>' + lab("確かめのため、ワークスペースの名前を打ってください") + field("株式会社ENGINE BASE", True) + '</div>')
  + mfoot(btn("やめる", "", "WsSettings.dc.html"), '<span style="height: 30px; border-radius: 6px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; background: #E8A5A5; color: #FFFFFF">本人確認して消す手続きをする</span>', left='<span style="font-size: 11px; color: %s">名前が合うと押せる</span>' % MUTED), 560, "ワークスペースを消す")
save("EdDeleteWs.dc.html", "ワークスペースを消す", s)
# 7 ワークスペースから抜ける
s = modal(L("MeProfile"), mhead("京蟻システム株式会社 から抜ける", "MeProfile.dc.html", icon("京", "#6D4AA6", 28), "あなたは メンバー")
  + mbody('<div style="font-size: 13px; line-height: 1.8">抜けると、京蟻システムのチケット・ナレッジは見られなくなり、あなたの分身もそこでは動かなくなります。</div>'
  + '<div><b style="font-size: 12px; font-weight: 500">担当しているチケット 2 件</b><div style="font-size: 12px; margin-top: 4px; line-height: 1.8">JD-201 ログイン画面の文言を直す ・ JD-204 追加開発の見積<br><span style="color: %s">抜ける前に、ほかの人に渡してください（受けてもらうまで抜けられない）</span></div></div>' % MUTED
  + '<div style="display: flex; flex-direction: column">' + check("あなたの分身が京蟻で覚えたことを消す", True, "京蟻のワークスペースに残るのは、あなたが書いたやり取り・決定ログだけ") + '</div>'
  + NOTE("抜けたあとでも、招待されればまた入れる"))
  + mfoot(btn("やめる", "", "MeProfile.dc.html"), btn("担当を渡しにいく", "", "TdAssignee.dc.html"), '<span style="height: 30px; border-radius: 6px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; background: #E8A5A5; color: #FFFFFF">抜ける（渡し終わってから）</span>'), 560, "ワークスペースから抜ける")
save("EdLeaveWs.dc.html", "ワークスペースから抜ける", s)
# 8 パスキーを足す
s = modal(L("MeLogin"), mhead("パスキーを足す", "MeLogin.dc.html", "", "この端末・スマホ・パスワード管理アプリに足せる")
  + mbody('<div>' + lab("どこに足す") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("この PC", "Windows Hello・Touch ID", True) + radio("スマホ", "QR を読み取って足す") + radio("パスワード管理アプリ", "1Password など") + '</div></div>'
  + '<div>' + lab("名前", "（あとで見分けるため）") + field("事務所の Windows") + '</div>'
  + '<div style="display: flex; gap: 10px; align-items: center; background: #F7F8FA; border-radius: 8px; padding: 12px 14px; font-size: 12px">' + icon("指", NAVY, 28) + '<span>「足す」を押すと、PC の確かめの画面（指紋・顔・PIN）が出る。そこで確かめると足される</span></div>'
  + NOTE("パスキーは 2 つ以上あると安心（1 つの端末をなくしても入れる）"))
  + mfoot(btn("やめる", "", "MeLogin.dc.html"), btn("足す", "p", "MeLogin.dc.html")), 560, "パスキーを足す")
save("EdPasskey.dc.html", "パスキーを足す", s)

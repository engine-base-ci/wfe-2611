from boards import *
from room import P
import re
# ---------- RoomAddRule: modal over RoomKnows ----------
k = open(P + "RoomKnows.dc.html", encoding="utf-8").read()
k = k.replace("<title>知っていること 必ず守ること</title>", "<title>守ることを足す</title>")
radio = lambda t, d, on=False: ('<label style="display: flex; gap: 8px; align-items: flex-start; border: 1px solid %s; background: %s; border-radius: 8px; padding: 8px 10px; flex: 1; min-width: 150px"><span style="width: 14px; height: 14px; margin-top: 3px; border-radius: 99px; border: %s; box-sizing: border-box; flex: none"></span><span><b style="font-weight: 500; display: block">%s</b><span style="font-size: 11px; color: %s">%s</span></span></label>'
    % (((NAVY, "#EEF3FD", "4px solid #22345C") if on else (LINE, "#FFFFFF", "1px solid #B8C0CC")) + (t, MUTED, d)))
lab = lambda t: '<div style="font-size: 12px; font-weight: 500; margin-bottom: 6px">%s</div>' % t
modal = ('<div role="dialog" aria-label="守ることを足す" style="position: fixed; inset: 0; background: rgba(19,27,39,.45); display: grid; place-items: center; padding: 16px; z-index: 10">'
 '<div style="width: 100%; max-width: 640px; max-height: calc(100vh - 32px); overflow: auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); display: flex; flex-direction: column">'
 '<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4">' + icon("守", "#186F69", 30) + '<b style="font-size: 15px">守ることを足す</b><a href="RoomKnows.dc.html" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>'
 '<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">'
 '<div>' + lab("守ること") + '<textarea style="width: 100%; box-sizing: border-box; min-height: 64px; border: 1px solid #22345C; box-shadow: 0 0 0 2px #DCE4F2; border-radius: 8px; padding: 8px 10px; font-family: inherit; font-size: 13px">セイコー様への見積は 5% 引いた額で書く</textarea><div style="font-size: 11px; color: #4A5563; margin-top: 4px">一文で。「〜する」「〜しない」の形だと分身が迷わない</div></div>'
 '<div>' + lab("どこで効かせる") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + radio("自分の仕事すべて", "どのチケットでも") + radio("取引先", "その取引先のチケットだけ", True) + radio("種別", "請求・見積など") + '</div>'
 '<div style="display: flex; gap: 6px; margin-top: 8px; align-items: center"><span style="font-size: 12px; color: #4A5563">取引先</span><span style="height: 30px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px">セイコー株式会社 ▾</span></div></div>'
 '<div>' + lab("分身の点検（書くたびに見直す）") + '<div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px">'
 '<div style="display: flex; gap: 8px; align-items: flex-start; border: 1px solid #F3C7C7; background: #FDF3F3; border-radius: 8px; padding: 8px 10px"><b style="color: #B91C1C">!</b><div style="flex: 1"><b style="font-weight: 500; color: #B91C1C">ワークスペースの「値引きを書かない」とぶつかる</b><div style="color: #4A5563">ワークスペースの決まりは自分では変えられない。どちらにするか選んでください</div>'
 '<div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px">' + radio("セイコー様だけの例外にして、マネージャーの OK をもらう", "OK が出るまでは今の決まりで動く。承認待ちに 佐藤 さん宛で出る", True) + radio("値引きは書かず、見積の備考で伝える形に書き直す", "分身の言い直し案：「セイコー様の見積は備考に『特別価格』と書く」") + '</div></div></div>'
 '<div style="display: flex; gap: 8px; align-items: flex-start; border: 1px solid #F1D9A8; background: #FFF8EE; border-radius: 8px; padding: 8px 10px"><b style="color: #7A4A05">≈</b><div><b style="font-weight: 500; color: #7A4A05">似ているもの：取引先「宛名と CC」</b><div style="color: #4A5563">別のことなのでそのまま足せる</div></div></div>'
 '<div style="display: flex; gap: 8px; align-items: center; border: 1px solid #CDE8D5; background: #F1FAF4; border-radius: 8px; padding: 8px 10px"><b style="color: #166534">✓</b><span>自分の守ること・やり方とはぶつからない</span></div>'
 '</div></div></div>'
 '<div style="display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #EDF0F4; flex-wrap: wrap">' + btn("やめる", "", "RoomKnows.dc.html") + btn("OK をもらって足す", "p", "RoomKnows.dc.html") + '</div>'
 '</div></div>\n')
k = k.replace("</x-dc>", modal + "</x-dc>", 1)
open(P + "RoomAddRule.dc.html", "w", encoding="utf-8").write(k); print("RoomAddRule", len(k))

# ---------- RoomDone ----------
def ev(time, m, bg, text, tid, used, res, rbg, rfg):
    return ('<div style="display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid #EDF0F4"><span style="width: 44px; flex: none; font-size: 12px; color: %s; padding-top: 6px">%s</span>%s<div style="flex: 1; min-width: 0"><div>%s <a href="TicketDetail.dc.html" style="font-size: 12px">%s</a></div><div style="font-size: 11px; color: %s">%s</div></div>%s</div>'
            % (MUTED, time, icon(m, bg, 30), text, tid, MUTED, used, pill(res, rbg, rfg)))
OK = ("#E8F5EC", "#166534"); NG = ("#FDECEC", "#B91C1C"); WAIT = ("#FFF4E0", "#7A4A05"); NEU = ("#EEF0F4", MUTED)
db = SEC + title("やったこと", "分身がやったことの記録。何を使ってそうしたかもわかる", btn("書き出す"))
db += '    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center">' + chip("すべて", True) + chip("実行した") + chip("作った") + chip("覚えた") + chip("止まった・落ちた") + '<span style="margin-left: auto; font-size: 12px; color: %s">期間 <b style="font-weight: 500; color: #131B27">この 1 週間 ▾</b></span></div>\n' % MUTED
db += '    <div style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; padding: 4px 16px 8px; max-width: 900px">'
db += '<div style="font-size: 12px; font-weight: 500; padding: 8px 0">今日 11/2（月）</div>'
db += ev("10:42", "送", NAVY, "請求書を作り、承認を出した", "EG-128", "やり方「請求書を作って送る」v4 ・ 守ること「宛名と CC」「請求は 25 日締め」", "承認待ち", *WAIT)
db += ev("10:05", "議", NAVY, "打ち合わせのまとめを書いた", "EG-133", "やり方「打ち合わせのまとめ」v3 ・ 覚えていること「社内向けは箇条書き」", "そのまま通った", *OK)
db += ev("09:30", "憶", "#6D4AA6", "「鈴木様は Chat が早い」を覚えたいことに出した", "", '壁打ち 10/30 から ・ <a href="RoomWants.dc.html">覚えたいことを見る</a>', "決めてもらう", *NEU)
db += '<div style="font-size: 12px; font-weight: 500; padding: 12px 0 8px">11/1（日）</div>'
db += ev("16:20", "見", NAVY, "見積の下書きを作った", "EG-131", "やり方「見積を作る」v2 → 高本さんが金額を直した", "直された", *WAIT)
db += ev("14:02", "!", "#B91C1C", "経費の申請が確認で落ち、直して出し直した", "EG-130", "落ちた理由：領収書の日付が読めなかった → 高本さんに聞いて直した", "直して通った", *OK)
db += ev("11:15", "応", "#5E6F93", "求人の応募文を 3 本書いた", "EG-127", "やり方「求人の応募文を書く」v6（層：営業）・ 守ること「400 字以内」", "そのまま通った", *OK)
db += '<div style="font-size: 12px; font-weight: 500; padding: 12px 0 8px">10/31（土）</div>'
db += ev("18:40", "戻", "#B91C1C", "提案書の骨組みが差し戻された", "EG-098", "マネージャー 佐藤：「結論が先に見えない」→ 覚えたいことに出した", "差し戻し", *NG)
db += '</div>\n   </section>\n'
stat = lambda n, l, c="#131B27": '<div style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 10px"><b style="font-size: 20px; color: %s">%s</b><div style="font-size: 11px; color: %s">%s</div></div>' % (c, n, MUTED, l)
db += aside('<b style="font-size: 14px">この 1 週間</b><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">' + stat("23", "やったこと") + stat("19", "そのまま通った", "#166534") + stat("3", "直された・差し戻し", "#B45309") + stat("1", "落ちて直した", "#B91C1C") + '</div>'
  + '<div style="font-size: 12px"><b style="font-weight: 500">よく使ったもの</b><div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; color: %s"><span>やり方「請求書を作って送る」 6 回</span><span>守ること「です・ます」 21 回</span><span>覚えていること「表は金額を右寄せ」 4 回</span></div></div>' % MUTED
  + '<div style="border-top: 1px solid #EDF0F4; padding-top: 10px; font-size: 12px; color: %s">直された・差し戻されたものは、覚えたいことに出て次から活かせる</div>' % MUTED, 300)
page("RoomDone.dc.html", "分身の部屋 やったこと", "RoomDone.dc.html", db)

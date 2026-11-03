import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import *
B = os.path.dirname(os.path.abspath(__file__)) + "/base/"
def base(n): return open(B + n + ".dc.html", encoding="utf-8").read()
GRIP = '<span style="color: #B8C0CC; cursor: grab">⋮⋮</span>'
def colrow(t, on=True, lock=False):
    return '<div style="display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px">%s%s<span style="flex: 1">%s</span>%s</div>' % (GRIP, check("", on).replace("padding: 4px 0", "padding: 0"), t, pill("固定") if lock else "")
L = base("List")
# 1 表示設定
view = ('<div style="display: flex; align-items: center; padding: 0 4px 6px"><b style="flex: 1">表示設定</b><a href="#" style="font-size: 12px">はじめに戻す</a></div>'
  + '<div style="font-size: 11px; color: %s; padding: 2px 6px">出す列（つかんで並べ替え）</div>' % MUTED
  + colrow("種別") + colrow("番号", True, True) + colrow("題名", True, True) + colrow("状態") + colrow("担当者") + colrow("分類") + colrow("節目") + colrow("開始日", False) + colrow("期限") + colrow("予定・実績") + colrow("更新") + colrow("取引先", False) + colrow("優先度", False)
  + SEP + '<div style="display: grid; grid-template-columns: 72px 1fr; gap: 8px; align-items: center; font-size: 12px; padding: 4px 6px"><span style="color: %s">1 行の高さ</span><span style="display: flex; gap: 4px">%s%s</span><span style="color: %s">まとめる</span><span style="display: flex; gap: 4px; flex-wrap: wrap">%s%s%s%s</span><span style="color: %s">並べ方</span><span>期限の近い順 ▾</span></div>' % (MUTED, chip("ふつう", True), chip("詰める"), MUTED, chip("親子", True), chip("状態"), chip("担当"), chip("なし"), MUTED)
  + SEP + '<div style="display: flex; align-items: center; gap: 8px; padding: 2px 6px; font-size: 12px"><span style="flex: 1">この見え方をグループの全員の既定にする</span>%s</div>' % toggle(False)
  + '<div style="font-size: 11px; color: %s; padding: 2px 6px">変えた見え方は自分だけに残る。グループの既定にできるのはマネージャー</div>' % MUTED)
save("LsView.dc.html", "表示設定（列）", anchor_pop(L, "表示設定（列）", view, 320))
# 2 詳しく（条件を組む）
cond = lambda a, op, v: '<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap"><span style="font-size: 12px; color: %s; width: 36px">%s</span>%s%s%s<button type="button" aria-label="外す" style="border: 0; background: transparent; color: #4A5563">×</button></div>' % (MUTED, a, field(op[0]).replace("min-height: 34px", "min-height: 30px; width: 110px; box-sizing: border-box"), field(op[1]).replace("min-height: 34px", "min-height: 30px; width: 80px; box-sizing: border-box"), field(v).replace("min-height: 34px", "min-height: 30px; flex: 1; min-width: 140px; gap: 4px; flex-wrap: wrap"))
adv = ('<div style="display: flex; align-items: center; gap: 8px; padding: 0 2px 8px"><b style="flex: 1">条件を組む</b><span style="font-size: 12px; color: %s">いま 12 件</span></div>' % MUTED
  + '<div style="display: flex; gap: 8px; align-items: center; border: 1px solid #DDE2E9; border-radius: 8px; padding: 6px 8px; margin-bottom: 10px">' + icon("AI", NAVY, 22) + '<span style="flex: 1; font-size: 12px; color: %s">ことばで探す：「鈴木さん担当で今週期限の提案、終わってないもの」</span>%s</div>' % (MUTED, btn("条件にする"))
  + '<div style="display: flex; flex-direction: column; gap: 6px">'
  + cond("条件", ("担当者", "が"), pill("鈴木", "#EEF3FD", NAVY) + pill("鈴木のAI", "#EEF3FD", NAVY))
  + cond("かつ", ("期限", "が"), "今週（11/02〜11/08）")
  + cond("かつ", ("状態", "でない"), pill("完了", "#EEF3FD", NAVY))
  + '<div style="border-left: 2px solid #DDE2E9; margin-left: 40px; padding-left: 10px; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 11px; color: %s">まとまり：どれか 1 つ</span>' % MUTED
  + cond("", ("分類", "が"), pill("提案", "#EEF3FD", NAVY)) + cond("または", ("題名", "に含む"), "見積") + '</div></div>'
  + '<div style="display: flex; gap: 10px; font-size: 12px; margin-top: 8px"><a href="#">＋ 条件</a><a href="#">＋ まとまり</a></div>'
  + SEP + '<div style="display: flex; gap: 6px; justify-content: flex-end">' + btn("かんたんに戻す") + btn("検索条件を保存", "", "LsSave.dc.html") + btn("12 件を見る", "p") + '</div>')
Lp = wire_buttons(L, {}); a = find_button(Lp, "詳しく"); Lp = Lp.replace(a, a.replace('style="', 'aria-expanded="true" style="box-shadow: 0 0 0 2px #DCE4F2; ', 1), 1)
save("LsFilter.dc.html", "条件を組む（詳しく）", float_pop(Lp, adv, "top: 150px; left: min(330px, 16px); left: clamp(16px, calc(100vw - 660px), 330px); width: 620px; max-width: calc(100vw - 32px)"))
# 3 まとめて操作
bar = ('<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"><b>3 件を選んでいる</b><a href="#" style="font-size: 12px; color: #DCE4F2">選ぶのをやめる</a><span style="flex: 1"></span>'
  + "".join('<button type="button" style="height: 30px; border-radius: 6px; border: 1px solid %s; background: %s; color: #FFFFFF; padding: 0 12px; font-size: 12px">%s</button>' % ("#FFFFFF" if t == "状態 ▾" else "#4A5C80", "#3A4E78" if t == "状態 ▾" else "transparent", t) for t in ["状態 ▾", "担当 ▾", "期限 ▾", "節目 ▾"]) + '</div>')
menu = ('<div style="font-size: 11px; color: %s; padding: 2px 6px 6px">3 件の状態を変える</div>' % MUTED
  + "".join('<div style="display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 6px; %s"><span style="width: 10px; height: 10px; border-radius: 99px; background: %s"></span><span style="flex: 1">%s</span><span style="font-size: 11px; color: %s">%s</span></div>' % ("background: #F1F3F6" if n == "完了" else "", c, n, MUTED, note) for n, c, note in [("未着手", "#6B7585", ""), ("作業中", "#2F4B7C", ""), ("保留", "#374151", ""), ("完了", "#166534", "1 件は承認待ちのため変えられない")])
  + SEP + '<div style="font-size: 11px; color: %s; padding: 2px 6px">ひとこと（やり取りに残る）</div><div style="padding: 4px 6px">%s</div>' % (MUTED, field("先方定例で合意済みのため完了に", True))
  + '<div style="display: flex; gap: 6px; justify-content: flex-end; padding: 6px">' + btn("2 件を完了にする", "p") + '</div>')
s = L.replace("</x-dc>", '<div style="position: fixed; left: 50%%; transform: translateX(-50%%); bottom: 20px; width: min(860px, calc(100vw - 32px)); background: #22345C; color: #FFFFFF; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.3); padding: 10px 14px; z-index: 25; box-sizing: border-box">%s<div style="%s; bottom: 52px; left: 140px; width: 300px">%s</div></div>\n</x-dc>' % (bar, POP, menu), 1)
save("LsBulk.dc.html", "まとめて操作", s)
# 4 検索条件を保存
s = modal(L, mhead("検索条件を保存", "List.dc.html", "", "いまの条件と見え方に名前をつけて、あとから 1 回で開く")
  + mbody('<div>' + lab("名前") + field("鈴木さん 今週の提案") + '</div>'
  + '<div>' + lab("条件") + '<div style="display: flex; gap: 4px; flex-wrap: wrap">' + pill("担当者：鈴木・鈴木のAI") + pill("期限：今週") + pill("状態：完了でない") + pill("分類：提案 または 題名に「見積」") + pill("列：10 ・ 親子でまとめる") + '</div></div>'
  + '<div>' + lab("見える人") + '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + chip("自分だけ", True) + chip("営業グループの全員") + '</div></div>'
  + '<div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px">'
  + '<div style="display: flex; align-items: center; gap: 8px"><span style="flex: 1">左のメニューに出す<span style="display: block; font-size: 11px; color: %s">グループの下に並ぶ</span></span>%s</div>' % (MUTED, toggle(True))
  + '<div style="display: flex; align-items: center; gap: 8px"><span style="flex: 1">当てはまるチケットが増えたら知らせる<span style="display: block; font-size: 11px; color: %s">1 日 1 回まとめて</span></span>%s</div>' % (MUTED, toggle(False)) + '</div>')
  + mfoot(btn("やめる", "", "List.dc.html"), btn("保存する", "p", "List.dc.html")), 560, "検索条件を保存")
save("LsSave.dc.html", "検索条件を保存", s)

A = base("Approvals")
# 5 決めた履歴
hist = lambda when, act, ac, key, title, note, undo=False: '<div style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-top: 1px solid #EDF0F4"><span style="width: 44px; flex: none; font-size: 11px; color: %s; padding-top: 2px">%s</span><div style="flex: 1; min-width: 0"><div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap">%s<a href="TicketDetail.dc.html" style="font-size: 12px">%s</a><span>%s</span></div><div style="font-size: 11px; color: %s; margin-top: 2px">%s</div></div>%s</div>' % (MUTED, when, pill(act, *ac), key, title, MUTED, note, btn("取り消す") if undo else "")
OK = ("#E8F5EC", "#166534"); NG = ("#FDECEC", "#B91C1C"); PS = ("#EEF0F4", MUTED)
dr = ('<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4"><b style="font-size: 15px">決めた履歴</b><span style="font-size: 12px; color: %s">自分が決めたもの</span><a href="Approvals.dc.html" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>' % MUTED
  + '<div style="display: flex; gap: 6px; padding: 10px 18px; border-bottom: 1px solid #EDF0F4; flex-wrap: wrap">' + chip("すべて", True) + chip("承認 14") + chip("差し戻し 3") + chip("人に回した 1") + '<span style="margin-left: auto; font-size: 12px; color: %s">この 1 週間 ▾</span></div>' % MUTED
  + '<div style="flex: 1; overflow: auto; padding: 4px 18px 14px">'
  + '<div style="font-size: 12px; font-weight: 500; padding: 8px 0">今日</div>'
  + hist("10:52", "承認", OK, "KR-031", "入金の照合（10月分）", "まとめて承認（2 件）の 1 つ ・ 実行は 11:00 の予定", True)
  + hist("10:48", "承認", OK, "EG-127", "発注ナビ 応募文 3 本", "1 件ずつ中身を見て承認（外に送る） ・ 送った", False)
  + hist("09:40", "差し戻し", NG, "EG-098", "提案書の骨組み", "理由：結論が先に見えない ・ 分身の覚えたいことに出た")
  + '<div style="font-size: 12px; font-weight: 500; padding: 12px 0 8px">10/31（金）</div>'
  + hist("17:20", "人に回した", PS, "JD-204", "京蟻 追加開発の見積", "上位の承認へ：佐藤 ・ 金額が 100 万円を超えたため")
  + hist("15:05", "承認", OK, "EG-126", "セイコー様 更新の見積", "確認 3 件すべて通過")
  + '<div style="font-size: 11px; color: %s; margin-top: 10px">「取り消す」は外に出る前（送る・実行する前）だけ。出たあとは差し戻しの書き込みで直す</div></div>' % MUTED)
save("ApHistory.dc.html", "決めた履歴", drawer(A, dr, 520, "決めた履歴"))
# 6 まとめて承認
it = lambda key, t, why, ok: '<div style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid %s; background: %s; border-radius: 8px">%s<div style="flex: 1; min-width: 0"><div><a href="TicketDetail.dc.html" style="font-size: 12px">%s</a> %s</div><div style="font-size: 11px; color: %s">%s</div></div></div>' % ((("#DDE2E9", "#FFFFFF") if ok else ("#F1D9A8", "#FFF8EE")) + (check("", ok).replace("padding: 4px 0", "padding: 0"), key, t, "#4A5563" if ok else "#7A4A05", why))
s = modal(A, mhead("選んだものをまとめて承認", "Approvals.dc.html", "", "4 件を選んでいる ・ 承認すると分身が送る・実行する")
  + mbody('<div>' + lab("まとめて承認してよい条件", "（決まっていて変えられない・D-128.35）") + '<div style="display: flex; gap: 4px; flex-wrap: wrap">' + pill("確認がすべて ① 機械で通過・確実", "#E8F5EC", "#166534") + pill("人が見る項目が無い", "#E8F5EC", "#166534") + pill("取り消せる操作だけ（外に送らない）", "#E8F5EC", "#166534") + '</div></div>'
  + '<div style="display: flex; flex-direction: column; gap: 6px">'
  + it("KR-031", "入金の照合（10月分）", "条件をすべて満たす ・ 社内だけ・取り消せる", True)
  + it("EG-127", "発注ナビ 応募文 3 本", "外した：3 社に送る（外に出ると取り消せない） → 1 件ずつ見る", False)
  + it("EG-133", "打ち合わせのまとめを共有", "条件をすべて満たす", True)
  + it("EG-128", "セイコー様へ 11月分の請求書を送る", "外した：メールを送る（取り消せない）・ ③「送る前に PDF を目で見る」がある → 1 件ずつ見る", False)
  + '</div>'
  + '<div style="font-size: 12px; color: %s">外したものは「続けて裁く」で 1 件ずつ見られる。条件は安全のため決まっていて、管理者も広げられない</div>' % MUTED)
  + mfoot(btn("やめる", "", "Approvals.dc.html"), btn("外したものを 1 件ずつ見る", "", "ApprovalsFocus.dc.html"), btn("2 件を承認する", "p", "ApHistory.dc.html")), 640, "まとめて承認")
save("ApBulk.dc.html", "まとめて承認", s)

C = base("Calendar")
# 7 日をクリック
day = ('<div style="display: flex; align-items: center; gap: 8px; padding: 0 2px 8px"><b style="flex: 1">11/5（水）</b><span style="font-size: 11px; color: #B45309">セイコー様の締め</span><a href="Calendar.dc.html" aria-label="閉じる" style="color: #4A5563; text-decoration: none">×</a></div>'
  + "".join('<a href="TicketDetail.dc.html" style="display: flex; gap: 8px; align-items: center; padding: 6px; border-radius: 6px; text-decoration: none; color: #131B27">%s<span style="flex: 1; min-width: 0"><span style="font-size: 11px; color: %s">%s</span> %s</span>%s</a>' % ('<span style="width: 4px; height: 26px; border-radius: 2px; background: %s"></span>' % c, MUTED, k, t, pill(st)) for k, t, st, c in [("EG-126", "更新の見積を作る", "確認中", "#6D4AA6"), ("EG-119", "山田様に一次返信", "渡し中", "#7E570D"), ("KR-034", "10月分の経費をまとめる", "未着手", "#6B7585")])
  + SEP + '<div style="display: flex; gap: 6px; align-items: center"><input placeholder="この日が期限のチケットを作る" style="flex: 1; height: 30px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 8px; font-family: inherit; font-size: 12px">' + btn("作る", "p", "Create.dc.html") + '</div>'
  + '<div style="font-size: 11px; color: %s; margin-top: 6px">チケットをほかの日へつかんで動かすと、期限が変わる（確かめる小窓が出る）</div>' % MUTED)
save("CalDay.dc.html", "カレンダーの日を開く", float_pop(C, day, "top: 300px; left: calc(50% - 40px); width: 340px"))

G = base("Gantt")
# 8 ガントのバーを動かした
s = modal(G, mhead("期限を動かしますか", "Gantt.dc.html", icon("期", "#B45309", 28), "EG-126 更新の見積を作る")
  + mbody('<div style="display: flex; gap: 10px; align-items: center; font-size: 14px"><span style="color: %s">期限</span><b>11/05（水）</b><span>→</span><b style="color: #22345C">11/08（土）</b><span style="font-size: 12px; color: %s">3 日後ろへ</span></div>' % (MUTED, MUTED)
  + '<div style="border: 1px solid #F1D9A8; background: #FFF8EE; border-radius: 8px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px"><b style="font-weight: 500; color: #7A4A05">あとに続くものにかかる</b><span>EG-129 契約書の更新版を送る（11/06 開始）が重なる</span><span>EG-130 更新の最終確認（11/14）は間に合う</span><span>親 EG-124 の期限 11/15 には収まる</span></div>'
  + '<div style="display: flex; flex-direction: column">' + check("あとに続く EG-129 も 3 日ずらす", True, "11/06〜11/12 → 11/09〜11/15") + check("土日を飛ばす", True, "11/08（土）→ 11/10（月）になる") + '</div>'
  + '<div>' + lab("ひとこと", "（やり取りに残り、担当の鈴木さんに知らせる）") + field("先方の確認待ちで後ろへ", True) + '</div>')
  + mfoot(btn("やめる（元に戻す）", "", "Gantt.dc.html"), btn("11/10 にする", "p", "Gantt.dc.html")), 560, "期限を動かす")
save("GtMove.dc.html", "ガントで期限を動かす", s)
# 9 開始・期限が無い
nd = ('<div style="font-size: 12px; font-weight: 500; padding: 0 4px 6px">開始・期限が無い 4 件</div>'
  + "".join('<div style="display: flex; gap: 8px; align-items: center; padding: 6px 4px; border-top: 1px solid #EDF0F4"><span style="color: #B8C0CC">⋮⋮</span><span style="flex: 1; min-width: 0"><span style="font-size: 11px; color: %s">%s</span> %s</span>%s</div>' % (MUTED, k, t, btn("日を入れる")) for k, t in [("EG-131", "セイコー様 来期の提案"), ("JD-199", "京蟻 管理画面の改善案"), ("KR-036", "年末調整の準備"), ("EG-132", "展示会の出展を決める")])
  + '<div style="font-size: 11px; color: %s; padding: 8px 4px 0">つかんでガントの日へ落とすと、その日が開始になる</div>' % MUTED)
Gp = G; a = find_button(Gp, "開始・期限が無い 4 件"); Gp = Gp.replace(a, a.replace('style="', 'aria-expanded="true" style="box-shadow: 0 0 0 2px #DCE4F2; ', 1), 1)
save("GtNoDate.dc.html", "開始・期限が無いもの", float_pop(Gp, nd, "top: 168px; right: 40px; width: 360px; max-width: calc(100vw - 32px)"))

# wire base screens
def w(name, mp):
    s = base(name); s = wire_buttons(s, mp); open(P + name + ".dc.html", "w", encoding="utf-8").write(s)
w("List", {"表示設定（列）": "LsView.dc.html", "詳しく": "LsFilter.dc.html", "まとめて操作": "LsBulk.dc.html", "検索条件を保存": "LsSave.dc.html"})
w("Approvals", {"決めた履歴": "ApHistory.dc.html", "選んだものをまとめて承認": "ApBulk.dc.html"})
w("Gantt", {"開始・期限が無い 4 件": "GtNoDate.dc.html"})
print("wired")

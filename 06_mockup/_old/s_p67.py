# -*- coding: utf-8 -*-
"""P6 人が増えたら / P7 外に説明する・出る"""
from _icons import ic
from _parts import *

ORG_CSS = """
.or{display:flex;gap:13px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line-soft)}
.or:last-child{border-bottom:0}
.or[data-l="1"]{padding-left:30px}.or[data-l="2"]{padding-left:60px}
.or-d{width:280px;flex:none}
@media(max-width:900px){.or{flex-wrap:wrap;gap:10px}
 .or[data-l="1"]{padding-left:14px}.or[data-l="2"]{padding-left:28px}.or-d{width:100%;padding-left:45px}}
"""

# ============================================================ members
def _node(name, kind, role, duties, depth, extra=""):
    kd = {"human":(pill("人"),"var(--sv)","var(--on-sv)"),
          "ai":(ai_pill("AI社員"),"var(--tertiary-c)","var(--on-tertiary-c)"),
          "clone":(f'<span class="pill" style="background:var(--tertiary)">{ic("ai")}クローン</span>',"var(--tertiary)","#fff")}[kind]
    return (f'<div class="or" data-l="{depth}">'
      f'<div style="width:32px;height:32px;border-radius:var(--r-full);background:{kd[1]};color:{kd[2]};'
      f'display:grid;place-items:center;font-size:12px;font-weight:700;flex:none">{name[0]}</div>'
      f'<div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      f'<b style="font-size:14px">{name}</b>{kd[0]}{extra}</div>'
      f'<div class="muted" style="font-size:12.5px">{role}</div></div>'
      f'<div class="or-d muted" style="font-size:12.5px">{duties}</div>{btn("編集")}</div>')

_me_list = card(table(["メンバー","種類","権限","見える範囲",("最終ログイン","r"),""], [
   ["<b>高本 雅人</b><div class='muted' style='font-size:12px'>info@engine-base.com</div>", pill("人"),
    pill("管理者","pr"), '<span class="muted" style="font-size:12.5px">すべて</span>',("いま","n"),""],
   ["<b>佐藤 健</b><div class='muted' style='font-size:12px'>sato@example.com</div>", pill("人"),
    pill("担当者"), '<span class="muted" style="font-size:12.5px">自分のタスクと、担当案件の台帳のみ</span>',
    ("昨日","n"),(btn("編集"),"r")],
   ["<b>鈴木 美咲</b><div class='muted' style='font-size:12px'>suzuki@example.com</div>", pill("人"),
    pill("招待中","wa","clock"), '<span class="muted" style="font-size:12.5px">—</span>',("—","n"),(btn("再送"),"r")],
   ["<b>AI 営業社員</b><div class='muted' style='font-size:12px'>高本 雅人 の配下</div>", ai_pill("AI社員"),
    pill("担当者"), '<span class="muted" style="font-size:12.5px">案件パイプラインのみ</span>',("今日 07:41","n"),(btn("編集"),"r")],
 ])) + card(head("権限の考え方") + table(["権限","できること","できないこと"], [
   [pill("管理者","pr"),"すべて。ポリシー・資格情報・請求の変更","運営の安全ルールの上書き · 証跡の削除"],
   [pill("担当者"),"自分のタスク・担当する台帳・承認箱の閲覧","ポリシー変更 · 資格情報の登録 · 他人の目標の編集"],
   [pill("閲覧のみ"),"見えるものを読むだけ","書き込み全般 · 承認"],
 ]) + '<p class="muted" style="font-size:12.5px;margin-top:14px">'
   '<b>AI 社員にも人と同じ権限を与えます。</b>「AI だから何でもできる」という設計にはしません。</p>')

_me_tree = ('<p class="muted" style="font-size:13px;margin-bottom:18px">'
 '人間と AI 社員が<b>同じツリーに並びます</b>。AI 社員は「ツール」ではなく「席に座っている担当者」として扱います。'
 '一人社長なら、運営 と 個人 の2層だけで成立します。</p>' +
 card(_node("株式会社ENGINE BASE","human","会社","",0,'<span class="tag">スコープ：会社</span>') +
   _node("高本 雅人","human","代表 / 営業・制作","営業 · 制作 · 経営判断",1, pill("管理者","pr")) +
   _node("経営クローン","clone","高本 雅人 の写し（1人に1体）","目標の逆算 · 再計画 · 判断の代行",2) +
   _node("AI 営業社員","ai","営業部","案件の取り込み · 追い提案 · 見積作成",2, pill("実行中","pr","play")) +
   _node("AI 経理社員","ai","経理部","請求書の作成・送付 · 入金消込 · 仕訳",2, pill("承認待ち 1","wa")) +
   _node("AI CS 社員","ai","カスタマーサクセス","問い合わせの一次返信 · FAQ更新",2) +
   _node("佐藤 健","human","外注 / フロントエンド","制作（ScoliVio）",2, pill("担当者")) +
   _node("鈴木 美咲","human","外注 / デザイン","制作（京蟻）",2, pill("閲覧のみ"))))

_me_inv = card(head("メンバーを招待する") +
  field("メールアドレス", inp("","name@example.com","email","","max-width:420px")) +
  field("権限", '<select class="inp" style="max-width:420px"><option>担当者</option><option>閲覧のみ</option>'
        '<option>管理者</option></select>') +
  field("見える範囲", '<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">' + "".join(
    f'<label style="display:flex;gap:9px;align-items:center;font-weight:400">'
    f'<input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C">{t}</label>'
    for t, c in [("自分のタスク",True),("案件パイプライン（担当する案件のみ）",True),("請求",False),("目標（全社）",False)]) + '</div>') +
  note("招待した人には<b>クローンが1体つきます</b>（1人に1体）。その人の判断を代行する存在なので、他の人からは操作できません。", "info") +
  note("<b>招待された人には、参加する前に「自分に何が見えるか」が表示されます。</b>"
       "見えないものも明示するので、あとから「見えると思っていた」が起きません。", "primary"))

MEMBERS = ("members", [("l","一覧","",_me_list),
  ("t","組織ツリー","人とAI社員が同じツリーに並ぶ。スコープ4層。",_me_tree),
  ("i","招待する","",_me_inv)], ORG_CSS, False)

# ============================================================ audit
_au = ('<div style="display:flex;gap:9px;align-items:center;margin-bottom:18px;flex-wrap:wrap">'
 '<button class="btn btn-p btn-sm">今日</button><button class="btn btn-g btn-sm">直近30日</button>'
 '<select class="inp" style="max-width:180px;padding:7px 12px;font-size:13px">'
 '<option>操作者：すべて</option><option>高本 雅人</option><option>佐藤 健</option><option>AI 営業社員</option></select>'
 '<div style="flex:1"></div>' + btn("書き出す","o","file","v1-audit-export.html") + '</div>' +
 note("<b>この記録は追記専用です。</b>書き換えも削除もできません。管理者にも運営にもできません。"
      "退会しても、法定保存期間のあいだは保持されます。", "primary") +
 card(table([("時刻","r"),"操作者","したこと","対象","権限"], [
   [("09:14:02","n muted"),"<b>高本 雅人</b>","請求書の送付を承認した","INV-2026-0912 · 株式会社◯◯",pill("管理者","pr")],
   [("09:12:16","n muted"),ai_pill("AI 経理社員"),"覚えた操作が中断した","◯◯銀行の入金明細を確認",pill("担当者")],
   [("08:41:33","n muted"),"<b>高本 雅人</b>","ポリシーを変更した",
    "請求書を送る：自動 → <b>承認</b>",pill("管理者","pr")],
   [("07:41:12","n muted"),ai_pill("AI 営業社員"),"台帳に5行を追加した","案件パイプライン",pill("担当者")],
   [("07:02:38","n muted"),ai_pill("AI CS 社員"),"問い合わせ4件に返信した","—",pill("担当者")],
   [("昨日 22:10","n muted"),"<b>佐藤 健</b>","タスクを完了にした","ScoliVio デザイン修正",pill("担当者")],
   [("昨日 18:04","n muted"),"<b>高本 雅人</b>","資格情報を登録した",
    "freee 会計（<b>中身は記録していません</b>）",pill("管理者","pr")],
 ])))

AUDIT = ("audit", [("l","一覧","",_au)], "", False)

# ============================================================ audit-export
_ae = (f'<a href="v1-audit.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}証跡に戻る</a>' +
 grid([
  card(head("証跡を書き出す") +
    '<p class="muted" style="font-size:13px;margin-bottom:18px">'
    '監査・情シスへの提出用に、期間を選んで全操作の記録を書き出します。</p>' +
    field("期間", '<div style="display:flex;gap:9px;align-items:center">'
      '<input class="inp num" value="2026-04-01" style="max-width:150px"><span class="muted">〜</span>'
      '<input class="inp num" value="2026-09-08" style="max-width:150px"></div>',
      "この期間の記録は <b class='num'>18,402</b> 件です") +
    field("含めるもの", '<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">' + "".join(
      f'<label style="display:flex;gap:9px;align-items:flex-start;font-weight:400">'
      f'<input type="checkbox" {"checked" if c else ""} {"disabled" if d else ""} style="margin-top:3px;accent-color:#22345C">'
      f'<div><b>{t}</b><div class="muted" style="font-size:12px">{s}</div></div></label>'
      for t, s, c, d in [
        ("人の操作","誰がいつ何をしたか",True,False),
        ("AI社員の実行","何を実行し、どの関門を通ったか",True,False),
        ("承認の記録","誰が何を承認・却下したか",True,False),
        ("ポリシーの変更","いつ誰が自動／承認／禁止を変えたか",True,False),
        ("資格情報の中身","<b>含められません。</b>参照した事実のみ記録しています",False,True),
      ]) + '</div>') +
    field("形式", '<div style="display:flex;gap:9px;flex-wrap:wrap">' + "".join(
      f'<label style="display:flex;gap:8px;align-items:center;padding:10px 16px;border:1.5px solid '
      f'{"var(--primary)" if i==0 else "var(--line)"};{"background:var(--primary-c);" if i==0 else ""}'
      f'border-radius:var(--r-md);font-size:13.5px"><input type="radio" name="f" {"checked" if i==0 else ""} '
      f'style="accent-color:#22345C">{x}</label>' for i, x in enumerate(["CSV","JSON Lines","PDF（要約つき）"])) + '</div>') +
    note("書き出したファイルには<b>改ざん検出用のハッシュ</b>が付きます。"
         "受け取った側が「途中で書き換えられていないこと」を確認できます。", "info")),
  card(head("過去の書き出し") +
    table(["期間",("件数","r"),("日時","r")], [
      ["2026-04-01 〜 06-30",("9,140","n"),("07-02","n muted")],
      ["2026-01-01 〜 03-31",("7,882","n"),("04-03","n muted")]])) +
  card(head("何に使うか") +
    '<p style="font-size:13px;line-height:1.85">'
    '情シス・コンプライアンス部門から「AIが何をしたか全部見せてほしい」と言われたときに、'
    'この画面から出したファイルをそのまま渡せます。<br><br>'
    '<b>Kaname 運営はこの記録を見られません。</b>出すかどうかを決めるのはお客様です。</p>'),
 ], "g21"))

AUDIT_EXPORT = ("audit-export", [("e","書き出し","情シスへの出口。ここが無いと「AIが何をしたか説明できない」で止まる。",_ae)], "", False)

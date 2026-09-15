# -*- coding: utf-8 -*-
"""P5 例外：automation-repair / audit / policies"""
from _icons import ic
from _parts import *
from s_p2 import clone_box
from _org import *

# ============================================================ automation-repair
_ar = grid([
  card(head("止まっているもの", sub="1件") +
    f'<div style="display:flex;gap:12px;align-items:flex-start;padding:14px;background:#FEF6EC;border-radius:var(--r-md);margin-bottom:16px">{ic("warn")}<div><b>発注ナビ 新着案件の取り込み</b> が手順 3/6 で止まりました<div class="muted" style="font-size:12.5px;margin-top:4px">9/10 06:03 · 「条件で絞る」のボタンが見つからない · 発注ナビの画面が変わった可能性</div></div></div>' +
    table(["手順","意味で記録した内容","状態"], [
      ["1","developer.hnavi.co.jp にログインする（資格情報 cr_8a21）",pill("OK","su")],["2","新着案件の一覧を開く",pill("OK","su")],
      ["3","条件（Web/アプリ・100万円以上）で絞る",pill("見つからない","da","x")],["4","1件ずつ詳細を開いて要件を読む",pill("未実行","ne")],
      ["5","条件に合うものを台帳「案件」に入れる",pill("未実行","ne")],["6","合わないものは理由を付けて見送る",pill("未実行","ne")]]) +
    '<div class="muted" style="font-size:12px;margin-top:10px">座標ではなく<b>意味</b>で記録しているので、ボタンの位置が変わっただけなら自動で追従します。今回は絞り込みのUIそのものが変わったようです。</div>'),
  card(head("覚え直させる") +
    f'<div class="ai" style="margin-bottom:14px"><div class="ai-h">{ic("clone")}高本AI</div>発注ナビの絞り込みが「検索条件」パネルに移動しています。<b>AIに画面を見せて手順 3 だけ作り直させます</b>。あなたのブラウザで動くので、ログインし直しは要りません。2〜3分です。</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' + "".join(
      f'<label style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;background:{"var(--primary-c)" if on else "var(--surface)"};border-radius:var(--r-md);font-size:13px"><input type="radio" name="fx" {"checked" if on else ""} style="margin-top:3px;accent-color:#22345C"><div><b>{t}</b><div class="muted" style="font-size:12px">{d}</div></div></label>'
      for t,d,on in [("AIに覚え直させる","画面を見て手順 3 を作り直す。できたらテストモードで1回動かして見せる",True),("自分でやって見せる","あなたが1回操作し、それを意味で記録する",False),("この手順はやめる","担当業務から外す。台帳への取り込みは手作業になる",False)]) + '</div>' +
    btn("覚え直させる","p","wrench")),
], "g2")
_ar_done = card(f'<div style="display:flex;gap:12px;align-items:center;padding:14px;background:#DCFCE7;border-radius:var(--r-md);margin-bottom:16px">{ic("check")}<div><b>覚え直しました。</b>手順 3 を「検索条件パネルを開く → 種別と金額を入れる → 適用」に置き換え、テストモードで1回通しました（12件取得）。</div></div>' +
  table(["版","日付","変わった手順","誰が"], [["第3版",("9/10","n"),"手順3（絞り込みUIの変更に追従）","AI（あなたが承認）"],["第2版",("8/20","n"),"手順5（台帳の項目追加に追従）","AI"],["第1版",("9/4","n"),"はじめの設定時に記録","あなたの操作から"]]) +
  '<div style="margin-top:14px">' + btn("自動実行を再開する","p","play") + '</div>')
_ar0 = card(empty("wrench","止まっているものはありません","外部サービスの画面が変わって止まったとき、ここに出ます。覚えた操作は意味で記録しているので、小さな変更なら自動で追従します。"))
AUTO_REPAIR = ("automation-repair", [("n","止まっている","",_ar),("d","覚え直した","",_ar_done),("0","何もない","",_ar0)],
  "", False, {"止まっているもの":"!1","覚え直す":"","版の履歴":"3"})

# ============================================================ audit
_au_rows = [
  ("09:14","高本","高本AIに指示","「セイコーの着手金、請求書作っておいて」","会話"),
  ("09:14","高本AI","経理社員に配る","着手金 990,000 の請求書作成","—"),
  ("07:02","CS社員","メール送信 2件","問い合わせへの一次返信（承認済みテンプレ）","通信・通知"),
  ("06:42","高本AI","承認待ちへ","京蟻 請求書 1,826,000（差し戻し2回のあと）","—"),
  ("06:40","営業社員","メール下書き","セイコー様への追いメール → 高本AI確認へ","AI"),
  ("06:31","経理社員","台帳に書く","入金 2件を照合（freee 正規API）","通信・保存"),
  ("06:03","営業社員","止まった","発注ナビ 取り込み · 手順3 見つからない","実行"),
  ("06:00","営業社員","ブラウザ操作","発注ナビ にログイン（cr_8a21 · Bridge）","実行・預かり先"),
]
def _au_table(rows):
  return table([("時刻",""),"誰が","何を","内容","経路"], [[(t,"n"),f'{ic("clone") if w=="高本AI" else (ic("ai") if "社員" in w else ic("user"))} {w}',a,d,'<span style="font-family:var(--font-code);font-size:11.5px">'+c+'</span>'] for t,w,a,d,c in rows])
_au = card(head("証跡", btn("書き出す","o","download") + btn("期間","g","down"), "9/10 · 全 31件") +
  '<div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap">' + "".join(f'<span style="font-size:12px;font-weight:600;padding:4px 11px;border-radius:var(--r-full);background:{"var(--primary-c)" if i==0 else "var(--sv)"}">{s}</span>' for i,s in enumerate(["すべて","人","高本AI","AI社員","外に出たもの"])) + '</div>' +
  _au_table(_au_rows) + '<div class="muted" style="font-size:12px;margin-top:10px">外に影響する操作は必ず Kaname を通り、ここに残ります。を通らない経路はありません。</div>')
_au_undo = grid([
  card(head("取り消す", pill("メール送信 · 07:02","ne")) + kv([("何を","◇◇様への一次返信（CS社員）"),("送った先","info@example.co.jp"),("経路","Google Workspace 正規API")]) +
    f'<div class="ai" style="margin:14px 0;background:#FEF6EC;border-left-color:var(--st-warning);color:#7A4A05"><div class="ai-h">{ic("warn")}高本AI</div>送ったメールは<b>取り消せません</b>（相手に届いています）。できるのは、訂正メールを下書きして承認待ちに上げることです。台帳の「返信済み」は戻せます。</div>' +
    '<div style="display:flex;gap:9px">' + btn("訂正メールを下書きさせる","p","pen") + btn("台帳だけ戻す","o","undo") + btn("やめる","g") + '</div>'),
  card(head("取り消せるもの・取り消せないもの") + table(["操作","取り消し"], [["台帳の更新",pill("できる","su")],["タスクの完了",pill("できる","su")],["下書き（未送信）",pill("できる","su")],["メール送信・投稿",pill("できない → 訂正を送る","da")],["請求書の送付",pill("できない → 取消の請求書","da")]])),
], "g2")
_au_export = card(head("書き出す") + field("期間", inp("2026-07-01 〜 2026-09-10")) + field("形式", '<select class="inp"><option>CSV</option><option>JSON</option><option>PDF（監査提出用）</option></select>') +
  field("含めるもの", '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<label style="display:flex;gap:8px"><input type="checkbox" checked style="accent-color:#22345C">{t}</label>' for t in ["人の操作","高本AIの判断（差し戻し・確認）","AI社員の実行","外に出たもの","資格情報の使用（誰が・いつ・どの預かり先の番号）"]) + '</div>') +
  btn("書き出す","p","download") + '<div class="muted" style="font-size:12px;margin-top:12px">残留物ゼロ：書き出したファイルは Kaname のサーバーに残りません。</div>')
_au_ops = ('<div data-sec="0 1 2 3 4">' + "".join([
  card(head("運営にサポートアクセスを許可する", sub="運営は既定であなたのデータを見られません。困ったときだけ、範囲と期限を決めて許可します") +
    field("範囲", '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' + "".join(f'<label style="display:flex;gap:8px"><input type="checkbox" {"checked" if c else ""} style="accent-color:#22345C">{x}</label>' for x, c in [("構成（プラン・AI社員の体数・版・止まっている型）— いつでも見える",True),("覚えた操作の手順（画面の中身は含まない）",True),("証跡（誰が・いつ・何を）",False),("台帳の中身",False),("会話・記憶",False)]) + '</div>') +
    field("期限", '<select class="inp"><option>24 時間</option><option>3 日</option><option>7 日</option><option>この詰まりが直るまで（最長 14 日）</option></select>') +
    field("理由（運営に伝わる）", inp("発注ナビの取り込みが止まっている（9/14〜）")) +
    '<div class="acts">' + btn("許可する","p","check") + btn("やめる","g") + '</div>' +
    '<div class="muted" style="font-size:12px;margin-top:12px">許可した範囲・期限・運営が実際に見たものは、この証跡と運営側の証跡の両方に残ります。いつでも取り消せます。</div>'),
  card(head("許可の記録", sub="運営が見たものは 1 件ずつ残る") + table(["いつ","範囲","期限","運営が見たもの","状態",""], [
    [("9/14 18:20","n"),"構成＋覚えた操作の手順","3 日（9/17 まで）","覚えた操作「発注ナビ 新着案件の取り込み」手順 3 を 9/14 18:41 に閲覧",pill("有効","su"),btn("取り消す","g","x")],
    [("8/2 10:05","n"),"構成＋証跡","24 時間","証跡 8/1〜8/2 を 8/2 10:30 に閲覧",pill("期限切れ","ne"),""]]) +
    note("運営が見られるのは許可した範囲だけ。許可の無い閲覧は設計上できません（運営側の画面にも「見られない」と出ます）。", "info")),
]) + '</div>')
AUDIT = ("audit", [("n","すべて","全操作が残る。",_au),("u","取り消す","取り消せないものは正直に言い、次の一手を出す。",_au_undo),("x","書き出す","",_au_export),("o","運営のアクセス","運営は既定で見られない。範囲と期限つきの許可だけ。",_au_ops)],
  "", False, {"すべて":"31","承認":"3","AIの実行":"12","取り消し":"0","運営のアクセス":"1"})

# ============================================================ policies（範囲ごとの札：運営は鍵。層は会社ごと。役割ごとに見える・直せるが変わる：D-073）
PO_CSS = """
.rg{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));margin-bottom:16px}
.rsec{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden;display:flex;flex-direction:column}
.rsec.locked{background:var(--surface)}
.rsec .rh{display:flex;gap:9px;align-items:center;padding:10px 14px;border-top:3px solid var(--sc);font-weight:700;font-size:13.5px;flex-wrap:wrap}
.rsec .rh .n{font-weight:500;color:var(--on-sv);font-size:11.5px}
.rsec .rh .who{margin-left:auto;font-size:11.5px;font-weight:500;color:var(--on-sv);display:inline-flex;gap:5px;align-items:center;white-space:nowrap}
.rsec .rh .who svg{width:13px;height:13px}
.rc{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:center;padding:11px 14px;border-top:1px solid var(--line-soft);font-size:13px}
.rc .ri{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--sv);color:var(--on-sv)}
.rc .ri.no{background:#FEE2E2;color:#991B1B}.rc .ri.ok{background:#FCEBD5;color:#7E570D}.rc .ri.up{background:#E9E0F5;color:#6D4AA6}
.rc .tx{min-width:0}.rc b{display:block}.rc small{display:block;color:var(--on-sv);font-size:12px;margin-top:2px;line-height:1.45}
.rc .lk{color:var(--on-sv);display:inline-flex;align-items:center}.rc .lk svg{width:15px;height:15px}
.rsec .none{padding:22px 14px;text-align:center;color:var(--on-sv);font-size:12.5px;flex:1;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center}
.rsec .foot{padding:8px 14px 10px;border-top:1px solid var(--line-soft);margin-top:auto}
.ladder{display:flex;flex-direction:column;gap:8px}
.ld{display:grid;grid-template-columns:118px 1fr;gap:10px}
.ld .lv{border-radius:var(--r-md);padding:9px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px}
.ld .lv svg{width:14px;height:14px}
.ld .lv.su{background:#DCFCE7;color:#166534}.ld .lv.wa{background:#FCEBD5;color:#7E570D}.ld .lv.da{background:#FEE2E2;color:#991B1B}.ld .lv.ne{background:var(--sv);color:var(--on-sv)}
.ld .it{display:flex;flex-wrap:wrap;gap:6px;align-content:center}
.ld .it span{font-size:12.5px;padding:5px 10px;border:1px solid var(--line);border-radius:var(--r-full);background:var(--card)}
@media(max-width:767px){.ld{grid-template-columns:1fr}}
"""
# (層, 単位, アイコン, 種別, 題名, 説明)
RULES = [
 ("運営","","ban","no","CAPTCHA は突破しない","出たら止めて人に渡す。突破すると顧客のアカウントが凍結される"),
 ("運営","","ban","no","銀行はブラウザで触らない","会計ソフトの正規連携（API）経由のみ"),
 ("運営","","ban","no","規約で自動操作を禁じるサービスは操作しない","サービス台帳で判定"),
 ("運営","","ban","no","資格情報を AI に渡さない","預かり先の番号だけ。入力は実行器"),
 ("会社","","inbox","ok","外に出るものは必ず承認","メール・請求書・投稿・台帳の外部更新"),
 ("会社","","ban","no","金額の話は AI社員がしない","値引き・見積の提示は人"),
 ("会社","","clock","ok","夜間（22〜6時）は外に出さない","下書きまで。朝の承認で出る"),
 ("事業","受託開発","flag","up","見積は工数の 1.3 倍で出す","手戻り分を乗せる。記憶「判断の癖」から昇格"),
 ("部署","制作","inbox","ok","納品は佐藤の確認を通す","ステージングで 1 日置いてから"),
 ("個人","高本","flag","up","初回は紹介でも値引きしない","記憶「判断の癖」から昇格 · 高本AIの提案 → 高本が承認"),
 ("個人","佐藤","clock","ok","金曜午後は打ち合わせを入れない","記憶から昇格 · 佐藤が決めた"),
 ("個人","鈴木","flag","up","進捗は週明けにまとめて見る","鈴木が決めた"),
]
def _rc(icon, kind, t, d, editable):
    return (f'<div class="rc"><span class="ri {kind}">{ic(icon)}</span><div class="tx"><b>{t}</b><small>{d}</small></div>'
            + (btn("直す","g","pen") if editable else f'<span class="lk" title="この範囲は直せません">{ic("lock")}</span>') + '</div>')
def _rsec(role, l, u, rules):
    ok = can_edit(role, l, u); locked = (l == "運営")
    name = ("自分" if (l == "個人" and (u == me_of(role))) else scope_name(l, u))
    body = "".join(_rc(i, k, t_, d, ok) for (_, _, i, k, t_, d) in rules) if rules else (
        f'<div class="none">{ic("policy")}この範囲のルールはまだありません' + (f'<span class="muted" style="font-size:12px">{editor(l,u)} が足せます。会社のルールはそのまま効きます。</span>' + btn("足す","o","plus") if ok else f'<span class="muted" style="font-size:12px">足せるのは {editor(l,u)}</span>') + '</div>')
    who = ("変えられない" if locked else (f"編集：{editor(l,u)}" + ("" if ok else " · 見るだけ")))
    return (f'<div class="rsec{" locked" if locked else ""}" style="--sc:{LAYER_C[l]}"><div class="rh">{name}<span class="n">{len(rules)}</span><span class="who">{ic("lock") if (locked or not ok) else ic("pen")}{who}</span></div>{body}'
            + (f'<div class="foot">{btn("足す","o","plus")}</div>' if (ok and rules) else "") + '</div>')
def _po_for(role):
    cfg = ROLE_ORG[role]; me = cfg["me"]; secs = ""
    scopes = [("運営","")] + ([("会社","")] if cfg["layers"] else [])
    for l in cfg["layers"]:
        for u, _ in UNITS[l]:
            if can_see(role, l, u): scopes.append((l, u))
    scopes.append(("個人", me))
    for l, u in scopes:
        rules = [r for r in RULES if r[0] == l and r[1] == u]
        if l == "部署" and not rules and role != "R2": continue      # 他の部署の空札は出さない
        secs += _rsec(role, l, u, rules)
    layers = "会社 › " + " › ".join(cfg["layers"]) + " › 個人" if cfg["layers"] else "個人だけ"
    hd = f'<div class="muted" style="font-size:12.5px;margin-bottom:12px">層：{layers}。近い範囲が勝ちます（個人 › 層 › 会社 › 運営）。運営の安全ルールだけは上書きできません。</div>'
    return f'<div data-roles="{role}">{hd}<div class="rg">{secs}</div></div>'
_ladder = card(head("AI にやらせる範囲", sub="4 段。上ほど自動。ルールはこの段を動かす") + '<div class="ladder">' + "".join(
    f'<div class="ld"><span class="lv {k}">{ic(i)}{lv}</span><div class="it">' + "".join(f'<span>{x}</span>' for x in items) + '</div></div>'
    for k, i, lv, items in [("su","check","自動でよい",["台帳への書き込み","下書き（メール・請求書）","記憶に覚える（人が書いたもの）"]),
                            ("wa","clock","下書きまで",["夜間の外向き（22〜6時）","記憶に覚える（AI が拾ったもの）"]),
                            ("wa","inbox","必ず承認",["送信・送付・投稿","台帳の外部更新","CS社員の一次返信"]),
                            ("da","ban","やらせない",["支払い・購入","銀行の画面","CAPTCHA","値引き・金額の提示"])]) + '</div>' +
  clone_box("高本AI","「送信は承認」を「CS社員の一次返信だけ自動」に緩めると、承認待ちが1日2件減ります。テンプレの範囲内に限るなら、リスクは低いと思います。", btn("そうする","o","check")+btn("今のまま","g")))
_po = "".join(_po_for(r) for r in ("R1","R2","R3","R4")) + f'<div data-roles="R1 R2">{_ladder}</div>'
POLICIES = ("policies", [("n","ルール","運営ルールは変えられない。範囲（運営／会社／この会社の層／個人）で編集できる人が決まる。自分のものは自由。",_po)], PO_CSS + ORG_CSS, False, {"運営":"4","会社":"3","層ごと":"2","個人":"1"})

SCREENS = [AUTO_REPAIR, AUDIT, POLICIES]

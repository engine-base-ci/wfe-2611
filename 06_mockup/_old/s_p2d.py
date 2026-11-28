# -*- coding: utf-8 -*-
"""P2 毎日（続き3）：chat / search"""
from _icons import ic
from _parts import *

CHAT_CSS = """
.chat{display:flex;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden;min-height:600px}
.msgs{flex:1;display:flex;flex-direction:column;min-width:0}
.msgs-b{flex:1;padding:22px;display:flex;flex-direction:column;gap:17px}
.m{display:flex;gap:11px;max-width:82%}
.m .av{width:28px;height:28px;border-radius:var(--r-full);display:grid;place-items:center;font-size:11px;font-weight:700;flex:none}
.m .bd{background:var(--surface);border-radius:var(--r-md);padding:12px 15px;font-size:13.5px;line-height:1.85}
.m.me{margin-left:auto;flex-direction:row-reverse}
.m.me .av{background:var(--primary);color:#fff}
.m.me .bd{background:var(--primary);color:#fff}
.m.ai .av{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.m.ai .bd{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.m .who{font-size:11px;color:var(--on-sv);margin-bottom:4px;font-weight:600}
.msgs-f{border-top:1px solid var(--line);padding:14px 18px;display:flex;gap:9px;align-items:flex-end}
@media(max-width:900px){.m{max-width:94%}.msgs-b{padding:16px}}
.sr{display:flex;gap:13px;padding:14px 0;border-bottom:1px solid var(--line-soft)}
.sr:last-child{border-bottom:0}
.sr .ico{width:32px;height:32px;border-radius:var(--r-md);background:var(--sv);display:grid;place-items:center;flex:none;color:var(--on-sv)}
.sr .t{font-weight:600;font-size:13.5px;margin-bottom:2px}
.sr .s{font-size:12.5px;color:var(--on-sv);line-height:1.7}
.sr mark{background:#FDF0C8;color:inherit;padding:0 2px;border-radius:2px}
"""

def _chat(msgs, footer):
    return f'<div class="chat"><div class="msgs"><div class="msgs-b">{msgs}</div><div class="msgs-f">{footer}</div></div></div>'

_M = f"""
<div class="m me"><div class="av">高</div><div><div class="bd">今期このままいくと、いくらで着地する？</div></div></div>
<div class="m ai"><div class="av">{ic("ai")}</div><div><div class="who">AI 経営クローン</div><div class="bd">
 <b>10,000,000（目標比 83.3%）</b>で着地する見込みです。<br><br>
 根拠は3つです。<br>
 ① 受注済 8,330,000 は確定<br>
 ② 内定 2,400,000 のうち、過去の内定→受注率 82% で 1,970,000<br>
 ③ 制作に配った 2,000,000 は着手ゼロで、残り22日では新規に積めない<br><br>
 <span class="num">①+②</span> で 10,300,000。ただし ScoliVio 様の未入金 1,100,000 が
 今期中に入らない可能性があるため、堅めに 10,000,000 と見ています。</div>
 <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">
 {btn("この見込みを目標に反映","o",None,"v1-goals.html")}{btn("根拠の台帳を開く","g",None,"v1-ledger.html")}</div></div></div>
<div class="m me"><div class="av">高</div><div><div class="bd">制作の2,000,000を埋めるには何をすればいい？</div></div></div>
<div class="m ai"><div class="av">{ic("ai")}</div><div><div class="who">AI 経営クローン</div><div class="bd">
 新規で取るのは間に合いません。<b>既存案件の追加開発</b>が現実的です。<br><br>
 ScoliVio 様は 3D の追加開発を 1,500,000 で提案済み（4日経過）。
 REMARE 様は前回「来期やりたい」と言われた Cloudflare 移行が 600,000 相当あります。
 この2件を今期に前倒しできれば 2,100,000 で埋まります。</div>
 <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">{btn("2件のタスクを作る","p","check")}</div></div></div>"""

_F = ('<textarea class="inp" rows="1" placeholder="クローンに聞く／AI社員に指示する／人に話しかける" style="resize:none"></textarea>'
      f'<button class="btn btn-p">{ic("arrow")}送る</button>')

_M_TH = _M + f"""
<div class="m me"><div class="av">高</div><div><div class="bd">その2件、先方の温度感も含めて整理して</div></div></div>
<div class="m ai"><div class="av">{ic("ai")}</div><div><div class="who">AI 経営クローン</div>
 <div class="bd" style="display:flex;gap:10px;align-items:center">
  <span class="spin dark"></span><span style="color:var(--on-sv)">2つの台帳と過去の会話を読んでいます…</span></div>
 <div class="muted" style="font-size:11.5px;margin-top:6px;font-family:var(--font-code)">
  案件パイプライン（34行）→ 完了<br>会話履歴（ScoliVio・REMARE）→ 読み込み中<br>
  関門 C2（永続化・読み取り）· C3（モデル呼び出し）</div></div></div>"""

_F_TH = ('<textarea class="inp" rows="1" placeholder="返答を待っています…" disabled style="resize:none;opacity:.6"></textarea>'
         f'<button class="btn btn-g" disabled style="opacity:.5">{ic("pause")}止める</button>')

_M_SENT = _M + f"""
<div class="m ai"><div class="av">{ic("ai")}</div><div><div class="who">AI 経営クローン</div><div class="bd">
 2件のタスクを作りました。あわせて、<b>ScoliVio 様への追い提案メール</b>は外に出る操作なので
 そのまま送らず<b>承認箱に入れて</b>あります。</div></div></div>
<div style="align-self:center;max-width:580px;width:100%">
 <div class="card" style="border-color:var(--st-warning);margin:0">
  <div style="display:flex;gap:11px;align-items:flex-start">{ic("inbox")}
   <div style="flex:1"><div style="font-weight:600;font-size:13.5px;margin-bottom:3px">承認箱に1件入りました</div>
    <div class="muted" style="font-size:12.5px">ScoliVio 様への追い提案メール · 関門 C1（ネットワーク）</div></div>
   {btn("承認へ","o",None,"v1-approval-detail.html")}</div></div>
 <p class="muted" style="font-size:12px;text-align:center;margin-top:9px">
  会話の中でも、外に出る操作は必ず承認箱を通ります。会話から直接送信されることはありません。</p></div>"""

CHAT = ("chat", [
  ("n","通常","人↔クローン・人↔AI社員・人↔人・AI↔AI を同じスレッドで扱う。区別しない。", _chat(_M, _F)),
  ("t","AI が考えている","何を読んでいるか・どの関門を通っているかを隠さない。", _chat(_M_TH, _F_TH)),
  ("s","承認箱に送られた","会話から直接送信はできない。外に出るものは必ず承認箱を通る。", _chat(_M_SENT, _F)),
], CHAT_CSS, False)

# ============================================================ search
def _sr(icon, t, s, meta):
    return (f'<div class="sr"><div class="ico">{ic(icon)}</div><div style="flex:1;min-width:0">'
            f'<div class="t">{t}</div><div class="s">{s}</div></div>'
            f'<div class="muted num" style="font-size:11.5px;white-space:nowrap">{meta}</div></div>')

_se = ('<div style="display:flex;gap:9px;align-items:center;margin-bottom:20px">'
 f'<div style="flex:1;position:relative">'
 f'<span style="position:absolute;left:13px;top:11px;color:var(--on-sv)">{ic("search")}</span>'
 '<input class="inp" value="セイコー" style="padding-left:38px;font-size:15px;padding-top:11px;padding-bottom:11px"></div>'
 f'<button class="btn btn-p">{ic("search")}探す</button></div>' +
 '<div style="display:flex;gap:7px;margin-bottom:18px;flex-wrap:wrap">' +
 "".join(f'<button class="btn btn-{"p" if i==0 else "g"} btn-sm">{x}</button>'
         for i, x in enumerate(["すべて 12","台帳の行 3","会話 5","実行 2","担当業務 1","メンバー 1"])) + '</div>' +
 card(f'<div class="card-h">{dot("d-indigo")}<h2 style="font-size:13.5px">台帳の行</h2>'
   '<div class="sp"></div><span class="muted num" style="font-size:12px">3件</span></div>' +
   _sr("ledger", '<a href="v1-record-detail.html"><mark>セイコー</mark> 食品パッケージ画像編集SaaS</a>',
       "株式会社<mark>セイコー</mark> · 提案済 · 3,300,000 · 確度70%", "案件パイプライン<br>7日前") +
   _sr("ledger", '<a href="v1-record-detail.html">INV-2026-0705</a>',
       "株式会社<mark>セイコー</mark> · 入金済 · 440,000", "請求<br>2026-07") +
   _sr("ledger", '<a href="v1-record-detail.html"><mark>セイコー</mark> 商品画像の一括リサイズ（失注）</a>',
       "失注理由：予算が合わなかった · 180,000", "案件パイプライン<br>2026-05")) +
 card(f'<div class="card-h">{ic("chat")}<h2 style="font-size:13.5px">会話</h2>'
   '<div class="sp"></div><span class="muted num" style="font-size:12px">5件</span></div>' +
   _sr("chat", '<a href="v1-chat.html"><mark>セイコー</mark>様の稟議期間について</a>',
       "「社内の稟議に2週間かかる」と山田様。次の提案では期限を逆算して出す", "AI 営業社員<br>8月25日") +
   _sr("chat", '<a href="v1-chat.html">提案書のレビュー依頼</a>',
       "<mark>セイコー</mark>様向けの提案書、権限管理の章を厚くしたい", "佐藤 健<br>8月30日")) +
 card(f'<div class="card-h">{ic("log")}<h2 style="font-size:13.5px">実行</h2>'
   '<div class="sp"></div><span class="muted num" style="font-size:12px">2件</span></div>' +
   _sr("log", '<a href="v1-run-detail.html">追いの文面を作った</a>',
       "AI 営業社員 · 関門 C3 · 承認箱で待機中", "今日 06:30") +
   _sr("log", '<a href="v1-run-detail.html">提案書を PDF にした</a>',
       "AI 営業社員 · 関門 C4 · 完了", "9月1日")) +
 card(ai("この検索についての要約",
   "<mark>セイコー</mark>様は<b>2025年5月に一度失注</b>しています（予算が合わなかった）。"
   "その後 7月に小口の請求が1件あり、今回が3回目の接点です。<br>"
   "前回の失注理由が予算なので、<b>今回の 3,300,000 も同じ理由で止まっている可能性</b>があります。"
   "段階的に導入する案を出すと動くかもしれません。",
   btn("段階導入の案を作らせる","p","ai"))))

_se_empty = (
 '<div style="display:flex;gap:9px;align-items:center;margin-bottom:20px">'
 f'<div style="flex:1;position:relative">'
 f'<span style="position:absolute;left:13px;top:11px;color:var(--on-sv)">{ic("search")}</span>'
 '<input class="inp" value="ぬるま湯" style="padding-left:38px;font-size:15px;padding-top:11px;padding-bottom:11px"></div>'
 f'<button class="btn btn-p">{ic("search")}探す</button></div>' +
 card(empty("search", "見つかりませんでした",
   "台帳の行・会話・実行・担当業務・メンバーを横断して探しましたが、一致するものがありませんでした。",
   btn("会話でクローンに聞く","o","chat","v1-chat.html"))) +
 card(head("よく探されるもの") +
   '<div style="display:flex;gap:7px;flex-wrap:wrap">' +
   "".join(f'<button class="btn btn-g btn-sm">{x}</button>'
           for x in ["今週動いていない案件","期限超過の請求","失敗した実行","承認待ちのもの",
                     "今月追加された案件","AIが見送った案件"]) + '</div>'))

SEARCH = ("search", [
  ("r","結果あり","台帳・会話・実行・担当業務を横断する。1か所で探せないと結局スプレッドシートに戻る。",_se),
  ("e","結果なし","行き止まりにしない。会話への導線と、よく探されるものを出す。",_se_empty)], CHAT_CSS, False)

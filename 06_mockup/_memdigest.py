# -*- coding: utf-8 -*-
"""記憶の毎朝のまとめ（D-105）。「今日」の一番上のボタンと結果、記憶の画面の「確認待ち」（上がってきた記憶・食い違い）。
 時間で勝手に動かさない。人が押して始める。個人の範囲は自動で入れ、整理は前と後を残して戻せる。上の層へは本人が送る。"""
from _icons import ic
from _parts import btn, pill

DIGEST_CSS = """
.dgbar{display:flex;gap:10px;align-items:center;padding:10px 14px;margin:8px 12px;border:1px solid var(--line);border-left:3px solid var(--tertiary);border-radius:var(--r-md);background:var(--card);font-size:14px}
.dgbar .muted{font-size:12px}
.dgbar .btn{margin-left:auto}
.dg{display:flex;flex-direction:column;gap:14px}
.dg .dgh{display:flex;gap:10px;align-items:center}
.dg .dgh h2{font-size:18px;font-weight:600}
.dg .dgh .muted{font-size:12px}
.dg .grp{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card)}
.dg .grp>b{display:flex;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line-soft);font-size:14px}
.dg .grp>b .n{margin-left:auto;font-size:12px;color:var(--on-sv);font-weight:400}
.dg .it{display:flex;gap:10px;align-items:flex-start;padding:8px 14px;border-bottom:1px solid var(--line-soft);font-size:14px}
.dg .it:last-child{border-bottom:0}
.dg .it .body{flex:1;display:flex;flex-direction:column;gap:2px}
.dg .it .muted{font-size:12px}
.dg .it .acts{display:flex;gap:4px;flex:none}
.dg .ba{display:grid;gap:6px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);font-size:12px}
.dg .ba div{padding:4px 8px;border-radius:var(--r-sm)}
.dg .ba .b{background:var(--st-danger-c);color:var(--on-st-danger-c);text-decoration:line-through}
.dg .ba .a{background:var(--st-success-c);color:var(--on-st-success-c)}
.dg .to{display:inline-flex;gap:4px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:var(--r-full);padding:1px 8px}
.dg .cf{border-left:3px solid var(--st-warning)}
.dg .two{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))}
.dg .two>div{border:1px solid var(--line-soft);border-radius:var(--r-md);padding:8px 10px;font-size:14px}
.dg .two .muted{display:block;font-size:12px}
"""

def digest_bar(days=2, convs=7, running=False):
    """「今日」の一番上（D-105.2）。押さない日は溜まり、溜まっている量を出す"""
    if running:
        return (f'<div class="dgbar" role="status">{ic("brain")}<div><b>昨日の会話をまとめています…</b>'
                f'<div class="muted">会話 {convs} と承認・差し戻し 5 件を読んでいます（あなたの PC で）</div></div></div>')
    return (f'<div class="dgbar">{ic("brain")}<div><b>昨日の会話をまとめる</b><div class="muted">溜まっている分：{days} 日分・会話 {convs}（記憶に使わない会話は読みません）</div></div>'
            f'{btn("まとめる","p","play")}</div>')

def digest_result():
    """結果（D-105.4）：覚えた／まとめた（前と後）／上の層に上げる候補（上げ先を変えて送る）／捨てた（拾い直す）＋上の層で変わったこと"""
    it = lambda body, meta, acts: f'<div class="it"><div class="body">{body}<span class="muted">{meta}</span></div><div class="acts">{acts}</div></div>'
    g = lambda icon, title, n, rows, cls="": f'<div class="grp {cls}"><b>{ic(icon)}{title}<span class="n">{n}</span></b>{rows}</div>'
    return ('<div class="dg"><div class="dgh"><h2>昨日の会話から覚えたこと</h2><span class="muted">9/9〜9/10 · 会話 7 · 承認・差し戻し 5 · 7:48 にまとめた</span></div>' +
      g("check", "覚えた（あなたの記憶）", "3",
        it("<b>京蟻の窓口は経理の鈴木さん</b>", "好み・やり方 · セイコー 着手金の請求書 から", btn("直す","g","pen") + btn("消す","g","trash")) +
        it("<b>請求書は税込を先に書く</b>", "OK をもらった実例 · 差し戻し 1 件から", btn("直す","g","pen") + btn("消す","g","trash")) +
        it("<b>追いは相手の検討期限の前日に</b>", "決まり · 今月の受注の見込み から", btn("直す","g","pen") + btn("消す","g","trash"))) +
      g("layers", "まとめた（前と後を残しています）", "1",
        '<div class="it"><div class="body"><b>単価の記憶を 1 つにまとめた</b><div class="ba"><div class="b">エンジニア 1 人日 55,000 円（8 月）</div><div class="a">エンジニア 1 人日 60,000 円（9 月から）</div></div></div>'
        '<div class="acts">' + btn("戻す","g","undo") + '</div></div>') +
      g("route", "上の層に上げる候補（送るまで上がりません）", "2",
        it("<b>着手金は契約時に 3 割</b>", '上げ先 <span class="to">' + ic("layers") + '会社全体</span> · 確認する人：代表（高本）', btn("上げ先を変える","g") + btn("送る","p","send")) +
        it("<b>請求書の宛名は「御中」</b>", '上げ先 <span class="to">' + ic("layers") + '経理部</span> · 確認する人：部の長がいないので 1 つ上の 会社全体 へ', btn("上げ先を変える","g") + btn("送る","p","send"))) +
      g("trash", "捨てた（今回だけの話）", "2",
        it("明日の 10 時に電話する", "予定なのでタスクにしました", btn("拾い直す","g","undo")) +
        it("京蟻の山田さんが休暇中", "来週には変わる話", btn("拾い直す","g","undo"))) +
      g("alert", "上の層で変わったこと", "1",
        it("<b>会社全体：値引きは部長の承認が要る（決まり）</b>", "あなたの記憶「初回は紹介でも値引きしない」とぶつかりません。決まりは上の層ほど強く、あなたの記憶より優先されます", btn("見る","g","eye","v1-clone-memory.html")), "cf") +
      '</div>')

def review_queue():
    """記憶の画面の「確認待ち」（D-105.6・D-105.9）：上がってきた記憶と、メンバー同士の食い違い。OK までは送った人の記憶として効く"""
    return ('<div class="dg"><div class="dgh"><h2>確認待ち</h2><span class="muted">あなたが確認する層：会社全体・経理部（長がいないので回ってきた）</span></div>'
      '<div class="grp"><b>' + ic("route") + '上がってきた記憶<span class="n">1</span></b>'
      '<div class="it"><div class="body"><b>着手金は契約時に 3 割</b><span class="muted">高本から · 上げ先 会社全体 · 根拠：セイコー 着手金の請求書（9/10）· OK までは高本の記憶として効いています</span></div>'
      '<div class="acts">' + btn("OK（会社全体に効く）","p","check") + btn("差し戻す","g","undo") + '</div></div></div>'
      '<div class="grp cf"><b>' + ic("alert") + '食い違い（同じことへの違う提案）<span class="n">1</span></b>'
      '<div class="it"><div class="body"><b>請求の締め日</b><div class="two">'
      '<div><b>月末締め</b><span class="muted">田中から · 京蟻の請求書（9/08）の会話</span></div>'
      '<div><b>20 日締め</b><span class="muted">佐藤から · SOICO の見積（9/09）の会話</span></div></div>'
      '<span class="muted">決まるまでは、それぞれの記憶として効きます。決めたら 2 人に知らせます</span></div>'
      '<div class="acts">' + btn("月末締めにする","o") + btn("20 日締めにする","o") + btn("書き直す","g","pen") + '</div></div></div>'
      '</div>')

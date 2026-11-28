# -*- coding: utf-8 -*-
"""P3 毎週 / P4 毎月：goals / goal-allocate / retro / duties / duty-detail"""
from _icons import ic
from _parts import *

GOAL_CSS = """
.gt{display:flex;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--line-soft)}
.gt:last-child{border-bottom:0}
.gt[data-l="1"]{padding-left:30px}.gt[data-l="2"]{padding-left:60px}.gt[data-l="3"]{padding-left:90px}
.gt-m{width:240px;flex:none}
.gt-b{min-width:52px;justify-content:center}
@media(max-width:900px){.gt{flex-wrap:wrap;gap:10px}.gt-m{width:100%}
 .gt[data-l="1"]{padding-left:12px}.gt[data-l="2"]{padding-left:24px}.gt[data-l="3"]{padding-left:36px}}
"""

ROLL = {"sum":("足す","su"),"convert":("変換","pr"),"none":("足さない","ne")}

def _gt(level, badge, bk, name, sub, val, tgt, pct, cls="", unit="", roll=None):
    u = f'<span class="tag" style="font-size:11px">単位 {unit}</span>' if unit else ""
    r = ""
    if roll:
        lab, k = ROLL[roll]
        r = f'<span class="pill p-{k}" style="font-size:10.5px">{lab}</span>'
    meter = (f'<div class="gt-m"><div style="display:flex;justify-content:space-between;font-size:12.5px" class="num">'
             f'<span style="font-weight:600">{val}</span><span class="muted">/ {tgt}</span></div>'
             f'<div class="bar"><i class="{cls}" style="width:{pct}%"></i></div>'
             f'<div class="muted num" style="font-size:11.5px;margin-top:4px">{pct}%</div></div>')
    return (f'<div class="gt" data-l="{level}"><span class="pill p-{bk} gt-b">{badge}</span>'
      f'<div style="flex:1;min-width:0"><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">'
      f'<span style="font-weight:600">{name}</span>{u}{r}</div>'
      f'<div class="muted" style="font-size:12px">{sub}</div></div>{meter}</div>')

_TREE = card(head("2026年度の木", btn("改訂履歴","g","undo"), "年 → 四半期 → 月 → 今週") +
  _gt(0,"年","pr","2026年度 売上","2026-04-01 〜 2027-03-31 · 全社","28,410,000","48,000,000",59.2,unit="円") +
  _gt(1,"四半期","pr","Q3 売上",'2026-10-01 〜 2026-12-31 · 全社 · <span style="color:var(--st-progress);font-weight:600">進行中</span>',"8,330,000","12,000,000",69.4,unit="円",roll="sum") +
  _gt(2,"月","ne","9月 売上","2026-09 · 全社","2,180,000","4,000,000",54.5,"warn",unit="円",roll="sum") +
  _gt(3,"今週","ne","受注 4件","2026-09-07 〜 09-13 · 件数目標","3 件","4 件",75,"warn",unit="件",roll="convert"))

_g_ok = (_TREE + card(head("Q3 の配分", "", "配ったぶんと積み上がったぶんが同じ表に出る") +
  '<div style="margin-bottom:14px">' + pill("未配分なし","su","check") + '</div>' +
  table(["配分先","合意",("配分","r"),("実績","r"),("達成率","r"),"状態"], [
    [f'<span class="tag">{dot("d-indigo")}営業（高本）</span>', pill("合意済","su"),
     ("7,000,000","n"),("5,120,000","n"),("73.1%","n"), pill("進行中","pr","play")],
    [f'<span class="tag">{dot("d-teal")}AI 営業社員</span>', pill("合意済","su"),
     ("3,000,000","n"),("3,210,000","n"),("107.0%","n"), pill("達成","su","check")],
    [f'<span class="tag">{dot("d-sage")}制作（外注 2名）</span>', pill("確認待ち","wa"),
     ("2,000,000","n"),("0","n"),("0%","n"), pill("未着手","ne","clock")],
    ["<b>合計</b>","",('<b>12,000,000</b>',"n"),('<b>8,330,000</b>',"n"),('<b>69.4%</b>',"n"),""],
  ])) +
 card(ai("AI 経営クローンの見立て",
   "制作の 2,000,000 が着手ゼロのままです。残り 22日で外注2名の稼働を積むには、<b>今週中に発注をかける</b>必要があります。"
   "かけない場合、Q3 は 10,000,000（83.3%）で着地する見込みです。",
   btn("発注のタスクを作る","p","check") + btn("配分を組み替える","g",None,"v1-goal-allocate.html"))))

_g_gap = (_TREE + card(
  '<div class="card-h">' + ic("warn") +
  '<h2 style="color:var(--error)">Q3 の 2,000,000 が誰にも配られていません</h2><div class="sp"></div>' +
  btn("配分する","p","arrow","v1-goal-allocate.html") + '</div>' +
  '<p class="muted" style="font-size:13px;margin-bottom:16px">'
  '親の目標 12,000,000 に対して、子への配分の合計が 10,000,000 です。'
  '<b>未配分＝親の目標 − 子の合計</b> として自動で出しています。ここが赤いまま期が進むと、誰も追わない金額が残ります。</p>' +
  table(["配分先",("配分","r"),("実績","r"),("達成率","r")], [
    [f'<span class="tag">{dot("d-indigo")}営業（高本）</span>',("7,000,000","n"),("5,120,000","n"),("73.1%","n")],
    [f'<span class="tag">{dot("d-teal")}AI 営業社員</span>',("3,000,000","n"),("3,210,000","n"),("107.0%","n")],
    ['<span style="color:var(--error);font-weight:600">未配分</span>',
     ('<span style="color:var(--error);font-weight:600">2,000,000</span>',"n"),("—","n"),("—","n")],
    ["<b>合計</b>",('<b>12,000,000</b>',"n"),('<b>8,330,000</b>',"n"),('<b>69.4%</b>',"n")],
  ]), style="border-color:var(--error)"))

_g_empty = (card(empty("target","目標がまだありません",
  "Kaname は目標から逆算してタスクを配ります。まず1つだけ決めてください。年の数字が1つ決まれば、四半期・月・今週は自動で割ります。",
  btn("年の目標を作る","p","plus") + btn("会話で決める","o","chat","v1-chat.html"))) +
 card(head("目標の型") + grid([
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">数値で追う</div>'
   '<div class="muted" style="font-size:12.5px">売上・受注件数・解約率。台帳の数値が自動で積み上がる</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">状態で追う</div>'
   '<div class="muted" style="font-size:12.5px">「ISMS を取る」のように、達成／未達で判定するもの</div></div>',
   '<div style="padding:15px;background:var(--surface);border-radius:var(--r-md)">'
   '<div style="font-weight:600;margin-bottom:5px">習慣で追う</div>'
   '<div class="muted" style="font-size:12.5px">「週に30件アプローチする」のように、回数を積むもの</div></div>'], "g3")))


_TREE_MIXED = card(head("2026年度の木（部署ごとに単位が変わる）", "", "親子で単位が違ってよい") +
  _gt(0,"年","pr","2026年度 売上","全社","28,410,000","48,000,000",59.2,unit="円") +
  _gt(1,"部署","pr","営業 — 受注件数","高本 ＋ AI営業社員","28 件","40 件",70,unit="件",roll="convert") +
  _gt(2,"個人","ne","AI 営業社員 — 新規リード","毎朝の取り込み","247 件","360 件",68.6,unit="件",roll="convert") +
  _gt(1,"部署","ne","制作 — 納期遵守率","外注 2名","88%","95%",92.6,"warn",unit="%",roll="none") +
  _gt(2,"個人","ne","佐藤 健 — 手戻り率","目標は 5% 以下","7%","5%",71,"warn",unit="%",roll="none") +
  _gt(1,"部署","ne","CS — 一次返信","初回接触までの時間","19時間","24時間",100,"ok",unit="時間",roll="none"))

_g_mixed = (_TREE_MIXED +
  card(head("親への積み上がり方", "", "子が親にどう効くかは3通りしかない") +
    table(["型","この木での例",("子の実績","r"),"親への効き方","足りないの出し方"], [
      [pill("足す","su"), "（この会社では使っていない）", ("—","n"),
       "子の値をそのまま親に足す", "未配分＝親 − 子の合計"],
      [pill("変換","pr"), "営業 受注28件 × 平均単価120万", ("33,600,000","n"),
       "変換して親に足す", "変換の結果が親に届くか"],
      [pill("足さない","ne"), "制作 納期遵守率 88% ／ CS 一次返信 19時間", ("—","n"),
       "<b>親の数字には入らない</b>。仮説で繋ぐ", "仮説が無い子目標を警告"],
    ])) +
  card(head("期間への降ろし方も、単位で変わる") +
    table(["単位","年→四半期への降ろし方","この木での例"], [
      ["金額（円）", "<b>割る</b>（合計が年の目標になる）", "48,000,000 → Q1 10,000,000 … Q4 15,000,000"],
      ["件数（件）", "<b>割る</b>", "40件 → Q1 8件 … Q4 13件"],
      ["割合（%）", "<b>置く</b>（各期で達成すべき水準。足し算にならない）", "納期遵守率 95% → 各四半期とも 95%"],
      ["時間", "<b>置く</b>", "一次返信 24時間以内 → 各期とも 24時間以内"],
      ["状態（達成/未達）", "<b>置く</b>（期末に判定）", "ISMS を取る → Q3 末までに達成"],
    ]) +
    '<p class="muted" style="font-size:12.5px;margin-top:14px">'
    'これは <span style="font-family:var(--font-code);font-size:12px">goal_kinds.progress_strategy</span>'
    '（numeric / state / habit）と単位から自動で判定します。人が毎回選びません。</p>') +
  card(ai("この木についての見立て",
    "<b>足さない型が2つあります（制作・CS）。</b>どちらも仮説が紐づいているので、"
    "「なぜこの目標が会社の売上に効くのか」が説明できる状態です。<br><br>"
    "制作の仮説「手戻りが多く納期が遅れ、追加受注を取り逃している」は、<b>9月末に検証</b>します。"
    "納期が改善しても売上が動かなければ、<b>この仮説は間違いで、制作の目標は会社目標に寄与していない</b>と分かります。",
    btn("仮説と検証を見る","p","review","v1-retro.html"))) +
  card('<div class="card-h">' + ic("warn") + '<h2>仮説が紐づいていない子目標</h2></div>' +
    '<p class="muted" style="font-size:13px;margin-bottom:14px">'
    '「足さない」型は、親の数字に入りません。<b>なぜやるかを仮説で説明できないと、追う理由がない目標になります。</b></p>' +
    table(["子目標","部署","型","仮説"], [
      ["納期遵守率 95%","制作", pill("足さない","ne"),
       '<a href="v1-retro.html" style="color:var(--primary);font-weight:600">手戻りが多く納期が遅れ、追加受注を取り逃している</a>'],
      ["一次返信 24時間以内","CS", pill("足さない","ne"),
       '<a href="v1-retro.html" style="color:var(--primary);font-weight:600">初回対応の遅さが解約に効いている</a>'],
      ["<b>提案書の質を上げる</b>","高本（自主）", pill("足さない","ne"),
       '<span style="color:var(--error);font-weight:600">仮説なし — 追う理由が説明できません</span>'],
    ])))

GOALS = ("goals", [("n","同じ単位（足す）","",_g_ok),
  ("g","未配分あり","親の目標と子の配分の差が赤で出る。<b>これは「足す」型のときだけ計算できる。</b>",_g_gap),
  ("m","単位が変わる木","会社=売上 → 営業=件数 → 制作=納期遵守率。<b>親子で単位が変わってよい。</b>積み上がり方は 足す／変換／足さない の3通り。",_g_mixed),
  ("e","未設定","",_g_empty)], GOAL_CSS, False)

# ============================================================ goal-allocate（目標の下ろし方）
def _card_type(k, lab, kind, title, desc, body, sel=False):
    return (f'<label style="display:block;padding:16px;border:1.5px solid '
      f'{"var(--primary)" if sel else "var(--line)"};{"background:var(--primary-c);" if sel else ""}'
      f'border-radius:var(--r-md);cursor:pointer;margin-bottom:11px">'
      f'<div style="display:flex;gap:12px;align-items:flex-start">'
      f'<input type="radio" name="roll" {"checked" if sel else ""} style="margin-top:4px;accent-color:#22345C">'
      f'<div style="flex:1"><div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:5px">'
      f'{pill(lab, kind)}<b style="font-size:14px">{title}</b></div>'
      f'<div class="muted" style="font-size:12.5px;line-height:1.75;margin-bottom:11px">{desc}</div>'
      f'{body}</div></div></label>')

_ga = (f'<a href="v1-goals.html" class="btn btn-g btn-sm" style="padding-left:0;margin-bottom:14px">{ic("undo")}目標に戻る</a>' +
 grid([
  card(head("Q3 売上 12,000,000 を、誰に・どう下ろすか") +
    '<p class="muted" style="font-size:13px;margin-bottom:18px">'
    '<b>子は親と同じ単位でなくて構いません。</b>単位を変える場合、親にどう積み上がるかを選んでください。</p>' +
    field("下ろす相手", '<select class="inp" style="max-width:340px">'
      '<option>制作（外注 2名）</option><option>営業（高本）</option><option>AI 営業社員</option>'
      '<option>新しく AI 社員を作る</option></select>') +
    field("この相手が追う指標", '<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">'
      '<input class="inp" value="納期遵守率" style="max-width:220px">'
      '<select class="inp" style="max-width:150px"><option>%（割合）</option><option>円（金額）</option>'
      '<option>件（件数）</option><option>時間</option><option>回</option>'
      '<option>＋ 新しい単位を作る</option></select>'
      '<input class="inp num" value="95" style="max-width:100px;text-align:right"></div>',
      "単位は<b>あなたの会社で作れます</b>。運営が用意した6つに限りません") +
    '<div class="card-h" style="margin-top:22px"><h2 style="font-size:13.5px">親（Q3 売上）にどう積み上がるか</h2></div>' +
    _card_type("sum", "足す", "su", "そのまま足す（同じ単位のとき）",
      "子の値が親の値にそのまま加算されます。<b>未配分＝親 − 子の合計</b>が計算でき、赤で出ます。",
      '<div style="background:var(--card);border-radius:var(--r-md);padding:11px 13px;font-size:12.5px" class="num">'
      'Q3 売上 12,000,000 − 子の合計 10,000,000 = <b style="color:var(--error)">未配分 2,000,000</b></div>') +
    _card_type("convert", "変換", "pr", "変換して足す（単位が変わるとき）",
      "子の値を式で親の単位に変換して足します。<b>式の中身はあなたが決めます</b>（目標設定のスキルが提案します）。",
      '<div style="background:var(--card);border-radius:var(--r-md);padding:11px 13px;font-size:12.5px">'
      '<span class="num">受注 40件 × 平均単価 1,200,000 = 48,000,000</span>'
      '<div class="muted" style="margin-top:5px">この式が親の目標に届くかを検査します</div></div>') +
    _card_type("none", "足さない", "ne", "足さない（数式では繋がらないとき）",
      "親の数字には入りません。代わりに<b>「なぜこの目標が親に効くのか」を仮説で繋ぎます</b>。"
      "効いたかは検証で確かめます。", 
      '<div style="background:var(--card);border-radius:var(--r-md);padding:11px 13px;font-size:12.5px">'
      '<b>仮説</b>：手戻りが多く納期が遅れ、追加受注を取り逃している<br>'
      '<span class="muted">→ 9月末に「提案→受注率」で検証する</span></div>', sel=True) +
    note("<b>「足さない」を選ぶと、仮説の入力が必須になります。</b>"
         "仮説の無い子目標は「追う理由が説明できない目標」になるため、目標画面で警告が出ます。", "warn")),
  card(head("いまの下ろし方") +
    table(["相手","指標",("目標","r"),"積み上がり方"], [
      [f'{dot("d-indigo")}営業（高本）',"売上",("7,000,000","n"), pill("足す","su")],
      [f'{dot("d-teal")}AI 営業社員',"新規リード",("360 件","n"), pill("変換","pr")],
      [f'{dot("d-sage")}制作',"納期遵守率",("95%","n"), pill("足さない","ne")],
      [f'{dot("d-amber")}CS',"一次返信",("24時間以内","n"), pill("足さない","ne")],
    ]) +
    '<div style="margin-top:14px;padding:12px;background:#FDF2F2;border-radius:var(--r-md);font-size:12.5px">'
    f'{ic("warn")} <b>足す型の合計 7,000,000</b>。Q3 の 12,000,000 に対して '
    '<b style="color:var(--error)">未配分 5,000,000</b>。'
    '<div class="muted" style="margin-top:5px">変換型・足さない型は、この引き算に入りません。</div></div>') +
  card(head("下ろし方の履歴") +
    '<div style="display:flex;flex-direction:column;gap:0">' + "".join(
      f'<div style="padding:11px 0;border-bottom:1px solid var(--line-soft)">'
      f'<div style="font-size:13px;font-weight:600">{a}</div>'
      f'<div class="muted" style="font-size:12px">{b}</div></div>'
      for a, b in [("制作を「足す 2,000,000」→「足さない 納期遵守率95%」に変更",
                    "2026-09-09 · 高本 · 理由：制作は売上を作っていない。納期が受注に効くという仮説で繋ぐ"),
                   ("AI営業社員を「足す 3,000,000」→「変換 新規リード360件」に変更",
                    "2026-09-09 · 高本 · 理由：AIが作るのはリードで、売上は人が決める"),
                   ("営業（高本）に 7,000,000 を配る",
                    "2026-08-25 · 高本 · 理由：昨年同期の実績から")]) + '</div>') +
  card(head("この下ろし方が影響するもの") +
    kv([("足す型の未配分", '<span class="num" style="color:var(--error)">5,000,000</span>'),
        ("変換型の見込み", '<span class="num">4,320,000（リード360件 × 過去の転換率）</span>'),
        ("足さない型", '<span class="num">2件</span>（どちらも仮説あり）'),
        ("仮説の無い子目標", '<span class="num" style="color:var(--error)">1件</span>'),
        ("改訂履歴", "理由つきで残ります")])),
 ], "g21"))

GOAL_ALLOCATE = ("goal-allocate", [
  ("a","下ろし方を決める","<b>子は親と同じ単位でなくてよい。</b>単位を変えるなら、親にどう積み上がるか（足す／変換／足さない）を選ぶ。",_ga)], "", False)

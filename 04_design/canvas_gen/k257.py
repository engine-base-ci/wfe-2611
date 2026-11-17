"""K-257：詳細・帯・小窓・PC をつなぐの絵を起こし直す。

  詳細の形の 7 枚 …… TicketDetail を土台にして（右のパネル 380・題名の行 20px・帯は題名の行の下）、帯の中身と上の札だけを替えて
                      StRunning・StFailed・StBefore・StConfirmDone・StDone・StDelegated を書き出す。帯の文は今の画面の本物の文。
                      幅 1023 以下は右のパネルを本文の下に回す（決まりは絵の頭の style の、shellfix が消さない所に置く）
  小窓 3 枚 ………… StApproveModal（承認の確かめ・× なし）・StReturnModal（差し戻し）・StCompleteModal（完了・× あり）を 1 枚に 1 つ。
                      上から 60px・左右の真ん中・幅 380（確かめ）か 420（ふつう）・幅 375 は画面の幅 − 48px
  承認待ち ………… Approvals の区切りと行を台本で描くのをやめ、固まった HTML で書く（区切りは画面の 5 つ）
  PC をつなぐ ……… EdPC・MePC・MePCInstalled に、今の画面に在って絵に無かった操作を描き足す（持ち主はこの作り手）

canvas.json・対応表（canvas-screens.json）・突き合わせの設定（fidelity.json）・代表に見せる見比べの 1 枚もここで作る。
環境の K257_NO_SIDEFILES=1 のときは絵だけを書く（試験が写しで流すため）。何度流しても同じ。最後に shellfix.py を回す。

  cd 04_design/canvas_gen && python3 k257.py
"""
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ov import P, load  # noqa: E402
import k219  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
REVIEW_DIR = os.path.join(ROOT, "04_design", "canvas-review")
BEFORE_DIR = os.path.join(REVIEW_DIR, "K-257", "before")
SIDEFILES = os.environ.get("K257_NO_SIDEFILES") != "1"
MUTED = "#4A5563"


def save(name, title, s):
    s = s.replace(re.search(r"<title>.*?</title>", s).group(0), "<title>%s</title>" % title, 1)
    with open(P + name + ".dc.html", "w", encoding="utf-8") as f:
        f.write(s)


def block_end(s, start, tag):
    """s[start] から始まる <tag …> の閉じタグの終わりの位置（入れ子を数える）"""
    depth = 0
    for m in re.compile(r"<(/?)%s\b[^>]*>" % tag).finditer(s, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.end()
    raise ValueError("閉じタグが無い：%s" % tag)


def replace_block(s, start, new, tag="div"):
    return s[:start] + new + s[block_end(s, start, tag):]


# ---------- 部品（正本の段の値だけ） ----------
GRAY = ' aria-disabled="true" title="まだ使えません"'
GRAY_ST = "; opacity: 0.55; cursor: not-allowed"


def bbtn(label, kind, h, href=None, off=False):
    """帯のボタン。kind：p（紺）・o（白地・線は帯の線の色）"""
    base = "height: %dpx; border-radius: 6px; padding: 0 %dpx; font-size: %dpx" % (h, 14 if h == 32 else 12, 13 if h == 32 else 12)
    look = {"p": "border: 1px solid #22345C; background: #22345C; color: #FFFFFF; font-weight: 500",
            "o": "border: 1px solid %s; background: #FFFFFF; color: #131B27"}[kind[0]]
    if kind[0] == "o":
        look = look % kind[1:]
    style = base + "; " + look
    if href:
        return ('<a href="%s" style="%s; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; '
                'box-sizing: border-box">%s</a>') % (href, style, label)
    if off:
        return '<button type="button"%s style="%s%s">%s</button>' % (GRAY, style, GRAY_ST, label)
    return '<button type="button" style="%s">%s</button>' % (style, label)


def band(role, line, bg, color, title, sub, acts, pad="12px 14px", extra=""):
    """帯の箱。題は最初の div の直下の b（突き合わせの組のセレクタ > div:first-child > b）。箱の中の b は題の 1 つだけ"""
    act = '\n      <span style="margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap">%s</span>' % "".join(acts) if acts else ""
    # 幅 375 で 2 行に割れるときも、割れてよい所（空白・「、」の後）でだけ割る（keep-all：日本語の字の間では割らない）
    sub_html = '<div style="color: %s; font-size: 12px; word-break: keep-all">%s</div>' % (color, sub) if sub else ""
    return ('<div role="%s" style="margin: 0 20px 14px; border: 1px solid %s; background: %s; border-radius: 8px; padding: %s; '
            'display: flex; align-items: center; gap: 10px; flex-wrap: wrap">\n'
            '      <div style="flex: 1 1 100%%; min-width: 0"><b style="color: %s">%s</b>%s%s</div>%s\n     </div>'
            ) % (role, line, bg, pad, color, title, sub_html, extra, act)


STEPS = [("受け取る", "done"), ("作る", "now"), ("確かめる", "next"), ("あなたの承認", "next"), ("実行", "next")]
STEP_LINE = {"done": "#166534", "now": "#1D4ED8", "next": "#DDE2E9"}


def steps():
    """進みの 5 段（作っているときだけ）"""
    li = "".join('<li data-state="%s" style="flex: 1 0 auto; white-space: nowrap; border-top: 3px solid %s; padding-top: 4px; font-size: 11px; color: %s%s">%s</li>'
                 % (st, STEP_LINE[st], "#1E40AF" if st == "now" else MUTED, "; font-weight: 700" if st == "now" else "", t) for t, st in STEPS)
    return '<ol aria-label="進み" style="list-style: none; margin: 8px 0 0; padding: 0; display: flex; gap: 4px">%s</ol>' % li


CAUTION = ('<div style="margin-top: 6px; border: 1px solid #F3C7C7; background: #FDECEC; border-radius: 8px; padding: 4px 10px; '
           'font-size: 12px; color: #991B1B">取り消せません</div>')
CHECK_TABLE = ('<div style="margin: 0 20px 14px; overflow-x: auto"><table aria-label="確認の結果" style="border-collapse: collapse; width: 100%; min-width: 0">'
               '<thead><tr><th>確認項目</th><th>種類</th><th>1 回目</th><th>2 回目</th><th>根拠</th></tr></thead><tbody></tbody></table>'
               '<div style="font-size: 12px; color: ' + MUTED + '; padding: 6px 0 0">検査なし（まだ流していません）</div></div>')

# 絵: (題, 上の札の字, 札の地, 帯)
APPROVAL = band("status", "#F3D3A7", "#FCEBD5", "#7A4A05", "あなたの承認を待っています",
                "成果物は 11/01 09:12 に作成 ・ 確認 検査なし（まだ流していません）",
                [bbtn("承認して送る", "p", 32, "StApproveModal.dc.html"), bbtn("自分で直す", "o#F3D3A7", 32, off=True),
                 bbtn("差し戻す", "o#F3D3A7", 32, "StReturnModal.dc.html"), bbtn("止める", "o#F3D3A7", 32, off=True)],
                pad="10px 12px", extra=CAUTION)
DETAIL = {
    "TicketDetail": ("チケットの詳細 EG-128", "承認待ち", "#B45309", APPROVAL),
    "StRunning": ("AI が実行しているとき", "作業中", "#2F4B7C",
                  band("status", "#C7D7F5", "#EEF3FD", "#1E40AF", "高本のAI が作っています", "開始 10:31 ・ 3 分",
                       [bbtn("AI と話す", "o#DDE2E9", 30, off=True), bbtn("止める", "o#DDE2E9", 30, off=True)], extra=steps())),
    "StFailed": ("AI が止まったとき", "作業中", "#2F4B7C",
                 band("alert", "#F3C7C7", "#FDECEC", "#991B1B", "高本のAI が止まりました",
                      "金額が見積 EG-097 の月額と合いませんでした",
                      [bbtn("AI に任せる", "p", 30), bbtn("直し方を AI に伝える", "o#F3C7C7", 30, off=True), bbtn("自分で直す", "o#F3C7C7", 30, off=True)])
                 + "\n     " + CHECK_TABLE),
    "StBefore": ("AI に任せる前", "未着手", "#6B7585",
                 band("status", "#DDE2E9", "#FFFFFF", "#22345C", "AI に任せる", "高本のAI が実施事項を進め、確かめてから承認を待ちます",
                      [bbtn("AI に任せる", "p", 30)])),
    "StConfirmDone": ("完了の確かめ", "作業中", "#2F4B7C",
                      band("status", "#DDE2E9", "#FFFFFF", "#22345C", "完了の条件を確かめて完了にしてください", "実施事項は全部終わりました",
                           [bbtn("完了にする", "p", 30, "StCompleteModal.dc.html")])),
    "StDone": ("完了しました", "完了", "#166534",
               band("status", "#CDE8D5", "#E8F5EC", "#166534", "完了しました（高本・11/02 10:48）", "", [])),
    "StDelegated": ("AI に任せました", "作業中", "#2F4B7C",
                    band("status", "#F3D3A7", "#FFF8EE", "#7A4A05", "高本のAI に任せました。", "PC が受け取るのを待っています",
                         [bbtn("AI と話す", "o#F3D3A7", 30, off=True)])),
}
PILL = re.compile(r'(<span style="font-size: 12px; font-weight: 500; border-radius: 9999px; padding: 2px 12px; color: #FFFFFF; background: )#[0-9A-Fa-f]{6}">[^<]*</span>')
# 幅 1023 以下は右のパネルを本文の下に回す（画面の K-226 と shellfix の今の境目 1023）。kn-shell の前に置くので shellfix が消さない
NARROW = ("/* k257-detail */\n@media (max-width:1023px){div:has(>aside[aria-label=\"チケットのパネル\"]){flex-direction:column}"
          "aside[aria-label=\"チケットのパネル\"]{width:auto !important;border-left:0 !important;border-top:1px solid #DDE2E9 !important}}"
          # 幅 767 以下は、上の行の日付と札を 2 列の格子にする（札の字の長さで行の折り返しが変わり、帯の位置が絵ごとにずれないように）
          "@media (max-width:767px){article>div:first-child>span[style*=\"margin-left: auto\"]{display:grid !important;grid-template-columns:max-content max-content;justify-items:start;row-gap:4px}}"
          # ボタンの名前は 1 行（並びは折り返す）。代表の答え answer=ba0d9572fc77・PM の決め
          "article :is(a[style*=\"height: 30px\"],a[style*=\"height: 32px\"],button){white-space:nowrap}article div:has(>a[style*=\"height: 30px\"]){flex-wrap:wrap}\n")
# 承認待ち：ボタンの名前は 1 行・右の並びは折り返す
AP = ("/* k257-ap */\nsection a[style*=\"height: 28px\"]{white-space:nowrap}"
      "section>div:first-child>span[style*=\"margin-left: auto\"]{flex-wrap:wrap;justify-content:flex-end}\n")


def put_css(s, css):
    """kn-shell の前（shellfix が消さない所）に 1 行の決まりを置く。前に置いた同じ印の行は消してから（何度流しても 1 回だけ）"""
    tag = re.escape(css.split("\n", 1)[0])
    s = re.sub(r"\n*" + tag + r"\n[^\n]*\n", "\n", s)
    return re.sub(r"\n*(?=/\* kn-shell)", lambda _m: "\n\n" + css, s, count=1)
TOOLS = [("太字", "B"), ("斜体", "I"), ("見出し", "見出し"), ("箇条書き", "・"), ("番号つき", "1."), ("チェックリスト", "☐"), ("表", "表"),
         ("画像・添付", "画像"), ("引用", "引用"), ("コード", "&lt;/&gt;"), ("注意の枠", "注意"), ("チケットを引く", "#"), ("人を呼ぶ", "@"), ("リンク", "リンク")]
TOOL = ('<button type="button" aria-label="%s" title="%s" style="min-width: 30px; height: 28px; border: 0; border-radius: 4px; '
        'background: transparent; color: #4A5563; font-size: 12px; padding: 0 6px">%s</button>')
SCRIPT = re.compile(r"\n?<script type=\"text/x-dc\" data-dc-script.*?</script>", re.S)


def detail_base():
    """TicketDetail を詳細の形の土台に直す（台本で描いていた道具の並びを固まった HTML に・帯を本物の文に・狭い幅の決まり）"""
    s = load("TicketDetail.dc.html")
    s = re.sub(r"<sc-for list=\"\{\{tools\}\}\".*?</sc-for>", lambda _m: "".join(TOOL % (n, n, label) for n, label in TOOLS), s, count=1, flags=re.S)
    s = SCRIPT.sub("", s)
    s = put_css(s, NARROW)
    # 題は 1 行。長いときは「…」で切り、全文は title（代表の答え answer=ba0d9572fc77・PM の決め）
    s = re.sub(r'<h1 style="font-size: 2[02]px;[^"]*"[^>]*>([^<]*)</h1>',
               lambda m: '<h1 style="font-size: 20px; margin: 0; line-height: 1.45; flex: 1 1 360px; min-width: 0; white-space: nowrap; overflow: hidden; '
                         'text-overflow: ellipsis" title="%s">%s</h1>' % (m.group(1), m.group(1)), s, count=1)
    return s


def detail_board(base, name):
    title, pill, pill_bg, band_html = DETAIL[name]
    s = PILL.sub(lambda m: m.group(1) + pill_bg + '">' + pill + "</span>", base, count=1)
    head = re.search(r'<div role="(?:status|alert)" style="margin: 0 20px 14px;', s)
    start = head.start()
    end = block_end(s, start, "div")
    # 前に足した確認の結果の表（止まったの絵）も帯ごと替える
    tail = re.match(r'\s*<div style="margin: 0 20px 14px; overflow-x: auto"><table aria-label="確認の結果"', s[end:])
    if tail:
        end = block_end(s, end + tail.start() + s[end + tail.start():].index("<div"), "div")
    s = s[:start] + band_html + s[end:]
    save(name, title, s)


def detail_boards():
    detail_board(detail_base(), "TicketDetail")
    base = load("TicketDetail.dc.html")
    for name in DETAIL:
        if name != "TicketDetail":
            detail_board(base, name)


# ---------- 小窓（StModal の外枠に 1 つずつ） ----------
OVERLAY = ('<div style="position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding: 60px 24px; '
           'box-sizing: border-box">\n  %s\n </div>')
SEC = ('<section role="%s" aria-label="%s" style="width: %dpx; max-width: 100%%; box-sizing: border-box; background: #FFFFFF; border-radius: 12px; '
       'box-shadow: 0 24px 60px rgba(19,27,39,0.3); overflow: hidden">\n%s\n  </section>')
CLOSE = ('<button type="button" aria-label="閉じる" style="margin-left: auto; width: 28px; height: 28px; border: 0; background: transparent; '
         'color: #4A5563">×</button>')
FOOT = '   <div style="padding: 12px 18px; border-top: 1px solid #DDE2E9; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap">%s</div>'
CANCEL = ('<button type="button" style="height: 34px; border-radius: 6px; border: 1px solid #DDE2E9; background: #FFFFFF; padding: 0 14px; '
          'font-size: 13px; color: #131B27">やめる</button>')
PRIMARY = ('<button type="button"%s style="height: 34px; border-radius: 6px; border: 1px solid #22345C; background: #22345C; color: #FFFFFF; '
           'padding: 0 16px; font-size: 13px; font-weight: 500%s">%s</button>')
TARGET = '    <div style="font-size: 12px; color: #4A5563">EG-128 セイコー様へ 11月分の請求書を送る</div>\n'
CHECK = '<label style="display: flex; gap: 6px; font-size: 12px"><input type="checkbox"%s>%s</label>'
FIELD = 'display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #4A5563'
TODO = ["新着から条件に合う案件を選ぶ（3 件 → 1 件）", "案件の要件と予算を読む", "応募文を作る（過去の採用文 3 件を参考）", "確認を通す",
        "発注ナビの画面から応募する（承認のあと）"]


def head(title, closable):
    if closable:
        return '   <div style="padding: 14px 18px; border-bottom: 1px solid #DDE2E9; display: flex; align-items: center"><b style="font-size: 15px">%s</b>%s</div>\n' % (title, CLOSE)
    return '   <div style="padding: 14px 18px; border-bottom: 1px solid #DDE2E9"><b style="font-size: 15px">%s</b></div>\n' % title


def body(inner, gap=12):
    return '   <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: %dpx; font-size: 13px">\n%s   </div>\n' % (gap, inner)


def modal_board(name, title, section):
    s = load("StModal.dc.html")
    s = replace_block(s, s.index('<div style="position: absolute; inset: 0;'), OVERLAY % section)
    save(name, title, s)


def modals():
    approve = SEC % ("alertdialog", "承認して送ります", 380,
                     head("承認して送ります", False)
                     + body('    <div style="border: 1px solid #F3C7C7; background: #FDECEC; border-radius: 8px; padding: 8px 10px; color: #991B1B">取り消せません</div>\n'
                            '    ' + CHECK % ("", "成果物を目で見た") + "\n", 10)
                     + FOOT % (CANCEL + PRIMARY % (GRAY.replace("まだ使えません", "成果物を目で見たに印を付けると送れます"), GRAY_ST, "承認して送る")))
    modal_board("StApproveModal", "承認して送りますの小窓", approve)
    off = ' disabled aria-disabled="true" style="opacity: 0.55"'
    ret = SEC % ("dialog", "差し戻す", 420,
                 head("差し戻す", True)
                 + body(TARGET
                        + '    <label style="%s">どこを直すか<select%s></select></label>\n' % (FIELD, off)
                        + '    <label style="%s"><span>理由 <span style="color: #B91C1C">必須</span></span><textarea aria-label="差し戻す理由" style="min-height: 64px">'
                          '10/19 の追加対応は無償なので外してください</textarea></label>\n' % FIELD
                        + '    <fieldset style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 8px 12px; margin: 0"><legend style="font-size: 12px; color: #4A5563; padding: 0 4px">次は誰が直すか</legend>\n'
                          '     <label style="display: flex; gap: 6px; font-size: 12px"><input type="radio" name="who" checked%s>AI に直させて、確認からやり直す</label>\n'
                          '     <label style="display: flex; gap: 6px; font-size: 12px"><input type="radio" name="who"%s>自分で直す</label>\n'
                          '    </fieldset>\n' % (off, off)
                        + '    <label style="display: flex; gap: 6px; font-size: 12px"><input type="checkbox"%s>この理由を AI に覚えさせる候補にする（ナレッジ更新の候補）</label>\n' % off)
                 + FOOT % (CANCEL + PRIMARY % ("", "", "差し戻す")))
    modal_board("StReturnModal", "差し戻すの小窓", ret)
    todo = "".join("     " + CHECK % (" checked disabled", t) + "\n" for t in TODO[:4]) + "     " + CHECK % ("", TODO[4]) + "\n"
    done = SEC % ("dialog", "完了にする", 420,
                  head("完了にする", True)
                  + body('    <div style="font-size: 12px; color: #4A5563">EG-127 発注ナビ 新着案件に応募文を出す</div>\n'
                         '    <div><div style="font-size: 12px; font-weight: 500">完了の条件</div><div style="font-size: 12px; color: #4A5563">応募が発注ナビの「応募済み」に出ていること</div></div>\n'
                         '    <fieldset style="border: 1px solid #DDE2E9; border-radius: 8px; padding: 8px 12px; margin: 0"><legend style="font-size: 12px; color: #4A5563; padding: 0 4px">実施事項</legend>\n'
                         + todo + '    </fieldset>\n    ' + CHECK % ("", "完了の条件を満たしたことを確かめました") + "\n", 10)
                  + FOOT % (CANCEL + PRIMARY % ("", "", "確かめて完了にする")))
    modal_board("StCompleteModal", "完了にするの小窓", done)


# ---------- 承認待ち（台本をやめて固まった HTML に） ----------
KIND = {"AI の成果物": "#22345C", "上位の承認": "#6D4AA6", "渡された": "#7E570D", "判断を仰がれた": "#B91C1C", "決まりの例外": "#186F69", "やり方を広げる": "#2F4B7C"}
TYPE = {"タスク": "#186F69", "QA": "#B91C1C", "課題": "#B45309", "決まり": "#4A5563", "やり方": "#4A5563"}
AVC = {"高本のAI": "#4A5563", "佐藤": "#186F69", "田中": "#7E570D", "鈴木": "#2F4B7C"}
# 区切りは画面の 5 つ（期限切れ・今日・7 日以内・それより後・期限なし）。この絵の今日は 11/02
GROUPS = [
    ("期限切れ", "#B91C1C", [
        ("AI の成果物", "タスク", "EG-128", "セイコー様へ 11月分の請求書を送る", "承認するとメールを送る（取り消せない）", "高本のAI", "確実 2 ・ AI 1 ・ 人 1", "11/01", True, "中身を見る", "差し戻す", False)]),
    ("今日", "#131B27", [
        ("上位の承認", "タスク", "JD-204", "京蟻 追加開発の見積を出す（1,826,000 円）", "見積が 100 万円を超えたため上位へ（ワークスペースの決まり）", "佐藤", "確実 2 ・ AI 1", "11/02（今日）", False, "承認する", "差し戻す", False),
        ("AI の成果物", "タスク", "KR-031", "入金の照合（10月分）を記録する", "承認すると会計に記録する（戻せる）", "高本のAI", "確実 3", "11/02（今日）", False, "承認する", "差し戻す", True)]),
    ("7 日以内", "#131B27", [
        ("渡された", "タスク", "EG-119", "問い合わせ（山田様）に一次返信する", "理由：先方と面識がある ・ 返事の期限 11/03", "佐藤", "—", "11/03", False, "受ける", "断る", False),
        ("AI の成果物", "タスク", "EG-127", "発注ナビ 応募文を出す", "承認すると 3 社に応募する（外に出る）", "高本のAI", "確実 2", "11/04", False, "中身を見る", "差し戻す", False),
        ("決まりの例外", "決まり", "—", "ミナト様だけ月末締めにしたい", "ワークスペースの決まり「請求は 25 日締め」と反対 ・ 田中の分身が点検", "田中", "—", "11/05", False, "OK する", "断る", False),
        ("判断を仰がれた", "QA", "JD-207", "保守の範囲にログの保管は入るか", "京蟻様から 1 年保管を頼まれた", "田中", "—", "11/05", False, "答える", "もっと聞く", False)]),
    ("それより後", "#4A5563", [
        ("渡された", "タスク", "JD-190", "【親】京蟻 v2.1 リリース", "子 8 件も一緒に ・ 返事の期限 11/16", "鈴木", "—", "11/16", False, "受ける", "断る", False)]),
    ("期限なし", "#4A5563", [
        ("やり方を広げる", "やり方", "—", "やり方「問い合わせに返す」を営業の全員に", "鈴木の自分のやり方 v1 ・ 使った 6 回・そのまま通った 4", "鈴木", "—", "—", False, "中身を見る", "断る", False)]),
]
FILTERS = [("すべて 9", True), ("AI の成果物 3", False), ("上位の承認 1", False), ("渡された 2", False), ("判断を仰がれた 1", False),
           ("決まりの例外 1", False), ("やり方を広げる 1", False)]


def ap_row(kind, typ, key, title, sub, frm, check, due, late, primary, second, bulk):
    pick = ('<input type="checkbox" aria-label="まとめて承認に入れる">' if bulk
            else '<span title="1 件ずつ決める" style="color: #8A94A3; font-size: 11px">—</span>')
    ini = "AI" if frm == "高本のAI" else frm[0]
    return ('         <tr>\n'
            '          <td>%s</td>\n'
            '          <td><span style="display: inline-block; font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 0 8px; border: 1.5px solid %s; color: %s">%s</span></td>\n'
            '          <td><span style="display: inline-block; font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; color: #FFFFFF; background: %s">%s</span></td>\n'
            '          <td><a href="TicketDetail.dc.html" style="font-size: 12px">%s</a></td>\n'
            '          <td style="max-width: 360px; overflow: hidden; text-overflow: ellipsis"><a href="TicketDetail.dc.html" style="color: #131B27; text-decoration: none; font-weight: 500">%s</a>'
            '<span style="display: block; font-size: 12px; color: #4A5563; overflow: hidden; text-overflow: ellipsis">%s</span></td>\n'
            '          <td><span style="display: inline-flex; align-items: center; gap: 5px"><span style="width: 22px; height: 22px; border-radius: 9999px; font-size: 10px; display: grid; place-items: center; color: #FFFFFF; background: %s">%s</span>%s</span></td>\n'
            '          <td style="font-size: 12px">%s</td>\n'
            '          <td%s>%s</td>\n'
            '          <td style="text-align: right"><span style="display: inline-flex; gap: 6px"><button type="button" style="height: 28px; border-radius: 6px; border: 1px solid #DDE2E9; background: #FFFFFF; padding: 0 10px; font-size: 12px; color: #131B27">%s</button>'
            '<button type="button" style="height: 28px; border-radius: 6px; border: 1px solid #22345C; background: #22345C; color: #FFFFFF; padding: 0 12px; font-size: 12px; font-weight: 500">%s</button></span></td>\n'
            '         </tr>\n') % (pick, KIND[kind], KIND[kind], kind, TYPE[typ], typ, key, title, sub, AVC[frm], ini, frm, check,
                                   ' style="color: #B91C1C; font-weight: 500"' if late else "", due, second, primary)


def approvals():
    s = load("Approvals.dc.html")
    filters = "".join('<button type="button" style="height: 26px; border: 1px solid %s; background: %s; color: %s; border-radius: 9999px; padding: 0 10px; font-size: 12px">%s</button>'
                      % ((("#22345C", "#22345C", "#FFFFFF") if on else ("#DDE2E9", "#FFFFFF", MUTED)) + (label,)) for label, on in FILTERS)
    i = s.index('<span style="display: flex; gap: 6px; flex-wrap: wrap">')
    s = replace_block(s, i, '<span style="display: flex; gap: 6px; flex-wrap: wrap">\n      %s\n     </span>' % filters, "span")
    rows = "".join('        <tr><td colspan="9" style="background: #F7F8FA; height: 28px; font-size: 12px; font-weight: 500; color: %s">%s　%d 件</td></tr>\n%s'
                   % (color, label, len(rs), "".join(ap_row(*r) for r in rs)) for label, color, rs in GROUPS)
    a = s.index("<tbody>") + len("<tbody>")
    s = s[:a] + "\n" + rows + "      " + s[s.index("</tbody>", a):]
    s = SCRIPT.sub("", s)
    s = put_css(s, AP)
    save("Approvals", "承認待ち", s)


# ---------- PC をつなぐ（画面に在って絵に無かった操作を描き足す） ----------
LINK = "color: #22345C; text-decoration: underline"
LEGACY = ('<p style="margin: 0; font-size: 12px; color: #4A5563">Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、'
          '<a data-act="legacy" href="/setup/bridge/legacy" style="%s">前の設定の画面</a>で行えます。</p>' % LINK)
BACK = '<a data-act="back" href="#" style="%s">戻る</a>' % LINK
NEW_CODE = ('<button type="button" data-act="new-code" style="margin-left: auto; padding: 0; font-size: 12px; background: none; border: none; border-radius: 0; '
            'color: #22345C; font-family: inherit; font-weight: 400; cursor: pointer">新しいコード</button>')
CODE_LINE = "10 分で切れる ・ この PC 専用の鍵が作られ、ほかの PC からは使えない"
WAKE = ('<button type="button" data-act="wake" style="margin-top: 6px; height: 30px; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 8px; '
        'font-size: 12px; font-weight: 600; padding: 0 12px; color: #131B27">Bridge を起こす</button>')
SWITCH = ('<button type="button" data-act="switch-account" style="height: 30px; border-radius: 6px; padding: 0 12px; font-size: 12px; '
          'border: 1.5px solid #B91C1C; background: transparent; color: #B91C1C; white-space: nowrap">このアカウントに切り替える</button>')
MAIN_SEC = '<section style="flex: 1; min-width: 0; padding: 22px 28px'


def conn_message():
    """画面と同じ E-CONN-001 の文（packages/errors/src/catalog.ts の message）"""
    src = open(os.path.join(ROOT, "packages", "errors", "src", "catalog.ts"), encoding="utf-8").read()
    return re.search(r'"E-CONN-001":\s*\{.*?"message":\s*"([^"]+)"', src, re.S).group(1)


def with_legacy(s):
    """本文（section）の最後に「ほかの設定」の文を置く（画面はいつも出す）"""
    if 'data-act="legacy"' in s:
        return s
    i = s.index(MAIN_SEC)
    end = block_end(s, i, "section") - len("</section>")
    return s[:end] + LEGACY + s[end:]


# PC をつなぐの小窓を小窓の型（K-229・正本の dialog）にそろえる（K-230・代表の答え answer=cc774c8b31d7）：
#   置き場は上から 60px・左右 24（真ん中に置かない）・幅 580 まで、影は正本の dialog（縁の輪 1px line と 0 24px 60px overlay-shadow）、
#   本文の余白 14px 18px・段の間 10・頭と足の線は line。何度流しても同じ（置き換える前の字が無ければ何もしない）
CONNECT_TYPED = [
    ('style="position: fixed; inset: 0; background: rgba(19,27,39,.45); display: grid; place-items: center; padding: 16px; z-index: 30"',
     'style="position: fixed; inset: 0; background: rgba(19,27,39,.45); display: flex; align-items: flex-start; justify-content: center; '
     'padding: 60px 24px; box-sizing: border-box; z-index: 30"'),
    ('max-width: 580px; max-height: calc(100vh - 32px); overflow: auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25);',
     'max-width: 580px; max-height: calc(100vh - 96px); overflow: auto; background: #FFFFFF; border-radius: 12px; '
     'box-shadow: 0 0 0 1px #DDE2E9, 0 24px 60px #131B274D;'),
    ('gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4"', 'gap: 10px; padding: 14px 18px; border-bottom: 1px solid #DDE2E9"'),
    ('<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">',
     '<div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">'),
    ('padding: 12px 18px; border-top: 1px solid #EDF0F4; flex-wrap: wrap"', 'padding: 12px 18px; border-top: 1px solid #DDE2E9; flex-wrap: wrap"'),
]


def connect_typed(ed):
    i = ed.index('<div role="dialog" aria-label="PC をつなぐ"')
    head, tail = ed[:i], ed[i:]
    for old, new in CONNECT_TYPED:
        tail = tail.replace(old, new, 1)
    return head + tail


def pc_boards():
    me = load("MePC.dc.html")
    if 'data-act="back"' not in me:
        i = me.index(MAIN_SEC)
        h = me.index("<h1", i)
        me = me[:h] + BACK + me[h:]
    if 'data-act="wake"' not in me:
        row = me.index("切れている</span>")
        box = me.rindex("<span", 0, me.index("background: #FFF8EE", row))
        end = block_end(me, box, "span") - len("</span>")
        me = me[:end] + '<span style="display: block; margin-top: 6px">%s</span>' % conn_message() + WAKE + me[end:]
    save("MePC", "自分の設定 PC と使った量", with_legacy(me))
    ed = load("EdPC.dc.html")
    if 'data-act="new-code"' not in ed:
        ed = ed.replace("<br>" + CODE_LINE + "</div>",
                        '<span style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px"><span>%s</span>%s</span></div>' % (CODE_LINE, NEW_CODE), 1)
    save("EdPC", "PC をつなぐ", with_legacy(connect_typed(ed)))
    ins = load("MePCInstalled.dc.html")
    if 'data-act="switch-account"' not in ins:
        btn = ins.index(">この PC の Bridge につなぐ</button>") + len(">この PC の Bridge につなぐ</button>")
        ins = ins[:btn] + SWITCH + ins[btn:]
    save("MePCInstalled", "自分の設定 この PC に Bridge が入っている", with_legacy(ins))


# ---------- 置き場の表（この作り手が持つ絵） ----------
# 絵: (近い絵, page, 画面, title, 組の id か None)
BOARDS = {
    "StBefore": ("StRunning", "states", "tickets", "帯・任せる前 ← チケットを作った直後", "band-before"),
    "StConfirmDone": ("StRunning", "states", "tickets", "帯・完了の確かめ ← 実行が終わって承認待ちが無い", "band-confirm-done"),
    "StDone": ("StRunning", "states", "tickets", "帯・完了 ← 完了にした", "band-done"),
    "StDelegated": ("StRunning", "states", "tickets", "帯・任せました（作る段） ← AI に任せるを押した", "band-delegated"),
    "StApproveModal": ("StModal", "states", "tickets", "承認して送りますの小窓 ← 帯の承認して送る・行の承認する", "approve-modal"),
    "StReturnModal": ("StModal", "states", "tickets", "差し戻すの小窓 ← 帯の差し戻す", "return-modal"),
    "StCompleteModal": ("StModal", "states", "tickets", "完了にするの小窓 ← 帯の完了にする", "complete-modal"),
    "MePCInstalled": ("MePC", "me", "bridge-setup", "この PC に Bridge が入っている ← PC をつなぐを開いた", "bridge-installed"),
}


def dump(path, data, newline):
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + ("\n" if newline else ""))


def update_canvas_json():
    """在る絵の置き場と題は持ち主が後から直すので触らない。無い絵だけ足す（止まったの絵の題だけは前の名前のときに 1 回だけ直す）"""
    path = P + "canvas.json"
    c = json.load(open(path, encoding="utf-8"))
    boards = dict(c["boards"])
    if boards.get("StFailed.dc.html", {}).get("title") == "4 確認で落ちて直しているとき":
        boards["StFailed.dc.html"] = {**boards["StFailed.dc.html"], "title": "4 AI が止まったとき"}
    for name, (ref, page, _screen, title, _g) in BOARDS.items():
        key = name + ".dc.html"
        if key in boards:
            continue
        r = boards[ref + ".dc.html"]
        col = [b for b in boards.values() if b.get("page") == page and b.get("x") == r["x"]]
        y = max(b["y"] + b["h"] for b in col) + 240
        boards[key] = dict(sorted({"w": r["w"], "h": r["h"], "page": page, "title": title, "x": r["x"], "y": y}.items()))
    c["boards"] = dict(sorted(boards.items()))
    c["order"] = list(c["order"]) + [n + ".dc.html" for n in BOARDS if n + ".dc.html" not in c["order"]]
    dump(path, c, False)


def update_screens():
    path = os.path.join(ROOT, "04_design", "canvas-screens.json")
    d = json.load(open(path, encoding="utf-8"))
    screens = {k: list(v) for k, v in d["screens"].items()}
    for name, (_ref, _page, screen, _t, _g) in BOARDS.items():
        if not any(name in v for v in screens.values()):
            screens[screen] = screens[screen] + [name]
    dump(path, {**d, "screens": screens}, False)


OLD_PRIMARY = '[role="dialog"][aria-label="PC をつなぐ"] > div :is(a, button)[style*="background: #22345C"]'


def update_fidelity():
    """組は無いときだけ足す（持ち主が後から直した組を戻さない）。前の形を直す 3 つ（承認の小窓の絵・完了の小窓のセレクタ・bridge-code の主ボタン）は、
    前の値が在るときだけ 1 回直す"""
    path = os.path.join(ROOT, "04_design", "fidelity.json")
    f = json.load(open(path, encoding="utf-8"))
    groups = []
    for g in f["groups"]:
        if g["id"] == "approve-modal" and g["canvas"] == "StModal":
            g = {**g, "canvas": "StApproveModal"}
        if g["id"] == "complete-modal":
            g = {**g, "pairs": [{**p, "canvas": p["canvas"].replace('section[role="alertdialog"]', 'section[role="dialog"]')} for p in g["pairs"]]}
        if g["id"] == "bridge-code":
            # EdPC の小窓に紺のボタンは無い（前のセレクタはキャンバスの側が「無い」）。足の帯の「あとで」どうしを比べる（K-230 の決めた形）
            g = {**g, "pairs": [({**p, "name": "足のボタン（あとで）", "canvas": '[role="dialog"][aria-label="PC をつなぐ"] > div > div:last-child a',
                                  "app": '.k-dialog-actions .k-btn[data-variant="outlined"]'} if p["name"] == "主ボタン" and p["canvas"] == OLD_PRIMARY else p)
                                for p in g["pairs"]]}
        groups.append(g)
    if not any(g["id"] == "return-modal" for g in groups):
        approve = next(g for g in groups if g["id"] == "approve-modal")
        groups.append({"id": "return-modal", "kind": "dialog", "canvas": "StReturnModal", "app": "/tickets/{ticket}", "state": "return-modal",
                       "widths": [1440, 375], "owner": "K-229", "enrolled": False,
                       "pairs": [{**p, "canvas": p["canvas"].replace('section[role="alertdialog"]', 'section[role="dialog"]')} for p in approve["pairs"]]})
    dump(path, {**f, "groups": groups}, True)


# ---------- 代表に見せる見比べの 1 枚 ----------
REVIEW = [
    ("TicketDetail", "チケットの詳細（承認待ち）", "スマホで見ると、右の欄が縮まらずに本文のカードが細く潰れ、画面が横にはみ出していました。幅が狭いときは右の欄を本文の下に回しました。"
     "帯の文は今の画面と同じ「確認 検査なし（まだ流していません）」にし、取り消せないことを赤い箱で出しました。「自分で直す」「止める」はまだ使えないので薄くしています。"
     "題・帯の文・ボタンは 2 行に割れないようにしました（題が長いときは 1 行で切って「…」を付け、全文は題に指を置くと出ます。帯のボタンは文の下に回しました）。"),
    ("StRunning", "AI が作っているとき", "詳細の画面と同じ形（右の欄の幅・帯の位置）にそろえました。帯の文は今の画面と同じ「高本のAI が作っています」にし、"
     "進みを「受け取る・作る・確かめる・あなたの承認・実行」の 5 段で出しています。スマホでも潰れません。"),
    ("StFailed", "AI が止まったとき", "詳細の画面と同じ形にそろえ、帯の文を今の画面と同じ「高本のAI が止まりました」と止まった理由にしました。"
     "まだ流していない確認の結果は表の下に「検査なし」と出します。スマホでも潰れません。"),
    ("StBefore", "AI に任せる前", "前は右の欄が無く、帯が横に長く伸びていました。詳細の画面と同じ形（右の欄あり）にそろえ、帯の位置と幅をほかの絵と同じにしました。"),
    ("StConfirmDone", "完了の確かめ", "詳細の画面と同じ形にそろえ、帯の位置と幅をほかの絵と同じにしました。「完了にする」を押すと完了の小窓が開きます。"),
    ("StDone", "完了しました", "詳細の画面と同じ形にそろえ、帯の文を今の画面と同じ「完了しました（高本・11/02 10:48）」にしました。"),
    ("StDelegated", "AI に任せました", "詳細の画面と同じ形にそろえ、帯の文を今の画面と同じ「高本のAI に任せました。PC が受け取るのを待っています」にしました。"),
    ("StApproveModal", "承認して送ります（小窓）", "前は 3 つの小窓を 1 枚に並べていて、スマホでは承認の小窓が細く潰れていました。1 枚に 1 つにし、画面の真ん中に置きました。"
     "本人確認は取り直さないので、その文を外しました。「成果物を目で見た」に印を付けるまで「承認して送る」は押せません。"),
    ("StReturnModal", "差し戻す（小窓）", "前は 3 つの小窓を 1 枚に並べていました。差し戻しの小窓を 1 枚に 1 つにし、画面の真ん中に置きました。"
     "「どこを直すか」「次は誰が直すか」「覚えさせる候補」はまだ使えないので薄くしています。"),
    ("StCompleteModal", "完了にする（小窓）", "閉じる × を頭に付けました（取り消せる操作なので、ふつうの小窓の形にしました）。置き場は前と同じ真ん中です。"),
    ("Approvals", "承認待ち", "期限の区切りを今の画面と同じ「期限切れ・今日・7 日以内・それより後・期限なし」にしました。今日が期限のものは「11/02（今日）」と出します。"),
    ("EdPC", "PC をつなぐ（コード）", "今の画面に在る「新しいコード」を、コードの説明の行の右に足しました。本文の最後に「前の設定の画面」への案内を足しました。小窓は小窓の型にそろえました（上から 60px・正本の影・本文の余白と段の間・頭と足の線・K-230）。"),
    ("MePC", "PC と使った量（つないでいる PC）", "切れている PC の直し方の箱に、今の画面と同じ案内の文と「Bridge を起こす」を足しました。"
     "題の左に「戻る」、本文の最後に「前の設定の画面」への案内を足しました。"),
    ("MePCInstalled", "この PC に Bridge が入っている", "「この PC の Bridge につなぐ」の隣に「このアカウントに切り替える」（赤い線のボタン）を足しました。"
     "本文の最後に「前の設定の画面」への案内を足しました。"),
]
ONLY = {"MePC": "戻るは、ほかの画面から開いたときだけ出る",
        "MePCInstalled": "このアカウントに切り替えるは、この PC の Bridge が別のアカウントでつながっているときだけ出る"}
CSS = ("body{margin:0;font-family:system-ui,sans-serif;color:#131B27;background:#F2F4F7;font-size:14px;line-height:1.7}\n"
       "main{padding:24px;display:flex;flex-direction:column;gap:20px}\nh1{font-size:20px;margin:0}\nh2{font-size:16px;margin:0}\n"
       "main>p{margin:0;color:#4A5563}\nsection{background:#FFFFFF;border:1px solid #DDE2E9;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px}\n"
       ".why{margin:0;color:#4A5563}\n.only{margin:0;font-size:13px;color:#7A4A05}\n.pair{display:flex;gap:16px;flex-wrap:wrap}\n"
       "figure{margin:0;display:flex;flex-direction:column;gap:6px}\nfigcaption{font-size:12px;color:#4A5563}\n"
       ".frame{width:576px;height:400px;overflow:hidden;border:1px solid #DDE2E9;border-radius:8px;background:#FFFFFF}\n"
       ".frame iframe{width:1440px;height:1000px;border:0;transform:scale(.4);transform-origin:0 0}\n"
       "@media (max-width:700px){main{padding:16px 12px}.pair{flex-direction:column}.frame{width:316px;height:220px}.frame iframe{transform:scale(.22)}}\n")


def frame(src, cap):
    return '<figure><figcaption>%s</figcaption><div class="frame"><iframe src="%s" title="%s" loading="lazy"></iframe></div></figure>' % (cap, src, cap)


def before_copies():
    """直す前の絵を 1 回だけ写す（後で上書きしない）。新しい 2 枚の前は、3 つを並べた見本の StModal"""
    os.makedirs(BEFORE_DIR, exist_ok=True)
    for name, _t, _w in REVIEW:
        src = "StModal" if name in ("StApproveModal", "StReturnModal") else name
        dst = os.path.join(BEFORE_DIR, src + ".html")
        if not os.path.exists(dst):
            shutil.copy(P + src + ".dc.html", dst)


def review_sheet():
    td = load("TicketDetail.dc.html")
    with open(os.path.join(BEFORE_DIR, "title-22.html"), "w", encoding="utf-8") as f:
        f.write(re.sub(r"(<h1[^>]*font-size: ?)20px", r"\g<1>22px", td, count=1))
    secs = ['<section data-board="title-size"><h2>題の文字の大きさ（どちらかを選んでください）</h2>'
            '<p class="why">左は題が 22px の絵、右は 20px に寄せた絵です。ほかは全部同じです。決まった文字の大きさの段は一番上が 20px なので、いまは 20px に寄せています。'
            '題が小さく見えて読みにくいと感じたら 22px を選んでください。22px を選ぶと、文字の大きさの段に 22px を足して、ほかの画面の題もそろえ直します。</p>'
            '<div class="pair">%s%s</div></section>' % (frame("K-257/before/title-22.html", "題が 22px の今の絵"), frame("../canvas/TicketDetail.dc.html", "20px に寄せた絵"))]
    for name, what, why in REVIEW:
        src = "StModal" if name in ("StApproveModal", "StReturnModal") else name
        only = '<p class="only">%s</p>' % ONLY[name] if name in ONLY else ""
        secs.append('<section data-board="%s"><h2>%s</h2><p class="why">%s</p>%s<div class="pair">%s%s</div></section>'
                    % (name, what, why, only, frame("K-257/before/%s.html" % src, "直す前"), frame("../canvas/%s.dc.html" % name, "直した後")))
    html = ("<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>詳細・帯・小窓・PC をつなぐの絵（見比べ）</title>\n<style>\n" + CSS + "</style>\n</head>\n<body>\n<main>\n"
            "<h1>詳細・帯・小窓・PC をつなぐの絵（見比べ）</h1>\n"
            "<p>左が直す前の絵、右が直した後の絵です。それぞれ、何を直したかを上に書いています。はじめの区画だけ、題の文字の大きさを選んでください。</p>\n"
            + "\n".join(secs) + "\n</main>\n</body>\n</html>\n")
    with open(os.path.join(REVIEW_DIR, "K-257.html"), "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    if SIDEFILES:
        before_copies()
    detail_boards()
    modals()
    approvals()
    k219.approvals_empty()   # 承認待ちが空の絵は、今の承認待ちから作り直す（持ち主はこの作り手・k219.py も同じ物を作る）
    pc_boards()
    subprocess.run([sys.executable, "shellfix.py"], cwd=HERE, check=True, stdout=subprocess.DEVNULL)
    if SIDEFILES:
        update_canvas_json()
        update_screens()
        update_fidelity()
        review_sheet()
    print("K-257 の絵", len(DETAIL) + 3 + 1 + 3, "枚")

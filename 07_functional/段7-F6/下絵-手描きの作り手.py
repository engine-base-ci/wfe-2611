#!/usr/bin/env python3
"""段 7（F6）の下絵（導線と配置だけ）を 1 枚の静的な HTML に書き出す。画像・スクリプトは持たない。"""
import sys
from html import escape as e

OUT = sys.argv[1:]

CSS = """
:root{
  --ink:#131B27; --muted:#4A5563; --faint:#8A93A0; --line:#DDE2E9; --line-soft:#EDF0F4;
  --bg:#F3F5F8; --surface:#FFFFFF; --tint:#FAFBFC; --chip:#F2F4F7;
  --navy:#22345C; --navy-tint:#EEF3FD; --navy-ring:#DCE4F2;
  --amber:#B45309; --amber-tint:#FFFBF3; --green:#166534; --green-tint:#E8F5EC;
  --red:#B42318; --red-tint:#FDECEA; --hold:#5B6472; --hold-tint:#EEF0F3;
  --r-sm:4px; --r-md:6px; --r-lg:8px; --r-pill:99px;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:40px;
  --t-xs:11px; --t-sm:12px; --t-md:13px; --t-lg:15px; --t-xl:20px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:var(--t-md)/1.7 "Hiragino Sans","Noto Sans JP",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:var(--s-5) var(--s-4) var(--s-6)}
h1{font-size:var(--t-xl);margin:0 0 var(--s-2)}
h2{font-size:var(--t-lg);margin:var(--s-6) 0 var(--s-3);padding-bottom:var(--s-2);border-bottom:2px solid var(--navy)}
h3{font-size:var(--t-md);margin:0}
p{margin:0 0 var(--s-2)}
.lead{color:var(--muted);max-width:76ch}
.legend{display:flex;flex-wrap:wrap;gap:var(--s-2) var(--s-4);margin:var(--s-3) 0;padding:var(--s-3) var(--s-4);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);font-size:var(--t-sm)}
.legend>span{display:inline-flex;align-items:center;gap:6px}
.legend .ps,.legend .sel,.legend .ask,.legend .node{white-space:nowrap;flex:none}
.toc{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--s-2) var(--s-4);margin:var(--s-3) 0;padding:0;list-style:none;font-size:var(--t-sm)}
.toc a{color:var(--navy)}
.flow{display:flex;flex-direction:column;gap:var(--s-2);padding:var(--s-4);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg)}
.flow-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:var(--t-sm)}
.flow-row b{min-width:5.5em;color:var(--navy)}
.node{border:1px solid var(--line);border-radius:var(--r-md);padding:2px 10px;background:var(--tint)}
.node.new{border-color:var(--navy);background:var(--navy-tint)}
.arrow{color:var(--faint)}
.state{margin:0 0 var(--s-5);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.state-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s-2) var(--s-3);padding:var(--s-3) var(--s-4);border-bottom:1px solid var(--line-soft)}
.state-head code{font-size:var(--t-xs);color:var(--muted);background:var(--chip);border-radius:var(--r-sm);padding:1px 6px}
.ps{font-size:var(--t-xs);border-radius:var(--r-pill);padding:1px 10px;background:var(--navy);color:#fff}
.meta{display:grid;grid-template-columns:8.5em 1fr;gap:2px var(--s-3);margin:0;padding:var(--s-3) var(--s-4);font-size:var(--t-sm);background:var(--tint);border-bottom:1px solid var(--line-soft)}
.meta dt{color:var(--muted)} .meta dd{margin:0}
.stage{padding:var(--s-4);overflow-x:auto;background:repeating-linear-gradient(45deg,#F6F7FA 0 10px,#F1F3F7 10px 20px)}
.frames{display:flex;flex-wrap:wrap;gap:var(--s-4);align-items:flex-start}
figure{margin:0}
figcaption{font-size:var(--t-xs);color:var(--muted);margin-top:4px}
/* 枠：詳細の全体 */
.page{width:1060px;display:grid;grid-template-columns:52px 1fr 380px;grid-template-rows:40px auto;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.page-nav{grid-row:1/3;background:#E9EDF3;border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:10px;padding-top:10px}
.page-nav i{width:22px;height:22px;border-radius:var(--r-md);background:#CBD3DE;display:block}
.page-nav i.on{background:var(--navy)}
.page-top{grid-column:2/4;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:var(--s-2);padding:0 var(--s-4);font-size:var(--t-sm);color:var(--muted)}
.page-body{padding:var(--s-4);min-width:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--s-3) var(--s-4)}
.meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-2);font-size:var(--t-sm);color:var(--muted)}
.meta-row .right{margin-left:auto;display:flex;align-items:center;gap:var(--s-3)}
.title{font-size:var(--t-xl);font-weight:600;margin:var(--s-2) 0;line-height:1.4}
.kind{background:var(--navy);color:#fff;border-radius:var(--r-sm);padding:0 6px;font-size:var(--t-xs)}
.pill{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);padding:1px 10px;font-size:var(--t-sm);background:var(--chip);color:var(--ink);border:1px solid transparent;white-space:nowrap}
.pill.doing{background:var(--navy-tint);color:var(--navy)} .pill.hold{background:var(--hold-tint);color:var(--hold)}
.pill.wait{background:var(--amber-tint);color:var(--amber)} .pill.done{background:var(--green-tint);color:var(--green)}
.pill.btn{border-color:var(--line);cursor:pointer} .pill.btn::after{content:"▾";font-size:10px}
.pill.new{background:var(--amber);color:#fff;font-size:var(--t-xs);padding:0 7px}
.band{border-radius:var(--r-lg);padding:var(--s-3) var(--s-4);margin:var(--s-2) 0;border:1px solid var(--line);background:var(--hold-tint)}
.band.wait{background:var(--amber-tint);border-color:#F3D9B5}
.band h3{margin-bottom:2px}
.band-acts{display:flex;gap:var(--s-2);margin-top:var(--s-2)}
.doc h4{font-size:14px;margin:var(--s-4) 0 var(--s-1);padding-bottom:4px;border-bottom:1px solid var(--line-soft);display:flex;align-items:center;gap:var(--s-2)}
.doc h4 .right{margin-left:auto}
.ph{height:10px;border-radius:5px;background:var(--line-soft);margin:6px 0}
.ph.w60{width:60%} .ph.w80{width:80%} .ph.w40{width:40%}
/* 右のパネル */
.panel{width:380px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;min-height:120px}
.page .panel{border-width:0 0 0 1px}
.tabs{display:flex;border-bottom:1px solid var(--line);padding:0 6px}
.tab{padding:9px 12px;border-bottom:2px solid transparent;color:var(--muted);display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
.tab.on{border-color:var(--navy);color:var(--navy);font-weight:600}
.count{font-size:var(--t-xs);background:var(--amber);color:#fff;border-radius:var(--r-pill);padding:0 6px}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:var(--s-2) var(--s-4);border-bottom:1px solid var(--line-soft);font-size:var(--t-sm)}
.chip{border:1px solid var(--line);border-radius:var(--r-pill);padding:0 10px;background:var(--surface)}
.chip.on{background:var(--navy);border-color:var(--navy);color:#fff}
.thread{padding:0 var(--s-4) var(--s-2);display:flex;flex-direction:column}
.day{display:flex;align-items:center;gap:var(--s-2);font-size:var(--t-xs);color:var(--muted);padding:10px 0 2px}
.day::before,.day::after{content:"";flex:1;border-top:1px solid var(--line-soft)}
.post{display:flex;gap:10px;padding:var(--s-3) 0}
.post.is-new{background:var(--amber-tint);margin:0 calc(var(--s-4)*-1);padding:var(--s-3) var(--s-4);box-shadow:inset 3px 0 0 var(--amber)}
.av{width:28px;height:28px;flex:none;border-radius:var(--r-pill);background:#6B5B99;color:#fff;font-size:var(--t-xs);display:grid;place-items:center}
.av.b{background:#2F4B7C} .av.c{background:#186F69} .av.s{width:20px;height:20px;font-size:10px}
.post-main{flex:1;min-width:0}
.post-head{display:flex;flex-wrap:wrap;gap:var(--s-2);align-items:baseline;font-size:var(--t-sm)}
.post-head time,.sub{color:var(--muted);font-size:var(--t-xs)}
.post-acts{display:flex;flex-wrap:wrap;gap:10px;font-size:var(--t-xs);color:var(--muted);margin-top:6px}
.post-acts .ok{color:var(--green)}
.mention{color:var(--navy);background:var(--navy-tint);border-radius:var(--r-sm);padding:0 4px}
.chg{display:inline-block;font-size:var(--t-xs);color:var(--muted);background:var(--chip);border-radius:var(--r-sm);padding:1px 7px;margin:4px 4px 0 0}
.small{display:flex;gap:var(--s-2);align-items:center;padding:6px 0 6px 4px;font-size:var(--t-sm);color:var(--muted)}
.small>span:not(.av){flex:1;min-width:0}
.run{display:flex;gap:var(--s-2);align-items:center;margin:4px 0;padding:var(--s-2) 10px;border:1px solid var(--line);border-radius:var(--r-lg);font-size:var(--t-sm)}
.run .robot{width:22px;height:22px;border-radius:var(--r-md);background:var(--navy);color:#fff;font-size:10px;display:grid;place-items:center;flex:none}
.quote{border-left:3px solid var(--line);padding-left:var(--s-2);color:var(--muted);font-size:var(--t-sm);margin:2px 0}
.composer{border-top:1px solid var(--line);padding:10px var(--s-4) var(--s-3);background:var(--surface);position:relative}
.box{border:1px solid var(--navy);box-shadow:0 0 0 2px var(--navy-ring);border-radius:var(--r-lg)}
.box.plain{border-color:var(--line);box-shadow:none}
.box-text{min-height:56px;padding:var(--s-2) 10px;color:var(--ink)}
.box-text.ghost{color:var(--faint)}
.box-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px var(--s-2);border-top:1px solid var(--line-soft);background:var(--tint);border-radius:0 0 var(--r-lg) var(--r-lg);font-size:var(--t-sm)}
.sel{display:inline-flex;gap:4px;align-items:center;border:1px solid var(--line);border-radius:var(--r-md);padding:1px 8px;background:var(--surface)}
.notify{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:var(--s-2);font-size:var(--t-sm)}
.who{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);background:var(--navy-tint);padding:1px 8px 1px 2px}
.hint{font-size:var(--t-xs);color:var(--muted);margin-top:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 14px;border-radius:var(--r-md);border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:var(--t-sm);white-space:nowrap}
.btn.primary{background:var(--navy);border-color:var(--navy);color:#fff}
.btn.danger{background:var(--red);border-color:var(--red);color:#fff}
.btn.sm{height:24px;padding:0 10px}
.btn.busy{opacity:.6}
.push{margin-left:auto}
/* まだ使えない物（キャンバスに在る・D-145.9）：隠さずグレーで押せない形 */
.inert{border:1px dashed #B7BFCA !important;background:#F4F5F7 !important;color:var(--faint) !important;box-shadow:none !important;cursor:not-allowed}
.inert-box{border:1px dashed #B7BFCA;background:#F4F5F7;color:var(--faint);border-radius:var(--r-md);padding:var(--s-2) 10px;font-size:var(--t-sm)}
.menu{width:230px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:0 8px 24px rgba(19,27,39,.14);padding:4px;font-size:var(--t-md)}
.menu div{display:flex;justify-content:space-between;gap:var(--s-2);padding:6px 10px;border-radius:var(--r-md)}
.menu div.on{background:var(--navy-tint);color:var(--navy)}
.menu div.off{color:var(--faint)}
.menu hr{border:0;border-top:1px solid var(--line-soft);margin:4px 0}
.menu small{color:var(--faint);font-size:var(--t-xs)}
.pop{position:absolute;left:var(--s-4);bottom:100%;margin-bottom:-56px;z-index:2}
.dim{background:rgba(19,27,39,.45);padding:var(--s-5);border-radius:var(--r-lg);display:grid;place-items:center;min-width:480px}
.dialog{width:420px;background:var(--surface);border-radius:var(--r-lg);box-shadow:0 12px 32px rgba(19,27,39,.25);overflow:hidden}
.dialog.wide{width:520px}
.dialog-head{display:flex;align-items:center;gap:var(--s-2);padding:var(--s-3) var(--s-4);border-bottom:1px solid var(--line);font-size:var(--t-lg);font-weight:600}
.dialog-body{padding:var(--s-3) var(--s-4);display:flex;flex-direction:column;gap:var(--s-3)}
.dialog-foot{display:flex;justify-content:flex-end;gap:var(--s-2);padding:var(--s-3) var(--s-4);border-top:1px solid var(--line)}
.field label{display:block;font-size:var(--t-sm);color:var(--muted);margin-bottom:2px}
.field label b{color:var(--red)}
.input{border:1px solid var(--line);border-radius:var(--r-md);padding:5px 10px;min-height:30px;background:var(--surface)}
.input.tall{min-height:56px} .input.err{border-color:var(--red)} .input.short{width:72px;display:inline-block}
.err-text{color:var(--red);font-size:var(--t-xs)}
.note{border-radius:var(--r-md);padding:var(--s-2) 10px;font-size:var(--t-sm);background:var(--amber-tint);border:1px solid #F3D9B5}
.note.red{background:var(--red-tint);border-color:#F5C6C0;color:var(--red)}
.note.ok{background:var(--green-tint);border-color:#BFE3CB;color:var(--green)}
.src{border:1px solid var(--line-soft);background:var(--tint);border-radius:var(--r-md);padding:var(--s-2) 10px;font-size:var(--t-sm)}
.fields{display:grid;grid-template-columns:6.5em 1fr;gap:6px var(--s-2);font-size:var(--t-sm);padding:var(--s-2) var(--s-4)}
.fields dt{color:var(--muted)} .fields dd{margin:0}
.sec-title{font-size:var(--t-xs);color:var(--muted);padding:var(--s-3) var(--s-4) 0;font-weight:600}
.dec{padding:var(--s-2) 0;border-bottom:1px solid var(--line-soft)}
.dec:last-child{border-bottom:0}
.dec b{font-weight:600}
.dec.old b{text-decoration:line-through;color:var(--muted)}
.dec .tag{font-size:var(--t-xs);border-radius:var(--r-sm);padding:0 6px;background:var(--chip);color:var(--muted);margin-left:6px}
.dec-acts{display:flex;gap:10px;font-size:var(--t-xs);color:var(--navy)}
.center{padding:var(--s-5) var(--s-4);text-align:center;color:var(--muted)}
.skeleton{height:44px;border-radius:var(--r-md);background:linear-gradient(90deg,var(--line-soft),#F7F8FA,var(--line-soft));margin:var(--s-2) var(--s-4)}
.phone{width:375px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.phone .panel{width:auto;border-width:1px 0 0}
.jump{color:var(--navy);font-size:var(--t-sm);text-decoration:underline}
.ask{font-size:var(--t-xs);border-radius:var(--r-pill);padding:1px 8px;background:var(--amber-tint);color:var(--amber);border:1px solid #F3D9B5;white-space:nowrap}
@media (max-width:767px){.meta{grid-template-columns:1fr}.dim{min-width:0;padding:var(--s-3)}.dialog,.dialog.wide{width:100%}}
"""


def chip(t, on=False):
    return f'<span class="chip{" on" if on else ""}">{t}</span>'


def av(c, cls=""):
    return f'<span class="av {cls}" aria-hidden="true">{c}</span>'


def post(c, who, when, text, cls="", extra="", acts="", chg=(), notify="", new=False, edited=""):
    chgs = "".join(f'<span class="chg">{x}</span>' for x in chg)
    nt = f'<div class="sub">知らせた：{notify}</div>' if notify else ""
    ed = f' <span class="sub">直した {edited}</span>' if edited else ""
    newp = ' <span class="pill new">新しい</span>' if new else ""
    acts = acts or '<span>☆</span><span>引用</span><span>決定にする</span>'
    return (f'<div class="post{" is-new" if new else ""}">{av(c, cls)}<div class="post-main">'
            f'<div class="post-head"><b>{who}</b><time>{when}</time>{ed}{newp}</div>{extra}'
            f'<div>{text}</div>{chgs}{nt}<div class="post-acts">{acts}</div></div></div>')


def small(c, cls, text, when):
    return f'<div class="small">{av(c, cls + " s")}<span>{text}</span><time class="sub">{when}</time></div>'


def run(text, when, res, data=True):
    req = ' data-requires="data"' if data else ""
    return (f'<div class="run"{req}><span class="robot">AI</span><span style="flex:1;min-width:0"><b>高本のAI</b> {text}'
            f'<span class="sub" style="display:block">{when} ・ 実行の記録を見る →</span></span><span class="pill done">{res}</span></div>')


def tabs(active, count=""):
    def t(key, label):
        return f'<span class="tab{" on" if key == active else ""}">{label}</span>'
    cnt = f' <span class="count">{count}</span>' if count else ""
    return ('<nav class="tabs" aria-label="パネルのタブ">' + t("attr", "属性") + t("talk", "やり取り" + cnt)
            + '<span class="tab inert" title="段 6 で作る">高本のAI</span></nav>')


FILTERS = ('<div class="filters">' + chip("すべて", True) + chip("話だけ") + chip("自分あて 1")
           + '<span class="push sub">古い順 ▾</span></div>')

TOOLS_GREY = ('<span class="sel inert" title="段 5・段 9 で作る">担当 変えない ▾</span>'
              '<span class="sel inert" title="段 5 で作る">📎</span>')


def composer(text="", ghost="書き込む（@ で人を呼べます）", stage="変えない", notify=("佐藤", "鈴木"), btn="書き込む",
             extra_top="", extra_mid="", busy=False, plain=False, stage_inert=False):
    body = f'<div class="box-text">{text}</div>' if text else f'<div class="box-text ghost">{ghost}</div>'
    who = "".join(f'<span class="who">{av(n[0], "s c")}{n} ×</span>' for n in notify)
    st = (f'<span class="sel inert">状態 {stage} ▾</span>' if stage_inert
          else f'<span class="sel">状態 <b>{stage}</b> ▾</span>')
    return (f'<div class="composer">{extra_top}<div class="box{" plain" if plain else ""}">{body}'
            f'<div class="box-tools">{st}{TOOLS_GREY}</div></div>{extra_mid}'
            f'<div class="notify"><span class="sub">知らせる人</span>{who}<span style="color:var(--navy)">＋</span>'
            f'<span class="push btn primary sm{" busy" if busy else ""}">{btn}</span></div>'
            f'<div class="hint">状態を変えると、この書き込みと一緒に残る ・ @ で呼ぶ</div></div>')


THREAD_FULL = (
    '<div class="thread">'
    + '<div class="day">10/28（火）</div>'
    + post("高", "高本 聖斗", "14:02", "山田様から、支払期日は<b>月末締め翌月末</b>でよいと返事がありました。", notify="鈴木",
           acts='<span>☆ 1</span><span>引用</span><span class="ok">✓ 決定にした</span><span>…</span>')
    + '<div class="day">10/30（木）</div>'
    + small("高", "", "<b>高本</b> がチケットを作った", "17:44")
    + small("高", "", "<b>高本</b> が状態を <b>未着手 → 作業中</b> に変えた", "17:50")
    + '<div class="day">11/01（土）</div>'
    + run("が請求書を作り、確認を流した", "09:00 → 09:12 ・ 12 分", "通った")
    + post("鈴", "鈴木 一郎", "10:20", '10/19 の追加対応は無償にした件、反映が要るかもしれません。<span class="mention">@高本</span> さん確認お願いします',
           cls="b", notify="高本・佐藤")
    + post("佐", "佐藤 花子", "10:41", "無償で合意済みなら外して OK です。今日中に出せると助かります", cls="c",
           chg=("状態：作業中 → 保留",), notify="高本・鈴木", new=True)
    + '</div>')


def panel(inner, active="talk", count="1"):
    return f'<aside class="panel" aria-label="チケットのパネル">{tabs(active, count)}{inner}</aside>'


def dialog(title, body, foot, wide=False):
    return (f'<div class="dim"><div class="dialog{" wide" if wide else ""}" role="dialog" aria-label="{e(title)}">'
            f'<div class="dialog-head">{title}<span class="push sub">×</span></div>'
            f'<div class="dialog-body">{body}</div><div class="dialog-foot">{foot}</div></div></div>')


def field(label, value, req=False, tall=False, err="", cls=""):
    r = " <b>*</b>" if req else ""
    er = f'<div class="err-text">{err}</div>' if err else ""
    return (f'<div class="field"><label>{label}{r}</label>'
            f'<div class="input{" tall" if tall else ""}{" err" if err else ""} {cls}">{value}</div>{er}</div>')


def meta_row(stage_html, extra=""):
    return ('<div class="meta-row"><span class="kind">タスク</span><span>EG-128</span><span>作成 10/30 17:44</span>'
            f'<span class="right">{extra}<span>期限 <b>11/05</b></span>{stage_html}</span></div>')


STAGE_MENU = ('<div class="menu" role="menu" aria-label="状態を変える">'
              '<div class="on"><span>未着手</span><span>✓</span></div>'
              '<div><span>作業中</span></div>'
              '<div><span>保留…</span><small>理由を書く</small></div><hr>'
              '<div class="off"><span>完了にする…</span><small>作業中にしてから</small></div></div>')

DOC = ('<div class="doc"><h4>目的</h4><div class="ph w80"></div><div class="ph w60"></div>'
       '<h4>完了の条件</h4><div class="ph w80"></div><div class="ph w40"></div></div>')

DEC_LIST = (
    '<div class="dec"><b>10/19 の追加対応は無償。11 月分の請求から外す</b>'
    '<div class="sub">11/01 鈴木 一郎（先方と合意）・理由：先方の都合による作業のため ・ 元：やり取り 11/01 10:20 →</div>'
    '<div class="dec-acts"><span>改める</span><span>取り消す</span></div></div>'
    '<div class="dec"><b>支払期日は月末締め翌月末</b><span class="tag">10/28 の決定を改めた</span>'
    '<div class="sub">10/28 高本 ・ 理由：山田様から了承 ・ 元：やり取り 10/28 14:02 →</div>'
    '<div class="dec-acts"><span>改める</span><span>取り消す</span></div></div>'
    '<div class="dec old"><b>支払期日は月末締め翌々月 10 日</b><span class="tag">改められた</span>'
    '<div class="sub">10/20 高本 ・ 新しい決定：支払期日は月末締め翌月末 ↑</div></div>'
    '<div class="dec old"><b>請求書は郵送もする</b><span class="tag">取り消した</span>'
    '<div class="sub">10/21 佐藤 ・ 取り消し 10/22 佐藤：先方がメールだけでよいと言ったため</div></div>')


def dec_section(inner, add=True):
    a = '<span class="right btn sm">＋ 決定を足す</span>' if add else ""
    return f'<div class="doc"><h4>決定ログ（2）{a}</h4>{inner}</div>'


STATES = []


def state(sid, title, ps, act, api, note, frames, asks=""):
    ask = "".join(f' <span class="ask">代表に聞く {a}</span>' for a in asks.split()) if asks else ""
    fr = "".join(f'<figure>{h}<figcaption>{cap}</figcaption></figure>' for cap, h in frames)
    STATES.append((sid, title))
    return (f'<section class="state" id="{sid}" data-ps="{ps.split()[0]}">'
            f'<div class="state-head"><h3>{title}</h3><code>{sid}</code><span class="ps">{ps}</span>{ask}</div>'
            f'<dl class="meta"><dt>行為・押す物</dt><dd>{act}</dd><dt>口</dt><dd>{api}</dd><dt>配置の決め</dt><dd>{note}</dd></dl>'
            f'<div class="stage"><div class="frames">{fr}</div></div></section>')


def build():
    out = []
    # ---------- 進める ----------
    p = []
    page = ('<div class="page"><div class="page-nav"><i></i><i class="on"></i><i></i><i></i></div>'
            '<div class="page-top">チケット › EG-128<span class="push">探す ・ 知らせ ・ 高</span></div>'
            '<div class="page-body"><div class="card">'
            + meta_row('<span class="pill btn">未着手</span>')
            + '<div class="title">セイコー様へ 11 月分の請求書を送る</div>'
            + '<div class="inert-box">（承認・実行・完了の帯の場所。保留中はここに保留の帯）</div>'
            + DOC + dec_section(DEC_LIST[:DEC_LIST.index('<div class="dec old">')])
            + '<div class="doc"><h4>申し送り</h4><div class="ph w60"></div></div></div></div>'
            + panel(FILTERS + '<div class="thread">' + small("高", "", "<b>高本</b> がチケットを作った", "17:44") + '</div>'
                    + composer(), count="") + '</div>')
    p.append(state("prog-overview", "詳細の全体：段 7 で生きる 4 つの所", "PS0 登録直後（PC なし）",
                   "①頭の行の<b>段の札</b>（押すと選べる）②題名の下の<b>帯</b>（保留中）③本文の<b>決定ログ</b>の区画 ④右のパネルのタブ<b>「やり取り」</b>と属性の<b>実績</b>",
                   "getTicket（在る）・listTicketTimeline（開くときに 1 回・タブの数もここから）・listTicketDecisions",
                   "新しい画面は足さない。/tickets/[id] の中の 4 つの所に入れる。PC が無くても全部使える（D-127.8）。〈名前〉のAI のタブはグレーのまま",
                   [("幅 1440 の配置（左のバー・上の帯・本文・右のパネル 380）", page)], "①"))
    head = '<div class="card" style="width:640px">' + meta_row('<span class="pill btn">未着手</span>') \
        + '<div style="display:flex;justify-content:flex-end;margin-top:4px">' + STAGE_MENU + '</div></div>'
    p.append(state("prog-menu", "段の札を押した（未着手のチケット）", "PS0 登録直後（PC なし）",
                   "段の札 → メニュー。「作業中」を押すとその場で変わる。「保留…」は小窓へ。「完了にする…」は作業中のときだけ押せ、今の完了の小窓を開く",
                   "updateTicket（段だけ）。段の候補は listTicketStages（会社が足した段も並ぶ）",
                   "いまの段に ✓。押せない項目は訳を右に小さく出す（グレー）。変えた後は札の字が替わり、やり取りに 1 行残る。失敗したら札は元のままで知らせを出す",
                   [("頭の行と開いたメニュー", head)], "① ② ③"))
    dlg = dialog("保留にします",
                 field("保留の理由", "先方の検収が終わるまで請求できないため", req=True, tall=True)
                 + field("再開の条件", "", req=True, err="再開の条件を書いてください")
                 + '<div class="sub">例：先方の返事が来たら／11/10 の定例の後。保留の間も、やり取りと決定は書けます</div>',
                 '<span class="btn">やめる</span><span class="btn primary">保留にする</span>')
    p.append(state("prog-hold-dialog", "保留にする小窓（理由と再開の条件は必須）", "PS0 登録直後（PC なし）",
                   "メニューの「保留…」／書く欄の「状態 ▾ → 保留」から。2 つとも書かないと「保留にする」は通らない（D-125.33）",
                   "updateTicket（段＝保留・理由・再開の条件）",
                   "小窓の型は今の物（題・本文・足のボタン。主ボタンは 1 つ・右）。空のまま押したら欄の下に赤い訳。Esc と「やめる」で何も変えずに閉じる",
                   [("小窓（右の欄が空で押した形）", dlg)], "㉒"))
    band = ('<div class="card" style="width:640px">' + meta_row('<span class="pill btn hold">保留</span>')
            + '<div class="title">セイコー様へ 11 月分の請求書を送る</div>'
            + '<div class="band"><h3>保留中です</h3><div>理由：先方の検収が終わるまで請求できないため</div>'
            + '<div>再開の条件：検収の完了の連絡が来たら</div><div class="sub">11/01 10:41 佐藤 が保留にした</div>'
            + '<div class="band-acts"><span class="btn primary sm">作業中に戻す</span></div></div></div>')
    p.append(state("prog-hold-band", "保留中のチケット（題名の下の帯）", "PS0 登録直後（PC なし）",
                   "帯の「作業中に戻す」。段の札のメニューからも戻せる",
                   "getTicket（保留の理由と再開の条件はもう答えに在る）・updateTicket（段＝作業中）",
                   "帯は承認・実行の帯と同じ場所に 1 つだけ。主ボタンは帯の中の 1 つ。戻すと帯が消え、理由と条件は更新の記録に残る。変えられない人には帯だけ出しボタンは出さない",
                   [("頭の行・題名・保留の帯", band)], "④ ㉓"))
    lock = ('<div class="card" style="width:640px">'
            + meta_row('<span class="pill wait" data-requires="data">承認待ち 🔒</span>')
            + '<div class="title">セイコー様へ 11 月分の請求書を送る</div>'
            + '<div class="band wait" data-requires="data"><h3>あなたの承認を待っています</h3><div class="sub">（F5 の帯・今のまま）</div></div>'
            + '<div class="sub">札に指を乗せる・キーボードで止まると：「AI が動いている間と承認待ちの間は、状態を変えられません」</div></div>')
    p.append(state("prog-locked", "仕組みの段の間（確認中・承認待ち・実行中）は変えられない", "PS2 使っている（AI の実行が在る）",
                   "段の札は押せない形（▾ が無く、鍵の印）。書く欄の「状態 ▾」も押せない形",
                   "updateTicket は 409（何も変えない）。口を直に呼ばれても同じ",
                   "仕組みの段は人が動かせない（D-125.38）。AI が終わって作業の段に戻ったら、読み直しで札が押せる形に戻る（切り替わりの直後も試験する）",
                   [("頭の行（承認待ち）", lock)], "㉒"))
    attr = ('<div class="sec-title">日付と時間</div><dl class="fields"><dt>開始日</dt><dd>10/30（金）</dd><dt>期限</dt><dd>11/05（木）</dd>'
            '<dt>予定</dt><dd>30 分 <span class="sub">（直すのは段 5）</span></dd>'
            '<dt>実績</dt><dd>1 時間 12 分 <span class="sub">（AI 12 分・人 1 時間）</span> <span class="btn sm">直す</span></dd></dl>')
    edit = ('<div class="sec-title">日付と時間</div><dl class="fields"><dt>予定</dt><dd>30 分</dd>'
            '<dt>実績</dt><dd><div class="sub">人が使った時間</div><span class="input short">1</span> 時間 <span class="input short">30</span> 分'
            '<div class="hint">AI が動いた時間（12 分）は自動で足されます</div>'
            '<div style="display:flex;gap:8px;margin-top:6px"><span class="btn sm">やめる</span><span class="btn primary sm">保存</span></div></dd></dl>')
    p.append(state("prog-time", "実績（人が使った時間）を入れる", "PS2 使っている（AI の分が在る例）",
                   "右のパネル「属性」→ 日付と時間 → 実績の「直す」→ 時間と分を入れて保存",
                   "updateTicket（実績だけ）。AI の分は実行の記録から自動で足す（getTicket が返す）",
                   "PC が無い時点（PS0）では「（AI 0 分・人 …）」ではなく人の分だけを出す。0 より小さい・数字でない値は欄の下に訳。保存すると更新の記録に 1 行",
                   [("読む形", panel(attr, "attr", "")), ("直す形", panel(edit, "attr", ""))], "⑥"))
    ro = ('<div class="card" style="width:640px">' + meta_row('<span class="pill">未着手</span>')
          + '<div class="title">セイコー様へ 11 月分の請求書を送る</div>'
          + '<div class="sub">閲覧のみの人：段の札は字だけ（▾ が無い）。属性の実績に「直す」は出ない。保留の帯にボタンは出ない</div></div>')
    p.append(state("prog-readonly", "段を変えられない人（閲覧のみ）", "PS0 登録直後（PC なし）",
                   "押す物は無い（読むだけ）", "getTicket の can（変えられるか）で決める。口を直に呼ばれたら 403",
                   "使えない物を押せる形で出さない。札は今の見た目（字の札）のまま", [("頭の行", ro)], "②"))
    out.append(("A. 自分で進める（作業の段・実績）", p))

    # ---------- 話す ----------
    t = []
    t.append(state("talk-list", "やり取り：ふつう（書き込み・変更の 1 行・AI の実行・新しい印）", "PS2 使っている",
                   "タブ「やり取り」を押す → 一覧（古い順・新しい物がいちばん下）→ 下の書く欄。絞り込み（すべて・話だけ・自分あて）",
                   "listTicketTimeline（続きは上へ「前のやり取りを読む」）",
                   "書き込みは顔つきの箱、変更だけの記録は小さく 1 行、AI の実行は 1 回＝1 枚で実行の記録へ（D-128.45）。まだ読んでいない書き込みに「新しい」と左の線、タブに数。書く欄はパネルの下に固定",
                   [("右のパネル（幅 380）", panel(FILTERS + '<div class="center sub" style="padding:8px">前のやり取りを読む</div>' + THREAD_FULL + composer()))], "⑬ ⑮"))
    empty = panel(FILTERS + '<div class="center">まだやり取りはありません。<br>気づいたこと・聞きたいことを書いてください</div>' + composer(notify=()), count="")
    t.append(state("talk-empty", "やり取り：まだ無い", "PS0 登録直後（PC なし）",
                   "書く欄にすぐ書ける", "listTicketTimeline（0 件）",
                   "作った直後のチケットは「〈人〉がチケットを作った」の 1 行が在るので、本当に空になるのは「話だけ」「自分あて」で絞ったとき。そのときの文は「当てはまるやり取りはありません」",
                   [("空の形", empty)], "㉒"))
    loading = panel('<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>', count="")
    failed = panel('<div class="center"><div class="note red">やり取りを読み込めませんでした</div>'
                   '<div style="margin-top:8px"><span class="btn sm">もう一度読む</span></div></div>'
                   + composer(notify=(), plain=True), count="")
    t.append(state("talk-loading-failed", "やり取り：読み込み中・読めない", "PS0 登録直後（PC なし）",
                   "読めないときは「もう一度読む」", "listTicketTimeline が遅い・落ちた（503）・ログインが切れた（401 は入り直しへ）",
                   "読めなくても本文と属性はそのまま使える（パネルの中だけの失敗にする）。読めない間も書く欄は出す（書いた字は残る）",
                   [("読み込み中", loading), ("読めない", failed)]))
    pop = ('<div class="menu" style="width:220px"><div class="on"><span>鈴木 一郎</span></div><div><span>鈴木 健</span></div>'
           '<div class="off"><small>見られる人だけが候補に出ます</small></div></div>')
    comp = composer(text='了解です。<span class="mention">@鈴</span>▍', extra_top=f'<div style="margin-bottom:8px">{pop}</div>')
    t.append(state("talk-compose", "書く欄：@ の候補・知らせる人", "PS0 登録直後（PC なし）",
                   "@ を打つと候補（名前で絞る・↑↓ と Enter）。「知らせる人」は ＋ で足し × で外す。「書き込む」で送る（⌘/Ctrl＋Enter でも）",
                   "createTicketMessage（本文・@・知らせる人・引用元）。人の候補は listMembers（作る画面と同じ口）",
                   "知らせる人の部品は作る画面の物を使う（同じ物を 2 つ作らない）。担当 ▾ と 📎 はグレー（まだ）。送ると一覧のいちばん下に出て、書く欄は空になる。@ された人の受け箱に 1 行（ベルは段 8）",
                   [("書く欄（@ の候補が開いた形）", panel(comp, count=""))], "⑧ ⑨ ⑮"))
    stg = ('<div class="menu" style="width:200px"><div class="on"><span>変えない</span><span>✓</span></div><div><span>未着手</span></div>'
           '<div><span>作業中</span></div><div><span>保留…</span></div></div>')
    hold_mid = ('<div style="margin-top:8px;display:grid;gap:6px">' + field("保留の理由", "検収の完了を待つ", req=True)
                + field("再開の条件", "検収の完了の連絡が来たら", req=True) + '</div>')
    t.append(state("talk-compose-stage", "書く欄：状態 ▾ で、書き込みと一緒に段を変える", "PS0 登録直後（PC なし）",
                   "状態 ▾ → 段を選ぶ → 書き込む。保留を選ぶと、理由と再開の条件の欄がその場で開く",
                   "createTicketMessage（段つき。書き込みと段の変更が 1 つの取引で残る。片方だけ残ることは無い）",
                   "送ると、書き込みの下に「状態：作業中 → 保留」の札が付く。字が空でも段だけ変えて送れるかは、頭の札と同じ結果（1 行の記録）にする。仕組みの段の間は 状態 ▾ が押せない",
                   [("状態 ▾ を開いた", panel(composer(text="検収が終わるまで止めます", extra_top=f'<div style="margin-bottom:8px">{stg}</div>'), count="")),
                    ("保留を選んだ", panel(composer(text="検収が終わるまで止めます", stage="保留", extra_mid=hold_mid), count=""))], "①"))
    mine = post("高", "高本 聖斗", "11:02", "了解です。10/19 分を外して今日中に送ります", edited="11/01 11:05",
                acts='<span>☆</span><span>引用</span><span>決定にする</span><span><b>…</b></span>')
    menu = '<div class="menu" style="width:150px;margin-left:auto"><div><span>直す</span></div><div><span>消す…</span></div></div>'
    editing = ('<div class="post">' + av("高") + '<div class="post-main"><div class="post-head"><b>高本 聖斗</b><time>11:02</time></div>'
               '<div class="box"><div class="box-text">了解です。10/19 分を外して今日中に送ります▍</div></div>'
               '<div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end"><span class="btn sm">やめる</span><span class="btn primary sm">直す</span></div></div></div>')
    t.append(state("talk-edit", "自分の書き込みの「…」：直す（その場で）・直した印", "PS0 登録直後（PC なし）",
                   "自分の書き込みの「…」→ 直す → その場で字を直して「直す」。人の書き込みには「…」が出ない（マネージャーには「消す…」だけ出る）",
                   "updateTicketMessage（書いた本人だけ・本文と @）",
                   "直した書き込みに「直した 11/01 11:05」。直している間にほかの人が消していたら「この書き込みは消されています」で元に戻す",
                   [("「…」を開いた・直した印", panel('<div class="thread">' + mine + menu + '</div>', count="")),
                    ("直している", panel('<div class="thread">' + editing + '</div>', count=""))], "⑩"))
    dl = dialog("この書き込みを消しますか？",
                '<div class="src">了解です。10/19 分を外して今日中に送ります</div>'
                '<div>消すと元に戻せません。「高本 が書き込みを消しました」の 1 行が残ります</div>',
                '<span class="btn">やめる</span><span class="btn danger">消す</span>')
    gone = ('<div class="thread">' + small("高", "", "<b>高本</b> が書き込みを消しました", "11:09")
            + small("佐", "c", "マネージャーの <b>佐藤</b> が <b>鈴木</b> の書き込みを消しました", "11:20") + '</div>')
    t.append(state("talk-delete", "書き込みを消す：確かめの小窓と、消した跡", "PS0 登録直後（PC なし）",
                   "「…」→ 消す… → 確かめ → 消す", "deleteTicketMessage（書いた本人。マネージャーは人の書き込みも）",
                   "取り消せない操作なので確かめを通す（赤いボタン・やめるが左）。消した後は本文の代わりに 1 行。決定の元だった書き込みを消すと、決定の側に「元の書き込みは消されました」",
                   [("確かめの小窓", dl), ("消した跡", panel(gone, count=""))], "⑪"))
    fail = composer(text="了解です。10/19 分を外して今日中に送ります",
                    extra_top='<div class="note red" style="margin-bottom:8px">送れませんでした。もう一度お試しください（書いた字は残っています）</div>')
    busy = composer(text="了解です。10/19 分を外して今日中に送ります", btn="送っています…", busy=True)
    t.append(state("talk-send", "送っている間・送れなかった", "PS0 登録直後（PC なし）",
                   "送っている間は「書き込む」が押せない（二度押しで 2 通にならない）。失敗したら字を残して押し直せる",
                   "createTicketMessage が遅い・落ちた・途中で切れた・ログインが切れた・チケットが消された（404 は「このチケットは消されました」）",
                   "書きかけの字は送るまでその端末に残す。同じ書き込みを 2 回送っても 1 通（冪等の鍵）",
                   [("送っている", panel(busy, count="")), ("送れなかった", panel(fail, count=""))]))
    cannot = ('<div class="composer"><div class="inert-box">閲覧のみのため、書き込めません</div></div>')
    done = composer(ghost="完了したチケットにも書けます（段は変わりません）", notify=(), stage_inert=True)
    t.append(state("talk-cannot", "書けない人（閲覧のみ）／完了したチケット", "PS2 使っている",
                   "⑧ が (b) のときだけ左の形。勧め (a) なら閲覧のみの人も右と同じ書く欄（状態 ▾ は押せない）",
                   "createTicketMessage（権限は代表の答えで決まる）",
                   "完了したチケットは書ける（段は変えられないので 状態 ▾ は押せない形。開き直すは段の札から）",
                   [("閲覧のみ（⑧ が b のとき）", panel(FILTERS + cannot, count="")),
                    ("完了したチケット", panel(FILTERS + done, count=""))], "⑧ ⑭"))
    phone = ('<div class="phone"><div class="page-top" style="height:40px">チケット › EG-128</div><div style="padding:12px">'
             '<div class="card">' + '<div class="meta-row"><span class="kind">タスク</span><span>EG-128</span><span class="pill btn doing">作業中</span></div>'
             + '<div class="title" style="font-size:16px">セイコー様へ 11 月分の請求書を送る</div>'
             + '<span class="jump">やり取り 3 ↓</span>' + DOC + '</div></div>'
             + panel(FILTERS + '<div class="thread">' + post("佐", "佐藤 花子", "10:41", "今日中に出せると助かります", cls="c", new=True) + '</div>' + composer(notify=("佐藤",)))
             + '</div>')
    t.append(state("talk-narrow", "狭い幅（375）：パネルは本文の下。題名の行に「やり取り」への飛び先", "PS2 使っている",
                   "題名の下の「やり取り 3 ↓」を押すと、下のやり取りまで動く。書く欄は画面に貼り付けない（今の詳細の形のまま）",
                   "同じ口", "幅 1023 以下は今と同じくパネルが本文の下（K-257）。入力欄の字は 16px（D-144.7）。スマホ専用の形（頭のタブ・書く欄を下に固定＝MbTalk）にするかは代表に聞く",
                   [("幅 375", phone)], "㉑"))
    out.append(("B. 話す（やり取り）", t))

    # ---------- 決める ----------
    d = []
    sec = '<div class="card" style="width:640px"><div class="sub">作るときに書いた字：支払いは銀行振込</div>' + dec_section(DEC_LIST) + '</div>'
    d.append(state("dec-log", "本文の決定ログの区画：一覧（改められた・取り消した・元の書き込みへ）", "PS0 登録直後（PC なし）",
                   "区画の見出しの右「＋ 決定を足す」／行の「改める」「取り消す」／「元：やり取り →」で右のパネルのその書き込みへ",
                   "listTicketDecisions",
                   "新しい決定が上。改められた物・取り消した物は線を引いて下に残す（消さない・D-125.63）。右の目次の「決定ログ（2）」は生きている決定の数。書けない人には足す・改めるを出さない",
                   [("本文の中の区画", sec)], "⑰ ⑳"))
    emp = '<div class="card" style="width:640px"><div class="doc"><h4>決定ログ<span class="right btn sm">＋ 決定を足す</span></h4><div class="sub">まだ決定はありません。決めたことと理由を残すと、あとから根拠として引けます</div></div></div>'
    bad = '<div class="card" style="width:640px"><div class="doc"><h4>決定ログ</h4><div class="note red">決定を読み込めませんでした <span class="btn sm">もう一度読む</span></div></div></div>'
    d.append(state("dec-empty", "決定が無い・読めない", "PS0 登録直後（PC なし）",
                   "＋ 決定を足す", "listTicketDecisions（0 件・503）",
                   "読めないのは区画の中だけ（本文のほかの区画は出す）", [("空", emp), ("読めない", bad)]))
    body = ('<div class="src"><b>鈴木 一郎</b> <span class="sub">11/01 10:20</span><br>10/19 の追加対応は先方の都合で無償にした件…</div>'
            + field("決めたこと", "10/19 の追加対応は無償。11 月分の請求から外す", req=True, tall=True)
            + '<div class="inert-box" data-requires="ai">AI が一文にまとめた案 ── AI の案は、自分の AI と話す画面ができてから使えます</div>'
            + field("決めた人", "鈴木 一郎 ▾　　ひとこと：先方と合意")
            + field("理由", "先方の都合による作業のため")
            + '<div class="field"><label>どこまで効かせる</label><div style="display:flex;gap:8px;flex-wrap:wrap">'
              '<span class="sel">◉ このチケットだけ</span><span class="sel inert" title="段 12 で作る">○ セイコー様のこれから（取引先のルールにする）</span></div></div>'
            + '<div class="inert-box" data-requires="ai">本文と食い違う所を AI が見つけて直す案を出す（まだ）</div>')
    d.append(state("dec-from-message", "書き込みを決定にする小窓", "PS0 登録直後（PC なし）",
                   "やり取りの書き込みの「決定にする」→ 小窓 →「決定にする」。済むと書き込みに「✓ 決定にした」、本文の決定ログに 1 件、やり取りに 1 行",
                   "createTicketDecision（元の書き込みつき）",
                   "キャンバス TdDecision の並び。AI の案の欄・取引先のルール・本文を直す案は、グレーで出す（隠さない・D-145.9）。決めたことの最初の字は、書き込みの本文をそのまま入れておく（人が短く直す）",
                   [("小窓", dialog("決定にする", body, '<span class="btn">やめる</span><span class="btn primary">決定にする</span>', wide=True))], "⑯ ⑱ ⑲"))
    body2 = (field("決めたこと", "", req=True, tall=True, err="決めたことを書いてください") + field("決めた人", "高本 聖斗 ▾") + field("理由", ""))
    d.append(state("dec-add", "決定を足す小窓（直接書く）", "PS0 登録直後（PC なし）",
                   "本文の決定ログの「＋ 決定を足す」→ 小窓 →「決定を足す」", "createTicketDecision（元の書き込みなし）",
                   "上の小窓から元の書き込みの箱を除いた形。決めたことが空だと通らない。字数の上限は置かない（D-130.1）",
                   [("小窓（空で押した形）", dialog("決定を足す", body2, '<span class="btn">やめる</span><span class="btn primary">決定を足す</span>'))], "⑱"))
    rev = ('<div class="src"><span class="sub">前の決定（10/20 高本）</span><br>支払期日は月末締め翌々月 10 日</div>'
           + field("新しい決定", "支払期日は月末締め翌月末", req=True, tall=True) + field("改める理由", "山田様から了承")
           + '<div class="sub">前の決定は消えず、「改められた」の印が付きます</div>')
    can = (field("取り消す理由", "", req=True, err="取り消す理由を書いてください") + '<div class="sub">取り消した印と理由が残ります（消えません）</div>')
    d.append(state("dec-revise", "決定を改める小窓／取り消す確かめ", "PS0 登録直後（PC なし）",
                   "決定の行の「改める」「取り消す」", "createTicketDecision（改める元つき）・updateTicketDecision（取り消す）",
                   "改めると、新しい行が上に足され、古い方に「改められた」と新しい決定への線。もう改められた・取り消した決定には「改める」「取り消す」を出さない",
                   [("改める", dialog("決定を改める", rev, '<span class="btn">やめる</span><span class="btn primary">改める</span>')),
                    ("取り消す（理由が空で押した形）", dialog("この決定を取り消しますか？", can, '<span class="btn">やめる</span><span class="btn danger">取り消す</span>'))], "⑰"))
    conf = dialog("決定を改める", '<div class="note red">この決定は、いま別の人が改めました。読み直してから、もう一度お試しください</div>' + rev,
                  '<span class="btn">閉じて読み直す</span>')
    d.append(state("dec-conflict", "同時にほかの人が改めていた・保存できない", "PS0 登録直後（PC なし）",
                   "「閉じて読み直す」で決定ログを読み直す。書いた字は小窓を閉じるまで残る", "createTicketDecision／updateTicketDecision の 409・503",
                   "2 人が同じ決定を同時に改めても、古い決定につながる新しい決定は 1 つだけ。負けた側には訳を出し、何も書かない",
                   [("小窓の中の知らせ", conf)], "㉒"))
    out.append(("C. 決める（決定ログ）", d))
    return out


def html():
    groups = build()
    toc = "".join(f'<li><a href="#{sid}">{title}</a></li>' for sid, title in STATES)
    body = "".join(f"<h2>{g}</h2>" + "".join(items) for g, items in groups)
    n = len(STATES)
    flow = (
        '<div class="flow" aria-label="導線">'
        '<div class="flow-row"><b>入口</b><span class="node">チケットの一覧</span><span class="arrow">→</span><span class="node">詳細 /tickets/[id]</span>'
        '<span class="sub">（知らせから直に開く・幅 1024 以上の一覧の右の詳細にはパネルが無いので「詳細を開く」から）</span></div>'
        '<div class="flow-row"><b>進める</b><span class="node new">段の札</span><span class="arrow">→</span><span class="node new">段のメニュー</span><span class="arrow">→</span>'
        '<span class="node new">作業中（その場で）</span><span class="arrow">／</span><span class="node new">保留にする小窓</span><span class="arrow">→</span><span class="node new">保留の帯</span>'
        '<span class="arrow">／</span><span class="node">完了の小窓（在る）</span>　<span class="node new">属性の実績 → 直す</span></div>'
        '<div class="flow-row"><b>話す</b><span class="node new">タブ「やり取り」</span><span class="arrow">→</span><span class="node new">読む</span><span class="arrow">→</span>'
        '<span class="node new">書く（@・知らせる人・状態 ▾）</span><span class="arrow">→</span><span class="node new">行の「…」：直す／消す</span>'
        '<span class="arrow">・</span><span class="node new">☆</span><span class="arrow">・</span><span class="node new">引用</span></div>'
        '<div class="flow-row"><b>決める</b><span class="node new">書き込みの「決定にする」</span><span class="arrow">→</span><span class="node new">決定にする小窓</span><span class="arrow">→</span>'
        '<span class="node new">本文の決定ログ</span><span class="arrow">→</span><span class="node new">＋ 足す／改める／取り消す</span>'
        '<span class="arrow">→</span><span class="node new">元の書き込みへ戻る</span></div></div>')
    return f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>段 7 下絵 自分で進める・話す・決める</title><style>{CSS}</style></head>
<body><main class="wrap">
<header>
<h1>段 7（F6 自分で進める・話す・決める）の下絵：{n} の状態</h1>
<p class="lead">導線と配置だけの下絵です（色・字・余白の細部は、この後に本番の部品で作るモック /dev/mock/f6 で詰めます）。新しい画面は足さず、チケットの詳細（/tickets/[id]）の中の 4 つの所 ── 頭の段の札・題名の下の帯・本文の決定ログ・右のパネルの「やり取り」── に入れます。どの形も「代表に聞くこと」の勧めで仮に描いてあり、答えで直します。</p>
<div class="legend">
<span><span class="ps">PS0</span> 製品の時点（何が在る時の画面か）。PS0＝登録直後・PC なし／PS2＝使っている（AI の実行が在る）</span>
<span><span class="sel inert">グレーの破線</span> キャンバスに在るが、この段ではまだ押せない物（隠さない）</span>
<span><span class="ask">代表に聞く ①</span> 「段7-代表に聞くこと.md」の番号</span>
<span><span class="node new">紺の枠</span> 段 7 で新しく生きる所</span>
</div>
</header>
<h2>導線（どこを通って何をするか）</h2>
{flow}
<h2>状態の一覧</h2>
<ul class="toc">{toc}</ul>
{body}
</main></body></html>
"""


if __name__ == "__main__":
    s = html()
    for path in OUT:
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
    print(len(STATES), "states", len(s), "bytes")

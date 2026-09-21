# -*- coding: utf-8 -*-
"""画面の中身でくり返し使う部品。ここに集約して、画面側では組み立てだけをする。"""
from _icons import ic

def card(body, cls="", style=""):
    return f'<div class="card {cls}" style="{style}">{body}</div>'

def head(title, right="", sub=""):
    s = f'<span class="muted" style="font-size:12px">{sub}</span>' if sub else ""
    return f'<div class="card-h"><h2>{title}</h2>{s}<div class="sp"></div>{right}</div>'

def table(cols, rows, wrap=True):
    th = "".join(f'<th class="{c[1]}">{c[0]}</th>' if isinstance(c, tuple) else f"<th>{c}</th>" for c in cols)
    tb = "".join("<tr>" + "".join(f'<td class="{c[1]}">{c[0]}</td>' if isinstance(c, tuple) else f"<td>{c}</td>"
                                  for c in r) + "</tr>" for r in rows)
    t = f'<table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table>'
    return f'<div class="t-wrap">{t}</div>' if wrap else t

def pill(text, kind="ne", icon=None):
    i = ic(icon) if icon else ""
    return f'<span class="pill p-{kind}">{i}{text}</span>'

def ai_pill(text="AI の提案"):
    return f'<span class="pill pill-ai">{ic("ai")}{text}</span>'

def metric(label, value, sub="", bar=None, barcls=""):
    b = f'<div class="bar"><i class="{barcls}" style="width:{bar}%"></i></div>' if bar is not None else ""
    s = f'<div class="metric-sub">{sub}</div>' if sub else ""
    return f'<div class="metric-lbl">{label}</div><div class="metric">{value}</div>{s}{b}'

def ai(title, body, buttons=""):
    b = f'<div style="display:flex;gap:9px;margin-top:13px;flex-wrap:wrap">{buttons}</div>' if buttons else ""
    return (f'<div class="ai"><div class="ai-h">{ic("ai")}{title}</div>'
            f'<div style="font-size:14px;line-height:1.85">{body}</div>{b}</div>')

def empty(icon, title, text, buttons=""):
    return (f'<div class="empty">{ic(icon)}<h3>{title}</h3><p>{text}</p>'
            f'<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">{buttons}</div></div>')

def kv(pairs):
    return '<dl class="kv">' + "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in pairs) + "</dl>"

def code(text):
    return f'<div class="code">{text}</div>'

def btn(label, kind="g", icon=None, href=None, style=""):
    i = ic(icon) if icon else ""
    if href: return f'<a class="btn btn-{kind} btn-sm" href="{href}" style="{style}">{i}{label}</a>'
    return f'<button class="btn btn-{kind} btn-sm" style="{style}">{i}{label}</button>'

def field(label, inner, help_=None, err=False):
    h = f'<div class="help {"err" if err else ""}">{ic("alert") if err else ""}<span>{help_}</span></div>' if help_ else ""
    return f'<div class="field"><label>{label}</label>{inner}{h}</div>'

def inp(value="", ph="", type_="text", cls="", style=""):
    el = f'<input class="inp {cls}" type="{type_}" value="{value}" placeholder="{ph}" style="{style}">'
    if type_ != "password":
        return el
    # パスワードは見る・隠すを切り替えられる（D-087）。打ち間違いを目で直せるようにする。
    # 既定は隠す。押すと text になり、アイコンと読み上げの名前が変わる
    return ('<div class="pw">'
            + el.replace('class="inp ', 'class="inp pw-inp ')
            + '<button type="button" class="pw-btn" aria-label="パスワードを表示" aria-pressed="false">'
            + '<span class="pw-on">' + ic("eye") + '</span>'
            + '<span class="pw-off">' + ic("eyeoff") + '</span>'
            + '</button></div>')

def dot(color): return f'<span class="dot" style="background:var(--{color});display:inline-block;width:4px;height:4px;border-radius:50%;margin-right:7px"></span>'

def rail(text): return f'<div class="rail" style="font-size:13.5px;line-height:1.85;color:var(--on-sv)">{text}</div>'

def grid(items, cls="g2"):
    return f'<div class="grid {cls}">' + "".join(items) + "</div>"

def note(text, kind="info"):
    bg = {"info":"var(--surface)","warn":"#FEF6EC","danger":"#FDF2F2","primary":"var(--primary-c)"}[kind]
    i = {"info":"info","warn":"warn","danger":"warn","primary":"lock"}[kind]
    return (f'<div style="display:flex;gap:12px;align-items:flex-start;padding:14px;background:{bg};'
            f'border-radius:var(--r-md);margin-bottom:16px">{ic(i)}'
            f'<div style="font-size:13px;line-height:1.8">{text}</div></div>')

AUTH_CSS = """
.auth{min-height:calc(100vh - 34px);display:grid;grid-template-columns:1fr 1fr}
.auth-l{background:var(--primary);color:#fff;padding:52px 44px;display:flex;flex-direction:column}
.auth-l .brand{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:700;margin-bottom:auto}
.auth-l .brand svg{width:24px;height:24px}
.auth-l h2{font-size:28px;font-weight:700;line-height:1.5;letter-spacing:-.01em;margin-bottom:16px}
.auth-l p{font-size:14px;line-height:1.9;opacity:.82;max-width:420px}
.auth-l .steps{margin-top:28px;display:flex;flex-direction:column;gap:9px;font-size:13px;opacity:.85}
.auth-l .steps div{display:flex;gap:9px;align-items:center}
.auth-r{display:grid;place-items:center;padding:44px 24px;background:var(--card)}
.auth-box{width:100%;max-width:376px}
.auth-box h1{font-size:24px;font-weight:700;margin-bottom:5px}
.auth-box .sub{font-size:13.5px;color:var(--on-sv);margin-bottom:26px;line-height:1.8}
.auth-box .pz{background:var(--surface);border-radius:var(--r-md);padding:11px 14px;font-size:12.5px;
  color:var(--on-sv);line-height:1.75;margin-bottom:22px;display:flex;gap:9px}
@media(max-width:767px){.auth{grid-template-columns:1fr}.auth-l{padding:30px 20px}
 .auth-l h2{font-size:22px}.auth-l .brand{margin-bottom:26px}.auth-l .steps{display:none}}
.wiz-steps{display:flex;gap:0;margin-bottom:30px}
.wiz-steps div{flex:1;text-align:center;font-size:12px;font-weight:600;color:var(--on-sv);
  padding-bottom:11px;border-bottom:3px solid var(--line)}
.wiz-steps div.on{color:var(--primary);border-bottom-color:var(--primary)}
.wiz-steps div.done{color:var(--st-success);border-bottom-color:var(--st-success)}
"""

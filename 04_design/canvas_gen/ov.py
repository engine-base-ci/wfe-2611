import os
import re
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
MUTED = "#4A5563"; NAVY = "#22345C"; LINE = "#DDE2E9"
def load(name): return open(P + name, encoding="utf-8").read()
def save(name, title, s):
    s = s.replace(re.search(r"<title>.*?</title>", s).group(0), "<title>%s</title>" % title, 1)
    open(P + name, "w", encoding="utf-8").write(s); print(name, len(s))
def chip(t, on=False):
    return '<button type="button" style="height: 28px; border: 1px solid %s; background: %s; color: %s; border-radius: 99px; padding: 0 12px; font-size: 12px">%s</button>' % ((NAVY, NAVY, "#FFFFFF") if on else (LINE, "#FFFFFF", MUTED)) + ("",) * 0 if False else '<button type="button" style="height: 28px; border: 1px solid %s; background: %s; color: %s; border-radius: 99px; padding: 0 12px; font-size: 12px">%s</button>' % (((NAVY, NAVY, "#FFFFFF") if on else (LINE, "#FFFFFF", MUTED)) + (t,))
def btn(t, kind="", href=None):
    st = {"": "border: 1px solid #DDE2E9; background: #FFFFFF; color: #131B27", "p": "border: 1px solid #22345C; background: #22345C; color: #FFFFFF", "d": "border: 1px solid #DDE2E9; background: #FFFFFF; color: #B91C1C"}[kind]
    base = "height: 30px; border-radius: 6px; padding: 0 12px; font-size: 12px; display: inline-flex; align-items: center; text-decoration: none; white-space: nowrap; " + st
    return ('<a href="%s" style="%s">%s</a>' % (href, base, t)) if href else '<button type="button" style="%s">%s</button>' % (base, t)
def pill(t, bg="#EEF0F4", fg=MUTED): return '<span style="font-size: 11px; background: %s; color: %s; border-radius: 99px; padding: 1px 8px; white-space: nowrap">%s</span>' % (bg, fg, t)
def icon(m, bg, size=30, fg="#FFFFFF"): return '<span style="width: %dpx; height: %dpx; flex: none; border-radius: 8px; background: %s; color: %s; display: grid; place-items: center; font-weight: 700; font-size: %dpx">%s</span>' % (size, size, bg, fg, max(10, size // 2.4), m)
def check(t, on=True, note=""):
    return '<label style="display: flex; gap: 8px; align-items: flex-start; padding: 4px 0"><span style="width: 16px; height: 16px; margin-top: 2px; flex: none; border-radius: 4px; border: 1px solid %s; background: %s; color: #FFFFFF; font-size: 11px; display: grid; place-items: center">%s</span><span>%s%s</span></label>' % (NAVY if on else "#B8C0CC", NAVY if on else "#FFFFFF", "✓" if on else "", t, '<span style="display: block; font-size: 11px; color: %s">%s</span>' % (MUTED, note) if note else "")
def lab(t, note=""): return '<div style="font-size: 12px; font-weight: 500; margin-bottom: 6px">%s%s</div>' % (t, ' <span style="font-weight: 400; color: %s">%s</span>' % (MUTED, note) if note else "")
def field(v, ph=False): return '<div style="min-height: 34px; border: 1px solid #DDE2E9; border-radius: 6px; padding: 0 10px; display: flex; align-items: center; color: %s">%s</div>' % (MUTED if ph else "#131B27", v)
SEP = '<div style="border-top: 1px solid #EDF0F4; margin: 6px 0"></div>'
POP = "position: absolute; z-index: 20; background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 10px; box-shadow: 0 10px 30px rgba(19,27,39,.18); padding: 10px; box-sizing: border-box; text-align: left; font-size: 13px; color: #131B27; white-space: normal; font-weight: 400"
def find_button(s, label):
    for m in re.finditer(r'<button type="button"[^>]*>(.*?)</button>', s, flags=re.S):
        if re.sub(r"<[^>]+>", "", m.group(1)).strip() == label: return m.group(0)
    raise KeyError(label)
def anchor_pop(s, label, html, w=300, align="right: 0", top=36):
    a = find_button(s, label)
    pressed = a.replace('style="', 'aria-expanded="true" style="box-shadow: 0 0 0 2px #DCE4F2; ', 1)
    return s.replace(a, '<span style="position: relative; display: inline-flex">%s<div role="dialog" style="%s; top: %dpx; %s; width: %dpx; max-width: calc(100vw - 32px)">%s</div></span>' % (pressed, POP, top, align, w, html), 1)
def float_pop(s, html, css):
    return s.replace("</x-dc>", '<div role="dialog" style="%s; position: fixed; %s">%s</div>\n</x-dc>' % (POP, css, html), 1)
def modal(s, html, w=600, tt=""):
    m = ('<div role="dialog" aria-label="%s" style="position: fixed; inset: 0; background: rgba(19,27,39,.45); display: grid; place-items: center; padding: 16px; z-index: 30"><div style="width: 100%%; max-width: %dpx; max-height: calc(100vh - 32px); overflow: auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); display: flex; flex-direction: column">%s</div></div>\n' % (tt, w, html))
    return s.replace("</x-dc>", m + "</x-dc>", 1)
def drawer(s, html, w=520, tt=""):
    m = ('<div role="dialog" aria-label="%s" style="position: fixed; inset: 0; background: rgba(19,27,39,.30); z-index: 30; display: flex; justify-content: flex-end"><div style="width: %dpx; max-width: 100%%; height: 100%%; background: #FFFFFF; box-shadow: -12px 0 40px rgba(0,0,0,.2); display: flex; flex-direction: column">%s</div></div>\n' % (tt, w, html))
    return s.replace("</x-dc>", m + "</x-dc>", 1)
def mhead(t, back, ic="", sub=""):
    return '<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #EDF0F4">%s<div style="min-width: 0"><b style="font-size: 15px">%s</b>%s</div><a href="%s" aria-label="閉じる" style="margin-left: auto; color: #4A5563; text-decoration: none; font-size: 18px">×</a></div>' % (ic, t, '<div style="font-size: 12px; color: %s">%s</div>' % (MUTED, sub) if sub else "", back)
def mbody(h): return '<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">%s</div>' % h
def mfoot(*b, left=""): return '<div style="display: flex; gap: 8px; align-items: center; padding: 12px 18px; border-top: 1px solid #EDF0F4; flex-wrap: wrap">%s<span style="margin-left: auto; display: flex; gap: 8px">%s</span></div>' % (left, "".join(b))
def toggle(on=True): return '<span style="width: 30px; height: 16px; flex: none; border-radius: 99px; background: %s; position: relative; display: inline-block"><span style="position: absolute; %s: 2px; top: 2px; width: 12px; height: 12px; border-radius: 99px; background: #FFFFFF"></span></span>' % ("#186F69" if on else "#B8C0CC", "right" if on else "left")
def wire_buttons(s, mp):
    for label, href in mp.items():
        try: a = find_button(s, label)
        except KeyError: continue
        m = re.match(r'<button type="button"( aria-[a-z]+="[^"]*")? style="([^"]*)">(.*)</button>', a, flags=re.S)
        if not m: continue
        s = s.replace(a, '<a href="%s"%s style="%s; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; box-sizing: border-box">%s</a>' % (href, m.group(1) or "", m.group(2), m.group(3)), 1)
    return s

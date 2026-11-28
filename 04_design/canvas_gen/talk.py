import os, re
os.environ["NOGEN"] = "1"
G = os.path.dirname(os.path.abspath(__file__)) + "/"
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
ROBOT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2M20 14h2M15 13v2M9 13v2"></path></svg>'
def tabs(active):
    def t(key, label, href):
        on = key == active
        return '<a href="%s"%s style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 2px solid %s; color: %s; text-decoration: none; %s white-space: nowrap">%s</a>' % (href, ' aria-current="page"' if on else "", "#22345C" if on else "transparent", "#22345C" if on else "#4A5563", "font-weight: 500;" if on else "", label)
    return ('<nav aria-label="パネルのタブ" style="display: flex; flex: none; border-bottom: 1px solid #DDE2E9; padding: 0 6px; background: #FFFFFF">'
            + t("attr", "属性", "TicketDetail.dc.html")
            + t("talk", 'やり取り<b style="font-size: 11px; background: #B45309; color: #FFFFFF; border-radius: 99px; padding: 0 6px; font-weight: 500">1</b>', "TdTalk.dc.html")
            + t("ai", ROBOT + "高本のAI", "StAiPanel.dc.html") + '</nav>')
PANEL = '<aside aria-label="チケットのパネル" style="width: 380px; flex: none; background: #FFFFFF; border-left: 1px solid #DDE2E9; display: flex; flex-direction: column; box-sizing: border-box">'
if __name__ == "__main__":
    s = open(G + "TicketDetail.base.orig.html", encoding="utf-8").read()
    # 1 remove bottom thread section
    a = s.index('    <section style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 8px">\n     <div style="display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #DDE2E9; gap: 8px; flex-wrap: wrap"><h2 style="font-size: 14px; margin: 0; padding: 0; border: 0">やり取りと記録')
    b = s.index("    </section>\n", a) + len("    </section>\n")
    s = s[:a] + s[b:]
    # 2 layout
    s = s.replace('<div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 24px 40px; align-items: flex-start">', '<div style="display: flex; flex: 1 0 auto; min-height: 0">', 1)
    s = s.replace('<div style="flex: 999 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 12px">', '<div style="flex: 1 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px 24px 40px">', 1)
    # 3 aside -> panel with tabs, flatten cards
    old = '<aside aria-label="属性" style="flex: 1 1 280px; max-width: 320px; display: flex; flex-direction: column; gap: 12px">'
    assert old in s
    s = s.replace(old, PANEL + "\n    " + tabs("attr") + '\n    <div class="kn-pbody" style="padding: 4px 16px 16px; display: flex; flex-direction: column">', 1)
    e = s.index("   </aside>", s.index(PANEL))
    s = s[:e] + "    </div>\n" + s[e:]
    seg0 = s.index(PANEL); seg1 = s.index("</aside>", seg0)
    seg = s[seg0:seg1].replace('<section style="background: #FFFFFF; border: 1px solid #DDE2E9; border-radius: 8px; padding: 12px 14px">', '<section style="padding: 12px 0; border-bottom: 1px solid #EDF0F4">')
    s = s[:seg0] + seg + s[seg1:]
    s = s.replace('"$preview":{"width":1440,"height":2050}', '"$preview":{"width":1440,"height":2050}')
    open(G + "TicketDetail.base.html", "w", encoding="utf-8").write(s)
    print("base ok")

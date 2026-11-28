import os
import re, sys
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
src = open(P + "RoomKnows.dc.html", encoding="utf-8").read()
head = src[:src.index('  <div style="display: flex; min-height: 0">')]
# aside block (subnav)
a0 = src.index('   <aside aria-label="知っていることの種類"'); a1 = src.index('   </aside>', a0) + len('   </aside>\n')
subnav = src[a0:a1]
tail = ' </main>\n</div>\n</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":1440,"height":1000}}\'>\nclass Component extends DCLogic {\n  renderVals() { return {}; }\n}\n</script>\n</body>\n</html>\n'
CUR_TAB = 'aria-current="page" style="padding: 8px 12px; border-bottom: 2px solid #22345C; color: #22345C; font-weight: 500; text-decoration: none"'
OFF_TAB = 'style="padding: 8px 12px; border-bottom: 2px solid transparent; color: #4A5563; text-decoration: none"'
def shell(title, tab):
    h = head.replace("<title>知っていること 必ず守ること</title>", "<title>%s</title>" % title)
    h = h.replace('href="RoomKnows.dc.html" ' + CUR_TAB, 'href="RoomKnows.dc.html" ' + OFF_TAB)
    h = h.replace('href="%s" %s' % (tab, OFF_TAB), 'href="%s" %s' % (tab, CUR_TAB))
    return h
CUR_SUB = 'aria-current="page" style="display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 8px; background: #F1F3F6; text-decoration: none; color: #131B27"'
OFF_SUB = 'style="display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 8px; text-decoration: none; color: #131B27"'
def sub(cur):
    s = subnav.replace('href="RoomKnows.dc.html" ' + CUR_SUB, 'href="RoomKnows.dc.html" ' + OFF_SUB)
    return s.replace('href="%s" %s' % (cur, OFF_SUB), 'href="%s" %s' % (cur, CUR_SUB))
def page(name, title, tab, body, subcur=None):
    import os
    if os.environ.get('NOGEN'): return
    out = shell(title, tab) + '  <div style="display: flex; min-height: 0">\n'
    if subcur: out += sub(subcur)
    out += body + '\n  </div>\n' + tail
    assert out.count('aria-current="page"') >= 2, name
    open(P + name, "w", encoding="utf-8").write(out)
    print(name, len(out))

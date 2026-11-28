import re, glob, os
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
SV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">%s</svg>'
IC = {"people": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5"></path>',
      "tree": '<rect x="3" y="3" width="7" height="6" rx="1.5"></rect><rect x="14" y="15" width="7" height="6" rx="1.5"></rect><path d="M6.5 9v5a2 2 0 0 0 2 2H14"></path>',
      "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>',
      "gear": '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>',
      "clock": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'}
MARK = lambda m, bg, fg="#FFFFFF": '<span style="width: 20px; height: 20px; flex: none; border-radius: 6px; background: %s; color: %s; display: grid; place-items: center; font-size: 11px; font-weight: 700">%s</span>' % (bg, fg, m)
def build(label, sections, cur, note=""):
    out = '<aside aria-label="%s" class="kn-sub">' % label
    for head, items in sections:
        if head: out += '<div class="kn-sub-h">%s</div>' % head
        for href, ic, name, count, badge in items:
            on = href == cur
            cnt = ('<b class="kn-sub-badge">%s</b>' % count) if badge else ('<span class="kn-sub-n">%s</span>' % count if count != "" else "")
            out += '<a href="%s"%s class="kn-sub-i"><span class="kn-sub-ic">%s</span><span class="kn-sub-t">%s</span>%s</a>' % (href, ' aria-current="page"' if on else "", ic, name, cnt)
    if note: out += '<div class="kn-sub-note">%s</div>' % note
    return out + '</aside>'
def ws_sub(cur):
    return build("ワークスペースの中", [("人", [("WsPeople.dc.html", SV % IC["people"], "メンバー", "5", False), ("WsPeople.dc.html", SV % IC["tree"], "層とグループ", "3", False)]),
        ("決まり", [("WsRules.dc.html", SV % IC["list"], "マスタ", "", False), ("WsSettings.dc.html", SV % IC["gear"], "ワークスペースの設定", "", False)]),
        ("記録", [("WsLog.dc.html", SV % IC["clock"], "証跡", "", False)])], cur, "直せるのは管理者と、権限を付けた人")
def room_sub(cur):
    return build("知っていることの種類", [("知っていること", [("RoomKnows.dc.html", MARK("守", "#186F69"), "必ず守ること", "9", False), ("RoomWays.dc.html", MARK("型", "#22345C"), "やり方", "8", False), ("RoomMemory.dc.html", MARK("憶", "#6D4AA6"), "覚えていること", "23", False)]),
        ("確かめること", [("RoomWants.dc.html", MARK("？", "#FCEBD5", "#7A4A05"), "覚えたいこと", "4", True)])], cur)
CSS = """
/* kn-sub: secondary left panel, white floating card for the current item */
.kn-sub{width:232px;flex:none;background:#EDF0F4;border-right:1px solid #DDE2E9;padding:10px 10px 14px;display:flex;flex-direction:column;gap:2px;box-sizing:border-box}
.kn-sub-h{font-size:11px;color:#6B7585;padding:12px 10px 4px;letter-spacing:.02em}
.kn-sub-h:first-child{padding-top:4px}
.kn-sub-i{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:8px;color:#3A4453;text-decoration:none;transition:background .12s}
.kn-sub-i:hover{background:rgba(255,255,255,.55);color:#131B27}
.kn-sub-i[aria-current="page"]{background:#FFFFFF;color:#131B27;font-weight:600;box-shadow:0 1px 2px rgba(19,27,39,.08),0 0 0 1px rgba(19,27,39,.06)}
.kn-sub-ic{display:grid;place-items:center;width:20px;color:#6B7585}
.kn-sub-i[aria-current="page"] .kn-sub-ic{color:#22345C}
.kn-sub-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kn-sub-n{font-size:12px;color:#6B7585;font-weight:400}
.kn-sub-badge{font-size:11px;background:#B45309;color:#FFFFFF;border-radius:99px;padding:0 7px;font-weight:500}
.kn-sub-note{margin-top:auto;font-size:11px;color:#6B7585;padding:10px}
@media (max-width:1023px){.kn-sub{width:64px;padding:10px 8px}.kn-sub-h,.kn-sub-t,.kn-sub-n,.kn-sub-note{display:none}.kn-sub-i{justify-content:center;padding:0}.kn-sub-badge{position:absolute;margin:-18px 0 0 18px;font-size:9px;padding:0 4px}}
@media (max-width:767px){.kn-sub{width:auto;flex:none;flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid #DDE2E9;padding:6px 8px}.kn-sub-t{display:inline}.kn-sub-i{padding:0 10px;flex:none}}
"""
def apply():
    for f in glob.glob(P + "*.dc.html"):
        s = open(f, encoding="utf-8").read(); o = s; name = os.path.basename(f)
        m = re.search(r'<aside aria-label="知っていることの種類".*?</aside>', s, flags=re.S)
        if m:
            cur = re.search(r'href="([^"]+)" aria-current="page"', m.group(0)) or re.search(r'<a href="([^"]+)"[^>]*aria-current', m.group(0))
            s = s[:m.start()] + room_sub(cur.group(1) if cur else "") + s[m.end():]
        m = re.search(r'<aside aria-label="ワークスペースの中".*?</aside>', s, flags=re.S)
        if m:
            cur = re.search(r'<a href="([^"]+)"[^>]*aria-current', m.group(0))
            s = s[:m.start()] + ws_sub(cur.group(1) if cur else "") + s[m.end():]
        if s != o: open(f, "w", encoding="utf-8").write(s); print("sub", name)
if __name__ == "__main__": apply()

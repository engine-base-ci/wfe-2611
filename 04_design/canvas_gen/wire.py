import re
MAP = {"複製": "TdDuplicate.dc.html", "…": "TdMore.dc.html", "自分の AI と話す": "StAiPanel.dc.html",
 "承認して送る": "StModal.dc.html", "差し戻す": "StModal.dc.html", "自分で直す": "StEdit.dc.html", "版と差分": "TdVersions.dc.html",
 "抜けを点検する": "TdCheck.dc.html", "項目を足す": "TdCheck.dc.html", "大きく見る": "TdPreview.dc.html", "データを見る": "TdPreview.dc.html",
 "試し打ち（自分宛）": "TdPreview.dc.html", "全文": "TdPreview.dc.html", "子を足す": "TdLink.dc.html", "つながりを足す": "TdLink.dc.html",
 "決定にする": "TdDecision.dc.html", "ナレッジ：請求のルール（版 4）": "KnPage.dc.html", "取引先の 1 社を開く": "CuRequests.dc.html", "実行の記録をすべて見る": "TdRunLog.dc.html", "EG-097": "TicketDetail.dc.html", "EG-097 保守契約の見積": "TicketDetail.dc.html"}
def txt(h): return re.sub(r"<[^>]+>", "", h).strip()
def wire(s):
    head, sep, body = s.partition("<main")
    def b(m):
        t = txt(m.group(3))
        if t in MAP: return '<a href="%s"%s style="%s; display: inline-flex; align-items: center; justify-content: center; gap: 4px; text-decoration: none; box-sizing: border-box">%s</a>' % (MAP[t], m.group(1) or "", m.group(2), m.group(3))
        return m.group(0)
    body = re.sub(r'<button type="button"( aria-label="[^"]*")? style="([^"]*)">(.*?)</button>', b, body, flags=re.S)
    body = re.sub(r'<a href="#"([^>]*)>(.*?)</a>', lambda m: ('<a href="%s"%s>%s</a>' % (MAP[txt(m.group(2))], m.group(1), m.group(2))) if txt(m.group(2)) in MAP else m.group(0), body, flags=re.S)
    return head + sep + body

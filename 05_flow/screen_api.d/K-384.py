# K-384 最後にやり取りを開いた時刻を書く口（markTicketTimelineSeen・新しい口）
#   体 { seen_at?: 日時 }（無ければ今）。答え { ticket_id, seen_at }（201）。自分の 1 行だけを書く（⑬）
SCREEN_API = {
    "tickets": [("POST", "/tickets/:id/timeline/seen", "A107", "ticket_messages", "markTicketTimelineSeen", [])],
}
PERMS = {
    "markTicketTimelineSeen": ("read", "そのチケットを見られる人（自分の『最後にやり取りを開いた時刻』だけを書く・⑬）", False),
}
INPUTS = {
    "markTicketTimelineSeen": ("TicketTimelineSeenInput", {"seen_at": "string?"}),
}
RESPONSES = {
    "markTicketTimelineSeen": ("TicketTimelineSeen", {"ticket_id": "string", "seen_at": "string"}),
}
UNEXPRESSIBLE_422 = {
    "markTicketTimelineSeen": ["seen_at が日時として読めない（空・字・暦に無い日）"],
}

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
# 書く所（自分の 1 行）で DB が落ちたら 500（何も変わらない）。守りの判定で落ちたら 503（入口の共通の 503 と同じ行）
ERRORS_4XX = {
    "markTicketTimelineSeen": [
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "自分の『最後にやり取りを開いた時刻』を書く所で DB が落ちた（1 つの処理なので何も変わらない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、時刻を前のまま残す"},
    ],
}

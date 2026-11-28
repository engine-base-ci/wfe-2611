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
# seen_at は ISO の日時（暦に無い日・時差の範囲外も断る）。形の決まりなので契約の VALUE_RANGES に書く（11-20 16:51 の決め・UNEXPRESSIBLE_422 には載せない）
VALUE_RANGES = {"markTicketTimelineSeen": {"seen_at": {"pattern": "^(?:[1-9]\\d{3}-(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|[1-9]\\d{3}-(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|[1-9]\\d{3}-02-(?:0[1-9]|1\\d|2[0-8])|(?:[1-9]\\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,6})?(?:Z|[+-](?:0\\d|1[0-5])(?::?[0-5]\\d)?)$"}}}
UNEXPRESSIBLE_422: dict = {}
# 書く所（自分の 1 行）で DB が落ちたら 503（何も変わらない・11-22 18:30 の決め：DB の失敗は止める側＝503 E-PAGE-003）。守りの判定で落ちたときも同じ 503
ERRORS_4XX = {
    "markTicketTimelineSeen": [
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "自分の『最後にやり取りを開いた時刻』を書く所で DB が落ちた（1 つの処理なので何も変わらない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 を返し、時刻を前のまま残す（止める側に倒す）"},
    ],
}

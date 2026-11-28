# K-881 チケットを見せる相手（ゲストのグループ）を読む口と付け外す口（listTicketGuestShares・updateTicketGuestShares）
#   読むのはチケットを読める人（選べるグループの一覧 choices は書ける人にだけ返す）。付け外しは担当者とマネージャー（チケットに書ける人）
#   付け外しの体は add と remove（どちらか 1 つは要る・1〜20 個の uuid）。選んだグループが無ければ 404・E-GST-040、見せる相手が 20 を超えれば 409・E-GST-041
SCREEN_API = {
    "tickets": [
        ("GET", "/tickets/:id/guest-shares", "A123", "ticket_guest_shares", "listTicketGuestShares", ["guest_groups"]),
        ("PATCH", "/tickets/:id/guest-shares", "A123", "ticket_guest_shares", "updateTicketGuestShares", ["guest_groups", "audit_events"]),
    ],
}

PERMS = {
    "listTicketGuestShares": ("read", "チケットを読める人（選べるグループの一覧は書ける人にだけ返す）", False),
    "updateTicketGuestShares": ("write", "チケットを書ける人（担当者・マネージャー・チケットの edit を持つ人＝app.ticket_writable・updateTicket と同じ）。見せる相手はゲストのグループだけ（1 人ずつ・項目ごとは選べない・D-155.36）", False),
}

INPUTS = {
    "updateTicketGuestShares": ("TicketGuestSharesInput", {"add": "uuid[]?", "remove": "uuid[]?"}),
}

VALUE_RANGES = {"updateTicketGuestShares": {"add": {"minItems": 1, "maxItems": 20}, "remove": {"minItems": 1, "maxItems": 20}}}

INPUT_RULES = {"updateTicketGuestShares": {"anyOf": [{"required": ["add"]}, {"required": ["remove"]}]}}

RESPONSES = {
    "listTicketGuestShares": ("TicketGuestShares", {"shared": "array", "choices": "array", "can_change": "boolean"}),
    "updateTicketGuestShares": ("TicketGuestSharesUpdated", {"shared": "array"}),
}

ERRORS_4XX = {
    "listTicketGuestShares": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "チケットが無い・消した・別の会社・自分に見えない（入口の行の確かめ・在るかを漏らさない）",
         "ears_form": "UNWANTED: IF チケットが見えないなら、Kaname は 404 を返し、見せる相手も選び肢も返さない"},
    ],
    "updateTicketGuestShares": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "チケットに書けない人（読むだけの人・ゲスト）",
         "ears_form": "UNWANTED: IF チケットに書けないなら、Kaname は 403 を返し、見せる相手も証跡も変えない"},
        {"status": 404, "code": "E-GST-040", "body": {"error": "not_found", "code": "E-GST-040"}, "errors": ["E-GST-040"],
         "trigger": "見せる相手に選んだゲストのグループが、この会社に無い・消した・別の会社の物（欄と details なし）",
         "ears_form": "UNWANTED: IF 選んだゲストのグループが見つからないなら、Kaname は 404 と E-GST-040 を返し、見せる相手も証跡も変えない"},
        {"status": 409, "code": "E-GST-041", "body": {"error": "conflict", "code": "E-GST-041"}, "errors": ["E-GST-041"],
         "trigger": "見せる相手が 20 を超える（外す分を引いた結果・欄と details なし）",
         "ears_form": "UNWANTED: IF 見せる相手が 20 を超えるなら、Kaname は 409 と E-GST-041 を返し、見せる相手も証跡も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "add と remove の両方が無い・空・21 個以上・uuid でない／知らない欄",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"},
    ],
}

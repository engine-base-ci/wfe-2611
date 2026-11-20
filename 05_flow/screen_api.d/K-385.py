# K-385 やり取りに書き込む口（createTicketMessage）
#   入力は 4 つだけ（本文・@ する人・知らせる人・引用元）。書いた人はセッションから・種類は post に決まる。ほかの欄は strict で 422
#   答えの 1 件の形 TimelineItem は K-383 と同じ名前・同じ欄（RESPONSES）。書いた 1 件をそのまま一覧の下に足せる（読み直さない）
INPUTS = {
    "createTicketMessage": ("TicketMessageInput", {"body": "string", "mention_member_ids": "uuid[]", "notify_member_ids": "uuid[]", "quote_of_id": "uuid?"}),
}

REQUIRED_INPUTS = {"createTicketMessage": ["body"]}

# 本文は空白だけでない（全角の空白・改行も）。入口の形の確かめでは言い表せないので、口が E-VAL-027 で断る
VALUE_RANGES = {"createTicketMessage": {"body": {"pattern": "\\S"}}}

UNEXPRESSIBLE_422 = {
    "createTicketMessage": [
        "本文が全角の空白・改行だけ（E-VAL-027）",
        "@ する人・知らせる人・引用元が、そのチケットを見られない人・抜けた人・止められた人・別のチケットの書き込み（E-VAL-014）",
    ],
}

RESPONSES = {
    "createTicketMessage": ("TimelineItem", {"id": "string", "kind": "string", "at": "string", "actor": "object?", "message": "object?", "changes": "array?", "run": "object?", "deleted": "object?"}),
}

ERRORS_4XX = {
    "createTicketMessage": [
        {"status": 422, "code": "E-VAL-027", "body": {"error": "validation", "code": "E-VAL-027"}, "errors": ["E-VAL-027"],
         "trigger": "本文が無い・空・空白だけ（全角の空白・改行も）",
         "ears_form": "UNWANTED: IF 本文が無い・空・空白だけなら、Kaname は 422 と E-VAL-027 を返し、書き込みも受け箱の行も作らない"},
        {"status": 422, "code": "E-VAL-014", "body": {"error": "validation", "code": "E-VAL-014"}, "errors": ["E-VAL-014"],
         "trigger": "@ する人・知らせる人・引用元が選べない（見られない・抜けた・止められた・別のチケットの書き込み・消した書き込み）",
         "ears_form": "UNWANTED: IF @ する人・知らせる人・引用元が選べないなら、Kaname は 422 と E-VAL-014 と欄の名前を返し、何も書かない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "チケットが無い・見えない・消した",
         "ears_form": "UNWANTED: IF チケットが無い・見えない・消したなら、Kaname は 404 と NOT_FOUND を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（見えるか）で例外・関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も書かない（止める側に倒す）"},
    ],
}

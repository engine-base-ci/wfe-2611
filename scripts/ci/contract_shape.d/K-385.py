# K-385 やり取りに書き込む口（createTicketMessage）の契約の形の登録（screen_api.d/K-385.py と同じ字）
REQUIRED_INPUTS = {"createTicketMessage": {"body"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"createTicketMessage": {"body": {"pattern": "\\S"}}}
UNEXPRESSIBLE_422 = {
    "createTicketMessage": [
        "本文が全角の空白・改行だけ（E-VAL-027）",
        "@ する人・知らせる人・引用元が、そのチケットを見られない人・抜けた人・止められた人・別のチケットの書き込み（E-VAL-014）",
    ],
}
AGENT_ANSWERS = {}

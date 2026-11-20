# K-385 やり取りに書き込む口（createTicketMessage）の契約の形の登録（screen_api.d/K-385.py と同じ字）
REQUIRED_INPUTS = {"createTicketMessage": {"body"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 05_flow/screen_api.d/K-385.py と同じ値域（K-389：保留の理由と再開の条件は空白と制御文字だけでない字）
_NOT_BLANK = "[^\\s\\u0000-\\u001f\\u007f]"
VALUE_RANGES = {"createTicketMessage": {"body": {"pattern": "\\S"}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                                        "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK}}}
UNEXPRESSIBLE_422 = {
    "createTicketMessage": [
        "本文が全角の空白・改行だけ（E-VAL-027）",
        "@ する人・知らせる人・引用元が、そのチケットを見られない人・抜けた人・止められた人・別のチケットの書き込み（E-VAL-014）",
        "stage_id と stage_key の両方",
        "stage_key hold で保留の理由か再開の条件が無い（E-VAL-041・E-VAL-047）",
        "段の欄が無いか stage_key todo・doing なのに保留の理由か再開の条件を付けた",
    ],
}
AGENT_ANSWERS = {}

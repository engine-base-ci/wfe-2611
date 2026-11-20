# K-390 決定を足す口（createTicketDecision）。読む口は体を受けない GET なので足す行は無い
#   text は必須・空白だけは入口の pattern で断る。制御文字だけ・決めた人・元の書き込み・取引先のルールは口の振る舞いのまま 422（契約に書けない）
REQUIRED_INPUTS = {"createTicketDecision": ["text"]}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"createTicketDecision": {"text": {"pattern": "\\S"}, "promoted_to": {"enum": ["ticket", "client_rule"]}}}
UNEXPRESSIBLE_422 = {
    "createTicketDecision": [
        "決めたことが制御文字だけ（E-VAL-042）",
        "決めた人が同じ会社の今のメンバーでない（E-VAL-043）",
        "元の書き込みがこのチケットの消していない書き込みでない（E-VAL-044）",
        "取引先のルールにする（E-VAL-018・段 12 まで）",
    ]
}
AGENT_ANSWERS = {}

# K-391 決定を改める・取り消す口（updateTicketDecision）
#   action は必須で revise・cancel・promote のどれか。text・reason の空・空白・制御文字だけ（E-VAL-042・E-VAL-045）と、action ごとに要る欄は、
#   K-355 の形全体の決まり（INPUT_RULES）が本線に入ったら INPUT_RULES（oneOf）に移して空にする（K-387 と同じ。それまでは口の振る舞いのまま 422）
REQUIRED_INPUTS = {"updateTicketDecision": ["action"]}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateTicketDecision": {"action": {"enum": ["revise", "cancel", "promote"]}}}
UNEXPRESSIBLE_422 = {
    "updateTicketDecision": [
        "改めるとき新しい決定が無い・空・空白だけ・制御文字だけ（E-VAL-042）",
        "取り消すとき理由が無い・空・空白だけ・制御文字だけ（E-VAL-045）",
        "取引先のルールにする（E-VAL-018・段 12 まで）",
    ]
}
AGENT_ANSWERS = {}

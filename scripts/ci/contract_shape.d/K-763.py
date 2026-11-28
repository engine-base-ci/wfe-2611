# K-763 チケットの中で言う口（sendTicketAgentMessage）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-763.py と同じ（2 か所）。
#   読む口（getTicketAgentSession）は体を受けない口なので、どの表にも載せない
REQUIRED_INPUTS = {
    "sendTicketAgentMessage": {"text"},   # 契約の形の表は集合（K144-SHAPE-020 が set と比べる・screen_api.d は並び）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "sendTicketAgentMessage": {"text": {"pattern": "\\S"}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

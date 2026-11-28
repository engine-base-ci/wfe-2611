# K-758 言う口（sendConversationMessage）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-758.py と同じ（2 か所）。
#   止める口（stopConversation）は空の体 {} だけを受け、必須の欄が無いので NO_REQUIRED_INPUTS に理由を書く（K144-SHAPE-020：体を受ける作った口はどちらかの表に載る）
REQUIRED_INPUTS = {
    "sendConversationMessage": {"text"},   # 契約の形の表は集合（K144-SHAPE-020 が set と比べる・screen_api.d は並び）
}
NO_REQUIRED_INPUTS = {
    "stopConversation": "止める口は空の体 {} だけを受ける（欄が 1 つも無い・知らない欄は 422）。無いことで 422 にする欄は無い",
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "sendConversationMessage": {"text": {"pattern": "\\S"}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

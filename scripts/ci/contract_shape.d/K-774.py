# K-774 作る画面の会話に言う口（sendDraftMessage）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-774.py と同じ（2 か所）。
#   始める口（startDraftConversation）は空の体 {} を受け、必須の欄が無いので NO_REQUIRED_INPUTS に理由を書く（K144-SHAPE-020：体を受ける作った口はどちらかの表に載る）
REQUIRED_INPUTS = {
    "sendDraftMessage": {"text", "draft"},   # 契約の形の表は集合（K144-SHAPE-020 が set と比べる・screen_api.d は並び）
}
NO_REQUIRED_INPUTS = {
    "startDraftConversation": "始める口は空の体 {} を受け、体の中身を読まない（欄が 1 つも無い）。無いことで 422 にする欄は無い",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

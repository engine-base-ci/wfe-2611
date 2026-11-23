# K-774 作る画面の会話に言う口（sendDraftMessage）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-774.py と同じ（2 か所）。
#   始める口（startDraftConversation）は体の中身を見ない口なので、どの表にも載せない
REQUIRED_INPUTS = {
    "sendDraftMessage": ["text", "draft"],
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

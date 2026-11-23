# K-758 言う口（sendConversationMessage）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-758.py と同じ（2 か所）。
#   止める口（stopConversation）は体の中身を見ない口なので、どの表にも載せない
REQUIRED_INPUTS = {
    "sendConversationMessage": ["text"],
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "sendConversationMessage": {"text": {"pattern": "\\S"}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

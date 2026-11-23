# K-760 写しの口（mirrorConversationEntries）の契約の形の表に足す分（K-325 の断片）。値は 05_flow/screen_api.d/K-760.py と同じ（2 か所）
REQUIRED_INPUTS = {
    "mirrorConversationEntries": {"entries"},   # 表は集合（本体 contract_shape_test.py の REQUIRED_INPUTS と同じ型。並びだと契約の required と等しくならない）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "mirrorConversationEntries": {"entries": {"minItems": 1, "maxItems": 500}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

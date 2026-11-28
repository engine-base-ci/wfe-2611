# K-908 依頼のやり取りに書く口（postPortalRequestMessage）の契約の形の表に足す分（K-325 の断片）
#   必須の欄・値域は 05_flow/screen_api.d/K-908.py に書いた契約と同じ（口は apps/api/src/features/F11/portal/request-message.ts の checkMessage）。
#   ここの 6 つの表は空（チケットの決め：契約の本体と断片が受ける）
REQUIRED_INPUTS = {
    "postPortalRequestMessage": {"body"},   # screen_api.d/K-908.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "postPortalRequestMessage": {'body': {'minLength': 1, 'maxLength': 10000}},   # screen_api.d/K-908.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

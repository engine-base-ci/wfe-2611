# K-895 依頼を断る口の契約の形の表に足す分（体の形は screen_api.d/K-895.py の INPUTS と VALUE_RANGES が持つ）
REQUIRED_INPUTS = {
    "declineClientRequest": {'reason'},   # decline.ts（理由が無い・空なら 422・欄 reason）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "declineClientRequest": {'reason': {'minLength': 1, 'maxLength': 2000}},   # screen_api.d/K-895.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

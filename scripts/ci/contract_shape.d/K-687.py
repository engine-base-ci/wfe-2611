# K-687 上の棚に上げる（頼む・取り下げる・帯を消す）の契約の形の表に足す分（K-325 の断片）
#   値域は 05_flow/screen_api.d/K-687.py と同じ。自分の棚のページの group_id が要るは 409 E-KNW-101（契約に書けない 422 を足さない）
REQUIRED_INPUTS: dict = {}
NO_REQUIRED_INPUTS = {
    "requestKnowledgeRaise": "group_id・folder_id・message はどれも無くてよい（自分の棚のページで group_id が無いは 409 E-KNW-101・K-687）",
    "dismissKnowledgeRequest": "体は空の形（K-687）。{} で 200",
}
PATH_PATTERNS: dict = {}
VALUE_RANGES = {
    "requestKnowledgeRaise": {"message": {"maxLength": 1000}},
}
UNEXPRESSIBLE_422: dict = {}
AGENT_ANSWERS: dict = {}

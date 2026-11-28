# K-688 承認待ちを読む・承認する・断るの契約の形の表に足す分（K-325 の断片）
#   値域は 05_flow/screen_api.d/K-688.py と同じ。契約に書けない 422 を足さない
REQUIRED_INPUTS = {
    "declineKnowledgeRequest": {"reason"},
}
NO_REQUIRED_INPUTS = {
    "approveKnowledgeRequest": "体は空の形（K-688）。{} で 200",
}
PATH_PATTERNS: dict = {}
VALUE_RANGES = {
    "declineKnowledgeRequest": {"reason": {"pattern": "\\S", "maxLength": 1000}},
}
UNEXPRESSIBLE_422: dict = {}
AGENT_ANSWERS: dict = {}

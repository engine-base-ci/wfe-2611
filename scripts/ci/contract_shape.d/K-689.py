# K-689 グループを選んで共有（読む・頼む・やめる）の契約の形の表に足す分（K-325 の断片）
#   値域は 05_flow/screen_api.d/K-689.py と同じ。ページかフォルダのどちらか 1 つは INPUT_RULES の oneOf（契約に書ける形）
REQUIRED_INPUTS = {
    "setKnowledgeShares": {"group_ids"},
}
NO_REQUIRED_INPUTS: dict = {}
PATH_PATTERNS: dict = {}
VALUE_RANGES = {
    "setKnowledgeShares": {"message": {"maxLength": 1000}, "group_ids": {"maxItems": 50}},
}
UNEXPRESSIBLE_422: dict = {}
AGENT_ANSWERS: dict = {}

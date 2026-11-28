# K-1004 の口の契約の形の表に足す分（統合の枝・05_flow/screen_api.d/K-1004.py の必須と値の範囲を写す・直しの担当 XC）
REQUIRED_INPUTS = {
    "addIncidentUpdate": {"body", "state"},   # screen_api.d/K-1004.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "sendWorkspaceNotice": {"body", "placements", "title"},   # screen_api.d/K-1004.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {
    "publishOpsNotice": '体は空（欄を持たない）。出すかどうかは行の状態で決まる',
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "addIncidentUpdate": {"state": {"enum": ["investigating", "identified", "monitoring", "resolved"]}, "body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}},   # screen_api.d/K-1004.py の VALUE_RANGES と同じ（統合の枝で写した）
    "sendWorkspaceNotice": {"title": {"minLength": 1, "maxLength": 100, "pattern": "\\S"}, "body": {"minLength": 1, "maxLength": 4000, "pattern": "\\S"}, "placements": {"items": {"type": "string", "enum": ["band", "list"]}, "minItems": 1, "maxItems": 2, "uniqueItems": True}},   # screen_api.d/K-1004.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

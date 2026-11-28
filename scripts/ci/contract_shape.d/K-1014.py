# K-1014 運営がお知らせを作る・直す口（createOpsNotice・updateOpsNotice）
#   必須・値の形は K-1004 の契約の断片、欄をまたぐ決まりは 05_flow/screen_api.d/K-1014.py の INPUT_RULES に書いた。
#   6 つの表に足す行は無い（登録先の決まりがチケットごとの住所を求めるので、空の表を置く）
REQUIRED_INPUTS = {
    "createOpsNotice": {"audience_mode", "body", "kind", "placements", "title"},   # screen_api.d/K-1014.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {
    "updateOpsNotice": '欄はどれも任意で、届け先の組み合わせは入力の形の oneOf（INPUT_RULES）が断る',
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "createOpsNotice": {'kind': {'enum': ['incident', 'maintenance', 'release']}, 'title': {'minLength': 1, 'maxLength': 100, 'pattern': '\\S'}, 'body': {'minLength': 1, 'maxLength': 4000, 'pattern': '\\S'}, 'audience_mode': {'enum': ['all', 'plans', 'workspaces']}, 'audience_plans': {'items': {'type': 'string', 'enum': ['free', 'team', 'business']}, 'uniqueItems': True}, 'audience_workspace_ids': {'items': {'type': 'string', 'format': 'uuid'}, 'uniqueItems': True}, 'placements': {'items': {'type': 'string', 'enum': ['band', 'list']}, 'minItems': 1, 'maxItems': 2, 'uniqueItems': True}, 'publish_at': {'format': 'date-time'}, 'maintenance_from': {'format': 'date-time'}, 'maintenance_to': {'format': 'date-time'}, 'impact': {'minLength': 1, 'maxLength': 200}},   # screen_api.d/K-1014.py の VALUE_RANGES と同じ（統合の枝で写した）
    "updateOpsNotice": {'kind': {'enum': ['incident', 'maintenance', 'release']}, 'title': {'minLength': 1, 'maxLength': 100, 'pattern': '\\S'}, 'body': {'minLength': 1, 'maxLength': 4000, 'pattern': '\\S'}, 'audience_mode': {'enum': ['all', 'plans', 'workspaces']}, 'audience_plans': {'items': {'type': 'string', 'enum': ['free', 'team', 'business']}, 'uniqueItems': True}, 'audience_workspace_ids': {'items': {'type': 'string', 'format': 'uuid'}, 'uniqueItems': True}, 'placements': {'items': {'type': 'string', 'enum': ['band', 'list']}, 'minItems': 1, 'maxItems': 2, 'uniqueItems': True}, 'publish_at': {'format': 'date-time'}, 'maintenance_from': {'format': 'date-time'}, 'maintenance_to': {'format': 'date-time'}, 'impact': {'minLength': 1, 'maxLength': 200}},   # screen_api.d/K-1014.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

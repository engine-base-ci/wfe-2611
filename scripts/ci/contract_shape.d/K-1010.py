# K-1010 運営がひな形の新しい版を出す口・操作を読む口の契約の形の表に足す分（K-325 の断片）。
#   値の決まりは全部 VALUE_RANGES に書いた（部と合わない中身・数の上限は 409 E-OPS-024 で 422 でない）ので、足す行は無い（空の表）
REQUIRED_INPUTS = {
    "releaseOpsTemplate": {"change_reason", "items"},   # screen_api.d/K-1010.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "releaseOpsTemplate": {'items': {'minItems': 0, 'maxItems': 100, 'items': {'type': 'object', 'required': ['key', 'name'], 'additionalProperties': False, 'properties': {'key': {'type': 'string', 'pattern': '^[a-z][a-z0-9_]{0,39}$'}, 'name': {'type': 'string', 'minLength': 1, 'maxLength': 40}, 'color_key': {'type': 'string', 'enum': ['indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light']}, 'body_template': {'type': 'object', 'nullable': True}, 'field_type': {'type': 'string', 'enum': ['short_text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'check']}, 'required': {'type': 'boolean'}, 'description': {'type': 'string', 'maxLength': 200}, 'options': {'type': 'array'}, 'kind_keys': {'type': 'array', 'items': {'type': 'string'}}}}}, 'change_reason': {'minLength': 1, 'maxLength': 500, 'pattern': '\\S'}},   # screen_api.d/K-1010.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

# K-909 ゲストが依頼に付ける添付を足す口（uploadPortalAttachment）の契約の形の表に足す分（K-325 の断片）
#   必須の欄・値域・書けない決まりは、05_flow/screen_api.d/K-909.py に書いた契約と同じ（口は apps/api/src/features/F11/portal/attachment.ts の input）
REQUIRED_INPUTS = {
    "uploadPortalAttachment": {"name", "content_type", "data"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "uploadPortalAttachment": {
        "name": {"minLength": 1, "maxLength": 200},
        "content_type": {"maxLength": 100, "pattern": "^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$"},
        "data": {"maxLength": 1000000},
    },
}
UNEXPRESSIBLE_422 = {
    "uploadPortalAttachment": ["名前に / \\ や制御文字を含む", "中身が base64 でない"],
}
AGENT_ANSWERS = {}

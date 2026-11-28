# K-907 依頼を出す口（createPortalRequest）・グループの依頼を読む口（getPortalRequest）の契約の形の表に足す分（K-325 の断片）
#   出す口の必須の欄・値域・書けない決まりは、05_flow/screen_api.d/K-907.py に書いた契約と同じ（口は apps/api/src/features/F11/portal/request-create.ts の checkInput）。
#   読む口は体を受けない GET（道の :id の uuid の形は入口の共通の確かめ・K144-API-1207）
REQUIRED_INPUTS = {
    "createPortalRequest": {"body"},   # request-create.ts の checkInput（無い・空・空白だけは 422 欄 body）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "createPortalRequest": {   # request-create.ts の checkInput
        "body": {"pattern": "\\S", "minLength": 1, "maxLength": 10000},
        "due_on": {"pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
        "attachment_ids": {"maxItems": 5},
    },
}
UNEXPRESSIBLE_422 = {
    "createPortalRequest": ["いつまでにが今日より前（日本時間）", "暦に無い日付のいつまでに"],
}
AGENT_ANSWERS = {}

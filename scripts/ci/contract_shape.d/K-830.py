# K-830 消す手続きを始める口（requestWorkspaceDeletion）の契約の形の表に足す分（K-325 の断片）。取り消す口は体を受けない
# apps/api/src/features/F10/workspace/deletion.ts（confirm_name は必須・1〜100 字。名前が合わないのは DB の中身で決まるので 409・E-WS-030）
REQUIRED_INPUTS = {
    "requestWorkspaceDeletion": {"confirm_name"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "requestWorkspaceDeletion": {
        "confirm_name": {"minLength": 1, "maxLength": 100},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 名前の打ち間違いは 422 でなく 409・E-WS-030（契約に書けない 422 は使わない）
AGENT_ANSWERS = {}

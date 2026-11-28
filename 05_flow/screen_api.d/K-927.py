# K-927 ゲストのグループの名前を直す口と消す口（updateGuestGroup・deleteGuestGroup）
#   どちらもメンバーを直す権限を持つ人（判定は DB の関数・足りなければ 403）。グループが無ければ 404・E-GST-001、直す名前が重なれば 409・E-GST-002（番号は K-876 の物）
#   消すと中のゲストは入れなくなり、見せる相手から外れる（チケットと依頼は残る）
SCREEN_API = {
    "members": [
        ("PATCH", "/guest-groups/:id", "A36", "members", "updateGuestGroup", ["guest_groups", "audit_events"]),
        ("DELETE", "/guest-groups/:id", "A36", "members", "deleteGuestGroup", ["guest_groups", "guest_group_members", "members", "tenant_memberships", "sessions", "invitations", "ticket_guest_shares", "audit_events"]),
    ],
}

PERMS = {
    "updateGuestGroup": ("self", "メンバーを直す権限を持つ人（管理者・権限を付けた人）。ゲスト・マネージャー・普通のメンバーは 403。判定は DB の関数が行う", False),
    "deleteGuestGroup": ("self", "同上。消すと中のゲストは入れなくなる", False),
}

INPUTS = {
    "updateGuestGroup": ("GuestGroupRenameInput", {"name": "string"}),
}

REQUIRED_INPUTS = {"updateGuestGroup": ["name"]}

VALUE_RANGES = {"updateGuestGroup": {"name": {"minLength": 1, "maxLength": 80}}}

RESPONSES = {
    "updateGuestGroup": ("GuestGroupRenamed", {"id": "uuid", "name": "string"}),
    "deleteGuestGroup": ("GuestGroupDeleted", {"id": "uuid"}),
}

_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
              "trigger": "メンバーを直す権限が無い人（ゲスト・マネージャー・普通のメンバー）",
              "ears_form": "UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 を返し、グループも証跡も変えない"}
_GONE = {"status": 404, "code": "E-GST-001", "body": {"error": "not_found", "code": "E-GST-001"}, "errors": ["E-GST-001"],
         "trigger": "グループが、この会社に無い・消した・別の会社の物（在るかを漏らさない・欄と details なし）",
         "ears_form": "UNWANTED: IF ゲストのグループが見つからないなら、Kaname は 404 と E-GST-001 を返し、何も変えない"}
ERRORS_4XX = {
    "updateGuestGroup": [
        dict(_FORBIDDEN), dict(_GONE),
        {"status": 409, "code": "E-GST-002", "body": {"error": "conflict", "code": "E-GST-002"}, "errors": ["E-GST-002"],
         "trigger": "直した名前と同じ名前のゲストのグループが今ある（全角半角・大文字小文字・空白の違いだけでも同じ・欄と details なし）",
         "ears_form": "UNWANTED: IF 直した名前と同じ名前のグループが今あるなら、Kaname は 409 と E-GST-002 を返し、名前も証跡も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "名前が無い・前後の空白を取ると空・80 字を超える／知らない欄",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"},
    ],
    "deleteGuestGroup": [dict(_FORBIDDEN), dict(_GONE)],
}

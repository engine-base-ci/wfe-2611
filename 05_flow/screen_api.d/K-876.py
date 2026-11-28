# K-876 ゲストのグループの一覧と作る口（listGuestGroups・createGuestGroup）
#   一覧は社内の人で、メンバーを見る権限か招く権限を持つ人。作るのはメンバーを招く権限か直す権限を持つ人。権限の確かめは DB の関数（足りなければ 403）
#   作る体は名前と届け先の社内のグループだけ（strict・名前は前後の空白を取って 1〜80 字）。届け先が無ければ 404・E-GST-003、同じ名前（表記ゆらぎも）は 409・E-GST-002
SCREEN_API = {
    "members": [
        ("GET", "/guest-groups", "A36", "members", "listGuestGroups", ["guest_groups", "guest_group_members", "invitations"]),
        ("POST", "/guest-groups", "A36", "members", "createGuestGroup", ["guest_groups", "audit_events"]),
    ],
}

PERMS = {
    "listGuestGroups": ("self", "社内の人で、メンバーを見る権限か招く権限を持つ人（管理者・権限を付けた人。ゲストは読めない）。権限の確かめは DB の関数が行い、足りなければ 403", False),
    "createGuestGroup": ("self", "社内の人で、メンバーを招く権限か直す権限を持つ人（管理者・権限を付けた人。ゲストは作れない）。足りなければ 403", False),
}

INPUTS = {
    "createGuestGroup": ("GuestGroupInput", {"name": "string", "request_scope_id": "uuid"}),
}

REQUIRED_INPUTS = {"createGuestGroup": ["name", "request_scope_id"]}

VALUE_RANGES = {"createGuestGroup": {"name": {"minLength": 1, "maxLength": 80}}}

RESPONSES = {
    "listGuestGroups": ("GuestGroups", {"groups": "array"}),
    "createGuestGroup": ("GuestGroupCreated", {"group": "object"}),
}

ERRORS_4XX = {
    "listGuestGroups": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを見る権限も招く権限も無い人・ゲスト",
         "ears_form": "UNWANTED: IF メンバーを見る権限も招く権限も無いなら、Kaname は 403 を返し、グループを 1 つも返さない"},
    ],
    "createGuestGroup": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを招く権限も直す権限も無い人・ゲスト",
         "ears_form": "UNWANTED: IF メンバーを招く権限も直す権限も無いなら、Kaname は 403 を返し、グループも証跡も作らない"},
        {"status": 404, "code": "E-GST-003", "body": {"error": "not_found", "code": "E-GST-003"}, "errors": ["E-GST-003"],
         "trigger": "届け先の社内のグループが、この会社に無い・消した・別の会社の物（在るかを漏らさない・欄と details なし）",
         "ears_form": "UNWANTED: IF 届け先の社内のグループが見つからないなら、Kaname は 404 と E-GST-003 を返し、グループも証跡も作らない"},
        {"status": 409, "code": "E-GST-002", "body": {"error": "conflict", "code": "E-GST-002"}, "errors": ["E-GST-002"],
         "trigger": "同じ名前のゲストのグループが今ある（全角半角・大文字小文字・空白の違いだけでも同じ・欄と details なし）",
         "ears_form": "UNWANTED: IF 同じ名前のゲストのグループが今あるなら、Kaname は 409 と E-GST-002 を返し、グループも証跡も作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "名前が無い・前後の空白を取ると空・80 字を超える／届け先が uuid でない・無い／知らない欄",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も作らない"},
    ],
}

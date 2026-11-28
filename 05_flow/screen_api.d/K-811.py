# K-811 役割を変える口（updateMemberRole・PATCH /api/v1/members/:id/role）
# 形は K-800 の「契約」の節で決めた形（MemberRoleInput・MemberRoleChanged）。strict（知らない欄・role_id・tenant_id は 422）。
#   role_key が admin なら会社全体の管理者（scope_id は見ない）。ほかは scope_id のグループ（無ければ主の所属）での役割（兼務はグループごとに別・D-154.15）。
#   本人確認の取り直し（stepUp always）と権限は screen_api.py の今のまま。自分の役割・最後の管理者は変えられない（D-154.19）
INPUTS = {
    "updateMemberRole": ("MemberRoleInput", {"role_key": "string", "scope_id": "uuid"}),
}

# 答えの鍵はちょうど 3 つ。groups は getMember の groups と同じ形 [{ id, name, code, primary, role }]（K-810 の app.member_groups_json）
RESPONSES = {
    "updateMemberRole": ("MemberRoleChanged", {"member_id": "uuid", "company_role": "string", "groups": "array"}),
}

# apps/api/src/features/F10/admin/members/role.ts（役割は無ければ 422）
REQUIRED_INPUTS = {
    "updateMemberRole": ["role_key"],
}

# 役割は決まった 4 つ（owner・requester は選べない）
VALUE_RANGES = {
    "updateMemberRole": {
        "role_key": {"enum": ["manager", "member", "viewer", "admin"]},
    },
}

# 役割を変える：本人確認（403）・権限（403）・入力の形（422）・相手が無い／グループが無い（404）・自分／最後の管理者／居ないグループ（409）・DB が落ちた（503）
ERRORS_4XX = {
    "updateMemberRole": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 本人確認の取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、役割を変えない"},
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "役割を変える権限（members の edit・会社全体）が無い（マネージャー・メンバー・閲覧のみ・止めた人）",
         "ears_form": "UNWANTED: IF 役割を変える権限が無いなら、Kaname は 403 と FORBIDDEN を返し、役割を変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "役割が無い・決まった 4 つの外・scope_id が uuid でない・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、役割を変えない"},
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "相手が無い・別の会社・外した・消した・AI（E-MEM-002）",
         "ears_form": "UNWANTED: IF 相手がこの会社に居ない（無い・外した・消した・AI）なら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-006", "body": {"error": "not_found", "code": "E-MEM-006"}, "errors": ["E-MEM-006"],
         "trigger": "scope_id のグループが無い・別の会社・消した（E-MEM-006）",
         "ears_form": "UNWANTED: IF 選んだグループがこの会社に無い・消したなら、Kaname は 404 と E-MEM-006 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-003", "body": {"error": "conflict", "code": "E-MEM-003"}, "errors": ["E-MEM-003"],
         "trigger": "自分の役割を自分で変える（E-MEM-003）",
         "ears_form": "UNWANTED: IF 自分の役割を自分で変えようとしたなら、Kaname は 409 と E-MEM-003 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-004", "body": {"error": "conflict", "code": "E-MEM-004"}, "errors": ["E-MEM-004"],
         "trigger": "最後の管理者を下げる（止めた管理者は数えない・E-MEM-004）",
         "ears_form": "UNWANTED: IF 最後の管理者を下げようとしたなら、Kaname は 409 と E-MEM-004 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-007", "body": {"error": "conflict", "code": "E-MEM-007"}, "errors": ["E-MEM-007"],
         "trigger": "相手がそのグループに入っていない（主の所属でも兼ねる所属でもない・E-MEM-007）",
         "ears_form": "UNWANTED: IF 相手がそのグループに入っていないなら、Kaname は 409 と E-MEM-007 を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "会社の役割・所属の行・証跡を書く DB が落ちた",
         "ears_form": "UNWANTED: IF 役割を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、役割も所属も証跡も残さない"},
    ],
}

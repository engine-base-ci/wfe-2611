# K-812 グループを移す・兼ねる口（updateMemberGroups・PATCH /members/:id/groups）。形は K-800 の「契約」の節で決めた形（MemberGroupsInput・MemberGroupsChanged）
# 移す（primary_scope_id）・兼ねる（add_scope_ids）・外す（remove_scope_ids）。role_key は新しく足す所属の役割（manager・member・viewer・既定 member）。
#   どれか 1 つは要る（体が空は 422）。strict（scope_id・tenant_id などの知らない欄は 422）。本人確認の取り直しが要る（契約の stepUp always）
INPUTS = {
    "updateMemberGroups": ("MemberGroupsInput", {"primary_scope_id": "uuid", "add_scope_ids": "uuid[]", "remove_scope_ids": "uuid[]", "role_key": "string"}),
}

# 答え：K-811 の MemberRoleChanged と同じ 3 つの鍵。groups は [{ id, name, code, primary, role }]（主が先・K-810 の getMember の groups と同じ形）
RESPONSES = {
    "updateMemberGroups": ("MemberGroupsChanged", {"member_id": "uuid", "company_role": "string", "groups": "array"}),
}

# apps/api/src/features/F10/admin/members/groups.ts → app.member_groups_change（役割は 3 つ・並びはどれも 20 まで）
VALUE_RANGES = {
    "updateMemberGroups": {
        "role_key": {"enum": ["manager", "member", "viewer"]},
        "add_scope_ids": {"maxItems": 20},
        "remove_scope_ids": {"maxItems": 20},
    },
}

# 変える物が 1 つは要る（体が空は 422）
INPUT_RULES = {
    "updateMemberGroups": {"anyOf": [{"required": [x]} for x in ("primary_scope_id", "add_scope_ids", "remove_scope_ids")]},
}

# 権限（403）・本人確認（403）・相手かグループが無い（404）・自分・居ないグループ・主を外す（409）・入力の形（422）・Kaname の側（503）。
#   404・409 は欄・details を付けない。断ったときは何も書かない（全部か無しか）
ERRORS_4XX = {
    "updateMemberGroups": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを直す権限（members の edit・会社全体）が無い（マネージャー・メンバー・閲覧のみ・止めた人）",
         "ears_form": "UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "道の id の人が無い・別の会社・外した・消した・AI",
         "ears_form": "UNWANTED: IF 相手が無い・別の会社・外した・消した・AI なら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-006", "body": {"error": "not_found", "code": "E-MEM-006"}, "errors": ["E-MEM-006"],
         "trigger": "体のグループの id のどれかが無い・別の会社・消した",
         "ears_form": "UNWANTED: IF 体のグループのどれかが無い・別の会社・消してあるなら、Kaname は 404 と E-MEM-006 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-003", "body": {"error": "conflict", "code": "E-MEM-003"}, "errors": ["E-MEM-003"],
         "trigger": "自分のグループを自分で変えようとした（D-154.19）",
         "ears_form": "UNWANTED: IF 自分のグループを変えようとしたなら、Kaname は 409 と E-MEM-003 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-007", "body": {"error": "conflict", "code": "E-MEM-007"}, "errors": ["E-MEM-007"],
         "trigger": "居ないグループを外そうとした",
         "ears_form": "UNWANTED: IF 相手が入っていないグループを外そうとしたなら、Kaname は 409 と E-MEM-007 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-008", "body": {"error": "conflict", "code": "E-MEM-008"}, "errors": ["E-MEM-008"],
         "trigger": "主のグループを移さずに外そうとした",
         "ears_form": "UNWANTED: IF 主のグループを移さずに外そうとしたなら、Kaname は 409 と E-MEM-008 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "体が空・役割が 3 つの外・グループの並びが 21 以上・uuid でない・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "所属の行・主の所属・証跡を書く取引が DB で落ちた",
         "ears_form": "UNWANTED: IF 所属を変える取引が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、所属も主も証跡も前のままにする"},
    ],
}

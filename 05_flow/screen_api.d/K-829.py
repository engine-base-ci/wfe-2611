# K-829 誰ができるかを変える（updateWorkspacePermissions・PATCH /workspace/permissions・D-154.83）
# 変えられるのは 2 つだけ（プランと支払い billing・ワークスペースを消す delete_workspace。書き出しは作らない・D-154.4）。値は admin（管理者）か admin_manager（管理者とマネージャー）。
#   strict（ほかの欄・export は 422）・1 つ以上（どちらも無い空の体は 422）・null は 422（送らない欄は変えない）。管理者だけ・本人確認を取り直す（権限の行は screen_api.py の今のまま）
INPUTS = {
    "updateWorkspacePermissions": ("WorkspacePermissionsInput", {"billing": "string", "delete_workspace": "string"}),
}

# 答え：変えた後の今の 2 つの値（key・value の並び。billing → delete_workspace の順）
RESPONSES = {
    "updateWorkspacePermissions": ("WorkspacePermissions", {"permissions": "array"}),
}

# apps/api/src/features/F10/workspace/permissions.ts（値は 2 つだけ）
VALUE_RANGES = {
    "updateWorkspacePermissions": {
        "billing": {"enum": ["admin", "admin_manager"]},
        "delete_workspace": {"enum": ["admin", "admin_manager"]},
    },
}

# 1 つ以上（契約の minProperties 1 の代わり。どちらの欄も無い空の体は 422）
INPUT_RULES = {
    "updateWorkspacePermissions": {"anyOf": [{"required": ["billing"]}, {"required": ["delete_workspace"]}]},
}

# 誰ができるかを変える：権限（403）・本人確認（403）・入力の形（422）・DB が落ちた（503）
ERRORS_4XX = {
    "updateWorkspacePermissions": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "管理者でない（マネージャー・権限を個別に付けた人・兼務のマネージャー・メンバー・閲覧のみ）",
         "ears_form": "UNWANTED: IF 管理者でない人が誰ができるかを変えようとしたなら、Kaname は 403 を返し、値も記録も変えない"},
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、値も記録も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "空の体・決まった値（admin・admin_manager）の外・null・文字でない値・知らない欄（export など・strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、値も記録も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "値と記録を書く DB が落ちた",
         "ears_form": "UNWANTED: IF 値と記録を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、値も記録も残さない"},
    ],
}

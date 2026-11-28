# K-837 知らせの設定の口（getNotificationSettings・updateNotificationSettings・copyNotificationSettings）
# 知らせの受け方はワークスペースごと（D-154.24・保存だけ作る。読んで受け箱・メールを出すのは F7・K-67）。
#   どのワークスペースかは workspace_id（GET は問い合わせ・PATCH は体・無ければ今の会社）。同じログインが入っていない会社は同じ 404。
#   止められない出来事（new_device）を切る体は 409・E-ME-040（同じ体のほかの変更も入れない）。写し先に写し元を含めれば 409・E-ME-041。
#   入口の zod は INPUT_RULES・VALUE_RANGES を見ないので、同じ決まりを口の前処理（apps/api/src/features/F10/me/notify.ts）が確かめて 422 を返す
_EVENTS = ["approval_waiting", "mentioned", "handed_over", "clone_stopped", "clone_finished", "ticket_changed", "new_device"]
_PRESETS = ["weekdays_night_weekend", "every_night", "weekend_only", "off"]
_URGENT = ["approval_due_today", "clone_stopped"]

INPUTS = {
    "updateNotificationSettings": ("NotificationSettingsUpdateInput", {"workspace_id": "uuid?", "email_digest": "boolean?", "quiet_hours": "object?", "pause": "string?", "urgent_override": "string[]?", "events": "array?"}),
    "copyNotificationSettings": ("NotificationSettingsCopyInput", {"from_workspace_id": "uuid", "to_workspace_ids": "uuid[]"}),
}

RESPONSES = {
    "getNotificationSettings": ("NotificationSettings", {"workspace_id": "uuid", "email_digest": "boolean", "quiet_hours": "object", "paused_until": "string?", "urgent_override": "array", "events": "array"}),
    "updateNotificationSettings": ("NotificationSettings", {"workspace_id": "uuid", "email_digest": "boolean", "quiet_hours": "object", "paused_until": "string?", "urgent_override": "array", "events": "array"}),
    "copyNotificationSettings": ("NotificationSettingsCopied", {"copied_to": "array"}),
}

REQUIRED_INPUTS = {
    "copyNotificationSettings": ["from_workspace_id", "to_workspace_ids"],
}

# 空の体・workspace_id だけの体は 422（変える項目を 1 つは送る）
INPUT_RULES = {
    "updateNotificationSettings": {"anyOf": [{"required": [x]} for x in ("email_digest", "quiet_hours", "pause", "urgent_override", "events")]},
}

VALUE_RANGES = {
    "updateNotificationSettings": {
        "events": {"maxItems": 7, "items": {"type": "object", "additionalProperties": False, "required": ["key"],
                                            "properties": {"key": {"enum": _EVENTS}, "bell": {"type": "boolean"}, "mail": {"type": "boolean"}},
                                            "anyOf": [{"required": ["bell"]}, {"required": ["mail"]}]}},
        "urgent_override": {"items": {"enum": _URGENT}},
        "quiet_hours": {"type": "object", "additionalProperties": False, "required": ["preset"], "properties": {"preset": {"enum": _PRESETS}}},
        "pause": {"enum": ["1h", "today", "tomorrow_morning", None]},
    },
    "copyNotificationSettings": {
        "to_workspace_ids": {"minItems": 1, "maxItems": 20},
    },
}

UNEXPRESSIBLE_422: dict = {}   # 422 は全部契約に書いた（控え帳「422 は契約に書ける形の誤りだけ」）

ERRORS_4XX = {
    "getNotificationSettings": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "workspace_id の会社に同じログインが入っていない（抜けた・別の人の会社・無い会社）",
         "ears_form": "UNWANTED: IF 指したワークスペースに自分が入っていないなら、Kaname は 404 を返し、在るかを漏らさず設定を返さない"},
    ],
    "updateNotificationSettings": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "workspace_id の会社に同じログインが入っていない（抜けた・別の人の会社・無い会社）",
         "ears_form": "UNWANTED: IF 指したワークスペースに自分が入っていないなら、Kaname は 404 を返し、何も保存しない"},
        {"status": 409, "code": "E-ME-040", "body": {"error": "conflict", "code": "E-ME-040"}, "errors": ["E-ME-040"],
         "trigger": "止められない出来事（新しい端末で入った new_device）のベルかメールを切る行を送った",
         "ears_form": "UNWANTED: IF 新しい端末で入った知らせを切ろうとしたなら、Kaname は 409 と E-ME-040 を返し、同じ体のほかの変更も保存しない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "変える項目が無い・知らない出来事・8 つ以上の出来事・ベルもメールも無い行・真偽でない値・知らない急ぎ・静かにする時間が 4 つ以外・pause が 1h／today／tomorrow_morning／null 以外・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄の理由を返し、何も保存しない"},
    ],
    "copyNotificationSettings": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "写し元か写し先のどれかに同じログインが入っていない（抜けた・別の人の会社・無い会社）",
         "ears_form": "UNWANTED: IF 写し元か写し先に自分が入っていない会社があるなら、Kaname は 404 を返し、1 つも写さない"},
        {"status": 409, "code": "E-ME-041", "body": {"error": "conflict", "code": "E-ME-041"}, "errors": ["E-ME-041"],
         "trigger": "写し先に写し元を含めた",
         "ears_form": "UNWANTED: IF 写し先に写し元を含めたなら、Kaname は 409 と E-ME-041 を返し、1 つも写さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "写し元・写し先が無い・写し先が 0 か 21 以上・uuid でない値・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 写し元・写し先の形が決まりに合わないなら、Kaname は 422 と欄の理由を返し、1 つも写さない"},
    ],
}

# K-837 知らせの設定の口（updateNotificationSettings・copyNotificationSettings）の契約の形の表に足す分（K-325 の断片）。getNotificationSettings は体を受けない GET
_EVENTS = ["approval_waiting", "mentioned", "handed_over", "clone_stopped", "clone_finished", "ticket_changed", "new_device"]
_PRESETS = ["weekdays_night_weekend", "every_night", "weekend_only", "off"]
_URGENT = ["approval_due_today", "clone_stopped"]

# apps/api/src/features/F10/me/notify.ts の inputCopy（無ければ 422）
REQUIRED_INPUTS = {
    "copyNotificationSettings": {"from_workspace_id", "to_workspace_ids"},
}
NO_REQUIRED_INPUTS = {
    "updateNotificationSettings": "どの項目も無くてよい（送った項目だけを直す・apps/api/src/features/F10/me/notify.ts）。変える項目が 1 つも無い体は 422（INPUT_RULES の anyOf）。知らない欄は 422（契約の strict）",
}

# apps/api/src/features/F10/me/notify.ts の inputUpdate・inputCopy（05_flow/screen_api.d/K-837.py と同じ）
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

UNEXPRESSIBLE_422: dict = {}

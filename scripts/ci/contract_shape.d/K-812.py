# K-812 グループを移す・兼ねる口（updateMemberGroups）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/admin/members/groups.ts（必須の欄は無い。どれか 1 つは要る＝契約の INPUT_RULES の anyOf・体が空は 422）
NO_REQUIRED_INPUTS = {
    "updateMemberGroups": "必須の欄は無い（移す・兼ねる・外すのどれか 1 つ。体が空は入口が 422・契約の INPUT_RULES の anyOf・K-812）",
}
# 役割は 3 つ・並びはどれも 20 まで
VALUE_RANGES = {
    "updateMemberGroups": {
        "role_key": {"enum": ["manager", "member", "viewer"]},
        "add_scope_ids": {"maxItems": 20},
        "remove_scope_ids": {"maxItems": 20},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 形の決まりは全部 VALUE_RANGES と INPUT_RULES に書いた。DB の中身で決まる断りは 404・409（K-800 の決め）

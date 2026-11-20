# K-419 招く口（createInvitations）の契約の形の表に足す分（K-325 の断片）。getWorkspaceMembers は体を受けない GET なので足す行は無い
# apps/api/src/features/F10/invite/create.ts（emails・scope_id・role_key は無ければ 422。message は無くてよい）
REQUIRED_INPUTS = {
    "createInvitations": {"emails", "scope_id", "role_key"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 役割は決まった 4 つ・ひとこと 500 文字まで（宛ての数の上限 50 は口が E-INV-012 で断るので契約には書かない）
VALUE_RANGES = {
    "createInvitations": {
        "emails": {"minItems": 1},
        "role_key": {"enum": ["member", "manager", "viewer", "admin"]},
        "message": {"maxLength": 500},
    },
}
UNEXPRESSIBLE_422 = {
    "createInvitations": [
        "宛てがメールの形でない（そろえた後の字で見る・E-INV-009）",
        "一度に 50 人を超える宛て（E-INV-012）",
    ],
}
AGENT_ANSWERS = {}

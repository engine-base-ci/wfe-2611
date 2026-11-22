# K-419 招く口（createInvitations）の契約の形の表に足す分（K-325 の断片）。getWorkspaceMembers は体を受けない GET なので足す行は無い
# apps/api/src/features/F10/invite/create.ts（emails・scope_id・role_key は無ければ 422。message は無くてよい）
import invite_patterns as _IP  # 宛ての pattern（scripts/ci/invite_patterns.py・口は apps/api/src/features/F10/invite/patterns.ts と同じ字・K419-API-024 が照らす）
REQUIRED_INPUTS = {
    "createInvitations": {"emails", "scope_id", "role_key"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 役割は決まった 4 つ・ひとこと 500 文字まで（宛ての数の上限 50 は口が E-INV-012 で断るので契約には書かない）
VALUE_RANGES = {
    "createInvitations": {
        "emails": {"minItems": 1, "maxItems": 50, "items": {"type": "string", "maxLength": _IP.EMAIL_MAX_LENGTH, "pattern": _IP.EMAIL}},
        "role_key": {"enum": ["member", "manager", "viewer", "admin"]},
        "message": {"maxLength": 500},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 宛ての形（E-INV-009）と人数（E-INV-012）は VALUE_RANGES の pattern・maxItems で契約に書いた（K-419・PM の決め 2026-11-21 02:25）
AGENT_ANSWERS = {}

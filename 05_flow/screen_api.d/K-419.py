# K-419 招く口（createInvitations）と、メンバーの並びを読む口（getWorkspaceMembers）
# 招く（K-419・D-148.1・D-148.23・D-148.29）：メール（何人でも・1〜50）・グループ・役割・ひとこと（500 文字まで）。strict（ほかの欄は 422）。
#   役割は member・manager・viewer・admin と、ゲストの requester（K-876・D-155.35・D-155.47）。admin のときだけ本人確認を取り直す。全部か無しか（1 人でも形の違う宛て・入っている人がいれば誰も招かない）
#   requester はゲストのグループ（guest_group_id）をちょうど 1 つ選び、依頼の届け先（scope_id）を持たない。ほかの役は scope_id が要り guest_group_id を持てない（K-876・D-155.40）
import invite_patterns as _IP  # 宛ての pattern（scripts/ci/invite_patterns.py・口は apps/api/src/features/F10/invite/patterns.ts と同じ字・K419-API-024 が照らす）
INPUTS = {
    "createInvitations": ("InvitationsCreateInput", {"emails": "string[]", "scope_id": "uuid?", "role_key": "string", "message": "string?", "guest_group_id": "uuid?"}),
}

# 招いた答え：招待ごとに id・宛て（そろえた後の小文字）・期限・メールを送れたか（sent／failed）。トークンは答えに出さない（メールのリンクにだけある）
RESPONSES = {
    "createInvitations": ("InvitationsSent", {"invitations": "array"}),
}

# apps/api/src/features/F10/invite/create.ts の入力（宛て・役割は無ければ 422。グループの指定は役割で分ける：INPUT_RULES・K-876）
REQUIRED_INPUTS = {
    "createInvitations": ["emails", "role_key"],
}

# apps/api/src/features/F10/invite/create.ts（宛ての数・形・入っている人は口が 422 にする。役割は 4 つだけ・ひとこと 500 文字まで）
VALUE_RANGES = {
    "createInvitations": {
        "emails": {"minItems": 1, "maxItems": 50, "items": {"type": "string", "maxLength": _IP.EMAIL_MAX_LENGTH, "pattern": _IP.EMAIL}},
        "role_key": {"enum": ["member", "manager", "viewer", "admin", "requester"]},
        "message": {"maxLength": 500},
    },
}

# 役割で分ける（K-876）：requester はゲストのグループが要り依頼の届け先を持てない／ほかの役は社内のグループが要りゲストのグループを持てない
INPUT_RULES = {"createInvitations": {"oneOf": [
    {"properties": {"role_key": {"enum": ["requester"]}}, "required": ["guest_group_id"], "not": {"required": ["scope_id"]}},
    {"properties": {"role_key": {"enum": ["member", "manager", "viewer", "admin"]}}, "required": ["scope_id"], "not": {"required": ["guest_group_id"]}},
]}}

UNEXPRESSIBLE_422: dict = {}   # 宛ての形（E-INV-009）と人数（E-INV-012）は VALUE_RANGES の pattern・maxItems で契約に書いた（K-419・PM の決め 2026-11-21 02:25）

# 招く：権限（403）・本人確認（403）・入力の形（422）・グループが無い（404）・もう入っている人（409）。並び：権限（403）
ERRORS_4XX = {
    "getWorkspaceMembers": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを見る権限（members の view・会社全体）が無い",
         "ears_form": "UNWANTED: IF メンバーを見る権限が無いなら、Kaname は 403 を返し、並びを返さない"},
    ],
    "createInvitations": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "管理者として招くのに、本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 管理者として招くのに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、招待もメールも作らない"},
        {"status": 404, "code": "E-INV-011", "body": {"error": "not_found", "code": "E-INV-011"}, "errors": ["E-INV-011", "E-GST-001"],
         "trigger": "選んだグループがこの会社に無い・消した（E-INV-011）／ゲストとして招くときに選んだゲストのグループがこの会社に無い・消した・別の会社の物（E-GST-001・K-876）",
         "ears_form": "UNWANTED: IF 選んだグループがこの会社に無い、または消してあるなら、Kaname は 404 と E-INV-011 を返し、どの宛ても招かずメールも送らない"},
        {"status": 409, "code": "E-INV-010", "body": {"error": "conflict", "code": "E-INV-010"}, "errors": ["E-INV-010"],
         "trigger": "宛てがもうこのワークスペースに入っている人（E-INV-010。止めている人も）",
         "ears_form": "UNWANTED: IF 宛てにもうこのワークスペースに入っている人がいるなら、Kaname は 409 と E-INV-010 と入っている宛ての一覧（detail）を返し、どの宛ても招かずメールも送らない"},
        {"status": 422, "code": "E-INV-009", "body": {"error": "validation", "code": "E-INV-009", "details": []}, "errors": ["E-INV-009", "E-INV-012"],
         "trigger": "メールの形でない宛て（E-INV-009）・51 人以上（E-INV-012）・役割が決まった値の外・ひとこと 501 文字・宛てが空・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と宛てごとの理由を返し、どの宛ても招かずメールも送らない"},
    ],
}

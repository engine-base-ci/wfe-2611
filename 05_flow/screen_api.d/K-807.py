# K-807 招待を送り直す口（resendInvitation）・取り消す口（revokeInvitation）。形は K-800 の「契約」の節で決めた形（D-154.12・D-154.21・D-154.35）
# 送り直す：体を受けない POST（strict・ほかの欄は 422）。招待は道の id で引く。取り消す：DELETE（体を読まない）
INPUTS = {
    "resendInvitation": ("InvitationResendInput", {}),
}

# 送り直した：id・宛て・新しい期限（今から 7 日）・メールを送れたか（sent／failed。failed の回は 1 日 1 回に数えない）。トークンは答えに出さない
# 取り消した：id・取り消した時刻
RESPONSES = {
    "resendInvitation": ("InvitationResent", {"id": "uuid", "email": "string?", "expires_at": "string", "mail": "string"}),
    "revokeInvitation": ("InvitationRevoked", {"id": "uuid", "revoked_at": "string"}),
}

# apps/api/src/features/F10/admin/invitations/resend.ts・revoke.ts（DB の関数の答えの言葉 → gate.ts の replyOf・K-800）
_E403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "招く権限（members の invite・会社全体）が無い（マネージャー・メンバー・閲覧のみ・止めた人）",
         "ears_form": "UNWANTED: IF 招く権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"}
_E404 = {"status": 404, "code": "E-INV-016", "body": {"error": "not_found", "code": "E-INV-016"}, "errors": ["E-INV-016"],
         "trigger": "道の id の招待が無い・別の会社・消した（E-INV-016）",
         "ears_form": "UNWANTED: IF 招待が無いか別の会社か消してあるなら、Kaname は 404 と E-INV-016 を返し、何も書かない"}
_E503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "招待の更新・証跡を書く DB が落ちた・使えない",
         "ears_form": "UNWANTED: IF 招待を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も書かない"}
ERRORS_4XX = {
    "resendInvitation": [
        _E403, _E404,
        {"status": 409, "code": "E-INV-017", "body": {"error": "conflict", "code": "E-INV-017"}, "errors": ["E-INV-017", "E-INV-018", "E-INV-019"],
         "trigger": "招待がもう使われた（E-INV-017）・取り消した（E-INV-018）・24 時間の内に送り直した（E-INV-019・detail に次に送れる時刻）",
         "ears_form": "UNWANTED: IF 招待がもう使われたか取り消してあるか今日もう送り直したなら、Kaname は 409 と E-INV-017／018／019 を返し、何も書かずメールも送らない"},
        _E503,
    ],
    "revokeInvitation": [
        _E403, _E404,
        {"status": 409, "code": "E-INV-017", "body": {"error": "conflict", "code": "E-INV-017"}, "errors": ["E-INV-017", "E-INV-018"],
         "trigger": "招待がもう使われた（E-INV-017）・もう取り消した（E-INV-018）",
         "ears_form": "UNWANTED: IF 招待がもう使われたかもう取り消してあるなら、Kaname は 409 と E-INV-017／018 を返し、何も書かない"},
        _E503,
    ],
}

# 答えの欄で DB は null を許すが口は null を返さない物（K-144 の SHAPE_013・統合の枝）
NOT_NULL_ANSWERS = {
    "revokeInvitation.revoked_at": "口が取り消したその行の時刻を返し、null にはしない（invitations.revoked_at は null 可）",
}

# 統合の枝で足した（K-144 の契約の形の試験・直しの担当 XC）
SUCCESS_STATUS = {
    "resendInvitation": 200,   # 作らず状態を変えるだけ・口は 200 を返す（K-144 の SHAPE_010）
}

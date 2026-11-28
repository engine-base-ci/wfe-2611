# K-815 外す前の下見の口（previewMemberRemoval・GET /api/v1/members/:id/remove-preview）。形は K-800 の「契約」の節の 7 つの鍵に member・blocked_by を足した 9 つ
#   体も問い合わせも受けない GET なので INPUTS・REQUIRED_INPUTS・VALUE_RANGES・INPUT_RULES は持たない。
#   本体 screen_api.py の前の答えの行（7 つの鍵）はこの葉が本体で消した（同じ鍵を 2 つのファイルが持つと作り手が止まる）
#   blocked_by：自分 'self'・最後の管理者 'last_admin'・ほかは null（外せない人も断らず 200 で理由を返す。断る 409 は外す口 K-848）
RESPONSES = {
    "previewMemberRemoval": ("MemberRemovalPreview", {"member": "object", "blocked_by": "string?", "tickets": "array", "handovers_cancelled": "array", "approvals_reassigned": "array", "sole_approver": "array", "deleted": "array", "kept": "array", "restorable_until": "string"}),
}

# 下見：権限（403）・相手が居ない・見えない（404・欄と details なし）。DB の失敗（503・E-PAGE-003）は口が返す
ERRORS_4XX = {
    "previewMemberRemoval": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを直す権限（members の edit・会社全体）が無い（マネージャー・メンバー・閲覧のみ・止めた人）",
         "ears_form": "UNWANTED: IF メンバーを直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "道の id の人が無い・別の会社・消した・外した・招待中・AI（E-MEM-002）",
         "ears_form": "UNWANTED: IF 道の id の人が無い、別の会社、消した、外した、招待中、または人でないなら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
    ],
}

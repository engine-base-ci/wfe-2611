# K-814 一時的に止める・戻す口（suspendMember・resumeMember・POST /api/v1/members/:id/suspend・/resume）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F10/admin/members/suspend.ts・resume.ts（DB の関数 app.member_suspend・app.member_resume）。
#   体は空（どの欄も無い・strict なので知らない欄は 422）。形は K-800 の「契約」の節（MemberStateChanged・鍵はちょうど 3）。
#   権限の文（PERMS）と本人確認 always は本体 05_flow/screen_api.py のまま。
INPUTS = {
    "suspendMember": ("MemberSuspendInput", {}),
    "resumeMember": ("MemberResumeInput", {}),
}

RESPONSES = {
    "suspendMember": ("MemberStateChanged", {"member_id": "uuid", "suspended": "boolean", "suspended_at": "string?"}),
    "resumeMember": ("MemberStateChanged", {"member_id": "uuid", "suspended": "boolean", "suspended_at": "string?"}),
}


def _errors(verb: str, conflicts: list[dict]) -> list[dict]:
    return [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": f"{verb}のに、本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": f"UNWANTED: IF {verb}のに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、何も書かない"},
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": f"members の edit を持たない人（マネージャー・メンバー・閲覧のみ・止められた人）が{verb}",
         "ears_form": f"UNWANTED: IF members の edit を持たない人が{verb}なら、Kaname は 403 を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "道の id の人が無い・別の会社・外した・消した・AI",
         "ears_form": f"UNWANTED: IF {verb}相手が無いか別の会社か外した・消した人か AI なら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
        *conflicts,
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "道の id が uuid でない・体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 道の id が uuid でないか体に知らない項目があるなら、Kaname は 422 を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "members・所属・セッション・PC の仕事・証跡の書き込みで DB が落ちた（取引ごと戻る）",
         "ears_form": f"UNWANTED: IF {verb}途中で DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止めもセッションも仕事も証跡も変えない"},
    ]


ERRORS_4XX = {
    "suspendMember": _errors("止める", [
        {"status": 409, "code": "E-MEM-005", "body": {"error": "conflict", "code": "E-MEM-005"}, "errors": ["E-MEM-005"],
         "trigger": "自分を止めようとした",
         "ears_form": "UNWANTED: IF 自分を止めようとしたなら、Kaname は 409 と E-MEM-005 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-004", "body": {"error": "conflict", "code": "E-MEM-004"}, "errors": ["E-MEM-004"],
         "trigger": "最後の管理者（止めた管理者は数えない）を止めようとした",
         "ears_form": "UNWANTED: IF 最後の管理者を止めようとしたなら、Kaname は 409 と E-MEM-004 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-009", "body": {"error": "conflict", "code": "E-MEM-009"}, "errors": ["E-MEM-009"],
         "trigger": "もう止まっている人を止めようとした（同時に 2 人が止めた負けた方を含む）",
         "ears_form": "UNWANTED: IF もう止まっている人を止めようとしたなら、Kaname は 409 と E-MEM-009 を返し、証跡を増やさない"},
    ]),
    "resumeMember": _errors("戻す", [
        {"status": 409, "code": "E-MEM-010", "body": {"error": "conflict", "code": "E-MEM-010"}, "errors": ["E-MEM-010"],
         "trigger": "止まっていない人を戻そうとした（二度押しを含む）",
         "ears_form": "UNWANTED: IF 止まっていない人を戻そうとしたなら、Kaname は 409 と E-MEM-010 を返し、証跡を増やさない"},
    ]),
}

# K-742 自分で直す口（editApproval）
# 体は { text, version }：直した成果物の字（書いたとおりに残す・長さの上限は置かない D-130.3）と、直す前に読んだ成果物の版（1 以上の整数）。
# 答えは直した後の小さな形 ApprovalEdited（4 欄）
INPUTS = {
    "editApproval": ("ApprovalEditInput", {"text": "string", "version": "integer"}),
}

RESPONSES = {
    "editApproval": ("ApprovalEdited", {"id": "string", "ticket_id": "string", "version": "integer", "edited_at": "string"}),
}

# apps/api/src/features/F5/more/edit.ts の parseEdit（無ければ 422・欄つき）
REQUIRED_INPUTS = {
    "editApproval": ["text", "version"],
}

# text は空白（全角も）だけでない・長さの上限は書かない（D-130.3）。version は 1 以上
VALUE_RANGES = {
    "editApproval": {
        "text": {"pattern": "\\S"},
        "version": {"minimum": 1},
    },
}

# 権限（403・承認する人＝今の担当者だけ）・見えない／無い（404）・版が古い・同じ字・もう決まった（409）・形の誤り（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "editApproval": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "承認する人（今の担当者）でない人・今のメンバーでない人・チケットを書けない人が成果物を直そうとした",
         "ears_form": "UNWANTED: IF 承認する人でない人が成果物を直そうとしたなら、Kaname は 403 を返し、成果物の版もやり取りも変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えない・無い id・消したチケット・成果物でない承認（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない承認・無い承認・消したチケットの承認を直そうとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-APR-020", "body": {"error": "conflict", "code": "E-APR-020", "current_version": 2}, "errors": ["E-APR-020"],
         "trigger": "直す前に読んだ版が古い（先にほかの人が直していた・同じ版で同時に 2 つ来た負けた方）",
         "ears_form": "UNWANTED: IF 直す前に読んだ版が今の版でないなら、Kaname は 409 と E-APR-020 と今の版を返し、成果物を変えない"},
        {"status": 409, "code": "E-APR-021", "body": {"error": "conflict", "code": "E-APR-021"}, "errors": ["E-APR-021"],
         "trigger": "今の成果物と同じ字を送った（何も変えていない）",
         "ears_form": "UNWANTED: IF 今の成果物と同じ字を送ったなら、Kaname は 409 と E-APR-021 を返し、版もやり取りも証跡も増やさない"},
        {"status": 409, "code": "E-CONF-003", "body": {"error": "conflict", "code": "E-CONF-003"}, "errors": ["E-CONF-003"],
         "trigger": "もう承認・差し戻し・止め・取り下げで決まった承認の成果物を直そうとした",
         "ears_form": "UNWANTED: IF もう決まった承認の成果物を直そうとしたなら、Kaname は 409 と E-CONF-003 を返し、成果物の版を増やさない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "text か version が無い・text が文字でない・空白だけ・NUL を含む・version が 1 以上の整数でない・体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "直す DB の関数が使えない・守りの判定が例外・証跡が書けない・DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 直す関数か守りの判定か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、成果物の版もやり取りも証跡も変えない"},
    ],
}

# 承認の行の ticket_id は null 可だが、DB の関数 app.approval_self_edit は ticket_id の無い承認を not_found で断り、直せた時だけ答えを返す
NOT_NULL_ANSWERS = {
    "editApproval.ticket_id": "直せるのはチケットの成果物の承認だけ。DB の関数 app.approval_self_edit は ticket_id の無い承認を not_found（404）で断るので、答えの ticket_id は必ず入る（approvals.ticket_id は成果物でない承認のために null 可）",
}

# K-768 まとめて承認の口（previewBulkApproval・bulkApprove・D-153.11・D-153.5）
#   確かめ：体は任意の approval_ids（1〜50 個）。無ければ自分が承認する承認待ちの成果物の全部（50 件まで）。何も書かない
#   承認：approval_ids（1〜50 個・必須）を古い順に 1 件ずつ、1 件承認する口と同じ関数 app.approval_decide で承認する（1 件ごとの取引）
INPUTS = {
    "previewBulkApproval": ("BulkApprovalPreviewInput", {"approval_ids": "uuid[]?"}),
    "bulkApprove": ("BulkApproveInput", {"approval_ids": "uuid[]"}),
}

REQUIRED_INPUTS = {
    "bulkApprove": ["approval_ids"],
}

VALUE_RANGES = {
    "previewBulkApproval": {"approval_ids": {"minItems": 1, "maxItems": 50}},
    "bulkApprove": {"approval_ids": {"minItems": 1, "maxItems": 50}},
}

RESPONSES = {
    "previewBulkApproval": ("BulkApprovalPreview", {"eligible": "array", "excluded": "array", "count": "integer", "irreversible_count": "integer", "unchecked_count": "integer"}),
    "bulkApprove": ("BulkResult", {"updated": "array", "skipped": "array"}),
}

ERRORS_4XX = {
    "previewBulkApproval": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "今のメンバーでない人（抜けた・止められた人）がまとめて承認の確かめを読もうとした",
         "ears_form": "UNWANTED: IF 今のメンバーでない人がまとめて承認の確かめを読もうとしたなら、Kaname は 403 を返し、何も変えない"},
        {"status": 409, "code": "E-APR-030", "body": {"error": "conflict", "code": "E-APR-030"}, "errors": ["E-APR-030"],
         "trigger": "「全部」（体なし）で、自分が承認する承認待ちの成果物が 50 件を超えている",
         "ears_form": "UNWANTED: IF 自分が承認する承認待ちが 50 件を超えているのに全部をまとめて確かめようとしたなら、Kaname は 409 と E-APR-030 を返し、何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "approval_ids が uuid の並びでない・空・51 個以上・null を含む・体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF approval_ids の形が誤っているか体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "確かめの DB の関数が使えない・DB が落ちた",
         "ears_form": "UNWANTED: IF 確かめの DB の関数か DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない"},
    ],
    "bulkApprove": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "今のメンバーでない人（抜けた・止められた人）がまとめて承認しようとした",
         "ears_form": "UNWANTED: IF 今のメンバーでない人がまとめて承認しようとしたなら、Kaname は 403 を返し、何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "approval_ids が無い・uuid の並びでない・空・51 個以上・null を含む・体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF approval_ids が無いか形が誤っているか体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "途中の 1 件で守りの判定か承認の関数か DB が落ちた（それまでに承認した物は承認のまま・落ちた物と後ろの物は決まっていない）",
         "ears_form": "UNWANTED: IF まとめて承認の途中で守りの判定か承認の関数か DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、落ちた 1 件と後ろの物を決めない"},
    ],
}

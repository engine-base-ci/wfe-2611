# K-732 承認待ちを使わずに止める口（stopApproval）
# 体は空（どの欄も無い・strict なので知らない欄は 422）。答えは止めた承認の小さな形 ApprovalStopped（5 欄・新しい実行が無いので run_id・pc を持たない）
INPUTS = {
    "stopApproval": ("ApprovalStopInput", {}),
}

RESPONSES = {
    "stopApproval": ("ApprovalStopped", {"id": "string", "decision": "string?", "decided_at": "string?", "status_id": "string?", "ticket_id": "string?"}),
}

# 権限（403・承認する人＝今の担当者だけ）・見えない／無い／成果物でない（404）・もう決まった（409）・体に知らない欄（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "stopApproval": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "承認する人（今の担当者）でない人・今のメンバーでない人・チケットを書けない人が承認待ちを止めようとした",
         "ears_form": "UNWANTED: IF 承認する人でない人が承認待ちを止めようとしたなら、Kaname は 403 を返し、承認の行も段もやり取りも変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えない・無い id・成果物でない承認（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない承認・無い承認・成果物でない承認を止めようとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-CONF-003", "body": {"error": "conflict", "code": "E-CONF-003"}, "errors": ["E-CONF-003"],
         "trigger": "もう承認・差し戻し・止め・取り下げで決まった承認を止めようとした（二度押し・別のタブ・承認と同時の負けた方）",
         "ears_form": "UNWANTED: IF もう決まった承認を止めようとしたなら、Kaname は 409 と E-CONF-003 を返し、やり取りの行も証跡も増やさない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "止める DB の関数が使えない・守りの判定が例外・証跡が書けない・DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 止める関数か守りの判定か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、承認の行もチケットもやり取りも変えない"},
    ],
}

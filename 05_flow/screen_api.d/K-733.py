# K-733 承認を取り下げる口（withdrawApproval）
# 体は空（どの欄も無い・strict なので知らない欄は 422）。答えは取り下げた承認の小さな形 ApprovalWithdrawn（4 欄・approval_id は新しく承認待ちに戻った行）
INPUTS = {
    "withdrawApproval": ("ApprovalWithdrawInput", {}),
}

RESPONSES = {
    "withdrawApproval": ("ApprovalWithdrawn", {"id": "string", "withdrawn_at": "string", "ticket_id": "string", "approval_id": "string"}),
}

# 権限（403・承認した本人だけ）・見えない／無い／成果物でない（404）・間に合わなかった／取り下げられない（409 の 3 つ）・体に知らない欄（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "withdrawApproval": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "承認した本人でない人・今のメンバーでない人・チケットを書けない人が承認を取り下げようとした",
         "ears_form": "UNWANTED: IF 承認した本人でない人が承認を取り下げようとしたなら、Kaname は 403 を返し、承認の行も実行も段も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えない・無い id・成果物でない承認・消したチケットの承認（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない承認・無い承認・成果物でない承認を取り下げようとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-APR-010", "body": {"error": "conflict", "code": "E-APR-010"}, "errors": ["E-APR-010"],
         "trigger": "PC がもう仕事を受け取って動かしている（running・asking）承認の後の実行を取り下げようとした（PC が取るのと同時の負けた方を含む）",
         "ears_form": "UNWANTED: IF PC がもう受け取って動かしている承認を取り下げようとしたなら、Kaname は 409 と E-APR-010 を返し、承認も実行も仕事も変えない"},
        {"status": 409, "code": "E-APR-011", "body": {"error": "conflict", "code": "E-APR-011"}, "errors": ["E-APR-011"],
         "trigger": "まだ承認していない・差し戻し済み・止め済み・もう取り下げた・PC が受け取る前に片付けられた承認を取り下げようとした（二度押し・別のタブの負けた方を含む）",
         "ears_form": "UNWANTED: IF 取り下げられない承認を取り下げようとしたなら、Kaname は 409 と E-APR-011 を返し、何も変えない"},
        {"status": 409, "code": "E-APR-012", "body": {"error": "conflict", "code": "E-APR-012"}, "errors": ["E-APR-012"],
         "trigger": "承認の後の実行がもう終わった（done）・PC が受け取った後に止まった承認を取り下げようとした",
         "ears_form": "UNWANTED: IF 承認の後の実行がもう終わった承認を取り下げようとしたなら、Kaname は 409 と E-APR-012 を返し、何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "取り下げる DB の関数が使えない・守りの判定が例外・証跡か受け箱が書けない・DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 取り下げる関数か守りの判定か証跡か受け箱の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、承認もチケットも実行も変えない"},
    ],
}

# K-746 試し打ちの口（dryRunTicket）
# 体は空（どの欄も無い・strict なので知らない欄は 422）。答えは積んだ試し打ちの小さな形 DryRunStarted（4 欄）
INPUTS = {
    "dryRunTicket": ("DryRunInput", {}),
}

RESPONSES = {
    "dryRunTicket": ("DryRunStarted", {"run_id": "string", "job_id": "string", "status": "string", "pc": "string"}),
}

# 権限（403・担当者だけ）・見えない／無い（404）・今の状態ではできない（409 が 4 つ）・体に知らない欄（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "dryRunTicket": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "担当者でない人（書ける人・マネージャー・見るだけの人）か、チケットを直せない人が試し打ちしようとした",
         "ears_form": "UNWANTED: IF 担当者でない人かチケットを直せない人が試し打ちしようとしたなら、Kaname は 403 を返し、仕事も実行もやり取りも変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えないグループ・無い id・消したチケット（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えないチケット・無いチケット・消したチケットで試し打ちしようとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-RUN-003", "body": {"error": "conflict", "code": "E-RUN-003"}, "errors": ["E-RUN-003"],
         "trigger": "承認待ちの成果物が無いチケット（作業中・承認済みで実行待ち・差し戻し済み・完了）で試し打ちしようとした",
         "ears_form": "UNWANTED: IF 承認待ちの成果物が無いチケットで試し打ちしようとしたなら、Kaname は 409 と E-RUN-003 を返し、何も積まない"},
        {"status": 409, "code": "E-CONF-013", "body": {"error": "conflict", "code": "E-CONF-013"}, "errors": ["E-CONF-013"],
         "trigger": "待っている・動いている実行がある（二度押し・同時に押した負けた方）",
         "ears_form": "UNWANTED: IF 待っている・動いている実行があるときに試し打ちしようとしたなら、Kaname は 409 と E-CONF-013 と今の実行の id を返し、何も積まない"},
        {"status": 409, "code": "E-RUN-004", "body": {"error": "conflict", "code": "E-RUN-004"}, "errors": ["E-RUN-004"],
         "trigger": "試し打ちを動かす AI が使えない（AI に任せた人が止められた・外された・直せなくなった・PC が無い）",
         "ears_form": "UNWANTED: IF 試し打ちを動かす AI が使えないなら、Kaname は 409 と E-RUN-004 と理由（detail.reason）を返し、何も積まない"},
        {"status": 409, "code": "E-RUN-005", "body": {"error": "conflict", "code": "E-RUN-005"}, "errors": ["E-RUN-005"],
         "trigger": "押した人のログインのメールアドレスが分からない",
         "ears_form": "UNWANTED: IF 押した人のメールアドレスが分からないなら、Kaname は 409 と E-RUN-005 を返し、何も積まず、メールアドレスを答えにもログにも出さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も積まない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "試し打ちを積む DB の関数・仕事・やり取り・証跡の書き込みか DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 試し打ちを積む関数か書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、実行も仕事もやり取りも何も残さない"},
    ],
}

# K-731 動いている AI の実行を止める口（stopActionRun）
# 体は空（どの欄も無い・strict なので知らない欄は 422）。答えは止めた実行の小さな形 ActionRunStopped（6 欄・K-485 の ActionRunView とは別の形）
INPUTS = {
    "stopActionRun": ("ActionRunStopInput", {}),
}

RESPONSES = {
    "stopActionRun": ("ActionRunStopped", {"id": "string", "ticket_id": "string", "phase": "string", "status": "string",
                                           "stopped_reason": "string?", "stopped_at": "string?"}),
}

# 権限（403・担当者だけ）・見えない／無い／消した（404）・今の状態ではできない（409）・体に知らない欄（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "stopActionRun": [
        {"status": 403, "code": "E-RUN-001", "body": {"error": "permission", "code": "E-RUN-001"}, "errors": ["E-RUN-001"],
         "trigger": "担当者でない人（任せた人・マネージャー・担当者のいないチケットの誰でも）が AI の実行を止めようとした",
         "ears_form": "UNWANTED: IF 担当者でない人か担当者のいないチケットで AI の実行を止めようとしたなら、Kaname は 403 と E-RUN-001 を返し、実行も仕事も段もやり取りも変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えないグループ・無い id・消したチケットの実行（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない実行・無い実行・消したチケットの実行を止めようとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-RUN-002", "body": {"error": "conflict", "code": "E-RUN-002"}, "errors": ["E-RUN-002"],
         "trigger": "もう止まった・作り終えた・取り消した実行を止めようとした（二度押し・別のタブ・同時に 2 つの負けた方）",
         "ears_form": "UNWANTED: IF もう止まった・作り終えた・取り消した実行を止めようとしたなら、Kaname は 409 と E-RUN-002 を返し、やり取りの行も証跡も増やさない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "止める DB の関数が使えない・証跡が書けない・DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 止める関数か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、実行も仕事もチケットもやり取りも変えない"},
    ],
}

# 止める口の答えは、チケットの実行 1 件（会話の実行は止めない）なので ticket_id・phase は必ず入る
NOT_NULL_ANSWERS = {
    "stopActionRun.ticket_id": "チケットの実行だけを止める口。DB の関数 app.run_stop は ticket_id を持つ実行だけを読む（action_runs.ticket_id は会話の実行のために null 可）",
    "stopActionRun.phase": "チケットの実行（作る段・承認の後の実行）だけを止める口で、どちらも phase を持つ。DB の関数 app.run_stop がそのまま返す（action_runs.phase は会話の実行のために null 可）",
}

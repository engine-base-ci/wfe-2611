# K-979 運営が障害の続報を足す口（addIncidentUpdate）
#   入力と答えの形（state 4 つ・body 1〜4000・答えは 16 欄）は K-1004 の断片が持つ。この葉は振る舞いと 404・409 を足す
#   振る舞いの本体は apps/api/src/features/F12/ops/notices/incident.ts（DB の関数 app.ops_notice_incident_update）
ERRORS_4XX = {
    "addIncidentUpdate": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": ["NOT_FOUND"],
         "trigger": "お知らせが無い・消した・運営の会社の行でない（欄も details も付けない）",
         "ears_form": "UNWANTED: IF お知らせが無いか見えないなら、Kaname は 404 と NOT_FOUND を返し、続報を足さない"},
        {"status": 409, "code": "E-OPS-012", "body": {"error": "conflict", "code": "E-OPS-012"}, "errors": ["E-OPS-012"],
         "trigger": "出した障害でない（リリース・メンテ・下書き・予定の時刻の前）",
         "ears_form": "UNWANTED: IF お知らせが出した障害でないなら、Kaname は 409 と E-OPS-012 を返し、続報を足さない"},
        {"status": 409, "code": "E-OPS-013", "body": {"error": "conflict", "code": "E-OPS-013"}, "errors": ["E-OPS-013"],
         "trigger": "障害がもう直った（今の状態が resolved）",
         "ears_form": "UNWANTED: IF 障害がもう直ったなら、Kaname は 409 と E-OPS-013 を返し、続報を足さない"},
    ],
}

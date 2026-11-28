# K-489 消したチケットを戻す口（restoreTicket・POST /api/v1/tickets/:id/restore）の体・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F7/ticket-delete/restore.ts（DB の関数 app.ticket_restore）。権限の文は本体 05_flow/screen_api.py の PERMS（前からある行を直した）
#   体は空（strict）。問い合わせを持たない口なので、K-468 の問い合わせの値域の表 QUERY_RANGES に足す物は無い
INPUTS = {"restoreTicket": ("TicketRestoreInput", {})}
RESPONSES = {"restoreTicket": ("TicketRestored", {"id": "uuid", "restored_count": "integer"})}
ERRORS_4XX = {
    "restoreTicket": [
        {"status": 403, "code": "E-DEL-040", "body": {"error": "permission", "code": "E-DEL-040"}, "errors": ["E-DEL-040"],
         "trigger": "消した本人でも、そのグループのマネージャー・管理者でもない人が、消したチケットを戻した",
         "ears_form": "UNWANTED: IF 消した本人でも、そのグループのマネージャー・管理者でもない人が戻したなら、Kaname は 403 を返し、チケットを何も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えないグループ・無い id のチケットを戻した（消した物が有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない・無いチケットを戻したなら、Kaname は 404 を返し、チケットを何も変えない"},
        {"status": 409, "code": "E-DEL-041", "body": {"error": "conflict", "code": "E-DEL-041"}, "errors": ["E-DEL-041", "E-DEL-042", "E-DEL-043"],
         "trigger": "もう戻っているチケットを戻した（E-DEL-041）／消してから 30 日を過ぎた（E-DEL-042）／親が消えている子を戻した（E-DEL-043）",
         "ears_form": "UNWANTED: IF 消えていないチケット・30 日を過ぎたチケット・親が消えている子を戻したなら、Kaname は 409 を返し、チケットを何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "体に知らない項目が入っている（体は空）",
         "ears_form": "UNWANTED: IF 体に知らない項目が入っているなら、Kaname は 422 を返し、チケットを何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "戻す DB の関数・証跡の書き込みが落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 戻す DB の関数か証跡の書き込みが落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も戻さない"},
    ],
}

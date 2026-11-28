# K-823 記録を探す口（listAuditEvents・GET /api/v1/audit_events）
#   問い合わせの名前は本体（screen_api.py）の QUERIES の行（kind・member_id・ticket_id・from・to。q は孫 K-850 が本体の同じ行に戻す）。
#   ことば（q）・scan_capped・E-AUD-010 は K-850 がこの断片に足した（同じ口を 2 つの断片が持つと作り手が止まる）。
#   scan_capped は q があるときだけ答えに付く（走査の上限 5000 行に届いて読み終えていなければ true・続きの印は付けない）
# 答えの形（K-825 の画面が使う・D-154.11）：entries（1 件は id・occurred_at・kind・action・actor・target・text・reason・device・step_up・deleted）・
#   next_cursor（続きの印・無ければ null）・scope（all＝管理者・groups＝マネージャー）。件数の合計は返さない（範囲の外を漏らさない）
RESPONSES = {
    "listAuditEvents": ("AuditEvents", {"entries": "array", "next_cursor": "string?", "scope": "string", "scan_capped": "boolean"}),
}
# 札は 6 つ（perm・out・device・ai・deleted・ops）。member_id・ticket_id は名前の _id で作り手が uuid の形にする。
#   from・to は ISO 8601 の日時（時差つき）・cursor は <occurred_at の UTC・マイクロ秒の ISO>_<id> を base64url にした字（形は作り手が KEY_CURSOR_OPS から書く）
QUERY_RANGES = {
    "listAuditEvents": {
        "q": {"minLength": 1, "maxLength": 100, "pattern": "\\S"},   # K-850：空・空白だけ・101 字以上は口が 422・E-AUD-010（apps/api/src/features/F10/audit/patterns.ts の AUDIT_Q_MAX）
        "kind": {"enum": ["perm", "out", "device", "ai", "deleted", "ops"]},
        "from": {"pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})$"},
        "to": {"pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,6})?)?(Z|[+-]\\d{2}:\\d{2})$"},
    },
}
# 一覧の細目：limit は 1〜100（既定 50）・sort を受けない（新しい順で固定）
LIST_DETAILS = {
    "listAuditEvents": {"limit_max": 100, "sort": False, "desc": "取得（audit_events）— 会社の記録を新しい順に読む（札・人・チケット・期間で絞る・50 件ずつ。会社全体は管理者・マネージャーは自分のグループの分）", "meta": "{}"},
}
# 読めるのは管理者とマネージャー（app.audit_list が 42501 → 403）。形の誤りは 422・E-AUD-001（欄ごと）・続きの印の形の誤りは 422・E-AUD-002
ERRORS_4XX = {
    "listAuditEvents": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": ["FORBIDDEN"],
         "trigger": "管理者でもマネージャーでもない人（メンバー・閲覧のみ・依頼する側）が記録を読もうとした",
         "ears_form": "UNWANTED: IF 管理者でもマネージャーでもない人が記録を読もうとしたなら、Kaname は 403 を返し、記録の行を 1 つも返さない"},
        {"status": 422, "code": "E-AUD-001", "body": {"error": "validation_failed", "code": "E-AUD-001"}, "errors": ["E-AUD-001"],
         "trigger": "絞りの形が違う（知らない札・日時でない from と to・100 を超える limit。uuid でない member_id と ticket_id・limit の 0 と数でない値は入口が VALIDATION_ERROR で断る）",
         "ears_form": "UNWANTED: IF 絞りの形が違うなら、Kaname は 422 と E-AUD-001 を欄ごとの理由つきで返し、記録を読まない"},
        {"status": 422, "code": "E-AUD-002", "body": {"error": "validation_failed", "code": "E-AUD-002"}, "errors": ["E-AUD-002"],
         "trigger": "続きの印をほどけない・中身が 時刻（マイクロ秒）_uuid でない・暦に無い日付（base64url の形でない印は入口が VALIDATION_ERROR で断る）",
         "ears_form": "UNWANTED: IF 続きの印の形が違うなら、Kaname は 422 と E-AUD-002 を返し、記録を読まない"},
        {"status": 422, "code": "E-AUD-010", "body": {"error": "validation_failed", "code": "E-AUD-010"}, "errors": ["E-AUD-010"],
         "trigger": "探すことば（q）が空・空白だけ・101 字以上（K-850。NUL は入口が VALIDATION_ERROR で断る）",
         "ears_form": "UNWANTED: IF 探すことばが空・空白だけ・101 字以上なら、Kaname は 422 と E-AUD-010 を欄 q の理由つきで返し、記録を読まない"},
    ],
}

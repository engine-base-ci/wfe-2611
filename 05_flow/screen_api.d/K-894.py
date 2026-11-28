# K-894 依頼を受けて普通のチケットを作る口（acceptClientRequest・POST /api/v1/client_requests/:id/accept）の体・答え・値域・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F11/requests/accept.ts（DB の関数 app.client_request_accept）。触る表と権限の文は本体 05_flow/screen_api.py（前からある行を直した）
#   期限・担当・グループは社内が決める（必須）。題・本文は無ければ依頼から入る。依頼を出したゲストのグループはいつも見せる相手に入る（guest_group_ids は足す分）
INPUTS = {
    "acceptClientRequest": ("ClientRequestAcceptInput", {"title": "string?", "body": "string?", "assignee_member_id": "uuid", "due_on": "string",
                                                         "scope_id": "uuid", "kind_id": "uuid?", "guest_group_ids": "uuid[]?"}),
}
VALUE_RANGES = {
    "acceptClientRequest": {"title": {"minLength": 1, "maxLength": 200}, "guest_group_ids": {"minItems": 1, "maxItems": 20}},
}
RESPONSES = {
    "acceptClientRequest": ("ClientRequestAccepted", {"ticket_id": "uuid", "number": "string"}),
}
ERRORS_4XX = {
    "acceptClientRequest": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "読むだけの人（届け先で client_requests を edit できない）／選んだグループに tickets を書けない（欄 scope_id）／ゲストの文脈",
         "ears_form": "UNWANTED: IF 依頼を直せない人か、選んだグループにチケットを書けない人が受けたなら、Kaname は 403 を返し、チケットを作らず依頼を変えない"},
        {"status": 404, "code": "E-GST-100", "body": {"error": "not_found", "code": "E-GST-100"}, "errors": ["E-GST-100", "E-GST-040"],
         "trigger": "依頼が無い・見えない・消した・別の会社・前の取引先の形（E-GST-100）／見せる相手に足したゲストのグループが無い・消した・別の会社（E-GST-040）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 依頼が見つからないか、足したゲストのグループが見つからないなら、Kaname は 404 を返し、何も残さず、在るかを漏らさない"},
        {"status": 409, "code": "E-GST-120", "body": {"error": "conflict", "code": "E-GST-120"}, "errors": ["E-GST-120", "E-GST-041"],
         "trigger": "依頼がもう決まっている（チケットにした・断った・同時の 2 本の後の方）（E-GST-120）／見せる相手が 20 を超える（E-GST-041）",
         "ears_form": "UNWANTED: IF 依頼がもう決まっているか、見せる相手が 20 を超えるなら、Kaname は 409 を返し、チケットを作らず依頼を変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"}, "errors": ["E-VAL-014"],
         "trigger": "担当・期限・グループが無い・題が空か 201 字以上・日付でない・uuid でない・guest_group_ids が空か 21 個・知らない欄／担当が会社の人でない・止めた・抜けた・種別が無い（E-VAL-014・欄つき）",
         "ears_form": "UNWANTED: IF 体が形に合わないか、担当か種別が選べないなら、Kaname は 422 を返し、何も残さない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "受ける取引の途中（見せる相手・証跡の書き込み）が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 受ける取引の途中が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、チケットも書き込みも見せる相手も依頼の変更も残さない"},
    ],
}

# 答えの欄で DB は null を許すが口は null を返さない物（K-144 の SHAPE_013・統合の枝）
NOT_NULL_ANSWERS = {
    "acceptClientRequest.ticket_id": "口が受けて作ったチケットの id を返し、無ければ 503 にする（null にはしない・client_requests.ticket_id は null 可）",
}

REQUIRED_INPUTS = {
    "acceptClientRequest": ['assignee_member_id', 'due_on', 'scope_id'],   # accept.ts の parseAccept（担当・期限・グループが無ければ 422・欄つき）
}

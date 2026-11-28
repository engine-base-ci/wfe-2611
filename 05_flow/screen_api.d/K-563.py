# K-563 会社が足す項目を読む口（listTicketFields・GET /api/v1/ticket-fields?kind_id=<uuid>）
# 答え（K-563・D-150.36・D-150.37）：鍵ちょうど 7。options は選ぶ型（select・multi_select）だけ { id, name, position } の並び・ほかの型は []。
#   会社の id・作った人・時刻は出さない。入力は問い合わせ kind_id（uuid・任意）だけ。
RESPONSES = {
    "listTicketFields": ("TicketField", {"id": "uuid", "name": "string", "field_type": "string", "required": "boolean", "description": "string?", "options": "array", "position": "integer"}),
}

QUERIES = {
    "listTicketFields": ["kind_id"],
}

LIST_DETAILS = {
    "listTicketFields": {"sort": False, "desc": "取得（custom_fields）— その種別で出す会社の項目を並びの順に見る（型・必須・説明・選択肢）"},
}

# 種別が無い・消された・別の会社は 404（在るかを漏らさないので field・details・detail を付けない）。403・409・502 は返さない。
#   kind_id が uuid の形でないは 422（入口の共通の形の確かめ）
ERRORS_4XX = {
    "listTicketFields": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "kind_id の種別が無い・消された・別の会社",
         "ears_form": "UNWANTED: IF kind_id の種別が無い・消された・別の会社なら、Kaname は 404 と NOT_FOUND を返し、項目を返さない"},
    ],
}

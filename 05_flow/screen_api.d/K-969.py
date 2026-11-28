# K-969（openPeek・closePeek）
#   答えの形は K-1006 の断片が持つ。この葉が足すのは 4xx の 4 つ：
#   開く … 指した会社・問い合わせが無い／見えない 404（app.ops_target・問い合わせの持ち主が P0002）・同じ人がもう開いている 409 E-OPS-001
#   閉じる … 自分が開いた許可が無い 404（P0002）・もう閉じた／期限が切れた／取り消した 409 E-OPS-002
ERRORS_4XX = {
    "openPeek": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "指した会社が無い・運営の会社・作りかけ・消した会社、または付けた問い合わせがその会社の物でない・消した・無い（P0002）",
         "ears_form": "UNWANTED: IF 指した会社か問い合わせが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず欄も details も付けず、許可を作らない"},
        {"status": 409, "code": "E-OPS-001", "body": {"error": "conflict", "code": "E-OPS-001"}, "errors": ["E-OPS-001"],
         "trigger": "同じ運営の人が同じ会社に、まだ効いている許可（閉じていない・期限の前・取り消していない）を持っている",
         "ears_form": "UNWANTED: IF 同じ運営の人がその会社をもう開いているなら、Kaname は 409 と E-OPS-001 を返し、許可を増やさない"},
    ],
    "closePeek": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "許可が無い・ほかの運営の人が開いた・消した許可（P0002）",
         "ears_form": "UNWANTED: IF 自分が開いた許可が無いなら、Kaname は 404 を返し、在るかを漏らさず欄も details も付けず、閉じない"},
        {"status": 409, "code": "E-OPS-002", "body": {"error": "conflict", "code": "E-OPS-002"}, "errors": ["E-OPS-002"],
         "trigger": "許可がもう閉じた・期限が切れた・取り消した（同時の 2 回目の閉じるも）",
         "ears_form": "UNWANTED: IF 許可がもう閉じたか期限が切れたなら、Kaname は 409 と E-OPS-002 を返し、記録を増やさない"},
    ],
}

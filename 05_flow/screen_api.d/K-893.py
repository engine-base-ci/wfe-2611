# K-893 届いた依頼の届け先を変える・返事を送る口（updateClientRequest・replyToClientRequest）の契約の形に足す分
#   体は strict（知らない欄は 422）。返事の本文は入口の normalize（NFKC と前後の空白）の後に 1 字以上・上限なし（D-130.1）
INPUTS = {
    "updateClientRequest": ("ClientRequestRouteInput", {"route_id": "uuid"}),
    "replyToClientRequest": ("ClientRequestReplyInput", {"body": "string"}),
}
RESPONSES = {
    "updateClientRequest": ("ClientRequestRouted", {"route_name": "string"}),
    "replyToClientRequest": ("ClientRequestReplied", {"state": "string"}),
}
VALUE_RANGES = {"replyToClientRequest": {"body": {"minLength": 1}}}

_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": [],
              "trigger": "依頼は見えるが直す権限（届け先のグループの client_requests の edit）が無い（読むだけの人）・ゲストの文脈",
              "ears_form": "UNWANTED: IF 依頼を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も変えない"}
_NOT_FOUND = {"status": 404, "code": "E-GST-100", "body": {"error": "not_found", "code": "E-GST-100"}, "errors": ["E-GST-100"],
              "trigger": "依頼が無い・見えない・消した・別の会社・前の取引先の形（欄・details は付けない・在るかを漏らさない）",
              "ears_form": "UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、何も変えない"}
_DECIDED = {"status": 409, "code": "E-GST-110", "body": {"error": "conflict", "code": "E-GST-110"}, "errors": ["E-GST-110"],
            "trigger": "依頼がもう決まっている（チケットにした・断った）",
            "ears_form": "UNWANTED: IF 依頼がもう決まっているなら、Kaname は 409 と E-GST-110 を返し、何も変えない"}
ERRORS_4XX = {
    "updateClientRequest": [
        _FORBIDDEN, _NOT_FOUND,
        {"status": 404, "code": "E-GST-111", "body": {"error": "not_found", "code": "E-GST-111"}, "errors": ["E-GST-111"],
         "trigger": "選んだ届け先のグループが、無い・消した・別の会社・見ている人が client_requests を edit できない",
         "ears_form": "UNWANTED: IF 選んだ届け先が選べないなら、Kaname は 404 と E-GST-111 を返し、届け先を変えない"},
        _DECIDED,
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "届け先の id が無い・空・uuid でない・知らない欄（strict）・道の :id が uuid でない",
         "ears_form": "UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"},
    ],
    "replyToClientRequest": [
        _FORBIDDEN, _NOT_FOUND, _DECIDED,
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "返事が空・空白だけ・文字でない・知らない欄（strict）・道の :id が uuid でない",
         "ears_form": "UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、返事を書かない"},
    ],
}

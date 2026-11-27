# K-895 届いた依頼を断る口（declineClientRequest）の契約の形に足す分
#   体は strict（知らない欄は 422）。理由は入口の normalize（NFKC と前後の空白）の後に 1〜2000 字（D-130.1）。理由は出し手に見える
INPUTS = {"declineClientRequest": ("ClientRequestDeclineInput", {"reason": "string"})}
RESPONSES = {"declineClientRequest": ("ClientRequestDeclined", {"state": "string"})}
VALUE_RANGES = {"declineClientRequest": {"reason": {"minLength": 1, "maxLength": 2000}}}

ERRORS_4XX = {
    "declineClientRequest": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": [],
         "trigger": "依頼は見えるが直す権限（届け先のグループの client_requests の edit）が無い（読むだけの人）・ゲストの文脈",
         "ears_form": "UNWANTED: IF 依頼を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も変えない"},
        {"status": 404, "code": "E-GST-100", "body": {"error": "not_found", "code": "E-GST-100"}, "errors": ["E-GST-100"],
         "trigger": "依頼が無い・見えない・消した・別の会社・前の取引先の形（欄・details は付けない・在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、何も変えない"},
        {"status": 409, "code": "E-GST-130", "body": {"error": "conflict", "code": "E-GST-130"}, "errors": ["E-GST-130"],
         "trigger": "依頼がもう決まっている（チケットにした・断った）ので断れない（断った依頼は取り消せない）",
         "ears_form": "UNWANTED: IF 依頼がもう決まっているなら、Kaname は 409 と E-GST-130 を返し、何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "理由が無い・空・空白だけ・文字でない・2001 字以上・知らない欄（strict）・道の :id が uuid でない",
         "ears_form": "UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、断らない"},
    ],
}

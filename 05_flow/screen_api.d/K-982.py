# K-982 運営が入金を記録する口（recordPayment）：入力と答えの形は K-1005。ここは振る舞いの断り（D-156.32・D-156.12・D-156.17）
#   請求書・取り消す入金が無い・見えないは 404（欄なし・在るかを漏らさない）。同じ入金の 2 回目の取り消し・打ち消しの行の取り消しは 409 E-BILL-004。
#   取り消す額が元の入金の額と違うは 409 E-BILL-005
ERRORS_4XX = {
    "recordPayment": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "道の id の請求書が無い・出していない下書き・消した・運営の会社の行。取り消す入金がその請求書の消していない正の額の入金でない。欄・details は付けない",
         "ears_form": "UNWANTED: IF 請求書か取り消す入金が無いなら、Kaname は 404 を返し、入金の行も記録も作らない"},
        {"status": 409, "code": "E-BILL-004", "body": {"error": "conflict", "code": "E-BILL-004"}, "errors": ["E-BILL-004", "E-BILL-005"],
         "trigger": "同じ入金をもう取り消した（同時に 2 回押した後の 1 つも）・打ち消しの行そのものを取り消そうとした（E-BILL-004）・取り消す額が入金の額と違う（E-BILL-005）。欄も details も付けない",
         "ears_form": "UNWANTED: IF もう取り消した入金を取り消すか、取り消す額が入金の額と違うなら、Kaname は 409 と E-BILL-004／E-BILL-005 を返し、入金の行も記録も作らない"},
    ],
}

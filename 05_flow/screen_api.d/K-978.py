# K-978 運営がお知らせを出す（publishOpsNotice）・1 社にお知らせを送る（sendWorkspaceNotice）の契約に足す分（D-156.33・D-128.108）
#   入力と答えの形は K-1004 の断片が持つ（出すは空の体・1 社に送るは title・body・placements が必須・管理者だけの組み合わせも K-1004）。
#   ここは口が返す 404・409 の行だけ。もう出した・メンテの時間が無いは DB の中身で決まるので 409（欄なし）

ERRORS_4XX = {
    "publishOpsNotice": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "お知らせが無い・消した・運営の会社の行でない（在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 指したお知らせが無いか消してあれば、Kaname は 404 と NOT_FOUND を返し、何も出さない"},
        {"status": 409, "code": "E-OPS-010", "body": {"error": "conflict", "code": "E-OPS-010"}, "errors": ["E-OPS-010"],
         "trigger": "使えなくなるメンテのお知らせに、メンテの始まりか終わりの時間が無い",
         "ears_form": "UNWANTED: IF メンテの時間が無いメンテのお知らせを出そうとしたら、Kaname は 409 と E-OPS-010 を返し、下書きのままにしてメールを送らない"},
        {"status": 409, "code": "E-OPS-011", "body": {"error": "conflict", "code": "E-OPS-011"}, "errors": ["E-OPS-011"],
         "trigger": "もう出した・予定にしたお知らせをもう一度出した（同時に 2 回押した後の方も）",
         "ears_form": "UNWANTED: IF もう出したか予定にしたお知らせを出そうとしたら、Kaname は 409 と E-OPS-011 を返し、状態の行も記録も増やさない"},
    ],
    "sendWorkspaceNotice": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "指した会社が無い・消した・作りかけ・運営の会社（在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 指した会社が無いか運営の会社なら、Kaname は 404 と NOT_FOUND を返し、お知らせを作らない"},
    ],
}

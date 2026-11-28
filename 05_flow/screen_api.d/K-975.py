# K-975 運営が問い合わせに返す口（replyOpsInquiry）と社内メモの口（addOpsInquiryNote）
#   契約の形（入力の欄 body・答えの OpsInquiryMessage の 6 欄・空白だけの body の決まり）は K-948 の断片が持つ。この葉は断る番号を足す。
#   振る舞いの本体は apps/api/src/features/F12/ops/inbox-reply.ts（DB の関数 app.ops_inquiry_reply・app.ops_inquiry_note）
ERRORS_4XX = {
    "replyOpsInquiry": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "問い合わせが無い・消した・作りかけの会社や消した会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 問い合わせが無いか消してあるなら、Kaname は 404 を返し、返事を書かない"},
        {"status": 409, "code": "E-OPS-005", "body": {"error": "conflict", "code": "E-OPS-005"}, "errors": ["E-OPS-005"],
         "trigger": "ほかの人が担当の問い合わせに返す",
         "ears_form": "UNWANTED: IF ほかの人が担当なら、Kaname は 409 と E-OPS-005 を返し、返事も鈴も書かない"},
    ],
    "addOpsInquiryNote": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "問い合わせが無い・消した・作りかけの会社や消した会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 問い合わせが無いか消してあるなら、Kaname は 404 を返し、社内メモを書かない"},
    ],
}

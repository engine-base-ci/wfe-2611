# K-977 運営がお知らせを読む口（listOpsNotices・getOpsNotice）。入力と答えの形・kind／state の値は K-1004 の断片と本体が持つ。
#   ここは getOpsNotice の断り（無い・消した・運営の会社でないお知らせは 404・欄なし）だけ。
#   振る舞いは apps/api/src/features/F12/ops/notices/read.ts と DB の関数 app.ops_notices・app.ops_notice_detail（20261128011700_ops_notices_read.sql）
ERRORS_4XX = {
    "getOpsNotice": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "お知らせが無い・消した・運営の会社のお知らせでない（欄も details も付けない）",
         "ears_form": "UNWANTED: IF お知らせが無いか消してあるなら、Kaname は 404 と NOT_FOUND を返し、在るかを漏らさず何も書かない"},
    ],
}

# K-892 届いた依頼を読む口（listClientRequests・getClientRequest）
#   ゲストのグループの依頼を、届け先の社内のグループが見える人（と会社全体の edit を持つ人）が読む（D-155.43・D-155.40）。
#   route・getClientRequest の答えの形・権限・問い合わせの行は本体（05_flow/screen_api.py）の前からある行を直した。ここは本体に無い物だけ。
#   一覧の答えは並びでなく { items, counts }（画面 K-898 が前提にした形）。並びでない一覧なので OBJECT_OPS に入れ、cursor・limit・sort を契約に足さない
OBJECT_OPS = {"listClientRequests"}

RESPONSES = {
    "listClientRequests": ("ClientRequestList", {"items": "array", "counts": "object"}),
}

# 問い合わせ state は live（新しい・聞いている）か done（チケットにした・断った）。無ければ両方（apps/api/src/features/F11/requests/read.ts）
QUERY_RANGES = {
    "listClientRequests": {"state": {"enum": ["live", "done"]}},
}

# 一覧：社内の人でない（ゲストの文脈は入口の 403）・問い合わせの誤り（422）・Kaname の側（503）
# 1 件：見えない・無い・消した・別の会社・前の取引先の形（404・E-GST-100・欄・details なし）・社内の人でない（403）・Kaname の側（503）
ERRORS_4XX = {
    "listClientRequests": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "社内の人でない（ゲストの文脈・入口の役の柵）",
         "ears_form": "UNWANTED: IF 社内の人でないなら、Kaname は 403 を返し、依頼を返さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "問い合わせ state が live・done 以外・空・重ねた・知らない問い合わせ",
         "ears_form": "UNWANTED: IF 問い合わせが live・done 以外か知らない名前なら、Kaname は 422 を返し、依頼を返さない"},
    ],
    "getClientRequest": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "社内の人でない（ゲストの文脈・入口の役の柵）",
         "ears_form": "UNWANTED: IF 社内の人でないなら、Kaname は 403 を返し、依頼を返さない"},
        {"status": 404, "code": "E-GST-100", "body": {"error": "not_found", "code": "E-GST-100"}, "errors": ["E-GST-100"],
         "trigger": "依頼が無い・見えない・消した・別の会社・前の取引先の形（在るかを漏らさないので欄・details なし）",
         "ears_form": "UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、依頼を返さない"},
    ],
}

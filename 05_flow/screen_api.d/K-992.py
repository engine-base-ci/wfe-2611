# K-992 運営がひな形を読む口（listOpsTemplates・getOpsTemplate）（D-156.20・D-156.21・D-156.12・D-156.17）
# 一覧：種別・状態・項目の 3 行（決まった並び・絞り込みも並べ替えも受けない）。1 行は 8 欄（下絵 oq-templates の 5 列）
# 1 つ：一覧の 8 欄と、今の版の中身（items）・版の記録（versions・新しい順）
#   took は今の版を知らせた会社が無ければ null・在れば { changed, offered }
_ROW = {"id": "uuid", "key": "string", "name": "string", "summary": "string", "version": "integer", "using": "integer",
        "took": "object?", "last_released_at": "string?"}
RESPONSES = {
    "listOpsTemplates": ("OpsTemplateRow", dict(_ROW)),
    "getOpsTemplate": ("OpsTemplate", {**_ROW, "items": "array", "versions": "array"}),
}

# 一覧は問い合わせの値を受けない（3 行の決まった並び）
QUERIES = {
    "listOpsTemplates": [],
}
LIST_DETAILS = {
    "listOpsTemplates": {"sort": False, "desc": "取得（distributions）— 運営のひな形（種別・状態・項目）を決まった並びで見る（今の版・使っている会社の数・知らせた会社のうち変えた数）"},
}

# 一覧も 1 つも 60/min/user（G-16・K992-API-006）
RATES = {
    "listOpsTemplates": "60/min/user",
    "getOpsTemplate": "60/min/user",
}

ERRORS_4XX = {
    "getOpsTemplate": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "運営の会社のひな形に無い id（消した・別の会社の配るもの）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 無いひな形を指したなら、Kaname は 404 を返し、中身を見せない"},
    ],
}

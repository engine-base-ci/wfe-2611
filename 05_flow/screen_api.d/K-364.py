# K-364 AI が使うブラウザを PC ごとに選ぶ口（updateMyDevice・PATCH /api/v1/bridge/devices/:id）
# 体は browser だけ（strict・名前・いつも使う PC は段 4 では作らない・代表の答え answer=0a262be577b2 ③）
INPUTS = {
    "updateMyDevice": ("DeviceBrowserInput", {"browser": "string"}),
}

# 選んだ答えは id と browser だけ（一覧の 1 行の形にしない・K-364）
RESPONSES = {
    "updateMyDevice": ("DeviceBrowser", {"id": "uuid", "browser": "string"}),
}

REQUIRED_INPUTS = {
    "updateMyDevice": ["browser"],   # apps/api/src/features/F3/ai-browser/pick.ts（無い・3 つ以外は 422・欄 browser・K-364）
}

# NFKC と前後の空白を落として chrome・dedicated・off のどれかになる値（enum にすると口が受ける全角を契約の外にしてしまう）
VALUE_RANGES = {
    "updateMyDevice": {"browser": {"pattern": "^\\s*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])\\s*$"}},
}

UNEXPRESSIBLE_422 = {
    "updateMyDevice": ["大文字の値（CHROME など・NFKC で小文字にならない）"],
}

# 選ぶ（K-364・D-128.156・D-128.166）。自分のアカウントの PC でない（他の人の PC・外した PC・消した PC・無い PC）は同じ 404。
#   3 つ以外・知らない欄は 422。DB に書けないときは 503・E-PAGE-003（汎用の 502 の行と同じく失敗の扱い）
ERRORS_4XX = {
    "updateMyDevice": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "自分のアカウントの PC でない（他の人の PC・外した PC・消した PC・無い PC）",
         "ears_form": "UNWANTED: IF 自分のアカウントの PC でないなら、Kaname は 404 と NOT_FOUND を返し、どの PC のブラウザも変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "browser が無い・文字でない・chrome／dedicated／off のどれでもない（NFKC と前後の空白を落とした後）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF browser が 3 つのどれでもないか知らない欄があるなら、Kaname は 422 と欄 browser の理由を返し、PC のブラウザを変えない"},
    ],
}

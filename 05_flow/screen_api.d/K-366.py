# K-366 Bridge の窓でも AI が使うブラウザを選び直せる口（setBridgeBrowser・POST /api/v1/bridge/browser・PC の印）
#   Kaname が正本で、画面（updateMyDevice・K-364）で変えたのと同じ値（sessions.browser）が変わる（D-120・代表の答え answer=0a262be577b2 ②）
SCREEN_API = {
    "bridge-setup": [
        ("POST", "/bridge/browser", "A09", "sessions", "setBridgeBrowser", []),
    ],
}

PERMS = {
    "setBridgeBrowser": ("device", "その人の PC（その PC 自身の AI が使うブラウザだけ。Kaname が正本で、画面で変えたのと同じ値・D-120）", False),
}

# 体は browser だけ（strict・ほかの欄は 422。PC は印で決まるので device_id などは受けない）
INPUTS = {
    "setBridgeBrowser": ("BridgeBrowserInput", {"browser": "string"}),
}

# 選んだ値だけを返す（PC の口の POST は sendHeartbeat と同じ 201）
RESPONSES = {
    "setBridgeBrowser": ("BridgeBrowser", {"browser": "string"}),
}

REQUIRED_INPUTS = {
    "setBridgeBrowser": ["browser"],   # apps/api/src/features/F3/ai-browser/bridge-browser.ts（無い・3 つ以外は 422・欄 browser・K-364 と同じ文）
}

# NFKC と前後の空白を落として chrome・dedicated・off のどれかになる値（K-364 の updateMyDevice と同じ）
VALUE_RANGES = {
    "setBridgeBrowser": {"browser": {"pattern": "^\\s*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])\\s*$"}},
}

UNEXPRESSIBLE_422 = {
    "setBridgeBrowser": ["大文字の値（CHROME など・NFKC で小文字にならない）"],
}

# 選び直す（K-366）。PC の印が無い・知らない・外した（関数が false を返した直後も）は 401。3 つ以外・知らない欄は 422。
#   DB に書けないときは 503・E-PAGE-003（汎用の失敗の行と同じ扱い）
ERRORS_4XX = {
    "setBridgeBrowser": [
        {"status": 401, "code": "UNAUTHENTICATED", "body": {"error": "unauthenticated", "code": "UNAUTHENTICATED"},
         "trigger": "PC の印が無い・知らない・外した PC の印（書く関数が false を返した直後も）",
         "ears_form": "UNWANTED: IF PC の印が無いか知らないか外した PC の印なら、Kaname は 401 と UNAUTHENTICATED を返し、どの PC のブラウザも変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "browser が無い・文字でない・chrome／dedicated／off のどれでもない（NFKC と前後の空白を落とした後）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF browser が 3 つのどれでもないか知らない欄があるなら、Kaname は 422 と欄 browser の理由を返し、PC のブラウザを変えない"},
    ],
}

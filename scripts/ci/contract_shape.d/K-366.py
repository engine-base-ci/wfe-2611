# K-366 Bridge の窓から AI が使うブラウザを選び直す口（setBridgeBrowser）
REQUIRED_INPUTS = {
    "setBridgeBrowser": {"browser"},   # apps/api/src/features/F3/ai-browser/bridge-browser.ts（無い・3 つ以外は 422・欄 browser・K-364 と同じ文）
}

# NFKC と前後の空白を落として chrome・dedicated・off のどれかになる値（05_flow/screen_api.d/K-366.py と同じ）
VALUE_RANGES = {
    "setBridgeBrowser": {"browser": {"pattern": "^\\s*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])\\s*$"}},
}

UNEXPRESSIBLE_422 = {
    "setBridgeBrowser": ["大文字の値（CHROME など・NFKC で小文字にならない）"],
}

# K-364 AI が使うブラウザを PC ごとに選ぶ口（updateMyDevice）
REQUIRED_INPUTS = {
    "updateMyDevice": {"browser"},   # apps/api/src/features/F3/ai-browser/pick.ts（無い・3 つ以外は 422・欄 browser・K-364）
}

# NFKC と前後の空白を落として chrome・dedicated・off のどれかになる値（05_flow/screen_api.d/K-364.py と同じ）
VALUE_RANGES = {
    "updateMyDevice": {"browser": {"pattern": "^\\s*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])\\s*$"}},
}

UNEXPRESSIBLE_422 = {
    "updateMyDevice": ["大文字の値（CHROME など・NFKC で小文字にならない）"],
}

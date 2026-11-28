# K-833 自分を直す口（updateMe）の契約の形の表に足す分（K-325 の断片）。getMe は体を受けない GET なので足す行は無い
NO_REQUIRED_INPUTS = {
    "updateMe": "どの欄も無くてよい（送った欄だけを直す・apps/api/src/features/F10/me/profile.ts）。1 つも欄の無い体は 422（INPUT_RULES の anyOf）。知らない欄は 422（契約の strict）",
}

# apps/api/src/features/F10/me/profile.ts の inputMe（05_flow/screen_api.d/K-833.py と同じ）
VALUE_RANGES = {
    "updateMe": {
        "name": {"pattern": "\\S", "maxLength": 100},   # 長すぎる名前・呼ばれ方は契約の maxLength で先に断る（口は前後の空白と NFKC の後で数える。NFKC で伸びて超える分は UNEXPRESSIBLE_422 のまま）
        "call_name": {"maxLength": 20},
        "language": {"enum": ["ja"]},
        "theme": {"enum": ["system", "light", "dark"]},
        "week_start": {"enum": [0, 1]},
        "timezone": {"enum": ["Asia/Tokyo", "UTC"]},
    },
}

UNEXPRESSIBLE_422 = {
    "updateMe": ["前後の空白・NFKC を除いて 101 文字以上の名前（E-ME-002・文字の数で数える）",
                 "前後の空白・NFKC を除いて 21 文字以上の呼ばれ方（E-ME-003・文字の数で数える）"],
}

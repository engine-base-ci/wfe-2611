# K-353 上書きの口（updateCredential）と消す口（deleteCredential）の契約の形の表に足す分（K-325 の断片）
#   消す口は体を受けない（DELETE）ので、どの表にも載せない（NO_REQUIRED_INPUTS は体を受ける口だけ・K144-SHAPE-020）
NO_REQUIRED_INPUTS = {
    "updateCredential": "どの欄も無くてよい（変える欄だけを送る）。変える物が 1 つも無いときは口が 422 E-CRED-008（features/F3/credentials/update.ts・K-353）",
}
# apps/api/src/features/F3/credentials/update.ts の checkFields（2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "updateCredential": {
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20},
    },
}
UNEXPRESSIBLE_422 = {
    "updateCredential": [
        "使える場所の形（URL・全角を直した後のドメイン・E-CRED-002）と、空の並び（E-CRED-003）",
        "日本の今日より前・暦に無い期限（E-CRED-004）",
        "種類ごとの中身の欠けと混ざり（ログイン情報は login と password を両方・鍵は value だけ・E-CRED-005）・認証アプリの鍵の形と有無（E-VAL-003）",
        "変える物が無い（空・理由だけ・E-CRED-008）",
    ],
}

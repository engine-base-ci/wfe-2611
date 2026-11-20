# K-352 預ける口（createCredential）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F3/credentials/create.ts の check（無ければ 422・使える場所は E-CRED-003）
REQUIRED_INPUTS = {
    "createCredential": {"layer", "kind", "name", "destinations"},
}
# apps/api/src/features/F3/credentials/input.ts（層・種類・2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "createCredential": {
        "layer": {"enum": ["workspace", "personal"]},
        "kind": {"enum": ["login", "key"]},
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20},
        "name": {"pattern": "^[ \\t\\n\\r]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{0,63}[ \\t\\n\\r]*$"},
    },
}
UNEXPRESSIBLE_422 = {
    "createCredential": [
        "使える場所の形（URL・全角を直した後のドメイン・E-CRED-002）",
        "日本の今日より前・暦に無い期限（E-CRED-004）",
        "種類ごとの中身の欠けと混ざり（E-CRED-005）",
        "認証アプリの鍵の形と有無（E-VAL-003）",
    ],
}

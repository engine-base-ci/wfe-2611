# K-353 上書きの口（updateCredential）と消す口（deleteCredential）の契約の形の表に足す分（K-325 の断片）
#   消す口は体を受けない（DELETE）ので、どの表にも載せない（NO_REQUIRED_INPUTS は体を受ける口だけ・K144-SHAPE-020）
NO_REQUIRED_INPUTS = {
    "updateCredential": "どの欄も無くてよい（変える欄だけを送る）。変える物が 1 つも無いときは口が 422 E-CRED-008（features/F3/credentials/update.ts・K-353）",
}
# apps/api/src/features/F3/credentials/update.ts の checkFields（2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "updateCredential": {
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20, "items": _K352_DEST},
        "login": {"pattern": "\S"},
        "password": {"minLength": 1},
        "value": {"minLength": 1},
        "totp_secret": {"pattern": _K352_TOTP},
        "expires_on": {"format": "date"},
    },
}
UNEXPRESSIBLE_422 = {
    "updateCredential": [
        "日本の今日より前の期限（E-CRED-004・日付の形と暦は契約に書いた）",
        "預けた物の種類で決まる中身の混ざり（鍵にログインの欄・ログインに value・2 段階を認証アプリに替える／外すのに中身が無い・E-CRED-005・E-VAL-003）",
    ],
}

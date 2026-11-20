# K-352 預ける口（createCredential）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F3/credentials/create.ts の check（無ければ 422・使える場所は E-CRED-003）
REQUIRED_INPUTS = {
    "createCredential": {"layer", "kind", "name", "destinations"},
}
# 値の決まりの共通の定数（_K352_NAME・_K352_DEST・_K352_TOTP）は 05_flow/screen_api.py と scripts/ci/contract_shape_test.py に在る（口の input.ts の NAME_PATTERN と同じ字）
# apps/api/src/features/F3/credentials/input.ts（層・種類・2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "createCredential": {
        "layer": {"enum": ["workspace", "personal"]},
        "kind": {"enum": ["login", "key"]},
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20, "items": _K352_DEST},
        "name": {"pattern": _K352_NAME},
        "login": {"pattern": "\\S"},
        "password": {"minLength": 1},
        "value": {"minLength": 1},
        "totp_secret": {"pattern": _K352_TOTP},
        "expires_on": {"format": "date"},
    },
}
UNEXPRESSIBLE_422 = {
    "createCredential": [
        "日本の今日より前の期限（E-CRED-004・日付の形と暦は契約に書いた）",
    ],
}

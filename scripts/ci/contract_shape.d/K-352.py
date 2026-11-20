# K-352 預ける口（createCredential）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F3/credentials/create.ts の check（無ければ 422・使える場所は E-CRED-003）
REQUIRED_INPUTS = {
    "createCredential": {"layer", "kind", "name", "destinations"},
}
# 値の決まりの pattern は scripts/ci/credential_patterns.py（_CP）。口は apps/api/src/features/F3/credentials/patterns.ts の同じ字（試験 K352-API-026 が照らす）
# apps/api/src/features/F3/credentials/input.ts（層・種類・2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "createCredential": {
        "layer": {"enum": ["workspace", "personal"]},
        "kind": {"enum": ["login", "key"]},
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20, "items": {"type": "string", "pattern": _CP.DEST}},
        "name": {"pattern": _CP.NAME},
        "login": {"pattern": _CP.LOGIN},
        "password": {"minLength": 1},
        "value": {"minLength": 1},
        "totp_secret": {"pattern": _CP.TOTP},
        "expires_on": {"pattern": _CP.EXPIRES},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES と INPUT_RULES で契約に書いた。今日より前の期限は時刻で決まるので 409（K-383・PM の決め）

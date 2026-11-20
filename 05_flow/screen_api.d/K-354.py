# K-354 PC がログイン情報を取り出す口（resolveCredential・POST /api/v1/bridge/credentials/resolve・PC の印）
# 体は仕事・情報・入れる場所・その回だけの PC の公開の鍵（X25519 の SPKI の DER の base64・44 バイト）。答えは封（RESPONSES は screen_api.py の本体）
INPUTS = {
    "resolveCredential": ("CredentialResolveInput", {"job_id": "uuid", "credential_id": "uuid", "destination": "string", "executor_key": "string"}),
}

# apps/api/src/features/F3/credentials/resolve.ts の parseResolve（無ければ 422）
REQUIRED_INPUTS = {
    "resolveCredential": ["job_id", "credential_id", "destination", "executor_key"],
}

VALUE_RANGES = {
    "resolveCredential": {
        "destination": {"maxLength": 2048},
        "executor_key": {"maxLength": 200},
    },
}

# 契約の形に書けない 422（口が自分で確かめる）
UNEXPRESSIBLE_422 = {
    "resolveCredential": [
        "名前に直せない入れる場所・253 文字を超える名前（入口が字をそろえる前の字で new URL の hostname を取り出す）",
        "X25519 の公開の鍵として読めない executor_key（base64 で 44 バイトの SPKI でない）",
    ],
}

# 取り出し（PC）：外した PC の印（401・入口）・動いていない仕事（403・E-CRED-010）・失効・期限切れ・預かり先が断った／読めない（403・E-CRED-011）・
#   使える場所の外（403・E-CRED-015・持ち主に知らせる）・その PC の仕事でない・情報が無い・持ち主でない（404・在るかを漏らさない）・
#   入力（422）・預かり先に届かない（502・E-SEC-001）・預かり先の上限（503・E-SEC-003）・記録の関数が使えない（503・E-PAGE-003）
ERRORS_4XX = {
    "resolveCredential": [
        {"status": 403, "code": "E-CRED-010", "body": {"error": "gate", "code": "E-CRED-010"}, "errors": ["E-CRED-010"],
         "trigger": "仕事がまだ取られていない・終わった・止まった（running・asking でない）",
         "ears_form": "UNWANTED: IF 仕事が動いていないなら、Kaname は 403 と E-CRED-010 を返し、預かり先から読まず使った記録も残さない"},
        {"status": 403, "code": "E-CRED-011", "body": {"error": "dependency", "code": "E-CRED-011"}, "errors": ["E-CRED-011"],
         "trigger": "失効した・期限が過ぎた・預かり先が断った・預かった中身が読めない（預け直す）",
         "ears_form": "UNWANTED: IF 失効したか期限が過ぎたか預かり先の物が読めないなら、Kaname は 403 と E-CRED-011 を返し、封を返さず使った記録も残さない"},
        {"status": 403, "code": "E-CRED-015", "body": {"error": "gate", "code": "E-CRED-015"}, "errors": ["E-CRED-015"],
         "trigger": "入れる場所の名前が使える場所の外（*. の印は下の名前だけ・名前は入口が字をそろえる前の字で取り出す）",
         "ears_form": "UNWANTED: IF 入れる場所が使える場所の外なら、Kaname は 403 と E-CRED-015 を返し、預かり先から読まず、証跡を残して持ち主に知らせる（同じ情報・同じ場所は 1 時間に 1 つ）"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "その PC の仕事でない（ほかのアカウント）・情報が無い・ほかのワークスペース・消した・確かめの仕事に結んでいない・個人の物を持ち主でない人の仕事で",
         "ears_form": "UNWANTED: IF その PC の仕事でないか、仕事の人が取り出せる情報でないなら、Kaname は 404 を返し、在るかを漏らさず預かり先から読まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "job_id・credential_id・destination・executor_key が無い・名前に直せない入れる場所・253 文字を超える名前・X25519 の公開の鍵でない・本文に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、預かり先から読まず使った記録も残さない"},
        {"status": 502, "code": "E-SEC-001", "body": {"error": "upstream_failed", "code": "E-SEC-001"}, "errors": ["E-SEC-001"],
         "trigger": "預かり先に届かない",
         "ears_form": "UNWANTED: IF 預かり先に届かないなら、Kaname は 502 と E-SEC-001 を返し、封を返さず使った記録も残さない"},
        {"status": 503, "code": "E-SEC-003", "body": {"error": "dependency", "code": "E-SEC-003"}, "errors": ["E-SEC-003"],
         "trigger": "預かり先の上限に当たった（retry_after_sec を付ける）",
         "ears_form": "UNWANTED: IF 預かり先の上限に当たったなら、Kaname は 503 と E-SEC-003 と retry_after_sec を返し、封を返さず使った記録も残さない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "判定・使った記録の DB の関数が使えない",
         "ears_form": "UNWANTED: IF 使った記録を残せないなら、Kaname は 503 と E-PAGE-003 を返し、封を返さない（記録できない取り出しはしない）"},
    ],
}

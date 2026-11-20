# K-352 預ける口（createCredential）
# 預ける（K-352・D-128.57）：名前・預ける先（層）・種類・中身・2 段階の種類・使える場所・期限（strict・ほかの欄は 422）。
#   中身は種類で決まる（login は login と password、key は value だけ）。値は金庫に入れ、答えにも表にも返さない
INPUTS = {
    "createCredential": ("CredentialCreateInput", {"layer": "string", "kind": "string", "name": "string", "description": "string?", "login": "string", "password": "string", "value": "string", "two_factor": "string", "totp_secret": "string", "destinations": "string[]", "expires_on": "string?"}),
}

# 答えの形は一覧（K-351）の 1 件と同じ：名前と使い方だけ。金庫の参照（vault_ref）と値は返さない
RESPONSES = {
    "createCredential": ("Credential", {"id": "uuid", "name": "string", "description": "string?", "layer": "string", "kind": "string", "two_factor": "string", "destinations": "string[]", "expires_on": "string?", "use_count": "integer", "last_used_at": "string?", "login_check": "object", "can_edit": "boolean", "created_at": "string", "updated_at": "string"}),
}

# apps/api/src/features/F3/credentials/create.ts の check（無ければ 422・使える場所は E-CRED-003）
REQUIRED_INPUTS = {
    "createCredential": ["layer", "kind", "name", "destinations"],
}

# apps/api/src/features/F3/credentials/input.ts（層・種類・2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "createCredential": {
        "layer": {"enum": ["workspace", "personal"]},
        "kind": {"enum": ["login", "key"]},
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20},
        "name": {"pattern": "^[A-Z][A-Z0-9_]{0,63}$"},
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

# 預ける（K-352）。権限（403）・本人確認（403）・同じ名前（409）・入力（422）・金庫に置けない（502）・預かれない／混んでいる／Kaname の側（503）
ERRORS_4XX = {
    "createCredential": [
        {"status": 403, "code": "E-CRED-007", "body": {"error": "permission", "code": "E-CRED-007"}, "errors": ["E-CRED-007"],
         "trigger": "ワークスペースに預けるのに、credentials の edit が無い",
         "ears_form": "UNWANTED: IF ワークスペースに預ける権限が無いなら、Kaname は 403 と E-CRED-007 を返し、金庫に置かず行も作らない"},
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無く、ログインからも 15 分を過ぎている",
         "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無く、ログインからも 15 分を過ぎているなら、Kaname は 403 と STEP_UP_REQUIRED を返し、金庫に置かず行も作らない"},
        {"status": 409, "code": "E-CRED-006", "body": {"error": "conflict", "code": "E-CRED-006"}, "errors": ["E-CRED-006"],
         "trigger": "同じ層（ワークスペースの中・自分の物の中）に、消していない・失効していない同じ名前の物がある（同時に預けた負けの方も）",
         "ears_form": "UNWANTED: IF 同じ層に同じ名前の物が預けてあるなら、Kaname は 409 と E-CRED-006 を返し、金庫に物を残さず行も作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-CRED-001", "E-CRED-002", "E-CRED-003", "E-CRED-004", "E-CRED-005", "E-VAL-003"],
         "trigger": "名前の形（E-CRED-001）・使える場所の形と数（E-CRED-002）・使える場所が無い（E-CRED-003）・期限（E-CRED-004）・種類ごとの中身（E-CRED-005）・認証アプリの鍵（E-VAL-003）・層／種類／2 段階の種類が決まった値の外・本文に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、金庫に置かず行も作らない"},
        {"status": 502, "code": "E-SEC-001", "body": {"error": "dependency", "code": "E-SEC-001"}, "errors": ["E-SEC-001"],
         "trigger": "暗号化した中身を預かり先（金庫）に置けなかった",
         "ears_form": "UNWANTED: IF 預かり先に置けなかったなら、Kaname は 502 と E-SEC-001 を返し、行を作らない"},
        {"status": 503, "code": "E-SEC-002", "body": {"error": "dependency", "code": "E-SEC-002"}, "errors": ["E-SEC-002", "E-SEC-003", "E-PAGE-003"],
         "trigger": "staging／本番で消える保管先のまま（E-SEC-002）・預かり先の上限に当たった（E-SEC-003 と retry_after_sec）・判定を読む DB か行を書く DB が落ちた（E-PAGE-003・置いた金庫の物は失効させる）",
         "ears_form": "UNWANTED: IF 預かれない・預かり先が混んでいる・行を書く DB が落ちたなら、Kaname は 503 と E-SEC-002／E-SEC-003／E-PAGE-003 を返し、行を作らず金庫の物を生かしたまま残さない"},
    ],
}

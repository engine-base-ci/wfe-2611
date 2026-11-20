# K-353 上書きの口（updateCredential）と消す口（deleteCredential）
# 上書き（K-353・D-125.151・D-128.57）：新しい値・使える場所・期限・説明・2 段階の種類と、なぜ上書きするか（記録に残る）。strict（名前・層・種類は 422）。
#   中身を変えるときは、ログイン情報は login と password を両方（認証アプリなら totp_secret も）、鍵は value。値は金庫に入れ、答えにも表にも返さない
INPUTS = {
    "updateCredential": ("CredentialUpdateInput", {"login": "string", "password": "string", "value": "string", "two_factor": "string", "totp_secret": "string", "destinations": "string[]", "expires_on": "string?", "description": "string?", "reason": "string"}),
}

# 上書きの答えは一覧（K-351）の 1 件と同じ形。消すの答えは id だけ
RESPONSES = {
    "updateCredential": ("Credential", {"id": "uuid", "name": "string", "description": "string?", "layer": "string", "kind": "string", "two_factor": "string", "destinations": "string[]", "expires_on": "string?", "use_count": "integer", "last_used_at": "string?", "login_check": "object", "can_edit": "boolean", "created_at": "string", "updated_at": "string"}),
    "deleteCredential": ("CredentialDeleted", {"id": "uuid"}),
}

# apps/api/src/features/F3/credentials/update.ts の checkFields（2 段階の種類は決まった値だけ・使える場所は 1〜20 個）
VALUE_RANGES = {
    "updateCredential": {
        "two_factor": {"enum": ["none", "totp", "sms", "email", "push"]},
        "destinations": {"minItems": 1, "maxItems": 20, "items": {"type": "string", "pattern": _CP.DEST}, "description": "契約の pattern に合っても、互換形で書いた公開の接尾辞だけ（ᶜo.jp・ⓒⓞ.jp など）は 422・E-CRED-002 で断る（預けた物がどこでも使えてしまうのを防ぐ守り・K-383）"},
        "login": {"pattern": _CP.LOGIN},
        "password": {"minLength": 1},
        "value": {"minLength": 1},
        "totp_secret": {"pattern": _CP.TOTP},
        "expires_on": {"pattern": _CP.EXPIRES},
    },
}

# 形全体の決まり（INPUT_RULES）：変える物が 1 つは要る（E-CRED-008）。中身は、何も替えない・login と password を両方・value だけ、のどれか（E-CRED-005）
_K353_NO_CONTENT = {"anyOf": [{"required": [x]} for x in ("login", "password", "value", "totp_secret")]}
INPUT_RULES = {
    "updateCredential": {"allOf": [
        {"anyOf": [{"required": [x]} for x in ("login", "password", "value", "two_factor", "totp_secret", "destinations", "expires_on", "description")]},
        {"anyOf": [
            {"not": _K353_NO_CONTENT},
            {"required": ["login", "password"], "not": {"required": ["value"]}},
            {"required": ["value"], "not": {"anyOf": [{"required": [x]} for x in ("login", "password", "two_factor", "totp_secret")]}},
        ]},
    ]},
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES と INPUT_RULES で契約に書いた。今日より前の期限・預けた物の種類で決まる混ざりは 409（K-383・PM の決め）

# 上書き：権限（403）・本人確認（403）・見えない（404）・ぶつかった（409）・入力（422）・金庫に置けない（502）・預かれない／混んでいる／Kaname の側（503）
# 消す：権限（403）・見えない（404）・Kaname の側（503）
ERRORS_4XX = {
    "updateCredential": [
        {"status": 403, "code": "E-CRED-007", "body": {"error": "permission", "code": "E-CRED-007"}, "errors": ["E-CRED-007"],
         "trigger": "ワークスペースの物を上書きするのに、credentials の edit が無い",
         "ears_form": "UNWANTED: IF ワークスペースの物を直す権限が無いなら、Kaname は 403 と E-CRED-007 を返し、金庫に置かず行も変えない"},
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無く、ログインからも 15 分を過ぎている",
         "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無く、ログインからも 15 分を過ぎているなら、Kaname は 403 と STEP_UP_REQUIRED を返し、金庫に置かず行も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "他人の個人の物・別の会社の物・消した物・失効しただけの物・無い id（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない物・消した物・失効した物を上書きしようとしたなら、Kaname は 404 を返し、金庫に置かず行も変えない"},
        {"status": 409, "code": "E-CRED-009", "body": {"error": "conflict", "code": "E-CRED-009"}, "errors": ["E-CRED-009"],
         "trigger": "同じ物の中身を、ほかの画面が先に上書きした（値の入れ替えがぶつかった）",
         "ears_form": "UNWANTED: IF 同じ物の中身をほかの画面が先に上書きしたなら、Kaname は 409 と E-CRED-009 を返し、置いた金庫の物を失効させて行は先の上書きのままにする"},
        {"status": 409, "code": "E-CRED-004", "body": {"error": "conflict", "code": "E-CRED-004"}, "errors": ["E-CRED-004"],
         "trigger": "期限が日本の今日より前（時刻で決まる）",
         "ears_form": "UNWANTED: IF 期限が日本の今日より前なら、Kaname は 409 と E-CRED-004 を返し、金庫に置かず行も変えない"},
        {"status": 409, "code": "E-CRED-015", "body": {"error": "conflict", "code": "E-CRED-015"}, "errors": ["E-CRED-015"],
         "trigger": "預けた物の種類や 2 段階の状態と合わない中身（鍵にログインの欄・ログインに value・2 段階を認証アプリに替える／外すのに中身が無い・認証アプリの鍵の有無が合わない）",
         "ears_form": "UNWANTED: IF 預けた物の種類や 2 段階の状態と合わない中身なら、Kaname は 409 と E-CRED-015 を返し、金庫に置かず行も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-CRED-002", "E-CRED-003", "E-CRED-005", "E-CRED-008", "E-VAL-003"],
         "trigger": "使える場所の形と数（E-CRED-002）・空の並び（E-CRED-003）・期限の形（暦に無い・年-月-日でない）・中身の欠け（E-CRED-005）・変える物が無い（E-CRED-008）・認証アプリの鍵（E-VAL-003）・2 段階の種類が決まった値の外・名前／層／種類や知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、金庫に置かず行も変えない"},
        {"status": 502, "code": "E-SEC-001", "body": {"error": "dependency", "code": "E-SEC-001"}, "errors": ["E-SEC-001"],
         "trigger": "新しい中身を預かり先（金庫）に置けなかった",
         "ears_form": "UNWANTED: IF 新しい中身を預かり先に置けなかったなら、Kaname は 502 と E-SEC-001 を返し、行は前の中身のままにする"},
        {"status": 503, "code": "E-SEC-002", "body": {"error": "dependency", "code": "E-SEC-002"}, "errors": ["E-SEC-002", "E-SEC-003", "E-PAGE-003"],
         "trigger": "staging／本番で消える保管先のまま（E-SEC-002）・預かり先の上限に当たった（E-SEC-003 と retry_after_sec）・行を読む DB か行を書く DB が落ちた（E-PAGE-003・置いた金庫の物は失効させる）",
         "ears_form": "UNWANTED: IF 預かれない・預かり先が混んでいる・行を書く DB が落ちたなら、Kaname は 503 と E-SEC-002／E-SEC-003／E-PAGE-003 を返し、行は前の中身のままにして新しい金庫の物を生かしたまま残さない"},
    ],
    "deleteCredential": [
        {"status": 403, "code": "E-CRED-007", "body": {"error": "permission", "code": "E-CRED-007"}, "errors": ["E-CRED-007"],
         "trigger": "ワークスペースの物を消すのに、credentials の edit が無い",
         "ears_form": "UNWANTED: IF ワークスペースの物を消す権限が無いなら、Kaname は 403 と E-CRED-007 を返し、行も金庫も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "他人の個人の物・別の会社の物・消した物・失効しただけの物・無い id（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない物・消した物・失効した物を消そうとしたなら、Kaname は 404 を返し、行も金庫も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "行を消す DB が落ちた",
         "ears_form": "UNWANTED: IF 行を消す DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、行も金庫も変えない"},
    ],
}

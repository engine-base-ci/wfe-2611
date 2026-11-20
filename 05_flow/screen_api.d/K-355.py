# K-355 預けた後のログインの確かめの口（checkCredentialLogin・answerCredentialLoginCheck・reportCredentialCheck）
# 頼みの印の欄は request_ref（代表の答え answer=cf9e0174b6fb：*_id は DB の行の id だけ。値は Claude の CLI の control_request の request_id をそのまま）
# もう一度確かめる（本人・体は空）・頼まれたコードに答える（本人・code と approved のどちらか 1 つ）・PC が途中と結果を知らせる（PC の印）
INPUTS = {
    "checkCredentialLogin": ("CredentialLoginCheckInput", {}),
    "answerCredentialLoginCheck": ("CredentialLoginAnswerInput", {"request_ref": "string", "code": "string", "approved": "boolean"}),
    "reportCredentialCheck": ("CredentialCheckReportInput", {"job_id": "uuid", "state": "string", "detail": "string", "request_ref": "string", "ask_kind": "string", "text": "string"}),
}

# 確かめの結果（pending・no_pc・forbidden・no_target）は誤りでなく 201。PC への答えの code は、本人が答えたコードを 1 回だけ渡す（無ければ null）
RESPONSES = {
    "checkCredentialLogin": ("CredentialLoginCheck", {"state": "string", "job_id": "uuid?"}),
    "answerCredentialLoginCheck": ("CredentialLoginAnswer", {"accepted": "boolean"}),
    "reportCredentialCheck": ("CredentialCheckReport", {"accepted": "boolean", "code": "string?"}),
}

# apps/api/src/features/F3/credentials/login-check.ts の parseAnswer・parseReport（無ければ 422）
REQUIRED_INPUTS = {
    "answerCredentialLoginCheck": ["request_ref"],
    "reportCredentialCheck": ["job_id", "state"],
}

# apps/api/src/features/F3/credentials/login-check.ts（state は 11 種・detail は 400 字・text は 300 字・ask_kind は code か approve・request_ref は 100 字まで）
VALUE_RANGES = {
    "answerCredentialLoginCheck": {
        "request_ref": {"maxLength": 100},
    },
    "reportCredentialCheck": {
        "state": {"enum": ["ok", "bad_password", "needs_2fa", "bad_code", "captcha", "unreachable", "no_form", "stopped", "no_answer", "asking", "waiting"]},
        "detail": {"maxLength": 400},
        "text": {"maxLength": 300},
        "ask_kind": {"enum": ["code", "approve"]},
        "request_ref": {"maxLength": 100},
    },
}

UNEXPRESSIBLE_422 = {
    "answerCredentialLoginCheck": [
        "code と approved の両方・どちらも無い（VALIDATION_ERROR・欄 code）",
        "NFKC と空白・ハイフンを落として空か 64 文字を超えるコード（E-VAL-009）",
    ],
    "reportCredentialCheck": [
        "asking・waiting で request_ref が無い（VALIDATION_ERROR・欄 request_ref）",
    ],
}

# 確かめる（本人）：無い・ほかの人の物・消した物（404）・確かめている最中／API キー／失効・期限切れ（409）・関数が落ちた（503）
#   答える（本人）：無い・ほかの人の物（404）・頼まれていない（404・E-CRED-014）・入力（422）・関数が落ちた（503）
#   知らせる（PC）：外した PC の印（401）・ほかの PC の仕事・違う情報・確かめでない仕事（404）・終わった仕事（409・E-CRED-010）・入力（422）・関数が落ちた（503）
ERRORS_4XX = {
    "checkCredentialLogin": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "預けたログイン情報が無い・消した・本人（預けた人）の物でない（ワークスペースの物も預けた人だけ）",
         "ears_form": "UNWANTED: IF 本人が預けた物でないなら、Kaname は 404 を返し、在るかを漏らさず確かめの仕事を積まない"},
        {"status": 409, "code": "E-CRED-012", "body": {"error": "conflict", "code": "E-CRED-012"}, "errors": ["E-CRED-012"],
         "trigger": "同じ物の確かめの仕事が待ち・動いている・コード待ち",
         "ears_form": "UNWANTED: IF いま確かめているなら、Kaname は 409 と E-CRED-012 を返し、仕事を増やさない"},
        {"status": 409, "code": "E-CRED-013", "body": {"error": "conflict", "code": "E-CRED-013"}, "errors": ["E-CRED-013"],
         "trigger": "API キー・値（ログインでない物）",
         "ears_form": "UNWANTED: IF ログインでない物なら、Kaname は 409 と E-CRED-013 を返し、確かめの仕事を積まない"},
        {"status": 409, "code": "E-CRED-011", "body": {"error": "dependency", "code": "E-CRED-011"}, "errors": ["E-CRED-011"],
         "trigger": "失効した・期限が過ぎた",
         "ears_form": "UNWANTED: IF 失効したか期限が過ぎたなら、Kaname は 409 と E-CRED-011 を返し、確かめの仕事を積まない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "確かめを積む DB の関数が使えない",
         "ears_form": "UNWANTED: IF 確かめを積めないなら、Kaname は 503 と E-PAGE-003 を返し、仕事も行の状態も変えない"},
    ],
    "answerCredentialLoginCheck": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "預けたログイン情報が無い・消した・本人（預けた人）の物でない",
         "ears_form": "UNWANTED: IF 本人が預けた物でないなら、Kaname は 404 を返し、答えの行を作らない"},
        {"status": 404, "code": "E-CRED-014", "body": {"error": "not_found", "code": "E-CRED-014"}, "errors": ["E-CRED-014"],
         "trigger": "その頼み（request_ref）を PC が出していない・確かめが終わった・止まった",
         "ears_form": "UNWANTED: IF いまコードを頼まれていないなら、Kaname は 404 と E-CRED-014 を返し、答えの行を作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-009"],
         "trigger": "code と approved の両方・どちらも無い・request_ref が無いか 100 字を超える・コードが空か 64 字を超える（E-VAL-009）・本文に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、答えの行を作らない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "答えを置く DB の関数が使えない",
         "ears_form": "UNWANTED: IF 答えを置けないなら、Kaname は 503 と E-PAGE-003 を返し、答えの行も仕事の段も変えない"},
    ],
    "reportCredentialCheck": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "ほかの PC が取った仕事・ほかのアカウントの仕事・道の id と仕事の情報が違う・確かめでない仕事",
         "ears_form": "UNWANTED: IF その PC の確かめの仕事でないなら、Kaname は 404 を返し、行も仕事も変えない"},
        {"status": 409, "code": "E-CRED-010", "body": {"error": "gate", "code": "E-CRED-010"}, "errors": ["E-CRED-010"],
         "trigger": "仕事がもう終わった・止まった（動いていない）",
         "ears_form": "UNWANTED: IF 仕事が動いていないなら、Kaname は 409 と E-CRED-010 を返し、行を変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "知らない state・401 字以上の detail・301 字以上の text・asking と waiting で request_ref が無い・ask_kind が code／approve でない・本文に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、行も仕事も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "結果を書く DB の関数が使えない",
         "ears_form": "UNWANTED: IF 結果を書けないなら、Kaname は 503 と E-PAGE-003 を返し、行・仕事・証跡を変えない（PC は次の問い合わせでもう一度送れる）"},
    ],
}

# K-835 メールを変える口（requestEmailChange・verifyEmailChange・D-154.12・D-154.18・D-154.58）
# 頼む：新しい宛て（strict・ほかの欄は 422）。そろえる前の宛ては scripts/ci/invite_patterns.py の EMAIL と同じ字（口は apps/api/src/features/F10/me/email.ts の inputEmailChange）
# 確かめる：メールのリンクの印（1〜200 字・strict）
import invite_patterns as _IP  # 宛ての pattern（口は apps/api/src/features/F10/invite/patterns.ts と同じ字）
INPUTS = {
    "requestEmailChange": ("EmailChangeInput", {"email": "string"}),
    "verifyEmailChange": ("EmailChangeVerifyInput", {"token": "string"}),
}

# 頼んだ答え：そろえた宛てと、リンクの期限（24 時間後）。リンクの印は答えに出さない（メールの本文にだけ在る）
# 確かめた答え：変わった印と、新しいログインのメール
RESPONSES = {
    "requestEmailChange": ("EmailChangeRequested", {"pending_email": "string", "expires_at": "string"}),
    "verifyEmailChange": ("EmailChanged", {"changed": "boolean", "email": "string"}),
}

REQUIRED_INPUTS = {
    "requestEmailChange": ["email"],
    "verifyEmailChange": ["token"],
}

VALUE_RANGES = {
    "requestEmailChange": {"email": {"maxLength": 254, "pattern": _IP.EMAIL}},
    "verifyEmailChange": {"token": {"minLength": 1, "maxLength": 200}},
}

UNEXPRESSIBLE_422: dict = {}   # 宛ての形（E-ME-020）は VALUE_RANGES の pattern で契約に書いた（口の前処理が同じ字で先に断る）

# 頼む：形（422 E-ME-020）・今のメールと同じ（409 E-ME-026）・ほかのアカウントが使っている（409 E-ME-021）・頼みすぎ（429 E-ME-024）・送れない（502 E-ME-025）
# 確かめる：使えない（409 E-PAGE-006）・使った（409 E-ME-023）・期限切れ（409 E-ME-022）・その間に取られた（409 E-ME-021）
ERRORS_4XX = {
    "requestEmailChange": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、メールも待っている変更も作らない"},
        {"status": 422, "code": "E-ME-020", "body": {"error": "validation", "code": "E-ME-020", "details": []}, "errors": ["E-ME-020"],
         "trigger": "メールの形でない宛て（空・@ だけ・ドットの無いドメイン・255 字以上）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 宛てがメールの形でないなら、Kaname は 422 と E-ME-020（欄 email）を返し、メールも待っている変更も作らない"},
        {"status": 409, "code": "E-ME-026", "body": {"error": "conflict", "code": "E-ME-026"}, "errors": ["E-ME-026", "E-ME-021"],
         "trigger": "今のログインのメールと同じ（E-ME-026）・ほかのアカウントが使っている（E-ME-021・ほかの会社の人も）",
         "ears_form": "UNWANTED: IF 宛てが今のメールと同じか、ほかのアカウントが使っているなら、Kaname は 409 と E-ME-026／E-ME-021 を返し、メールも待っている変更も作らない"},
        {"status": 429, "code": "E-ME-024", "body": {"error": "rate_limited", "code": "E-ME-024"}, "errors": ["E-ME-024"],
         "trigger": "直近 1 時間にもう 5 回頼んだ",
         "ears_form": "UNWANTED: IF 直近 1 時間にもう 5 回頼んでいるなら、Kaname は 429 と E-ME-024 を返し、メールを送らない"},
        {"status": 502, "code": "E-ME-025", "body": {"error": "dependency", "code": "E-ME-025"}, "errors": ["E-ME-025"],
         "trigger": "確かめのメールを送れなかった（待っている変更は取り消す）",
         "ears_form": "UNWANTED: IF 確かめのメールを送れなかったなら、Kaname は 502 と E-ME-025 を返し、待っている変更を残さない"},
    ],
    "verifyEmailChange": [
        {"status": 409, "code": "E-PAGE-006", "body": {"error": "conflict", "code": "E-PAGE-006"}, "errors": ["E-PAGE-006", "E-ME-021", "E-ME-022", "E-ME-023"],
         "trigger": "リンクが無い・取り消された・別のログインの物（E-PAGE-006）・その間に宛てがほかの人に使われた（E-ME-021）・期限切れ（E-ME-022）・もう使った（E-ME-023）",
         "ears_form": "UNWANTED: IF リンクが使えないか期限切れかもう使ったか、宛てがほかの人に使われたなら、Kaname は 409 と番号を返し、ログインのメールを変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "リンクの印が空・201 字以上・知らない欄（strict）",
         "ears_form": "UNWANTED: IF リンクの印が空か 200 字を超えるなら、Kaname は 422 を返し、ログインのメールを変えない"},
    ],
}

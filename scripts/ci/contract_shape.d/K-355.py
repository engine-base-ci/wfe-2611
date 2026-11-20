# K-355 預けた後のログインの確かめの口の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F3/credentials/login-check.ts の parseAnswer・parseReport（無ければ 422）
REQUIRED_INPUTS = {
    "answerCredentialLoginCheck": {"request_ref"},
    "reportCredentialCheck": {"job_id", "state"},
}
NO_REQUIRED_INPUTS = {
    "checkCredentialLogin": "体は空（確かめる物は道の id・本人は印から）",
}
VALUE_RANGES = {
    "answerCredentialLoginCheck": {
        "request_ref": {"pattern": "\\S", "maxLength": 100},
        "code": {"pattern": f"^[{CODE_SEP}]*(?:[0-9A-Za-z０-９Ａ-Ｚａ-ｚ][{CODE_SEP}]*){{1,64}}$"},
        "approved": {"enum": [True]},
    },
    "reportCredentialCheck": {
        "state": {"enum": ["ok", "bad_password", "needs_2fa", "bad_code", "captcha", "unreachable", "no_form", "stopped", "no_answer", "asking", "waiting"]},
        "detail": {"maxLength": 400},
        "text": {"maxLength": 300},
        "ask_kind": {"enum": ["code", "approve"]},
        "request_ref": {"pattern": "\\S", "maxLength": 100},
    },
}
UNEXPRESSIBLE_422 = {
    "answerCredentialLoginCheck": [
        "code と approved の両方・どちらも無い（VALIDATION_ERROR・欄 code）",
    ],
    "reportCredentialCheck": [
        "asking・waiting で request_ref が無い（VALIDATION_ERROR・欄 request_ref）",
    ],
}

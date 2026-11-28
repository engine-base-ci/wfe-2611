# K-365 もう一度確かめる仕事をその PC に宛てる口（checkMyDeviceBrowser・POST /api/v1/bridge/devices/:id/browser-check）
SCREEN_API = {
    "bridge-setup": [
        ("POST", "/bridge/devices/:id/browser-check", "A09", "bridge_jobs", "checkMyDeviceBrowser", ["sessions"]),
    ],
}

# 体は空の形（strict・知らない欄は 422）。確かめの文は口が決まった 1 つ（BROWSER_CHECK_PROMPT）を使い、画面から入れさせない
INPUTS = {
    "checkMyDeviceBrowser": ("DeviceBrowserCheckInput", {}),
}

# 積んだ仕事の id だけ（確かめの文・PC の印は返さない・K-365）
RESPONSES = {
    "checkMyDeviceBrowser": ("DeviceBrowserCheck", {"job_id": "uuid"}),
}

# 確かめは本人のサブスクを少し使うので 1 分 10 回（K-365）
RATES = {
    "checkMyDeviceBrowser": "10/min/user",
}

PERMS = {
    "checkMyDeviceBrowser": ("self", "自分のアカウントの PC だけ。その PC に宛てた確かめの仕事を 1 つ積む（本人のサブスクを少し使うので 1 分 10 回）", False),
}

# もう一度確かめる（K-365・D-120・D-128.156・D-128.166）。自分のアカウントの PC でない（他の人の PC・外した PC・消した PC・無い PC）は同じ 404。
#   眠っている・返事がまだの PC は 409（目録の where.state が browser_check_asleep）。知らない欄・:id が uuid でないは 422。
#   DB に積めないときは 503・E-PAGE-003（汎用の失敗の行と同じ）
ERRORS_4XX = {
    "checkMyDeviceBrowser": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "自分のアカウントの PC でない（他の人の PC・外した PC・消した PC・無い PC）",
         "ears_form": "UNWANTED: IF 自分のアカウントの PC でないなら、Kaname は 404 と NOT_FOUND を返し、確かめの仕事を積まない"},
        {"status": 409, "code": "E-CONN-018", "body": {"error": "conflict", "code": "E-CONN-018"}, "errors": ["E-CONN-018"],
         "trigger": "PC の Bridge が動いていない（返事がまだ・最後の知らせが 75 秒より前）",
         "ears_form": "UNWANTED: IF PC の Bridge が動いていない（状態 browser_check_asleep）なら、Kaname は 409 と E-CONN-018 を返し、確かめの仕事を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない欄がある（prompt など・strict）・:id が uuid でない",
         "ears_form": "UNWANTED: IF 体に知らない欄があるか :id が uuid でないなら、Kaname は 422 を返し、確かめの仕事を積まない"},
    ],
}

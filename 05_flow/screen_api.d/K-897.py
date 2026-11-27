# K-897 PC の側が案を返す口（reportClientRequestDraft）
#   道の :id は仕事の id・PC の印で叩く。体は draft か failed のちょうど 1 つ（strict）
#   その PC が受け取った・案の種類の・動いている仕事でなければ 404・E-GST-150（在るかを漏らさない）
#   依頼が決まった・押し直された仕事の結果は 200 discarded（案は保存しない）
SCREEN_API = {
    "bridge-setup": [
        ("POST", "/bridge/jobs/:id/client-request-draft", "A122", "bridge_jobs", "reportClientRequestDraft", ["client_requests", "audit_events"]),
    ],
}

PERMS = {
    "reportClientRequestDraft": ("device", "PC の印だけ。自分の PC が取った案の仕事の結果だけ返せる", False),
}

INPUTS = {
    "reportClientRequestDraft": ("ClientRequestDraftResultInput", {"draft": "object?", "failed": "string?"}),
}

INPUT_RULES = {
    "reportClientRequestDraft": {"oneOf": [{"required": ["draft"]}, {"required": ["failed"]}]},
}

RESPONSES = {
    "reportClientRequestDraft": ("ClientRequestDraftResult", {"state": "string"}),
}

ERRORS_4XX = {
    "reportClientRequestDraft": [
        {"status": 401, "code": "UNAUTHENTICATED", "body": {"error": "unauthenticated", "code": "UNAUTHENTICATED"},
         "trigger": "PC の印が無い・形の違う印・失効した PC の印",
         "ears_form": "UNWANTED: IF PC の印が無いか失効しているなら、Kaname は 401 を返し、何も書かない"},
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "画面のログインの人・ゲストの文脈（PC の印でない）",
         "ears_form": "UNWANTED: IF PC の印でない人が結果を返そうとしたなら、Kaname は 403 を返し、何も書かない"},
        {"status": 404, "code": "E-GST-150", "body": {"error": "not_found", "code": "E-GST-150"}, "errors": ["E-GST-150"],
         "trigger": "仕事が無い・この PC が受け取った物でない・案の仕事でない・動いていない（待っている・もう終わった）（在るかを漏らさない・欄と details なし）",
         "ears_form": "UNWANTED: IF この PC が受け取った動いている案の仕事でないなら、Kaname は 404 と E-GST-150 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "draft と failed の両方・どちらも無い・案の形・長さ・日付が決まりに合わない・知らない欄・failed が空か 401 字以上",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
}

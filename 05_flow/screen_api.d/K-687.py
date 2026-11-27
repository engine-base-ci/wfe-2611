# K-687 上の棚に上げる：頼む・取り下げる・断りの帯を消す（requestKnowledgeRaise・withdrawKnowledgeRequest・dismissKnowledgeRequest）の契約の宣言
#   名前の正本は 07_functional/段10-F9/土台-knowledge.md の 2・3・4 章（決め切れていない所は 11_tickets/K-687.md が決める）
#   頼みの表 knowledge_requests はこの葉が作る。頼みの :id の口は入口で行を読まない（row_rules.mjs の ROW_EXEMPT）
#   口の振る舞いは持ち主の葉（apps/api/src/features/F9/knowledge/ops.ts の表 → hooks/f9-knowledge-raise.ts）が作る

SCREEN_API = {
    "knowledge": [
        ("POST", "/knowledge_pages/:id/raise", "A136", "knowledge_requests", "requestKnowledgeRaise", ["knowledge_pages", "knowledge_folders", "notifications"]),
        ("DELETE", "/knowledge/requests/:id", "A136", "knowledge_requests", "withdrawKnowledgeRequest", ["notifications"]),
        ("POST", "/knowledge/requests/:id/dismiss", "A136", "knowledge_requests", "dismissKnowledgeRequest", ["notifications"]),
    ],
}

# 入力は口ごとの専用の形（知らない欄は 422・strict）。自分の棚のページの group_id が要るは 409 E-KNW-101（契約に書けない 422 を足さない）
INPUTS = {
    "requestKnowledgeRaise": ("KnowledgeRaiseInput", {"group_id": "uuid?", "folder_id": "uuid?", "message": "string?"}),
    "dismissKnowledgeRequest": ("KnowledgeDismissInput", {}),
}

VALUE_RANGES = {
    "requestKnowledgeRaise": {"message": {"maxLength": 1000}},
}

RESPONSES = {
    "requestKnowledgeRaise": ("KnowledgeRequest", {"id": "uuid", "kind": "string", "state": "string", "page_id": "uuid", "to_name": "string", "at": "string"}),
    "withdrawKnowledgeRequest": ("KnowledgeRequestEnded", {"id": "uuid", "state": "string"}),
    "dismissKnowledgeRequest": ("KnowledgeRequestEnded", {"id": "uuid", "state": "string"}),
}

# 取り下げる・帯を消すは新しい物を作らない（状態を替えるだけ）：200
SUCCESS_STATUS = {
    "dismissKnowledgeRequest": 200,
}

RATES = {
    "requestKnowledgeRaise": "60/min/user",
    "withdrawKnowledgeRequest": "60/min/user",
    "dismissKnowledgeRequest": "60/min/user",
}

# 権限の言葉は「社内の人」までしか見ない。頼める・取り下げられるは DB の関数が決める（見えない物は 404・見えて頼めないは 403）
PERMS = {
    "requestKnowledgeRaise": ("write", "そのページに書ける人（app.kpage_writable）。先の棚と承認する人は app.kn_raise_request が決める", False),
    "withdrawKnowledgeRequest": ("write", "頼んだ人だけ（app.kn_request_visible で 404・app.kn_request_end で 403）", False),
    "dismissKnowledgeRequest": ("write", "頼んだ人だけ（断られた頼みの帯を消す・app.kn_request_end）", False),
}

# 断り（土台 4 章・K-687 の断りの一覧）
_403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}
_404 = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
_422 = {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": []}
_503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
        "trigger": "頼みを書く・読む DB の問い合わせが落ちた（想定外の例外・取引が落ちた）",
        "ears_form": "UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない"}


def _r(base: dict, trigger: str, ears: str) -> dict:
    return {**base, "trigger": trigger, "ears_form": ears}


def _c(code: str, trigger: str) -> dict:
    return {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code], "trigger": trigger,
            "ears_form": f"UNWANTED: IF {trigger}なら、Kaname は 409 と {code} を返し、頼みもお知らせもページも変えない"}


_NF_REQ = _r(_404, "頼みが無い・見えない・別の会社の物（在るかを漏らさない）",
             "UNWANTED: IF 頼みが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない")
_FB_REQ = _r(_403, "頼みは見えるが頼んだ人でない（承認する人・ページを読める人）",
             "UNWANTED: IF 頼んだ人でないなら、Kaname は 403 を返し、何も変えない")

ERRORS_4XX = {
    "requestKnowledgeRaise": [
        _r(_403, "ページは見えるが書けない（その棚に書けない人）", "UNWANTED: IF ページに書けない人なら、Kaname は 403 を返し、頼みを作らない"),
        _r(_404, "ページ・上げる先のグループ・入れるフォルダが無い・見えない・消した・別の会社の物",
           "UNWANTED: IF ページか上げる先が無いか見えないなら、Kaname は 404 を返し、頼みを作らない"),
        _c("E-KNW-010", "ページがまだ書き終わっていない（下書きだけ）"),
        _c("E-KNW-011", "上げる・共有する頼みが承認待ち"),
        _c("E-KNW-100", "ページが会社の棚にあり、これより上の棚が無い"),
        _c("E-KNW-101", "自分の棚のページで上げる先のグループを選んでいない"),
        _c("E-KNW-102", "上げる先に承認できる人がいない"),
        _c("E-KNW-103", "入れるフォルダが上げる先の棚に無い"),
        _c("E-KNW-106", "ページ（か上のフォルダ）をほかのグループに共有している"),
        _r(_422, "ひとことが 1,000 字を超える・group_id・folder_id が uuid でない・体に知らない欄（strict）",
           "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、頼みを作らない"),
        _503,
    ],
    "withdrawKnowledgeRequest": [_FB_REQ, _NF_REQ, _c("E-KNW-104", "頼みがもう決まっている（承認・断り・取り下げ済み）"), _503],
    "dismissKnowledgeRequest": [_FB_REQ, _NF_REQ, _c("E-KNW-105", "断られた頼みの帯でない（承認待ち・承認済み・取り下げ済み・もう消した）"),
                                _r(_422, "体に知らない欄（strict）", "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、何も変えない"), _503],
}

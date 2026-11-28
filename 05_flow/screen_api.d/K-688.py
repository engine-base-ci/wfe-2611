# K-688 承認待ちを読む・承認する・断る（listKnowledgeApprovals・approveKnowledgeRequest・declineKnowledgeRequest）の契約の宣言
#   名前の正本は 07_functional/段10-F9/土台-knowledge.md の 2・3・4 章と K-687 の md（表 knowledge_requests の列）
#   承認する人＝先がグループならそのグループのマネージャー・先が会社なら管理者（app.kn_approvers_of・K-687）。決めるのは DB の関数 app.kn_request_decide
#   頼みの :id の口は入口で行を読まない（row_rules.mjs の ROW_EXEMPT・K-687 が足した 1 行）

SCREEN_API = {
    "knowledge": [
        ("GET", "/knowledge/approvals", "A136", "knowledge_requests", "listKnowledgeApprovals", ["knowledge_pages", "knowledge_folders"]),
        ("POST", "/knowledge/requests/:id/approve", "A136", "knowledge_requests", "approveKnowledgeRequest", ["knowledge_pages", "notifications"]),
        ("POST", "/knowledge/requests/:id/decline", "A136", "knowledge_requests", "declineKnowledgeRequest", ["notifications"]),
    ],
}

# 入力は口ごとの専用の形（知らない欄は 422・strict）
INPUTS = {
    "approveKnowledgeRequest": ("KnowledgeApproveInput", {}),
    "declineKnowledgeRequest": ("KnowledgeDeclineInput", {"reason": "string"}),
}

REQUIRED_INPUTS = {
    "declineKnowledgeRequest": ["reason"],
}

VALUE_RANGES = {
    "declineKnowledgeRequest": {"reason": {"pattern": "\\S", "maxLength": 1000}},
}

RESPONSES = {
    "listKnowledgeApprovals": ("KnowledgeApproval", {"id": "uuid", "kind": "string", "from_name": "string", "from_shelf_name": "string", "to_shelf_name": "string", "title": "string", "desc": "string", "message": "string?", "requested_at": "string", "similar": "object?", "body": "object?"}),
    "approveKnowledgeRequest": ("KnowledgeRequestDecided", {"id": "uuid", "kind": "string", "state": "string", "page_id": "uuid?", "folder_id": "uuid?"}),
    "declineKnowledgeRequest": ("KnowledgeRequestDecided", {"id": "uuid", "kind": "string", "state": "string", "page_id": "uuid?", "folder_id": "uuid?"}),
}

# 承認する・断るは新しい物を作らない（頼みの状態を替えるだけ）：200
SUCCESS_STATUS = {
    "approveKnowledgeRequest": 200,
    "declineKnowledgeRequest": 200,
}

# 承認待ちの一覧は並べ替え・絞り込みを受けない（新しい順に 50 行で切る）
QUERIES = {
    "listKnowledgeApprovals": [],
}
LIST_DETAILS = {
    "listKnowledgeApprovals": {"sort": False, "limit_max": 50, "desc": "取得（knowledge_requests）— 自分が承認できる承認待ちを新しい順に見る", "meta": "{ count }"},
}
META = {
    "listKnowledgeApprovals": {"count": {"type": "integer"}},
}

RATES = {
    "listKnowledgeApprovals": "120/min/user",
    "approveKnowledgeRequest": "60/min/user",
    "declineKnowledgeRequest": "60/min/user",
}

PERMS = {
    "listKnowledgeApprovals": ("self", "承認できる人（管理者・どれかのグループのマネージャー）だけ。行は自分が承認する承認待ちだけ（app.kn_approval_rows）", False),
    "approveKnowledgeRequest": ("write", "その頼みを承認する人だけ（app.kn_request_visible で 404・app.kn_request_decide で 403）", False),
    "declineKnowledgeRequest": ("write", "その頼みを承認する人だけ（理由が要る・app.kn_request_decide）", False),
}

_403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}
_404 = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
_422 = {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": []}
_503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
        "trigger": "頼みを読む・決める DB の問い合わせが落ちた（想定外の例外・取引が落ちた）",
        "ears_form": "UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、頼みもお知らせもページも変えない"}


def _r(base: dict, trigger: str, ears: str) -> dict:
    return {**base, "trigger": trigger, "ears_form": ears}


def _c(code: str, trigger: str) -> dict:
    return {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code], "trigger": trigger,
            "ears_form": f"UNWANTED: IF {trigger}なら、Kaname は 409 と {code} を返し、頼みもお知らせもページも変えない"}


_NF_REQ = _r(_404, "頼みが無い・見えない・別の会社の物（在るかを漏らさない）",
             "UNWANTED: IF 頼みが無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も変えない")
_FB_REQ = _r(_403, "頼みは見えるが承認する人でない（頼んだ人・ページを読める人）",
             "UNWANTED: IF 承認する人でないなら、Kaname は 403 を返し、何も変えない")
_DECIDED = _c("E-KNW-110", "頼みがもう決まっている（承認・断り・取り下げ済み・同時に押した負けた方）")

ERRORS_4XX = {
    "listKnowledgeApprovals": [
        _r(_403, "承認できる人でない（メンバー・閲覧のみ・どこにも入っていない人）",
           "UNWANTED: IF 承認できる人でないなら、Kaname は 403 を返し、承認待ちを見せない"),
        _503,
    ],
    "approveKnowledgeRequest": [
        _FB_REQ, _NF_REQ, _DECIDED,
        _c("E-KNW-111", "自分の棚のページを上げる頼みで、頼んだ人がもう先のグループにいない"),
        _c("E-KNW-103", "入れるフォルダが先の棚に無い（頼んだあとにフォルダが付け替わった）"),
        _r(_422, "体に知らない欄（strict）", "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、何も変えない"),
        _503,
    ],
    "declineKnowledgeRequest": [
        _FB_REQ, _NF_REQ, _DECIDED,
        _r(_422, "理由が無い・空・空白だけ・1,000 字を超える・文字でない・体に知らない欄（strict）",
           "UNWANTED: IF 断る理由が決まりに合わないなら、Kaname は 422 と欄 reason の理由を返し、頼みを変えない"),
        _503,
    ],
}

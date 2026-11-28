# K-695 見直すページを読む（getKnowledgeReview）の契約の宣言（土台 2 章：持ち主も契約も K-695）
#   名前の正本は 07_functional/段10-F9/土台-knowledge.md の 1.4・2・3.2 と 11_tickets/K-695.md
#   見られるのは管理者と、どれかのグループのマネージャー（app.kn_can_approve・K-688）。行は自分が書ける棚の公開済みページだけ（DB の関数 app.kn_review_*）

SCREEN_API = {
    "knowledge": [
        ("GET", "/knowledge/review", "A93", "knowledge_pages", "getKnowledgeReview", ["knowledge_breaches", "reference_logs"]),
    ],
}

# 入力なし（絞り込み・並べ替え・ページ送りを受けない。3 つの一覧を決まった並びで各 50 件まで返す）
QUERIES = {
    "getKnowledgeReview": [],
}

RESPONSES = {
    "getKnowledgeReview": ("KnowledgeReview", {"unused": "array", "conflicts": "array", "broken": "array"}),
}

RATES = {
    "getKnowledgeReview": "120/min/user",
}

PERMS = {
    "getKnowledgeReview": ("self", "管理者と、どれかのグループのマネージャー（app.kn_can_approve）だけ。行は自分が書ける棚の公開済みページだけ（自分の棚は除く・app.kn_review_unused・kn_review_conflicts・kn_review_broken）", False),
}

_403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}

ERRORS_4XX = {
    "getKnowledgeReview": [
        {**_403, "trigger": "管理者でもグループのマネージャーでもない（メンバー・閲覧のみ・どこにも入っていない人）",
         "ears_form": "UNWANTED: IF 管理者でもマネージャーでもないなら、Kaname は 403 を返し、見直すページを見せない"},
    ],
}

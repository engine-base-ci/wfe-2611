# K-689 グループを選んで共有：共有の選びを読む・頼む・やめる・取り下げる（getKnowledgeShares・setKnowledgeShares）の契約の宣言
#   名前の正本は 07_functional/段10-F9/土台-knowledge.md の 2・3・4 章と 11_tickets/K-689.md。表 knowledge_shares はこの葉が作る
#   口の振る舞いは持ち主の葉（apps/api/src/features/F9/knowledge/ops.ts の表 → hooks/f9-knowledge-shares.ts）が作る

SCREEN_API = {
    "knowledge": [
        ("GET", "/knowledge/shares", "A136", "knowledge_shares", "getKnowledgeShares", ["knowledge_requests"]),
        ("PUT", "/knowledge/shares", "A136", "knowledge_shares", "setKnowledgeShares", ["knowledge_requests"]),
    ],
}

# 読む口の問い合わせは page_id・folder_id だけ（どちらか 1 つを指さない・両方は 404＝問い合わせの 2 欄にまたがる決まりは契約に書けない）
QUERIES = {
    "getKnowledgeShares": ["page_id", "folder_id"],
}
# page_id・folder_id は名前が _id で終わるので、作り手が uuid の形にする（QUERY_RANGES には書けない）。uuid でない値は契約が 422

# 入力は送った後の選びの全部（group_ids）。知らない欄は 422（strict）
INPUTS = {
    "setKnowledgeShares": ("KnowledgeShareSetInput", {"page_id": "uuid?", "folder_id": "uuid?", "group_ids": "uuid[]", "message": "string?"}),
}
REQUIRED_INPUTS = {
    "setKnowledgeShares": ["group_ids"],
}
VALUE_RANGES = {
    "setKnowledgeShares": {"message": {"maxLength": 1000}, "group_ids": {"maxItems": 50}},
}
# ページかフォルダのどちらか 1 つ（体の中の欄をまたぐ決まりなので契約に書ける）
INPUT_RULES = {
    "setKnowledgeShares": {"oneOf": [{"required": ["page_id"]}, {"required": ["folder_id"]}]},
}
UNEXPRESSIBLE_422: dict = {}

RESPONSES = {
    "getKnowledgeShares": ("KnowledgeShareChoice", {"target": "object", "from_group_name": "string", "groups": "array"}),
    "setKnowledgeShares": ("KnowledgeShareChoice", {"target": "object", "from_group_name": "string", "groups": "array"}),
}

RATES = {
    "getKnowledgeShares": "120/min/user",
    "setKnowledgeShares": "60/min/user",
}

# 権限の言葉は「社内の人」までしか見ない。読める・決められるは DB の関数（app.kn_share_view・app.kn_share_set）が決める
PERMS = {
    "getKnowledgeShares": ("read", "元を書ける人（app.kpage_writable・app.kfolder_writable）か、共有を受けているグループのマネージャー（app.kn_share_view）", False),
    "setKnowledgeShares": ("write", "元を書ける人は頼む・やめる・取り下げる。共有を受けているグループのマネージャーは自分のグループの分をやめるだけ（app.kn_share_set）", False),
}

_403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}
_404 = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
_422 = {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": []}
_503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
        "trigger": "共有・頼み・お知らせ・証跡を読む・書く DB の問い合わせが落ちた（想定外の例外・取引が落ちた）",
        "ears_form": "UNWANTED: IF DB が使えないなら、Kaname は 503 と E-PAGE-003 を返し、共有も頼みもお知らせも変えない"}


def _r(base: dict, trigger: str, ears: str) -> dict:
    return {**base, "trigger": trigger, "ears_form": ears}


def _c(code: str, trigger: str) -> dict:
    return {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code], "trigger": trigger,
            "ears_form": f"UNWANTED: IF {trigger}なら、Kaname は 409 と {code} を返し、共有も頼みもお知らせも変えない"}


ERRORS_4XX = {
    "getKnowledgeShares": [
        _r(_403, "物は見えるが共有を決められない（元を書けず、共有を受けているグループのマネージャーでもない）",
           "UNWANTED: IF 共有を決められない人なら、Kaname は 403 を返し、選びを見せない"),
        _r(_404, "ページかフォルダのどちらか 1 つを指さない（無い・両方）・指した物が無い・見えない・消した・別の会社の物",
           "UNWANTED: IF 指した物が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさない"),
        _r(_422, "page_id・folder_id が uuid でない", "UNWANTED: IF 問い合わせの値の形が違うなら、Kaname は 422 を返す"),
        _503,
    ],
    "setKnowledgeShares": [
        _r(_403, "物は見えるが共有を決められない・共有を受けている側が足す・自分の管理でない共有や頼みを外す",
           "UNWANTED: IF 共有を決められない人なら、Kaname は 403 を返し、何も変えない"),
        _r(_404, "物・選んだグループが無い・見えない・消した・別の会社の物・会社のいちばん上のグループ",
           "UNWANTED: IF 物か選んだグループが無いか見えないなら、Kaname は 404 を返し、何も変えない"),
        _c("E-KNW-010", "ページがまだ書き終わっていない（下書きだけ）"),
        _c("E-KNW-011", "上げる頼みが承認待ち"),
        _c("E-KNW-120", "元のグループを共有先に選んだ"),
        _c("E-KNW-121", "グループの棚の物でない（会社の棚・自分の棚）"),
        _c("E-KNW-122", "足す共有先のグループに承認できる人（マネージャー）がいない"),
        _r(_422, "ページかフォルダのどちらか 1 つでない・group_ids が無い・配列でない・uuid でない・51 個以上・ひとことが 1,000 字を超える・知らない欄（strict）",
           "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"),
        _503,
    ],
}

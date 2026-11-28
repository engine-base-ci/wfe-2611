# K-810 メンバーの 1 人を読む口（getMember・GET /api/v1/members/:id）。形は K-800 の「契約」の節で決めた物（この葉の口の分をこの葉が書く）
#   体を受けない GET なので INPUTS・REQUIRED_INPUTS・VALUE_RANGES・INPUT_RULES は持たない。
#   答えは鍵ちょうど 6（member・groups・assigned・clone・login・recent_events）。人ごとの「できること」（role_bundle・granted・revoked）は返さない（D-154.10）。
#   本体 screen_api.py の前の答えの行（9 の鍵）は K-800 が消す（同じ鍵を 2 つのファイルが持つと作り手が止まる）
RESPONSES = {
    "getMember": ("MemberDetail", {"member": "object", "groups": "array", "assigned": "object", "clone": "object", "login": "object", "recent_events": "array"}),
}

UNEXPRESSIBLE_422: dict = {}   # 入力を受けない GET。道の id の形は入口の共通（K144-API-1104）

# 読む：権限（403）・相手が居ない・見えない（404・欄と details なし）。DB の失敗（503・E-PAGE-003）は入口の共通の扱い
ERRORS_4XX = {
    "getMember": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "メンバーを見る権限（members の view・会社全体）が無い（マネージャー・メンバー・閲覧のみ・止めた人）",
         "ears_form": "UNWANTED: IF メンバーを見る権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "道の id の人が無い・別の会社・消した・外した・AI（E-MEM-002）",
         "ears_form": "UNWANTED: IF 道の id の人が無い、別の会社、消した、外した、または人でないなら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
    ],
}

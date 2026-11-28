# K-804 グループを直す・並びを替える口（updateScope・PATCH /scopes/:id）と、グループの一覧（listScopes・K-60 の口）に足す鍵。
# 形は K-800 の「契約」の節で決めたもの（口ごとの断片はこの葉が持つ）。
# 直せる欄は 名前・色（tone の鍵 6 つ）・並び（兄弟の中の位置・1 から）・マネージャー（その会社の人 10 人まで・全員を指す形）。
# 短い名前（チケットの番号の頭）・上のグループ・層は変えられない（欄が無い・送ると strict で 422）。1 つは要る（INPUT_RULES の anyOf）
INPUTS = {
    "updateScope": ("ScopeUpdateInput", {"name": "string", "color": "string", "position": "integer", "manager_member_ids": "uuid[]"}),
}

# 直した 1 行：createScope の答え（ScopeCreated）と同じ 10 の鍵（apps/api/src/features/F10/admin/scopes/input.ts の SCOPE_KEYS）。
# listScopes の 1 件にも同じ 10 の鍵を足す（元の表の列 layer_id などは残る＝答えの形は足した鍵の分だけ広がる）。並びは上のグループが先・兄弟は position の順
RESPONSES = {
    "updateScope": ("ScopeUpdated", {"id": "uuid", "name": "string", "ticket_prefix": "string?", "color": "string?", "parent_id": "uuid?",
                                     "layer": "object?", "position": "integer", "managers": "array", "member_count": "integer",
                                     "created_at": "string"}),
    "listScopes": ("ScopeListItem", {"id": "uuid", "name": "string", "ticket_prefix": "string?", "color": "string?", "parent_id": "uuid?",
                                     "layer": "object?", "position": "integer", "managers": "array", "member_count": "integer",
                                     "created_at": "string", "layer_id": "uuid?"}),
}

# 名前は空白だけでない 100 文字まで・色は 6 つ・並びは 1 以上・マネージャーは 10 人まで
VALUE_RANGES = {
    "updateScope": {
        "name": {"pattern": "\\S", "maxLength": 100},
        "color": {"enum": ["teal", "plum", "indigo", "amber", "coral", "sage"]},
        "position": {"minimum": 1},
        "manager_member_ids": {"maxItems": 10},
    },
}

# 体が空は 422（直す欄が 1 つは要る）
INPUT_RULES = {
    "updateScope": {"anyOf": [{"required": [x]} for x in ("name", "color", "position", "manager_member_ids")]},
}

# 権限（403）・直す先や選んだ人が無い（404）・今の状態ではできない（409）・形の誤り（422）。404・409 は欄と details を付けない
ERRORS_4XX = {
    "updateScope": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "グループを直す権限（scopes の edit・会社全体）が無い",
         "ears_form": "UNWANTED: IF グループを直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 404, "code": "E-GRP-002", "body": {"error": "not_found", "code": "E-GRP-002"}, "errors": ["E-GRP-002", "E-GRP-015"],
         "trigger": "直すグループ（E-GRP-002）・選んだ人（E-GRP-015）が無い・別の会社・消した・抜けた・人でない",
         "ears_form": "UNWANTED: IF 直すグループか選んだ人が見つからないなら、Kaname は 404 と E-GRP-002・015 のどれかを返し、何も書かない"},
        {"status": 409, "code": "E-GRP-011", "body": {"error": "conflict", "code": "E-GRP-011"},
         "errors": ["E-GRP-011", "E-GRP-016", "E-GRP-017"],
         "trigger": "同じ上のグループに同じ名前（E-GRP-011）・止まっている・招待中の人（E-GRP-016）・閲覧のみをマネージャーに（E-GRP-017）",
         "ears_form": "UNWANTED: IF 名前が兄弟と重なる・選べない人がいるなら、Kaname は 409 と E-GRP-011・016・017 のどれかを返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []},
         "errors": ["E-GRP-001", "E-GRP-004", "E-GRP-005", "E-GRP-008", "E-GRP-009"],
         "trigger": "名前が空・101 文字（E-GRP-001）・直す欄が無い（E-GRP-004）・色が 6 つの外（E-GRP-005）・並びが 0 以下（E-GRP-008）・人の数（E-GRP-009）・短い名前／上のグループ／層など知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "グループ・所属・証跡を書く DB が落ちた",
         "ears_form": "UNWANTED: IF グループを直す DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、名前も並びも所属も証跡も前のまま"},
    ],
}

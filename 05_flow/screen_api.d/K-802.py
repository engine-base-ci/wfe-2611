# K-802 グループを足す口（createScope・POST /scopes）。形は K-800 の「契約」の節で決めたもの（口ごとの断片はこの葉が持つ）
# 名前・短い名前（チケットの番号の頭・作ったあとは変えられない）・上のグループ（無ければ会社のいちばん上）・層（無ければ上のグループから決める）・
# 色（tone の鍵 6 つ・既定 teal）・マネージャー（10 人まで）・最初のメンバー（50 人まで）。strict（ほかの欄は 422）
INPUTS = {
    "createScope": ("ScopeCreateInput", {"name": "string", "ticket_prefix": "string", "parent_id": "uuid", "layer_id": "uuid",
                                         "color": "string", "manager_member_ids": "uuid[]", "member_ids": "uuid[]"}),
}

# 足した 1 行：id・name・ticket_prefix（大文字）・color・parent_id・layer（{id, label} か null）・position・managers（[{id, name}]）・
# member_count（マネージャーを含む重ならない人数）・created_at（鍵はちょうど 10・apps/api/src/features/F10/admin/scopes/input.ts の SCOPE_KEYS）
RESPONSES = {
    "createScope": ("ScopeCreated", {"id": "uuid", "name": "string", "ticket_prefix": "string?", "color": "string?", "parent_id": "uuid?",
                                     "layer": "object?", "position": "integer", "managers": "array", "member_count": "integer",
                                     "created_at": "string"}),
}

# apps/api/src/features/F10/admin/scopes/create.ts（名前と短い名前は無ければ 422）
REQUIRED_INPUTS = {
    "createScope": ["name", "ticket_prefix"],
}

# 名前は空白だけでない 100 文字まで・短い名前は英字で始まる英数字 1〜8 文字で T だけは使えない（口が大文字にする）・色は 6 つ・人の数
VALUE_RANGES = {
    "createScope": {
        "name": {"pattern": "\\S", "maxLength": 100},
        "ticket_prefix": {"pattern": "^(?![Tt]$)[A-Za-z][A-Za-z0-9]{0,7}$"},
        "color": {"enum": ["teal", "plum", "indigo", "amber", "coral", "sage"]},
        "manager_member_ids": {"maxItems": 10},
        "member_ids": {"maxItems": 50},
    },
}

# 権限（403）・指した物が無い（404）・今の状態ではできない（409）・形の誤り（422）。404・409 は欄と details を付けない
ERRORS_4XX = {
    "createScope": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "グループを直す権限（scopes の edit・会社全体）が無い",
         "ears_form": "UNWANTED: IF グループを直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 404, "code": "E-GRP-014", "body": {"error": "not_found", "code": "E-GRP-014"}, "errors": ["E-GRP-014", "E-GRP-015", "E-GRP-020"],
         "trigger": "上のグループ（E-GRP-014）・選んだ人（E-GRP-015）・層（E-GRP-020）が無い・別の会社・消した・抜けた・人でない",
         "ears_form": "UNWANTED: IF 上のグループ・選んだ人・層が見つからないなら、Kaname は 404 と E-GRP-014・015・020 のどれかを返し、何も書かない"},
        {"status": 409, "code": "E-GRP-010", "body": {"error": "conflict", "code": "E-GRP-010"},
         "errors": ["E-GRP-010", "E-GRP-011", "E-GRP-012", "E-GRP-016", "E-GRP-017"],
         "trigger": "短い名前の重なり（E-GRP-010）・同じ上のグループに同じ名前（E-GRP-011）・グループが 200（E-GRP-012）・止まっている・招待中の人（E-GRP-016）・閲覧のみをマネージャーに（E-GRP-017）",
         "ears_form": "UNWANTED: IF 短い名前か名前が重なる・グループが上限・選べない人がいるなら、Kaname は 409 と E-GRP-010・011・012・016・017 のどれかを返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []},
         "errors": ["E-GRP-001", "E-GRP-003", "E-GRP-005", "E-GRP-009"],
         "trigger": "名前が無い・空・101 文字（E-GRP-001）・短い名前の形（E-GRP-003）・色が 6 つの外（E-GRP-005）・人の数（E-GRP-009）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
}

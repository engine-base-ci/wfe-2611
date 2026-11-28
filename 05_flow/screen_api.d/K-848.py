# K-848 外す口 removeMember（POST /members/:id/remove）の断る番号。入力・答えの形は K-800 のまま（MemberRemoveInput・MemberRemoved）
#   403 の権限と STEP_UP_REQUIRED・422 は入口の共通。404・409 はこの口の DB の関数（app.member_remove）が返す
# 入力・答えの形は K-800 の「契約」の節で決めた形（MemberRemoveInput・MemberRemoved）。K-800 は本体 screen_api.py に書かず、
#   この葉も「K-800 のまま」として書かなかったので、契約に形が無く入口が transfer_to_member_id・transfers を知らない欄として 422 にしていた（統合の枝の直し）
INPUTS = {
    "removeMember": ("MemberRemoveInput", {"transfer_to_member_id": "uuid", "transfers": "array"}),
}

# 答えの鍵はちょうど 4 つ（remove.ts の REMOVED_KEYS）
RESPONSES = {
    "removeMember": ("MemberRemoved", {"member_id": "uuid", "tickets_moved": "integer", "handovers_cancelled": "integer", "restorable_until": "string"}),
}

# 外すのは作る口でない（200・dataReply(200, …)）
SUCCESS_STATUS = {"removeMember": 200}

# transfers は最大 500 件（K-800 の VALUE_RANGES）
VALUE_RANGES = {
    "removeMember": {
        "transfers": {"maxItems": 500,
                      "items": {"type": "object", "required": ["ticket_id", "to_member_id"], "additionalProperties": False,
                                "properties": {"ticket_id": {"type": "string", "format": "uuid"},
                                               "to_member_id": {"type": "string", "format": "uuid"}}}},
    },
}

# 全部同じ人（transfer_to_member_id）と 1 件ずつ（transfers）は両方を指せない（入口が 422・K848-API-019）
INPUT_RULES = {
    "removeMember": {"not": {"required": ["transfer_to_member_id", "transfers"]}},
}

ERRORS_4XX = {
    "removeMember": [
        {"status": 404, "code": "E-MEM-002", "body": {"error": "not_found", "code": "E-MEM-002"}, "errors": ["E-MEM-002"],
         "trigger": "外す相手が居ない（別の会社・在らない・もう外した・招待中）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 外す相手が居ないなら、Kaname は 404 と E-MEM-002 を返し、何も書かない"},
        {"status": 404, "code": "E-MEM-021", "body": {"error": "heir_gone", "code": "E-MEM-021"}, "errors": ["E-MEM-021"],
         "trigger": "引き継ぎ先が居ない（別の会社・在らない・もう外した・招待中）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 引き継ぎ先が居ないなら、Kaname は 404 と E-MEM-021 を返し、担当を 1 件も移さない"},
        {"status": 409, "code": "E-MEM-004", "body": {"error": "last_admin", "code": "E-MEM-004"}, "errors": ["E-MEM-004"],
         "trigger": "会社のただ 1 人の有効な管理者を外そうとした",
         "ears_form": "UNWANTED: IF 最後の管理者を外そうとしたなら、Kaname は 409 と E-MEM-004 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-005", "body": {"error": "self_stop", "code": "E-MEM-005"}, "errors": ["E-MEM-005"],
         "trigger": "自分を外そうとした（最後の管理者より先に見る）",
         "ears_form": "UNWANTED: IF 自分を外そうとしたなら、Kaname は 409 と E-MEM-005 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-020", "body": {"error": "heir_missing", "code": "E-MEM-020"}, "errors": ["E-MEM-020"],
         "trigger": "担当があるのに引き継ぎ先が無い・transfers が担当の全部をちょうど 1 回ずつ指していない（下見のあとで担当が変わった）",
         "ears_form": "UNWANTED: IF 担当の全部に引き継ぎ先が決まっていないなら、Kaname は 409 と E-MEM-020 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-022", "body": {"error": "heir_state", "code": "E-MEM-022", "detail": {"名前": "鈴木 一郎", "訳": "止まっています"}}, "errors": ["E-MEM-022"],
         "trigger": "引き継ぎ先が止めた人・外す本人（detail に 名前 と 訳）",
         "ears_form": "UNWANTED: IF 引き継ぎ先が止めた人か外す本人なら、Kaname は 409 と E-MEM-022 を返し、何も書かない"},
        {"status": 409, "code": "E-MEM-023", "body": {"error": "heir_viewer", "code": "E-MEM-023", "detail": {"名前": "山口 健"}}, "errors": ["E-MEM-023"],
         "trigger": "引き継ぎ先が閲覧のみ・依頼する側（detail に 名前）",
         "ears_form": "UNWANTED: IF 引き継ぎ先が閲覧のみか依頼する側なら、Kaname は 409 と E-MEM-023 を返し、何も書かない"},
    ],
}

# K-848 外す口 removeMember（POST /members/:id/remove）の断る番号。入力・答えの形は K-800 のまま（MemberRemoveInput・MemberRemoved）
#   403 の権限と STEP_UP_REQUIRED・422 は入口の共通。404・409 はこの口の DB の関数（app.member_remove）が返す
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

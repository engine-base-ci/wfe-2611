# K-351 預けたログイン情報の一覧の口（listCredentials）
# 答えの形（K-351・D-128.57）：名前と使い方だけ。金庫の参照（vault_ref）と持ち主の id は出さない。
#   kind は login／key・expires_on は日本の日付（YYYY-MM-DD）・login_check は { state, detail, at, request_id }・can_edit は直せるか
RESPONSES = {
    "listCredentials": ("Credential", {"id": "uuid", "name": "string", "description": "string?", "layer": "string", "kind": "string", "two_factor": "string", "destinations": "string[]", "expires_on": "string?", "use_count": "integer", "last_used_at": "string?", "login_check": "object", "can_edit": "boolean", "created_at": "string", "updated_at": "string"}),
}

# 一覧の細目（K-351）：絞り込みと並べ替えを受けない（名前の順に全部・上限 500）
LIST_DETAILS = {
    "listCredentials": {"sort": False, "desc": "取得（credentials）— 預けたログイン情報を名前の順に見る（自分の個人とワークスペース）"},
}

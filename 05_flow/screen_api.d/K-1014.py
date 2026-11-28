# K-1014 運営がお知らせを作る口（createOpsNotice）と直す口（updateOpsNotice）の契約に足す分。入力と答えの形は K-1004 の断片（ここでは変えない）
#   欄をまたぐ決まり（INPUT_RULES・K-355 の書き方）と、DB で決まる断り（ERRORS_4XX）だけを足す
#   作る：①ワークスペースを選ぶなら並び（1 つ以上）が要りプランを付けない ②プランで選ぶなら並び（1 つ以上）が要りワークスペースを付けない
#         ③全部ならどちらも付けない ④メンテの始まりと終わりは両方か、どちらも無い
#   直す：プランかワークスペースの並びを付けるなら誰に（audience_mode）も要り、付けたら ①〜③。メンテの時間は片方だけでも送れる
#         （保存の値と合わせて前後を DB が見る・409 E-OPS-014・試験 K1014-API-011・012）
_WS = {"properties": {"audience_mode": {"enum": ["workspaces"]}, "audience_workspace_ids": {"minItems": 1}},
       "required": ["audience_workspace_ids"], "not": {"required": ["audience_plans"]}}
_PLANS = {"properties": {"audience_mode": {"enum": ["plans"]}, "audience_plans": {"minItems": 1}},
          "required": ["audience_plans"], "not": {"required": ["audience_workspace_ids"]}}
_ALL = {"properties": {"audience_mode": {"enum": ["all"]}},
        "not": {"anyOf": [{"required": ["audience_plans"]}, {"required": ["audience_workspace_ids"]}]}}
_NO_MODE = {"not": {"anyOf": [{"required": ["audience_mode"]}, {"required": ["audience_plans"]}, {"required": ["audience_workspace_ids"]}]}}
_MAINT_PAIR = {"anyOf": [{"required": ["maintenance_from", "maintenance_to"]},
                         {"not": {"anyOf": [{"required": ["maintenance_from"]}, {"required": ["maintenance_to"]}]}}]}
INPUT_RULES = {
    "createOpsNotice": {"allOf": [{"oneOf": [_WS, _PLANS, _ALL]}, _MAINT_PAIR]},
    "updateOpsNotice": {"oneOf": [{**_WS, "required": ["audience_mode", "audience_workspace_ids"]},
                                  {**_PLANS, "required": ["audience_mode", "audience_plans"]},
                                  {**_ALL, "required": ["audience_mode"]},
                                  _NO_MODE]},
}

_NF = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
_MAINT = {"status": 409, "code": "E-OPS-014", "body": {"error": "conflict", "code": "E-OPS-014"}, "errors": ["E-OPS-014"],
          "trigger": "メンテの終わりが始まりより前か同じ（直すときは保存の値と合わせて）",
          "ears_form": "UNWANTED: IF メンテの終わりが始まりより前か同じなら、Kaname は 409 と E-OPS-014 を返し、お知らせも記録も書かない"}
ERRORS_4XX = {
    "createOpsNotice": [
        {**_NF, "trigger": "選んだワークスペースが顧客の会社でない（運営の会社・無い・消した・作りかけ）",
         "ears_form": "UNWANTED: IF 選んだワークスペースが選べない会社なら、Kaname は 404 を返し、在るかを漏らさずお知らせも記録も作らない"},
        dict(_MAINT),
    ],
    "updateOpsNotice": [
        {**_NF, "trigger": "お知らせが無い・消した・顧客の会社の行／選んだワークスペースが顧客の会社でない",
         "ears_form": "UNWANTED: IF お知らせか選んだワークスペースが見えないなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-OPS-009", "body": {"error": "conflict", "code": "E-OPS-009"}, "errors": ["E-OPS-009"],
         "trigger": "出した後（出した・予定の時刻を過ぎた・直った）に 種類・誰に・出す場所・出す日時 を送った（値が今と同じでも）",
         "ears_form": "UNWANTED: IF 出したお知らせの種類・誰に・出す場所・出す日時を変えようとしたら、Kaname は 409 と E-OPS-009 を返し、何も変えない"},
        dict(_MAINT),
    ],
}

# K-1004 から前へ移した分（PM の決め 2026-11-26・K-924 と同じく前へ移す）：上の INPUT_RULES が使う欄の入力の形。
#   入力の形の持ち主 K-1004 が段の枝 i/段13 にまだ無く、作り直し（05_flow/build_api.py）が「createOpsNotice の INPUT_RULES の欄 audience_mode が
#   入力の形 CreateOpsNoticeInput に無い」で落ちるため、作る・直すの 2 口の INPUTS・REQUIRED_INPUTS・VALUE_RANGES をここに置く。
#   中身は K-1004 の断片（t/K-1004 の 05_flow/screen_api.d/K-1004.py）の createOpsNotice・updateOpsNotice の行と同じ。K-1004 はこの行を持たない
_NOT_BLANK = "\\S"   # 空白だけは断る（全角の空白・タブ・改行だけも 422・D-156.38）
_OPS_INPUT = {
    "kind": "string", "title": "string", "body": "string",
    "audience_mode": "string", "audience_plans": "string[]", "audience_workspace_ids": "uuid[]",
    "placements": "string[]", "publish_at": "string?",
    "maintenance_from": "string?", "maintenance_to": "string?", "impact": "string?",
}
INPUTS = {
    "createOpsNotice": ("OpsNoticeCreateInput", dict(_OPS_INPUT)),
    "updateOpsNotice": ("OpsNoticeUpdateInput", dict(_OPS_INPUT)),
}
# 直す（updateOpsNotice）は必須なし（渡した欄だけ直す）
REQUIRED_INPUTS = {
    "createOpsNotice": ["kind", "title", "body", "audience_mode", "placements"],
}
_WHEN = {"format": "date-time"}
_OPS_RANGES = {
    "kind": {"enum": ["incident", "maintenance", "release"]},
    "title": {"minLength": 1, "maxLength": 100, "pattern": _NOT_BLANK},
    "body": {"minLength": 1, "maxLength": 4000, "pattern": _NOT_BLANK},
    "audience_mode": {"enum": ["all", "plans", "workspaces"]},   # 誰に：全部・プランで選ぶ・ワークスペースを選ぶ（D-156.33）
    "audience_plans": {"items": {"type": "string", "enum": ["free", "team", "business"]}, "uniqueItems": True},
    "audience_workspace_ids": {"items": {"type": "string", "format": "uuid"}, "uniqueItems": True},
    "placements": {"items": {"type": "string", "enum": ["band", "list"]}, "minItems": 1, "maxItems": 2, "uniqueItems": True},
    "publish_at": dict(_WHEN), "maintenance_from": dict(_WHEN), "maintenance_to": dict(_WHEN),
    "impact": {"minLength": 1, "maxLength": 200},
}
VALUE_RANGES = {
    "createOpsNotice": {k: dict(v) for k, v in _OPS_RANGES.items()},
    "updateOpsNotice": {k: dict(v) for k, v in _OPS_RANGES.items()},
}

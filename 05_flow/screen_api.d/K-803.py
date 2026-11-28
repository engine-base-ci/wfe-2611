# K-803 層の一覧の口（listLayers・GET /api/v1/layers）。契約に無かったので足す（K-70 の葉・束 G）
#   切る段（c/段11）で、生成の試験 get_layers を先に作るためにこの口の分だけを置いた（carry: で運ぶ）。
#   作る段で、層を足す・直す口（createLayer・updateLayer・POST /layers・PATCH /layers/:id）の形を足した。形は K-800 の「契約」の節で決めたもの
SCREEN_API = {
    "layers": [
        ("GET", "/layers", "A117", "layers", "listLayers", ["scopes"]),
    ],
}

# 会社の人なら誰でも読める（役を見ない・D-125.116）
PERMS = {
    "listLayers": ("read", "ワークスペースのメンバー（層の名前と並びと、層に入っているグループの数だけ）", False),
}

# 絞り込みを受けない（会社はセッションから決める・層は 8 段まで）
QUERIES = {
    "listLayers": [],
}

# 並びは order_no の順で固定（sort を受けない）。ページを持たない
LIST_DETAILS = {
    "listLayers": {"sort": False, "desc": "取得（layers）— 層の名前と並びを見る（order_no の順・消した層を含まない・層に入っているグループの数）"},
}

# 層の名前（1〜40 文字）と並び（1 から。無ければ最後・範囲を超えれば最後）。key・tenant_id は送れない（strict）
INPUTS = {
    "createLayer": ("LayerCreateInput", {"label": "string", "order_no": "integer"}),
    "updateLayer": ("LayerUpdateInput", {"label": "string", "order_no": "integer"}),
}

# 1 件の層：id・key（l_ ＋ 8 文字・画面に出さない）・label・order_no・group_count（その層の消していないグループの数）・created_at
#   （鍵はちょうど 6・apps/api/src/features/F10/admin/layers/input.ts の LAYER_KEYS）。listLayers はこの形の並び
_LAYER = {"id": "uuid", "key": "string", "label": "string", "order_no": "integer", "group_count": "integer", "created_at": "string"}
RESPONSES = {
    "createLayer": ("LayerCreated", dict(_LAYER)),
    "updateLayer": ("LayerUpdated", dict(_LAYER)),
    "listLayers": ("Layer", dict(_LAYER)),
}

# apps/api/src/features/F10/admin/layers/create.ts（名前は無ければ 422）
REQUIRED_INPUTS = {
    "createLayer": ["label"],
}

# 名前は空白だけでない 40 文字まで・並びは 1 以上の整数（上は入口の整数が受ける 2^53-1 まで。大きい数は層の数＋1 に寄せる cleanOrder）
VALUE_RANGES = {
    "createLayer": {
        "label": {"pattern": "\\S", "maxLength": 40},
        "order_no": {"minimum": 1, "maximum": 9007199254740991},
    },
    "updateLayer": {
        "label": {"pattern": "\\S", "maxLength": 40},
        "order_no": {"minimum": 1, "maximum": 9007199254740991},
    },
}

# 直す口は名前か並びのどちらか 1 つは要る（体が空は 422）
INPUT_RULES = {
    "updateLayer": {"anyOf": [{"required": ["label"]}, {"required": ["order_no"]}]},
}

# 権限（403）・指した物が無い（404）・今の状態ではできない（409）・形の誤り（422）。404・409 は欄と details を付けない
ERRORS_4XX = {
    "createLayer": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "層を直す権限（layers の edit・会社全体）が無い",
         "ears_form": "UNWANTED: IF 層を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 409, "code": "E-GRP-013", "body": {"error": "conflict", "code": "E-GRP-013"}, "errors": ["E-GRP-013", "E-GRP-019"],
         "trigger": "消していない層が 8 段ある（E-GRP-013）・同じ名前の層がある（E-GRP-019）",
         "ears_form": "UNWANTED: IF 層が上限か名前が重なるなら、Kaname は 409 と E-GRP-013・019 のどれかを返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []},
         "errors": ["E-GRP-006", "E-GRP-008"],
         "trigger": "名前が無い・空・41 文字（E-GRP-006）・並びが 0 以下・整数でない（E-GRP-008）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
    "updateLayer": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "層を直す権限（layers の edit・会社全体）が無い",
         "ears_form": "UNWANTED: IF 層を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない"},
        {"status": 404, "code": "E-GRP-007", "body": {"error": "not_found", "code": "E-GRP-007"},
         "trigger": "直す層が無い・別の会社・消した",
         "ears_form": "UNWANTED: IF 直す層が見つからないなら、Kaname は 404 と E-GRP-007 を返し、何も書かない"},
        {"status": 409, "code": "E-GRP-019", "body": {"error": "conflict", "code": "E-GRP-019"},
         "trigger": "ほかの消していない層と同じ名前",
         "ears_form": "UNWANTED: IF ほかの層と名前が重なるなら、Kaname は 409 と E-GRP-019 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []},
         "errors": ["E-GRP-004", "E-GRP-006", "E-GRP-008"],
         "trigger": "体が空（E-GRP-004）・名前が空・41 文字（E-GRP-006）・並びが 0 以下・整数でない（E-GRP-008）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
}

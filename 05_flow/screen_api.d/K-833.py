# K-833 自分を読む・直す口（getMe・updateMe）
# 直す（D-154.56・D-125.150）：名前・呼ばれ方・言語・見た目・週のはじめ・時間帯を、送った欄だけ、同じログインの抜けていない全部のワークスペースの人の行に書く。
#   strict（ほかの欄は 422。顔は K-834・メールは K-835 の口）。call_name の空文字・null は「消す」（null に戻す）
#   getMe の答えの形（"getMe": ("Me", …)・K-253 が workspace_name を足した）は本体の screen_api.py のまま（member・workspaces の中の形は口と試験が決める）
INPUTS = {
    "updateMe": ("MeUpdateInput", {"name": "string?", "call_name": "string?", "language": "string?", "theme": "string?", "week_start": "integer?", "timezone": "string?"}),
}

# 直した答え：今いる会社の自分の member（getMe の member と同じ形）と、保存した時刻（同じ値への保存は前の時刻のまま）
RESPONSES = {
    "updateMe": ("MeUpdated", {"member": "object", "saved_at": "string"}),
}

# 1 つも欄の無い体は 422（どれか 1 つは送る）
INPUT_RULES = {
    "updateMe": {"anyOf": [{"required": ["name"]}, {"required": ["call_name"]}, {"required": ["language"]},
                           {"required": ["theme"]}, {"required": ["week_start"]}, {"required": ["timezone"]}]},
}

# apps/api/src/features/F10/me/profile.ts の inputMe（名前は空白だけなら 422・見え方は決まった値だけ）
VALUE_RANGES = {
    "updateMe": {
        "name": {"pattern": "\\S"},
        "language": {"enum": ["ja"]},
        "theme": {"enum": ["system", "light", "dark"]},
        "week_start": {"enum": [0, 1]},
        "timezone": {"enum": ["Asia/Tokyo", "UTC"]},
    },
}

UNEXPRESSIBLE_422 = {
    "updateMe": ["名前が null（空と同じ・E-ME-001）", "前後の空白・NFKC を除いて 101 文字以上の名前（E-ME-002・文字の数で数える）",
                 "前後の空白・NFKC を除いて 21 文字以上の呼ばれ方（E-ME-003・文字の数で数える）"],
}

# 直す：名前が空（E-ME-001）・長すぎる（E-ME-002）・呼ばれ方が長すぎる（E-ME-003）・見え方の値の外・知らない欄・空の体
ERRORS_4XX = {
    "updateMe": [
        {"status": 422, "code": "E-ME-001", "body": {"error": "validation_failed", "code": "E-ME-001", "details": []}, "errors": ["E-ME-001", "E-ME-002", "E-ME-003"],
         "trigger": "名前が空・空白だけ・null（E-ME-001）・前後の空白を削って 101 文字以上（E-ME-002）・呼ばれ方が前後の空白を削って 21 文字以上（E-ME-003）（欄の名前つき）",
         "ears_form": "UNWANTED: IF 名前が空か 100 文字を超えるか、呼ばれ方が 20 文字を超えるなら、Kaname は 422 と欄の理由を返し、どのワークスペースの行も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "言語が ja でない・見た目が system／light／dark でない・週のはじめが 0／1 でない・時間帯が Asia/Tokyo／UTC でない・欄が 1 つも無い・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 見え方の値が決まった値の外か、欄が無いか知らない欄があるなら、Kaname は 422 と欄の理由を返し、どのワークスペースの行も変えない"},
    ],
}

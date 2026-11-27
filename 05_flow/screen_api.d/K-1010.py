# K-1010 運営がひな形の新しい版を出す口（releaseOpsTemplate）と、操作を読む口（listOperations）
#   出す：中身（items）と変えた理由（change_reason）。dry_run が true なら何も書かず、届く会社の数だけを返す（D-156.20・D-156.56）。
#   部と合わない中身（部の欄でない欄・項目に field_type が無い・同じ key・壊れた本文のひな形・数の上限）は部で決まるので契約に書けない＝409 E-OPS-024。
#   振る舞いの本体は apps/api/src/features/F12/ops/templates/release.ts（値の決まりは同じ字）・operations.ts

_COLORS = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"]   # 段 10 の 8 つの字（K-704・K-705）
_FIELD_TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"]   # 段 10 の 7 つ（K-706）

# 体は strict（知らない欄は 422）
INPUTS = {
    "releaseOpsTemplate": ("OpsTemplateReleaseInput", {"items": "array", "change_reason": "string", "dry_run": "boolean"}),
}

REQUIRED_INPUTS = {
    "releaseOpsTemplate": ["items", "change_reason"],   # apps/api/src/features/F12/ops/templates/release.ts（無いと 422）
}

# 中身の 1 つ：key・name は必須。部ごとに使う欄（種別＝color_key・body_template／状態＝color_key／項目＝field_type・required・description・options・kind_keys）
VALUE_RANGES = {
    "releaseOpsTemplate": {
        "items": {"minItems": 0, "maxItems": 100,
                  "items": {"type": "object", "required": ["key", "name"], "additionalProperties": False,
                            "properties": {
                                "key": {"type": "string", "pattern": "^[a-z][a-z0-9_]{0,39}$"},
                                "name": {"type": "string", "minLength": 1, "maxLength": 40},
                                "color_key": {"type": "string", "enum": list(_COLORS)},
                                "body_template": {"type": "object", "nullable": True},
                                "field_type": {"type": "string", "enum": list(_FIELD_TYPES)},
                                "required": {"type": "boolean"},
                                "description": {"type": "string", "maxLength": 200},
                                "options": {"type": "array"},
                                "kind_keys": {"type": "array", "items": {"type": "string"}},
                            }}},
        # 空白だけの理由は断る
        "change_reason": {"minLength": 1, "maxLength": 500, "pattern": "\\S"},
    },
}

# 出すも下書きも 201（契約は 1 つの口に 2xx を 1 つ）。data はひな形の一覧の 1 行（K-992 の 8 欄）。操作の 1 行は 6 欄
RESPONSES = {
    "releaseOpsTemplate": ("OpsTemplateRow", {"id": "uuid", "key": "string", "name": "string", "summary": "string", "version": "integer",
                                              "using": "integer", "took": "object?", "last_released_at": "string?"}),
    "listOperations": ("OpsOperation", {"id": "uuid", "key": "string", "name": "string", "version_label": "string?",
                                        "description": "string?", "check_state": "string"}),
}

# 届く会社の数（offered）と、そのひな形を使っている会社の数（using）
META = {
    "releaseOpsTemplate": {"offered": "integer", "using": "integer"},
}

# 操作の一覧は 60/min/user（運営の一覧の口と同じ・K-985・K1010-API-013）。出す口は POST の既定の 60/min/user のまま
RATES = {
    "listOperations": "60/min/user",
}

ERRORS_4XX = {
    "releaseOpsTemplate": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "配るもの（ひな形）が無い・消した（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 無いひな形に新しい版を出そうとしたなら、Kaname は 404 を返し、版も知らせも書かない"},
        {"status": 409, "code": "E-OPS-023", "body": {"error": "conflict", "code": "E-OPS-023"}, "errors": ["E-OPS-023"],
         "trigger": "中身が今の版と同じ（並びも含めて・同時に 2 回出した後の 1 つも）。欄も details も付けない",
         "ears_form": "UNWANTED: IF 今の版と同じ中身を出そうとしたなら、Kaname は 409 と E-OPS-023 を返し、版も知らせも書かない"},
        {"status": 409, "code": "E-OPS-024", "body": {"error": "conflict", "code": "E-OPS-024"}, "errors": ["E-OPS-024"],
         "trigger": "部と合わない中身（部の欄でない欄・項目に field_type が無い・同じ key が 2 つ・本文のひな形が壊れている・種別が 10 を超える・状態が仕組みの段を除いて 8 を超える）。detail.key がどの 1 つか",
         "ears_form": "UNWANTED: IF 部と合わない中身か数の上限を超える中身を出そうとしたなら、Kaname は 409 と E-OPS-024 と detail.key を返し、版も知らせも書かない"},
    ],
}

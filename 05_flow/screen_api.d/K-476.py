# K-476 検索条件を直す・消す口（updateSavedView・deleteSavedView）
# 直せる人・消せる人（D-128.119）：作った人と、グループの全員向けの物は見せているグループのマネージャー。
#   見せる相手（share・scope_id）を変えられるのは作った人だけ（マネージャーは名前・条件・列・詰め方だけ）。消すのは消した印を付けるだけ（行は残す）。
INPUTS = {
    # どの欄も無くてよい（送った欄だけ変える）。member_id・tenant_id・created_by・deleted_at は受けない（strict）。scope_id だけ null を受ける
    "updateSavedView": ("SavedViewUpdateInput", {"name": "string", "share": "string", "scope_id": "uuid?", "filters": "object", "columns": "string[]", "density": "string"}),
}

_VIEW = {"id": "uuid", "name": "string", "share": "string", "scope_id": "uuid?", "filters": "object", "columns": "string[]", "density": "string",
         "member_id": "uuid", "member_name": "string", "mine": "boolean", "can_edit": "boolean", "created_at": "string", "updated_at": "string"}
RESPONSES = {
    "updateSavedView": ("SavedView", dict(_VIEW)),
    "deleteSavedView": ("SavedViewDeleted", {"id": "uuid"}),
}

# 値域は K-475（screen_api.d/K-475.py）と同じ字。直すだけの違いは、name を必須にしない（REQUIRED_INPUTS は書かない）ことと、INPUT_RULES が 2 つあること
_VISIBLE = r"[^\s\u0000-\u001f\u007f-\u009f]"
_NO_CTRL = r"[^\u0000-\u001f\u007f-\u009f]"
_NAME = rf"^\s*{_VISIBLE}(?:{_NO_CTRL}*{_VISIBLE})?\s*$"
def _key(): return {"pattern": "^[A-Za-z0-9_]{1,40}$"}
def _leaf(): return [{"type": "string", "maxLength": 500}, {"type": "number"}, {"type": "boolean"}]
def _filters(): return {"maxProperties": 8, "propertyNames": _key(),
                        "additionalProperties": {"anyOf": _leaf() + [{"type": "object", "maxProperties": 32, "propertyNames": _key(), "additionalProperties": {"anyOf": _leaf()}}]}}
VALUE_RANGES = {"updateSavedView": {
    "name": {"minLength": 1, "maxLength": 60, "pattern": _NAME},
    "share": {"enum": ["self", "group"]},
    "density": {"enum": ["normal", "compact"]},
    "filters": _filters(),
    "columns": {"maxItems": 50, "items": {"type": "string", "maxLength": 40}},
}}

INPUT_RULES = {"updateSavedView": {"allOf": [
    {"anyOf": [{"required": [k]} for k in ("name", "share", "scope_id", "filters", "columns", "density")]},   # 空の体は送れない（欄が 1 つは要る）
    {"anyOf": [
        {"not": {"required": ["share"]}},
        {"properties": {"share": {"enum": ["self"]}}},
        {"required": ["scope_id"], "properties": {"scope_id": {"type": "string"}}},
    ]},   # share を group にするなら scope_id（null でない）が要る
]}}

_NOTHING = "条件も証跡も書かない"
ERRORS_4XX = {
    "updateSavedView": [
        {"status": 403, "code": "E-VWS-020", "body": {"error": "forbidden", "code": "E-VWS-020"}, "errors": ["E-VWS-020"],
         "trigger": "見せる相手（share か scope_id）を今と違う値で送ったのが、作った人でない（グループのマネージャー）。今と同じ値を添えただけなら変えないので通す",
         "ears_form": f"UNWANTED: IF 作った人でない人が見せる相手を変えようとするなら、Kaname は 403 と E-VWS-020 を返し、{_NOTHING}"},
        {"status": 404, "code": "E-VWS-004", "body": {"error": "not_found", "code": "E-VWS-004"}, "errors": ["E-VWS-004"],
         "trigger": "見せるグループ（scope_id）を、無い・別の会社・消した・作った人に見えないグループへ変えようとした（在るかを教えない）",
         "ears_form": f"UNWANTED: IF 見せるグループが無いか見えないなら、Kaname は 404 と E-VWS-004 を返し、{_NOTHING}"},
        {"status": 409, "code": "E-VWS-005", "body": {"error": "conflict", "code": "E-VWS-005"}, "errors": ["E-VWS-005"],
         "trigger": "直した名前が、作った人の消していない別の条件の名前と同じ（大文字小文字・全角半角の違いも同じ。同時の 2 回目も）",
         "ears_form": f"UNWANTED: IF 直した名前が作った人の別の条件と同じなら、Kaname は 409 と E-VWS-005 を返し、{_NOTHING}"},
        {"status": 409, "code": "E-VWS-021", "body": {"error": "conflict", "code": "E-VWS-021"}, "errors": ["E-VWS-021"],
         "trigger": "グループの全員に見せている条件で、share は送らずに scope_id を null にした（先に「自分だけ」に変える）",
         "ears_form": f"UNWANTED: IF グループの全員に見せたまま見せるグループを外すなら、Kaname は 409 と E-VWS-021 を返し、{_NOTHING}"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "知らない欄（member_id・tenant_id・created_by・deleted_at など・strict）・空の体・share と density が決めた言葉の外・scope_id が uuid でない",
         "ears_form": f"UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、{_NOTHING}"},
        {"status": 422, "code": "E-VWS-001", "body": {"error": "validation", "code": "E-VWS-001"}, "errors": ["E-VWS-001", "E-VWS-002", "E-VWS-003", "E-VWS-007", "E-VWS-008"],
         "trigger": "名前が空・空白だけ（E-VWS-001）／61 文字以上（E-VWS-002）／グループの全員に見せるのに見せるグループが無い・null（E-VWS-003）／条件・列の形か大きさが決まりの外（E-VWS-007）／名前の途中に制御文字（E-VWS-008）",
         "ears_form": f"UNWANTED: IF 名前か条件か見せるグループの指定が決まりに合わないなら、Kaname は 422 と欄つきの番号を返し、{_NOTHING}"},
    ],
}

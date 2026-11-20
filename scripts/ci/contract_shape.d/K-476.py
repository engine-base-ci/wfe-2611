# K-476 検索条件を直す口（updateSavedView）の契約の形の表に足す分（K-325 の断片）
# どの欄も無くてよい（送った欄だけを変える）。空の体は screen_api.d/K-476.py の INPUT_RULES の anyOf で契約に書き、口は 422 欄 body（K-476）
NO_REQUIRED_INPUTS = {"updateSavedView": "どの欄も無くてよい（送った欄だけを変える）。空の体は INPUT_RULES の anyOf で契約に書き、口は 422 欄 body・K-476"}
# 値域は 05_flow/screen_api.d/K-476.py の VALUE_RANGES と同じ字の写し。INPUT_RULES は screen_api.d だけに書く（K-355 と同じ）
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

# K-387 段・実績・保留を変える口（updateTicket）。送った欄だけを変えるので、どの欄も条件つき
NO_REQUIRED_INPUTS = {
    "updateTicket": "どの欄も条件つき（送った欄だけを変える。空の体は 422 欄 body・K-387）",
}

# 05_flow/screen_api.d/K-387.py と同じ値域（保留の理由と再開の条件は空白と制御文字だけでない字）
_NOT_BLANK = "^[^\\u0000]*[^\\s\\u0000-\\u001f\\u007f][^\\u0000]*$"
# K-483：期限・開始日・expected の日付と理由（05_flow/screen_api.d/K-387.py と同じ字）
_Y = r"(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})"
_LEAP = r"(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)"
_DATE = rf"^(?:{_Y}-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|{_Y}-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|{_Y}-02-(?:0[1-9]|1[0-9]|2[0-8])|{_LEAP}-02-29)$"
def _date(): return {"pattern": _DATE}
def _reason(): return {"maxLength": 200, "pattern": r"[^\s\u0000-\u001f\u007f-\u009f]"}
VALUE_RANGES = {
    "updateTicket": {"actual_minutes": {"minimum": 0, "maximum": 100000}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                     "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK},
                     "priority": {"enum": ["mid", "high"]}, "priority_reason": {"pattern": _NOT_BLANK},   # priority・priority_reason は K-440
                     "estimate_minutes": {"minimum": 0, "maximum": 100000},   # estimate_minutes は K-583
                     "due_on": _date(), "start_on": _date(), "expected_due_on": _date(), "expected_start_on": _date(), "due_reason": _reason(),   # K-483
                     "fields": {"minProperties": 1, "propertyNames": {"format": "uuid"},
                  "additionalProperties": {"anyOf": [{"type": "string"}, {"type": "number"}, {"type": "boolean"}, {"type": "array", "items": {"type": "string"}}], "nullable": True}}},   # fields は K-564
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES と INPUT_RULES（05_flow/screen_api.d/K-387.py）で契約に書いた（代表の答え answer=f0f290e785a9）

# K-387 段・実績・保留を変える口（updateTicket）。送った欄だけを変えるので、どの欄も条件つき
NO_REQUIRED_INPUTS = {
    "updateTicket": "どの欄も条件つき（送った欄だけを変える。空の体は 422 欄 body・K-387）",
}

# 05_flow/screen_api.d/K-387.py と同じ値域（保留の理由と再開の条件は空白と制御文字だけでない字）
_NOT_BLANK = "[^\\s\\u0000-\\u001f\\u007f]"
VALUE_RANGES = {
    "updateTicket": {"actual_minutes": {"minimum": 0, "maximum": 100000}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                     "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK}},
}

UNEXPRESSIBLE_422 = {
    "updateTicket": ["stage_id と stage_key の両方", "stage_key hold で保留の理由か再開の条件が無い（E-VAL-041・E-VAL-047）",
                     "stage_key todo・doing に保留の理由か再開の条件を付けた", "ほかの欄（E-VAL-018・前処理）", "空の体"],
}

# K-1006 運営の 1 社のまとまり（中を見る・止める・再開）の契約の形の表に足す分（K-325 の断片）
#   形（必須の欄・値域）の正本は 05_flow/screen_api.d/K-1006.py。口の振る舞いは後の葉（K-968・K-969・K-970）が書き、この表のとおりに 422 で断る
REQUIRED_INPUTS = {
    "openPeek": {"reason", "minutes"},            # 理由と分が無ければ 422（D-128.68）
    "stopWorkspace": {"reason_key", "mode"},      # 理由の種類と止め方が無ければ 422（D-156.23）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "openPeek": {"reason": {"minLength": 1, "maxLength": 200}, "minutes": {"minimum": 1, "maximum": 60}},
    "stopWorkspace": {"reason_key": {"enum": ["unpaid", "violation", "danger", "request"]}, "mode": {"enum": ["scheduled", "now"]},
                      "stop_on": {"format": "date"}, "note": {"minLength": 1, "maxLength": 500},
                      "admin_notice": {"minLength": 1, "maxLength": 2000}},
    "resumeWorkspace": {"note": {"minLength": 1, "maxLength": 500}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

# K-910 依頼を書く間に分身が聞く口（askPortalRequestQuestions）の契約の形の表に足す分（K-325 の断片）
#   必須の欄・値域は 05_flow/screen_api.d/K-910.py に書いた契約と同じ（口は apps/api/src/features/F11/portal/questions.ts の checkBody）。
#   ここで足す表は無い（6 つとも空）
REQUIRED_INPUTS = {
    "askPortalRequestQuestions": {"body"},   # screen_api.d/K-910.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "askPortalRequestQuestions": {"body": {"minLength": 1, "maxLength": 10000}},   # screen_api.d/K-910.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

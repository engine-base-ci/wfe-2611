# K-990 値段を変える案を決める・差し戻すの口の契約の形の表に足す分
#   形は 05_flow/screen_api.d/K-990.py に書いた（入力・必須・値の範囲・空白だけの 422）。ここに足す鍵は無いので、登録先の決まりが求める空の表を置く
REQUIRED_INPUTS = {
    "decidePlanProposal": {"notice_body"},   # screen_api.d/K-990.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "returnPlanProposal": {"reason"},   # screen_api.d/K-990.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "decidePlanProposal": {'notice_body': {'minLength': 1, 'maxLength': 2000}},   # screen_api.d/K-990.py の VALUE_RANGES と同じ（統合の枝で写した）
    "returnPlanProposal": {'reason': {'minLength': 1, 'maxLength': 500}},   # screen_api.d/K-990.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

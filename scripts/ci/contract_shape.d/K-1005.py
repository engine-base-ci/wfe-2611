# K-1005 の口の契約の形の表に足す分（統合の枝・05_flow/screen_api.d/K-1005.py の必須と値の範囲を写す・直しの担当 XC）
REQUIRED_INPUTS = {
    "changeOpsWorkspacePlan": {"inquiry_id", "plan_key"},   # screen_api.d/K-1005.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "changePlan": {"plan_key"},   # screen_api.d/K-1005.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "issueOpsInvoices": {"month"},   # screen_api.d/K-1005.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "recordPayment": {"amount", "paid_on"},   # screen_api.d/K-1005.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
    "updateBillingContact": {"attn", "company", "email"},   # screen_api.d/K-1005.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "recordPayment": {"amount": {"minimum": 1}, "paid_on": {"format": "date"}, "payer_name": {"minLength": 1, "maxLength": 100}},   # screen_api.d/K-1005.py の VALUE_RANGES と同じ（統合の枝で写した）
    "updateBillingContact": {"company": {"minLength": 1, "maxLength": 100, "pattern": "\\S"}, "attn": {"minLength": 1, "maxLength": 100, "pattern": "\\S"}, "email": {"format": "email"}},   # screen_api.d/K-1005.py の VALUE_RANGES と同じ（統合の枝で写した）
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

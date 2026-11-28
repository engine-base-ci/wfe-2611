# K-988 値段を変える案を作る・直す・回す口の契約の形の表に足す分（K-325 の断片）。
#   値の決まりと組み合わせは全部 VALUE_RANGES・INPUT_RULES に書いた（開いた案・同じ値段・状態は 409）ので、足す行は無い（空の表）
REQUIRED_INPUTS = {
    "createPlanProposal": {"existing_policy", "member_limit", "plan_key", "price_monthly", "reason"},   # screen_api.d/K-988.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
NO_REQUIRED_INPUTS = {
    "submitPlanProposal": '体の欄は読まない（回すのは行の状態だけで決まる）',
    "updatePlanProposal": '欄はどれも任意で、少なくとも 1 つ・組み合わせの決まりは入力の形の allOf（INPUT_RULES）が断る',
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

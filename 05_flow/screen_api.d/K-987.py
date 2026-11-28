# K-987 配るもの › プランの読む口 3 本（listOpsPlans・listPlanProposals・listPlanHistory）の答えの形と問い合わせの値の形。
#   入口は 3 本とも ops:any（本体の PERMS）で、値段の案か値段を決めるを持つかは DB の関数 app.ops_plan_caps_ok が見る（D-156.21・D-128.72）。
#   記録は plan_key で絞る（本体の QUERIES・plan_id はやめた）。振る舞いは apps/api/src/features/F12/ops/plans/read.ts と
#   DB の関数 app.ops_plans・app.ops_plan_proposals・app.ops_plan_history（20261128012700_ops_plans_read.sql）。
#   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける（頭の表 HEADERS は受ける頭なので足さない）

_PLAN_KEYS = ["free", "team", "business"]

RESPONSES = {
    # 値段の安い順。trial_days は今の版の無料期間の日数（K-1104・0 なら無し）。facts は { label, value } の並び（先頭は人数）。proposal は待っている案の短い形
    #   { id, state, to_version, price_monthly, proposer_name } か null
    "listOpsPlans": ("PlanOps", {"plan_key": "string", "name": "string?", "version": "integer", "price_monthly": "integer?",
                                 "member_limit": "integer", "trial_days": "integer", "facts": "array", "places": "integer", "proposal": "object?"}),
    # before・changes は { price_monthly, member_limit }（無料期間を変える案だけ trial_days も持つ・K-1104）。existing_policy は after_days・keep。proposer は { member_id, name }・decider は同じ形か null
    "listPlanProposals": ("PlanProposal", {"id": "uuid", "plan_key": "string", "plan_name": "string", "from_version": "integer?",
                                           "to_version": "integer?", "before": "object", "changes": "object",
                                           "existing_policy": "string", "notice_days": "integer?", "new_from": "string?",
                                           "reason": "string", "state": "string", "proposer": "object", "decider": "object?",
                                           "return_reason": "string?", "created_at": "string", "submitted_at": "string?",
                                           "decided_at": "string?", "can_edit": "boolean", "can_decide": "boolean"}),
    # action は plan.propose・plan.update・plan.submit・plan.return・plan.decide。price・members は { from, to } か null
    "listPlanHistory": ("PlanHistoryRow", {"id": "uuid", "at": "string", "actor_name": "string?", "action": "string",
                                           "plan_name": "string?", "to_version": "integer?", "reason": "string?",
                                           "price": "object?", "members": "object?"}),
}

QUERY_RANGES = {
    "listPlanProposals": {"state": {"enum": ["draft", "waiting", "decided", "returned"]}},
    "listPlanHistory": {"plan_key": {"enum": list(_PLAN_KEYS)}},
}

# 上限はチケットの G-16 どおり 60/min/user（運営の一覧の口と同じ・K-985・K-1010。GET の既定 120 にしない・K987-API-010）
RATES = {
    "listOpsPlans": "60/min/user",
}

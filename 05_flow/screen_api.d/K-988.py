# K-988 値段を変える案を作る・直す・決める人に回す口（createPlanProposal・updatePlanProposal・submitPlanProposal）
#   作る＝下書きの案（版は今の版 → 次の版）・理由は必須。直す＝作った人だけ・下書きか差し戻された案だけ（直すと下書きに戻る）。
#   回す＝作った人だけ・下書きを「決める人を待っている」に。答えは 3 本とも K-987 の案の 20 欄（PlanProposal）。
#   振る舞いの本体は apps/api/src/features/F12/ops/plans/write.ts（値の決まりは同じ字）と DB の関数 app.ops_plan_proposal_*（20261128012800_ops_plans_write.sql）

_PLAN_KEYS = ["free", "team", "business"]
_POLICIES = ["after_days", "keep"]   # N 日たってから・ずっと今の値段（D-128.72）
_EDITABLE = ["price_monthly", "member_limit", "existing_policy", "notice_days", "new_from", "reason"]

# 体は strict（知らない欄は 422）。new_from の null は決めたらすぐ
INPUTS = {
    "createPlanProposal": ("PlanProposalCreateInput", {"plan_key": "string", "price_monthly": "integer", "member_limit": "integer",
                                                       "existing_policy": "string", "notice_days": "integer", "new_from": "string?",
                                                       "reason": "string"}),
    "updatePlanProposal": ("PlanProposalUpdateInput", {"price_monthly": "integer", "member_limit": "integer", "existing_policy": "string",
                                                       "notice_days": "integer", "new_from": "string?", "reason": "string"}),
}

REQUIRED_INPUTS = {
    "createPlanProposal": ["plan_key", "price_monthly", "member_limit", "existing_policy", "reason"],   # 無いと 422（write.ts の checkCreate）
}

# 「30 日より短くできない」は minimum 30（D-128.72）。値段の上限 1,000 万円・人数の上限 1 万人は仮の守り（K-991 の画面の欄と合わせる）。
#   理由は前後の空白を落として 1〜1,000 字（空白だけは 422）
_RANGES = {
    "price_monthly": {"minimum": 0, "maximum": 10000000},
    "member_limit": {"minimum": 1, "maximum": 10000},
    "existing_policy": {"enum": list(_POLICIES)},
    "notice_days": {"minimum": 30, "maximum": 365},
    "new_from": {"format": "date"},
    "reason": {"minLength": 1, "pattern": "\\S"},
}
VALUE_RANGES = {
    "createPlanProposal": {"plan_key": {"enum": list(_PLAN_KEYS)}, **{k: dict(v) for k, v in _RANGES.items()}},
    "updatePlanProposal": {k: dict(v) for k, v in _RANGES.items()},
}

# 形全体の決まり（K-355 の形）：after_days なら notice_days が要る・keep なら notice_days を送らない。直すは 6 つのうち 1 つ以上（空の体は 422）
_AFTER_NEEDS_DAYS = {"not": {"properties": {"existing_policy": {"enum": ["after_days"]}}, "required": ["existing_policy"],
                             "not": {"required": ["notice_days"]}}}
_KEEP_NO_DAYS = {"not": {"properties": {"existing_policy": {"enum": ["keep"]}}, "required": ["existing_policy", "notice_days"]}}
INPUT_RULES = {
    "createPlanProposal": {"allOf": [_AFTER_NEEDS_DAYS, _KEEP_NO_DAYS]},
    "updatePlanProposal": {"allOf": [{"anyOf": [{"required": [k]} for k in _EDITABLE]}, _AFTER_NEEDS_DAYS, _KEEP_NO_DAYS]},
}

_PROPOSAL = {"id": "uuid", "plan_key": "string", "plan_name": "string", "from_version": "integer", "to_version": "integer",
             "before": "object", "changes": "object", "existing_policy": "string", "notice_days": "integer?", "new_from": "string?",
             "reason": "string", "state": "string", "proposer": "object", "decider": "object?", "return_reason": "string?",
             "created_at": "string", "submitted_at": "string?", "decided_at": "string?", "can_edit": "boolean", "can_decide": "boolean"}
RESPONSES = {
    "createPlanProposal": ("PlanProposal", dict(_PROPOSAL)),
    "updatePlanProposal": ("PlanProposal", dict(_PROPOSAL)),
    "submitPlanProposal": ("PlanProposal", dict(_PROPOSAL)),
}

_NOT_FOUND = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
              "trigger": "案が無い・消した（欄も details も付けない）",
              "ears_form": "UNWANTED: IF 無い案か消した案を指したなら、Kaname は 404 を返し、案も記録も変えない"}
_NOT_OWNER = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": [],
              "trigger": "案を作った人でない（入口の役と同じ形・欄なし）",
              "ears_form": "UNWANTED: IF 案を作った人でないなら、Kaname は 403 を返し、案も記録も変えない"}
_STATE = {"status": 409, "code": "E-OPS-021", "body": {"error": "conflict", "code": "E-OPS-021"}, "errors": ["E-OPS-021"],
          "trigger": "直すは下書きか差し戻された案でない・回すは下書きでない（2 回目に回したのも）。欄も details も付けない",
          "ears_form": "UNWANTED: IF いま直せない・回せない状態の案なら、Kaname は 409 と E-OPS-021 を返し、案も記録も変えない"}
_NO_CHANGE = {"status": 409, "code": "E-OPS-020", "body": {"error": "conflict", "code": "E-OPS-020"}, "errors": ["E-OPS-020"],
              "trigger": "値段と人数が今のプランと同じ（作るも直した後も）。欄も details も付けない",
              "ears_form": "UNWANTED: IF 値段と人数が今のプランと同じなら、Kaname は 409 と E-OPS-020 を返し、案も記録も変えない"}
ERRORS_4XX = {
    "createPlanProposal": [
        {"status": 409, "code": "E-OPS-019", "body": {"error": "conflict", "code": "E-OPS-019"}, "errors": ["E-OPS-019"],
         "trigger": "そのプランにもう開いた案（下書き・待っている）が在る（同時に 2 回作った後の 1 つも）。欄も details も付けない",
         "ears_form": "UNWANTED: IF そのプランに開いた案が在るなら、Kaname は 409 と E-OPS-019 を返し、案も記録も増やさない"},
        _NO_CHANGE,
    ],
    "updatePlanProposal": [_NOT_FOUND, _NOT_OWNER, _STATE, _NO_CHANGE],
    "submitPlanProposal": [_NOT_FOUND, _NOT_OWNER, _STATE],
}

# K-990 値段を変える案を決める口・差し戻す口（decidePlanProposal・returnPlanProposal・D-128.72・D-156.12・D-156.17・D-156.28・D-156.33・D-156.57）
#   入口は本体の PERMS のまま（どちらも ops:plan_decide・決めるは本人確認の取り直し）。関連は本体の SCREEN_API（差し戻すは鈴を出さない）。
#   振る舞いは apps/api/src/features/F12/ops/plans/decide.ts と DB の関数 app.ops_plan_decide・app.ops_plan_return
#   （20261128013000_ops_plans_decide.sql）。答えは案の 1 行で、形は K-987 の PlanProposal を名前で指す（欄を写さない）

# 決める＝お知らせの文だけ・差し戻す＝理由だけ（ほかの欄は 422・strict）
INPUTS = {
    "decidePlanProposal": ("PlanProposalDecideInput", {"notice_body": "string"}),
    "returnPlanProposal": ("PlanProposalReturnInput", {"reason": "string"}),
}

RESPONSES = {
    "decidePlanProposal": "PlanProposal",
    "returnPlanProposal": "PlanProposal",
}

# 作らず決めるだけなので、POST でも 200（チケットの行と試験も 200）
SUCCESS_STATUS = {"decidePlanProposal": 200, "returnPlanProposal": 200}

REQUIRED_INPUTS = {
    "decidePlanProposal": ["notice_body"],
    "returnPlanProposal": ["reason"],
}

VALUE_RANGES = {
    "decidePlanProposal": {"notice_body": {"minLength": 1, "maxLength": 2000}},
    "returnPlanProposal": {"reason": {"minLength": 1, "maxLength": 500}},
}

# 空白だけは 422（前後の空白は DB の関数が落として残す）
INPUT_RULES = {
    "decidePlanProposal": {"allOf": [{"properties": {"notice_body": {"pattern": "\\S"}}}]},
    "returnPlanProposal": {"allOf": [{"properties": {"reason": {"pattern": "\\S"}}}]},
}

_NOT_FOUND = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
              "trigger": "無い id・消した案（有ることも漏らさない）。欄・details は付けない"}
_STATE = {"status": 409, "code": "E-OPS-021", "body": {"error": "conflict", "code": "E-OPS-021"}, "errors": ["E-OPS-021"],
          "trigger": "案が待っている（waiting）でない（下書き・決めた・差し戻した・同時に 2 回の後の方）。欄なし"}
_SELF = {"status": 409, "code": "E-OPS-022", "body": {"error": "conflict", "code": "E-OPS-022"}, "errors": ["E-OPS-022"],
         "trigger": "呼んだ人が作った人で、値段を決めるを持つ生きている運営の人がほかにも居る（1 人だけの間は例外・D-128.72）。欄なし"}

ERRORS_4XX = {
    "decidePlanProposal": [
        {**_NOT_FOUND, "ears_form": "UNWANTED: IF 無い案か消した案を決めようとしたなら、Kaname は 404 を返し、欄を付けない"},
        {**_STATE, "ears_form": "UNWANTED: IF 待っていない案を決めようとしたなら、Kaname は 409 と E-OPS-021 を返し、版の行もお知らせも作らない"},
        {**_SELF, "ears_form": "UNWANTED: IF ほかに値段を決める人が居るのに自分の案を決めようとしたなら、Kaname は 409 と E-OPS-022 を返し、案を待っているのまま残す"},
    ],
    "returnPlanProposal": [
        {**_NOT_FOUND, "ears_form": "UNWANTED: IF 無い案か消した案を差し戻そうとしたなら、Kaname は 404 を返し、欄を付けない"},
        {**_STATE, "ears_form": "UNWANTED: IF 待っていない案を差し戻そうとしたなら、Kaname は 409 と E-OPS-021 を返し、案を変えない"},
        {**_SELF, "ears_form": "UNWANTED: IF ほかに値段を決める人が居るのに自分の案を差し戻そうとしたなら、Kaname は 409 と E-OPS-022 を返し、案を待っているのまま残す"},
    ],
}

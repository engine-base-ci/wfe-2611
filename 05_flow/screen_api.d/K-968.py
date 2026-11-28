# K-968 運営が 1 社のプランと請求を読む口（getOpsWorkspaceBilling）と、頼まれたときに代わりにプランを変える口（changeOpsWorkspacePlan）
#   契約の形（読む 4 欄・変えるの入力 plan_key・inquiry_id と答えの 4 欄）は K-1005 の断片が持つ。この葉は振る舞いと 404・409 を足す
#   振る舞いの本体は apps/api/src/features/F12/ops/workspace-billing.ts（DB の関数 app.ops_workspace_billing・app.ops_workspace_plan_change）
#   409 の番号は K-961 の errors.d（E-PLAN-001・E-PLAN-002）を使う（足さない）
ERRORS_4XX = {
    "getOpsWorkspaceBilling": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "会社が無い・消した・作りかけ・運営の会社（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 指した会社が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさない"},
    ],
    "changeOpsWorkspacePlan": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": ["E-PAGE-001"],
         "trigger": "会社が無い・見えない・頼まれた問い合わせがその会社の消していない物でない（NOT_FOUND）・プランの鍵が無い・消したプラン（E-PAGE-001）。どれも欄も details も付けない",
         "ears_form": "UNWANTED: IF 会社・プラン・頼まれた問い合わせが無いか見えないなら、Kaname は 404 を返し、契約も頼みの行も記録も変えない"},
        {"status": 409, "code": "E-PLAN-001", "body": {"error": "conflict", "code": "E-PLAN-001"}, "errors": ["E-PLAN-001", "E-PLAN-002"],
         "trigger": "今のプランを選んだ（下げる予定が無いとき）（E-PLAN-001）・人数が選んだプランの上限を超える（E-PLAN-002・detail に members と member_limit）",
         "ears_form": "UNWANTED: IF 今のプランか人数が上限を超えるプランを選んだなら、Kaname は 409 と E-PLAN-001／E-PLAN-002 を返し、契約も頼みの行も記録も変えない"},
    ],
}

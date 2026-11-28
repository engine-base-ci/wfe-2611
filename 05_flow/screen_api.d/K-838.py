# K-838 ワークスペースから抜ける口 leaveWorkspace（DELETE /me/workspaces/:id・:id は抜ける会社の id）
#   体は受けない。本人確認は契約の stepUp: "always" のまま（入口が 403・STEP_UP_REQUIRED）。道の id の形は入口の 422
#   答え：抜けた会社の id・left・30 日の戻れる期限（D-154.26・K-817 が招き直しで読む）
RESPONSES = {
    "leaveWorkspace": ("WorkspaceLeft", {"tenant_id": "uuid", "left": "boolean", "restorable_until": "string"}),
}

# 404 は入っていない・もう抜けた・無い・別の人の会社（同じ答え・欄・details なし）。409 は抜けられない 2 つ（最後の管理者が先）
ERRORS_4XX = {
    "leaveWorkspace": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "同じログインが入っていない会社・もう抜けた会社・無い会社・別の人の会社（在るかを漏らさない・欄・details は付けない）",
         "ears_form": "UNWANTED: IF 同じログインが入っていない会社から抜けようとしたなら、Kaname は 404 を返し、何も書かない"},
        {"status": 409, "code": "E-ME-050", "body": {"error": "conflict", "code": "E-ME-050"}, "errors": ["E-ME-050"],
         "trigger": "その会社で自分が担当の終わっていないチケットが残っている（渡し中も担当のまま）",
         "ears_form": "UNWANTED: IF その会社に担当しているチケットが残っているなら、Kaname は 409 と E-ME-050 を返し、何も書かない"},
        {"status": 409, "code": "E-ME-051", "body": {"error": "conflict", "code": "E-ME-051"}, "errors": ["E-ME-051"],
         "trigger": "その会社の有効な管理者が自分だけ（止めた管理者は数えない・自分だけの会社も同じ・担当が残っていてもこちらが先）",
         "ears_form": "UNWANTED: IF その会社の最後の管理者が抜けようとしたなら、Kaname は 409 と E-ME-051 を返し、何も書かない"},
    ],
}

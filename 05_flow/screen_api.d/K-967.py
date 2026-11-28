# K-967 運営が 1 社のメンバーに本人確認のメールを送り直す口（resendOpsVerification）
#   契約の形（空の体 {}・答え { sent_at }）は K-1006 の断片が持つ。この葉は振る舞いと 404・409 を足す
#   振る舞いの本体は apps/api/src/features/F12/ops/resend-verification.ts（DB の関数 app.ops_resend_verification_prepare・関門 C6 の NotifyGateway）
ERRORS_4XX = {
    "resendOpsVerification": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "会社が無い・消した・作りかけ・運営の会社・その会社のメンバーでない・抜けた・認証の人が無い（AI 社員）・無い人（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 指した会社かメンバーが無いか見えないなら、Kaname は 404 を返し、メールを送らず記録も残さない"},
        {"status": 409, "code": "E-CONF-039", "body": {"error": "conflict", "code": "E-CONF-039"}, "errors": ["E-CONF-039"],
         "trigger": "その人はもう本人確認が済んでいる（認証の人の emailVerified が真）",
         "ears_form": "UNWANTED: IF もう本人確認が済んだ人に送り直そうとしたなら、Kaname は 409 と E-CONF-039 を返し、メールを送らず記録も残さない"},
    ],
}

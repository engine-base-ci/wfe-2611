# K-989 値段を変える案の影響を見る口（getPlanProposalImpact・D-128.72・D-156.12・D-156.17）
# 答えの形（7 欄）と入口の印（ops:any・値段の印は関数の中で見る）は本体 05_flow/screen_api.py の RESPONSES・PERMS に書いた。ここは住所だけ：
#   無い・消した案は 404（欄・details なし）・上限は 60/min/user（K989-API-010）
#   Cache-Control: private, no-store は口（apps/api/src/features/F12/ops/plans/impact.ts）が付ける（本体の HEADERS は受ける頭の表なのでここには書かない）

RATES = {
    "getPlanProposalImpact": "60/min/user",
}

ERRORS_4XX = {
    "getPlanProposalImpact": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "無い id・消した案（有ることも漏らさない）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 無い案か消した案の影響を見ようとしたなら、Kaname は 404 を返し、欄を付けない"},
    ],
}

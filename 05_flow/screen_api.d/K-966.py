# K-966（getOpsWorkspace・listOpsWorkspaceMembers）
#   答えの形は K-1006 の断片が持つ。この葉が足すのは、2 本の 404（指した会社が無い・見えない）だけ（K-947 の opsErrorReply・P0002）
ERRORS_4XX = {
    "getOpsWorkspace": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "指した会社が無い・運営の会社・作りかけ・消した会社（app.ops_target が P0002）",
         "ears_form": "UNWANTED: IF 指した会社が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず欄も details も付けない"},
    ],
    "listOpsWorkspaceMembers": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "指した会社が無い・運営の会社・作りかけ・消した会社（app.ops_target が P0002）",
         "ears_form": "UNWANTED: IF 指した会社が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず欄も details も付けない"},
    ],
}

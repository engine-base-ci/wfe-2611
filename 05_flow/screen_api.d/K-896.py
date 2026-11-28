# K-896 分身の案の仕事を出す口（requestClientRequestDraft）
#   体は受けない（道の :id が依頼）。押した人自身の PC がつながっているときだけ、その人の PC に案の仕事を 1 回積む（D-155.11・D-128.101）
#   見える・直せるの判定は DB の関数（K-892 の app.client_request_visible/actable）。見えなければ 404・E-GST-100（K-892 の番号・在るかを漏らさない）
#   決まった依頼は 409・E-GST-140・PC がつながっていないは 409・E-GST-141・作っている／出来ているは 409・E-GST-142
SCREEN_API = {
    "requests": [
        ("POST", "/client_requests/:id/draft", "A122", "client_requests", "requestClientRequestDraft", ["bridge_jobs", "audit_events"]),
    ],
}

PERMS = {
    "requestClientRequestDraft": ("write", "届け先で client_requests を edit できる人。押した人自身の PC に積む", False),
}

INPUTS = {
    "requestClientRequestDraft": ("ClientRequestDraftInput", {}),
}

RESPONSES = {
    "requestClientRequestDraft": ("ClientRequestDraftQueued", {"job_id": "uuid"}),
}

ERRORS_4XX = {
    "requestClientRequestDraft": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "読むだけの人（届け先で edit できない人）・ゲストの文脈",
         "ears_form": "UNWANTED: IF 依頼を直せない人が案を作ろうとしたなら、Kaname は 403 を返し、仕事も依頼の変更も証跡も作らない"},
        {"status": 404, "code": "E-GST-100", "body": {"error": "not_found", "code": "E-GST-100"}, "errors": ["E-GST-100"],
         "trigger": "依頼が無い・見えない・消した・別の会社の物・前の取引先の形の物（在るかを漏らさない・欄と details なし）",
         "ears_form": "UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、在るかを漏らさず何も積まない"},
        {"status": 409, "code": "E-GST-140", "body": {"error": "conflict", "code": "E-GST-140"}, "errors": ["E-GST-140"],
         "trigger": "依頼がもう決まっている（チケットにした・断った）",
         "ears_form": "UNWANTED: IF 依頼がもう決まっているなら、Kaname は 409 と E-GST-140 を返し、仕事を積まない"},
        {"status": 409, "code": "E-GST-141", "body": {"error": "conflict", "code": "E-GST-141"}, "errors": ["E-GST-141"],
         "trigger": "押した人に生きている PC が無い（PC が無い・失効した・最後の知らせが 75 秒より前・別の人の PC だけ）",
         "ears_form": "UNWANTED: IF 押した人の PC がつながっていないなら、Kaname は 409 と E-GST-141 を返し、仕事も依頼の変更も作らない"},
        {"status": 409, "code": "E-GST-142", "body": {"error": "conflict", "code": "E-GST-142"}, "errors": ["E-GST-142"],
         "trigger": "案をもう作っている（pending で 10 分以内）・もう出来ている（ready）",
         "ears_form": "UNWANTED: IF 案をもう作っているか出来ているなら、Kaname は 409 と E-GST-142 を返し、仕事を増やさない"},
    ],
}

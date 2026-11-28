# K-836 入っている端末：listMySessions・revokeMySession・revokeOtherSessions（D-128.156・D-154.79）
# 一覧：同じログインの全部のワークスペースの生きている端末（今の端末を先頭）と、最近の安全の記録 10 件（events）。頁に分けない（多くても十数行）
# 1 つ切る：200 { revoked: true }。今の端末は 409・E-ME-030。無い・切ってある・ほかの人の端末は同じ 404
# すべて切る：201 { revoked: <切った端末の数> }。体は受けない（strict）。切る 2 口は本人確認の取り直しが要る（本体の PERMS の印）
INPUTS = {
    "revokeOtherSessions": ("MySessionsRevokeInput", {}),
}

RESPONSES = {
    "listMySessions": ("MySessions", {"sessions": "array", "events": "array"}),
    "revokeMySession": ("MySessionRevoked", {"revoked": "boolean"}),
    "revokeOtherSessions": ("MySessionsRevoked", {"revoked": "integer"}),
}

QUERIES = {"listMySessions": []}

ERRORS_4XX = {
    "revokeMySession": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 本人確認の取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、どの端末も切らない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "自分のログインの生きている端末でない（無い・切ってある・ほかの人・別の会社の人の端末）",
         "ears_form": "UNWANTED: IF 自分のログインの生きている端末でないなら、Kaname は 404 を返し、どの端末も切らない"},
        {"status": 409, "code": "E-ME-030", "body": {"error": "conflict", "code": "E-ME-030"}, "errors": ["E-ME-030"],
         "trigger": "今の端末を切ろうとした（E-ME-030）",
         "ears_form": "UNWANTED: IF 今の端末を切ろうとしたなら、Kaname は 409 と E-ME-030 を返し、端末を切らない"},
    ],
    "revokeOtherSessions": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 本人確認の取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、どの端末も切らない"},
    ],
}

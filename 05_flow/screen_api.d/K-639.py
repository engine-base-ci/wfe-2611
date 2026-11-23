# K-639 記憶・接続コードの引き取りの契約の形に足す分（契約 fuzz G36 の ST202：形どおりの入力が断られた）
# 形の誤りは契約に書き、DB の中身で決まる断りは 422 にしない（404・409）。控え帳 2026-11-20 16:51・2026-11-21 01:55
INPUT_RULES = {
    # 覚えることは文字で来る（null は 422）。入口の zod は null を通し、口（apps/api/src/hooks/agent.ts）が「覚えることが空です」で断る。契約は口と同じに null を外す
    "updateMemory": {"allOf": [{"properties": {"body": {"type": "string"}}}]},
    # 記憶を作る口も同じ：覚えること（body）が null は 422（口が断る・欄 body）。無いのは 201。実物（K-424 の G36）の失敗は POST も PATCH も body が null だった
    "createMemory": {"allOf": [{"properties": {"body": {"type": "string"}}}]},
}
# 引き取り：形どおりの接続コードが DB で使えない（違う・期限切れ・使い終わった・出し直す前）は 404 E-CONN-013（どれかを見分けさせない）
ERRORS_4XX = {
    "claimPairingCode": [
        {"status": 404, "code": "E-CONN-013", "body": {"error": "not_found", "code": "E-CONN-013"}, "errors": ["E-CONN-013"],
         "trigger": "形どおりの接続コードが使えない（違う・期限切れ・使い終わった・出し直す前。どれかを見分けさせない・D-089）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 接続コードが使えないなら、Kaname は 404 と E-CONN-013 を返し、PC を作らず、どの理由かを漏らさない"},
    ],
}

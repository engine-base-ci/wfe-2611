# K-759 書きながらの返事を流す口（streamConversation）の断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/stream.ts（openChangeStream）と apps/api/src/hooks/talk-stream.ts。
#   流れの答え（RAW_200・RAW_200_TYPES の text/event-stream）と PERMS の説明は本体 05_flow/screen_api.py の前からある行を直した。
#   体を受けない GET なので INPUTS・REQUIRED_INPUTS は足さない。汎用の 401・403・429 は作り手が足す
ERRORS_4XX = {
    "streamConversation": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "他人・別の会社・無い・消した会話（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 自分の会話でないか無い会話の流れを開いたなら、Kaname は 404 を返し、在るかを漏らさず流れを開かない"},
        {"status": 503, "code": "E-TALK-020", "body": {"error": "unavailable", "code": "E-TALK-020"}, "errors": ["E-TALK-020"],
         "trigger": "知らせの接続が無い・つなげない・ログインの確かめの手段が無い",
         "ears_form": "UNWANTED: IF 知らせの接続が無いかつなげないなら、Kaname は 503 と E-TALK-020 を返し、流れを開かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "会話の持ち主を確かめる DB が落ちた",
         "ears_form": "UNWANTED: IF 会話の持ち主を確かめる DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、流れを開かない"},
    ],
}
UNEXPRESSIBLE_422: dict = {}

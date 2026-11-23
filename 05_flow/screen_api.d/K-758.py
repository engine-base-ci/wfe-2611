# K-758 自分の AI に言う口（sendConversationMessage）と止める口（stopConversation）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/say.ts（DB の関数 app.clone_talk_say・app.talk_stop・0 から作った 20261125023800）。
#   「使う表」と PERMS の説明は本体 05_flow/screen_api.py の前からある行を直した。
#   言う口の体は text だけ（引用・添付・許可のモード・分岐・場所の文脈は受けない・D-153.16）。字は書いたとおりに残す（長さの上限は書かない・D-130.3）
INPUTS = {
    "sendConversationMessage": ("ConversationSay", {"text": "string"}),
    # 止める口は中身を受けない：空の体 {} だけ（体なしは入口が 422 body・欄を付けると strict で 422）
    "stopConversation": ("ConversationStopInput", {}),
}
VALUE_RANGES = {
    "sendConversationMessage": {"text": {"pattern": "\\S"}},   # 前後の空白（全角の空白を含む）だけの字は 422
}
REQUIRED_INPUTS = {
    "sendConversationMessage": ["text"],
}
RESPONSES = {
    # 言った答え（鍵ちょうど 3）：人の言葉の行の id・会話・PC が取りに来る仕事
    "sendConversationMessage": ("ConversationSaid", {"id": "string", "conversation_id": "string", "job_id": "string"}),
    # 止めた答え：stopping（動いている物に合図）・cancelled（待っている物だけを取りやめた）・none（止める物が無い）
    "stopConversation": ("ConversationStopped", {"state": "string"}),
}
_NOT_FOUND = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
              "trigger": "自分の会話でない（同じグループの別の人・別の会社）・無い・消した会話（欄も details も付けない）",
              "ears_form": "UNWANTED: IF 自分の会話でないか無い会話に言う・止めるなら、Kaname は 404 を返し、在るかを漏らさず何も変えない"}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "言う・止める DB の関数が落ちた（使えない・例外・証跡が書けない）",
         "ears_form": "UNWANTED: IF 言う・止める DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない"}
ERRORS_4XX = {
    "sendConversationMessage": [
        dict(_NOT_FOUND),
        {"status": 409, "code": "E-TALK-010", "body": {"error": "conflict", "code": "E-TALK-010"}, "errors": ["E-TALK-010"],
         "trigger": "つながっている自分の PC が無い（外した・まだつないでいない。別の人の PC は数えない）",
         "ears_form": "UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-010 を返し、行も仕事も作らない"},
        {"status": 409, "code": "E-TALK-011", "body": {"error": "conflict", "code": "E-TALK-011"}, "errors": ["E-TALK-011"],
         "trigger": "自分の AI との会話でない会話（チケットの会話・作る画面の会話）にこの口から言った",
         "ears_form": "UNWANTED: IF 自分の AI との会話でない会話にこの口から言うなら、Kaname は 409 と E-TALK-011 を返し、何も変えない"},
        {"status": 409, "code": "E-TALK-012", "body": {"error": "conflict", "code": "E-TALK-012"}, "errors": ["E-TALK-012"],
         "trigger": "1 つの会話で待っている仕事が 20 ある（終わった・止まった・取りやめた仕事は数えない）",
         "ears_form": "UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "text が無い・空・空白だけ（全角も）・文字でない／契約に無い項目（quote・attachment_ids・permission_mode・context・branch_from ほか）",
         "ears_form": "UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない"},
        dict(_DOWN),
    ],
    "stopConversation": [
        dict(_NOT_FOUND),
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "体が無い・JSON でない・空の体 {} でない（欄を付けた）",
         "ears_form": "UNWANTED: IF 止める口の体が空の {} でないなら、Kaname は 422 を返し、何も止めない"},
        dict(_DOWN),
    ],
}

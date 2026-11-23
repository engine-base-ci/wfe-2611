# K-763 チケットの中で話す口（getTicketAgentSession・sendTicketAgentMessage）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/ticket.ts（DB の関数 app.ticket_talk_conversation・app.ticket_talk_say・20261125024300）。
#   本体 05_flow/screen_api.py の口の行と PERMS（読む read・言う write）はそのまま。
#   言う口の体は text だけ（引用・添付・許可のモード・前の道すじの欄は受けない・D-153.16）。字は書いたとおりに残す（長さの上限は書かない・D-130.3）
INPUTS = {
    "sendTicketAgentMessage": ("TicketAgentMessageInput", {"text": "string"}),
}
VALUE_RANGES = {
    "sendTicketAgentMessage": {"text": {"pattern": "\\S"}},   # 前後の空白（全角の空白を含む）だけの字は 422
}
REQUIRED_INPUTS = {
    "sendTicketAgentMessage": ["text"],
}
RESPONSES = {
    # そのチケットの自分の会話の今（鍵ちょうど 6・K-757 の ConversationView と同じ鍵）。会話がまだ無ければ conversation が null・messages が空
    "getTicketAgentSession": ("TicketAgentSession", {"conversation": "object?", "messages": "array", "has_more": "boolean",
                                                     "running_job_id": "uuid?", "work": "object?", "stopped": "object?"}),
    # 言った答え（鍵ちょうど 3）：人の言葉の行の id・会話・PC が取りに来る仕事
    "sendTicketAgentMessage": ("TicketAgentSent", {"id": "uuid", "conversation_id": "uuid", "job_id": "uuid"}),
}
_NOT_FOUND = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
              "trigger": "チケットが見えない（見えない人・別の会社）・無い・消したチケット（欄も details も付けない）",
              "ears_form": "UNWANTED: IF 見えないか無いチケットの会話を開く・言うなら、Kaname は 404 を返し、在るかを漏らさず何も変えない"}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "チケットの会話を読む・言う DB の関数が落ちた（使えない・例外・証跡が書けない・文脈が組めない）",
         "ears_form": "UNWANTED: IF チケットの会話を読む・言う DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない"}
ERRORS_4XX = {
    "getTicketAgentSession": [dict(_NOT_FOUND), dict(_DOWN)],
    "sendTicketAgentMessage": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": [],
         "trigger": "チケットは見えるが書けない（見るだけの人・担当が替わった前の担当者・書く権限を外された人）",
         "ears_form": "UNWANTED: IF チケットが見えるが書けない人が言うなら、Kaname は 403 を返し、会話も仕事も作らない"},
        dict(_NOT_FOUND),
        {"status": 409, "code": "E-TALK-050", "body": {"error": "conflict", "code": "E-TALK-050"}, "errors": ["E-TALK-050"],
         "trigger": "つながっている自分の PC が無い（まだつないでいない・外した）",
         "ears_form": "UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-050 を返し、作りかけの会話ごと戻して何も残さない"},
        {"status": 409, "code": "E-TALK-012", "body": {"error": "conflict", "code": "E-TALK-012"}, "errors": ["E-TALK-012"],
         "trigger": "このチケットの自分の会話で待っている仕事が 20 ある（終わった・止まった・取りやめた仕事は数えない）",
         "ears_form": "UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "text が無い・空・空白だけ（全角も）・文字でない／契約に無い項目（conversation_id・quote・attachment_ids・permission_mode ほか）",
         "ears_form": "UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない"},
        dict(_DOWN),
    ],
}

# 答えの conversation_id・job_id は null にならない（messages の列は null 可・K144-SHAPE-013）。DB の関数 app.ticket_talk_say（中で app.talk_enqueue） が会話の id と作った仕事の id を入れて返し、
#   作れなければ error で断る（答えの 201 に null は出ない）
NOT_NULL_ANSWERS = {
    "sendTicketAgentMessage.conversation_id": "DB の関数 app.ticket_talk_say（中で app.talk_enqueue） が会話の id を入れて返し、会話が無ければ error で断る（messages.conversation_id は null 可）",
    "sendTicketAgentMessage.job_id": "DB の関数 app.ticket_talk_say（中で app.talk_enqueue） が作った仕事の id を返し、作れなければ no_pc ほかの error で断る（messages.job_id は null 可）",
}

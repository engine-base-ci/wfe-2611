# K-774 作る画面の会話の口（startDraftConversation・sendDraftMessage）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/draft.ts（DB の関数 app.draft_talk_start・app.draft_talk_say・20261125025400）。
#   口の行と PERMS（どちらも self）は本体 05_flow/screen_api.py の clone-chat の束に足した。
#   言う口の体は text・draft（欄の今の中身）・edited（人が直した欄）だけ。本文と言った字の長さの上限は書かない（D-130.3）
INPUTS = {
    # 始める口は中身を受けない（体なし・空の体 {} だけ。知らない項目は入口が 422）
    "startDraftConversation": ("DraftConversationStartInput", {}),
    "sendDraftMessage": ("DraftMessageInput", {"text": "string", "draft": "object", "edited": "string[]?"}),
}
VALUE_RANGES = {
    "sendDraftMessage": {
        "text": {"pattern": "\\S"},   # 前後の空白（全角の空白を含む）だけの字は 422
        # 欄の今の中身：題 200 字まで・確認項目 50 件まで・1 件 200 字まで（K-437・K-434・D-150.28）。本文は上限なし
        "draft": {"type": "object",
                  "properties": {"title": {"type": "string", "maxLength": 200}, "body": {"type": "string"},
                                 "checks": {"type": "array", "maxItems": 50, "items": {"type": "string", "maxLength": 200}}},
                  "required": ["title", "body", "checks"], "additionalProperties": False},
        "edited": {"type": "array", "maxItems": 3, "uniqueItems": True, "items": {"enum": ["title", "body", "checks"]}},
    },
}
REQUIRED_INPUTS = {
    "sendDraftMessage": ["text", "draft"],
}
RESPONSES = {
    "startDraftConversation": ("DraftConversationStarted", {"id": "uuid"}),
    # 言った答え（鍵ちょうど 3）：人の言葉の行の id・会話・PC が取りに来る仕事
    "sendDraftMessage": ("DraftMessageSent", {"id": "uuid", "conversation_id": "uuid", "job_id": "uuid"}),
}
_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": [],
              "trigger": "会社のメンバーとして使えない人（停止された人・外された人）",
              "ears_form": "UNWANTED: IF 停止された人が作る画面の会話を始める・言うなら、Kaname は 403 を返し、何も作らない"}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "作る画面の会話を始める・言う DB の関数が落ちた（使えない・例外・証跡が書けない・文脈が組めない）",
         "ears_form": "UNWANTED: IF 作る画面の会話を始める・言う DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない"}
ERRORS_4XX = {
    "startDraftConversation": [dict(_FORBIDDEN), dict(_DOWN)],
    "sendDraftMessage": [
        dict(_FORBIDDEN),
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "自分の会話でない（同じグループの別の人・別の会社）・無い・消した会話（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 自分の会話でないか無い会話に言うなら、Kaname は 404 を返し、在るかを漏らさず何も変えない"},
        {"status": 409, "code": "E-TALK-060", "body": {"error": "conflict", "code": "E-TALK-060"}, "errors": ["E-TALK-060"],
         "trigger": "つながっている自分の PC が無い（まだつないでいない・外した）",
         "ears_form": "UNWANTED: IF つながっている自分の PC が無いなら、Kaname は 409 と E-TALK-060 を返し、行も仕事も作らない"},
        {"status": 409, "code": "E-TALK-061", "body": {"error": "conflict", "code": "E-TALK-061"}, "errors": ["E-TALK-061"],
         "trigger": "作る画面の会話でない会話（自分の AI との会話・チケットに移った会話）に言った",
         "ears_form": "UNWANTED: IF 作る画面の会話でない会話に言うなら、Kaname は 409 と E-TALK-061 を返し、何も積まない"},
        {"status": 409, "code": "E-TALK-012", "body": {"error": "conflict", "code": "E-TALK-012"}, "errors": ["E-TALK-012"],
         "trigger": "1 つの会話で待っている仕事が 20 ある（終わった・止まった・取りやめた仕事は数えない）",
         "ears_form": "UNWANTED: IF 1 つの会話で待っている仕事が 20 あるなら、Kaname は 409 と E-TALK-012 を返し、21 個目を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "text が無い・空・空白だけ・文字でない／draft が無い・形が違う・題 201 字・確認項目 51 件・1 件 201 字／edited に知らない値・重なり／契約に無い項目",
         "ears_form": "UNWANTED: IF 言う体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない"},
        dict(_DOWN),
    ],
}

# 答えの conversation_id・job_id は null にならない（messages の列は null 可・K144-SHAPE-013）。DB の関数 app.draft_talk_say（中で app.talk_enqueue） が会話の id と作った仕事の id を入れて返し、
#   作れなければ error で断る（答えの 201 に null は出ない）
NOT_NULL_ANSWERS = {
    "sendDraftMessage.conversation_id": "DB の関数 app.draft_talk_say（中で app.talk_enqueue） が会話の id を入れて返し、会話が無ければ error で断る（messages.conversation_id は null 可）",
    "sendDraftMessage.job_id": "DB の関数 app.draft_talk_say（中で app.talk_enqueue） が作った仕事の id を返し、作れなければ no_pc ほかの error で断る（messages.job_id は null 可）",
}

# K-776 作った後に会話をチケットへ移す口（adoptDraftConversation・POST /api/v1/ticket_draft_conversations/:id/adopt）の行・入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/adopt.ts（DB の関数 app.draft_adopt・20261125025600）。作る口 createTicket（K-437）は変えない
SCREEN_API = {
    "clone-chat": [
        ("POST", "/ticket_draft_conversations/:id/adopt", "A99|A20", "conversations", "adoptDraftConversation", ["messages", "tickets"]),
    ],
}
PERMS = {
    "adoptDraftConversation": ("self", "作る画面の会話の持ち主で、そのチケットを作った人だけ", False),
}
INPUTS = {
    "adoptDraftConversation": ("ConversationAdoptInput", {"ticket_id": "uuid"}),
}
REQUIRED_INPUTS = {
    "adoptDraftConversation": ["ticket_id"],
}
RESPONSES = {
    # 移した答え（鍵ちょうど 2）：会話の id（変わらない）と移した先のチケット
    "adoptDraftConversation": ("ConversationAdopted", {"conversation_id": "uuid", "ticket_id": "uuid"}),
}
ERRORS_4XX = {
    "adoptDraftConversation": [
        {"status": 403, "code": "E-TALK-080", "body": {"error": "forbidden", "code": "E-TALK-080"}, "errors": ["E-TALK-080"],
         "trigger": "そのチケットを作った人でない人（担当者を含む）が移そうとした",
         "ears_form": "UNWANTED: IF そのチケットを作った人でない人が会話を移すなら、Kaname は 403 と E-TALK-080 を返し、何も変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "会話が自分の物でない・無い・消した／チケットが無い・消した・別の会社・見えない（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 自分の会話でないか、無いか見えないチケットへ移すなら、Kaname は 404 を返し、在るかを漏らさず何も変えない"},
        {"status": 409, "code": "E-TALK-081", "body": {"error": "conflict", "code": "E-TALK-081"}, "errors": ["E-TALK-081"],
         "trigger": "作る画面の会話でない会話（自分の AI との会話）を移そうとした",
         "ears_form": "UNWANTED: IF 作る画面の会話でない会話を移すなら、Kaname は 409 と E-TALK-081 を返し、何も変えない"},
        {"status": 409, "code": "E-TALK-082", "body": {"error": "conflict", "code": "E-TALK-082"}, "errors": ["E-TALK-082"],
         "trigger": "もうチケットに移した会話をもう 1 度移そうとした",
         "ears_form": "UNWANTED: IF もう移した会話をもう 1 度移すなら、Kaname は 409 と E-TALK-082 を返し、最初の移しを残す"},
        {"status": 409, "code": "E-TALK-083", "body": {"error": "conflict", "code": "E-TALK-083"}, "errors": ["E-TALK-083"],
         "trigger": "そのチケットの自分の会話がもう在る（右のパネルで先に話した）",
         "ears_form": "UNWANTED: IF そのチケットの自分の会話がもう在るなら、Kaname は 409 と E-TALK-083 を返し、作る時の会話をそのまま残す"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "ticket_id が無い・null・文字でない・空・uuid でない／契約に無い項目",
         "ears_form": "UNWANTED: IF 移す体の形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "移す DB の関数が落ちた（使えない・例外・証跡が書けない）",
         "ears_form": "UNWANTED: IF 移す DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も変えない"},
    ],
}

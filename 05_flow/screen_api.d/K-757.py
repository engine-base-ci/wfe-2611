# K-757 会話を読む 3 つの口（listConversations・getConversation・listConversationMessages）の答え・問い合わせ・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/read.ts（DB の関数 app.conversation_list・app.conversation_view・app.conversation_messages）。
#   listConversations の QUERIES（q・starred を外した）と PERMS の説明は本体 05_flow/screen_api.py の前からある行を直した。
#   続きの鍵は文字（base64url）：KEY_CURSOR_OPS（05_flow/build_api.py・apps/api/src/contract/op.ts）に 2 つの口を足した（K-754 と同じ）。
#   limit の上限は LIST_DETAILS の limit_max（一覧 100・行 200）。作り手 qtype が limit の形に書く（QUERY_RANGES は limit の言葉を受けない）

# 会話の行（MessageView・鍵ちょうど 8）。passed は作る画面の会話で人が AI に渡した欄・proposal は AI の案（kind proposal の行だけ）・took は段 6 では常に null
_MESSAGE = {"id": "uuid", "who": "string", "text": "string", "at": "string", "job_id": "uuid?",
            "passed": "array", "proposal": "object?", "took": "object?"}
RESPONSES = {
    # 1 つの会話の今（ConversationView・鍵ちょうど 6）。messages は新しい 50 件を古い順に。work は動いている・答えを待っている仕事
    "getConversation": ("ConversationView", {"conversation": "object", "messages": "array", "has_more": "boolean",
                                             "running_job_id": "uuid?", "work": "object?", "stopped": "object?"}),
    # 自分の AI との会話（clone）の一覧の 1 行（鍵ちょうど 4）。last_text は人か AI の最新の行の先頭 60 字
    "listConversations": ("ConversationRow", {"id": "uuid", "title": "string", "updated_at": "string", "last_text": "string?"}),
    "listConversationMessages": ("MessageView", dict(_MESSAGE)),
}
# 行の続きは cursor と limit だけ（並べ替え・絞り込みを受けない。新しい側から読み、各回は古い順に並べて返す）
QUERIES = {
    "listConversationMessages": [],
}
LIST_DETAILS = {
    "listConversations": {"limit_max": 100, "sort": False, "desc": "取得（conversations）— 自分の AI との会話の一覧（新しい順・続きの鍵つき・探す・星は作らない）", "meta": "{ limit, cursor }"},
    "listConversationMessages": {"limit_max": 200, "sort": False, "desc": "取得（messages）— 会話の行の続き（これより古い分・各回は古い順）", "meta": "{ limit, cursor }"},
}
META = {
    "listConversations": {"limit": {"type": "integer"}, "cursor": {"type": "string", "nullable": True}},   # 次の分の鍵（最後の分は null）
    "listConversationMessages": {"limit": {"type": "integer"}, "cursor": {"type": "string", "nullable": True}},   # これより古い分の鍵（最後は null）
}
# 断り：持ち主でない・無い・消した・別の会社の会話は 404（鍵は code と error だけ・欄も details も付けない＝在るかを漏らさない）。
#   問い合わせの形の誤り（limit の範囲・壊れた鍵・知らない項目）は 422。読む関数が落ちた（DB の失敗）は 503・E-PAGE-003。汎用の 401・403・429 は作り手が足す
_NOT_FOUND = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
              "trigger": "自分の会話でない（同じグループの別の人・別の会社）・無い・消した会話（欄も details も付けない）",
              "ears_form": "UNWANTED: IF 自分の会話でないか無い会話を開いたなら、Kaname は 404 を返し、在るかを漏らさない"}
_INVALID = {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
            "trigger": "limit が範囲の外・整数でない／cursor が壊れた鍵／契約に無い問い合わせ（q・starred・before ほか）",
            "ears_form": "UNWANTED: IF 問い合わせの形が契約に合わないなら、Kaname は 422 と欄の名前を返し、何も変えない"}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "会話を読む DB の関数が落ちた（使えない・例外）",
         "ears_form": "UNWANTED: IF 会話を読む DB の関数が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない"}
ERRORS_4XX = {
    "listConversations": [dict(_INVALID), dict(_DOWN)],
    "getConversation": [dict(_NOT_FOUND), dict(_DOWN)],
    "listConversationMessages": [dict(_NOT_FOUND), dict(_INVALID), dict(_DOWN)],
}

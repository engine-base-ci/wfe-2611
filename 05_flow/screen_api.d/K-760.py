# K-760 PC の側の会話の写し（mirrorConversationEntries）と取り戻す先（listMirrorTargets）の入力・答え・断りの表（K-325 の断片）
#   振る舞いの本体は apps/api/src/features/F5/talk/mirror.ts（DB の関数 app.talk_mirror_entries・app.talk_mirror_targets・20261125024000）。
#   PERMS の説明は本体 05_flow/screen_api.py の前からある行を直した。会話は仕事から決める（体に会話の id・仕事の id を持たない・D-112）
INPUTS = {
    "mirrorConversationEntries": ("ConversationEntriesInput", {"entries": "array"}),
}
VALUE_RANGES = {
    "mirrorConversationEntries": {"entries": {"minItems": 1, "maxItems": 500}},
}
REQUIRED_INPUTS = {
    "mirrorConversationEntries": ["entries"],
}
RESPONSES = {
    "mirrorConversationEntries": ("ConversationEntriesMirrored", {"inserted": "integer"}),
    "listMirrorTargets": ("MirrorTarget", {"conversation_id": "uuid", "agent_session_id": "string", "job_id": "uuid"}),
}
LIST_DETAILS = {
    "listMirrorTargets": {"limit_max": 50, "sort": False, "desc": "取得（conversations）— PC が写し漏れを取り戻す先を読む（直近 14 日の本人の会話と、そこで使った Claude Code の session）", "meta": "{ limit }"},
}
UNEXPRESSIBLE_422: dict = {}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"]}
ERRORS_4XX = {
    "mirrorConversationEntries": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "ほかの PC・人の仕事・無い仕事・消した会話（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 受け取っていない仕事か消した会話に写そうとしたなら、Kaname は 404 を返し、在るかを漏らさず何も写さない"},
        {"status": 409, "code": "E-TALK-030", "body": {"error": "conflict", "code": "E-TALK-030"}, "errors": ["E-TALK-030"],
         "trigger": "写す仕事に会話が無い（記憶のまとめ・チケットの仕事）",
         "ears_form": "UNWANTED: IF 写す仕事に会話が無いなら、Kaname は 409 と E-TALK-030 を返し、何も写さない"},
        {**_DOWN, "trigger": "写しを書く DB が落ちた",
         "ears_form": "UNWANTED: IF 写しを書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、取引ごと戻して何も写さない"},
    ],
    "listMirrorTargets": [
        {**_DOWN, "trigger": "取り戻す先を読む DB が落ちた",
         "ears_form": "UNWANTED: IF 取り戻す先を読む DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返す"},
    ],
}

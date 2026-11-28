# K-1009 運営の人のできることを変える口（updateOpsMemberCaps）と外す口（removeOpsMember）（D-156.22・D-156.34・D-128.70）
# 変える：できること 1〜9 つだけ（strict・丸ごと置き換え）。答えは K-985 の 1 行の 8 欄
# 外す：体なし。パスキー・使っていないリンク・セッションをすぐ使えなくし、その人が担当の問い合わせを空にする
#   自分は変えられない・外せない（409 E-OPS-017）。「運営の人」「値段を決める」の最後の 1 人になる変更は 409 E-OPS-018（detail.cap）
#   決まりの確かめは口（apps/api/src/features/F12/ops/team-edit.ts）が契約と同じ数で持つ
INPUTS = {
    "updateOpsMemberCaps": ("OpsMemberCapsInput", {"caps": "string[]"}),
}

REQUIRED_INPUTS = {
    "updateOpsMemberCaps": ["caps"],
}

# できることは 9 つの字のどれか・1〜9 個・重ならない（K-985 の addOpsMember と同じ）
_CAPS = ["inquiry", "peek", "money", "stop", "notice", "distribute", "plan_propose", "plan_decide", "ops_people"]
VALUE_RANGES = {
    "updateOpsMemberCaps": {
        "caps": {"minItems": 1, "maxItems": 9, "uniqueItems": True, "items": {"type": "string", "enum": list(_CAPS)}},
    },
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES で契約に書いた

# 1 行は 8 欄（K-985 と同じ・K-986 の画面の正本）
_ROW = {"member_id": "uuid", "name": "string", "email": "string", "caps": "string[]", "has_passkey": "boolean",
        "setup_pending": "boolean", "is_self": "boolean", "locked_caps": "string[]"}
RESPONSES = {
    "updateOpsMemberCaps": ("OpsMemberRow", dict(_ROW)),
    "removeOpsMember": ("OpsMemberRemoved", {"member_id": "uuid", "removed_at": "string", "released_inquiries": "integer"}),
}

NOT_NULL_ANSWERS = {
    "updateOpsMemberCaps.member_id": "答えの member_id は members.id（主キー）。app.ops_member_row が members と内部結合で読むので null にならない（ops_members.member_id は列として null 可）",
    "removeOpsMember.member_id": "答えの member_id は外した人の members.id（主キー）。app.ops_member_remove が members と内部結合で取った行の id を返すので null にならない",
}

_NF = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
       "trigger": "運営の会社の生きている運営の人でない（外した人・顧客の会社の人・無い id）。欄も details も付けない（在るかを漏らさない）"}
_SELF = {"status": 409, "code": "E-OPS-017", "body": {"error": "conflict", "code": "E-OPS-017"}, "errors": ["E-OPS-017"],
         "trigger": "道の id が自分（呼んだ運営の人）。欄・details・detail は付けない"}
_LAST = {"status": 409, "code": "E-OPS-018", "body": {"error": "conflict", "code": "E-OPS-018"}, "errors": ["E-OPS-018"],
         "trigger": "変えた後・外した後に、生きている運営の人のうち「運営の人」か「値段を決める」を持つ人が 0 になる。detail.cap にその印（ops_people・plan_decide）"}
ERRORS_4XX = {
    "updateOpsMemberCaps": [
        {**_NF, "ears_form": "UNWANTED: IF 運営の人が無いか外してあるなら、Kaname は 404 を返し、できることを変えない"},
        {**_SELF, "ears_form": "UNWANTED: IF 自分のできることを変えようとしたなら、Kaname は 409 と E-OPS-017 を返し、できることを変えない"},
        {**_LAST, "ears_form": "UNWANTED: IF 変えると「運営の人」か「値段を決める」を持つ人が居なくなるなら、Kaname は 409 と E-OPS-018 を返し、できることを変えない"},
    ],
    "removeOpsMember": [
        {**_NF, "ears_form": "UNWANTED: IF 運営の人が無いか外してあるなら、Kaname は 404 を返し、何も変えない"},
        {**_SELF, "ears_form": "UNWANTED: IF 自分を外そうとしたなら、Kaname は 409 と E-OPS-017 を返し、何も変えない"},
        {**_LAST, "ears_form": "UNWANTED: IF 外すと「運営の人」か「値段を決める」を持つ人が居なくなるなら、Kaname は 409 と E-OPS-018 を返し、何も変えない"},
    ],
}

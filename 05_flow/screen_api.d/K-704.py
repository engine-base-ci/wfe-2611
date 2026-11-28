# K-704 種別を足す・直す・消す・並べる口（チケットの設定 › 種別・段 10・設計は 07_functional/段10-F9/土台-settings.md の 3 章）
#   振る舞いの本体は apps/api/src/features/F9/settings/kinds.ts（DB の関数 app.ticket_kind_create / update / delete / reorder・20261125014400）
#   読む口 listTicketKinds の答えの鍵 color_key は本体 05_flow/screen_api.py の RESPONSES の前からある行に足した
#   並べる口が PUT でなく POST なのは、契約の作り手に PUT の前例が無いため（K-704 の切る段の決め）
import doc_shape as _DS   # 本文のひな形の木の形（K-432・K-561 の validateDoc と同じ決まり）

SCREEN_API = {
    "masters": [
        ("POST", "/ticket_kinds", "A118", "ticket_kinds", "createTicketKind", ["audit_events"]),
        ("PATCH", "/ticket_kinds/:id", "A118", "ticket_kinds", "updateTicketKind", ["audit_events"]),
        ("DELETE", "/ticket_kinds/:id", "A118", "ticket_kinds", "deleteTicketKind", ["audit_events"]),
        ("POST", "/ticket_kinds/order", "A118", "ticket_kinds", "reorderTicketKinds", ["audit_events"]),
    ],
}

_WHO = "ticket_kinds の edit を持つ人（既定は管理者）。口と DB の関数の 2 か所で確かめる"
PERMS = {
    "createTicketKind": ("write", _WHO, False),
    "updateTicketKind": ("write", _WHO, False),
    "deleteTicketKind": ("write", _WHO, False),
    "reorderTicketKinds": ("write", _WHO, False),
}

_COLOR_KEYS = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"]
INPUTS = {
    "createTicketKind": ("TicketKindCreateInput", {"name": "string", "color_key": "string", "body_template": "object?"}),
    "updateTicketKind": ("TicketKindUpdateInput", {"name": "string", "color_key": "string", "body_template": "object?"}),
    "reorderTicketKinds": ("TicketKindOrderInput", {"kind_ids": "uuid[]"}),
}
REQUIRED_INPUTS = {
    "createTicketKind": ["name", "color_key"],
    "reorderTicketKinds": ["kind_ids"],
}
# 名前は前後の空白（全角・タブ・改行）を落として 1〜40 字（NFKC にしない）。落とす前の字数は契約に書けないので maxLength は書かない（UNEXPRESSIBLE_422）
VALUE_RANGES = {
    "createTicketKind": {"name": {"pattern": "\\S"}, "color_key": {"enum": list(_COLOR_KEYS)}, "body_template": _DS.doc_schema()},
    "updateTicketKind": {"name": {"pattern": "\\S"}, "color_key": {"enum": list(_COLOR_KEYS)}, "body_template": _DS.doc_schema()},
    "reorderTicketKinds": {"kind_ids": {"minItems": 1}},
}
# 直す口は 3 つの欄のうち 1 つ以上（空の体は 422）
INPUT_RULES = {
    "updateTicketKind": {"anyOf": [{"required": ["name"]}, {"required": ["color_key"]}, {"required": ["body_template"]}]},
}
UNEXPRESSIBLE_422 = {
    "createTicketKind": ["前後の空白を落として 41 字以上の名前", "NUL を含む名前", "本文のひな形の木の節ごとの子の決まり・中身の無い節（validateDoc）"],
    "updateTicketKind": ["前後の空白を落として 41 字以上の名前", "NUL を含む名前", "本文のひな形の木の節ごとの子の決まり・中身の無い節（validateDoc）"],
}

_SETTING = ("TicketKindSetting", {"id": "uuid", "name": "string", "color_key": "string?", "position": "integer", "is_builtin": "boolean", "body_template": "object?"})
RESPONSES = {
    "createTicketKind": _SETTING,
    "updateTicketKind": _SETTING,
    "deleteTicketKind": ("TicketKindDeleted", {"id": "uuid"}),
    "reorderTicketKinds": _SETTING,
}

RATES = {
    "createTicketKind": "30/min/user",
    "updateTicketKind": "30/min/user",
    "deleteTicketKind": "30/min/user",
    "reorderTicketKinds": "30/min/user",
}


def _e404(what):
    return {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
            "trigger": f"{what}種別が無い・消した・別の会社",
            "ears_form": f"UNWANTED: IF {what}種別が無い・消した・別の会社なら、Kaname は 404 と E-PAGE-001 を返し（欄・details なし）、種別を何も変えない"}


def _e409(code, trigger, ears):
    return {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code],
            "trigger": trigger, "ears_form": f"UNWANTED: IF {ears}なら、Kaname は 409 と {code} を返し、種別を何も変えない"}


_E503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "種別の行か証跡を書く DB が落ちた（同じ取引なので全部戻る）",
         "ears_form": "UNWANTED: IF 種別の行か証跡を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、種別も証跡も残さない"}
_NAME_TAKEN = ("E-KND-001", "消していない種別に同じ名前（前後の空白を落とした字で比べる）がある", "消していない種別に同じ名前があるの")
ERRORS_4XX = {
    "createTicketKind": [
        _e409(*_NAME_TAKEN),
        _e409("E-KND-002", "種別がもう 10 ある", "種別がもう 10 ある"),
        _E503,
    ],
    "updateTicketKind": [
        _e404("直す"),
        _e409(*_NAME_TAKEN),
        _E503,
    ],
    "deleteTicketKind": [
        _e404("消す"),
        _e409("E-KND-003", "使っているチケットが在る（消したチケットも数える・枚数は detail.ticket_count）", "使っているチケットが在る種別を消そうとした"),
        _e409("E-KND-005", "生きている種別の最後の 1 つ", "最後の 1 つの種別を消そうとした"),
        _E503,
    ],
    "reorderTicketKinds": [
        _e409("E-KND-004", "kind_ids が今の生きている種別の全部と過不足なく一致しない（足りない・余る・重なる・消した種別・別の会社の種別）", "並びが今の種別と合わない"),
        _E503,
    ],
}

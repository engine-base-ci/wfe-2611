# K-704 種別を足す・直す・消す・並べる口（createTicketKind・updateTicketKind・deleteTicketKind・reorderTicketKinds）の契約の形の表に足す分（K-325 の断片）
#   05_flow/screen_api.d/K-704.py と同じ値域。口は apps/api/src/features/F9/settings/kinds.ts
#   名前は前後の空白（全角・タブ・改行）を落として 1〜40 字・NFKC にしない・NUL は 422（落とす前の字数と NUL は契約に書けない）
import doc_shape as _DS   # 本文のひな形の木の形（K-432 と同じ定義）

_COLOR_KEYS = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"]
REQUIRED_INPUTS = {"createTicketKind": {"name", "color_key"}, "reorderTicketKinds": {"kind_ids"}}
NO_REQUIRED_INPUTS = {"updateTicketKind": "3 つの欄のうち 1 つ以上（どれが要るかは決まっていない・空の体は形全体の決まりで 422）"}
PATH_PATTERNS: dict = {}
VALUE_RANGES = {
    "createTicketKind": {"name": {"pattern": "\\S"}, "color_key": {"enum": list(_COLOR_KEYS)}, "body_template": _DS.doc_schema()},
    "updateTicketKind": {"name": {"pattern": "\\S"}, "color_key": {"enum": list(_COLOR_KEYS)}, "body_template": _DS.doc_schema()},
    "reorderTicketKinds": {"kind_ids": {"minItems": 1}},
}
UNEXPRESSIBLE_422 = {
    "createTicketKind": ["前後の空白を落として 41 字以上の名前", "NUL を含む名前", "本文のひな形の木の節ごとの子の決まり・中身の無い節（validateDoc）"],
    "updateTicketKind": ["前後の空白を落として 41 字以上の名前", "NUL を含む名前", "本文のひな形の木の節ごとの子の決まり・中身の無い節（validateDoc）"],
}
AGENT_ANSWERS: dict = {}

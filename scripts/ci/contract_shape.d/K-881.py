# K-881 見せる相手を付け外す口（updateTicketGuestShares）の契約の形の表に足す分（K-325 の断片）
#   体の形（add・remove のどちらか・1〜20 個の uuid・strict）は 05_flow/screen_api.d/K-881.py の INPUTS・VALUE_RANGES・INPUT_RULES で契約に書いた。読む口は体を受けない GET
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "updateTicketGuestShares": 'add・remove のどちらか 1 つ以上（入力の形の anyOf・INPUT_RULES）。片方だけなら 422 にしない',
}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateTicketGuestShares": {"add": {"minItems": 1, "maxItems": 20}, "remove": {"minItems": 1, "maxItems": 20}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

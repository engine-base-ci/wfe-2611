# K-882 見せたチケットのチャットにゲストが書く口（postPortalTicketMessage）の契約の形の表に足す分（K-325 の断片）
#   体の形（body だけ・strict・空なら 422）は 05_flow/screen_api.d/K-882.py の INPUTS・REQUIRED_INPUTS・VALUE_RANGES で契約に書いた
REQUIRED_INPUTS = {"postPortalTicketMessage": {"body"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"postPortalTicketMessage": {"body": {"minLength": 1}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

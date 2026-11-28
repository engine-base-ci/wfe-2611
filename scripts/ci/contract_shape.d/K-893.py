# K-893 届け先を変える・返事を送る口の契約の形の表に足す分（体の形は screen_api.d/K-893.py の INPUTS と VALUE_RANGES が持つ）
REQUIRED_INPUTS = {
    "replyToClientRequest": {'body'},   # reply.ts（返事が無い・空なら 422・欄 body）
    "updateClientRequest": {'route_id'},   # route.ts（届け先のグループが無い・uuid でなければ 422・欄 route_id）
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

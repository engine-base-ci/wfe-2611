# K-876 ゲストのグループを作る口（createGuestGroup）の契約の形の表に足す分（K-325 の断片）
#   一覧の口（listGuestGroups）は体を受けない GET なので、どの表にも載せない
REQUIRED_INPUTS = {"createGuestGroup": {"name", "request_scope_id"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"createGuestGroup": {"name": {"minLength": 1, "maxLength": 80}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

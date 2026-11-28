# K-927 ゲストのグループの名前を直す口（updateGuestGroup）の契約の形の表に足す分（K-325 の断片）
#   消す口（deleteGuestGroup）は体を受けない DELETE なので、どの表にも載せない
REQUIRED_INPUTS = {"updateGuestGroup": {"name"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateGuestGroup": {"name": {"minLength": 1, "maxLength": 80}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

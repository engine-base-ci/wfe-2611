# K-836 入っている端末の口（listMySessions・revokeMySession・revokeOtherSessions）の契約の形の表に足す分（K-325 の断片）
#   体を受けるのは revokeOtherSessions だけで、体は空の形（strict）。一覧と 1 つ切るは体を受けない
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "revokeOtherSessions": "体は空の形（K-836）。切る端末はログインの印（今の部品のセッション）から決める。{} で 201。知らない欄は 422（契約の strict）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

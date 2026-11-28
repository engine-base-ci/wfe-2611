# K-462 既読にする口（readNotification）・全部既読にする口（readAllNotifications）
#   422 は全部契約に書ける形の誤り（read が無い・真偽でない・知らない欄）。契約に書けない 422 は残さない
REQUIRED_INPUTS = {
    "readNotification": {"read"},   # apps/api/src/features/F7/notifications/read.ts（無い・真偽でない・null は 422・欄 read・K-462）
}
NO_REQUIRED_INPUTS = {
    "readAllNotifications": "欄を持たない（体は空のオブジェクト・知らない欄は 422）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

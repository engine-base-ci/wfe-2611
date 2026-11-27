# K-1014 運営がお知らせを作る・直す口（createOpsNotice・updateOpsNotice）
#   必須・値の形は K-1004 の契約の断片、欄をまたぐ決まりは 05_flow/screen_api.d/K-1014.py の INPUT_RULES に書いた。
#   6 つの表に足す行は無い（登録先の決まりがチケットごとの住所を求めるので、空の表を置く）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

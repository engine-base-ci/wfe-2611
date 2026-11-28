# K-465 外枠の数と帯を 1 本で返す口（getShell・GET /api/v1/shell）
#   入力を受けない GET なので、6 つの表に足す行は無い（登録先の決まりがチケットごとの住所を求めるので、空の表を置く）。
#   契約の答えの形（member・saved_views を足した Shell）は 05_flow/screen_api.py の RESPONSES の getShell
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

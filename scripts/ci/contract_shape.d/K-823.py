# K-823 記録を探す口（listAuditEvents）
#   体を受けない GET なので、6 つの表に足す行は無い（登録先の決まりがチケットごとの住所を求めるので、空の表を置く）。
#   問い合わせの値域（kind の 6 つ・from と to の日時の形）は 05_flow/screen_api.d/K-823.py の QUERY_RANGES、limit の 1〜100 は LIST_DETAILS、
#   member_id・ticket_id の uuid は名前の _id で作り手が書く。続きの印の形（base64url の 1〜200 字）は作り手が KEY_CURSOR_OPS から書き、ほどいた中身（時刻（マイクロ秒）_uuid）は口の patterns.ts が見る（E-AUD-002）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

# K-384 最後にやり取りを開いた時刻を書く口（markTicketTimelineSeen）
#   seen_at は無くてよい（無ければ今）。{} で 201
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {"markTicketTimelineSeen": "seen_at は無くてよい（無ければ今・K-384）。{} で 201"}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {"markTicketTimelineSeen": ["seen_at が日時として読めない（空・字・暦に無い日）"]}
AGENT_ANSWERS = {}

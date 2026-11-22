# K-384 最後にやり取りを開いた時刻を書く口（markTicketTimelineSeen）
#   seen_at は無くてよい（無ければ今）。{} で 201
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {"markTicketTimelineSeen": "seen_at は無くてよい（無ければ今・K-384）。{} で 201"}
PATH_PATTERNS = {}
VALUE_RANGES = {"markTicketTimelineSeen": {"seen_at": {"pattern": "^(?:[1-9]\\d{3}-(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|[1-9]\\d{3}-(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|[1-9]\\d{3}-02-(?:0[1-9]|1\\d|2[0-8])|(?:[1-9]\\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,6})?(?:Z|[+-](?:0\\d|1[0-5])(?::?[0-5]\\d)?)$"}}}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

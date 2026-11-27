# K-894 依頼を受けて普通のチケットを作る口（acceptClientRequest）：6 つの表に足す行は無い。
#   体の値域（title の 1〜200 字・guest_group_ids の 1〜20 個）は screen_api.d/K-894.py の VALUE_RANGES に書く。
#   必須（assignee_member_id・due_on・scope_id）は契約の INPUTS の「?」の無い欄から作り手が出す。日付の形は口（accept.ts）が 422 にする
#   登録先の決まり（touch_rules）が住所を求めるので、空の 6 つの表を置く（K-488 と同じ形）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

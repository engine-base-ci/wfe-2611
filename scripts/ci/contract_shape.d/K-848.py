# K-848 外す口 removeMember の契約の形の表に足す分
#   入力（transfer_to_member_id・transfers〜500）と答えの形は K-800 が契約に置いた（MemberRemoveInput・MemberRemoved）。
#   この葉は新しい鍵を足さないので、登録先の決まりが求める空の表を置く
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {
    "removeMember": '引き継ぐ先（transfer_to_member_id か transfers）はどちらも任意で、両方は送れない（入力の形の not・INPUT_RULES）',
}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

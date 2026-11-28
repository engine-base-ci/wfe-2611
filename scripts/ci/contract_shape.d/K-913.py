# K-913 ゲストの「初めて」の印はホームを開いたときだけ（getPortalHome に問い合わせ visit を 1 つ足す・代表の決め answer=b187f0c59dec）
#   visit の値域は契約の enum（elsewhere だけ・allowEmptyValue）で書けるので、6 つの表に足す行は無い
#   （登録先の決まりがチケットごとの住所を求めるので、空の表を置く。K-906 と同じ形）。
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

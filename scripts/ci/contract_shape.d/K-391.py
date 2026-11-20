# K-391 決定を改める・取り消す口（updateTicketDecision）
#   action は必須で revise・cancel・promote のどれか。action ごとに要る欄と空・空白・制御文字だけの 422（E-VAL-042・E-VAL-045）は INPUT_RULES（05_flow/screen_api.d/K-391.py・oneOf）に書いた（代表の答え answer=f0f290e785a9：検査の例外は足さない）。
#   promote だけは段 12 まで口が E-VAL-018 で断る（契約に書けない値の決まりとして残す）
REQUIRED_INPUTS = {"updateTicketDecision": {"action"}}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {"updateTicketDecision": {"action": {"enum": ["revise", "cancel", "promote"]}}}
UNEXPRESSIBLE_422 = {
    "updateTicketDecision": ["取引先のルールにする（E-VAL-018・段 12 まで）"],
}
AGENT_ANSWERS = {}

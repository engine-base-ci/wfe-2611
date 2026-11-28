# K-835 メールを変える口（requestEmailChange・verifyEmailChange）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/me/email.ts（email・token は無ければ 422）
import invite_patterns as _IP  # 宛ての pattern（05_flow/screen_api.d/K-835.py と同じ字）
REQUIRED_INPUTS = {
    "requestEmailChange": {"email"},
    "verifyEmailChange": {"token"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "requestEmailChange": {"email": {"maxLength": 254, "pattern": _IP.EMAIL}},
    "verifyEmailChange": {"token": {"minLength": 1, "maxLength": 200}},
}
UNEXPRESSIBLE_422: dict = {}   # 宛ての形（E-ME-020）は VALUE_RANGES の pattern で契約に書いた
AGENT_ANSWERS = {}

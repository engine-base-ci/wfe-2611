"""招く口（createInvitations）が、打ったとおりの宛てを照らす pattern（K-419）。
契約（05_flow/screen_api.d/K-419.py の VALUE_RANGES）と口（apps/api/src/features/F10/invite/patterns.ts）が同じ字を使う。
同じ字かは試験 K419-API-024 が 08_api/openapi.yaml と照らす。"""

# trim が落とす字（全角の空白 U+3000 も）
WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
# 宛ての中に入れない字：@（半角・全角・小さい @）と空白
BAD = f"@＠﹫{WS}"

# 宛て 1 つ：前後の空白は許し、中に空白は無く、@（半角か全角）で 2 つに分かれ、後ろの名前に点（半角か全角）がある
EMAIL = f"^[{WS}]*[^{BAD}]+[@＠][^{BAD}]+[.．][^{BAD}]+[{WS}]*$"

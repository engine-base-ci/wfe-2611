"""招く口（createInvitations）が、打ったとおりの宛てを照らす pattern（K-419）。
契約（05_flow/screen_api.d/K-419.py の VALUE_RANGES）と口（apps/api/src/features/F10/invite/patterns.ts）が同じ字を使う。
同じ字かは試験 K419-API-024 が 08_api/openapi.yaml と照らす。前の口が受けていた入力は今も受ける（K419-API-027）。"""

# trim が落とす字（全角の空白 U+3000 も）。JavaScript の \s と同じ字
WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
# NFKC で @ になる字（半角・全角・小さい @）と、. になる字（半角・全角・小さい点・一点リーダー）
AT = "[@＠﹫]"
DOT = "[.․﹒．]"
# @ でも空白でもない字（NFKC の後に 2 字以上へ開く ‥ ⒈ ㏂ などは、点とは数えずふつうの字として通す）
NOT = f"[^@＠﹫{WS}]"
SP = f"[{WS}]*"

# 宛て 1 つ：空白（半角・全角・中も）は許し、そろえるときに落ちる。@ で 2 つに分かれ、後ろの名前の中ほどに点がある
EMAIL = f"^{SP}(?:{NOT}{SP})+{AT}{SP}{NOT}(?:{SP}{NOT})*{SP}{DOT}(?:{SP}{NOT})+{SP}$"

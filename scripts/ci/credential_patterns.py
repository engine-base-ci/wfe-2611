"""預けたログイン情報の口（createCredential・updateCredential）が、打ったとおりの入力を照らす pattern（K-383）。
契約（05_flow/screen_api.d/K-352.py・K-353.py の VALUE_RANGES）と口（apps/api/src/features/F3/credentials/patterns.ts）が同じ字を使う。
同じ字かは試験 K352-API-026 が 08_api/openapi.yaml と照らす。公開の接尾辞の一覧は patterns.ts の PUBLIC_SUFFIXES と同じ並び。"""

# trim が落とす字（全角の空白 U+3000 も）
WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
PUBLIC_SUFFIXES = ["co.jp", "ne.jp", "or.jp", "ac.jp", "ad.jp", "ed.jp", "go.jp", "gr.jp", "lg.jp", "co.uk", "org.uk", "ac.uk", "gov.uk",
                   "com.au", "net.au", "org.au", "co.nz", "co.kr", "com.cn", "com.tw", "com.sg", "com.br"]
FULL = {c: chr(ord(c) - ord("a") + 0xFF41) for c in "abcdefghijklmnopqrstuvwxyz"}  # 全角の小文字


def _ch(c: str) -> str:
    """英字 1 字を、大文字・小文字・全角で受ける（. は半角と全角の点）"""
    if c == ".":
        return "[.．]"
    return f"[{c}{c.upper()}{FULL[c]}{chr(ord(FULL[c]) - 0x20)}]"


def _word(s: str) -> str:
    return "".join(_ch(c) for c in s)


NAME = f"^[{WS}]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{{0,63}}[{WS}]*$"

_ALNUM = "A-Za-z0-9Ａ-Ｚａ-ｚ０-９"
_JP = "ぁ-ゖァ-ヶー一-龥"
_NOT_XN = f"(?!{_word('xn')}--)"
_ASCII_LABEL = f"{_NOT_XN}[{_ALNUM}](?:[{_ALNUM}-]{{0,61}}[{_ALNUM}])?"
_JP_LABEL = f"[{_JP}](?:[{_JP}{_ALNUM}-]{{0,8}}[{_JP}{_ALNUM}])?"
_LABEL = f"(?:{_ASCII_LABEL}|{_JP_LABEL})"
_TLD = f"{_NOT_XN}[A-Za-zＡ-Ｚａ-ｚ][{_ALNUM}-]{{1,62}}"
_HOST = f"(?:{_LABEL}[.．])+{_TLD}[.．]?"
_SUFFIX_LOOK = "(?!(?:\\*[.．])?(?:" + "|".join(_word(s) for s in PUBLIC_SUFFIXES) + f")[.．]?(?:[/?#]|[{WS}]|$))"
_SCHEME = f"{_word('http')}{_ch('s')}?://"
_USERINFO = "(?:[A-Za-z0-9._~%!$&'()*+,;:=-]+@)?"
_PATH = "(?:[/?#][A-Za-z0-9._~%!$&'()*+,;=:@/?#-]*)?"
# 使える場所 1 つ：URL（http・https・@ の前・道・問い合わせ・断片）・大文字・全角・日本語の名前・末尾の点・頭の *. 。公開の接尾辞だけは入れない
DEST = f"^[{WS}]*(?:{_SCHEME}{_USERINFO}{_SUFFIX_LOOK}{_HOST}{_PATH}|{_SUFFIX_LOOK}(?:\\*[.．])?{_HOST})[{WS}]*$"

# 認証アプリの鍵：半角の空白と大文字・小文字・全角の Base32 を 16 字以上
TOTP = "^[ \\t]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t]*){16,}=*[ \\t]*$"

# 期限：年-月-日（半角の数字）。暦に在る日だけ（うるう年の 2 月 29 日まで）。日本の今日との前後は口が決める（時刻で決まる・409）
_M31 = "(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])"
_M30 = "(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)"
_FEB = "02-(?:0[1-9]|1[0-9]|2[0-8])"
_LEAP = "(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:00|0[48]|[2468][048]|[13579][26])00)-02-29"
EXPIRES = f"^[{WS}]*(?:[0-9]{{4}}-(?:{_M31}|{_M30}|{_FEB})|{_LEAP})[{WS}]*$"

# ログイン名：空白だけでない
LOGIN = "\\S"

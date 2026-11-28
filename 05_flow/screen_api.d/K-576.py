# K-576 項目の変更を点の形に戻す口（restoreTicketItems・POST /tickets/:id/item-changes/restore）
# 入力は from（戻す先の点）と to（今見ている点）の 2 欄だけ。strict（知らない欄は 422）
# 404・409 の体は error と code（409 は message）だけで field・details・detail を付けない（控え帳 2026-11-20 20:50・2026-11-21 01:15）
INPUTS = {"restoreTicketItems": ("ItemRestoreInput", {"from": "integer", "to": "integer"})}
REQUIRED_INPUTS = {"restoreTicketItems": ["from", "to"]}
VALUE_RANGES = {"restoreTicketItems": {"from": {"minimum": 1, "maximum": 2147483647}, "to": {"minimum": 1, "maximum": 2147483647}}}   # 点の番号は DB の int（超える数は口の入口で 422・DB の 22003 で 503 にしない）
RESPONSES = {"restoreTicketItems": ("ItemRestored", {"changed": "boolean", "restored": "array", "skipped": "array"})}
UNEXPRESSIBLE_422: dict = {}

_ITM = lambda code: {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code]}  # noqa: E731
ERRORS_4XX = {
    "restoreTicketItems": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "そのチケットは見えるが書く権限が無い・止められた人",
         "ears_form": "UNWANTED: IF チケットは見えるが書く権限が無いなら、Kaname は 403 と FORBIDDEN を返し、項目を変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えない・無い id（入口の行の守りで返す・有ることも漏らさない）",
         "ears_form": "UNWANTED: IF チケットが別の会社・見えない・無い id なら、Kaname は 404 と NOT_FOUND を返し、何も書かない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "無い点・消したチケット",
         "ears_form": "UNWANTED: IF 無い点か消したチケットを戻そうとしたなら、Kaname は 404 と E-PAGE-001 を返し、何も書かない"},
        {**_ITM("E-ITM-001"), "trigger": "完了したチケット",
         "ears_form": "UNWANTED: IF 完了したチケットの項目を戻そうとしたなら、Kaname は 409 と E-ITM-001 を返し、項目を変えない"},
        {**_ITM("E-ITM-002"), "trigger": "今見ている点（to）が今の最新の点でない（先に項目が変えられた）",
         "ears_form": "UNWANTED: IF 今見ている点が今の最新の点でないなら、Kaname は 409 と E-ITM-002 を返し、項目を変えない"},
        {**_ITM("E-ITM-003"), "trigger": "戻す物が無い（from が to 以上・正味の変わりが空）",
         "ears_form": "UNWANTED: IF 戻す物が無いなら、Kaname は 409 と E-ITM-003 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []},
         "trigger": "from・to が無い・整数でない・1 未満／知らない欄",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、項目を変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "項目・やり取り・お知らせ・証跡のどれかを書く DB が落ちた・守りの判定が例外（1 つの取引で戻す）",
         "ears_form": "UNWANTED: IF 戻す DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、項目・やり取り・お知らせ・証跡のどれも残さない"},
    ],
}

# 画面の口（統合の枝で本体から移した・K-1112・PM の決め 2026-11-28）
SCREEN_API = {
    "tickets": [
        ("POST", "/tickets/:id/item-changes/restore", "A101", "ticket_messages", "restoreTicketItems", ["tickets", "ticket_field_values"]),
    ],
}

PERMS = {
    "restoreTicketItems": ("write", "そのチケットを書ける人", False),
}

# 口が返す成功の状態コード（契約を口に合わせる・K-144 の SHAPE_010・統合の枝）
SUCCESS_STATUS = {
    "restoreTicketItems": 200,   # 作らず状態を変えるだけ・口は 200 を返す
}

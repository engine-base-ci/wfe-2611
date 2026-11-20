# K-387 段・実績・保留を変える口（updateTicket の段と実績の分）。ほかの欄は段 8（K-67）が足すまで 422 E-VAL-018
#   振る舞い：apps/api/src/features/ticket-update/（欄ごとの処理の表）と F6/progress/（段・実績・保留の組）・DB の関数 app.ticket_progress_set（20261120130400）
#   段は stage_key（todo・doing・hold）か stage_id（会社が足した段・鍵が空）のどちらか 1 つ。送った欄だけを変える
INPUTS = {
    "updateTicket": ("TicketUpdateInput", {"stage_id": "uuid", "stage_key": "string", "actual_minutes": "integer?", "hold_reason": "string?", "resume_condition": "string?"}),
}

RESPONSES = {
    "updateTicket": ("TicketUpdated", {"ticket": "object", "stage": "object", "changed": "boolean", "message_id": "uuid?"}),
}

# 入口の zod は値域を読まない（知らない段の鍵は口が E-VAL-040 で断る・実績の範囲は口と DB の関数の 2 重）
VALUE_RANGES = {
    "updateTicket": {"actual_minutes": {"minimum": 0, "maximum": 100000}, "stage_key": {"enum": ["todo", "doing", "hold"]}},
}

ERRORS_4XX = {
    "updateTicket": [
        {"status": 409, "code": "E-CONF-030", "body": {"error": "conflict", "code": "E-CONF-030"}, "errors": ["E-CONF-030"],
         "trigger": "今の段が仕組みの段（確認中・承認待ち・実行中）か、走っている実行（待ち・実行中・聞いている）・決まっていない承認待ちがあるのに段を変えた（busy）。実績と保留の理由だけならこの間も変えられる",
         "ears_form": "UNWANTED: IF AI が動いている間か承認待ちの間に段を変えようとしたら、Kaname は 409 と E-CONF-030 を返し、何も書かない"},
        {"status": 409, "code": "E-CONF-032", "body": {"error": "conflict", "code": "E-CONF-032"}, "errors": ["E-CONF-032"],
         "trigger": "今の段が完了なのに、未着手・保留・会社が足した段に変えた（done。作業中への開き直しは K-388）",
         "ears_form": "UNWANTED: IF 完了したチケットの段を開き直さずに変えようとしたら、Kaname は 409 と E-CONF-032 を返し、何も書かない"},
        {"status": 422, "code": "E-VAL-018", "body": {"error": "validation", "code": "E-VAL-018", "details": []}, "errors": ["E-VAL-018"],
         "trigger": "まだ変えられない欄（題名・期限・担当者・優先度・見込み・知らない欄）を送った（前処理・欄ごとに「この欄はまだ変えられません」・段を一緒に送っても何も書かない）",
         "ears_form": "UNWANTED: IF まだ変えられない欄を送ったなら、Kaname は 422 と E-VAL-018 と欄ごとの理由を返し、何も書かない"},
        {"status": 422, "code": "E-VAL-040", "body": {"error": "validation", "code": "E-VAL-040", "details": []}, "errors": ["E-VAL-040"],
         "trigger": "行き先の段が仕組みの段・完了・別の会社の段・消した段・無い段・知らない鍵（bad_stage・欄 stage_id か stage_key）",
         "ears_form": "UNWANTED: IF 選べない段を行き先にしたなら、Kaname は 422 と E-VAL-040 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-041", "E-VAL-047"],
         "trigger": "保留にするのに理由（E-VAL-041）か再開の条件（E-VAL-047）が無い・空・空白だけ・制御文字だけ。ほかに stage_id と stage_key の両方・保留でない行き先に理由を付けた・実績が 0〜100000 の整数でない・空の体・本文の形違い（欄ごとの理由）",
         "ears_form": "UNWANTED: IF 保留にするのに理由か再開の条件が無いなら、Kaname は 422 と欄ごとの理由（E-VAL-041・E-VAL-047）を返し、何も書かない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "書く所（段・保留の列・変更の 1 行・担当者の受け箱の行・証跡）で DB が落ちた（1 つの処理なので何も残らない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、段・保留の列・変更の 1 行・知らせを前のまま残す"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（今のメンバーか・書けるか）の所で例外になった・DB の関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
}

# 契約に書けない値の決まり（口の振る舞いのまま 422・scripts/ci/contract_shape.d/K-387.py と同じ並び）
UNEXPRESSIBLE_422 = {
    "updateTicket": ["stage_id と stage_key の両方", "行き先が仕組みの段・完了・別の会社の段・消した段（E-VAL-040）",
                     "保留にするのに理由が空・制御文字だけ（E-VAL-041）", "保留にするのに再開の条件が空・制御文字だけ（E-VAL-047）",
                     "保留でない行き先に理由を付けた", "ほかの欄（E-VAL-018・前処理）", "空の体"],
}

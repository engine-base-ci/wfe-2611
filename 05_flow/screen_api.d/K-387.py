# K-387 段・実績・保留を変える口（updateTicket の段と実績の分）。ほかの欄は段 8（K-67 から切る葉）が足すまで 422 E-VAL-018
#   振る舞い：apps/api/src/features/ticket-update/（欄ごとの処理の表）と F6/progress/（段・実績・保留の組）・DB の関数 app.ticket_progress_set（20261120130400）
#   段は stage_key（todo・doing・hold）か stage_id（会社が足した段・鍵が空）のどちらか 1 つ。送った欄だけを変える
#   断る番号は役割で分ける（代表の答え answer=f0f290e785a9）：422＝形の誤り（契約に書ける物だけ）／404＝指した物が無い・見えない／409＝今の状態ではできない
# K-440：優先度・親の組を足す（features/F4/ticket-sort/・DB の関数 app.ticket_sort_set・20261122094000）。priority は mid か high（高は priority_reason が要る）。
#   parent_ticket_id は親にするチケットの id（外すときは null）。期限・担当者は別の葉（K-483・段 9）が足すまで 422 E-VAL-018
# K-583：予定時間の組を足す（features/F4/ticket-estimate/・DB の関数 app.ticket_estimate_set・20261122101300）。estimate_minutes は整数 0〜100000（分）か null（空にする）。
#   完了したチケットでも仕組みの段の間でも変えられる（K-387 の実績と同じ）。DB の中身で決まる断りは無いので 409 の行は足さない
# K-564：会社の項目の値の組を足す（features/F4/ticket-fields/・DB の関数 app.ticket_fields_set・20261122100400）。fields は { "<項目の id（uuid）>": 値 }（送った項目だけ変える・空にするのは null）。
#   値の形（文字・数・真偽・文字の並び・null）と鍵（uuid・1 つ以上）は契約に書き、項目の型に合うか・選択肢に在るか・種別に出るか・必須かはマスタ（DB）で決まるので 404 E-PAGE-001／409 E-FLD-001〜004
# K-483：期限・開始日の組を足す（features/F7/due/・DB の関数 app.ticket_due_set・20261123088300）。due_on・start_on は暦にある YYYY-MM-DD か null。
#   due_on を送るときは due_reason が要る（なくすときも初めて決めるときも）。理由だけ・expected だけは送れない。
#   今日より前の期限（409 E-VAL-012）・開始日が期限より後（409 E-VAL-028）は契約に書けないので 409（番号の定義は K-437）
INPUTS = {
    "updateTicket": ("TicketUpdateInput", {"stage_id": "uuid", "stage_key": "string", "actual_minutes": "integer?", "hold_reason": "string", "resume_condition": "string",
                                           "priority": "string", "priority_reason": "string", "parent_ticket_id": "uuid?",
                                           "fields": "object", "estimate_minutes": "integer?",
                                           "due_on": "string?", "start_on": "string?", "due_reason": "string",
                                           "expected_due_on": "string?", "expected_start_on": "string?"}),
}

RESPONSES = {
    "updateTicket": ("TicketUpdated", {"ticket": "object", "stage": "object?", "changed": "boolean", "message_id": "uuid?"}),   # stage は段・実績・保留の欄を送ったときだけ（K-440 で省けるにした）
}

# 保留の理由と再開の条件は、空白（\s）と制御文字だけでない字で、NUL（U+0000）を含まない（空・空白だけ・NUL を含むは 422 E-VAL-041・047・NUL はどの口でも入口で 422 の決め answer=c8b3f4c3aef8・字数の上限は置かない D-130.1）
_NOT_BLANK = "^[^\\u0000]*[^\\s\\u0000-\\u001f\\u007f][^\\u0000]*$"
# K-483：日付は暦にある YYYY-MM-DD だけ（時刻つき・斜線・空の文字は外）。理由は 200 文字まで・見える字を 1 つ以上。
#   同じ辞書を 2 か所に置くと YAML の別名が出るので、関数で作る
_Y = r"(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})"
_LEAP = r"(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)"
_DATE = rf"^(?:{_Y}-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|{_Y}-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|{_Y}-02-(?:0[1-9]|1[0-9]|2[0-8])|{_LEAP}-02-29)$"
def _date(): return {"pattern": _DATE}
def _reason(): return {"maxLength": 200, "pattern": r"[^\s\u0000-\u001f\u007f-\u009f]"}
VALUE_RANGES = {
    "updateTicket": {"actual_minutes": {"minimum": 0, "maximum": 100000}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                     "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK},
                     "priority": {"enum": ["mid", "high"]}, "priority_reason": {"pattern": _NOT_BLANK},
                     "estimate_minutes": {"minimum": 0, "maximum": 100000},
                     "due_on": _date(), "start_on": _date(), "expected_due_on": _date(), "expected_start_on": _date(), "due_reason": _reason(),
                     "fields": {"minProperties": 1, "propertyNames": {"format": "uuid"},
                  "additionalProperties": {"anyOf": [{"type": "string"}, {"type": "number"}, {"type": "boolean"}, {"type": "array", "items": {"type": "string"}}], "nullable": True}}},
}

ERRORS_4XX = {
    "updateTicket": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "チケットが無い・別の会社・消した（入口の行の守り）か、段の id（stage_id）が指す段が無い・別の会社の段・消した段（欄 stage_id）か、親（parent_ticket_id）が指すチケットが無い・別の会社・消した・自分に見えない、会社の項目（fields）の鍵が指す項目が無い・別の会社・消した（欄・明細なし）",
         "ears_form": "UNWANTED: IF チケットか指した段・親が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も書かない"},
        {"status": 409, "code": "E-CONF-030", "body": {"error": "conflict", "code": "E-CONF-030"}, "errors": ["E-CONF-030"],
         "trigger": "今の段が仕組みの段（確認中・承認待ち・実行中）か、走っている実行（待ち・実行中・聞いている）・決まっていない承認待ちがあるのに段を変えた（busy）。実績と保留の理由だけならこの間も変えられる",
         "ears_form": "UNWANTED: IF AI が動いている間か承認待ちの間に段を変えようとしたら、Kaname は 409 と E-CONF-030 を返し、何も書かない"},
        {"status": 409, "code": "E-CONF-032", "body": {"error": "conflict", "code": "E-CONF-032"}, "errors": ["E-CONF-032"],
         "trigger": "今の段が完了なのに、作業中（開き直す）以外の段（未着手・保留・会社が足した段）に変えた（done）。完了 → 作業中は開き直す（K-388）",
         "ears_form": "UNWANTED: IF 完了したチケットの段を、作業中への開き直し以外に変えようとしたら、Kaname は 409 と E-CONF-032 を返し、何も書かない"},
        {"status": 409, "code": "E-CONF-034", "body": {"error": "conflict", "code": "E-CONF-034", "details": []}, "errors": ["E-CONF-034"],
         "trigger": "段の id（stage_id）で、仕組みの段（確認中・承認待ち・実行中）か完了の段を行き先にした（段の口では移せない・欄 stage_id）",
         "ears_form": "UNWANTED: IF 段の口で移せない段を行き先にしたなら、Kaname は 409 と E-CONF-034 を返し、何も書かない"},
        {"status": 409, "code": "E-CONF-035", "body": {"error": "conflict", "code": "E-CONF-035", "details": []}, "errors": ["E-CONF-035"],
         "trigger": "段の id（stage_id）で保留の段を選んだのに、保留の理由か再開の条件を送っていない（足りない欄ごとの明細）",
         "ears_form": "UNWANTED: IF 段の id で保留の段を選んで理由か条件が無いなら、Kaname は 409 と E-CONF-035 と足りない欄を返し、何も書かない"},
        {"status": 409, "code": "E-CONF-036", "body": {"error": "conflict", "code": "E-CONF-036", "details": []}, "errors": ["E-CONF-036"],
         "trigger": "保留でないチケットで段を送らずに保留の理由か再開の条件を送った、または段の id で保留でない段を選んで理由か条件を付けた（欄ごとの明細）",
         "ears_form": "UNWANTED: IF 保留でないのに保留の理由か条件を書こうとしたら、Kaname は 409 と E-CONF-036 を返し、何も書かない"},
        {"status": 409, "code": "E-TKT-001", "body": {"error": "conflict", "code": "E-TKT-001"}, "errors": ["E-TKT-001"],
         "trigger": "親（parent_ticket_id）に、そのチケット自身を決めた（欄・明細なし）",
         "ears_form": "UNWANTED: IF チケット自身を親にしようとしたなら、Kaname は 409 と E-TKT-001 を返し、何も書かない"},
        {"status": 409, "code": "E-TKT-002", "body": {"error": "conflict", "code": "E-TKT-002"}, "errors": ["E-TKT-002"],
         "trigger": "親に、そのチケットの子・孫（下の段）を決めた＝親子が輪になる（欄・明細なし）。同時に A の親を B・B の親を A にしても、後の 1 本が断られる",
         "ears_form": "UNWANTED: IF 自分の子孫を親にしようとしたなら、Kaname は 409 と E-TKT-002 を返し、何も書かない"},
        {"status": 409, "code": "E-TKT-003", "body": {"error": "conflict", "code": "E-TKT-003"}, "errors": ["E-TKT-003"],
         "trigger": "親を決めると、親子が 3 段を超える（親が 3 段目、または自分の下の段を数えて 3 段を超える・欄・明細なし）",
         "ears_form": "UNWANTED: IF 親子が 3 段を超える親を決めようとしたなら、Kaname は 409 と E-TKT-003 を返し、何も書かない"},
        {"status": 409, "code": "E-TKT-004", "body": {"error": "conflict", "code": "E-TKT-004"}, "errors": ["E-TKT-004"],
         "trigger": "今の自分の期限が親の期限より後のチケットに、その親を決めた（どちらかの期限が空なら見ない・親の期限より後の期限にする側は期限の口 K-483・欄・明細なし）",
         "ears_form": "UNWANTED: IF 期限が親より後のチケットに親を決めようとしたなら、Kaname は 409 と E-TKT-004 を返し、何も書かない"},
        {"status": 409, "code": "E-FLD-001", "body": {"error": "conflict", "code": "E-FLD-001"}, "errors": ["E-FLD-001"],
         "trigger": "会社の項目（fields）の値を、そのチケットの種別に出ない項目に入れようとした（項目に種別の行があって、このチケットの種別が入っていない。消した種別の行しか無い項目も同じ・欄・明細なし）",
         "ears_form": "UNWANTED: IF そのチケットの種別に出ない項目に値を入れようとしたなら、Kaname は 409 と E-FLD-001 を返し、何も書かない"},
        {"status": 409, "code": "E-FLD-002", "body": {"error": "conflict", "code": "E-FLD-002"}, "errors": ["E-FLD-002"],
         "trigger": "会社の項目（fields）の値が、選択肢に無い（1 つ選ぶ・複数選ぶ。別の項目の選択肢の id・マスタから外した選択肢も同じ・欄・明細なし）",
         "ears_form": "UNWANTED: IF 選択肢に無い値を項目に入れようとしたなら、Kaname は 409 と E-FLD-002 を返し、何も書かない"},
        {"status": 409, "code": "E-FLD-003", "body": {"error": "conflict", "code": "E-FLD-003"}, "errors": ["E-FLD-003"],
         "trigger": "会社の項目（fields）の値が、項目の型と合わない（数に文字・日付に暦に無い日や別の書き方・チェックに文字・選ぶ型に数・欄・明細なし）",
         "ears_form": "UNWANTED: IF 項目の型と合わない値を入れようとしたなら、Kaname は 409 と E-FLD-003 を返し、何も書かない"},
        {"status": 409, "code": "E-FLD-004", "body": {"error": "conflict", "code": "E-FLD-004"}, "errors": ["E-FLD-004"],
         "trigger": "必須の会社の項目（fields）を空にしようとした（null・空の文字・空白だけ・空の並び。必須のチェックは false も同じ・欄・明細なし）",
         "ears_form": "UNWANTED: IF 必須の項目を空にしようとしたなら、Kaname は 409 と E-FLD-004 を返し、何も書かない"},
        {"status": 409, "code": "E-VAL-028", "body": {"error": "conflict", "code": "E-VAL-028"}, "errors": ["E-VAL-028"],
         "trigger": "直した後の開始日が期限より後になる（両方を送ったときも片方だけ送って今の値と合わないときも・欄・明細なし・K-483）",
         "ears_form": "UNWANTED: IF 開始日が期限より後になる直しを送ったなら、Kaname は 409 と E-VAL-028 を返し、何も書かない"},
        {"status": 409, "code": "E-DUE-005", "body": {"error": "conflict", "code": "E-DUE-005"}, "errors": ["E-DUE-005"],
         "trigger": "子のチケットの期限を、親（消していない・期限がある）の期限より後にしようとした（K-483）",
         "ears_form": "UNWANTED: IF 子の期限を親の期限より後にしようとしたなら、Kaname は 409 と E-DUE-005 を返し、何も書かない"},
        {"status": 409, "code": "E-DUE-006", "body": {"error": "conflict", "code": "E-DUE-006"}, "errors": ["E-DUE-006"],
         "trigger": "親のチケットの期限を、消していない直接の子の期限より前にしようとした（K-483）",
         "ears_form": "UNWANTED: IF 親の期限を子の期限より前にしようとしたなら、Kaname は 409 と E-DUE-006 を返し、何も書かない"},
        {"status": 409, "code": "E-DUE-007", "body": {"error": "conflict", "code": "E-DUE-007"}, "errors": ["E-DUE-007"],
         "trigger": "完了したチケットの期限か開始日を変えようとした（K-483）",
         "ears_form": "UNWANTED: IF 完了したチケットの期限か開始日を変えようとしたなら、Kaname は 409 と E-DUE-007 を返し、何も書かない"},
        {"status": 409, "code": "E-DUE-008", "body": {"error": "conflict", "code": "E-DUE-008"}, "errors": ["E-DUE-008"],
         "trigger": "画面が見ていた期限・開始日（expected_due_on・expected_start_on）が今の値と違う（K-483）",
         "ears_form": "UNWANTED: IF 画面が見ていた期限と今の期限が違うなら、Kaname は 409 と E-DUE-008 を返し、何も書かない"},
        {"status": 409, "code": "E-VAL-012", "body": {"error": "conflict", "code": "E-VAL-012"}, "errors": ["E-VAL-012"],
         "trigger": "期限を日本時間の今日より前の日に変えようとした（今日は通る・開始日は過去でもよい・欄・明細なし・K-483）",
         "ears_form": "UNWANTED: IF 期限を今日より前の日に変えようとしたなら、Kaname は 409 と E-VAL-012 を返し、何も書かない"},
        {"status": 422, "code": "E-VAL-018", "body": {"error": "validation", "code": "E-VAL-018", "details": []}, "errors": ["E-VAL-018"],
         "trigger": "まだ変えられない欄（題名・担当者・知らない欄）を送った（前処理・欄ごとに「この欄はまだ変えられません」・段を一緒に送っても何も書かない）",
         "ears_form": "UNWANTED: IF まだ変えられない欄を送ったなら、Kaname は 422 と E-VAL-018 と欄ごとの理由を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-041", "E-VAL-047"],
         "trigger": "形の誤り：優先度が mid・high でない・優先度が高で理由が無い（空・空白だけ・制御文字だけも）・中や優先度なしで理由を付けた・親の id が uuid か null でない（欄 priority・priority_reason・parent_ticket_id）・会社の項目の欄 fields が object でない・空・鍵が uuid でない（大文字小文字違いで重なるも）・値が文字・数・真偽・文字の並び・null のどれでもない・NUL を含む（欄 fields）。保留の理由（E-VAL-041）か再開の条件（E-VAL-047）が空・空白だけ・制御文字だけ、stage_key hold で理由か条件が無い。ほかに stage_id と stage_key の両方・stage_key が todo・doing・hold でない・stage_key todo・doing に理由か条件を付けた・実績が 0〜100000 の整数でない・予定時間（estimate_minutes）が 0〜100000 の整数か null でない・期限・開始日・expected_due_on・expected_start_on が暦にある YYYY-MM-DD か null でない（時刻つきも）・期限なしで理由を送った・expected_due_on を due_on なしで・expected_start_on を start_on なしで送った（K-483）・空の体・本文の形違い（欄ごとの理由）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由（E-VAL-041・E-VAL-047 を含む）を返し、何も書かない"},
        {"status": 422, "code": "E-DUE-001", "body": {"error": "validation", "code": "E-DUE-001", "details": []}, "errors": ["E-DUE-001"],
         "trigger": "期限（due_on）を送ったのに理由（due_reason）が無い・null・空・空白だけ・制御文字だけ（欄 due_reason・K-483）",
         "ears_form": "UNWANTED: IF 理由なしで期限を変えようとしたなら、Kaname は 422 と E-DUE-001 を返し、何も書かない"},
        {"status": 422, "code": "E-DUE-002", "body": {"error": "validation", "code": "E-DUE-002", "details": []}, "errors": ["E-DUE-002"],
         "trigger": "期限を変える理由が 201 文字以上（欄 due_reason・K-483）",
         "ears_form": "UNWANTED: IF 期限を変える理由が 200 文字を超えたなら、Kaname は 422 と E-DUE-002 を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "書く所（段・保留・優先度・親の列・会社の項目の値の行・変更の 1 行・担当者の受け箱の行・証跡）で DB が落ちた（1 つの処理なので何も残らない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 を返し、段・保留の列・変更の 1 行・知らせを前のまま残す"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（今のメンバーか・書けるか）の所で例外になった・DB の関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
}

# 形全体の決まり（欄をまたぐ決まり・K-355 の INPUT_RULES の書き方・代表の答え answer=f0f290e785a9：検査の例外は足さない）。口の振る舞いと同じ 422
#   1 段は stage_id か stage_key の片方だけ／空の体は断る（どれか 1 欄は要る）／stage_key hold は理由と条件が要る／stage_key todo・doing は理由と条件を付けない
#   優先度が高は priority_reason が要る・priority_reason は優先度が高のときだけ（K-440）
#   「ほかの欄（題名・期限など）」は入力の形に無い欄＝知らない欄なので、形が断る（E-VAL-018 の前処理と同じ 422）
_FIELDS = ["stage_id", "stage_key", "actual_minutes", "hold_reason", "resume_condition", "priority", "priority_reason", "parent_ticket_id", "fields", "estimate_minutes", "due_on", "start_on"]
INPUT_RULES = {
    "updateTicket": {"allOf": [
        {"not": {"required": ["stage_id", "stage_key"]}},
        {"anyOf": [{"required": [f]} for f in _FIELDS]},
        {"anyOf": [{"not": {"required": ["stage_key"]}}, {"properties": {"stage_key": {"enum": ["todo", "doing"]}}},
                   {"required": ["hold_reason", "resume_condition"]}]},
        {"anyOf": [{"not": {"required": ["stage_key"]}}, {"properties": {"stage_key": {"enum": ["hold"]}}},
                   {"not": {"anyOf": [{"required": ["hold_reason"]}, {"required": ["resume_condition"]}]}}]},
        # K-483：期限を送ったら（null＝なくすときも）理由が要る／理由だけは送れない／expected は対の欄と一緒に
        {"anyOf": [{"not": {"required": ["due_on"]}}, {"required": ["due_reason"], "properties": {"due_reason": {"type": "string"}}}]},
        {"anyOf": [{"not": {"required": ["due_reason"]}}, {"required": ["due_on"]}]},
        {"anyOf": [{"not": {"required": ["expected_due_on"]}}, {"required": ["due_on"]}]},
        {"anyOf": [{"not": {"required": ["expected_start_on"]}}, {"required": ["start_on"]}]},
    ],
        # K-440：優先度と理由の組み合わせ（条件つきの必須・422・欄 priority_reason）。高なら理由が要る・理由は高のときだけ。
        #   {priority:high}・{priority:mid, reason}・{reason だけ} は無効、{}・{priority:mid}・{priority:high, reason} は有効（oneOf の 2 つ目は「理由が在る、または優先度が高」ではない）
        "oneOf": [{"properties": {"priority": {"enum": ["high"]}}, "required": ["priority", "priority_reason"]},
                  {"not": {"anyOf": [{"required": ["priority_reason"]}, {"properties": {"priority": {"enum": ["high"]}}, "required": ["priority"]}]}}]},
}

# K-401 渡しの口の置き場（createTicketHandover・answerTicketHandover の入力の作り直しと断り方）・渡す前の下見の口（previewTicketHandover）・決まりを読む口（listHandoverRules）
# 渡す前の下見（D-148.2）：詳細の右の「担当者 ▾」を押して相手を選ぶ小窓が開くときに 1 回。候補・件数・決まり・子と関連の数を 1 回で返す
SCREEN_API = {
    "tickets": [
        ("GET", "/tickets/:id/handover-preview", "A51|A111|A48", T, "previewTicketHandover", ["handover_rules", "members", "scopes", "ticket_links", "ticket_handovers"]),
    ],
}

PERMS = {
    "previewTicketHandover": ("read", "そのチケットを見られる人のうち、渡す・配る・申し出るのどれかができる人（できなければ 403）", False),
}

# 渡す：種類・相手（人かグループ）・理由・お願い・返事の期限・一緒に切り替えるもの・上の層にも知らせる・別の人にする（待っている自分の渡し）。
# 答える：受ける・断る・断る理由・一緒に切り替えるもの。表の写し（ticket_id・from_member_id・state・decided_at）は受けない（strict）
INPUTS = {
    "createTicketHandover": ("TicketHandoverCreateInput", {"kind": "string", "to_member_id": "uuid?", "to_scope_id": "uuid?", "reason": "string?", "ask": "string?", "reply_due": "string?", "switch": "object?", "notify_managers": "boolean?", "replaces": "uuid?"}),
    "answerTicketHandover": ("TicketHandoverAnswerInput", {"decision": "string", "decline_reason": "string?", "switch": "object?"}),
}

REQUIRED_INPUTS = {
    "createTicketHandover": ["kind"],
    "answerTicketHandover": ["decision"],
}

VALUE_RANGES = {
    "createTicketHandover": {"kind": {"enum": ["pass", "offer", "distribute", "escalate"]}},
    "answerTicketHandover": {"decision": {"enum": ["accept", "decline"]}},
}

QUERIES = {
    "listHandoverRules": [],
}

LIST_DETAILS = {
    "listHandoverRules": {"sort": False, "desc": "取得（handover_rules）— 渡すときに一緒に切り替えるものの決まり（会社の分を全部）"},
}

# 成功の答え（種類の葉が返す形）は 16 の鍵。K-405 の一覧の 1 件は別の名前 TicketHandover
_HANDOVER = {"id": "uuid", "ticket_id": "uuid", "kind": "string", "state": "string", "from": "object", "to": "object?", "to_scope": "object?", "reason": "string?", "ask": "string?", "reply_due": "string?", "switch": "object", "switch_applied": "object?", "notify_managers": "boolean", "decline_reason": "string?", "decided_at": "string?", "created_at": "string"}
RESPONSES = {
    "previewTicketHandover": ("HandoverPreview", {"kinds": "string[]", "blocked": "string?", "waiting": "object?", "default_reply_due": "string", "rules": "array", "children": "object", "links": "object", "group": "object", "candidates": "array", "groups": "array"}),
    "listHandoverRules": ("HandoverRule", {"id": "uuid", "target": "string", "axis_id": "uuid?", "axis_name": "string?", "mode": "string"}),
    "createTicketHandover": ("TicketHandoverCreated", dict(_HANDOVER)),
    "answerTicketHandover": ("TicketHandoverAnswered", dict(_HANDOVER)),
}

# 渡す：権限（403）・見えない（404）・止まり（409）・入力と相手と切り替え（422）
# 答える：答える人でない（403）・無い（404）・もう決まった／止まり（409）・入力（422）
# 下見：できる種類が無い（403）・見えない（404）
# 判定の所が落ちたときの 503・E-PAGE-003 は、全部の口に付く入口の行（build_api.py の four）と同じ番号なので足さない（同じ番号の行を 2 つにしない）
ERRORS_4XX = {
    "createTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "担当者でない人の引き継いでもらう・管理しない人の配る・閲覧のみの人・別の人にする（replaces）が自分の渡した待っている渡しでない",
         "ears_form": "UNWANTED: IF その人がその種類で渡せないなら、Kaname は 403 と E-HND-002 を返し、何も書かない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "見えない・別の会社・消したチケット・無い id（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えないチケットに渡そうとしたなら、Kaname は 404 と E-PAGE-001 を返し、何も書かない"},
        {"status": 409, "code": "E-HND-004", "body": {"error": "conflict", "code": "E-HND-004"}, "errors": ["E-HND-003", "E-HND-004", "E-HND-005", "E-HND-009"],
         "trigger": "AI が動いている・承認を待っている（E-HND-003）・同じチケットに待っている渡しがある（E-HND-004）・別の人にするの渡しがもう決まっていた（E-HND-005）・完了したチケット（E-HND-009）",
         "ears_form": "UNWANTED: IF そのチケットが今は渡せない状態なら、Kaname は 409 と E-HND-003／E-HND-004／E-HND-005／E-HND-009 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-HND-001", "E-HND-006", "E-HND-007", "E-HND-008", "E-HND-010", "E-HND-011", "E-HND-012", "E-HND-013", "E-HND-014"],
         "trigger": "上へ上げる（E-HND-001）・相手が止まっている／招待中（E-HND-006）・理由が空（E-HND-007）・返事の期限が今より後でない（E-HND-008）・相手が自分（E-HND-010）・切り替えが決まりと合わない（E-HND-011）・グループが無い（E-HND-012）・相手がいない（E-HND-013）・相手が見つからない（E-HND-014）・種類の値・欄の組み合わせ・期限の形・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
    "answerTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "答える人でない（渡した人・関係ない人・閲覧のみ・グループ宛てでそのグループを管理しない人）",
         "ears_form": "UNWANTED: IF 答える人でないなら、Kaname は 403 と E-HND-002 を返し、何も書かない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "無い・別の会社の渡し（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 無い渡しに答えようとしたなら、Kaname は 404 と E-PAGE-001 を返し、何も書かない"},
        {"status": 409, "code": "E-HND-005", "body": {"error": "conflict", "code": "E-HND-005"}, "errors": ["E-HND-005", "E-HND-003", "E-HND-009"],
         "trigger": "もう決まった渡し（受けた・断った・取り消された・二度押し）（E-HND-005）・受けるときにチケットが止まっている（E-HND-003・E-HND-009）",
         "ears_form": "UNWANTED: IF その渡しがもう決まっているか今は受けられないなら、Kaname は 409 と E-HND-005／E-HND-003／E-HND-009 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-HND-001", "E-HND-007", "E-HND-011"],
         "trigger": "上へ上げるの渡し（E-HND-001）・断る理由が空（E-HND-007）・切り替えの形（E-HND-011）・決め方の値・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
    "previewTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "チケットは見えるが、渡す・配る・申し出るのどれもできない（閲覧のみ・取引先・止まっている人）",
         "ears_form": "UNWANTED: IF その人ができる種類が無いなら、Kaname は 403 と E-HND-002 を返し、候補の人などの中身を返さない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "見えない・別の会社・消した・取り込みの下書きのチケット・無い id",
         "ears_form": "UNWANTED: IF 見えないチケットの下見なら、Kaname は 404 と E-PAGE-001 を返し、中身を返さない"},
    ],
}

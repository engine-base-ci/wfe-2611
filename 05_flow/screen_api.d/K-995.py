# K-995 照合が使えなかった登録の回収の口（listOpsPwned・GET /api/v1/ops/pwned／ackOpsPwned・POST /api/v1/ops/workspaces/:id/pwned/ack）
#   代表の答え 2026-11-23（D-156.35）：運営のワークスペースの一覧の上の帯 → 小窓（日時・ワークスペース・人）と「確かめた」。
#   1 行は会社ごと（security_events の pwned_check_unavailable が、その会社の最後の pwned_check_acknowledged より後にある会社・0086 と同じ見方）
SCREEN_API = {
    "ops-home": [
        ("GET", "/ops/pwned", "A138", "security_events", "listOpsPwned", ["tenants", "members"]),
        ("POST", "/ops/workspaces/:id/pwned/ack", "A138", "security_events", "ackOpsPwned", ["ops_audit_events", "audit_events"]),
    ],
}

PERMS = {
    "listOpsPwned": ("ops:any", "運営の人なら誰でも。照合が使えなかった登録の会社と人の名前だけ（中身は出さない）", False),
    "ackOpsPwned": ("ops:any", "運営の人なら誰でも。照合が使えなかった登録の会社と人の名前だけ（中身は出さない）。押した人と日時は運営の記録に残る", False),
}

# 確かめた（K-995）：空の体だけ（strict・ほかの欄は 422）。会社は道の :id で指す
INPUTS = {
    "ackOpsPwned": ("OpsPwnedAckInput", {}),
}

# 一覧の 1 行（会社ごと）：workspace { id, name }・member { id, name } か null（いちばん新しい出来事の人）・last_at（いちばん新しい出来事の時刻）・count（確かめた印より後の出来事の数）
#   K-1110：確定前に去った申し込みの照合落ちは、workspace・member が null の 1 行にまとめて出す（D-156.69・D-156.79・数と時刻だけ）
# 確かめた：acknowledged_at（書いた印の時刻）・remaining（確かめた後に残る会社の数＝外枠の pwned.unchecked と同じ）
RESPONSES = {
    "listOpsPwned": ("OpsPwnedRow", {"workspace": "object?", "member": "object?", "last_at": "string", "count": "integer"}),
    "ackOpsPwned": ("OpsPwnedAck", {"acknowledged_at": "string", "remaining": "integer"}),
}

# 絞り込みを持たない（会社の数までを全部返す）。並びは last_at の新しい順で固定（sort を受けない）
QUERIES = {
    "listOpsPwned": [],
}
LIST_DETAILS = {
    "listOpsPwned": {"sort": False, "desc": "取得（security_events）— 照合が使えなかった登録の会社を新しい順に見る（日時・ワークスペース・人・件数。確かめていない会社だけ）"},
}

# 確かめたは作らず印を書くだけなので 200
SUCCESS_STATUS = {"ackOpsPwned": 200}

ERRORS_4XX = {
    "listOpsPwned": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [], "trigger": "運営の DB の関数が、読む・書く行が無いこと（P0002）を知らせた（共通の読み替え ops/db.ts の opsErrorReply）", "ears_form": "UNWANTED: IF 運営の DB の関数が行が無いと知らせたなら、Kaname は 404 を返し、何も変えない"},
    ],
    "ackOpsPwned": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "指した会社が無い・見えない（無い id・運営の会社・作りかけ・消した会社）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 指した会社が無いか見えないなら、Kaname は 404 を返し、どの会社にも確かめた印を書かない"},
        {"status": 409, "code": "E-OPS-026", "body": {"error": "conflict", "code": "E-OPS-026"}, "errors": ["E-OPS-026"],
         "trigger": "確かめる物が無い（もう確かめた会社・照合が使えなかった出来事の無い会社）",
         "ears_form": "UNWANTED: IF 確かめる物が無いなら、Kaname は 409 と E-OPS-026 を返し、印も記録も増やさない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "確かめた印・運営の記録を書く DB（app.ops_pwned_ack）が落ちた・使えない",
         "ears_form": "UNWANTED: IF 確かめた印を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、印も記録も残さない"},
    ],
}

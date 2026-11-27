# K-1110 確定前に去った申し込みの照合落ちをまとめて確かめた（ackOpsPwnedPending・POST /api/v1/ops/pwned/pending/ack）
#   代表の答え 2026-11-23（D-156.69・D-156.79）：確定しないまま去った申し込みの照合落ちも、運営の照合落ちの一覧（listOpsPwned・K-995）に
#   まとめて 1 行（workspace・member は null・数と時刻だけ）で出し、その［確かめた］でまとめて確かめる。道は 05_flow/screen_api.py の ops-home

PERMS = {
    "ackOpsPwnedPending": ("ops:any", "運営の人なら誰でも。確定前に去った申し込みの数と時刻だけ（メール・名前・会社名は出さない）。押した人と日時は運営の記録に残る", False),
}

# 体は空の形だけ（strict・ほかの欄は 422）。1 社を指さない
INPUTS = {
    "ackOpsPwnedPending": ("OpsPwnedPendingAckInput", {}),
}

# acknowledged_at（書いた確かめた時刻）・remaining（確かめた後に残る照合落ちの数＝外枠の pwned.unchecked と同じ・K-995 の確かめたと同じ形）
RESPONSES = {
    "ackOpsPwnedPending": ("OpsPwnedPendingAck", {"acknowledged_at": "string", "remaining": "integer"}),
}

# 確かめたは作らず印を書くだけなので 200
SUCCESS_STATUS = {"ackOpsPwnedPending": 200}

ERRORS_4XX = {
    "ackOpsPwnedPending": [
        {"status": 409, "code": "E-OPS-026", "body": {"error": "conflict", "code": "E-OPS-026"}, "errors": ["E-OPS-026"],
         "trigger": "確かめる物が無い（確定前に去った照合落ちの申し込みが無い・もう確かめた・同時に押した後の方）",
         "ears_form": "UNWANTED: IF 確かめる確定前の申し込みが無いなら、Kaname は 409 と E-OPS-026 を返し、印も記録も増やさない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "確かめた時刻・運営の記録を書く DB（app.ops_pwned_pending_ack）が落ちた・使えない",
         "ears_form": "UNWANTED: IF 確かめた時刻を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、印も記録も残さない"},
    ],
}

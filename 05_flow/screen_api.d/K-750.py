# K-750 決めた履歴を読む口（listApprovalHistory・GET /api/v1/approvals/history）
#   自分が決めた AI の成果物の承認（承認・差し戻し・止める）を、決めた新しい順に読む。決めと期間（日本時間の日付）で絞る。
#   QUERIES（decision・from・to）と PERMS（自分が決めたものだけ）は本体の行のまま。cursor の形（base64url）は作り手が KEY_CURSOR_OPS から書く
# 問い合わせの値域（K-468 の仕組み・契約と fuzz の書き物。入口は読まず、422 にするのは口 apps/api/src/features/F5/more/history.ts）
#   decision：approve・return・stop。from・to：暦に在る日（format: date）＋年 0000 を外す pattern（K-473 と同じ形）
QUERY_RANGES = {
    "listApprovalHistory": {
        "decision": {"enum": ["approve", "return", "stop"]},
        "from": {"format": "date", "pattern": "^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
        "to": {"format": "date", "pattern": "^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
    },
}
# 一覧の細目：limit は 1〜200（既定 20）・sort を受けない（決めた時刻・id の新しい順で固定）
LIST_DETAILS = {
    "listApprovalHistory": {"limit_max": 200, "sort": False, "desc": "取得（approvals）— 自分が決めた AI の成果物の承認を、決めた新しい順に読む（決めと期間で絞る・取り下げられるかの印）", "meta": "{ limit, counts }"},
}
# 一覧の答えの meta：札の横の数（期間で絞った数・決めの札では絞らない）{ total, approve, return, stop }
META = {
    "listApprovalHistory": {"counts": "object"},
}
# 答えの 1 件（鍵はちょうど 11）
RESPONSES = {
    "listApprovalHistory": ("ApprovalHistoryItem", {"id": "string", "ticket_id": "string", "ticket_number": "string", "title": "string", "decision": "string", "decided_at": "string", "reason": "string?", "next_actor": "string?", "withdrawn_at": "string?", "run_status": "string?", "can_withdraw": "boolean"}),
}

# K-462 既読にする口（readNotification・PATCH /api/v1/notifications/:id）と全部既読にする口（readAllNotifications・POST /api/v1/notifications/read-all）
# 入力（K-462・D-151.3）：既読にする口は read（真偽）だけ（strict・member_id・payload・sent_at など表の欄は 422）。read true＝読んだ印を付ける（すでにあれば最初の時刻のまま）・false＝未読に戻す。
#   全部既読の体は空（strict・どの欄も 422）
INPUTS = {
    "readNotification": ("NotificationReadInput", {"read": "boolean"}),
    "readAllNotifications": ("NotificationReadAllInput", {}),
}
REQUIRED_INPUTS = {
    "readNotification": ["read"],   # apps/api/src/features/F7/notifications/read.ts（無い・真偽でない・null は 422・欄 read・K-462）
}
# 答え：既読にする口は一覧（K-461）の 1 件と同じ 12 欄。全部既読は、この呼び出しで読んだことにした行の数
RESPONSES = {
    "readNotification": ("Notification", {"id": "uuid", "kind": "string", "tag": "string", "href": "string?", "ticket_id": "uuid?", "number": "string?", "title": "string?", "actor": "object?", "params": "object", "read": "boolean", "read_at": "string?", "created_at": "string"}),
    "readAllNotifications": ("NotificationsRead", {"read": "integer"}),
}
# 404 だけ新しいエラー E-NTF-010（自分宛てで一覧に出る行でない）。422 は契約に書ける形の誤り（read の型・知らない欄）だけで、DB の中身で決まる 422 は作らない（控え帳 2026-11-20 16:51）
ERRORS_4XX = {
    "readNotification": [
        {"status": 404, "code": "E-NTF-010", "body": {"error": "not_found", "code": "E-NTF-010"}, "errors": ["E-NTF-010"],
         "trigger": "別の人宛て・別の会社の行・無い id・一覧に出ない行（メールの印・消した・知らない種類・見えないチケット）",
         "ears_form": "UNWANTED: IF 自分宛てで一覧に出る行でないなら、Kaname は 404 と E-NTF-010 を返し、行を変えない"},
    ],
}

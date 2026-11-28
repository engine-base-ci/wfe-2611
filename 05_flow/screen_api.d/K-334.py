# K-334 期限切れの招待の送り直しを頼む口（requestInvitationResend）
SCREEN_API = {
    "invite-accept": [
        ("POST", "/auth/invitations/:token/resend-request", "A03", "invitations", "requestInvitationResend", ["notifications"]),
    ],
}

PERMS = {
    "requestInvitationResend": ("public", "期限切れの招待のリンクを持つ人。招いた人（居なければ管理者）に送り直しを頼む知らせが届く。同じ招待で 1 日 1 回（D-128.63・K-334）", False),
}

# 送り直しを頼む（K-334）：空の体だけ（strict・ほかの欄は 422）。招待は道のトークンで引く
INPUTS = {
    "requestInvitationResend": ("InvitationResendInput", {}),
}

# 送り直しを頼んだ（K-334）。sent（知らせた）・already（24 時間の内に頼んである）・failed（1 通でも送れなかった・押し直せる）
RESPONSES = {
    "requestInvitationResend": ("InvitationResendResult", {"result": "string"}),
}

# 送り直しを頼む（K-334・D-128.63）。期限切れの招待だけ。行が無い 404・まだ使える 409・取り消し／使われた 410・宛てを引く DB が落ちた 503。
#   24 時間の内の 2 回目は 201・already、メールが送れなかったら 201・failed（502 にしない）
ERRORS_4XX = {
    "requestInvitationResend": [
        {"status": 404, "code": "E-INV-001", "body": {"error": "not_found", "code": "E-INV-001"}, "errors": ["E-INV-001"],
         "trigger": "招待のリンクの印が見つからない（でたらめ・古い・512 文字を超える）",
         "ears_form": "UNWANTED: IF 招待のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、誰にも知らせない"},
        {"status": 409, "code": "E-INV-008", "body": {"error": "conflict", "code": "E-INV-008"}, "errors": ["E-INV-008"],
         "trigger": "招待はまだ使える（期限の内・取り消されていない・使われていない）",
         "ears_form": "UNWANTED: IF 招待がまだ使えるなら、Kaname は 409 と E-INV-008 を返し、誰にも知らせない"},
        {"status": 410, "code": "E-INV-002", "body": {"error": "gone", "code": "E-INV-002"}, "errors": ["E-INV-002", "E-INV-004"],
         "trigger": "招待が取り消された（E-INV-002）・もう使われた（E-INV-004）",
         "ears_form": "UNWANTED: IF 招待が取り消されたかもう使われたなら、Kaname は 410 と E-INV-002／E-INV-004 を返し、誰にも知らせない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "招待の状態を読む・宛てを引く・知らせの行を入れる DB（app.invitation_resend_targets）が落ちた・使えない",
         "ears_form": "UNWANTED: IF 宛てを引く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、知らせの行もメールも残さない"},
    ],
}

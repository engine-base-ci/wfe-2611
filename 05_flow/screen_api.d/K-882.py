# K-882 見せたチケットのチャットにゲストが書く口（postPortalTicketMessage）
#   体は本文 body だけ（strict・入口が前後の空白を取り NFKC にした後で空なら 422）。書いた人はセッションのゲスト・種類は post・ゲストに見える印は true
#   書けるのは見せたチケットのゲストだけ（判定は DB の関数・K-878 の app.guest_sees_ticket）。見えなければ 404・E-GST-060（在るかを漏らさない）
#   書いたら担当者の受け箱に 1 件（ticket.message・メールは送らない・関門 C6）
SCREEN_API = {
    "portal": [
        ("POST", "/portal/tickets/:id/messages", "A125", "ticket_messages", "postPortalTicketMessage", ["tickets", "notifications", "audit_events"]),
    ],
}

PERMS = {
    "postPortalTicketMessage": ("client", "自分のゲストのグループに見せたチケットのチャットに書ける（見せていない・外した直後は書けない）", False),
}

INPUTS = {
    "postPortalTicketMessage": ("PortalTicketMessageInput", {"body": "string"}),
}

REQUIRED_INPUTS = {"postPortalTicketMessage": ["body"]}

VALUE_RANGES = {"postPortalTicketMessage": {"body": {"minLength": 1}}}

RESPONSES = {
    "postPortalTicketMessage": ("PortalTicketMessageCreated", {"id": "uuid"}),
}

ERRORS_4XX = {
    "postPortalTicketMessage": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "社内の人（役割ゲストでない人）が先方の口を叩いた（入口の役の柵）",
         "ears_form": "UNWANTED: IF ゲストでない人が見せたチケットのチャットに書こうとしたなら、Kaname は 403 を返し、書き込みも受け箱の行も証跡も作らない"},
        {"status": 404, "code": "E-GST-060", "body": {"error": "not_found", "code": "E-GST-060"}, "errors": ["E-GST-060"],
         "trigger": "チケットを見せていない・見せる相手を外した・ゲストのグループが消えた・チケットを消した・下書き・別のグループの物・無い id（在るかを漏らさない・欄と details なし）",
         "ears_form": "UNWANTED: IF 書こうとしたチケットがゲストに見えないなら、Kaname は 404 と E-GST-060 を返し、在るかを漏らさず何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "本文が無い・前後の空白を取ると空・文字でない／知らない欄（author_member_id・kind・guest_visible・mentions など）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
}

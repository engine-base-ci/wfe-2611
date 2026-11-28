# K-908 依頼のやり取りに書く口（postPortalRequestMessage）
#   書けるかは K-878 の app.guest_ok()・app.my_guest_group() と、依頼の state（new・asking だけ）で決める（D-155.10・D-155.37）。
#   SCREEN_API・PERMS の行は本体の前からある行を直した（ここには同じ鍵を書かない）。ここは本体に無い鍵だけ
INPUTS = {
    "postPortalRequestMessage": ("PortalRequestMessageInput", {"body": "string"}),
}
RESPONSES = {
    "postPortalRequestMessage": ("PortalRequestMessagePosted", {"id": "uuid"}),
}
REQUIRED_INPUTS = {
    "postPortalRequestMessage": ["body"],   # apps/api/src/features/F11/portal/request-message.ts の checkMessage（無い・空・空白だけは 422 欄 body）
}
VALUE_RANGES = {
    "postPortalRequestMessage": {   # apps/api/src/features/F11/portal/request-message.ts の checkMessage
        "body": {"minLength": 1, "maxLength": 10000},
    },
}
_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
              "trigger": "ゲストでない（役割 requester でない・グループに入っていない・止めた・抜けた・グループから外された・グループが消えた）・社内の人（入口）",
              "ears_form": "UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も書かない"}
ERRORS_4XX = {
    "postPortalRequestMessage": [
        dict(_FORBIDDEN),
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "自分のゲストのグループの依頼でない（別のグループ・別の会社・消した・無い id。在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 依頼が自分のゲストのグループの物でないなら、Kaname は 404 を返し、何も書かない"},
        {"status": 409, "code": "E-GST-170", "body": {"error": "conflict", "code": "E-GST-170"}, "errors": ["E-GST-170"],
         "trigger": "依頼がもうチケットになった（ticketed）・断られた（declined）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 依頼の state が new・asking でないなら、Kaname は 409 と E-GST-170 を返し、返事も知らせも作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "本文が無い・空・空白だけ・10000 字を超える・NUL を含む・文字でない／知らない欄（添付・side など）",
         "ears_form": "UNWANTED: IF 本文の値が決まりの外なら、Kaname は 422 と欄の理由を返し、何も書かない"},
    ],
}

# K-907 依頼を出す口（createPortalRequest）・グループの依頼を読む口（getPortalRequest）
#   見えるか・出せるかは K-878 の app.guest_ok()・app.my_guest_group() だけで決める（D-155.37・D-155.42）。
#   SCREEN_API・RESPONSES・PERMS の行は本体の前からある行を直した（ここには同じ鍵を書かない）。ここは本体に無い鍵だけ
#   いつまでに（due_on）は作り手の型の名前に date が無いので文字（null 可）と日付の形の値域で書く（今日より前・暦に無い日は UNEXPRESSIBLE_422）
INPUTS = {
    "createPortalRequest": ("PortalRequestCreateInput", {"body": "string", "due_on": "string?", "attachment_ids": "uuid[]?"}),
}
RESPONSES = {
    "createPortalRequest": ("PortalRequestCreated", {"id": "uuid"}),
}
REQUIRED_INPUTS = {
    "createPortalRequest": ["body"],   # apps/api/src/features/F11/portal/request-create.ts の checkInput（無い・空・空白だけは 422 欄 body）
}
VALUE_RANGES = {
    "createPortalRequest": {   # apps/api/src/features/F11/portal/request-create.ts の checkInput
        "body": {"pattern": "\\S", "minLength": 1, "maxLength": 10000},
        "due_on": {"pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
        "attachment_ids": {"maxItems": 5},
    },
}
UNEXPRESSIBLE_422 = {
    "createPortalRequest": ["いつまでにが今日より前（日本時間）", "暦に無い日付のいつまでに"],
}
_FORBIDDEN = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
              "trigger": "ゲストでない（役割 requester でない・グループに入っていない・止めた・抜けた・グループから外された・グループが消えた）・社内の人（入口）",
              "ears_form": "UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も返さず何も書かない"}
ERRORS_4XX = {
    "createPortalRequest": [
        dict(_FORBIDDEN),
        {"status": 404, "code": "E-GST-160", "body": {"error": "not_found", "code": "E-GST-160"}, "errors": ["E-GST-160"],
         "trigger": "付けようとした添付が、自分の下書きでない・無い・もう依頼に付いた・消した・検査が済んでいない（1 つでも）。欄・details は付けない",
         "ears_form": "UNWANTED: IF 付けようとした添付のどれかが自分の検査済みの下書きでないなら、Kaname は 404 と E-GST-160 を返し、依頼も添付の付け替えも知らせも作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "本文が無い・空・空白だけ・10000 字を超える／いつまでにの形が違う・暦に無い・今日より前（日本時間）／添付が 6 つ以上・uuid でない／知らない欄",
         "ears_form": "UNWANTED: IF 本文・いつまでに・添付の値が決まりの外なら、Kaname は 422 と欄ごとの理由を返し、何も作らない"},
    ],
    "getPortalRequest": [
        dict(_FORBIDDEN),
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "自分のゲストのグループの依頼でない（別のグループ・別の会社・消した・無い id。在るかを漏らさない・欄なし）",
         "ears_form": "UNWANTED: IF 依頼が自分のゲストのグループの物でないなら、Kaname は 404 を返し、題も本文も返さない"},
    ],
}

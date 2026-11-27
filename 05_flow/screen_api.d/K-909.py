# K-909 ゲストが依頼に付ける添付を足す口（uploadPortalAttachment）
#   体は JSON { name, content_type, data }（data は base64）。契約の入口の 1MB に入るよう、中身は 1 つ 700000 バイトまで（2026-11-23 の決め）。
#   SCREEN_API・PERMS の行は本体の前からある行を直した（ここには同じ鍵を書かない）。ここは本体に無い鍵だけ
#   口は apps/api/src/features/F11/portal/attachment.ts（前処理 input と本体）・attachment-check.ts（大きさと種類）
INPUTS = {
    "uploadPortalAttachment": ("PortalAttachmentInput", {"name": "string", "content_type": "string", "data": "string"}),
}
RESPONSES = {
    "uploadPortalAttachment": ("PortalAttachmentAdded", {"id": "uuid", "name": "string"}),
}
REQUIRED_INPUTS = {
    "uploadPortalAttachment": ["name", "content_type", "data"],   # attachment.ts の input（無い欄は入口の strict な形が 422）
}
VALUE_RANGES = {
    "uploadPortalAttachment": {   # attachment.ts の input・checkName
        "name": {"minLength": 1, "maxLength": 200},
        "content_type": {"maxLength": 100, "pattern": "^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$"},
        "data": {"maxLength": 1000000},
    },
}
UNEXPRESSIBLE_422 = {
    "uploadPortalAttachment": ["名前に / \\ や制御文字を含む", "中身が base64 でない"],
}
ERRORS_4XX = {
    "uploadPortalAttachment": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "ゲストでない（役割 requester でない・グループに入っていない・止めた・抜けた・グループから外された・グループが消えた）・社内の人（入口）",
         "ears_form": "UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、置き場に置かず行も作らない"},
        {"status": 422, "code": "E-GST-181", "body": {"error": "validation", "code": "E-GST-181"}, "errors": ["E-GST-181", "E-GST-182", "E-GST-183", "E-GST-184"],
         "trigger": "中身が 700000 バイトを超える（E-GST-181）／実行できる形式（名前の拡張子か中身の先頭・E-GST-182）／依頼に付いていない自分の下書きが 5 つある（E-GST-183）／中身が空（E-GST-184）。欄・details は付けない",
         "ears_form": "UNWANTED: IF ファイルが大きすぎる・空・実行できる形式・下書きが 5 つあるなら、Kaname は 422 とその番号を返し、置き場に置かず行も作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR", "details": []}, "errors": [],
         "trigger": "名前が空・空白だけ・200 字を超える・/ \\ や制御文字を含む／種類が「種類/種類」の形でない・100 字を超える／中身が base64 でない／欄が足りない／知らない欄（owner_id・scope_id など）",
         "ears_form": "UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、何も置かず何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "置き場が落ちた・置いた後に行が書けなかった（置いたファイルは消す。ログは例外の種類と参照だけ）",
         "ears_form": "UNWANTED: IF 置き場か DB が落ちたなら、Kaname は 503 を返し、行も証跡も半端なファイルも残さない"},
    ],
}

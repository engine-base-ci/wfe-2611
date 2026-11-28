# K-834 自分の顔の写真（uploadAvatar）
# 体は multipart/form-data（入口の multipart の道・K-828）：欄 file（PNG・JPEG・WebP を中身の先頭の印で見る・5 MB まで）か reset=true（文字に戻す）のどちらか 1 つ。
#   JSON の体を持たない（strict の形の対象外）。答えは getMe の member.avatar と同じ形（kind・initial・url）。顔は今の会社の自分の行だけ（D-154.56）
INPUTS = {
    "uploadAvatar": ("AvatarUploadInput", {}),
}

RESPONSES = {
    "uploadAvatar": ("Avatar", {"avatar": "object"}),
}

# 体の形（file か reset=true のどちらか 1 つ）は multipart の欄で、契約の JSON の形に書けない
UNEXPRESSIBLE_422 = {
    "uploadAvatar": ["体が multipart の欄 file か reset=true のどちらか 1 つでない（JSON の形に書けない）",
                     "ファイルの中身が PNG・JPEG・WebP でない（中身の先頭の印で見る・E-ME-011）"],
}

# 顔の写真：大きすぎる（413）・体の形（422）・種類（422）・置き場（502）・DB（503）
ERRORS_4XX = {
    "uploadAvatar": [
        {"status": 413, "code": "E-ME-010", "body": {"error": "payload_too_large", "code": "E-ME-010"}, "errors": ["E-ME-010"],
         "trigger": "写真のファイルが 5 MB（5,242,880 バイト）を超えた",
         "ears_form": "UNWANTED: IF 写真のファイルが 5 MB を超えたなら、Kaname は 413 と E-ME-010 を返し、顔を変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "体に file も reset も無い・両方ある・reset が true 以外（欄 file）",
         "ears_form": "UNWANTED: IF 体が file か reset=true のどちらか 1 つでないなら、Kaname は 422 を返し、顔を変えない"},
        {"status": 422, "code": "E-ME-011", "body": {"error": "validation_failed", "code": "E-ME-011"}, "errors": ["E-ME-011"],
         "trigger": "ファイルの中身が PNG・JPEG・WebP でない（SVG・GIF・空・画像でない。content-type と名前は信じない）",
         "ears_form": "UNWANTED: IF ファイルの中身が PNG・JPEG・WebP でないなら、Kaname は 422 と E-ME-011 を返し、顔を変えない"},
        {"status": 502, "code": "E-ME-012", "body": {"error": "upstream_failed", "code": "E-ME-012"}, "errors": ["E-ME-012"],
         "trigger": "置き場（関門 C4）に写真を置けなかった",
         "ears_form": "UNWANTED: IF 置き場に写真を置けなかったなら、Kaname は 502 と E-ME-012 を返し、顔は前のまま"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "顔を書く DB が落ちた",
         "ears_form": "UNWANTED: IF 顔を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、置いた新しい写真を消して顔は前のまま"},
    ],
}

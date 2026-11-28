# K-424 契約 fuzz（G36）で出た、契約に書けない値の決まり（口の振る舞いのまま 422）
#   OpenAPI 3.0.3 は欄の名前の決まり（propertyNames）を書く場所が無い（3.1 から）。作り手は INPUT_RULES の propertyNames を写すが、
#   fuzz（Schemathesis の 3.0 の読み）はそれを見ずに変な字の欄の名前を作り、口が形の誤りとして 422 で断る（G36 の回 45185794809 の ST202 2 件）。
#   K-475 の createSavedView と同じく、その口の 422 の説明と x-unexpressible-422 に書き、schemathesis.toml でこの口に限って 422 を受け付けと数えない
UNEXPRESSIBLE_422 = {
    "createTicket": ["区画（sections）の欄の名前の決まり（英小文字で始まる英小文字・数字・_ の 41 字まで）",
                     "会社の項目（fields）の欄の名前の決まり（項目の id の uuid）"],
    "updateTicket": ["会社の項目（fields）の欄の名前の決まり（項目の id の uuid）"],
}

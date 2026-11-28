# K-424 契約 fuzz（G36）で出た、契約に書けない値の決まりを契約の形の表に足す分（K-325 の断片）。05_flow/screen_api.d/K-424.py と同じ字の写し
#   区画（sections）・会社の項目（fields）の欄の名前の決まりは OpenAPI 3.0 に書く場所が無い（propertyNames は 3.1 から）ので、口の振る舞いのまま 422
UNEXPRESSIBLE_422 = {
    "createTicket": ["区画（sections）の欄の名前の決まり（英小文字で始まる英小文字・数字・_ の 41 字まで）",
                     "会社の項目（fields）の欄の名前の決まり（項目の id の uuid）"],
    "updateTicket": ["会社の項目（fields）の欄の名前の決まり（項目の id の uuid）"],
}

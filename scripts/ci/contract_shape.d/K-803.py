# K-803 層を足す・直す・読む口（createLayer・updateLayer・listLayers）の契約の形の表に足す分（K-325 の断片）。形の決まりは全部
# 05_flow/screen_api.d/K-803.py の VALUE_RANGES・INPUT_RULES に書いた（名前・並び・直す口の anyOf）。DB の中身で決まる断り（上限・名前の重なり・無い層）は 404・409（控え帳）
UNEXPRESSIBLE_422: dict = {}
REQUIRED_INPUTS = {
    "createLayer": {"label"},   # screen_api.d/K-803.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
VALUE_RANGES = {
    "createLayer": {'label': {'pattern': '\\S', 'maxLength': 40}, 'order_no': {'minimum': 1, 'maximum': 9007199254740991}},   # screen_api.d/K-803.py の VALUE_RANGES と同じ（統合の枝で写した）
    "updateLayer": {'label': {'pattern': '\\S', 'maxLength': 40}, 'order_no': {'minimum': 1, 'maximum': 9007199254740991}},   # screen_api.d/K-803.py の VALUE_RANGES と同じ（統合の枝で写した）
}

# 統合の枝で足した（K-144 の契約の形の試験・直しの担当 XC）
NO_REQUIRED_INPUTS = {
    "updateLayer": 'label・order_no のどちらか 1 つ以上（入力の形の anyOf・INPUT_RULES）。片方だけなら 422 にしない',
}

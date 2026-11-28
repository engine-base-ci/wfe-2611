# K-804 グループを直す口（updateScope）の契約の形の表に足す分（K-325 の断片）。形の決まりは全部 05_flow/screen_api.d/K-804.py の
# VALUE_RANGES と INPUT_RULES に書いた（名前・色・並び・人の数・1 つは要る）。DB の中身で決まる断り（重なり・人の状態・直す先）は 404・409（控え帳）
NO_REQUIRED_INPUTS = {
    "updateScope": "直す欄はどれも任意（名前・色・並び・マネージャー）。1 つは要る（INPUT_RULES の anyOf・体が空は 422）",
}
UNEXPRESSIBLE_422: dict = {}
VALUE_RANGES = {
    "updateScope": {'name': {'pattern': '\\S', 'maxLength': 100}, 'color': {'enum': ['teal', 'plum', 'indigo', 'amber', 'coral', 'sage']}, 'position': {'minimum': 1}, 'manager_member_ids': {'maxItems': 10}},   # screen_api.d/K-804.py の VALUE_RANGES と同じ（統合の枝で写した）
}

# K-802 グループを足す口（createScope）の契約の形の表に足す分（K-325 の断片）。形の決まりは全部 05_flow/screen_api.d/K-802.py の
# VALUE_RANGES に書いた（名前・短い名前・色・人の数）。DB の中身で決まる断り（重なり・上限・人の状態）は 404・409（控え帳）
UNEXPRESSIBLE_422: dict = {}
REQUIRED_INPUTS = {
    "createScope": {"name", "ticket_prefix"},   # screen_api.d/K-802.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
VALUE_RANGES = {
    "createScope": {'name': {'pattern': '\\S', 'maxLength': 100}, 'ticket_prefix': {'pattern': '^(?![Tt]$)[A-Za-z][A-Za-z0-9]{0,7}$'}, 'color': {'enum': ['teal', 'plum', 'indigo', 'amber', 'coral', 'sage']}, 'manager_member_ids': {'maxItems': 10}, 'member_ids': {'maxItems': 50}},   # screen_api.d/K-802.py の VALUE_RANGES と同じ（統合の枝で写した）
}

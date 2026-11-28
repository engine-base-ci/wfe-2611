# K-1107 請求書の型の口 2 本（getOpsInvoiceTemplate・updateOpsInvoiceTemplate）の契約の形の表に足す分（K-325 の断片）。入力と答えの形は screen_api.d/K-1107.py のまま（足す物なし）
REQUIRED_INPUTS = {
    "updateOpsInvoiceTemplate": {"address", "company", "contact", "payee", "reg_no", "version"},   # screen_api.d/K-1107.py の REQUIRED_INPUTS と同じ（統合の枝で写した）
}
VALUE_RANGES = {
    "updateOpsInvoiceTemplate": {'company': {'minLength': 1, 'maxLength': 100, 'pattern': '\\S'}, 'address': {'minLength': 1, 'maxLength': 200, 'pattern': '\\S'}, 'reg_no': {'pattern': '^T[0-9]{13}$'}, 'contact': {'minLength': 1, 'maxLength': 200, 'pattern': '\\S'}, 'payee': {'minLength': 1, 'maxLength': 200, 'pattern': '\\S'}, 'note': {'maxLength': 500}, 'version': {'minimum': 0}},   # screen_api.d/K-1107.py の VALUE_RANGES と同じ（統合の枝で写した）
}

# K-1000 が K-1006 から前へ移した分（PM の決め 2026-11-26・K-924 と同じく前へ移す）
#   段の枝 i/段13 に K-970（stopWorkspace の INPUT_RULES の欄 mode・stop_on・reason_key）が先に入り、入力の形の持ち主 K-1006 が
#   K-948 ← K-1000 の重ね待ちで入れず、作り直し（05_flow/build_api.py）が落ちる輪になったため、止めるの入力の形だけをここに置く。
#   中身は K-1006 の断片（t/K-1006 3ce4884e86 の 05_flow/screen_api.d/K-1006.py）の stopWorkspace の 3 行と同じ。K-1006 はこの 3 行を持たない
#   理由の種類 4 つ・先に知らせる（scheduled・stop_on の日に止まる）／すぐ（now）。admin_notice は管理者へのお知らせの本文（D-156.23）。体は strict（知らない欄は 422）

INPUTS = {
    "stopWorkspace": ("OpsWorkspaceStopInput", {"reason_key": "string", "mode": "string", "stop_on": "string", "note": "string", "admin_notice": "string"}),
}

REQUIRED_INPUTS = {
    "stopWorkspace": ["reason_key", "mode"],
}

VALUE_RANGES = {
    "stopWorkspace": {"reason_key": {"enum": ["unpaid", "violation", "danger", "request"]}, "mode": {"enum": ["scheduled", "now"]},
                      "stop_on": {"format": "date"}, "note": {"minLength": 1, "maxLength": 500},
                      "admin_notice": {"minLength": 1, "maxLength": 2000}},
}

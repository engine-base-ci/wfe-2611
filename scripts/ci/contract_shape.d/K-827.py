# K-827 名前を直す口（updateWorkspace）の契約の形の表に足す分（K-325 の断片）。getWorkspaceSettings は体を受けない GET なので足す行は無い
# apps/api/src/features/F10/workspace/rename.ts（name は無ければ 422・E-WS-001。前後の空白を削って 1〜100 字・コードポイント）
REQUIRED_INPUTS = {
    "updateWorkspace": {"name"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "updateWorkspace": {
        "name": {"minLength": 1, "maxLength": 100},
    },
}
UNEXPRESSIBLE_422: dict = {}   # 名前の空・長すぎる（E-WS-001・E-WS-002）は VALUE_RANGES の minLength・maxLength で契約に書いた（前後の空白を削った後の字数）
AGENT_ANSWERS = {}

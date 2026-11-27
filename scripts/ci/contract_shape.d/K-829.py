# K-829 誰ができるかを変える（updateWorkspacePermissions）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F10/workspace/permissions.ts（必須の欄は無い。1 つ以上は前処理 checkPermissionsInput と契約の anyOf）
REQUIRED_INPUTS = {}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
# 値は 2 つだけ（admin・admin_manager）
VALUE_RANGES = {
    "updateWorkspacePermissions": {
        "billing": {"enum": ["admin", "admin_manager"]},
        "delete_workspace": {"enum": ["admin", "admin_manager"]},
    },
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}

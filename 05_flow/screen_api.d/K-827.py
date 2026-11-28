# K-827 設定を読む口（getWorkspaceSettings）と名前を直す口（updateWorkspace）
# 読む（D-154.83）：名前・ロゴの今・誰ができるか 2 つ・決まっている物・消す手続きの今・押せる区画（access）。
#   プランと支払い・取引先の見える人の既定・書き出しは読まない（D-154.22・D-154.4）。入口の言葉は write（本体の PERMS）で、開けるかは口の中で決める
# 直す：名前だけ（前後の空白を削って 1〜100 字・コードポイントで数える）。strict（ほかの欄は 422）
INPUTS = {
    "updateWorkspace": ("WorkspaceUpdateInput", {"name": "string"}),
}

RESPONSES = {
    "getWorkspaceSettings": ("WorkspaceSettings", {"workspace": "object", "permissions": "array", "fixed_rules": "array", "deletion": "object", "access": "object"}),
    # 直した後の名前（rename.ts は { workspace: { id, name, logo } } を返す。前例 updateTicket の TicketUpdated と同じ形）
    "updateWorkspace": ("WorkspaceRenamed", {"workspace": "object"}),
}

# apps/api/src/features/F10/workspace/rename.ts（名前は無ければ 422・E-WS-001）
REQUIRED_INPUTS = {
    "updateWorkspace": ["name"],
}

# apps/api/src/features/F10/workspace/rename.ts（前後の空白を削った後の字数。サロゲート対は 1 字）
VALUE_RANGES = {
    "updateWorkspace": {
        "name": {"minLength": 1, "maxLength": 100},
    },
}

# 読む：開けない人（403）。直す：管理者でない（403）・名前が空／長すぎる（422）
ERRORS_4XX = {
    "getWorkspaceSettings": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "管理者でなく、「誰ができるか」で可にもなっていない（app.workspace_can が billing・delete_workspace とも不可）",
         "ears_form": "UNWANTED: IF 管理者でなく、プランと支払いもワークスペースを消すも可でないなら、Kaname は 403 を返し、設定を返さない"},
    ],
    "updateWorkspace": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "管理者でない（可になったマネージャー・個別に付けた人も名前は直せない）",
         "ears_form": "UNWANTED: IF 管理者でないなら、Kaname は 403 を返し、名前も記録も変えない"},
        {"status": 422, "code": "E-WS-001", "body": {"error": "validation", "code": "E-WS-001", "details": []}, "errors": ["E-WS-001", "E-WS-002"],
         "trigger": "名前が無い・空・空白だけ（E-WS-001）・前後の空白を削って 101 字以上（E-WS-002）・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 名前が空か 101 字以上なら、Kaname は 422 と欄 name の理由を返し、名前も記録も変えない"},
    ],
}

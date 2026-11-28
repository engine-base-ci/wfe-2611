# K-851 ワークスペースを切り替える・自分に届いた招待を読む（switchWorkspace・listMyInvitations）。契約に無かった新しい口（D-154.81）
#   切る段（c/段11）で、生成の試験 2 つを先に作るためにチケットの「実施事項・契約」の形のとおり置いた（carry: で運ぶ）。
#   PERMS はチケットの「member（本人だけ）」を、契約の言葉の self（本人だけ）で書く（member という権限の言葉は契約に無い）
SCREEN_API = {
    "tickets": [
        ("POST", "/me/workspaces/:id/switch", "A74", "sessions", "switchWorkspace", ["tenant_memberships"]),
        ("GET", "/me/invitations", "A74", "invitations", "listMyInvitations", ["tenants"]),
    ],
}

PERMS = {
    "switchWorkspace": ("self", "本人（同じログインが入っている会社にだけ切り替えられる。本人確認の取り直しは要らない）", False),
    "listMyInvitations": ("self", "本人（確かめ済みのログインのメールに届いた、待っている・期限内の招待だけ）", False),
}

# 体なし（strict・ほかの欄は 422）
INPUTS = {
    "switchWorkspace": ("WorkspaceSwitchInput", {}),
}

RESPONSES = {
    "switchWorkspace": ("WorkspaceSwitched", {"tenant_id": "uuid", "switched": "boolean"}),
    "listMyInvitations": ("MyInvitations", {"invitations": "array", "total": "integer"}),
}

# 絞り込み・頁を受けない（届いた招待は多くても数件）
QUERIES = {
    "listMyInvitations": [],
}

# 行き先が無い・別のログインの会社・止められた・抜けた・招待中・会社を消した は同じ 404（欄と details を付けない）
ERRORS_4XX = {
    "switchWorkspace": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "行き先の会社に同じログインの入っている人がいない（無い・別のログインの会社・止められた・抜けた・招待中・会社を消した）",
         "ears_form": "UNWANTED: IF 同じログインが入っていない会社に切り替えようとしたなら、Kaname は 404 を返し、今の端末の会社を変えない"},
    ],
}

# 口が返す成功の状態コード（契約を口に合わせる・K-144 の SHAPE_010・統合の枝）
SUCCESS_STATUS = {
    "switchWorkspace": 200,   # 作らず状態を変えるだけ・口は 200 を返す
}

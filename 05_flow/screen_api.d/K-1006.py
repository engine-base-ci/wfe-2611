# K-1006 契約の作り直し 4：運営の 1 社のまとまり（全社の一覧の絞り込み・メンバーの本人確認の送り直し・1 社の問い合わせと記録・中を見る・止める・再開）を
#   画面（下絵 op-list・op-ws・op-ws-members・op-ws-inquiries・op-ws-log・op-peek・op-stop・op-stopped）が要る欄に作り直す。
#   振る舞いは後の葉（K-963・K-965〜K-972）で、ここは入力と答えの形だけ（D-156.5）。
#   前からある行（getOpsShell・listOpsWorkspaces・getOpsWorkspace・listOpsWorkspaceMembers の答え・一覧の絞り込みの名前）は本体 05_flow/screen_api.py で直した。
#   1 社の口の :id は会社。答えに会社の中身（チケット・会話・預けたログイン情報の値）を入れない（D-156.3）

# 1 社の答え（getOpsWorkspace と同じ 14 欄・本体の行と同じ形）。止める・再開の答えに使う。members は { count }・inquiries は { open }（2026-11-25）
_WS = {"id": "uuid", "name": "string", "plan_name": "string?", "state": "string", "stop": "object?", "admin": "object", "members": "object", "inquiries": "object", "pc": "object?",
       "runs_month": "object", "stuck_runs": "object", "files": "object", "recent": "array", "peek": "object?"}
# 中を見る許可（開く・閉じるの答え）。閉じていなければ closed_at は null
_PEEK = {"id": "uuid", "workspace_id": "uuid", "reason": "string", "expires_at": "string", "closed_at": "string?"}

# 体は strict（知らない欄は 422）。止める（stopWorkspace）の入力の形・必須・値の幅は K-1000 の断片が持つ（PM の決め 2026-11-26・前へ移した）
INPUTS = {
    "resendOpsVerification": ("OpsVerificationResendInput", {}),
    # 理由が必須・1〜60 分（D-128.68 の 1 時間まで）。頼まれた問い合わせを付けられる
    "openPeek": ("OpsPeekOpenInput", {"reason": "string", "minutes": "integer", "inquiry_id": "uuid"}),
    "resumeWorkspace": ("OpsWorkspaceResumeInput", {"note": "string"}),
}

REQUIRED_INPUTS = {
    "openPeek": ["reason", "minutes"],
}

VALUE_RANGES = {
    "openPeek": {"reason": {"minLength": 1, "maxLength": 200}, "minutes": {"minimum": 1, "maximum": 60}},
    "resumeWorkspace": {"note": {"minLength": 1, "maxLength": 500}},
}

RESPONSES = {
    "resendOpsVerification": ("OpsVerificationResent", {"sent_at": "string"}),
    # topic は usage・trouble・billing・other・state は open・waiting・later・done。担当がいなければ owner_name は null
    "listOpsWorkspaceInquiries": ("OpsWorkspaceInquiry", {"id": "uuid", "title": "string", "topic": "string", "asker_name": "string", "owner_name": "string?",
                                                           "state": "string", "created_at": "string"}),
    # 運営の人の操作の記録（消せない）。action は種類の鍵（peek.open など）・action_label は画面の字
    "listOpsWorkspaceAudit": ("OpsWorkspaceAuditRow", {"id": "uuid", "at": "string", "actor_name": "string", "action": "string", "action_label": "string",
                                                        "target_label": "string?", "reason": "string?"}),
    "openPeek": ("OpsPeek", dict(_PEEK)),
    "closePeek": ("OpsPeek", dict(_PEEK)),
    "stopWorkspace": ("OpsWorkspace", dict(_WS)),
    "resumeWorkspace": ("OpsWorkspace", dict(_WS)),
}

# 並びは QUERIES の sort を自分の enum で受ける（表の列の名前の sort を使わない）。記録は新しい順だけ
# 記録の件数の上限（limit_max 100）はこの断片が持つ（PM の決め 2026-11-25・既定 50 と口の 2 層目は K-1011。K-1011 の断片には書かない）
LIST_DETAILS = {
    "listOpsWorkspaces": {"sort": False, "desc": "取得（tenants）— 全社の一覧（名前・管理者のメールで探す・気にかける／止めている／やめる手続き中・プランで絞る・数と種類だけ。上の数は getOpsShell）"},
    "listOpsWorkspaceAudit": {"limit_max": 100, "sort": False, "desc": "取得（ops_audit_events）— 1 社についての運営の人の操作の記録（新しい順・期間で絞る・既定 50 件・100 件まで）"},
}

QUERY_RANGES = {
    "listOpsWorkspaces": {"q": {"maxLength": 100}, "view": {"enum": ["all", "attention", "stopped", "closing"]},
                          "plan": {"enum": ["free", "team", "business"]}, "sort": {"enum": ["attention", "members", "runs"]}},
}

# 中を見る許可は openPeek だけが作り、理由を必須（1〜200）で入れる。開く・閉じるの口はその行だけを返す（support_access_grants.reason は前からの行のために null 可）
NOT_NULL_ANSWERS = {
    "openPeek.reason": "口が必須の理由（1〜200 字）を入れた行を返し、null にはしない（support_access_grants.reason は前からの行のために null 可）",
    "closePeek.reason": "openPeek が理由を必須で入れた行だけを閉じて返し、null にはしない（support_access_grants.reason は前からの行のために null 可）",
}

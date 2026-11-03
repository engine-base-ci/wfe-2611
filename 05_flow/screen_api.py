"""第1フェーズの画面 → API（D-128.78）。キャンバスの画面 1 枚ずつ「何を読み・何を押すか」から逆に出したもの。
人が読む表は 08_api/phase1/*.md。ここはその機械用の写し（build_functional.py が読み、build_api.py が API にする）。
ここに無い画面は、今までどおり行為の言葉からの推測（build_functional.py の api_for_act）で出る。

1 行 = (method, path, 行為（複数は | で区切る）, 答えの表, operationId, 一緒に読み書きする表)
  path は /api の下。変数は :id（その表の行）・:key・:v など。番号（EG-128）でも引ける所は :id のまま（説明に書く）
"""

T = "tickets"
SCREEN_API = {
    # ---------------------------------------------------------------- チケット（08_api/phase1/01_チケット.md）
    "tickets": [
        # 一覧・数・探す
        ("GET", "/tickets", "A58|A113", T, "listTickets", ["ticket_kinds", "ticket_stages", "members", "clients"]),
        ("GET", "/tickets/counts", "A58", T, "countTickets", []),
        ("GET", "/scopes/:id/overview", "A58", T, "getScopeOverview", ["scopes", "ticket_stages"]),
        ("GET", "/search", "A21", T, "search", ["knowledge_pages", "ticket_decisions", "conversations"]),
        # 1 件を開く・作る・直す・消す
        ("GET", "/tickets/:id", "A101", T, "getTicket", ["ticket_sections", "test_specs", "ticket_links", "clients"]),
        ("POST", "/tickets", "A99|A98|A129", T, "createTicket", ["ticket_sections", "test_specs", "conversations"]),
        ("PATCH", "/tickets/:id", "A103|A17|A115|A113", T, "updateTicket", ["ticket_class_values", "ticket_messages"]),
        ("GET", "/tickets/:id/kind-change-preview", "A103", T, "previewTicketKindChange", ["kind_sections", "ticket_sections"]),
        ("GET", "/tickets/:id/work-type-candidates", "A130", "skills", "listWorkTypeCandidates", ["skill_versions"]),
        ("GET", "/tickets/:id/delete-preview", "A116", T, "previewTicketDelete", ["attachments", "artifacts"]),
        ("DELETE", "/tickets/:id", "A116", T, "deleteTicket", ["audit_events"]),
        ("POST", "/tickets/:id/restore", "A116", T, "restoreTicket", ["audit_events"]),
        ("POST", "/tickets/:id/complete", "A106", T, "completeTicket", ["knowledge_pages", "ticket_decisions"]),
        ("POST", "/tickets/bulk", "A103|A113", T, "bulkUpdateTickets", ["ticket_messages"]),
        ("POST", "/ticket_imports", "A99", "ticket_imports", "createTicketImport", []),
        ("GET", "/ticket_imports/:id", "A99", "ticket_imports", "getTicketImport", []),
        ("POST", "/ticket_imports/:id/commit", "A99", "ticket_imports", "commitTicketImport", [T]),
        # 本文（区画）と版
        ("PATCH", "/tickets/:id/sections/:key", "A101", "ticket_sections", "updateTicketSection", ["ticket_section_versions"]),
        ("GET", "/tickets/:id/versions", "A101", "ticket_section_versions", "listTicketVersions", []),
        ("POST", "/tickets/:id/versions/:v/restore", "A101", "ticket_section_versions", "restoreTicketVersion", ["ticket_sections"]),
        ("POST", "/ticket_kinds/:id/template-from-ticket", "A101", "kind_sections", "makeKindTemplateFromTicket", [T]),
        # テスト仕様と確認
        ("GET", "/tickets/:id/test-specs", "A102", "test_specs", "listTestSpecs", []),
        ("POST", "/tickets/:id/test-specs", "A102", "test_specs", "createTestSpec", []),
        ("PATCH", "/test_specs/:id", "A102", "test_specs", "updateTestSpec", []),
        ("DELETE", "/test_specs/:id", "A102", "test_specs", "deleteTestSpec", []),
        ("POST", "/tickets/:id/test-specs/suggest", "A102", "test_specs", "suggestTestSpecs", ["action_runs"]),
        ("POST", "/tickets/:id/test-specs/lint", "A102", "test_specs", "lintTestSpecs", []),
        ("GET", "/tickets/:id/checks", "A102", "checks", "listChecks", ["test_specs", "artifact_versions"]),
        ("POST", "/checks/:id/human", "A15", "checks", "markHumanCheck", []),
        # 分身に任せる・実行
        ("POST", "/tickets/:id/delegate", "A104", "action_runs", "delegateTicket", ["approvals"]),
        ("POST", "/tickets/:id/dry-run", "A105", "action_runs", "dryRunTicket", []),
        ("GET", "/tickets/:id/runs", "A104", "action_runs", "listTicketRuns", []),
        ("GET", "/action_runs/:id", "A104", "action_runs", "getActionRun", ["reference_logs"]),
        ("POST", "/action_runs/:id/stop", "A89", "action_runs", "stopActionRun", []),
        ("GET", "/tickets/:id/references", "A101", "reference_logs", "listTicketReferences", []),
        # やり取り・決定・渡す
        ("GET", "/tickets/:id/timeline", "A107", "ticket_messages", "listTicketTimeline", ["action_runs"]),
        ("POST", "/tickets/:id/messages", "A107", "ticket_messages", "createTicketMessage", [T, "notifications"]),
        ("PATCH", "/ticket_messages/:id", "A107", "ticket_messages", "updateTicketMessage", []),
        ("DELETE", "/ticket_messages/:id", "A107", "ticket_messages", "deleteTicketMessage", []),
        ("POST", "/ticket_messages/:id/star", "A107", "ticket_messages", "starTicketMessage", []),
        ("GET", "/tickets/:id/decisions", "A108", "ticket_decisions", "listTicketDecisions", []),
        ("POST", "/tickets/:id/decisions", "A108", "ticket_decisions", "createTicketDecision", []),
        ("PATCH", "/ticket_decisions/:id", "A108", "ticket_decisions", "updateTicketDecision", ["policies"]),
        ("POST", "/tickets/:id/handovers", "A51|A48|A111|A112", "ticket_handovers", "createTicketHandover", ["notifications"]),
        ("PATCH", "/ticket_handovers/:id", "A110", "ticket_handovers", "answerTicketHandover", [T]),
        # つながり・成果物・検収
        ("GET", "/tickets/:id/links", "A103", "ticket_links", "listTicketLinks", []),
        ("POST", "/tickets/:id/links", "A103", "ticket_links", "createTicketLink", []),
        ("DELETE", "/ticket_links/:id", "A103", "ticket_links", "deleteTicketLink", []),
        ("GET", "/tickets/:id/artifacts", "A101", "artifacts", "listTicketArtifacts", ["artifact_versions"]),
        ("GET", "/artifact_versions/:id", "A101", "artifact_versions", "getArtifactVersion", []),
        ("POST", "/tickets/:id/attachments", "A101", "attachments", "createTicketAttachment", []),
        ("POST", "/tickets/:id/acceptances", "A123", "acceptances", "requestAcceptance", ["client_contacts", "notifications"]),
        # 一覧の設定・知らせ・選ぶもの
        ("GET", "/saved_views", "A58", "saved_views", "listSavedViews", []),
        ("POST", "/saved_views", "A58", "saved_views", "createSavedView", []),
        ("PATCH", "/saved_views/:id", "A58", "saved_views", "updateSavedView", []),
        ("DELETE", "/saved_views/:id", "A58", "saved_views", "deleteSavedView", []),
        ("GET", "/notifications", "A109", "notifications", "listNotifications", []),
        ("PATCH", "/notifications/:id", "A109", "notifications", "readNotification", []),
        ("POST", "/notifications/read-all", "A109", "notifications", "readAllNotifications", []),
        ("GET", "/ticket_kinds", "A103", "ticket_kinds", "listTicketKinds", ["kind_sections"]),
        ("GET", "/ticket_stages", "A103", "ticket_stages", "listTicketStages", []),
        ("GET", "/class_axes", "A103", "class_axes", "listClassAxes", ["class_values"]),
        ("GET", "/members", "A103", "members", "listMembers", []),
        ("GET", "/clients", "A103", "clients", "listClients", []),
    ],
}


# 表の行ではない答えの形（operationId → 名前と項目）。項目の型は string／integer／boolean／object／array
RESPONSES = {
    "countTickets": ("TicketCounts", {"overdue": "integer", "due_today": "integer", "awaiting_my_approval": "integer", "ai_running": "integer", "assigned_to_me": "integer", "delegated_to_me": "integer", "handed_to_me": "integer"}),
    "getScopeOverview": ("ScopeOverview", {"by_stage": "array", "milestones": "array", "recent": "array", "total": "integer"}),
    "previewTicketKindChange": ("TicketKindChangePreview", {"added_sections": "array", "removed_sections": "array", "moved_to_body": "array", "checks_reset": "boolean"}),
    "previewTicketDelete": ("TicketDeletePreview", {"children": "integer", "attachments": "integer", "artifacts": "integer", "restorable_until": "string"}),
    "search": ("SearchHit", {"kind": "string", "id": "string", "title": "string", "snippet": "string", "url": "string"}),
    "listTicketTimeline": ("TimelineItem", {"kind": "string", "at": "string", "actor_member_id": "string", "message": "object", "changes": "array", "run": "object"}),
    "lintTestSpecs": ("TestSpecLint", {"missing": "array", "warnings": "array"}),
    "completeTicket": ("TicketCompletion", {"ticket": "object", "knowledge_candidates": "array", "skipped_reason": "string"}),
    "bulkUpdateTickets": ("BulkResult", {"updated": "array", "skipped": "array"}),
}
# 一覧の絞り込み（operationId → query の名前）。cursor・limit・sort はいつも付く
QUERIES = {
    "listTickets": ["view", "scope_id", "q", "kind_id", "stage_id", "assignee_id", "client_id", "due_from", "due_to", "start_from", "start_to", "overdue", "fire", "parent", "fields"],
    "countTickets": ["view", "scope_id"],
    "search": ["q", "kinds"],
    "listNotifications": ["unread", "actor_member_id"],
    "listMembers": ["scope_id", "q"],
    "listClients": ["q"],
    "listSavedViews": ["share"],
}

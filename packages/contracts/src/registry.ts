// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml＋endpoints.json）。手で直さない。openapi:406576c86e166c6e
export type EndpointKind = "list" | "get" | "create" | "update" | "delete";
export interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
  table: string;
  kind: EndpointKind;
  /** true：表の素の読み書き（共通の処理で動く）。false：hooks に振る舞いを書くまで 501 */
  generic: boolean;
  input: string | null;
  success: number;
  /** 成功の答えの data の形（components の名前）。outputList なら配列 */
  output: string | null;
  outputList: boolean;
  auth: "member" | "ops" | "client" | "device" | "public";
  rateLimit: { perMinute: number; key: "user" | "ip" };
  /** 契約で format: uuid の道の値と問い合わせの名前（入口が正式な uuid か確かめる・D-129.42・K-144） */
  uuidParams: string[];
  chokePoints: string[];
  errors: number[];
  acts: string[];
  screens: string[];
  /** 誰が呼べるか（08_api の permission・K-14）。入口が言葉ごとに確かめる（apps/api/src/contract/permissions.ts） */
  perm: {
    word: string;
    target: string | null;
    ability: string | null;
    scope: "workspace" | "any" | "ops_all" | "ops_tenant";
    adminOnly: boolean;
    cap: string | null;
    stepUp: string | null;
    /** 行に結ぶ言葉の確かめ（K-15・scripts/ci/row_rules.mjs）。:id の行を RLS の中で読み、見えなければ 404・sql が偽なら 403 */
    row: { table: string; sql: string } | null;
  };
  /** 同意し直し（K-53）の間も止めない口（規約の 2 つ・ログアウト・自分の取得）。正本は 05_flow/screen_api.py の TERMS_OPEN_OPS */
  termsOpen: boolean;
  /** 付けるまで進めない（K-321・D-128.141）の間も止めない口。正本は 05_flow/screen_api.py の MFA_OPEN_OPS */
  mfaOpen: boolean;
  /** 一覧の scope_id（グループで絞る）を形だけ確かめて無視する口。正本は 05_flow/screen_api.py の LIST_OPS */
  ignoresScope: boolean;
}
export const ENDPOINTS: readonly EndpointDef[] = [
  {
    "method": "GET",
    "path": "/api/v1/action_runs/:id",
    "operationId": "getActionRun",
    "table": "action_runs",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ActionRunView",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "action_runs",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/action_runs/:id/stop",
    "operationId": "stopActionRun",
    "table": "action_runs",
    "kind": "create",
    "input": "ActionRunStopInput",
    "success": 201,
    "output": "ActionRunStopped",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A89"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "action_runs",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/action_runs/:id/takeover",
    "operationId": "takeoverActionRun",
    "table": "action_runs",
    "kind": "create",
    "input": "ActionRunTakeoverInput",
    "success": 201,
    "output": "ActionRunView",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A57"
    ],
    "screens": [
      "ai-activity"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "action_runs",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/approvals/:id",
    "operationId": "getApproval",
    "table": "approvals",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ApprovalDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "(approver_member_id = app.user_id() or requested_by = app.user_id() or app.ticket_assignee_is_me(ticket_id) or app.manages_scope(scope_id) or exists (select 1 from tickets t where t.id = ticket_id and (t.assignee_member_id = app.user_id() or t.created_by = app.user_id() or app.manages_scope(t.scope_id))))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/:id/approve",
    "operationId": "approveApproval",
    "table": "approvals",
    "kind": "create",
    "input": "ApprovalApproveInput",
    "success": 201,
    "output": "ApprovalDecided",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "app.ticket_assignee_is_me(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/:id/edit",
    "operationId": "editApproval",
    "table": "approvals",
    "kind": "create",
    "input": "ApprovalEditInput",
    "success": 201,
    "output": "ApprovalEdited",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "app.ticket_assignee_is_me(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/:id/return",
    "operationId": "returnApproval",
    "table": "approvals",
    "kind": "create",
    "input": "ApprovalReturnInput",
    "success": 201,
    "output": "ApprovalDecided",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "app.ticket_assignee_is_me(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/:id/stop",
    "operationId": "stopApproval",
    "table": "approvals",
    "kind": "create",
    "input": "ApprovalStopInput",
    "success": 201,
    "output": "ApprovalStopped",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A15",
      "A89"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "app.ticket_assignee_is_me(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/:id/withdraw",
    "operationId": "withdrawApproval",
    "table": "approvals",
    "kind": "create",
    "input": "ApprovalWithdrawInput",
    "success": 201,
    "output": "ApprovalWithdrawn",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A89"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "approvals",
        "sql": "approver_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/bulk",
    "operationId": "bulkApprove",
    "table": "approvals",
    "kind": "create",
    "input": "BulkApproveInput",
    "success": 201,
    "output": "BulkResult",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/approvals/bulk/preview",
    "operationId": "previewBulkApproval",
    "table": "approvals",
    "kind": "create",
    "input": "BulkApprovalPreviewInput",
    "success": 201,
    "output": "BulkApprovalPreview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "approver",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/approvals/history",
    "operationId": "listApprovalHistory",
    "table": "approvals",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ApprovalHistoryItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/approvals/queue",
    "operationId": "listApprovalQueue",
    "table": "approvals",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ApprovalQueueItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A15"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/artifact_versions/:id",
    "operationId": "getArtifactVersion",
    "table": "artifact_versions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ArtifactVersions",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "artifact_versions",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/artifact_versions/:id/restore",
    "operationId": "restoreArtifactVersion",
    "table": "artifact_versions",
    "kind": "create",
    "input": "ArtifactVersionsInput",
    "success": 201,
    "output": "ArtifactVersions",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A95"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "artifact_versions",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/artifacts/:id",
    "operationId": "updateArtifact",
    "table": "artifacts",
    "kind": "update",
    "input": "ArtifactsInput",
    "success": 200,
    "output": "Artifacts",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A95"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "artifacts",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/audit_events",
    "operationId": "listAuditEvents",
    "table": "audit_events",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "AuditEvents",
    "outputList": true,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "member_id",
      "ticket_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      422,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A33"
    ],
    "screens": [
      "audit"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/invitations/:token",
    "operationId": "getInvitation",
    "table": "invitations",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "InvitationPreview",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      422,
      404,
      503,
      429,
      503
    ],
    "acts": [
      "A03"
    ],
    "screens": [
      "invite-accept"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/invitations/:token/accept",
    "operationId": "acceptInvitation",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationAcceptInput",
    "success": 202,
    "output": "InvitationAccepted",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      422,
      403,
      403,
      404,
      409,
      409,
      410,
      422,
      409,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A03",
      "A96"
    ],
    "screens": [
      "invite-accept"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/invitations/:token/resend-request",
    "operationId": "requestInvitationResend",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationResendInput",
    "success": 201,
    "output": "InvitationResendResult",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      409,
      422,
      404,
      410,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A03"
    ],
    "screens": [
      "invite-accept"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/invitations/confirm",
    "operationId": "confirmInvitationJoin",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationJoinConfirmInput",
    "success": 201,
    "output": "InvitationJoinConfirmed",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      422,
      403,
      404,
      409,
      410,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A03",
      "A96"
    ],
    "screens": [
      "invite-accept"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/ops-setup",
    "operationId": "startOpsSetup",
    "table": "sessions",
    "kind": "create",
    "input": "OpsSetupInput",
    "success": 201,
    "output": "OpsSetupSession",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      422,
      409,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A134"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/password/forgot",
    "operationId": "requestPasswordReset",
    "table": "security_events",
    "kind": "create",
    "input": "PasswordForgotInput",
    "success": 201,
    "output": "PasswordForgotAccepted",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      422,
      413,
      429,
      503
    ],
    "acts": [
      "A31"
    ],
    "screens": [
      "password-reset"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/password/reset",
    "operationId": "resetPassword",
    "table": "sessions",
    "kind": "create",
    "input": "PasswordResetInput",
    "success": 201,
    "output": "PasswordResetDone",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      422,
      410,
      409,
      500,
      413,
      429,
      503
    ],
    "acts": [
      "A31"
    ],
    "screens": [
      "password-reset"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/recovery/admin-request",
    "operationId": "requestAdminRecovery",
    "table": "security_events",
    "kind": "create",
    "input": "AdminRecoveryInput",
    "success": 201,
    "output": "AdminRecoveryResult",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      409,
      422,
      401,
      500,
      413,
      429,
      503
    ],
    "acts": [
      "A13"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/service-status",
    "operationId": "getServiceStatus",
    "table": "status_incidents",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PublicServiceStatus",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      422,
      500,
      429,
      503
    ],
    "acts": [
      "A13",
      "A135"
    ],
    "screens": [
      "help",
      "login"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/sign-in",
    "operationId": "signInWithPassword",
    "table": "sessions",
    "kind": "create",
    "input": "SignInInput",
    "success": 201,
    "output": "SignInResult",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      409,
      422,
      401,
      403,
      403,
      422,
      422,
      429,
      500,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A13"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/sign-out",
    "operationId": "signOut",
    "table": "sessions",
    "kind": "create",
    "input": "SignOutInput",
    "success": 201,
    "output": "SignedOut",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      503
    ],
    "acts": [
      "A13"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": true,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/sign-up",
    "operationId": "createSignup",
    "table": "pending_signup",
    "kind": "create",
    "input": "SignupInput",
    "success": 201,
    "output": "SignupCreated",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      409,
      422,
      500,
      413,
      429,
      503
    ],
    "acts": [
      "A01",
      "A96"
    ],
    "screens": [
      "signup"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/sign-up/resend",
    "operationId": "resendSignupEmail",
    "table": "pending_signup",
    "kind": "create",
    "input": "SignupResendInput",
    "success": 201,
    "output": "SignupResent",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      409,
      422,
      413,
      429,
      503
    ],
    "acts": [
      "A01"
    ],
    "screens": [
      "signup"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/sign-up/status",
    "operationId": "getSignupStatus",
    "table": "pending_signup",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "SignupStatus",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      422,
      429,
      503
    ],
    "acts": [
      "A01"
    ],
    "screens": [
      "signup"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/sign-up/verify",
    "operationId": "verifySignup",
    "table": "pending_signup",
    "kind": "create",
    "input": "SignupVerifyInput",
    "success": 201,
    "output": "SignupVerified",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      409,
      422,
      410,
      500,
      413,
      429,
      503
    ],
    "acts": [
      "A02"
    ],
    "screens": [
      "verify-email"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/step-up",
    "operationId": "stepUp",
    "table": "sessions",
    "kind": "create",
    "input": "StepUpInput",
    "success": 201,
    "output": "StepUp",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      503
    ],
    "acts": [
      "A13"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/terms/consent",
    "operationId": "consentToTerms",
    "table": "terms_consents",
    "kind": "create",
    "input": "TermsConsentInput",
    "success": 201,
    "output": "TermsConsented",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      500,
      413,
      429,
      503
    ],
    "acts": [
      "A96"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": true,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/terms/current",
    "operationId": "getCurrentTerms",
    "table": "terms_versions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "CurrentTerms",
    "outputList": true,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      422,
      500,
      429,
      503
    ],
    "acts": [
      "A96"
    ],
    "screens": [
      "signup"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": true,
    "mfaOpen": true,
    "ignoresScope": true
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/two-factor/verify",
    "operationId": "verifySignInCode",
    "table": "sessions",
    "kind": "create",
    "input": "SignInCodeInput",
    "success": 201,
    "output": "SignInCodeResult",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 10,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      409,
      422,
      401,
      401,
      403,
      422,
      429,
      500,
      403,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A13"
    ],
    "screens": [
      "login"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/browser",
    "operationId": "setBridgeBrowser",
    "table": "sessions",
    "kind": "create",
    "input": "BridgeBrowserInput",
    "success": 201,
    "output": "BridgeBrowser",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/claim",
    "operationId": "claimPairingCode",
    "table": "sessions",
    "kind": "create",
    "input": "BridgeClaimInput",
    "success": 201,
    "output": "BridgeClaim",
    "outputList": false,
    "generic": false,
    "auth": "public",
    "rateLimit": {
      "perMinute": 5,
      "key": "ip"
    },
    "uuidParams": [],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      409,
      422,
      404,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "public",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/credentials/:id/check-result",
    "operationId": "reportCredentialCheck",
    "table": "credentials",
    "kind": "create",
    "input": "CredentialCheckReportInput",
    "success": 201,
    "output": "CredentialCheckReport",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/credentials/resolve",
    "operationId": "resolveCredential",
    "table": "credentials",
    "kind": "create",
    "input": "CredentialResolveInput",
    "success": 201,
    "output": "ResolvedCredential",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      403,
      403,
      404,
      502,
      503,
      503,
      413,
      429,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/devices",
    "operationId": "listMyDevices",
    "table": "sessions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "BridgeDevice",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/bridge/devices/:id",
    "operationId": "updateMyDevice",
    "table": "sessions",
    "kind": "update",
    "input": "DeviceBrowserInput",
    "success": 200,
    "output": "DeviceBrowser",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/bridge/devices/:id",
    "operationId": "revokeMyDevice",
    "table": "sessions",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "RevokedDevice",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/devices/:id/browser-check",
    "operationId": "checkMyDeviceBrowser",
    "table": "bridge_jobs",
    "kind": "create",
    "input": "DeviceBrowserCheckInput",
    "success": 201,
    "output": "DeviceBrowserCheck",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 10,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/files/:ref",
    "operationId": "getFileForBridge",
    "table": "attachments",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "BridgeJobFile",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "job_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      502,
      503,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/heartbeat",
    "operationId": "sendHeartbeat",
    "table": "sessions",
    "kind": "create",
    "input": "BridgeHeartbeatInput",
    "success": 201,
    "output": "BridgeHeartbeat",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/artifacts",
    "operationId": "putArtifactFromBridge",
    "table": "artifacts",
    "kind": "create",
    "input": "ArtifactsInput",
    "success": 201,
    "output": "Artifacts",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      503
    ],
    "acts": [
      "A95"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/browser",
    "operationId": "reportBrowserState",
    "table": "bridge_job_events",
    "kind": "create",
    "input": "BridgeBrowserStateInput",
    "success": 201,
    "output": "BridgeBrowserReported",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/client-request-draft",
    "operationId": "reportClientRequestDraft",
    "table": "bridge_jobs",
    "kind": "create",
    "input": "ClientRequestDraftResultInput",
    "success": 200,
    "output": "ClientRequestDraftResult",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/jobs/:id/control",
    "operationId": "getJobControl",
    "table": "bridge_jobs",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "JobControl",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/conversation-entries",
    "operationId": "mirrorConversationEntries",
    "table": "messages",
    "kind": "create",
    "input": "ConversationEntriesInput",
    "success": 201,
    "output": "ConversationEntriesMirrored",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/finish",
    "operationId": "finishBridgeJob",
    "table": "bridge_jobs",
    "kind": "create",
    "input": "BridgeFinishInput",
    "success": 201,
    "output": "BridgeFinish",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/progress",
    "operationId": "reportJobProgress",
    "table": "bridge_job_events",
    "kind": "create",
    "input": "BridgeProgressInput",
    "success": 201,
    "output": "BridgeJobEvents",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/questions",
    "operationId": "askFromBridge",
    "table": "messages",
    "kind": "create",
    "input": "MessagesInput",
    "success": 201,
    "output": "Messages",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A91"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/jobs/:id/questions/:qid",
    "operationId": "getBridgeQuestionAnswer",
    "table": "messages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "Messages",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "qid"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      503
    ],
    "acts": [
      "A91"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/:id/tools/:name",
    "operationId": "callKanameTool",
    "table": "action_runs",
    "kind": "create",
    "input": "BridgeToolInput",
    "success": 201,
    "output": "BridgeToolResult",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/jobs/take",
    "operationId": "takeBridgeJob",
    "table": "bridge_jobs",
    "kind": "create",
    "input": "BridgeTakeInput",
    "success": 201,
    "output": "BridgeJob",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      502,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/mirror-targets",
    "operationId": "listMirrorTargets",
    "table": "conversations",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MirrorTarget",
    "outputList": true,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      502,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/pairing-codes",
    "operationId": "createPairingCode",
    "table": "bridge_pairing_codes",
    "kind": "create",
    "input": "PairingCodeInput",
    "success": 201,
    "output": "PairingCode",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C1",
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/releases/:name/file",
    "operationId": "downloadBridgeRelease",
    "table": "sessions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "BridgeReleaseLink",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      404,
      404,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self_or_device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/bridge/releases/latest",
    "operationId": "getLatestBridgeRelease",
    "table": "sessions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "BridgeRelease",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A09"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "self_or_device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/bridge/usage",
    "operationId": "reportUsage",
    "table": "agent_usage_snapshots",
    "kind": "create",
    "input": "AgentUsageSnapshotsInput",
    "success": 201,
    "output": "AgentUsageSnapshots",
    "outputList": false,
    "generic": false,
    "auth": "device",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      503
    ],
    "acts": [
      "A94"
    ],
    "screens": [
      "bridge-setup"
    ],
    "perm": {
      "word": "device",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/client_requests",
    "operationId": "listClientRequests",
    "table": "client_requests",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ClientRequestList",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/client_requests/:id",
    "operationId": "getClientRequest",
    "table": "client_requests",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ClientRequestDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/client_requests/:id",
    "operationId": "updateClientRequest",
    "table": "client_requests",
    "kind": "update",
    "input": "ClientRequestRouteInput",
    "success": 200,
    "output": "ClientRequestRouted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      404,
      409,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/client_requests/:id/accept",
    "operationId": "acceptClientRequest",
    "table": "client_requests",
    "kind": "create",
    "input": "ClientRequestAcceptInput",
    "success": 201,
    "output": "ClientRequestAccepted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/client_requests/:id/decline",
    "operationId": "declineClientRequest",
    "table": "client_requests",
    "kind": "create",
    "input": "ClientRequestDeclineInput",
    "success": 200,
    "output": "ClientRequestDeclined",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/client_requests/:id/draft",
    "operationId": "requestClientRequestDraft",
    "table": "client_requests",
    "kind": "create",
    "input": "ClientRequestDraftInput",
    "success": 201,
    "output": "ClientRequestDraftQueued",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/client_requests/:id/reply",
    "operationId": "replyToClientRequest",
    "table": "client_requests",
    "kind": "create",
    "input": "ClientRequestReplyInput",
    "success": 201,
    "output": "ClientRequestReplied",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A122"
    ],
    "screens": [
      "requests"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/clones/me",
    "operationId": "getMyClone",
    "table": "clones",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MyClone",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/clones/me",
    "operationId": "updateMyClone",
    "table": "clones",
    "kind": "update",
    "input": "ClonesInput",
    "success": 200,
    "output": "Clones",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A91"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/clones/me/activity",
    "operationId": "listCloneActivity",
    "table": "action_runs",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "CloneActivity",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A53"
    ],
    "screens": [
      "ai-activity"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/clones/me/growth",
    "operationId": "getCloneGrowth",
    "table": "action_runs",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "CloneGrowth",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A53"
    ],
    "screens": [
      "ai-activity"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/clones/me/now",
    "operationId": "getCloneNow",
    "table": "action_runs",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "CloneNow",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A53"
    ],
    "screens": [
      "ai-activity"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/conversations",
    "operationId": "listConversations",
    "table": "conversations",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ConversationRow",
    "outputList": true,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A88"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/conversations",
    "operationId": "createConversation",
    "table": "conversations",
    "kind": "create",
    "input": "ConversationsInput",
    "success": 201,
    "output": "ConversationCreated",
    "outputList": false,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A100",
      "A88"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/conversations/:id",
    "operationId": "getConversation",
    "table": "conversations",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ConversationView",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A88"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/conversations/:id",
    "operationId": "updateConversation",
    "table": "conversations",
    "kind": "update",
    "input": "UpdateConversationInput",
    "success": 200,
    "output": "ConversationUpdated",
    "outputList": false,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A88"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/conversations/:id",
    "operationId": "deleteConversation",
    "table": "conversations",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "Conversations",
    "outputList": false,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A88"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/conversations/:id/attachments",
    "operationId": "createConversationAttachment",
    "table": "attachments",
    "kind": "create",
    "input": "AttachmentsInput",
    "success": 201,
    "output": "Attachments",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A90"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/conversations/:id/messages",
    "operationId": "listConversationMessages",
    "table": "messages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "MessageView",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/conversations/:id/messages",
    "operationId": "sendConversationMessage",
    "table": "messages",
    "kind": "create",
    "input": "ConversationSay",
    "success": 201,
    "output": "ConversationSaid",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A100",
      "A20"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/conversations/:id/permissions/:pid",
    "operationId": "answerAgentPermission",
    "table": "messages",
    "kind": "create",
    "input": "MessagesInput",
    "success": 201,
    "output": "Messages",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "pid"
    ],
    "chokePoints": [
      "C2",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A91"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/conversations/:id/stop",
    "operationId": "stopConversation",
    "table": "messages",
    "kind": "create",
    "input": "ConversationStopInput",
    "success": 201,
    "output": "ConversationStopped",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/conversations/:id/stream",
    "operationId": "streamConversation",
    "table": "messages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "Messages",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/credentials",
    "operationId": "listCredentials",
    "table": "credentials",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Credential",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C8"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/credentials",
    "operationId": "createCredential",
    "table": "credentials",
    "kind": "create",
    "input": "CredentialCreateInput",
    "success": 201,
    "output": "Credential",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      403,
      409,
      502,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/credentials/:id",
    "operationId": "updateCredential",
    "table": "credentials",
    "kind": "update",
    "input": "CredentialUpdateInput",
    "success": 200,
    "output": "Credential",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      403,
      409,
      409,
      409,
      502,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": {
        "table": "credentials",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/credentials/:id",
    "operationId": "deleteCredential",
    "table": "credentials",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "CredentialDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "credentials",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/credentials/:id/login-check",
    "operationId": "checkCredentialLogin",
    "table": "credentials",
    "kind": "create",
    "input": "CredentialLoginCheckInput",
    "success": 201,
    "output": "CredentialLoginCheck",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "credentials",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/credentials/:id/login-check/answer",
    "operationId": "answerCredentialLoginCheck",
    "table": "credentials",
    "kind": "create",
    "input": "CredentialLoginAnswerInput",
    "success": 201,
    "output": "CredentialLoginAnswer",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A10"
    ],
    "screens": [
      "credentials"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "credentials",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/guest-groups",
    "operationId": "listGuestGroups",
    "table": "members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "GuestGroups",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/guest-groups",
    "operationId": "createGuestGroup",
    "table": "members",
    "kind": "create",
    "input": "GuestGroupInput",
    "success": 201,
    "output": "GuestGroupCreated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/guest-groups/:id",
    "operationId": "updateGuestGroup",
    "table": "members",
    "kind": "update",
    "input": "GuestGroupRenameInput",
    "success": 200,
    "output": "GuestGroupRenamed",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/guest-groups/:id",
    "operationId": "deleteGuestGroup",
    "table": "members",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "GuestGroupDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/handover_rules",
    "operationId": "listHandoverRules",
    "table": "handover_rules",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "HandoverRule",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A110"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inquiries",
    "operationId": "listMyInquiries",
    "table": "inquiries",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MyInquiry",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inquiries",
    "operationId": "createInquiry",
    "table": "inquiries",
    "kind": "create",
    "input": "InquiryCreateInput",
    "success": 201,
    "output": "MyInquiry",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inquiries/:id",
    "operationId": "getMyInquiry",
    "table": "inquiries",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "MyInquiryDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "inquiries",
        "sql": "opened_by_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inquiries/:id/messages",
    "operationId": "postInquiryMessage",
    "table": "messages",
    "kind": "create",
    "input": "InquiryMessageInput",
    "success": 201,
    "output": "MyInquiryMessage",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "inquiries",
        "sql": "opened_by_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inquiries/:id/resolve",
    "operationId": "resolveMyInquiry",
    "table": "inquiries",
    "kind": "create",
    "input": "InquiryResolveInput",
    "success": 200,
    "output": "MyInquiry",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "inquiries",
        "sql": "opened_by_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inquiries/attachments",
    "operationId": "uploadInquiryAttachment",
    "table": "attachments",
    "kind": "create",
    "input": "InquiryAttachmentInput",
    "success": 201,
    "output": "InquiryAttachmentUpload",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A67"
    ],
    "screens": [
      "inquiry"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/invitations",
    "operationId": "createInvitations",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationsCreateInput",
    "success": 201,
    "output": "InvitationsSent",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "invite",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "admin_role",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/invitations/:id",
    "operationId": "revokeInvitation",
    "table": "invitations",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "InvitationRevoked",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "invite",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/invitations/:id/resend",
    "operationId": "resendInvitation",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationResendInput",
    "success": 201,
    "output": "InvitationResent",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "invite",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/invitations/link",
    "operationId": "createInvitationLink",
    "table": "invitations",
    "kind": "create",
    "input": "InvitationLinkCreateInput",
    "success": 201,
    "output": "InvitationLink",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      422,
      404,
      503,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "invite",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "admin_role",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/invoices/:id/pdf",
    "operationId": "downloadInvoicePdf",
    "table": "invoices",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "SignedUrl",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A69"
    ],
    "screens": [
      "billing"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "billing",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge/approvals",
    "operationId": "listKnowledgeApprovals",
    "table": "knowledge_requests",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "KnowledgeApproval",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge/folders",
    "operationId": "createKnowledgeFolder",
    "table": "knowledge_folders",
    "kind": "create",
    "input": "KnowledgeFolderCreateInput",
    "success": 201,
    "output": "KnowledgeFolder",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/knowledge/folders/:id",
    "operationId": "updateKnowledgeFolder",
    "table": "knowledge_folders",
    "kind": "update",
    "input": "KnowledgeFolderUpdateInput",
    "success": 200,
    "output": "KnowledgeFolder",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/knowledge/folders/:id",
    "operationId": "deleteKnowledgeFolder",
    "table": "knowledge_folders",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "KnowledgeFolderDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/knowledge/requests/:id",
    "operationId": "withdrawKnowledgeRequest",
    "table": "knowledge_requests",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "KnowledgeRequestEnded",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge/requests/:id/approve",
    "operationId": "approveKnowledgeRequest",
    "table": "knowledge_requests",
    "kind": "create",
    "input": "KnowledgeApproveInput",
    "success": 200,
    "output": "KnowledgeRequestDecided",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge/requests/:id/decline",
    "operationId": "declineKnowledgeRequest",
    "table": "knowledge_requests",
    "kind": "create",
    "input": "KnowledgeDeclineInput",
    "success": 200,
    "output": "KnowledgeRequestDecided",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge/requests/:id/dismiss",
    "operationId": "dismissKnowledgeRequest",
    "table": "knowledge_requests",
    "kind": "create",
    "input": "KnowledgeDismissInput",
    "success": 200,
    "output": "KnowledgeRequestEnded",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge/review",
    "operationId": "getKnowledgeReview",
    "table": "knowledge_pages",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "KnowledgeReview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A93"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge/shares",
    "operationId": "getKnowledgeShares",
    "table": "knowledge_shares",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "KnowledgeShareChoice",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "page_id",
      "folder_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/knowledge/shares",
    "operationId": "setKnowledgeShares",
    "table": "knowledge_shares",
    "kind": "update",
    "input": "KnowledgeShareSetInput",
    "success": 200,
    "output": "KnowledgeShareChoice",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      422,
      404,
      409,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge/similar",
    "operationId": "findSimilarKnowledge",
    "table": "knowledge_pages",
    "kind": "create",
    "input": "KnowledgeSimilarInput",
    "success": 200,
    "output": "KnowledgeSimilar",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge/tree",
    "operationId": "getKnowledgeTree",
    "table": "knowledge_pages",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "KnowledgeTree",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge_pages",
    "operationId": "createKnowledgePage",
    "table": "knowledge_pages",
    "kind": "create",
    "input": "KnowledgePageCreateInput",
    "success": 201,
    "output": "KnowledgePageStub",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge_pages/:id",
    "operationId": "getKnowledgePage",
    "table": "knowledge_pages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "KnowledgePageDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/knowledge_pages/:id",
    "operationId": "updateKnowledgePage",
    "table": "knowledge_pages",
    "kind": "update",
    "input": "KnowledgePageMoveInput",
    "success": 200,
    "output": "KnowledgePageStub",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/knowledge_pages/:id",
    "operationId": "deleteKnowledgePage",
    "table": "knowledge_pages",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "KnowledgePageDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge_pages/:id/copy",
    "operationId": "copyKnowledgePage",
    "table": "knowledge_pages",
    "kind": "create",
    "input": "KnowledgeCopyInput",
    "success": 201,
    "output": "KnowledgePageStub",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/knowledge_pages/:id/draft",
    "operationId": "saveKnowledgeDraft",
    "table": "knowledge_page_versions",
    "kind": "update",
    "input": "KnowledgeDraftInput",
    "success": 200,
    "output": "KnowledgeDraftSaved",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/knowledge_pages/:id/draft",
    "operationId": "discardKnowledgeDraft",
    "table": "knowledge_page_versions",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "KnowledgeDraftDiscarded",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/knowledge_pages/:id/must",
    "operationId": "setKnowledgeMust",
    "table": "knowledge_pages",
    "kind": "update",
    "input": "KnowledgeMustInput",
    "success": 200,
    "output": "KnowledgeMustSet",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge_pages/:id/publish",
    "operationId": "publishKnowledgePage",
    "table": "knowledge_page_versions",
    "kind": "create",
    "input": "KnowledgePublishInput",
    "success": 200,
    "output": "KnowledgePublished",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/knowledge_pages/:id/raise",
    "operationId": "requestKnowledgeRaise",
    "table": "knowledge_requests",
    "kind": "create",
    "input": "KnowledgeRaiseInput",
    "success": 201,
    "output": "KnowledgeRequest",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A136"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "(deleted_at is not null or app.kpage_writable(id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge_pages/:id/versions",
    "operationId": "listKnowledgeVersions",
    "table": "knowledge_page_versions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "KnowledgeVersionItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/knowledge_pages/:id/versions/:v",
    "operationId": "getKnowledgePageVersion",
    "table": "knowledge_page_versions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "KnowledgeVersion",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A114"
    ],
    "screens": [
      "knowledge"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "knowledge_pages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/layers",
    "operationId": "listLayers",
    "table": "layers",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Layer",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/layers",
    "operationId": "createLayer",
    "table": "layers",
    "kind": "create",
    "input": "LayerCreateInput",
    "success": 201,
    "output": "LayerCreated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "admin",
      "target": "layers",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/layers/:id",
    "operationId": "updateLayer",
    "table": "layers",
    "kind": "update",
    "input": "LayerUpdateInput",
    "success": 200,
    "output": "LayerUpdated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "admin",
      "target": "layers",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me",
    "operationId": "getMe",
    "table": "members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Me",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account",
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": true,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/me",
    "operationId": "updateMe",
    "table": "members",
    "kind": "update",
    "input": "MeUpdateInput",
    "success": 200,
    "output": "MeUpdated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/avatar",
    "operationId": "uploadAvatar",
    "table": "members",
    "kind": "create",
    "input": "AvatarUploadInput",
    "success": 201,
    "output": "Avatar",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      422,
      502,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/backup-codes",
    "operationId": "regenerateBackupCodes",
    "table": "security_events",
    "kind": "create",
    "input": "SecurityEventsInput",
    "success": 201,
    "output": "BackupCodes",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A04"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/email-change",
    "operationId": "requestEmailChange",
    "table": "security_events",
    "kind": "create",
    "input": "EmailChangeInput",
    "success": 201,
    "output": "EmailChangeRequested",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      429,
      502,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/email-change/verify",
    "operationId": "verifyEmailChange",
    "table": "security_events",
    "kind": "create",
    "input": "EmailChangeVerifyInput",
    "success": 201,
    "output": "EmailChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/invitations",
    "operationId": "listMyInvitations",
    "table": "invitations",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MyInvitations",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/notification-settings",
    "operationId": "getNotificationSettings",
    "table": "notification_settings",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "NotificationSettings",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "workspace_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/me/notification-settings",
    "operationId": "updateNotificationSettings",
    "table": "notification_settings",
    "kind": "update",
    "input": "NotificationSettingsUpdateInput",
    "success": 200,
    "output": "NotificationSettings",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      404,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/notification-settings/copy",
    "operationId": "copyNotificationSettings",
    "table": "notification_settings",
    "kind": "create",
    "input": "NotificationSettingsCopyInput",
    "success": 201,
    "output": "NotificationSettingsCopied",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/me/passkeys/:id",
    "operationId": "renamePasskey",
    "table": "passkeys",
    "kind": "update",
    "input": "PasskeyRenameInput",
    "success": 200,
    "output": "Passkeys",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A97"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/me/passkeys/:id",
    "operationId": "deletePasskey",
    "table": "passkeys",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "Passkeys",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A97"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/password",
    "operationId": "setMyPassword",
    "table": "security_events",
    "kind": "create",
    "input": "PasswordSetInput",
    "success": 201,
    "output": "PasswordSet",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A97"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/me/password",
    "operationId": "changePassword",
    "table": "security_events",
    "kind": "update",
    "input": "PasswordChangeInput",
    "success": 200,
    "output": "PasswordChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A97"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/security",
    "operationId": "getMySecurity",
    "table": "passkeys",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MySecurity",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C8"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      503
    ],
    "acts": [
      "A04",
      "A97"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/sessions",
    "operationId": "listMySessions",
    "table": "sessions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MySessions",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/me/sessions/:id",
    "operationId": "revokeMySession",
    "table": "sessions",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "MySessionRevoked",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/sessions/revoke-others",
    "operationId": "revokeOtherSessions",
    "table": "sessions",
    "kind": "create",
    "input": "MySessionsRevokeInput",
    "success": 201,
    "output": "MySessionsRevoked",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/setup-tasks",
    "operationId": "listSetupTasks",
    "table": "members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "SetupTask",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/setup-tasks/dismiss",
    "operationId": "dismissSetupTasks",
    "table": "members",
    "kind": "create",
    "input": "DismissSetupTasksInput",
    "success": 201,
    "output": "SetupTasksDismissed",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/ticket-drafts",
    "operationId": "listMyTicketDrafts",
    "table": "tenant_memberships",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "TicketDraft",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/ticket-drafts",
    "operationId": "saveMyTicketDraft",
    "table": "tenant_memberships",
    "kind": "create",
    "input": "TicketDraftInput",
    "success": 201,
    "output": "TicketDraft",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/me/two-factor",
    "operationId": "disableTwoFactor",
    "table": "security_events",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "SecurityEvents",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A04"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/two-factor/confirm",
    "operationId": "confirmTwoFactor",
    "table": "security_events",
    "kind": "create",
    "input": "TwoFactorConfirmInput",
    "success": 201,
    "output": "TwoFactorEnabled",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      503
    ],
    "acts": [
      "A04"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/two-factor/enable",
    "operationId": "startTwoFactor",
    "table": "security_events",
    "kind": "create",
    "input": "TwoFactorStartInput",
    "success": 201,
    "output": "TwoFactorSetup",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      503
    ],
    "acts": [
      "A04"
    ],
    "screens": [
      "mfa-setup"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "login_or_step_up",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": true,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/me/usage",
    "operationId": "getMyUsage",
    "table": "agent_usage_snapshots",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "MyUsage",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A94"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/me/workspaces/:id",
    "operationId": "leaveWorkspace",
    "table": "tenant_memberships",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "WorkspaceLeft",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "account"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/me/workspaces/:id/switch",
    "operationId": "switchWorkspace",
    "table": "sessions",
    "kind": "create",
    "input": "WorkspaceSwitchInput",
    "success": 200,
    "output": "WorkspaceSwitched",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A74"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/members",
    "operationId": "listMembers",
    "table": "members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Members",
    "outputList": true,
    "generic": true,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/members/:id",
    "operationId": "getMember",
    "table": "members",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "MemberDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A61"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "view",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/members/:id/groups",
    "operationId": "updateMemberGroups",
    "table": "scope_memberships",
    "kind": "update",
    "input": "MemberGroupsInput",
    "success": 200,
    "output": "MemberGroupsChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      403,
      404,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A61"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/members/:id/remove",
    "operationId": "removeMember",
    "table": "members",
    "kind": "create",
    "input": "MemberRemoveInput",
    "success": 200,
    "output": "MemberRemoved",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      409,
      409,
      409,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A62"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/members/:id/remove-preview",
    "operationId": "previewMemberRemoval",
    "table": "members",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "MemberRemovalPreview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A62"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/members/:id/resume",
    "operationId": "resumeMember",
    "table": "members",
    "kind": "create",
    "input": "MemberResumeInput",
    "success": 201,
    "output": "MemberStateChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      403,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A62"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/members/:id/role",
    "operationId": "updateMemberRole",
    "table": "members",
    "kind": "update",
    "input": "MemberRoleInput",
    "success": 200,
    "output": "MemberRoleChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      403,
      404,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A61"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/members/:id/suspend",
    "operationId": "suspendMember",
    "table": "members",
    "kind": "create",
    "input": "MemberSuspendInput",
    "success": 201,
    "output": "MemberStateChanged",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      403,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A62"
    ],
    "screens": [
      "member-detail"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/members/:id/two-factor/reset",
    "operationId": "resetMemberTwoFactor",
    "table": "security_events",
    "kind": "create",
    "input": "SecurityEventsInput",
    "success": 201,
    "output": "SecurityEvents",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C8"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A04"
    ],
    "screens": [
      "member-detail",
      "mfa-setup"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/messages/:id/artifacts",
    "operationId": "createArtifactFromMessage",
    "table": "artifacts",
    "kind": "create",
    "input": "ArtifactsInput",
    "success": 201,
    "output": "Artifacts",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A95"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "messages",
        "sql": "exists (select 1 from conversations c where c.id = conversation_id and c.owner_member_id = app.user_id())"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/notices",
    "operationId": "listNotices",
    "table": "notices",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Notice",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A68"
    ],
    "screens": [
      "notices"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/notices/:id/read",
    "operationId": "markNoticeRead",
    "table": "notice_deliveries",
    "kind": "create",
    "input": "NoticeReadInput",
    "success": 200,
    "output": "NoticeRead",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A68"
    ],
    "screens": [
      "notices"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/notifications",
    "operationId": "listNotifications",
    "table": "notifications",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Notification",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "actor_member_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A109"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/notifications/:id",
    "operationId": "readNotification",
    "table": "notifications",
    "kind": "update",
    "input": "NotificationReadInput",
    "success": 200,
    "output": "Notification",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A109"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/notifications/read-all",
    "operationId": "readAllNotifications",
    "table": "notifications",
    "kind": "create",
    "input": "NotificationReadAllInput",
    "success": 201,
    "output": "NotificationsRead",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A109"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/inquiries",
    "operationId": "listOpsInquiries",
    "table": "inquiries",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsInquiryRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A70"
    ],
    "screens": [
      "ops-support"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/inquiries/:id",
    "operationId": "getOpsInquiry",
    "table": "inquiries",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsInquiryDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A70"
    ],
    "screens": [
      "ops-support"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ops/inquiries/:id",
    "operationId": "updateOpsInquiry",
    "table": "inquiries",
    "kind": "update",
    "input": "OpsInquiryUpdateInput",
    "success": 200,
    "output": "OpsInquiryRow",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A70"
    ],
    "screens": [
      "ops-support"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/inquiries/:id/notes",
    "operationId": "addOpsInquiryNote",
    "table": "messages",
    "kind": "create",
    "input": "OpsInquiryNoteInput",
    "success": 201,
    "output": "OpsInquiryMessage",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A70"
    ],
    "screens": [
      "ops-support"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/inquiries/:id/replies",
    "operationId": "replyOpsInquiry",
    "table": "messages",
    "kind": "create",
    "input": "OpsInquiryReplyInput",
    "success": 201,
    "output": "OpsInquiryMessage",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A70"
    ],
    "screens": [
      "ops-support"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/invoice-template",
    "operationId": "getOpsInvoiceTemplate",
    "table": "ops_invoice_templates",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsInvoiceTemplate",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A72"
    ],
    "screens": [
      "ops-billing"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "money",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/ops/invoice-template",
    "operationId": "updateOpsInvoiceTemplate",
    "table": "ops_invoice_templates",
    "kind": "update",
    "input": "OpsInvoiceTemplateInput",
    "success": 200,
    "output": "OpsInvoiceTemplate",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      409,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A72"
    ],
    "screens": [
      "ops-billing"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "money",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/invoices",
    "operationId": "listOpsInvoices",
    "table": "invoices",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsInvoiceRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A72"
    ],
    "screens": [
      "ops-billing"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "money",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/invoices/:id/payments",
    "operationId": "recordPayment",
    "table": "payments",
    "kind": "create",
    "input": "PaymentRecordInput",
    "success": 201,
    "output": "OpsInvoiceRow",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A72"
    ],
    "screens": [
      "ops-billing"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "money",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/invoices/issue",
    "operationId": "issueOpsInvoices",
    "table": "invoices",
    "kind": "create",
    "input": "OpsInvoiceIssueInput",
    "success": 201,
    "output": "OpsInvoiceIssue",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A72"
    ],
    "screens": [
      "ops-billing"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "money",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/members",
    "operationId": "listOpsMembers",
    "table": "ops_members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsMemberRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A134"
    ],
    "screens": [
      "ops-team"
    ],
    "perm": {
      "word": "ops:ops_people",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "ops_people",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/members",
    "operationId": "addOpsMember",
    "table": "ops_members",
    "kind": "create",
    "input": "OpsMemberAddInput",
    "success": 201,
    "output": "OpsMemberRow",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A134"
    ],
    "screens": [
      "ops-team"
    ],
    "perm": {
      "word": "ops:ops_people",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "ops_people",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ops/members/:id",
    "operationId": "updateOpsMemberCaps",
    "table": "ops_members",
    "kind": "update",
    "input": "OpsMemberCapsInput",
    "success": 200,
    "output": "OpsMemberRow",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A134"
    ],
    "screens": [
      "ops-team"
    ],
    "perm": {
      "word": "ops:ops_people",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "ops_people",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ops/members/:id",
    "operationId": "removeOpsMember",
    "table": "ops_members",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "OpsMemberRemoved",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A134"
    ],
    "screens": [
      "ops-team"
    ],
    "perm": {
      "word": "ops:ops_people",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "ops_people",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/notices",
    "operationId": "listOpsNotices",
    "table": "notices",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsNoticeRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/notices",
    "operationId": "createOpsNotice",
    "table": "notices",
    "kind": "create",
    "input": "OpsNoticeCreateInput",
    "success": 201,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/notices/:id",
    "operationId": "getOpsNotice",
    "table": "notices",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ops/notices/:id",
    "operationId": "updateOpsNotice",
    "table": "notices",
    "kind": "update",
    "input": "OpsNoticeUpdateInput",
    "success": 200,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/notices/:id/publish",
    "operationId": "publishOpsNotice",
    "table": "notices",
    "kind": "create",
    "input": "OpsNoticePublishInput",
    "success": 201,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/notices/:id/updates",
    "operationId": "addIncidentUpdate",
    "table": "status_incidents",
    "kind": "create",
    "input": "IncidentUpdateInput",
    "success": 201,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A71"
    ],
    "screens": [
      "ops-notices"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/operations",
    "operationId": "listOperations",
    "table": "operations",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsOperation",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A80"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:distribute",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "distribute",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ops/peeks/:id",
    "operationId": "closePeek",
    "table": "support_access_grants",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "OpsPeek",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:peek",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "peek",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/plan_history",
    "operationId": "listPlanHistory",
    "table": "ops_audit_events",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PlanHistoryRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/plan_proposals",
    "operationId": "listPlanProposals",
    "table": "ops_plan_proposals",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PlanProposal",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/plan_proposals",
    "operationId": "createPlanProposal",
    "table": "ops_plan_proposals",
    "kind": "create",
    "input": "PlanProposalCreateInput",
    "success": 201,
    "output": "PlanProposal",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:plan_propose",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "plan_propose",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ops/plan_proposals/:id",
    "operationId": "updatePlanProposal",
    "table": "ops_plan_proposals",
    "kind": "update",
    "input": "PlanProposalUpdateInput",
    "success": 200,
    "output": "PlanProposal",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:plan_propose",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "plan_propose",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/plan_proposals/:id/decide",
    "operationId": "decidePlanProposal",
    "table": "ops_plan_proposals",
    "kind": "create",
    "input": "PlanProposalDecideInput",
    "success": 200,
    "output": "PlanProposal",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:plan_decide",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "plan_decide",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/plan_proposals/:id/impact",
    "operationId": "getPlanProposalImpact",
    "table": "ops_plan_proposals",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "PlanProposalImpact",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/plan_proposals/:id/return",
    "operationId": "returnPlanProposal",
    "table": "ops_plan_proposals",
    "kind": "create",
    "input": "PlanProposalReturnInput",
    "success": 200,
    "output": "PlanProposal",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:plan_decide",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "plan_decide",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/plan_proposals/:id/submit",
    "operationId": "submitPlanProposal",
    "table": "ops_plan_proposals",
    "kind": "create",
    "input": "OpsPlanProposalsInput",
    "success": 201,
    "output": "PlanProposal",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:plan_propose",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "plan_propose",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/plans",
    "operationId": "listOpsPlans",
    "table": "plans",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PlanOps",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A133"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/pwned",
    "operationId": "listOpsPwned",
    "table": "security_events",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsPwnedRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A138"
    ],
    "screens": [
      "ops-home"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/pwned/pending/ack",
    "operationId": "ackOpsPwnedPending",
    "table": "pending_signup",
    "kind": "create",
    "input": "OpsPwnedPendingAckInput",
    "success": 200,
    "output": "OpsPwnedPendingAck",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      503,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A138"
    ],
    "screens": [
      "ops-home"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/shell",
    "operationId": "getOpsShell",
    "table": "inquiries",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsShell",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A60"
    ],
    "screens": [
      "ops-home"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/templates",
    "operationId": "listOpsTemplates",
    "table": "distributions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsTemplateRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A128"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:distribute",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "distribute",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/templates/:id",
    "operationId": "getOpsTemplate",
    "table": "distributions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsTemplate",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A128"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:distribute",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "distribute",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/templates/:id/versions",
    "operationId": "releaseOpsTemplate",
    "table": "distributions",
    "kind": "create",
    "input": "OpsTemplateReleaseInput",
    "success": 201,
    "output": "OpsTemplateRow",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A128"
    ],
    "screens": [
      "ops-skills"
    ],
    "perm": {
      "word": "ops:distribute",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "distribute",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces",
    "operationId": "listOpsWorkspaces",
    "table": "tenants",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "OpsWorkspaceRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A60"
    ],
    "screens": [
      "ops-home"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_all",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces/:id",
    "operationId": "getOpsWorkspace",
    "table": "tenants",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsWorkspace",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces/:id/audit",
    "operationId": "listOpsWorkspaceAudit",
    "table": "ops_audit_events",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsWorkspaceAuditRow",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces/:id/billing",
    "operationId": "getOpsWorkspaceBilling",
    "table": "invoices",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsWorkspaceBilling",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "money",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces/:id/inquiries",
    "operationId": "listOpsWorkspaceInquiries",
    "table": "inquiries",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsWorkspaceInquiry",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ops/workspaces/:id/members",
    "operationId": "listOpsWorkspaceMembers",
    "table": "members",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "OpsWorkspaceMember",
    "outputList": true,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/members/:mid/resend-verification",
    "operationId": "resendOpsVerification",
    "table": "security_events",
    "kind": "create",
    "input": "OpsVerificationResendInput",
    "success": 201,
    "output": "OpsVerificationResent",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "mid"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:inquiry",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "inquiry",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/notices",
    "operationId": "sendWorkspaceNotice",
    "table": "notices",
    "kind": "create",
    "input": "WorkspaceNoticeInput",
    "success": 201,
    "output": "OpsNoticeDetail",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:notice",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "notice",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/peeks",
    "operationId": "openPeek",
    "table": "support_access_grants",
    "kind": "create",
    "input": "OpsPeekOpenInput",
    "success": 201,
    "output": "OpsPeek",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:peek",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "peek",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/plan",
    "operationId": "changeOpsWorkspacePlan",
    "table": "subscriptions",
    "kind": "create",
    "input": "OpsPlanChangeInput",
    "success": 201,
    "output": "PlanChange",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A64"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:money",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "money",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/pwned/ack",
    "operationId": "ackOpsPwned",
    "table": "security_events",
    "kind": "create",
    "input": "OpsPwnedAckInput",
    "success": 200,
    "output": "OpsPwnedAck",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A138"
    ],
    "screens": [
      "ops-home"
    ],
    "perm": {
      "word": "ops:any",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "any",
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/resume",
    "operationId": "resumeWorkspace",
    "table": "account_events",
    "kind": "create",
    "input": "OpsWorkspaceResumeInput",
    "success": 201,
    "output": "OpsWorkspace",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A127"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:stop",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "stop",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ops/workspaces/:id/stop",
    "operationId": "stopWorkspace",
    "table": "account_events",
    "kind": "create",
    "input": "OpsWorkspaceStopInput",
    "success": 201,
    "output": "OpsWorkspace",
    "outputList": false,
    "generic": false,
    "auth": "ops",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A127"
    ],
    "screens": [
      "ops-tenant"
    ],
    "perm": {
      "word": "ops:stop",
      "target": null,
      "ability": null,
      "scope": "ops_tenant",
      "adminOnly": false,
      "cap": "stop",
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/portal",
    "operationId": "getPortalHome",
    "table": "client_requests",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PortalHome",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A125"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/portal/attachments",
    "operationId": "uploadPortalAttachment",
    "table": "attachments",
    "kind": "create",
    "input": "PortalAttachmentInput",
    "success": 201,
    "output": "PortalAttachmentAdded",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A124"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/portal/notices",
    "operationId": "listPortalNotices",
    "table": "notices",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Notices",
    "outputList": true,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A125"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/portal/requests",
    "operationId": "createPortalRequest",
    "table": "client_requests",
    "kind": "create",
    "input": "PortalRequestCreateInput",
    "success": 201,
    "output": "PortalRequestCreated",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A124"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/portal/requests/:id",
    "operationId": "getPortalRequest",
    "table": "client_requests",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "PortalRequest",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A124"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/portal/requests/:id/messages",
    "operationId": "postPortalRequestMessage",
    "table": "messages",
    "kind": "create",
    "input": "PortalRequestMessageInput",
    "success": 201,
    "output": "PortalRequestMessagePosted",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A124"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/portal/requests/questions",
    "operationId": "askPortalRequestQuestions",
    "table": "client_requests",
    "kind": "create",
    "input": "PortalQuestionsInput",
    "success": 200,
    "output": "PortalQuestions",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A124"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/portal/tickets/:id",
    "operationId": "getPortalTicket",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "PortalTicket",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A125"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/portal/tickets/:id/messages",
    "operationId": "postPortalTicketMessage",
    "table": "ticket_messages",
    "kind": "create",
    "input": "PortalTicketMessageInput",
    "success": 201,
    "output": "PortalTicketMessageCreated",
    "outputList": false,
    "generic": false,
    "auth": "client",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A125"
    ],
    "screens": [
      "portal"
    ],
    "perm": {
      "word": "client",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/saved_views",
    "operationId": "listSavedViews",
    "table": "saved_views",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "SavedView",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/saved_views",
    "operationId": "createSavedView",
    "table": "saved_views",
    "kind": "create",
    "input": "SavedViewInput",
    "success": 201,
    "output": "SavedView",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/saved_views/:id",
    "operationId": "updateSavedView",
    "table": "saved_views",
    "kind": "update",
    "input": "SavedViewUpdateInput",
    "success": 200,
    "output": "SavedView",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "saved_views",
        "sql": "(member_id = app.user_id() or app.manages_scope(scope_id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/saved_views/:id",
    "operationId": "deleteSavedView",
    "table": "saved_views",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "SavedViewDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "saved_views",
        "sql": "(member_id = app.user_id() or app.manages_scope(scope_id))"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/scopes",
    "operationId": "listScopes",
    "table": "scopes",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ScopeListItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "layer_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/scopes",
    "operationId": "createScope",
    "table": "scopes",
    "kind": "create",
    "input": "ScopeCreateInput",
    "success": 201,
    "output": "ScopeCreated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "admin",
      "target": "scopes",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/scopes/:id",
    "operationId": "updateScope",
    "table": "scopes",
    "kind": "update",
    "input": "ScopeUpdateInput",
    "success": 200,
    "output": "ScopeUpdated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A117"
    ],
    "screens": [
      "layers"
    ],
    "perm": {
      "word": "admin",
      "target": "scopes",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/scopes/:id/overview",
    "operationId": "getScopeOverview",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ScopeOverview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "scopes",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/search",
    "operationId": "search",
    "table": "tickets",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "SearchHit",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A21"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/service-status",
    "operationId": "getServiceStatusForMember",
    "table": "status_incidents",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "ServiceStatus",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A68"
    ],
    "screens": [
      "notices"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/shell",
    "operationId": "getShell",
    "table": "notifications",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Shell",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A58"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/test_specs/:id",
    "operationId": "updateTestSpec",
    "table": "test_specs",
    "kind": "update",
    "input": "TestSpecUpdateInput",
    "success": 200,
    "output": "TestSpecItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "test_specs",
        "sql": "tenant_id = current_setting('app.tenant_id', true)::uuid AND app.ticket_writable(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/test_specs/:id",
    "operationId": "deleteTestSpec",
    "table": "test_specs",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TestSpecItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "test_specs",
        "sql": "tenant_id = current_setting('app.tenant_id', true)::uuid AND app.ticket_writable(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket-field-master",
    "operationId": "listTicketFieldMaster",
    "table": "custom_fields",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "TicketFieldSetting",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "custom_fields",
      "ability": "view",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket-fields",
    "operationId": "listTicketFields",
    "table": "custom_fields",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "TicketField",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "kind_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      404,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket-fields",
    "operationId": "createTicketField",
    "table": "custom_fields",
    "kind": "create",
    "input": "TicketFieldCreateInput",
    "success": 201,
    "output": "TicketFieldSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "custom_fields",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket-fields/:id",
    "operationId": "updateTicketField",
    "table": "custom_fields",
    "kind": "update",
    "input": "TicketFieldUpdateInput",
    "success": 200,
    "output": "TicketFieldSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "custom_fields",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ticket-fields/:id",
    "operationId": "deleteTicketField",
    "table": "custom_fields",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TicketFieldDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "custom_fields",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket-fields/order",
    "operationId": "reorderTicketFields",
    "table": "custom_fields",
    "kind": "create",
    "input": "TicketFieldOrderInput",
    "success": 200,
    "output": "TicketFieldSetting",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "custom_fields",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket_decisions/:id",
    "operationId": "updateTicketDecision",
    "table": "ticket_decisions",
    "kind": "update",
    "input": "TicketDecisionUpdateInput",
    "success": 200,
    "output": "TicketDecisionChange",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A108"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_decisions",
        "sql": "tenant_id = current_setting('app.tenant_id', true)::uuid AND app.ticket_writable(ticket_id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_draft_conversations",
    "operationId": "startDraftConversation",
    "table": "conversations",
    "kind": "create",
    "input": "DraftConversationStartInput",
    "success": 201,
    "output": "DraftConversationStarted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      403,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20",
      "A99"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_draft_conversations/:id/adopt",
    "operationId": "adoptDraftConversation",
    "table": "conversations",
    "kind": "create",
    "input": "ConversationAdoptInput",
    "success": 201,
    "output": "ConversationAdopted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20",
      "A99"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_draft_conversations/:id/messages",
    "operationId": "sendDraftMessage",
    "table": "messages",
    "kind": "create",
    "input": "DraftMessageInput",
    "success": 201,
    "output": "DraftMessageSent",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      403,
      409,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20",
      "A99"
    ],
    "screens": [
      "clone-chat"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "conversations",
        "sql": "owner_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket_handovers/:id",
    "operationId": "answerTicketHandover",
    "table": "ticket_handovers",
    "kind": "update",
    "input": "TicketHandoverAnswerInput",
    "success": 200,
    "output": "TicketHandoverAnswered",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A110"
    ],
    "screens": [
      "approvals",
      "tickets"
    ],
    "perm": {
      "word": "recipient",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_handovers",
        "sql": "app.handover_answerer(id, app.user_id(), false)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_handovers/:id/claim",
    "operationId": "claimTicketHandover",
    "table": "ticket_handovers",
    "kind": "create",
    "input": "TicketHandoverClaimInput",
    "success": 200,
    "output": "TicketHandoverClaimed",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A111"
    ],
    "screens": [
      "approvals"
    ],
    "perm": {
      "word": "recipient",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_handovers",
        "sql": "app.handover_answerer(id, app.user_id(), false)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_handovers/:id/remind",
    "operationId": "remindTicketHandover",
    "table": "ticket_handovers",
    "kind": "create",
    "input": "HandoverRemindInput",
    "success": 201,
    "output": "HandoverReminded",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A111",
      "A51"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_handovers",
        "sql": "from_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_handovers/:id/withdraw",
    "operationId": "withdrawTicketHandover",
    "table": "ticket_handovers",
    "kind": "create",
    "input": "HandoverWithdrawInput",
    "success": 201,
    "output": "HandoverWithdrawn",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A111",
      "A48",
      "A51"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_handovers",
        "sql": "from_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_imports",
    "operationId": "createTicketImport",
    "table": "ticket_imports",
    "kind": "create",
    "input": "TicketImportsInput",
    "success": 201,
    "output": "TicketImports",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket_imports/:id",
    "operationId": "getTicketImport",
    "table": "ticket_imports",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketImports",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_imports",
        "sql": "uploaded_by = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_imports/:id/commit",
    "operationId": "commitTicketImport",
    "table": "ticket_imports",
    "kind": "create",
    "input": "TicketImportsInput",
    "success": 201,
    "output": "TicketImports",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_imports",
        "sql": "uploaded_by = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket_kinds",
    "operationId": "listTicketKinds",
    "table": "ticket_kinds",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "TicketKindChoice",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_kinds",
    "operationId": "createTicketKind",
    "table": "ticket_kinds",
    "kind": "create",
    "input": "TicketKindCreateInput",
    "success": 201,
    "output": "TicketKindSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket_kinds/:id",
    "operationId": "updateTicketKind",
    "table": "ticket_kinds",
    "kind": "update",
    "input": "TicketKindUpdateInput",
    "success": 200,
    "output": "TicketKindSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_kinds",
        "sql": "tenant_id = current_setting('app.tenant_id', true)::uuid AND has_permission(current_setting('app.user_id', true)::uuid, 'ticket_kinds', NULL, 'edit')"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ticket_kinds/:id",
    "operationId": "deleteTicketKind",
    "table": "ticket_kinds",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TicketKindDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_kinds",
        "sql": "tenant_id = current_setting('app.tenant_id', true)::uuid AND has_permission(current_setting('app.user_id', true)::uuid, 'ticket_kinds', NULL, 'edit')"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_kinds/order",
    "operationId": "reorderTicketKinds",
    "table": "ticket_kinds",
    "kind": "create",
    "input": "TicketKindOrderInput",
    "success": 201,
    "output": "TicketKindSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket_kinds/template-updates",
    "operationId": "listKindTemplateUpdates",
    "table": "tenant_distributions",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "KindTemplateUpdate",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A120"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "tenant_distributions",
      "ability": "view",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_kinds/template-updates/:id/apply",
    "operationId": "applyKindTemplateUpdate",
    "table": "tenant_distributions",
    "kind": "create",
    "input": "KindTemplateUpdateApplyInput",
    "success": 201,
    "output": "KindTemplateUpdate",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A120"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "tenant_distributions",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ticket_links/:id",
    "operationId": "deleteTicketLink",
    "table": "ticket_links",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TicketLinkDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket_messages/:id",
    "operationId": "updateTicketMessage",
    "table": "ticket_messages",
    "kind": "update",
    "input": "TicketMessageEditInput",
    "success": 200,
    "output": "TimelineItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      404,
      503,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "self",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_messages",
        "sql": "author_member_id = app.user_id()"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ticket_messages/:id",
    "operationId": "deleteTicketMessage",
    "table": "ticket_messages",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TimelineItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_messages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_messages/:id/star",
    "operationId": "starTicketMessage",
    "table": "ticket_messages",
    "kind": "create",
    "input": "TicketMessageStarInput",
    "success": 200,
    "output": "TicketMessageStar",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "ticket_messages",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/ticket_stages",
    "operationId": "listTicketStages",
    "table": "ticket_stages",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "TicketStageSetting",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_stages",
    "operationId": "createTicketStage",
    "table": "ticket_stages",
    "kind": "create",
    "input": "TicketStageCreateInput",
    "success": 201,
    "output": "TicketStageSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "ticket_stages",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/ticket_stages/:id",
    "operationId": "updateTicketStage",
    "table": "ticket_stages",
    "kind": "update",
    "input": "TicketStageUpdateInput",
    "success": 200,
    "output": "TicketStageSetting",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "ticket_stages",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/ticket_stages/:id",
    "operationId": "deleteTicketStage",
    "table": "ticket_stages",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TicketStageDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "ticket_stages",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/ticket_stages/order",
    "operationId": "reorderTicketStages",
    "table": "ticket_stages",
    "kind": "create",
    "input": "TicketStageOrderInput",
    "success": 200,
    "output": "TicketStageSetting",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 30,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A118"
    ],
    "screens": [
      "masters"
    ],
    "perm": {
      "word": "admin",
      "target": "ticket_stages",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets",
    "operationId": "listTickets",
    "table": "tickets",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Tickets",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "scope_id",
      "kind_id",
      "stage_id",
      "assignee_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      409,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A113",
      "A58",
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets",
    "operationId": "createTicket",
    "table": "tickets",
    "kind": "create",
    "input": "TicketCreateInput",
    "success": 201,
    "output": "Tickets",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      409,
      409,
      409,
      409,
      409,
      409,
      404,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A129",
      "A98",
      "A99"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id",
    "operationId": "getTicket",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketDetail",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/tickets/:id",
    "operationId": "updateTicket",
    "table": "tickets",
    "kind": "update",
    "input": "TicketUpdateInput",
    "success": 200,
    "output": "TicketUpdated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
      422,
      422,
      422,
      503,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103",
      "A113",
      "A115",
      "A17"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/tickets/:id",
    "operationId": "deleteTicket",
    "table": "tickets",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "TicketDeleted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "parent_id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A116"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/agent-session",
    "operationId": "getTicketAgentSession",
    "table": "conversations",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketAgentSession",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/agent-session/apply",
    "operationId": "applyTicketAgentProposal",
    "table": "ticket_sections",
    "kind": "create",
    "input": "TicketSectionsInput",
    "success": 201,
    "output": "TicketSections",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/agent-session/messages",
    "operationId": "sendTicketAgentMessage",
    "table": "messages",
    "kind": "create",
    "input": "TicketAgentMessageInput",
    "success": 201,
    "output": "TicketAgentSent",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C4",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A20",
      "A91"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/artifacts",
    "operationId": "listTicketArtifacts",
    "table": "artifacts",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "Artifacts",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/attachments",
    "operationId": "createTicketAttachment",
    "table": "attachments",
    "kind": "create",
    "input": "AttachmentsInput",
    "success": 201,
    "output": "Attachments",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C4"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/tickets/:id/body",
    "operationId": "updateTicketBody",
    "table": "ticket_sections",
    "kind": "update",
    "input": "TicketBodyInput",
    "success": 200,
    "output": "BodySaved",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/complete",
    "operationId": "completeTicket",
    "table": "tickets",
    "kind": "create",
    "input": "TicketCompleteInput",
    "success": 201,
    "output": "TicketCompletion",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A106"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/decisions",
    "operationId": "listTicketDecisions",
    "table": "ticket_decisions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketDecision",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A108"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/decisions",
    "operationId": "createTicketDecision",
    "table": "ticket_decisions",
    "kind": "create",
    "input": "TicketDecisionInput",
    "success": 201,
    "output": "TicketDecisionCreated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A108"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/delegate",
    "operationId": "delegateTicket",
    "table": "action_runs",
    "kind": "create",
    "input": "TicketDelegateInput",
    "success": 201,
    "output": "TicketDelegation",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3",
      "C5"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/delete-preview",
    "operationId": "previewTicketDelete",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketDeletePreview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A116"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/dry-run",
    "operationId": "dryRunTicket",
    "table": "action_runs",
    "kind": "create",
    "input": "DryRunInput",
    "success": 201,
    "output": "DryRunStarted",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C1",
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      409,
      409,
      409,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A105"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/guest-shares",
    "operationId": "listTicketGuestShares",
    "table": "ticket_guest_shares",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketGuestShares",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A123"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/tickets/:id/guest-shares",
    "operationId": "updateTicketGuestShares",
    "table": "ticket_guest_shares",
    "kind": "update",
    "input": "TicketGuestSharesInput",
    "success": 200,
    "output": "TicketGuestSharesUpdated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      422,
      409,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A123"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/handover-preview",
    "operationId": "previewTicketHandover",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "HandoverPreview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A111",
      "A48",
      "A51"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/handovers",
    "operationId": "listTicketHandovers",
    "table": "ticket_handovers",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketHandover",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A110",
      "A51"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/handovers",
    "operationId": "createTicketHandover",
    "table": "ticket_handovers",
    "kind": "create",
    "input": "TicketHandoverCreateInput",
    "success": 201,
    "output": "TicketHandoverCreated",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A111",
      "A112",
      "A48",
      "A51"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/item-changes",
    "operationId": "listTicketItemChanges",
    "table": "ticket_messages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketItemChangesView",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      404,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/item-changes/restore",
    "operationId": "restoreTicketItems",
    "table": "ticket_messages",
    "kind": "create",
    "input": "ItemRestoreInput",
    "success": 200,
    "output": "ItemRestored",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/kind-change-preview",
    "operationId": "previewTicketKindChange",
    "table": "tickets",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketKindChangePreview",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/links",
    "operationId": "listTicketLinks",
    "table": "ticket_links",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketLink",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      404,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/links",
    "operationId": "createTicketLink",
    "table": "ticket_links",
    "kind": "create",
    "input": "TicketLinkInput",
    "success": 201,
    "output": "TicketLink",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/messages",
    "operationId": "createTicketMessage",
    "table": "ticket_messages",
    "kind": "create",
    "input": "TicketMessageInput",
    "success": 201,
    "output": "TimelineItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      409,
      409,
      409,
      409,
      422,
      404,
      503,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/references",
    "operationId": "listTicketReferences",
    "table": "reference_logs",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ReferenceLogs",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/restore",
    "operationId": "restoreTicket",
    "table": "tickets",
    "kind": "create",
    "input": "TicketRestoreInput",
    "success": 201,
    "output": "TicketRestored",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A116"
    ],
    "screens": [
      "audit",
      "tickets"
    ],
    "perm": {
      "word": "assignee",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/runs",
    "operationId": "listTicketRuns",
    "table": "action_runs",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "ActionRunView",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "scope_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A104"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/test-specs",
    "operationId": "listTestSpecs",
    "table": "test_specs",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TestSpecItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/test-specs",
    "operationId": "createTestSpec",
    "table": "test_specs",
    "kind": "create",
    "input": "TestSpecCreateInput",
    "success": 201,
    "output": "TestSpecItem",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/test-specs/lint",
    "operationId": "lintTestSpecs",
    "table": "test_specs",
    "kind": "create",
    "input": "TestSpecsInput",
    "success": 201,
    "output": "TestSpecLint",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/test-specs/suggest",
    "operationId": "suggestTestSpecs",
    "table": "test_specs",
    "kind": "create",
    "input": "TestSpecsInput",
    "success": 201,
    "output": "TestSpecs",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C3"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      413,
      429,
      502,
      403,
      403,
      503
    ],
    "acts": [
      "A102"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/timeline",
    "operationId": "listTicketTimeline",
    "table": "ticket_messages",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TimelineItem",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id",
      "before_id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/timeline/seen",
    "operationId": "markTicketTimelineSeen",
    "table": "ticket_messages",
    "kind": "create",
    "input": "TicketTimelineSeenInput",
    "success": 201,
    "output": "TicketTimelineSeen",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2",
      "C6"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A107"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tickets/:id/versions",
    "operationId": "listTicketVersions",
    "table": "ticket_section_versions",
    "kind": "get",
    "input": null,
    "success": 200,
    "output": "TicketVersionsView",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [],
    "errors": [
      401,
      403,
      404,
      422,
      404,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "read",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "true"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/:id/versions/:v/restore",
    "operationId": "restoreTicketVersion",
    "table": "ticket_sections",
    "kind": "create",
    "input": "BodyRestoreInput",
    "success": 201,
    "output": "BodyRestored",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [
      "id"
    ],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      404,
      409,
      422,
      404,
      409,
      409,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A101"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": {
        "table": "tickets",
        "sql": "app.ticket_writable(id)"
      }
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tickets/bulk",
    "operationId": "bulkUpdateTickets",
    "table": "tickets",
    "kind": "create",
    "input": "TicketsInput",
    "success": 201,
    "output": "BulkResult",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A103",
      "A113"
    ],
    "screens": [
      "tickets"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/workspace",
    "operationId": "getWorkspaceSettings",
    "table": "tenants",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "WorkspaceSettings",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/workspace",
    "operationId": "updateWorkspace",
    "table": "tenants",
    "kind": "update",
    "input": "WorkspaceUpdateInput",
    "success": 200,
    "output": "WorkspaceRenamed",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/workspace/billing",
    "operationId": "getBilling",
    "table": "invoices",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "Billing",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A69"
    ],
    "screens": [
      "billing"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "billing",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/workspace/billing-contact",
    "operationId": "updateBillingContact",
    "table": "subscriptions",
    "kind": "update",
    "input": "BillingContactInput",
    "success": 200,
    "output": "BillingContact",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A69"
    ],
    "screens": [
      "billing"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "billing",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/workspace/deletion",
    "operationId": "requestWorkspaceDeletion",
    "table": "account_events",
    "kind": "create",
    "input": "WorkspaceDeletionInput",
    "success": 200,
    "output": "WorkspaceDeletion",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      403,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/workspace/deletion",
    "operationId": "cancelWorkspaceDeletion",
    "table": "account_events",
    "kind": "delete",
    "input": null,
    "success": 200,
    "output": "WorkspaceDeletion",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      403,
      409,
      503,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "write",
      "target": null,
      "ability": null,
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/workspace/logo",
    "operationId": "uploadWorkspaceLogo",
    "table": "tenants",
    "kind": "create",
    "input": "WorkspaceLogoInput",
    "success": 201,
    "output": "WorkspaceLogo",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      413,
      422,
      502,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/workspace/members",
    "operationId": "getWorkspaceMembers",
    "table": "members",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "WorkspaceMembers",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A36"
    ],
    "screens": [
      "members"
    ],
    "perm": {
      "word": "admin",
      "target": "members",
      "ability": "view",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/workspace/permissions",
    "operationId": "updateWorkspacePermissions",
    "table": "permissions",
    "kind": "update",
    "input": "WorkspacePermissionsInput",
    "success": 200,
    "output": "WorkspacePermissions",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      422,
      403,
      503,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A75"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "admin",
      "target": "permissions",
      "ability": "edit",
      "scope": "workspace",
      "adminOnly": true,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "POST",
    "path": "/api/v1/workspace/plan",
    "operationId": "changePlan",
    "table": "subscriptions",
    "kind": "create",
    "input": "PlanChangeInput",
    "success": 200,
    "output": "PlanChange",
    "outputList": false,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 60,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [
      "C2"
    ],
    "errors": [
      401,
      403,
      409,
      422,
      404,
      413,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A69"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "billing",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": "always",
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  },
  {
    "method": "GET",
    "path": "/api/v1/workspace/plans",
    "operationId": "listWorkspacePlans",
    "table": "plans",
    "kind": "list",
    "input": null,
    "success": 200,
    "output": "PlanChoice",
    "outputList": true,
    "generic": false,
    "auth": "member",
    "rateLimit": {
      "perMinute": 120,
      "key": "user"
    },
    "uuidParams": [],
    "chokePoints": [],
    "errors": [
      401,
      403,
      422,
      429,
      403,
      403,
      503
    ],
    "acts": [
      "A69"
    ],
    "screens": [
      "company-settings"
    ],
    "perm": {
      "word": "admin",
      "target": "tenants",
      "ability": "billing",
      "scope": "workspace",
      "adminOnly": false,
      "cap": null,
      "stepUp": null,
      "row": null
    },
    "termsOpen": false,
    "mfaOpen": false,
    "ignoresScope": false
  }
];
export const OPENAPI_HASH = "406576c86e166c6e";

// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。openapi:524c29fc35499719
export interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
}
export const ENDPOINTS: readonly EndpointDef[] = [
  {
    method: "GET",
    path: "/api/v1/action_runs",
    operationId: "getActionRuns",
  },
  {
    method: "GET",
    path: "/api/v1/ai_employees",
    operationId: "getAiEmployees",
  },
  {
    method: "PATCH",
    path: "/api/v1/ai_employees/{id}",
    operationId: "patchAiEmployeesById",
  },
  {
    method: "GET",
    path: "/api/v1/approvals",
    operationId: "getApprovals",
  },
  {
    method: "PATCH",
    path: "/api/v1/approvals/{id}",
    operationId: "patchApprovalsById",
  },
  {
    method: "POST",
    path: "/api/v1/attachments",
    operationId: "postAttachments",
  },
  {
    method: "GET",
    path: "/api/v1/audit_events",
    operationId: "getAuditEvents",
  },
  {
    method: "POST",
    path: "/api/v1/audit_events",
    operationId: "postAuditEvents",
  },
  {
    method: "PATCH",
    path: "/api/v1/audit_events/{id}",
    operationId: "patchAuditEventsById",
  },
  {
    method: "DELETE",
    path: "/api/v1/audit_events/{id}",
    operationId: "deleteAuditEventsById",
  },
  {
    method: "POST",
    path: "/api/v1/clones",
    operationId: "postClones",
  },
  {
    method: "GET",
    path: "/api/v1/conversations",
    operationId: "getConversations",
  },
  {
    method: "POST",
    path: "/api/v1/credentials",
    operationId: "postCredentials",
  },
  {
    method: "POST",
    path: "/api/v1/distributions",
    operationId: "postDistributions",
  },
  {
    method: "PATCH",
    path: "/api/v1/duties/{id}",
    operationId: "patchDutiesById",
  },
  {
    method: "POST",
    path: "/api/v1/export_jobs",
    operationId: "postExportJobs",
  },
  {
    method: "GET",
    path: "/api/v1/goal_allocations",
    operationId: "getGoalAllocations",
  },
  {
    method: "PATCH",
    path: "/api/v1/goal_allocations/{id}",
    operationId: "patchGoalAllocationsById",
  },
  {
    method: "GET",
    path: "/api/v1/goals",
    operationId: "getGoals",
  },
  {
    method: "PATCH",
    path: "/api/v1/goals/{id}",
    operationId: "patchGoalsById",
  },
  {
    method: "GET",
    path: "/api/v1/hypotheses",
    operationId: "getHypotheses",
  },
  {
    method: "PATCH",
    path: "/api/v1/hypotheses/{id}",
    operationId: "patchHypothesesById",
  },
  {
    method: "GET",
    path: "/api/v1/inquiries",
    operationId: "getInquiries",
  },
  {
    method: "POST",
    path: "/api/v1/inquiries",
    operationId: "postInquiries",
  },
  {
    method: "PATCH",
    path: "/api/v1/inquiries/{id}",
    operationId: "patchInquiriesById",
  },
  {
    method: "GET",
    path: "/api/v1/invitations",
    operationId: "getInvitations",
  },
  {
    method: "GET",
    path: "/api/v1/invoices",
    operationId: "getInvoices",
  },
  {
    method: "GET",
    path: "/api/v1/learned_procedures",
    operationId: "getLearnedProcedures",
  },
  {
    method: "GET",
    path: "/api/v1/ledger_definitions",
    operationId: "getLedgerDefinitions",
  },
  {
    method: "PATCH",
    path: "/api/v1/ledger_definitions/{id}",
    operationId: "patchLedgerDefinitionsById",
  },
  {
    method: "GET",
    path: "/api/v1/ledger_records",
    operationId: "getLedgerRecords",
  },
  {
    method: "PATCH",
    path: "/api/v1/ledger_records/{id}",
    operationId: "patchLedgerRecordsById",
  },
  {
    method: "GET",
    path: "/api/v1/members",
    operationId: "getMembers",
  },
  {
    method: "PATCH",
    path: "/api/v1/members/{id}",
    operationId: "patchMembersById",
  },
  {
    method: "DELETE",
    path: "/api/v1/members/{id}",
    operationId: "deleteMembersById",
  },
  {
    method: "POST",
    path: "/api/v1/memories",
    operationId: "postMemories",
  },
  {
    method: "GET",
    path: "/api/v1/messages",
    operationId: "getMessages",
  },
  {
    method: "PATCH",
    path: "/api/v1/messages/{id}",
    operationId: "patchMessagesById",
  },
  {
    method: "DELETE",
    path: "/api/v1/messages/{id}",
    operationId: "deleteMessagesById",
  },
  {
    method: "POST",
    path: "/api/v1/notices",
    operationId: "postNotices",
  },
  {
    method: "PATCH",
    path: "/api/v1/notices/{id}",
    operationId: "patchNoticesById",
  },
  {
    method: "GET",
    path: "/api/v1/plans",
    operationId: "getPlans",
  },
  {
    method: "POST",
    path: "/api/v1/plans",
    operationId: "postPlans",
  },
  {
    method: "PATCH",
    path: "/api/v1/plans/{id}",
    operationId: "patchPlansById",
  },
  {
    method: "DELETE",
    path: "/api/v1/plans/{id}",
    operationId: "deletePlansById",
  },
  {
    method: "PATCH",
    path: "/api/v1/policies/{id}",
    operationId: "patchPoliciesById",
  },
  {
    method: "POST",
    path: "/api/v1/service_registry",
    operationId: "postServiceRegistry",
  },
  {
    method: "PATCH",
    path: "/api/v1/service_registry/{id}",
    operationId: "patchServiceRegistryById",
  },
  {
    method: "GET",
    path: "/api/v1/sessions",
    operationId: "getSessions",
  },
  {
    method: "POST",
    path: "/api/v1/sessions",
    operationId: "postSessions",
  },
  {
    method: "POST",
    path: "/api/v1/skills",
    operationId: "postSkills",
  },
  {
    method: "GET",
    path: "/api/v1/tasks",
    operationId: "getTasks",
  },
  {
    method: "POST",
    path: "/api/v1/tasks",
    operationId: "postTasks",
  },
  {
    method: "PATCH",
    path: "/api/v1/tasks/{id}",
    operationId: "patchTasksById",
  },
  {
    method: "GET",
    path: "/api/v1/tenants",
    operationId: "getTenants",
  },
  {
    method: "PATCH",
    path: "/api/v1/tenants/{id}",
    operationId: "patchTenantsById",
  },
] as const;
export const OPENAPI_HASH = "524c29fc35499719";

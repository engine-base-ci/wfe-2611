// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:524c29fc35499719
export type ApiResponse<T> = { data: T; meta?: { cursor?: string; limit?: number; total?: number } };
export type ApiError = {
  error: string;
  code?: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
  retry_after_sec?: number;
};

export type Tenants = {
  name?: string;
  plan_id?: string;
  status_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TenantsInput = { name?: string; plan_id?: string; status_id?: string };
export type Scopes = {
  parent_id?: string;
  layer_id?: string;
  name?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ScopesInput = { parent_id?: string; layer_id?: string; name?: string };
export type MemberKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MemberKindsInput = { key?: string; label?: string };
export type Members = {
  kind_id?: string;
  display_name?: string;
  role_id?: string;
  manager_member_id?: string;
  auth_user_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MembersInput = {
  kind_id?: string;
  display_name?: string;
  role_id?: string;
  manager_member_id?: string;
  auth_user_id?: string;
};
export type Clones = {
  owner_member_id?: string;
  persona?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ClonesInput = { owner_member_id?: string; persona?: string };
export type AiEmployees = {
  member_id?: string;
  provisioning_id?: string;
  template_ref?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AiEmployeesInput = { member_id?: string; provisioning_id?: string; template_ref?: string };
export type GoalKinds = {
  key?: string;
  label?: string;
  progress_strategy?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type GoalKindsInput = { key?: string; label?: string; progress_strategy?: string };
export type Units = {
  key?: string;
  label?: string;
  symbol?: string;
  value_type_id?: string;
  decimals?: number;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type UnitsInput = { key?: string; label?: string; symbol?: string; value_type_id?: string; decimals?: number };
export type RollupKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type RollupKindsInput = { key?: string; label?: string };
export type Goals = {
  ended_at?: string;
  parent_id?: string;
  rollup_kind_id?: string;
  rollup_spec?: Record<string, unknown>;
  kind_id?: string;
  period_start?: string;
  period_end?: string;
  target_value?: number;
  unit_id?: string;
  origin_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type GoalsInput = {
  ended_at?: string;
  parent_id?: string;
  rollup_kind_id?: string;
  rollup_spec?: Record<string, unknown>;
  kind_id?: string;
  period_start?: string;
  period_end?: string;
  target_value?: number;
  unit_id?: string;
  origin_id?: string;
};
export type GoalAllocations = {
  goal_id?: string;
  assignee_member_id?: string;
  allocated_value?: number;
  agreement_status_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type GoalAllocationsInput = {
  goal_id?: string;
  assignee_member_id?: string;
  allocated_value?: number;
  agreement_status_id?: string;
};
export type GoalContributions = {
  child_goal_id?: string;
  parent_goal_id?: string;
  hypothesis_id?: string;
  verdict_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type GoalContributionsInput = {
  child_goal_id?: string;
  parent_goal_id?: string;
  hypothesis_id?: string;
  verdict_id?: string;
};
export type GoalVersions = {
  goal_id?: string;
  version?: string;
  snapshot?: Record<string, unknown>;
  changed_at?: string;
  changed_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type GoalVersionsInput = {
  goal_id?: string;
  snapshot?: Record<string, unknown>;
  changed_at?: string;
  changed_by?: string;
};
export type Hypotheses = {
  goal_id?: string;
  statement?: string;
  evidence?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type HypothesesInput = { goal_id?: string; statement?: string; evidence?: string };
export type Measures = {
  hypothesis_id?: string;
  statement?: string;
  expected_effect?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MeasuresInput = { hypothesis_id?: string; statement?: string; expected_effect?: string };
export type Validations = {
  measure_id?: string;
  measured_value?: number;
  verdict_id?: string;
  measured_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ValidationsInput = {
  measure_id?: string;
  measured_value?: number;
  verdict_id?: string;
  measured_at?: string;
};
export type LedgerDefinitions = {
  kind_id?: string;
  name?: string;
  json_schema?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LedgerDefinitionsInput = { kind_id?: string; name?: string; json_schema?: Record<string, unknown> };
export type LedgerFields = {
  definition_id?: string;
  key?: string;
  label?: string;
  data_type_id?: string;
  required?: boolean;
  options_master_id?: string;
  order_no?: number;
  is_filterable?: boolean;
  is_sortable?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LedgerFieldsInput = {
  definition_id?: string;
  key?: string;
  label?: string;
  data_type_id?: string;
  required?: boolean;
  options_master_id?: string;
  order_no?: number;
  is_filterable?: boolean;
  is_sortable?: boolean;
};
export type LedgerStages = {
  definition_id?: string;
  key?: string;
  label?: string;
  order_no?: number;
  rules?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LedgerStagesInput = {
  definition_id?: string;
  key?: string;
  label?: string;
  order_no?: number;
  rules?: Record<string, unknown>;
};
export type LedgerViews = {
  definition_id?: string;
  kind_id?: string;
  filters?: Record<string, unknown>;
  sorts?: Record<string, unknown>;
  columns?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LedgerViewsInput = {
  definition_id?: string;
  kind_id?: string;
  filters?: Record<string, unknown>;
  sorts?: Record<string, unknown>;
  columns?: Record<string, unknown>;
};
export type LedgerRecords = {
  definition_id?: string;
  stage_id?: string;
  amount?: number;
  occurred_on?: string;
  assignee_id?: string;
  goal_id?: string;
  measure_id?: string;
  data?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LedgerRecordsInput = {
  definition_id?: string;
  stage_id?: string;
  amount?: number;
  occurred_on?: string;
  assignee_id?: string;
  goal_id?: string;
  measure_id?: string;
  data?: Record<string, unknown>;
};
export type Duties = {
  ai_employee_id?: string;
  name?: string;
  definition_md?: string;
  constraints?: Record<string, unknown>;
  visibility_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DutiesInput = {
  ai_employee_id?: string;
  name?: string;
  definition_md?: string;
  constraints?: Record<string, unknown>;
  visibility_id?: string;
};
export type DutyVersions = {
  duty_id?: string;
  version?: string;
  snapshot?: Record<string, unknown>;
  changed_by?: string;
  change_reason?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DutyVersionsInput = {
  duty_id?: string;
  snapshot?: Record<string, unknown>;
  changed_by?: string;
  change_reason?: string;
};
export type LearnedProcedures = {
  duty_id?: string;
  target_service_id?: string;
  status_id?: string;
  run_count?: number;
  avg_ms?: number;
  fail_count?: number;
  last_verified_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LearnedProceduresInput = {
  duty_id?: string;
  target_service_id?: string;
  status_id?: string;
  run_count?: number;
  avg_ms?: number;
  fail_count?: number;
  last_verified_at?: string;
};
export type ProcedureSteps = {
  procedure_id?: string;
  order_no?: number;
  intent_ja?: string;
  locator?: Record<string, unknown>;
  is_variable?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ProcedureStepsInput = {
  procedure_id?: string;
  order_no?: number;
  intent_ja?: string;
  is_variable?: boolean;
};
export type MemoryKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MemoryKindsInput = { key?: string; label?: string };
export type Memories = {
  kind_id?: string;
  owner_member_id?: string;
  title?: string;
  body?: string;
  confidence?: number;
  source_type_id?: string;
  source_ref_id?: string;
  embedding?: string;
  approved_by?: string;
  approved_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MemoriesInput = {
  kind_id?: string;
  owner_member_id?: string;
  title?: string;
  body?: string;
  confidence?: number;
  source_type_id?: string;
  source_ref_id?: string;
  approved_by?: string;
  approved_at?: string;
};
export type Tasks = {
  goal_id?: string;
  measure_id?: string;
  assignee_member_id?: string;
  status_id?: string;
  due_on?: string;
  title?: string;
  origin_id?: string;
  goal_changed_at?: string;
  next_action?: string;
  estimate_minutes?: number;
  actual_minutes?: number;
  planned_for?: string;
  blocked_reason_id?: string;
  blocked_since?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TasksInput = {
  goal_id?: string;
  measure_id?: string;
  assignee_member_id?: string;
  status_id?: string;
  due_on?: string;
  title?: string;
  origin_id?: string;
  goal_changed_at?: string;
  next_action?: string;
  estimate_minutes?: number;
  actual_minutes?: number;
  planned_for?: string;
  blocked_reason_id?: string;
  blocked_since?: string;
};
export type TaskHandovers = {
  task_id?: string;
  from_member_id?: string;
  to_member_id?: string;
  mode_id?: string;
  agreement_status_id?: string;
  reason?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TaskHandoversInput = {
  task_id?: string;
  from_member_id?: string;
  to_member_id?: string;
  mode_id?: string;
  agreement_status_id?: string;
  reason?: string;
};
export type DailyPlans = {
  member_id?: string;
  plan_date?: string;
  capacity_minutes?: number;
  committed_at?: string;
  closed_at?: string;
  carry_over?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DailyPlansInput = {
  member_id?: string;
  plan_date?: string;
  capacity_minutes?: number;
  committed_at?: string;
  closed_at?: string;
  carry_over?: Record<string, unknown>;
};
export type Triggers = {
  kind_id?: string;
  cron_expr?: string;
  timezone?: string;
  on_missed_id?: string;
  ttl_minutes?: string;
  enabled?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TriggersInput = {
  kind_id?: string;
  cron_expr?: string;
  timezone?: string;
  on_missed_id?: string;
  ttl_minutes?: string;
  enabled?: boolean;
};
export type Policies = {
  subject_kind_id?: string;
  action_kind_id?: string;
  mode_id?: string;
  params?: Record<string, unknown>;
  is_locked?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PoliciesInput = {
  subject_kind_id?: string;
  action_kind_id?: string;
  mode_id?: string;
  params?: Record<string, unknown>;
  is_locked?: boolean;
};
export type Approvals = {
  action_run_id?: string;
  requested_by?: string;
  approver_member_id?: string;
  status_id?: string;
  resolved_at?: string;
  note?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ApprovalsInput = {
  action_run_id?: string;
  requested_by?: string;
  approver_member_id?: string;
  status_id?: string;
  resolved_at?: string;
  note?: string;
};
export type ActionRuns = {
  task_id?: string;
  action_kind_id?: string;
  choke_point_id?: string;
  service_id?: string;
  procedure_id?: string;
  status_id?: string;
  started_at?: string;
  finished_at?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
  error_summary?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ActionRunsInput = {
  task_id?: string;
  action_kind_id?: string;
  choke_point_id?: string;
  service_id?: string;
  procedure_id?: string;
  status_id?: string;
  started_at?: string;
  finished_at?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
  error_summary?: string;
};
export type ServiceRegistry = {
  name?: string;
  domain?: string;
  automation_verdict_id?: string;
  notes?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ServiceRegistryInput = { name?: string; domain?: string; automation_verdict_id?: string; notes?: string };
export type CredentialKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type CredentialKindsInput = { key?: string; label?: string };
export type Credentials = {
  service_id?: string;
  kind_id?: string;
  vault_ref?: string;
  owner_member_id?: string;
  revoked_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type CredentialsInput = { service_id?: string; kind_id?: string; owner_member_id?: string; revoked_at?: string };
export type Conversations = {
  title?: string;
  participant_member_ids?: string[];
  area?: string;
  subject_type?: string;
  parent_conversation_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ConversationsInput = {
  title?: string;
  participant_member_ids?: string[];
  area?: string;
  subject_type?: string;
  parent_conversation_id?: string;
};
export type Messages = {
  conversation_id?: string;
  sender_member_id?: string;
  body?: string;
  attachments?: Record<string, unknown>;
  action_run_id?: string;
  kind?: string;
  options?: Record<string, unknown>;
  confidence?: number;
  citations?: Record<string, unknown>;
  parent_message_id?: string;
  undo_action_run_id?: string;
  read_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type MessagesInput = {
  conversation_id?: string;
  sender_member_id?: string;
  body?: string;
  attachments?: Record<string, unknown>;
  action_run_id?: string;
  kind?: string;
  options?: Record<string, unknown>;
  confidence?: number;
  citations?: Record<string, unknown>;
  parent_message_id?: string;
  undo_action_run_id?: string;
  read_at?: string;
};
export type Artifacts = {
  task_id?: string;
  format_id?: string;
  storage_ref?: string;
  template_id?: string;
  approved_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ArtifactsInput = { task_id?: string; format_id?: string; template_id?: string; approved_by?: string };
export type AuditEvents = {
  actor_member_id?: string;
  actor_role?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  choke_point_id?: string;
  payload?: Record<string, unknown>;
  occurred_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AuditEventsInput = {
  actor_member_id?: string;
  actor_role?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  choke_point_id?: string;
  payload?: Record<string, unknown>;
  occurred_at?: string;
};
export type SessionKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SessionKindsInput = { key?: string; label?: string };
export type RevokeReasons = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type RevokeReasonsInput = { key?: string; label?: string };
export type Layers = {
  key?: string;
  label?: string;
  order_no?: number;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type LayersInput = { key?: string; label?: string; order_no?: number };
export type TargetKinds = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TargetKindsInput = { key?: string; label?: string };
export type Abilities = {
  key?: string;
  label?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AbilitiesInput = { key?: string; label?: string };
export type Permissions = {
  grantee_member_id?: string;
  target_kind_id?: string;
  scope_id?: string;
  ability_id?: string;
  granted_by?: string;
  revoked_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PermissionsInput = {
  grantee_member_id?: string;
  target_kind_id?: string;
  ability_id?: string;
  granted_by?: string;
  revoked_at?: string;
};
export type AccountEvents = {
  kind_id?: string;
  subject_type?: string;
  subject_id?: string;
  requested_by?: string;
  status_id?: string;
  resolved_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AccountEventsInput = {
  kind_id?: string;
  subject_type?: string;
  subject_id?: string;
  requested_by?: string;
  status_id?: string;
  resolved_at?: string;
};
export type AccountEventItems = {
  event_id?: string;
  object_kind?: string;
  disposition_id?: string;
  target_ref?: string;
  decided_by?: string;
  done_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AccountEventItemsInput = {
  event_id?: string;
  object_kind?: string;
  disposition_id?: string;
  target_ref?: string;
  decided_by?: string;
  done_at?: string;
};
export type Sessions = {
  member_id?: string;
  kind_id?: string;
  auth_session_id?: string;
  device_label?: string;
  ip_region?: string;
  issued_at?: string;
  last_seen_at?: string;
  revoked_at?: string;
  revoke_reason_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SessionsInput = {
  member_id?: string;
  kind_id?: string;
  auth_session_id?: string;
  device_label?: string;
  ip_region?: string;
  issued_at?: string;
  last_seen_at?: string;
  revoked_at?: string;
  revoke_reason_id?: string;
};
export type SupportAccessGrants = {
  granted_by_member_id?: string;
  scope?: Record<string, unknown>;
  expires_at?: string;
  revoked_at?: string;
  ops_member_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SupportAccessGrantsInput = {
  granted_by_member_id?: string;
  scope?: Record<string, unknown>;
  expires_at?: string;
  revoked_at?: string;
  ops_member_id?: string;
};
export type RetentionHolds = {
  record_type?: string;
  record_ref?: string;
  retain_until?: string;
  legal_basis?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type RetentionHoldsInput = {
  record_type?: string;
  record_ref?: string;
  retain_until?: string;
  legal_basis?: string;
};
export type ErasureCertificates = {
  issued_at?: string;
  content_hash?: string;
  sent_to?: string;
  storage_ref?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ErasureCertificatesInput = { issued_at?: string; sent_to?: string };
export type Distributions = {
  kind_id?: string;
  key?: string;
  name?: string;
  current_version?: number;
  plan_ids?: string[];
  is_locked?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DistributionsInput = {
  kind_id?: string;
  key?: string;
  name?: string;
  current_version?: number;
  plan_ids?: string[];
  is_locked?: boolean;
};
export type DistributionVersions = {
  distribution_id?: string;
  version?: string;
  snapshot?: Record<string, unknown>;
  released_at?: string;
  released_by?: string;
  change_reason?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type DistributionVersionsInput = {
  distribution_id?: string;
  snapshot?: Record<string, unknown>;
  released_at?: string;
  released_by?: string;
  change_reason?: string;
};
export type TenantDistributions = {
  distribution_id?: string;
  version_in_use?: number;
  enabled?: boolean;
  override?: Record<string, unknown>;
  disabled_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TenantDistributionsInput = {
  distribution_id?: string;
  version_in_use?: number;
  enabled?: boolean;
  override?: Record<string, unknown>;
  disabled_by?: string;
};
export type ServiceRegistryVersions = {
  service_id?: string;
  version?: string;
  automation_verdict_id?: string;
  reason?: string;
  released_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ServiceRegistryVersionsInput = {
  service_id?: string;
  automation_verdict_id?: string;
  reason?: string;
  released_at?: string;
};
export type ServiceRequests = {
  service_name?: string;
  url?: string;
  requested_by?: string;
  verdict_id?: string;
  decided_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ServiceRequestsInput = {
  service_name?: string;
  url?: string;
  requested_by?: string;
  verdict_id?: string;
  decided_at?: string;
};
export type ReviewRequests = {
  subject_type?: string;
  subject_id?: string;
  anonymization_check?: Record<string, unknown>;
  status_id?: string;
  reviewer_ops_member_id?: string;
  decided_at?: string;
  reason?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ReviewRequestsInput = {
  subject_type?: string;
  subject_id?: string;
  anonymization_check?: Record<string, unknown>;
  status_id?: string;
  reviewer_ops_member_id?: string;
  decided_at?: string;
  reason?: string;
};
export type OpsMembers = {
  member_id?: string;
  ops_role_id?: string;
  revoked_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type OpsMembersInput = { member_id?: string; ops_role_id?: string; revoked_at?: string };
export type OpsAuditEvents = {
  ops_member_id?: string;
  target_tenant_id?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  grant_id?: string;
  payload?: Record<string, unknown>;
  occurred_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type OpsAuditEventsInput = {
  ops_member_id?: string;
  target_tenant_id?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  grant_id?: string;
  payload?: Record<string, unknown>;
  occurred_at?: string;
};
export type SecurityEvents = {
  kind_id?: string;
  member_id?: string;
  ip_region?: string;
  detail?: Record<string, unknown>;
  occurred_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SecurityEventsInput = {
  kind_id?: string;
  member_id?: string;
  ip_region?: string;
  detail?: Record<string, unknown>;
  occurred_at?: string;
};
export type Inquiries = {
  opened_by_member_id?: string;
  kind_id?: string;
  status_id?: string;
  conversation_id?: string;
  assignee_ops_member_id?: string;
  ai_first_answered_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type InquiriesInput = {
  opened_by_member_id?: string;
  kind_id?: string;
  status_id?: string;
  conversation_id?: string;
  assignee_ops_member_id?: string;
  ai_first_answered_at?: string;
};
export type Notices = {
  kind_id?: string;
  title?: string;
  body?: string;
  target_plan_ids?: string[];
  target_tenant_id?: string;
  publish_at?: string;
  published_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type NoticesInput = {
  kind_id?: string;
  title?: string;
  body?: string;
  target_plan_ids?: string[];
  target_tenant_id?: string;
  publish_at?: string;
  published_by?: string;
};
export type NoticeDeliveries = {
  notice_id?: string;
  member_id?: string;
  delivered_at?: string;
  read_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type NoticeDeliveriesInput = { notice_id?: string; member_id?: string; delivered_at?: string; read_at?: string };
export type StatusIncidents = {
  component_id?: string;
  service_id?: string;
  state_id?: string;
  started_at?: string;
  resolved_at?: string;
  note?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type StatusIncidentsInput = {
  component_id?: string;
  service_id?: string;
  state_id?: string;
  started_at?: string;
  resolved_at?: string;
  note?: string;
};
export type NotificationPreferences = {
  member_id?: string;
  event_kind_id?: string;
  channel_id?: string;
  enabled?: boolean;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type NotificationPreferencesInput = {
  member_id?: string;
  event_kind_id?: string;
  channel_id?: string;
  enabled?: boolean;
};
export type Notifications = {
  member_id?: string;
  channel_id?: string;
  event_kind_id?: string;
  payload?: Record<string, unknown>;
  dedupe_key?: string;
  sent_at?: string;
  failed_at?: string;
  retry_count?: number;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type NotificationsInput = {
  member_id?: string;
  channel_id?: string;
  event_kind_id?: string;
  payload?: Record<string, unknown>;
  sent_at?: string;
  failed_at?: string;
  retry_count?: number;
};
export type Plans = {
  key?: string;
  name?: string;
  price_monthly?: number;
  limits?: Record<string, unknown>;
  current_version?: number;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PlansInput = {
  key?: string;
  name?: string;
  price_monthly?: number;
  limits?: Record<string, unknown>;
  current_version?: number;
};
export type PlanVersions = {
  plan_id?: string;
  version?: string;
  snapshot?: Record<string, unknown>;
  released_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PlanVersionsInput = { plan_id?: string; snapshot?: Record<string, unknown>; released_at?: string };
export type Subscriptions = {
  plan_id?: string;
  status_id?: string;
  started_at?: string;
  suspended_at?: string;
  ended_at?: string;
  billing_contact?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SubscriptionsInput = {
  plan_id?: string;
  status_id?: string;
  started_at?: string;
  suspended_at?: string;
  ended_at?: string;
  billing_contact?: Record<string, unknown>;
};
export type PlanChangeRequests = {
  from_plan_id?: string;
  to_plan_id?: string;
  requested_by?: string;
  status_id?: string;
  dependencies_event_id?: string;
  decided_by_ops_member_id?: string;
  decided_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PlanChangeRequestsInput = {
  from_plan_id?: string;
  to_plan_id?: string;
  requested_by?: string;
  status_id?: string;
  dependencies_event_id?: string;
  decided_by_ops_member_id?: string;
  decided_at?: string;
};
export type UsageMeters = {
  meter_key?: string;
  period_start?: string;
  value?: number;
  limit_value?: number;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type UsageMetersInput = { meter_key?: string; period_start?: string; value?: number; limit_value?: number };
export type Invoices = {
  subscription_id?: string;
  period_start?: string;
  period_end?: string;
  amount?: number;
  issued_at?: string;
  due_on?: string;
  status_id?: string;
  pdf_ref?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type InvoicesInput = {
  subscription_id?: string;
  period_start?: string;
  period_end?: string;
  amount?: number;
  issued_at?: string;
  due_on?: string;
  status_id?: string;
  pdf_ref?: string;
};
export type Payments = {
  invoice_id?: string;
  paid_on?: string;
  amount?: number;
  method_id?: string;
  recorded_by_ops_member_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type PaymentsInput = {
  invoice_id?: string;
  paid_on?: string;
  amount?: number;
  method_id?: string;
  recorded_by_ops_member_id?: string;
};
export type ErrorEvents = {
  error_code?: string;
  member_id?: string;
  screen_id?: string;
  context?: Record<string, unknown>;
  shown_at?: string;
  next_action_taken_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ErrorEventsInput = {
  error_code?: string;
  member_id?: string;
  screen_id?: string;
  context?: Record<string, unknown>;
  shown_at?: string;
  next_action_taken_at?: string;
};
export type Imports = {
  file_ref?: string;
  detected_kind_id?: string;
  proposal?: Record<string, unknown>;
  status_id?: string;
  applied_at?: string;
  applied_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ImportsInput = {
  file_ref?: string;
  detected_kind_id?: string;
  proposal?: Record<string, unknown>;
  status_id?: string;
  applied_at?: string;
  applied_by?: string;
};
export type Integrations = {
  service_id?: string;
  kind_id?: string;
  credential_id?: string;
  scopes?: string;
  status_id?: string;
  connected_at?: string;
  revoked_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type IntegrationsInput = {
  service_id?: string;
  kind_id?: string;
  credential_id?: string;
  scopes?: string;
  status_id?: string;
  connected_at?: string;
  revoked_at?: string;
};
export type Invitations = {
  email?: string;
  scope_id?: string;
  role_id?: string;
  permission_preset?: Record<string, unknown>;
  token_hash?: string;
  expires_at?: string;
  accepted_member_id?: string;
  revoked_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type InvitationsInput = {
  email?: string;
  role_id?: string;
  permission_preset?: Record<string, unknown>;
  expires_at?: string;
  accepted_member_id?: string;
  revoked_at?: string;
};
export type ExportJobs = {
  requested_by?: string;
  kind_id?: string;
  storage_ref?: string;
  status_id?: string;
  expires_at?: string;
  downloaded_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ExportJobsInput = {
  requested_by?: string;
  kind_id?: string;
  status_id?: string;
  expires_at?: string;
  downloaded_at?: string;
};
export type Attachments = {
  owner_type?: string;
  owner_id?: string;
  storage_ref?: string;
  mime?: string;
  size?: number;
  scanned_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type AttachmentsInput = {
  owner_type?: string;
  owner_id?: string;
  mime?: string;
  size?: number;
  scanned_at?: string;
};
export type Skills = {
  kind_id?: string;
  key?: string;
  name?: string;
  purpose?: string;
  current_version?: number;
  plan_ids?: string[];
  visibility_id?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SkillsInput = {
  kind_id?: string;
  key?: string;
  name?: string;
  purpose?: string;
  current_version?: number;
  plan_ids?: string[];
  visibility_id?: string;
};
export type SkillVersions = {
  skill_id?: string;
  version?: string;
  package_ref?: string;
  changelog?: string;
  tested_at?: string;
  test_result?: Record<string, unknown>;
  released_at?: string;
  released_by?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SkillVersionsInput = {
  skill_id?: string;
  changelog?: string;
  tested_at?: string;
  test_result?: Record<string, unknown>;
  released_at?: string;
  released_by?: string;
};
export type SkillTestRuns = {
  skill_version_id?: string;
  ops_member_id?: string;
  mode?: string;
  started_at?: string;
  finished_at?: string;
  result?: Record<string, unknown>;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SkillTestRunsInput = {
  skill_version_id?: string;
  ops_member_id?: string;
  mode?: string;
  started_at?: string;
  finished_at?: string;
  result?: Record<string, unknown>;
};
export type SkillAttachments = {
  skill_id?: string;
  version_in_use?: number;
  target_type?: string;
  target_id?: string;
  enabled?: boolean;
  disabled_by?: string;
  attached_at?: string;
  id: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SkillAttachmentsInput = {
  skill_id?: string;
  version_in_use?: number;
  target_type?: string;
  target_id?: string;
  enabled?: boolean;
  disabled_by?: string;
  attached_at?: string;
};

export const ENDPOINTS = [
  {
    id: "EP-001",
    method: "GET",
    path: "/api/v1/action_runs",
    acts: ["A11"],
    screens: ["onboard-testrun"],
  },
  {
    id: "EP-002",
    method: "GET",
    path: "/api/v1/ai_employees",
    acts: ["A37", "A46", "A53", "A59", "A79"],
    screens: ["ai-activity", "ai-staff", "ai-staff-detail", "ops-catalog"],
  },
  {
    id: "EP-003",
    method: "PATCH",
    path: "/api/v1/ai_employees/:id",
    acts: ["A81"],
    screens: ["ai-staff-detail"],
  },
  {
    id: "EP-004",
    method: "GET",
    path: "/api/v1/approvals",
    acts: ["A16"],
    screens: ["clone-thread"],
  },
  {
    id: "EP-005",
    method: "PATCH",
    path: "/api/v1/approvals/:id",
    acts: ["A15"],
    screens: ["approvals"],
  },
  {
    id: "EP-006",
    method: "POST",
    path: "/api/v1/attachments",
    acts: ["A76"],
    screens: ["import"],
  },
  {
    id: "EP-007",
    method: "GET",
    path: "/api/v1/audit_events",
    acts: ["A33", "A38", "A73"],
    screens: ["audit", "ops-audit"],
  },
  {
    id: "EP-008",
    method: "POST",
    path: "/api/v1/audit_events",
    acts: ["A40"],
    screens: ["audit"],
  },
  {
    id: "EP-009",
    method: "PATCH",
    path: "/api/v1/audit_events/:id",
    acts: ["A65"],
    screens: ["ops-audit"],
  },
  {
    id: "EP-010",
    method: "DELETE",
    path: "/api/v1/audit_events/:id",
    acts: ["A34", "A66"],
    screens: ["audit"],
  },
  {
    id: "EP-011",
    method: "POST",
    path: "/api/v1/clones",
    acts: ["A06"],
    screens: ["onboard-interview"],
  },
  {
    id: "EP-012",
    method: "GET",
    path: "/api/v1/conversations",
    acts: ["A20"],
    screens: ["clone-chat"],
  },
  {
    id: "EP-013",
    method: "POST",
    path: "/api/v1/credentials",
    acts: ["A10"],
    screens: ["credentials"],
  },
  {
    id: "EP-014",
    method: "POST",
    path: "/api/v1/distributions",
    acts: ["A63"],
    screens: ["ops-review"],
  },
  {
    id: "EP-015",
    method: "PATCH",
    path: "/api/v1/duties/:id",
    acts: ["A28"],
    screens: ["duties"],
  },
  {
    id: "EP-016",
    method: "POST",
    path: "/api/v1/export_jobs",
    acts: ["A41"],
    screens: ["export"],
  },
  {
    id: "EP-017",
    method: "GET",
    path: "/api/v1/goal_allocations",
    acts: ["A25"],
    screens: ["my-progress"],
  },
  {
    id: "EP-018",
    method: "PATCH",
    path: "/api/v1/goal_allocations/:id",
    acts: ["A23", "A49"],
    screens: ["goal-allocation", "my-progress"],
  },
  {
    id: "EP-019",
    method: "GET",
    path: "/api/v1/goals",
    acts: ["A22", "A52", "A54"],
    screens: ["goal-edit", "goals"],
  },
  {
    id: "EP-020",
    method: "PATCH",
    path: "/api/v1/goals/:id",
    acts: ["A29"],
    screens: ["goal-edit"],
  },
  {
    id: "EP-021",
    method: "GET",
    path: "/api/v1/hypotheses",
    acts: ["A26"],
    screens: ["review"],
  },
  {
    id: "EP-022",
    method: "PATCH",
    path: "/api/v1/hypotheses/:id",
    acts: ["A27"],
    screens: ["hypotheses"],
  },
  {
    id: "EP-023",
    method: "GET",
    path: "/api/v1/inquiries",
    acts: ["A67"],
    screens: ["inquiry"],
  },
  {
    id: "EP-024",
    method: "POST",
    path: "/api/v1/inquiries",
    acts: ["A70"],
    screens: ["ops-support"],
  },
  {
    id: "EP-025",
    method: "PATCH",
    path: "/api/v1/inquiries/:id",
    acts: ["A43"],
    screens: ["ops-support"],
  },
  {
    id: "EP-026",
    method: "GET",
    path: "/api/v1/invitations",
    acts: ["A03"],
    screens: ["invite-accept"],
  },
  {
    id: "EP-027",
    method: "GET",
    path: "/api/v1/invoices",
    acts: ["A72"],
    screens: ["ops-billing"],
  },
  {
    id: "EP-028",
    method: "GET",
    path: "/api/v1/learned_procedures",
    acts: ["A32"],
    screens: ["automation-repair"],
  },
  {
    id: "EP-029",
    method: "GET",
    path: "/api/v1/ledger_definitions",
    acts: ["A21", "A47"],
    screens: ["records", "search"],
  },
  {
    id: "EP-030",
    method: "PATCH",
    path: "/api/v1/ledger_definitions/:id",
    acts: ["A24", "A44"],
    screens: ["ledger-def", "records"],
  },
  {
    id: "EP-031",
    method: "GET",
    path: "/api/v1/ledger_records",
    acts: ["A18"],
    screens: ["record-detail"],
  },
  {
    id: "EP-032",
    method: "PATCH",
    path: "/api/v1/ledger_records/:id",
    acts: ["A19"],
    screens: ["record-detail"],
  },
  {
    id: "EP-033",
    method: "GET",
    path: "/api/v1/members",
    acts: ["A02", "A04", "A13"],
    screens: ["login", "mfa-setup", "verify-email"],
  },
  {
    id: "EP-034",
    method: "PATCH",
    path: "/api/v1/members/:id",
    acts: ["A31", "A36", "A61", "A74"],
    screens: ["account", "member-detail", "members", "password-reset"],
  },
  {
    id: "EP-035",
    method: "DELETE",
    path: "/api/v1/members/:id",
    acts: ["A42", "A62"],
    screens: ["account-close", "member-detail"],
  },
  {
    id: "EP-036",
    method: "POST",
    path: "/api/v1/memories",
    acts: ["A30"],
    screens: ["clone-memory"],
  },
  {
    id: "EP-037",
    method: "GET",
    path: "/api/v1/messages",
    acts: ["A14"],
    screens: ["today"],
  },
  {
    id: "EP-038",
    method: "PATCH",
    path: "/api/v1/messages/:id",
    acts: ["A55"],
    screens: ["today"],
  },
  {
    id: "EP-039",
    method: "DELETE",
    path: "/api/v1/messages/:id",
    acts: ["A56"],
    screens: ["today"],
  },
  {
    id: "EP-040",
    method: "POST",
    path: "/api/v1/notices",
    acts: ["A71"],
    screens: ["ops-notices"],
  },
  {
    id: "EP-041",
    method: "PATCH",
    path: "/api/v1/notices/:id",
    acts: ["A68"],
    screens: ["notices"],
  },
  {
    id: "EP-042",
    method: "GET",
    path: "/api/v1/plans",
    acts: ["A60"],
    screens: ["ops-home"],
  },
  {
    id: "EP-043",
    method: "POST",
    path: "/api/v1/plans",
    acts: ["A01", "A05"],
    screens: ["billing-setup", "signup"],
  },
  {
    id: "EP-044",
    method: "PATCH",
    path: "/api/v1/plans/:id",
    acts: ["A69"],
    screens: ["billing"],
  },
  {
    id: "EP-045",
    method: "DELETE",
    path: "/api/v1/plans/:id",
    acts: ["A64"],
    screens: ["ops-tenant"],
  },
  {
    id: "EP-046",
    method: "PATCH",
    path: "/api/v1/policies/:id",
    acts: ["A35"],
    screens: ["policies"],
  },
  {
    id: "EP-047",
    method: "POST",
    path: "/api/v1/service_registry",
    acts: ["A77"],
    screens: ["services"],
  },
  {
    id: "EP-048",
    method: "PATCH",
    path: "/api/v1/service_registry/:id",
    acts: ["A78"],
    screens: ["ops-services"],
  },
  {
    id: "EP-049",
    method: "GET",
    path: "/api/v1/sessions",
    acts: ["A39"],
    screens: ["security-brief"],
  },
  {
    id: "EP-050",
    method: "POST",
    path: "/api/v1/sessions",
    acts: ["A09"],
    screens: ["bridge-setup"],
  },
  {
    id: "EP-051",
    method: "POST",
    path: "/api/v1/skills",
    acts: ["A80"],
    screens: ["ops-skills"],
  },
  {
    id: "EP-052",
    method: "GET",
    path: "/api/v1/tasks",
    acts: ["A48", "A58"],
    screens: ["tasks"],
  },
  {
    id: "EP-053",
    method: "POST",
    path: "/api/v1/tasks",
    acts: ["A50", "A57"],
    screens: ["tasks"],
  },
  {
    id: "EP-054",
    method: "PATCH",
    path: "/api/v1/tasks/:id",
    acts: ["A17", "A51"],
    screens: ["tasks"],
  },
  {
    id: "EP-055",
    method: "GET",
    path: "/api/v1/tenants",
    acts: ["A07", "A08", "A12", "A45"],
    screens: ["company-model", "onboard-draft", "onboard-golive"],
  },
  {
    id: "EP-056",
    method: "PATCH",
    path: "/api/v1/tenants/:id",
    acts: ["A75"],
    screens: ["company-settings"],
  },
] as const;

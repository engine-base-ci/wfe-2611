// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml components）。手で直さない。openapi:f1ef89151444fbfc
import { z } from "zod";

export const Tenants = z.strictObject({
  name: z.string().optional(),
  plan_id: z.uuid().nullable().optional(),
  status_id: z.uuid().nullable().optional(),
  live_at: z.iso.datetime({ offset: true }).nullable().optional(),
  live_by: z.uuid().nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  stopped_at: z.iso.datetime({ offset: true }).nullable().optional(),
  stop_on: z.iso.date().nullable().optional(),
  stop_reason_key: z.string().nullable().optional(),
  stop_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_visibility_default: z.string().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deletion_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  half_made_at: z.iso.datetime({ offset: true }).nullable().optional(),
  logo_ref: z.string().nullable().optional(),
  request_routing: z.string().nullable().optional(),
  session_idle_hours: z.number().int().optional(),
  session_max_days: z.number().int().optional(),
  stop_notice: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  who_billing: z.string().optional(),
  who_delete_workspace: z.string().optional(),
});
export const TenantsInput = z.strictObject({
  name: z.string().optional(),
  plan_id: z.uuid().nullable().optional(),
  status_id: z.uuid().nullable().optional(),
  live_at: z.iso.datetime({ offset: true }).nullable().optional(),
  live_by: z.uuid().nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  stopped_at: z.iso.datetime({ offset: true }).nullable().optional(),
  stop_on: z.iso.date().nullable().optional(),
  stop_reason_key: z.string().nullable().optional(),
  stop_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Scopes = z.strictObject({
  parent_id: z.uuid().nullable().optional(),
  layer_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  next_ticket_no: z.number().int().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ScopesInput = z.strictObject({
  parent_id: z.uuid().nullable().optional(),
  layer_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  next_ticket_no: z.number().int().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
});
export const MemberKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const MemberKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Members = z.strictObject({
  kind_id: z.string().optional(),
  display_name: z.string().optional(),
  role_id: z.string().nullable().optional(),
  manager_member_id: z.uuid().nullable().optional(),
  auth_user_id: z.string().nullable().optional(),
  setup_step: z.number().int().optional(),
  agent_permission_mode: z.string().optional(),
  agent_model: z.string().nullable().optional(),
  agent_effort: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  avatar_ref: z.string().nullable().optional(),
  call_name: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  language: z.string().optional(),
  scope_id: z.uuid().optional(),
  setup_dismissed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  setup_skipped_keys: z.array(z.string()).optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_by: z.uuid().nullable().optional(),
  theme: z.string().optional(),
  timezone: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
  week_start: z.number().int().optional(),
});
export const MembersInput = z.strictObject({
  kind_id: z.string().optional(),
  display_name: z.string().optional(),
  role_id: z.string().nullable().optional(),
  manager_member_id: z.uuid().nullable().optional(),
  auth_user_id: z.string().nullable().optional(),
  setup_step: z.number().int().optional(),
  agent_permission_mode: z.string().optional(),
  agent_model: z.string().nullable().optional(),
  agent_effort: z.string().nullable().optional(),
});
export const SetupSteps = z.strictObject({
  n: z.number().int().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SetupStepsInput = z.strictObject({
  n: z.number().int().optional(),
  label: z.string().optional(),
});
export const Clones = z.strictObject({
  owner_member_id: z.uuid().nullable().optional(),
  persona: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  auto_memory: z.boolean().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClonesInput = z.strictObject({
  owner_member_id: z.uuid().nullable().optional(),
  persona: z.string().nullable().optional(),
});
export const AiEmployees = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  provisioning_id: z.uuid().nullable().optional(),
  template_ref: z.string().nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AiEmployeesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  provisioning_id: z.uuid().nullable().optional(),
  template_ref: z.string().nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_reason: z.string().nullable().optional(),
});
export const GoalKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  progress_strategy: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const GoalKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  progress_strategy: z.string().nullable().optional(),
});
export const Units = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  symbol: z.string().nullable().optional(),
  value_type_id: z.string().nullable().optional(),
  decimals: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const UnitsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  symbol: z.string().nullable().optional(),
  value_type_id: z.string().nullable().optional(),
  decimals: z.number().int().nullable().optional(),
});
export const RollupKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RollupKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Goals = z.strictObject({
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  rollup_kind_id: z.string().nullable().optional(),
  rollup_spec: z.unknown().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  target_value: z.string().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const GoalsInput = z.strictObject({
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  rollup_kind_id: z.string().nullable().optional(),
  rollup_spec: z.unknown().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  target_value: z.string().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
});
export const GoalAllocations = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  allocated_value: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalAllocationsInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  allocated_value: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
});
export const GoalContributions = z.strictObject({
  child_goal_id: z.uuid().nullable().optional(),
  parent_goal_id: z.uuid().nullable().optional(),
  hypothesis_id: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalContributionsInput = z.strictObject({
  child_goal_id: z.uuid().nullable().optional(),
  parent_goal_id: z.uuid().nullable().optional(),
  hypothesis_id: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
});
export const GoalVersions = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  name: z.string().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GoalVersionsInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
});
export const Hypotheses = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const HypothesesInput = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
});
export const Measures = z.strictObject({
  hypothesis_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  expected_effect: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MeasuresInput = z.strictObject({
  hypothesis_id: z.uuid().nullable().optional(),
  statement: z.string().nullable().optional(),
  expected_effect: z.string().nullable().optional(),
});
export const Validations = z.strictObject({
  measure_id: z.uuid().nullable().optional(),
  measured_value: z.string().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  measured_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ValidationsInput = z.strictObject({
  measure_id: z.uuid().nullable().optional(),
  measured_value: z.string().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  measured_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LedgerDefinitions = z.strictObject({
  kind_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  json_schema: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const LedgerDefinitionsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  json_schema: z.unknown().nullable().optional(),
});
export const LedgerFields = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  data_type_id: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  options_master_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  is_filterable: z.boolean().nullable().optional(),
  is_sortable: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerFieldsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  data_type_id: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  options_master_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  is_filterable: z.boolean().nullable().optional(),
  is_sortable: z.boolean().nullable().optional(),
});
export const LedgerStages = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().nullable().optional(),
  rules: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerStagesInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().nullable().optional(),
  rules: z.unknown().nullable().optional(),
});
export const LedgerViews = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  filters: z.unknown().nullable().optional(),
  sorts: z.unknown().nullable().optional(),
  columns: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerViewsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  filters: z.unknown().nullable().optional(),
  sorts: z.unknown().nullable().optional(),
  columns: z.unknown().nullable().optional(),
});
export const LedgerRecords = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  stage_id: z.uuid().nullable().optional(),
  amount: z.string().nullable().optional(),
  occurred_on: z.iso.date().nullable().optional(),
  assignee_id: z.uuid().nullable().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  data: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LedgerRecordsInput = z.strictObject({
  definition_id: z.uuid().nullable().optional(),
  stage_id: z.uuid().nullable().optional(),
  amount: z.string().nullable().optional(),
  occurred_on: z.iso.date().nullable().optional(),
  assignee_id: z.uuid().nullable().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  data: z.unknown().nullable().optional(),
});
export const Duties = z.strictObject({
  ai_employee_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  definition_md: z.string().nullable().optional(),
  constraints: z.unknown().nullable().optional(),
  visibility_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
});
export const DutiesInput = z.strictObject({
  ai_employee_id: z.uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  definition_md: z.string().nullable().optional(),
  constraints: z.unknown().nullable().optional(),
  visibility_id: z.string().nullable().optional(),
});
export const DutyVersions = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DutyVersionsInput = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  changed_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
});
export const LearnedProcedures = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  target_service_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  run_count: z.number().int().nullable().optional(),
  avg_ms: z.number().int().nullable().optional(),
  fail_count: z.number().int().nullable().optional(),
  last_verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LearnedProceduresInput = z.strictObject({
  duty_id: z.uuid().nullable().optional(),
  target_service_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  run_count: z.number().int().nullable().optional(),
  avg_ms: z.number().int().nullable().optional(),
  fail_count: z.number().int().nullable().optional(),
  last_verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ProcedureSteps = z.strictObject({
  procedure_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  intent_ja: z.string().nullable().optional(),
  locator: z.unknown().nullable().optional(),
  is_variable: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ProcedureStepsInput = z.strictObject({
  procedure_id: z.uuid().nullable().optional(),
  order_no: z.number().int().nullable().optional(),
  intent_ja: z.string().nullable().optional(),
  is_variable: z.boolean().nullable().optional(),
});
export const MemoryKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const MemoryKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Memories = z.strictObject({
  kind_id: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  source_type_id: z.string().nullable().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  approved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  digest_id: z.uuid().nullable().optional(),
  superseded_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  auto: z.boolean().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  embedding: z.array(z.unknown()).nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
  visibility: z.string().optional(),
});
export const MemoriesInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  source_type_id: z.string().nullable().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  approved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  digest_id: z.uuid().nullable().optional(),
  superseded_by: z.uuid().nullable().optional(),
});
export const MemoryDigests = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  from_on: z.iso.date().nullable().optional(),
  to_on: z.iso.date().nullable().optional(),
  conversation_count: z.number().int().nullable().optional(),
  state_id: z.string().nullable().optional(),
  result: z.unknown().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MemoryDigestsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  from_on: z.iso.date().nullable().optional(),
  to_on: z.iso.date().nullable().optional(),
  conversation_count: z.number().int().nullable().optional(),
  state_id: z.string().nullable().optional(),
  result: z.unknown().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const MemoryProposals = z.strictObject({
  memory_id: z.uuid().nullable().optional(),
  target_scope_id: z.uuid().nullable().optional(),
  proposer_member_id: z.uuid().nullable().optional(),
  reviewer_member_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  conflict_group_id: z.uuid().nullable().optional(),
  evidence: z.unknown().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const MemoryProposalsInput = z.strictObject({
  memory_id: z.uuid().nullable().optional(),
  target_scope_id: z.uuid().nullable().optional(),
  proposer_member_id: z.uuid().nullable().optional(),
  reviewer_member_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  conflict_group_id: z.uuid().nullable().optional(),
  evidence: z.unknown().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const EmbeddingModels = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  dim: z.number().int().optional(),
  state_id: z.string().optional(),
  artifact_url: z.string().optional(),
  sha256: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const EmbeddingModelsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  dim: z.number().int().optional(),
  state_id: z.string().optional(),
  artifact_url: z.string().optional(),
  sha256: z.string().optional(),
});
export const SearchEmbeddings = z.strictObject({
  target_type_id: z.string().optional(),
  target_id: z.uuid().optional(),
  model_id: z.string().optional(),
  chunk_no: z.string().optional(),
  content_hash: z.string().optional(),
  embedding: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SearchEmbeddingsInput = z.strictObject({
  target_type_id: z.string().optional(),
  target_id: z.uuid().optional(),
  model_id: z.string().optional(),
  chunk_no: z.string().optional(),
});
export const Tasks = z.strictObject({
  parent_task_id: z.uuid().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  title: z.string().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  goal_changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  next_action: z.string().nullable().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  planned_for: z.iso.date().nullable().optional(),
  blocked_reason_id: z.string().nullable().optional(),
  blocked_since: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TasksInput = z.strictObject({
  parent_task_id: z.uuid().optional(),
  goal_id: z.uuid().nullable().optional(),
  measure_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  title: z.string().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
  goal_changed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  next_action: z.string().nullable().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  planned_for: z.iso.date().nullable().optional(),
  blocked_reason_id: z.string().nullable().optional(),
  blocked_since: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TaskHandovers = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  from_member_id: z.uuid().nullable().optional(),
  to_member_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TaskHandoversInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  from_member_id: z.uuid().nullable().optional(),
  to_member_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  agreement_status_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const DailyPlans = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  plan_date: z.iso.date().nullable().optional(),
  capacity_minutes: z.number().int().nullable().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  carry_over: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DailyPlansInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  plan_date: z.iso.date().nullable().optional(),
  capacity_minutes: z.number().int().nullable().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  carry_over: z.unknown().nullable().optional(),
});
export const Triggers = z.strictObject({
  kind_id: z.string().nullable().optional(),
  cron_expr: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  on_missed_id: z.string().nullable().optional(),
  ttl_minutes: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TriggersInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  cron_expr: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  on_missed_id: z.string().nullable().optional(),
  ttl_minutes: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
export const Policies = z.strictObject({
  subject_kind_id: z.string().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  params: z.unknown().nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  applies_to: z.string().optional(),
  client_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  escalate_to: z.string().nullable().optional(),
  escalate_when: z.unknown().nullable().optional(),
  exception_approval_id: z.uuid().nullable().optional(),
  exception_of_policy_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  kind_id: z.uuid().nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  paused_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  source_ref: z.unknown().nullable().optional(),
  text: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
  version: z.number().int().optional(),
});
export const PoliciesInput = z.strictObject({
  subject_kind_id: z.string().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  params: z.unknown().nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
});
export const Approvals = z.strictObject({
  action_run_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  approver_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  bulk_batch_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  decision: z.string().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  escalated_by_policy_id: z.uuid().nullable().optional(),
  human_checks: z.unknown().optional(),
  irreversible: z.boolean().optional(),
  kind: z.string().optional(),
  level: z.number().int().optional(),
  memory_candidate: z.boolean().optional(),
  next_actor: z.string().nullable().optional(),
  parent_approval_id: z.uuid().nullable().optional(),
  return_reason: z.string().nullable().optional(),
  return_targets: z.unknown().nullable().optional(),
  scope_id: z.uuid().optional(),
  step_up_at: z.iso.datetime({ offset: true }).nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  ticket_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  withdrawn_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ApprovalsInput = z.strictObject({
  action_run_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  approver_member_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
});
export const ActionRuns = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  procedure_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  phase: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  tokens_in: z.number().int().nullable().optional(),
  tokens_out: z.number().int().nullable().optional(),
  cost: z.string().nullable().optional(),
  error_summary: z.string().nullable().optional(),
  ai_employee_id: z.uuid().nullable().optional(),
  duty_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  taken_over_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  approval_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  ticket_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ActionRunsInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  action_kind_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  procedure_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  phase: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  tokens_in: z.number().int().nullable().optional(),
  tokens_out: z.number().int().nullable().optional(),
  cost: z.string().nullable().optional(),
  error_summary: z.string().nullable().optional(),
  ai_employee_id: z.uuid().nullable().optional(),
  duty_id: z.uuid().nullable().optional(),
  mode_id: z.string().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  taken_over_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ServiceRegistry = z.strictObject({
  name: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryInput = z.strictObject({
  name: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const CredentialKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const CredentialKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Credentials = z.strictObject({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  service_id: z.uuid().nullable().optional(),
  service_name: z.string().nullable().optional(),
  service_domain: z.string().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  provider_id: z.string().optional(),
  vault_ref: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  destinations: z.array(z.string()).optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  login_check_at: z.iso.datetime({ offset: true }).nullable().optional(),
  login_check_detail: z.string().nullable().optional(),
  login_check_state: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  read_only: z.boolean().optional(),
  scope_id: z.uuid().optional(),
  two_factor_id: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
  use_count: z.number().int().optional(),
});
export const CredentialsInput = z.strictObject({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  service_id: z.uuid().nullable().optional(),
  service_name: z.string().nullable().optional(),
  service_domain: z.string().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  provider_id: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Conversations = z.strictObject({
  title: z.string().nullable().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  talk_kind: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ConversationsInput = z.strictObject({
  title: z.string().nullable().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  talk_kind: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
});
export const BridgeJobs = z.strictObject({
  member_id: z.uuid().optional(),
  conversation_id: z.uuid().nullable().optional(),
  state_id: z.string().optional(),
  prompt: z.string().optional(),
  agent_session_id: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  partial: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  sweep_failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  sweep_error_code: z.string().nullable().optional(),
  permission_mode: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  tools: z.array(z.string()).nullable().optional(),
  attachment_ids: z.array(z.uuid()).nullable().optional(),
  steer_seq: z.number().int().optional(),
  tool_token_hash: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_request_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  kind: z.string().optional(),
  resume_session_id: z.uuid().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  stop_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  taken_session_id: z.uuid().nullable().optional(),
  target_session_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgeJobsInput = z.strictObject({
  member_id: z.uuid().optional(),
  conversation_id: z.uuid().nullable().optional(),
  state_id: z.string().optional(),
  prompt: z.string().optional(),
  agent_session_id: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  partial: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  sweep_failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  sweep_error_code: z.string().nullable().optional(),
  permission_mode: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  tools: z.array(z.string()).nullable().optional(),
  attachment_ids: z.array(z.uuid()).nullable().optional(),
  steer_seq: z.number().int().optional(),
  tool_token_hash: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const BridgeJobStates = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const BridgeJobStatesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const BridgeJobEvents = z.strictObject({
  member_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
  kind: z.string().optional(),
  seq: z.number().int().optional(),
  request_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgeJobEventsInput = z.strictObject({
  member_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
  kind: z.string().optional(),
  seq: z.number().int().optional(),
  request_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
});
export const PermissionRules = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  tool: z.string().nullable().optional(),
  target_pattern: z.string().nullable().optional(),
  decision_id: z.string().nullable().optional(),
  bridge_job_event_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PermissionRulesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  tool: z.string().nullable().optional(),
  target_pattern: z.string().nullable().optional(),
  decision_id: z.string().nullable().optional(),
  bridge_job_event_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AgentUsageSnapshots = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  window_id: z.string().nullable().optional(),
  utilization: z.string().nullable().optional(),
  resets_at: z.iso.datetime({ offset: true }).nullable().optional(),
  observed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AgentUsageSnapshotsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  window_id: z.string().nullable().optional(),
  utilization: z.string().nullable().optional(),
  resets_at: z.iso.datetime({ offset: true }).nullable().optional(),
  observed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Messages = z.strictObject({
  conversation_id: z.uuid().nullable().optional(),
  sender_member_id: z.uuid().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  kind: z.string().nullable().optional(),
  options: z.unknown().nullable().optional(),
  confidence: z.string().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  parent_message_id: z.uuid().nullable().optional(),
  quote: z.unknown().nullable().optional(),
  work: z.unknown().nullable().optional(),
  send_state: z.string().nullable().optional(),
  transcript_uuid: z.string().nullable().optional(),
  undo_action_run_id: z.uuid().nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  author_name: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  job_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  visibility: z.string().optional(),
});
export const MessagesInput = z.strictObject({
  conversation_id: z.uuid().nullable().optional(),
  sender_member_id: z.uuid().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  kind: z.string().nullable().optional(),
  options: z.unknown().nullable().optional(),
  confidence: z.string().nullable().optional(),
  citations: z.unknown().nullable().optional(),
  parent_message_id: z.uuid().nullable().optional(),
  quote: z.unknown().nullable().optional(),
  work: z.unknown().nullable().optional(),
  send_state: z.string().nullable().optional(),
  transcript_uuid: z.string().nullable().optional(),
  undo_action_run_id: z.uuid().nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Artifacts = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  format_id: z.string().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  template_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  source_conversation_id: z.uuid().nullable().optional(),
  source_job_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ArtifactsInput = z.strictObject({
  task_id: z.uuid().nullable().optional(),
  format_id: z.string().nullable().optional(),
  template_id: z.uuid().nullable().optional(),
  approved_by: z.uuid().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  source_conversation_id: z.uuid().nullable().optional(),
  source_job_id: z.uuid().nullable().optional(),
});
export const ArtifactVersions = z.strictObject({
  artifact_id: z.uuid().optional(),
  version: z.number().int().optional(),
  storage_ref: z.string().optional(),
  size_bytes: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  reverted_from: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ArtifactVersionsInput = z.strictObject({
  artifact_id: z.uuid().optional(),
  size_bytes: z.string().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  reverted_from: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const AuditEvents = z.strictObject({
  entries: z.array(z.unknown()).optional(),
  next_cursor: z.string().nullable().optional(),
  scope: z.string().optional(),
  scan_capped: z.boolean().optional(),
});
export const AuditEventsInput = z.strictObject({
  actor_member_id: z.uuid().nullable().optional(),
  actor_role: z.string().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  choke_point_id: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const SessionKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const SessionKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const RevokeReasons = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RevokeReasonsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Layers = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LayersInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
});
export const TargetKinds = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const TargetKindsInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Abilities = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const AbilitiesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
});
export const Permissions = z.strictObject({
  grantee_member_id: z.uuid().optional(),
  target_kind_id: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  ability_id: z.string().optional(),
  granted_by: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  bundle_role: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PermissionsInput = z.strictObject({
  grantee_member_id: z.uuid().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  granted_by: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AccountEvents = z.strictObject({
  kind_id: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AccountEventsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const AccountEventItems = z.strictObject({
  event_id: z.uuid().nullable().optional(),
  object_kind: z.string().nullable().optional(),
  disposition_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  done_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AccountEventItemsInput = z.strictObject({
  event_id: z.uuid().nullable().optional(),
  object_kind: z.string().nullable().optional(),
  disposition_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  done_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Sessions = z.strictObject({
  member_id: z.uuid().optional(),
  kind_id: z.string().optional(),
  auth_session_id: z.string().nullable().optional(),
  device_label: z.string().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).optional(),
  last_seen_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoke_reason_id: z.string().nullable().optional(),
  device_token_hash: z.string().nullable().optional(),
  alive_at: z.iso.datetime({ offset: true }).nullable().optional(),
  bridge_version: z.string().nullable().optional(),
  machine_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  browser: z.string().optional(),
  cli_model: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  device: z.string().nullable().optional(),
  health: z.unknown().nullable().optional(),
  health_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_ip: z.string().nullable().optional(),
  login_kind: z.string().nullable().optional(),
  mfa_pending: z.boolean().optional(),
  step_up_at: z.iso.datetime({ offset: true }).nullable().optional(),
  terms_pending: z.boolean().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SessionsInput = z.strictObject({
  member_id: z.uuid().optional(),
  kind_id: z.string().optional(),
  auth_session_id: z.string().nullable().optional(),
  device_label: z.string().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).optional(),
  last_seen_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoke_reason_id: z.string().nullable().optional(),
  device_token_hash: z.string().nullable().optional(),
  alive_at: z.iso.datetime({ offset: true }).nullable().optional(),
  bridge_version: z.string().nullable().optional(),
  machine_id: z.uuid().nullable().optional(),
});
export const SupportAccessGrants = z.strictObject({
  granted_by_member_id: z.uuid().nullable().optional(),
  scope: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  inquiry_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SupportAccessGrantsInput = z.strictObject({
  granted_by_member_id: z.uuid().nullable().optional(),
  scope: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
});
export const RetentionHolds = z.strictObject({
  record_type: z.string().nullable().optional(),
  record_ref: z.string().nullable().optional(),
  retain_until: z.iso.date().nullable().optional(),
  legal_basis: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const RetentionHoldsInput = z.strictObject({
  record_type: z.string().nullable().optional(),
  record_ref: z.string().nullable().optional(),
  retain_until: z.iso.date().nullable().optional(),
  legal_basis: z.string().nullable().optional(),
});
export const ErasureCertificates = z.strictObject({
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  content_hash: z.string().nullable().optional(),
  sent_to: z.string().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ErasureCertificatesInput = z.strictObject({
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  sent_to: z.string().nullable().optional(),
});
export const Distributions = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DistributionsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  is_locked: z.boolean().nullable().optional(),
});
export const DistributionVersions = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const DistributionVersionsInput = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  change_reason: z.string().nullable().optional(),
});
export const TenantDistributions = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  override: z.unknown().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  offered_version: z.number().int().nullable().optional(),
  offered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  chosen: z.string().nullable().optional(),
  chosen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  chosen_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TenantDistributionsInput = z.strictObject({
  distribution_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  override: z.unknown().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  offered_version: z.number().int().nullable().optional(),
  offered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  chosen: z.string().nullable().optional(),
  chosen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  chosen_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryVersions = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRegistryVersionsInput = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  automation_verdict_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ServiceRequests = z.strictObject({
  service_name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ServiceRequestsInput = z.strictObject({
  service_name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  verdict_id: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const ReviewRequests = z.strictObject({
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  anonymization_check: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  reviewer_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ReviewRequestsInput = z.strictObject({
  subject_type: z.string().nullable().optional(),
  subject_id: z.uuid().nullable().optional(),
  anonymization_check: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  reviewer_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const OpsMembers = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  ops_role_id: z.string().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  caps: z.array(z.string()).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsMembersInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  ops_role_id: z.string().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const OpsAuditEvents = z.strictObject({
  ops_member_id: z.uuid().nullable().optional(),
  target_tenant_id: z.uuid().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  grant_id: z.uuid().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsAuditEventsInput = z.strictObject({
  ops_member_id: z.uuid().nullable().optional(),
  target_tenant_id: z.uuid().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
  target_id: z.string().nullable().optional(),
  grant_id: z.uuid().nullable().optional(),
  payload: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const SecurityEvents = z.strictObject({
  kind_id: z.string().optional(),
  step_up: z.string().optional(),
  step_up_failed: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  detail: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SecurityEventsInput = z.strictObject({
  kind_id: z.string().optional(),
  step_up: z.string().optional(),
  step_up_failed: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  ip_region: z.string().nullable().optional(),
  detail: z.unknown().optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});
export const Inquiries = z.strictObject({
  opened_by_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  topic_key: z.string().nullable().optional(),
  state: z.string().optional(),
  asker_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_message_at: z.iso.datetime({ offset: true }).nullable().optional(),
  conversation_id: z.uuid().nullable().optional(),
  assignee_ops_member_id: z.uuid().nullable().optional(),
  ai_first_answered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  kind_id: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  context: z.unknown().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  later_until: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InquiriesInput = z.strictObject({
  opened_by_member_id: z.uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  topic_key: z.string().nullable().optional(),
  state: z.string().optional(),
  asker_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  last_message_at: z.iso.datetime({ offset: true }).nullable().optional(),
  conversation_id: z.uuid().nullable().optional(),
  assignee_ops_member_id: z.uuid().nullable().optional(),
  ai_first_answered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  kind_id: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
});
export const Notices = z.strictObject({
  kind_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  target_plan_ids: z.array(z.uuid()).nullable().optional(),
  target_tenant_id: z.uuid().nullable().optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  admins_only: z.boolean().optional(),
  affects: z.unknown().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  emailed_admins_at: z.iso.datetime({ offset: true }).nullable().optional(),
  impact: z.string().nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  placements: z.array(z.string()).optional(),
  state: z.string().optional(),
  target_tenant_ids: z.array(z.uuid()).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NoticesInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  target_plan_ids: z.array(z.uuid()).nullable().optional(),
  target_tenant_id: z.uuid().nullable().optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
});
export const NoticeDeliveries = z.strictObject({
  notice_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  delivered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NoticeDeliveriesInput = z.strictObject({
  notice_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  delivered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const NoticeUpdates = z.strictObject({
  notice_id: z.uuid().optional(),
  state: z.string().optional(),
  body: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NoticeUpdatesInput = z.strictObject({
  notice_id: z.uuid().optional(),
  state: z.string().optional(),
  body: z.string().optional(),
});
export const StatusIncidents = z.strictObject({
  component_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  body: z.string().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
  state: z.string().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const StatusIncidentsInput = z.strictObject({
  component_id: z.string().nullable().optional(),
  service_id: z.uuid().nullable().optional(),
  state_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  resolved_at: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().nullable().optional(),
});
export const NotificationPreferences = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NotificationPreferencesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
export const Notifications = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  dedupe_key: z.string().nullable().optional(),
  sent_at: z.iso.datetime({ offset: true }).nullable().optional(),
  failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retry_count: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const NotificationsInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  channel_id: z.string().nullable().optional(),
  event_kind_id: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  sent_at: z.iso.datetime({ offset: true }).nullable().optional(),
  failed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retry_count: z.number().int().nullable().optional(),
});
export const Plans = z.strictObject({
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.string().nullable().optional(),
  limits: z.unknown().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PlansInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.string().nullable().optional(),
  limits: z.unknown().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
});
export const PlanVersions = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  price_monthly: z.number().int().nullable().optional(),
  member_limit: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  existing_from: z.iso.date().nullable().optional(),
  proposal_id: z.uuid().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  trial_days: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PlanVersionsInput = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  snapshot: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  price_monthly: z.number().int().nullable().optional(),
  member_limit: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  existing_from: z.iso.date().nullable().optional(),
  proposal_id: z.uuid().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  trial_days: z.number().int().optional(),
});
export const Subscriptions = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  payment_method_id: z.uuid().optional(),
  stripe_customer_ref: z.string().optional(),
  stripe_subscription_ref: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SubscriptionsInput = z.strictObject({
  plan_id: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  suspended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  billing_contact: z.unknown().nullable().optional(),
  payment_method_id: z.uuid().optional(),
  stripe_customer_ref: z.string().optional(),
  stripe_subscription_ref: z.string().optional(),
});
export const PlanChangeRequests = z.strictObject({
  from_plan_id: z.uuid().nullable().optional(),
  to_plan_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  dependencies_event_id: z.uuid().nullable().optional(),
  decided_by_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  effective_from: z.iso.date().nullable().optional(),
  prorated_amount: z.number().int().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PlanChangeRequestsInput = z.strictObject({
  from_plan_id: z.uuid().nullable().optional(),
  to_plan_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().nullable().optional(),
  status_id: z.string().nullable().optional(),
  dependencies_event_id: z.uuid().nullable().optional(),
  decided_by_ops_member_id: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  effective_from: z.iso.date().nullable().optional(),
  prorated_amount: z.number().int().nullable().optional(),
});
export const UsageMeters = z.strictObject({
  meter_key: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  value: z.string().nullable().optional(),
  limit_value: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const UsageMetersInput = z.strictObject({
  meter_key: z.string().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  value: z.string().nullable().optional(),
  limit_value: z.string().nullable().optional(),
});
export const Invoices = z.strictObject({
  subscription_id: z.uuid().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  status_id: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  plan_name: z.string().nullable().optional(),
  price_amount: z.number().int().nullable().optional(),
  tax_amount: z.number().int().nullable().optional(),
  prorated_amount: z.number().int().nullable().optional(),
  overdue_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  overdue_week_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  stripe_invoice_ref: z.string().optional(),
  hosted_url: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InvoicesInput = z.strictObject({
  subscription_id: z.uuid().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  status_id: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  plan_name: z.string().nullable().optional(),
  price_amount: z.number().int().nullable().optional(),
  tax_amount: z.number().int().nullable().optional(),
  prorated_amount: z.number().int().nullable().optional(),
  overdue_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  overdue_week_noticed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  stripe_invoice_ref: z.string().optional(),
  hosted_url: z.string().optional(),
});
export const OpsInvoiceTemplates = z.strictObject({
  company: z.string().optional(),
  address: z.string().optional(),
  reg_no: z.string().optional(),
  contact: z.string().optional(),
  payee: z.string().optional(),
  note: z.string().optional(),
  version: z.number().int().optional(),
  updated_by: z.uuid().nullable().optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
});
export const OpsInvoiceTemplatesInput = z.strictObject({
  company: z.string().optional(),
  address: z.string().optional(),
  reg_no: z.string().optional(),
  contact: z.string().optional(),
  payee: z.string().optional(),
  note: z.string().optional(),
});
export const Payments = z.strictObject({
  invoice_id: z.uuid().nullable().optional(),
  paid_on: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  method_id: z.string().nullable().optional(),
  recorded_by_ops_member_id: z.uuid().nullable().optional(),
  stripe_payment_ref: z.string().optional(),
  payer_name: z.string().nullable().optional(),
  reverses_payment_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PaymentsInput = z.strictObject({
  invoice_id: z.uuid().nullable().optional(),
  paid_on: z.iso.date().nullable().optional(),
  amount: z.string().nullable().optional(),
  method_id: z.string().nullable().optional(),
  recorded_by_ops_member_id: z.uuid().nullable().optional(),
  stripe_payment_ref: z.string().optional(),
  payer_name: z.string().nullable().optional(),
  reverses_payment_id: z.uuid().nullable().optional(),
});
export const ErrorEvents = z.strictObject({
  error_code: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  screen_id: z.string().nullable().optional(),
  context: z.unknown().optional(),
  shown_at: z.iso.datetime({ offset: true }).optional(),
  next_action_taken_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ErrorEventsInput = z.strictObject({
  error_code: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  screen_id: z.string().nullable().optional(),
  context: z.unknown().optional(),
  shown_at: z.iso.datetime({ offset: true }).optional(),
  next_action_taken_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Imports = z.strictObject({
  file_ref: z.string().nullable().optional(),
  detected_kind_id: z.string().nullable().optional(),
  proposal: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  applied_at: z.iso.datetime({ offset: true }).nullable().optional(),
  applied_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ImportsInput = z.strictObject({
  file_ref: z.string().nullable().optional(),
  detected_kind_id: z.string().nullable().optional(),
  proposal: z.unknown().nullable().optional(),
  status_id: z.string().nullable().optional(),
  applied_at: z.iso.datetime({ offset: true }).nullable().optional(),
  applied_by: z.uuid().nullable().optional(),
});
export const Integrations = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  scopes: z.array(z.string()).nullable().optional(),
  status_id: z.string().nullable().optional(),
  connected_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const IntegrationsInput = z.strictObject({
  service_id: z.uuid().nullable().optional(),
  kind_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  scopes: z.array(z.string()).nullable().optional(),
  status_id: z.string().nullable().optional(),
  connected_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Invitations = z.strictObject({
  email: z.string().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  role_id: z.string().nullable().optional(),
  permission_preset: z.unknown().optional(),
  token_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  accepted_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  message: z.string().nullable().optional(),
  resend_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  resent_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const InvitationsInput = z.strictObject({
  email: z.string().nullable().optional(),
  role_id: z.string().nullable().optional(),
  permission_preset: z.unknown().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  accepted_member_id: z.uuid().nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  message: z.string().nullable().optional(),
  resend_requested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
});
export const PendingSignup = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  pw_iv: z.string().optional(),
  token_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  sent_at: z.iso.datetime({ offset: true }).optional(),
  send_error: z.string().optional(),
  consumed_at: z.iso.datetime({ offset: true }).optional(),
  pwned_acked_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PendingSignupInput = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  pw_iv: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  sent_at: z.iso.datetime({ offset: true }).optional(),
  send_error: z.string().optional(),
  consumed_at: z.iso.datetime({ offset: true }).optional(),
  pwned_acked_at: z.iso.datetime({ offset: true }).optional(),
});
export const ExportJobs = z.strictObject({
  requested_by: z.uuid().nullable().optional(),
  kind_id: z.string().optional(),
  storage_ref: z.string().nullable().optional(),
  status_id: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  downloaded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ExportJobsInput = z.strictObject({
  requested_by: z.uuid().nullable().optional(),
  kind_id: z.string().optional(),
  status_id: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  downloaded_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Attachments = z.strictObject({
  owner_type: z.string().nullable().optional(),
  owner_id: z.uuid().nullable().optional(),
  storage_ref: z.string().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  uploaded_by: z.uuid().nullable().optional(),
  scanned_at: z.iso.datetime({ offset: true }).nullable().optional(),
  upload_token_hash: z.string().nullable().optional(),
  upload_expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  upload_ref: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AttachmentsInput = z.strictObject({
  owner_type: z.string().nullable().optional(),
  owner_id: z.uuid().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  uploaded_by: z.uuid().nullable().optional(),
  scanned_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Skills = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  visibility_id: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  scope_id: z.uuid().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  current_version: z.number().int().nullable().optional(),
  plan_ids: z.array(z.uuid()).nullable().optional(),
  visibility_id: z.string().nullable().optional(),
});
export const SkillVersions = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  package_ref: z.string().nullable().optional(),
  changelog: z.string().nullable().optional(),
  tested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  test_result: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  checked: z.unknown().nullable().optional(),
  fields: z.unknown().optional(),
  state: z.string().optional(),
});
export const SkillVersionsInput = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  changelog: z.string().nullable().optional(),
  tested_at: z.iso.datetime({ offset: true }).nullable().optional(),
  test_result: z.unknown().nullable().optional(),
  released_at: z.iso.datetime({ offset: true }).nullable().optional(),
  released_by: z.uuid().nullable().optional(),
});
export const SkillTestRuns = z.strictObject({
  skill_version_id: z.uuid().nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  mode: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillTestRunsInput = z.strictObject({
  skill_version_id: z.uuid().nullable().optional(),
  ops_member_id: z.uuid().nullable().optional(),
  mode: z.string().nullable().optional(),
  started_at: z.iso.datetime({ offset: true }).nullable().optional(),
  finished_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result: z.unknown().nullable().optional(),
});
export const SkillAttachments = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.uuid().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  attached_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SkillAttachmentsInput = z.strictObject({
  skill_id: z.uuid().nullable().optional(),
  version_in_use: z.number().int().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.uuid().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  disabled_by: z.uuid().nullable().optional(),
  attached_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const PaymentMethods = z.strictObject({
  kind_id: z.string().nullable().optional(),
  stripe_customer_ref: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  last4: z.string().nullable().optional(),
  expires_on: z.iso.date().nullable().optional(),
  registered_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PaymentMethodsInput = z.strictObject({
  kind_id: z.string().nullable().optional(),
  stripe_customer_ref: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  last4: z.string().nullable().optional(),
  expires_on: z.iso.date().nullable().optional(),
  registered_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const BillingEvents = z.strictObject({
  stripe_event_ref: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  received_at: z.iso.datetime({ offset: true }).nullable().optional(),
  processed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  signature_ok: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BillingEventsInput = z.strictObject({
  stripe_event_ref: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  received_at: z.iso.datetime({ offset: true }).nullable().optional(),
  processed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  signature_ok: z.string().nullable().optional(),
});
export const LlmRoutes = z.strictObject({
  default_kind_id: z.string().nullable().optional(),
  offline_kind_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  managed_allowed_by_ops_member_id: z.uuid().nullable().optional(),
  managed_allowed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LlmRoutesInput = z.strictObject({
  default_kind_id: z.string().nullable().optional(),
  offline_kind_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  credential_id: z.uuid().nullable().optional(),
  managed_allowed_by_ops_member_id: z.uuid().nullable().optional(),
  managed_allowed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LlmCapabilities = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  provider_id: z.uuid().nullable().optional(),
  capability_id: z.string().nullable().optional(),
  supported: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const LlmCapabilitiesInput = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  provider_id: z.uuid().nullable().optional(),
  capability_id: z.string().nullable().optional(),
  supported: z.string().nullable().optional(),
});
export const PushDevices = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  platform_id: z.string().nullable().optional(),
  token_ref: z.string().nullable().optional(),
  app_version: z.number().int().nullable().optional(),
  last_seen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const PushDevicesInput = z.strictObject({
  member_id: z.uuid().nullable().optional(),
  platform_id: z.string().nullable().optional(),
  token_ref: z.string().nullable().optional(),
  app_version: z.number().int().nullable().optional(),
  last_seen_at: z.iso.datetime({ offset: true }).nullable().optional(),
  revoked_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const DisclosureVersions = z.strictObject({
  version: z.number().int().nullable().optional(),
  generated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  content_hash: z.string().nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  dpa_ref: z.string().nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const DisclosureVersionsInput = z.strictObject({
  generated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  pdf_ref: z.string().nullable().optional(),
  dpa_ref: z.string().nullable().optional(),
  released_by: z.uuid().nullable().optional(),
  notice_id: z.uuid().nullable().optional(),
});
export const Subprocessors = z.strictObject({
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  data_kinds: z.array(z.string()).nullable().optional(),
  effective_from: z.string().nullable().optional(),
  announced_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retired_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SubprocessorsInput = z.strictObject({
  name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  data_kinds: z.array(z.string()).nullable().optional(),
  effective_from: z.string().nullable().optional(),
  announced_at: z.iso.datetime({ offset: true }).nullable().optional(),
  retired_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const Tickets = z.strictObject({
  number: z.string().optional(),
  kind_id: z.uuid().optional(),
  stage_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  completed_by: z.uuid().nullable().optional(),
  delegated_to_clone: z.boolean().optional(),
  client_id: z.uuid().nullable().optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  derived_from_ticket_id: z.uuid().nullable().optional(),
  start_on: z.iso.date().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  priority: z.string().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  work_type_id: z.uuid().nullable().optional(),
  work_type_version: z.number().int().nullable().optional(),
  hold_reason: z.string().nullable().optional(),
  resume_condition: z.string().nullable().optional(),
  priority_reason: z.string().nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  draft_import_id: z.uuid().nullable().optional(),
  no_spec_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_share: z.unknown().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketsInput = z.strictObject({
  number: z.string().optional(),
  kind_id: z.uuid().optional(),
  stage_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  completed_by: z.uuid().nullable().optional(),
  delegated_to_clone: z.boolean().optional(),
  client_id: z.uuid().nullable().optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  derived_from_ticket_id: z.uuid().nullable().optional(),
  start_on: z.iso.date().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  priority: z.string().optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  work_type_id: z.uuid().nullable().optional(),
  work_type_version: z.number().int().nullable().optional(),
  hold_reason: z.string().nullable().optional(),
  resume_condition: z.string().nullable().optional(),
  priority_reason: z.string().nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  draft_import_id: z.uuid().nullable().optional(),
  no_spec_reason: z.string().nullable().optional(),
});
export const TicketSections = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_key: z.string().optional(),
  position: z.number().int().optional(),
  body: z.unknown().optional(),
  version: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketSectionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_key: z.string().optional(),
  position: z.number().int().optional(),
  body: z.unknown().optional(),
});
export const TicketSectionVersions = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_id: z.uuid().optional(),
  version: z.number().int().optional(),
  body: z.unknown().optional(),
  edited_by: z.uuid().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).optional(),
  edited_by_clone: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  restored_from: z.number().int().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketSectionVersionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  section_id: z.uuid().optional(),
  body: z.unknown().optional(),
  edited_by: z.uuid().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).optional(),
  edited_by_clone: z.boolean().optional(),
});
export const TicketKinds = z.strictObject({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  color_key: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  body_template: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  description: z.string().nullable().optional(),
  template_hash: z.string().nullable().optional(),
  template_key: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketKindsInput = z.strictObject({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  color_key: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  body_template: z.unknown().nullable().optional(),
});
export const KindSections = z.strictObject({
  kind_id: z.uuid().optional(),
  section_key: z.string().optional(),
  label: z.string().optional(),
  mode: z.string().optional(),
  position: z.number().int().optional(),
  default_test_specs: z.unknown().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  client_visible: z.boolean().optional(),
  content_type: z.string().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  hint: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  used_for_acceptance: z.boolean().optional(),
});
export const KindSectionsInput = z.strictObject({
  kind_id: z.uuid().optional(),
  section_key: z.string().optional(),
  label: z.string().optional(),
  mode: z.string().optional(),
  position: z.number().int().optional(),
  default_test_specs: z.unknown().nullable().optional(),
});
export const TicketStages = z.strictObject({
  key: z.string().nullable().optional(),
  name: z.string().optional(),
  color_key: z.string().optional(),
  position: z.number().int().optional(),
  is_fixed: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  template_hash: z.string().nullable().optional(),
  template_key: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketStagesInput = z.strictObject({
  key: z.string().nullable().optional(),
  name: z.string().optional(),
  color_key: z.string().optional(),
  position: z.number().int().optional(),
  is_fixed: z.boolean().optional(),
});
export const ClassAxes = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  is_builtin: z.boolean().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClassAxesInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  is_builtin: z.boolean().optional(),
  position: z.number().int().optional(),
});
export const ClassValues = z.strictObject({
  axis_id: z.uuid().optional(),
  label: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClassValuesInput = z.strictObject({
  axis_id: z.uuid().optional(),
  label: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
});
export const TicketClassValues = z.strictObject({
  ticket_id: z.uuid().optional(),
  value_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketClassValuesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  value_id: z.uuid().optional(),
});
export const CustomFields = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.unknown().optional(),
  position: z.number().int().optional(),
  template_key: z.string().nullable().optional(),
  template_hash: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const CustomFieldsInput = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.unknown().optional(),
  position: z.number().int().optional(),
  template_key: z.string().nullable().optional(),
  template_hash: z.string().nullable().optional(),
});
export const CustomFieldKinds = z.strictObject({
  field_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const CustomFieldKindsInput = z.strictObject({
  field_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
});
export const TicketFieldValues = z.strictObject({
  ticket_id: z.uuid().optional(),
  field_id: z.uuid().optional(),
  value: z.unknown().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketFieldValuesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  field_id: z.uuid().optional(),
  value: z.unknown().optional(),
});
export const HandoverRules = z.strictObject({
  target: z.string().optional(),
  axis_id: z.uuid().nullable().optional(),
  mode: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const HandoverRulesInput = z.strictObject({
  target: z.string().optional(),
  axis_id: z.uuid().nullable().optional(),
  mode: z.string().optional(),
});
export const TestSpecs = z.strictObject({
  ticket_id: z.uuid().optional(),
  check_kind: z.string().nullable().optional(),
  title: z.string().optional(),
  judge_type: z.string().nullable().optional(),
  params: z.unknown().optional(),
  version: z.number().int().optional(),
  off_reason: z.string().nullable().optional(),
  checked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  checked_by_ai: z.boolean().optional(),
  checked_basis: z.string().nullable().optional(),
  source: z.string().optional(),
  source_ref_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TestSpecsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  check_kind: z.string().nullable().optional(),
  title: z.string().optional(),
  judge_type: z.string().nullable().optional(),
  params: z.unknown().optional(),
  off_reason: z.string().nullable().optional(),
  checked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  checked_by_ai: z.boolean().optional(),
  checked_basis: z.string().nullable().optional(),
  source: z.string().optional(),
  source_ref_id: z.uuid().nullable().optional(),
});
export const Checks = z.strictObject({
  ticket_id: z.uuid().optional(),
  test_spec_id: z.uuid().optional(),
  spec_version: z.number().int().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  attempt: z.number().int().optional(),
  result: z.string().optional(),
  evidence: z.unknown().optional(),
  runner: z.string().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ChecksInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  test_spec_id: z.uuid().optional(),
  spec_version: z.number().int().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  attempt: z.number().int().optional(),
  result: z.string().optional(),
  evidence: z.unknown().optional(),
  runner: z.string().optional(),
  checked_by_member_id: z.uuid().nullable().optional(),
});
export const TicketDecisions = z.strictObject({
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  source_message_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  promoted_to: z.string().optional(),
  decided_note: z.string().nullable().optional(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  cancelled_by: z.uuid().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketDecisionsInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  source_message_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  promoted_to: z.string().optional(),
  decided_note: z.string().nullable().optional(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  cancelled_by: z.uuid().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
});
export const TicketMessages = z.strictObject({
  ticket_id: z.uuid().optional(),
  author_member_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  mentions: z.array(z.uuid()).optional(),
  changes: z.unknown().nullable().optional(),
  quote_of_id: z.uuid().nullable().optional(),
  reactions: z.unknown().optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_text: z.string().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  guest_visible: z.boolean().optional(),
  from_request: z.boolean().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketMessagesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  author_member_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  mentions: z.array(z.uuid()).optional(),
  changes: z.unknown().nullable().optional(),
  quote_of_id: z.uuid().nullable().optional(),
  reactions: z.unknown().optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_text: z.string().nullable().optional(),
  edited_at: z.iso.datetime({ offset: true }).nullable().optional(),
  deleted_by: z.uuid().nullable().optional(),
  guest_visible: z.boolean().optional(),
  from_request: z.boolean().optional(),
});
export const ReferenceLogs = z.strictObject({
  ticket_id: z.uuid().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  ref_type: z.string().optional(),
  ref_id: z.uuid().nullable().optional(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  seen_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ReferenceLogsInput = z.strictObject({
  ticket_id: z.uuid().nullable().optional(),
  action_run_id: z.uuid().nullable().optional(),
  member_id: z.uuid().nullable().optional(),
  bridge_job_id: z.uuid().nullable().optional(),
  ref_type: z.string().optional(),
  ref_id: z.uuid().nullable().optional(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  seen_at: z.iso.datetime({ offset: true }).optional(),
});
export const KnowledgePages = z.strictObject({
  is_personal: z.boolean().optional(),
  parent_page_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  is_must: z.boolean().optional(),
  copied_from_page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  position: z.number().int().optional(),
  owner_member_id: z.uuid().optional(),
  state: z.string().optional(),
  verify_interval_days: z.number().int().nullable().optional(),
  verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  verify_due_on: z.iso.date().nullable().optional(),
  topics: z.array(z.string()).optional(),
  current_version: z.number().int().optional(),
  form: z.string().optional(),
  archived_at: z.iso.datetime({ offset: true }).nullable().optional(),
  archived_to_page_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgePagesInput = z.strictObject({
  is_personal: z.boolean().optional(),
  parent_page_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  is_must: z.boolean().optional(),
  copied_from_page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  position: z.number().int().optional(),
  owner_member_id: z.uuid().optional(),
  state: z.string().optional(),
  verify_interval_days: z.number().int().nullable().optional(),
  verified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  verify_due_on: z.iso.date().nullable().optional(),
  topics: z.array(z.string()).optional(),
  current_version: z.number().int().optional(),
  form: z.string().optional(),
  archived_at: z.iso.datetime({ offset: true }).nullable().optional(),
  archived_to_page_id: z.uuid().nullable().optional(),
});
export const KnowledgePageVersions = z.strictObject({
  page_id: z.uuid().optional(),
  version: z.number().int().optional(),
  kind: z.string().optional(),
  body: z.unknown().optional(),
  note: z.string().nullable().optional(),
  author_member_id: z.uuid().nullable().optional(),
  proposed_from_ticket_id: z.uuid().nullable().optional(),
  proposed_by_clone: z.boolean().optional(),
  decision: z.string().nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  published_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgePageVersionsInput = z.strictObject({
  page_id: z.uuid().optional(),
  kind: z.string().optional(),
  body: z.unknown().optional(),
  note: z.string().nullable().optional(),
  author_member_id: z.uuid().nullable().optional(),
  proposed_from_ticket_id: z.uuid().nullable().optional(),
  proposed_by_clone: z.boolean().optional(),
  decision: z.string().nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  published_by: z.uuid().nullable().optional(),
  published_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const KnowledgeLinks = z.strictObject({
  from_page_id: z.uuid().optional(),
  to_type: z.string().optional(),
  to_id: z.uuid().optional(),
  anchor: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgeLinksInput = z.strictObject({
  from_page_id: z.uuid().optional(),
  to_type: z.string().optional(),
  to_id: z.uuid().optional(),
  anchor: z.string().nullable().optional(),
});
export const KnowledgeBreaches = z.strictObject({
  ticket_id: z.uuid().optional(),
  page_id: z.uuid().optional(),
  test_spec_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgeBreachesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  page_id: z.uuid().optional(),
  test_spec_id: z.uuid().nullable().optional(),
  kind: z.string().optional(),
});
export const KnowledgeFolders = z.strictObject({
  is_personal: z.boolean().optional(),
  owner_member_id: z.uuid().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  position: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  scope_id: z.uuid().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgeFoldersInput = z.strictObject({
  is_personal: z.boolean().optional(),
  owner_member_id: z.uuid().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
  position: z.number().int().optional(),
});
export const KnowledgeLimits = z.strictObject({
  shelf: z.string().optional(),
  must_max: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const KnowledgeLimitsInput = z.strictObject({
  shelf: z.string().optional(),
  must_max: z.number().int().optional(),
});
export const KnowledgeRequests = z.strictObject({
  kind: z.string().optional(),
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  from_scope_id: z.uuid().optional(),
  from_is_personal: z.boolean().optional(),
  to_scope_id: z.uuid().optional(),
  to_folder_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().optional(),
  message: z.string().nullable().optional(),
  state: z.string().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  dismissed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgeRequestsInput = z.strictObject({
  kind: z.string().optional(),
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  from_scope_id: z.uuid().optional(),
  from_is_personal: z.boolean().optional(),
  to_scope_id: z.uuid().optional(),
  to_folder_id: z.uuid().nullable().optional(),
  requested_by: z.uuid().optional(),
  message: z.string().nullable().optional(),
  state: z.string().optional(),
  decided_by: z.uuid().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  decline_reason: z.string().nullable().optional(),
  dismissed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const KnowledgeShares = z.strictObject({
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  group_id: z.uuid().optional(),
  request_id: z.uuid().nullable().optional(),
  shared_by: z.uuid().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const KnowledgeSharesInput = z.strictObject({
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  group_id: z.uuid().optional(),
  request_id: z.uuid().nullable().optional(),
  shared_by: z.uuid().optional(),
  ended_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ended_by: z.uuid().nullable().optional(),
});
export const Clients = z.strictObject({
  name: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  visibility: z.string().optional(),
  default_share: z.unknown().optional(),
  routing: z.string().nullable().optional(),
  email_domain: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientsInput = z.strictObject({
  name: z.string().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  visibility: z.string().optional(),
  default_share: z.unknown().optional(),
  routing: z.string().nullable().optional(),
  email_domain: z.string().nullable().optional(),
});
export const ClientGroups = z.strictObject({
  client_id: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientGroupsInput = z.strictObject({
  client_id: z.uuid().optional(),
});
export const ClientContacts = z.strictObject({
  client_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  role: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  cc_role: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientContactsInput = z.strictObject({
  client_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  role: z.string().optional(),
  member_id: z.uuid().nullable().optional(),
  cc_role: z.string().optional(),
});
export const ClientRequests = z.strictObject({
  client_id: z.uuid().nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  state: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
  routed_scope_id: z.uuid().nullable().optional(),
  questions: z.unknown().optional(),
  decline_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  draft: z.unknown().nullable().optional(),
  draft_at: z.iso.datetime({ offset: true }).nullable().optional(),
  draft_job_id: z.uuid().nullable().optional(),
  draft_state: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientRequestsInput = z.strictObject({
  client_id: z.uuid().nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  body: z.string().nullable().optional(),
  due_on: z.iso.date().nullable().optional(),
  state: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
  routed_scope_id: z.uuid().nullable().optional(),
  questions: z.unknown().optional(),
  decline_reason: z.string().nullable().optional(),
});
export const ClientRequestMessages = z.strictObject({
  client_request_id: z.uuid().optional(),
  side: z.string().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  author_member_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ClientRequestMessagesInput = z.strictObject({
  client_request_id: z.uuid().optional(),
  side: z.string().optional(),
  kind: z.string().optional(),
  body: z.string().nullable().optional(),
  author_member_id: z.uuid().optional(),
});
export const Acceptances = z.strictObject({
  ticket_id: z.uuid().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().optional(),
  due_on: z.iso.date().nullable().optional(),
  message: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const AcceptancesInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  artifact_version_id: z.uuid().nullable().optional(),
  contact_id: z.uuid().optional(),
  due_on: z.iso.date().nullable().optional(),
  message: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TenantMemberships = z.strictObject({
  auth_user_id: z.string().nullable().optional(),
  member_id: z.uuid().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  joined_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TenantMembershipsInput = z.strictObject({
  auth_user_id: z.string().nullable().optional(),
  member_id: z.uuid().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  joined_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const TermsVersions = z.strictObject({
  kind: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
  published_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TermsVersionsInput = z.strictObject({
  kind: z.string().optional(),
  url: z.string().optional(),
  published_at: z.iso.datetime({ offset: true }).optional(),
});
export const TermsConsents = z.strictObject({
  member_id: z.uuid().optional(),
  auth_user_id: z.string().nullable().optional(),
  terms_version_id: z.uuid().optional(),
  agreed_at: z.iso.datetime({ offset: true }).optional(),
  ip: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TermsConsentsInput = z.strictObject({
  member_id: z.uuid().optional(),
  auth_user_id: z.string().nullable().optional(),
  terms_version_id: z.uuid().optional(),
  agreed_at: z.iso.datetime({ offset: true }).optional(),
  ip: z.string().nullable().optional(),
});
export const Passkeys = z.strictObject({
  auth_user_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  public_key: z.string().optional(),
  name: z.string().optional(),
  transports: z.string().optional(),
  last_used_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const PasskeysInput = z.strictObject({
  auth_user_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  public_key: z.string().optional(),
  name: z.string().optional(),
  transports: z.string().optional(),
  last_used_at: z.iso.datetime({ offset: true }).optional(),
  revoked_at: z.iso.datetime({ offset: true }).optional(),
});
export const Operations = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  kind: z.string().optional(),
  current_version: z.number().int().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  check_state: z.string().optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  description: z.string().nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
  version_label: z.string().nullable().optional(),
});
export const OperationsInput = z.strictObject({
  key: z.string().optional(),
  name: z.string().optional(),
  kind: z.string().optional(),
  current_version: z.number().int().optional(),
});
export const TicketLinks = z.strictObject({
  from_ticket_id: z.uuid().optional(),
  to_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketLinksInput = z.strictObject({
  from_ticket_id: z.uuid().optional(),
  to_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
});
export const GuestGroups = z.strictObject({
  groups: z.array(z.unknown()).optional(),
});
export const GuestGroupsInput = z.strictObject({
  name: z.string().optional(),
  name_key: z.string().nullable().optional(),
  request_scope_id: z.uuid().optional(),
});
export const GuestGroupMembers = z.strictObject({
  guest_group_id: z.uuid().optional(),
  member_id: z.uuid().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const GuestGroupMembersInput = z.strictObject({
  guest_group_id: z.uuid().optional(),
  member_id: z.uuid().optional(),
});
export const TicketGuestShares = z.strictObject({
  shared: z.array(z.unknown()).optional(),
  choices: z.array(z.unknown()).optional(),
  can_change: z.boolean().optional(),
});
export const TicketGuestSharesInput = z.strictObject({
  add: z.array(z.uuid()).nullable().optional(),
  remove: z.array(z.uuid()).nullable().optional(),
});
export const TicketHandovers = z.strictObject({
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  from_member_id: z.uuid().optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.unknown().optional(),
  state: z.string().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  notify_managers: z.boolean().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  overdue_notified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  switch_applied: z.unknown().nullable().optional(),
  answered_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketHandoversInput = z.strictObject({
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  from_member_id: z.uuid().optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.unknown().optional(),
  state: z.string().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  notify_managers: z.boolean().optional(),
  reminded_at: z.iso.datetime({ offset: true }).nullable().optional(),
  overdue_notified_at: z.iso.datetime({ offset: true }).nullable().optional(),
  switch_applied: z.unknown().nullable().optional(),
  answered_by: z.uuid().nullable().optional(),
});
export const SavedViews = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.unknown().optional(),
  columns: z.unknown().optional(),
  density: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const SavedViewsInput = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  filters: z.unknown().optional(),
  columns: z.unknown().optional(),
  density: z.string().optional(),
});
export const TicketImports = z.strictObject({
  uploaded_by: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  source: z.string().optional(),
  mapping: z.unknown().optional(),
  rows: z.number().int().optional(),
  errors: z.unknown().optional(),
  state: z.string().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const TicketImportsInput = z.strictObject({
  uploaded_by: z.uuid().optional(),
  source: z.string().optional(),
  mapping: z.unknown().optional(),
  rows: z.number().int().optional(),
  errors: z.unknown().optional(),
  state: z.string().optional(),
  committed_at: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const LearningCandidates = z.strictObject({
  owner_member_id: z.uuid().optional(),
  trigger: z.string().optional(),
  proposed_as: z.string().optional(),
  text: z.string().optional(),
  evidence: z.unknown().optional(),
  check_result: z.unknown().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result_type: z.string().nullable().optional(),
  result_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const LearningCandidatesInput = z.strictObject({
  owner_member_id: z.uuid().optional(),
  trigger: z.string().optional(),
  proposed_as: z.string().optional(),
  text: z.string().optional(),
  evidence: z.unknown().optional(),
  check_result: z.unknown().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  result_type: z.string().nullable().optional(),
  result_id: z.uuid().nullable().optional(),
});
export const BridgePairingCodes = z.strictObject({
  member_id: z.uuid().optional(),
  code_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  used_session_id: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const BridgePairingCodesInput = z.strictObject({
  member_id: z.uuid().optional(),
  code_hash: z.string().optional(),
  expires_at: z.iso.datetime({ offset: true }).optional(),
  used_at: z.iso.datetime({ offset: true }).nullable().optional(),
  used_session_id: z.uuid().nullable().optional(),
});
export const NotificationSettings = z.strictObject({
  workspace_id: z.uuid().optional(),
  email_digest: z.boolean().optional(),
  quiet_hours: z.record(z.string(), z.unknown()).optional(),
  paused_until: z.string().nullable().optional(),
  urgent_override: z.array(z.unknown()).optional(),
  events: z.array(z.unknown()).optional(),
});
export const NotificationSettingsInput = z.strictObject({
  member_id: z.uuid().optional(),
  email_digest: z.boolean().optional(),
  quiet_hours: z.unknown().optional(),
  paused_until: z.iso.datetime({ offset: true }).nullable().optional(),
  urgent_override: z.unknown().optional(),
});
export const OpsPlanProposals = z.strictObject({
  plan_id: z.uuid().optional(),
  from_version: z.number().int().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  changes: z.unknown().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
  proposed_by: z.uuid().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  return_reason: z.string().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  submitted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const OpsPlanProposalsInput = z.strictObject({
  plan_id: z.uuid().optional(),
  from_version: z.number().int().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  changes: z.unknown().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().nullable().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
  proposed_by: z.uuid().optional(),
  decided_by: z.uuid().nullable().optional(),
  state: z.string().optional(),
  decided_at: z.iso.datetime({ offset: true }).nullable().optional(),
  return_reason: z.string().nullable().optional(),
});
export const ScopeMemberships = z.strictObject({
  member_id: z.uuid().optional(),
  scope_id: z.uuid().optional(),
  is_primary: z.boolean().optional(),
  role: z.string().optional(),
  since: z.iso.date().optional(),
  changed_by: z.uuid().nullable().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  created_by: z.uuid().nullable().optional(),
  deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_by: z.uuid().nullable().optional(),
});
export const ScopeMembershipsInput = z.strictObject({
  member_id: z.uuid().optional(),
  is_primary: z.boolean().optional(),
  role: z.string().optional(),
  since: z.iso.date().optional(),
  changed_by: z.uuid().nullable().optional(),
});
export const RoleBundleDefaults = z.strictObject({
  role: z.string().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  scope_kind: z.string().optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const RoleBundleDefaultsInput = z.strictObject({
  role: z.string().optional(),
  target_kind_id: z.string().optional(),
  ability_id: z.string().optional(),
  scope_kind: z.string().optional(),
});
export const StepUpInput = z.strictObject({
  password: z.string().optional(),
  code: z.string().optional(),
  passkey: z.record(z.string(), z.unknown()).optional(),
});
export const PasskeyRenameInput = z.strictObject({
  name: z.string().optional(),
});
export const SignupInput = z.strictObject({
  email: z.string().optional(),
  name: z.string().optional(),
  company_name: z.string().optional(),
  password: z.string().optional(),
});
export const SignupResendInput = z.strictObject({

});
export const SignupVerifyInput = z.strictObject({
  token: z.string().optional(),
});
export const PasswordForgotInput = z.strictObject({
  email: z.string().optional(),
});
export const SignInInput = z.strictObject({
  email: z.string().optional(),
  password: z.string().optional(),
  invitation: z.string().nullable().optional(),
});
export const SignInCodeInput = z.strictObject({
  pending: z.string().optional(),
  code: z.string().nullable().optional(),
  backup_code: z.string().nullable().optional(),
  invitation: z.string().nullable().optional(),
});
export const SignOutInput = z.strictObject({

});
export const AdminRecoveryInput = z.strictObject({
  pending: z.string().optional(),
});
export const TwoFactorStartInput = z.strictObject({
  password: z.string().nullable().optional(),
});
export const TwoFactorConfirmInput = z.strictObject({
  code: z.string().optional(),
});
export const PasswordChangeInput = z.strictObject({
  current_password: z.string().optional(),
  new_password: z.string().optional(),
});
export const PasswordSetInput = z.strictObject({
  new_password: z.string().optional(),
});
export const PasswordResetInput = z.strictObject({
  token: z.string().optional(),
  new_password: z.string().optional(),
});
export const TermsConsentInput = z.strictObject({
  agree: z.boolean().optional(),
  terms_version_id: z.uuid().optional(),
  privacy_version_id: z.uuid().optional(),
});
export const PairingCodeInput = z.strictObject({

});
export const BridgeClaimInput = z.strictObject({
  code: z.string().optional(),
  device_label: z.string().optional(),
  machine_id: z.uuid().nullable().optional(),
});
export const BridgeHeartbeatInput = z.strictObject({
  health: z.unknown().optional(),
  protocol: z.unknown().optional(),
  version: z.string().optional(),
});
export const TicketCreateInput = z.strictObject({
  scope_id: z.uuid().optional(),
  kind_id: z.uuid().optional(),
  title: z.string().optional(),
  assignee_member_id: z.uuid().optional(),
  due_on: z.iso.date().optional(),
  start_on: z.string().optional(),
  priority: z.string().optional(),
  priority_reason: z.string().optional(),
  parent_ticket_id: z.uuid().optional(),
  estimate_minutes: z.unknown().nullable().optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  draft_id: z.uuid().optional(),
  source_draft_id: z.uuid().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  specs: z.array(z.string()).optional(),
  links: z.array(z.unknown()).optional(),
  duplicate_of: z.uuid().optional(),
  copy: z.array(z.unknown()).optional(),
});
export const TicketDraftInput = z.strictObject({
  draft_id: z.uuid().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  discard: z.boolean().optional(),
});
export const DismissSetupTasksInput = z.strictObject({
  key: z.string().optional(),
});
export const TicketDelegateInput = z.strictObject({
  no_spec_reason: z.string().optional(),
});
export const BridgeTakeInput = z.strictObject({
  wait_sec: z.number().int().optional(),
  protocol: z.number().int().optional(),
  idle: z.boolean().optional(),
});
export const BridgeProgressInput = z.strictObject({
  seq: z.number().int().optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  agent_session_id: z.uuid().optional(),
  model: z.string().optional(),
  tool: z.unknown().optional(),
  usage: z.unknown().optional(),
  todos: z.unknown().optional(),
  windows: z.unknown().optional(),
  blocked: z.unknown().optional(),
});
export const BridgeFinishInput = z.strictObject({
  state: z.string().optional(),
  result: z.string().optional(),
  reason: z.string().optional(),
  agent_session_id: z.uuid().optional(),
});
export const BridgeToolInput = z.strictObject({
  input: z.unknown().optional(),
});
export const ApprovalApproveInput = z.strictObject({

});
export const ApprovalReturnInput = z.strictObject({
  note: z.string().optional(),
  next_actor: z.string().nullable().optional(),
});
export const InvitationAcceptInput = z.strictObject({
  name: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});
export const TicketCompleteInput = z.strictObject({
  conditions_confirmed: z.boolean().optional(),
});
export const InvitationResendInput = z.strictObject({

});
export const CredentialCreateInput = z.strictObject({
  layer: z.string().optional(),
  kind: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  value: z.string().optional(),
  two_factor: z.string().optional(),
  totp_secret: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
});
export const CredentialUpdateInput = z.strictObject({
  login: z.string().optional(),
  password: z.string().optional(),
  value: z.string().optional(),
  two_factor: z.string().optional(),
  totp_secret: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  reason: z.string().optional(),
});
export const CredentialResolveInput = z.strictObject({
  job_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  destination: z.string().optional(),
  executor_key: z.string().optional(),
});
export const CredentialLoginCheckInput = z.strictObject({

});
export const CredentialLoginAnswerInput = z.strictObject({
  request_ref: z.string().optional(),
  code: z.string().optional(),
  approved: z.boolean().optional(),
});
export const CredentialCheckReportInput = z.strictObject({
  job_id: z.uuid().optional(),
  state: z.string().optional(),
  detail: z.string().optional(),
  request_ref: z.string().optional(),
  ask_kind: z.string().optional(),
  text: z.string().optional(),
});
export const DeviceBrowserInput = z.strictObject({
  browser: z.string().optional(),
});
export const DeviceBrowserCheckInput = z.strictObject({

});
export const BridgeBrowserInput = z.strictObject({
  browser: z.string().optional(),
});
export const TicketTimelineSeenInput = z.strictObject({
  seen_at: z.string().nullable().optional(),
});
export const TicketMessageInput = z.strictObject({
  body: z.string().optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_of_id: z.uuid().nullable().optional(),
  stage_key: z.string().optional(),
  stage_id: z.uuid().optional(),
  hold_reason: z.string().optional(),
  resume_condition: z.string().optional(),
});
export const TicketMessageEditInput = z.strictObject({
  body: z.string().optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
});
export const TicketMessageStarInput = z.strictObject({

});
export const TicketUpdateInput = z.strictObject({
  stage_id: z.uuid().optional(),
  stage_key: z.string().optional(),
  actual_minutes: z.number().int().nullable().optional(),
  hold_reason: z.string().optional(),
  resume_condition: z.string().optional(),
  priority: z.string().optional(),
  priority_reason: z.string().optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  estimate_minutes: z.number().int().nullable().optional(),
  due_on: z.string().nullable().optional(),
  start_on: z.string().nullable().optional(),
  due_reason: z.string().optional(),
  expected_due_on: z.string().nullable().optional(),
  expected_start_on: z.string().nullable().optional(),
});
export const TicketDecisionInput = z.strictObject({
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by_member_id: z.uuid().nullable().optional(),
  decided_note: z.string().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  promoted_to: z.string().nullable().optional(),
});
export const TicketDecisionUpdateInput = z.strictObject({
  action: z.string().optional(),
  text: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const TicketHandoverCreateInput = z.strictObject({
  kind: z.string().optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.record(z.string(), z.unknown()).nullable().optional(),
  notify_managers: z.boolean().nullable().optional(),
  replaces: z.uuid().nullable().optional(),
});
export const TicketHandoverAnswerInput = z.strictObject({
  decision: z.string().optional(),
  decline_reason: z.string().nullable().optional(),
  switch: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const HandoverWithdrawInput = z.strictObject({

});
export const HandoverRemindInput = z.strictObject({

});
export const TicketHandoverClaimInput = z.strictObject({
  member_id: z.uuid().optional(),
});
export const InvitationsCreateInput = z.strictObject({
  emails: z.array(z.string()).optional(),
  scope_id: z.uuid().nullable().optional(),
  role_key: z.string().optional(),
  message: z.string().nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
});
export const InvitationLinkCreateInput = z.strictObject({
  scope_id: z.uuid().optional(),
  role_key: z.string().optional(),
});
export const InvitationJoinConfirmInput = z.strictObject({
  token: z.string().optional(),
});
export const TicketBodyInput = z.strictObject({
  version: z.number().int().optional(),
  doc: z.record(z.string(), z.unknown()).optional(),
});
export const BodyRestoreInput = z.strictObject({
  current_version: z.number().int().optional(),
});
export const TestSpecCreateInput = z.strictObject({
  title: z.string().optional(),
});
export const TestSpecUpdateInput = z.strictObject({
  version: z.number().int().optional(),
  checked: z.boolean().optional(),
  title: z.string().optional(),
});
export const TicketLinkInput = z.strictObject({
  other_ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
});
export const NotificationReadInput = z.strictObject({
  read: z.boolean().optional(),
});
export const NotificationReadAllInput = z.strictObject({

});
export const SavedViewInput = z.strictObject({
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  density: z.string().optional(),
});
export const SavedViewUpdateInput = z.strictObject({
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  density: z.string().optional(),
});
export const ActionRunTakeoverInput = z.strictObject({

});
export const TicketRestoreInput = z.strictObject({

});
export const ItemRestoreInput = z.strictObject({
  from: z.number().int().optional(),
  to: z.number().int().optional(),
});
export const KnowledgeFolderCreateInput = z.strictObject({
  shelf: z.string().optional(),
  group_id: z.uuid().nullable().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  name: z.string().optional(),
});
export const KnowledgeFolderUpdateInput = z.strictObject({
  name: z.string().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  position: z.number().int().optional(),
});
export const KnowledgePageCreateInput = z.strictObject({
  shelf: z.string().optional(),
  group_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  title: z.string().optional(),
  desc: z.string().optional(),
});
export const KnowledgeDraftInput = z.strictObject({
  title: z.string().optional(),
  desc: z.string().optional(),
  doc: z.record(z.string(), z.unknown()).optional(),
});
export const KnowledgePublishInput = z.strictObject({

});
export const KnowledgePageMoveInput = z.strictObject({
  folder_id: z.uuid().nullable().optional(),
  position: z.number().int().optional(),
});
export const KnowledgeMustInput = z.strictObject({
  must: z.boolean().optional(),
});
export const KnowledgeSimilarInput = z.strictObject({
  title: z.string().optional(),
  desc: z.string().optional(),
  text: z.string().optional(),
  exclude_page_id: z.uuid().optional(),
});
export const KnowledgeCopyInput = z.strictObject({
  folder_id: z.uuid().nullable().optional(),
});
export const KnowledgeRaiseInput = z.strictObject({
  group_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  message: z.string().nullable().optional(),
});
export const KnowledgeDismissInput = z.strictObject({

});
export const KnowledgeApproveInput = z.strictObject({

});
export const KnowledgeDeclineInput = z.strictObject({
  reason: z.string().optional(),
});
export const KnowledgeShareSetInput = z.strictObject({
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  group_ids: z.array(z.uuid()).optional(),
  message: z.string().nullable().optional(),
});
export const TicketKindCreateInput = z.strictObject({
  name: z.string().optional(),
  color_key: z.string().optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindUpdateInput = z.strictObject({
  name: z.string().optional(),
  color_key: z.string().optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindOrderInput = z.strictObject({
  kind_ids: z.array(z.uuid()).optional(),
});
export const TicketStageCreateInput = z.strictObject({
  name: z.string().optional(),
  color_key: z.string().optional(),
});
export const TicketStageUpdateInput = z.strictObject({
  name: z.string().optional(),
  color_key: z.string().optional(),
});
export const TicketStageOrderInput = z.strictObject({
  stage_ids: z.array(z.uuid()).optional(),
});
export const TicketFieldCreateInput = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  kind_ids: z.array(z.uuid()).optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
});
export const TicketFieldUpdateInput = z.strictObject({
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
  kind_ids: z.array(z.uuid()).optional(),
});
export const TicketFieldOrderInput = z.strictObject({
  field_ids: z.array(z.uuid()).optional(),
});
export const ActionRunStopInput = z.strictObject({

});
export const ApprovalStopInput = z.strictObject({

});
export const ApprovalWithdrawInput = z.strictObject({

});
export const ApprovalEditInput = z.strictObject({
  text: z.string().optional(),
  version: z.number().int().optional(),
});
export const DryRunInput = z.strictObject({

});
export const ConversationSay = z.strictObject({
  text: z.string().optional(),
});
export const ConversationStopInput = z.strictObject({

});
export const ConversationEntriesInput = z.strictObject({
  entries: z.array(z.unknown()).optional(),
});
export const BridgeBrowserStateInput = z.strictObject({
  browser: z.string().optional(),
  state: z.string().optional(),
});
export const TicketAgentMessageInput = z.strictObject({
  text: z.string().optional(),
});
export const BulkApprovalPreviewInput = z.strictObject({
  approval_ids: z.array(z.uuid()).nullable().optional(),
});
export const BulkApproveInput = z.strictObject({
  approval_ids: z.array(z.uuid()).optional(),
});
export const DraftConversationStartInput = z.strictObject({

});
export const DraftMessageInput = z.strictObject({
  text: z.string().optional(),
  draft: z.record(z.string(), z.unknown()).optional(),
  edited: z.array(z.unknown()).nullable().optional(),
});
export const ConversationAdoptInput = z.strictObject({
  ticket_id: z.uuid().optional(),
});
export const ScopeCreateInput = z.strictObject({
  name: z.string().optional(),
  ticket_prefix: z.string().optional(),
  parent_id: z.uuid().optional(),
  layer_id: z.uuid().optional(),
  color: z.string().optional(),
  manager_member_ids: z.array(z.uuid()).optional(),
  member_ids: z.array(z.uuid()).optional(),
});
export const LayerCreateInput = z.strictObject({
  label: z.string().optional(),
  order_no: z.number().int().optional(),
});
export const LayerUpdateInput = z.strictObject({
  label: z.string().optional(),
  order_no: z.number().int().optional(),
});
export const ScopeUpdateInput = z.strictObject({
  name: z.string().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  manager_member_ids: z.array(z.uuid()).optional(),
});
export const MemberRoleInput = z.strictObject({
  role_key: z.string().optional(),
  scope_id: z.uuid().optional(),
});
export const MemberGroupsInput = z.strictObject({
  primary_scope_id: z.uuid().optional(),
  add_scope_ids: z.array(z.uuid()).optional(),
  remove_scope_ids: z.array(z.uuid()).optional(),
  role_key: z.string().optional(),
});
export const MemberSuspendInput = z.strictObject({

});
export const MemberResumeInput = z.strictObject({

});
export const WorkspaceUpdateInput = z.strictObject({
  name: z.string().optional(),
});
export const WorkspaceLogoInput = z.strictObject({

});
export const WorkspacePermissionsInput = z.strictObject({
  billing: z.string().optional(),
  delete_workspace: z.string().optional(),
});
export const WorkspaceDeletionInput = z.strictObject({
  confirm_name: z.string().optional(),
});
export const MeUpdateInput = z.strictObject({
  name: z.string().nullable().optional(),
  call_name: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  week_start: z.number().int().nullable().optional(),
  timezone: z.string().nullable().optional(),
});
export const AvatarUploadInput = z.strictObject({

});
export const EmailChangeInput = z.strictObject({
  email: z.string().optional(),
});
export const EmailChangeVerifyInput = z.strictObject({
  token: z.string().optional(),
});
export const MySessionsRevokeInput = z.strictObject({

});
export const NotificationSettingsUpdateInput = z.strictObject({
  workspace_id: z.uuid().nullable().optional(),
  email_digest: z.boolean().nullable().optional(),
  quiet_hours: z.record(z.string(), z.unknown()).nullable().optional(),
  pause: z.string().nullable().optional(),
  urgent_override: z.array(z.unknown()).nullable().optional(),
  events: z.array(z.unknown()).nullable().optional(),
});
export const NotificationSettingsCopyInput = z.strictObject({
  from_workspace_id: z.uuid().optional(),
  to_workspace_ids: z.array(z.uuid()).optional(),
});
export const MemberRemoveInput = z.strictObject({
  transfer_to_member_id: z.uuid().optional(),
  transfers: z.array(z.unknown()).optional(),
});
export const WorkspaceSwitchInput = z.strictObject({

});
export const GuestGroupInput = z.strictObject({
  name: z.string().optional(),
  request_scope_id: z.uuid().optional(),
});
export const PortalTicketMessageInput = z.strictObject({
  body: z.string().optional(),
});
export const ClientRequestRouteInput = z.strictObject({
  route_id: z.uuid().optional(),
});
export const ClientRequestReplyInput = z.strictObject({
  body: z.string().optional(),
});
export const ClientRequestAcceptInput = z.strictObject({
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  assignee_member_id: z.uuid().optional(),
  due_on: z.string().optional(),
  scope_id: z.uuid().optional(),
  kind_id: z.uuid().nullable().optional(),
  guest_group_ids: z.array(z.uuid()).nullable().optional(),
});
export const ClientRequestDeclineInput = z.strictObject({
  reason: z.string().optional(),
});
export const ClientRequestDraftInput = z.strictObject({

});
export const ClientRequestDraftResultInput = z.strictObject({
  draft: z.record(z.string(), z.unknown()).nullable().optional(),
  failed: z.string().nullable().optional(),
});
export const PortalRequestCreateInput = z.strictObject({
  body: z.string().optional(),
  due_on: z.string().nullable().optional(),
  attachment_ids: z.array(z.uuid()).nullable().optional(),
});
export const PortalRequestMessageInput = z.strictObject({
  body: z.string().optional(),
});
export const PortalAttachmentInput = z.strictObject({
  name: z.string().optional(),
  content_type: z.string().optional(),
  data: z.string().optional(),
});
export const PortalQuestionsInput = z.strictObject({
  body: z.string().optional(),
});
export const GuestGroupRenameInput = z.strictObject({
  name: z.string().optional(),
});
export const OpsSetupInput = z.strictObject({
  token: z.string().optional(),
  name: z.string().nullable().optional(),
});
export const InquiryCreateInput = z.strictObject({
  topic: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  attachment_ids: z.array(z.uuid()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export const InquiryMessageInput = z.strictObject({
  body: z.string().optional(),
  attachment_ids: z.array(z.uuid()).optional(),
});
export const InquiryResolveInput = z.strictObject({

});
export const InquiryAttachmentInput = z.strictObject({
  name: z.string().optional(),
  content_type: z.string().optional(),
  size: z.number().int().optional(),
});
export const OpsInquiryUpdateInput = z.strictObject({
  take: z.boolean().optional(),
  release: z.boolean().optional(),
  state: z.string().optional(),
  later_until: z.string().nullable().optional(),
});
export const OpsInquiryReplyInput = z.strictObject({
  body: z.string().optional(),
});
export const OpsInquiryNoteInput = z.strictObject({
  body: z.string().optional(),
});
export const OpsMemberAddInput = z.strictObject({
  email: z.string().optional(),
  caps: z.array(z.string()).optional(),
});
export const PlanProposalCreateInput = z.strictObject({
  plan_key: z.string().optional(),
  price_monthly: z.number().int().optional(),
  member_limit: z.number().int().optional(),
  trial_days: z.number().int().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
});
export const PlanProposalUpdateInput = z.strictObject({
  price_monthly: z.number().int().optional(),
  member_limit: z.number().int().optional(),
  trial_days: z.number().int().optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().optional(),
});
export const PlanProposalDecideInput = z.strictObject({
  notice_body: z.string().optional(),
});
export const PlanProposalReturnInput = z.strictObject({
  reason: z.string().optional(),
});
export const KindTemplateUpdateApplyInput = z.strictObject({
  choice: z.string().optional(),
});
export const OpsPwnedAckInput = z.strictObject({

});
export const OpsWorkspaceStopInput = z.strictObject({
  reason_key: z.string().optional(),
  mode: z.string().optional(),
  stop_on: z.iso.date().optional(),
  note: z.string().optional(),
  admin_notice: z.string().optional(),
});
export const NoticeReadInput = z.strictObject({

});
export const OpsNoticePublishInput = z.strictObject({

});
export const IncidentUpdateInput = z.strictObject({
  state: z.string().optional(),
  body: z.string().optional(),
});
export const WorkspaceNoticeInput = z.strictObject({
  title: z.string().optional(),
  body: z.string().optional(),
  placements: z.array(z.string()).optional(),
  admins_only: z.boolean().optional(),
});
export const BillingContactInput = z.strictObject({
  company: z.string().optional(),
  attn: z.string().optional(),
  email: z.string().optional(),
});
export const PlanChangeInput = z.strictObject({
  plan_key: z.string().optional(),
});
export const OpsInvoiceIssueInput = z.strictObject({
  month: z.string().optional(),
  dry_run: z.boolean().optional(),
});
export const PaymentRecordInput = z.strictObject({
  amount: z.number().int().optional(),
  paid_on: z.iso.date().optional(),
  payer_name: z.string().optional(),
  reverses_payment_id: z.uuid().optional(),
});
export const OpsPlanChangeInput = z.strictObject({
  plan_key: z.string().optional(),
  inquiry_id: z.uuid().optional(),
});
export const OpsVerificationResendInput = z.strictObject({

});
export const OpsPeekOpenInput = z.strictObject({
  reason: z.string().optional(),
  minutes: z.number().int().optional(),
  inquiry_id: z.uuid().optional(),
});
export const OpsWorkspaceResumeInput = z.strictObject({
  note: z.string().optional(),
});
export const OpsMemberCapsInput = z.strictObject({
  caps: z.array(z.string()).optional(),
});
export const OpsTemplateReleaseInput = z.strictObject({
  items: z.array(z.unknown()).optional(),
  change_reason: z.string().optional(),
  dry_run: z.boolean().optional(),
});
export const OpsNoticeCreateInput = z.strictObject({
  kind: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  audience_mode: z.string().optional(),
  audience_plans: z.array(z.string()).optional(),
  audience_workspace_ids: z.array(z.uuid()).optional(),
  placements: z.array(z.string()).optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  impact: z.string().nullable().optional(),
});
export const OpsNoticeUpdateInput = z.strictObject({
  kind: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  audience_mode: z.string().optional(),
  audience_plans: z.array(z.string()).optional(),
  audience_workspace_ids: z.array(z.uuid()).optional(),
  placements: z.array(z.string()).optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  impact: z.string().nullable().optional(),
});
export const OpsInvoiceTemplateInput = z.strictObject({
  company: z.string().optional(),
  address: z.string().optional(),
  reg_no: z.string().optional(),
  contact: z.string().optional(),
  payee: z.string().optional(),
  note: z.string().optional(),
  version: z.number().int().optional(),
});
export const OpsPwnedPendingAckInput = z.strictObject({

});
export const ScopeOverview = z.strictObject({
  by_stage: z.array(z.unknown()).optional(),
  milestones: z.array(z.unknown()).optional(),
  recent: z.array(z.unknown()).optional(),
  total: z.number().int().optional(),
});
export const TicketKindChangePreview = z.strictObject({
  added_sections: z.array(z.unknown()).optional(),
  removed_sections: z.array(z.unknown()).optional(),
  moved_to_body: z.array(z.unknown()).optional(),
  checks_reset: z.boolean().optional(),
});
export const TicketDeletePreview = z.strictObject({
  children: z.number().int().optional(),
  descendants: z.number().int().optional(),
  attachments: z.number().int().optional(),
  artifacts: z.number().int().optional(),
  pending_approvals: z.number().int().optional(),
  links: z.number().int().optional(),
  running_runs: z.number().int().optional(),
  descendant_pending_approvals: z.number().int().optional(),
  descendant_running_runs: z.number().int().optional(),
  restorable_until: z.string().optional(),
});
export const SearchHit = z.strictObject({
  kind: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  url: z.string().optional(),
});
export const TimelineItem = z.strictObject({
  id: z.string().optional(),
  kind: z.string().optional(),
  at: z.string().optional(),
  actor: z.record(z.string(), z.unknown()).nullable().optional(),
  message: z.record(z.string(), z.unknown()).nullable().optional(),
  changes: z.array(z.unknown()).nullable().optional(),
  run: z.record(z.string(), z.unknown()).nullable().optional(),
  deleted: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TestSpecLint = z.strictObject({
  missing: z.array(z.unknown()).optional(),
  warnings: z.array(z.unknown()).optional(),
});
export const TicketCompletion = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  unchecked: z.record(z.string(), z.unknown()).optional(),
});
export const BulkResult = z.strictObject({
  updated: z.array(z.unknown()).optional(),
  skipped: z.array(z.unknown()).optional(),
});
export const ApprovalQueueItem = z.strictObject({
  kind: z.string().optional(),
  id: z.string().optional(),
  ticket_id: z.string().nullable().optional(),
  ticket_number: z.string().optional(),
  title: z.string().optional(),
  from_member_id: z.string().optional(),
  from_name: z.string().optional(),
  check_summary: z.string().optional(),
  due_on: z.string().nullable().optional(),
  decide_inline: z.boolean().optional(),
  irreversible: z.boolean().optional(),
  primary_action: z.string().optional(),
  secondary_action: z.string().optional(),
  note: z.string().nullable().optional(),
  created_at: z.string().optional(),
  handover_kind: z.string().nullable().optional(),
  reply_due: z.string().nullable().optional(),
  carry_children: z.number().int().nullable().optional(),
  to_scope_name: z.string().nullable().optional(),
  ticket_scope_name: z.string().nullable().optional(),
});
export const ApprovalDetail = z.strictObject({
  approval: z.record(z.string(), z.unknown()).optional(),
  ticket: z.record(z.string(), z.unknown()).optional(),
  operation: z.record(z.string(), z.unknown()).optional(),
  message_text: z.string().optional(),
  artifact_version: z.record(z.string(), z.unknown()).optional(),
  checks: z.array(z.unknown()).optional(),
  check_summary: z.string().optional(),
  cautions: z.array(z.unknown()).optional(),
  irreversible: z.boolean().optional(),
  can_decide: z.boolean().optional(),
  chain: z.array(z.unknown()).optional(),
});
export const CloneNow = z.strictObject({
  pc: z.record(z.string(), z.unknown()).optional(),
  current: z.record(z.string(), z.unknown()).nullable().optional(),
  next: z.array(z.unknown()).optional(),
  waiting_approvals: z.number().int().optional(),
  stopped: z.number().int().optional(),
});
export const CloneGrowth = z.strictObject({
  assigned: z.number().int().optional(),
  pass_rate: z.number().int().nullable().optional(),
  pass_rate_last_week: z.number().int().nullable().optional(),
  work_seconds: z.number().int().optional(),
});
export const CloneActivity = z.strictObject({
  id: z.uuid().optional(),
  at: z.string().optional(),
  kind: z.string().optional(),
  ticket_id: z.uuid().optional(),
  ticket_number: z.string().optional(),
  title: z.string().optional(),
  result: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export const SignupCreated = z.strictObject({
  email: z.string().optional(),
  sent: z.boolean().optional(),
  mail_error: z.string().nullable().optional(),
  mail_error_kind: z.string().nullable().optional(),
  expires_at: z.string().optional(),
  signup_token: z.string().optional(),
});
export const SignupResent = z.strictObject({
  email: z.string().nullable().optional(),
  sent: z.boolean().optional(),
  mail_error: z.string().nullable().optional(),
  mail_error_kind: z.string().nullable().optional(),
  pending: z.boolean().optional(),
  registered: z.boolean().optional(),
  expired: z.boolean().optional(),
});
export const SignupStatus = z.strictObject({
  state: z.string().optional(),
  email: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});
export const SignupVerified = z.strictObject({
  email: z.string().optional(),
  token: z.string().nullable().optional(),
  signed_in: z.boolean().optional(),
  terms_pending: z.boolean().optional(),
});
export const PasswordForgotAccepted = z.strictObject({
  accepted: z.boolean().optional(),
});
export const SignInResult = z.strictObject({
  token: z.string().nullable().optional(),
  two_factor: z.boolean().optional(),
  pending: z.string().nullable().optional(),
});
export const SignInCodeResult = z.strictObject({
  token: z.string().optional(),
  backup_codes_left: z.number().int().optional(),
});
export const SignedOut = z.strictObject({
  signed_out: z.boolean().optional(),
});
export const AdminRecoveryResult = z.strictObject({
  result: z.string().optional(),
});
export const PasswordResetDone = z.strictObject({
  reset: z.boolean().optional(),
});
export const CurrentTerms = z.strictObject({
  id: z.string().optional(),
  kind: z.string().optional(),
  version: z.string().optional(),
  url: z.string().optional(),
  published_at: z.string().optional(),
});
export const TermsConsented = z.strictObject({
  consented: z.boolean().optional(),
});
export const ConversationCreated = z.strictObject({
  id: z.uuid().optional(),
  conversation_id: z.uuid().optional(),
});
export const ConversationUpdated = z.strictObject({
  id: z.uuid().optional(),
  ok: z.boolean().optional(),
});
export const MySecurity = z.strictObject({
  passkeys: z.array(z.unknown()).optional(),
  has_password: z.boolean().optional(),
  two_factor: z.boolean().optional(),
  two_factor_required: z.boolean().optional(),
  backup_codes_left: z.number().int().nullable().optional(),
  mfa_pending: z.boolean().optional(),
});
export const TwoFactorSetup = z.strictObject({
  otpauth_uri: z.string().optional(),
  secret: z.string().optional(),
});
export const TwoFactorEnabled = z.strictObject({
  backup_codes: z.array(z.string()).optional(),
  token: z.string().nullable().optional(),
});
export const BackupCodes = z.strictObject({
  codes: z.array(z.unknown()).optional(),
});
export const StepUp = z.strictObject({
  step_up_at: z.string().optional(),
  valid_until: z.string().optional(),
});
export const PasswordChanged = z.strictObject({
  revoked: z.number().int().optional(),
});
export const PasswordSet = z.strictObject({
  ok: z.boolean().optional(),
});
export const Me = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  workspaces: z.array(z.unknown()).optional(),
  workspace_name: z.string().nullable().optional(),
});
export const MyUsage = z.strictObject({
  five_hour: z.record(z.string(), z.unknown()).optional(),
  month: z.record(z.string(), z.unknown()).optional(),
  by_workspace: z.array(z.unknown()).optional(),
  notify_at_percent: z.number().int().optional(),
  on_exhausted: z.string().optional(),
});
export const SetupTask = z.strictObject({
  key: z.string().optional(),
  label: z.string().optional(),
  desc: z.string().optional(),
  done: z.boolean().optional(),
  href: z.string().nullable().optional(),
  available: z.boolean().optional(),
  optional: z.boolean().optional(),
  skipped: z.boolean().optional(),
});
export const SetupTasksDismissed = z.strictObject({
  dismissed: z.boolean().optional(),
  skipped: z.array(z.string()).optional(),
});
export const PairingCode = z.strictObject({
  code: z.string().optional(),
  expires_at: z.string().optional(),
});
export const BridgeRelease = z.strictObject({
  released: z.boolean().optional(),
  version: z.string().optional(),
  released_at: z.string().optional(),
  update: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const BridgeClaim = z.strictObject({
  device_token: z.string().optional(),
  device_id: z.string().optional(),
  member_id: z.string().optional(),
  device_label: z.string().optional(),
});
export const BridgeReleaseLink = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const BridgeHeartbeat = z.strictObject({
  ok: z.boolean().optional(),
  browser: z.string().nullable().optional(),
  outdated: z.boolean().optional(),
  device_id: z.string().optional(),
});
export const BridgeDevice = z.strictObject({
  id: z.string().optional(),
  device_label: z.string().nullable().optional(),
  state: z.string().optional(),
  last_seen_at: z.string().nullable().optional(),
  connected_at: z.string().optional(),
  version: z.string().nullable().optional(),
  health: z.array(z.unknown()).optional(),
  health_at: z.string().nullable().optional(),
  browser: z.string().optional(),
  revoke_reason: z.string().nullable().optional(),
});
export const TicketDetail = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  kind: z.record(z.string(), z.unknown()).nullable().optional(),
  stage: z.record(z.string(), z.unknown()).nullable().optional(),
  assignee: z.record(z.string(), z.unknown()).nullable().optional(),
  can: z.record(z.string(), z.unknown()).optional(),
  approval: z.record(z.string(), z.unknown()).nullable().optional(),
  completed: z.record(z.string(), z.unknown()).nullable().optional(),
  time: z.record(z.string(), z.unknown()).optional(),
  hold: z.record(z.string(), z.unknown()).nullable().optional(),
  guest_share: z.record(z.string(), z.unknown()).optional(),
  handover: z.record(z.string(), z.unknown()).nullable().optional(),
  handover_kinds: z.array(z.string()).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  fields: z.array(z.unknown()).optional(),
  spec_count: z.number().int().optional(),
  spec_unchecked: z.number().int().optional(),
  no_spec_reason: z.string().nullable().optional(),
  parent: z.record(z.string(), z.unknown()).nullable().optional(),
  child_count: z.number().int().optional(),
  link_count: z.number().int().optional(),
  results: z.record(z.string(), z.unknown()).optional(),
});
export const TicketKindChoice = z.strictObject({
  id: z.string().optional(),
  name: z.string().optional(),
  color: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
  fields: z.array(z.unknown()).optional(),
  color_key: z.string().nullable().optional(),
});
export const TicketDraft = z.strictObject({
  draft_id: z.string().optional(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  saved_at: z.string().nullable().optional(),
});
export const BridgeJob = z.strictObject({
  job: z.record(z.string(), z.unknown()).nullable().optional(),
  forbidden_domains: z.array(z.unknown()).optional(),
  next_ms: z.number().int().optional(),
  outdated: z.boolean().optional(),
});
export const JobControl = z.strictObject({
  stop: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  steers: z.array(z.unknown()).optional(),
});
export const TicketDelegation = z.strictObject({
  run_id: z.string().optional(),
  job_id: z.string().optional(),
  status: z.string().optional(),
  pc: z.string().optional(),
});
export const ApprovalDecided = z.strictObject({
  id: z.string().optional(),
  decision: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  ticket_id: z.string().nullable().optional(),
  run_id: z.string().nullable().optional(),
  pc: z.string().optional(),
});
export const BridgeFinish = z.strictObject({
  ok: z.boolean().optional(),
  outcome: z.string().optional(),
});
export const BridgeToolResult = z.strictObject({
  result: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const ActionRunView = z.strictObject({
  id: z.string().optional(),
  ticket_id: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  by: z.record(z.string(), z.unknown()).optional(),
  pc: z.string().optional(),
  silent: z.boolean().optional(),
  last_event_at: z.string().nullable().optional(),
  progress: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
  return_reason: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  taken_over_at: z.string().nullable().optional(),
  sweep_failed_at: z.string().nullable().optional(),
  reason_kind: z.string().nullable().optional(),
  checks: z.record(z.string(), z.unknown()).optional(),
});
export const ResolvedCredential = z.strictObject({
  credential_id: z.uuid().optional(),
  kind: z.string().optional(),
  name: z.string().optional(),
  destinations: z.array(z.unknown()).optional(),
  two_factor: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  server_key: z.string().optional(),
  iv: z.string().optional(),
  tag: z.string().optional(),
  ciphertext_for_executor: z.string().optional(),
});
export const PlanProposalImpact = z.strictObject({
  customers: z.number().int().optional(),
  stopped: z.number().int().optional(),
  monthly_revenue_diff: z.number().int().optional(),
  immediate: z.boolean().optional(),
  existing_from: z.string().nullable().optional(),
  new_from: z.string().nullable().optional(),
  by_workspace: z.array(z.unknown()).optional(),
});
export const WorkspaceMembers = z.strictObject({
  groups: z.array(z.unknown()).optional(),
  invitations: z.array(z.unknown()).optional(),
  alerts: z.array(z.unknown()).optional(),
  count: z.number().int().optional(),
});
export const InvitationLink = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const PlanChoice = z.strictObject({
  plan_key: z.string().optional(),
  name: z.string().nullable().optional(),
  price_monthly: z.number().int().nullable().optional(),
  member_limit: z.number().int().nullable().optional(),
  current: z.boolean().optional(),
  can_choose: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  effective_from: z.string().optional(),
  summary: z.string().optional(),
  recommended: z.boolean().optional(),
  upgrade: z.record(z.string(), z.unknown()).nullable().optional(),
  upcoming: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const Billing = z.strictObject({
  terms: z.string().optional(),
  payee: z.record(z.string(), z.unknown()).optional(),
  contact: z.record(z.string(), z.unknown()).optional(),
  invoices: z.array(z.unknown()).optional(),
  overdue: z.record(z.string(), z.unknown()).nullable().optional(),
  free: z.boolean().optional(),
  can_edit_contact: z.boolean().optional(),
});
export const SignedUrl = z.strictObject({
  url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const ClientRequestDetail = z.strictObject({
  request: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  routes: z.array(z.unknown()).optional(),
  can_act: z.boolean().optional(),
  pc_connected: z.boolean().optional(),
  ticket_draft: z.record(z.string(), z.unknown()).nullable().optional(),
  questions: z.array(z.unknown()).optional(),
  reply_draft: z.string().nullable().optional(),
  route_suggestion: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const PortalHome = z.strictObject({
  group_name: z.string().optional(),
  tenant_name: z.string().optional(),
  request_scope_name: z.string().nullable().optional(),
  me: z.record(z.string(), z.unknown()).optional(),
  first_visit: z.boolean().optional(),
  requests: z.array(z.unknown()).optional(),
  tickets: z.array(z.unknown()).optional(),
});
export const PortalQuestions = z.strictObject({
  available: z.boolean().optional(),
  questions: z.array(z.unknown()).optional(),
});
export const PortalRequest = z.strictObject({
  request: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  can_write: z.boolean().optional(),
});
export const PortalTicket = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
});
export const KnowledgeTree = z.strictObject({
  company_name: z.string().optional(),
  company_nodes: z.array(z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  my_nodes: z.array(z.unknown()).optional(),
  can_write: z.record(z.string(), z.unknown()).optional(),
  admin_counts: z.record(z.string(), z.unknown()).nullable().optional(),
  truncated: z.boolean().optional(),
});
export const KnowledgePageDetail = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
  desc: z.string().optional(),
  state: z.string().optional(),
  must: z.boolean().optional(),
  must_blocked: z.string().nullable().optional(),
  place: z.record(z.string(), z.unknown()).optional(),
  acts: z.array(z.string()).optional(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  draft: z.record(z.string(), z.unknown()).nullable().optional(),
  request: z.record(z.string(), z.unknown()).nullable().optional(),
  copied_from: z.record(z.string(), z.unknown()).nullable().optional(),
  shared_from: z.record(z.string(), z.unknown()).nullable().optional(),
  raise_to: z.record(z.string(), z.unknown()).nullable().optional(),
  foot: z.record(z.string(), z.unknown()).optional(),
});
export const OpsWorkspaceRow = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  admin_name: z.string().optional(),
  plan_name: z.string().nullable().optional(),
  members: z.record(z.string(), z.unknown()).optional(),
  pc: z.record(z.string(), z.unknown()).nullable().optional(),
  runs_month: z.number().int().nullable().optional(),
  attention: z.array(z.unknown()).optional(),
  billing_state: z.string().nullable().optional(),
  state: z.string().optional(),
  state_since: z.string().optional(),
});
export const OpsWorkspace = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  plan_name: z.string().nullable().optional(),
  state: z.string().optional(),
  stop: z.record(z.string(), z.unknown()).nullable().optional(),
  admin: z.record(z.string(), z.unknown()).optional(),
  members: z.record(z.string(), z.unknown()).optional(),
  inquiries: z.record(z.string(), z.unknown()).optional(),
  pc: z.record(z.string(), z.unknown()).nullable().optional(),
  runs_month: z.record(z.string(), z.unknown()).optional(),
  stuck_runs: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), z.unknown()).optional(),
  recent: z.array(z.unknown()).optional(),
  peek: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const OpsWorkspaceMember = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  role_label: z.string().optional(),
  last_seen_at: z.string().nullable().optional(),
  pc: z.string().optional(),
  login_methods: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
});
export const OpsWorkspaceBilling = z.strictObject({
  plan: z.record(z.string(), z.unknown()).optional(),
  members: z.record(z.string(), z.unknown()).optional(),
  payment_terms: z.string().optional(),
  invoices: z.array(z.unknown()).optional(),
});
export const Shell = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  approvals_waiting: z.number().int().optional(),
  notifications_unread: z.number().int().optional(),
  groups: z.array(z.unknown()).optional(),
  pc: z.record(z.string(), z.unknown()).optional(),
  setup_left: z.number().int().optional(),
  banner: z.record(z.string(), z.unknown()).optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
  saved_views: z.array(z.unknown()).nullable().optional(),
  service_status: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const OpsShell = z.strictObject({
  operator: z.record(z.string(), z.unknown()).optional(),
  inbox: z.record(z.string(), z.unknown()).optional(),
  invoices: z.record(z.string(), z.unknown()).nullable().optional(),
  workspaces: z.record(z.string(), z.unknown()).optional(),
  runs_month: z.record(z.string(), z.unknown()).optional(),
  pwned: z.record(z.string(), z.unknown()).optional(),
});
export const OpsInquiryDetail = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().nullable().optional(),
  topic: z.string().optional(),
  state: z.string().optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
  asker: z.record(z.string(), z.unknown()).optional(),
  owner: z.record(z.string(), z.unknown()).nullable().optional(),
  later_until: z.string().nullable().optional(),
  created_at: z.string().optional(),
  last_message_at: z.string().nullable().optional(),
  messages: z.array(z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  workspace_status: z.record(z.string(), z.unknown()).optional(),
});
export const OpsNoticeDetail = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  title: z.string().nullable().optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
  state: z.string().optional(),
  placements: z.array(z.string()).optional(),
  publish_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  incident_state: z.string().nullable().optional(),
  admins_only: z.boolean().optional(),
  body: z.string().nullable().optional(),
  maintenance: z.record(z.string(), z.unknown()).nullable().optional(),
  impact: z.string().nullable().optional(),
  updates: z.array(z.unknown()).optional(),
  reach: z.record(z.string(), z.unknown()).optional(),
});
export const PublicServiceStatus = z.strictObject({
  incidents: z.array(z.unknown()).optional(),
  maintenance: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const InvitationPreview = z.strictObject({
  state: z.string().optional(),
  workspace_name: z.string().optional(),
  inviter_name: z.string().nullable().optional(),
  group_name: z.string().nullable().optional(),
  role: z.string().optional(),
  message: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  expires_at: z.string().optional(),
  account_exists: z.boolean().optional(),
  signed_in: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const InvitationAccepted = z.strictObject({
  token: z.string().optional(),
  workspace_id: z.string().optional(),
  next: z.string().optional(),
  state: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});
export const ServiceStatus = z.strictObject({
  components: z.array(z.unknown()).optional(),
  bands: z.array(z.unknown()).optional(),
  maintenance_now: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const InvitationResendResult = z.strictObject({
  result: z.string().optional(),
});
export const Credential = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  layer: z.string().optional(),
  kind: z.string().optional(),
  two_factor: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  expires_on: z.string().nullable().optional(),
  use_count: z.number().int().optional(),
  last_used_at: z.string().nullable().optional(),
  login_check: z.record(z.string(), z.unknown()).optional(),
  can_edit: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const CredentialDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const CredentialLoginCheck = z.strictObject({
  state: z.string().optional(),
  job_id: z.uuid().nullable().optional(),
});
export const CredentialLoginAnswer = z.strictObject({
  accepted: z.boolean().optional(),
});
export const CredentialCheckReport = z.strictObject({
  accepted: z.boolean().optional(),
  code: z.string().nullable().optional(),
});
export const RevokedDevice = z.strictObject({
  id: z.string().optional(),
  device_label: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
  revoke_reason: z.string().optional(),
});
export const DeviceBrowser = z.strictObject({
  id: z.uuid().optional(),
  browser: z.string().optional(),
});
export const DeviceBrowserCheck = z.strictObject({
  job_id: z.uuid().optional(),
});
export const BridgeBrowser = z.strictObject({
  browser: z.string().optional(),
});
export const TicketTimelineSeen = z.strictObject({
  ticket_id: z.string().optional(),
  seen_at: z.string().optional(),
});
export const TicketMessageStar = z.strictObject({
  id: z.string().optional(),
  stars: z.number().int().optional(),
  starred: z.boolean().optional(),
});
export const TicketUpdated = z.strictObject({
  ticket: z.record(z.string(), z.unknown()).optional(),
  stage: z.record(z.string(), z.unknown()).nullable().optional(),
  changed: z.boolean().optional(),
  message_id: z.uuid().nullable().optional(),
});
export const TicketDecision = z.strictObject({
  id: z.uuid().optional(),
  ticket_id: z.uuid().optional(),
  text: z.string().optional(),
  reason: z.string().nullable().optional(),
  decided_by: z.record(z.string(), z.unknown()).nullable().optional(),
  decided_note: z.string().nullable().optional(),
  decided_at: z.string().optional(),
  source: z.record(z.string(), z.unknown()).nullable().optional(),
  revises_id: z.uuid().nullable().optional(),
  superseded_by_id: z.uuid().nullable().optional(),
  cancelled: z.record(z.string(), z.unknown()).nullable().optional(),
  promoted_to: z.string().optional(),
});
export const TicketDecisionCreated = z.strictObject({
  decision: z.record(z.string(), z.unknown()).optional(),
  message_id: z.uuid().optional(),
});
export const TicketDecisionChange = z.strictObject({
  decision: z.record(z.string(), z.unknown()).optional(),
  previous: z.record(z.string(), z.unknown()).nullable().optional(),
  message_id: z.uuid().optional(),
});
export const HandoverPreview = z.strictObject({
  kinds: z.array(z.string()).optional(),
  blocked: z.string().nullable().optional(),
  waiting: z.record(z.string(), z.unknown()).nullable().optional(),
  default_reply_due: z.string().optional(),
  rules: z.array(z.unknown()).optional(),
  children: z.record(z.string(), z.unknown()).optional(),
  links: z.record(z.string(), z.unknown()).optional(),
  group: z.record(z.string(), z.unknown()).optional(),
  candidates: z.array(z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
});
export const HandoverRule = z.strictObject({
  id: z.uuid().optional(),
  target: z.string().optional(),
  axis_id: z.uuid().nullable().optional(),
  axis_name: z.string().nullable().optional(),
  mode: z.string().optional(),
});
export const TicketHandoverCreated = z.strictObject({
  id: z.uuid().optional(),
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  state: z.string().optional(),
  from: z.record(z.string(), z.unknown()).optional(),
  to: z.record(z.string(), z.unknown()).nullable().optional(),
  to_scope: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.string().nullable().optional(),
  switch: z.record(z.string(), z.unknown()).optional(),
  switch_applied: z.record(z.string(), z.unknown()).nullable().optional(),
  notify_managers: z.boolean().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export const TicketHandoverAnswered = z.strictObject({
  id: z.uuid().optional(),
  ticket_id: z.uuid().optional(),
  kind: z.string().optional(),
  state: z.string().optional(),
  from: z.record(z.string(), z.unknown()).optional(),
  to: z.record(z.string(), z.unknown()).nullable().optional(),
  to_scope: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.string().nullable().optional(),
  switch: z.record(z.string(), z.unknown()).optional(),
  switch_applied: z.record(z.string(), z.unknown()).nullable().optional(),
  notify_managers: z.boolean().optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export const TicketHandover = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  state: z.string().optional(),
  from: z.record(z.string(), z.unknown()).optional(),
  to: z.record(z.string(), z.unknown()).nullable().optional(),
  to_scope: z.record(z.string(), z.unknown()).nullable().optional(),
  ticket_scope: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().nullable().optional(),
  ask: z.string().nullable().optional(),
  reply_due: z.string().nullable().optional(),
  overdue: z.boolean().optional(),
  switch: z.record(z.string(), z.unknown()).optional(),
  decline_reason: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  reminded_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  can: z.record(z.string(), z.unknown()).optional(),
});
export const HandoverWithdrawn = z.strictObject({
  id: z.uuid().optional(),
  state: z.string().optional(),
  decided_at: z.string().optional(),
});
export const HandoverReminded = z.strictObject({
  id: z.uuid().optional(),
  reminded_at: z.string().optional(),
});
export const TicketHandoverClaimed = z.strictObject({
  id: z.uuid().optional(),
  state: z.string().optional(),
  ticket_id: z.uuid().optional(),
  assignee_member_id: z.uuid().optional(),
});
export const InvitationsSent = z.strictObject({
  invitations: z.array(z.unknown()).optional(),
});
export const InvitationJoinConfirmed = z.strictObject({
  token: z.string().optional(),
  workspace_id: z.uuid().optional(),
  next: z.string().optional(),
});
export const BodySaved = z.strictObject({
  version: z.number().int().optional(),
  changed: z.boolean().optional(),
  edited_at: z.string().optional(),
});
export const TicketVersionsView = z.strictObject({
  versions: z.array(z.unknown()).optional(),
  from: z.record(z.string(), z.unknown()).nullable().optional(),
  to: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const BodyRestored = z.strictObject({
  version: z.number().int().optional(),
  changed: z.boolean().optional(),
  edited_at: z.string().optional(),
});
export const TicketItemChangesView = z.strictObject({
  points: z.array(z.unknown()).optional(),
  from: z.number().int().nullable().optional(),
  to: z.number().int().optional(),
  diff: z.array(z.unknown()).optional(),
});
export const TestSpecItem = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
  checked: z.boolean().optional(),
  position: z.number().int().optional(),
  source: z.string().optional(),
  version: z.number().int().optional(),
  source_page: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketLink = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  side: z.string().nullable().optional(),
  other: z.record(z.string(), z.unknown()).optional(),
  can_remove: z.boolean().optional(),
  created_at: z.string().optional(),
});
export const TicketLinkDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const Notification = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  tag: z.string().optional(),
  href: z.string().nullable().optional(),
  ticket_id: z.uuid().nullable().optional(),
  number: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  actor: z.record(z.string(), z.unknown()).nullable().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  read: z.boolean().optional(),
  read_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export const NotificationsRead = z.strictObject({
  read: z.number().int().optional(),
});
export const SavedView = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  share: z.string().optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  density: z.string().optional(),
  member_id: z.uuid().optional(),
  member_name: z.string().optional(),
  mine: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const SavedViewDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const TicketDeleted = z.strictObject({
  id: z.uuid().optional(),
  deleted_count: z.number().int().optional(),
  withdrawn_approvals: z.number().int().optional(),
  stopped_runs: z.number().int().optional(),
  restorable_until: z.string().optional(),
});
export const TicketRestored = z.strictObject({
  id: z.uuid().optional(),
  restored_count: z.number().int().optional(),
});
export const TicketField = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
  position: z.number().int().optional(),
});
export const ItemRestored = z.strictObject({
  changed: z.boolean().optional(),
  restored: z.array(z.unknown()).optional(),
  skipped: z.array(z.unknown()).optional(),
});
export const KnowledgeVersionItem = z.strictObject({
  version: z.number().int().optional(),
  published_at: z.string().nullable().optional(),
  by_name: z.string().nullable().optional(),
});
export const KnowledgeVersion = z.strictObject({
  version: z.number().int().optional(),
  published_at: z.string().nullable().optional(),
  by_name: z.string().nullable().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
});
export const KnowledgeFolder = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  shelf: z.string().optional(),
  group_id: z.uuid().nullable().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  position: z.number().int().optional(),
});
export const KnowledgeFolderDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const KnowledgePageStub = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
  desc: z.string().optional(),
  state: z.string().optional(),
  must: z.boolean().optional(),
  place: z.record(z.string(), z.unknown()).optional(),
});
export const KnowledgeDraftSaved = z.strictObject({
  saved_at: z.string().optional(),
  title: z.string().optional(),
  desc: z.string().optional(),
});
export const KnowledgeDraftDiscarded = z.strictObject({
  id: z.uuid().optional(),
  page_deleted: z.boolean().optional(),
});
export const KnowledgePublished = z.strictObject({
  id: z.uuid().optional(),
  version: z.number().int().optional(),
  published_at: z.string().nullable().optional(),
});
export const KnowledgePageDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const KnowledgeMustSet = z.strictObject({
  id: z.uuid().optional(),
  must: z.boolean().optional(),
  used: z.number().int().optional(),
  limit: z.number().int().optional(),
});
export const KnowledgeSimilar = z.strictObject({
  pages: z.array(z.unknown()).optional(),
});
export const KnowledgeRequest = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  state: z.string().optional(),
  page_id: z.uuid().nullable().optional(),
  to_name: z.string().optional(),
  at: z.string().optional(),
});
export const KnowledgeRequestEnded = z.strictObject({
  id: z.uuid().optional(),
  state: z.string().optional(),
});
export const KnowledgeApproval = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  from_name: z.string().optional(),
  from_shelf_name: z.string().optional(),
  to_shelf_name: z.string().optional(),
  title: z.string().optional(),
  desc: z.string().optional(),
  message: z.string().nullable().optional(),
  requested_at: z.string().optional(),
  similar: z.record(z.string(), z.unknown()).nullable().optional(),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const KnowledgeRequestDecided = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  state: z.string().optional(),
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
});
export const KnowledgeShareChoice = z.strictObject({
  target: z.record(z.string(), z.unknown()).optional(),
  from_group_name: z.string().optional(),
  groups: z.array(z.unknown()).optional(),
});
export const KnowledgeReview = z.strictObject({
  unused: z.array(z.unknown()).optional(),
  conflicts: z.array(z.unknown()).optional(),
  broken: z.array(z.unknown()).optional(),
});
export const TicketKindSetting = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  color_key: z.string().nullable().optional(),
  position: z.number().int().optional(),
  is_builtin: z.boolean().optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const TicketStageSetting = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().nullable().optional(),
  name: z.string().optional(),
  color_key: z.string().optional(),
  position: z.number().int().optional(),
  lock: z.string().nullable().optional(),
});
export const TicketStageDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const TicketFieldSetting = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  field_type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
  position: z.number().int().optional(),
  kind_ids: z.array(z.uuid()).optional(),
  all_kinds: z.boolean().optional(),
  value_count: z.number().int().optional(),
});
export const TicketFieldDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const ActionRunStopped = z.strictObject({
  id: z.string().optional(),
  ticket_id: z.string().optional(),
  phase: z.string().optional(),
  status: z.string().optional(),
  stopped_reason: z.string().nullable().optional(),
  stopped_at: z.string().nullable().optional(),
});
export const ApprovalStopped = z.strictObject({
  id: z.string().optional(),
  decision: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  status_id: z.string().nullable().optional(),
  ticket_id: z.string().nullable().optional(),
});
export const ApprovalWithdrawn = z.strictObject({
  id: z.string().optional(),
  withdrawn_at: z.string().optional(),
  ticket_id: z.string().optional(),
  approval_id: z.string().optional(),
});
export const ApprovalEdited = z.strictObject({
  id: z.string().optional(),
  ticket_id: z.string().optional(),
  version: z.number().int().optional(),
  edited_at: z.string().optional(),
});
export const DryRunStarted = z.strictObject({
  run_id: z.string().optional(),
  job_id: z.string().optional(),
  status: z.string().optional(),
  pc: z.string().optional(),
});
export const ApprovalHistoryItem = z.strictObject({
  id: z.string().optional(),
  ticket_id: z.string().nullable().optional(),
  ticket_number: z.string().optional(),
  title: z.string().optional(),
  decision: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  next_actor: z.string().nullable().optional(),
  withdrawn_at: z.string().nullable().optional(),
  run_status: z.string().nullable().optional(),
  can_withdraw: z.boolean().optional(),
});
export const MyClone = z.strictObject({
  name: z.string().optional(),
  full_name: z.string().optional(),
  since: z.string().optional(),
  pc: z.record(z.string(), z.unknown()).optional(),
});
export const ConversationView = z.strictObject({
  conversation: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.unknown()).optional(),
  has_more: z.boolean().optional(),
  running_job_id: z.uuid().nullable().optional(),
  work: z.record(z.string(), z.unknown()).nullable().optional(),
  stopped: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const ConversationRow = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
  updated_at: z.string().optional(),
  last_text: z.string().nullable().optional(),
});
export const MessageView = z.strictObject({
  id: z.uuid().optional(),
  who: z.string().optional(),
  text: z.string().optional(),
  at: z.string().optional(),
  job_id: z.uuid().nullable().optional(),
  passed: z.array(z.unknown()).optional(),
  proposal: z.record(z.string(), z.unknown()).nullable().optional(),
  took: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const ConversationSaid = z.strictObject({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  job_id: z.string().optional(),
});
export const ConversationStopped = z.strictObject({
  state: z.string().optional(),
});
export const ConversationEntriesMirrored = z.strictObject({
  inserted: z.number().int().optional(),
});
export const MirrorTarget = z.strictObject({
  conversation_id: z.uuid().optional(),
  agent_session_id: z.string().optional(),
  job_id: z.uuid().optional(),
});
export const BridgeBrowserReported = z.strictObject({
  ok: z.boolean().optional(),
});
export const BridgeJobFile = z.strictObject({
  url: z.string().optional(),
  name: z.string().nullable().optional(),
  mime: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
});
export const TicketAgentSession = z.strictObject({
  conversation: z.record(z.string(), z.unknown()).nullable().optional(),
  messages: z.array(z.unknown()).optional(),
  has_more: z.boolean().optional(),
  running_job_id: z.uuid().nullable().optional(),
  work: z.record(z.string(), z.unknown()).nullable().optional(),
  stopped: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketAgentSent = z.strictObject({
  id: z.uuid().optional(),
  conversation_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
});
export const BulkApprovalPreview = z.strictObject({
  eligible: z.array(z.unknown()).optional(),
  excluded: z.array(z.unknown()).optional(),
  count: z.number().int().optional(),
  irreversible_count: z.number().int().optional(),
  unchecked_count: z.number().int().optional(),
});
export const DraftConversationStarted = z.strictObject({
  id: z.uuid().optional(),
});
export const DraftMessageSent = z.strictObject({
  id: z.uuid().optional(),
  conversation_id: z.uuid().optional(),
  job_id: z.uuid().optional(),
});
export const ConversationAdopted = z.strictObject({
  conversation_id: z.uuid().optional(),
  ticket_id: z.uuid().optional(),
});
export const ScopeCreated = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  layer: z.record(z.string(), z.unknown()).nullable().optional(),
  position: z.number().int().optional(),
  managers: z.array(z.unknown()).optional(),
  member_count: z.number().int().optional(),
  created_at: z.string().optional(),
});
export const LayerCreated = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
  group_count: z.number().int().optional(),
  created_at: z.string().optional(),
});
export const LayerUpdated = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
  group_count: z.number().int().optional(),
  created_at: z.string().optional(),
});
export const Layer = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  label: z.string().optional(),
  order_no: z.number().int().optional(),
  group_count: z.number().int().optional(),
  created_at: z.string().optional(),
});
export const ScopeUpdated = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  layer: z.record(z.string(), z.unknown()).nullable().optional(),
  position: z.number().int().optional(),
  managers: z.array(z.unknown()).optional(),
  member_count: z.number().int().optional(),
  created_at: z.string().optional(),
});
export const ScopeListItem = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
  ticket_prefix: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  parent_id: z.uuid().nullable().optional(),
  layer: z.record(z.string(), z.unknown()).nullable().optional(),
  position: z.number().int().optional(),
  managers: z.array(z.unknown()).optional(),
  member_count: z.number().int().optional(),
  created_at: z.string().optional(),
  layer_id: z.uuid().nullable().optional(),
});
export const InvitationResent = z.strictObject({
  id: z.uuid().optional(),
  email: z.string().nullable().optional(),
  expires_at: z.string().optional(),
  mail: z.string().optional(),
});
export const InvitationRevoked = z.strictObject({
  id: z.uuid().optional(),
  revoked_at: z.string().optional(),
});
export const MemberDetail = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  groups: z.array(z.unknown()).optional(),
  assigned: z.record(z.string(), z.unknown()).optional(),
  clone: z.record(z.string(), z.unknown()).optional(),
  login: z.record(z.string(), z.unknown()).optional(),
  recent_events: z.array(z.unknown()).optional(),
});
export const MemberRoleChanged = z.strictObject({
  member_id: z.uuid().optional(),
  company_role: z.string().optional(),
  groups: z.array(z.unknown()).optional(),
});
export const MemberGroupsChanged = z.strictObject({
  member_id: z.uuid().optional(),
  company_role: z.string().optional(),
  groups: z.array(z.unknown()).optional(),
});
export const MemberStateChanged = z.strictObject({
  member_id: z.uuid().optional(),
  suspended: z.boolean().optional(),
  suspended_at: z.string().nullable().optional(),
});
export const MemberRemovalPreview = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  blocked_by: z.string().nullable().optional(),
  tickets: z.array(z.unknown()).optional(),
  handovers_cancelled: z.array(z.unknown()).optional(),
  approvals_reassigned: z.array(z.unknown()).optional(),
  sole_approver: z.array(z.unknown()).optional(),
  deleted: z.array(z.unknown()).optional(),
  kept: z.array(z.unknown()).optional(),
  restorable_until: z.string().optional(),
});
export const WorkspaceSettings = z.strictObject({
  workspace: z.record(z.string(), z.unknown()).optional(),
  permissions: z.array(z.unknown()).optional(),
  fixed_rules: z.array(z.unknown()).optional(),
  deletion: z.record(z.string(), z.unknown()).optional(),
  access: z.record(z.string(), z.unknown()).optional(),
});
export const WorkspaceRenamed = z.strictObject({
  workspace: z.record(z.string(), z.unknown()).optional(),
});
export const WorkspaceLogo = z.strictObject({
  logo: z.record(z.string(), z.unknown()).optional(),
});
export const WorkspacePermissions = z.strictObject({
  permissions: z.array(z.unknown()).optional(),
});
export const WorkspaceDeletion = z.strictObject({
  deletion: z.record(z.string(), z.unknown()).optional(),
});
export const MeUpdated = z.strictObject({
  member: z.record(z.string(), z.unknown()).optional(),
  saved_at: z.string().optional(),
});
export const Avatar = z.strictObject({
  avatar: z.record(z.string(), z.unknown()).optional(),
});
export const EmailChangeRequested = z.strictObject({
  pending_email: z.string().optional(),
  expires_at: z.string().optional(),
});
export const EmailChanged = z.strictObject({
  changed: z.boolean().optional(),
  email: z.string().optional(),
});
export const MySessions = z.strictObject({
  sessions: z.array(z.unknown()).optional(),
  events: z.array(z.unknown()).optional(),
});
export const MySessionRevoked = z.strictObject({
  revoked: z.boolean().optional(),
});
export const MySessionsRevoked = z.strictObject({
  revoked: z.number().int().optional(),
});
export const NotificationSettingsCopied = z.strictObject({
  copied_to: z.array(z.unknown()).optional(),
});
export const WorkspaceLeft = z.strictObject({
  tenant_id: z.uuid().optional(),
  left: z.boolean().optional(),
  restorable_until: z.string().optional(),
});
export const MemberRemoved = z.strictObject({
  member_id: z.uuid().optional(),
  tickets_moved: z.number().int().optional(),
  handovers_cancelled: z.number().int().optional(),
  restorable_until: z.string().optional(),
});
export const WorkspaceSwitched = z.strictObject({
  tenant_id: z.uuid().optional(),
  switched: z.boolean().optional(),
});
export const MyInvitations = z.strictObject({
  invitations: z.array(z.unknown()).optional(),
  total: z.number().int().optional(),
});
export const GuestGroupCreated = z.strictObject({
  group: z.record(z.string(), z.unknown()).optional(),
});
export const TicketGuestSharesUpdated = z.strictObject({
  shared: z.array(z.unknown()).optional(),
});
export const PortalTicketMessageCreated = z.strictObject({
  id: z.uuid().optional(),
});
export const ClientRequestList = z.strictObject({
  items: z.array(z.unknown()).optional(),
  counts: z.record(z.string(), z.unknown()).optional(),
});
export const ClientRequestRouted = z.strictObject({
  route_name: z.string().optional(),
});
export const ClientRequestReplied = z.strictObject({
  state: z.string().optional(),
});
export const ClientRequestAccepted = z.strictObject({
  ticket_id: z.uuid().optional(),
  number: z.string().optional(),
});
export const ClientRequestDeclined = z.strictObject({
  state: z.string().optional(),
});
export const ClientRequestDraftQueued = z.strictObject({
  job_id: z.uuid().optional(),
});
export const ClientRequestDraftResult = z.strictObject({
  state: z.string().optional(),
});
export const PortalRequestCreated = z.strictObject({
  id: z.uuid().optional(),
});
export const PortalRequestMessagePosted = z.strictObject({
  id: z.uuid().optional(),
});
export const PortalAttachmentAdded = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().nullable().optional(),
});
export const GuestGroupRenamed = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().optional(),
});
export const GuestGroupDeleted = z.strictObject({
  id: z.uuid().optional(),
});
export const OpsSetupSession = z.strictObject({
  token: z.string().optional(),
});
export const MyInquiry = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().nullable().optional(),
  topic: z.string().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  last_reply_at: z.string().nullable().optional(),
  has_unread_reply: z.boolean().optional(),
});
export const MyInquiryDetail = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().nullable().optional(),
  topic: z.string().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  last_reply_at: z.string().nullable().optional(),
  has_unread_reply: z.boolean().optional(),
  messages: z.array(z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const MyInquiryMessage = z.strictObject({
  id: z.uuid().optional(),
  from: z.string().optional(),
  author_name: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
});
export const InquiryAttachmentUpload = z.strictObject({
  id: z.uuid().optional(),
  upload_url: z.string().optional(),
  done_url: z.string().optional(),
  expires_at: z.string().optional(),
});
export const OpsInquiryRow = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().nullable().optional(),
  topic: z.string().optional(),
  state: z.string().optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
  asker: z.record(z.string(), z.unknown()).optional(),
  owner: z.record(z.string(), z.unknown()).nullable().optional(),
  later_until: z.string().nullable().optional(),
  created_at: z.string().optional(),
  last_message_at: z.string().nullable().optional(),
});
export const OpsInquiryMessage = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  attachments: z.array(z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
});
export const OpsMemberRow = z.strictObject({
  member_id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  caps: z.array(z.string()).optional(),
  has_passkey: z.boolean().optional(),
  setup_pending: z.boolean().optional(),
  is_self: z.boolean().optional(),
  locked_caps: z.array(z.string()).optional(),
});
export const PlanOps = z.strictObject({
  plan_key: z.string().optional(),
  name: z.string().nullable().optional(),
  version: z.number().int().optional(),
  price_monthly: z.number().int().nullable().optional(),
  member_limit: z.number().int().optional(),
  trial_days: z.number().int().optional(),
  facts: z.array(z.unknown()).optional(),
  places: z.number().int().optional(),
  proposal: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const PlanProposal = z.strictObject({
  id: z.uuid().optional(),
  plan_key: z.string().optional(),
  plan_name: z.string().optional(),
  from_version: z.number().int().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  before: z.record(z.string(), z.unknown()).optional(),
  changes: z.record(z.string(), z.unknown()).optional(),
  existing_policy: z.string().optional(),
  notice_days: z.number().int().nullable().optional(),
  new_from: z.string().nullable().optional(),
  reason: z.string().optional(),
  state: z.string().optional(),
  proposer: z.record(z.string(), z.unknown()).optional(),
  decider: z.record(z.string(), z.unknown()).nullable().optional(),
  return_reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
  submitted_at: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  can_edit: z.boolean().optional(),
  can_decide: z.boolean().optional(),
});
export const PlanHistoryRow = z.strictObject({
  id: z.uuid().optional(),
  at: z.string().optional(),
  actor_name: z.string().nullable().optional(),
  action: z.string().optional(),
  plan_name: z.string().nullable().optional(),
  to_version: z.number().int().nullable().optional(),
  reason: z.string().nullable().optional(),
  price: z.record(z.string(), z.unknown()).nullable().optional(),
  members: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const OpsTemplateRow = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  summary: z.string().optional(),
  version: z.number().int().optional(),
  using: z.number().int().optional(),
  took: z.record(z.string(), z.unknown()).nullable().optional(),
  last_released_at: z.string().nullable().optional(),
});
export const OpsTemplate = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  name: z.string().nullable().optional(),
  summary: z.string().optional(),
  version: z.number().int().optional(),
  using: z.number().int().optional(),
  took: z.record(z.string(), z.unknown()).nullable().optional(),
  last_released_at: z.string().nullable().optional(),
  items: z.array(z.unknown()).optional(),
  versions: z.array(z.unknown()).optional(),
});
export const KindTemplateUpdate = z.strictObject({
  id: z.uuid().optional(),
  part: z.string().optional(),
  part_name: z.string().optional(),
  from_version: z.number().int().optional(),
  to_version: z.number().int().optional(),
  released_at: z.string().nullable().optional(),
  diffs: z.array(z.unknown()).optional(),
});
export const OpsPwnedRow = z.strictObject({
  workspace: z.record(z.string(), z.unknown()).nullable().optional(),
  member: z.record(z.string(), z.unknown()).nullable().optional(),
  last_at: z.string().optional(),
  count: z.number().int().optional(),
});
export const OpsPwnedAck = z.strictObject({
  acknowledged_at: z.string().optional(),
  remaining: z.number().int().optional(),
});
export const Notice = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  published_at: z.string().optional(),
  unread: z.boolean().optional(),
  maintenance: z.record(z.string(), z.unknown()).nullable().optional(),
  updates: z.array(z.unknown()).optional(),
});
export const NoticeRead = z.strictObject({
  id: z.uuid().optional(),
  read_at: z.string().optional(),
});
export const OpsNoticeRow = z.strictObject({
  id: z.uuid().optional(),
  kind: z.string().optional(),
  title: z.string().nullable().optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
  state: z.string().optional(),
  placements: z.array(z.string()).optional(),
  publish_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  incident_state: z.string().nullable().optional(),
  admins_only: z.boolean().optional(),
});
export const BillingContact = z.strictObject({
  company: z.string().optional(),
  attn: z.string().optional(),
  email: z.string().optional(),
});
export const PlanChange = z.strictObject({
  plan_key: z.string().optional(),
  effective_from: z.string().optional(),
  prorated_amount: z.number().int().optional(),
  next_invoice_on: z.string().optional(),
});
export const OpsInvoiceRow = z.strictObject({
  id: z.uuid().optional(),
  workspace: z.record(z.string(), z.unknown()).optional(),
  plan_name: z.string().nullable().optional(),
  month: z.string().optional(),
  amount_total: z.number().int().optional(),
  state: z.string().optional(),
  paid_total: z.number().int().optional(),
  difference: z.number().int().optional(),
  due_on: z.string().nullable().optional(),
  can_record_payment: z.boolean().optional(),
  payments: z.array(z.unknown()).optional(),
});
export const OpsInvoiceIssue = z.strictObject({
  month: z.string().optional(),
  count: z.number().int().optional(),
  total: z.number().int().optional(),
  lines: z.array(z.unknown()).optional(),
});
export const OpsVerificationResent = z.strictObject({
  sent_at: z.string().optional(),
});
export const OpsWorkspaceInquiry = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().nullable().optional(),
  topic: z.string().optional(),
  asker_name: z.string().optional(),
  owner_name: z.string().nullable().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
});
export const OpsWorkspaceAuditRow = z.strictObject({
  id: z.uuid().optional(),
  at: z.string().optional(),
  actor_name: z.string().optional(),
  action: z.string().optional(),
  action_label: z.string().optional(),
  target_label: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const OpsPeek = z.strictObject({
  id: z.uuid().optional(),
  workspace_id: z.uuid().optional(),
  reason: z.string().optional(),
  expires_at: z.string().optional(),
  closed_at: z.string().nullable().optional(),
});
export const OpsMemberRemoved = z.strictObject({
  member_id: z.uuid().optional(),
  removed_at: z.string().optional(),
  released_inquiries: z.number().int().optional(),
});
export const OpsOperation = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  version_label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  check_state: z.string().optional(),
});
export const OpsInvoiceTemplate = z.strictObject({
  company: z.string().optional(),
  address: z.string().optional(),
  reg_no: z.string().optional(),
  contact: z.string().optional(),
  payee: z.string().optional(),
  note: z.string().optional(),
  version: z.number().int().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by_name: z.string().nullable().optional(),
});
export const OpsPwnedPendingAck = z.strictObject({
  acknowledged_at: z.string().optional(),
  remaining: z.number().int().optional(),
});
export const UpdateConversationInput = z.strictObject({
  title: z.string().optional(),
  participant_member_ids: z.array(z.uuid()).nullable().optional(),
  area: z.string().nullable().optional(),
  subject_type: z.string().nullable().optional(),
  parent_conversation_id: z.uuid().nullable().optional(),
  agent_session_id: z.string().nullable().optional(),
  branched_from_message_id: z.uuid().nullable().optional(),
  owner_member_id: z.uuid().nullable().optional(),
  closed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  title_auto: z.boolean().optional(),
  starred_at: z.iso.datetime({ offset: true }).nullable().optional(),
  incognito: z.boolean().optional(),
  last_read_at: z.iso.datetime({ offset: true }).nullable().optional(),
  talk_kind: z.string().optional(),
  ticket_id: z.uuid().nullable().optional(),
});

export const SCHEMAS: Record<string, z.ZodType> = { Tenants, TenantsInput, Scopes, ScopesInput, MemberKinds, MemberKindsInput, Members, MembersInput, SetupSteps, SetupStepsInput, Clones, ClonesInput, AiEmployees, AiEmployeesInput, GoalKinds, GoalKindsInput, Units, UnitsInput, RollupKinds, RollupKindsInput, Goals, GoalsInput, GoalAllocations, GoalAllocationsInput, GoalContributions, GoalContributionsInput, GoalVersions, GoalVersionsInput, Hypotheses, HypothesesInput, Measures, MeasuresInput, Validations, ValidationsInput, LedgerDefinitions, LedgerDefinitionsInput, LedgerFields, LedgerFieldsInput, LedgerStages, LedgerStagesInput, LedgerViews, LedgerViewsInput, LedgerRecords, LedgerRecordsInput, Duties, DutiesInput, DutyVersions, DutyVersionsInput, LearnedProcedures, LearnedProceduresInput, ProcedureSteps, ProcedureStepsInput, MemoryKinds, MemoryKindsInput, Memories, MemoriesInput, MemoryDigests, MemoryDigestsInput, MemoryProposals, MemoryProposalsInput, EmbeddingModels, EmbeddingModelsInput, SearchEmbeddings, SearchEmbeddingsInput, Tasks, TasksInput, TaskHandovers, TaskHandoversInput, DailyPlans, DailyPlansInput, Triggers, TriggersInput, Policies, PoliciesInput, Approvals, ApprovalsInput, ActionRuns, ActionRunsInput, ServiceRegistry, ServiceRegistryInput, CredentialKinds, CredentialKindsInput, Credentials, CredentialsInput, Conversations, ConversationsInput, BridgeJobs, BridgeJobsInput, BridgeJobStates, BridgeJobStatesInput, BridgeJobEvents, BridgeJobEventsInput, PermissionRules, PermissionRulesInput, AgentUsageSnapshots, AgentUsageSnapshotsInput, Messages, MessagesInput, Artifacts, ArtifactsInput, ArtifactVersions, ArtifactVersionsInput, AuditEvents, AuditEventsInput, SessionKinds, SessionKindsInput, RevokeReasons, RevokeReasonsInput, Layers, LayersInput, TargetKinds, TargetKindsInput, Abilities, AbilitiesInput, Permissions, PermissionsInput, AccountEvents, AccountEventsInput, AccountEventItems, AccountEventItemsInput, Sessions, SessionsInput, SupportAccessGrants, SupportAccessGrantsInput, RetentionHolds, RetentionHoldsInput, ErasureCertificates, ErasureCertificatesInput, Distributions, DistributionsInput, DistributionVersions, DistributionVersionsInput, TenantDistributions, TenantDistributionsInput, ServiceRegistryVersions, ServiceRegistryVersionsInput, ServiceRequests, ServiceRequestsInput, ReviewRequests, ReviewRequestsInput, OpsMembers, OpsMembersInput, OpsAuditEvents, OpsAuditEventsInput, SecurityEvents, SecurityEventsInput, Inquiries, InquiriesInput, Notices, NoticesInput, NoticeDeliveries, NoticeDeliveriesInput, NoticeUpdates, NoticeUpdatesInput, StatusIncidents, StatusIncidentsInput, NotificationPreferences, NotificationPreferencesInput, Notifications, NotificationsInput, Plans, PlansInput, PlanVersions, PlanVersionsInput, Subscriptions, SubscriptionsInput, PlanChangeRequests, PlanChangeRequestsInput, UsageMeters, UsageMetersInput, Invoices, InvoicesInput, OpsInvoiceTemplates, OpsInvoiceTemplatesInput, Payments, PaymentsInput, ErrorEvents, ErrorEventsInput, Imports, ImportsInput, Integrations, IntegrationsInput, Invitations, InvitationsInput, PendingSignup, PendingSignupInput, ExportJobs, ExportJobsInput, Attachments, AttachmentsInput, Skills, SkillsInput, SkillVersions, SkillVersionsInput, SkillTestRuns, SkillTestRunsInput, SkillAttachments, SkillAttachmentsInput, PaymentMethods, PaymentMethodsInput, BillingEvents, BillingEventsInput, LlmRoutes, LlmRoutesInput, LlmCapabilities, LlmCapabilitiesInput, PushDevices, PushDevicesInput, DisclosureVersions, DisclosureVersionsInput, Subprocessors, SubprocessorsInput, Tickets, TicketsInput, TicketSections, TicketSectionsInput, TicketSectionVersions, TicketSectionVersionsInput, TicketKinds, TicketKindsInput, KindSections, KindSectionsInput, TicketStages, TicketStagesInput, ClassAxes, ClassAxesInput, ClassValues, ClassValuesInput, TicketClassValues, TicketClassValuesInput, CustomFields, CustomFieldsInput, CustomFieldKinds, CustomFieldKindsInput, TicketFieldValues, TicketFieldValuesInput, HandoverRules, HandoverRulesInput, TestSpecs, TestSpecsInput, Checks, ChecksInput, TicketDecisions, TicketDecisionsInput, TicketMessages, TicketMessagesInput, ReferenceLogs, ReferenceLogsInput, KnowledgePages, KnowledgePagesInput, KnowledgePageVersions, KnowledgePageVersionsInput, KnowledgeLinks, KnowledgeLinksInput, KnowledgeBreaches, KnowledgeBreachesInput, KnowledgeFolders, KnowledgeFoldersInput, KnowledgeLimits, KnowledgeLimitsInput, KnowledgeRequests, KnowledgeRequestsInput, KnowledgeShares, KnowledgeSharesInput, Clients, ClientsInput, ClientGroups, ClientGroupsInput, ClientContacts, ClientContactsInput, ClientRequests, ClientRequestsInput, ClientRequestMessages, ClientRequestMessagesInput, Acceptances, AcceptancesInput, TenantMemberships, TenantMembershipsInput, TermsVersions, TermsVersionsInput, TermsConsents, TermsConsentsInput, Passkeys, PasskeysInput, Operations, OperationsInput, TicketLinks, TicketLinksInput, GuestGroups, GuestGroupsInput, GuestGroupMembers, GuestGroupMembersInput, TicketGuestShares, TicketGuestSharesInput, TicketHandovers, TicketHandoversInput, SavedViews, SavedViewsInput, TicketImports, TicketImportsInput, LearningCandidates, LearningCandidatesInput, BridgePairingCodes, BridgePairingCodesInput, NotificationSettings, NotificationSettingsInput, OpsPlanProposals, OpsPlanProposalsInput, ScopeMemberships, ScopeMembershipsInput, RoleBundleDefaults, RoleBundleDefaultsInput, StepUpInput, PasskeyRenameInput, SignupInput, SignupResendInput, SignupVerifyInput, PasswordForgotInput, SignInInput, SignInCodeInput, SignOutInput, AdminRecoveryInput, TwoFactorStartInput, TwoFactorConfirmInput, PasswordChangeInput, PasswordSetInput, PasswordResetInput, TermsConsentInput, PairingCodeInput, BridgeClaimInput, BridgeHeartbeatInput, TicketCreateInput, TicketDraftInput, DismissSetupTasksInput, TicketDelegateInput, BridgeTakeInput, BridgeProgressInput, BridgeFinishInput, BridgeToolInput, ApprovalApproveInput, ApprovalReturnInput, InvitationAcceptInput, TicketCompleteInput, InvitationResendInput, CredentialCreateInput, CredentialUpdateInput, CredentialResolveInput, CredentialLoginCheckInput, CredentialLoginAnswerInput, CredentialCheckReportInput, DeviceBrowserInput, DeviceBrowserCheckInput, BridgeBrowserInput, TicketTimelineSeenInput, TicketMessageInput, TicketMessageEditInput, TicketMessageStarInput, TicketUpdateInput, TicketDecisionInput, TicketDecisionUpdateInput, TicketHandoverCreateInput, TicketHandoverAnswerInput, HandoverWithdrawInput, HandoverRemindInput, TicketHandoverClaimInput, InvitationsCreateInput, InvitationLinkCreateInput, InvitationJoinConfirmInput, TicketBodyInput, BodyRestoreInput, TestSpecCreateInput, TestSpecUpdateInput, TicketLinkInput, NotificationReadInput, NotificationReadAllInput, SavedViewInput, SavedViewUpdateInput, ActionRunTakeoverInput, TicketRestoreInput, ItemRestoreInput, KnowledgeFolderCreateInput, KnowledgeFolderUpdateInput, KnowledgePageCreateInput, KnowledgeDraftInput, KnowledgePublishInput, KnowledgePageMoveInput, KnowledgeMustInput, KnowledgeSimilarInput, KnowledgeCopyInput, KnowledgeRaiseInput, KnowledgeDismissInput, KnowledgeApproveInput, KnowledgeDeclineInput, KnowledgeShareSetInput, TicketKindCreateInput, TicketKindUpdateInput, TicketKindOrderInput, TicketStageCreateInput, TicketStageUpdateInput, TicketStageOrderInput, TicketFieldCreateInput, TicketFieldUpdateInput, TicketFieldOrderInput, ActionRunStopInput, ApprovalStopInput, ApprovalWithdrawInput, ApprovalEditInput, DryRunInput, ConversationSay, ConversationStopInput, ConversationEntriesInput, BridgeBrowserStateInput, TicketAgentMessageInput, BulkApprovalPreviewInput, BulkApproveInput, DraftConversationStartInput, DraftMessageInput, ConversationAdoptInput, ScopeCreateInput, LayerCreateInput, LayerUpdateInput, ScopeUpdateInput, MemberRoleInput, MemberGroupsInput, MemberSuspendInput, MemberResumeInput, WorkspaceUpdateInput, WorkspaceLogoInput, WorkspacePermissionsInput, WorkspaceDeletionInput, MeUpdateInput, AvatarUploadInput, EmailChangeInput, EmailChangeVerifyInput, MySessionsRevokeInput, NotificationSettingsUpdateInput, NotificationSettingsCopyInput, MemberRemoveInput, WorkspaceSwitchInput, GuestGroupInput, PortalTicketMessageInput, ClientRequestRouteInput, ClientRequestReplyInput, ClientRequestAcceptInput, ClientRequestDeclineInput, ClientRequestDraftInput, ClientRequestDraftResultInput, PortalRequestCreateInput, PortalRequestMessageInput, PortalAttachmentInput, PortalQuestionsInput, GuestGroupRenameInput, OpsSetupInput, InquiryCreateInput, InquiryMessageInput, InquiryResolveInput, InquiryAttachmentInput, OpsInquiryUpdateInput, OpsInquiryReplyInput, OpsInquiryNoteInput, OpsMemberAddInput, PlanProposalCreateInput, PlanProposalUpdateInput, PlanProposalDecideInput, PlanProposalReturnInput, KindTemplateUpdateApplyInput, OpsPwnedAckInput, OpsWorkspaceStopInput, NoticeReadInput, OpsNoticePublishInput, IncidentUpdateInput, WorkspaceNoticeInput, BillingContactInput, PlanChangeInput, OpsInvoiceIssueInput, PaymentRecordInput, OpsPlanChangeInput, OpsVerificationResendInput, OpsPeekOpenInput, OpsWorkspaceResumeInput, OpsMemberCapsInput, OpsTemplateReleaseInput, OpsNoticeCreateInput, OpsNoticeUpdateInput, OpsInvoiceTemplateInput, OpsPwnedPendingAckInput, ScopeOverview, TicketKindChangePreview, TicketDeletePreview, SearchHit, TimelineItem, TestSpecLint, TicketCompletion, BulkResult, ApprovalQueueItem, ApprovalDetail, CloneNow, CloneGrowth, CloneActivity, SignupCreated, SignupResent, SignupStatus, SignupVerified, PasswordForgotAccepted, SignInResult, SignInCodeResult, SignedOut, AdminRecoveryResult, PasswordResetDone, CurrentTerms, TermsConsented, ConversationCreated, ConversationUpdated, MySecurity, TwoFactorSetup, TwoFactorEnabled, BackupCodes, StepUp, PasswordChanged, PasswordSet, Me, MyUsage, SetupTask, SetupTasksDismissed, PairingCode, BridgeRelease, BridgeClaim, BridgeReleaseLink, BridgeHeartbeat, BridgeDevice, TicketDetail, TicketKindChoice, TicketDraft, BridgeJob, JobControl, TicketDelegation, ApprovalDecided, BridgeFinish, BridgeToolResult, ActionRunView, ResolvedCredential, PlanProposalImpact, WorkspaceMembers, InvitationLink, PlanChoice, Billing, SignedUrl, ClientRequestDetail, PortalHome, PortalQuestions, PortalRequest, PortalTicket, KnowledgeTree, KnowledgePageDetail, OpsWorkspaceRow, OpsWorkspace, OpsWorkspaceMember, OpsWorkspaceBilling, Shell, OpsShell, OpsInquiryDetail, OpsNoticeDetail, PublicServiceStatus, InvitationPreview, InvitationAccepted, ServiceStatus, InvitationResendResult, Credential, CredentialDeleted, CredentialLoginCheck, CredentialLoginAnswer, CredentialCheckReport, RevokedDevice, DeviceBrowser, DeviceBrowserCheck, BridgeBrowser, TicketTimelineSeen, TicketMessageStar, TicketUpdated, TicketDecision, TicketDecisionCreated, TicketDecisionChange, HandoverPreview, HandoverRule, TicketHandoverCreated, TicketHandoverAnswered, TicketHandover, HandoverWithdrawn, HandoverReminded, TicketHandoverClaimed, InvitationsSent, InvitationJoinConfirmed, BodySaved, TicketVersionsView, BodyRestored, TicketItemChangesView, TestSpecItem, TicketLink, TicketLinkDeleted, Notification, NotificationsRead, SavedView, SavedViewDeleted, TicketDeleted, TicketRestored, TicketField, ItemRestored, KnowledgeVersionItem, KnowledgeVersion, KnowledgeFolder, KnowledgeFolderDeleted, KnowledgePageStub, KnowledgeDraftSaved, KnowledgeDraftDiscarded, KnowledgePublished, KnowledgePageDeleted, KnowledgeMustSet, KnowledgeSimilar, KnowledgeRequest, KnowledgeRequestEnded, KnowledgeApproval, KnowledgeRequestDecided, KnowledgeShareChoice, KnowledgeReview, TicketKindSetting, TicketKindDeleted, TicketStageSetting, TicketStageDeleted, TicketFieldSetting, TicketFieldDeleted, ActionRunStopped, ApprovalStopped, ApprovalWithdrawn, ApprovalEdited, DryRunStarted, ApprovalHistoryItem, MyClone, ConversationView, ConversationRow, MessageView, ConversationSaid, ConversationStopped, ConversationEntriesMirrored, MirrorTarget, BridgeBrowserReported, BridgeJobFile, TicketAgentSession, TicketAgentSent, BulkApprovalPreview, DraftConversationStarted, DraftMessageSent, ConversationAdopted, ScopeCreated, LayerCreated, LayerUpdated, Layer, ScopeUpdated, ScopeListItem, InvitationResent, InvitationRevoked, MemberDetail, MemberRoleChanged, MemberGroupsChanged, MemberStateChanged, MemberRemovalPreview, WorkspaceSettings, WorkspaceRenamed, WorkspaceLogo, WorkspacePermissions, WorkspaceDeletion, MeUpdated, Avatar, EmailChangeRequested, EmailChanged, MySessions, MySessionRevoked, MySessionsRevoked, NotificationSettingsCopied, WorkspaceLeft, MemberRemoved, WorkspaceSwitched, MyInvitations, GuestGroupCreated, TicketGuestSharesUpdated, PortalTicketMessageCreated, ClientRequestList, ClientRequestRouted, ClientRequestReplied, ClientRequestAccepted, ClientRequestDeclined, ClientRequestDraftQueued, ClientRequestDraftResult, PortalRequestCreated, PortalRequestMessagePosted, PortalAttachmentAdded, GuestGroupRenamed, GuestGroupDeleted, OpsSetupSession, MyInquiry, MyInquiryDetail, MyInquiryMessage, InquiryAttachmentUpload, OpsInquiryRow, OpsInquiryMessage, OpsMemberRow, PlanOps, PlanProposal, PlanHistoryRow, OpsTemplateRow, OpsTemplate, KindTemplateUpdate, OpsPwnedRow, OpsPwnedAck, Notice, NoticeRead, OpsNoticeRow, BillingContact, PlanChange, OpsInvoiceRow, OpsInvoiceIssue, OpsVerificationResent, OpsWorkspaceInquiry, OpsWorkspaceAuditRow, OpsPeek, OpsMemberRemoved, OpsOperation, OpsInvoiceTemplate, OpsPwnedPendingAck, UpdateConversationInput };

export const INPUT_SHAPES: Record<string, Record<string, unknown>> = {"AuditEvents":{"type":"object","properties":{"entries":{"type":"array","items":{"type":"object"}},"next_cursor":{"type":"string","nullable":true},"scope":{"type":"string"},"scan_capped":{"type":"boolean"}},"x-operation":"listAuditEvents"},"GuestGroups":{"type":"object","properties":{"groups":{"type":"array","items":{"type":"object"}}},"x-operation":"listGuestGroups"},"TicketGuestShares":{"type":"object","properties":{"shared":{"type":"array","items":{"type":"object"}},"choices":{"type":"array","items":{"type":"object"}},"can_change":{"type":"boolean"}},"x-operation":"listTicketGuestShares"},"TicketGuestSharesInput":{"type":"object","properties":{"add":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true,"minItems":1,"maxItems":20},"remove":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true,"minItems":1,"maxItems":20}},"additionalProperties":false,"x-operation":"updateTicketGuestShares","anyOf":[{"required":["add"]},{"required":["remove"]}]},"NotificationSettings":{"type":"object","properties":{"workspace_id":{"type":"string","format":"uuid"},"email_digest":{"type":"boolean"},"quiet_hours":{"type":"object"},"paused_until":{"type":"string","nullable":true},"urgent_override":{"type":"array","items":{"type":"object"}},"events":{"type":"array","items":{"type":"object"}}},"x-operation":"updateNotificationSettings"},"StepUpInput":{"type":"object","properties":{"password":{"type":"string"},"code":{"type":"string"},"passkey":{"type":"object"}},"additionalProperties":false,"x-operation":"stepUp"},"PasskeyRenameInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"renamePasskey"},"SignupInput":{"type":"object","properties":{"email":{"type":"string","pattern":"^[ \\t\\n\\r]*(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}[ \\t\\n\\r]*$"},"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"company_name":{"type":"string","maxLength":100},"password":{"type":"string","minLength":12}},"additionalProperties":false,"x-operation":"createSignup"},"SignupResendInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"resendSignupEmail"},"SignupVerifyInput":{"type":"object","properties":{"token":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"verifySignup"},"PasswordForgotInput":{"type":"object","properties":{"email":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"requestPasswordReset"},"SignInInput":{"type":"object","properties":{"email":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"password":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"invitation":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":512}},"additionalProperties":false,"x-operation":"signInWithPassword","allOf":[{"properties":{"email":{"pattern":"^[ \\t\\n\\r]*(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}[ \\t\\n\\r]*$"}}}]},"SignInCodeInput":{"type":"object","properties":{"pending":{"type":"string"},"code":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":64},"backup_code":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":64},"invitation":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":512}},"additionalProperties":false,"x-operation":"verifySignInCode","allOf":[{"properties":{"pending":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}],"oneOf":[{"required":["code"],"properties":{"code":{"type":"string"}},"not":{"required":["backup_code"]}},{"required":["backup_code"],"properties":{"backup_code":{"type":"string"}},"not":{"required":["code"]}}]},"SignOutInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"signOut"},"AdminRecoveryInput":{"type":"object","properties":{"pending":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"requestAdminRecovery"},"TwoFactorStartInput":{"type":"object","properties":{"password":{"type":"string","nullable":true}},"additionalProperties":false,"x-operation":"startTwoFactor"},"TwoFactorConfirmInput":{"type":"object","properties":{"code":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":64}},"additionalProperties":false,"x-operation":"confirmTwoFactor"},"PasswordChangeInput":{"type":"object","properties":{"current_password":{"type":"string"},"new_password":{"type":"string"}},"additionalProperties":false,"x-operation":"changePassword"},"PasswordSetInput":{"type":"object","properties":{"new_password":{"type":"string"}},"additionalProperties":false,"x-operation":"setMyPassword"},"PasswordResetInput":{"type":"object","properties":{"token":{"type":"string"},"new_password":{"type":"string"}},"additionalProperties":false,"x-operation":"resetPassword"},"TermsConsentInput":{"type":"object","properties":{"agree":{"type":"boolean","enum":[true]},"terms_version_id":{"type":"string","format":"uuid"},"privacy_version_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"consentToTerms"},"PairingCodeInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"createPairingCode"},"BridgeClaimInput":{"type":"object","properties":{"code":{"type":"string","maxLength":32,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*(?:[2-9A-HJKMNP-Za-hjkmnp-z２-９Ａ-ＨＪＫＭＮＰ-Ｚａ-ｈｊｋｍｎｐ-ｚ][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*){6}$"},"device_label":{"type":"string"},"machine_id":{"type":"string","format":"uuid","nullable":true}},"additionalProperties":false,"x-operation":"claimPairingCode"},"BridgeHeartbeatInput":{"type":"object","properties":{"health":{},"protocol":{},"version":{"type":"string"}},"additionalProperties":false,"x-operation":"sendHeartbeat"},"TicketCreateInput":{"type":"object","properties":{"scope_id":{"type":"string","format":"uuid"},"kind_id":{"type":"string","format":"uuid"},"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200},"assignee_member_id":{"type":"string","format":"uuid"},"due_on":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"start_on":{"type":"string","anyOf":[{"maxLength":0},{"format":"date"}]},"priority":{"type":"string","enum":["","mid","high"]},"priority_reason":{"type":"string"},"parent_ticket_id":{"type":"string","format":"uuid"},"estimate_minutes":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"string","pattern":"^(?:0*(?:[0-9]{1,5}|100000))?$"}],"nullable":true},"notify_member_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":20},"draft_id":{"type":"string","format":"uuid"},"source_draft_id":{"type":"string","format":"uuid"},"body":{"type":"object","required":["doc"],"propertyNames":{"pattern":"^doc$"},"properties":{"doc":{"type":"object","required":["type","content"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["doc"]},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["text","hardBreak"]},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"fields":{"type":"object","propertyNames":{"pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"additionalProperties":{"anyOf":[{"type":"string"},{"type":"number"},{"type":"boolean"},{"type":"array","items":{"type":"string"}}],"nullable":true}},"specs":{"type":"array","items":{"type":"string"},"maxItems":50},"links":{"type":"array","maxItems":20,"uniqueItems":true,"items":{"type":"object","required":["kind","other_ticket_id"],"additionalProperties":false,"properties":{"kind":{"enum":["related","derived_from"]},"other_ticket_id":{"type":"string","format":"uuid"}}}},"duplicate_of":{"type":"string","format":"uuid"},"copy":{"type":"array","items":{"enum":["body","assignee","fields","specs","links","children"]},"maxItems":6,"uniqueItems":true}},"additionalProperties":false,"x-operation":"createTicket","allOf":[{"anyOf":[{"not":{"properties":{"priority":{"enum":["high"]}},"required":["priority"]}},{"properties":{"priority_reason":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"required":["priority_reason"]}]},{"anyOf":[{"not":{"required":["copy"]}},{"required":["duplicate_of"]}]}]},"TicketDraftInput":{"type":"object","properties":{"draft_id":{"type":"string","format":"uuid"},"body":{"type":"object"},"discard":{"type":"boolean"}},"additionalProperties":false,"x-operation":"saveMyTicketDraft"},"DismissSetupTasksInput":{"type":"object","properties":{"key":{"type":"string"}},"additionalProperties":false,"x-operation":"dismissSetupTasks"},"TicketDelegateInput":{"type":"object","properties":{"no_spec_reason":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":500}},"additionalProperties":false,"x-operation":"delegateTicket"},"BridgeTakeInput":{"type":"object","properties":{"wait_sec":{"type":"integer"},"protocol":{"type":"integer"},"idle":{"type":"boolean"}},"additionalProperties":false,"x-operation":"takeBridgeJob"},"BridgeProgressInput":{"type":"object","properties":{"seq":{"type":"integer"},"kind":{"type":"string"},"text":{"type":"string"},"agent_session_id":{"type":"string","format":"uuid"},"model":{"type":"string"},"tool":{},"usage":{},"todos":{},"windows":{},"blocked":{}},"additionalProperties":false,"x-operation":"reportJobProgress"},"BridgeFinishInput":{"type":"object","properties":{"state":{"type":"string"},"result":{"type":"string","maxLength":200000},"reason":{"type":"string"},"agent_session_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"finishBridgeJob"},"BridgeToolInput":{"type":"object","properties":{"input":{}},"additionalProperties":false,"x-operation":"callKanameTool"},"ApprovalApproveInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"approveApproval"},"ApprovalReturnInput":{"type":"object","properties":{"note":{"type":"string"},"next_actor":{"type":"string","nullable":true,"enum":["clone","self"]}},"additionalProperties":false,"x-operation":"returnApproval"},"InvitationAcceptInput":{"type":"object","properties":{"name":{"type":"string","nullable":true},"password":{"type":"string","nullable":true},"email":{"type":"string","nullable":true,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"acceptInvitation"},"TicketCompleteInput":{"type":"object","properties":{"conditions_confirmed":{"type":"boolean","enum":[true]}},"additionalProperties":false,"x-operation":"completeTicket"},"InvitationResendInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"resendInvitation"},"CredentialCreateInput":{"type":"object","properties":{"layer":{"type":"string","enum":["workspace","personal"]},"kind":{"type":"string","enum":["login","key"]},"name":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{0,63}[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"description":{"type":"string","nullable":true},"login":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"password":{"type":"string","minLength":1},"value":{"type":"string","minLength":1},"two_factor":{"type":"string","enum":["none","totp","sms","email","push"]},"totp_secret":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*){16,}[=＝]*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"destinations":{"type":"array","items":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(\\*[.．。｡])?(?:[hHｈＨ][tTｔＴ][tTｔＴ][pPｐＰ][sSｓＳ]?[:：][/／][/／])?(?:[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff/／?？#＃\\\\]*[@＠])?(?!(?:[cCｃＣ][oOｏＯ][.．。｡][jJｊＪ][pPｐＰ]|[nNｎＮ][eEｅＥ][.．。｡][jJｊＪ][pPｐＰ]|[oOｏＯ][rRｒＲ][.．。｡][jJｊＪ][pPｐＰ]|[aAａＡ][cCｃＣ][.．。｡][jJｊＪ][pPｐＰ]|[aAａＡ][dDｄＤ][.．。｡][jJｊＪ][pPｐＰ]|[eEｅＥ][dDｄＤ][.．。｡][jJｊＪ][pPｐＰ]|[gGｇＧ][oOｏＯ][.．。｡][jJｊＪ][pPｐＰ]|[gGｇＧ][rRｒＲ][.．。｡][jJｊＪ][pPｐＰ]|[lLｌＬ][gGｇＧ][.．。｡][jJｊＪ][pPｐＰ]|[cCｃＣ][oOｏＯ][.．。｡][uUｕＵ][kKｋＫ]|[oOｏＯ][rRｒＲ][gGｇＧ][.．。｡][uUｕＵ][kKｋＫ]|[aAａＡ][cCｃＣ][.．。｡][uUｕＵ][kKｋＫ]|[gGｇＧ][oOｏＯ][vVｖＶ][.．。｡][uUｕＵ][kKｋＫ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][aAａＡ][uUｕＵ]|[nNｎＮ][eEｅＥ][tTｔＴ][.．。｡][aAａＡ][uUｕＵ]|[oOｏＯ][rRｒＲ][gGｇＧ][.．。｡][aAａＡ][uUｕＵ]|[cCｃＣ][oOｏＯ][.．。｡][nNｎＮ][zZｚＺ]|[cCｃＣ][oOｏＯ][.．。｡][kKｋＫ][rRｒＲ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][cCｃＣ][nNｎＮ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][tTｔＴ][wWｗＷ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][sSｓＳ][gGｇＧ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][bBｂＢ][rRｒＲ])[.．。｡]?(?:[:：/／?？#＃]|[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]|$))((?:[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]+[.．。｡])+[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]*[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b0-9０-９][^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]*[.．。｡]?)(?:[:：][0-9０-９]{0,5})?(?:[/／?？#＃][^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*)?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"minItems":1,"maxItems":20,"description":"契約の pattern に合っても、互換形で書いた公開の接尾辞だけ（ᶜo.jp・ⓒⓞ.jp など）は 422・E-CRED-002 で断る（預けた物がどこでも使えてしまうのを防ぐ守り・K-383）"},"expires_on":{"type":"string","nullable":true,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[0-9０-９]{4}[-－](?:(?:[0０][13578１３５７８]|[1１][02０２])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])|(?:[0０][469４６９]|[1１][1１])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])|[0０][2２][-－](?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８]))|(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})[-－][0０][2２][-－][2２][9９])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"createCredential","anyOf":[{"properties":{"kind":{"enum":["login"]},"two_factor":{"enum":["none","sms","email","push"]}},"required":["kind","login","password","two_factor"],"not":{"anyOf":[{"required":["value"]},{"required":["totp_secret"]}]}},{"properties":{"kind":{"enum":["login"]}},"required":["kind","login","password"],"not":{"anyOf":[{"required":["two_factor"]},{"required":["value"]},{"required":["totp_secret"]}]}},{"properties":{"kind":{"enum":["login"]},"two_factor":{"enum":["totp"]}},"required":["kind","login","password","two_factor","totp_secret"],"not":{"anyOf":[{"required":["value"]}]}},{"properties":{"kind":{"enum":["key"]}},"required":["kind","value"],"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["two_factor"]},{"required":["totp_secret"]}]}}]},"CredentialUpdateInput":{"type":"object","properties":{"login":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"password":{"type":"string","minLength":1},"value":{"type":"string","minLength":1},"two_factor":{"type":"string","enum":["none","totp","sms","email","push"]},"totp_secret":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*){16,}[=＝]*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"destinations":{"type":"array","items":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(\\*[.．。｡])?(?:[hHｈＨ][tTｔＴ][tTｔＴ][pPｐＰ][sSｓＳ]?[:：][/／][/／])?(?:[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff/／?？#＃\\\\]*[@＠])?(?!(?:[cCｃＣ][oOｏＯ][.．。｡][jJｊＪ][pPｐＰ]|[nNｎＮ][eEｅＥ][.．。｡][jJｊＪ][pPｐＰ]|[oOｏＯ][rRｒＲ][.．。｡][jJｊＪ][pPｐＰ]|[aAａＡ][cCｃＣ][.．。｡][jJｊＪ][pPｐＰ]|[aAａＡ][dDｄＤ][.．。｡][jJｊＪ][pPｐＰ]|[eEｅＥ][dDｄＤ][.．。｡][jJｊＪ][pPｐＰ]|[gGｇＧ][oOｏＯ][.．。｡][jJｊＪ][pPｐＰ]|[gGｇＧ][rRｒＲ][.．。｡][jJｊＪ][pPｐＰ]|[lLｌＬ][gGｇＧ][.．。｡][jJｊＪ][pPｐＰ]|[cCｃＣ][oOｏＯ][.．。｡][uUｕＵ][kKｋＫ]|[oOｏＯ][rRｒＲ][gGｇＧ][.．。｡][uUｕＵ][kKｋＫ]|[aAａＡ][cCｃＣ][.．。｡][uUｕＵ][kKｋＫ]|[gGｇＧ][oOｏＯ][vVｖＶ][.．。｡][uUｕＵ][kKｋＫ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][aAａＡ][uUｕＵ]|[nNｎＮ][eEｅＥ][tTｔＴ][.．。｡][aAａＡ][uUｕＵ]|[oOｏＯ][rRｒＲ][gGｇＧ][.．。｡][aAａＡ][uUｕＵ]|[cCｃＣ][oOｏＯ][.．。｡][nNｎＮ][zZｚＺ]|[cCｃＣ][oOｏＯ][.．。｡][kKｋＫ][rRｒＲ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][cCｃＣ][nNｎＮ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][tTｔＴ][wWｗＷ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][sSｓＳ][gGｇＧ]|[cCｃＣ][oOｏＯ][mMｍＭ][.．。｡][bBｂＢ][rRｒＲ])[.．。｡]?(?:[:：/／?？#＃]|[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]|$))((?:[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]+[.．。｡])+[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]*[^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b0-9０-９][^\\x00-\\x20\\x7f-\\x9f!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]\\^`{|}~\\u00a0\\u1680\\u2000-\\u200f\\u2016-\\u206f\\u3000-\\u3004\\u3008-\\u303f\\uff01-\\uff0c\\uff0e\\uff0f\\uff1a-\\uff20\\uff3b-\\uff3e\\uff40\\uff5b-\\uff65\\ufeff\\ufff0-\\uffff\\u2100-\\u2101\\u2105-\\u2106\\u2488-\\u249b\\u2a74\\u33c2\\u33c7\\u33d8\\ufe13\\ufe16\\ufe19\\ufe30\\ufe47-\\ufe48\\ufe52\\ufe55-\\ufe56\\ufe5f\\ufe68\\ufe6b]*[.．。｡]?)(?:[:：][0-9０-９]{0,5})?(?:[/／?？#＃][^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*)?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"minItems":1,"maxItems":20,"description":"契約の pattern に合っても、互換形で書いた公開の接尾辞だけ（ᶜo.jp・ⓒⓞ.jp など）は 422・E-CRED-002 で断る（預けた物がどこでも使えてしまうのを防ぐ守り・K-383）"},"expires_on":{"type":"string","nullable":true,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[0-9０-９]{4}[-－](?:(?:[0０][13578１３５７８]|[1１][02０２])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])|(?:[0０][469４６９]|[1１][1１])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])|[0０][2２][-－](?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８]))|(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})[-－][0０][2２][-－][2２][9９])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"description":{"type":"string","nullable":true},"reason":{"type":"string"}},"additionalProperties":false,"x-operation":"updateCredential","allOf":[{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["value"]},{"required":["two_factor"]},{"required":["totp_secret"]},{"required":["destinations"]},{"required":["expires_on"]},{"required":["description"]}]},{"anyOf":[{"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["value"]},{"required":["totp_secret"]}]}},{"required":["login","password"],"not":{"required":["value"]}},{"required":["value"],"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["two_factor"]},{"required":["totp_secret"]}]}}]}]},"CredentialResolveInput":{"type":"object","properties":{"job_id":{"type":"string","format":"uuid"},"credential_id":{"type":"string","format":"uuid"},"destination":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":2048},"executor_key":{"type":"string","maxLength":200,"pattern":"^MCowBQYDK2VuAyEA[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$"}},"additionalProperties":false,"x-operation":"resolveCredential"},"CredentialLoginCheckInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"checkCredentialLogin"},"CredentialLoginAnswerInput":{"type":"object","properties":{"request_ref":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"code":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*(?:[0-9A-Za-z０-９Ａ-Ｚａ-ｚ][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*){1,64}$"},"approved":{"type":"boolean","enum":[true]}},"additionalProperties":false,"x-operation":"answerCredentialLoginCheck","oneOf":[{"required":["code"],"not":{"required":["approved"]}},{"required":["approved"],"not":{"required":["code"]}}]},"CredentialCheckReportInput":{"type":"object","properties":{"job_id":{"type":"string","format":"uuid"},"state":{"type":"string","enum":["ok","bad_password","needs_2fa","bad_code","captcha","unreachable","no_form","stopped","no_answer","asking","waiting"]},"detail":{"type":"string","maxLength":400},"request_ref":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"ask_kind":{"type":"string","enum":["code","approve"]},"text":{"type":"string","maxLength":300}},"additionalProperties":false,"x-operation":"reportCredentialCheck","oneOf":[{"properties":{"state":{"enum":["asking","waiting"]}},"required":["request_ref"]},{"properties":{"state":{"enum":["ok","bad_password","needs_2fa","bad_code","captcha","unreachable","no_form","stopped","no_answer"]}}}]},"DeviceBrowserInput":{"type":"object","properties":{"browser":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"updateMyDevice"},"DeviceBrowserCheckInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"checkMyDeviceBrowser"},"BridgeBrowserInput":{"type":"object","properties":{"browser":{"type":"string","pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"setBridgeBrowser"},"TicketTimelineSeenInput":{"type":"object","properties":{"seen_at":{"type":"string","nullable":true,"pattern":"^(?:[1-9][0-9]{3}-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|[1-9][0-9]{3}-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|[1-9][0-9]{3}-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[1-9][0-9](?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]{1,6})?(?:Z|[+-](?:0[0-9]|1[0-5])(?::?[0-5][0-9])?)$"}},"additionalProperties":false,"x-operation":"markTicketTimelineSeen"},"TicketMessageInput":{"type":"object","properties":{"body":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"mention_member_ids":{"type":"array","items":{"type":"string","format":"uuid"}},"notify_member_ids":{"type":"array","items":{"type":"string","format":"uuid"}},"quote_of_id":{"type":"string","format":"uuid","nullable":true},"stage_key":{"type":"string","enum":["todo","doing","hold"]},"stage_id":{"type":"string","format":"uuid"},"hold_reason":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"},"resume_condition":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"}},"additionalProperties":false,"x-operation":"createTicketMessage","allOf":[{"not":{"required":["stage_id","stage_key"]}},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["todo","doing"]}}},{"required":["hold_reason","resume_condition"]}]},{"anyOf":[{"required":["stage_id"]},{"required":["stage_key"],"properties":{"stage_key":{"enum":["hold"]}}},{"not":{"anyOf":[{"required":["hold_reason"]},{"required":["resume_condition"]}]}}]}]},"TicketMessageEditInput":{"type":"object","properties":{"body":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"mention_member_ids":{"type":"array","items":{"type":"string","format":"uuid"}}},"additionalProperties":false,"x-operation":"updateTicketMessage"},"TicketMessageStarInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"starTicketMessage"},"TicketUpdateInput":{"type":"object","properties":{"stage_id":{"type":"string","format":"uuid"},"stage_key":{"type":"string","enum":["todo","doing","hold"]},"actual_minutes":{"type":"integer","nullable":true,"minimum":0,"maximum":100000},"hold_reason":{"type":"string","pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$"},"resume_condition":{"type":"string","pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$"},"priority":{"type":"string","enum":["mid","high"]},"priority_reason":{"type":"string","pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$"},"parent_ticket_id":{"type":"string","format":"uuid","nullable":true},"fields":{"type":"object","minProperties":1,"propertyNames":{"format":"uuid"},"additionalProperties":{"anyOf":[{"type":"string"},{"type":"number"},{"type":"boolean"},{"type":"array","items":{"type":"string"}}],"nullable":true}},"estimate_minutes":{"type":"integer","nullable":true,"minimum":0,"maximum":100000},"due_on":{"type":"string","nullable":true,"pattern":"^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$"},"start_on":{"type":"string","nullable":true,"pattern":"^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$"},"due_reason":{"type":"string","maxLength":200,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f]"},"expected_due_on":{"type":"string","nullable":true,"pattern":"^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$"},"expected_start_on":{"type":"string","nullable":true,"pattern":"^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$"}},"additionalProperties":false,"x-operation":"updateTicket","allOf":[{"not":{"required":["stage_id","stage_key"]}},{"anyOf":[{"required":["stage_id"]},{"required":["stage_key"]},{"required":["actual_minutes"]},{"required":["hold_reason"]},{"required":["resume_condition"]},{"required":["priority"]},{"required":["priority_reason"]},{"required":["parent_ticket_id"]},{"required":["fields"]},{"required":["estimate_minutes"]},{"required":["due_on"]},{"required":["start_on"]}]},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["todo","doing"]}}},{"required":["hold_reason","resume_condition"]}]},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["hold"]}}},{"not":{"anyOf":[{"required":["hold_reason"]},{"required":["resume_condition"]}]}}]},{"anyOf":[{"not":{"required":["due_on"]}},{"required":["due_reason"],"properties":{"due_reason":{"type":"string"}}}]},{"anyOf":[{"not":{"required":["due_reason"]}},{"required":["due_on"]}]},{"anyOf":[{"not":{"required":["expected_due_on"]}},{"required":["due_on"]}]},{"anyOf":[{"not":{"required":["expected_start_on"]}},{"required":["start_on"]}]}],"oneOf":[{"properties":{"priority":{"enum":["high"]}},"required":["priority","priority_reason"]},{"not":{"anyOf":[{"required":["priority_reason"]},{"properties":{"priority":{"enum":["high"]}},"required":["priority"]}]}}]},"TicketDecisionInput":{"type":"object","properties":{"text":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"},"reason":{"type":"string","nullable":true},"decided_by_member_id":{"type":"string","format":"uuid","nullable":true},"decided_note":{"type":"string","nullable":true},"source_message_id":{"type":"string","format":"uuid","nullable":true},"promoted_to":{"type":"string","nullable":true,"enum":["ticket"]}},"additionalProperties":false,"x-operation":"createTicketDecision"},"TicketDecisionUpdateInput":{"type":"object","properties":{"action":{"type":"string","enum":["revise","cancel"]},"text":{"type":"string","nullable":true},"reason":{"type":"string","nullable":true}},"additionalProperties":false,"x-operation":"updateTicketDecision","oneOf":[{"properties":{"action":{"enum":["revise"]},"text":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"}},"required":["text"]},{"properties":{"action":{"enum":["cancel"]},"reason":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"}},"required":["reason"]}]},"TicketHandoverCreateInput":{"type":"object","properties":{"kind":{"type":"string","enum":["pass","offer","distribute"]},"to_member_id":{"type":"string","format":"uuid","nullable":true},"to_scope_id":{"type":"string","format":"uuid","nullable":true},"reason":{"type":"string","nullable":false,"pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f\\ufeff][^\\u0000]*$"},"ask":{"type":"string","nullable":true,"pattern":"^[^\\u0000]*$"},"reply_due":{"type":"string","nullable":true,"format":"date-time"},"switch":{"type":"object","nullable":true,"additionalProperties":false,"properties":{"children":{"type":"boolean"},"links":{"type":"boolean"},"group":{"type":"boolean"},"axes":{"type":"array","items":{"type":"string","format":"uuid"}}}},"notify_managers":{"type":"boolean","nullable":true},"replaces":{"type":"string","format":"uuid","nullable":true}},"additionalProperties":false,"x-operation":"createTicketHandover","allOf":[{"not":{"allOf":[{"required":["to_member_id"],"properties":{"to_member_id":{"type":"string"}}},{"required":["to_scope_id"],"properties":{"to_scope_id":{"type":"string"}}}]}},{"anyOf":[{"not":{"required":["kind"],"properties":{"kind":{"enum":["offer"]}}}},{"properties":{"to_member_id":{"nullable":true,"enum":[null]},"to_scope_id":{"nullable":true,"enum":[null]},"reply_due":{"nullable":true,"enum":[null]}}}]},{"anyOf":[{"not":{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}}},{"properties":{"to_scope_id":{"nullable":true,"enum":[null]}}}]},{"anyOf":[{"not":{"required":["replaces"],"properties":{"replaces":{"type":"string"}}}},{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}}]},{"anyOf":[{"not":{"anyOf":[{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}},{"required":["kind"],"properties":{"kind":{"enum":["distribute"]}}}]}},{"anyOf":[{"required":["to_member_id"],"properties":{"to_member_id":{"type":"string"}}},{"required":["to_scope_id"],"properties":{"to_scope_id":{"type":"string"}}}]}]}]},"TicketHandoverAnswerInput":{"type":"object","properties":{"decision":{"type":"string","enum":["accept","decline"]},"decline_reason":{"type":"string","nullable":true,"pattern":"^[^\\u0000]*$"},"switch":{"type":"object","nullable":true,"additionalProperties":false,"properties":{"children":{"type":"boolean"},"links":{"type":"boolean"},"group":{"type":"boolean"},"axes":{"type":"array","items":{"type":"string","format":"uuid"}}}}},"additionalProperties":false,"x-operation":"answerTicketHandover","allOf":[{"anyOf":[{"not":{"required":["decision"],"properties":{"decision":{"enum":["decline"]}}}},{"required":["decline_reason"],"properties":{"decline_reason":{"type":"string","pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f\\ufeff][^\\u0000]*$"}}}]}]},"HandoverWithdrawInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"withdrawTicketHandover"},"HandoverRemindInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"remindTicketHandover"},"TicketHandoverClaimInput":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"claimTicketHandover"},"InvitationsCreateInput":{"type":"object","properties":{"emails":{"type":"array","items":{"type":"string","maxLength":320,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*)+[@＠﹫][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[.․﹒．](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"minItems":1,"maxItems":50},"scope_id":{"type":"string","format":"uuid","nullable":true},"role_key":{"type":"string","enum":["member","manager","viewer","admin","requester"]},"message":{"type":"string","nullable":true,"maxLength":500},"guest_group_id":{"type":"string","format":"uuid","nullable":true}},"additionalProperties":false,"x-operation":"createInvitations","oneOf":[{"properties":{"role_key":{"enum":["requester"]}},"required":["guest_group_id"],"not":{"required":["scope_id"]}},{"properties":{"role_key":{"enum":["member","manager","viewer","admin"]}},"required":["scope_id"],"not":{"required":["guest_group_id"]}}]},"InvitationLinkCreateInput":{"type":"object","properties":{"scope_id":{"type":"string","format":"uuid"},"role_key":{"type":"string","enum":["member","manager","viewer","admin"]}},"additionalProperties":false,"x-operation":"createInvitationLink"},"InvitationJoinConfirmInput":{"type":"object","properties":{"token":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"confirmInvitationJoin"},"TicketBodyInput":{"type":"object","properties":{"version":{"type":"integer","minimum":0,"maximum":2147483647},"doc":{"type":"object","required":["type","content"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["doc"]},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["text","hardBreak"]},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"additionalProperties":false,"x-operation":"updateTicketBody"},"BodyRestoreInput":{"type":"object","properties":{"current_version":{"type":"integer","minimum":1}},"additionalProperties":false,"x-operation":"restoreTicketVersion"},"TestSpecCreateInput":{"type":"object","properties":{"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200}},"additionalProperties":false,"x-operation":"createTestSpec"},"TestSpecUpdateInput":{"type":"object","properties":{"version":{"type":"integer","minimum":1},"checked":{"type":"boolean"},"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200}},"additionalProperties":false,"x-operation":"updateTestSpec","oneOf":[{"required":["checked"]},{"required":["title"]}]},"TicketLinkInput":{"type":"object","properties":{"other_ticket_id":{"type":"string","format":"uuid"},"kind":{"type":"string","enum":["related","derived_from"]}},"additionalProperties":false,"x-operation":"createTicketLink"},"NotificationReadInput":{"type":"object","properties":{"read":{"type":"boolean"}},"additionalProperties":false,"x-operation":"readNotification"},"NotificationReadAllInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"readAllNotifications"},"SavedViewInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f](?:[^\\u0000-\\u001f\\u007f-\\u009f]{0,58}[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f])?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"share":{"type":"string","enum":["self","group"]},"scope_id":{"type":"string","format":"uuid","nullable":true},"filters":{"type":"object","maxProperties":8,"propertyNames":{"pattern":"^[A-Za-z0-9_]{1,40}$"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":500},{"type":"number"},{"type":"boolean"},{"type":"object","maxProperties":32,"propertyNames":{"pattern":"^[A-Za-z0-9_]{1,40}$"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":500},{"type":"number"},{"type":"boolean"}]}}]}},"columns":{"type":"array","items":{"type":"string","maxLength":40},"maxItems":50},"density":{"type":"string","enum":["normal","compact"]}},"additionalProperties":false,"x-operation":"createSavedView","anyOf":[{"not":{"required":["share"]}},{"properties":{"share":{"enum":["self"]}}},{"required":["scope_id"],"properties":{"scope_id":{"type":"string"}}}]},"SavedViewUpdateInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f](?:[^\\u0000-\\u001f\\u007f-\\u009f]{0,58}[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f])?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"},"share":{"type":"string","enum":["self","group"]},"scope_id":{"type":"string","format":"uuid","nullable":true},"filters":{"type":"object","maxProperties":8,"propertyNames":{"pattern":"^[A-Za-z0-9_]{1,40}$"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":500},{"type":"number"},{"type":"boolean"},{"type":"object","maxProperties":32,"propertyNames":{"pattern":"^[A-Za-z0-9_]{1,40}$"},"additionalProperties":{"anyOf":[{"type":"string","maxLength":500},{"type":"number"},{"type":"boolean"}]}}]}},"columns":{"type":"array","items":{"type":"string","maxLength":40},"maxItems":50},"density":{"type":"string","enum":["normal","compact"]}},"additionalProperties":false,"x-operation":"updateSavedView","allOf":[{"anyOf":[{"required":["name"]},{"required":["share"]},{"required":["scope_id"]},{"required":["filters"]},{"required":["columns"]},{"required":["density"]}]},{"anyOf":[{"not":{"required":["share"]}},{"properties":{"share":{"enum":["self"]}}},{"required":["scope_id"],"properties":{"scope_id":{"type":"string"}}}]}]},"ActionRunTakeoverInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"takeoverActionRun"},"TicketRestoreInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"restoreTicket"},"ItemRestoreInput":{"type":"object","properties":{"from":{"type":"integer","minimum":1},"to":{"type":"integer","minimum":1}},"additionalProperties":false,"x-operation":"restoreTicketItems"},"KnowledgeFolderCreateInput":{"type":"object","properties":{"shelf":{"type":"string","enum":["company","group","me"]},"group_id":{"type":"string","format":"uuid","nullable":true},"parent_folder_id":{"type":"string","format":"uuid","nullable":true},"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100}},"additionalProperties":false,"x-operation":"createKnowledgeFolder","anyOf":[{"properties":{"shelf":{"enum":["company","me"]}}},{"required":["group_id"],"properties":{"group_id":{"type":"string","format":"uuid"}}}]},"KnowledgeFolderUpdateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"parent_folder_id":{"type":"string","format":"uuid","nullable":true},"position":{"type":"integer","minimum":0,"maximum":2147483647}},"additionalProperties":false,"x-operation":"updateKnowledgeFolder","anyOf":[{"required":["name"]},{"required":["parent_folder_id"]},{"required":["position"]}]},"KnowledgePageCreateInput":{"type":"object","properties":{"shelf":{"type":"string","enum":["company","group","me"]},"group_id":{"type":"string","format":"uuid","nullable":true},"folder_id":{"type":"string","format":"uuid","nullable":true},"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200},"desc":{"type":"string","maxLength":200}},"additionalProperties":false,"x-operation":"createKnowledgePage","anyOf":[{"properties":{"shelf":{"enum":["company","me"]}}},{"required":["group_id"],"properties":{"group_id":{"type":"string","format":"uuid"}}}]},"KnowledgeDraftInput":{"type":"object","properties":{"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200},"desc":{"type":"string","maxLength":200},"doc":{"type":"object"}},"additionalProperties":false,"x-operation":"saveKnowledgeDraft","anyOf":[{"required":["title"]},{"required":["desc"]},{"required":["doc"]}]},"KnowledgePublishInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"publishKnowledgePage"},"KnowledgePageMoveInput":{"type":"object","properties":{"folder_id":{"type":"string","format":"uuid","nullable":true},"position":{"type":"integer","minimum":0,"maximum":2147483647}},"additionalProperties":false,"x-operation":"updateKnowledgePage","anyOf":[{"required":["folder_id"]},{"required":["position"]}]},"KnowledgeMustInput":{"type":"object","properties":{"must":{"type":"boolean"}},"additionalProperties":false,"x-operation":"setKnowledgeMust"},"KnowledgeSimilarInput":{"type":"object","properties":{"title":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":200},"desc":{"type":"string","maxLength":200},"text":{"type":"string","maxLength":10000},"exclude_page_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"findSimilarKnowledge"},"KnowledgeCopyInput":{"type":"object","properties":{"folder_id":{"type":"string","format":"uuid","nullable":true}},"additionalProperties":false,"x-operation":"copyKnowledgePage"},"KnowledgeRaiseInput":{"type":"object","properties":{"group_id":{"type":"string","format":"uuid","nullable":true},"folder_id":{"type":"string","format":"uuid","nullable":true},"message":{"type":"string","nullable":true,"maxLength":1000}},"additionalProperties":false,"x-operation":"requestKnowledgeRaise"},"KnowledgeDismissInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"dismissKnowledgeRequest"},"KnowledgeApproveInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"approveKnowledgeRequest"},"KnowledgeDeclineInput":{"type":"object","properties":{"reason":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":1000}},"additionalProperties":false,"x-operation":"declineKnowledgeRequest"},"KnowledgeShareSetInput":{"type":"object","properties":{"page_id":{"type":"string","format":"uuid","nullable":true},"folder_id":{"type":"string","format":"uuid","nullable":true},"group_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":50},"message":{"type":"string","nullable":true,"maxLength":1000}},"additionalProperties":false,"x-operation":"setKnowledgeShares","oneOf":[{"required":["page_id"]},{"required":["folder_id"]}]},"TicketKindCreateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"color_key":{"type":"string","enum":["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]},"body_template":{"type":"object","nullable":true,"required":["type","content"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["doc"]},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["text","hardBreak"]},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"additionalProperties":false,"x-operation":"createTicketKind"},"TicketKindUpdateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"color_key":{"type":"string","enum":["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]},"body_template":{"type":"object","nullable":true,"required":["type","content"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["doc"]},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["paragraph","heading","bulletList","orderedList","horizontalRule","taskList","table","blockquote","codeBlock","image","listItem","taskItem","tableRow","tableHeader","tableCell","text","hardBreak"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"level":{"type":"integer","enum":[2,3,4]},"ghost":{"type":"boolean"},"textAlign":{"type":"string","enum":["left","center","right","justify"]},"start":{"type":"integer","minimum":1,"maximum":9999},"colspan":{"type":"integer","minimum":1,"maximum":50},"rowspan":{"type":"integer","minimum":1,"maximum":50},"colwidth":{"type":"array","items":{"type":"integer","minimum":1,"maximum":2000}},"checked":{"type":"boolean"},"caption":{"type":"string"},"attachment_id":{"type":"string","format":"uuid","nullable":true}}},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}},"content":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["text","hardBreak"]},"text":{"type":"string","minLength":1},"marks":{"type":"array","items":{"type":"object","required":["type"],"additionalProperties":false,"properties":{"type":{"type":"string","enum":["bold","italic","underline","strike","code","superscript","subscript","highlight","color","link"]},"attrs":{"type":"object","additionalProperties":false,"properties":{"color":{"type":"string","anyOf":[{"enum":["red","teal","amber"]},{"pattern":"^#[0-9a-f]{6}$"}]},"href":{"type":"string","pattern":"^(?:https?://|mailto:)","maxLength":2048}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}},"additionalProperties":false,"x-operation":"updateTicketKind","anyOf":[{"required":["name"]},{"required":["color_key"]},{"required":["body_template"]}]},"TicketKindOrderInput":{"type":"object","properties":{"kind_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1}},"additionalProperties":false,"x-operation":"reorderTicketKinds"},"TicketStageCreateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":20},"color_key":{"type":"string","enum":["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]}},"additionalProperties":false,"x-operation":"createTicketStage"},"TicketStageUpdateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":20},"color_key":{"type":"string","enum":["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]}},"additionalProperties":false,"x-operation":"updateTicketStage","anyOf":[{"required":["name"]},{"required":["color_key"]}]},"TicketStageOrderInput":{"type":"object","properties":{"stage_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1}},"additionalProperties":false,"x-operation":"reorderTicketStages"},"TicketFieldCreateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":80},"field_type":{"type":"string","enum":["short_text","long_text","number","date","select","multi_select","check"]},"kind_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1},"required":{"type":"boolean"},"description":{"type":"string","nullable":true},"options":{"type":"array","items":{"type":"object","required":["name"],"additionalProperties":false,"properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":80}}}}},"additionalProperties":false,"x-operation":"createTicketField","oneOf":[{"properties":{"field_type":{"enum":["select","multi_select"]},"options":{"minItems":1}},"required":["options"]},{"properties":{"field_type":{"enum":["short_text","long_text","number","date","check"]},"options":{"maxItems":0}}}]},"TicketFieldUpdateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":80},"field_type":{"type":"string","enum":["short_text","long_text","number","date","select","multi_select","check"]},"required":{"type":"boolean"},"description":{"type":"string","nullable":true},"options":{"type":"array","minItems":1,"items":{"type":"object","required":["name"],"additionalProperties":false,"properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":80}}}},"kind_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1}},"additionalProperties":false,"x-operation":"updateTicketField","allOf":[{"anyOf":[{"required":["name"]},{"required":["field_type"]},{"required":["required"]},{"required":["description"]},{"required":["options"]},{"required":["kind_ids"]}]},{"not":{"required":["field_type","options"],"properties":{"field_type":{"enum":["short_text","long_text","number","date","check"]}}}}]},"TicketFieldOrderInput":{"type":"object","properties":{"field_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1}},"additionalProperties":false,"x-operation":"reorderTicketFields"},"ActionRunStopInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"stopActionRun"},"ApprovalStopInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"stopApproval"},"ApprovalWithdrawInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"withdrawApproval"},"ApprovalEditInput":{"type":"object","properties":{"text":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"version":{"type":"integer","minimum":1}},"additionalProperties":false,"x-operation":"editApproval"},"DryRunInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"dryRunTicket"},"ConversationSay":{"type":"object","properties":{"text":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"sendConversationMessage"},"ConversationStopInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"stopConversation"},"ConversationEntriesInput":{"type":"object","properties":{"entries":{"type":"array","minItems":1,"maxItems":500}},"additionalProperties":false,"x-operation":"mirrorConversationEntries"},"BridgeBrowserStateInput":{"type":"object","properties":{"browser":{"type":"string","enum":["chrome","dedicated"]},"state":{"type":"string","enum":["using","off"]}},"additionalProperties":false,"x-operation":"reportBrowserState"},"TicketAgentMessageInput":{"type":"object","properties":{"text":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"sendTicketAgentMessage"},"BulkApprovalPreviewInput":{"type":"object","properties":{"approval_ids":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true,"minItems":1,"maxItems":50}},"additionalProperties":false,"x-operation":"previewBulkApproval"},"BulkApproveInput":{"type":"object","properties":{"approval_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":50}},"additionalProperties":false,"x-operation":"bulkApprove"},"DraftConversationStartInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"startDraftConversation"},"DraftMessageInput":{"type":"object","properties":{"text":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"draft":{"type":"object","properties":{"title":{"type":"string","maxLength":200},"body":{"type":"string"},"checks":{"type":"array","maxItems":50,"items":{"type":"string","maxLength":200}}},"required":["title","body","checks"],"additionalProperties":false},"edited":{"type":"array","items":{"enum":["title","body","checks"]},"nullable":true,"maxItems":3,"uniqueItems":true}},"additionalProperties":false,"x-operation":"sendDraftMessage"},"ConversationAdoptInput":{"type":"object","properties":{"ticket_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"adoptDraftConversation"},"ScopeCreateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"ticket_prefix":{"type":"string","pattern":"^(?![Tt]$)[A-Za-z][A-Za-z0-9]{0,7}$"},"parent_id":{"type":"string","format":"uuid"},"layer_id":{"type":"string","format":"uuid"},"color":{"type":"string","enum":["teal","plum","indigo","amber","coral","sage"]},"manager_member_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":10},"member_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":50}},"additionalProperties":false,"x-operation":"createScope"},"LayerCreateInput":{"type":"object","properties":{"label":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":40},"order_no":{"type":"integer","minimum":1}},"additionalProperties":false,"x-operation":"createLayer"},"LayerUpdateInput":{"type":"object","properties":{"label":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":40},"order_no":{"type":"integer","minimum":1}},"additionalProperties":false,"x-operation":"updateLayer","anyOf":[{"required":["label"]},{"required":["order_no"]}]},"ScopeUpdateInput":{"type":"object","properties":{"name":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","maxLength":100},"color":{"type":"string","enum":["teal","plum","indigo","amber","coral","sage"]},"position":{"type":"integer","minimum":1},"manager_member_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":10}},"additionalProperties":false,"x-operation":"updateScope","anyOf":[{"required":["name"]},{"required":["color"]},{"required":["position"]},{"required":["manager_member_ids"]}]},"MemberRoleInput":{"type":"object","properties":{"role_key":{"type":"string","enum":["manager","member","viewer","admin"]},"scope_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"updateMemberRole"},"MemberGroupsInput":{"type":"object","properties":{"primary_scope_id":{"type":"string","format":"uuid"},"add_scope_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":20},"remove_scope_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":20},"role_key":{"type":"string","enum":["manager","member","viewer"]}},"additionalProperties":false,"x-operation":"updateMemberGroups","anyOf":[{"required":["primary_scope_id"]},{"required":["add_scope_ids"]},{"required":["remove_scope_ids"]}]},"MemberSuspendInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"suspendMember"},"MemberResumeInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"resumeMember"},"WorkspaceUpdateInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":100}},"additionalProperties":false,"x-operation":"updateWorkspace"},"WorkspaceLogoInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"uploadWorkspaceLogo"},"WorkspacePermissionsInput":{"type":"object","properties":{"billing":{"type":"string","enum":["admin","admin_manager"]},"delete_workspace":{"type":"string","enum":["admin","admin_manager"]}},"additionalProperties":false,"x-operation":"updateWorkspacePermissions","anyOf":[{"required":["billing"]},{"required":["delete_workspace"]}]},"WorkspaceDeletionInput":{"type":"object","properties":{"confirm_name":{"type":"string","minLength":1,"maxLength":100}},"additionalProperties":false,"x-operation":"requestWorkspaceDeletion"},"MeUpdateInput":{"type":"object","properties":{"name":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"call_name":{"type":"string","nullable":true},"language":{"type":"string","nullable":true,"enum":["ja"]},"theme":{"type":"string","nullable":true,"enum":["system","light","dark"]},"week_start":{"type":"integer","nullable":true,"enum":[0,1]},"timezone":{"type":"string","nullable":true,"enum":["Asia/Tokyo","UTC"]}},"additionalProperties":false,"x-operation":"updateMe","anyOf":[{"required":["name"]},{"required":["call_name"]},{"required":["language"]},{"required":["theme"]},{"required":["week_start"]},{"required":["timezone"]}]},"AvatarUploadInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"uploadAvatar"},"EmailChangeInput":{"type":"object","properties":{"email":{"type":"string","maxLength":254,"pattern":"^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*)+[@＠﹫][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[.․﹒．](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$"}},"additionalProperties":false,"x-operation":"requestEmailChange"},"EmailChangeVerifyInput":{"type":"object","properties":{"token":{"type":"string","minLength":1,"maxLength":200}},"additionalProperties":false,"x-operation":"verifyEmailChange"},"MySessionsRevokeInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"revokeOtherSessions"},"NotificationSettingsUpdateInput":{"type":"object","properties":{"workspace_id":{"type":"string","format":"uuid","nullable":true},"email_digest":{"type":"boolean","nullable":true},"quiet_hours":{"type":"object","nullable":true,"additionalProperties":false,"required":["preset"],"properties":{"preset":{"enum":["weekdays_night_weekend","every_night","weekend_only","off"]}}},"pause":{"type":"string","nullable":true,"enum":["1h","today","tomorrow_morning",null]},"urgent_override":{"type":"array","items":{"enum":["approval_due_today","clone_stopped"]},"nullable":true},"events":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["key"],"properties":{"key":{"enum":["approval_waiting","mentioned","handed_over","clone_stopped","clone_finished","ticket_changed","new_device"]},"bell":{"type":"boolean"},"mail":{"type":"boolean"}},"anyOf":[{"required":["bell"]},{"required":["mail"]}]},"nullable":true,"maxItems":7}},"additionalProperties":false,"x-operation":"updateNotificationSettings","anyOf":[{"required":["email_digest"]},{"required":["quiet_hours"]},{"required":["pause"]},{"required":["urgent_override"]},{"required":["events"]}]},"NotificationSettingsCopyInput":{"type":"object","properties":{"from_workspace_id":{"type":"string","format":"uuid"},"to_workspace_ids":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":20}},"additionalProperties":false,"x-operation":"copyNotificationSettings"},"MemberRemoveInput":{"type":"object","properties":{"transfer_to_member_id":{"type":"string","format":"uuid"},"transfers":{"type":"array","maxItems":500,"items":{"type":"object","required":["ticket_id","to_member_id"],"additionalProperties":false,"properties":{"ticket_id":{"type":"string","format":"uuid"},"to_member_id":{"type":"string","format":"uuid"}}}}},"additionalProperties":false,"x-operation":"removeMember","not":{"required":["transfer_to_member_id","transfers"]}},"WorkspaceSwitchInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"switchWorkspace"},"GuestGroupInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":80},"request_scope_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"createGuestGroup"},"PortalTicketMessageInput":{"type":"object","properties":{"body":{"type":"string","minLength":1}},"additionalProperties":false,"x-operation":"postPortalTicketMessage"},"ClientRequestRouteInput":{"type":"object","properties":{"route_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"updateClientRequest"},"ClientRequestReplyInput":{"type":"object","properties":{"body":{"type":"string","minLength":1}},"additionalProperties":false,"x-operation":"replyToClientRequest"},"ClientRequestAcceptInput":{"type":"object","properties":{"title":{"type":"string","nullable":true,"minLength":1,"maxLength":200},"body":{"type":"string","nullable":true},"assignee_member_id":{"type":"string","format":"uuid"},"due_on":{"type":"string"},"scope_id":{"type":"string","format":"uuid"},"kind_id":{"type":"string","format":"uuid","nullable":true},"guest_group_ids":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true,"minItems":1,"maxItems":20}},"additionalProperties":false,"x-operation":"acceptClientRequest"},"ClientRequestDeclineInput":{"type":"object","properties":{"reason":{"type":"string","minLength":1,"maxLength":2000}},"additionalProperties":false,"x-operation":"declineClientRequest"},"ClientRequestDraftInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"requestClientRequestDraft"},"ClientRequestDraftResultInput":{"type":"object","properties":{"draft":{"type":"object","nullable":true},"failed":{"type":"string","nullable":true}},"additionalProperties":false,"x-operation":"reportClientRequestDraft","oneOf":[{"required":["draft"]},{"required":["failed"]}]},"PortalRequestCreateInput":{"type":"object","properties":{"body":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","minLength":1,"maxLength":10000},"due_on":{"type":"string","nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"attachment_ids":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true,"maxItems":5}},"additionalProperties":false,"x-operation":"createPortalRequest"},"PortalRequestMessageInput":{"type":"object","properties":{"body":{"type":"string","minLength":1,"maxLength":10000}},"additionalProperties":false,"x-operation":"postPortalRequestMessage"},"PortalAttachmentInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":200},"content_type":{"type":"string","maxLength":100,"pattern":"^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$"},"data":{"type":"string","maxLength":1000000}},"additionalProperties":false,"x-operation":"uploadPortalAttachment"},"PortalQuestionsInput":{"type":"object","properties":{"body":{"type":"string","minLength":1,"maxLength":10000}},"additionalProperties":false,"x-operation":"askPortalRequestQuestions"},"GuestGroupRenameInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":80}},"additionalProperties":false,"x-operation":"updateGuestGroup"},"OpsSetupInput":{"type":"object","properties":{"token":{"type":"string","pattern":"^[A-Za-z0-9_-]{43}$"},"name":{"type":"string","nullable":true,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]","minLength":1,"maxLength":40}},"additionalProperties":false,"x-operation":"startOpsSetup"},"InquiryCreateInput":{"type":"object","properties":{"topic":{"type":"string","enum":["usage","trouble","billing","other"]},"title":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"attachment_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":5},"context":{"type":"object"}},"additionalProperties":false,"x-operation":"createInquiry"},"InquiryMessageInput":{"type":"object","properties":{"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"attachment_ids":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":5}},"additionalProperties":false,"x-operation":"postInquiryMessage"},"InquiryResolveInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"resolveMyInquiry"},"InquiryAttachmentInput":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":200},"content_type":{"type":"string","enum":["image/png","image/jpeg","image/gif","image/webp","application/pdf","application/zip"]},"size":{"type":"integer","minimum":1,"maximum":10485760}},"additionalProperties":false,"x-operation":"uploadInquiryAttachment"},"OpsInquiryUpdateInput":{"type":"object","properties":{"take":{"type":"boolean"},"release":{"type":"boolean"},"state":{"type":"string","enum":["open","done"]},"later_until":{"type":"string","nullable":true}},"additionalProperties":false,"x-operation":"updateOpsInquiry","allOf":[{"anyOf":[{"required":["take"]},{"required":["release"]},{"required":["state"]},{"required":["later_until"]}]},{"not":{"properties":{"take":{"const":true},"release":{"const":true}},"required":["take","release"]}},{"not":{"required":["state","later_until"]}}]},"OpsInquiryReplyInput":{"type":"object","properties":{"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"replyOpsInquiry"},"OpsInquiryNoteInput":{"type":"object","properties":{"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"addOpsInquiryNote"},"OpsMemberAddInput":{"type":"object","properties":{"email":{"type":"string","minLength":3,"maxLength":254,"pattern":"^[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$"},"caps":{"type":"array","items":{"type":"string","enum":["inquiry","peek","money","stop","notice","distribute","plan_propose","plan_decide","ops_people"]},"minItems":1,"maxItems":9,"uniqueItems":true}},"additionalProperties":false,"x-operation":"addOpsMember"},"PlanProposalCreateInput":{"type":"object","properties":{"plan_key":{"type":"string","enum":["free","team","business"]},"price_monthly":{"type":"integer","minimum":0,"maximum":10000000},"member_limit":{"type":"integer","minimum":1,"maximum":10000},"trial_days":{"type":"integer","minimum":0,"maximum":365},"existing_policy":{"type":"string","enum":["after_days","keep"]},"notice_days":{"type":"integer","minimum":30,"maximum":365},"new_from":{"type":"string","nullable":true,"format":"date"},"reason":{"type":"string","minLength":1,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"createPlanProposal","allOf":[{"not":{"properties":{"existing_policy":{"enum":["after_days"]}},"required":["existing_policy"],"not":{"required":["notice_days"]}}},{"not":{"properties":{"existing_policy":{"enum":["keep"]}},"required":["existing_policy","notice_days"]}}]},"PlanProposalUpdateInput":{"type":"object","properties":{"price_monthly":{"type":"integer","minimum":0,"maximum":10000000},"member_limit":{"type":"integer","minimum":1,"maximum":10000},"trial_days":{"type":"integer","minimum":0,"maximum":365},"existing_policy":{"type":"string","enum":["after_days","keep"]},"notice_days":{"type":"integer","minimum":30,"maximum":365},"new_from":{"type":"string","nullable":true,"format":"date"},"reason":{"type":"string","minLength":1,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"updatePlanProposal","allOf":[{"anyOf":[{"required":["price_monthly"]},{"required":["member_limit"]},{"required":["trial_days"]},{"required":["existing_policy"]},{"required":["notice_days"]},{"required":["new_from"]},{"required":["reason"]}]},{"not":{"properties":{"existing_policy":{"enum":["after_days"]}},"required":["existing_policy"],"not":{"required":["notice_days"]}}},{"not":{"properties":{"existing_policy":{"enum":["keep"]}},"required":["existing_policy","notice_days"]}}]},"PlanProposalDecideInput":{"type":"object","properties":{"notice_body":{"type":"string","minLength":1,"maxLength":2000}},"additionalProperties":false,"x-operation":"decidePlanProposal","allOf":[{"properties":{"notice_body":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}]},"PlanProposalReturnInput":{"type":"object","properties":{"reason":{"type":"string","minLength":1,"maxLength":500}},"additionalProperties":false,"x-operation":"returnPlanProposal","allOf":[{"properties":{"reason":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}]},"KindTemplateUpdateApplyInput":{"type":"object","properties":{"choice":{"type":"string","enum":["change","keep"]}},"additionalProperties":false,"x-operation":"applyKindTemplateUpdate"},"OpsPwnedAckInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"ackOpsPwned"},"OpsWorkspaceStopInput":{"type":"object","properties":{"reason_key":{"type":"string","enum":["unpaid","violation","danger","request"]},"mode":{"type":"string","enum":["scheduled","now"]},"stop_on":{"type":"string","format":"date"},"note":{"type":"string","minLength":1,"maxLength":500},"admin_notice":{"type":"string","minLength":1,"maxLength":2000}},"additionalProperties":false,"x-operation":"stopWorkspace","anyOf":[{"required":["stop_on"],"properties":{"mode":{"enum":["scheduled"]}}},{"not":{"required":["stop_on"]},"properties":{"mode":{"enum":["now"]},"reason_key":{"enum":["violation","danger"]}}}]},"NoticeReadInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"markNoticeRead"},"OpsNoticePublishInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"publishOpsNotice"},"IncidentUpdateInput":{"type":"object","properties":{"state":{"type":"string","enum":["investigating","identified","monitoring","resolved"]},"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"addIncidentUpdate"},"WorkspaceNoticeInput":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"placements":{"type":"array","items":{"type":"string","enum":["band","list"]},"minItems":1,"maxItems":2,"uniqueItems":true},"admins_only":{"type":"boolean"}},"additionalProperties":false,"x-operation":"sendWorkspaceNotice","not":{"properties":{"admins_only":{"const":true},"placements":{"contains":{"const":"band"}}},"required":["admins_only","placements"]}},"BillingContactInput":{"type":"object","properties":{"company":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"attn":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"email":{"type":"string","format":"email"}},"additionalProperties":false,"x-operation":"updateBillingContact"},"PlanChangeInput":{"type":"object","properties":{"plan_key":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"additionalProperties":false,"x-operation":"changePlan"},"OpsInvoiceIssueInput":{"type":"object","properties":{"month":{"type":"string","pattern":"^[0-9]{4}-(0[1-9]|1[0-2])$"},"dry_run":{"type":"boolean"}},"additionalProperties":false,"x-operation":"issueOpsInvoices"},"PaymentRecordInput":{"type":"object","properties":{"amount":{"type":"integer","minimum":1},"paid_on":{"type":"string","format":"date"},"payer_name":{"type":"string","minLength":1,"maxLength":100},"reverses_payment_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"recordPayment"},"OpsPlanChangeInput":{"type":"object","properties":{"plan_key":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"inquiry_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"changeOpsWorkspacePlan"},"OpsVerificationResendInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"resendOpsVerification"},"OpsPeekOpenInput":{"type":"object","properties":{"reason":{"type":"string","minLength":1,"maxLength":200},"minutes":{"type":"integer","minimum":1,"maximum":60},"inquiry_id":{"type":"string","format":"uuid"}},"additionalProperties":false,"x-operation":"openPeek"},"OpsWorkspaceResumeInput":{"type":"object","properties":{"note":{"type":"string","minLength":1,"maxLength":500}},"additionalProperties":false,"x-operation":"resumeWorkspace"},"OpsMemberCapsInput":{"type":"object","properties":{"caps":{"type":"array","items":{"type":"string","enum":["inquiry","peek","money","stop","notice","distribute","plan_propose","plan_decide","ops_people"]},"minItems":1,"maxItems":9,"uniqueItems":true}},"additionalProperties":false,"x-operation":"updateOpsMemberCaps"},"OpsTemplateReleaseInput":{"type":"object","properties":{"items":{"type":"array","minItems":0,"maxItems":100,"items":{"type":"object","required":["key","name"],"additionalProperties":false,"properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,39}$"},"name":{"type":"string","minLength":1,"maxLength":40},"color_key":{"type":"string","enum":["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]},"body_template":{"type":"object","nullable":true},"field_type":{"type":"string","enum":["short_text","long_text","number","date","select","multi_select","check"]},"required":{"type":"boolean"},"description":{"type":"string","maxLength":200},"options":{"type":"array"},"kind_keys":{"type":"array","items":{"type":"string"}}}}},"change_reason":{"type":"string","minLength":1,"maxLength":500,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"dry_run":{"type":"boolean"}},"additionalProperties":false,"x-operation":"releaseOpsTemplate"},"OpsNoticeCreateInput":{"type":"object","properties":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"title":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"audience_mode":{"type":"string","enum":["all","plans","workspaces"]},"audience_plans":{"type":"array","items":{"type":"string","enum":["free","team","business"]},"uniqueItems":true},"audience_workspace_ids":{"type":"array","items":{"type":"string","format":"uuid"},"uniqueItems":true},"placements":{"type":"array","items":{"type":"string","enum":["band","list"]},"minItems":1,"maxItems":2,"uniqueItems":true},"publish_at":{"type":"string","nullable":true,"format":"date-time"},"maintenance_from":{"type":"string","nullable":true,"format":"date-time"},"maintenance_to":{"type":"string","nullable":true,"format":"date-time"},"impact":{"type":"string","nullable":true,"minLength":1,"maxLength":200}},"additionalProperties":false,"x-operation":"createOpsNotice","allOf":[{"oneOf":[{"properties":{"audience_mode":{"enum":["workspaces"]},"audience_workspace_ids":{"minItems":1}},"required":["audience_workspace_ids"],"not":{"required":["audience_plans"]}},{"properties":{"audience_mode":{"enum":["plans"]},"audience_plans":{"minItems":1}},"required":["audience_plans"],"not":{"required":["audience_workspace_ids"]}},{"properties":{"audience_mode":{"enum":["all"]}},"not":{"anyOf":[{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]}}]},{"anyOf":[{"required":["maintenance_from","maintenance_to"]},{"not":{"anyOf":[{"required":["maintenance_from"]},{"required":["maintenance_to"]}]}}]}]},"OpsNoticeUpdateInput":{"type":"object","properties":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"title":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"body":{"type":"string","minLength":1,"maxLength":4000,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"audience_mode":{"type":"string","enum":["all","plans","workspaces"]},"audience_plans":{"type":"array","items":{"type":"string","enum":["free","team","business"]},"uniqueItems":true},"audience_workspace_ids":{"type":"array","items":{"type":"string","format":"uuid"},"uniqueItems":true},"placements":{"type":"array","items":{"type":"string","enum":["band","list"]},"minItems":1,"maxItems":2,"uniqueItems":true},"publish_at":{"type":"string","nullable":true,"format":"date-time"},"maintenance_from":{"type":"string","nullable":true,"format":"date-time"},"maintenance_to":{"type":"string","nullable":true,"format":"date-time"},"impact":{"type":"string","nullable":true,"minLength":1,"maxLength":200}},"additionalProperties":false,"x-operation":"updateOpsNotice","oneOf":[{"properties":{"audience_mode":{"enum":["workspaces"]},"audience_workspace_ids":{"minItems":1}},"required":["audience_mode","audience_workspace_ids"],"not":{"required":["audience_plans"]}},{"properties":{"audience_mode":{"enum":["plans"]},"audience_plans":{"minItems":1}},"required":["audience_mode","audience_plans"],"not":{"required":["audience_workspace_ids"]}},{"properties":{"audience_mode":{"enum":["all"]}},"not":{"anyOf":[{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]},"required":["audience_mode"]},{"not":{"anyOf":[{"required":["audience_mode"]},{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]}}]},"OpsInvoiceTemplateInput":{"type":"object","properties":{"company":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"address":{"type":"string","minLength":1,"maxLength":200,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"reg_no":{"type":"string","pattern":"^T[0-9]{13}$"},"contact":{"type":"string","minLength":1,"maxLength":200,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"payee":{"type":"string","minLength":1,"maxLength":200,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"note":{"type":"string","maxLength":500},"version":{"type":"integer","minimum":0}},"additionalProperties":false,"x-operation":"updateOpsInvoiceTemplate"},"OpsPwnedPendingAckInput":{"type":"object","properties":{},"additionalProperties":false,"x-operation":"ackOpsPwnedPending"},"ScopeOverview":{"type":"object","properties":{"by_stage":{"type":"array","items":{"type":"object"}},"milestones":{"type":"array","items":{"type":"object"}},"recent":{"type":"array","items":{"type":"object"}},"total":{"type":"integer"}},"x-operation":"getScopeOverview"},"TicketKindChangePreview":{"type":"object","properties":{"added_sections":{"type":"array","items":{"type":"object"}},"removed_sections":{"type":"array","items":{"type":"object"}},"moved_to_body":{"type":"array","items":{"type":"object"}},"checks_reset":{"type":"boolean"}},"x-operation":"previewTicketKindChange"},"TicketDeletePreview":{"type":"object","properties":{"children":{"type":"integer"},"descendants":{"type":"integer"},"attachments":{"type":"integer"},"artifacts":{"type":"integer"},"pending_approvals":{"type":"integer"},"links":{"type":"integer"},"running_runs":{"type":"integer"},"descendant_pending_approvals":{"type":"integer"},"descendant_running_runs":{"type":"integer"},"restorable_until":{"type":"string"}},"x-operation":"previewTicketDelete"},"SearchHit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"},"title":{"type":"string"},"snippet":{"type":"string"},"url":{"type":"string"}},"x-operation":"search"},"TimelineItem":{"type":"object","properties":{"id":{"type":"string"},"kind":{"type":"string"},"at":{"type":"string"},"actor":{"type":"object","nullable":true},"message":{"type":"object","nullable":true},"changes":{"type":"array","items":{"type":"object"},"nullable":true},"run":{"type":"object","nullable":true},"deleted":{"type":"object","nullable":true}},"x-operation":"deleteTicketMessage"},"TestSpecLint":{"type":"object","properties":{"missing":{"type":"array","items":{"type":"object"}},"warnings":{"type":"array","items":{"type":"object"}}},"x-operation":"lintTestSpecs"},"TicketCompletion":{"type":"object","properties":{"ticket":{"type":"object"},"unchecked":{"type":"object"}},"x-operation":"completeTicket"},"BulkResult":{"type":"object","properties":{"updated":{"type":"array","items":{"type":"object"}},"skipped":{"type":"array","items":{"type":"object"}}},"x-operation":"bulkApprove"},"ApprovalQueueItem":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"},"ticket_id":{"type":"string","nullable":true},"ticket_number":{"type":"string"},"title":{"type":"string"},"from_member_id":{"type":"string"},"from_name":{"type":"string"},"check_summary":{"type":"string"},"due_on":{"type":"string","nullable":true},"decide_inline":{"type":"boolean"},"irreversible":{"type":"boolean"},"primary_action":{"type":"string"},"secondary_action":{"type":"string"},"note":{"type":"string","nullable":true},"created_at":{"type":"string"},"handover_kind":{"type":"string","nullable":true},"reply_due":{"type":"string","nullable":true},"carry_children":{"type":"integer","nullable":true},"to_scope_name":{"type":"string","nullable":true},"ticket_scope_name":{"type":"string","nullable":true}},"x-operation":"listApprovalQueue"},"ApprovalDetail":{"type":"object","properties":{"approval":{"type":"object"},"ticket":{"type":"object"},"operation":{"type":"object"},"message_text":{"type":"string"},"artifact_version":{"type":"object"},"checks":{"type":"array","items":{"type":"object"}},"check_summary":{"type":"string"},"cautions":{"type":"array","items":{"type":"object"}},"irreversible":{"type":"boolean"},"can_decide":{"type":"boolean"},"chain":{"type":"array","items":{"type":"object"}}},"x-operation":"getApproval"},"CloneNow":{"type":"object","properties":{"pc":{"type":"object"},"current":{"type":"object","nullable":true},"next":{"type":"array","items":{"type":"object"}},"waiting_approvals":{"type":"integer"},"stopped":{"type":"integer"}},"x-operation":"getCloneNow"},"CloneGrowth":{"type":"object","properties":{"assigned":{"type":"integer"},"pass_rate":{"type":"integer","nullable":true},"pass_rate_last_week":{"type":"integer","nullable":true},"work_seconds":{"type":"integer"}},"x-operation":"getCloneGrowth"},"CloneActivity":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"at":{"type":"string"},"kind":{"type":"string"},"ticket_id":{"type":"string","format":"uuid"},"ticket_number":{"type":"string"},"title":{"type":"string"},"result":{"type":"string"},"detail":{"type":"object"}},"x-operation":"listCloneActivity"},"SignupCreated":{"type":"object","properties":{"email":{"type":"string"},"sent":{"type":"boolean"},"mail_error":{"type":"string","nullable":true},"mail_error_kind":{"type":"string","nullable":true},"expires_at":{"type":"string"},"signup_token":{"type":"string"}},"x-operation":"createSignup"},"SignupResent":{"type":"object","properties":{"email":{"type":"string","nullable":true},"sent":{"type":"boolean"},"mail_error":{"type":"string","nullable":true},"mail_error_kind":{"type":"string","nullable":true},"pending":{"type":"boolean"},"registered":{"type":"boolean"},"expired":{"type":"boolean"}},"x-operation":"resendSignupEmail"},"SignupStatus":{"type":"object","properties":{"state":{"type":"string"},"email":{"type":"string","nullable":true},"expires_at":{"type":"string","nullable":true}},"x-operation":"getSignupStatus"},"SignupVerified":{"type":"object","properties":{"email":{"type":"string"},"token":{"type":"string","nullable":true},"signed_in":{"type":"boolean"},"terms_pending":{"type":"boolean"}},"x-operation":"verifySignup"},"PasswordForgotAccepted":{"type":"object","properties":{"accepted":{"type":"boolean"}},"x-operation":"requestPasswordReset"},"SignInResult":{"type":"object","properties":{"token":{"type":"string","nullable":true},"two_factor":{"type":"boolean"},"pending":{"type":"string","nullable":true}},"x-operation":"signInWithPassword"},"SignInCodeResult":{"type":"object","properties":{"token":{"type":"string"},"backup_codes_left":{"type":"integer"}},"x-operation":"verifySignInCode"},"SignedOut":{"type":"object","properties":{"signed_out":{"type":"boolean"}},"x-operation":"signOut"},"AdminRecoveryResult":{"type":"object","properties":{"result":{"type":"string"}},"x-operation":"requestAdminRecovery"},"PasswordResetDone":{"type":"object","properties":{"reset":{"type":"boolean"}},"x-operation":"resetPassword"},"CurrentTerms":{"type":"object","properties":{"id":{"type":"string"},"kind":{"type":"string"},"version":{"type":"string"},"url":{"type":"string"},"published_at":{"type":"string"}},"x-operation":"getCurrentTerms"},"TermsConsented":{"type":"object","properties":{"consented":{"type":"boolean"}},"x-operation":"consentToTerms"},"ConversationCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"conversation_id":{"type":"string","format":"uuid"}},"x-operation":"createConversation"},"ConversationUpdated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"ok":{"type":"boolean"}},"x-operation":"updateConversation"},"MySecurity":{"type":"object","properties":{"passkeys":{"type":"array","items":{"type":"object"}},"has_password":{"type":"boolean"},"two_factor":{"type":"boolean"},"two_factor_required":{"type":"boolean"},"backup_codes_left":{"type":"integer","nullable":true},"mfa_pending":{"type":"boolean"}},"x-operation":"getMySecurity"},"TwoFactorSetup":{"type":"object","properties":{"otpauth_uri":{"type":"string"},"secret":{"type":"string"}},"x-operation":"startTwoFactor"},"TwoFactorEnabled":{"type":"object","properties":{"backup_codes":{"type":"array","items":{"type":"string"}},"token":{"type":"string","nullable":true}},"x-operation":"confirmTwoFactor"},"BackupCodes":{"type":"object","properties":{"codes":{"type":"array","items":{"type":"object"}}},"x-operation":"regenerateBackupCodes"},"StepUp":{"type":"object","properties":{"step_up_at":{"type":"string"},"valid_until":{"type":"string"}},"x-operation":"stepUp"},"PasswordChanged":{"type":"object","properties":{"revoked":{"type":"integer"}},"x-operation":"changePassword"},"PasswordSet":{"type":"object","properties":{"ok":{"type":"boolean"}},"x-operation":"setMyPassword"},"Me":{"type":"object","properties":{"member":{"type":"object"},"workspaces":{"type":"array","items":{"type":"object"}},"workspace_name":{"type":"string","nullable":true}},"x-operation":"getMe"},"MyUsage":{"type":"object","properties":{"five_hour":{"type":"object"},"month":{"type":"object"},"by_workspace":{"type":"array","items":{"type":"object"}},"notify_at_percent":{"type":"integer"},"on_exhausted":{"type":"string"}},"x-operation":"getMyUsage"},"SetupTask":{"type":"object","properties":{"key":{"type":"string"},"label":{"type":"string"},"desc":{"type":"string"},"done":{"type":"boolean"},"href":{"type":"string","nullable":true},"available":{"type":"boolean"},"optional":{"type":"boolean"},"skipped":{"type":"boolean"}},"x-operation":"listSetupTasks"},"SetupTasksDismissed":{"type":"object","properties":{"dismissed":{"type":"boolean"},"skipped":{"type":"array","items":{"type":"string"}}},"x-operation":"dismissSetupTasks"},"PairingCode":{"type":"object","properties":{"code":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"createPairingCode"},"BridgeRelease":{"type":"object","properties":{"released":{"type":"boolean"},"version":{"type":"string"},"released_at":{"type":"string"},"update":{"type":"object","nullable":true}},"x-operation":"getLatestBridgeRelease"},"BridgeClaim":{"type":"object","properties":{"device_token":{"type":"string"},"device_id":{"type":"string"},"member_id":{"type":"string"},"device_label":{"type":"string"}},"x-operation":"claimPairingCode"},"BridgeReleaseLink":{"type":"object","properties":{"url":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"downloadBridgeRelease"},"BridgeHeartbeat":{"type":"object","properties":{"ok":{"type":"boolean"},"browser":{"type":"string","nullable":true},"outdated":{"type":"boolean"},"device_id":{"type":"string"}},"x-operation":"sendHeartbeat"},"BridgeDevice":{"type":"object","properties":{"id":{"type":"string"},"device_label":{"type":"string","nullable":true},"state":{"type":"string"},"last_seen_at":{"type":"string","nullable":true},"connected_at":{"type":"string"},"version":{"type":"string","nullable":true},"health":{"type":"array","items":{"type":"object"}},"health_at":{"type":"string","nullable":true},"browser":{"type":"string"},"revoke_reason":{"type":"string","nullable":true}},"x-operation":"listMyDevices"},"TicketDetail":{"type":"object","properties":{"ticket":{"type":"object"},"kind":{"type":"object","nullable":true},"stage":{"type":"object","nullable":true},"assignee":{"type":"object","nullable":true},"can":{"type":"object"},"approval":{"type":"object","nullable":true},"completed":{"type":"object","nullable":true},"time":{"type":"object"},"hold":{"type":"object","nullable":true},"guest_share":{"type":"object"},"handover":{"type":"object","nullable":true},"handover_kinds":{"type":"array","items":{"type":"string"}},"body":{"type":"object"},"fields":{"type":"array","items":{"type":"object"}},"spec_count":{"type":"integer"},"spec_unchecked":{"type":"integer"},"no_spec_reason":{"type":"string","nullable":true},"parent":{"type":"object","nullable":true},"child_count":{"type":"integer"},"link_count":{"type":"integer"},"results":{"type":"object"}},"x-operation":"getTicket"},"TicketKindChoice":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"color":{"type":"string","nullable":true},"position":{"type":"integer"},"is_builtin":{"type":"boolean"},"body_template":{"type":"object","nullable":true},"fields":{"type":"array","items":{"type":"object"}},"color_key":{"type":"string","nullable":true}},"x-operation":"listTicketKinds"},"TicketDraft":{"type":"object","properties":{"draft_id":{"type":"string"},"body":{"type":"object","nullable":true},"saved_at":{"type":"string","nullable":true}},"x-operation":"saveMyTicketDraft"},"BridgeJob":{"type":"object","properties":{"job":{"type":"object","nullable":true},"forbidden_domains":{"type":"array","items":{"type":"object"}},"next_ms":{"type":"integer"},"outdated":{"type":"boolean"}},"x-operation":"takeBridgeJob"},"JobControl":{"type":"object","properties":{"stop":{"type":"boolean"},"reason":{"type":"string","nullable":true},"steers":{"type":"array","items":{"type":"object"}}},"x-operation":"getJobControl"},"TicketDelegation":{"type":"object","properties":{"run_id":{"type":"string"},"job_id":{"type":"string"},"status":{"type":"string"},"pc":{"type":"string"}},"x-operation":"delegateTicket"},"ApprovalDecided":{"type":"object","properties":{"id":{"type":"string"},"decision":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"status_id":{"type":"string","nullable":true},"ticket_id":{"type":"string","nullable":true},"run_id":{"type":"string","nullable":true},"pc":{"type":"string"}},"x-operation":"returnApproval"},"BridgeFinish":{"type":"object","properties":{"ok":{"type":"boolean"},"outcome":{"type":"string"}},"x-operation":"finishBridgeJob"},"BridgeToolResult":{"type":"object","properties":{"result":{"type":"object","nullable":true}},"x-operation":"callKanameTool"},"ActionRunView":{"type":"object","properties":{"id":{"type":"string"},"ticket_id":{"type":"string"},"phase":{"type":"string"},"status":{"type":"string"},"by":{"type":"object"},"pc":{"type":"string"},"silent":{"type":"boolean"},"last_event_at":{"type":"string","nullable":true},"progress":{"type":"string","nullable":true},"stopped_reason":{"type":"string","nullable":true},"return_reason":{"type":"string","nullable":true},"started_at":{"type":"string","nullable":true},"finished_at":{"type":"string","nullable":true},"taken_over_at":{"type":"string","nullable":true},"sweep_failed_at":{"type":"string","nullable":true},"reason_kind":{"type":"string","nullable":true},"checks":{"type":"object"}},"x-operation":"takeoverActionRun"},"ResolvedCredential":{"type":"object","properties":{"credential_id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"name":{"type":"string"},"destinations":{"type":"array","items":{"type":"object"}},"two_factor":{"type":"string"},"expires_at":{"type":"string","nullable":true},"server_key":{"type":"string"},"iv":{"type":"string"},"tag":{"type":"string"},"ciphertext_for_executor":{"type":"string"}},"x-operation":"resolveCredential"},"PlanProposalImpact":{"type":"object","properties":{"customers":{"type":"integer"},"stopped":{"type":"integer"},"monthly_revenue_diff":{"type":"integer"},"immediate":{"type":"boolean"},"existing_from":{"type":"string","nullable":true},"new_from":{"type":"string","nullable":true},"by_workspace":{"type":"array","items":{"type":"object"}}},"x-operation":"getPlanProposalImpact"},"WorkspaceMembers":{"type":"object","properties":{"groups":{"type":"array","items":{"type":"object"}},"invitations":{"type":"array","items":{"type":"object"}},"alerts":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"}},"x-operation":"getWorkspaceMembers"},"InvitationLink":{"type":"object","properties":{"url":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"createInvitationLink"},"PlanChoice":{"type":"object","properties":{"plan_key":{"type":"string"},"name":{"type":"string","nullable":true},"price_monthly":{"type":"integer","nullable":true},"member_limit":{"type":"integer","nullable":true},"current":{"type":"boolean"},"can_choose":{"type":"boolean"},"reason":{"type":"string","nullable":true},"effective_from":{"type":"string"},"summary":{"type":"string"},"recommended":{"type":"boolean"},"upgrade":{"type":"object","nullable":true},"upcoming":{"type":"object","nullable":true}},"x-operation":"listWorkspacePlans"},"Billing":{"type":"object","properties":{"terms":{"type":"string"},"payee":{"type":"object"},"contact":{"type":"object"},"invoices":{"type":"array","items":{"type":"object"}},"overdue":{"type":"object","nullable":true},"free":{"type":"boolean"},"can_edit_contact":{"type":"boolean"}},"x-operation":"getBilling"},"SignedUrl":{"type":"object","properties":{"url":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"downloadInvoicePdf"},"ClientRequestDetail":{"type":"object","properties":{"request":{"type":"object"},"messages":{"type":"array","items":{"type":"object"}},"routes":{"type":"array","items":{"type":"object"}},"can_act":{"type":"boolean"},"pc_connected":{"type":"boolean"},"ticket_draft":{"type":"object","nullable":true},"questions":{"type":"array","items":{"type":"object"}},"reply_draft":{"type":"string","nullable":true},"route_suggestion":{"type":"object","nullable":true}},"x-operation":"getClientRequest"},"PortalHome":{"type":"object","properties":{"group_name":{"type":"string"},"tenant_name":{"type":"string"},"request_scope_name":{"type":"string","nullable":true},"me":{"type":"object"},"first_visit":{"type":"boolean"},"requests":{"type":"array","items":{"type":"object"}},"tickets":{"type":"array","items":{"type":"object"}}},"x-operation":"getPortalHome"},"PortalQuestions":{"type":"object","properties":{"available":{"type":"boolean"},"questions":{"type":"array","items":{"type":"object"}}},"x-operation":"askPortalRequestQuestions"},"PortalRequest":{"type":"object","properties":{"request":{"type":"object"},"messages":{"type":"array","items":{"type":"object"}},"can_write":{"type":"boolean"}},"x-operation":"getPortalRequest"},"PortalTicket":{"type":"object","properties":{"ticket":{"type":"object"},"messages":{"type":"array","items":{"type":"object"}}},"x-operation":"getPortalTicket"},"KnowledgeTree":{"type":"object","properties":{"company_name":{"type":"string"},"company_nodes":{"type":"array","items":{"type":"object"}},"groups":{"type":"array","items":{"type":"object"}},"my_nodes":{"type":"array","items":{"type":"object"}},"can_write":{"type":"object"},"admin_counts":{"type":"object","nullable":true},"truncated":{"type":"boolean"}},"x-operation":"getKnowledgeTree"},"KnowledgePageDetail":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string"},"desc":{"type":"string"},"state":{"type":"string"},"must":{"type":"boolean"},"must_blocked":{"type":"string","nullable":true},"place":{"type":"object"},"acts":{"type":"array","items":{"type":"string"}},"body":{"type":"object","nullable":true},"draft":{"type":"object","nullable":true},"request":{"type":"object","nullable":true},"copied_from":{"type":"object","nullable":true},"shared_from":{"type":"object","nullable":true},"raise_to":{"type":"object","nullable":true},"foot":{"type":"object"}},"x-operation":"getKnowledgePage"},"OpsWorkspaceRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"admin_name":{"type":"string"},"plan_name":{"type":"string","nullable":true},"members":{"type":"object"},"pc":{"type":"object","nullable":true},"runs_month":{"type":"integer","nullable":true},"attention":{"type":"array","items":{"type":"object"}},"billing_state":{"type":"string","nullable":true},"state":{"type":"string"},"state_since":{"type":"string"}},"x-operation":"listOpsWorkspaces"},"OpsWorkspace":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"plan_name":{"type":"string","nullable":true},"state":{"type":"string"},"stop":{"type":"object","nullable":true},"admin":{"type":"object"},"members":{"type":"object"},"inquiries":{"type":"object"},"pc":{"type":"object","nullable":true},"runs_month":{"type":"object"},"stuck_runs":{"type":"object"},"files":{"type":"object"},"recent":{"type":"array","items":{"type":"object"}},"peek":{"type":"object","nullable":true}},"x-operation":"resumeWorkspace"},"OpsWorkspaceMember":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"name":{"type":"string"},"email":{"type":"string","nullable":true},"role_label":{"type":"string"},"last_seen_at":{"type":"string","nullable":true},"pc":{"type":"string"},"login_methods":{"type":"array","items":{"type":"string"}},"verified":{"type":"boolean"}},"x-operation":"listOpsWorkspaceMembers"},"OpsWorkspaceBilling":{"type":"object","properties":{"plan":{"type":"object"},"members":{"type":"object"},"payment_terms":{"type":"string"},"invoices":{"type":"array","items":{"type":"object"}}},"x-operation":"getOpsWorkspaceBilling"},"Shell":{"type":"object","properties":{"member":{"type":"object"},"approvals_waiting":{"type":"integer"},"notifications_unread":{"type":"integer"},"groups":{"type":"array","items":{"type":"object"}},"pc":{"type":"object"},"setup_left":{"type":"integer"},"banner":{"type":"object"},"workspace":{"type":"object"},"saved_views":{"type":"array","items":{"type":"object"},"nullable":true},"service_status":{"type":"object","nullable":true}},"x-operation":"getShell"},"OpsShell":{"type":"object","properties":{"operator":{"type":"object"},"inbox":{"type":"object"},"invoices":{"type":"object","nullable":true},"workspaces":{"type":"object"},"runs_month":{"type":"object"},"pwned":{"type":"object"}},"x-operation":"getOpsShell"},"OpsInquiryDetail":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string","nullable":true},"topic":{"type":"string"},"state":{"type":"string"},"workspace":{"type":"object"},"asker":{"type":"object"},"owner":{"type":"object","nullable":true},"later_until":{"type":"string","nullable":true},"created_at":{"type":"string"},"last_message_at":{"type":"string","nullable":true},"messages":{"type":"array","items":{"type":"object"}},"context":{"type":"object"},"workspace_status":{"type":"object"}},"x-operation":"getOpsInquiry"},"OpsNoticeDetail":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"title":{"type":"string","nullable":true},"audience":{"type":"object"},"state":{"type":"string"},"placements":{"type":"array","items":{"type":"string"}},"publish_at":{"type":"string","nullable":true},"published_at":{"type":"string","nullable":true},"author_name":{"type":"string","nullable":true},"incident_state":{"type":"string","nullable":true},"admins_only":{"type":"boolean"},"body":{"type":"string","nullable":true},"maintenance":{"type":"object","nullable":true},"impact":{"type":"string","nullable":true},"updates":{"type":"array","items":{"type":"object"}},"reach":{"type":"object"}},"x-operation":"sendWorkspaceNotice"},"PublicServiceStatus":{"type":"object","properties":{"incidents":{"type":"array","items":{"type":"object"}},"maintenance":{"type":"object","nullable":true}},"x-operation":"getServiceStatus"},"InvitationPreview":{"type":"object","properties":{"state":{"type":"string"},"workspace_name":{"type":"string"},"inviter_name":{"type":"string","nullable":true},"group_name":{"type":"string","nullable":true},"role":{"type":"string"},"message":{"type":"string","nullable":true},"email":{"type":"string","nullable":true},"expires_at":{"type":"string"},"account_exists":{"type":"boolean"},"signed_in":{"type":"object","nullable":true}},"x-operation":"getInvitation"},"InvitationAccepted":{"type":"object","properties":{"token":{"type":"string"},"workspace_id":{"type":"string"},"next":{"type":"string"},"state":{"type":"string","nullable":true},"email":{"type":"string","nullable":true}},"x-operation":"acceptInvitation"},"ServiceStatus":{"type":"object","properties":{"components":{"type":"array","items":{"type":"object"}},"bands":{"type":"array","items":{"type":"object"}},"maintenance_now":{"type":"object","nullable":true}},"x-operation":"getServiceStatusForMember"},"InvitationResendResult":{"type":"object","properties":{"result":{"type":"string"}},"x-operation":"requestInvitationResend"},"Credential":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"description":{"type":"string","nullable":true},"layer":{"type":"string"},"kind":{"type":"string"},"two_factor":{"type":"string"},"destinations":{"type":"array","items":{"type":"string"}},"expires_on":{"type":"string","nullable":true},"use_count":{"type":"integer"},"last_used_at":{"type":"string","nullable":true},"login_check":{"type":"object"},"can_edit":{"type":"boolean"},"created_at":{"type":"string"},"updated_at":{"type":"string"}},"x-operation":"updateCredential"},"CredentialDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteCredential"},"CredentialLoginCheck":{"type":"object","properties":{"state":{"type":"string"},"job_id":{"type":"string","format":"uuid","nullable":true}},"x-operation":"checkCredentialLogin"},"CredentialLoginAnswer":{"type":"object","properties":{"accepted":{"type":"boolean"}},"x-operation":"answerCredentialLoginCheck"},"CredentialCheckReport":{"type":"object","properties":{"accepted":{"type":"boolean"},"code":{"type":"string","nullable":true}},"x-operation":"reportCredentialCheck"},"RevokedDevice":{"type":"object","properties":{"id":{"type":"string"},"device_label":{"type":"string","nullable":true},"revoked_at":{"type":"string","nullable":true},"revoke_reason":{"type":"string"}},"x-operation":"revokeMyDevice"},"DeviceBrowser":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"browser":{"type":"string"}},"x-operation":"updateMyDevice"},"DeviceBrowserCheck":{"type":"object","properties":{"job_id":{"type":"string","format":"uuid"}},"x-operation":"checkMyDeviceBrowser"},"BridgeBrowser":{"type":"object","properties":{"browser":{"type":"string"}},"x-operation":"setBridgeBrowser"},"TicketTimelineSeen":{"type":"object","properties":{"ticket_id":{"type":"string"},"seen_at":{"type":"string"}},"x-operation":"markTicketTimelineSeen"},"TicketMessageStar":{"type":"object","properties":{"id":{"type":"string"},"stars":{"type":"integer"},"starred":{"type":"boolean"}},"x-operation":"starTicketMessage"},"TicketUpdated":{"type":"object","properties":{"ticket":{"type":"object"},"stage":{"type":"object","nullable":true},"changed":{"type":"boolean"},"message_id":{"type":"string","format":"uuid","nullable":true}},"x-operation":"updateTicket"},"TicketDecision":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"},"text":{"type":"string"},"reason":{"type":"string","nullable":true},"decided_by":{"type":"object","nullable":true},"decided_note":{"type":"string","nullable":true},"decided_at":{"type":"string"},"source":{"type":"object","nullable":true},"revises_id":{"type":"string","format":"uuid","nullable":true},"superseded_by_id":{"type":"string","format":"uuid","nullable":true},"cancelled":{"type":"object","nullable":true},"promoted_to":{"type":"string"}},"x-operation":"listTicketDecisions"},"TicketDecisionCreated":{"type":"object","properties":{"decision":{"type":"object"},"message_id":{"type":"string","format":"uuid"}},"x-operation":"createTicketDecision"},"TicketDecisionChange":{"type":"object","properties":{"decision":{"type":"object"},"previous":{"type":"object","nullable":true},"message_id":{"type":"string","format":"uuid"}},"x-operation":"updateTicketDecision"},"HandoverPreview":{"type":"object","properties":{"kinds":{"type":"array","items":{"type":"string"}},"blocked":{"type":"string","nullable":true},"waiting":{"type":"object","nullable":true},"default_reply_due":{"type":"string"},"rules":{"type":"array","items":{"type":"object"}},"children":{"type":"object"},"links":{"type":"object"},"group":{"type":"object"},"candidates":{"type":"array","items":{"type":"object"}},"groups":{"type":"array","items":{"type":"object"}}},"x-operation":"previewTicketHandover"},"HandoverRule":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"target":{"type":"string"},"axis_id":{"type":"string","format":"uuid","nullable":true},"axis_name":{"type":"string","nullable":true},"mode":{"type":"string"}},"x-operation":"listHandoverRules"},"TicketHandoverCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"state":{"type":"string"},"from":{"type":"object"},"to":{"type":"object","nullable":true},"to_scope":{"type":"object","nullable":true},"reason":{"type":"string","nullable":true},"ask":{"type":"string","nullable":true},"reply_due":{"type":"string","nullable":true},"switch":{"type":"object"},"switch_applied":{"type":"object","nullable":true},"notify_managers":{"type":"boolean"},"decline_reason":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"created_at":{"type":"string"}},"x-operation":"createTicketHandover"},"TicketHandoverAnswered":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"state":{"type":"string"},"from":{"type":"object"},"to":{"type":"object","nullable":true},"to_scope":{"type":"object","nullable":true},"reason":{"type":"string","nullable":true},"ask":{"type":"string","nullable":true},"reply_due":{"type":"string","nullable":true},"switch":{"type":"object"},"switch_applied":{"type":"object","nullable":true},"notify_managers":{"type":"boolean"},"decline_reason":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"created_at":{"type":"string"}},"x-operation":"answerTicketHandover"},"TicketHandover":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"state":{"type":"string"},"from":{"type":"object"},"to":{"type":"object","nullable":true},"to_scope":{"type":"object","nullable":true},"ticket_scope":{"type":"object"},"reason":{"type":"string","nullable":true},"ask":{"type":"string","nullable":true},"reply_due":{"type":"string","nullable":true},"overdue":{"type":"boolean"},"switch":{"type":"object"},"decline_reason":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"reminded_at":{"type":"string","nullable":true},"created_at":{"type":"string"},"can":{"type":"object"}},"x-operation":"listTicketHandovers"},"HandoverWithdrawn":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"state":{"type":"string"},"decided_at":{"type":"string"}},"x-operation":"withdrawTicketHandover"},"HandoverReminded":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"reminded_at":{"type":"string"}},"x-operation":"remindTicketHandover"},"TicketHandoverClaimed":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"state":{"type":"string"},"ticket_id":{"type":"string","format":"uuid"},"assignee_member_id":{"type":"string","format":"uuid"}},"x-operation":"claimTicketHandover"},"InvitationsSent":{"type":"object","properties":{"invitations":{"type":"array","items":{"type":"object"}}},"x-operation":"createInvitations"},"InvitationJoinConfirmed":{"type":"object","properties":{"token":{"type":"string"},"workspace_id":{"type":"string","format":"uuid"},"next":{"type":"string"}},"x-operation":"confirmInvitationJoin"},"BodySaved":{"type":"object","properties":{"version":{"type":"integer"},"changed":{"type":"boolean"},"edited_at":{"type":"string"}},"x-operation":"updateTicketBody"},"TicketVersionsView":{"type":"object","properties":{"versions":{"type":"array","items":{"type":"object"}},"from":{"type":"object","nullable":true},"to":{"type":"object","nullable":true}},"x-operation":"listTicketVersions"},"BodyRestored":{"type":"object","properties":{"version":{"type":"integer"},"changed":{"type":"boolean"},"edited_at":{"type":"string"}},"x-operation":"restoreTicketVersion"},"TicketItemChangesView":{"type":"object","properties":{"points":{"type":"array","items":{"type":"object"}},"from":{"type":"integer","nullable":true},"to":{"type":"integer"},"diff":{"type":"array","items":{"type":"object"}}},"x-operation":"listTicketItemChanges"},"TestSpecItem":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string"},"checked":{"type":"boolean"},"position":{"type":"integer"},"source":{"type":"string"},"version":{"type":"integer"},"source_page":{"type":"object","nullable":true}},"x-operation":"deleteTestSpec"},"TicketLink":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"side":{"type":"string","nullable":true},"other":{"type":"object"},"can_remove":{"type":"boolean"},"created_at":{"type":"string"}},"x-operation":"createTicketLink"},"TicketLinkDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteTicketLink"},"Notification":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"tag":{"type":"string"},"href":{"type":"string","nullable":true},"ticket_id":{"type":"string","format":"uuid","nullable":true},"number":{"type":"string","nullable":true},"title":{"type":"string","nullable":true},"actor":{"type":"object","nullable":true},"params":{"type":"object"},"read":{"type":"boolean"},"read_at":{"type":"string","nullable":true},"created_at":{"type":"string"}},"x-operation":"readNotification"},"NotificationsRead":{"type":"object","properties":{"read":{"type":"integer"}},"x-operation":"readAllNotifications"},"SavedView":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"share":{"type":"string"},"scope_id":{"type":"string","format":"uuid","nullable":true},"filters":{"type":"object"},"columns":{"type":"array","items":{"type":"string"}},"density":{"type":"string"},"member_id":{"type":"string","format":"uuid"},"member_name":{"type":"string"},"mine":{"type":"boolean"},"can_edit":{"type":"boolean"},"created_at":{"type":"string"},"updated_at":{"type":"string"}},"x-operation":"updateSavedView"},"SavedViewDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteSavedView"},"TicketDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"deleted_count":{"type":"integer"},"withdrawn_approvals":{"type":"integer"},"stopped_runs":{"type":"integer"},"restorable_until":{"type":"string"}},"x-operation":"deleteTicket"},"TicketRestored":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"restored_count":{"type":"integer"}},"x-operation":"restoreTicket"},"TicketField":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"field_type":{"type":"string"},"required":{"type":"boolean"},"description":{"type":"string","nullable":true},"options":{"type":"array","items":{"type":"object"}},"position":{"type":"integer"}},"x-operation":"listTicketFields"},"ItemRestored":{"type":"object","properties":{"changed":{"type":"boolean"},"restored":{"type":"array","items":{"type":"object"}},"skipped":{"type":"array","items":{"type":"object"}}},"x-operation":"restoreTicketItems"},"KnowledgeVersionItem":{"type":"object","properties":{"version":{"type":"integer"},"published_at":{"type":"string","nullable":true},"by_name":{"type":"string","nullable":true}},"x-operation":"listKnowledgeVersions"},"KnowledgeVersion":{"type":"object","properties":{"version":{"type":"integer"},"published_at":{"type":"string","nullable":true},"by_name":{"type":"string","nullable":true},"body":{"type":"object"}},"x-operation":"getKnowledgePageVersion"},"KnowledgeFolder":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"shelf":{"type":"string"},"group_id":{"type":"string","format":"uuid","nullable":true},"parent_folder_id":{"type":"string","format":"uuid","nullable":true},"position":{"type":"integer"}},"x-operation":"updateKnowledgeFolder"},"KnowledgeFolderDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteKnowledgeFolder"},"KnowledgePageStub":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string"},"desc":{"type":"string"},"state":{"type":"string"},"must":{"type":"boolean"},"place":{"type":"object"}},"x-operation":"copyKnowledgePage"},"KnowledgeDraftSaved":{"type":"object","properties":{"saved_at":{"type":"string"},"title":{"type":"string"},"desc":{"type":"string"}},"x-operation":"saveKnowledgeDraft"},"KnowledgeDraftDiscarded":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"page_deleted":{"type":"boolean"}},"x-operation":"discardKnowledgeDraft"},"KnowledgePublished":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"version":{"type":"integer"},"published_at":{"type":"string","nullable":true}},"x-operation":"publishKnowledgePage"},"KnowledgePageDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteKnowledgePage"},"KnowledgeMustSet":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"must":{"type":"boolean"},"used":{"type":"integer"},"limit":{"type":"integer"}},"x-operation":"setKnowledgeMust"},"KnowledgeSimilar":{"type":"object","properties":{"pages":{"type":"array","items":{"type":"object"}}},"x-operation":"findSimilarKnowledge"},"KnowledgeRequest":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"state":{"type":"string"},"page_id":{"type":"string","format":"uuid","nullable":true},"to_name":{"type":"string"},"at":{"type":"string"}},"x-operation":"requestKnowledgeRaise"},"KnowledgeRequestEnded":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"state":{"type":"string"}},"x-operation":"dismissKnowledgeRequest"},"KnowledgeApproval":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"from_name":{"type":"string"},"from_shelf_name":{"type":"string"},"to_shelf_name":{"type":"string"},"title":{"type":"string"},"desc":{"type":"string"},"message":{"type":"string","nullable":true},"requested_at":{"type":"string"},"similar":{"type":"object","nullable":true},"body":{"type":"object","nullable":true}},"x-operation":"listKnowledgeApprovals"},"KnowledgeRequestDecided":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"state":{"type":"string"},"page_id":{"type":"string","format":"uuid","nullable":true},"folder_id":{"type":"string","format":"uuid","nullable":true}},"x-operation":"declineKnowledgeRequest"},"KnowledgeShareChoice":{"type":"object","properties":{"target":{"type":"object"},"from_group_name":{"type":"string"},"groups":{"type":"array","items":{"type":"object"}}},"x-operation":"setKnowledgeShares"},"KnowledgeReview":{"type":"object","properties":{"unused":{"type":"array","items":{"type":"object"}},"conflicts":{"type":"array","items":{"type":"object"}},"broken":{"type":"array","items":{"type":"object"}}},"x-operation":"getKnowledgeReview"},"TicketKindSetting":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"color_key":{"type":"string","nullable":true},"position":{"type":"integer"},"is_builtin":{"type":"boolean"},"body_template":{"type":"object","nullable":true}},"x-operation":"reorderTicketKinds"},"TicketKindDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteTicketKind"},"TicketStageSetting":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string","nullable":true},"name":{"type":"string"},"color_key":{"type":"string"},"position":{"type":"integer"},"lock":{"type":"string","nullable":true}},"x-operation":"reorderTicketStages"},"TicketStageDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteTicketStage"},"TicketFieldSetting":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"field_type":{"type":"string"},"required":{"type":"boolean"},"description":{"type":"string","nullable":true},"options":{"type":"array","items":{"type":"object"}},"position":{"type":"integer"},"kind_ids":{"type":"array","items":{"type":"string","format":"uuid"}},"all_kinds":{"type":"boolean"},"value_count":{"type":"integer"}},"x-operation":"reorderTicketFields"},"TicketFieldDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteTicketField"},"ActionRunStopped":{"type":"object","properties":{"id":{"type":"string"},"ticket_id":{"type":"string"},"phase":{"type":"string"},"status":{"type":"string"},"stopped_reason":{"type":"string","nullable":true},"stopped_at":{"type":"string","nullable":true}},"x-operation":"stopActionRun"},"ApprovalStopped":{"type":"object","properties":{"id":{"type":"string"},"decision":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"status_id":{"type":"string","nullable":true},"ticket_id":{"type":"string","nullable":true}},"x-operation":"stopApproval"},"ApprovalWithdrawn":{"type":"object","properties":{"id":{"type":"string"},"withdrawn_at":{"type":"string"},"ticket_id":{"type":"string"},"approval_id":{"type":"string"}},"x-operation":"withdrawApproval"},"ApprovalEdited":{"type":"object","properties":{"id":{"type":"string"},"ticket_id":{"type":"string"},"version":{"type":"integer"},"edited_at":{"type":"string"}},"x-operation":"editApproval"},"DryRunStarted":{"type":"object","properties":{"run_id":{"type":"string"},"job_id":{"type":"string"},"status":{"type":"string"},"pc":{"type":"string"}},"x-operation":"dryRunTicket"},"ApprovalHistoryItem":{"type":"object","properties":{"id":{"type":"string"},"ticket_id":{"type":"string","nullable":true},"ticket_number":{"type":"string"},"title":{"type":"string"},"decision":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"reason":{"type":"string","nullable":true},"next_actor":{"type":"string","nullable":true},"withdrawn_at":{"type":"string","nullable":true},"run_status":{"type":"string","nullable":true},"can_withdraw":{"type":"boolean"}},"x-operation":"listApprovalHistory"},"MyClone":{"type":"object","properties":{"name":{"type":"string"},"full_name":{"type":"string"},"since":{"type":"string"},"pc":{"type":"object"}},"x-operation":"getMyClone"},"ConversationView":{"type":"object","properties":{"conversation":{"type":"object"},"messages":{"type":"array","items":{"type":"object"}},"has_more":{"type":"boolean"},"running_job_id":{"type":"string","format":"uuid","nullable":true},"work":{"type":"object","nullable":true},"stopped":{"type":"object","nullable":true}},"x-operation":"getConversation"},"ConversationRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string"},"updated_at":{"type":"string"},"last_text":{"type":"string","nullable":true}},"x-operation":"listConversations"},"MessageView":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"who":{"type":"string"},"text":{"type":"string"},"at":{"type":"string"},"job_id":{"type":"string","format":"uuid","nullable":true},"passed":{"type":"array","items":{"type":"object"}},"proposal":{"type":"object","nullable":true},"took":{"type":"object","nullable":true}},"x-operation":"listConversationMessages"},"ConversationSaid":{"type":"object","properties":{"id":{"type":"string"},"conversation_id":{"type":"string"},"job_id":{"type":"string"}},"x-operation":"sendConversationMessage"},"ConversationStopped":{"type":"object","properties":{"state":{"type":"string"}},"x-operation":"stopConversation"},"ConversationEntriesMirrored":{"type":"object","properties":{"inserted":{"type":"integer"}},"x-operation":"mirrorConversationEntries"},"MirrorTarget":{"type":"object","properties":{"conversation_id":{"type":"string","format":"uuid"},"agent_session_id":{"type":"string"},"job_id":{"type":"string","format":"uuid"}},"x-operation":"listMirrorTargets"},"BridgeBrowserReported":{"type":"object","properties":{"ok":{"type":"boolean"}},"x-operation":"reportBrowserState"},"BridgeJobFile":{"type":"object","properties":{"url":{"type":"string"},"name":{"type":"string","nullable":true},"mime":{"type":"string","nullable":true},"size":{"type":"integer","nullable":true}},"x-operation":"getFileForBridge"},"TicketAgentSession":{"type":"object","properties":{"conversation":{"type":"object","nullable":true},"messages":{"type":"array","items":{"type":"object"}},"has_more":{"type":"boolean"},"running_job_id":{"type":"string","format":"uuid","nullable":true},"work":{"type":"object","nullable":true},"stopped":{"type":"object","nullable":true}},"x-operation":"getTicketAgentSession"},"TicketAgentSent":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"conversation_id":{"type":"string","format":"uuid"},"job_id":{"type":"string","format":"uuid"}},"x-operation":"sendTicketAgentMessage"},"BulkApprovalPreview":{"type":"object","properties":{"eligible":{"type":"array","items":{"type":"object"}},"excluded":{"type":"array","items":{"type":"object"}},"count":{"type":"integer"},"irreversible_count":{"type":"integer"},"unchecked_count":{"type":"integer"}},"x-operation":"previewBulkApproval"},"DraftConversationStarted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"startDraftConversation"},"DraftMessageSent":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"conversation_id":{"type":"string","format":"uuid"},"job_id":{"type":"string","format":"uuid"}},"x-operation":"sendDraftMessage"},"ConversationAdopted":{"type":"object","properties":{"conversation_id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"}},"x-operation":"adoptDraftConversation"},"ScopeCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"ticket_prefix":{"type":"string","nullable":true},"color":{"type":"string","nullable":true},"parent_id":{"type":"string","format":"uuid","nullable":true},"layer":{"type":"object","nullable":true},"position":{"type":"integer"},"managers":{"type":"array","items":{"type":"object"}},"member_count":{"type":"integer"},"created_at":{"type":"string"}},"x-operation":"createScope"},"LayerCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"label":{"type":"string"},"order_no":{"type":"integer"},"group_count":{"type":"integer"},"created_at":{"type":"string"}},"x-operation":"createLayer"},"LayerUpdated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"label":{"type":"string"},"order_no":{"type":"integer"},"group_count":{"type":"integer"},"created_at":{"type":"string"}},"x-operation":"updateLayer"},"Layer":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"label":{"type":"string"},"order_no":{"type":"integer"},"group_count":{"type":"integer"},"created_at":{"type":"string"}},"x-operation":"listLayers"},"ScopeUpdated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"ticket_prefix":{"type":"string","nullable":true},"color":{"type":"string","nullable":true},"parent_id":{"type":"string","format":"uuid","nullable":true},"layer":{"type":"object","nullable":true},"position":{"type":"integer"},"managers":{"type":"array","items":{"type":"object"}},"member_count":{"type":"integer"},"created_at":{"type":"string"}},"x-operation":"updateScope"},"ScopeListItem":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"},"ticket_prefix":{"type":"string","nullable":true},"color":{"type":"string","nullable":true},"parent_id":{"type":"string","format":"uuid","nullable":true},"layer":{"type":"object","nullable":true},"position":{"type":"integer"},"managers":{"type":"array","items":{"type":"object"}},"member_count":{"type":"integer"},"created_at":{"type":"string"},"layer_id":{"type":"string","format":"uuid","nullable":true}},"x-operation":"listScopes"},"InvitationResent":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"email":{"type":"string","nullable":true},"expires_at":{"type":"string"},"mail":{"type":"string"}},"x-operation":"resendInvitation"},"InvitationRevoked":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"revoked_at":{"type":"string"}},"x-operation":"revokeInvitation"},"MemberDetail":{"type":"object","properties":{"member":{"type":"object"},"groups":{"type":"array","items":{"type":"object"}},"assigned":{"type":"object"},"clone":{"type":"object"},"login":{"type":"object"},"recent_events":{"type":"array","items":{"type":"object"}}},"x-operation":"getMember"},"MemberRoleChanged":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"company_role":{"type":"string"},"groups":{"type":"array","items":{"type":"object"}}},"x-operation":"updateMemberRole"},"MemberGroupsChanged":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"company_role":{"type":"string"},"groups":{"type":"array","items":{"type":"object"}}},"x-operation":"updateMemberGroups"},"MemberStateChanged":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"suspended":{"type":"boolean"},"suspended_at":{"type":"string","nullable":true}},"x-operation":"resumeMember"},"MemberRemovalPreview":{"type":"object","properties":{"member":{"type":"object"},"blocked_by":{"type":"string","nullable":true},"tickets":{"type":"array","items":{"type":"object"}},"handovers_cancelled":{"type":"array","items":{"type":"object"}},"approvals_reassigned":{"type":"array","items":{"type":"object"}},"sole_approver":{"type":"array","items":{"type":"object"}},"deleted":{"type":"array","items":{"type":"object"}},"kept":{"type":"array","items":{"type":"object"}},"restorable_until":{"type":"string"}},"x-operation":"previewMemberRemoval"},"WorkspaceSettings":{"type":"object","properties":{"workspace":{"type":"object"},"permissions":{"type":"array","items":{"type":"object"}},"fixed_rules":{"type":"array","items":{"type":"object"}},"deletion":{"type":"object"},"access":{"type":"object"}},"x-operation":"getWorkspaceSettings"},"WorkspaceRenamed":{"type":"object","properties":{"workspace":{"type":"object"}},"x-operation":"updateWorkspace"},"WorkspaceLogo":{"type":"object","properties":{"logo":{"type":"object"}},"x-operation":"uploadWorkspaceLogo"},"WorkspacePermissions":{"type":"object","properties":{"permissions":{"type":"array","items":{"type":"object"}}},"x-operation":"updateWorkspacePermissions"},"WorkspaceDeletion":{"type":"object","properties":{"deletion":{"type":"object"}},"x-operation":"cancelWorkspaceDeletion"},"MeUpdated":{"type":"object","properties":{"member":{"type":"object"},"saved_at":{"type":"string"}},"x-operation":"updateMe"},"Avatar":{"type":"object","properties":{"avatar":{"type":"object"}},"x-operation":"uploadAvatar"},"EmailChangeRequested":{"type":"object","properties":{"pending_email":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"requestEmailChange"},"EmailChanged":{"type":"object","properties":{"changed":{"type":"boolean"},"email":{"type":"string"}},"x-operation":"verifyEmailChange"},"MySessions":{"type":"object","properties":{"sessions":{"type":"array","items":{"type":"object"}},"events":{"type":"array","items":{"type":"object"}}},"x-operation":"listMySessions"},"MySessionRevoked":{"type":"object","properties":{"revoked":{"type":"boolean"}},"x-operation":"revokeMySession"},"MySessionsRevoked":{"type":"object","properties":{"revoked":{"type":"integer"}},"x-operation":"revokeOtherSessions"},"NotificationSettingsCopied":{"type":"object","properties":{"copied_to":{"type":"array","items":{"type":"object"}}},"x-operation":"copyNotificationSettings"},"WorkspaceLeft":{"type":"object","properties":{"tenant_id":{"type":"string","format":"uuid"},"left":{"type":"boolean"},"restorable_until":{"type":"string"}},"x-operation":"leaveWorkspace"},"MemberRemoved":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"tickets_moved":{"type":"integer"},"handovers_cancelled":{"type":"integer"},"restorable_until":{"type":"string"}},"x-operation":"removeMember"},"WorkspaceSwitched":{"type":"object","properties":{"tenant_id":{"type":"string","format":"uuid"},"switched":{"type":"boolean"}},"x-operation":"switchWorkspace"},"MyInvitations":{"type":"object","properties":{"invitations":{"type":"array","items":{"type":"object"}},"total":{"type":"integer"}},"x-operation":"listMyInvitations"},"GuestGroupCreated":{"type":"object","properties":{"group":{"type":"object"}},"x-operation":"createGuestGroup"},"TicketGuestSharesUpdated":{"type":"object","properties":{"shared":{"type":"array","items":{"type":"object"}}},"x-operation":"updateTicketGuestShares"},"PortalTicketMessageCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"postPortalTicketMessage"},"ClientRequestList":{"type":"object","properties":{"items":{"type":"array","items":{"type":"object"}},"counts":{"type":"object"}},"x-operation":"listClientRequests"},"ClientRequestRouted":{"type":"object","properties":{"route_name":{"type":"string"}},"x-operation":"updateClientRequest"},"ClientRequestReplied":{"type":"object","properties":{"state":{"type":"string"}},"x-operation":"replyToClientRequest"},"ClientRequestAccepted":{"type":"object","properties":{"ticket_id":{"type":"string","format":"uuid"},"number":{"type":"string"}},"x-operation":"acceptClientRequest"},"ClientRequestDeclined":{"type":"object","properties":{"state":{"type":"string"}},"x-operation":"declineClientRequest"},"ClientRequestDraftQueued":{"type":"object","properties":{"job_id":{"type":"string","format":"uuid"}},"x-operation":"requestClientRequestDraft"},"ClientRequestDraftResult":{"type":"object","properties":{"state":{"type":"string"}},"x-operation":"reportClientRequestDraft"},"PortalRequestCreated":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"createPortalRequest"},"PortalRequestMessagePosted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"postPortalRequestMessage"},"PortalAttachmentAdded":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string","nullable":true}},"x-operation":"uploadPortalAttachment"},"GuestGroupRenamed":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"name":{"type":"string"}},"x-operation":"updateGuestGroup"},"GuestGroupDeleted":{"type":"object","properties":{"id":{"type":"string","format":"uuid"}},"x-operation":"deleteGuestGroup"},"OpsSetupSession":{"type":"object","properties":{"token":{"type":"string"}},"x-operation":"startOpsSetup"},"MyInquiry":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string","nullable":true},"topic":{"type":"string"},"state":{"type":"string"},"created_at":{"type":"string"},"last_reply_at":{"type":"string","nullable":true},"has_unread_reply":{"type":"boolean"}},"x-operation":"resolveMyInquiry"},"MyInquiryDetail":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string","nullable":true},"topic":{"type":"string"},"state":{"type":"string"},"created_at":{"type":"string"},"last_reply_at":{"type":"string","nullable":true},"has_unread_reply":{"type":"boolean"},"messages":{"type":"array","items":{"type":"object"}},"context":{"type":"object","nullable":true}},"x-operation":"getMyInquiry"},"MyInquiryMessage":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"from":{"type":"string"},"author_name":{"type":"string","nullable":true},"body":{"type":"string","nullable":true},"attachments":{"type":"array","items":{"type":"object"},"nullable":true},"created_at":{"type":"string"}},"x-operation":"postInquiryMessage"},"InquiryAttachmentUpload":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"upload_url":{"type":"string"},"done_url":{"type":"string"},"expires_at":{"type":"string"}},"x-operation":"uploadInquiryAttachment"},"OpsInquiryRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string","nullable":true},"topic":{"type":"string"},"state":{"type":"string"},"workspace":{"type":"object"},"asker":{"type":"object"},"owner":{"type":"object","nullable":true},"later_until":{"type":"string","nullable":true},"created_at":{"type":"string"},"last_message_at":{"type":"string","nullable":true}},"x-operation":"updateOpsInquiry"},"OpsInquiryMessage":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string","nullable":true},"author_name":{"type":"string","nullable":true},"body":{"type":"string","nullable":true},"attachments":{"type":"array","items":{"type":"object"},"nullable":true},"created_at":{"type":"string"}},"x-operation":"addOpsInquiryNote"},"OpsMemberRow":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"name":{"type":"string"},"email":{"type":"string"},"caps":{"type":"array","items":{"type":"string"}},"has_passkey":{"type":"boolean"},"setup_pending":{"type":"boolean"},"is_self":{"type":"boolean"},"locked_caps":{"type":"array","items":{"type":"string"}}},"x-operation":"updateOpsMemberCaps"},"PlanOps":{"type":"object","properties":{"plan_key":{"type":"string"},"name":{"type":"string","nullable":true},"version":{"type":"integer"},"price_monthly":{"type":"integer","nullable":true},"member_limit":{"type":"integer"},"trial_days":{"type":"integer"},"facts":{"type":"array","items":{"type":"object"}},"places":{"type":"integer"},"proposal":{"type":"object","nullable":true}},"x-operation":"listOpsPlans"},"PlanProposal":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"plan_key":{"type":"string"},"plan_name":{"type":"string"},"from_version":{"type":"integer","nullable":true},"to_version":{"type":"integer","nullable":true},"before":{"type":"object"},"changes":{"type":"object"},"existing_policy":{"type":"string"},"notice_days":{"type":"integer","nullable":true},"new_from":{"type":"string","nullable":true},"reason":{"type":"string"},"state":{"type":"string"},"proposer":{"type":"object"},"decider":{"type":"object","nullable":true},"return_reason":{"type":"string","nullable":true},"created_at":{"type":"string"},"submitted_at":{"type":"string","nullable":true},"decided_at":{"type":"string","nullable":true},"can_edit":{"type":"boolean"},"can_decide":{"type":"boolean"}},"x-operation":"returnPlanProposal"},"PlanHistoryRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"at":{"type":"string"},"actor_name":{"type":"string","nullable":true},"action":{"type":"string"},"plan_name":{"type":"string","nullable":true},"to_version":{"type":"integer","nullable":true},"reason":{"type":"string","nullable":true},"price":{"type":"object","nullable":true},"members":{"type":"object","nullable":true}},"x-operation":"listPlanHistory"},"OpsTemplateRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"name":{"type":"string","nullable":true},"summary":{"type":"string"},"version":{"type":"integer"},"using":{"type":"integer"},"took":{"type":"object","nullable":true},"last_released_at":{"type":"string","nullable":true}},"x-operation":"releaseOpsTemplate"},"OpsTemplate":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"name":{"type":"string","nullable":true},"summary":{"type":"string"},"version":{"type":"integer"},"using":{"type":"integer"},"took":{"type":"object","nullable":true},"last_released_at":{"type":"string","nullable":true},"items":{"type":"array","items":{"type":"object"}},"versions":{"type":"array","items":{"type":"object"}}},"x-operation":"getOpsTemplate"},"KindTemplateUpdate":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"part":{"type":"string"},"part_name":{"type":"string"},"from_version":{"type":"integer"},"to_version":{"type":"integer"},"released_at":{"type":"string","nullable":true},"diffs":{"type":"array","items":{"type":"object"}}},"x-operation":"applyKindTemplateUpdate"},"OpsPwnedRow":{"type":"object","properties":{"workspace":{"type":"object","nullable":true},"member":{"type":"object","nullable":true},"last_at":{"type":"string"},"count":{"type":"integer"}},"x-operation":"listOpsPwned"},"OpsPwnedAck":{"type":"object","properties":{"acknowledged_at":{"type":"string"},"remaining":{"type":"integer"}},"x-operation":"ackOpsPwned"},"Notice":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"title":{"type":"string","nullable":true},"body":{"type":"string","nullable":true},"state":{"type":"string","nullable":true},"published_at":{"type":"string"},"unread":{"type":"boolean"},"maintenance":{"type":"object","nullable":true},"updates":{"type":"array","items":{"type":"object"}}},"x-operation":"listNotices"},"NoticeRead":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"read_at":{"type":"string"}},"x-operation":"markNoticeRead"},"OpsNoticeRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"kind":{"type":"string"},"title":{"type":"string","nullable":true},"audience":{"type":"object"},"state":{"type":"string"},"placements":{"type":"array","items":{"type":"string"}},"publish_at":{"type":"string","nullable":true},"published_at":{"type":"string","nullable":true},"author_name":{"type":"string","nullable":true},"incident_state":{"type":"string","nullable":true},"admins_only":{"type":"boolean"}},"x-operation":"listOpsNotices"},"BillingContact":{"type":"object","properties":{"company":{"type":"string"},"attn":{"type":"string"},"email":{"type":"string"}},"x-operation":"updateBillingContact"},"PlanChange":{"type":"object","properties":{"plan_key":{"type":"string"},"effective_from":{"type":"string"},"prorated_amount":{"type":"integer"},"next_invoice_on":{"type":"string"}},"x-operation":"changeOpsWorkspacePlan"},"OpsInvoiceRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"workspace":{"type":"object"},"plan_name":{"type":"string","nullable":true},"month":{"type":"string"},"amount_total":{"type":"integer"},"state":{"type":"string"},"paid_total":{"type":"integer"},"difference":{"type":"integer"},"due_on":{"type":"string","nullable":true},"can_record_payment":{"type":"boolean"},"payments":{"type":"array","items":{"type":"object"}}},"x-operation":"recordPayment"},"OpsInvoiceIssue":{"type":"object","properties":{"month":{"type":"string"},"count":{"type":"integer"},"total":{"type":"integer"},"lines":{"type":"array","items":{"type":"object"}}},"x-operation":"issueOpsInvoices"},"OpsVerificationResent":{"type":"object","properties":{"sent_at":{"type":"string"}},"x-operation":"resendOpsVerification"},"OpsWorkspaceInquiry":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"title":{"type":"string","nullable":true},"topic":{"type":"string"},"asker_name":{"type":"string"},"owner_name":{"type":"string","nullable":true},"state":{"type":"string"},"created_at":{"type":"string"}},"x-operation":"listOpsWorkspaceInquiries"},"OpsWorkspaceAuditRow":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"at":{"type":"string"},"actor_name":{"type":"string"},"action":{"type":"string"},"action_label":{"type":"string"},"target_label":{"type":"string","nullable":true},"reason":{"type":"string","nullable":true}},"x-operation":"listOpsWorkspaceAudit"},"OpsPeek":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"workspace_id":{"type":"string","format":"uuid"},"reason":{"type":"string"},"expires_at":{"type":"string"},"closed_at":{"type":"string","nullable":true}},"x-operation":"closePeek"},"OpsMemberRemoved":{"type":"object","properties":{"member_id":{"type":"string","format":"uuid"},"removed_at":{"type":"string"},"released_inquiries":{"type":"integer"}},"x-operation":"removeOpsMember"},"OpsOperation":{"type":"object","properties":{"id":{"type":"string","format":"uuid"},"key":{"type":"string"},"name":{"type":"string"},"version_label":{"type":"string","nullable":true},"description":{"type":"string","nullable":true},"check_state":{"type":"string"}},"x-operation":"listOperations"},"OpsInvoiceTemplate":{"type":"object","properties":{"company":{"type":"string"},"address":{"type":"string"},"reg_no":{"type":"string"},"contact":{"type":"string"},"payee":{"type":"string"},"note":{"type":"string"},"version":{"type":"integer"},"updated_at":{"type":"string","nullable":true},"updated_by_name":{"type":"string","nullable":true}},"x-operation":"updateOpsInvoiceTemplate"},"OpsPwnedPendingAck":{"type":"object","properties":{"acknowledged_at":{"type":"string"},"remaining":{"type":"integer"}},"x-operation":"ackOpsPwnedPending"},"UpdateConversationInput":{"type":"object","properties":{"title":{"type":"string","nullable":false,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"participant_member_ids":{"type":"array","items":{"type":"string","format":"uuid"},"nullable":true},"area":{"type":"string","nullable":true},"subject_type":{"type":"string","nullable":true},"parent_conversation_id":{"type":"string","format":"uuid","nullable":true},"agent_session_id":{"type":"string","nullable":true},"branched_from_message_id":{"type":"string","format":"uuid","nullable":true},"owner_member_id":{"type":"string","format":"uuid","nullable":true},"closed_at":{"type":"string","format":"date-time","nullable":true},"title_auto":{"type":"boolean"},"starred_at":{"type":"string","format":"date-time","nullable":true},"incognito":{"type":"boolean"},"last_read_at":{"type":"string","format":"date-time","nullable":true},"talk_kind":{"type":"string"},"ticket_id":{"type":"string","format":"uuid","nullable":true}},"additionalProperties":false,"x-operation":"updateConversation"}};

export const REQUIRED_BY_HOOKS: Record<string, string[]> = {"PasskeyRenameInput":["name"],"SignupInput":["email","name","password"],"SignupVerifyInput":["token"],"PasswordForgotInput":["email"],"SignInInput":["email","password"],"SignInCodeInput":["pending"],"AdminRecoveryInput":["pending"],"TwoFactorConfirmInput":["code"],"PasswordChangeInput":["current_password","new_password"],"PasswordSetInput":["new_password"],"PasswordResetInput":["token","new_password"],"TermsConsentInput":["agree","terms_version_id","privacy_version_id"],"BridgeClaimInput":["code"],"TicketCreateInput":["title","scope_id","kind_id","assignee_member_id","due_on"],"TicketDraftInput":["draft_id"],"BridgeProgressInput":["kind"],"BridgeFinishInput":["state"],"ApprovalReturnInput":["note"],"TicketCompleteInput":["conditions_confirmed"],"CredentialCreateInput":["layer","kind","name","destinations"],"CredentialResolveInput":["job_id","credential_id","destination","executor_key"],"CredentialLoginAnswerInput":["request_ref"],"CredentialCheckReportInput":["job_id","state"],"DeviceBrowserInput":["browser"],"BridgeBrowserInput":["browser"],"TicketMessageInput":["body"],"TicketMessageEditInput":["body"],"TicketDecisionInput":["text"],"TicketDecisionUpdateInput":["action"],"TicketHandoverCreateInput":["kind","reason"],"TicketHandoverAnswerInput":["decision"],"TicketHandoverClaimInput":["member_id"],"InvitationsCreateInput":["emails","role_key"],"InvitationLinkCreateInput":["scope_id","role_key"],"InvitationJoinConfirmInput":["token"],"TicketBodyInput":["version","doc"],"BodyRestoreInput":["current_version"],"TestSpecCreateInput":["title"],"TestSpecUpdateInput":["version"],"TicketLinkInput":["other_ticket_id","kind"],"NotificationReadInput":["read"],"SavedViewInput":["name"],"ItemRestoreInput":["from","to"],"KnowledgeFolderCreateInput":["shelf","name"],"KnowledgePageCreateInput":["shelf","title"],"KnowledgeMustInput":["must"],"KnowledgeSimilarInput":["title"],"KnowledgeDeclineInput":["reason"],"KnowledgeShareSetInput":["group_ids"],"TicketKindCreateInput":["name","color_key"],"TicketKindOrderInput":["kind_ids"],"TicketStageCreateInput":["name","color_key"],"TicketStageOrderInput":["stage_ids"],"TicketFieldCreateInput":["name","field_type","kind_ids"],"TicketFieldOrderInput":["field_ids"],"ApprovalEditInput":["text","version"],"ConversationSay":["text"],"ConversationEntriesInput":["entries"],"BridgeBrowserStateInput":["browser","state"],"TicketAgentMessageInput":["text"],"BulkApproveInput":["approval_ids"],"DraftMessageInput":["text","draft"],"ConversationAdoptInput":["ticket_id"],"ScopeCreateInput":["name","ticket_prefix"],"LayerCreateInput":["label"],"MemberRoleInput":["role_key"],"WorkspaceUpdateInput":["name"],"WorkspaceDeletionInput":["confirm_name"],"EmailChangeInput":["email"],"EmailChangeVerifyInput":["token"],"NotificationSettingsCopyInput":["from_workspace_id","to_workspace_ids"],"GuestGroupInput":["name","request_scope_id"],"PortalTicketMessageInput":["body"],"ClientRequestRouteInput":["route_id"],"ClientRequestReplyInput":["body"],"ClientRequestAcceptInput":["assignee_member_id","due_on","scope_id"],"ClientRequestDeclineInput":["reason"],"PortalRequestCreateInput":["body"],"PortalRequestMessageInput":["body"],"PortalAttachmentInput":["name","content_type","data"],"PortalQuestionsInput":["body"],"GuestGroupRenameInput":["name"],"OpsSetupInput":["token"],"InquiryCreateInput":["topic","title","body"],"InquiryMessageInput":["body"],"InquiryAttachmentInput":["name","content_type","size"],"OpsInquiryReplyInput":["body"],"OpsInquiryNoteInput":["body"],"OpsMemberAddInput":["email","caps"],"PlanProposalCreateInput":["plan_key","price_monthly","member_limit","existing_policy","reason"],"PlanProposalDecideInput":["notice_body"],"PlanProposalReturnInput":["reason"],"KindTemplateUpdateApplyInput":["choice"],"OpsWorkspaceStopInput":["reason_key","mode"],"IncidentUpdateInput":["state","body"],"WorkspaceNoticeInput":["title","body","placements"],"BillingContactInput":["company","attn","email"],"PlanChangeInput":["plan_key"],"OpsInvoiceIssueInput":["month"],"PaymentRecordInput":["amount","paid_on"],"OpsPlanChangeInput":["plan_key","inquiry_id"],"OpsPeekOpenInput":["reason","minutes"],"OpsMemberCapsInput":["caps"],"OpsTemplateReleaseInput":["items","change_reason"],"OpsNoticeCreateInput":["kind","title","body","audience_mode","placements"],"OpsInvoiceTemplateInput":["company","address","reg_no","contact","payee","version"]};

export const QUERY_RULES: Record<string, Record<string, Record<string, unknown>>> = {"getActionRun":{},"stopActionRun":{},"takeoverActionRun":{},"getApproval":{},"approveApproval":{},"editApproval":{},"returnApproval":{},"stopApproval":{},"withdrawApproval":{},"bulkApprove":{},"previewBulkApproval":{},"listApprovalHistory":{"decision":{"type":"string","enum":["approve","return","stop"]},"from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listApprovalQueue":{"kind":{"type":"string","enum":["artifact","handover"]},"sort":{"type":"string","pattern":"^[a-z_][a-z0-9_]{0,62}$","enum":["due","waiting","title"]},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getArtifactVersion":{},"restoreArtifactVersion":{},"updateArtifact":{},"listAuditEvents":{"q":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"kind":{"type":"string","enum":["perm","out","device","ai","deleted","ops"]},"member_id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"},"from":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$"},"to":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getInvitation":{},"acceptInvitation":{},"requestInvitationResend":{},"confirmInvitationJoin":{},"startOpsSetup":{},"requestPasswordReset":{},"resetPassword":{},"requestAdminRecovery":{},"getServiceStatus":{},"signInWithPassword":{},"signOut":{},"createSignup":{},"resendSignupEmail":{},"getSignupStatus":{},"verifySignup":{},"stepUp":{},"consentToTerms":{},"getCurrentTerms":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","deleted_at","id","kind","published_at","tenant_id","updated_at","updated_by","url","version"]}},"verifySignInCode":{},"setBridgeBrowser":{},"claimPairingCode":{},"reportCredentialCheck":{},"resolveCredential":{},"listMyDevices":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["alive_at","auth_session_id","bridge_version","browser","cli_model","country","created_at","created_by","deleted_at","device","device_label","device_token_hash","health","health_at","id","ip_region","issued_at","kind_id","last_ip","last_seen_at","login_kind","machine_id","member_id","mfa_pending","revoke_reason_id","revoked_at","step_up_at","tenant_id","terms_pending","updated_at","updated_by"]}},"updateMyDevice":{},"revokeMyDevice":{},"checkMyDeviceBrowser":{},"getFileForBridge":{"job_id":{"type":"string","format":"uuid"}},"sendHeartbeat":{},"putArtifactFromBridge":{},"reportBrowserState":{},"reportClientRequestDraft":{},"getJobControl":{},"mirrorConversationEntries":{},"finishBridgeJob":{},"reportJobProgress":{},"askFromBridge":{},"getBridgeQuestionAnswer":{},"callKanameTool":{},"takeBridgeJob":{},"listMirrorTargets":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"createPairingCode":{},"downloadBridgeRelease":{},"getLatestBridgeRelease":{"os":{"type":"string"},"arch":{"type":"string"}},"reportUsage":{},"listClientRequests":{"state":{"type":"string","enum":["live","done"]}},"getClientRequest":{},"updateClientRequest":{},"acceptClientRequest":{},"declineClientRequest":{},"requestClientRequestDraft":{},"replyToClientRequest":{},"getMyClone":{},"updateMyClone":{},"listCloneActivity":{"kind":{"type":"string","enum":["ran","made","stopped"]},"from":{"type":"string","format":"date"},"to":{"type":"string","format":"date"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getCloneGrowth":{},"getCloneNow":{},"listConversations":{"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"createConversation":{},"getConversation":{},"updateConversation":{},"deleteConversation":{},"createConversationAttachment":{},"listConversationMessages":{"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"sendConversationMessage":{},"answerAgentPermission":{},"stopConversation":{},"streamConversation":{},"listCredentials":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createCredential":{},"updateCredential":{},"deleteCredential":{},"checkCredentialLogin":{},"answerCredentialLoginCheck":{},"listGuestGroups":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"createGuestGroup":{},"updateGuestGroup":{},"deleteGuestGroup":{},"listHandoverRules":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listMyInquiries":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createInquiry":{},"getMyInquiry":{},"postInquiryMessage":{},"resolveMyInquiry":{},"uploadInquiryAttachment":{},"createInvitations":{},"revokeInvitation":{},"resendInvitation":{},"createInvitationLink":{},"downloadInvoicePdf":{},"listKnowledgeApprovals":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"createKnowledgeFolder":{},"updateKnowledgeFolder":{},"deleteKnowledgeFolder":{},"withdrawKnowledgeRequest":{},"approveKnowledgeRequest":{},"declineKnowledgeRequest":{},"dismissKnowledgeRequest":{},"getKnowledgeReview":{},"getKnowledgeShares":{"page_id":{"type":"string","format":"uuid"},"folder_id":{"type":"string","format":"uuid"}},"setKnowledgeShares":{},"findSimilarKnowledge":{},"getKnowledgeTree":{},"createKnowledgePage":{},"getKnowledgePage":{},"updateKnowledgePage":{},"deleteKnowledgePage":{},"copyKnowledgePage":{},"saveKnowledgeDraft":{},"discardKnowledgeDraft":{},"setKnowledgeMust":{},"publishKnowledgePage":{},"requestKnowledgeRaise":{},"listKnowledgeVersions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getKnowledgePageVersion":{},"listLayers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createLayer":{},"updateLayer":{},"getMe":{},"updateMe":{},"uploadAvatar":{},"regenerateBackupCodes":{},"requestEmailChange":{},"verifyEmailChange":{},"listMyInvitations":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["accepted_member_id","created_at","created_by","deleted_at","email","expires_at","guest_group_id","id","message","permission_preset","resend_requested_at","resent_at","revoked_at","role_id","scope_id","tenant_id","token_hash","updated_at","updated_by"]}},"getNotificationSettings":{"workspace_id":{"type":"string","format":"uuid"}},"updateNotificationSettings":{},"copyNotificationSettings":{},"renamePasskey":{},"deletePasskey":{},"setMyPassword":{},"changePassword":{},"getMySecurity":{},"listMySessions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["alive_at","auth_session_id","bridge_version","browser","cli_model","country","created_at","created_by","deleted_at","device","device_label","device_token_hash","health","health_at","id","ip_region","issued_at","kind_id","last_ip","last_seen_at","login_kind","machine_id","member_id","mfa_pending","revoke_reason_id","revoked_at","step_up_at","tenant_id","terms_pending","updated_at","updated_by"]}},"revokeMySession":{},"revokeOtherSessions":{},"listSetupTasks":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"dismissSetupTasks":{},"listMyTicketDrafts":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["auth_user_id","created_at","created_by","deleted_at","id","joined_at","member_id","role","status","tenant_id","updated_at","updated_by"]}},"saveMyTicketDraft":{},"disableTwoFactor":{},"confirmTwoFactor":{},"startTwoFactor":{},"getMyUsage":{},"leaveWorkspace":{},"switchWorkspace":{},"listMembers":{"scope_id":{"type":"string","format":"uuid"},"q":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"getMember":{},"updateMemberGroups":{},"removeMember":{},"previewMemberRemoval":{},"resumeMember":{},"updateMemberRole":{},"suspendMember":{},"resetMemberTwoFactor":{},"createArtifactFromMessage":{},"listNotices":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"unread":{"type":"string","enum":["true"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"markNoticeRead":{},"listNotifications":{"unread":{"type":"string","enum":["true","false"]},"actor_member_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"readNotification":{},"readAllNotifications":{},"listOpsInquiries":{"box":{"type":"string","enum":["unassigned","mine","waiting","later","done"]},"topic":{"type":"string","enum":["usage","trouble","billing","other"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getOpsInquiry":{},"updateOpsInquiry":{},"addOpsInquiryNote":{},"replyOpsInquiry":{},"getOpsInvoiceTemplate":{},"updateOpsInvoiceTemplate":{},"listOpsInvoices":{"month":{"type":"string","pattern":"^[0-9]{4}-(0[1-9]|1[0-2])$"},"state":{"type":"string","enum":["unpaid","paid","overdue"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"recordPayment":{},"issueOpsInvoices":{},"listOpsMembers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"addOpsMember":{},"updateOpsMemberCaps":{},"removeOpsMember":{},"listOpsNotices":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"state":{"type":"string","enum":["draft","scheduled","published","resolved"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createOpsNotice":{},"getOpsNotice":{},"updateOpsNotice":{},"publishOpsNotice":{},"addIncidentUpdate":{},"listOperations":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["check_state","created_at","created_by","current_version","deleted_at","description","id","key","kind","name","tenant_id","updated_at","updated_by","version_label"]}},"closePeek":{},"listPlanHistory":{"plan_key":{"type":"string","enum":["free","team","business"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action","created_at","created_by","deleted_at","grant_id","id","occurred_at","ops_member_id","payload","target_id","target_tenant_id","target_type","tenant_id","updated_at","updated_by"]}},"listPlanProposals":{"state":{"type":"string","enum":["draft","waiting","decided","returned"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["changes","created_at","created_by","decided_at","decided_by","deleted_at","existing_policy","from_version","id","new_from","notice_days","plan_id","proposed_by","reason","return_reason","state","submitted_at","tenant_id","to_version","updated_at","updated_by"]}},"createPlanProposal":{},"updatePlanProposal":{},"decidePlanProposal":{},"getPlanProposalImpact":{},"returnPlanProposal":{},"submitPlanProposal":{},"listOpsPlans":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","current_version","deleted_at","id","key","limits","name","price_monthly","tenant_id","updated_at","updated_by"]}},"listOpsPwned":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"ackOpsPwnedPending":{},"getOpsShell":{},"listOpsTemplates":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getOpsTemplate":{},"releaseOpsTemplate":{},"listOpsWorkspaces":{"q":{"type":"string","maxLength":100},"view":{"type":"string","enum":["all","attention","stopped","closing"]},"plan":{"type":"string","enum":["free","team","business"]},"sort":{"type":"string","pattern":"^[a-z_][a-z0-9_]{0,62}$","enum":["attention","members","runs"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getOpsWorkspace":{},"listOpsWorkspaceAudit":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getOpsWorkspaceBilling":{},"listOpsWorkspaceInquiries":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["ai_first_answered_at","asker_read_at","assignee_ops_member_id","context","conversation_id","created_at","created_by","deleted_at","id","kind_id","last_message_at","later_until","opened_by_member_id","state","status_id","tenant_id","title","topic_key","updated_at","updated_by"]}},"listOpsWorkspaceMembers":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"resendOpsVerification":{},"sendWorkspaceNotice":{},"openPeek":{},"changeOpsWorkspacePlan":{},"ackOpsPwned":{},"resumeWorkspace":{},"stopWorkspace":{},"getPortalHome":{"visit":{"type":"string","enum":["elsewhere"]}},"uploadPortalAttachment":{},"listPortalNotices":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["admins_only","affects","body","created_at","created_by","deleted_at","emailed_admins_at","id","impact","kind_id","maintenance_from","maintenance_to","placements","publish_at","published_by","state","target_plan_ids","target_tenant_id","target_tenant_ids","tenant_id","title","updated_at","updated_by"]}},"createPortalRequest":{},"getPortalRequest":{},"postPortalRequestMessage":{},"askPortalRequestQuestions":{},"getPortalTicket":{},"postPortalTicketMessage":{},"listSavedViews":{"share":{"type":"string","enum":["self","group"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createSavedView":{},"updateSavedView":{},"deleteSavedView":{},"listScopes":{"layer_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["color","created_at","created_by","deleted_at","id","layer_id","name","next_ticket_no","parent_id","position","tenant_id","ticket_prefix","updated_at","updated_by"]}},"createScope":{},"updateScope":{},"getScopeOverview":{},"search":{"q":{"type":"string","maxLength":100},"kinds":{"type":"string","pattern":"^(?:ticket|decision|conversation|knowledge)(?:,(?:ticket|decision|conversation|knowledge))*$"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":5}},"getServiceStatusForMember":{},"getShell":{},"updateTestSpec":{},"deleteTestSpec":{},"listTicketFieldMaster":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listTicketFields":{"kind_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createTicketField":{},"updateTicketField":{},"deleteTicketField":{},"reorderTicketFields":{},"updateTicketDecision":{},"startDraftConversation":{},"adoptDraftConversation":{},"sendDraftMessage":{},"answerTicketHandover":{},"claimTicketHandover":{},"remindTicketHandover":{},"withdrawTicketHandover":{},"createTicketImport":{},"getTicketImport":{},"commitTicketImport":{},"listTicketKinds":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["body_template","color","color_key","created_at","created_by","deleted_at","description","id","is_builtin","name","position","template_hash","template_key","tenant_id","updated_at","updated_by"]}},"createTicketKind":{},"updateTicketKind":{},"deleteTicketKind":{},"reorderTicketKinds":{},"listKindTemplateUpdates":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"applyKindTemplateUpdate":{},"deleteTicketLink":{},"updateTicketMessage":{},"deleteTicketMessage":{},"starTicketMessage":{},"listTicketStages":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["color_key","created_at","created_by","deleted_at","id","is_fixed","key","name","position","template_hash","template_key","tenant_id","updated_at","updated_by"]}},"createTicketStage":{},"updateTicketStage":{},"deleteTicketStage":{},"reorderTicketStages":{},"listTickets":{"view":{"type":"string","enum":["mine","all"]},"q":{"type":"string","maxLength":100},"scope_id":{"type":"string","format":"uuid"},"kind_id":{"type":"string","format":"uuid"},"stage_id":{"type":"string","format":"uuid"},"assignee_id":{"type":"string","format":"uuid"},"done":{"type":"string","enum":["true","false"]},"due":{"type":"string","enum":["none"]},"delegated":{"type":"string","enum":["true","false"]},"approving":{"type":"string","enum":["true","false"]},"due_from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"due_to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"start_from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"start_to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"overdue":{"type":"string","enum":["true","false"]},"fire":{"type":"string","enum":["true","false"]},"parent":{"type":"string","pattern":"^(?:none|any|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"fields":{"type":"string","pattern":"^(?:start_on|priority|estimate_minutes|actual_minutes|scope)(?:,(?:start_on|priority|estimate_minutes|actual_minutes|scope))*$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100},"sort":{"type":"string","enum":["due_on","start_on","updated_at","created_at"]}},"createTicket":{},"getTicket":{},"updateTicket":{},"deleteTicket":{"children":{"type":"string","enum":["","move","cascade","detach"]},"parent_id":{"type":"string","format":"uuid"},"reason":{"type":"string","maxLength":400}},"getTicketAgentSession":{},"applyTicketAgentProposal":{},"sendTicketAgentMessage":{},"listTicketArtifacts":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["approved_by","created_at","created_by","current_version","deleted_at","format_id","id","owner_member_id","scope_id","source_conversation_id","source_job_id","source_message_id","storage_ref","task_id","template_id","tenant_id","title","updated_at","updated_by"]}},"createTicketAttachment":{},"updateTicketBody":{},"completeTicket":{},"listTicketDecisions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["cancel_reason","cancelled_at","cancelled_by","created_at","created_by","decided_at","decided_by","decided_note","deleted_at","id","promoted_to","reason","source_message_id","superseded_by_id","tenant_id","text","ticket_id","updated_at","updated_by"]}},"createTicketDecision":{},"delegateTicket":{},"previewTicketDelete":{},"dryRunTicket":{},"listTicketGuestShares":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","deleted_at","guest_group_id","id","shared_by","tenant_id","ticket_id","updated_at","updated_by"]}},"updateTicketGuestShares":{},"previewTicketHandover":{},"listTicketHandovers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["answered_by","ask","created_at","created_by","decided_at","decline_reason","deleted_at","from_member_id","id","kind","notify_managers","overdue_notified_at","reason","reminded_at","reply_due","state","switch","switch_applied","tenant_id","ticket_id","to_member_id","to_scope_id","updated_at","updated_by"]}},"createTicketHandover":{},"listTicketItemChanges":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"restoreTicketItems":{},"previewTicketKindChange":{},"listTicketLinks":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","deleted_at","from_ticket_id","id","kind","tenant_id","to_ticket_id","updated_at","updated_by"]}},"createTicketLink":{},"createTicketMessage":{},"listTicketReferences":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action_run_id","bridge_job_id","created_at","created_by","deleted_at","id","member_id","ref_id","ref_type","seen_at","tenant_id","ticket_id","title","updated_at","updated_by","url"]}},"restoreTicket":{},"listTicketRuns":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action_kind_id","ai_employee_id","approval_id","bridge_job_id","choke_point_id","cost","created_at","created_by","deleted_at","duty_id","error_summary","finished_at","id","mode_id","phase","procedure_id","scope_id","service_id","started_at","status_id","taken_over_at","task_id","tenant_id","ticket_id","tokens_in","tokens_out","updated_at","updated_by"]}},"listTestSpecs":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createTestSpec":{},"lintTestSpecs":{},"suggestTestSpecs":{},"listTicketTimeline":{"filter":{"type":"string"},"before_at":{"type":"string"},"before_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"markTicketTimelineSeen":{},"listTicketVersions":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"restoreTicketVersion":{},"bulkUpdateTickets":{},"getWorkspaceSettings":{},"updateWorkspace":{},"getBilling":{},"updateBillingContact":{},"requestWorkspaceDeletion":{},"cancelWorkspaceDeletion":{},"uploadWorkspaceLogo":{},"getWorkspaceMembers":{},"updateWorkspacePermissions":{},"changePlan":{},"listWorkspacePlans":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","current_version","deleted_at","id","key","limits","name","price_monthly","tenant_id","updated_at","updated_by"]}}};

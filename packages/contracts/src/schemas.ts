// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml components）。手で直さない。openapi:a440229153fe1099
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
  target_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  target_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  origin_id: z.uuid().nullable().optional(),
});
export const GoalAllocations = z.strictObject({
  goal_id: z.uuid().nullable().optional(),
  assignee_member_id: z.uuid().nullable().optional(),
  allocated_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  allocated_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  expected_effect: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  expected_effect: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
});
export const Validations = z.strictObject({
  measure_id: z.uuid().nullable().optional(),
  measured_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  measured_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  confidence: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  confidence: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  cost: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  cost: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  utilization: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  utilization: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  confidence: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  confidence: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  size_bytes: z.string().regex(new RegExp("^-?[0-9]+$", "u")).nullable().optional(),
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
  size_bytes: z.string().regex(new RegExp("^-?[0-9]+$", "u")).nullable().optional(),
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
  price_monthly: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  price_monthly: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
  limit_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
  limit_value: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
});
export const Invoices = z.strictObject({
  subscription_id: z.uuid().nullable().optional(),
  period_start: z.iso.date().nullable().optional(),
  period_end: z.iso.date().nullable().optional(),
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  amount: z.string().regex(new RegExp("^-?[0-9]+(\\.[0-9]+)?$", "u")).nullable().optional(),
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
  size: z.string().regex(new RegExp("^-?[0-9]+$", "u")).nullable().optional(),
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
  size: z.string().regex(new RegExp("^-?[0-9]+$", "u")).nullable().optional(),
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
  guest_visible: z.string().optional(),
  from_request: z.string().optional(),
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
  guest_visible: z.string().optional(),
  from_request: z.string().optional(),
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
  page_id: z.uuid().optional(),
  folder_id: z.uuid().optional(),
  from_scope_id: z.uuid().optional(),
  from_is_personal: z.string().optional(),
  to_scope_id: z.uuid().optional(),
  to_folder_id: z.uuid().optional(),
  requested_by: z.uuid().optional(),
  message: z.string().optional(),
  state: z.string().optional(),
  decided_by: z.uuid().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  decline_reason: z.string().optional(),
  dismissed_at: z.iso.datetime({ offset: true }).optional(),
  id: z.uuid(),
  tenant_id: z.uuid().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
});
export const KnowledgeRequestsInput = z.strictObject({
  kind: z.string().optional(),
  page_id: z.uuid().optional(),
  folder_id: z.uuid().optional(),
  from_scope_id: z.uuid().optional(),
  from_is_personal: z.string().optional(),
  to_scope_id: z.uuid().optional(),
  to_folder_id: z.uuid().optional(),
  requested_by: z.uuid().optional(),
  message: z.string().optional(),
  state: z.string().optional(),
  decided_by: z.uuid().optional(),
  decided_at: z.iso.datetime({ offset: true }).optional(),
  decline_reason: z.string().optional(),
  dismissed_at: z.iso.datetime({ offset: true }).optional(),
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
  add: z.array(z.uuid()).min(1).max(20).nullable().optional(),
  remove: z.array(z.uuid()).min(1).max(20).nullable().optional(),
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
  name: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const SignupInput = z.strictObject({
  email: z.string().regex(new RegExp("^[ \\t\\n\\r]*(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}[ \\t\\n\\r]*$", "u")).optional(),
  name: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  company_name: z.string().max(100).optional(),
  password: z.string().min(12).optional(),
});
export const SignupResendInput = z.strictObject({

});
export const SignupVerifyInput = z.strictObject({
  token: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const PasswordForgotInput = z.strictObject({
  email: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
});
export const SignInInput = z.strictObject({
  email: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  password: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  invitation: z.string().max(512).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
});
export const SignInCodeInput = z.strictObject({
  pending: z.string().optional(),
  code: z.string().max(64).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
  backup_code: z.string().max(64).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
  invitation: z.string().max(512).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
});
export const SignOutInput = z.strictObject({

});
export const AdminRecoveryInput = z.strictObject({
  pending: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const TwoFactorStartInput = z.strictObject({
  password: z.string().nullable().optional(),
});
export const TwoFactorConfirmInput = z.strictObject({
  code: z.string().max(64).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
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
  code: z.string().max(32).regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*(?:[2-9A-HJKMNP-Za-hjkmnp-z２-９Ａ-ＨＪＫＭＮＰ-Ｚａ-ｈｊｋｍｎｐ-ｚ][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*){6}$", "u")).optional(),
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
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  assignee_member_id: z.uuid().optional(),
  due_on: z.iso.date().optional(),
  start_on: z.string().optional(),
  priority: z.enum(["","mid","high"]).optional(),
  priority_reason: z.string().optional(),
  parent_ticket_id: z.uuid().optional(),
  estimate_minutes: z.unknown().nullable().optional(),
  notify_member_ids: z.array(z.uuid()).max(20).optional(),
  draft_id: z.uuid().optional(),
  source_draft_id: z.uuid().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  specs: z.array(z.string()).max(50).optional(),
  links: z.array(z.unknown()).max(20).optional(),
  duplicate_of: z.uuid().optional(),
  copy: z.array(z.unknown()).max(6).optional(),
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
  no_spec_reason: z.string().max(500).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
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
  result: z.string().max(200000).optional(),
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
  next_actor: z.enum(["clone","self"]).nullable().optional(),
});
export const InvitationAcceptInput = z.strictObject({
  name: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  email: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).nullable().optional(),
});
export const TicketCompleteInput = z.strictObject({
  conditions_confirmed: z.boolean().optional(),
});
export const InvitationResendInput = z.strictObject({

});
export const CredentialCreateInput = z.strictObject({
  layer: z.enum(["workspace","personal"]).optional(),
  kind: z.enum(["login","key"]).optional(),
  name: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{0,63}[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
  description: z.string().nullable().optional(),
  login: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  password: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  two_factor: z.enum(["none","totp","sms","email","push"]).optional(),
  totp_secret: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*){16,}[=＝]*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
  destinations: z.array(z.string()).min(1).max(20).optional(),
  expires_on: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[0-9０-９]{4}[-－](?:(?:[0０][13578１３５７８]|[1１][02０２])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])|(?:[0０][469４６９]|[1１][1１])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])|[0０][2２][-－](?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８]))|(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})[-－][0０][2２][-－][2２][9９])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).nullable().optional(),
});
export const CredentialUpdateInput = z.strictObject({
  login: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  password: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  two_factor: z.enum(["none","totp","sms","email","push"]).optional(),
  totp_secret: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*){16,}[=＝]*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
  destinations: z.array(z.string()).min(1).max(20).optional(),
  expires_on: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[0-9０-９]{4}[-－](?:(?:[0０][13578１３５７８]|[1１][02０２])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][01０１])|(?:[0０][469４６９]|[1１][1１])[-－](?:[0０][1-9１-９]|[12１２][0-9０-９]|[3３][0０])|[0０][2２][-－](?:[0０][1-9１-９]|[1１][0-9０-９]|[2２][0-8０-８]))|(?:[0-9０-９]{2}(?:[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])|(?:[0０]{2}|[0０][48４８]|[2468２４６８][048０４８]|[13579１３５７９][26２６])[0０]{2})[-－][0０][2２][-－][2２][9９])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).nullable().optional(),
  description: z.string().nullable().optional(),
  reason: z.string().optional(),
});
export const CredentialResolveInput = z.strictObject({
  job_id: z.uuid().optional(),
  credential_id: z.uuid().optional(),
  destination: z.string().max(2048).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  executor_key: z.string().max(200).regex(new RegExp("^MCowBQYDK2VuAyEA[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$", "u")).optional(),
});
export const CredentialLoginCheckInput = z.strictObject({

});
export const CredentialLoginAnswerInput = z.strictObject({
  request_ref: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  code: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*(?:[0-9A-Za-z０-９Ａ-Ｚａ-ｚ][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\-‐‑‒–—―ー−－]*){1,64}$", "u")).optional(),
  approved: z.boolean().optional(),
});
export const CredentialCheckReportInput = z.strictObject({
  job_id: z.uuid().optional(),
  state: z.enum(["ok","bad_password","needs_2fa","bad_code","captcha","unreachable","no_form","stopped","no_answer","asking","waiting"]).optional(),
  detail: z.string().max(400).optional(),
  request_ref: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  ask_kind: z.enum(["code","approve"]).optional(),
  text: z.string().max(300).optional(),
});
export const DeviceBrowserInput = z.strictObject({
  browser: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
});
export const DeviceBrowserCheckInput = z.strictObject({

});
export const BridgeBrowserInput = z.strictObject({
  browser: z.string().regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[cｃ][hｈ][rｒ][oｏ][mｍ][eｅ]|[dｄ][eｅ][dｄ][iｉ][cｃ][aａ][tｔ][eｅ][dｄ]|[oｏ][fｆ][fｆ])[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
});
export const TicketTimelineSeenInput = z.strictObject({
  seen_at: z.string().regex(new RegExp("^(?:[1-9][0-9]{3}-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|[1-9][0-9]{3}-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|[1-9][0-9]{3}-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[1-9][0-9](?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]{1,6})?(?:Z|[+-](?:0[0-9]|1[0-5])(?::?[0-5][0-9])?)$", "u")).nullable().optional(),
});
export const TicketMessageInput = z.strictObject({
  body: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
  notify_member_ids: z.array(z.uuid()).optional(),
  quote_of_id: z.uuid().nullable().optional(),
  stage_key: z.enum(["todo","doing","hold"]).optional(),
  stage_id: z.uuid().optional(),
  hold_reason: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]", "u")).optional(),
  resume_condition: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]", "u")).optional(),
});
export const TicketMessageEditInput = z.strictObject({
  body: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  mention_member_ids: z.array(z.uuid()).optional(),
});
export const TicketMessageStarInput = z.strictObject({

});
export const TicketUpdateInput = z.strictObject({
  stage_id: z.uuid().optional(),
  stage_key: z.enum(["todo","doing","hold"]).optional(),
  actual_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  hold_reason: z.string().regex(new RegExp("^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$", "u")).optional(),
  resume_condition: z.string().regex(new RegExp("^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$", "u")).optional(),
  priority: z.enum(["mid","high"]).optional(),
  priority_reason: z.string().regex(new RegExp("^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f][^\\u0000]*$", "u")).optional(),
  parent_ticket_id: z.uuid().nullable().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  estimate_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  due_on: z.string().regex(new RegExp("^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$", "u")).nullable().optional(),
  start_on: z.string().regex(new RegExp("^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$", "u")).nullable().optional(),
  due_reason: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f]", "u")).optional(),
  expected_due_on: z.string().regex(new RegExp("^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$", "u")).nullable().optional(),
  expected_start_on: z.string().regex(new RegExp("^(?:(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|(?:000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3})-02-(?:0[1-9]|1[0-9]|2[0-8])|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)$", "u")).nullable().optional(),
});
export const TicketDecisionInput = z.strictObject({
  text: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]", "u")).optional(),
  reason: z.string().nullable().optional(),
  decided_by_member_id: z.uuid().nullable().optional(),
  decided_note: z.string().nullable().optional(),
  source_message_id: z.uuid().nullable().optional(),
  promoted_to: z.enum(["ticket"]).nullable().optional(),
});
export const TicketDecisionUpdateInput = z.strictObject({
  action: z.enum(["revise","cancel"]).optional(),
  text: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});
export const TicketHandoverCreateInput = z.strictObject({
  kind: z.enum(["pass","offer","distribute"]).optional(),
  to_member_id: z.uuid().nullable().optional(),
  to_scope_id: z.uuid().nullable().optional(),
  reason: z.string().regex(new RegExp("^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f\\ufeff][^\\u0000]*$", "u")).optional(),
  ask: z.string().regex(new RegExp("^[^\\u0000]*$", "u")).nullable().optional(),
  reply_due: z.iso.datetime({ offset: true }).nullable().optional(),
  switch: z.record(z.string(), z.unknown()).nullable().optional(),
  notify_managers: z.boolean().nullable().optional(),
  replaces: z.uuid().nullable().optional(),
});
export const TicketHandoverAnswerInput = z.strictObject({
  decision: z.enum(["accept","decline"]).optional(),
  decline_reason: z.string().regex(new RegExp("^[^\\u0000]*$", "u")).nullable().optional(),
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
  emails: z.array(z.string()).min(1).max(50).optional(),
  scope_id: z.uuid().nullable().optional(),
  role_key: z.enum(["member","manager","viewer","admin","requester"]).optional(),
  message: z.string().max(500).nullable().optional(),
  guest_group_id: z.uuid().nullable().optional(),
});
export const InvitationLinkCreateInput = z.strictObject({
  scope_id: z.uuid().optional(),
  role_key: z.enum(["member","manager","viewer","admin"]).optional(),
});
export const InvitationJoinConfirmInput = z.strictObject({
  token: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const TicketBodyInput = z.strictObject({
  version: z.number().int().min(0).max(2147483647).optional(),
  doc: z.record(z.string(), z.unknown()).optional(),
});
export const BodyRestoreInput = z.strictObject({
  current_version: z.number().int().min(1).optional(),
});
export const TestSpecCreateInput = z.strictObject({
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const TestSpecUpdateInput = z.strictObject({
  version: z.number().int().min(1).optional(),
  checked: z.boolean().optional(),
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const TicketLinkInput = z.strictObject({
  other_ticket_id: z.uuid().optional(),
  kind: z.enum(["related","derived_from"]).optional(),
});
export const NotificationReadInput = z.strictObject({
  read: z.boolean().optional(),
});
export const NotificationReadAllInput = z.strictObject({

});
export const SavedViewInput = z.strictObject({
  name: z.string().min(1).regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f](?:[^\\u0000-\\u001f\\u007f-\\u009f]{0,58}[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f])?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
  share: z.enum(["self","group"]).optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).max(50).optional(),
  density: z.enum(["normal","compact"]).optional(),
});
export const SavedViewUpdateInput = z.strictObject({
  name: z.string().min(1).regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f](?:[^\\u0000-\\u001f\\u007f-\\u009f]{0,58}[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f-\\u009f])?[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
  share: z.enum(["self","group"]).optional(),
  scope_id: z.uuid().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).max(50).optional(),
  density: z.enum(["normal","compact"]).optional(),
});
export const ActionRunTakeoverInput = z.strictObject({

});
export const TicketRestoreInput = z.strictObject({

});
export const ItemRestoreInput = z.strictObject({
  from: z.number().int().min(1).optional(),
  to: z.number().int().min(1).optional(),
});
export const KnowledgeFolderCreateInput = z.strictObject({
  shelf: z.enum(["company","group","me"]).optional(),
  group_id: z.uuid().nullable().optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  name: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const KnowledgeFolderUpdateInput = z.strictObject({
  name: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  parent_folder_id: z.uuid().nullable().optional(),
  position: z.number().int().min(0).max(2147483647).optional(),
});
export const KnowledgePageCreateInput = z.strictObject({
  shelf: z.enum(["company","group","me"]).optional(),
  group_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  desc: z.string().max(200).optional(),
});
export const KnowledgeDraftInput = z.strictObject({
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  desc: z.string().max(200).optional(),
  doc: z.record(z.string(), z.unknown()).optional(),
});
export const KnowledgePublishInput = z.strictObject({

});
export const KnowledgePageMoveInput = z.strictObject({
  folder_id: z.uuid().nullable().optional(),
  position: z.number().int().min(0).max(2147483647).optional(),
});
export const KnowledgeMustInput = z.strictObject({
  must: z.boolean().optional(),
});
export const KnowledgeSimilarInput = z.strictObject({
  title: z.string().max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  desc: z.string().max(200).optional(),
  text: z.string().max(10000).optional(),
  exclude_page_id: z.uuid().optional(),
});
export const KnowledgeCopyInput = z.strictObject({
  folder_id: z.uuid().nullable().optional(),
});
export const KnowledgeRaiseInput = z.strictObject({
  group_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
});
export const KnowledgeDismissInput = z.strictObject({

});
export const KnowledgeApproveInput = z.strictObject({

});
export const KnowledgeDeclineInput = z.strictObject({
  reason: z.string().max(1000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const KnowledgeShareSetInput = z.strictObject({
  page_id: z.uuid().nullable().optional(),
  folder_id: z.uuid().nullable().optional(),
  group_ids: z.array(z.uuid()).max(50).optional(),
  message: z.string().max(1000).nullable().optional(),
});
export const TicketKindCreateInput = z.strictObject({
  name: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  color_key: z.enum(["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]).optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindUpdateInput = z.strictObject({
  name: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  color_key: z.enum(["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]).optional(),
  body_template: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const TicketKindOrderInput = z.strictObject({
  kind_ids: z.array(z.uuid()).min(1).optional(),
});
export const TicketStageCreateInput = z.strictObject({
  name: z.string().max(20).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  color_key: z.enum(["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]).optional(),
});
export const TicketStageUpdateInput = z.strictObject({
  name: z.string().max(20).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  color_key: z.enum(["indigo","teal","amber","coral","sage","plum","lavender","teal-light"]).optional(),
});
export const TicketStageOrderInput = z.strictObject({
  stage_ids: z.array(z.uuid()).min(1).optional(),
});
export const TicketFieldCreateInput = z.strictObject({
  name: z.string().max(80).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  field_type: z.enum(["short_text","long_text","number","date","select","multi_select","check"]).optional(),
  kind_ids: z.array(z.uuid()).min(1).optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).optional(),
});
export const TicketFieldUpdateInput = z.strictObject({
  name: z.string().max(80).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  field_type: z.enum(["short_text","long_text","number","date","select","multi_select","check"]).optional(),
  required: z.boolean().optional(),
  description: z.string().nullable().optional(),
  options: z.array(z.unknown()).min(1).optional(),
  kind_ids: z.array(z.uuid()).min(1).optional(),
});
export const TicketFieldOrderInput = z.strictObject({
  field_ids: z.array(z.uuid()).min(1).optional(),
});
export const ActionRunStopInput = z.strictObject({

});
export const ApprovalStopInput = z.strictObject({

});
export const ApprovalWithdrawInput = z.strictObject({

});
export const ApprovalEditInput = z.strictObject({
  text: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  version: z.number().int().min(1).optional(),
});
export const DryRunInput = z.strictObject({

});
export const ConversationSay = z.strictObject({
  text: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const ConversationStopInput = z.strictObject({

});
export const ConversationEntriesInput = z.strictObject({
  entries: z.array(z.unknown()).min(1).max(500).optional(),
});
export const BridgeBrowserStateInput = z.strictObject({
  browser: z.enum(["chrome","dedicated"]).optional(),
  state: z.enum(["using","off"]).optional(),
});
export const TicketAgentMessageInput = z.strictObject({
  text: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const BulkApprovalPreviewInput = z.strictObject({
  approval_ids: z.array(z.uuid()).min(1).max(50).nullable().optional(),
});
export const BulkApproveInput = z.strictObject({
  approval_ids: z.array(z.uuid()).min(1).max(50).optional(),
});
export const DraftConversationStartInput = z.strictObject({

});
export const DraftMessageInput = z.strictObject({
  text: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  draft: z.record(z.string(), z.unknown()).optional(),
  edited: z.array(z.unknown()).max(3).nullable().optional(),
});
export const ConversationAdoptInput = z.strictObject({
  ticket_id: z.uuid().optional(),
});
export const ScopeCreateInput = z.strictObject({
  name: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  ticket_prefix: z.string().regex(new RegExp("^(?![Tt]$)[A-Za-z][A-Za-z0-9]{0,7}$", "u")).optional(),
  parent_id: z.uuid().optional(),
  layer_id: z.uuid().optional(),
  color: z.enum(["teal","plum","indigo","amber","coral","sage"]).optional(),
  manager_member_ids: z.array(z.uuid()).max(10).optional(),
  member_ids: z.array(z.uuid()).max(50).optional(),
});
export const LayerCreateInput = z.strictObject({
  label: z.string().max(40).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  order_no: z.number().int().min(1).optional(),
});
export const LayerUpdateInput = z.strictObject({
  label: z.string().max(40).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  order_no: z.number().int().min(1).optional(),
});
export const ScopeUpdateInput = z.strictObject({
  name: z.string().max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  color: z.enum(["teal","plum","indigo","amber","coral","sage"]).optional(),
  position: z.number().int().min(1).optional(),
  manager_member_ids: z.array(z.uuid()).max(10).optional(),
});
export const MemberRoleInput = z.strictObject({
  role_key: z.enum(["manager","member","viewer","admin"]).optional(),
  scope_id: z.uuid().optional(),
});
export const MemberGroupsInput = z.strictObject({
  primary_scope_id: z.uuid().optional(),
  add_scope_ids: z.array(z.uuid()).max(20).optional(),
  remove_scope_ids: z.array(z.uuid()).max(20).optional(),
  role_key: z.enum(["manager","member","viewer"]).optional(),
});
export const MemberSuspendInput = z.strictObject({

});
export const MemberResumeInput = z.strictObject({

});
export const WorkspaceUpdateInput = z.strictObject({
  name: z.string().min(1).max(100).optional(),
});
export const WorkspaceLogoInput = z.strictObject({

});
export const WorkspacePermissionsInput = z.strictObject({
  billing: z.enum(["admin","admin_manager"]).optional(),
  delete_workspace: z.enum(["admin","admin_manager"]).optional(),
});
export const WorkspaceDeletionInput = z.strictObject({
  confirm_name: z.string().min(1).max(100).optional(),
});
export const MeUpdateInput = z.strictObject({
  name: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
  call_name: z.string().nullable().optional(),
  language: z.enum(["ja"]).nullable().optional(),
  theme: z.enum(["system","light","dark"]).nullable().optional(),
  week_start: z.number().int().nullable().optional(),
  timezone: z.enum(["Asia/Tokyo","UTC"]).nullable().optional(),
});
export const AvatarUploadInput = z.strictObject({

});
export const EmailChangeInput = z.strictObject({
  email: z.string().max(254).regex(new RegExp("^[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*(?:[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*)+[@＠﹫][ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])*[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[.․﹒．](?:[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*[^@＠﹫ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])+[ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$", "u")).optional(),
});
export const EmailChangeVerifyInput = z.strictObject({
  token: z.string().min(1).max(200).optional(),
});
export const MySessionsRevokeInput = z.strictObject({

});
export const NotificationSettingsUpdateInput = z.strictObject({
  workspace_id: z.uuid().nullable().optional(),
  email_digest: z.boolean().nullable().optional(),
  quiet_hours: z.record(z.string(), z.unknown()).nullable().optional(),
  pause: z.enum(["1h","today","tomorrow_morning","null"]).nullable().optional(),
  urgent_override: z.array(z.unknown()).nullable().optional(),
  events: z.array(z.unknown()).max(7).nullable().optional(),
});
export const NotificationSettingsCopyInput = z.strictObject({
  from_workspace_id: z.uuid().optional(),
  to_workspace_ids: z.array(z.uuid()).min(1).max(20).optional(),
});
export const MemberRemoveInput = z.strictObject({
  transfer_to_member_id: z.uuid().optional(),
  transfers: z.array(z.unknown()).max(500).optional(),
});
export const WorkspaceSwitchInput = z.strictObject({

});
export const GuestGroupInput = z.strictObject({
  name: z.string().min(1).max(80).optional(),
  request_scope_id: z.uuid().optional(),
});
export const PortalTicketMessageInput = z.strictObject({
  body: z.string().min(1).optional(),
});
export const ClientRequestRouteInput = z.strictObject({
  route_id: z.uuid().optional(),
});
export const ClientRequestReplyInput = z.strictObject({
  body: z.string().min(1).optional(),
});
export const ClientRequestAcceptInput = z.strictObject({
  title: z.string().min(1).max(200).nullable().optional(),
  body: z.string().nullable().optional(),
  assignee_member_id: z.uuid().optional(),
  due_on: z.string().optional(),
  scope_id: z.uuid().optional(),
  kind_id: z.uuid().nullable().optional(),
  guest_group_ids: z.array(z.uuid()).min(1).max(20).nullable().optional(),
});
export const ClientRequestDeclineInput = z.strictObject({
  reason: z.string().min(1).max(2000).optional(),
});
export const ClientRequestDraftInput = z.strictObject({

});
export const ClientRequestDraftResultInput = z.strictObject({
  draft: z.record(z.string(), z.unknown()).nullable().optional(),
  failed: z.string().nullable().optional(),
});
export const PortalRequestCreateInput = z.strictObject({
  body: z.string().min(1).max(10000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  due_on: z.string().regex(new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", "u")).nullable().optional(),
  attachment_ids: z.array(z.uuid()).max(5).nullable().optional(),
});
export const PortalRequestMessageInput = z.strictObject({
  body: z.string().min(1).max(10000).optional(),
});
export const PortalAttachmentInput = z.strictObject({
  name: z.string().min(1).max(200).optional(),
  content_type: z.string().max(100).regex(new RegExp("^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$", "u")).optional(),
  data: z.string().max(1000000).optional(),
});
export const PortalQuestionsInput = z.strictObject({
  body: z.string().min(1).max(10000).optional(),
});
export const GuestGroupRenameInput = z.strictObject({
  name: z.string().min(1).max(80).optional(),
});
export const OpsSetupInput = z.strictObject({
  token: z.string().regex(new RegExp("^[A-Za-z0-9_-]{43}$", "u")).optional(),
  name: z.string().min(1).max(40).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).nullable().optional(),
});
export const InquiryCreateInput = z.strictObject({
  topic: z.enum(["usage","trouble","billing","other"]).optional(),
  title: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  attachment_ids: z.array(z.uuid()).max(5).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export const InquiryMessageInput = z.strictObject({
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  attachment_ids: z.array(z.uuid()).max(5).optional(),
});
export const InquiryResolveInput = z.strictObject({

});
export const InquiryAttachmentInput = z.strictObject({
  name: z.string().min(1).max(200).optional(),
  content_type: z.enum(["image/png","image/jpeg","image/gif","image/webp","application/pdf","application/zip"]).optional(),
  size: z.number().int().min(1).max(10485760).optional(),
});
export const OpsInquiryUpdateInput = z.strictObject({
  take: z.boolean().optional(),
  release: z.boolean().optional(),
  state: z.enum(["open","done"]).optional(),
  later_until: z.string().nullable().optional(),
});
export const OpsInquiryReplyInput = z.strictObject({
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const OpsInquiryNoteInput = z.strictObject({
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const OpsMemberAddInput = z.strictObject({
  email: z.string().min(3).max(254).regex(new RegExp("^[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+@[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+\\.[^@ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$", "u")).optional(),
  caps: z.array(z.enum(["inquiry","peek","money","stop","notice","distribute","plan_propose","plan_decide","ops_people"])).min(1).max(9).optional(),
});
export const PlanProposalCreateInput = z.strictObject({
  plan_key: z.enum(["free","team","business"]).optional(),
  price_monthly: z.number().int().min(0).max(10000000).optional(),
  member_limit: z.number().int().min(1).max(10000).optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
  existing_policy: z.enum(["after_days","keep"]).optional(),
  notice_days: z.number().int().min(30).max(365).optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().min(1).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const PlanProposalUpdateInput = z.strictObject({
  price_monthly: z.number().int().min(0).max(10000000).optional(),
  member_limit: z.number().int().min(1).max(10000).optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
  existing_policy: z.enum(["after_days","keep"]).optional(),
  notice_days: z.number().int().min(30).max(365).optional(),
  new_from: z.iso.date().nullable().optional(),
  reason: z.string().min(1).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const PlanProposalDecideInput = z.strictObject({
  notice_body: z.string().min(1).max(2000).optional(),
});
export const PlanProposalReturnInput = z.strictObject({
  reason: z.string().min(1).max(500).optional(),
});
export const KindTemplateUpdateApplyInput = z.strictObject({
  choice: z.enum(["change","keep"]).optional(),
});
export const OpsPwnedAckInput = z.strictObject({

});
export const OpsWorkspaceStopInput = z.strictObject({
  reason_key: z.enum(["unpaid","violation","danger","request"]).optional(),
  mode: z.enum(["scheduled","now"]).optional(),
  stop_on: z.iso.date().optional(),
  note: z.string().min(1).max(500).optional(),
  admin_notice: z.string().min(1).max(2000).optional(),
});
export const NoticeReadInput = z.strictObject({

});
export const OpsNoticePublishInput = z.strictObject({

});
export const IncidentUpdateInput = z.strictObject({
  state: z.enum(["investigating","identified","monitoring","resolved"]).optional(),
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const WorkspaceNoticeInput = z.strictObject({
  title: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  placements: z.array(z.enum(["band","list"])).min(1).max(2).optional(),
  admins_only: z.boolean().optional(),
});
export const BillingContactInput = z.strictObject({
  company: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  attn: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  email: z.email().optional(),
});
export const PlanChangeInput = z.strictObject({
  plan_key: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
});
export const OpsInvoiceIssueInput = z.strictObject({
  month: z.string().regex(new RegExp("^[0-9]{4}-(0[1-9]|1[0-2])$", "u")).optional(),
  dry_run: z.boolean().optional(),
});
export const PaymentRecordInput = z.strictObject({
  amount: z.number().int().min(1).optional(),
  paid_on: z.iso.date().optional(),
  payer_name: z.string().min(1).max(100).optional(),
  reverses_payment_id: z.uuid().optional(),
});
export const OpsPlanChangeInput = z.strictObject({
  plan_key: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  inquiry_id: z.uuid().optional(),
});
export const OpsVerificationResendInput = z.strictObject({

});
export const OpsPeekOpenInput = z.strictObject({
  reason: z.string().min(1).max(200).optional(),
  minutes: z.number().int().min(1).max(60).optional(),
  inquiry_id: z.uuid().optional(),
});
export const OpsWorkspaceResumeInput = z.strictObject({
  note: z.string().min(1).max(500).optional(),
});
export const OpsMemberCapsInput = z.strictObject({
  caps: z.array(z.enum(["inquiry","peek","money","stop","notice","distribute","plan_propose","plan_decide","ops_people"])).min(1).max(9).optional(),
});
export const OpsTemplateReleaseInput = z.strictObject({
  items: z.array(z.unknown()).min(0).max(100).optional(),
  change_reason: z.string().min(1).max(500).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  dry_run: z.boolean().optional(),
});
export const OpsNoticeCreateInput = z.strictObject({
  kind: z.enum(["incident","maintenance","release"]).optional(),
  title: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  audience_mode: z.enum(["all","plans","workspaces"]).optional(),
  audience_plans: z.array(z.enum(["free","team","business"])).optional(),
  audience_workspace_ids: z.array(z.uuid()).optional(),
  placements: z.array(z.enum(["band","list"])).min(1).max(2).optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  impact: z.string().min(1).max(200).nullable().optional(),
});
export const OpsNoticeUpdateInput = z.strictObject({
  kind: z.enum(["incident","maintenance","release"]).optional(),
  title: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  body: z.string().min(1).max(4000).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  audience_mode: z.enum(["all","plans","workspaces"]).optional(),
  audience_plans: z.array(z.enum(["free","team","business"])).optional(),
  audience_workspace_ids: z.array(z.uuid()).optional(),
  placements: z.array(z.enum(["band","list"])).min(1).max(2).optional(),
  publish_at: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_from: z.iso.datetime({ offset: true }).nullable().optional(),
  maintenance_to: z.iso.datetime({ offset: true }).nullable().optional(),
  impact: z.string().min(1).max(200).nullable().optional(),
});
export const OpsInvoiceTemplateInput = z.strictObject({
  company: z.string().min(1).max(100).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  address: z.string().min(1).max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  reg_no: z.string().regex(new RegExp("^T[0-9]{13}$", "u")).optional(),
  contact: z.string().min(1).max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  payee: z.string().min(1).max(200).regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
  note: z.string().max(500).optional(),
  version: z.number().int().min(0).optional(),
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
  title: z.string().optional(),
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
  title: z.string().optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
  state: z.string().optional(),
  placements: z.array(z.string()).optional(),
  publish_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  incident_state: z.string().nullable().optional(),
  admins_only: z.boolean().optional(),
  body: z.string().optional(),
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
  page_id: z.uuid().optional(),
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
  color_key: z.string().optional(),
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
  ticket_prefix: z.string().optional(),
  color: z.string().nullable().optional(),
  parent_id: z.uuid().optional(),
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
  ticket_prefix: z.string().optional(),
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
  email: z.string().optional(),
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
  name: z.string().optional(),
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
  title: z.string().optional(),
  topic: z.string().optional(),
  state: z.string().optional(),
  created_at: z.string().optional(),
  last_reply_at: z.string().nullable().optional(),
  has_unread_reply: z.boolean().optional(),
});
export const MyInquiryDetail = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().optional(),
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
  author_name: z.string().optional(),
  body: z.string().optional(),
  attachments: z.array(z.unknown()).optional(),
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
  title: z.string().optional(),
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
  kind: z.string().optional(),
  author_name: z.string().optional(),
  body: z.string().optional(),
  attachments: z.array(z.unknown()).optional(),
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
  name: z.string().optional(),
  version: z.number().int().optional(),
  price_monthly: z.number().int().optional(),
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
  from_version: z.number().int().optional(),
  to_version: z.number().int().optional(),
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
  name: z.string().optional(),
  summary: z.string().optional(),
  version: z.number().int().optional(),
  using: z.number().int().optional(),
  took: z.record(z.string(), z.unknown()).nullable().optional(),
  last_released_at: z.string().nullable().optional(),
});
export const OpsTemplate = z.strictObject({
  id: z.uuid().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
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
  title: z.string().optional(),
  body: z.string().optional(),
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
  title: z.string().optional(),
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
  plan_name: z.string().optional(),
  month: z.string().optional(),
  amount_total: z.number().int().optional(),
  state: z.string().optional(),
  paid_total: z.number().int().optional(),
  difference: z.number().int().optional(),
  due_on: z.string().optional(),
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
  title: z.string().optional(),
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
  title: z.string().regex(new RegExp("[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]", "u")).optional(),
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

export const INPUT_RULES: Record<string, Record<string, unknown>> = {"TicketGuestSharesInput":{"anyOf":[{"required":["add"]},{"required":["remove"]}]},"SignInInput":{"allOf":[{"properties":{"email":{"pattern":"^[ \\t\\n\\r]*(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}[ \\t\\n\\r]*$"}}}]},"SignInCodeInput":{"allOf":[{"properties":{"pending":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}],"oneOf":[{"required":["code"],"properties":{"code":{"type":"string"}},"not":{"required":["backup_code"]}},{"required":["backup_code"],"properties":{"backup_code":{"type":"string"}},"not":{"required":["code"]}}]},"TicketCreateInput":{"allOf":[{"anyOf":[{"not":{"properties":{"priority":{"enum":["high"]}},"required":["priority"]}},{"properties":{"priority_reason":{"type":"string","pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}},"required":["priority_reason"]}]},{"anyOf":[{"not":{"required":["copy"]}},{"required":["duplicate_of"]}]}]},"CredentialCreateInput":{"anyOf":[{"properties":{"kind":{"enum":["login"]},"two_factor":{"enum":["none","sms","email","push"]}},"required":["kind","login","password","two_factor"],"not":{"anyOf":[{"required":["value"]},{"required":["totp_secret"]}]}},{"properties":{"kind":{"enum":["login"]}},"required":["kind","login","password"],"not":{"anyOf":[{"required":["two_factor"]},{"required":["value"]},{"required":["totp_secret"]}]}},{"properties":{"kind":{"enum":["login"]},"two_factor":{"enum":["totp"]}},"required":["kind","login","password","two_factor","totp_secret"],"not":{"anyOf":[{"required":["value"]}]}},{"properties":{"kind":{"enum":["key"]}},"required":["kind","value"],"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["two_factor"]},{"required":["totp_secret"]}]}}]},"CredentialUpdateInput":{"allOf":[{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["value"]},{"required":["two_factor"]},{"required":["totp_secret"]},{"required":["destinations"]},{"required":["expires_on"]},{"required":["description"]}]},{"anyOf":[{"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["value"]},{"required":["totp_secret"]}]}},{"required":["login","password"],"not":{"required":["value"]}},{"required":["value"],"not":{"anyOf":[{"required":["login"]},{"required":["password"]},{"required":["two_factor"]},{"required":["totp_secret"]}]}}]}]},"CredentialLoginAnswerInput":{"oneOf":[{"required":["code"],"not":{"required":["approved"]}},{"required":["approved"],"not":{"required":["code"]}}]},"CredentialCheckReportInput":{"oneOf":[{"properties":{"state":{"enum":["asking","waiting"]}},"required":["request_ref"]},{"properties":{"state":{"enum":["ok","bad_password","needs_2fa","bad_code","captcha","unreachable","no_form","stopped","no_answer"]}}}]},"TicketMessageInput":{"allOf":[{"not":{"required":["stage_id","stage_key"]}},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["todo","doing"]}}},{"required":["hold_reason","resume_condition"]}]},{"anyOf":[{"required":["stage_id"]},{"required":["stage_key"],"properties":{"stage_key":{"enum":["hold"]}}},{"not":{"anyOf":[{"required":["hold_reason"]},{"required":["resume_condition"]}]}}]}]},"TicketUpdateInput":{"allOf":[{"not":{"required":["stage_id","stage_key"]}},{"anyOf":[{"required":["stage_id"]},{"required":["stage_key"]},{"required":["actual_minutes"]},{"required":["hold_reason"]},{"required":["resume_condition"]},{"required":["priority"]},{"required":["priority_reason"]},{"required":["parent_ticket_id"]},{"required":["fields"]},{"required":["estimate_minutes"]},{"required":["due_on"]},{"required":["start_on"]}]},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["todo","doing"]}}},{"required":["hold_reason","resume_condition"]}]},{"anyOf":[{"not":{"required":["stage_key"]}},{"properties":{"stage_key":{"enum":["hold"]}}},{"not":{"anyOf":[{"required":["hold_reason"]},{"required":["resume_condition"]}]}}]},{"anyOf":[{"not":{"required":["due_on"]}},{"required":["due_reason"],"properties":{"due_reason":{"type":"string"}}}]},{"anyOf":[{"not":{"required":["due_reason"]}},{"required":["due_on"]}]},{"anyOf":[{"not":{"required":["expected_due_on"]}},{"required":["due_on"]}]},{"anyOf":[{"not":{"required":["expected_start_on"]}},{"required":["start_on"]}]}],"oneOf":[{"properties":{"priority":{"enum":["high"]}},"required":["priority","priority_reason"]},{"not":{"anyOf":[{"required":["priority_reason"]},{"properties":{"priority":{"enum":["high"]}},"required":["priority"]}]}}]},"TicketDecisionUpdateInput":{"oneOf":[{"properties":{"action":{"enum":["revise"]},"text":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"}},"required":["text"]},{"properties":{"action":{"enum":["cancel"]},"reason":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f]"}},"required":["reason"]}]},"TicketHandoverCreateInput":{"allOf":[{"not":{"allOf":[{"required":["to_member_id"],"properties":{"to_member_id":{"type":"string"}}},{"required":["to_scope_id"],"properties":{"to_scope_id":{"type":"string"}}}]}},{"anyOf":[{"not":{"required":["kind"],"properties":{"kind":{"enum":["offer"]}}}},{"properties":{"to_member_id":{"nullable":true,"enum":[null]},"to_scope_id":{"nullable":true,"enum":[null]},"reply_due":{"nullable":true,"enum":[null]}}}]},{"anyOf":[{"not":{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}}},{"properties":{"to_scope_id":{"nullable":true,"enum":[null]}}}]},{"anyOf":[{"not":{"required":["replaces"],"properties":{"replaces":{"type":"string"}}}},{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}}]},{"anyOf":[{"not":{"anyOf":[{"required":["kind"],"properties":{"kind":{"enum":["pass"]}}},{"required":["kind"],"properties":{"kind":{"enum":["distribute"]}}}]}},{"anyOf":[{"required":["to_member_id"],"properties":{"to_member_id":{"type":"string"}}},{"required":["to_scope_id"],"properties":{"to_scope_id":{"type":"string"}}}]}]}]},"TicketHandoverAnswerInput":{"allOf":[{"anyOf":[{"not":{"required":["decision"],"properties":{"decision":{"enum":["decline"]}}}},{"required":["decline_reason"],"properties":{"decline_reason":{"type":"string","pattern":"^[^\\u0000]*[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0000-\\u001f\\u007f\\ufeff][^\\u0000]*$"}}}]}]},"InvitationsCreateInput":{"oneOf":[{"properties":{"role_key":{"enum":["requester"]}},"required":["guest_group_id"],"not":{"required":["scope_id"]}},{"properties":{"role_key":{"enum":["member","manager","viewer","admin"]}},"required":["scope_id"],"not":{"required":["guest_group_id"]}}]},"TestSpecUpdateInput":{"oneOf":[{"required":["checked"]},{"required":["title"]}]},"SavedViewInput":{"anyOf":[{"not":{"required":["share"]}},{"properties":{"share":{"enum":["self"]}}},{"required":["scope_id"],"properties":{"scope_id":{"type":"string"}}}]},"SavedViewUpdateInput":{"allOf":[{"anyOf":[{"required":["name"]},{"required":["share"]},{"required":["scope_id"]},{"required":["filters"]},{"required":["columns"]},{"required":["density"]}]},{"anyOf":[{"not":{"required":["share"]}},{"properties":{"share":{"enum":["self"]}}},{"required":["scope_id"],"properties":{"scope_id":{"type":"string"}}}]}]},"KnowledgeFolderCreateInput":{"anyOf":[{"properties":{"shelf":{"enum":["company","me"]}}},{"required":["group_id"],"properties":{"group_id":{"type":"string","format":"uuid"}}}]},"KnowledgeFolderUpdateInput":{"anyOf":[{"required":["name"]},{"required":["parent_folder_id"]},{"required":["position"]}]},"KnowledgePageCreateInput":{"anyOf":[{"properties":{"shelf":{"enum":["company","me"]}}},{"required":["group_id"],"properties":{"group_id":{"type":"string","format":"uuid"}}}]},"KnowledgeDraftInput":{"anyOf":[{"required":["title"]},{"required":["desc"]},{"required":["doc"]}]},"KnowledgePageMoveInput":{"anyOf":[{"required":["folder_id"]},{"required":["position"]}]},"KnowledgeShareSetInput":{"oneOf":[{"required":["page_id"]},{"required":["folder_id"]}]},"TicketKindUpdateInput":{"anyOf":[{"required":["name"]},{"required":["color_key"]},{"required":["body_template"]}]},"TicketStageUpdateInput":{"anyOf":[{"required":["name"]},{"required":["color_key"]}]},"TicketFieldCreateInput":{"oneOf":[{"properties":{"field_type":{"enum":["select","multi_select"]},"options":{"minItems":1}},"required":["options"]},{"properties":{"field_type":{"enum":["short_text","long_text","number","date","check"]},"options":{"maxItems":0}}}]},"TicketFieldUpdateInput":{"allOf":[{"anyOf":[{"required":["name"]},{"required":["field_type"]},{"required":["required"]},{"required":["description"]},{"required":["options"]},{"required":["kind_ids"]}]},{"not":{"required":["field_type","options"],"properties":{"field_type":{"enum":["short_text","long_text","number","date","check"]}}}}]},"LayerUpdateInput":{"anyOf":[{"required":["label"]},{"required":["order_no"]}]},"ScopeUpdateInput":{"anyOf":[{"required":["name"]},{"required":["color"]},{"required":["position"]},{"required":["manager_member_ids"]}]},"MemberGroupsInput":{"anyOf":[{"required":["primary_scope_id"]},{"required":["add_scope_ids"]},{"required":["remove_scope_ids"]}]},"WorkspacePermissionsInput":{"anyOf":[{"required":["billing"]},{"required":["delete_workspace"]}]},"MeUpdateInput":{"anyOf":[{"required":["name"]},{"required":["call_name"]},{"required":["language"]},{"required":["theme"]},{"required":["week_start"]},{"required":["timezone"]}]},"NotificationSettingsUpdateInput":{"anyOf":[{"required":["email_digest"]},{"required":["quiet_hours"]},{"required":["pause"]},{"required":["urgent_override"]},{"required":["events"]}]},"MemberRemoveInput":{"not":{"required":["transfer_to_member_id","transfers"]}},"ClientRequestDraftResultInput":{"oneOf":[{"required":["draft"]},{"required":["failed"]}]},"OpsInquiryUpdateInput":{"allOf":[{"anyOf":[{"required":["take"]},{"required":["release"]},{"required":["state"]},{"required":["later_until"]}]},{"not":{"properties":{"take":{"const":true},"release":{"const":true}},"required":["take","release"]}},{"not":{"required":["state","later_until"]}}]},"PlanProposalCreateInput":{"allOf":[{"not":{"properties":{"existing_policy":{"enum":["after_days"]}},"required":["existing_policy"],"not":{"required":["notice_days"]}}},{"not":{"properties":{"existing_policy":{"enum":["keep"]}},"required":["existing_policy","notice_days"]}}]},"PlanProposalUpdateInput":{"allOf":[{"anyOf":[{"required":["price_monthly"]},{"required":["member_limit"]},{"required":["trial_days"]},{"required":["existing_policy"]},{"required":["notice_days"]},{"required":["new_from"]},{"required":["reason"]}]},{"not":{"properties":{"existing_policy":{"enum":["after_days"]}},"required":["existing_policy"],"not":{"required":["notice_days"]}}},{"not":{"properties":{"existing_policy":{"enum":["keep"]}},"required":["existing_policy","notice_days"]}}]},"PlanProposalDecideInput":{"allOf":[{"properties":{"notice_body":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}]},"PlanProposalReturnInput":{"allOf":[{"properties":{"reason":{"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"}}}]},"OpsWorkspaceStopInput":{"anyOf":[{"required":["stop_on"],"properties":{"mode":{"enum":["scheduled"]}}},{"not":{"required":["stop_on"]},"properties":{"mode":{"enum":["now"]},"reason_key":{"enum":["violation","danger"]}}}]},"WorkspaceNoticeInput":{"not":{"properties":{"admins_only":{"const":true},"placements":{"contains":{"const":"band"}}},"required":["admins_only","placements"]}},"OpsNoticeCreateInput":{"allOf":[{"oneOf":[{"properties":{"audience_mode":{"enum":["workspaces"]},"audience_workspace_ids":{"minItems":1}},"required":["audience_workspace_ids"],"not":{"required":["audience_plans"]}},{"properties":{"audience_mode":{"enum":["plans"]},"audience_plans":{"minItems":1}},"required":["audience_plans"],"not":{"required":["audience_workspace_ids"]}},{"properties":{"audience_mode":{"enum":["all"]}},"not":{"anyOf":[{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]}}]},{"anyOf":[{"required":["maintenance_from","maintenance_to"]},{"not":{"anyOf":[{"required":["maintenance_from"]},{"required":["maintenance_to"]}]}}]}]},"OpsNoticeUpdateInput":{"oneOf":[{"properties":{"audience_mode":{"enum":["workspaces"]},"audience_workspace_ids":{"minItems":1}},"required":["audience_mode","audience_workspace_ids"],"not":{"required":["audience_plans"]}},{"properties":{"audience_mode":{"enum":["plans"]},"audience_plans":{"minItems":1}},"required":["audience_mode","audience_plans"],"not":{"required":["audience_workspace_ids"]}},{"properties":{"audience_mode":{"enum":["all"]}},"not":{"anyOf":[{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]},"required":["audience_mode"]},{"not":{"anyOf":[{"required":["audience_mode"]},{"required":["audience_plans"]},{"required":["audience_workspace_ids"]}]}}]}};

export const QUERY_RULES: Record<string, Record<string, Record<string, unknown>>> = {"getActionRun":{},"stopActionRun":{},"takeoverActionRun":{},"getApproval":{},"approveApproval":{},"editApproval":{},"returnApproval":{},"stopApproval":{},"withdrawApproval":{},"bulkApprove":{},"previewBulkApproval":{},"listApprovalHistory":{"decision":{"type":"string","enum":["approve","return","stop"]},"from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listApprovalQueue":{"kind":{"type":"string","enum":["artifact","handover"]},"sort":{"type":"string","pattern":"^[a-z_][a-z0-9_]{0,62}$","enum":["due","waiting","title"]},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getArtifactVersion":{},"restoreArtifactVersion":{},"updateArtifact":{},"listAuditEvents":{"q":{"type":"string","minLength":1,"maxLength":100,"pattern":"[^ \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"},"kind":{"type":"string","enum":["perm","out","device","ai","deleted","ops"]},"member_id":{"type":"string","format":"uuid"},"ticket_id":{"type":"string","format":"uuid"},"from":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$"},"to":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getInvitation":{},"acceptInvitation":{},"requestInvitationResend":{},"confirmInvitationJoin":{},"startOpsSetup":{},"requestPasswordReset":{},"resetPassword":{},"requestAdminRecovery":{},"getServiceStatus":{},"signInWithPassword":{},"signOut":{},"createSignup":{},"resendSignupEmail":{},"getSignupStatus":{},"verifySignup":{},"stepUp":{},"consentToTerms":{},"getCurrentTerms":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","deleted_at","id","kind","published_at","tenant_id","updated_at","updated_by","url","version"]}},"verifySignInCode":{},"setBridgeBrowser":{},"claimPairingCode":{},"reportCredentialCheck":{},"resolveCredential":{},"listMyDevices":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["alive_at","auth_session_id","bridge_version","browser","cli_model","country","created_at","created_by","deleted_at","device","device_label","device_token_hash","health","health_at","id","ip_region","issued_at","kind_id","last_ip","last_seen_at","login_kind","machine_id","member_id","mfa_pending","revoke_reason_id","revoked_at","step_up_at","tenant_id","terms_pending","updated_at","updated_by"]}},"updateMyDevice":{},"revokeMyDevice":{},"checkMyDeviceBrowser":{},"getFileForBridge":{"job_id":{"type":"string","format":"uuid"}},"sendHeartbeat":{},"putArtifactFromBridge":{},"reportBrowserState":{},"reportClientRequestDraft":{},"getJobControl":{},"mirrorConversationEntries":{},"finishBridgeJob":{},"reportJobProgress":{},"askFromBridge":{},"getBridgeQuestionAnswer":{},"callKanameTool":{},"takeBridgeJob":{},"listMirrorTargets":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"createPairingCode":{},"downloadBridgeRelease":{},"getLatestBridgeRelease":{"os":{"type":"string"},"arch":{"type":"string"}},"reportUsage":{},"listClientRequests":{"state":{"type":"string","enum":["live","done"]}},"getClientRequest":{},"updateClientRequest":{},"acceptClientRequest":{},"declineClientRequest":{},"requestClientRequestDraft":{},"replyToClientRequest":{},"getMyClone":{},"updateMyClone":{},"listCloneActivity":{"kind":{"type":"string","enum":["ran","made","stopped"]},"from":{"type":"string","format":"date"},"to":{"type":"string","format":"date"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getCloneGrowth":{},"getCloneNow":{},"listConversations":{"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"createConversation":{},"getConversation":{},"updateConversation":{},"deleteConversation":{},"createConversationAttachment":{},"listConversationMessages":{"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"sendConversationMessage":{},"answerAgentPermission":{},"stopConversation":{},"streamConversation":{},"listCredentials":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createCredential":{},"updateCredential":{},"deleteCredential":{},"checkCredentialLogin":{},"answerCredentialLoginCheck":{},"listGuestGroups":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"createGuestGroup":{},"updateGuestGroup":{},"deleteGuestGroup":{},"listHandoverRules":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listMyInquiries":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createInquiry":{},"getMyInquiry":{},"postInquiryMessage":{},"resolveMyInquiry":{},"uploadInquiryAttachment":{},"createInvitations":{},"revokeInvitation":{},"resendInvitation":{},"createInvitationLink":{},"downloadInvoicePdf":{},"listKnowledgeApprovals":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"createKnowledgeFolder":{},"updateKnowledgeFolder":{},"deleteKnowledgeFolder":{},"withdrawKnowledgeRequest":{},"approveKnowledgeRequest":{},"declineKnowledgeRequest":{},"dismissKnowledgeRequest":{},"getKnowledgeReview":{},"getKnowledgeShares":{"page_id":{"type":"string","format":"uuid"},"folder_id":{"type":"string","format":"uuid"}},"setKnowledgeShares":{},"findSimilarKnowledge":{},"getKnowledgeTree":{},"createKnowledgePage":{},"getKnowledgePage":{},"updateKnowledgePage":{},"deleteKnowledgePage":{},"copyKnowledgePage":{},"saveKnowledgeDraft":{},"discardKnowledgeDraft":{},"setKnowledgeMust":{},"publishKnowledgePage":{},"requestKnowledgeRaise":{},"listKnowledgeVersions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getKnowledgePageVersion":{},"listLayers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createLayer":{},"updateLayer":{},"getMe":{},"updateMe":{},"uploadAvatar":{},"regenerateBackupCodes":{},"requestEmailChange":{},"verifyEmailChange":{},"listMyInvitations":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["accepted_member_id","created_at","created_by","deleted_at","email","expires_at","guest_group_id","id","message","permission_preset","resend_requested_at","resent_at","revoked_at","role_id","scope_id","tenant_id","token_hash","updated_at","updated_by"]}},"getNotificationSettings":{"workspace_id":{"type":"string","format":"uuid"}},"updateNotificationSettings":{},"copyNotificationSettings":{},"renamePasskey":{},"deletePasskey":{},"setMyPassword":{},"changePassword":{},"getMySecurity":{},"listMySessions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["alive_at","auth_session_id","bridge_version","browser","cli_model","country","created_at","created_by","deleted_at","device","device_label","device_token_hash","health","health_at","id","ip_region","issued_at","kind_id","last_ip","last_seen_at","login_kind","machine_id","member_id","mfa_pending","revoke_reason_id","revoked_at","step_up_at","tenant_id","terms_pending","updated_at","updated_by"]}},"revokeMySession":{},"revokeOtherSessions":{},"listSetupTasks":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"dismissSetupTasks":{},"listMyTicketDrafts":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["auth_user_id","created_at","created_by","deleted_at","id","joined_at","member_id","role","status","tenant_id","updated_at","updated_by"]}},"saveMyTicketDraft":{},"disableTwoFactor":{},"confirmTwoFactor":{},"startTwoFactor":{},"getMyUsage":{},"leaveWorkspace":{},"switchWorkspace":{},"listMembers":{"scope_id":{"type":"string","format":"uuid"},"q":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"getMember":{},"updateMemberGroups":{},"removeMember":{},"previewMemberRemoval":{},"resumeMember":{},"updateMemberRole":{},"suspendMember":{},"resetMemberTwoFactor":{},"createArtifactFromMessage":{},"listNotices":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"unread":{"type":"string","enum":["true"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"markNoticeRead":{},"listNotifications":{"unread":{"type":"string","enum":["true","false"]},"actor_member_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":50}},"readNotification":{},"readAllNotifications":{},"listOpsInquiries":{"box":{"type":"string","enum":["unassigned","mine","waiting","later","done"]},"topic":{"type":"string","enum":["usage","trouble","billing","other"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getOpsInquiry":{},"updateOpsInquiry":{},"addOpsInquiryNote":{},"replyOpsInquiry":{},"getOpsInvoiceTemplate":{},"updateOpsInvoiceTemplate":{},"listOpsInvoices":{"month":{"type":"string","pattern":"^[0-9]{4}-(0[1-9]|1[0-2])$"},"state":{"type":"string","enum":["unpaid","paid","overdue"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"recordPayment":{},"issueOpsInvoices":{},"listOpsMembers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"addOpsMember":{},"updateOpsMemberCaps":{},"removeOpsMember":{},"listOpsNotices":{"kind":{"type":"string","enum":["incident","maintenance","release"]},"state":{"type":"string","enum":["draft","scheduled","published","resolved"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createOpsNotice":{},"getOpsNotice":{},"updateOpsNotice":{},"publishOpsNotice":{},"addIncidentUpdate":{},"listOperations":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["check_state","created_at","created_by","current_version","deleted_at","description","id","key","kind","name","tenant_id","updated_at","updated_by","version_label"]}},"closePeek":{},"listPlanHistory":{"plan_key":{"type":"string","enum":["free","team","business"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action","created_at","created_by","deleted_at","grant_id","id","occurred_at","ops_member_id","payload","target_id","target_tenant_id","target_type","tenant_id","updated_at","updated_by"]}},"listPlanProposals":{"state":{"type":"string","enum":["draft","waiting","decided","returned"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["changes","created_at","created_by","decided_at","decided_by","deleted_at","existing_policy","from_version","id","new_from","notice_days","plan_id","proposed_by","reason","return_reason","state","submitted_at","tenant_id","to_version","updated_at","updated_by"]}},"createPlanProposal":{},"updatePlanProposal":{},"decidePlanProposal":{},"getPlanProposalImpact":{},"returnPlanProposal":{},"submitPlanProposal":{},"listOpsPlans":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","current_version","deleted_at","id","key","limits","name","price_monthly","tenant_id","updated_at","updated_by"]}},"listOpsPwned":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"ackOpsPwnedPending":{},"getOpsShell":{},"listOpsTemplates":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getOpsTemplate":{},"releaseOpsTemplate":{},"listOpsWorkspaces":{"q":{"type":"string","maxLength":100},"view":{"type":"string","enum":["all","attention","stopped","closing"]},"plan":{"type":"string","enum":["free","team","business"]},"sort":{"type":"string","pattern":"^[a-z_][a-z0-9_]{0,62}$","enum":["attention","members","runs"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"getOpsWorkspace":{},"listOpsWorkspaceAudit":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"getOpsWorkspaceBilling":{},"listOpsWorkspaceInquiries":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["ai_first_answered_at","asker_read_at","assignee_ops_member_id","context","conversation_id","created_at","created_by","deleted_at","id","kind_id","last_message_at","later_until","opened_by_member_id","state","status_id","tenant_id","title","topic_key","updated_at","updated_by"]}},"listOpsWorkspaceMembers":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["agent_effort","agent_model","agent_permission_mode","auth_user_id","avatar_ref","call_name","created_at","created_by","deleted_at","display_name","id","kind_id","language","manager_member_id","role_id","scope_id","setup_dismissed_at","setup_skipped_keys","setup_step","suspended_at","suspended_by","tenant_id","theme","timezone","updated_at","updated_by","week_start"]}},"resendOpsVerification":{},"sendWorkspaceNotice":{},"openPeek":{},"changeOpsWorkspacePlan":{},"ackOpsPwned":{},"resumeWorkspace":{},"stopWorkspace":{},"getPortalHome":{"visit":{"type":"string","enum":["elsewhere"]}},"uploadPortalAttachment":{},"listPortalNotices":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["admins_only","affects","body","created_at","created_by","deleted_at","emailed_admins_at","id","impact","kind_id","maintenance_from","maintenance_to","placements","publish_at","published_by","state","target_plan_ids","target_tenant_id","target_tenant_ids","tenant_id","title","updated_at","updated_by"]}},"createPortalRequest":{},"getPortalRequest":{},"postPortalRequestMessage":{},"askPortalRequestQuestions":{},"getPortalTicket":{},"postPortalTicketMessage":{},"listSavedViews":{"share":{"type":"string","enum":["self","group"]},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createSavedView":{},"updateSavedView":{},"deleteSavedView":{},"listScopes":{"layer_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["color","created_at","created_by","deleted_at","id","layer_id","name","next_ticket_no","parent_id","position","tenant_id","ticket_prefix","updated_at","updated_by"]}},"createScope":{},"updateScope":{},"getScopeOverview":{},"search":{"q":{"type":"string","maxLength":100},"kinds":{"type":"string","pattern":"^(?:ticket|decision|conversation|knowledge)(?:,(?:ticket|decision|conversation|knowledge))*$"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":5}},"getServiceStatusForMember":{},"getShell":{},"updateTestSpec":{},"deleteTestSpec":{},"listTicketFieldMaster":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"listTicketFields":{"kind_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createTicketField":{},"updateTicketField":{},"deleteTicketField":{},"reorderTicketFields":{},"updateTicketDecision":{},"startDraftConversation":{},"adoptDraftConversation":{},"sendDraftMessage":{},"answerTicketHandover":{},"claimTicketHandover":{},"remindTicketHandover":{},"withdrawTicketHandover":{},"createTicketImport":{},"getTicketImport":{},"commitTicketImport":{},"listTicketKinds":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["body_template","color","color_key","created_at","created_by","deleted_at","description","id","is_builtin","name","position","template_hash","template_key","tenant_id","updated_at","updated_by"]}},"createTicketKind":{},"updateTicketKind":{},"deleteTicketKind":{},"reorderTicketKinds":{},"listKindTemplateUpdates":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"applyKindTemplateUpdate":{},"deleteTicketLink":{},"updateTicketMessage":{},"deleteTicketMessage":{},"starTicketMessage":{},"listTicketStages":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["color_key","created_at","created_by","deleted_at","id","is_fixed","key","name","position","template_hash","template_key","tenant_id","updated_at","updated_by"]}},"createTicketStage":{},"updateTicketStage":{},"deleteTicketStage":{},"reorderTicketStages":{},"listTickets":{"view":{"type":"string","enum":["mine","all"]},"q":{"type":"string","maxLength":100},"scope_id":{"type":"string","format":"uuid"},"kind_id":{"type":"string","format":"uuid"},"stage_id":{"type":"string","format":"uuid"},"assignee_id":{"type":"string","format":"uuid"},"done":{"type":"string","enum":["true","false"]},"due":{"type":"string","enum":["none"]},"delegated":{"type":"string","enum":["true","false"]},"approving":{"type":"string","enum":["true","false"]},"due_from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"due_to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"start_from":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"start_to":{"type":"string","format":"date","pattern":"^(?!0000-)[0-9]{4}-[0-9]{2}-[0-9]{2}$"},"overdue":{"type":"string","enum":["true","false"]},"fire":{"type":"string","enum":["true","false"]},"parent":{"type":"string","pattern":"^(?:none|any|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"fields":{"type":"string","pattern":"^(?:start_on|priority|estimate_minutes|actual_minutes|scope)(?:,(?:start_on|priority|estimate_minutes|actual_minutes|scope))*$"},"cursor":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,200}$"},"limit":{"type":"integer","minimum":1,"maximum":100},"sort":{"type":"string","enum":["due_on","start_on","updated_at","created_at"]}},"createTicket":{},"getTicket":{},"updateTicket":{},"deleteTicket":{"children":{"type":"string","enum":["","move","cascade","detach"]},"parent_id":{"type":"string","format":"uuid"},"reason":{"type":"string","maxLength":400}},"getTicketAgentSession":{},"applyTicketAgentProposal":{},"sendTicketAgentMessage":{},"listTicketArtifacts":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["approved_by","created_at","created_by","current_version","deleted_at","format_id","id","owner_member_id","scope_id","source_conversation_id","source_job_id","source_message_id","storage_ref","task_id","template_id","tenant_id","title","updated_at","updated_by"]}},"createTicketAttachment":{},"updateTicketBody":{},"completeTicket":{},"listTicketDecisions":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["cancel_reason","cancelled_at","cancelled_by","created_at","created_by","decided_at","decided_by","decided_note","deleted_at","id","promoted_to","reason","source_message_id","superseded_by_id","tenant_id","text","ticket_id","updated_at","updated_by"]}},"createTicketDecision":{},"delegateTicket":{},"previewTicketDelete":{},"dryRunTicket":{},"listTicketGuestShares":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","pattern":"^[a-z_][a-z0-9_]{0,62}$"}},"updateTicketGuestShares":{},"previewTicketHandover":{},"listTicketHandovers":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["answered_by","ask","created_at","created_by","decided_at","decline_reason","deleted_at","from_member_id","id","kind","notify_managers","overdue_notified_at","reason","reminded_at","reply_due","state","switch","switch_applied","tenant_id","ticket_id","to_member_id","to_scope_id","updated_at","updated_by"]}},"createTicketHandover":{},"listTicketItemChanges":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"restoreTicketItems":{},"previewTicketKindChange":{},"listTicketLinks":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","deleted_at","from_ticket_id","id","kind","tenant_id","to_ticket_id","updated_at","updated_by"]}},"createTicketLink":{},"createTicketMessage":{},"listTicketReferences":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action_run_id","bridge_job_id","created_at","created_by","deleted_at","id","member_id","ref_id","ref_type","seen_at","tenant_id","ticket_id","title","updated_at","updated_by","url"]}},"restoreTicket":{},"listTicketRuns":{"scope_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["action_kind_id","ai_employee_id","approval_id","bridge_job_id","choke_point_id","cost","created_at","created_by","deleted_at","duty_id","error_summary","finished_at","id","mode_id","phase","procedure_id","scope_id","service_id","started_at","status_id","taken_over_at","task_id","tenant_id","ticket_id","tokens_in","tokens_out","updated_at","updated_by"]}},"listTestSpecs":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"createTestSpec":{},"lintTestSpecs":{},"suggestTestSpecs":{},"listTicketTimeline":{"filter":{"type":"string"},"before_at":{"type":"string"},"before_id":{"type":"string","format":"uuid"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":100}},"markTicketTimelineSeen":{},"listTicketVersions":{"from":{"type":"string"},"to":{"type":"string"},"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200}},"restoreTicketVersion":{},"bulkUpdateTickets":{},"getWorkspaceSettings":{},"updateWorkspace":{},"getBilling":{},"updateBillingContact":{},"requestWorkspaceDeletion":{},"cancelWorkspaceDeletion":{},"uploadWorkspaceLogo":{},"getWorkspaceMembers":{},"updateWorkspacePermissions":{},"changePlan":{},"listWorkspacePlans":{"cursor":{"type":"string","pattern":"^[0-9]{1,9}$"},"limit":{"type":"integer","minimum":1,"maximum":200},"sort":{"type":"string","enum":["created_at","created_by","current_version","deleted_at","id","key","limits","name","price_monthly","tenant_id","updated_at","updated_by"]}}};

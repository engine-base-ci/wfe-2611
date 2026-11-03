// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:97208711802d3bba
export type ApiResponse<T> = { data: T; meta?: { cursor?: string; limit?: number; total?: number } };
export type ApiError = { error: string; code?: string; message?: string; details?: Array<{ field: string; message: string }>; retry_after_sec?: number };

export type Tenants = { name?: string; plan_id?: string; status_id?: string; live_at?: string; live_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TenantsInput = { name?: string; plan_id?: string; status_id?: string; live_at?: string; live_by?: string };
export type Scopes = { parent_id?: string; layer_id?: string; name?: string; ticket_prefix?: string; next_ticket_no?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ScopesInput = { parent_id?: string; layer_id?: string; name?: string; ticket_prefix?: string; next_ticket_no?: string };
export type MemberKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemberKindsInput = { key?: string; label?: string };
export type Members = { kind_id?: string; display_name?: string; role_id?: string; manager_member_id?: string; auth_user_id?: string; setup_step?: string; agent_permission_mode?: string; agent_model?: string; agent_effort?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MembersInput = { kind_id?: string; display_name?: string; role_id?: string; manager_member_id?: string; auth_user_id?: string; setup_step?: string; agent_permission_mode?: string; agent_model?: string; agent_effort?: string };
export type SetupSteps = { n?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SetupStepsInput = { n?: string; label?: string };
export type Clones = { owner_member_id?: string; persona?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClonesInput = { owner_member_id?: string; persona?: string };
export type AiEmployees = { member_id?: string; provisioning_id?: string; template_ref?: string; paused_at?: string; paused_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AiEmployeesInput = { member_id?: string; provisioning_id?: string; template_ref?: string; paused_at?: string; paused_reason?: string };
export type GoalKinds = { key?: string; label?: string; progress_strategy?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalKindsInput = { key?: string; label?: string; progress_strategy?: string };
export type Units = { key?: string; label?: string; symbol?: string; value_type_id?: string; decimals?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type UnitsInput = { key?: string; label?: string; symbol?: string; value_type_id?: string; decimals?: number };
export type RollupKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RollupKindsInput = { key?: string; label?: string };
export type Goals = { ended_at?: string; parent_id?: string; rollup_kind_id?: string; rollup_spec?: Record<string, unknown>; kind_id?: string; period_start?: string; period_end?: string; target_value?: number; unit_id?: string; origin_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalsInput = { ended_at?: string; parent_id?: string; rollup_kind_id?: string; rollup_spec?: Record<string, unknown>; kind_id?: string; period_start?: string; period_end?: string; target_value?: number; unit_id?: string; origin_id?: string };
export type GoalAllocations = { goal_id?: string; assignee_member_id?: string; allocated_value?: number; agreement_status_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalAllocationsInput = { goal_id?: string; assignee_member_id?: string; allocated_value?: number; agreement_status_id?: string };
export type GoalContributions = { child_goal_id?: string; parent_goal_id?: string; hypothesis_id?: string; verdict_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalContributionsInput = { child_goal_id?: string; parent_goal_id?: string; hypothesis_id?: string; verdict_id?: string };
export type GoalVersions = { goal_id?: string; version?: number; name?: string; snapshot?: Record<string, unknown>; changed_at?: string; changed_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type GoalVersionsInput = { goal_id?: string; name?: string; snapshot?: Record<string, unknown>; changed_at?: string; changed_by?: string };
export type Hypotheses = { goal_id?: string; statement?: string; evidence?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type HypothesesInput = { goal_id?: string; statement?: string; evidence?: string };
export type Measures = { hypothesis_id?: string; statement?: string; expected_effect?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MeasuresInput = { hypothesis_id?: string; statement?: string; expected_effect?: number };
export type Validations = { measure_id?: string; measured_value?: number; verdict_id?: string; measured_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ValidationsInput = { measure_id?: string; measured_value?: number; verdict_id?: string; measured_at?: string };
export type LedgerDefinitions = { kind_id?: string; name?: string; json_schema?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LedgerDefinitionsInput = { kind_id?: string; name?: string; json_schema?: Record<string, unknown> };
export type LedgerFields = { definition_id?: string; key?: string; label?: string; data_type_id?: string; required?: boolean; options_master_id?: string; order_no?: number; is_filterable?: boolean; is_sortable?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LedgerFieldsInput = { definition_id?: string; key?: string; label?: string; data_type_id?: string; required?: boolean; options_master_id?: string; order_no?: number; is_filterable?: boolean; is_sortable?: boolean };
export type LedgerStages = { definition_id?: string; key?: string; label?: string; order_no?: number; rules?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LedgerStagesInput = { definition_id?: string; key?: string; label?: string; order_no?: number; rules?: Record<string, unknown> };
export type LedgerViews = { definition_id?: string; kind_id?: string; filters?: Record<string, unknown>; sorts?: Record<string, unknown>; columns?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LedgerViewsInput = { definition_id?: string; kind_id?: string; filters?: Record<string, unknown>; sorts?: Record<string, unknown>; columns?: Record<string, unknown> };
export type LedgerRecords = { definition_id?: string; stage_id?: string; amount?: number; occurred_on?: string; assignee_id?: string; goal_id?: string; measure_id?: string; data?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LedgerRecordsInput = { definition_id?: string; stage_id?: string; amount?: number; occurred_on?: string; assignee_id?: string; goal_id?: string; measure_id?: string; data?: Record<string, unknown> };
export type Duties = { ai_employee_id?: string; name?: string; definition_md?: string; constraints?: Record<string, unknown>; visibility_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DutiesInput = { ai_employee_id?: string; name?: string; definition_md?: string; constraints?: Record<string, unknown>; visibility_id?: string };
export type DutyVersions = { duty_id?: string; version?: number; snapshot?: Record<string, unknown>; changed_by?: string; change_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DutyVersionsInput = { duty_id?: string; snapshot?: Record<string, unknown>; changed_by?: string; change_reason?: string };
export type LearnedProcedures = { duty_id?: string; target_service_id?: string; status_id?: string; run_count?: number; avg_ms?: number; fail_count?: number; last_verified_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LearnedProceduresInput = { duty_id?: string; target_service_id?: string; status_id?: string; run_count?: number; avg_ms?: number; fail_count?: number; last_verified_at?: string };
export type ProcedureSteps = { procedure_id?: string; order_no?: number; intent_ja?: string; locator?: Record<string, unknown>; is_variable?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ProcedureStepsInput = { procedure_id?: string; order_no?: number; intent_ja?: string; is_variable?: boolean };
export type MemoryKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemoryKindsInput = { key?: string; label?: string };
export type Memories = { kind_id?: string; owner_member_id?: string; title?: string; body?: string; confidence?: number; source_type_id?: string; source_ref_id?: string; approved_by?: string; approved_at?: string; digest_id?: string; superseded_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemoriesInput = { kind_id?: string; owner_member_id?: string; title?: string; body?: string; confidence?: number; source_type_id?: string; source_ref_id?: string; approved_by?: string; approved_at?: string; digest_id?: string; superseded_by?: string };
export type MemoryDigests = { member_id?: string; from_on?: string; to_on?: string; conversation_count?: number; state_id?: string; result?: Record<string, unknown>; bridge_job_id?: string; started_at?: string; finished_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemoryDigestsInput = { member_id?: string; from_on?: string; to_on?: string; conversation_count?: number; state_id?: string; result?: Record<string, unknown>; bridge_job_id?: string; started_at?: string; finished_at?: string };
export type MemoryProposals = { memory_id?: string; target_scope_id?: string; proposer_member_id?: string; reviewer_member_id?: string; state_id?: string; conflict_group_id?: string; evidence?: Record<string, unknown>; decided_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MemoryProposalsInput = { memory_id?: string; target_scope_id?: string; proposer_member_id?: string; reviewer_member_id?: string; state_id?: string; conflict_group_id?: string; evidence?: Record<string, unknown>; decided_at?: string };
export type EmbeddingModels = { key?: string; label?: string; dim?: number; state_id?: string; artifact_url?: string; sha256?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type EmbeddingModelsInput = { key?: string; label?: string; dim?: number; state_id?: string; artifact_url?: string; sha256?: string };
export type SearchEmbeddings = { target_type_id?: string; target_id?: string; model_id?: string; chunk_no?: string; content_hash?: string; embedding?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SearchEmbeddingsInput = { target_type_id?: string; target_id?: string; model_id?: string; chunk_no?: string };
export type Tasks = { parent_task_id?: string; goal_id?: string; measure_id?: string; assignee_member_id?: string; status_id?: string; due_on?: string; title?: string; origin_id?: string; goal_changed_at?: string; next_action?: string; estimate_minutes?: number; actual_minutes?: number; planned_for?: string; blocked_reason_id?: string; blocked_since?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TasksInput = { parent_task_id?: string; goal_id?: string; measure_id?: string; assignee_member_id?: string; status_id?: string; due_on?: string; title?: string; origin_id?: string; goal_changed_at?: string; next_action?: string; estimate_minutes?: number; actual_minutes?: number; planned_for?: string; blocked_reason_id?: string; blocked_since?: string };
export type TaskHandovers = { task_id?: string; from_member_id?: string; to_member_id?: string; mode_id?: string; agreement_status_id?: string; reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TaskHandoversInput = { task_id?: string; from_member_id?: string; to_member_id?: string; mode_id?: string; agreement_status_id?: string; reason?: string };
export type DailyPlans = { member_id?: string; plan_date?: string; capacity_minutes?: number; committed_at?: string; closed_at?: string; carry_over?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DailyPlansInput = { member_id?: string; plan_date?: string; capacity_minutes?: number; committed_at?: string; closed_at?: string; carry_over?: Record<string, unknown> };
export type Triggers = { kind_id?: string; cron_expr?: string; timezone?: string; on_missed_id?: string; ttl_minutes?: number; enabled?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TriggersInput = { kind_id?: string; cron_expr?: string; timezone?: string; on_missed_id?: string; ttl_minutes?: number; enabled?: boolean };
export type Policies = { subject_kind_id?: string; action_kind_id?: string; mode_id?: string; params?: Record<string, unknown>; is_locked?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PoliciesInput = { subject_kind_id?: string; action_kind_id?: string; mode_id?: string; params?: Record<string, unknown>; is_locked?: boolean };
export type Approvals = { action_run_id?: string; requested_by?: string; approver_member_id?: string; status_id?: string; resolved_at?: string; note?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ApprovalsInput = { action_run_id?: string; requested_by?: string; approver_member_id?: string; status_id?: string; resolved_at?: string; note?: string };
export type ActionRuns = { task_id?: string; action_kind_id?: string; choke_point_id?: string; service_id?: string; procedure_id?: string; status_id?: string; started_at?: string; finished_at?: string; tokens_in?: number; tokens_out?: number; cost?: number; error_summary?: string; ai_employee_id?: string; duty_id?: string; mode_id?: string; bridge_job_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ActionRunsInput = { task_id?: string; action_kind_id?: string; choke_point_id?: string; service_id?: string; procedure_id?: string; status_id?: string; started_at?: string; finished_at?: string; tokens_in?: number; tokens_out?: number; cost?: number; error_summary?: string; ai_employee_id?: string; duty_id?: string; mode_id?: string; bridge_job_id?: string };
export type ServiceRegistry = { name?: string; domain?: string; automation_verdict_id?: string; notes?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ServiceRegistryInput = { name?: string; domain?: string; automation_verdict_id?: string; notes?: string };
export type CredentialKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type CredentialKindsInput = { key?: string; label?: string };
export type Credentials = { service_id?: string; service_name?: string; service_domain?: string; kind_id?: string; provider_id?: string; vault_ref?: string; owner_member_id?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type CredentialsInput = { service_id?: string; service_name?: string; service_domain?: string; kind_id?: string; provider_id?: string; owner_member_id?: string; revoked_at?: string };
export type Conversations = { title?: string; participant_member_ids?: string[]; area?: string; subject_type?: string; parent_conversation_id?: string; agent_session_id?: string; branched_from_message_id?: string; owner_member_id?: string; closed_at?: string; title_auto?: string; starred_at?: string; incognito?: string; last_read_at?: string; deleted_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ConversationsInput = { title?: string; participant_member_ids?: string[]; area?: string; subject_type?: string; parent_conversation_id?: string; agent_session_id?: string; branched_from_message_id?: string; owner_member_id?: string; closed_at?: string; title_auto?: string; starred_at?: string; incognito?: string; last_read_at?: string };
export type BridgeJobs = { member_id?: string; conversation_id?: string; state_id?: string; prompt?: string; agent_session_id?: string; result?: string; partial?: string; stopped_reason?: string; permission_mode?: string; model?: string; effort?: string; tools?: string[]; attachment_ids?: string[]; steer_seq?: string; tool_token_hash?: string; browser?: string; started_at?: string; finished_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BridgeJobsInput = { member_id?: string; conversation_id?: string; state_id?: string; prompt?: string; agent_session_id?: string; result?: string; partial?: string; stopped_reason?: string; permission_mode?: string; model?: string; effort?: string; tools?: string[]; attachment_ids?: string[]; steer_seq?: string; tool_token_hash?: string; browser?: string; started_at?: string; finished_at?: string };
export type BridgeJobStates = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BridgeJobStatesInput = { key?: string; label?: string };
export type BridgeJobEvents = { member_id?: string; job_id?: string; kind?: string; seq?: string; request_id?: string; payload?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BridgeJobEventsInput = { member_id?: string; job_id?: string; kind?: string; seq?: string; request_id?: string; payload?: Record<string, unknown> };
export type PermissionRules = { member_id?: string; tool?: string; target_pattern?: string; decision_id?: string; bridge_job_event_id?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PermissionRulesInput = { member_id?: string; tool?: string; target_pattern?: string; decision_id?: string; bridge_job_event_id?: string; revoked_at?: string };
export type AgentUsageSnapshots = { member_id?: string; window_id?: string; utilization?: number; resets_at?: string; observed_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AgentUsageSnapshotsInput = { member_id?: string; window_id?: string; utilization?: number; resets_at?: string; observed_at?: string };
export type Messages = { conversation_id?: string; sender_member_id?: string; body?: string; attachments?: Record<string, unknown>; action_run_id?: string; kind?: string; options?: Record<string, unknown>; confidence?: number; citations?: Record<string, unknown>; parent_message_id?: string; quote?: Record<string, unknown>; work?: Record<string, unknown>; send_state?: string; transcript_uuid?: string; undo_action_run_id?: string; read_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type MessagesInput = { conversation_id?: string; sender_member_id?: string; body?: string; attachments?: Record<string, unknown>; action_run_id?: string; kind?: string; options?: Record<string, unknown>; confidence?: number; citations?: Record<string, unknown>; parent_message_id?: string; quote?: Record<string, unknown>; work?: Record<string, unknown>; send_state?: string; transcript_uuid?: string; undo_action_run_id?: string; read_at?: string };
export type Artifacts = { task_id?: string; format_id?: string; storage_ref?: string; template_id?: string; approved_by?: string; source_message_id?: string; title?: string; owner_member_id?: string; current_version?: number; source_conversation_id?: string; source_job_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ArtifactsInput = { task_id?: string; format_id?: string; template_id?: string; approved_by?: string; source_message_id?: string; title?: string; owner_member_id?: string; current_version?: number; source_conversation_id?: string; source_job_id?: string };
export type ArtifactVersions = { artifact_id?: string; version?: number; storage_ref?: string; size_bytes?: number; owner_member_id?: string; reverted_from?: number; note?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ArtifactVersionsInput = { artifact_id?: string; size_bytes?: number; owner_member_id?: string; reverted_from?: number; note?: string };
export type AuditEvents = { actor_member_id?: string; actor_role?: string; action?: string; target_type?: string; target_id?: string; choke_point_id?: string; payload?: Record<string, unknown>; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AuditEventsInput = { actor_member_id?: string; actor_role?: string; action?: string; target_type?: string; target_id?: string; choke_point_id?: string; payload?: Record<string, unknown>; occurred_at?: string };
export type SessionKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SessionKindsInput = { key?: string; label?: string };
export type RevokeReasons = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RevokeReasonsInput = { key?: string; label?: string };
export type Layers = { key?: string; label?: string; order_no?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LayersInput = { key?: string; label?: string; order_no?: number };
export type TargetKinds = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TargetKindsInput = { key?: string; label?: string };
export type Abilities = { key?: string; label?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AbilitiesInput = { key?: string; label?: string };
export type Permissions = { grantee_member_id?: string; target_kind_id?: string; scope_id?: string; ability_id?: string; granted_by?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PermissionsInput = { grantee_member_id?: string; target_kind_id?: string; ability_id?: string; granted_by?: string; revoked_at?: string };
export type AccountEvents = { kind_id?: string; subject_type?: string; subject_id?: string; requested_by?: string; status_id?: string; resolved_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AccountEventsInput = { kind_id?: string; subject_type?: string; subject_id?: string; requested_by?: string; status_id?: string; resolved_at?: string };
export type AccountEventItems = { event_id?: string; object_kind?: string; disposition_id?: string; target_ref?: string; decided_by?: string; done_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AccountEventItemsInput = { event_id?: string; object_kind?: string; disposition_id?: string; target_ref?: string; decided_by?: string; done_at?: string };
export type Sessions = { member_id?: string; kind_id?: string; auth_session_id?: string; device_label?: string; ip_region?: string; issued_at?: string; last_seen_at?: string; revoked_at?: string; revoke_reason_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SessionsInput = { member_id?: string; kind_id?: string; auth_session_id?: string; device_label?: string; ip_region?: string; issued_at?: string; last_seen_at?: string; revoked_at?: string; revoke_reason_id?: string };
export type SupportAccessGrants = { granted_by_member_id?: string; scope?: Record<string, unknown>; expires_at?: string; revoked_at?: string; ops_member_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SupportAccessGrantsInput = { granted_by_member_id?: string; scope?: Record<string, unknown>; expires_at?: string; revoked_at?: string; ops_member_id?: string };
export type RetentionHolds = { record_type?: string; record_ref?: string; retain_until?: string; legal_basis?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RetentionHoldsInput = { record_type?: string; record_ref?: string; retain_until?: string; legal_basis?: string };
export type ErasureCertificates = { issued_at?: string; content_hash?: string; sent_to?: string; storage_ref?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ErasureCertificatesInput = { issued_at?: string; sent_to?: string };
export type Distributions = { kind_id?: string; key?: string; name?: string; current_version?: number; plan_ids?: string[]; is_locked?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DistributionsInput = { kind_id?: string; key?: string; name?: string; current_version?: number; plan_ids?: string[]; is_locked?: boolean };
export type DistributionVersions = { distribution_id?: string; version?: number; snapshot?: Record<string, unknown>; released_at?: string; released_by?: string; change_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DistributionVersionsInput = { distribution_id?: string; snapshot?: Record<string, unknown>; released_at?: string; released_by?: string; change_reason?: string };
export type TenantDistributions = { distribution_id?: string; version_in_use?: number; enabled?: boolean; override?: Record<string, unknown>; disabled_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TenantDistributionsInput = { distribution_id?: string; version_in_use?: number; enabled?: boolean; override?: Record<string, unknown>; disabled_by?: string };
export type ServiceRegistryVersions = { service_id?: string; version?: number; automation_verdict_id?: string; reason?: string; released_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ServiceRegistryVersionsInput = { service_id?: string; automation_verdict_id?: string; reason?: string; released_at?: string };
export type ServiceRequests = { service_name?: string; url?: string; requested_by?: string; verdict_id?: string; decided_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ServiceRequestsInput = { service_name?: string; url?: string; requested_by?: string; verdict_id?: string; decided_at?: string };
export type ReviewRequests = { subject_type?: string; subject_id?: string; anonymization_check?: Record<string, unknown>; status_id?: string; reviewer_ops_member_id?: string; decided_at?: string; reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ReviewRequestsInput = { subject_type?: string; subject_id?: string; anonymization_check?: Record<string, unknown>; status_id?: string; reviewer_ops_member_id?: string; decided_at?: string; reason?: string };
export type OpsMembers = { member_id?: string; ops_role_id?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type OpsMembersInput = { member_id?: string; ops_role_id?: string; revoked_at?: string };
export type OpsAuditEvents = { ops_member_id?: string; target_tenant_id?: string; action?: string; target_type?: string; target_id?: string; grant_id?: string; payload?: Record<string, unknown>; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type OpsAuditEventsInput = { ops_member_id?: string; target_tenant_id?: string; action?: string; target_type?: string; target_id?: string; grant_id?: string; payload?: Record<string, unknown>; occurred_at?: string };
export type SecurityEvents = { kind_id?: string; member_id?: string; ip_region?: string; detail?: Record<string, unknown>; occurred_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SecurityEventsInput = { kind_id?: string; member_id?: string; ip_region?: string; detail?: Record<string, unknown>; occurred_at?: string };
export type Inquiries = { opened_by_member_id?: string; kind_id?: string; status_id?: string; conversation_id?: string; assignee_ops_member_id?: string; ai_first_answered_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type InquiriesInput = { opened_by_member_id?: string; kind_id?: string; status_id?: string; conversation_id?: string; assignee_ops_member_id?: string; ai_first_answered_at?: string };
export type Notices = { kind_id?: string; title?: string; body?: string; target_plan_ids?: string[]; target_tenant_id?: string; publish_at?: string; published_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type NoticesInput = { kind_id?: string; title?: string; body?: string; target_plan_ids?: string[]; target_tenant_id?: string; publish_at?: string; published_by?: string };
export type NoticeDeliveries = { notice_id?: string; member_id?: string; delivered_at?: string; read_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type NoticeDeliveriesInput = { notice_id?: string; member_id?: string; delivered_at?: string; read_at?: string };
export type StatusIncidents = { component_id?: string; service_id?: string; state_id?: string; started_at?: string; resolved_at?: string; note?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type StatusIncidentsInput = { component_id?: string; service_id?: string; state_id?: string; started_at?: string; resolved_at?: string; note?: string };
export type NotificationPreferences = { member_id?: string; event_kind_id?: string; channel_id?: string; enabled?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type NotificationPreferencesInput = { member_id?: string; event_kind_id?: string; channel_id?: string; enabled?: boolean };
export type Notifications = { member_id?: string; channel_id?: string; event_kind_id?: string; payload?: Record<string, unknown>; dedupe_key?: string; sent_at?: string; failed_at?: string; retry_count?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type NotificationsInput = { member_id?: string; channel_id?: string; event_kind_id?: string; payload?: Record<string, unknown>; sent_at?: string; failed_at?: string; retry_count?: number };
export type Plans = { key?: string; name?: string; price_monthly?: number; limits?: Record<string, unknown>; current_version?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PlansInput = { key?: string; name?: string; price_monthly?: number; limits?: Record<string, unknown>; current_version?: number };
export type PlanVersions = { plan_id?: string; version?: number; snapshot?: Record<string, unknown>; released_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PlanVersionsInput = { plan_id?: string; snapshot?: Record<string, unknown>; released_at?: string };
export type Subscriptions = { plan_id?: string; status_id?: string; started_at?: string; suspended_at?: string; ended_at?: string; billing_contact?: Record<string, unknown>; payment_method_id?: string; stripe_customer_ref?: string; stripe_subscription_ref?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SubscriptionsInput = { plan_id?: string; status_id?: string; started_at?: string; suspended_at?: string; ended_at?: string; billing_contact?: Record<string, unknown>; payment_method_id?: string; stripe_customer_ref?: string; stripe_subscription_ref?: string };
export type PlanChangeRequests = { from_plan_id?: string; to_plan_id?: string; requested_by?: string; status_id?: string; dependencies_event_id?: string; decided_by_ops_member_id?: string; decided_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PlanChangeRequestsInput = { from_plan_id?: string; to_plan_id?: string; requested_by?: string; status_id?: string; dependencies_event_id?: string; decided_by_ops_member_id?: string; decided_at?: string };
export type UsageMeters = { meter_key?: string; period_start?: string; value?: number; limit_value?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type UsageMetersInput = { meter_key?: string; period_start?: string; value?: number; limit_value?: number };
export type Invoices = { subscription_id?: string; period_start?: string; period_end?: string; amount?: number; issued_at?: string; due_on?: string; status_id?: string; pdf_ref?: string; stripe_invoice_ref?: string; hosted_url?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type InvoicesInput = { subscription_id?: string; period_start?: string; period_end?: string; amount?: number; issued_at?: string; due_on?: string; status_id?: string; pdf_ref?: string; stripe_invoice_ref?: string; hosted_url?: string };
export type Payments = { invoice_id?: string; paid_on?: string; amount?: number; method_id?: string; recorded_by_ops_member_id?: string; stripe_payment_ref?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PaymentsInput = { invoice_id?: string; paid_on?: string; amount?: number; method_id?: string; recorded_by_ops_member_id?: string; stripe_payment_ref?: string };
export type ErrorEvents = { error_code?: string; member_id?: string; screen_id?: string; context?: Record<string, unknown>; shown_at?: string; next_action_taken_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ErrorEventsInput = { error_code?: string; member_id?: string; screen_id?: string; context?: Record<string, unknown>; shown_at?: string; next_action_taken_at?: string };
export type Imports = { file_ref?: string; detected_kind_id?: string; proposal?: Record<string, unknown>; status_id?: string; applied_at?: string; applied_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ImportsInput = { file_ref?: string; detected_kind_id?: string; proposal?: Record<string, unknown>; status_id?: string; applied_at?: string; applied_by?: string };
export type Integrations = { service_id?: string; kind_id?: string; credential_id?: string; scopes?: string[]; status_id?: string; connected_at?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type IntegrationsInput = { service_id?: string; kind_id?: string; credential_id?: string; scopes?: string[]; status_id?: string; connected_at?: string; revoked_at?: string };
export type Invitations = { email?: string; scope_id?: string; role_id?: string; permission_preset?: Record<string, unknown>; token_hash?: string; expires_at?: string; accepted_member_id?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type InvitationsInput = { email?: string; role_id?: string; permission_preset?: Record<string, unknown>; expires_at?: string; accepted_member_id?: string; revoked_at?: string };
export type PendingSignup = { email?: string; name?: string; company_name?: string; pw_iv?: string; token_hash?: string; expires_at?: string; sent_at?: string; send_error?: string; consumed_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PendingSignupInput = { email?: string; name?: string; company_name?: string; pw_iv?: string; expires_at?: string; sent_at?: string; send_error?: string; consumed_at?: string };
export type ExportJobs = { requested_by?: string; kind_id?: string; storage_ref?: string; status_id?: string; expires_at?: string; downloaded_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ExportJobsInput = { requested_by?: string; kind_id?: string; status_id?: string; expires_at?: string; downloaded_at?: string };
export type Attachments = { owner_type?: string; owner_id?: string; storage_ref?: string; mime?: string; size?: number; name?: string; uploaded_by?: string; scanned_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AttachmentsInput = { owner_type?: string; owner_id?: string; mime?: string; size?: number; name?: string; uploaded_by?: string; scanned_at?: string };
export type Skills = { kind_id?: string; key?: string; name?: string; purpose?: string; current_version?: number; plan_ids?: string[]; visibility_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SkillsInput = { kind_id?: string; key?: string; name?: string; purpose?: string; current_version?: number; plan_ids?: string[]; visibility_id?: string };
export type SkillVersions = { skill_id?: string; version?: number; package_ref?: string; changelog?: string; tested_at?: string; test_result?: Record<string, unknown>; released_at?: string; released_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SkillVersionsInput = { skill_id?: string; changelog?: string; tested_at?: string; test_result?: Record<string, unknown>; released_at?: string; released_by?: string };
export type SkillTestRuns = { skill_version_id?: string; ops_member_id?: string; mode?: string; started_at?: string; finished_at?: string; result?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SkillTestRunsInput = { skill_version_id?: string; ops_member_id?: string; mode?: string; started_at?: string; finished_at?: string; result?: Record<string, unknown> };
export type SkillAttachments = { skill_id?: string; version_in_use?: number; target_type?: string; target_id?: string; enabled?: boolean; disabled_by?: string; attached_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SkillAttachmentsInput = { skill_id?: string; version_in_use?: number; target_type?: string; target_id?: string; enabled?: boolean; disabled_by?: string; attached_at?: string };
export type PaymentMethods = { kind_id?: string; stripe_customer_ref?: string; brand?: string; last4?: string; expires_on?: string; registered_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PaymentMethodsInput = { kind_id?: string; stripe_customer_ref?: string; brand?: string; last4?: string; expires_on?: string; registered_at?: string };
export type BillingEvents = { stripe_event_ref?: string; kind?: string; payload?: Record<string, unknown>; received_at?: string; processed_at?: string; signature_ok?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BillingEventsInput = { stripe_event_ref?: string; kind?: string; payload?: Record<string, unknown>; received_at?: string; processed_at?: string; signature_ok?: string };
export type LlmRoutes = { default_kind_id?: string; offline_kind_id?: string; provider_id?: string; credential_id?: string; managed_allowed_by_ops_member_id?: string; managed_allowed_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LlmRoutesInput = { default_kind_id?: string; offline_kind_id?: string; provider_id?: string; credential_id?: string; managed_allowed_by_ops_member_id?: string; managed_allowed_at?: string };
export type LlmCapabilities = { key?: string; label?: string; provider_id?: string; capability_id?: string; supported?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LlmCapabilitiesInput = { key?: string; label?: string; provider_id?: string; capability_id?: string; supported?: string };
export type PushDevices = { member_id?: string; platform_id?: string; token_ref?: string; app_version?: number; last_seen_at?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PushDevicesInput = { member_id?: string; platform_id?: string; token_ref?: string; app_version?: number; last_seen_at?: string; revoked_at?: string };
export type DisclosureVersions = { version?: number; generated_at?: string; content_hash?: string; pdf_ref?: string; dpa_ref?: string; released_by?: string; notice_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type DisclosureVersionsInput = { generated_at?: string; pdf_ref?: string; dpa_ref?: string; released_by?: string; notice_id?: string };
export type Subprocessors = { name?: string; purpose?: string; region?: string; data_kinds?: string[]; effective_from?: string; announced_at?: string; retired_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SubprocessorsInput = { name?: string; purpose?: string; region?: string; data_kinds?: string[]; effective_from?: string; announced_at?: string; retired_at?: string };
export type Tickets = { number?: string; kind_id?: string; stage_id?: string; title?: string; assignee_member_id?: string; delegated_to_clone?: string; client_id?: string; parent_ticket_id?: string; derived_from_ticket_id?: string; start_on?: string; due_on?: string; priority?: string; estimate_minutes?: number; actual_minutes?: number; work_type_id?: string; work_type_version?: number; hold_reason?: string; resume_condition?: string; priority_reason?: string; deleted_by?: string; created_by?: string; draft_import_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketsInput = { number?: string; kind_id?: string; stage_id?: string; title?: string; assignee_member_id?: string; delegated_to_clone?: string; client_id?: string; parent_ticket_id?: string; derived_from_ticket_id?: string; start_on?: string; due_on?: string; priority?: string; estimate_minutes?: number; actual_minutes?: number; work_type_id?: string; work_type_version?: number; hold_reason?: string; resume_condition?: string; priority_reason?: string; deleted_by?: string; draft_import_id?: string };
export type TicketSections = { ticket_id?: string; section_key?: string; position?: string; body?: Record<string, unknown>; version?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketSectionsInput = { ticket_id?: string; section_key?: string; position?: string; body?: Record<string, unknown> };
export type TicketSectionVersions = { ticket_id?: string; section_id?: string; version?: number; body?: Record<string, unknown>; edited_by?: string; edited_at?: string; edited_by_clone?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketSectionVersionsInput = { ticket_id?: string; section_id?: string; body?: Record<string, unknown>; edited_by?: string; edited_at?: string; edited_by_clone?: string };
export type TicketKinds = { name?: string; color?: string; position?: string; is_builtin?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketKindsInput = { name?: string; color?: string; position?: string; is_builtin?: boolean };
export type KindSections = { kind_id?: string; section_key?: string; label?: string; mode?: string; position?: string; default_test_specs?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type KindSectionsInput = { kind_id?: string; section_key?: string; label?: string; mode?: string; position?: string; default_test_specs?: Record<string, unknown> };
export type TicketStages = { name?: string; position?: string; is_fixed?: boolean; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketStagesInput = { name?: string; position?: string; is_fixed?: boolean };
export type ClassAxes = { key?: string; name?: string; is_builtin?: boolean; position?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClassAxesInput = { key?: string; name?: string; is_builtin?: boolean; position?: string };
export type ClassValues = { axis_id?: string; label?: string; color?: string; position?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClassValuesInput = { axis_id?: string; label?: string; color?: string; position?: string };
export type TicketClassValues = { ticket_id?: string; value_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketClassValuesInput = { ticket_id?: string; value_id?: string };
export type HandoverRules = { target?: string; axis_id?: string; mode?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type HandoverRulesInput = { target?: string; axis_id?: string; mode?: string };
export type TestSpecs = { ticket_id?: string; check_kind?: string; title?: string; judge_type?: string; params?: Record<string, unknown>; version?: number; off_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TestSpecsInput = { ticket_id?: string; check_kind?: string; title?: string; judge_type?: string; params?: Record<string, unknown>; off_reason?: string };
export type Checks = { ticket_id?: string; test_spec_id?: string; spec_version?: number; artifact_version_id?: string; attempt?: string; result?: string; evidence?: Record<string, unknown>; runner?: string; checked_by_member_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ChecksInput = { ticket_id?: string; test_spec_id?: string; spec_version?: number; artifact_version_id?: string; attempt?: string; result?: string; evidence?: Record<string, unknown>; runner?: string; checked_by_member_id?: string };
export type TicketDecisions = { ticket_id?: string; text?: string; reason?: string; decided_by?: string; decided_at?: string; source_message_id?: string; superseded_by_id?: string; promoted_to?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketDecisionsInput = { ticket_id?: string; text?: string; reason?: string; decided_by?: string; decided_at?: string; source_message_id?: string; superseded_by_id?: string; promoted_to?: string };
export type TicketMessages = { ticket_id?: string; author_member_id?: string; kind?: string; body?: string; mentions?: string[]; changes?: Record<string, unknown>; quote_of_id?: string; reactions?: Record<string, unknown>; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketMessagesInput = { ticket_id?: string; author_member_id?: string; kind?: string; body?: string; mentions?: string[]; changes?: Record<string, unknown>; quote_of_id?: string; reactions?: Record<string, unknown> };
export type ReferenceLogs = { ticket_id?: string; action_run_id?: string; ref_type?: string; ref_id?: string; url?: string; title?: string; seen_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ReferenceLogsInput = { ticket_id?: string; action_run_id?: string; ref_type?: string; ref_id?: string; url?: string; title?: string; seen_at?: string };
export type KnowledgePages = { is_personal?: boolean; parent_page_id?: string; title?: string; owner_member_id?: string; state?: string; verify_interval_days?: string; verified_at?: string; verify_due_on?: string; topics?: string[]; current_version?: number; form?: string; archived_at?: string; archived_to_page_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type KnowledgePagesInput = { is_personal?: boolean; parent_page_id?: string; title?: string; owner_member_id?: string; state?: string; verify_interval_days?: string; verified_at?: string; verify_due_on?: string; topics?: string[]; current_version?: number; form?: string; archived_at?: string; archived_to_page_id?: string };
export type KnowledgePageVersions = { page_id?: string; version?: number; kind?: string; body?: Record<string, unknown>; note?: string; author_member_id?: string; proposed_from_ticket_id・proposed_by_clone?: string; decision?: string; decline_reason?: string; decided_by?: string; decided_at?: string; published_by?: string; published_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type KnowledgePageVersionsInput = { page_id?: string; kind?: string; body?: Record<string, unknown>; note?: string; author_member_id?: string; proposed_from_ticket_id・proposed_by_clone?: string; decision?: string; decline_reason?: string; decided_by?: string; decided_at?: string; published_by?: string; published_at?: string };
export type KnowledgeLinks = { nodes?: string[]; edges?: string[]; unlinked_mentions?: string[] };
export type KnowledgeLinksInput = { from_page_id?: string; to_type?: string; to_id?: string; anchor?: string };
export type Clients = { name?: string; owner_member_id?: string; visibility?: string; default_share?: Record<string, unknown>; routing?: string; email_domain?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClientsInput = { name?: string; owner_member_id?: string; visibility?: string; default_share?: Record<string, unknown>; routing?: string; email_domain?: string };
export type ClientGroups = { client_id?: string; scope_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClientGroupsInput = { client_id?: string };
export type ClientContacts = { client_id?: string; name?: string; email?: string; role?: string; member_id?: string; cc_role?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClientContactsInput = { client_id?: string; name?: string; email?: string; role?: string; member_id?: string; cc_role?: string };
export type ClientRequests = { client_id?: string; contact_id?: string; title?: string; body?: string; due_on?: string; state?: string; ticket_id?: string; routed_scope_id?: string; questions?: Record<string, unknown>; decline_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ClientRequestsInput = { client_id?: string; contact_id?: string; title?: string; body?: string; due_on?: string; state?: string; ticket_id?: string; routed_scope_id?: string; questions?: Record<string, unknown>; decline_reason?: string };
export type Acceptances = { ticket_id?: string; artifact_version_id?: string; contact_id?: string; due_on?: string; message?: string; result?: string; comment?: string; decided_at?: string; reminded_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type AcceptancesInput = { ticket_id?: string; artifact_version_id?: string; contact_id?: string; due_on?: string; message?: string; result?: string; comment?: string; decided_at?: string; reminded_at?: string };
export type TenantMemberships = { auth_user_id?: string; member_id?: string; role?: string; status?: string; joined_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TenantMembershipsInput = { auth_user_id?: string; member_id?: string; role?: string; status?: string; joined_at?: string };
export type TermsVersions = { kind?: string; version?: number; url?: string; published_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TermsVersionsInput = { kind?: string; url?: string; published_at?: string };
export type TermsConsents = { member_id?: string; auth_user_id?: string; terms_version_id?: string; agreed_at?: string; ip?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TermsConsentsInput = { member_id?: string; auth_user_id?: string; terms_version_id?: string; agreed_at?: string; ip?: string };
export type Passkeys = { auth_user_id?: string; credential_id?: string; public_key?: string; name?: string; transports?: string; last_used_at?: string; revoked_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type PasskeysInput = { auth_user_id?: string; credential_id?: string; public_key?: string; name?: string; transports?: string; last_used_at?: string; revoked_at?: string };
export type Operations = { key?: string; name?: string; kind?: string; current_version?: number; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type OperationsInput = { key?: string; name?: string; kind?: string; current_version?: number };
export type TicketLinks = { from_ticket_id?: string; to_ticket_id?: string; kind?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketLinksInput = { from_ticket_id?: string; to_ticket_id?: string; kind?: string };
export type TicketHandovers = { ticket_id?: string; kind?: string; from_member_id?: string; to_member_id?: string; to_scope_id?: string; reason?: string; ask?: string; reply_due?: string; switch?: Record<string, unknown>; state?: string; decline_reason?: string; decided_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketHandoversInput = { ticket_id?: string; kind?: string; from_member_id?: string; to_member_id?: string; to_scope_id?: string; reason?: string; ask?: string; reply_due?: string; switch?: Record<string, unknown>; state?: string; decline_reason?: string; decided_at?: string };
export type SavedViews = { member_id?: string; name?: string; share?: string; scope_id?: string; filters?: Record<string, unknown>; columns?: Record<string, unknown>; density?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type SavedViewsInput = { member_id?: string; name?: string; share?: string; filters?: Record<string, unknown>; columns?: Record<string, unknown>; density?: string };
export type TicketImports = { uploaded_by?: string; scope_id?: string; source?: string; mapping?: Record<string, unknown>; rows?: number; errors?: Record<string, unknown>; state?: string; committed_at?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type TicketImportsInput = { uploaded_by?: string; source?: string; mapping?: Record<string, unknown>; rows?: number; errors?: Record<string, unknown>; state?: string; committed_at?: string };
export type LearningCandidates = { owner_member_id?: string; trigger?: string; proposed_as?: string; text?: string; evidence?: Record<string, unknown>; check_result?: Record<string, unknown>; decided_by?: string; state?: string; decided_at?: string; result_type?: string; result_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type LearningCandidatesInput = { owner_member_id?: string; trigger?: string; proposed_as?: string; text?: string; evidence?: Record<string, unknown>; check_result?: Record<string, unknown>; decided_by?: string; state?: string; decided_at?: string; result_type?: string; result_id?: string };
export type BridgePairingCodes = { member_id?: string; code_hash?: string; expires_at?: string; used_at?: string; used_session_id?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type BridgePairingCodesInput = { member_id?: string; code_hash?: string; expires_at?: string; used_at?: string; used_session_id?: string };
export type NotificationSettings = { email_digest?: boolean; quiet_hours?: Record<string, unknown>; paused_until?: string; urgent_override?: string[]; events?: string[] };
export type NotificationSettingsInput = { member_id?: string; email_digest?: string; quiet_hours?: Record<string, unknown>; paused_until?: string; urgent_override?: Record<string, unknown> };
export type OpsPlanProposals = { plan_id?: string; from_version?: number; to_version?: number; changes?: Record<string, unknown>; existing_policy?: string; notice_days?: string; new_from?: string; reason?: string; proposed_by?: string; decided_by?: string; state?: string; decided_at?: string; return_reason?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type OpsPlanProposalsInput = { plan_id?: string; from_version?: number; to_version?: number; changes?: Record<string, unknown>; existing_policy?: string; notice_days?: string; new_from?: string; reason?: string; proposed_by?: string; decided_by?: string; state?: string; decided_at?: string; return_reason?: string };
export type ScopeMemberships = { member_id?: string; scope_id?: string; is_primary?: boolean; role?: string; since?: string; changed_by?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type ScopeMembershipsInput = { member_id?: string; is_primary?: boolean; role?: string; since?: string; changed_by?: string };
export type RoleBundleDefaults = { role?: string; target_kind_id?: string; ability_id?: string; scope_kind?: string; id: string; tenant_id?: string; created_at?: string; updated_at?: string };
export type RoleBundleDefaultsInput = { role?: string; target_kind_id?: string; ability_id?: string; scope_kind?: string };
export type ScopeOverview = { by_stage?: string[]; milestones?: string[]; recent?: string[]; total?: number };
export type TicketKindChangePreview = { added_sections?: string[]; removed_sections?: string[]; moved_to_body?: string[]; checks_reset?: boolean };
export type TicketDeletePreview = { children?: number; attachments?: number; artifacts?: number; restorable_until?: string };
export type SearchHit = { kind?: string; id?: string; title?: string; snippet?: string; url?: string };
export type TimelineItem = { kind?: string; at?: string; actor_member_id?: string; message?: Record<string, unknown>; changes?: string[]; run?: Record<string, unknown> };
export type TestSpecLint = { missing?: string[]; warnings?: string[] };
export type TicketCompletion = { ticket?: Record<string, unknown>; knowledge_candidates?: string[]; skipped_reason?: string };
export type BulkResult = { updated?: string[]; skipped?: string[] };
export type ApprovalQueueItem = { kind?: string; id?: string; ticket_id?: string; ticket_number?: string; title?: string; from_member_id?: string; check_summary?: string; due_on?: string; decide_inline?: boolean; primary_action?: string; secondary_action?: string };
export type ApprovalDetail = { approval?: Record<string, unknown>; ticket?: Record<string, unknown>; operation?: Record<string, unknown>; message_text?: string; artifact_version?: Record<string, unknown>; checks?: string[]; cautions?: string[]; irreversible?: boolean; chain?: string[] };
export type BulkApprovalPreview = { eligible?: string[]; excluded?: string[] };
export type CloneNow = { current?: Record<string, unknown>; next?: string[]; waiting_approvals?: number; stopped?: number };
export type CloneGrowth = { delegated?: number; passed_without_edit_rate?: number; saved_hours?: number; trend?: string[]; often_fixed?: string[] };
export type KnowsCounts = { rules?: number; work_types?: number; memories?: number; candidates?: number };
export type ActivityItem = { kind?: string; at?: string; title?: string; ticket_id?: string; used?: string[]; result?: string };
export type SignupStatus = { state?: string; email?: string; expires_at?: string };
export type MySecurity = { passkeys?: string[]; has_password?: boolean; two_factor?: boolean; two_factor_required?: boolean; backup_codes_left?: number; sessions?: string[]; recent_events?: string[] };
export type TwoFactorSetup = { otpauth_uri?: string; secret_masked?: string; expires_at?: string };
export type BackupCodes = { codes?: string[] };
export type StepUp = { step_up_at?: string; valid_until?: string };
export type Me = { member?: Record<string, unknown>; workspaces?: string[] };
export type MyUsage = { five_hour?: Record<string, unknown>; month?: Record<string, unknown>; by_workspace?: string[]; notify_at_percent?: number; on_exhausted?: string };
export type SetupTask = { key?: string; label?: string; done?: boolean; href?: string };
export type PairingCode = { code?: string; expires_at?: string };
export type BridgeRelease = { version?: string; files?: string[]; sha256?: Record<string, unknown>; released_at?: string };
export type BridgeClaim = { device_token?: string; device_id?: string; member_id?: string };
export type BridgeJob = { job?: Record<string, unknown>; allowed_tools?: string[]; forbidden_domains?: string[]; rules?: string[] };
export type JobControl = { stop?: boolean; steers?: string[] };
export type ResolvedCredential = { ref?: string; ciphertext_for_executor?: string; destinations?: string[]; expires_at?: string };
export type WorkTypeUploadCheck = { package?: Record<string, unknown>; checks?: string[]; passed?: boolean; test_scenarios?: number; changelog?: string };
export type PlanProposalImpact = { tenants?: number; monthly_revenue_diff?: number; existing_from?: string; new_from?: string; by_workspace?: string[] };
export type RuleCheck = { conflicts?: string[]; similar?: string[]; needs_approval_from?: string; warnings?: string[] };
export type WorkspaceMembers = { groups?: string[]; invitations?: string[]; alerts?: string[]; count?: number };
export type InvitationLink = { url?: string; expires_at?: string };
export type MemberDetail = { member?: Record<string, unknown>; groups?: string[]; role_bundle?: Record<string, unknown>; granted?: string[]; revoked?: string[]; assigned?: Record<string, unknown>; clone?: Record<string, unknown>; login?: Record<string, unknown>; recent_events?: string[] };
export type MemberRemovalPreview = { tickets?: string[]; handovers_cancelled?: string[]; approvals_reassigned?: string[]; sole_approver?: string[]; deleted?: string[]; kept?: string[]; restorable_until?: string };
export type WorkspaceRules = { rules?: string[]; rules_by_layer?: string[]; escalations?: string[]; work_types?: string[] };
export type EscalationPreview = { matched_last_month?: number; examples?: string[] };
export type ExportStatus = { status?: string; url?: string; expires_at?: string };
export type WorkspaceSettings = { workspace?: Record<string, unknown>; plan?: Record<string, unknown>; subscription?: Record<string, unknown>; price_change?: Record<string, unknown>; permissions?: string[]; fixed_rules?: string[]; deletion?: Record<string, unknown> };
export type PlanChoice = { plan_id?: string; name?: string; price_monthly?: number; limits?: Record<string, unknown>; current?: boolean; can_choose?: boolean; reason?: string; effective_from?: string };
export type Billing = { payee?: Record<string, unknown>; billing_contact?: Record<string, unknown>; terms?: string; invoices?: string[] };
export type SignedUrl = { url?: string; expires_at?: string };
export type ClientRow = { id?: string; name?: string; summary?: string; groups?: string[]; owner_member_id?: string; visibility?: string; active_tickets?: number; open_requests?: number; waiting_acceptances?: number; last_activity_at?: string };
export type ClientLinkCandidate = { ticket_id?: string; number?: string; title?: string; reason?: string };
export type ClientDetail = { client?: Record<string, unknown>; groups?: string[]; contacts?: string[]; todo?: string[]; rules?: string[]; knowledge?: string[]; counts?: Record<string, unknown> };
export type ClientActivityItem = { at?: string; actor?: Record<string, unknown>; kind?: string; text?: string; ticket_id?: string; client_visible?: boolean };
export type PortalHome = { to_review?: string[]; requests?: string[]; tickets?: string[] };
export type ClientRequestDetail = { request?: Record<string, unknown>; messages?: string[]; ticket_draft?: Record<string, unknown>; questions?: string[]; reply_draft?: string; route_suggestion?: Record<string, unknown> };
export type PortalQuestions = { available?: boolean; questions?: string[] };
export type PortalRequest = { request?: Record<string, unknown>; messages?: string[] };
export type PortalTicket = { title?: string; stage?: string; due_on?: string; artifacts?: string[]; messages?: string[]; sections?: string[] };
export type PortalAcceptance = { acceptance?: Record<string, unknown>; artifact?: Record<string, unknown>; preview_url?: string; message?: string; due_on?: string };
export type KnowledgeHome = { to_verify?: string[]; proposals?: string[]; recent?: string[]; popular?: string[]; count?: number };
export type KnowledgeTree = { places?: string[]; topics?: string[]; archived?: number };
export type KnowledgeAnswer = { mode?: string; answer?: string; citations?: string[]; hits?: string[] };
export type KnowledgePageDetail = { page?: Record<string, unknown>; body?: Record<string, unknown>; toc?: string[]; children?: string[]; backlinks?: string[]; related_rules?: string[]; proposal_marks?: string[]; draft?: Record<string, unknown> };
export type KnowledgeUsage = { reads_3m?: number; returns?: number; recent_tickets?: string[]; hot_sections?: string[] };
export type KnowledgeLinkTarget = { kind?: string; id?: string; title?: string; place?: string };
export type KnowledgeVerification = { page_id?: string; title?: string; place?: string; owner_member_id?: string; due_on?: string; interval?: string; ai_check?: string; suggested_action?: string; newer_page_id?: string };
export type KnowledgeImportPreview = { source?: string; pages?: number; folders?: number; links?: number; topics?: number; images?: number; mapping?: Record<string, unknown>; warnings?: string[] };
export type OpsWorkspaceRow = { id?: string; name?: string; admin?: Record<string, unknown>; plan?: string; members?: string; pc_connected?: string; runs_month?: number; attention?: string[]; billing?: string; state?: string };
export type OpsWorkspace = { workspace?: Record<string, unknown>; pc?: Record<string, unknown>; runs?: Record<string, unknown>; stopped?: Record<string, unknown>; files?: Record<string, unknown>; stop_reasons?: string[]; recent?: string[]; info?: Record<string, unknown> };
export type OpsWorkspaceMember = { name?: string; email?: string; role?: string; last_seen_at?: string; pc?: string; login?: string };
export type OpsWorkspaceBilling = { plan?: Record<string, unknown>; usage?: Record<string, unknown>; payment_terms?: string; invoices?: string[] };
export type Shell = { approvals_waiting?: number; notifications_unread?: number; groups?: string[]; pc?: Record<string, unknown>; setup_left?: number; banner?: Record<string, unknown>; workspace?: Record<string, unknown> };
export type OpsShell = { inquiries_unassigned?: number; inquiries_mine?: number; invoices_overdue?: number; banner?: Record<string, unknown> };
export type TicketShape = { kinds?: string[]; stages?: string[]; axes?: string[]; handover_rules?: string[]; limits?: Record<string, unknown>; template_updates?: number };
export type TicketShapeChangePreview = { removed?: string[]; needs_move_to?: string[]; affected_tickets?: number; over_limits?: string[] };
export type OpsInquiryDetail = { inquiry?: Record<string, unknown>; messages?: string[]; context?: Record<string, unknown>; workspace?: Record<string, unknown> };
export type OpsNoticeDetail = { notice?: Record<string, unknown>; updates?: string[]; affects?: Record<string, unknown>; placements?: string[] };
export type ServiceStatus = { components?: string[]; banner?: Record<string, unknown>; maintenance?: Record<string, unknown> };

export const ENDPOINTS = [
 {
  "id": "EP-001",
  "method": "POST",
  "path": "/api/v1/acceptances/:id/remind",
  "acts": [
   "A123"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-002",
  "method": "GET",
  "path": "/api/v1/action_runs/:id",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-003",
  "method": "POST",
  "path": "/api/v1/action_runs/:id/retry",
  "acts": [
   "A57"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-004",
  "method": "POST",
  "path": "/api/v1/action_runs/:id/stop",
  "acts": [
   "A89"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-005",
  "method": "POST",
  "path": "/api/v1/action_runs/:id/takeover",
  "acts": [
   "A57"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-006",
  "method": "GET",
  "path": "/api/v1/approvals/:id",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-007",
  "method": "POST",
  "path": "/api/v1/approvals/:id/approve",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-008",
  "method": "POST",
  "path": "/api/v1/approvals/:id/edit",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-009",
  "method": "POST",
  "path": "/api/v1/approvals/:id/return",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-010",
  "method": "POST",
  "path": "/api/v1/approvals/:id/stop",
  "acts": [
   "A15",
   "A89"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-011",
  "method": "POST",
  "path": "/api/v1/approvals/:id/withdraw",
  "acts": [
   "A89"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-012",
  "method": "POST",
  "path": "/api/v1/approvals/bulk",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-013",
  "method": "POST",
  "path": "/api/v1/approvals/bulk/preview",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-014",
  "method": "GET",
  "path": "/api/v1/approvals/history",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-015",
  "method": "GET",
  "path": "/api/v1/approvals/queue",
  "acts": [
   "A15"
  ],
  "screens": [
   "approvals"
  ]
 },
 {
  "id": "EP-016",
  "method": "GET",
  "path": "/api/v1/artifact_versions/:id",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-017",
  "method": "POST",
  "path": "/api/v1/artifact_versions/:id/restore",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-018",
  "method": "PATCH",
  "path": "/api/v1/artifacts/:id",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-019",
  "method": "GET",
  "path": "/api/v1/audit_events",
  "acts": [
   "A33"
  ],
  "screens": [
   "audit"
  ]
 },
 {
  "id": "EP-020",
  "method": "GET",
  "path": "/api/v1/auth/invitations/:token",
  "acts": [
   "A03"
  ],
  "screens": [
   "invite-accept"
  ]
 },
 {
  "id": "EP-021",
  "method": "POST",
  "path": "/api/v1/auth/invitations/:token/accept",
  "acts": [
   "A03",
   "A96"
  ],
  "screens": [
   "invite-accept"
  ]
 },
 {
  "id": "EP-022",
  "method": "POST",
  "path": "/api/v1/auth/password/forgot",
  "acts": [
   "A31"
  ],
  "screens": [
   "password-reset"
  ]
 },
 {
  "id": "EP-023",
  "method": "POST",
  "path": "/api/v1/auth/password/reset",
  "acts": [
   "A31"
  ],
  "screens": [
   "password-reset"
  ]
 },
 {
  "id": "EP-024",
  "method": "POST",
  "path": "/api/v1/auth/recovery/admin-request",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-025",
  "method": "GET",
  "path": "/api/v1/auth/service-status",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-026",
  "method": "POST",
  "path": "/api/v1/auth/sign-in",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-027",
  "method": "POST",
  "path": "/api/v1/auth/sign-out",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-028",
  "method": "POST",
  "path": "/api/v1/auth/sign-up",
  "acts": [
   "A01",
   "A96"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-029",
  "method": "POST",
  "path": "/api/v1/auth/sign-up/resend",
  "acts": [
   "A01"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-030",
  "method": "GET",
  "path": "/api/v1/auth/sign-up/status",
  "acts": [
   "A01"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-031",
  "method": "POST",
  "path": "/api/v1/auth/sign-up/verify",
  "acts": [
   "A02"
  ],
  "screens": [
   "verify-email"
  ]
 },
 {
  "id": "EP-032",
  "method": "POST",
  "path": "/api/v1/auth/step-up",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-033",
  "method": "POST",
  "path": "/api/v1/auth/terms/consent",
  "acts": [
   "A96"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-034",
  "method": "GET",
  "path": "/api/v1/auth/terms/current",
  "acts": [
   "A96"
  ],
  "screens": [
   "signup"
  ]
 },
 {
  "id": "EP-035",
  "method": "POST",
  "path": "/api/v1/auth/two-factor/verify",
  "acts": [
   "A13"
  ],
  "screens": [
   "login"
  ]
 },
 {
  "id": "EP-036",
  "method": "POST",
  "path": "/api/v1/bridge/claim",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-037",
  "method": "POST",
  "path": "/api/v1/bridge/credentials/:id/check-result",
  "acts": [
   "A10"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-038",
  "method": "POST",
  "path": "/api/v1/bridge/credentials/resolve",
  "acts": [
   "A10"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-039",
  "method": "GET",
  "path": "/api/v1/bridge/devices",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-040",
  "method": "PATCH",
  "path": "/api/v1/bridge/devices/:id",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-041",
  "method": "DELETE",
  "path": "/api/v1/bridge/devices/:id",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-042",
  "method": "GET",
  "path": "/api/v1/bridge/files/:ref",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-043",
  "method": "POST",
  "path": "/api/v1/bridge/heartbeat",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-044",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/artifacts",
  "acts": [
   "A95"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-045",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/browser",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-046",
  "method": "GET",
  "path": "/api/v1/bridge/jobs/:id/control",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-047",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/conversation-entries",
  "acts": [
   "A20"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-048",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/finish",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-049",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/progress",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-050",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/questions",
  "acts": [
   "A91"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-051",
  "method": "GET",
  "path": "/api/v1/bridge/jobs/:id/questions/:qid",
  "acts": [
   "A91"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-052",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/:id/tools/:name",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-053",
  "method": "POST",
  "path": "/api/v1/bridge/jobs/take",
  "acts": [
   "A104"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-054",
  "method": "POST",
  "path": "/api/v1/bridge/pairing-codes",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-055",
  "method": "GET",
  "path": "/api/v1/bridge/releases/:name/file",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-056",
  "method": "GET",
  "path": "/api/v1/bridge/releases/latest",
  "acts": [
   "A09"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-057",
  "method": "POST",
  "path": "/api/v1/bridge/usage",
  "acts": [
   "A94"
  ],
  "screens": [
   "bridge-setup"
  ]
 },
 {
  "id": "EP-058",
  "method": "POST",
  "path": "/api/v1/checks/:id/human",
  "acts": [
   "A15"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-059",
  "method": "GET",
  "path": "/api/v1/class_axes",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-060",
  "method": "PATCH",
  "path": "/api/v1/client_contacts/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-061",
  "method": "DELETE",
  "path": "/api/v1/client_contacts/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-062",
  "method": "POST",
  "path": "/api/v1/client_contacts/:id/invitation",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-063",
  "method": "GET",
  "path": "/api/v1/client_requests",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-064",
  "method": "GET",
  "path": "/api/v1/client_requests/:id",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-065",
  "method": "PATCH",
  "path": "/api/v1/client_requests/:id",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-066",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/accept",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-067",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/decline",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-068",
  "method": "POST",
  "path": "/api/v1/client_requests/:id/reply",
  "acts": [
   "A122"
  ],
  "screens": [
   "requests"
  ]
 },
 {
  "id": "EP-069",
  "method": "GET",
  "path": "/api/v1/clients",
  "acts": [
   "A103",
   "A121"
  ],
  "screens": [
   "clients",
   "tickets"
  ]
 },
 {
  "id": "EP-070",
  "method": "POST",
  "path": "/api/v1/clients",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-071",
  "method": "GET",
  "path": "/api/v1/clients/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-072",
  "method": "PATCH",
  "path": "/api/v1/clients/:id",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-073",
  "method": "GET",
  "path": "/api/v1/clients/:id/activity",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-074",
  "method": "POST",
  "path": "/api/v1/clients/:id/contacts",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-075",
  "method": "GET",
  "path": "/api/v1/clients/:id/portal-preview",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-076",
  "method": "PATCH",
  "path": "/api/v1/clients/:id/share",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-077",
  "method": "GET",
  "path": "/api/v1/clients/link-candidates",
  "acts": [
   "A121"
  ],
  "screens": [
   "clients"
  ]
 },
 {
  "id": "EP-078",
  "method": "GET",
  "path": "/api/v1/clones/me",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-079",
  "method": "PATCH",
  "path": "/api/v1/clones/me",
  "acts": [
   "A91"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-080",
  "method": "GET",
  "path": "/api/v1/clones/me/activity",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-081",
  "method": "POST",
  "path": "/api/v1/clones/me/activity/export",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-082",
  "method": "GET",
  "path": "/api/v1/clones/me/growth",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-083",
  "method": "GET",
  "path": "/api/v1/clones/me/knows/counts",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-084",
  "method": "GET",
  "path": "/api/v1/clones/me/now",
  "acts": [
   "A53"
  ],
  "screens": [
   "ai-activity"
  ]
 },
 {
  "id": "EP-085",
  "method": "GET",
  "path": "/api/v1/conversations",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-086",
  "method": "POST",
  "path": "/api/v1/conversations",
  "acts": [
   "A100",
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-087",
  "method": "GET",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-088",
  "method": "PATCH",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-089",
  "method": "DELETE",
  "path": "/api/v1/conversations/:id",
  "acts": [
   "A88"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-090",
  "method": "POST",
  "path": "/api/v1/conversations/:id/attachments",
  "acts": [
   "A90"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-091",
  "method": "GET",
  "path": "/api/v1/conversations/:id/messages",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-092",
  "method": "POST",
  "path": "/api/v1/conversations/:id/messages",
  "acts": [
   "A100",
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-093",
  "method": "POST",
  "path": "/api/v1/conversations/:id/permissions/:pid",
  "acts": [
   "A91"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-094",
  "method": "POST",
  "path": "/api/v1/conversations/:id/stop",
  "acts": [
   "A20"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-095",
  "method": "GET",
  "path": "/api/v1/credentials",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-096",
  "method": "POST",
  "path": "/api/v1/credentials",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-097",
  "method": "PATCH",
  "path": "/api/v1/credentials/:id",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-098",
  "method": "DELETE",
  "path": "/api/v1/credentials/:id",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-099",
  "method": "POST",
  "path": "/api/v1/credentials/:id/login-check",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-100",
  "method": "POST",
  "path": "/api/v1/credentials/:id/login-check/answer",
  "acts": [
   "A10"
  ],
  "screens": [
   "credentials"
  ]
 },
 {
  "id": "EP-101",
  "method": "POST",
  "path": "/api/v1/exports",
  "acts": [
   "A40"
  ],
  "screens": [
   "audit",
   "company-settings"
  ]
 },
 {
  "id": "EP-102",
  "method": "GET",
  "path": "/api/v1/exports/:id",
  "acts": [
   "A40"
  ],
  "screens": [
   "audit"
  ]
 },
 {
  "id": "EP-103",
  "method": "GET",
  "path": "/api/v1/handover_rules",
  "acts": [
   "A110"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-104",
  "method": "GET",
  "path": "/api/v1/inquiries",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-105",
  "method": "POST",
  "path": "/api/v1/inquiries",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-106",
  "method": "GET",
  "path": "/api/v1/inquiries/:id",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-107",
  "method": "POST",
  "path": "/api/v1/inquiries/:id/messages",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-108",
  "method": "POST",
  "path": "/api/v1/inquiries/:id/resolve",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-109",
  "method": "POST",
  "path": "/api/v1/inquiries/attachments",
  "acts": [
   "A67"
  ],
  "screens": [
   "inquiry"
  ]
 },
 {
  "id": "EP-110",
  "method": "POST",
  "path": "/api/v1/invitations",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-111",
  "method": "DELETE",
  "path": "/api/v1/invitations/:id",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-112",
  "method": "POST",
  "path": "/api/v1/invitations/:id/resend",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-113",
  "method": "POST",
  "path": "/api/v1/invitations/link",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-114",
  "method": "GET",
  "path": "/api/v1/invoices/:id/pdf",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-115",
  "method": "POST",
  "path": "/api/v1/knowledge/ask",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-116",
  "method": "POST",
  "path": "/api/v1/knowledge/ask/feedback",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-117",
  "method": "GET",
  "path": "/api/v1/knowledge/home",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-118",
  "method": "GET",
  "path": "/api/v1/knowledge/link-targets",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-119",
  "method": "GET",
  "path": "/api/v1/knowledge/proposals",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-120",
  "method": "POST",
  "path": "/api/v1/knowledge/proposals/:id/accept",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-121",
  "method": "POST",
  "path": "/api/v1/knowledge/proposals/:id/decline",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-122",
  "method": "GET",
  "path": "/api/v1/knowledge/tree",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-123",
  "method": "GET",
  "path": "/api/v1/knowledge/verifications",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-124",
  "method": "POST",
  "path": "/api/v1/knowledge_imports",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-125",
  "method": "GET",
  "path": "/api/v1/knowledge_imports/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-126",
  "method": "POST",
  "path": "/api/v1/knowledge_imports/:id/commit",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-127",
  "method": "GET",
  "path": "/api/v1/knowledge_pages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-128",
  "method": "POST",
  "path": "/api/v1/knowledge_pages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-129",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-130",
  "method": "PATCH",
  "path": "/api/v1/knowledge_pages/:id",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-131",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/archive",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-132",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/attachments",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-133",
  "method": "PATCH",
  "path": "/api/v1/knowledge_pages/:id/draft",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-134",
  "method": "DELETE",
  "path": "/api/v1/knowledge_pages/:id/draft",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-135",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/links",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-136",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/links",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-137",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/markdown",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-138",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/messages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-139",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/messages",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-140",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/publish",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-141",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/unarchive",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-142",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/usage",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-143",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/verify",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-144",
  "method": "GET",
  "path": "/api/v1/knowledge_pages/:id/versions",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-145",
  "method": "POST",
  "path": "/api/v1/knowledge_pages/:id/versions/:v/restore",
  "acts": [
   "A114"
  ],
  "screens": [
   "knowledge"
  ]
 },
 {
  "id": "EP-146",
  "method": "POST",
  "path": "/api/v1/layers",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-147",
  "method": "PATCH",
  "path": "/api/v1/layers/:id",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-148",
  "method": "GET",
  "path": "/api/v1/learning_candidates",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-149",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/accept",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-150",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/dismiss",
  "acts": [
   "A30",
   "A93"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-151",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/exception-request",
  "acts": [
   "A131"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-152",
  "method": "POST",
  "path": "/api/v1/learning_candidates/:id/later",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-153",
  "method": "GET",
  "path": "/api/v1/me",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-154",
  "method": "PATCH",
  "path": "/api/v1/me",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-155",
  "method": "POST",
  "path": "/api/v1/me/avatar",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-156",
  "method": "POST",
  "path": "/api/v1/me/backup-codes",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-157",
  "method": "POST",
  "path": "/api/v1/me/email-change",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-158",
  "method": "POST",
  "path": "/api/v1/me/email-change/verify",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-159",
  "method": "GET",
  "path": "/api/v1/me/notification-settings",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-160",
  "method": "PATCH",
  "path": "/api/v1/me/notification-settings",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-161",
  "method": "POST",
  "path": "/api/v1/me/notification-settings/copy",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-162",
  "method": "PATCH",
  "path": "/api/v1/me/passkeys/:id",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-163",
  "method": "DELETE",
  "path": "/api/v1/me/passkeys/:id",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-164",
  "method": "PATCH",
  "path": "/api/v1/me/password",
  "acts": [
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-165",
  "method": "GET",
  "path": "/api/v1/me/security",
  "acts": [
   "A04",
   "A97"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-166",
  "method": "GET",
  "path": "/api/v1/me/sessions",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-167",
  "method": "DELETE",
  "path": "/api/v1/me/sessions/:id",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-168",
  "method": "POST",
  "path": "/api/v1/me/sessions/revoke-others",
  "acts": [
   "A74"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-169",
  "method": "GET",
  "path": "/api/v1/me/setup-tasks",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-170",
  "method": "POST",
  "path": "/api/v1/me/setup-tasks/dismiss",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-171",
  "method": "DELETE",
  "path": "/api/v1/me/two-factor",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-172",
  "method": "POST",
  "path": "/api/v1/me/two-factor/confirm",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-173",
  "method": "POST",
  "path": "/api/v1/me/two-factor/enable",
  "acts": [
   "A04"
  ],
  "screens": [
   "mfa-setup"
  ]
 },
 {
  "id": "EP-174",
  "method": "GET",
  "path": "/api/v1/me/usage",
  "acts": [
   "A94"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-175",
  "method": "DELETE",
  "path": "/api/v1/me/workspaces/:id",
  "acts": [
   "A74"
  ],
  "screens": [
   "account"
  ]
 },
 {
  "id": "EP-176",
  "method": "GET",
  "path": "/api/v1/members",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-177",
  "method": "GET",
  "path": "/api/v1/members/:id",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-178",
  "method": "DELETE",
  "path": "/api/v1/members/:id",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-179",
  "method": "PATCH",
  "path": "/api/v1/members/:id/groups",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-180",
  "method": "POST",
  "path": "/api/v1/members/:id/nudge",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-181",
  "method": "PATCH",
  "path": "/api/v1/members/:id/permissions",
  "acts": [
   "A61"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-182",
  "method": "GET",
  "path": "/api/v1/members/:id/remove-preview",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-183",
  "method": "POST",
  "path": "/api/v1/members/:id/resume",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-184",
  "method": "PATCH",
  "path": "/api/v1/members/:id/role",
  "acts": [
   "A61"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-185",
  "method": "POST",
  "path": "/api/v1/members/:id/suspend",
  "acts": [
   "A62"
  ],
  "screens": [
   "member-detail"
  ]
 },
 {
  "id": "EP-186",
  "method": "POST",
  "path": "/api/v1/members/:id/two-factor/reset",
  "acts": [
   "A04"
  ],
  "screens": [
   "member-detail",
   "mfa-setup"
  ]
 },
 {
  "id": "EP-187",
  "method": "GET",
  "path": "/api/v1/memories",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-188",
  "method": "POST",
  "path": "/api/v1/memories",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-189",
  "method": "PATCH",
  "path": "/api/v1/memories/:id",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-190",
  "method": "DELETE",
  "path": "/api/v1/memories/:id",
  "acts": [
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-191",
  "method": "POST",
  "path": "/api/v1/memories/:id/promote",
  "acts": [
   "A131",
   "A30"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-192",
  "method": "POST",
  "path": "/api/v1/messages/:id/artifacts",
  "acts": [
   "A95"
  ],
  "screens": [
   "clone-chat"
  ]
 },
 {
  "id": "EP-193",
  "method": "GET",
  "path": "/api/v1/notices",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-194",
  "method": "POST",
  "path": "/api/v1/notices/:id/read",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-195",
  "method": "GET",
  "path": "/api/v1/notifications",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-196",
  "method": "PATCH",
  "path": "/api/v1/notifications/:id",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-197",
  "method": "POST",
  "path": "/api/v1/notifications/read-all",
  "acts": [
   "A109"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-198",
  "method": "GET",
  "path": "/api/v1/ops/inquiries",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-199",
  "method": "GET",
  "path": "/api/v1/ops/inquiries/:id",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-200",
  "method": "PATCH",
  "path": "/api/v1/ops/inquiries/:id",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-201",
  "method": "POST",
  "path": "/api/v1/ops/inquiries/:id/notes",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-202",
  "method": "POST",
  "path": "/api/v1/ops/inquiries/:id/replies",
  "acts": [
   "A70"
  ],
  "screens": [
   "ops-support"
  ]
 },
 {
  "id": "EP-203",
  "method": "GET",
  "path": "/api/v1/ops/invoices",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-204",
  "method": "POST",
  "path": "/api/v1/ops/invoices/:id/payments",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-205",
  "method": "POST",
  "path": "/api/v1/ops/invoices/export",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-206",
  "method": "POST",
  "path": "/api/v1/ops/invoices/issue",
  "acts": [
   "A72"
  ],
  "screens": [
   "ops-billing"
  ]
 },
 {
  "id": "EP-207",
  "method": "GET",
  "path": "/api/v1/ops/members",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-208",
  "method": "POST",
  "path": "/api/v1/ops/members",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-209",
  "method": "PATCH",
  "path": "/api/v1/ops/members/:id",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-210",
  "method": "DELETE",
  "path": "/api/v1/ops/members/:id",
  "acts": [
   "A134"
  ],
  "screens": [
   "ops-team"
  ]
 },
 {
  "id": "EP-211",
  "method": "GET",
  "path": "/api/v1/ops/notices",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-212",
  "method": "POST",
  "path": "/api/v1/ops/notices",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-213",
  "method": "GET",
  "path": "/api/v1/ops/notices/:id",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-214",
  "method": "PATCH",
  "path": "/api/v1/ops/notices/:id",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-215",
  "method": "POST",
  "path": "/api/v1/ops/notices/:id/publish",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-216",
  "method": "POST",
  "path": "/api/v1/ops/notices/:id/updates",
  "acts": [
   "A71"
  ],
  "screens": [
   "ops-notices"
  ]
 },
 {
  "id": "EP-217",
  "method": "GET",
  "path": "/api/v1/ops/operations",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-218",
  "method": "DELETE",
  "path": "/api/v1/ops/peeks/:id",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-219",
  "method": "GET",
  "path": "/api/v1/ops/plan_history",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-220",
  "method": "GET",
  "path": "/api/v1/ops/plan_proposals",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-221",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-222",
  "method": "PATCH",
  "path": "/api/v1/ops/plan_proposals/:id",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-223",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/decide",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-224",
  "method": "GET",
  "path": "/api/v1/ops/plan_proposals/:id/impact",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-225",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/return",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-226",
  "method": "POST",
  "path": "/api/v1/ops/plan_proposals/:id/submit",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-227",
  "method": "GET",
  "path": "/api/v1/ops/plans",
  "acts": [
   "A133"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-228",
  "method": "GET",
  "path": "/api/v1/ops/shell",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-229",
  "method": "GET",
  "path": "/api/v1/ops/templates",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-230",
  "method": "GET",
  "path": "/api/v1/ops/templates/:id",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-231",
  "method": "POST",
  "path": "/api/v1/ops/templates/:id/versions",
  "acts": [
   "A128"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-232",
  "method": "POST",
  "path": "/api/v1/ops/work_type_uploads",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-233",
  "method": "GET",
  "path": "/api/v1/ops/work_type_uploads/:id",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-234",
  "method": "GET",
  "path": "/api/v1/ops/work_types",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-235",
  "method": "GET",
  "path": "/api/v1/ops/work_types/:id",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-236",
  "method": "POST",
  "path": "/api/v1/ops/work_types/:id/versions",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-237",
  "method": "POST",
  "path": "/api/v1/ops/work_types/:id/versions/:v/rollback",
  "acts": [
   "A80"
  ],
  "screens": [
   "ops-skills"
  ]
 },
 {
  "id": "EP-238",
  "method": "GET",
  "path": "/api/v1/ops/workspaces",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-239",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-240",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/audit",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-241",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/billing",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-242",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/inquiries",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-243",
  "method": "GET",
  "path": "/api/v1/ops/workspaces/:id/members",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-244",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/members/:mid/resend-verification",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-245",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/notices",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-246",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/peeks",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-247",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/plan",
  "acts": [
   "A64"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-248",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/resume",
  "acts": [
   "A127"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-249",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/:id/stop",
  "acts": [
   "A127"
  ],
  "screens": [
   "ops-tenant"
  ]
 },
 {
  "id": "EP-250",
  "method": "POST",
  "path": "/api/v1/ops/workspaces/export",
  "acts": [
   "A60"
  ],
  "screens": [
   "ops-home"
  ]
 },
 {
  "id": "EP-251",
  "method": "GET",
  "path": "/api/v1/portal",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-252",
  "method": "GET",
  "path": "/api/v1/portal/acceptances/:id",
  "acts": [
   "A126"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-253",
  "method": "POST",
  "path": "/api/v1/portal/acceptances/:id/answer",
  "acts": [
   "A126"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-254",
  "method": "POST",
  "path": "/api/v1/portal/attachments",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-255",
  "method": "GET",
  "path": "/api/v1/portal/notices",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-256",
  "method": "POST",
  "path": "/api/v1/portal/requests",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-257",
  "method": "GET",
  "path": "/api/v1/portal/requests/:id",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-258",
  "method": "POST",
  "path": "/api/v1/portal/requests/:id/messages",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-259",
  "method": "POST",
  "path": "/api/v1/portal/requests/questions",
  "acts": [
   "A124"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-260",
  "method": "GET",
  "path": "/api/v1/portal/tickets/:id",
  "acts": [
   "A125"
  ],
  "screens": [
   "portal"
  ]
 },
 {
  "id": "EP-261",
  "method": "GET",
  "path": "/api/v1/rules",
  "acts": [
   "A121",
   "A131"
  ],
  "screens": [
   "clients",
   "rules"
  ]
 },
 {
  "id": "EP-262",
  "method": "POST",
  "path": "/api/v1/rules",
  "acts": [
   "A121",
   "A131"
  ],
  "screens": [
   "clients",
   "rules"
  ]
 },
 {
  "id": "EP-263",
  "method": "GET",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-264",
  "method": "PATCH",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-265",
  "method": "DELETE",
  "path": "/api/v1/rules/:id",
  "acts": [
   "A131"
  ],
  "screens": [
   "rules"
  ]
 },
 {
  "id": "EP-266",
  "method": "POST",
  "path": "/api/v1/rules/check",
  "acts": [
   "A118",
   "A131"
  ],
  "screens": [
   "masters",
   "rules"
  ]
 },
 {
  "id": "EP-267",
  "method": "GET",
  "path": "/api/v1/saved_views",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-268",
  "method": "POST",
  "path": "/api/v1/saved_views",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-269",
  "method": "PATCH",
  "path": "/api/v1/saved_views/:id",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-270",
  "method": "DELETE",
  "path": "/api/v1/saved_views/:id",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-271",
  "method": "GET",
  "path": "/api/v1/scopes",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-272",
  "method": "POST",
  "path": "/api/v1/scopes",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-273",
  "method": "PATCH",
  "path": "/api/v1/scopes/:id",
  "acts": [
   "A117"
  ],
  "screens": [
   "layers"
  ]
 },
 {
  "id": "EP-274",
  "method": "GET",
  "path": "/api/v1/scopes/:id/overview",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-275",
  "method": "GET",
  "path": "/api/v1/search",
  "acts": [
   "A21"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-276",
  "method": "GET",
  "path": "/api/v1/service-status",
  "acts": [
   "A68"
  ],
  "screens": [
   "notices"
  ]
 },
 {
  "id": "EP-277",
  "method": "GET",
  "path": "/api/v1/shell",
  "acts": [
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-278",
  "method": "PATCH",
  "path": "/api/v1/test_specs/:id",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-279",
  "method": "DELETE",
  "path": "/api/v1/test_specs/:id",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-280",
  "method": "PATCH",
  "path": "/api/v1/ticket_decisions/:id",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-281",
  "method": "PATCH",
  "path": "/api/v1/ticket_handovers/:id",
  "acts": [
   "A110"
  ],
  "screens": [
   "approvals",
   "tickets"
  ]
 },
 {
  "id": "EP-282",
  "method": "POST",
  "path": "/api/v1/ticket_imports",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-283",
  "method": "GET",
  "path": "/api/v1/ticket_imports/:id",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-284",
  "method": "POST",
  "path": "/api/v1/ticket_imports/:id/commit",
  "acts": [
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-285",
  "method": "GET",
  "path": "/api/v1/ticket_kinds",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-286",
  "method": "POST",
  "path": "/api/v1/ticket_kinds/:id/template-from-ticket",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-287",
  "method": "GET",
  "path": "/api/v1/ticket_kinds/template-updates",
  "acts": [
   "A120"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-288",
  "method": "POST",
  "path": "/api/v1/ticket_kinds/template-updates/:id/apply",
  "acts": [
   "A120"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-289",
  "method": "DELETE",
  "path": "/api/v1/ticket_links/:id",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-290",
  "method": "PATCH",
  "path": "/api/v1/ticket_messages/:id",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-291",
  "method": "DELETE",
  "path": "/api/v1/ticket_messages/:id",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-292",
  "method": "POST",
  "path": "/api/v1/ticket_messages/:id/star",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-293",
  "method": "GET",
  "path": "/api/v1/ticket_stages",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-294",
  "method": "GET",
  "path": "/api/v1/tickets",
  "acts": [
   "A113",
   "A58"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-295",
  "method": "POST",
  "path": "/api/v1/tickets",
  "acts": [
   "A129",
   "A98",
   "A99"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-296",
  "method": "GET",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-297",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A103",
   "A113",
   "A115",
   "A17"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-298",
  "method": "DELETE",
  "path": "/api/v1/tickets/:id",
  "acts": [
   "A116"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-299",
  "method": "POST",
  "path": "/api/v1/tickets/:id/acceptances",
  "acts": [
   "A123"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-300",
  "method": "GET",
  "path": "/api/v1/tickets/:id/agent-session",
  "acts": [
   "A20"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-301",
  "method": "POST",
  "path": "/api/v1/tickets/:id/agent-session/apply",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-302",
  "method": "POST",
  "path": "/api/v1/tickets/:id/agent-session/messages",
  "acts": [
   "A20",
   "A91"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-303",
  "method": "GET",
  "path": "/api/v1/tickets/:id/artifacts",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-304",
  "method": "POST",
  "path": "/api/v1/tickets/:id/attachments",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-305",
  "method": "GET",
  "path": "/api/v1/tickets/:id/checks",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-306",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id/client-share",
  "acts": [
   "A123"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-307",
  "method": "POST",
  "path": "/api/v1/tickets/:id/complete",
  "acts": [
   "A106"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-308",
  "method": "GET",
  "path": "/api/v1/tickets/:id/decisions",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-309",
  "method": "POST",
  "path": "/api/v1/tickets/:id/decisions",
  "acts": [
   "A108"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-310",
  "method": "POST",
  "path": "/api/v1/tickets/:id/delegate",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-311",
  "method": "GET",
  "path": "/api/v1/tickets/:id/delete-preview",
  "acts": [
   "A116"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-312",
  "method": "POST",
  "path": "/api/v1/tickets/:id/dry-run",
  "acts": [
   "A105"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-313",
  "method": "POST",
  "path": "/api/v1/tickets/:id/handovers",
  "acts": [
   "A111",
   "A112",
   "A48",
   "A51"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-314",
  "method": "GET",
  "path": "/api/v1/tickets/:id/kind-change-preview",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-315",
  "method": "GET",
  "path": "/api/v1/tickets/:id/links",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-316",
  "method": "POST",
  "path": "/api/v1/tickets/:id/links",
  "acts": [
   "A103"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-317",
  "method": "POST",
  "path": "/api/v1/tickets/:id/messages",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-318",
  "method": "GET",
  "path": "/api/v1/tickets/:id/references",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-319",
  "method": "POST",
  "path": "/api/v1/tickets/:id/restore",
  "acts": [
   "A116"
  ],
  "screens": [
   "audit",
   "tickets"
  ]
 },
 {
  "id": "EP-320",
  "method": "GET",
  "path": "/api/v1/tickets/:id/runs",
  "acts": [
   "A104"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-321",
  "method": "PATCH",
  "path": "/api/v1/tickets/:id/sections/:key",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-322",
  "method": "GET",
  "path": "/api/v1/tickets/:id/test-specs",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-323",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-324",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs/lint",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-325",
  "method": "POST",
  "path": "/api/v1/tickets/:id/test-specs/suggest",
  "acts": [
   "A102"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-326",
  "method": "GET",
  "path": "/api/v1/tickets/:id/timeline",
  "acts": [
   "A107"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-327",
  "method": "GET",
  "path": "/api/v1/tickets/:id/versions",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-328",
  "method": "POST",
  "path": "/api/v1/tickets/:id/versions/:v/restore",
  "acts": [
   "A101"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-329",
  "method": "GET",
  "path": "/api/v1/tickets/:id/work-type-candidates",
  "acts": [
   "A130"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-330",
  "method": "POST",
  "path": "/api/v1/tickets/bulk",
  "acts": [
   "A103",
   "A113"
  ],
  "screens": [
   "tickets"
  ]
 },
 {
  "id": "EP-331",
  "method": "GET",
  "path": "/api/v1/work_types",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-332",
  "method": "POST",
  "path": "/api/v1/work_types",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-333",
  "method": "GET",
  "path": "/api/v1/work_types/:id",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-334",
  "method": "POST",
  "path": "/api/v1/work_types/:id/copy",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-335",
  "method": "PATCH",
  "path": "/api/v1/work_types/:id/draft",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-336",
  "method": "POST",
  "path": "/api/v1/work_types/:id/release",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-337",
  "method": "POST",
  "path": "/api/v1/work_types/:id/spread-requests",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-338",
  "method": "POST",
  "path": "/api/v1/work_types/:id/try",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-339",
  "method": "GET",
  "path": "/api/v1/work_types/:id/versions",
  "acts": [
   "A119"
  ],
  "screens": [
   "work-types"
  ]
 },
 {
  "id": "EP-340",
  "method": "GET",
  "path": "/api/v1/workspace",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-341",
  "method": "PATCH",
  "path": "/api/v1/workspace",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-342",
  "method": "GET",
  "path": "/api/v1/workspace/billing",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-343",
  "method": "PATCH",
  "path": "/api/v1/workspace/billing-contact",
  "acts": [
   "A69"
  ],
  "screens": [
   "billing"
  ]
 },
 {
  "id": "EP-344",
  "method": "POST",
  "path": "/api/v1/workspace/deletion",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-345",
  "method": "DELETE",
  "path": "/api/v1/workspace/deletion",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-346",
  "method": "POST",
  "path": "/api/v1/workspace/escalation-rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-347",
  "method": "PATCH",
  "path": "/api/v1/workspace/escalation-rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-348",
  "method": "DELETE",
  "path": "/api/v1/workspace/escalation-rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-349",
  "method": "POST",
  "path": "/api/v1/workspace/escalation-rules/preview",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-350",
  "method": "POST",
  "path": "/api/v1/workspace/logo",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-351",
  "method": "GET",
  "path": "/api/v1/workspace/members",
  "acts": [
   "A36"
  ],
  "screens": [
   "members"
  ]
 },
 {
  "id": "EP-352",
  "method": "PATCH",
  "path": "/api/v1/workspace/permissions",
  "acts": [
   "A75"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-353",
  "method": "POST",
  "path": "/api/v1/workspace/plan",
  "acts": [
   "A69"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-354",
  "method": "GET",
  "path": "/api/v1/workspace/plans",
  "acts": [
   "A69"
  ],
  "screens": [
   "company-settings"
  ]
 },
 {
  "id": "EP-355",
  "method": "GET",
  "path": "/api/v1/workspace/rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-356",
  "method": "POST",
  "path": "/api/v1/workspace/rules",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-357",
  "method": "PATCH",
  "path": "/api/v1/workspace/rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-358",
  "method": "DELETE",
  "path": "/api/v1/workspace/rules/:id",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-359",
  "method": "GET",
  "path": "/api/v1/workspace/ticket-shape",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-360",
  "method": "PATCH",
  "path": "/api/v1/workspace/ticket-shape",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 },
 {
  "id": "EP-361",
  "method": "POST",
  "path": "/api/v1/workspace/ticket-shape/preview",
  "acts": [
   "A118"
  ],
  "screens": [
   "masters"
  ]
 }
] as const;

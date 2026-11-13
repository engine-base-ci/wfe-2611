// 関門 C2（永続化）の置き場。実体（repository・接続プール・RLS の SET LOCAL）は T-F-02／T-F-03。
// ここでは migration の並びと、テナント文脈の名前だけを定める。
export const TENANT_SETTING = "app.tenant_id" as const;
export const USER_SETTING = "app.user_id" as const;

/** 適用する migration の順（ファイル名の 4 桁が順序。飛び番・重複は起動時に落とす）。 */
export const MIGRATIONS = [
  "0001_foundation.sql",
  "0002_access_control.sql",
  "0003_audit.sql",
  "0004_sessions.sql",
  "0005_auth_flows.sql",
  "0006_error_events.sql",
  "0007_s01.sql",
  "0008_s02.sql",
  "0009_s03.sql",
  "0010_s04.sql",
  "0011_s05.sql",
  "0012_s06.sql",
  "0013_s10.sql",
  "0014_s11.sql",
  "0015_s12.sql",
  "0016_s13.sql",
  "0017_s14.sql",
  "0018_ops_write.sql",
  "0019_s15.sql",
  "0020_signup.sql",
  "0021_owner_role.sql",
  "0022_pending_signup.sql",
  "0023_pending_consumed.sql",
  "0024_setup_progress.sql",
  "0025_bridge_dev_claim.sql",
  "0026_bridge_claim.sql",
  "0027_bridge_jobs.sql",
  "0028_agent_say.sql",
  "0029_bridge_claim_session.sql",
  "0030_agent_enqueue_guard.sql",
  "0031_agent_open_fix.sql",
  "0032_agent_state.sql",
  "0033_agent_new_conversation.sql",
  "0034_bridge_one_row_per_device.sql",
  "0035_bridge_job_events.sql",
  "0036_bridge_session_alive.sql",
  "0037_bridge_poll.sql",
  "0038_bridge_work_record.sql",
  "0039_agent_context.sql",
  "0040_chat_memory.sql",
  "0041_agent_chat.sql",
  "0042_agent_default_mode.sql",
  "0043_memory_digest.sql",
  "0044_steer_queue.sql",
  "0045_artifacts.sql",
  "0046_bridge_blocked.sql",
  "0047_draft_credentials.sql",
  "0048_answer_note.sql",
  "0049_agent_tools.sql",
  "0050_agent_lane.sql",
  "0051_bridge_orphans.sql",
  "0052_answer_carry.sql",
  "0053_transcript_mirror.sql",
  "0054_agent_notify.sql",
  "0055_entry_join.sql",
  "0056_bridge_notice.sql",
  "0057_bridge_browser.sql",
  "0058_cli_model.sql",
  "0059_auth_boundary.sql",
  "0060_reset_revokes.sql",
  "0061_search_normalize.sql",
  "0062_search_norm_dash.sql",
  "0063_approval_once.sql",
  "0064_bridge_credential.sql",
  "0065_login_check.sql",
  "0066_two_factor.sql",
  "0067_two_factor_notice.sql",
  "0068_artifact_from_job.sql",
  "0069_testrun.sql",
  "0070_golive.sql",
  "0071_tickets.sql",
  "0072_ticket_around.sql",
  "0073_knowledge.sql",
  "0074_clients.sql",
  "0075_workspace_people.sql",
  "0076_clone_ops.sql",
  "0077_approvals_clone.sql",
  "0078_people_tenant_ops.sql",
  "0079_contract_tables.sql",
  "0080_permission_bundles.sql",
  "0081_step_up.sql",
  "0082_row_words.sql",
  "0083_session_watch.sql",
  "0084_private_rows.sql",
  "0085_signup_consent.sql",
  "0086_security_event_opening.sql",
  "0087_pending_replaced_tokens.sql",
  "0088_terms_consent.sql",
  "0089_bridge_pairing_codes.sql",
  "0090_ticket_create.sql",
  "0091_free_text_limits.sql",
  "0092_ticket_delegate.sql",
  "0093_free_text_limits_2.sql",
  "0094_bridge_code_new_lock.sql",
  "0095_approve_queue.sql",
  "0096_approve_decide.sql",
  "0097_approve_return.sql",
  "0098_approve_execute_end.sql",
  "0099_bridge_take_guard.sql",
] as const;

/** migration 名の並びを検査する。重複・順序違い・4 桁でない名前があれば理由を返す。 */
export function checkMigrationOrder(names: readonly string[]): { ok: true } | { ok: false; reason: string } {
  const seen = new Set<number>();
  let last = 0;
  for (const name of names) {
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
    if (!m) return { ok: false, reason: `名前の形が違う: ${name}` };
    const n = Number(m[1]);
    if (seen.has(n)) return { ok: false, reason: `番号が重複: ${name}` };
    if (n !== last + 1) return { ok: false, reason: `番号が飛んでいる: ${name}（前は ${last}）` };
    seen.add(n);
    last = n;
  }
  return { ok: true };
}

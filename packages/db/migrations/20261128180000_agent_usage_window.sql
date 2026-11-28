-- 使っている量の窓（agent_usage）は、窓の名前（window_id）が無い行を読まない（統合の枝・契約 fuzz G36 の ST101・直しの担当 XC）。
--   列 window_id は null を許す作り（0040_chat_memory.sql）。本物の書き込み（PC の報告・0041 以降）はいつも窓の名前を入れるが、
--   名前の無い行が 1 つでもあると jsonb_object_agg が 22023（field name must not be null）で落ち、会話を読む口（getConversation・
--   agent_state を通る口）が 503 になる。名前の無い行は窓として意味を持たないので、集めるときに飛ばす。中身は 0041 の版に 1 行足しただけ
create or replace function app.agent_usage(p_member uuid)
returns jsonb
language sql security definer set search_path = public, app as $$
  select coalesce(jsonb_object_agg(u.window_id, jsonb_build_object('utilization', u.utilization, 'resets_at', u.resets_at, 'observed_at', u.observed_at)), '{}'::jsonb)
    from agent_usage_snapshots u where u.member_id = p_member and u.deleted_at is null and u.window_id is not null
$$;

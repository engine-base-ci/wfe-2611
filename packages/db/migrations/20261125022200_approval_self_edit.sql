-- 20261125022200_approval_self_edit 自分で直す（K-742・契約の口 editApproval・関門 C2・D-125.103・D-128.25・D-128.171・D-130.3・D-150.41・D-153.9・D-153.28）
--   列も表も足さない。足すのは関数 1 本（app.approval_self_edit）。
--   承認する人（今の担当者）が成果物の字を直すと、成果物の区画（ticket_sections の artifacts）に新しい版（版 + 1・直した人は押した人・
--   AI が書いた印は付けない）と版の履歴 1 行。承認の行は決めない（承認待ちのまま・decision の self_edit は使わない）。
--   やり取りに 1 行・証跡 1 行（版だけで、字は入れない）。お知らせは書かない（直したのは承認する本人）。AI のチェックは外さない（D-153.9）。
--   守りは app.approval_stop（K-732）と同じ：今のメンバー・今の担当者・チケットを書ける。判定の例外は guard_failed（何も書かない）。
--   字は書いたとおりに残す（切らない・長さの上限は置かない・D-130.3）。空白（全角も）だけの字は text_empty（口が先に 422 にする・2 層目）。
--   security definer・search_path に pg_temp・public から外す（D-128.171）。

create or replace function app.approval_self_edit(p_approval uuid, p_text text, p_version integer) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        v_err text; v_sec uuid; v_ver int; v_old text; v_body jsonb; v_at timestamptz := now();
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じ承認の同時の 2 本（直す × 直す・承認 × 直す）は承認の行で待ち合わせる。後の 1 本は前の 1 本が書いた後の行と版を見る
  select * into a from approvals where id = p_approval and tenant_id = v_tenant for update;
  if a.id is null or a.deleted_at is not null or a.ticket_id is null or a.kind is distinct from 'artifact' then
    return jsonb_build_object('error', 'not_found');   -- 成果物でない承認も見つからない（D-131.11）
  end if;
  select * into t from tickets where id = a.ticket_id and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif t.assignee_member_id is null or t.assignee_member_id <> v_me then v_err := 'not_approver';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
    return jsonb_build_object('error', 'decided');
  end if;
  -- 空・空白だけ（全角の空白 U+3000 も）は直せない（口が先に 422 にする・ここは 2 層目）
  if p_text is null or btrim(p_text, E' \t\r\n\v\f　') = '' then
    return jsonb_build_object('error', 'text_empty');
  end if;

  select s.id, s.version, s.body->>'text' into v_sec, v_ver, v_old
    from ticket_sections s
   where s.ticket_id = t.id and s.tenant_id = v_tenant and s.section_key = 'artifacts' and s.deleted_at is null
   for update;
  if v_sec is null then return jsonb_build_object('error', 'not_found'); end if;
  -- 直す前に読んだ版が今の版でない（先にほかの人が直していた）：今の版を返す
  if p_version is distinct from v_ver then
    return jsonb_build_object('error', 'stale', 'current_version', v_ver);
  end if;
  if v_old is not distinct from p_text then return jsonb_build_object('error', 'unchanged'); end if;

  -- 新しい版（直した人は押した人・AI が書いた印は付けない）。書き方は 0092 の app.bridge_finish_job と同じ形
  v_ver := v_ver + 1;
  v_body := jsonb_build_object('text', p_text);
  update ticket_sections set body = v_body, version = v_ver, updated_by = v_me where id = v_sec;
  insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, created_by)
    values (t.tenant_id, t.id, v_sec, v_ver, v_body, v_me, false, v_me);
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が成果物を直しました（版 ' || v_ver || '）');
  -- 証跡には版だけ（字は入れない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.self_edit', 'approvals', a.id::text, 'C2',
            jsonb_build_object('ticket_id', t.id, 'version', v_ver), v_me);
  return jsonb_build_object('id', a.id, 'ticket_id', t.id, 'version', v_ver, 'edited_at', v_at);
end $$;
revoke all on function app.approval_self_edit(uuid, text, integer) from public;
grant execute on function app.approval_self_edit(uuid, text, integer) to kaname_app;

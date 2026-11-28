-- 20261126002900 誰ができるかを変える（K-829・契約の口 updateWorkspacePermissions・D-154.83・関門 C2）
--   値の置き場 tenants.who_billing・who_delete_workspace（K-827 の migration が足した列・check で admin／admin_manager の 2 値）と、
--   変えた後に効く共通の判定 app.workspace_can(ability)（K-827 が作る・呼ぶたびに列を読む）は、この葉では作らない。
--   app.workspace_permissions_set(p jsonb)：
--     ① 会社ごとの錠 app.admin_lock()（K-800・同じ会社の変更は順に通る・G-16）
--     ② 管理者でなければ 42501（権限を個別に付けた人・会社全体のマネージャーでも変えられない・口が 403 にする）
--     ③ 送られた欄（billing・delete_workspace）だけを見る。値が 2 値の外なら 22023（口が先に 422 で断る・ここは最後の砦）
--     ④ 今の値と違う欄だけを書き、変わった欄があれば記録 workspace.permissions_changed（payload { changes: [{ key, from, to }] }・1 回の保存で 1 行）
--     ⑤ 答えは今の 2 つの値 { permissions: [{ key, value }] }（billing → delete_workspace の順）
--   全部を 1 つの取引で（記録が落ちれば列も戻る）。中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）

create or replace function app.workspace_permissions_set(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  v_billing text;
  v_delete text;
  v_new_billing text;
  v_new_delete text;
  v_changes jsonb := '[]'::jsonb;
begin
  if v_tenant is null or v_user is null then
    raise exception '会社の文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  perform app.admin_lock();
  if not app.is_admin(v_user) then
    raise exception '誰ができるかを変えられるのは管理者だけ' using errcode = 'insufficient_privilege';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '入力の形が正しくない' using errcode = '22023';
  end if;

  select t.who_billing, t.who_delete_workspace into v_billing, v_delete
    from tenants t where t.id = v_tenant for update;
  if not found then
    raise exception '会社が無い' using errcode = 'insufficient_privilege';
  end if;

  v_new_billing := v_billing;
  v_new_delete := v_delete;
  if p ? 'billing' then
    if jsonb_typeof(p -> 'billing') <> 'string' or (p ->> 'billing') not in ('admin', 'admin_manager') then
      raise exception 'billing の値が正しくない' using errcode = '22023';
    end if;
    v_new_billing := p ->> 'billing';
  end if;
  if p ? 'delete_workspace' then
    if jsonb_typeof(p -> 'delete_workspace') <> 'string' or (p ->> 'delete_workspace') not in ('admin', 'admin_manager') then
      raise exception 'delete_workspace の値が正しくない' using errcode = '22023';
    end if;
    v_new_delete := p ->> 'delete_workspace';
  end if;

  if v_new_billing is distinct from v_billing then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('key', 'billing', 'from', v_billing, 'to', v_new_billing));
  end if;
  if v_new_delete is distinct from v_delete then
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('key', 'delete_workspace', 'from', v_delete, 'to', v_new_delete));
  end if;

  if jsonb_array_length(v_changes) > 0 then
    update tenants set who_billing = v_new_billing, who_delete_workspace = v_new_delete where id = v_tenant;
    perform app.record_audit('workspace.permissions_changed', 'workspace', v_tenant::text, null,
      jsonb_build_object('changes', v_changes));
  end if;

  return jsonb_build_object('permissions', jsonb_build_array(
    jsonb_build_object('key', 'billing', 'value', v_new_billing),
    jsonb_build_object('key', 'delete_workspace', 'value', v_new_delete)));
end $$;
revoke all on function app.workspace_permissions_set(jsonb) from public;
grant execute on function app.workspace_permissions_set(jsonb) to kaname_app;

-- 20261126003000 ワークスペースを消す手続き・取り消す（K-830・契約の口 requestWorkspaceDeletion・cancelWorkspaceDeletion・関門 C2）
--   D-128.65・D-154.4・D-154.5・D-154.16・D-154.21・D-154.25・D-154.83
--   新しい表・列は作らない。手続きの時刻は前からの tenants.deletion_requested_at（0078）。押せる人の判定は app.workspace_can（K-827）、
--   会社ごとの錠は app.admin_lock（K-800）。14 日後に会社を消すのは運営（F12）で、この段は消す仕組みを作らない（D-148.9）。
--   手続き中も全員いつもどおり使える（D-154.5）：人・セッション・機能は何も止めない。書き出しは無い（D-154.4）。
--
--   app.workspace_deletion_request(p_confirm)：
--     ① 会社ごとの錠 → ② 押せる人か（app.workspace_can('delete_workspace')・不可なら 403）
--     ③ 打った名前が今の名前と正確に同じか（全角半角・前後の空白・大文字小文字を同じとみなさない・違えば 409・E-WS-030）
--     ④ すでに手続き中なら 409・E-WS-031 → ⑤ 時刻を立てる・ほかの有効な管理者に受け箱の行（inapp だけ）・記録 workspace.deletion_requested
--     答え：{ ok: true, requested_at } ／ { ok: false, status, code }
--   app.workspace_deletion_cancel()：
--     ① 錠 → ② 判定 → ③ 手続き中でなければ 409・E-WS-033 → ④ 始めて 14 日を過ぎていれば 409・E-WS-032
--     → ⑤ 時刻を null に戻す・ほかの有効な管理者に受け箱の行・記録 workspace.deletion_cancelled
--     答え：{ ok: true } ／ { ok: false, status, code }
--   どちらも 1 つの取引（受け箱か記録が落ちれば手続きも戻る）。中に begin／commit を書かない。
--   tenants への書き込みは security definer の関数だけが行う（行の守り packages/db/policies は変えない）

-- ほかの有効な管理者（呼んだ本人・止めた人・外した人・消した人を除く）に受け箱の行を 1 通ずつ。メールは出さない（channel inapp だけ）
create or replace function app.workspace_deletion_notify(p_kind text, p_at timestamptz, p_payload jsonb) returns void
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
begin
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
  select v_tenant, tm.member_id, 'inapp', p_kind, p_payload,
         p_kind || ':' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || ':' || tm.member_id, v_me
    from tenant_memberships tm
    join members m on m.id = tm.member_id and m.tenant_id = tm.tenant_id
   where tm.tenant_id = v_tenant and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null
     and m.deleted_at is null and m.suspended_at is null and tm.member_id <> v_me;
end $$;

create or replace function app.workspace_deletion_request(p_confirm text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_t tenants%rowtype;
  v_at timestamptz := now();
  v_name text;
begin
  if v_tenant is null or v_me is null then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  perform app.admin_lock();
  if not app.workspace_can('delete_workspace') then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  select * into v_t from tenants where id = v_tenant for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  -- 正確に比べる（is distinct from：照合の規則で全角半角・大小を寄せない）
  if p_confirm is null or p_confirm is distinct from v_t.name then
    return jsonb_build_object('ok', false, 'status', 409, 'code', 'E-WS-030');
  end if;
  if v_t.deletion_requested_at is not null then
    return jsonb_build_object('ok', false, 'status', 409, 'code', 'E-WS-031');
  end if;

  update tenants set deletion_requested_at = v_at where id = v_tenant;
  select m.name into v_name from members m where m.id = v_me;
  perform app.workspace_deletion_notify('workspace.deletion_requested', v_at,
    jsonb_build_object('by', jsonb_build_object('id', v_me, 'name', v_name),
                       'delete_at', to_char((v_at + interval '14 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  perform app.record_audit('workspace.deletion_requested', 'workspace', v_tenant::text, 'C2',
    jsonb_build_object('requested_at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  return jsonb_build_object('ok', true,
    'requested_at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create or replace function app.workspace_deletion_cancel() returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_t tenants%rowtype;
  v_at timestamptz := now();
  v_name text;
begin
  if v_tenant is null or v_me is null then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  perform app.admin_lock();
  if not app.workspace_can('delete_workspace') then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  select * into v_t from tenants where id = v_tenant for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  if v_t.deletion_requested_at is null then
    return jsonb_build_object('ok', false, 'status', 409, 'code', 'E-WS-033');
  end if;
  -- 14 日の境（D-154.16）：始めた時刻の 14 日後を過ぎたら取り消せない
  if v_at > v_t.deletion_requested_at + interval '14 days' then
    return jsonb_build_object('ok', false, 'status', 409, 'code', 'E-WS-032');
  end if;

  update tenants set deletion_requested_at = null where id = v_tenant;
  select m.name into v_name from members m where m.id = v_me;
  perform app.workspace_deletion_notify('workspace.deletion_cancelled', v_t.deletion_requested_at,
    jsonb_build_object('by', jsonb_build_object('id', v_me, 'name', v_name)));
  perform app.record_audit('workspace.deletion_cancelled', 'workspace', v_tenant::text, 'C2',
    jsonb_build_object('requested_at', to_char(v_t.deletion_requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                       'days', floor(extract(epoch from (v_at - v_t.deletion_requested_at)) / 86400)::int));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function app.workspace_deletion_notify(text, timestamptz, jsonb) from public;
revoke all on function app.workspace_deletion_request(text) from public;
revoke all on function app.workspace_deletion_cancel() from public;
grant execute on function app.workspace_deletion_request(text) to kaname_app;
grant execute on function app.workspace_deletion_cancel() to kaname_app;

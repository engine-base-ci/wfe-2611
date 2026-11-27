-- 20261128005900 請求先を変える（K-959・契約の口 updateBillingContact・D-156.29・D-156.30・D-125.130）
--   関数 app.billing_contact_set(会社名, 宛名, メール)：会社に 1 つの請求先（tenants.billing_contact・K-958 が作った列）を書く。
--   ⓐ 頭で「会社の中の人で、tenants の billing の能力を持つ」かを確かめる（入口の 2 層目・G-02）
--   ⓑ 会社の行を for update で取る（同時に 2 つ変えたら順に書き、後に書いた方が残る）
--   ⓒ 前の値と同じなら何も書かない（お知らせ・記録を増やさない）
--   ⓓ 書く → ⓔ 変えた欄の名前（company・attn・email の順）
--   ⓕ 管理者全員（所属が admin・active・消していない・人も消していない）に画面のお知らせを 1 行ずつ（inapp・billing.contact_changed）。
--      中身の字（会社名・宛名・メール）は入れない。メールは送らない（D-125.130）。新しいメールへの確かめも送らない（D-156.30）
--   ⓖ 記録（関門 C2・payload は変えた欄の名前だけ）
--   整え（NFKC・前後の空白・メールの小文字）は口がする。ここは受け取った字をそのまま書く

create or replace function app.billing_contact_set(p_company text, p_attn text, p_email text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_prev jsonb;
  v_new jsonb;
  v_fields text[] := array[]::text[];
begin
  if v_tenant is null or not app.member_ok() or not has_permission(v_me, 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select t.billing_contact into v_prev from tenants t where t.id = v_tenant for update;

  v_new := jsonb_build_object('company', p_company, 'attn', p_attn, 'email', p_email);
  if v_prev is not distinct from v_new then
    return jsonb_build_object('data', v_new);
  end if;

  update tenants set billing_contact = v_new where id = v_tenant;

  if v_prev->>'company' is distinct from p_company then v_fields := v_fields || 'company'; end if;
  if v_prev->>'attn' is distinct from p_attn then v_fields := v_fields || 'attn'; end if;
  if v_prev->>'email' is distinct from p_email then v_fields := v_fields || 'email'; end if;

  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, sent_at, created_by)
  select v_tenant, tm.member_id, 'inapp', 'billing.contact_changed', '{}'::jsonb, now(), v_me
    from tenant_memberships tm
    join members m on m.id = tm.member_id and m.deleted_at is null
   where tm.tenant_id = v_tenant and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null;

  perform app.record_audit('billing.contact_update', 'tenants', v_tenant::text, 'C2',
                           jsonb_build_object('fields', to_jsonb(v_fields)));

  return jsonb_build_object('data', v_new);
end $$;
revoke all on function app.billing_contact_set(text, text, text) from public;
grant execute on function app.billing_contact_set(text, text, text) to kaname_app;

-- 0064 Bridge が「いま動いている仕事」のために資格情報 1 件を受け取る（T-B-05・D-102.2・D-017.1）。
--   判定は関数の中で：Bridge の鍵（sessions）が生きている／その人の仕事が動いている（running・asking）／資格情報が本人のもの。
--   返すのは参照（vault_ref）まで。中身を解くのは関門 C8（SecretsGateway）で、AI の文脈は拒む
create or replace function app.bridge_credential(p_session uuid, p_job uuid, p_credential uuid)
returns table (tenant_id uuid, member_id uuid, vault_ref text, service_name text, revoked boolean, job_ok boolean)
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_tenant uuid;
begin
  select s.member_id, s.tenant_id into v_member, v_tenant
    from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return; end if;
  return query
    select c.tenant_id, c.owner_member_id, c.vault_ref, c.service_name, (c.revoked_at is not null) as revoked,
           exists (select 1 from bridge_jobs j where j.id = p_job and j.member_id = v_member and j.state_id in ('running', 'asking') and j.deleted_at is null) as job_ok
      from credentials c
     where c.id = p_credential and c.tenant_id = v_tenant and c.owner_member_id = v_member and c.deleted_at is null;
end $$;
grant execute on function app.bridge_credential(uuid, uuid, uuid) to kaname_app;

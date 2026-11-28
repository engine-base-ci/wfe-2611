-- 20261119120800 預けたログイン情報のまわりの、会社をまたぐ結びつきを DB で止める（K-348・関門 C2・D-017・D-076.5・D-108・D-128.57）
--   調べ（.ticket-flow/research/security-credentials-2026-11-20.md の穴 1）：app.credential_service（0047）は台帳 service_registry
--   （会社ごとの表）を会社の条件なしで引き、credentials.service_id は外部キーだけで会社の一致を見なかった。
--   結ばれると、確かめの仕事を積む関数（0065）・本番に切り替える判定（0070）などが、別の会社の台帳の可否を読む。
--   結んでよい台帳の行は「その会社の行と、運営の行」（運営の行を先に・ほかの会社の行は不可・代表の答え answer=c544910246a6）。
--   台帳の可否は全社に効く運営の資産（D-076.5）なので、会社の行で運営の禁止を上書きできないように運営の行を先に返す。
--
-- ② 関数：会社の文脈（app.tenant_id()）の行と運営の行だけを引く。文脈が無ければ運営の行だけ。運営の行を先に、その中で古い順
-- ③ 前から在る違反の行（別の会社の台帳の行に結んだ credentials）は、結びつきだけを外す（行は消さない・名前と宛先の列は残る）
-- ④ 引き金：credentials の service_id・tenant_id を書くたびに、結ぶ先が同じ会社か運営の台帳の行かを見る（DB の最後の砦）。
--      台帳に見つからない id は外部キー（23503）に任せる（行が見えない役のときに毎回 23514 にしない）
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする

-- ② 台帳のサービスを引く関数（会社と運営の行だけ）
create or replace function app.credential_service(p_name text, p_domain text) returns uuid
language sql stable security definer set search_path = public, app as $$
  select s.id from service_registry s
   where s.deleted_at is null
     and s.tenant_id in (app.tenant_id(), app.ops_tenant_id())
     and ((nullif(trim(p_domain), '') is not null and lower(regexp_replace(regexp_replace(coalesce(s.domain, ''), '^[a-z]+://', '', 'i'), '^www\.|/.*$', '', 'g')) = lower(trim(p_domain)))
          or (nullif(trim(p_name), '') is not null and lower(s.name) = lower(trim(p_name))))
   order by (s.tenant_id = app.ops_tenant_id()) desc, s.created_at limit 1
$$;
grant execute on function app.credential_service(text, text) to kaname_app;

-- ③ 前から在る違反の行の結びつきを外す
update credentials c set service_id = null
 where c.service_id is not null
   and not exists (select 1 from service_registry s
                    where s.id = c.service_id and s.tenant_id in (c.tenant_id, app.ops_tenant_id()));

-- ④ 結ぶ先の会社の一致を見る引き金
create or replace function app.credentials_service_tenant_guard() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_owner uuid;
begin
  if new.service_id is null then
    return new;
  end if;
  select s.tenant_id into v_owner from service_registry s where s.id = new.service_id;
  if not found then
    return new; -- 台帳に無い id は外部キー（23503）に任せる
  end if;
  if v_owner is distinct from new.tenant_id and v_owner is distinct from app.ops_tenant_id() then
    raise exception using errcode = '23514', message = 'credentials.service_id は、同じ会社か運営の台帳のサービスにだけ結べます';
  end if;
  return new;
end
$$;

drop trigger if exists credentials_service_tenant on credentials;
create trigger credentials_service_tenant before insert or update of service_id, tenant_id on credentials
  for each row execute function app.credentials_service_tenant_guard();

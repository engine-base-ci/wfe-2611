-- 20261128041800 上げる先・頼みの帯の「承認する人」「断った人」の名前を読む（K-687・関門 C2・読むだけ・統合の枝）
--   上げる小窓の上げる先（page-parts/raise-to.ts）と承認待ちの帯（page-parts/request.ts）は、app.kn_approvers_of の人の表示名を
--   要求の文脈で members から直に読んでいた。人の行の守り（members_tenant_read）は見えるグループ（visible_scopes）の人だけを通すので、
--   グループのマネージャーが会社の棚へ上げるとき、会社のいちばん上にいる管理者の名前が見えず空になっていた（K687-API-015）。
--   先（p_scope）が今の人の会社のグループか会社のいちばん上のときだけ、承認する人から p_except を除いた表示名（コードポイント順）を返す。
--   返すのは表示名だけ。security definer・public から外し kaname_app だけ。もう 1 度当てても壊れない。
create or replace function app.kn_approver_names(p_scope uuid, p_except uuid) returns text[]
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(array_agg(m.display_name order by m.display_name collate "C", m.id), '{}')
    from members m
   where m.tenant_id = app.tenant_id() and m.deleted_at is null
     and exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = app.tenant_id() and s.deleted_at is null)
     and m.id in (select app.kn_approvers_of(p_scope))
     and m.id is distinct from p_except
$$;
revoke all on function app.kn_approver_names(uuid, uuid) from public;
grant execute on function app.kn_approver_names(uuid, uuid) to kaname_app;

-- 断った人の表示名（断りの帯・page-parts/request.ts）。同じ理由で members を直に読むと、会社の管理者が断ったときに名前が空になる。
--   今の人の会社の頼みの、決めた人の表示名だけを返す（頼みそのものが見えるかは呼ぶ側の問い合わせ＝頼みの行の守りが決める）
create or replace function app.kn_request_decider_name(p_request uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.display_name
    from knowledge_requests r join members m on m.id = r.decided_by and m.tenant_id = r.tenant_id
   where r.id = p_request and r.tenant_id = app.tenant_id()
$$;
revoke all on function app.kn_request_decider_name(uuid) from public;
grant execute on function app.kn_request_decider_name(uuid) to kaname_app;

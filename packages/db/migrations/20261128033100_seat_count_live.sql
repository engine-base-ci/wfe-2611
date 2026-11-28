-- 20261128033100_seat_count_live 席（人数）の数え方 app.tenant_seat_count を「同じ会社の所属が消されておらず、状態が left でない人」だけにする
--   （K-1158・K-961 の 1 か所の置き換え・関門 C2・D-156.36・D-156.51・D-128.96・PM の決め 2026-11-25 案 A）
--   数える人：その会社の members で kind human・deleted_at is null の人のうち、
--     ・同じ会社の所属の行（tenant_memberships・会社と人で 1 つ＝0075 の unique）がある人は、その行が deleted_at is null・status <> 'left'・
--       role <> 'requester'（ゲストは数えない・D-156.51）のときだけ
--     ・所属の行が無い人は今のまま数える
--   invited・suspended は代表の答え待ちで今のまま数える（保留）。答えが出たら、この 1 か所だけを直す。
--   数える所（運営の一覧と 1 社・1 社の請求・値段を変える案・招く上限・顧客のプラン）はどれもこの関数を呼ぶので、呼ぶ側は変えない。
--   権限は今のまま（security definer・public から外す・kaname_app に渡さない）
create or replace function app.tenant_seat_count(p_tenant uuid) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(*)::int from members m
   where m.tenant_id = p_tenant and m.kind_id = 'human' and m.deleted_at is null
     and (
       not exists (select 1 from tenant_memberships tm
                    where tm.tenant_id = p_tenant and tm.member_id = m.id)
       or exists (select 1 from tenant_memberships tm
                   where tm.tenant_id = p_tenant and tm.member_id = m.id
                     and tm.deleted_at is null and tm.status <> 'left' and tm.role <> 'requester')
     )
$$;
revoke all on function app.tenant_seat_count(uuid) from public;

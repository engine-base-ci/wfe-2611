-- 20261128032300 招く・人を足すときに、プランの人数（席）の上限で止める（K-1103・D-156.51・D-156.36・D-156.58・D-128.65・D-148.22）
--   新しい表・列は作らない。関数を 1 つ足す（書く取引の中で止める・関門 C2）。
--   招く口（K-419 の app.create_invitations の前）とリンクの口（K-421 の app.create_invitation_link の前）が、招待を書く同じ取引の頭で呼ぶ。
--   表の引き金にしない訳：試験の道具の createInvitation（本番の口を通らない）で招待を直に入れる前からの試験が多く、引き金だと無関係の試験が赤になる。
--
-- app.seat_check(p_adding, p_replacing)：
--   ⓐ 会社＝app.tenant_id()（引数で会社を受けない＝ほかの会社を数えられない）。p_adding が 0 以下なら何もしない
--   ⓑ 会社の行を for update で取る（同時の 2 本は、後の方が前の招待を数える）
--   ⓒ 上限＝いまのプラン（K-961 の app.tenant_plan_id・下げる予定の間は今のプラン）の limits.members。プランの行・値が無ければ止めない（上限なし）
--   ⓓ 人数＝app.tenant_seat_count（K-961・社内の人だけ・ゲストは数えない＝D-156.51）
--      招待中＝その会社の招待で、使っていない・取り消していない・消していない・期限の内・役割がゲスト（requester）でない物。
--      今回送り直す宛て（p_replacing・小文字で比べる）の招待中は数えない（K-419 は同じ宛ての招待中を取り消して作り直す）
--   ⓔ 人数＋招待中＋p_adding が上限を超えたら P0001・hint E-PLAN-003・detail「人数,招待中,上限」（数だけ・名前やメールを載せない）

create or replace function app.seat_check(p_adding integer, p_replacing text[] default '{}') returns void
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_limit integer;
  v_members integer;
  v_invited integer;
  v_replacing text[];
begin
  if v_tenant is null or p_adding is null or p_adding <= 0 then
    return;
  end if;
  perform 1 from tenants where id = v_tenant for update;
  select (p.limits->>'members')::int into v_limit from plans p where p.id = app.tenant_plan_id(v_tenant);
  if v_limit is null then
    return;
  end if;
  v_members := app.tenant_seat_count(v_tenant);
  select coalesce(array_agg(lower(x)), '{}') into v_replacing from unnest(coalesce(p_replacing, '{}')) as x;
  select count(*)::int into v_invited from invitations i
   where i.tenant_id = v_tenant
     and i.accepted_member_id is null
     and i.revoked_at is null
     and i.deleted_at is null
     and i.expires_at > now()
     and i.role_id is distinct from 'requester'
     and (i.email is null or lower(i.email) <> all (v_replacing));
  if v_members + v_invited + p_adding > v_limit then
    raise exception using errcode = 'P0001', message = 'seat_limit', hint = 'E-PLAN-003',
      detail = v_members || ',' || v_invited || ',' || v_limit;
  end if;
end;
$$;

revoke all on function app.seat_check(integer, text[]) from public;
grant execute on function app.seat_check(integer, text[]) to kaname_app;

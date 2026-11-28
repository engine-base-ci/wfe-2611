-- 20261128014900_ops_team_edit 運営の人のできることを変える・外す（K-1009・関門 C2・D-156.22・D-156.34・D-128.70・D-156.3）
--   ① app.ops_member_caps(members.id, caps)：ops_people を持つ運営の人だけ。できることを丸ごと置き換える
--   ② app.ops_member_remove(members.id)：ops_people を持つ運営の人だけ。1 つの取引で
--      外した印（revoked_at）・パスキーを消す・使っていないリンクを使えなくする・生きているセッションを閉じる・担当の問い合わせを空にする・記録
--   どちらも：対象は運営の会社の生きている運営の人だけ（ほかは no_data_found＝口が 404）。自分は {"error":"self"}。
--     「運営の人」「値段を決める」の最後の 1 人になる変更は {"error":"last","cap":…}。最後の 1 人かは K-985 の app.ops_member_row の
--     locked_caps（1 か所）で見る。数える前に、変える・外すを錠で 1 本ずつにし、その印を持つ生きている運営の人の行を for update で取る
--     （同時に 2 人を外して 0 になるのを止める）
--   どれも security definer・search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）。
--   kaname_auth.passkey は関数の持ち主の権限で消す（kaname_app に触らせない）

-- ⓪ 2 つが頭で使う取り方（変える・外すを錠で 1 本ずつ → 印を持つ行を for update → 対象を for update）
create or replace function app.ops_member_lock(p_member uuid, out o_ops_id uuid, out o_caps text[], out o_member_id uuid,
                                               out o_name text, out o_auth_user_id text)
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
begin
  perform app.ops_require('ops_people');
  -- 変える・外すを 1 本ずつにする（取引の間だけ。印を持つ行の取り合いで互いに待ち合わない）
  perform pg_advisory_xact_lock(hashtext('kaname.ops_member_edit'));
  -- 最後の 1 人の印を持つ生きている運営の人の行を先に取る（数える間に外されない）
  perform 1 from ops_members o
   where o.tenant_id = app.ops_tenant_id() and o.revoked_at is null and o.deleted_at is null
     and o.caps && array['ops_people', 'plan_decide']::text[]
   order by o.id
     for update;
  select o.id, o.caps, m.id, m.display_name, m.auth_user_id
    into o_ops_id, o_caps, o_member_id, o_name, o_auth_user_id
    from ops_members o
    join members m on m.id = o.member_id
   where m.id = p_member and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
     and o.tenant_id = app.ops_tenant_id() and o.revoked_at is null and o.deleted_at is null
   order by o.created_at
   limit 1
     for update of o;
  if not found then
    raise exception '運営の人が無い' using errcode = 'no_data_found';
  end if;
end $$;
revoke all on function app.ops_member_lock(uuid) from public;
grant execute on function app.ops_member_lock(uuid) to kaname_app;

create or replace function app.ops_member_caps(p_member uuid, p_caps text[]) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v record; v_row jsonb; v_cap text;
begin
  perform app.ops_require('ops_people');
  if coalesce(cardinality(p_caps), 0) = 0 then
    raise exception 'できることが空' using errcode = 'invalid_parameter_value';
  end if;
  select * into v from app.ops_member_lock(p_member);
  if v.o_member_id = app.user_id() then
    return jsonb_build_object('error', 'self');
  end if;
  v_row := app.ops_member_row(v.o_ops_id);
  -- 同じ（並びは問わない）なら何もしない（記録も書かない）
  if (select coalesce(array_agg(distinct c order by c), '{}') from unnest(v.o_caps) c)
     = (select coalesce(array_agg(distinct c order by c), '{}') from unnest(p_caps) c) then
    return jsonb_build_object('data', v_row);
  end if;
  select c into v_cap from jsonb_array_elements_text(v_row -> 'locked_caps') with ordinality as k(c, i)
   where not (c = any(p_caps)) order by i limit 1;
  if v_cap is not null then
    return jsonb_build_object('error', 'last', 'cap', v_cap);
  end if;
  update ops_members set caps = p_caps where id = v.o_ops_id;
  perform app.record_ops_audit(app.ops_tenant_id(), 'ops_member.caps', 'ops_members', v.o_ops_id::text, null,
                               jsonb_build_object('target_label', v.o_name, 'before', v_row -> 'caps',
                                                  'after', app.ops_member_row(v.o_ops_id) -> 'caps'));
  return jsonb_build_object('data', app.ops_member_row(v.o_ops_id));
end $$;
revoke all on function app.ops_member_caps(uuid, text[]) from public;
grant execute on function app.ops_member_caps(uuid, text[]) to kaname_app;

create or replace function app.ops_member_remove(p_member uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v record; v_cap text; v_at timestamptz := now(); v_released integer;
begin
  perform app.ops_require('ops_people');
  select * into v from app.ops_member_lock(p_member);
  if v.o_member_id = app.user_id() then
    return jsonb_build_object('error', 'self');
  end if;
  select c into v_cap from jsonb_array_elements_text(app.ops_member_row(v.o_ops_id) -> 'locked_caps') with ordinality as k(c, i)
   order by i limit 1;
  if v_cap is not null then
    return jsonb_build_object('error', 'last', 'cap', v_cap);
  end if;
  update ops_members set revoked_at = v_at where id = v.o_ops_id;
  delete from kaname_auth.passkey where "userId" = v.o_auth_user_id;
  update ops_setup_links set used_at = v_at where ops_member_id = v.o_ops_id and used_at is null;
  update sessions set revoked_at = v_at where member_id = v.o_member_id and revoked_at is null;
  -- その人が担当の問い合わせは担当なしに戻す（どの会社の物でも・受信箱に取り残さない）
  update inquiries set assignee_ops_member_id = null, updated_at = v_at, updated_by = app.user_id()
   where assignee_ops_member_id = v.o_member_id;
  get diagnostics v_released = row_count;
  perform app.record_ops_audit(app.ops_tenant_id(), 'ops_member.remove', 'ops_members', v.o_ops_id::text, null,
                               jsonb_build_object('target_label', v.o_name, 'released_inquiries', v_released));
  return jsonb_build_object('data', jsonb_build_object('member_id', v.o_member_id, 'removed_at', v_at,
                                                       'released_inquiries', v_released));
end $$;
revoke all on function app.ops_member_remove(uuid) from public;
grant execute on function app.ops_member_remove(uuid) to kaname_app;

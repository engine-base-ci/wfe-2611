-- 20261128010600_ops_workspace 運営が 1 社を読む：いまの状態（getOpsWorkspace）とメンバー（listOpsWorkspaceMembers）（K-966・関門 C2・D-156.3・D-156.12・D-156.17・D-156.23・D-156.47・D-156.49・D-156.63・D-156.72・D-155.35・D-125.128）
--   ① app.auth_user_contact(認証の人)：メールと本人確認の印。認証の表（kaname_auth）は業務の接続から読めず、migrate は migrateAuth より先に
--      走るので、0113 の app.login_methods と同じく実行の時に表を引く（表がまだ無ければ null・false）。内部用（kaname_app に渡さない）
--   ② app.ops_workspace(会社)：14 欄（K-1006）。数の決まり（プラン・状態・人数・PC・今月の実行・管理者）は K-963 の app.workspace_facts を
--      読むだけ（同じ数え方を 2 つ書かない）。止まった実行・ファイルの量・最近のこと・止める印・自分の中を見る（理由の字つき）・
--      人数（app.tenant_seat_count・K-961 の 1 か所）・済んでいない問い合わせの数をここで足す
--   ③ app.ops_workspace_members(会社)：8 欄の並び（K-1006）
--   ②③ は頭で app.ops_require（K-947 の型・2 層目）→ app.ops_target（運営の会社・無い・作りかけ・消した会社は P0002 → 404）。
--   読むだけなので運営の記録は書かない（D-128.108 は書く操作だけ）。中身（チケット・会話・問い合わせの内容・預けたログイン情報）は返さない（D-156.3）
--   どの関数も security definer・search_path に pg_temp・public から外す（D-128.171）。日付は日本の暦（Asia/Tokyo）

create or replace function app.auth_user_contact(p_auth_user_id text, out email text, out verified boolean)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  email := null;
  verified := false;
  if p_auth_user_id is null or p_auth_user_id = '' or to_regclass('kaname_auth."user"') is null then
    return;
  end if;
  execute 'select email, coalesce("emailVerified", false) from kaname_auth."user" where id = $1'
    into email, verified using p_auth_user_id;
  verified := coalesce(verified, false);
end $$;
revoke all on function app.auth_user_contact(text) from public;

-- 時刻を答えの字にする（UTC・ミリ秒まで・末尾 Z。画面と試験が Date で読む形）。内部用
create or replace function app.utc_iso_ms(p_at timestamptz) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select to_char(date_trunc('milliseconds', p_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
revoke all on function app.utc_iso_ms(timestamptz) from public;

-- 1 社の 14 欄。最近のことは 4 つの出来事（問い合わせ・請求書・入金・メンバー）の型の字だけ（D-156.47）。新しい順に 5 件まで
create or replace function app.ops_workspace(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_facts jsonb;
  t record;
  v_stop jsonb;
  v_stuck jsonb;
  v_files bigint;
  v_recent jsonb;
  v_peek jsonb;
  v_open integer;
begin
  v_ops := app.ops_require('any');
  perform app.ops_target(p_tenant);

  v_facts := app.workspace_facts(p_tenant);
  select x.stopped_at, x.stop_on, x.stop_reason_key, x.stop_noticed_at into t from tenants x where x.id = p_tenant;

  -- 止める印（D-156.23）：止める日か止めた時刻があれば 4 欄・どちらも無ければ null
  if t.stop_on is not null or t.stopped_at is not null then
    v_stop := jsonb_build_object(
      'reason_key', t.stop_reason_key,
      'stop_on', to_char(t.stop_on, 'YYYY-MM-DD'),
      'stopped_at', app.utc_iso_ms(t.stopped_at),
      'noticed_at', app.utc_iso_ms(t.stop_noticed_at));
  end if;

  -- 止まった実行：直近 7 日と、その前の 7 日（7〜14 日前）。14 日より前は数えない（K-963 の気にかけるの stuck と同じ窓）
  select jsonb_build_object(
           'count_7d', count(*) filter (where r.created_at > now() - interval '7 days')::integer,
           'prev_week', count(*) filter (where r.created_at <= now() - interval '7 days')::integer)
    into v_stuck
    from action_runs r
   where r.tenant_id = p_tenant and r.status_id = 'stopped' and r.deleted_at is null
     and r.created_at > now() - interval '14 days';

  -- ファイルの量：消していないファイルの大きさの合計（上限は持たない・D-156.63）
  select coalesce(sum(a.size), 0)::bigint into v_files
    from attachments a
   where a.tenant_id = p_tenant and a.deleted_at is null;

  -- 最近のこと（D-156.47）：{ at, label, detail }。字は型だけ（問い合わせの内容・チケット・会話は入れない）
  with ev as (
    select i.created_at as at,
           '問い合わせ「' || coalesce(i.title, '') || '」が届いた' as label,
           nullif(concat_ws(' ・ 担当 ', asker.display_name, owner.display_name), '') as detail
      from inquiries i
      left join members asker on asker.id = i.opened_by_member_id
      left join members owner on owner.id = i.assignee_ops_member_id
     where i.tenant_id = p_tenant and i.deleted_at is null
    union all
    select v.issued_at,
           extract(month from coalesce(v.period_start, (v.issued_at at time zone 'Asia/Tokyo')::date))::integer
             || ' 月分の請求書を出した ¥' || to_char(coalesce(v.amount, 0), 'FM999,999,999,999,990'),
           case when v.due_on is null then null else '期限 ' || to_char(v.due_on, 'MM/DD') end
      from invoices v
     where v.tenant_id = p_tenant and v.issued_at is not null and v.deleted_at is null
    union all
    -- 振込名義（payer_name）は入金の葉（K-982）が足す列。行を jsonb にして読み、列がまだ無い DB でも同じ答え（null）にする
    select p.created_at,
           extract(month from coalesce(v.period_start, (p.created_at at time zone 'Asia/Tokyo')::date))::integer
             || ' 月分の入金を記録した',
           nullif(to_jsonb(p) ->> 'payer_name', '')
      from payments p
      left join invoices v on v.id = p.invoice_id
     where p.tenant_id = p_tenant and p.deleted_at is null
    union all
    -- メンバーが増えた：社内の人（ゲスト〔requester〕は人数に数えない・D-156.51）。その時点の人数は、その時刻までに入った今もいる社内の人の数
    select tm.joined_at,
           'メンバーが 1 人増えた（' || (
             select count(*) from tenant_memberships o
              where o.tenant_id = p_tenant and o.deleted_at is null and o.status <> 'left'
                and o.role <> 'requester' and o.joined_at <= tm.joined_at) || ' 人）',
           null::text
      from tenant_memberships tm
     where tm.tenant_id = p_tenant and tm.deleted_at is null and tm.status <> 'left'
       and tm.role <> 'requester' and tm.joined_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('at', app.utc_iso_ms(e.at), 'label', e.label, 'detail', e.detail) order by e.at desc), '[]'::jsonb)
    into v_recent
    from (select * from ev order by at desc limit 5) e;

  -- 中を見る：自分（この運営の人）が開いた、閉じていない期限内の許可のうち新しい 1 つ。ほかの運営の人の許可は見せない（0078 の開いた本人の柵）
  --   reason は許可の理由の字をそのまま（切らない・詰めない）。理由は開いた本人の答えにだけ入る
  select jsonb_build_object('id', g.id, 'expires_at', app.utc_iso_ms(g.expires_at), 'reason', g.reason) into v_peek
    from support_access_grants g
   where g.tenant_id = p_tenant and g.ops_member_id = v_ops
     and g.closed_at is null and g.revoked_at is null and g.deleted_at is null and g.expires_at > now()
   order by g.created_at desc, g.id desc
   limit 1;

  -- 済んでいない問い合わせの数（タブ「問い合わせ N」）：消していない・済み（done）でない（open・waiting・later）。数だけで題・中身は返さない
  select count(*)::integer into v_open
    from inquiries i
   where i.tenant_id = p_tenant and i.deleted_at is null and i.state <> 'done';

  return jsonb_build_object(
    'id', p_tenant,
    'name', v_facts ->> 'name',
    'plan_name', v_facts -> 'plan_name',
    'state', v_facts -> 'state',
    'stop', v_stop,
    'admin', jsonb_build_object('name', v_facts -> 'admin_name'),
    'members', jsonb_build_object('count', app.tenant_seat_count(p_tenant)),
    'inquiries', jsonb_build_object('open', v_open),
    'pc', v_facts -> 'pc',
    'runs_month', jsonb_build_object('count', coalesce((v_facts ->> 'runs_month')::integer, 0)),
    'stuck_runs', v_stuck,
    'files', jsonb_build_object('bytes', v_files),
    'recent', v_recent,
    'peek', v_peek);
end $$;
revoke all on function app.ops_workspace(uuid) from public;
grant execute on function app.ops_workspace(uuid) to kaname_app;

-- 1 社のメンバーの 8 欄。抜けた人は出さない。並びは役割（管理者 → マネージャー → メンバー → 閲覧のみ → ゲスト）→ 名前。
--   役割 requester の字は「ゲスト」（D-155.35・「依頼する側」は画面から消した）
create or replace function app.ops_workspace_members(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_rows jsonb;
begin
  perform app.ops_require('inquiry');
  perform app.ops_target(p_tenant);

  with ppl as (
    select m.id, m.display_name, tm.role,
           coalesce(tm.auth_user_id, m.auth_user_id) as auth_user_id,
           case tm.role when 'admin' then 1 when 'manager' then 2 when 'member' then 3 when 'viewer' then 4 else 5 end as role_order
      from tenant_memberships tm
      join members m on m.id = tm.member_id and m.tenant_id = p_tenant and m.deleted_at is null
     where tm.tenant_id = p_tenant and tm.status <> 'left' and tm.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', p.id,
           'name', p.display_name,
           'email', c.email,
           'role_label', case p.role when 'admin' then '管理者' when 'manager' then 'マネージャー'
                                     when 'member' then 'メンバー' when 'viewer' then '閲覧のみ' else 'ゲスト' end,
           'last_seen_at', (select app.utc_iso_ms(max(s.last_seen_at)) from sessions s
                             where s.tenant_id = p_tenant and s.member_id = p.id and s.kind_id = 'web'),
           'pc', case
                   when p.role in ('viewer', 'requester') then 'none'
                   when exists (select 1 from sessions s
                                 where s.tenant_id = p_tenant and s.member_id = p.id and s.kind_id = 'bridge'
                                   and s.revoked_at is null and s.alive_at is not null
                                   and s.last_seen_at > now() - interval '90 seconds') then 'connected'
                   when exists (select 1 from sessions s
                                 where s.tenant_id = p_tenant and s.member_id = p.id and s.kind_id = 'bridge'
                                   and s.revoked_at is null) then 'paired'
                   else 'never' end,
           'login_methods', (select to_jsonb(array_remove(array[
                                       case when l.passkeys > 0 then 'passkey' end,
                                       case when l.has_password then 'password' end,
                                       case when l.two_factor then 'two_factor' end], null))
                               from app.login_methods(p.auth_user_id) l),
           'verified', coalesce(c.verified, false))
         order by p.role_order, p.display_name, p.id), '[]'::jsonb)
    into v_rows
    from ppl p
    cross join lateral app.auth_user_contact(p.auth_user_id) c;

  return v_rows;
end $$;
revoke all on function app.ops_workspace_members(uuid) from public;
grant execute on function app.ops_workspace_members(uuid) to kaname_app;

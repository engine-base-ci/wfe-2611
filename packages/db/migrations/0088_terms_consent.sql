-- 0088 規約に同意する（K-53・D-125.162・D-128.137・D-128.146）の DB の足し分
--   ① 今の版を返す app.current_terms()：kind ごとに、公開の時刻（published_at）を過ぎた、取り下げていない一番新しい版（運営のテナントの版だけ）。
--      今の行の守り terms_versions_all_read はログインしていないと 0 行なので、誰でも読める口（getCurrentTerms）と登録の画面のために
--      security definer で要る列（id・kind・version・url・published_at）だけを返す。行の守りそのものは変えない。
--      本体はふつうの sql 関数（文字列の本体）にする。BEGIN ATOMIC は作った時点で表に結びつき、表が読めないときに落ちなくなる（K53-API-033）
--   ② まだ同意していない今の版 app.terms_pending(auth_user_id)：同意が要るのは利用規約とプライバシーポリシーの 2 つだけ（特商法の表示は見せるだけ）。
--      同意は人ごとに 1 回（どのワークスペースで同意しても他で聞き直さない）なので、テナントでなく auth_user_id で引く
--   ③ sessions.terms_pending（同意し直しの印）と、その人の画面のセッションの印を決め直す app.refresh_terms_pending(auth_user_id)。
--      印はログインでセッションができたとき（packages/auth の hook）と、確定の直後（K-52）と、同意したときに決める。
--      PC の常駐（Bridge）のセッションには立てない（D-128.137。Bridge は時間で切らないので、止めると PC 側の仕事が全部止まる）。
--      運営の人（セッションの人の members.tenant_id が app.ops_tenant_id()）のセッションにも立てない（D-128.172）。
--      守りの 2 層目として、印を読む app.session_terms_pending は運営のテナントのセッションでは常に false を返す
--   ④ 同じ人が同じ版に 2 行持たない索引（2 回押し・2 つのタブで同時に押しても 1 行）
--   ⑤ 種：運営のテナントに利用規約とプライバシーポリシーの第 1 版（版が 1 つも無い状態は作らない・D-128.137）。
--      公開日は apps/web/content/legal/<kind>-v1.md の施行日の行と同じ日の日本時間 0 時（ずれたら K53-API-035 が赤）。
--      施行日の値は K-86（専門家の確認）で決める。それまでは開発の仮の日付（migration を作る日より前・未来にすると登録が止まる）。
--      試験の種の入れ替え（packages/db/src/seeds.ts の truncate）でも消えたままにしないよう、種は関数 app.seed_first_terms() にして両方から呼ぶ
--   ⑥ kaname_auth.signup_current_terms()（0085）の中身を app.current_terms() を引く形に寄せる。認証の接続（kaname_auth）には app のスキーマの
--      usage を渡さない決まり（D-128.171）なので、関数の名前と置き場（kaname_auth）は残し、中は security definer で持ち主の権限で引く

create or replace function app.current_terms()
returns table (id uuid, kind text, version text, url text, published_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select distinct on (v.kind) v.id, v.kind, v.version, v.url, v.published_at
    from terms_versions v
   where v.tenant_id = app.ops_tenant_id() and v.deleted_at is null and v.published_at <= now()
   order by v.kind, v.published_at desc, v.created_at desc, v.id desc
$$;
revoke all on function app.current_terms() from public;
grant execute on function app.current_terms() to kaname_app;

create or replace function app.terms_pending(p_auth_user_id text)
returns table (id uuid, kind text, version text, url text, published_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select t.id, t.kind, t.version, t.url, t.published_at
    from app.current_terms() t
   where t.kind in ('terms', 'privacy')
     and not exists (select 1 from terms_consents c
                      where c.auth_user_id = p_auth_user_id and c.terms_version_id = t.id and c.deleted_at is null)
$$;
revoke all on function app.terms_pending(text) from public;
grant execute on function app.terms_pending(text) to kaname_app;

-- 画面のセッションが「同意し直しが要る」とき true。既定は false（版が出た時点でログイン中の人はそのまま使える・D-125.162）
alter table sessions add column if not exists terms_pending boolean not null default false;

-- その人の生きている画面のセッションの印を、今の版への同意で決め直す。Bridge のセッションは見ない。変えた行の数を返す
create or replace function app.refresh_terms_pending(p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_pending boolean; n int;
begin
  if p_auth_user_id is null or p_auth_user_id = '' then return 0; end if;
  v_pending := exists (select 1 from app.terms_pending(p_auth_user_id));
  update sessions s set terms_pending = v_pending
    from members m
   where m.id = s.member_id and m.auth_user_id = p_auth_user_id
     and m.tenant_id <> app.ops_tenant_id()
     and s.kind_id <> 'bridge' and s.revoked_at is null and s.terms_pending is distinct from v_pending;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.refresh_terms_pending(text) from public;
grant execute on function app.refresh_terms_pending(text) to kaname_app;

-- ログインでできた 1 つのセッションに印を立てる（Better Auth の hook が app.open_session の後に呼ぶ）。Bridge のセッションには立てない
create or replace function app.mark_session_terms(p_auth_session_id text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; v_kind text; v_user text; v_tenant uuid; v_pending boolean;
begin
  select s.id, s.kind_id, m.auth_user_id, m.tenant_id into v_id, v_kind, v_user, v_tenant
    from sessions s join members m on m.id = s.member_id
   where s.auth_session_id = p_auth_session_id and s.revoked_at is null;
  if v_id is null or v_kind = 'bridge' or v_tenant = app.ops_tenant_id() then return false; end if;
  v_pending := exists (select 1 from app.terms_pending(v_user));
  update sessions set terms_pending = v_pending where id = v_id and terms_pending is distinct from v_pending;
  return v_pending;
end $$;
revoke all on function app.mark_session_terms(text) from public;
grant execute on function app.mark_session_terms(text) to kaname_app;

-- そのセッションの印（要求ごとに packages/auth の resolver が読む）。Bridge のセッションと運営のテナントのセッションは常に false（D-128.172）
create or replace function app.session_terms_pending(p_session_id uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((select s.terms_pending and s.kind_id <> 'bridge' and m.tenant_id <> app.ops_tenant_id()
                     from sessions s join members m on m.id = s.member_id where s.id = p_session_id), false)
$$;
revoke all on function app.session_terms_pending(uuid) from public;
grant execute on function app.session_terms_pending(uuid) to kaname_app;

-- 同じ人が同じ版に 2 行持たない（同意の口は on conflict do nothing で 2 回目を 1 回目の行のままにする）
create unique index if not exists terms_consents_user_version_uq on terms_consents (auth_user_id, terms_version_id)
  where deleted_at is null;

-- 種の第 1 版（開発の仮の施行日 2026-11-01・日本時間 0 時。apps/web/content/legal/<kind>-v1.md の施行日の行と同じ）。あれば何もしない
create or replace function app.seed_first_terms() returns void
language sql volatile security definer set search_path = public, app, pg_temp as $$
  insert into terms_versions (tenant_id, kind, version, url, published_at)
  values (app.ops_tenant_id(), 'terms', '1', '/legal/terms?v=1', timestamptz '2026-11-01 00:00:00+09'),
         (app.ops_tenant_id(), 'privacy', '1', '/legal/privacy?v=1', timestamptz '2026-11-01 00:00:00+09')
  on conflict (tenant_id, kind, version) do nothing
$$;
revoke all on function app.seed_first_terms() from public;
select app.seed_first_terms();

create or replace function kaname_auth.signup_current_terms() returns table (terms_version_id uuid, privacy_version_id uuid)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select (select t.id from app.current_terms() t where t.kind = 'terms'),
         (select t.id from app.current_terms() t where t.kind = 'privacy')
$$;
revoke all on function kaname_auth.signup_current_terms() from public;
grant execute on function kaname_auth.signup_current_terms() to kaname_auth;

insert into app.schema_migrations (name) values ('0088_terms_consent.sql') on conflict do nothing;

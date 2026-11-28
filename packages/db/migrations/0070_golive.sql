-- 0070 本番に切り替える（T-U-12・A12・D-028.4・D-116.5・E-DEP-004）。
--   切り替える前の確認（会社モデルが確定・Bridge がつながっている・外に出るものは承認が要る・AI社員が使うログイン情報と連携の権限が足りている・AI社員の目標）を
--   本物の記録から 1 回で出し、赤が 1 件でもあれば切り替えない（黄は承知のうえで押せる）。押したら会社を本番にし（tenants.live_at）、段 6 を通したと記録して証跡に残す。
--   足りない AI社員は「止めたまま本番へ」にできる（E-DEP-004 の一手。ai_employees.paused_at）。
--   ER図：tenants.live_at / live_by、ai_employees.paused_at / paused_reason
alter table tenants add column if not exists live_at timestamptz;
alter table tenants add column if not exists live_by uuid references members(id);
alter table ai_employees add column if not exists paused_at timestamptz;
alter table ai_employees add column if not exists paused_reason text;

-- 切り替える前の確認（D-116.5）。level：ok／warn（黄・承知すれば押せる）／red（押せない）／paused（止めたまま本番へ）
--   checks[]：id・level・title・detail・fix{label,href}・employee_id（AI社員ごとの行だけ）
--   schedule[]：切り替えると明日から動くもの（担当業務から。時刻はまだ決めていないので「朝」）
--   shortfall：赤の文（E-DEP-004 の文言「本番に切り替える前に N つ足りません：…。埋めると切り替えられます」）
create or replace function app.onboard_golive(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare m members%rowtype; t tenants%rowtype; b jsonb; checks jsonb := '[]'::jsonb; e record; svc text; c record;
  v_goals int; v_duties int; v_emps int; v_missing text[] := '{}'; v_red int; v_warn int; v_detail text; v_level text;
  v_live_by text;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('checks', '[]'::jsonb, 'schedule', '[]'::jsonb, 'ready', false, 'red', 0, 'warn', 0, 'live', null); end if;
  select * into t from tenants where id = m.tenant_id;

  -- 1. 会社モデルが確定している（たたき台で「これでいく」＝段 3・目標・担当業務・AI社員がある）
  select count(*) into v_goals from goals g where g.tenant_id = m.tenant_id and g.deleted_at is null and g.ended_at is null;
  select count(*) into v_duties from duties d where d.tenant_id = m.tenant_id and d.deleted_at is null;
  select count(*) into v_emps from ai_employees a where a.tenant_id = m.tenant_id and a.deleted_at is null;
  v_detail := concat_ws('・', case when coalesce(m.setup_step, 0) < 3 then 'たたき台で「これでいく」を押していません' end,
                               case when v_goals = 0 then '目標がありません' end,
                               case when v_duties = 0 then '担当業務がありません' end,
                               case when v_emps = 0 then 'AI社員がいません' end);
  checks := checks || jsonb_build_object('id', 'model', 'level', case when v_detail = '' then 'ok' else 'red' end,
              'title', '会社モデル（目標・台帳・担当業務・AI社員・ルール）が確定している',
              'detail', case when v_detail = '' then format('目標 %s・担当業務 %s・AI社員 %s', v_goals, v_duties, v_emps) else v_detail end,
              'fix', jsonb_build_object('label', 'たたき台を直す', 'href', '/onboard/draft'));
  if v_detail <> '' then v_missing := array_append(v_missing, '会社モデル'); end if;

  -- 2. Bridge がつながっている（本人の PC。75 秒以内に知らせがある）
  b := app.bridge_state(p_member);
  v_level := case when (b->>'live')::boolean then 'ok' else 'red' end;
  checks := checks || jsonb_build_object('id', 'bridge', 'level', v_level, 'title', 'Bridge がつながっている',
              'detail', case when (b->>'live')::boolean then coalesce(b->>'device_label', 'この PC')
                             when (b->>'connected')::boolean then format('%s からの知らせが止まっています（%s 秒前）。PC を開いて Bridge を起動してください', coalesce(b->>'device_label', 'この PC'), b->>'last_seen_sec')
                             else 'まだ PC をつないでいません' end,
              'fix', jsonb_build_object('label', 'PC をつなぐ', 'href', '/setup/bridge'));
  if v_level <> 'ok' then v_missing := array_append(v_missing, 'Bridge の接続'); end if;

  -- 3. 外に出るものは承認が要るルールになっている（運営の安全ルールは上書き不可・D-026。会社の層で外向きの操作を auto にしていれば赤）
  if exists (select 1 from policies p where p.tenant_id = m.tenant_id and p.deleted_at is null and p.mode_id = 'auto'
                and coalesce(p.action_kind_id, '') ~ '^(external|send|post|pay|publish)') then
    v_level := 'red'; v_detail := '外に出る操作を承認なしで動く設定にしています。承認が要る設定に戻してください';
    v_missing := array_append(v_missing, '外に出るものの承認');
  else
    v_level := 'ok'; v_detail := 'メール・請求書・投稿など外に出るものは、送る前に必ずあなたに見せます';
  end if;
  checks := checks || jsonb_build_object('id', 'approval', 'level', v_level, 'title', '外に出るものは承認が要るルールになっている', 'detail', v_detail);

  -- 4. AI社員ごと：使うログイン情報と連携の権限が足りている・目標がある（E-DEP-004）。止めたまま本番へ にした AI社員は見ない
  for e in select a.id, a.paused_at, a.paused_reason, coalesce(sm.display_name, '') as name, sm.id as member_id,
                  coalesce((select array_agg(distinct lower(trim(x))) from duties d, jsonb_array_elements_text(coalesce(d.constraints->'services', '[]'::jsonb)) x
                             where d.ai_employee_id = a.id and d.deleted_at is null and trim(x) <> ''), '{}') as services
             from ai_employees a left join members sm on sm.id = a.member_id
            where a.tenant_id = m.tenant_id and a.deleted_at is null order by a.created_at loop
    if e.paused_at is not null then
      checks := checks || jsonb_build_object('id', 'paused:' || e.id, 'employee_id', e.id, 'level', 'paused',
                  'title', format('%sは止めたまま本番へ（動かしません）', e.name), 'detail', coalesce(e.paused_reason, ''));
      continue;
    end if;
    -- 使うサービス（担当業務の constraints.services）ごとに、本人が預けたログイン情報があるか・ログインできたか・規約で禁止でないか
    foreach svc in array e.services loop
      select c2.id, c2.login_check_state, c2.login_check_detail, c2.two_factor_id, coalesce(s.automation_verdict_id, 'unspecified') as verdict,
             coalesce(nullif(c2.service_name, ''), s.name, svc) as shown
        into c
        from credentials c2 left join service_registry s on s.id = c2.service_id
       where c2.owner_member_id = p_member and c2.deleted_at is null and c2.revoked_at is null
         and (lower(trim(c2.service_name)) = svc or lower(trim(c2.service_domain)) = svc or lower(s.name) = svc or lower(coalesce(s.domain, '')) = svc)
       order by c2.created_at desc limit 1;
      if not found then
        v_level := 'red'; v_detail := format('%sの %s のログイン情報を預けていません', e.name, svc);
        v_missing := array_append(v_missing, format('%sの %s のログイン情報', e.name, svc));
      elsif c.verdict in ('forbidden', 'bank') then
        v_level := 'red'; v_detail := format('%s は規約で AI が触れないサービスです（%s）。この担当業務は人がやります', c.shown, case when c.verdict = 'bank' then '銀行' else '禁止' end);
        v_missing := array_append(v_missing, format('%sの %s（規約で禁止）', e.name, c.shown));
      elsif c.login_check_state in ('bad_password', 'forbidden', 'unreachable', 'no_form') then
        v_level := 'red'; v_detail := format('%s にログインできませんでした（%s）', c.shown, coalesce(c.login_check_detail, '理由は分かりません'));
        v_missing := array_append(v_missing, format('%sの %s のログイン', e.name, c.shown));
      elsif c.login_check_state in ('needs_2fa', 'captcha', 'stopped', 'no_bridge') then
        v_level := 'warn'; v_detail := format('%s のログインが途中で止まっています（%s）。本番でも同じところで止まり、あなたに頼みます', c.shown, coalesce(c.login_check_detail, '理由は分かりません'));
      elsif c.login_check_state = 'ok' then
        v_level := 'ok'; v_detail := format('%s にログインできました', c.shown);
      else
        v_level := 'warn'; v_detail := format('%s にログインできるかをまだ確かめていません。切り替えたあと最初の仕事で確かめます', c.shown);
      end if;
      checks := checks || jsonb_build_object('id', format('cred:%s:%s', e.id, svc), 'employee_id', e.id, 'level', v_level,
                  'title', format('%sが使う %s のログイン情報と権限', e.name, coalesce(c.shown, svc)), 'detail', v_detail,
                  'fix', jsonb_build_object('label', '連携を直す', 'href', '/settings/credentials'));
    end loop;
    -- 目標が配られているか（配られていない AI社員のタスクは行き先の無いタスクになる・D-061）
    if not exists (select 1 from goal_allocations ga where ga.assignee_member_id = e.member_id and ga.deleted_at is null) then
      checks := checks || jsonb_build_object('id', 'goal:' || e.id, 'employee_id', e.id, 'level', 'red',
                  'title', format('%sの目標', e.name), 'detail', format('%sにまだ目標が配られていません。たたき台で自分のAI に配らせるか、止めたまま本番へ にします', e.name),
                  'fix', jsonb_build_object('label', 'たたき台で配る', 'href', '/onboard/draft'));
      v_missing := array_append(v_missing, format('%sの目標', e.name));
    else
      checks := checks || jsonb_build_object('id', 'goal:' || e.id, 'employee_id', e.id, 'level', 'ok',
                  'title', format('%sの目標', e.name), 'detail', '配られています');
    end if;
  end loop;

  select count(*) filter (where x->>'level' = 'red'), count(*) filter (where x->>'level' = 'warn') into v_red, v_warn from jsonb_array_elements(checks) x;
  select coalesce(sm.display_name, '') into v_live_by from members sm where sm.id = t.live_by;
  return jsonb_build_object(
    'checks', checks,
    'schedule', coalesce((select jsonb_agg(jsonb_build_object('duty', d.name, 'staff', coalesce(sm.display_name, ''), 'paused', a.paused_at is not null) order by d.created_at)
                            from duties d left join ai_employees a on a.id = d.ai_employee_id left join members sm on sm.id = a.member_id
                           where d.tenant_id = m.tenant_id and d.deleted_at is null), '[]'::jsonb),
    'red', v_red, 'warn', v_warn,
    'ready', v_red = 0,
    'shortfall', case when v_red = 0 then null
                      else format('本番に切り替える前に %s つ足りません：%s。埋めると切り替えられます', v_red, array_to_string(v_missing, '／')) end,
    'live', case when t.live_at is null then null else jsonb_build_object('at', t.live_at, 'by', v_live_by) end,
    'step', coalesce(m.setup_step, 0));
end $$;
grant execute on function app.onboard_golive(uuid) to kaname_app;

-- 「切り替える」（D-116.5）：赤が 1 件でもあれば切り替えない。黄は承知のうえで（p_accept_warnings）。押したら会社を本番にし、段 6 を通したと記録し、証跡に残す
create or replace function app.onboard_golive_switch(p_member uuid, p_accept_warnings boolean) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; r jsonb; v_live timestamptz;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('error', 'MEMBER_NOT_FOUND'); end if;
  r := app.onboard_golive(p_member);
  if (r->>'red')::int > 0 then return jsonb_build_object('error', 'RED', 'message', r->>'shortfall', 'red', r->'red'); end if;
  if (r->>'warn')::int > 0 and not coalesce(p_accept_warnings, false) then
    return jsonb_build_object('error', 'WARN', 'message', format('%s 件の警告があります。理由を見て、承知のうえで切り替えてください', r->>'warn'), 'warn', r->'warn');
  end if;
  update tenants set live_at = coalesce(live_at, now()), live_by = coalesce(live_by, p_member), updated_by = p_member
   where id = m.tenant_id returning live_at into v_live;
  perform app.setup_step_done(p_member, 6::smallint);
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (m.tenant_id, p_member, 'member', 'golive.switched', 'tenants', m.tenant_id::text, 'C2',
            jsonb_build_object('warnings_accepted', r->'warn',
                               'warnings', (select coalesce(jsonb_agg(x->>'title'), '[]'::jsonb) from jsonb_array_elements(r->'checks') x where x->>'level' = 'warn'),
                               'paused', (select coalesce(jsonb_agg(x->>'employee_id'), '[]'::jsonb) from jsonb_array_elements(r->'checks') x where x->>'level' = 'paused')),
            p_member);
  return jsonb_build_object('ok', true, 'live_at', v_live);
end $$;
grant execute on function app.onboard_golive_switch(uuid, boolean) to kaname_app;

-- 「止めたまま本番へ」（E-DEP-004 の一手）：足りない AI社員を動かさないまま切り替える。戻すのも同じ口（p_paused=false）。本人の会社の分だけ・証跡に残す
create or replace function app.golive_pause(p_member uuid, p_employee uuid, p_paused boolean, p_reason text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; a ai_employees%rowtype;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return false; end if;
  update ai_employees set paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
                          paused_reason = case when p_paused then left(coalesce(p_reason, ''), 200) else null end, updated_by = p_member
   where id = p_employee and tenant_id = m.tenant_id and deleted_at is null returning * into a;
  if a.id is null then return false; end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (m.tenant_id, p_member, 'member', case when p_paused then 'golive.employee_paused' else 'golive.employee_resumed' end, 'ai_employees', a.id::text, 'C2',
            jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)), p_member);
  return true;
end $$;
grant execute on function app.golive_pause(uuid, uuid, boolean, text) to kaname_app;

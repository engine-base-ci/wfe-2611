-- 20261127095400 依頼を受けて普通のチケットを作る（K-894・契約の口 acceptClientRequest・D-155.8・D-155.35・D-155.37・D-155.41〜45・D-150.49・D-130.4・D-136.1）
--   新しい表・列は作らない。関数を 1 つ足す（書く・関門 C2）。
--
-- app.client_request_accept(p_req, p)：1 つの取引の中で、ゲストの依頼を普通のチケットにする（チケットはチケット・特別扱いしない・D-155.42）。
--   呼んだ人は app.user_id() で引く（引数で人を受けない）。順：
--   ① 依頼を for update で取る（同時の 2 本は 1 本だけ通る）。見えない・無い・消した・別の会社・前の取引先の形（guest_group_id が空）は 42501＋hint E-GST-100。
--      直せない（届け先で client_requests を edit できない）は 42501（hint なし）。もう決まっている（ticketed・declined）は 22023＋hint E-GST-120
--   ② 題・本文・種別を決める（題は p.title か依頼の題・本文は p.body か依頼の本文を段 5 の本文の形 { doc, text } に・種別は p.kind_id か既定の「タスク」）
--   ③ 段 5 の app.ticket_create を呼ぶ。ok が false なら、その答えをそのまま返す（何も書いていない）
--   ④ チャットの頭：依頼の最初の本文（出し手・依頼の作った時刻）と client_request_messages の message（消していない・古い順）を、
--      元の書いた人と時刻のまま ticket_messages に post・guest_visible true・from_request true で入れる（1 つの insert … select）
--   ⑤ 見せる相手：K-881 の app.ticket_guest_shares_update(チケット, 依頼のグループ ∪ p.guest_group_ids, {})。42501／22023 はそのまま上に投げる（取引ごと戻る）
--   ⑥ 依頼を ticketed・ticket_id で更新 ⑦ 証跡 client_request.accepted（payload は request_id と ticket_id だけ）
--   答え：{ ok: true, ticket_id, number } か app.ticket_create の { ok: false, status, code, field }

create or replace function app.client_request_accept(p_req uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_r client_requests%rowtype;
  v_title text;
  v_text text;
  v_kind uuid;
  v_body jsonb;
  v_made jsonb;
  v_ticket uuid;
  v_groups uuid[];
begin
  if v_me is null or v_tenant is null or not app.member_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- ① 依頼の行を取る（同時の 2 本は待ってから、決まった状態を見る）
  select * into v_r from client_requests
    where id = p_req and tenant_id = v_tenant and deleted_at is null and guest_group_id is not null
    for update;
  if not found or not app.client_request_visible(p_req) then
    raise exception 'client request not found' using errcode = '42501', hint = 'E-GST-100';
  end if;
  if not app.client_request_actable(p_req) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_r.state not in ('new', 'asking') then
    raise exception 'client request already decided' using errcode = '22023', hint = 'E-GST-120';
  end if;
  -- ② 題・本文・種別
  v_title := coalesce(nullif(btrim(p->>'title'), ''), v_r.title);
  v_text := coalesce(p->>'body', v_r.body, '');
  v_body := jsonb_build_object(
    'doc', jsonb_build_object('type', 'doc', 'content',
      case when v_text = '' then '[]'::jsonb
           else jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content',
                  jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_text)))) end),
    'text', v_text);
  v_kind := nullif(p->>'kind_id', '')::uuid;
  if v_kind is null then
    select k.id into v_kind from ticket_kinds k
      where k.tenant_id = v_tenant and k.name = 'タスク' and k.deleted_at is null
      order by k.position, k.id limit 1;
  end if;
  -- ③ 普通のチケットを作る（種別・段・番号・担当への知らせも普通のチケットと同じ）
  v_made := app.ticket_create(jsonb_build_object(
    'scope_id', p->>'scope_id', 'kind_id', v_kind, 'title', v_title,
    'assignee_member_id', p->>'assignee_member_id', 'due_on', p->>'due_on', 'body', v_body));
  if (v_made->>'ok')::boolean is distinct from true then
    return v_made;
  end if;
  v_ticket := (v_made->>'id')::uuid;
  -- ④ チャットの頭（元の書いた人と時刻のまま・ゲストに見える・依頼から来た）
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, guest_visible, from_request,
                               created_at, updated_at, created_by, updated_by)
  select v_tenant, v_ticket, x.author, 'post', x.body, true, true, x.at, x.at, v_me, v_me
    from (
      select v_r.created_by as author, v_r.body as body, v_r.created_at as at, null::uuid as id, 0 as ord
       where v_r.created_by is not null and length(btrim(coalesce(v_r.body, ''))) > 0
      union all
      select m.author_member_id, m.body, m.created_at, m.id, 1
        from client_request_messages m
       where m.client_request_id = p_req and m.tenant_id = v_tenant and m.kind = 'message' and m.deleted_at is null
    ) x
   order by x.at, x.ord, x.id;
  -- ⑤ 見せる相手（依頼を出したグループはいつも入る）
  select coalesce(array_agg(distinct g), '{}') into v_groups
    from (
      select v_r.guest_group_id as g
      union
      select (e)::uuid from jsonb_array_elements_text(coalesce(p->'guest_group_ids', '[]'::jsonb)) e
    ) s;
  perform app.ticket_guest_shares_update(v_ticket, v_groups, '{}'::uuid[]);
  -- ⑥ 依頼はチケットになった（やり取りはチケットに 1 つにまとまる）
  update client_requests set state = 'ticketed', ticket_id = v_ticket, updated_by = v_me
   where id = p_req;
  -- ⑦ 証跡
  perform app.record_audit('client_request.accepted', 'client_requests', p_req::text, 'C2',
    jsonb_build_object('request_id', p_req, 'ticket_id', v_ticket));
  return jsonb_build_object('ok', true, 'ticket_id', v_ticket, 'number', v_made->>'number');
end $$;
revoke all on function app.client_request_accept(uuid, jsonb) from public;
grant execute on function app.client_request_accept(uuid, jsonb) to kaname_app;

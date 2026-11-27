-- 20261127100900 ゲストが依頼に付ける添付を足す（K-909・契約の口 uploadPortalAttachment・D-155.12・D-155.53・関門 C2・C4）
--
-- 置き場（関門 C4）に置くのは口（apps/api/src/features/F11/portal/attachment.ts）。ここは「空きを見る」と「行と証跡を 1 つの取引で書く」だけ。
-- ① attachments.name は 0041_agent_chat.sql で既にある。列は足さず、空でない check だけを足す（前からの行は null でよい・not valid で前からの行を見ない）。
--    字数の上限は DB に置かない（会話の資料のファイル名は 300 字も切らずに通す・D-135.5・PM の決め 2026-11-28）。先方の口の 200 字は口が確かめる（attachment.ts の NAME_MAX）
-- ② app.portal_attachment_room() returns int：ゲスト（app.guest_ok()・K-878）でなければ 42501。
--      本人の下書き（owner_type portal_draft・owner_id 本人・消していない）の数を 5 から引いて返す（0 より下にしない）
-- ③ app.portal_attachment_add(p_ref, p_name, p_mime, p_size) returns jsonb：ゲストでなければ 42501。本人ごとの錠を取り、空きを数え直す。
--      空きが無ければ P0001・hint E-GST-183。attachments に下書きを 1 行（scope_id はゲストのグループの届け先 request_scope_id・scanned_at は今＝大きさと種類の検査を通した印）
--      と証跡 portal.attachment_uploaded（payload は attachment_id と size だけ・名前は載せない）。{ id, name } を返す
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す。表の行の守りは足さない（ゲストは表を直に読まない）

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attachments_name_chk' and conrelid = 'attachments'::regclass) then
    alter table attachments add constraint attachments_name_chk
      check (name is null or length(btrim(name)) >= 1) not valid;
  end if;
end $$;

create or replace function app.portal_attachment_room() returns int
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_used int;
begin
  if not coalesce(app.guest_ok(), false) then
    raise exception 'ゲストでない' using errcode = 'insufficient_privilege';
  end if;
  select count(*)::int into v_used
    from attachments a
   where a.tenant_id = app.tenant_id() and a.owner_type = 'portal_draft'
     and a.owner_id = app.user_id() and a.deleted_at is null;
  return greatest(5 - v_used, 0);
end $$;
revoke all on function app.portal_attachment_room() from public;
grant execute on function app.portal_attachment_room() to kaname_app;

create or replace function app.portal_attachment_add(p_ref text, p_name text, p_mime text, p_size bigint) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_scope uuid;
  v_used int;
  v_id uuid;
begin
  if not coalesce(app.guest_ok(), false) then
    raise exception 'ゲストでない' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('portal_attachment:' || v_self::text, 0));
  select count(*)::int into v_used
    from attachments a
   where a.tenant_id = v_tenant and a.owner_type = 'portal_draft'
     and a.owner_id = v_self and a.deleted_at is null;
  if v_used >= 5 then
    raise exception '添付は 5 つまで' using errcode = 'P0001', hint = 'E-GST-183';
  end if;
  select g.request_scope_id into v_scope
    from guest_groups g
   where g.id = app.my_guest_group() and g.tenant_id = v_tenant and g.deleted_at is null;
  if v_scope is null then
    raise exception 'ゲストのグループが無い' using errcode = 'insufficient_privilege';
  end if;
  insert into attachments (tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, name, uploaded_by, scanned_at, created_by, updated_by)
  values (v_tenant, v_scope, 'portal_draft', v_self, p_ref, p_mime, p_size, btrim(p_name), v_self, now(), v_self, v_self)
  returning id into v_id;
  perform app.record_audit('portal.attachment_uploaded', 'attachments', v_id::text, 'C2',
                           jsonb_build_object('attachment_id', v_id, 'size', p_size));
  return jsonb_build_object('id', v_id, 'name', btrim(p_name));
end $$;
revoke all on function app.portal_attachment_add(text, text, text, bigint) from public;
grant execute on function app.portal_attachment_add(text, text, text, bigint) to kaname_app;

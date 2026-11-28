-- 20261126004900 外す口の後ろ半分（K-849・K-816 の孫・口は K-848・D-128.96・D-125.140・D-154.15・D-154.20・D-154.21・D-154.26・D-154.37・D-154.41）
--   新しい表・列は作らない。関数を 1 つ足す（書く・関門 C2）。
--
-- app.member_erase(p_member, p_removed_by)：外した瞬間に決まる物を、呼び手の取引の中で 1 度に書く。
--   呼ぶのは K-848 の app.member_remove と K-838 の app.me_leave（どちらも同じ取引の中）。kaname_app には execute を渡さない。
--   会社ごとの錠（app.admin_lock）は呼び手が取る。この関数は錠を取らない＝呼び手が錠を取った後でだけ呼ぶこと。
--   外す判断（権限・自分・最後の管理者・引き継ぎ先）はこの関数でしない（K-848）。
--   会社は外す側（p_removed_by）の members の行から引く（app.tenant_id() は使わない：K-838 の抜けるは今のセッションと別の会社のこともある）。
--   外す側が無い・居ない、または外す人がその会社に居なければ member_gone。
--   順：① 外す人を読む（居ない・外した・人でない・別の会社・所属が left → { error: member_gone }・何も書かない）
--       ② 時刻 v_at は 1 つ（members・所属の行・個別の権限の行が同じ時刻＝K-817 が戻す元を選ぶ印）
--       ③ 個人の記憶（visibility self。勧めた記憶 recommended は残す・D-154.37）④ 1 人だけの会話
--       ⑤ 預けたログイン情報（失効していない物は revoked_at・deleted_at・vault_ref 空／前から失効の物は vault_ref だけ空）
--       ⑥ 出した招待で待っている物（使われていない・取り消していない・期限内）に revoked_at
--       ⑦ app.admin_cut_sessions(p_member, 本人なら 'member_left'・ほかの人なら 'member_removed')（K-814）でセッションと PC の仕事を切る（所属・status を書く前）。
--          理由はやめた PC の仕事の字を分けるだけ（抜けた／外された・代表の答え e0920e503c99）。セッションの失効の理由はどちらも member_left
--       ⑧ 所属の行 → tenant_memberships の status left → members.deleted_at の順。status を書くと役割の束の引き金（0080）が
--          束の権限の行を消すので、この関数は束の行に触らない。その後に個別の権限の行（bundle_role が null）だけ revoked_at。
--          ⑦ の後なので、members と権限の引き金（0004）が呼ぶ revoke_all_sessions は 0 件（安全の記録は ⑦ の 1 回だけ）。
--       ⑨ 答え { memories, conversations, credentials, invitations, sessions, restorable_until }（件数は数・名前・メール・id は入れない）
--   30 日の戻りの元は新しい表を作らず、消した印を付けた所属の行（role・is_primary のまま）と members.deleted_at で残す（D-154.41・K-817 が読む）。

create or replace function app.member_erase(p_member uuid, p_removed_by uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := (select m.tenant_id from members m where m.id = p_removed_by);
  v_m members%rowtype;
  v_status text;
  v_at timestamptz := now();
  v_memories int;
  v_conversations int;
  v_credentials int;
  v_invitations int;
  v_cut jsonb;
begin
  -- 外す側が無い・居ない（会社が引けない）
  if v_tenant is null then
    return jsonb_build_object('error', 'member_gone');
  end if;

  -- ① 外す人（行を for update で取る：同じ人を 2 度外さない）
  select * into v_m from members
   where id = p_member and tenant_id = v_tenant and deleted_at is null and kind_id = 'human'
   for update;
  if not found then
    return jsonb_build_object('error', 'member_gone');
  end if;
  select status into v_status from tenant_memberships where tenant_id = v_tenant and member_id = p_member;
  if v_status = 'left' then
    return jsonb_build_object('error', 'member_gone');
  end if;

  -- ③ 個人の記憶（自分だけの物。勧めた記憶・会社の記憶・他人の記憶は残す）
  update memories set deleted_at = v_at, updated_by = p_removed_by
   where tenant_id = v_tenant and owner_member_id = p_member and visibility = 'self' and deleted_at is null;
  get diagnostics v_memories = row_count;

  -- ④ 1 人だけの会話（ほかの人が入っている会話は残し、参加者の並びも変えない）
  update conversations set deleted_at = v_at, updated_by = p_removed_by
   where tenant_id = v_tenant and deleted_at is null
     and cardinality(participant_member_ids) > 0 and p_member = all(participant_member_ids);
  get diagnostics v_conversations = row_count;

  -- ⑤ 預けたログイン情報（外の置き場の実体の消去は K-349 系の仕組み。ここは DB の印まで）
  update credentials set vault_ref = null, updated_by = p_removed_by
   where tenant_id = v_tenant and owner_member_id = p_member and revoked_at is not null and vault_ref is not null;
  update credentials set revoked_at = v_at, deleted_at = coalesce(deleted_at, v_at), vault_ref = null, updated_by = p_removed_by
   where tenant_id = v_tenant and owner_member_id = p_member and revoked_at is null;
  get diagnostics v_credentials = row_count;

  -- ⑥ 出した招待で待っている物（使われた招待の accepted_member_id は変えない）
  update invitations set revoked_at = v_at, updated_by = p_removed_by
   where tenant_id = v_tenant and created_by = p_member
     and accepted_member_id is null and revoked_at is null and deleted_at is null and expires_at > v_at;
  get diagnostics v_invitations = row_count;

  -- ⑦ セッションと PC（所属・status を書く前：束の引き金が先に理由 permission_changed で切らないように）
  v_cut := app.admin_cut_sessions(p_member, case when p_removed_by = p_member then 'member_left' else 'member_removed' end);

  -- ⑧ 所属の行 → status left → members（束の権限の行は status の引き金が消す）→ 個別の権限の行
  update scope_memberships set deleted_at = v_at, updated_by = p_removed_by
   where tenant_id = v_tenant and member_id = p_member and deleted_at is null;
  update tenant_memberships set status = 'left', updated_by = p_removed_by
   where tenant_id = v_tenant and member_id = p_member;
  update members set deleted_at = v_at, updated_by = p_removed_by where id = p_member;
  update permissions set revoked_at = v_at, updated_by = p_removed_by
   where tenant_id = v_tenant and grantee_member_id = p_member and bundle_role is null and revoked_at is null;

  -- ⑨ 答え（件数と戻せる期限だけ）
  return jsonb_build_object(
    'memories', v_memories,
    'conversations', v_conversations,
    'credentials', v_credentials,
    'invitations', v_invitations,
    'sessions', coalesce((v_cut ->> 'sessions_cut')::int, 0),
    'restorable_until', to_char((v_at + interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end $$;

-- 画面の口の接続（kaname_app）には渡さない。呼ぶのは K-848 の app.member_remove と K-838 の app.me_leave（持ち主の権限）だけ
revoke all on function app.member_erase(uuid, uuid) from public;
revoke all on function app.member_erase(uuid, uuid) from kaname_app;

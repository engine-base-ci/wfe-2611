-- 20261123080300 承認待ちになったとき、承認する人に知らせ（受け箱の行）を書く（K-463・D-151.6・D-125.41・関門 C2・C6）
--   書く所は承認の行（approvals）への「足す」を引き金で拾う 1 か所：app.notify_approval_requested()（trigger 関数）と
--   引き金 approvals_notify_requested（after insert・行ごと）。承認待ちを作る所（0092 の app.bridge_finish_job・0098 の 24 時間の聞き直し・
--   今後の入口）はどれも approvals に足すので、これで全部を覆う。**それらの関数は作り直さない**（段 6 の K-61 が同じ関数を触っても重ならない）。
--
--   引き金の条件：kind が artifact・decision が空・withdrawn_at が空の承認を足したときだけ（決まっている承認・取り下げた承認は書かない。
--   承認する・差し戻す＝更新では動かない）。
--   書く行：tenant_id は承認の会社・channel_id inapp・event_kind_id approval.requested（K-461 の表の種類）・
--     payload はちょうど { ticket_id, number, title, approval_id }（成果物の本文・理由は入れない）・dedupe_key は approval.requested:<承認の id>・
--     created_by は requested_by・sent_at・failed_at・read_at は空（メールは出さない・D-151.6）。証跡（audit_events）は書かない。
--   宛先は approvals.approver_member_id（今のメンバー：消されていない・止められていない人）。チケットが無い（ticket_id が空）・消えている・
--     宛先が今のメンバーでないときは書かず、承認の行の作成は成功のまま。
--   知らせの書き込みに失敗しても承認待ちの作成は止めない（知らせを 1 つ失うより承認待ちそのものを失う方が重い）：関数の中で例外を受け、警告だけ出して返す。
--   security definer・search_path 固定（public, app, pg_temp）。本人宛てだけの行の守り（K-461）の外で別の人宛ての行を書く（0090・0100 と同じ作り）。
--   表・列は足さない。引き金は表を書き換えない。
create or replace function app.notify_approval_requested() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_key text;
begin
  -- チケットが無い・消えている承認は書かない
  select x.* into t from tickets x where x.id = new.ticket_id and x.tenant_id = new.tenant_id and x.deleted_at is null;
  if t.id is null then return null; end if;
  -- 宛先が今のメンバーでなければ書かない（抜けた・止められた人）
  if new.approver_member_id is null or not exists (
       select 1 from members m
        where m.id = new.approver_member_id and m.tenant_id = new.tenant_id and m.deleted_at is null and m.suspended_at is null) then
    return null;
  end if;
  v_key := 'approval.requested:' || new.id::text;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    select new.tenant_id, new.approver_member_id, 'inapp', 'approval.requested',
           jsonb_build_object('ticket_id', t.id, 'number', t.number, 'title', t.title, 'approval_id', new.id),
           v_key, new.requested_by
     where not exists (select 1 from notifications o
                        where o.tenant_id = new.tenant_id and o.member_id = new.approver_member_id and o.dedupe_key = v_key);
  return null;
exception when others then
  -- 知らせを書けなくても承認待ちの作成は止めない（失敗の記録は DB のログの警告に残る）
  raise warning '承認待ちの知らせを書けなかった（承認 %）：%', new.id, sqlerrm;
  return null;
end $$;
revoke all on function app.notify_approval_requested() from public;

drop trigger if exists approvals_notify_requested on approvals;
create trigger approvals_notify_requested after insert on approvals for each row
  when (new.kind = 'artifact' and new.decision is null and new.withdrawn_at is null)
  execute function app.notify_approval_requested();

-- 20261123080400 AI が止まったとき、チケットの担当者の受け箱に「止まりました：<理由>」の行を書く（K-464・D-151.6・D-129.3・D-129.47・関門 C2・C6）
--   止まる所は約 10 の migration に散っている（作る段の終わり・承認の後の実行の終わり・人を止めた／外した・PC のつながり直し・24 時間の聞き直し・PC を外した）が、
--   どれも実行の記録（action_runs）の status_id を 'stopped'・error_summary を止まった理由にして書く。その 1 か所を引き金で拾う（止まる所の関数は 1 つも作り直さない）。
--   cancelled（人が PC でやめた）は止まりと別の値で、知らせない。仕事（bridge_jobs）の状態では拾わない（承認の後の実行は仕事が done のまま実行の記録だけ stopped になる所がある）。
--
--   書く行：tenant_id はチケットの会社・channel_id は inapp・event_kind_id は ticket.stopped・payload はちょうど { ticket_id, number, title, reason, job_id }
--     （reason は止まった理由を 200 字で切った物。全文は実行の記録の error_summary に残る・job_id は action_runs.bridge_job_id）・dedupe_key は ticket.stopped:<実行の記録の id>・
--     created_by は空（仕組みが起こした知らせ）・sent_at・failed_at・read_at は空（メールは出さない）
--   宛先は止まった時点のチケットの担当者。今のメンバー（抜けていない・止められていない）だけ。チケットが無い・消えている・担当者がいない／今のメンバーでないときは書かない。
--     チケットを消す口（K-488）は deleted_at を先に立ててから走っている実行を止める順にするので、消されたチケットでは担当者に知らせは出ない（理由の文を見て外す作りにしない）。
--   知らせを書くのに失敗しても、止まった扱い（実行の記録・仕事・チケットの段）は止めない（警告だけ出して返す）。止まった記録を失う方が、知らせを 1 つ失うより重い。
--   他人宛ての受け箱の行は行の守り（本人宛てだけ）では書けないので、security definer（search_path 固定）の trigger 関数が書く（0090・0100 と同じ作り）。証跡（audit_events）は書かない。
create or replace function app.notify_ai_stopped() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_reason text; v_key text;
begin
  if new.ticket_id is null then return null; end if;
  select x.* into t from tickets x
   where x.id = new.ticket_id and x.tenant_id = new.tenant_id and x.deleted_at is null;
  if t.id is null or t.assignee_member_id is null then return null; end if;
  if not exists (select 1 from members m
                  where m.id = t.assignee_member_id and m.tenant_id = new.tenant_id
                    and m.deleted_at is null and m.suspended_at is null) then
    return null;
  end if;
  v_reason := left(coalesce(nullif(btrim(new.error_summary, E' \t\r\n　'), ''),
                            'AI が途中で止まりました（理由は届いていません）'), 200);
  v_key := 'ticket.stopped:' || new.id::text;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    select new.tenant_id, t.assignee_member_id, 'inapp', 'ticket.stopped',
           jsonb_build_object('ticket_id', t.id, 'number', t.number, 'title', t.title, 'reason', v_reason, 'job_id', new.bridge_job_id),
           v_key, null
     where not exists (select 1 from notifications o
                        where o.tenant_id = new.tenant_id and o.member_id = t.assignee_member_id and o.dedupe_key = v_key);
  return null;
exception when others then
  raise warning '止まった知らせを書けなかった（実行 %）：%', new.id, sqlerrm;
  return null;
end $$;
revoke all on function app.notify_ai_stopped() from public;

-- 引き金の条件：新しい status_id が stopped・前の status_id と違う・ticket_id がある（理由だけの書き直し・もう一度 stopped にする更新・ticket_id の無い実行では動かない）
drop trigger if exists action_runs_ticket_stopped_notice on action_runs;
create trigger action_runs_ticket_stopped_notice after update of status_id on action_runs
  for each row when (new.status_id = 'stopped' and old.status_id is distinct from new.status_id and new.ticket_id is not null)
  execute function app.notify_ai_stopped();

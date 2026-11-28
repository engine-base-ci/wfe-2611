-- 0063 承認は 1 回で決まる。決まった承認（resolved_at が入った／approved・rejected）は、決定を変える更新を DB が断る。
-- API（op.ts）はこの文言を 409 CONFLICT にする。画面・関門のどこを通っても、ここが最後の砦（G-02）
create or replace function app.approval_once() returns trigger
language plpgsql as $$
begin
  if (old.resolved_at is not null or old.status_id in ('approved', 'rejected'))
     and (new.status_id is distinct from old.status_id
          or new.resolved_at is distinct from old.resolved_at
          or new.approver_member_id is distinct from old.approver_member_id) then
    raise exception '決まった承認は変えられません（承認 %）', old.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists approvals_once on approvals;
create trigger approvals_once before update on approvals for each row execute function app.approval_once();

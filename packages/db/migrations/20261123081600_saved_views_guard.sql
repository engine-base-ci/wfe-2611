-- 20261123081600 保存した検索条件の更新の守り（K-476・契約の口 updateSavedView・D-128.119・D-151.9・関門 C2）
--   行の守りの update（saved_views_edit_update）は、直す人が member_id（作った人）や tenant_id を書き換えられ（マネージャーが自分の物にできる）、
--   作った人が見えないグループへ見せ直せる（insert には見えるグループの確かめがあるが update には無い）。引き金で止める。
--   ① member_id・tenant_id が変わる更新は断る ② share か scope_id が変わるとき、元の作った人でなければ断る
--   ③ share か scope_id が変わるときだけ、変わった後が share group で見えないグループなら断る（名前・列・条件・詰め方・消した印だけの更新には掛けない。
--      席を移した作った人が前のグループに見せた物の名前を直す・マネージャーの名前の直しが通るため）。errcode は 42501。
--   app.user_id() が空の接続（試験の種・運営の作業）は、share・scope_id が動かない更新なら通る。列は足さない。
--   security invoker のまま（app.user_id() と visible_scopes は接続の設定値で引く）。
create or replace function app.saved_views_guard() returns trigger language plpgsql set search_path = public, app as $$
begin
  if new.member_id is distinct from old.member_id or new.tenant_id is distinct from old.tenant_id then
    raise exception '保存した条件の作った人と会社は変えられません' using errcode = '42501';
  end if;
  if new.share is distinct from old.share or new.scope_id is distinct from old.scope_id then
    if app.user_id() is distinct from old.member_id then
      raise exception '見せる相手を変えられるのは作った人だけです' using errcode = '42501';
    end if;
    if new.share = 'group' and not coalesce(new.scope_id = any(visible_scopes(app.user_id())), false) then
      raise exception '見えないグループには見せられません' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists saved_views_guard on saved_views;
create trigger saved_views_guard before update on saved_views for each row execute function app.saved_views_guard();

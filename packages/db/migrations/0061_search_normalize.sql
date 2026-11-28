-- 0061 会話を探すときの表記ゆらぎ（2026-10-01 QA：SCR-CLONE-CHAT-027〜030）。
-- 全角／半角・NFD（macOS の入力）・途中の全角の空白・ハイフンの種類（‐ ‑ ‒ – — ― − －）・大文字小文字の違いで、同じ会話が見つからなかった。
-- 探す語と、名前・本文の両方を同じ形にそろえてから比べる（NFKC → ハイフンを 1 つに → 空白をまとめる → 小文字）。% と _ は文字として扱う。
create or replace function app.search_norm(p text) returns text
language sql immutable parallel safe as $$
  select lower(regexp_replace(translate(normalize(coalesce(p, ''), NFKC), '‐‑‒–—―−', '-------'), '\s+', ' ', 'g'))
$$;
grant execute on function app.search_norm(text) to kaname_app, kaname_auth;

create or replace function app.agent_conversations(p_member uuid, p_q text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v jsonb; q text := nullif(trim(app.search_norm(p_q)), ''); pat text;
begin
  pat := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select coalesce(jsonb_agg(x order by (x->>'starred')::boolean desc, x->>'updated_at' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', c.id, 'title', coalesce(c.title, '新しい会話'), 'title_auto', c.title_auto,
      'starred', c.starred_at is not null, 'incognito', c.incognito, 'updated_at', c.updated_at,
      'unread', (select count(*) from messages m where m.conversation_id = c.id and m.deleted_at is null and m.kind = 'ai'
                   and m.created_at > coalesce(c.last_read_at, 'epoch'::timestamptz)),
      -- 当たった所：そろえた本文から語のまわりを切り出す（元の本文と長さが変わることがあるので、そろえた側で切る）
      'hit', case when q is null then null else
              (select substr(app.search_norm(m.body), greatest(1, strpos(app.search_norm(m.body), q) - 60), 160 + length(q))
                 from messages m where m.conversation_id = c.id and m.deleted_at is null
                 and app.search_norm(m.body) like pat order by m.created_at desc limit 1) end) as x
      from conversations c
     where c.owner_member_id = p_member and c.deleted_at is null
       and (q is null or app.search_norm(c.title) like pat
            or exists (select 1 from messages m where m.conversation_id = c.id and m.deleted_at is null and app.search_norm(m.body) like pat))
     order by c.updated_at desc limit 200
  ) t;
  return v;
end $$;

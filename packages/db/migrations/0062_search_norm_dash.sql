-- 0062 探すときのそろえ方に、英数字にはさまれた長音「ー」をハイフンとして扱うことを足す（「ABCー123」も「ABC-123」に当たる・SCR-CLONE-CHAT-029）。
-- カタカナの長音（「データ」）は変えない。apps/web/components/ai/list.tsx の searchNorm と同じ規則
create or replace function app.search_norm(p text) returns text
language sql immutable parallel safe as $$
  select lower(regexp_replace(
    regexp_replace(translate(normalize(coalesce(p, ''), NFKC), '‐‑‒–—―−', '-------'), '([0-9A-Za-z])ー(?=[0-9A-Za-z])', '\1-', 'g'),
    '\s+', ' ', 'g'))
$$;

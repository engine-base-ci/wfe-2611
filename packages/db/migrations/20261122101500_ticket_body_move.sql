-- 20261122101500 今あるチケットの区画の中身を 1 枚の本文に移す（K-575・D-150.58・D-150.35・D-150.50・D-150.41・関門 C2）
--   ① app.ticket_body_build(チケット)：区画（鍵が body・artifacts でない・消していない）を position・鍵の順に読み、
--      区画ごとに 見出し（level 2）＋中身（checklist＝チェックの箱・bullets＝箇条書き・ほか＝行ごとに段落）にして {doc, text} を返す。移す区画が無ければ null。
--      見出しの名前：自由欄（鍵 free・free_…）は区画の本文の label → 種別の区画の名前 → 鍵。ほかは種別の区画の名前 → 鍵。
--      text は packages/contracts の docToText と同じ規則（見出し・段落は 1 行・箇条書きは「- 」・チェックの箱は「[x] 」「[ ] 」・改行でつなぐ）。
--      DB が text を作るのはこの移しだけ（K-561 の決めの、この葉だけの例外）。ずれたら正は docToText（試験 K575-DB-014 が突き合わせる）。
--   ② app.ticket_body_move(会社)：鍵 body の行が無い（生きていても消していても）チケットを 1 枚ずつ ① で組み、
--      本文の行（位置 0・版 1・作った人＝チケットを作った人）と版 1 の行（edited_by＝区画のうち最後に直した人）を書き、元の区画の行に deleted_at を入れる。
--      本文が上限（app.ticket_body_valid）を通らないチケットは区画のまま残して skipped に数える。tickets・やり取り・証跡・お知らせは書かない。
--      本文の行が在るチケットを選ばないので、何回流しても増えない。答え {moved, skipped}
--   ③ どちらも誰にも execute を渡さない（migration と管理者の接続だけが呼ぶ・K-563 の app.custom_fields_move_axes と同じ置き方）
--   ④ 最後に全部の会社へ 1 回呼ぶ。列・表・引き金は足さない

create or replace function app.ticket_body_build(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  ws constant text := E' \t\r\n　';
  s record;
  ln text;
  lines text[];
  m text[];
  item jsonb;
  items jsonb;
  label text;
  blocks jsonb := '[]'::jsonb;
  out_lines text[] := array[]::text[];
  sec_lines text[];
begin
  for s in
    select ts.section_key, ts.body, ks.label as kind_label, coalesce(ks.content_type, 'text') as ctype
    from ticket_sections ts
    join tickets t on t.id = ts.ticket_id
    left join lateral (
      select k.label, k.content_type from kind_sections k
      where k.kind_id = t.kind_id and k.section_key = ts.section_key and k.deleted_at is null
      order by k.position, k.id limit 1
    ) ks on true
    where ts.ticket_id = p_ticket and ts.section_key not in ('body', 'artifacts') and ts.deleted_at is null
    order by ts.position, ts.section_key
  loop
    -- 行に分けて前後の空白（全角・タブ・改行）を落とし、空の行は飛ばす
    lines := array[]::text[];
    foreach ln in array regexp_split_to_array(replace(replace(coalesce(s.body->>'text', ''), E'\r\n', E'\n'), E'\r', E'\n'), E'\n') loop
      ln := btrim(ln, ws);
      if ln <> '' then lines := lines || ln; end if;
    end loop;
    if cardinality(lines) = 0 then continue; end if;

    items := '[]'::jsonb;
    sec_lines := array[]::text[];
    if s.ctype in ('checklist', 'bullets') then
      foreach ln in array lines loop
        if left(ln, 2) = '- ' then ln := btrim(substr(ln, 3), ws); end if;
        if s.ctype = 'checklist' then
          m := regexp_match(ln, E'^\\[([ xX])\\](?:[ \t　]+(.*))?$');
          if m is not null then ln := btrim(coalesce(m[2], ''), ws); end if;
          if ln = '' then continue; end if;
          item := jsonb_build_object('type', 'taskItem',
            'attrs', jsonb_build_object('checked', m is not null and m[1] in ('x', 'X')),
            'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
              'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', ln)))));
          sec_lines := sec_lines || (case when m is not null and m[1] in ('x', 'X') then '[x] ' else '[ ] ' end || ln);
        else
          if ln = '' then continue; end if;
          item := jsonb_build_object('type', 'listItem',
            'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
              'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', ln)))));
          sec_lines := sec_lines || ('- ' || ln);
        end if;
        items := items || jsonb_build_array(item);
      end loop;
      if jsonb_array_length(items) = 0 then continue; end if;
    else
      foreach ln in array lines loop
        items := items || jsonb_build_array(jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', ln))));
        sec_lines := sec_lines || ln;
      end loop;
    end if;

    -- 見出しの名前（改行・タブは空白 1 つに・前後の空白を落とす）
    label := null;
    if s.section_key = 'free' or s.section_key like 'free\_%' then
      label := nullif(btrim(regexp_replace(coalesce(s.body->>'label', ''), E'[\r\n\t]+', ' ', 'g'), ws), '');
    end if;
    label := coalesce(label,
      nullif(btrim(regexp_replace(coalesce(s.kind_label, ''), E'[\r\n\t]+', ' ', 'g'), ws), ''),
      s.section_key);

    blocks := blocks || jsonb_build_array(jsonb_build_object('type', 'heading',
      'attrs', jsonb_build_object('level', 2),
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', label))));
    out_lines := out_lines || label;
    if s.ctype = 'checklist' then
      blocks := blocks || jsonb_build_array(jsonb_build_object('type', 'taskList', 'content', items));
    elsif s.ctype = 'bullets' then
      blocks := blocks || jsonb_build_array(jsonb_build_object('type', 'bulletList', 'content', items));
    else
      blocks := blocks || items;
    end if;
    out_lines := out_lines || sec_lines;
  end loop;

  if jsonb_array_length(blocks) = 0 then return null; end if;
  return jsonb_build_object('doc', jsonb_build_object('type', 'doc', 'content', blocks),
                            'text', array_to_string(out_lines, E'\n'));
end $$;
revoke all on function app.ticket_body_build(uuid) from public;
revoke all on function app.ticket_body_build(uuid) from kaname_app;

create or replace function app.ticket_body_move(p_tenant uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  t record;
  b jsonb;
  sid uuid;
  ed uuid;
  moved int := 0;
  skipped int := 0;
begin
  for t in
    select tk.id, tk.created_by from tickets tk
    where tk.tenant_id = p_tenant
      and not exists (select 1 from ticket_sections s where s.ticket_id = tk.id and s.section_key = 'body')
    order by tk.created_at, tk.id
  loop
    b := app.ticket_body_build(t.id);
    if b is null then continue; end if;
    if not app.ticket_body_valid(b) then
      skipped := skipped + 1;
      continue;
    end if;
    select coalesce(s.updated_by, t.created_by) into ed
      from ticket_sections s
      where s.ticket_id = t.id and s.section_key not in ('body', 'artifacts') and s.deleted_at is null
      order by s.updated_at desc, s.id desc limit 1;
    insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
      values (p_tenant, t.id, 'body', 0, b, 1, t.created_by, t.created_by)
      returning id into sid;
    insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, restored_from, created_by, updated_by)
      values (p_tenant, t.id, sid, 1, b, ed, false, null, ed, ed);
    update ticket_sections set deleted_at = now()
      where ticket_id = t.id and section_key not in ('body', 'artifacts') and deleted_at is null;
    moved := moved + 1;
  end loop;
  return jsonb_build_object('moved', moved, 'skipped', skipped);
end $$;
revoke all on function app.ticket_body_move(uuid) from public;
revoke all on function app.ticket_body_move(uuid) from kaname_app;

-- 前からある会社のチケットを、1 回だけ本文に移す
select app.ticket_body_move(id) from tenants;

// K-575「今あるチケットの区画の中身を 1 枚の本文に移す」の単体の試験（本物の DB）。名前の頭の行 ID（K575-DB-…）は 11_tickets/K-575.md の表のマスに 1 対 1 で結ぶ。
//   移しの関数 app.ticket_body_move(会社) を管理者の接続で呼ぶ。前の形のチケット・区画の行・版の行は DB に直に入れる。会社は試験ごとに新しく作る（数を数える試験が重ならない）。
//   本文の木の形と text は @kaname/contracts の validateDoc・docToText で突き合わせる（DB が text を作るのはこの移しだけなので、2 つの実装のずれをここで見る）。
//   テストはチケットを作る人が書き、実装する人は変えない。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { docToText, validateDoc } from "../../contracts/src/doc.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
const app = new pg.Pool({ connectionString: APP_URL, max: 1 });

type Co = { tenant: string; scope: string; member: string; member2: string; kind: string; stage: string };
type Node = Record<string, unknown>;
const text = (t: string) => ({ type: "text", text: t });
const P = (t: string): Node => ({ type: "paragraph", content: [text(t)] });
const H = (t: string): Node => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
const TL = (items: [string, boolean][]): Node => ({
  type: "taskList",
  content: items.map(([t, c]) => ({ type: "taskItem", attrs: { checked: c }, content: [P(t)] })),
});
const BL = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [P(t)] })),
});
const DOC = (...content: Node[]) => ({ type: "doc", content });

const one = async <T = string>(sql: string, p: unknown[] = []) => (await admin.query<{ v: T }>(sql, p)).rows[0]!.v;
const n = async (sql: string, p: unknown[] = []) => Number(await one<string>(sql, p));
async function company(): Promise<Co> {
  const tenant = await one(
    "insert into tenants (id, tenant_id, name) select u, u, '会社 移し' from gen_random_uuid() u returning id as v",
  );
  const scope = await one(
    "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '会社', 'MV') returning id as v",
    [tenant],
  );
  const mk = (name: string) =>
    one(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id as v",
      [tenant, scope, name],
    );
  return {
    tenant,
    scope,
    member: await mk("作った人"),
    member2: await mk("直した人"),
    kind: await one(
      "select id as v from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [tenant],
    ),
    stage: await one("select id as v from ticket_stages where tenant_id = $1 and key = 'todo' and deleted_at is null", [
      tenant,
    ]),
  };
}
const ticket = (c: Co, title = "請求書を送る") =>
  one(
    "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, due_on, created_by, updated_by) values ($1, $2, '', $3, $4, $5, $6, '2030-01-31', $6, $6) returning id as v",
    [c.tenant, c.scope, c.kind, c.stage, title, c.member],
  );
/** 前の形の区画の行と版 1 を入れる。位置は種別の区画の物（無い鍵は 500） */
async function sec(c: Co, t: string, key: string, body: Record<string, unknown>, o: { by?: string; at?: string } = {}) {
  const pos = Number(
    (
      await admin.query<{ position: number }>(
        "select position from kind_sections where kind_id = (select kind_id from tickets where id = $1) and section_key = $2",
        [t, key],
      )
    ).rows[0]?.position ?? 500,
  );
  const by = o.by ?? c.member;
  const id = await one(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by, updated_at) values ($1, $2, $3, $4, $5::jsonb, 1, $6, $6, coalesce($7::timestamptz, now())) returning id as v",
    [c.tenant, t, key, pos, JSON.stringify(body), by, o.at ?? null],
  );
  await admin.query(
    "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by, updated_by) values ($1, $2, $3, 1, $4::jsonb, $5, $5, $5)",
    [c.tenant, t, id, JSON.stringify(body), by],
  );
  return id;
}
const move = async (tenant: string) =>
  (await admin.query<{ v: { moved: number; skipped: number } }>("select app.ticket_body_move($1) as v", [tenant]))
    .rows[0]!.v;
const bodyRow = async (t: string) =>
  (
    await admin.query<{
      body: { doc: unknown; text: string };
      version: number;
      position: number;
      deleted_at: string | null;
      created_by: string;
    }>(
      "select body, version, position, deleted_at, created_by from ticket_sections where ticket_id = $1 and section_key = 'body'",
      [t],
    )
  ).rows[0];
const live = (t: string) =>
  n("select count(*) as v from ticket_sections where ticket_id = $1 and deleted_at is null and section_key <> 'body'", [
    t,
  ]);
const dump = async (t: string) =>
  JSON.stringify(
    (await admin.query("select * from ticket_sections where ticket_id = $1 order by section_key", [t])).rows,
  ) +
  JSON.stringify(
    (await admin.query("select * from ticket_section_versions where ticket_id = $1 order by section_id, version", [t]))
      .rows,
  );

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("区画 → 本文 1 枚の移し（app.ticket_body_move）", () => {
  it("K575-DB-001 タスクのチケットを移す：区画の位置の順に 見出し＋中身（箱・箇条書き・段落）。空の相手は出ない。版 1 の行が 1 つ", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "purpose", { text: "月末の請求を出す" });
    await sec(c, t, "done", { text: "- 先方が受け取った" });
    await sec(c, t, "constraints", { text: "- 支払期日は翌月末\n- 送り方はメール" });
    await sec(c, t, "counterpart", { text: "" });
    await sec(c, t, "todo", { text: "- [x] 作る\n- [X] 送る\n- 残す" });
    await sec(c, t, "decisions", { text: "- 割引はしない" });
    await admin.query(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, 'free_ab12', 200, $3::jsonb, 1, $4, $4)",
      [c.tenant, t, JSON.stringify({ text: "調べたこと", label: "調査メモ" }), c.member],
    );
    expect(await move(c.tenant)).toEqual({ moved: 1, skipped: 0 });
    const b = (await bodyRow(t))!;
    expect(b).toMatchObject({ version: 1, position: 0, deleted_at: null, created_by: c.member });
    expect(b.body.doc).toEqual(
      DOC(
        H("目的"),
        P("月末の請求を出す"),
        H("完了の条件"),
        TL([["先方が受け取った", false]]),
        H("前提と制約"),
        BL(["支払期日は翌月末", "送り方はメール"]),
        H("実施事項"),
        TL([
          ["作る", true],
          ["送る", true],
          ["残す", false],
        ]),
        H("決定ログ"),
        BL(["割引はしない"]),
        H("調査メモ"),
        P("調べたこと"),
      ),
    );
    const v = (
      await admin.query<{ version: number; body: unknown }>(
        "select v.version, v.body from ticket_section_versions v join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'body'",
        [t],
      )
    ).rows;
    expect(v).toEqual([{ version: 1, body: b.body }]);
  });
  it("K575-DB-002 実施事項の箱：「- [x] 」「- [X] 」は済み・「- 」と印も「- 」も無い行は未チェック。箱の字に印と「- 」が入らない。text は「[x] 」「[ ] 」", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "todo", { text: "- [x] 作る\n- [X] 送る\n- 残す\nやる" });
    await move(c.tenant);
    const b = (await bodyRow(t))!;
    expect(b.body.doc).toEqual(
      DOC(
        H("実施事項"),
        TL([
          ["作る", true],
          ["送る", true],
          ["残す", false],
          ["やる", false],
        ]),
      ),
    );
    expect(b.body.text).toBe("実施事項\n[x] 作る\n[x] 送る\n[ ] 残す\n[ ] やる");
  });
  it("K575-DB-003 見出しの名前：種別の区画の名前・自由欄の label・種別に鍵が無い区画は鍵のまま。text の区画は行ごとに段落・空行と前後の空白（全角も）は落ちる", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "purpose", { text: "　一行目 \r\n\r\n\t二行目\n" });
    await sec(c, t, "zz_unknown", { text: "鍵だけの区画" });
    await admin.query(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, 'free', 150, $3::jsonb, 1, $4, $4)",
      [c.tenant, t, JSON.stringify({ text: "自由な字", label: "メモ書き" }), c.member],
    );
    await move(c.tenant);
    const b = (await bodyRow(t))!;
    expect(b.body.doc).toEqual(
      DOC(H("目的"), P("一行目"), P("二行目"), H("メモ書き"), P("自由な字"), H("zz_unknown"), P("鍵だけの区画")),
    );
  });
  it("K575-DB-004 空白だけの区画（全角の空白・タブ・改行）は見出しごと出ない。全部の区画が空のチケットは本文の行も版の行も作らず、元の区画は生きたまま", async () => {
    const c = await company();
    const t1 = await ticket(c, "一部が空");
    await sec(c, t1, "purpose", { text: " 　\t\n" });
    await sec(c, t1, "done", { text: "- 条件" });
    const t2 = await ticket(c, "全部が空");
    await sec(c, t2, "purpose", { text: "" });
    await sec(c, t2, "todo", { text: "　 \n\t" });
    expect(await move(c.tenant)).toEqual({ moved: 1, skipped: 0 });
    expect((await bodyRow(t1))!.body.doc).toEqual(DOC(H("完了の条件"), TL([["条件", false]])));
    expect(await bodyRow(t2)).toBeUndefined();
    expect(await live(t2)).toBe(2);
    expect(await n("select count(*) as v from ticket_section_versions where ticket_id = $1", [t2])).toBe(2);
  });
  it("K575-DB-005 成果物（artifacts）の区画は本文に入らず、元の行は生きたまま・中身も版も変わらない。成果物だけのチケットは本文の行を作らない", async () => {
    const c = await company();
    const t1 = await ticket(c, "成果物つき");
    await sec(c, t1, "purpose", { text: "目的の字" });
    const art = await sec(c, t1, "artifacts", { text: "請求書 PDF" });
    const t2 = await ticket(c, "成果物だけ");
    await sec(c, t2, "artifacts", { text: "メールの下書き" });
    const before = JSON.stringify((await admin.query("select * from ticket_sections where id = $1", [art])).rows);
    await move(c.tenant);
    expect(JSON.stringify((await bodyRow(t1))!.body.doc)).not.toContain("請求書");
    expect(JSON.stringify((await admin.query("select * from ticket_sections where id = $1", [art])).rows)).toBe(before);
    expect(await bodyRow(t2)).toBeUndefined();
    expect(await live(t2)).toBe(1);
  });
  it("K575-DB-006 元の区画の行は消さず deleted_at が入り、body・version・position と版の行の数は同じ。失敗 S1 DB に書く：途中で落ちたら全部戻る（本文の行も deleted_at も前のまま）", async () => {
    const c = await company();
    const t1 = await ticket(c, "移る 1");
    const s1 = await sec(c, t1, "purpose", { text: "目的 1" });
    const t2 = await ticket(c, "落ちる 2");
    await sec(c, t2, "purpose", { text: "目的 2" });
    const orig = (await admin.query("select body, version, position from ticket_sections where id = $1", [s1])).rows[0];
    const versions = await n("select count(*) as v from ticket_section_versions where tenant_id = $1", [c.tenant]);
    await admin.query(`create or replace function public.k575_fail() returns trigger language plpgsql as $$ begin
      if new.version = 1 and new.body ? 'doc' and (select title from tickets where id = new.ticket_id) = '落ちる 2' then raise exception 'k575 試験の失敗'; end if; return new; end $$`);
    await admin.query(
      "create trigger k575_fail before insert on ticket_section_versions for each row execute function public.k575_fail()",
    );
    try {
      await expect(move(c.tenant)).rejects.toThrow();
    } finally {
      await admin.query("drop trigger k575_fail on ticket_section_versions");
      await admin.query("drop function public.k575_fail()");
    }
    expect(await bodyRow(t1)).toBeUndefined();
    expect(await live(t1)).toBe(1);
    expect(await live(t2)).toBe(1);
    expect(await move(c.tenant)).toEqual({ moved: 2, skipped: 0 });
    const gone = (
      await admin.query("select body, version, position, deleted_at from ticket_sections where id = $1", [s1])
    ).rows[0];
    expect(gone.deleted_at).not.toBeNull();
    expect({ body: gone.body, version: gone.version, position: gone.position }).toEqual(orig);
    expect(await n("select count(*) as v from ticket_section_versions where tenant_id = $1", [c.tenant])).toBe(
      versions + 2,
    ); // 元の版は同じ・本文の版が 2 つ増える
  });
  it("K575-DB-007 すでに鍵 body の行があるチケット（生きている・消してある）は触らない：本文の行・版・元の区画が同じ・moved に数えない", async () => {
    const c = await company();
    const live1 = await ticket(c, "本文あり");
    await sec(c, live1, "purpose", { text: "区画の字" });
    await sec(c, live1, "body", { doc: DOC(P("もう本文がある")), text: "もう本文がある" });
    const dead = await ticket(c, "本文を消してある");
    await sec(c, dead, "purpose", { text: "区画の字" });
    const bid = await sec(c, dead, "body", { doc: DOC(P("消した本文")), text: "消した本文" });
    await admin.query("update ticket_sections set deleted_at = now() where id = $1", [bid]);
    const before = [await dump(live1), await dump(dead)];
    expect(await move(c.tenant)).toEqual({ moved: 0, skipped: 0 });
    expect([await dump(live1), await dump(dead)]).toEqual(before);
  });
  it("K575-DB-008 同じ会社に 2 回続けて呼ぶ：2 回目は moved も skipped も 0 で、本文の行・版の行・区画の行の数が 1 回目の後と同じ", async () => {
    const c = await company();
    for (const title of ["一", "二"]) await sec(c, await ticket(c, title), "purpose", { text: `${title}の目的` });
    expect(await move(c.tenant)).toEqual({ moved: 2, skipped: 0 });
    const counts = async () => [
      await n("select count(*) as v from ticket_sections where tenant_id = $1", [c.tenant]),
      await n("select count(*) as v from ticket_section_versions where tenant_id = $1", [c.tenant]),
    ];
    const after = await counts();
    expect(await move(c.tenant)).toEqual({ moved: 0, skipped: 0 });
    expect(await counts()).toEqual(after);
  });
  it("K575-DB-009 チケットの列：移す前と後で tickets の行が 1 字も変わらず、やり取り・証跡・お知らせの行は増えない", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "purpose", { text: "目的" });
    const row = async () => JSON.stringify((await admin.query("select * from tickets where id = $1", [t])).rows);
    const side = async () => [
      await n("select count(*) as v from ticket_messages where tenant_id = $1", [c.tenant]),
      await n("select count(*) as v from audit_events where tenant_id = $1", [c.tenant]),
      await n("select count(*) as v from notifications where tenant_id = $1", [c.tenant]),
    ];
    const before = [await row(), await side()];
    await move(c.tenant);
    expect([await row(), await side()]).toEqual(before);
  });
  it("K575-DB-010 別の会社：会社 a に呼んでも会社 b のチケットは移らない。会社 b に呼べば移る", async () => {
    const a = await company();
    const b = await company();
    const ta = await ticket(a);
    const tb = await ticket(b);
    await sec(a, ta, "purpose", { text: "a の目的" });
    await sec(b, tb, "purpose", { text: "b の目的" });
    const before = await dump(tb);
    expect(await move(a.tenant)).toEqual({ moved: 1, skipped: 0 });
    expect(await dump(tb)).toBe(before);
    expect(await bodyRow(tb)).toBeUndefined();
    expect(await move(b.tenant)).toEqual({ moved: 1, skipped: 0 });
  });
  it("K575-DB-011 本文が上限（大きさ 1,048,576 バイト）を超える（約 1.2MB の 1 区画）チケットは区画のまま・skipped に数える。ふつうのチケットは移る。落ちない", async () => {
    const c = await company();
    const big = await ticket(c, "大きい");
    await sec(c, big, "constraints", { text: "あ".repeat(400_000) }); // UTF-8 で約 1.2MB（節の数の上限は無い・大きさだけが上限）
    const ok = await ticket(c, "ふつう");
    await sec(c, ok, "purpose", { text: "ふつうの目的" });
    expect(await move(c.tenant)).toEqual({ moved: 1, skipped: 1 });
    expect(await bodyRow(big)).toBeUndefined();
    expect(await live(big)).toBe(1);
    expect(await bodyRow(ok)).toBeDefined();
  });
  it("K575-DB-012 消したチケット・完了したチケットも移る：本文の行が書かれ、元の区画に deleted_at が入る（消した・完了のまま）", async () => {
    const c = await company();
    const del = await ticket(c, "消した");
    const done = await ticket(c, "完了");
    for (const t of [del, done]) await sec(c, t, "purpose", { text: `${t} の目的` });
    await admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [del, c.member]);
    await admin.query(
      "update tickets t set stage_id = s.id, completed_at = now(), completed_by = t.assignee_member_id from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'",
      [done],
    );
    expect(await move(c.tenant)).toEqual({ moved: 2, skipped: 0 });
    for (const t of [del, done]) {
      expect(await bodyRow(t)).toBeDefined();
      expect(await live(t)).toBe(0);
    }
    expect(await n("select count(*) as v from tickets where id = $1 and deleted_at is not null", [del])).toBe(1);
    expect(await n("select count(*) as v from tickets where id = $1 and completed_at is not null", [done])).toBe(1);
  });
  it("K575-DB-013 版の行：版 1・edited_by は区画のうち最後に直した人・edited_by_clone が false・restored_from が空・中身は本文の行と同じ", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "purpose", { text: "古い区画" }, { by: c.member, at: "2026-01-01T00:00:00Z" });
    await sec(c, t, "done", { text: "- 新しい区画" }, { by: c.member2, at: "2026-06-01T00:00:00Z" });
    await move(c.tenant);
    const b = (await bodyRow(t))!;
    const v = (
      await admin.query<{
        version: number;
        edited_by: string;
        edited_by_clone: boolean;
        restored_from: number | null;
        body: unknown;
      }>(
        "select v.version, v.edited_by, v.edited_by_clone, v.restored_from, v.body from ticket_section_versions v join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'body'",
        [t],
      )
    ).rows;
    expect(v).toEqual([
      { version: 1, edited_by: c.member2, edited_by_clone: false, restored_from: null, body: b.body },
    ]);
  });
  it("K575-DB-014 移した全部の行の形：doc が validateDoc を通り、docToText(doc) が text と同じ・app.ticket_body_valid が真", async () => {
    const c = await company();
    const t = await ticket(c);
    await sec(c, t, "purpose", { text: "目的\n二行" });
    await sec(c, t, "done", { text: "- [x] 済み\n- 未" });
    await sec(c, t, "constraints", { text: "- 一\n- 二" });
    await sec(c, t, "tests", { text: "| 項目 | 結果 |\n| 金額 | 通過 |" });
    await sec(c, await ticket(c, "二つ目"), "todo", { text: "- [x] a" });
    await move(c.tenant);
    const rows = (
      await admin.query<{ body: { doc: never; text: string } }>(
        "select body from ticket_sections where tenant_id = $1 and section_key = 'body'",
        [c.tenant],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(validateDoc(r.body.doc).ok).toBe(true);
      expect(r.body.text).toBe(docToText(r.body.doc));
      expect(await one<boolean>("select app.ticket_body_valid($1::jsonb) as v", [JSON.stringify(r.body)])).toBe(true);
    }
  });
  it("K575-DB-015 関数の権限：kaname_app は app.ticket_body_move・app.ticket_body_build を実行できない。管理者の接続は呼べる", async () => {
    for (const fn of ["app.ticket_body_move(uuid)", "app.ticket_body_build(uuid)"])
      expect(await one<boolean>("select has_function_privilege('kaname_app', $1, 'execute') as v", [fn])).toBe(false);
    await expect(app.query("select app.ticket_body_move(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    expect(await move((await company()).tenant)).toEqual({ moved: 0, skipped: 0 });
  });
  it("K575-DB-016 この会社に流した後：鍵が body・artifacts でない生きた区画の行は、空の区画（全部空のチケットの物・K575-DB-004 で生きたまま）と skipped のチケットの分を除いて 0 件。migration の本文に全部の会社へ呼ぶ文がある", async () => {
    const c = await company();
    await sec(c, await ticket(c, "一"), "purpose", { text: "目的" });
    await sec(c, await ticket(c, "二"), "todo", { text: "- 実施" });
    await move(c.tenant); // 他の試験の会社には触らない（全部の会社への呼び出しは migration の本文で確かめる）
    // 空の区画（text が空白だけ）は本文に入らず生きたまま残る（K575-DB-004）ので数えない。skipped のチケットの分は試験の会社には無い
    expect(
      await n(
        "select count(*) as v from ticket_sections where tenant_id = $1 and deleted_at is null and section_key not in ('body', 'artifacts') and btrim(coalesce(body->>'text', ''), E' \t\r\n　') <> ''",
        [c.tenant],
      ),
    ).toBe(0);
    const sql = readFileSync(join(here, "..", "migrations", "20261122101500_ticket_body_move.sql"), "utf8");
    expect(sql).toMatch(/select\s+app\.ticket_body_move\(\s*id\s*\)\s+from\s+tenants/i);
  });
});

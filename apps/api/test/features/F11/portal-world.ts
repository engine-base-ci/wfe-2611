// 段 12 の先方の場所の口（K-906〜K-910）の試験が共に使う道具（K-906 が持ち込む・K-907〜K-910 も読む）。
//   会社・社内の人（メール付き）・ゲストのグループ・ゲスト・チケット（段・本文・詳細つき）・見せる相手・依頼を、本物の DB に作る。
//   口は網の手前で差し替えない（契約の入口 createApp と偽の画面のログインで叩く）。口の振る舞いは葉の hooks のファイルを動的 import して足す。
//   探したが無かった：先方の場所の口を叩く土台は apps/api/test/features に無い（似た物は F11/ticket-guest-shares.test.ts の world・guest）。
//   表の名前・列は K-876（guest_groups・guest_group_members）・K-878（client_requests.guest_group_id）・K-881（ticket_guest_shares）・
//   K-882（ticket_messages.guest_visible）・K-892（client_request_messages）が決めた物。変わるときはこのファイルの 1 か所を直す。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateAuth } from "@kaname/auth/migrate";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture, Person } from "../fixture.js";

export type P = Person & { email: string; authUserId: string };
export type Json = Record<string, unknown>;
export const asJson = async (r: Response): Promise<Json> => (await r.clone().json()) as Json;
/** 断りの答えに、欄・details を付けない（在るかどうかを漏らさない） */
export const hasNoDetail = (j: Json): boolean => !["field", "details", "detail"].some((k) => k in j);
export const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

/** 口のメール送りの偽。届いた物は mails に溜まる */
export const mails: { to: string; subject: string; text: string }[] = [];
let authReady = false;
export async function ensureAuth(): Promise<void> {
  if (authReady) return;
  await migrateAuth(process.env["DATABASE_URL"]!);
  authReady = true;
}
/** 葉の hooks のファイル（apps/api/src/hooks/<file>.ts）の register を、試験の土台に足す。extra は口の材料（objects など） */
export async function useHooks(f: Fixture, file: string, extra: Partial<HookDeps> = {}): Promise<void> {
  const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
  const mailer = async (x: { to: string; subject: string; text: string }) => {
    mails.push(x);
  };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool, mailer, ...extra } as unknown as HookDeps));
}

export interface World {
  tenantId: string;
  root: string;
  /** ゲストの依頼が届く社内のグループ（ゲストのグループ gA・gB が持つ） */
  reqScope: string;
  gA: string;
  gB: string;
  boss: P; // 全体に書ける・admin
  staff: P; // reqScope のマネージャー（メールあり・依頼の知らせの宛先）
}
/** 人を 1 人作る（認証のアカウント・members・tenant_memberships）。role は役割（requester＝ゲスト） */
export async function make(
  f: Fixture,
  tenantId: string,
  scope: string,
  name: string,
  o: { role?: string; status?: string; ability?: "edit" | "view" | null } = {},
): Promise<P> {
  await ensureAuth();
  const authUserId = randomUUID();
  const email = `p-${authUserId.slice(0, 10)}@portal.example`;
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [authUserId, name, email],
  );
  const p = await f.person(tenantId, scope, { name, authUserId, ticketAbility: o.ability ?? null });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
    [tenantId, p.id, authUserId, o.role ?? "member", o.status ?? "active"],
  );
  return { ...p, email, authUserId };
}
export async function group(
  f: Fixture,
  w: { tenantId: string; reqScope: string },
  name: string,
  o: { scope?: string; deleted?: boolean } = {},
): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [w.tenantId, `${name}${randomUUID().slice(0, 4)}`, o.scope ?? w.reqScope, o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
}
export async function world(f: Fixture, tag: string): Promise<World> {
  const c = await f.company(`ポータル試験 ${tag} ${randomUUID().slice(0, 5)}`, "PT");
  const reqScope = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '営業', 'PS', $2) returning id",
      [c.tenantId, c.rootScope],
    )
  ).rows[0]!.id;
  const boss = await make(f, c.tenantId, c.rootScope, "高本", { role: "admin", ability: "edit" });
  const staff = await make(f, c.tenantId, reqScope, "営業の人", { ability: "edit" });
  await f.admin.query(
    "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'manager')",
    [c.tenantId, staff.id, reqScope],
  );
  const base = { tenantId: c.tenantId, reqScope };
  return { tenantId: c.tenantId, root: c.rootScope, reqScope, boss, staff, gA: await group(f, base, "Ａ社"), gB: await group(f, base, "Ｂ社") };
}
/** ゲスト（役割 requester）。g が null ならグループに入れない */
export async function guest(f: Fixture, w: World, name: string, g: string | null, o: { status?: string } = {}): Promise<P> {
  const p = await make(f, w.tenantId, w.root, name, { role: "requester", status: o.status ?? "active" });
  if (g)
    await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
      w.tenantId,
      g,
      p.id,
    ]);
  return p;
}
export const asG = (f: Fixture, p: Person): Record<string, string> => f.as(p, "client");
export const asM = (f: Fixture, p: Person): Record<string, string> => f.as(p, "member");

export interface TicketOpt {
  title?: string;
  /** ticket_stages.key。null は鍵の無い（会社が自分で作った）段 */
  stageKey?: string | null;
  body?: string;
  detail?: string;
  deleted?: boolean;
  due?: string;
}
export async function ticket(f: Fixture, w: World, o: TicketOpt = {}): Promise<string> {
  const stageSql =
    o.stageKey === null
      ? "(select id from ticket_stages where tenant_id = $1 and key is null limit 1)"
      : "(select id from ticket_stages where tenant_id = $1 and key = $5)";
  const params: unknown[] = [w.tenantId, w.root, o.title ?? "見せるチケット", o.deleted ? new Date() : null];
  if (o.stageKey !== null) params.push(o.stageKey ?? "doing");
  params.push(o.due ?? "2026-12-26");
  const dueIdx = params.length;
  const id = (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, deleted_at, due_on)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'), ${stageSql}, $3, $4, $${dueIdx}::date
       returning id`,
      params,
    )
  ).rows[0]!.id;
  await section(f, w, id, "body", o.body ?? "本文のもと");
  if (o.detail !== undefined) await section(f, w, id, "detail", o.detail);
  return id;
}
export async function section(f: Fixture, w: World, ticketId: string, key: string, text: string): Promise<void> {
  const body = key === "body" ? { doc: { type: "doc", content: [] }, text } : { text };
  await f.admin.query(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, body) values ($1, $2, $3, $4::jsonb) on conflict (ticket_id, section_key) do update set body = excluded.body",
    [w.tenantId, ticketId, key, JSON.stringify(body)],
  );
}
/** 見せる相手（K-881）。removed を付けると、外した行になる */
export async function share(f: Fixture, w: World, t: string, g: string, o: { removed?: boolean } = {}): Promise<void> {
  await f.admin.query(
    "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by, deleted_at) values ($1, $2, $3, $4, $5)",
    [w.tenantId, t, g, w.boss.id, o.removed ? new Date() : null],
  );
}
/** チケットのチャットの 1 件（K-882：guest_visible が true の書き込みだけゲストに見える） */
export async function chat(
  f: Fixture,
  w: World,
  t: string,
  by: Person,
  text: string,
  o: { visible?: boolean; kind?: string; ago?: string; fromRequest?: boolean } = {},
): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, guest_visible, created_at, from_request)
       values ($1, $2, $3, $4, $5, $6, now() - $7::interval, $8) returning id`,
      [w.tenantId, t, by.id, o.kind ?? "post", text, o.visible ?? true, o.ago ?? "0 seconds", o.fromRequest ?? false],
    )
  ).rows[0]!.id;
}
/** 依頼（ゲストのグループの依頼）。ticketId を付けると「受けてチケットにした」依頼 */
export async function request(
  f: Fixture,
  w: World,
  g: string,
  by: Person,
  o: { title?: string; state?: string; ticketId?: string; routed?: string } = {},
): Promise<string> {
  const state = o.state ?? (o.ticketId ? "ticketed" : "new");
  return (
    await f.admin.query<{ id: string }>(
      `insert into client_requests (tenant_id, guest_group_id, title, body, state, ticket_id, decline_reason, routed_scope_id, created_by)
       values ($1, $2, $3, $3, $4, $5, $6, $7, $8) returning id`,
      [w.tenantId, g, o.title ?? "依頼のたいとる", state, o.ticketId ?? null, state === "declined" ? "今回は受けられません" : null, o.routed ?? null, by.id],
    )
  ).rows[0]!.id;
}
/** 依頼のやり取りの 1 件（K-892 の client_request_messages）。side は guest か company */
export async function requestMsg(
  f: Fixture,
  w: World,
  rid: string,
  side: "guest" | "company",
  by: Person,
  text: string,
  o: { ago?: string } = {},
): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id, created_at)
       values ($1, $2, $3, 'message', $4, $5, now() - $6::interval) returning id`,
      [w.tenantId, rid, side, text, by.id, o.ago ?? "0 seconds"],
    )
  ).rows[0]!.id;
}
export const n = async (f: Fixture, sql: string, p: unknown[] = []): Promise<number> =>
  Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
/** その人の受け箱（inapp）の行の数（種類で絞る） */
export const inbox = (f: Fixture, memberId: string, kind: string): Promise<number> =>
  n(
    f,
    "select count(*) as n from notifications where member_id = $1 and channel_id = 'inapp' and event_kind_id = $2 and deleted_at is null",
    [memberId, kind],
  );
export const count = (f: Fixture, table: string, where = "true", p: unknown[] = []): Promise<number> =>
  n(f, `select count(*) as n from ${table} where ${where}`, p);
/** 追加（insert）のとき例外を出す引き金を 1 つ付けて fn を流し、必ず外す（途中の失敗の再現） */
export async function failOn(f: Fixture, table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k9_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K9 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}

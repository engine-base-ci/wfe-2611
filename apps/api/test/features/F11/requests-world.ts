// 段 12 の届いた依頼の口（K-892〜K-897）の試験が共に使う道具（K-892 が持ち込む・K-893〜K-897 も読む）。
//   会社・社内の人（全体に書ける人・届け先で書ける人・読むだけの人・別のグループの人）・ゲストのグループ（届け先が違う 2 つ）・ゲスト・チケット・依頼・依頼のやり取り・Bridge の生存を、本物の DB に作る。
//   口は網の手前で差し替えない（契約の入口 createApp と偽の画面のログインで叩く）。口の振る舞いは葉の hooks のファイルを動的 import して足す。
//   表の名前・列は K-876（guest_groups・guest_group_members）・K-878（client_requests.guest_group_id）・K-881（ticket_guest_shares）・K-892（client_request_messages・案の列）が決めた物。
//   変わるときはこのファイルの 1 か所を直す。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture, Person } from "../fixture.js";

export type Json = Record<string, unknown>;
export const asJson = async (r: Response): Promise<Json> => (await r.clone().json()) as Json;
/** 断りの答えに、欄・details を付けない（在るかどうかを漏らさない） */
export const hasNoDetail = (j: Json): boolean => !["field", "details", "detail"].some((k) => k in j);
export const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
export const NO_SUCH = "00000000-0000-4000-8000-0000000000ee";

/** 口のメール送りの偽。届いた物は mails に溜まる（既定は送れる。fail を立てると送れずに例外） */
export const mails: { to: string; subject: string; text: string }[] = [];
export const mailer = { fail: false };
/** 葉の hooks のファイル（apps/api/src/hooks/<file>.ts）の register を、試験の土台に足す。extra は口の材料 */
export async function useHooks(f: Fixture, file: string, extra: Partial<HookDeps> = {}): Promise<void> {
  const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
  const send = async (x: { to: string; subject: string; text: string }) => {
    if (mailer.fail) throw new Error("試験：メールが送れない");
    mails.push(x);
  };
  Object.assign(
    f.hooks,
    m.register.make({
      appPool: f.pool,
      mailer: send,
      config: { webBaseUrl: "http://localhost:3123" },
      ...extra,
    } as unknown as HookDeps),
  );
}

export interface RW {
  tenantId: string;
  root: string;
  reqScope: string; // ゲストのグループ gA の届け先（営業）
  otherScope: string; // ゲストのグループ gB の届け先（経理）
  boss: Person; // 管理者（会社全体の edit）
  staff: Person; // 営業の人（届け先 reqScope で client_requests を edit できる）
  viewer: Person; // 営業の人（読むだけ）
  outsider: Person; // 経理の人（営業の依頼は見えない）
  gA: string;
  gB: string;
}
async function person(
  f: Fixture,
  tenantId: string,
  scope: string,
  name: string,
  role: string,
  o: { ability?: "edit" | "view" | null; scopeRole?: string } = {},
): Promise<Person> {
  const p = await f.person(tenantId, scope, { name, ticketAbility: o.ability ?? null });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, $3, 'active')",
    [tenantId, p.id, role],
  );
  await f.admin.query(
    `insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role)
     select $1, $2, $3, true, $4 where not exists (select 1 from scope_memberships where member_id = $2 and scope_id = $3)`,
    [tenantId, p.id, scope, o.scopeRole ?? "member"],
  );
  return p;
}
/** その人に、そのグループで ability（edit など）を付ける。target は既定が client_requests */
export async function perm(
  f: Fixture,
  w: { tenantId: string },
  p: Person,
  scope: string | null,
  ability = "edit",
  target = "client_requests",
): Promise<void> {
  await f.admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, $3, $4, $5)",
    [w.tenantId, p.id, target, scope, ability],
  );
}
const group = async (f: Fixture, tenantId: string, name: string, scope: string): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3) returning id",
      [tenantId, `${name}${randomUUID().slice(0, 4)}`, scope],
    )
  ).rows[0]!.id;
export async function world(f: Fixture, tag: string): Promise<RW> {
  const c = await f.company(`依頼試験 ${tag} ${randomUUID().slice(0, 5)}`, "RQ");
  const mk = async (name: string, prefix: string) =>
    (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, $2, $3, $4) returning id",
        [c.tenantId, name, prefix, c.rootScope],
      )
    ).rows[0]!.id;
  const [reqScope, otherScope] = [await mk("営業", "RS"), await mk("経理", "RK")];
  const boss = await person(f, c.tenantId, c.rootScope, "高本", "admin", { ability: "edit" });
  const staff = await person(f, c.tenantId, reqScope, "営業の人", "member", { ability: "edit", scopeRole: "manager" });
  await perm(f, c, staff, reqScope);
  const viewer = await person(f, c.tenantId, reqScope, "読むだけの人", "viewer", {
    ability: "view",
    scopeRole: "viewer",
  });
  const outsider = await person(f, c.tenantId, otherScope, "経理の人", "member", { ability: "edit" });
  return {
    tenantId: c.tenantId,
    root: c.rootScope,
    reqScope,
    otherScope,
    boss,
    staff,
    viewer,
    outsider,
    gA: await group(f, c.tenantId, "Ａ社", reqScope),
    gB: await group(f, c.tenantId, "Ｂ社", otherScope),
  };
}
/** ゲスト（役割 requester）。g が null ならグループに入れない */
export async function guest(
  f: Fixture,
  w: RW,
  name: string,
  g: string | null,
  o: { status?: string } = {},
): Promise<Person> {
  const p = await f.person(w.tenantId, w.root, { name });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, 'requester', $3)",
    [w.tenantId, p.id, o.status ?? "active"],
  );
  if (g)
    await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
      w.tenantId,
      g,
      p.id,
    ]);
  return p;
}
export const asM = (f: Fixture, p: Person): Record<string, string> => f.as(p, "member");
export const asG = (f: Fixture, p: Person): Record<string, string> => f.as(p, "client");
export async function ticket(f: Fixture, w: RW, o: { title?: string; assignee?: string | null } = {}): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = 'doing'), $3, $4 returning id`,
      [w.tenantId, w.root, o.title ?? "依頼から作ったチケット", o.assignee ?? null],
    )
  ).rows[0]!.id;
}
export interface ReqOpt {
  title?: string;
  body?: string;
  state?: "new" | "asking" | "ticketed" | "declined";
  ticketId?: string;
  routed?: string | null;
  deleted?: boolean;
  ago?: string;
  draft?: { state: "pending" | "ready" | "failed"; draft?: Json } | null;
}
/** 依頼（ゲストのグループの依頼）。ticketed は ticketId を付けなければ作ったチケットを自動で結ぶ */
export async function request(f: Fixture, w: RW, g: string, by: Person, o: ReqOpt = {}): Promise<string> {
  const state = o.state ?? "new";
  const tid = state === "ticketed" ? (o.ticketId ?? (await ticket(f, w))) : (o.ticketId ?? null);
  return (
    await f.admin.query<{ id: string }>(
      `insert into client_requests (tenant_id, guest_group_id, title, body, state, ticket_id, decline_reason, routed_scope_id, created_by, deleted_at, created_at, updated_at, draft_state, draft)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now() - $11::interval, now() - $11::interval, $12, $13::jsonb) returning id`,
      [
        w.tenantId,
        g,
        o.title ?? "依頼のたいとる",
        o.body ?? "依頼の本文です",
        state,
        tid,
        state === "declined" ? "今回は受けられません" : null,
        o.routed ?? null,
        by.id,
        o.deleted ? new Date() : null,
        o.ago ?? "0 seconds",
        o.draft?.state ?? null,
        o.draft?.draft ? JSON.stringify(o.draft.draft) : null,
      ],
    )
  ).rows[0]!.id;
}
/** 依頼のやり取りの 1 件。side は guest か company */
export async function requestMsg(
  f: Fixture,
  w: RW,
  rid: string,
  side: "guest" | "company",
  by: Person,
  text: string,
  o: { ago?: string; deleted?: boolean } = {},
): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id, created_at, deleted_at)
       values ($1, $2, $3, 'message', $4, $5, now() - $6::interval, $7) returning id`,
      [w.tenantId, rid, side, text, by.id, o.ago ?? "0 seconds", o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
}
/** その人の Bridge（PC）のセッションを 1 つ作る。既定は生きている物（生きた知らせが今届いた＝`app.account_pc_live` が true）。revoked を付けると失効した物・quiet を付けると失効していないが最後の知らせが 3 分前（75 秒より前から静か）の物 */
export async function bridge(
  f: Fixture,
  w: RW,
  p: Person,
  o: { revoked?: boolean; quiet?: boolean } = {},
): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      `insert into sessions (tenant_id, member_id, kind_id, auth_session_id, alive_at, last_seen_at, revoked_at, revoke_reason_id)
       values ($1, $2, 'bridge', $3, now() - $4::interval, now() - $4::interval, $5, $6) returning id`,
      [
        w.tenantId,
        p.id,
        `br-${randomUUID()}`,
        o.quiet ? "3 minutes" : "0 seconds",
        o.revoked ? new Date() : null,
        o.revoked ? "logout" : null,
      ],
    )
  ).rows[0]!.id;
}
/** その人の PC（Bridge）を、PC の印つきで作る（x-bridge-session に載せる印。形は kpc_ ＋ 43 字・DB には印のハッシュだけ）。device の口を PC として叩くのに使う */
export async function device(
  f: Fixture,
  w: RW,
  p: Person,
  o: { revoked?: boolean } = {},
): Promise<{ sessionId: string; headers: Record<string, string> }> {
  const token = `kpc_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const sessionId = (
    await f.admin.query<{ id: string }>(
      "insert into sessions (tenant_id, member_id, kind_id, auth_session_id, device_token_hash, revoked_at, revoke_reason_id) values ($1, $2, 'bridge', $3, $4, $5, $6) returning id",
      [w.tenantId, p.id, `pc-${randomUUID()}`, hash, o.revoked ? new Date() : null, o.revoked ? "logout" : null],
    )
  ).rows[0]!.id;
  return { sessionId, headers: { "x-bridge-session": token } };
}
/** 案の仕事（kind client_request_draft）を 1 つ、依頼に結んで入れる。state は動いている（running）か待っている（queued）など。依頼の draft_state は pending にして draft_job_id を結ぶ */
export async function draftJob(
  f: Fixture,
  w: RW,
  rid: string,
  p: Person,
  o: { state?: string; kind?: string; link?: boolean } = {},
): Promise<string> {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into bridge_jobs (tenant_id, member_id, prompt, kind, client_request_id, state_id, started_at, created_by) values ($1, $2, 'データ', $3, $4, $5, now(), $2) returning id",
      [w.tenantId, p.id, o.kind ?? "client_request_draft", rid, o.state ?? "running"],
    )
  ).rows[0]!.id;
  if (o.link !== false)
    await f.admin.query(
      "update client_requests set draft_state = 'pending', draft_job_id = $2, draft_at = now() where id = $1",
      [rid, id],
    );
  return id;
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
/** 追加（insert）のとき例外を出す引き金を 1 つ付けて fn を流し、必ず外す（途中の失敗の再現） */
export async function failOn(f: Fixture, table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k9r_fail_${randomUUID().replaceAll("-", "")}`;
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

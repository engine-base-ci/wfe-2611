// 段 7「やり取りの口」（K-383 読む・K-384 最後に開いた時刻・K-385 書く・K-386 直す・消す・☆）の試験の共通の土台（K-383 が carry で運ぶ）。
//   行（it）は葉ごとのファイル thread-timeline.test.ts（K-383）・thread-seen.test.ts（K-384）・thread-post.test.ts（K-385）・thread-edit.test.ts（K-386）にある。
//   土台は各ファイルの頭で setupThread([使う hooks のファイルの名前]) を 1 回呼ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-57・K-60 の土台（apps/api/test/features/fixture.ts）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・
//   本物の口の振る舞い（葉ごとの hooks のファイル apps/api/src/hooks/<名前>.ts の register・K-326）。画面のログインだけは偽（fixture の Bearer fake）。
//   口の振る舞いの読み込みは、最初の要求の前に 1 回だけする（準備 beforeAll で読まない）。実装の前（切る段の smoke）に、
//   まだ無いファイルを準備で読みに行って準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
//   準備（beforeAll）は今ある表と列だけを使う（この段で足す列・表は試験の本体の中でだけ使う）。
//
// 人とグループ（会社 T の中。チケットは「開発」のグループに置く）:
//   boss     高本  開発・チケットの edit（担当者にすることが多い）
//   writer   佐藤  開発・チケットの edit
//   viewer   鈴木  開発・チケットの view（閲覧のみ。チケットは読めるが書けない＝app.ticket_writable が false）
//   manager  田中  開発・チケットの edit・開発のマネージャー（scope_memberships の manager・app.manages_scope が true）
//   stranger 伊藤  営業（開発と同じ親の別のグループ）・権限なし（開発のチケットは見えない）
//   outsider 別の会社の人（会社 O）
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

export type { Person } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

/** 土台（fixture.ts の Fixture）に、葉の hooks のファイル（apps/api/src/hooks/<file>.ts の register）を足す。
 *  ファイルは最初の要求の前に 1 回だけ読む（準備で読まない）。共有の試験 k144 の葉のファイル（contract/k144.d/K-38x.ts の setup）も同じ物を呼ぶ。
 *  やり取りの口が使う材料は appPool だけ（ほかの欄は使わない） */
export function addThreadHooks(f: Pick<Fixture, "pool" | "hooks" | "req">, files: readonly string[]): void {
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of files) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    }
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

export type Company = { tenantId: string; rootScope: string };
export type J = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown> };
export interface Ticket {
  id: string;
  number: string;
  tenant: string;
  scope: string;
}
/** 人の出し方（名前・呼ばれ方。会社から外れた人も出る・D-128.96・D-128.58） */
export interface Who {
  member_id: string;
  display_name: string | null;
  call_name: string | null;
}
/** 書き込み・仕組みの行の中身（変更の 1 行・AI の実行・消した跡は null） */
export interface MessageView {
  body: string;
  mentions: Who[];
  notified: Who[];
  quote: { id: string; excerpt: string } | null;
  edited_at: string | null;
  stars: number;
  starred: boolean;
  is_new: boolean;
  decided: boolean;
  can_edit: boolean;
  can_delete: boolean;
}
/** やり取りの 1 件の答え（K-383 の TimelineItem。画面の試験の道具 apps/web/tests/k/thread-mock.ts と同じ形） */
export interface Item {
  id: string;
  kind: "post" | "change" | "system" | "run" | "deleted";
  at: string;
  actor: Who | null;
  message: MessageView | null;
  changes: { field: string; from: string | null; to: string | null; note?: string | null }[] | null;
  run: { id: string; summary: string; started_at: string | null; finished_at: string | null; minutes: number | null; result: string } | null;
  deleted: { by: Who; author: Who; by_manager: boolean } | null;
}
/** 答えの 1 件の鍵（K-383・K-385・K-386 の答えは全部この形） */
export const ITEM_KEYS = ["actor", "at", "changes", "deleted", "id", "kind", "message", "run"];
export const MESSAGE_KEYS = [
  "body",
  "can_delete",
  "can_edit",
  "decided",
  "edited_at",
  "is_new",
  "mentions",
  "notified",
  "quote",
  "starred",
  "stars",
];
/** 人の出し方（試験の人は呼ばれ方を持たない） */
export const who = (p: { id: string }, name: string): Who => ({ member_id: p.id, display_name: name, call_name: null });

export interface ThreadKit {
  f: Fixture;
  T: Company;
  /** 会社 T の「開発」のグループ（チケットの置き場） */
  dev: string;
  /** 会社 T の「営業」のグループ（stranger の居場所） */
  sales: string;
  O: Company;
  boss: Person;
  writer: Person;
  viewer: Person;
  manager: Person;
  stranger: Person;
  outsider: Person;
  /** 契約の口を叩く（path は /api/v1 から） */
  req: (p: Person | null, method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  json: (r: Response) => Promise<J>;
  one: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R>;
  num: (sql: string, p?: unknown[]) => Promise<number>;
  /** 新しい人（試験どうしで人を使い回さない） */
  person: (name: string, o?: { scope?: string; ability?: "edit" | "view" | null; company?: Company }) => Promise<Person>;
  ticket: (o?: { scope?: string; tenant?: string; assignee?: Person; creator?: Person; stage?: string; title?: string }) => Promise<Ticket>;
  /** やり取りの 1 行を DB に直に入れる（口を使わない・行の守りの外）。at は今から何分前か */
  post: (
    t: Ticket,
    by: Person | null,
    o?: {
      body?: string;
      kind?: "post" | "change" | "system";
      at?: number;
      mentions?: Person[];
      changes?: unknown[];
      quoteOf?: string;
      reactions?: Record<string, unknown>;
    },
  ) => Promise<string>;
  /** AI の実行を 1 件、DB に直に置く（K-62 の作る段が終わった形の一部：仕事と実行の記録）。at は今から何分前か */
  run: (t: Ticket, by: Person, o?: { at?: number; status?: string }) => Promise<string>;
  /** この試験の中だけ app.ticket_visible を「この題名のチケットなら例外」に作り替え、終わったら元の定義に戻す（守りの判定が落ちた・D-136.1） */
  breakVisible: <R>(title: string, body: () => Promise<R>) => Promise<R>;
}

let ipSeq = 0;
/** 試験ごとに別の IP（上限の数え方を試験どうしで混ぜない） */
export const ownIp = (): string => `198.51.100.${(ipSeq = (ipSeq % 250) + 1)}`;

/** 各試験のファイルの頭で 1 回呼ぶ。beforeAll で組み立て、afterAll で閉じる。hooks は使う葉の hooks のファイルの名前（拡張子なし） */
export function setupThread(hooks: readonly string[]): ThreadKit {
  const k = {} as ThreadKit;
  beforeAll(async () => {
    const f = await makeFixture();
    addThreadHooks(f, hooks);
    k.f = f;
    k.T = await f.company("K38x の会社", "TL");
    k.O = await f.company("K38x の別の会社", "OT");
    const scope = async (name: string, prefix: string) =>
      (
        await f.admin.query<{ id: string }>(
          "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
          [k.T.tenantId, k.T.rootScope, name, prefix],
        )
      ).rows[0]!.id;
    k.dev = await scope("開発", "DV");
    k.sales = await scope("営業", "SL");
    k.boss = await f.person(k.T.tenantId, k.dev, { name: "高本", ticketAbility: "edit" });
    k.writer = await f.person(k.T.tenantId, k.dev, { name: "佐藤", ticketAbility: "edit" });
    k.viewer = await f.person(k.T.tenantId, k.dev, { name: "鈴木", ticketAbility: "view" });
    k.manager = await f.person(k.T.tenantId, k.dev, { name: "田中", ticketAbility: "edit" });
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [k.T.tenantId, k.dev, k.manager.id],
    );
    k.stranger = await f.person(k.T.tenantId, k.sales, { name: "伊藤" });
    k.outsider = await f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    // 1 人が 1 分に 60 回より多く叩く試験がある。上限は各ファイルの上限の行だけで確かめ、ほかでは上げておく
    for (const op of [
      "listTicketTimeline",
      "markTicketTimelineSeen",
      "createTicketMessage",
      "updateTicketMessage",
      "deleteTicketMessage",
      "starTicketMessage",
    ])
      f.limits[op] = 10_000;
  }, 120_000);
  afterAll(async () => {
    await k.f?.close();
  });

  k.req = (p, method, path, body, headers = {}) =>
    k.f.req(method, path, {
      ...(body === undefined ? {} : { body }),
      headers: { ...(p ? p.auth : {}), ...headers },
      ip: ownIp(),
    });
  k.json = async (r) => (await r.clone().json()) as J;
  k.one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    (await k.f.admin.query(sql, p)).rows[0] as R;
  k.num = async (sql, p = []) => Number((await k.one<{ n: string }>(sql, p)).n);
  k.person = (name, o = {}) =>
    k.f.person(o.company?.tenantId ?? k.T.tenantId, o.scope ?? o.company?.rootScope ?? k.dev, {
      name,
      ticketAbility: o.ability === undefined ? "edit" : o.ability,
    });
  k.ticket = async (o = {}) => {
    const tenant = o.tenant ?? k.T.tenantId;
    const scope = o.scope ?? k.dev;
    const kind = await k.one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [tenant],
    );
    const stage = await k.one<{ id: string }>(
      "select id from ticket_stages where tenant_id = $1 and key = $2 and deleted_at is null",
      [tenant, o.stage ?? "doing"],
    );
    const t = await k.one<{ id: string; number: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on)
       values ($1, $2, '', $3, $4, $5, $6, $7, (now() + interval '3 days')::date) returning id, number`,
      [tenant, scope, kind.id, stage.id, o.title ?? `請求書を送る ${randomUUID().slice(0, 8)}`, (o.assignee ?? k.boss).id, (o.creator ?? k.writer).id],
    );
    return { ...t, tenant, scope };
  };
  k.post = async (t, by, o = {}) => {
    const kind = o.kind ?? "post";
    const r = await k.one<{ id: string }>(
      `insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, mentions, changes, quote_of_id, reactions, created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6::uuid[], $7::jsonb, $8, $9::jsonb, $10, now() - make_interval(mins => $11), now() - make_interval(mins => $11))
       returning id`,
      [
        t.tenant,
        t.id,
        kind === "system" ? null : (by?.id ?? null),
        kind,
        o.body ?? (kind === "change" ? null : "確認お願いします"),
        (o.mentions ?? []).map((p) => p.id),
        o.changes === undefined ? null : JSON.stringify(o.changes),
        o.quoteOf ?? null,
        JSON.stringify(o.reactions ?? {}),
        by?.id ?? null,
        o.at ?? 0,
      ],
    );
    return r.id;
  };
  k.run = async (t, by, o = {}) => {
    const job = await k.one<{ id: string }>(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, finished_at, created_at)
       values ($1, $2, $3, 'ticket', 'done', '（作る段）', now() - make_interval(mins => $4), now() - make_interval(mins => $4), now() - make_interval(mins => $4))
       returning id`,
      [t.tenant, t.scope, by.id, o.at ?? 0],
    );
    const run = await k.one<{ id: string }>(
      `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, finished_at, created_by, created_at)
       values ($1, $2, $3, 'make', $4, $5, now() - make_interval(mins => $6), now() - make_interval(mins => $6), $7, now() - make_interval(mins => $6))
       returning id`,
      [t.tenant, t.scope, t.id, o.status ?? "done", job.id, o.at ?? 0, by.id],
    );
    return run.id;
  };
  k.breakVisible = async (title, body) => {
    const orig = (
      await k.one<{ def: string }>("select pg_get_functiondef('app.ticket_visible(uuid)'::regprocedure) as def")
    ).def;
    // 0102 の本体を写し、題名の条件だけを足す（ほかの試験のチケットには効かない）
    await k.f.admin.query(`create or replace function app.ticket_visible(tid uuid) returns boolean language plpgsql stable security definer set search_path = public, app as $$
    begin
      if exists (select 1 from tickets x where x.id = tid and x.title = '${title}') then
        raise exception 'K38x の試験で守りを壊した';
      end if;
      return exists (
        select 1 from tickets t
        where t.id = tid and t.tenant_id = app.tenant_id()
          and t.deleted_at is null
          and app.ticket_draft_ok(t.draft_import_id, app.user_id())
          and (t.scope_id = any(visible_scopes(app.user_id())) or t.assignee_member_id = app.user_id() or app.ticket_involved(t.id, app.user_id()))
      );
    end $$`);
    try {
      return await body();
    } finally {
      await k.f.admin.query(orig);
    }
  };
  return k;
}

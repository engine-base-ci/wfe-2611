// 段 10「上げる・承認する・共有する・写す」の試験（K-687・K-688・K-689・K-719・K-690）が共有する小さな道具。
//   K-687 が運ぶ（carry）。K-688・K-689・K-719・K-690 は K-687 に依存するので同じ道具を読める。
//   中身は 会社・グループ・人の組み立て・頼み／共有の行を行の守りの外で入れる・お知らせと証跡の数え・書き込みを壊す引き金。
//   名前の決めは 07_functional/段10-F9/土台-knowledge.md と 11_tickets/K-687.md（表 knowledge_requests の列の確定）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { type KnowledgeHarness, type Person } from "./knowledge.harness.js";

export type Json = Record<string, unknown>;

export interface World {
  co: { tenantId: string; rootScope: string };
  /** 営業 */
  g1: string;
  /** 受託開発 */
  g2: string;
  /** 企画（マネージャーがいないグループ） */
  g3: string;
  boss: Person;
  boss2: Person;
  mgr1: Person;
  mgr1b: Person;
  mgr2: Person;
  mem1: Person;
  view1: Person;
  mem2: Person;
  mem3: Person;
  none: Person;
}

/** 会社 1 つ・グループ 3 つ・人 10 人。名前は並びの試験が使うので変えない */
export const makeWorld = async (h: KnowledgeHarness, label: string): Promise<World> => {
  const co = await h.company(label);
  const g1 = await h.group(co.tenantId, co.rootScope, "営業");
  const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
  const g3 = await h.group(co.tenantId, co.rootScope, "企画");
  const boss = await h.person(co.tenantId, co.rootScope, { name: "管理者", role: "admin" });
  const boss2 = await h.person(co.tenantId, co.rootScope, { name: "管理者 2", role: "admin" });
  const mgr1 = await h.person(co.tenantId, g1, { name: "営業マネージャー", role: "manager" });
  const mgr1b = await h.person(co.tenantId, g1, { name: "営業のもう 1 人のマネージャー", role: "manager" });
  const mgr2 = await h.person(co.tenantId, g2, { name: "開発マネージャー", role: "manager" });
  const mem1 = await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" });
  const view1 = await h.person(co.tenantId, g1, { name: "営業閲覧", role: "viewer" });
  const mem2 = await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" });
  const mem3 = await h.person(co.tenantId, g3, { name: "企画メンバー", role: "member" });
  const none = await h.person(co.tenantId, co.rootScope, { name: "どこにも入っていない人", role: "member" });
  return { co, g1, g2, g3, boss, boss2, mgr1, mgr1b, mgr2, mem1, view1, mem2, mem3, none };
};

export const num = async (h: KnowledgeHarness, sql: string, p: unknown[] = []): Promise<number> =>
  Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

export interface AuditRow {
  actor_member_id: string;
  target_type: string;
  target_id: string;
  choke_point_id: string;
  payload: unknown;
}
export const audits = async (h: KnowledgeHarness, w: World, action: string): Promise<AuditRow[]> =>
  (
    await h.admin.query(
      "select actor_member_id, target_type, target_id, choke_point_id, payload from audit_events where tenant_id = $1 and action = $2 order by occurred_at",
      [w.co.tenantId, action],
    )
  ).rows as AuditRow[];
export const allAudits = (h: KnowledgeHarness, w: World): Promise<number> =>
  num(h, "select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId]);

export interface NoticeRow {
  member_id: string;
  channel_id: string;
  event_kind_id: string;
  payload: Json;
  dedupe_key: string;
  read_at: string | null;
  deleted_at: string | null;
}
/** お知らせ（受け箱の行）。live ＝ 消していない物だけ（既定） */
export const notices = async (
  h: KnowledgeHarness,
  w: World,
  kind: string,
  o: { member?: Person; live?: boolean } = {},
): Promise<NoticeRow[]> =>
  (
    await h.admin.query(
      "select member_id, channel_id, event_kind_id, payload, dedupe_key, read_at, deleted_at from notifications where tenant_id = $1 and event_kind_id = $2 and ($3::uuid is null or member_id = $3) and ($4::boolean = false or deleted_at is null) order by created_at, member_id",
      [w.co.tenantId, kind, o.member?.id ?? null, o.live ?? true],
    )
  ).rows as NoticeRow[];
export const allNotices = (h: KnowledgeHarness, w: World): Promise<number> =>
  num(h, "select count(*) as n from notifications where tenant_id = $1 and event_kind_id like 'knowledge.%'", [
    w.co.tenantId,
  ]);

export interface RequestSeed {
  kind?: "raise" | "share";
  page?: string | null;
  folder?: string | null;
  fromScope: string;
  fromPersonal?: boolean;
  toScope: string;
  toFolder?: string | null;
  by: Person;
  state?: "pending" | "approved" | "declined" | "withdrawn";
  message?: string | null;
  reason?: string | null;
  dismissed?: boolean;
  decidedBy?: Person | null;
}
/** 頼みを行の守りの外で入れる（表 knowledge_requests の列は K-687 の md で確定） */
export const seedRequest = async (h: KnowledgeHarness, w: World, o: RequestSeed): Promise<string> => {
  const state = o.state ?? "pending";
  const kind = o.kind ?? "raise";
  const decided = state === "pending" ? null : (o.decidedBy ?? null);
  const r = await h.admin.query<{ id: string }>(
    "insert into knowledge_requests (tenant_id, kind, page_id, folder_id, from_scope_id, from_is_personal, to_scope_id, to_folder_id, requested_by, message, state, decided_by, decided_at, decline_reason, dismissed_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, case when $12::uuid is null then null else now() end, $13, case when $14::boolean then now() else null end) returning id",
    [
      w.co.tenantId,
      kind,
      o.page ?? null,
      o.folder ?? null,
      o.fromScope,
      o.fromPersonal ?? false,
      o.toScope,
      o.toFolder ?? null,
      o.by.id,
      o.message ?? null,
      state,
      decided?.id ?? null,
      o.reason ?? null,
      o.dismissed ?? false,
    ],
  );
  return r.rows[0]!.id;
};

export const requestRow = async (h: KnowledgeHarness, id: string): Promise<Record<string, unknown> | undefined> =>
  (await h.admin.query("select * from knowledge_requests where id = $1", [id])).rows[0];
export const requestRows = async (h: KnowledgeHarness, w: World): Promise<Record<string, unknown>[]> =>
  (
    await h.admin.query("select * from knowledge_requests where tenant_id = $1 order by created_at, id", [
      w.co.tenantId,
    ])
  ).rows;

/** 書き込みを試験で壊す（行を入れる・直すが XX000 で落ちる）。返す関数で元に戻す（finally で必ず呼ぶ・G-10） */
export const breakWrites = async (
  h: KnowledgeHarness,
  table: string,
  tenantId: string,
): Promise<() => Promise<void>> => {
  const fn = `test_break_${randomUUID().slice(0, 8)}`;
  await h.admin.query(
    `create function ${fn}() returns trigger language plpgsql as $$ begin raise exception '試験で壊した' using errcode = 'XX000'; end $$`,
  );
  await h.admin.query(
    `create trigger ${fn} before insert or update on ${table} for each row when (new.tenant_id = '${tenantId}') execute function ${fn}()`,
  );
  return async () => {
    await h.admin.query(`drop trigger if exists ${fn} on ${table}`);
    await h.admin.query(`drop function if exists ${fn}()`);
  };
};

/** 木の中のページかフォルダを id で探す（会社・グループ・自分の全部の木を見る） */
export const findNode = (tree: Json, id: string): Json | null => {
  const walk = (nodes: unknown): Json | null => {
    for (const n of (nodes as Json[] | undefined) ?? []) {
      if (n["id"] === id) return n;
      const hit = walk(n["children"]);
      if (hit) return hit;
    }
    return null;
  };
  const groups = (tree["groups"] as Json[] | undefined) ?? [];
  return (
    walk(tree["company_nodes"]) ?? walk(tree["my_nodes"]) ?? groups.map((g) => walk(g["nodes"])).find((x) => x) ?? null
  );
};

// 段 13「運営のお知らせ」の口（K-977 listOpsNotices・getOpsNotice／K-1014 createOpsNotice・updateOpsNotice／
//   K-978 publishOpsNotice・sendWorkspaceNotice／K-979 addIncidentUpdate）の単体の試験の土台（K-977 が持ち込む）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   会社・人・運営の人の作り方は ops-ws.harness.ts（K-963）をそのまま使い、hooks の材料だけをこの土台が自分で組む：
//     メンテのメール（関門 C6）は材料の mailer を偽物にして、送った宛先・題を数える（fail を真にすると次の送りから例外）。
//   お知らせは運営の会社（app.ops_tenant_id()）の行。共用の DB なので、ほかの試験の行も一覧に混ざる。
//   だから答えを見るときは、この回の題の頭（run）が付いた行だけを見る（mine）。終わったらこの回の行を消す（G-10）
import { afterAll } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createRepository } from "@kaname/db/repository";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import { OPS_TENANT, startOpsWs, type OpsWs, type PlanKey } from "./ops-ws.harness.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

export interface Mail {
  to: string;
  subject: string;
  text: string;
}
export interface OpsNoticeRow {
  kind?: "incident" | "maintenance" | "release";
  /** 題（頭に run が付く） */
  title?: string;
  body?: string;
  state?: "draft" | "scheduled" | "published";
  /** 出す時刻（秒・今からの差。負は過去・null は無し） */
  publishIn?: number | null;
  /** DB の値（'list'・'banner'） */
  placements?: readonly string[];
  planKeys?: readonly PlanKey[] | null;
  tenantIds?: readonly string[] | null;
  maintenance?: { fromIn: number; toIn: number } | null;
  impact?: string | null;
  by?: Person;
  deleted?: boolean;
}
export interface OpsNotices extends OpsWs {
  /** メンテのメールの送った記録（K-978） */
  mails: { calls: Mail[]; fail: boolean };
  /** お知らせを DB に直に置く（題の頭に run）。id を返す */
  notice: (o?: OpsNoticeRow) => Promise<string>;
  /** 障害の今の状態（status_incidents の行） */
  incident: (noticeId: string, state: string, o?: { resolved?: boolean }) => Promise<void>;
  /** 障害の続報（notice_updates の行） */
  update: (noticeId: string, state: string, body: string, atIn: number) => Promise<void>;
  /** 運営の会社のプランの id（ops-ws.harness.ts の 3 つ） */
  planId: (key: PlanKey) => Promise<string>;
  /** この回の行だけに絞る（題の頭） */
  mine: (rows: unknown) => Record<string, unknown>[];
  /** アプリの接続から関数を呼べなくし、返す関数で戻す（例 "app.ops_notices(text, text, integer)"） */
  /** 関数の実行の許可を kaname_app から外して壊し、返す関数で戻す。共用の DB の関数を壊すので、壊している間に同じ関数を読む試験がほかにあると巻き込む。
   *  いま app.ops_notices を壊すのは K977-API-009 だけ・同じ関数を読む試験を後の葉が足すときは、ここに書き足してから使う（ファイルは直列） */
  breakFn: (signature: string) => Promise<() => Promise<void>>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-notices-read"） */
export async function startOpsNotices(prefix: string, hookFiles: readonly string[]): Promise<OpsNotices> {
  const t = await startOpsWs(prefix, []);
  const made: string[] = [];
  afterAll(async () => {
    if (!made.length) return;
    const ids = [made];
    await t.f.admin.query("delete from notice_updates where notice_id = any($1::uuid[])", ids);
    await t.f.admin.query("delete from status_incidents where notice_id = any($1::uuid[])", ids);
    await t.f.admin.query("delete from notice_deliveries where notice_id = any($1::uuid[])", ids);
    // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
    await t.f.admin.query("delete from notices where id = any($1::uuid[])", ids);
  });
  // 口が作ったお知らせ（題の頭に run）も消す
  afterAll(async () => {
    const r = await t.f.admin.query<{ id: string }>("select id from notices where tenant_id = $1 and title like $2", [
      OPS_TENANT,
      `${t.run}%`,
    ]);
    for (const x of r.rows) if (!made.includes(x.id)) made.push(x.id);
  });
  const mails: OpsNotices["mails"] = { calls: [], fail: false };
  const repo = await createRepository(t.f.pool);
  const deps = {
    appPool: t.f.pool,
    authPool: t.f.pool,
    repo,
    mailer: async (m: Mail) => {
      if (mails.fail) throw new Error("試験で落とした送り出し");
      mails.calls.push(m);
    },
    config: { webBaseUrl: "http://127.0.0.1:3123", baseUrl: "http://api.k977.test" },
  } as unknown as HookDeps;
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of hookFiles) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(t.f.hooks, m.register.make(deps));
    }
  };
  const base = t.f.req;
  t.f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
  const at = (sec: number | null | undefined) =>
    sec === null || sec === undefined ? null : new Date(Date.now() + sec * 1000).toISOString();
  const planId: OpsNotices["planId"] = async (key) =>
    (await t.row<{ id: string }>("select id from plans where tenant_id = $1 and key = $2", [OPS_TENANT, key]))!.id;
  const notice: OpsNotices["notice"] = async (o = {}) => {
    const id = randomUUID();
    const plans = o.planKeys ? await Promise.all(o.planKeys.map((k) => planId(k))) : null;
    await t.f.admin.query(
      `insert into notices (id, tenant_id, kind_id, title, body, state, publish_at, placements, target_plan_ids,
                            target_tenant_ids, maintenance_from, maintenance_to, impact, created_by, deleted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        OPS_TENANT,
        o.kind ?? "release",
        `${t.run} ${o.title ?? "お知らせ"}`,
        o.body ?? "本文",
        o.state ?? "draft",
        at(o.publishIn === undefined ? null : o.publishIn),
        [...(o.placements ?? ["list"])],
        plans,
        o.tenantIds ? [...o.tenantIds] : null,
        o.maintenance ? at(o.maintenance.fromIn) : null,
        o.maintenance ? at(o.maintenance.toIn) : null,
        o.impact ?? null,
        o.by ? o.by.id : null,
        o.deleted ? new Date().toISOString() : null,
      ],
    );
    made.push(id);
    return id;
  };
  const incident: OpsNotices["incident"] = async (noticeId, state, o = {}) => {
    await t.f.admin.query(
      `insert into status_incidents (tenant_id, notice_id, state, started_at, resolved_at)
       values ($1, $2, $3, now() - interval '10 minutes', $4)`,
      [OPS_TENANT, noticeId, state, o.resolved ? new Date().toISOString() : null],
    );
  };
  const update: OpsNotices["update"] = async (noticeId, state, body, atIn) => {
    await t.f.admin.query(
      `insert into notice_updates (notice_id, state, body, created_at) values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [noticeId, state, body, atIn],
    );
  };
  const mine: OpsNotices["mine"] = (rows) =>
    (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).filter((r) =>
      String(r["title"] ?? "").startsWith(t.run),
    );
  const breakFn: OpsNotices["breakFn"] = async (signature) => {
    await t.f.admin.query(`revoke execute on function ${signature} from kaname_app`);
    return async () => {
      await t.f.admin.query(`grant execute on function ${signature} to kaname_app`);
    };
  };
  return { ...t, mails, notice, incident, update, planId, mine, breakFn };
}

/** listOpsNotices の 1 行の 11 欄（K-1004・incident_state は K-980 の一覧が障害の今の状態を出すため・admins_only は管理者だけの印＝D-156.57） */
export const OPS_NOTICE_ROW_KEYS = [
  "admins_only",
  "audience",
  "author_name",
  "id",
  "incident_state",
  "kind",
  "placements",
  "publish_at",
  "published_at",
  "state",
  "title",
];
/** OpsNoticeDetail の 16 欄（K-1004） */
export const OPS_NOTICE_KEYS = [...OPS_NOTICE_ROW_KEYS, "body", "impact", "maintenance", "reach", "updates"].sort();

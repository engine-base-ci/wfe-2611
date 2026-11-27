// 段 13「配るもの › ひな形」の口（K-992 listOpsTemplates・getOpsTemplate／K-1010 releaseOpsTemplate・listOperations／
//   K-993 listKindTemplateUpdates・applyKindTemplateUpdate）の単体の試験の土台（K-992 が持ち込む）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   会社・人・運営の人・本人確認の取り直しは ops-act.harness.ts（K-969）をそのまま使い、ひな形の準備だけを足す:
//     ・dist：運営の会社の配るもの（kind・state・field）の id と今の版
//     ・addVersion：新しい版の中身を DB に直に置く（出す口を通さない準備）。今の版を進める
//     ・hashOf・itemOf：中身の印と、会社の行の今の中身（K-992 の関数を直に呼ぶ）
//   試験が進めた版と足した版の行は afterAll で元に戻す（共用の DB・G-10）
import { afterClose, type Person } from "../fixture.js";
import { OPS_TENANT } from "./ops-ws.harness.js";
import { startOpsAct, STEP, type OpsAct } from "./ops-act.harness.js";

export { OPS_TENANT, STEP };
export type Part = "kind" | "state" | "field";
export const PARTS: readonly Part[] = ["kind", "state", "field"];
export const TEMPLATES = "/ops/templates";
export const UPDATES = "/ticket_kinds/template-updates";
/** listOpsTemplates の 1 行の 8 欄（K-992） */
export const TEMPLATE_ROW_KEYS = [
  "id",
  "key",
  "last_released_at",
  "name",
  "summary",
  "took",
  "using",
  "version",
] as const;

export interface Item {
  key: string;
  [k: string]: unknown;
}
export interface OpsTemplates extends OpsAct {
  dist: (part: Part) => Promise<{ id: string; version: number; items: Item[] }>;
  /** 新しい版の中身を置き、今の版を進める。返すのは新しい版の数 */
  addVersion: (part: Part, items: Item[], by?: Person, reason?: string) => Promise<number>;
  hashOf: (part: Part, item: Item) => Promise<string>;
  /** 会社の行（種別・状態・項目）の今の中身（K-992 の app.template_item_of） */
  itemOf: (part: Part, rowId: string) => Promise<Item>;
  /** 会社の既定の種別の行（名前で引く） */
  kindRow: (tenantId: string, name: string) => Promise<Record<string, unknown> | undefined>;
  /** 会社のその部の使い始めの行 */
  tenantDist: (tenantId: string, part: Part) => Promise<Record<string, unknown> | undefined>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-templates-read"） */
export async function startOpsTemplates(prefix: string, hookFiles: readonly string[]): Promise<OpsTemplates> {
  const t = await startOpsAct(prefix, hookFiles);
  const before = await t.f.admin.query<{ id: string; key: string; current_version: number | null }>(
    "select id, key, current_version from distributions where tenant_id = $1",
    [OPS_TENANT],
  );
  const versionsBefore = new Set(
    (await t.f.admin.query<{ id: string }>("select id from distribution_versions")).rows.map((r) => r.id),
  );
  // 戻しは close の中で流す（fixture.ts の afterClose：beforeAll の中の afterAll は vitest に登録されない）
  const restore = async (): Promise<void> => {
    for (const r of before.rows)
      await t.f.admin.query("update distributions set current_version = $2 where id = $1", [r.id, r.current_version]);
    const added = (await t.f.admin.query<{ id: string }>("select id from distribution_versions")).rows
      .map((r) => r.id)
      .filter((id) => !versionsBefore.has(id));
    if (added.length) await t.f.admin.query("delete from distribution_versions where id = any($1::uuid[])", [added]);
    // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
  };
  afterClose(restore);

  const dist: OpsTemplates["dist"] = async (part) => {
    const d = (await t.row<{ id: string; current_version: number }>(
      "select id, current_version from distributions where tenant_id = $1 and key = $2",
      [OPS_TENANT, part],
    ))!;
    const v = await t.row<{ snapshot: { items?: Item[] } }>(
      "select snapshot from distribution_versions where distribution_id = $1 and version = $2",
      [d.id, d.current_version],
    );
    return { id: d.id, version: d.current_version, items: v?.snapshot.items ?? [] };
  };
  const addVersion: OpsTemplates["addVersion"] = async (part, items, by, reason = "試験の版") => {
    const d = await dist(part);
    const version = d.version + 1;
    await t.f.admin.query(
      `insert into distribution_versions (distribution_id, version, snapshot, released_at, released_by, change_reason)
       values ($1, $2, $3, now(), $4, $5)`,
      [d.id, version, { items }, by ? by.id : null, `${t.run} ${reason}`],
    );
    await t.f.admin.query("update distributions set current_version = $2 where id = $1", [d.id, version]);
    return version;
  };
  const hashOf: OpsTemplates["hashOf"] = async (part, item) =>
    (await t.row<{ h: string }>("select app.template_item_hash($1, $2) as h", [part, item]))!.h;
  const itemOf: OpsTemplates["itemOf"] = async (part, rowId) =>
    (await t.row<{ x: Item }>("select app.template_item_of($1, $2) as x", [part, rowId]))!.x;
  const kindRow: OpsTemplates["kindRow"] = (tenantId, name) =>
    t.row("select * from ticket_kinds where tenant_id = $1 and name = $2 and deleted_at is null", [tenantId, name]);
  const tenantDist: OpsTemplates["tenantDist"] = async (tenantId, part) =>
    t.row(
      `select td.* from tenant_distributions td join distributions d on d.id = td.distribution_id
        where td.tenant_id = $1 and d.key = $2 and td.deleted_at is null`,
      [tenantId, part],
    );
  return { ...t, dist, addVersion, hashOf, itemOf, kindRow, tenantDist };
}

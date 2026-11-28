// 生成テストが使う「その endpoint を正しく呼ぶ引数」：作成の body は場合表の種から契約の入力に絞る。更新・削除は自分で 1 行作ってから
import type { EndpointDef } from "@kaname/contracts";
import { ENDPOINTS } from "@kaname/contracts";
import type { Harness, Who } from "./harness.js";

export async function args(
  h: Harness,
  e: EndpointDef,
  who: Who = "boss",
): Promise<{ body?: unknown; id?: string; query?: Record<string, string> }> {
  const tenant = who === "ops" ? h.opsTenantFor(e) : h.S.tenantA;
  if (e.kind === "list") return { query: { limit: "5" } };
  if (e.kind === "create") return { body: h.bodyFor(e, tenant) };
  // update／delete／get：同じ表の作成 endpoint があれば API で作る。無ければ管理者接続で 1 行（種の作り方）
  const creator = ENDPOINTS.find((x) => x.table === e.table && x.kind === "create");
  let id: string | undefined;
  if (creator) {
    const w = creator.auth === "ops" ? "ops" : who === "ops" ? "boss" : who;
    const r = await h.call(creator, w, {
      body: h.bodyFor(creator, w === "ops" ? h.opsTenantFor(creator) : h.S.tenantA),
    });
    if (r.status < 300) id = ((await r.json()) as { data: { id: string } }).data.id;
  }
  if (!id) id = h.S.rows[e.table]?.insert ? await h.freshRow(e.table, tenant) : h.S.rows[e.table]?.visible; // 作り方の無い表（tenants）は種の行
  return { id, ...(e.kind === "update" ? { body: h.bodyFor(e, tenant) } : {}) };
}

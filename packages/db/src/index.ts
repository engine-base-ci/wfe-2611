// 関門 C2（永続化）の置き場。実体（repository・接続プール・RLS の SET LOCAL）は T-F-02／T-F-03。
// ここでは migration の並びと、テナント文脈の名前だけを定める。
export const TENANT_SETTING = "app.tenant_id" as const;
export const USER_SETTING = "app.user_id" as const;

/** 適用する migration の順（ファイル名の 4 桁が順序。飛び番・重複は起動時に落とす）。 */
export const MIGRATIONS = ["0001_foundation.sql", "0002_access_control.sql"] as const;

/** migration 名の並びを検査する。重複・順序違い・4 桁でない名前があれば理由を返す。 */
export function checkMigrationOrder(names: readonly string[]): { ok: true } | { ok: false; reason: string } {
  const seen = new Set<number>();
  let last = 0;
  for (const name of names) {
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
    if (!m) return { ok: false, reason: `名前の形が違う: ${name}` };
    const n = Number(m[1]);
    if (seen.has(n)) return { ok: false, reason: `番号が重複: ${name}` };
    if (n !== last + 1) return { ok: false, reason: `番号が飛んでいる: ${name}（前は ${last}）` };
    seen.add(n);
    last = n;
  }
  return { ok: true };
}

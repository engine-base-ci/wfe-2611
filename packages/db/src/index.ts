// 関門 C2（永続化）の置き場。実体（repository・接続プール・RLS の SET LOCAL）は T-F-02／T-F-03。
// ここでは migration の並びと、テナント文脈の名前だけを定める。
export const TENANT_SETTING = "app.tenant_id" as const;
export const USER_SETTING = "app.user_id" as const;

/** 適用する migration の順。作り手（scripts/ci/gen_migrations.py）が packages/db/migrations/ を名前の順に並べて作る生成物。 */
export { MIGRATIONS } from "./migrations.generated.js";

/** 4 けたの続き番号の最後（K-327 から新しい migration は YYYYMMDDHHMMSS_名前.sql の時刻の名前にする）。 */
export const LEGACY_LAST = 116;

const LEGACY_NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;
const TIME_NAME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_[a-z0-9_]+\.sql$/;

/** 時刻の名前の 14 けたが日付と時刻として正しいか（月 01〜12・日 01〜31・時 00〜23・分秒 00〜59）。 */
function isTimeName(name: string): boolean {
  const m = TIME_NAME.exec(name);
  if (!m) return false;
  const [mo, d, h, mi, se] = m.slice(2).map(Number) as [number, number, number, number, number];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 23 && mi <= 59 && se <= 59;
}

/**
 * migration 名の並びを検査する。
 * 4 けた（0001〜LEGACY_LAST）は 0001 からの続き番号で、時刻の名前（YYYYMMDDHHMMSS_名前.sql）はその後に名前の順で並ぶ（飛びは許す）。
 * 4 けたが無い・途中までの並びも通す（続きかどうかだけを見る）。
 */
export function checkMigrationOrder(names: readonly string[]): { ok: true } | { ok: false; reason: string } {
  const seen = new Set<string>();
  let last = 0;
  let lastTime = "";
  for (const name of names) {
    if (seen.has(name)) return { ok: false, reason: `名前が重複: ${name}` };
    seen.add(name);
    const legacy = LEGACY_NAME.exec(name);
    if (legacy) {
      const n = Number(legacy[1]);
      if (lastTime)
        return { ok: false, reason: `4 けたの migration が時刻の名前の後にある: ${name}（前は ${lastTime}）` };
      if (n === last) return { ok: false, reason: `番号が重複: ${name}` };
      if (n > LEGACY_LAST)
        return {
          ok: false,
          reason: `4 けたは ${LEGACY_LAST} まで。新しい migration は時刻の名前（YYYYMMDDHHMMSS_名前.sql）にする: ${name}`,
        };
      if (n !== last + 1) return { ok: false, reason: `番号が飛んでいる: ${name}（前は ${last}）` };
      last = n;
      continue;
    }
    if (!isTimeName(name)) return { ok: false, reason: `名前の形が違う: ${name}（YYYYMMDDHHMMSS_名前.sql）` };
    if (lastTime && name <= lastTime)
      return { ok: false, reason: `時刻の名前が名前の順に並んでいない: ${name}（前は ${lastTime}）` };
    lastTime = name;
  }
  return { ok: true };
}

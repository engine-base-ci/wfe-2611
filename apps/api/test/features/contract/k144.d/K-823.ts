// 葉 K-823「記録を探す（listAuditEvents）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   本体の入口の uuid の行 K144-API-028・029（?member_id・?ticket_id）は、正しい uuid で口の振る舞いまで進み、答えを契約の形 AuditEvents で確かめる。
//   K-823 が答えの形を { entries, next_cursor, scope, scan_capped } に替えたので、その口の hooks（apps/api/src/hooks/audit.ts の register）を足す。
//   行は足さない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["audit"]); // K-823
  },
};

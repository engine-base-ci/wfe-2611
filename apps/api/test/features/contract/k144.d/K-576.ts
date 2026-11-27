// 葉 K-576「項目の変更を点の形に戻す口」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 5 の枠 K144-API-500〜599（K-432 が 500・K-433 が 510〜512・この葉が 520）。
//   入口の uuid の行（道の値 :id）と、その口を叩く時の体。体は正しい形で 422 にならない値（無いチケットは口の確かめで 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 項目を戻す口は apps/api/src/hooks/ticket-item-restore.ts の register（K-326）。最初の要求の前に 1 回だけ読む（準備で読まない・answer=8f745003d023）
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import("../../../../src/hooks/ticket-item-restore.js")) as {
        register: { make: (d: unknown) => Record<string, unknown> };
      };
      Object.assign(f.hooks, m.register.make({ appPool: f.pool }));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [["K144-API-529", "restoreTicketItems", "path", "id"]], // K-576
  BODIES: {
    restoreTicketItems: { from: 1, to: 2 }, // K-576
  },
};

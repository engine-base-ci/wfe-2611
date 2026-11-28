// 葉 K-882「ゲストが見せたチケットのチャットに書く口（postPortalTicketMessage）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 12 の枠 K144-API-1200〜1299（この葉は 1283）。入口の uuid の行（道の値 :id＝チケット）と、書く口を叩く時の体（必須の欄 body）。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-ticket-chat.ts。最初の要求の前に 1 回だけ読む（準備で読まない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDeps, HookModule } from "../../../../src/hooks/registry.js";
import type { K144Leaf } from "./_base.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "src", "hooks");

export const leaf: K144Leaf = {
  setup: (f) => {
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import(join(HOOKS_DIR, "portal-ticket-chat.ts"))) as { register: HookModule }; // K-882
      Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [
    ["K144-API-1283", "postPortalTicketMessage", "path", "id"], // K-882
  ],
  BODIES: {
    postPortalTicketMessage: { body: "確認をお願いします" }, // K-882
  },
};

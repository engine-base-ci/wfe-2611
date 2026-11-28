// 葉 K-927「ゲストのグループの名前を直す・消す口（updateGuestGroup・deleteGuestGroup）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 12 の枠 K144-API-1200〜1299（この葉は 1227・1228）。入口の uuid の行（道の値 :id＝ゲストのグループ）と、直す口を叩く時の体（必須の欄 name）。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/guest-group-edit.ts。最初の要求の前に 1 回だけ読む（準備で読まない）。
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
      const m = (await import(join(HOOKS_DIR, "guest-group-edit.ts"))) as { register: HookModule }; // K-927
      Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [
    ["K144-API-1227", "updateGuestGroup", "path", "id"], // K-927
    ["K144-API-1228", "deleteGuestGroup", "path", "id"], // K-927
  ],
  BODIES: {
    updateGuestGroup: { name: "株式会社セイコー（ゲスト）" }, // K-927
  },
};

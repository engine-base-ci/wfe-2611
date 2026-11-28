// 葉 K-838「ワークスペースから抜ける」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行は「作った口 × uuid の値」と 1 対 1（契約の形の検査 K144-SHAPE-017）。leaveWorkspace（DELETE /me/workspaces/:id）の道の id（抜ける会社の id）の 1 本。
//   段 11 の k144 の番号は 1100〜1199：書き手 D（自分の設定）は 1180〜1189（K-836 が 1180・K-838 が 1181）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 口は apps/api/src/hooks/me-leave.ts の register（K-326）。最初の要求の前に 1 回だけ読む（準備で読まない：
    //   実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない）。正しい uuid は無い会社なので 404 の道を回る
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import("../../../../src/hooks/me-leave.js")) as {
        register: { make: (d: unknown) => Record<string, unknown> };
      };
      Object.assign(f.hooks, m.register.make({ appPool: f.pool, config: { webBaseUrl: "", env: "test" } }));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [
    ["K144-API-1181", "leaveWorkspace", "path", "id"], // K-838
  ],
};

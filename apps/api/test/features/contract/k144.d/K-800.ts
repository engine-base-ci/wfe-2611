// 葉 K-800「F10 の口の置き場」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行は「作った口 × uuid の値」と 1 対 1（契約の形の検査 K144-SHAPE-017）。この葉が登録する 13 の口のうち、
//   uuid の道の値を持つ 11 本の行を置く（createScope・createLayer は道に id が無い）。
//   段 11 の k144 の番号は 1100〜1199：K-800 が 1100〜1110、書き手 B の葉は 1140 から（段 12 が 1206〜・段 9 が 900 台）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 11 の口は apps/api/src/hooks/f10-admin.ts の register（K-326）。最初の要求の前に 1 回だけ読む（準備で読まない：
    //   実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない）。正しい uuid は無い行なので 404 の道を回る
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import("../../../../src/hooks/f10-admin.js")) as {
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
    ["K144-API-1100", "updateScope", "path", "id"], // K-800
    ["K144-API-1101", "updateLayer", "path", "id"], // K-800
    ["K144-API-1102", "resendInvitation", "path", "id"], // K-800
    ["K144-API-1103", "revokeInvitation", "path", "id"], // K-800
    ["K144-API-1104", "getMember", "path", "id"], // K-800
    ["K144-API-1105", "updateMemberRole", "path", "id"], // K-800
    ["K144-API-1106", "updateMemberGroups", "path", "id"], // K-800
    ["K144-API-1107", "suspendMember", "path", "id"], // K-800
    ["K144-API-1108", "resumeMember", "path", "id"], // K-800
    ["K144-API-1109", "previewMemberRemoval", "path", "id"], // K-800
    ["K144-API-1110", "removeMember", "path", "id"], // K-800
  ],
  BODIES: {
    updateScope: { name: "営業" }, // K-800
    updateLayer: { label: "部門" }, // K-800
    resendInvitation: {}, // K-800
    updateMemberRole: { role_key: "member" }, // K-800
    updateMemberGroups: { primary_scope_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }, // K-800
    suspendMember: {}, // K-800
    resumeMember: {}, // K-800
    removeMember: {}, // K-800
  },
};

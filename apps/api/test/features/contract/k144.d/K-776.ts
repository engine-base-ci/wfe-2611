// 葉 K-776「作った後に会話をチケットへ移す口（adoptDraftConversation）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 作る画面の会話の残りの口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-776
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["draft-adopt"]); // K-776（作った後に会話をチケットへ移す口（adoptDraftConversation）：K144-API-930）
  },
  UUID_PARAM_CASES: [
    ["K144-API-930", "adoptDraftConversation", "path", "id"], // K-776
  ],
  BODIES: {
    adoptDraftConversation: { ticket_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }, // K-776
  },
};

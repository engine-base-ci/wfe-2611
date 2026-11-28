// 葉 K-763「チケットの中で話す口（getTicketAgentSession・sendTicketAgentMessage）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 話す口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-763
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["ticket-talk"]); // K-763（チケットの中で話す口：K144-API-927・928）
  },
  UUID_PARAM_CASES: [
    ["K144-API-927", "getTicketAgentSession", "path", "id"], // K-763
    ["K144-API-928", "sendTicketAgentMessage", "path", "id"], // K-763
  ],
  BODIES: {
    sendTicketAgentMessage: { text: "このチケットのことを聞く" }, // K-763
  },
};

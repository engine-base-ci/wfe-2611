// 葉 K-383「やり取りを読む口（listTicketTimeline）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 7 の枠 K144-API-700〜799（葉ごと：K-383 700〜701・K-384 710・K-385 720・K-386 730〜732・K-387 740・K-390 750〜751・K-391 760。段 9 は 900 台・本線と段 4 は 001〜072・801〜855 で重ならない）。
//   入口の uuid の行：道の値 :id と、問い合わせ ?before_id（名前が id で終わる問い合わせは入口が uuid を確かめる）。
//   口の振る舞いは、葉の hooks のファイル apps/api/src/hooks/ticket-timeline.ts の register を、最初の要求の前に 1 回だけ足す（準備で読まない・answer=8f745003d023）。
//   土台は値で読み込まない（setup の中で動的に読む・K-378.ts の注と同じ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F6/thread.harness.js")).addThreadHooks(f, ["ticket-timeline"]); // K-383
  },
  UUID_PARAM_CASES: [
    ["K144-API-700", "listTicketTimeline", "path", "id"], // K-383
    ["K144-API-701", "listTicketTimeline", "query", "before_id"], // K-383
  ],
};

// 葉 K-910「依頼を書く間に分身が聞く口（askPortalRequestQuestions）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の値を持たない口なので uuid の行は無い。足すのは「準備」と、口を叩く時の体（必須の欄 body）だけ。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-questions.ts。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/portal-questions.js")) as {
      portalQuestionsHooks: (p: typeof f.pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.portalQuestionsHooks(f.pool));
  },
  BODIES: {
    askPortalRequestQuestions: { body: "報告書をください" }, // K-910
  },
};

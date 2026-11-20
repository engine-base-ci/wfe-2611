// 葉 K-355「預けた後のログインの確かめの口（checkCredentialLogin・answerCredentialLoginCheck・reportCredentialCheck）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行は、本体に印つきで書いていた物をそのまま移した（中身は変えていない。字下げと、手助けを読む道 ../F3 → ../../F3 だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/credentials.harness.js")).addCredentialLeafHooks(f, "credentials-check"); // K-355（確かめ 3 本：K144-API-067〜069）
  },
  UUID_PARAM_CASES: [
    ["K144-API-067", "checkCredentialLogin", "path", "id"], // K-355
    ["K144-API-068", "answerCredentialLoginCheck", "path", "id"], // K-355
    ["K144-API-069", "reportCredentialCheck", "path", "id"], // K-355（PC の口・PC の印で叩く）
  ],
  BODIES: {
    answerCredentialLoginCheck: { request_id: "rq-k144", code: "123456" }, // K-355
    reportCredentialCheck: { job_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", state: "ok" }, // K-355
  },
};

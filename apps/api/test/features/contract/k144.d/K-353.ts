// 葉 K-353「預けたログイン情報の上書き・消す口（updateCredential・deleteCredential）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行は、本体に印つきで書いていた物をそのまま移した（中身は変えていない。字下げと、手助けを読む道 ../F3 → ../../F3 だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 4 の預けたログイン情報の口は、葉ごとの hooks のファイルの register（K-326）を葉ごとの 1 行が自分の分だけ足す。最初の要求の前に 1 回だけ読む // K-353
    //   正しい uuid は無い行なので 404 の道を回る（秘密の関門は本物の形・保管はメモリ。値を預けない）。K-355 の行は K-353 の行を当てにしない // K-353
    (await import("../../F3/credentials.harness.js")).addCredentialLeafHooks(f, "credentials-edit"); // K-353（上書き・消す：K144-API-065・066）
  },
  UUID_PARAM_CASES: [
    ["K144-API-065", "updateCredential", "path", "id"], // K-353
    ["K144-API-066", "deleteCredential", "path", "id"], // K-353
  ],
  BODIES: {
    updateCredential: { description: "説明" }, // K-353
  },
};

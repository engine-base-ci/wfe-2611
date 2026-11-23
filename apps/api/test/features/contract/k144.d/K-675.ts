// 葉 K-675「ナレッジの口の置き場」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行：道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。入口の uuid の確かめは 501 より前なので、
//   口の振る舞い（hooks）がまだ無くても確かめられる（だから setup は要らない）。道に :id を持つ 12 本の行を、この葉が 1 か所でまとめて持つ
//   （K-677〜K-690 の葉は自分の uuid の行を持たない。K-687 以降の葉は 120〜149 の自分の枠を使う）。
//   行 ID は段 10 の枠 K144-API-100〜149（本線・c/段5・c/段8・c/段9 に在る番号の外）。この葉は 100〜111。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  UUID_PARAM_CASES: [
    ["K144-API-100", "getKnowledgePage", "path", "id"], // K-675
    ["K144-API-101", "listKnowledgeVersions", "path", "id"], // K-675
    ["K144-API-102", "getKnowledgePageVersion", "path", "id"], // K-675
    ["K144-API-103", "updateKnowledgeFolder", "path", "id"], // K-675
    ["K144-API-104", "deleteKnowledgeFolder", "path", "id"], // K-675
    ["K144-API-105", "saveKnowledgeDraft", "path", "id"], // K-675
    ["K144-API-106", "discardKnowledgeDraft", "path", "id"], // K-675
    ["K144-API-107", "publishKnowledgePage", "path", "id"], // K-675
    ["K144-API-108", "updateKnowledgePage", "path", "id"], // K-675
    ["K144-API-109", "deleteKnowledgePage", "path", "id"], // K-675
    ["K144-API-110", "setKnowledgeMust", "path", "id"], // K-675
    ["K144-API-111", "copyKnowledgePage", "path", "id"], // K-675
  ],
  BODIES: {
    updateKnowledgeFolder: { name: "名前" }, // K-675
    saveKnowledgeDraft: { title: "題名" }, // K-675
    publishKnowledgePage: {}, // K-675
    updateKnowledgePage: { position: 0 }, // K-675
    setKnowledgeMust: { must: true }, // K-675
    copyKnowledgePage: {}, // K-675
  },
};

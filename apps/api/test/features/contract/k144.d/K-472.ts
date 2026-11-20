// 葉 K-472「一覧の絞り込みの受け皿と、人・段・種別・取引先・完了で絞る」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   足す欄は listTickets（GET /tickets）の問い合わせ kind_id・stage_id・assignee_id・client_id（どれも *_id なので契約で uuid・入口の共通の形の確かめ・K-144）。
//   uuid でない値は 422・欄 <名前>・理由 uuid、正しい uuid・空の値は 422 にしない。口は作り済み（ticketHooks）なので準備（setup）は要らない。
//   行の番号 K144-API-872〜875 は段 8 の切る段で置いた番号（K-472 の下 2 桁を 8 の次に使い、4 つの欄で 872・873・874・875 を借りる。
//   K-473 〜 K-476 は uuid の問い合わせの欄を作らない前提。ぶつかるときはまとめ役が 9 台に付け替える）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  UUID_PARAM_CASES: [
    ["K144-API-872", "listTickets", "query", "kind_id"], // K-472
    ["K144-API-873", "listTickets", "query", "stage_id"], // K-472
    ["K144-API-874", "listTickets", "query", "assignee_id"], // K-472
    ["K144-API-875", "listTickets", "query", "client_id"], // K-472
  ],
};

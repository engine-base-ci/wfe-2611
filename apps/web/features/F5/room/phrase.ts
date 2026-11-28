// 見出しを文節の切れ目だけで折るための字の並び（2026-11-23・段 6 の下絵）。
//   文節の中の字の間に「語をつなぐ印」（U+2060）を入れ、文節の中では折らせない。文節どうしの間でだけ折れる
//   使い方：ph("この期間に", "やったことは", "ありません")
const JOIN = "\u2060";

export function ph(...phrases: readonly string[]): string {
  return phrases.map((p) => [...p].join(JOIN)).join("");
}

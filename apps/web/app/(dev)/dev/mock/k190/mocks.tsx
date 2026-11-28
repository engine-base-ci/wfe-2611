// K-190（片付けに失敗した承認の後の実行）の帯の状態の並び。正の欄（11_tickets/K-1192.md の mock:）が指す状態の id。
//   決める人が見た下絵は 07_functional/段1-K190/下絵.html（answer=0e11672a186a）。描き手（page.tsx・[id]/page.tsx）は K-1192 が、
//   本番と同じ部品（features/F5/approve-complete/sweep-failed.tsx と components/k）を並べて作る（design-system.md §8）。
//   状態の並びは機械が読む（scripts/ci/canvas_field_gate.py）：{ id, screen, label, ticket } の順と引用符を崩さない。

export interface MockEntry {
  id: string;
  screen: "tickets";
  label: string;
  /** この状態を本物にする画面の葉 */
  ticket: string;
}

// prettier-ignore
export const MOCKS: readonly MockEntry[] = [
  { id: "k190-sweep-owner", screen: "tickets", label: "片付けに失敗している：担当者が見る（［この実行を止める］）", ticket: "K-1192" },
  { id: "k190-sweep-other", screen: "tickets", label: "片付けに失敗している：担当者でない人が見る（ボタンなし）", ticket: "K-1192" },
  { id: "k190-sweep-confirm", screen: "tickets", label: "この実行を止めますか（確かめの小窓）", ticket: "K-1192" },
];

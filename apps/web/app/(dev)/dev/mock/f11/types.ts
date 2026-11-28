// 段 12 の下絵の状態の形（mocks-cu.tsx・mocks-cp.tsx が使う）
/** 製品の時点：PS0 登録直後（PC なし）／PS2 使っている（PC がつながり AI が動く） */
export type ProductState = "PS0" | "PS2";
export interface MockEntry {
  id: string;
  /** 下絵の頁の番号（まとまり-枝） */
  no: string;
  screen: "members" | "requests" | "tickets" | "portal";
  /** 製品の時点 */
  ps: ProductState;
  label: string;
  /** この状態を本物にする画面の葉（詳細を切るときに決める・今は仮の K-0） */
  ticket: string;
  leaf: string;
}

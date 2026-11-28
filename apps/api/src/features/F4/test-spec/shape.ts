// 確認項目の答えの形（K-434・K-726）。一覧（listTestSpecs）・足す（createTestSpec）・直す・付け外す（K-435）の口が同じ形で答える。
//   鍵はちょうど 7（id・title・checked・position・source・version・source_page）。version は行の版（画面が updateTestSpec に送る）。
//   source_page は出どころ knowledge で今も必ず守るで生きているページの行だけ { id, title（ページの今の題名） }、ほかは null（K-726）。
//   中身は DB の関数 app.test_spec_item が作る（position は消していない行を作った順に数えた 1 からの番号）

/** 出どころのページ（K-726） */
export interface SpecSourcePage {
  id: string;
  title: string;
}

/** 答えの項目（鍵 7） */
export interface SpecItem {
  id: string;
  title: string;
  checked: boolean;
  position: number;
  source: string;
  version: number;
  source_page: SpecSourcePage | null;
}

/** DB の関数の答え（jsonb）を整える。鍵をちょうど 7 にそろえる */
export function toSpecItem(v: SpecItem): SpecItem {
  const page = v.source_page;
  return {
    id: v.id,
    title: v.title,
    checked: v.checked === true,
    position: Number(v.position),
    source: v.source,
    version: Number(v.version),
    source_page: page ? { id: page.id, title: page.title } : null,
  };
}

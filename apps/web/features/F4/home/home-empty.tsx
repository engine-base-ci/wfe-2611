"use client";
// 一覧の 0 件の画面のおすすめ 1 行（K-453・D-150.18）。書ける人には 3 つを押せる字にし、押すとその題名を入れて作る面を開く。
//   書けない人（書けるグループが無い）には今までどおり押せない形（aria-disabled・「<名前>（準備中）」）。
//   移り先は見張り use-suggest.ts が決める（このファイルは道を持たない）。onCreate（主ボタンの関数）はおすすめでは呼ばない
import { SuggestLine } from "./views";
import { useSuggestCreate } from "./use-suggest";

export const SUGGESTIONS = ["今月の請求書を送る", "問い合わせに返す", "見積を作る"] as const;

export interface HomeSuggestProps {
  /** 書けるグループがある（おすすめを押せる） */
  canCreate: boolean;
  /** 一覧の作るボタンの関数。おすすめでは呼ばない（おすすめは題名つきで作る面を開き直す） */
  onCreate?: (title?: string) => void;
}

export function HomeSuggest({ canCreate }: HomeSuggestProps) {
  const go = useSuggestCreate();
  return <SuggestLine suggestions={SUGGESTIONS} onSuggest={canCreate ? go : undefined} />;
}

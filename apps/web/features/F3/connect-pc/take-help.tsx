"use client";
// 「PC をつなぐ」の小窓の受け取る段に差す物の置き場（K-349）。
//   K-374 が受け取った OS を覚えて越え方を返す。この葉の時点では onTaken は何もしない・node は null（小窓は今の絵のまま）
import type { ReactNode } from "react";
import type { Os } from "./connect-dialog";

/** 何もしない（描き直すたびに別の関数を作らない） */
const noop = (): void => undefined;

export function useTakeHelp(): { onTaken: (os: Os) => void; node: ReactNode } {
  return { onTaken: noop, node: null };
}

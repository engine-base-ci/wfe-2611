"use client";
// 「PC をつなぐ」の小窓の受け取る段に差す物の置き場（K-349）。
//   K-374：受け取りに成功した OS を覚え、その OS の分だけ OS の警告の越え方（OsWarning・閉じた形）を返す。
//   受け取る前は null（小窓はキャンバス EdPC の絵のまま）。失敗では onTaken が呼ばれないので、前に覚えた OS はそのまま。
//   覚えるのは画面の中だけ（小窓を閉じて開き直しても残り、画面を読み込み直すと受け取る前に戻る）
import { useState, type ReactNode } from "react";
import type { Os } from "./connect-dialog";
import { OsWarning } from "./pc-row-parts";

export function useTakeHelp(): { onTaken: (os: Os) => void; node: ReactNode } {
  const [takenOs, setTakenOs] = useState<Os | null>(null);
  return { onTaken: setTakenOs, node: takenOs ? <OsWarning os={takenOs} /> : null };
}

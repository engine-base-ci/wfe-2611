// 送りすぎで待ってもらうときの文（正本 E-LIM-005・D-128.146）。画面で文を作らず、正本の {秒} に待つ秒数を入れる
import { CATALOG } from "@kaname/errors/catalog";

/** 待つ秒数が分からないときは 60 秒（契約の口の上限は 1 分ごと） */
export const waitText = (sec: number | null | undefined): string =>
  (CATALOG["E-LIM-005"]?.message ?? "E-LIM-005").replace("{秒}", String(sec ?? 60));

// まだ実装していない画面への行き先（typedRoutes の型に無い）。どのタスクで実装するかを必ず書く。
// 実装済みの画面は必ず型で守る（ここを通さない）。ops_block.py が同じ「未実装の行き先」を正本の行にも BLOCKED で書く。
import type { Route } from "next";
import { WEB_ENV } from "@/lib/env";

export function pendingRoute(path: string, task: string): Route {
  if (!WEB_ENV.isProduction) console.debug(`[pending-route] ${path} は ${task} で実装`);
  return path as Route;
}

/** 生成されたナビ（lib/nav.ts ← flow.json）の行き先。実装済みの画面もまだの画面も混ざる。
 *  まだの画面は押すと 404 になり、その事実は正本の行に BLOCKED（自動）で出る（scripts/ci/ops_block.py）。 */
export const navRoute = (path: string): Route => path as Route;

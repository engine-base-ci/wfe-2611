// ログイン・招待の受諾の後にどこへ行くか。
// 行き先の判定（PC をつないでいなければ 自分のPCをつなぐ／つないでいれば 今日）は入口（app/page.tsx・D-086）が
// 既に持っている。ここで同じ判定を書かず、入口へ渡す（判定は 1 か所・L-008）。
// 由来：ここが "/today" 決め打ちだったため、はじめの設定を 1 つも終えていない人が 404 に落ちていた。
import type { Route } from "next";

export function afterLogin(next?: string | null): Route {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next as Route;
  return "/" as Route; // 入口が今の時点を見て振り分ける
}

// K-694 ナレッジの管理の一覧の登録。後ろの葉は 1 行足すだけ（K-696 は { key: "review", View: ReviewAdmin } を足す）。
//   登録の無い一覧の入口は押せない形（isListReady）で出す
import type { ComponentType } from "react";
import { ApprovalsAdmin } from "./admin-main";
import { ReviewAdmin } from "./review-admin";
import type { AdminListKey } from "./approvals-shape";
import type { TreeAnswer } from "./shape";

/** 管理の一覧が入れ物から受け取る物 */
export interface AdminCtx {
  tree: TreeAnswer | undefined;
  go: (href: string) => void;
  /** 読み直す（木・ページ） */
  reload: (what?: { tree?: boolean; page?: boolean }) => void;
  /** お知らせ（失敗は type: "error"） */
  notify: (text: string, o?: { type?: "info" | "error" }) => void;
}

export interface AdminListEntry {
  key: AdminListKey;
  View: ComponentType<AdminCtx>;
}

export const ADMIN_LISTS: readonly AdminListEntry[] = [
  { key: "approvals", View: ApprovalsAdmin },
  { key: "review", View: ReviewAdmin },
];

/** 登録のある一覧の鍵 */
export const registeredLists = (): AdminListKey[] => ADMIN_LISTS.map((l) => l.key);

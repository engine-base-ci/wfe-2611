// 段 11 の口ごとのファイルの約束（K-800）。index.ts が口ごとの run を (a) => run({ d, a }) にして束ねる。
//   後ろの葉（K-802〜K-815・K-848）は自分の口のファイルだけを本物にする（ready を true に・run を差し替える）。
//   名前と形を変えるときは後ろの葉の md と試験の頭を一緒に直す
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { AdminDeps } from "./deps.js";

export interface AdminCtx {
  d: AdminDeps;
  a: HookArgs;
}
export type AdminOp = (c: AdminCtx) => Promise<HookReply>;

/** まだ作っていない口（空の形・501・NOT_IMPLEMENTED）。入口の共通（401・403・本人確認・429・uuid の道の値・strict の形）は先に効く */
export const notReady: AdminOp = async () => ({
  status: 501,
  body: { error: "not_implemented", code: "NOT_IMPLEMENTED", message: "契約にある口だが、まだ作っていない" },
});

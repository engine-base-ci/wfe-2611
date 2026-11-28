// 段 6 の承認の残りの口（止める・取り下げる・自分で直す・決めた履歴・次は誰が直すか）の試験が使う手助け（K-732 が持ち込む。K-733・K-742・K-744・K-748・K-750 が使う）。
//   土台は K-63 の F5/approve-complete.harness.ts（本物の DB・本物の PC の印・承認待ちの種）。口の登録は葉ごとの hooks のファイル
//   （apps/api/src/hooks/approval-stop.ts・approval-withdraw.ts・approval-edit.ts・approval-history.ts の register・K-326）で、その口を最初に叩くときに 1 回だけ読んで harness の hooks に足す。
//   準備で読まないのは、実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import { auth, f, hooks, limits, req } from "./approve-complete.harness.js";

const HOOKS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "hooks");
const loaded = new Map<string, Promise<void>>();
/** 葉の hooks のファイル（拡張子なし）の register を 1 回だけ読んで足し、この試験が 1 人で何度も押す口の上限を上げる（上限そのものは各葉の「上限」の行だけが確かめる） */
export const loadHook = (file: string, ...ops: string[]): Promise<void> => {
  let p = loaded.get(file);
  if (!p) {
    p = (async () => {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
      for (const op of ops) limits[op] = 100_000;
    })();
    loaded.set(file, p);
  }
  return p;
};

const post = (p: Person, path: string, body: unknown) => req("POST", path, { body, headers: auth(p) });
export const stopApproval = async (p: Person, id: string, body: unknown = {}) => {
  await loadHook("approval-stop", "stopApproval");
  return post(p, `/approvals/${id}/stop`, body);
};
export const withdrawApproval = async (p: Person, id: string, body: unknown = {}) => {
  await loadHook("approval-withdraw", "withdrawApproval");
  return post(p, `/approvals/${id}/withdraw`, body);
};
export const editApproval = async (p: Person, id: string, body: unknown) => {
  await loadHook("approval-edit", "editApproval");
  return post(p, `/approvals/${id}/edit`, body);
};
export const history = async (p: Person, q = "") => {
  await loadHook("approval-history", "listApprovalHistory");
  return req("GET", `/approvals/history${q}`, { headers: auth(p) });
};
/** 差し戻す（K-163・K-744）と承認待ちの一覧（K-161・K-748）は前からの口（approveHooks）。上限だけ上げる */
export const returnTo = (p: Person, id: string, body: unknown) => {
  limits["returnApproval"] = 100_000;
  return post(p, `/approvals/${id}/return`, body);
};
export const queueMore = (p: Person, q = "") => {
  limits["listApprovalQueue"] = 100_000;
  return req("GET", `/approvals/queue${q}`, { headers: auth(p) });
};

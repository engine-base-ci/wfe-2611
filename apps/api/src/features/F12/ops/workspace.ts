// 運営が 1 社を読む口（K-966・関門 C2・D-156.3・D-156.12・D-156.17）：
//   getOpsWorkspace（GET /api/v1/ops/workspaces/:id）… いまの状態の 14 欄（K-1006）
//   listOpsWorkspaceMembers（GET /api/v1/ops/workspaces/:id/members）… メンバーの 8 欄の並び（K-1006）
//   読むだけ（DB に書かない・運営の記録も書かない）。振る舞いの本体は DB の関数 app.ops_workspace・app.ops_workspace_members
//   （20261128010600_ops_workspace.sql）。上限・認証・運営の人だけ（ops:any／ops:inquiry）・道の id の形は契約の入口（op.ts）が先に確かめる。
//   ここでも id の形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。DB の断りは opsErrorReply（K-947）：
//   できることが無い 403・指した会社が無い／見えない 404（欄なし）・ほか 503 E-PAGE-003
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

type OpsWorkspaceFn = "ops_workspace" | "ops_workspace_members";
/** 呼ぶ関数ごとの SQL（関数名を SQL の文字に埋め込まない・G10） */
const READ_SQL: Readonly<Record<OpsWorkspaceFn, string>> = {
  ops_workspace: "select app.ops_workspace($1::uuid) as j",
  ops_workspace_members: "select app.ops_workspace_members($1::uuid) as j",
};

/** 道の id が uuid でなければ 422（欄 id）。入口が先に止めるので、ここに来るのは入口が抜けたときだけ */
function badId(id: string): HookReply | null {
  if (isUuid(id)) return null;
  return {
    status: 422,
    body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "id", message: "uuid" }] },
  };
}

/** 運営の文脈の 1 取引で app.<fn>(会社) を 1 回呼び、その答え（jsonb）を data にして返す */
function readOne(appPool: pg.Pool, fn: OpsWorkspaceFn): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = a.id ?? a.c.req.param("id") ?? "";
    const bad = badId(id);
    if (bad) return bad;
    try {
      const data = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: unknown }>(READ_SQL[fn], [id]);
        return r.rows[0]!.j;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, fn === "ops_workspace" ? "workspace" : "workspace_members");
    }
  };
}

export function createGetOpsWorkspace(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return readOne(appPool, "ops_workspace");
}

export function createListOpsWorkspaceMembers(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return readOne(appPool, "ops_workspace_members");
}

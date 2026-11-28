// 運営が 1 社を止める（stopWorkspace・POST /api/v1/ops/workspaces/:id/stop）・再開する（resumeWorkspace・POST …/resume）（K-970・関門 C2・D-156.23・D-125.126）。
//   振る舞いの本体は DB の関数 app.ops_workspace_stop・app.ops_workspace_resume（20261128011000_ops_stop.sql）。
//   上限・認証・止める（ops:stop）を持つ運営の人だけ・本人確認の取り直し（step_up always）・入力の形と組み合わせ（INPUT_RULES）・:id の形は
//   契約の入口（op.ts）が先に確かめる。ここでは opsTx の 1 取引で関数を 1 回呼び、関数の断りを 409 の番号に直す。DB の断りは opsErrorReply（K-947）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

/** 関数の断り（{ error }）→ 409 の番号（欄なし） */
const CONFLICTS: Readonly<Record<string, string>> = {
  already_stopping: "E-OPS-003",
  not_stopped: "E-OPS-004",
  stop_on_past: "E-OPS-006",
};

type FnAnswer = { data?: unknown; error?: string };

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

const reply = (j: FnAnswer): HookReply => {
  if (j.error !== undefined) {
    const code = CONFLICTS[j.error];
    if (code === undefined) throw new Error("止める関数が知らない断りを返した");
    return { status: 409, body: { error: "conflict", code } };
  }
  return { status: 201, body: { data: j.data } };
};

const call = (appPool: pg.Pool, where: string, sql: string, params: (a: HookArgs) => unknown[]) => {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      const j = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: FnAnswer }>(sql, params(a));
        return r.rows[0]!.j;
      });
      return reply(j); // 知らない断りは投げて 503 に倒す（ふつうを返さない）
    } catch (e) {
      return opsErrorReply(e, where);
    }
  };
};

export function createStopWorkspace(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return call(appPool, "stop", "select app.ops_workspace_stop($1, $2, $3, $4::date, $5, $6) as j", (a) => [
    a.id,
    str(a.input["reason_key"]),
    str(a.input["mode"]),
    str(a.input["stop_on"]),
    str(a.input["note"]),
    str(a.input["admin_notice"]),
  ]);
}

export function createResumeWorkspace(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return call(appPool, "stop", "select app.ops_workspace_resume($1, $2) as j", (a) => [a.id, str(a.input["note"])]);
}
